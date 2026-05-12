import React, { useEffect, useMemo, useState } from 'react';
import { 
  Calendar, MapPin, Users, Ticket, 
  Settings, Plus, X, Trash2, Clock, AlignLeft 
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import { getCurrentSession, fetchEventManagementData, createEvent, updateEvent } from '../../services/api';
import {
  normalizeText,
  SQL_MAX_LENGTH,
  isPositiveInteger,
  isNonNegativeNumber,
} from '../../utils/formValidation';

const EventManagementPage = () => {
  const session = getCurrentSession();
  const userRole = session.userRole || 'admin';
  const userId = session.userId;

  const normalizeVenue = (venue) => ({
    id: venue.venue_id,
    name: venue.venue_name,
    city: venue.city,
    seating_type: venue.jenis_seating,
  });

  const normalizeArtist = (artist) => ({
    id: artist.artist_id,
    name: artist.name,
    genre: artist.genre,
  });

  const normalizeEvent = (event) => {
    const eventDate = event.event_datetime ? event.event_datetime.split('T')[0] : '';
    const eventTime = event.event_datetime ? event.event_datetime.split('T')[1]?.substring(0, 5) : '';

    return {
      id: event.event_id,
      event_id: event.event_id,
      title: event.event_title || '',
      event_title: event.event_title || '',
      date: eventDate,
      time: eventTime,
      venue: event.venue_id || '',
      venue_name: event.venue_name || '',
      venue_id: event.venue_id || '',
      organizerName: event.organizer_name || '',
      description: event.description || '',
      artists: Array.isArray(event.artists) ? event.artists : [],
      categories: Array.isArray(event.categories) ? event.categories : [{ name: 'Regular', price: 100000, quota: 100 }],
    };
  };

  // --- DATA MASTER ---
  const [venues, setVenues] = useState([]);
  const [availableArtists, setAvailableArtists] = useState([]);
  
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const loadManagementData = async () => {
      const data = await fetchEventManagementData({ userRole, userId });
      setVenues((data.venues || []).map(normalizeVenue));
      setAvailableArtists((data.artists || []).map(normalizeArtist));
      setEvents((data.events || []).map(normalizeEvent));
    };

    loadManagementData();
  }, [userRole, userId]);

  // --- LOGIK FILTER BERDASARKAN ROLE ---
  const filteredEvents = useMemo(() => events, [events]);

  // --- STATE MODAL & FORM ---
  const [activeModal, setActiveModal] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [formEvent, setFormEvent] = useState({
    id: null,
    title: '', date: '', time: '', venue: '', description: '',
    artists: [],
    categories: [{ name: "Regular", price: 100000, quota: 100 }]
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- HANDLERS ---
  const openCreateModal = () => {
    setFormEvent({
      title: '', date: '', time: '', venue: venues[0]?.id || '', description: '',
      artists: [],
      categories: [{ name: "Regular", price: 100000, quota: 100 }]
    });
    setFormErrors({});
    setSelectedEvent(null);
    setActiveModal('create');
  };

  const openEditModal = (event) => {
    const artistIds = (event.artists || [])
      .map((artist) => artist?.artist_id || artist?.id || artist?.artistId || artist)
      .filter(Boolean)
      .map((artistId) => String(artistId));

    setFormEvent({ 
      id: event.event_id,
      title: event.event_title || '',
      date: event.date || '',
      time: event.time || '',
      venue: event.venue_id || '',
      description: event.description || '',
      artists: artistIds,
      categories: event.categories || [{ name: "Regular", price: 100000, quota: 100 }]
    });
    setSelectedEvent(event);
    setFormErrors({});
    setActiveModal('edit');
  };

  const addCategory = () => {
    setFormEvent({
      ...formEvent,
      categories: [...formEvent.categories, { name: "", price: 0, quota: 0 }]
    });
  };

  const removeCategory = (index) => {
    const updated = formEvent.categories.filter((_, i) => i !== index);
    setFormEvent({ ...formEvent, categories: updated });
  };

  const handleCategoryChange = (index, field, value) => {
    const updated = [...formEvent.categories];
    updated[index][field] = value;
    setFormEvent({ ...formEvent, categories: updated });
  };

  const toggleArtist = (artist) => {
    const artistId = String(artist.id);
    const current = formEvent.artists;
    const updated = current.includes(artistId) 
      ? current.filter(a => a !== artistId) 
      : [...current, artistId];
    setFormEvent({ ...formEvent, artists: updated });
  };

  const handleSaveEvent = async () => {
    const nextErrors = {};

    const title = normalizeText(formEvent.title);
    const venue = normalizeText(formEvent.venue);

    if (!title || title.length > SQL_MAX_LENGTH.EVENT_TITLE) {
      nextErrors.title = `Judul acara wajib diisi (maks ${SQL_MAX_LENGTH.EVENT_TITLE} karakter)`;
    }

    if (!formEvent.date) {
      nextErrors.date = 'Tanggal acara wajib diisi';
    }

    if (!formEvent.time) {
      nextErrors.time = 'Waktu acara wajib diisi';
    }

    if (!venue) {
      nextErrors.venue = 'Venue wajib dipilih';
    }

    formEvent.categories.forEach((cat, index) => {
      const name = normalizeText(cat.name);
      const price = Number(cat.price);
      const quota = Number(cat.quota);

      if (!name || name.length > SQL_MAX_LENGTH.CATEGORY_NAME) {
        nextErrors[`category_name_${index}`] = `Nama kategori wajib diisi (maks ${SQL_MAX_LENGTH.CATEGORY_NAME} karakter)`;
      }

      if (!isNonNegativeNumber(price)) {
        nextErrors[`category_price_${index}`] = 'Harga tiket harus angka >= 0';
      }

      if (!isPositiveInteger(quota)) {
        nextErrors[`category_quota_${index}`] = 'Stok tiket harus bilangan bulat > 0';
      }
    });

    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    // Prepare API payload with proper date/time format
    const datetime = `${formEvent.date}T${formEvent.time}:00`;
    
    const eventData = {
      event_title: title,
      event_datetime: datetime,
      venue_id: formEvent.venue,
      organizer_id: userId || 1,
      description: formEvent.description,
      artists: formEvent.artists
    };

    let result;
    if (activeModal === 'create') {
      result = await createEvent(eventData);
    } else if (activeModal === 'edit' && selectedEvent) {
      result = await updateEvent(selectedEvent.event_id, eventData);
    }

    setIsSubmitting(false);

    if (!result.success) {
      setFormErrors((prev) => ({ ...prev, submit: result.error || 'Gagal menyimpan acara.' }));
      return;
    }

    // Reload events after successful save
    const data = await fetchEventManagementData({ userRole, userId });
    setVenues((data.venues || []).map(normalizeVenue));
    setAvailableArtists((data.artists || []).map(normalizeArtist));
    setEvents((data.events || []).map(normalizeEvent));
    
    setActiveModal(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {userRole === 'admin' ? 'Seluruh Event' : 'Event Saya'}
            </h1>
            <p className="text-slate-500 mt-1 text-sm">
              {userRole === 'admin' 
                ? 'Memantau seluruh aktivitas event dari seluruh organizer.' 
                : 'Kelola publikasi dan kategori tiket acara Anda.'}
            </p>
          </div>
          <button 
            onClick={openCreateModal}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-100 transition-all active:scale-95"
          >
            <Plus size={20} /> Buat Acara
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event) => (
            <div key={event.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md">
              <div className={`h-16 bg-gradient-to-r ${event.gradient || 'from-slate-400 to-slate-500'}`} />
              <div className="p-5 flex-grow flex flex-col">
                <div className="flex justify-between items-start mb-3">
                  <div className="overflow-hidden flex-1">
                    <h3 className="font-bold text-slate-900 line-clamp-1 text-sm">{event.title}</h3>
                    {userRole === 'admin' && (
                       <span className="text-[8px] text-slate-500 font-semibold">{event.organizerName}</span>
                    )}
                  </div>
                  <button onClick={() => openEditModal(event)} className="p-2 text-slate-400 hover:text-blue-600 rounded-lg flex-shrink-0">
                    <Settings size={16} />
                  </button>
                </div>
                
                <div className="space-y-1.5 text-[10px] text-slate-500 font-medium mb-3">
                  <div className="flex items-center gap-2"><Calendar size={12} /> {event.date} {event.time}</div>
                  <div className="flex items-center gap-2"><MapPin size={12} /> {event.venue_name || event.venue}</div>
                </div>

                {/* Artist Section */}
                {event.artists && event.artists.length > 0 && (
                  <div className="mb-3 pb-3 border-t border-slate-100">
                    <p className="text-[8px] font-bold text-slate-400 uppercase mb-1.5">Artist ({event.artists.length})</p>
                    <div className="flex flex-wrap gap-1.5">
                      {event.artists.map((artist, i) => (
                        <span key={i} className="text-[8px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-semibold">
                          {artist.name} <span className="text-purple-500">({artist.role})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ticket Categories Section */}
                {event.categories && event.categories.length > 0 && (
                  <div className="mb-2 pb-2 border-t border-slate-100">
                    <p className="text-[8px] font-bold text-slate-400 uppercase mb-1.5">Kategori Tiket ({event.categories.length})</p>
                    <div className="space-y-1">
                      {event.categories.map((cat, i) => (
                        <div key={i} className="text-[9px] bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100 flex justify-between">
                          <span className="font-semibold">{cat.name}</span>
                          <span className="text-blue-500">Rp{(cat.price / 1000).toLocaleString('id-ID')}K | {cat.quota} tiket</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {filteredEvents.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
              <p className="text-slate-400 font-medium">Belum ada acara yang terdaftar.</p>
            </div>
          )}
        </div>
      </main>

      {/* --- MODAL FORM --- */}
      {activeModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
              <h3 className="text-xl font-bold text-slate-900">
                {activeModal === 'create' ? 'Buat Acara Baru' : 'Edit Acara'}
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            {/* Modal Content - Dua Kolom */}
            <div className="flex flex-col md:flex-row overflow-hidden">
              
              {/* KOLOM KIRI: Informasi Utama */}
              <div className="flex-1 p-6 space-y-5 overflow-y-auto border-b md:border-b-0 md:border-r border-slate-100">
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-4">Informasi Dasar</p>
                
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Judul Acara</label>
                  <input 
                    type="text"
                    value={formEvent.title}
                    maxLength={200}
                    required
                    onChange={(e) => setFormEvent({...formEvent, title: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
                    placeholder="Nama event..."
                  />
                  {formErrors.title && <p className="text-red-500 text-xs mt-1">{formErrors.title}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-2"><Calendar size={13}/> Tanggal</label>
                    <input 
                      type="date" 
                      required
                      value={formEvent.date}
                      onChange={(e) => setFormEvent({...formEvent, date: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none"
                    />
                    {formErrors.date && <p className="text-red-500 text-xs mt-1">{formErrors.date}</p>}
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-2"><Clock size={13}/> Waktu</label>
                    <input 
                      type="time"
                      value={formEvent.time}
                      required
                      onChange={(e) => setFormEvent({...formEvent, time: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none"
                    />
                    {formErrors.time && <p className="text-red-500 text-xs mt-1">{formErrors.time}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-2"><MapPin size={13}/> Venue</label>
                  <select 
                    value={formEvent.venue}
                    onChange={(e) => setFormEvent({...formEvent, venue: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none"
                    required
                  >
                    <option value="">Pilih venue</option>
                    {venues.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name}{v.city ? ` - ${v.city}` : ''}
                      </option>
                    ))}
                  </select>
                  {formErrors.venue && <p className="text-red-500 text-xs mt-1">{formErrors.venue}</p>}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-2"><Users size={13}/> Artist</label>
                  <div className="flex flex-wrap gap-2">
                    {availableArtists.map(artist => (
                      <button
                        key={artist.id}
                        type="button"
                        onClick={() => toggleArtist(artist)}
                        className={`px-3 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                          formEvent.artists.includes(String(artist.id)) 
                          ? 'bg-blue-600 border-blue-600 text-white' 
                          : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300'
                        }`}
                      >
                        {artist.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-2"><AlignLeft size={13}/> Deskripsi</label>
                  <textarea 
                    rows="3"
                    value={formEvent.description}
                    onChange={(e) => setFormEvent({...formEvent, description: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none resize-none"
                    placeholder="Deskripsi singkat acara..."
                  />
                </div>
              </div>

              {/* KOLOM KANAN: Pengaturan Tiket */}
              <div className="flex-1 p-6 space-y-4 overflow-y-auto bg-slate-50/50">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2 text-blue-600">
                    <Ticket size={18} />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">Kategori Tiket</p>
                  </div>
                  <button 
                    type="button"
                    onClick={addCategory}
                    className="text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm transition-all active:scale-95"
                  >
                    <Plus size={14} /> Tambah
                  </button>
                </div>
                
                <div className="space-y-3">
                  {formEvent.categories.map((cat, index) => (
                    <div key={index} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3 relative group animate-in slide-in-from-right-2 duration-200">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Nama Kategori</label>
                          <input 
                            type="text"
                            value={cat.name}
                            onChange={(e) => handleCategoryChange(index, 'name', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white text-xs outline-none transition-all"
                            placeholder="VVIP / Regular..."
                            maxLength={SQL_MAX_LENGTH.CATEGORY_NAME}
                          />
                          {formErrors[`category_name_${index}`] && (
                            <p className="text-red-500 text-[10px] mt-1">{formErrors[`category_name_${index}`]}</p>
                          )}
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Harga (Rp)</label>
                          <input 
                            type="number"
                            value={cat.price}
                            onChange={(e) => handleCategoryChange(index, 'price', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white text-xs outline-none transition-all"
                            min={0}
                          />
                          {formErrors[`category_price_${index}`] && (
                            <p className="text-red-500 text-[10px] mt-1">{formErrors[`category_price_${index}`]}</p>
                          )}
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Stok Tiket</label>
                          <input 
                            type="number"
                            value={cat.quota}
                            onChange={(e) => handleCategoryChange(index, 'quota', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white text-xs outline-none transition-all"
                            min={1}
                          />
                          {formErrors[`category_quota_${index}`] && (
                            <p className="text-red-500 text-[10px] mt-1">{formErrors[`category_quota_${index}`]}</p>
                          )}
                        </div>
                      </div>
                      
                      {formEvent.categories.length > 1 && (
                        <button 
                          type="button"
                          onClick={() => removeCategory(index)}
                          className="absolute -top-2 -right-2 bg-white border border-red-100 text-red-500 p-1.5 rounded-full shadow-sm hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-6 border-t border-slate-100 bg-white flex gap-3">
              <button 
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-all"
              >
                Batal
              </button>
              <button 
                type="button"
                onClick={handleSaveEvent}
                disabled={isSubmitting}
                className="flex-1 px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'Menyimpan...' : (activeModal === 'create' ? 'Publikasikan Acara' : 'Simpan Perubahan')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventManagementPage;
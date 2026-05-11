import React, { useEffect, useMemo, useState } from 'react';
import { Search, MapPin, Users, Ticket, Settings, Plus, X, AlertTriangle } from 'lucide-react';
import Navbar from '../../components/Navbar';
import { fetchVenues, createVenue, updateVenue } from '../../services/api';
import {
  normalizeText,
  SQL_MAX_LENGTH,
  isPositiveInteger,
} from '../../utils/formValidation';

const VenuePage = () => {
  // --- STATE ---
  const [venues, setVenues] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("Semua Kota");
  const [selectedSeating, setSelectedSeating] = useState("Semua Tipe Seating");

  const [formData, setFormData] = useState({
    name: "",
    seating_type: "RESERVED_SEATING",
    address: "",
    city: "",
    capacity: "",
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    const loadVenues = async () => {
      const data = await fetchVenues();
      setVenues(data);
    };

    loadVenues();
  }, []);

  // State Modal
  const [activeModal, setActiveModal] = useState(null);
  const [selectedVenue, setSelectedVenue] = useState(null);

  // Role Check
  const userRole = localStorage.getItem('userRole') || 'admin';
  const isAdminOrOrganizer = userRole === 'admin' || userRole === 'organizer';

  // --- LOGIC FILTERING ---
  const filteredVenues = useMemo(() => {
    return venues.filter(venue => {
      const matchesSearch = venue.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           venue.address.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCity = selectedCity === "Semua Kota" || venue.city === selectedCity;
      const matchesSeating = selectedSeating === "Semua Tipe Seating" || venue.seating_type === selectedSeating;
      return matchesSearch && matchesCity && matchesSeating;
    });
  }, [venues, searchQuery, selectedCity, selectedSeating]);

  const stats = {
    total: venues.length,
    reserved: venues.filter(v => v.seating_type === "RESERVED_SEATING").length,
    capacity: venues.reduce((acc, curr) => acc + curr.capacity, 0)
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const normalized = {
      name: normalizeText(formData.name),
      seating_type: normalizeText(formData.seating_type),
      address: normalizeText(formData.address),
      city: normalizeText(formData.city),
      capacity: Number(formData.capacity),
    };

    const nextErrors = {};

    if (!normalized.name || normalized.name.length > SQL_MAX_LENGTH.VENUE_NAME) {
      nextErrors.name = `Nama venue wajib diisi (maks ${SQL_MAX_LENGTH.VENUE_NAME} karakter)`;
    }

    if (!isPositiveInteger(normalized.capacity)) {
      nextErrors.capacity = 'Kapasitas harus bilangan bulat lebih dari 0';
    }

    if (!normalized.city || normalized.city.length > SQL_MAX_LENGTH.CITY) {
      nextErrors.city = `Kota wajib diisi (maks ${SQL_MAX_LENGTH.CITY} karakter)`;
    }

    if (!normalized.address) {
      nextErrors.address = 'Alamat wajib diisi';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    let result;
    if (activeModal === 'create') {
      result = await createVenue(normalized);
    } else if (activeModal === 'edit') {
      result = await updateVenue(normalized);
    }

    if (!result) {
      setErrors((prev) => ({ ...prev, name: 'Gagal menyimpan venue.' }));
      return;
    }

    handleCloseModal();
  };

  // --- HANDLERS ---
  const handleCloseModal = () => {
    setActiveModal(null);
    setSelectedVenue(null);
    setErrors({});
    setFormData({
      name: '',
      seating_type: 'RESERVED_SEATING',
      address: '',
      city: '',
      capacity: '',
    });
  };

  const openCreateModal = () => {
    setFormData({
      name: '',
      seating_type: 'RESERVED_SEATING',
      address: '',
      city: '',
      capacity: '',
    });
    setErrors({});
    setSelectedVenue(null);
    setActiveModal('create');
  };

  const openEditModal = (venue) => {
    setFormData({
      name: venue.name || '',
      seating_type: venue.seating_type || 'RESERVED_SEATING',
      address: venue.address || '',
      city: venue.city || '',
      capacity: String(venue.capacity || ''),
    });
    setErrors({});
    setSelectedVenue(venue);
    setActiveModal('edit');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header & Stats */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Daftar Venue</h1>
              <p className="text-slate-500 mt-1">Kelola dan telusuri lokasi acara yang tersedia</p>
            </div>
            {isAdminOrOrganizer && (
              <button 
                onClick={openCreateModal}
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-200 transition-all active:scale-95"
              >
                <Plus size={20} /> Tambah Venue
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard icon={<MapPin size={22}/>} label="Total Venue" value={stats.total} color="blue" />
            <StatCard icon={<Ticket size={22}/>} label="RESERVED_SEATING" value={stats.reserved} color="amber" />
            <StatCard icon={<Users size={22}/>} label="Total Kapasitas" value={stats.capacity.toLocaleString()} color="emerald" />
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mb-8 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col lg:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari nama atau alamat..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select 
            className="px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none text-sm focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
          >
            <option>Semua Kota</option>
            <option>Jakarta</option>
            <option>Bandung</option>
            <option>Yogyakarta</option>
          </select>
          <select 
            className="px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none text-sm focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
            value={selectedSeating}
            onChange={(e) => setSelectedSeating(e.target.value)}
          >
            <option>Semua Tipe Seating</option>
            <option>RESERVED_SEATING</option>
            <option>FREE_SEATING</option>
          </select>
        </div>

        {/* Grid Venue */}
        {filteredVenues.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVenues.map((venue) => (
              <div key={venue.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-xl font-bold text-slate-800 leading-tight">{venue.name}</h2>
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md whitespace-nowrap ${venue.seating_type === 'RESERVED_SEATING' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                      {venue.seating_type}
                    </span>
                  </div>
                  
                  <div className="space-y-3 mb-6">
                    <div className="flex items-start gap-3">
                      <MapPin size={18} className="text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-slate-600 leading-relaxed">{venue.address}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-tight">{venue.city}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-slate-600">
                      <Users size={18} className="text-slate-400 shrink-0" />
                      <p className="text-sm">Kapasitas: <span className="font-bold text-slate-800">{venue.capacity.toLocaleString()}</span></p>
                    </div>
                  </div>
                </div>

                {isAdminOrOrganizer && (
                  <div className="flex gap-2 pt-4 border-t border-slate-50">
                    <button 
                      onClick={() => openEditModal(venue)}
                      className="flex-grow flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-600 py-2.5 rounded-lg text-sm font-bold transition-colors"
                    >
                      <Settings size={16} /> Edit
                    </button>
                    <button 
                      onClick={() => { setSelectedVenue(venue); setActiveModal('delete'); }}
                      className="px-3 bg-red-50 hover:bg-red-100 text-red-600 py-2.5 rounded-lg text-sm font-bold transition-colors"
                    >
                      Hapus
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200 text-slate-400 font-medium">
            Tidak ada venue ditemukan.
          </div>
        )}
      </main>

      {/* --- MODAL CREATE / EDIT --- */}
      {(activeModal === 'create' || activeModal === 'edit') && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
              <h3 className="text-xl font-bold text-slate-900">
                {activeModal === 'create' ? 'Tambah Venue Baru' : 'Edit Venue'}
              </h3>
              <button onClick={handleCloseModal} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <form className="p-6 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nama Venue</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="Contoh: Stadion Utama"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  required
                  maxLength={SQL_MAX_LENGTH.VENUE_NAME}
                />
                {errors.name && <p className="text-red-500 text-xs">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Kapasitas</label>
                  <input 
                    type="number"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="0"
                    value={formData.capacity}
                    onChange={(e) => setFormData((prev) => ({ ...prev, capacity: e.target.value }))}
                    min={1}
                    required
                  />
                  {errors.capacity && <p className="text-red-500 text-xs">{errors.capacity}</p>}
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Kota</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="Contoh: Jakarta"
                    maxLength={SQL_MAX_LENGTH.CITY}
                    value={formData.city}
                    onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                    required
                  />
                  {errors.city && <p className="text-red-500 text-xs">{errors.city}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Alamat Lengkap</label>
                <textarea 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all"
                  rows="3"
                  placeholder="Jl. Nama Jalan No. 123..."
                  value={formData.address}
                  onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                  required
                />
                {errors.address && <p className="text-red-500 text-xs">{errors.address}</p>}
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-700">Has Reserved Seating</span>
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Aktifkan pengaturan kursi</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={formData.seating_type === 'RESERVED_SEATING'}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        seating_type: e.target.checked ? 'RESERVED_SEATING' : 'FREE_SEATING',
                      }))
                    }
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all"
                >
                  {activeModal === 'create' ? 'Simpan Venue' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL DELETE --- */}
      {activeModal === 'delete' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Hapus Venue?</h3>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              Anda akan menghapus <span className="font-bold text-slate-800">"{selectedVenue?.name}"</span>. Data yang dihapus tidak dapat dikembalikan.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={handleCloseModal}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
              >
                Batal
              </button>
              <button 
                className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-lg shadow-red-100 transition-all"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- HELPER SUB-COMPONENTS ---
const StatCard = ({ icon, label, value, color }) => {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 transition-transform hover:scale-[1.02]">
      <div className={`p-3 rounded-xl ${colorMap[color]}`}>{icon}</div>
      <div>
        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{label}</p>
        <h3 className="text-2xl font-bold text-slate-900 leading-none mt-1">{value}</h3>
      </div>
    </div>
  );
};

export default VenuePage;
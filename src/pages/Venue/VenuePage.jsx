import React, { useEffect, useMemo, useState } from 'react';
import { Search, MapPin, Users, Ticket, Settings, Plus, X, AlertTriangle } from 'lucide-react';
import Navbar from '../../components/Navbar';
import { fetchVenues, createVenue, updateVenue } from '../../services/api';
import {
  normalizeText,
  SQL_MAX_LENGTH,
  isPositiveInteger,
} from '../../utils/formValidation';
import StatCard from '../../components/ui/StatCard';
import PanelCard from '../../components/ui/PanelCard';

const VenuePage = () => {
  // --- STATE ---
  const [venues, setVenues] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // Tambahan state loading

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
      setIsLoading(true); // Set loading ke true saat mulai fetch
      const data = await fetchVenues();
      
      // Transform API response to expected format
      const transformed = (data || []).map(venue => ({
        id: venue.venue_id,
        name: venue.venue_name || 'Venue tanpa nama',
        address: venue.address || '',
        city: venue.city || '',
        capacity: venue.capacity || 0,
        seating_type: venue.jenis_seating || 'FREE_SEATING'
      }));
      
      setVenues(transformed);
      setIsLoading(false); // Set loading ke false setelah selesai
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
    if (!venues || venues.length === 0) return [];
    
    return venues.filter(venue => {
      const nameSafe = (venue.name || '').toLowerCase();
      const addressSafe = (venue.address || '').toLowerCase();
      const citySafe = venue.city || '';
      const seatingTypeSafe = venue.seating_type || 'FREE_SEATING';
      
      const matchesSearch = nameSafe.includes(searchQuery.toLowerCase()) ||
                           addressSafe.includes(searchQuery.toLowerCase());
      const matchesCity = selectedCity === "Semua Kota" || citySafe === selectedCity;
      const matchesSeating = selectedSeating === "Semua Tipe Seating" || seatingTypeSafe === selectedSeating;
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
            {Array.from(new Set(venues.filter(v => v.city).map(v => v.city))).map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
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

        {/* Grid Venue & Skeleton */}
        {isLoading ? (
          /* SKELETON SCREEN SECTION */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between animate-pulse">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="h-6 bg-slate-200 rounded w-1/2"></div>
                    <div className="h-5 bg-slate-200 rounded w-24"></div>
                  </div>
                  
                  <div className="space-y-4 mb-6">
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 bg-slate-200 rounded-full shrink-0"></div>
                      <div className="w-full">
                        <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-slate-200 rounded w-1/3"></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-slate-200 rounded-full shrink-0"></div>
                      <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>

                {isAdminOrOrganizer && (
                  <div className="w-full h-10 bg-slate-200 rounded-lg mt-2"></div>
                )}
              </div>
            ))}
          </div>
        ) : filteredVenues.length > 0 ? (
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
                  <button 
                    onClick={() => openEditModal(venue)}
                    className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 py-2.5 rounded-lg font-bold text-sm transition-all active:scale-95"
                  >
                    <Settings size={16} /> Edit Venue
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
            <AlertTriangle className="mx-auto mb-4 text-slate-400" size={40} />
            <p className="text-slate-400 font-medium">Venue tidak ditemukan.</p>
          </div>
        )}

        {/* Modal Create/Edit Venue */}
        {activeModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <PanelCard className="w-full max-w-md">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">{activeModal === 'create' ? 'Tambah Venue' : 'Edit Venue'}</h2>
                <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name Field */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Nama Venue</label>
                  <input
                    type="text"
                    placeholder="Contoh: Arena Jakarta"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
                </div>

                {/* Address Field */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Alamat</label>
                  <textarea
                    placeholder="Contoh: Jl. Senayan no 1"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    rows="2"
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  {errors.address && <p className="text-xs text-red-600 mt-1">{errors.address}</p>}
                </div>

                {/* City Field */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Kota</label>
                  <input
                    type="text"
                    placeholder="Contoh: Jakarta"
                    value={formData.city}
                    onChange={(e) => setFormData({...formData, city: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  {errors.city && <p className="text-xs text-red-600 mt-1">{errors.city}</p>}
                </div>

                {/* Capacity Field */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Kapasitas</label>
                  <input
                    type="number"
                    placeholder="Contoh: 5000"
                    value={formData.capacity}
                    onChange={(e) => setFormData({...formData, capacity: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  {errors.capacity && <p className="text-xs text-red-600 mt-1">{errors.capacity}</p>}
                </div>

                {/* Seating Type Field */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Tipe Seating</label>
                  <select
                    value={formData.seating_type}
                    onChange={(e) => setFormData({...formData, seating_type: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="RESERVED_SEATING">Reserved Seating</option>
                    <option value="FREE_SEATING">Free Seating</option>
                  </select>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all active:scale-95"
                  >
                    Simpan
                  </button>
                </div>
              </form>
            </PanelCard>
          </div>
        )}
      </main>
    </div>
  );
};

export default VenuePage;
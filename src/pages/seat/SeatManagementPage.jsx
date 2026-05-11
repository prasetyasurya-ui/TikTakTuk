import React, { useState, useEffect, useMemo } from 'react';
import { Search, Pencil, Trash2, X, Plus, Armchair, Building2, Loader2, CheckCircle2, XCircle } from 'lucide-react';

// Components (Update these 3)
import Navbar from '../../components/Navbar';
import PanelCard from '../../components/ui/PanelCard';
import StatCard from '../../components/ui/StatCard';

// Services & API (Update these 2)
import { getCurrentSession } from '../../services/api';
import {
  fetchSeatsManagementData,
  createSeat,
  updateSeat,
  deleteSeat
} from '../../services/api/seatApi';

function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <PanelCard className="w-full max-w-md p-6 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-2 rounded-lg hover:bg-slate-50 text-slate-600"
        >
          <X size={18} />
        </button>
        <h2 className="text-lg font-black tracking-tight text-slate-900 mb-4">{title}</h2>
        {children}
      </PanelCard>
    </div>
  );
}

const SeatManagementPage = () => {
  const session = getCurrentSession();
  const canEdit = session.userRole === 'admin' || session.userRole === 'organizer';

  const [seats, setSeats] = useState([]);
  const [venues, setVenues] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [venueFilter, setVenueFilter] = useState('');
  const [banner, setBanner] = useState(null);

  // Modal State
  const [modalConfig, setModalConfig] = useState({ type: null, seat: null });
  const [formData, setFormData] = useState({ venueId: '', section: '', rowNumber: '', seatNumber: '' });

  const loadData = async () => {
    setIsLoading(true);
    const data = await fetchSeatsManagementData();
    setSeats(data.seats);
    setVenues(data.venues);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Stats calculation
  const stats = useMemo(() => {
    const total = seats.length;
    const occupied = seats.filter(s => s.status === 'TERISI').length;
    const available = seats.filter(s => s.status === 'TERSEDIA').length;
    return { total, occupied, available };
  }, [seats]);

  // Filtering
  const filteredSeats = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return seats.filter(seat => {
      const matchSearch =
        seat.section.toLowerCase().includes(q) ||
        seat.rowNumber.toLowerCase().includes(q) ||
        seat.seatNumber.toLowerCase().includes(q);
      const matchVenue = venueFilter === '' || seat.venueId === venueFilter;
      return matchSearch && matchVenue;
    });
  }, [seats, searchQuery, venueFilter]);

  // Form Handlers
  const openCreateModal = () => {
    setFormData({ venueId: venues[0]?.id || '', section: '', rowNumber: '', seatNumber: '' });
    setModalConfig({ type: 'create', seat: null });
  };

  const openUpdateModal = (seat) => {
    setFormData({
      venueId: seat.venueId,
      section: seat.section,
      rowNumber: seat.rowNumber,
      seatNumber: seat.seatNumber
    });
    setModalConfig({ type: 'update', seat });
  };

  const handleFormSubmit = async () => {
    setBanner(null);
    let result;

    if (modalConfig.type === 'create') {
      result = await createSeat(formData);
    } else {
      result = await updateSeat(modalConfig.seat.id, formData);
    }

    if (!result.ok) {
      setBanner({ type: 'error', message: result.message });
      return;
    }

    setBanner({ type: 'success', message: result.message });
    setModalConfig({ type: null, seat: null });
    loadData(); // Refresh table
  };

  const handleDelete = async () => {
    setBanner(null);
    const result = await deleteSeat(modalConfig.seat.id);

    if (!result.ok) {
      setBanner({ type: 'error', message: result.message });
      setModalConfig({ type: null, seat: null });
      return;
    }

    setBanner({ type: 'success', message: result.message });
    setModalConfig({ type: null, seat: null });
    loadData();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Manajemen Kursi</h1>
            <p className="text-slate-500 mt-1">Kelola kursi dan denah tempat duduk venue</p>
          </div>
          {canEdit && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
            >
              <Plus size={18} /> Tambah Kursi
            </button>
          )}
        </div>

        {/* Banner Messages */}
        {banner && (
          <div className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-bold flex items-center gap-2 ${
            banner.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}>
            {banner.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            {banner.message}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <StatCard label="Total Kursi" value={stats.total} />
          <StatCard label="Tersedia" value={stats.available} />
          <StatCard label="Terisi" value={stats.occupied} />
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              type="text"
              placeholder="Cari section, baris, atau nomor..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all shadow-sm bg-white"
            />
          </div>
          <select
            value={venueFilter}
            onChange={(e) => setVenueFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white outline-none text-sm cursor-pointer md:w-64 shadow-sm"
          >
            <option value="">Semua Venue</option>
            {venues.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <PanelCard className="overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
          ) : filteredSeats.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-medium">
              Tidak ada kursi yang ditemukan.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
                    <th className="text-left px-6 py-4">Section</th>
                    <th className="text-left px-6 py-4">Baris</th>
                    <th className="text-left px-6 py-4">No. Kursi</th>
                    <th className="text-left px-6 py-4">Venue</th>
                    <th className="text-left px-6 py-4">Status</th>
                    {canEdit && <th className="text-right px-6 py-4 w-24">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSeats.map((seat) => (
                    <tr key={seat.id} className="bg-white hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-blue-600 flex items-center gap-2">
                        <Armchair size={14} className="text-blue-400" /> {seat.section}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-700">{seat.rowNumber}</td>
                      <td className="px-6 py-4 font-semibold text-slate-700">{seat.seatNumber}</td>
                      <td className="px-6 py-4 text-slate-500 font-medium flex items-center gap-2">
                        <Building2 size={14} className="text-slate-400" /> {seat.venueName}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest border ${
                          seat.status === 'TERSEDIA'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {seat.status === 'TERSEDIA' ? <CheckCircle2 size={12}/> : <XCircle size={12}/>}
                          {seat.status}
                        </span>
                      </td>
                      {canEdit && (
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openUpdateModal(seat)}
                              className="p-1.5 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => setModalConfig({ type: 'delete', seat })}
                              disabled={seat.status === 'TERISI'}
                              className={`p-1.5 rounded-md transition-colors ${
                                seat.status === 'TERISI'
                                  ? 'text-slate-300 cursor-not-allowed'
                                  : 'hover:bg-rose-100 text-slate-400 hover:text-rose-600'
                              }`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PanelCard>

      </main>

      {/* CREATE / UPDATE MODAL */}
      {(modalConfig.type === 'create' || modalConfig.type === 'update') && (
        <ModalShell
          title={modalConfig.type === 'create' ? 'Tambah Kursi Baru' : 'Edit Kursi'}
          onClose={() => setModalConfig({ type: null, seat: null })}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Venue</label>
              <select
                value={formData.venueId}
                onChange={e => setFormData({...formData, venueId: e.target.value})}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white outline-none text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="" disabled>Pilih Venue</option>
                {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Section</label>
              <input
                type="text"
                placeholder="cth. WVIP"
                value={formData.section}
                onChange={e => setFormData({...formData, section: e.target.value})}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Baris</label>
                <input
                  type="text"
                  placeholder="cth. A"
                  value={formData.rowNumber}
                  onChange={e => setFormData({...formData, rowNumber: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">No. Kursi</label>
                <input
                  type="text"
                  placeholder="cth. 1"
                  value={formData.seatNumber}
                  onChange={e => setFormData({...formData, seatNumber: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4 mt-2 border-t border-slate-100">
              <button
                onClick={() => setModalConfig({ type: null, seat: null })}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleFormSubmit}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-md shadow-blue-200"
              >
                {modalConfig.type === 'create' ? 'Tambah' : 'Simpan'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* DELETE MODAL */}
      {modalConfig.type === 'delete' && (
        <ModalShell title="Hapus Kursi" onClose={() => setModalConfig({ type: null, seat: null })}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus kursi ini? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setModalConfig({ type: null, seat: null })}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 transition-colors shadow-md shadow-rose-200"
              >
                Hapus
              </button>
            </div>
          </div>
        </ModalShell>
      )}

    </div>
  );
};

export default SeatManagementPage;
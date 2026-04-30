import React, { useState, useEffect } from "react";
import { Search, Calendar, MapPin, Pencil, Trash2, Ticket, Loader2, CheckCircle2, XCircle, Plus } from "lucide-react";

import Navbar from "../../components/Navbar";
import PanelCard from "../../components/ui/PanelCard";
import StatCard from "../../components/ui/StatCard";
import { getCurrentSession } from "../../services/api";
import {
  fetchManageTicketsData,
  fetchAvailableSeatsForTicket,
  updateTicket,
  deleteTicket
} from "../../services/api/ticketManagementApi";

function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <PanelCard className="w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-600"
        >
          ✕
        </button>
        <h2 className="text-lg font-black tracking-tight text-slate-900 mb-6">{title}</h2>
        {children}
      </PanelCard>
    </div>
  );
}

const TicketManagementPage = () => {
  const session = getCurrentSession();
  // Safe check for admin role, ensuring it works regardless of capitalization
  const isAdmin = String(session?.userRole || '').toLowerCase() === 'admin';

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua Status');
  const [banner, setBanner] = useState(null);

  // Modal States
  const [modalConfig, setModalConfig] = useState({ type: null, ticket: null });
  const [updateForm, setUpdateForm] = useState({ status: '', seatId: '' });
  const [availableSeats, setAvailableSeats] = useState([]);

  const loadTickets = async () => {
    setLoading(true);
    const data = await fetchManageTicketsData({ userRole: session?.userRole, userId: session?.userId });
    setTickets(data);
    setLoading(false);
  };

  useEffect(() => {
    loadTickets();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter Logic
  const filteredTickets = tickets.filter(ticket => {
    const q = searchQuery.toLowerCase();
    const matchSearch = (ticket.ticketCode || '').toLowerCase().includes(q) ||
                        (ticket.eventName || '').toLowerCase().includes(q) ||
                        (ticket.customerName || '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'Semua Status' || ticket.status === statusFilter.toUpperCase();
    return matchSearch && matchStatus;
  });

  // Stats
  const totalTickets = tickets.length;
  const validTickets = tickets.filter(t => t.status === 'VALID').length;
  const usedTickets = tickets.filter(t => t.status === 'TERPAKAI').length;

  // Handlers
  const openUpdateModal = async (ticket) => {
    setModalConfig({ type: 'update', ticket });
    setUpdateForm({ status: ticket.status, seatId: ticket.seatId });

    // Fetch seats for dropdown
    const seats = await fetchAvailableSeatsForTicket(ticket.venueId, ticket.seatId);
    setAvailableSeats(seats);
  };

  const handleUpdateSubmit = async () => {
    setBanner(null);
    const result = await updateTicket(modalConfig.ticket.id, updateForm);
    if (result.ok) {
      setBanner({ type: 'success', message: result.message });
      setModalConfig({ type: null, ticket: null });
      loadTickets();
    } else {
      setBanner({ type: 'error', message: result.message });
    }
  };

  const handleDeleteSubmit = async () => {
    setBanner(null);
    const result = await deleteTicket(modalConfig.ticket.id);
    if (result.ok) {
      setBanner({ type: 'success', message: result.message });
      setModalConfig({ type: null, ticket: null });
      loadTickets();
    } else {
      setBanner({ type: 'error', message: result.message });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-1">Manajemen Tiket</h1>
            <p className="text-sm text-slate-500">Kelola tiket: tambah, ubah status, dan hapus tiket</p>
          </div>
          {isAdmin && (
            <button className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-full transition-all shadow-sm active:scale-95 text-sm">
              <Plus size={16} /> Tambah Tiket
            </button>
          )}
        </div>

        {/* Banner */}
        {banner && (
          <div className={`rounded-2xl border px-4 py-3 text-sm font-bold flex items-center gap-2 ${
            banner.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}>
            {banner.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            {banner.message}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="TOTAL TIKET" value={totalTickets} />
          <StatCard label="VALID" value={validTickets} />
          <StatCard label="TERPAKAI" value={usedTickets} />
        </div>

        {/* Search and Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Cari kode tiket atau nama acara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white font-medium text-slate-700 text-sm md:w-48"
          >
            <option>Semua Status</option>
            <option>Valid</option>
            <option>Terpakai</option>
            <option>Dibatalkan</option>
          </select>
        </div>

        {/* Ticket List */}
        <div className="space-y-4">
          {loading ? (
             <div className="flex justify-center p-12">
               <Loader2 className="animate-spin text-blue-600" size={32} />
             </div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500 font-medium">Tidak ada tiket yang ditemukan.</p>
            </div>
          ) : (
            filteredTickets.map((ticket) => (
              <PanelCard key={ticket.id} className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white flex-shrink-0">
                    <Ticket size={24} />
                  </div>
                  <div>
                    <div className="flex gap-2 mb-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        ticket.status === 'VALID' ? 'bg-emerald-100 text-emerald-700' :
                        ticket.status === 'TERPAKAI' ? 'bg-slate-100 text-slate-600' :
                        'bg-rose-100 text-rose-700'
                      }`}>
                        {ticket.status}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 uppercase tracking-wider">
                        {ticket.categoryName}
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">{ticket.eventName}</h3>
                    <p className="text-xs text-slate-400 font-mono tracking-wider mt-0.5">{ticket.ticketCode}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-5 gap-x-4 py-4 border-t border-slate-100 mt-2">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Jadwal</p>
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                      <Calendar size={14} className="text-slate-400" />
                      {ticket.date}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Lokasi</p>
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                      <MapPin size={14} className="text-slate-400" />
                      {ticket.location}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Kursi</p>
                    <p className="text-sm font-semibold text-slate-700">{ticket.seatLabel}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Harga</p>
                    <p className="text-sm font-black text-slate-900">{ticket.price}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Order</p>
                    <p className="text-sm font-semibold text-slate-700">{ticket.orderId}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pelanggan</p>
                    <p className="text-sm font-semibold text-slate-700">{ticket.customerName}</p>
                  </div>
                </div>

                {/* ONLY SHOWS FOR ADMIN */}
                {isAdmin && (
                  <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                    <button
                      onClick={() => openUpdateModal(ticket)}
                      className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold px-4 py-2 rounded-lg transition-colors"
                    >
                      <Pencil size={14} /> Update
                    </button>
                    <button
                      onClick={() => setModalConfig({ type: 'delete', ticket })}
                      className="inline-flex items-center gap-1.5 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-bold px-4 py-2 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} /> Hapus
                    </button>
                  </div>
                )}
              </PanelCard>
            ))
          )}
        </div>
      </main>

      {/* UPDATE MODAL */}
      {modalConfig.type === 'update' && modalConfig.ticket && (
        <ModalShell title="Update Tiket" onClose={() => setModalConfig({ type: null, ticket: null })}>
          <div className="space-y-5">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Kode Tiket</label>
              <input
                type="text"
                disabled
                value={modalConfig.ticket.ticketCode}
                className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 text-slate-900 font-bold outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Status</label>
              <select
                value={updateForm.status}
                onChange={e => setUpdateForm({...updateForm, status: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none text-sm focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
              >
                <option value="VALID">Valid</option>
                <option value="TERPAKAI">Terpakai</option>
                <option value="DIBATALKAN">Dibatalkan</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Kursi (opsional)</label>
              <select
                value={updateForm.seatId}
                onChange={e => setUpdateForm({...updateForm, seatId: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none text-sm focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
              >
                <option value="">Tanpa Kursi</option>
                {availableSeats.map(seat => (
                  <option key={seat.id} value={seat.id}>{seat.label}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-4 mt-2">
              <button
                onClick={() => setModalConfig({ type: null, ticket: null })}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleUpdateSubmit}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-md shadow-blue-200 flex justify-center items-center gap-2"
              >
                ✓ Simpan
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* DELETE MODAL */}
      {modalConfig.type === 'delete' && modalConfig.ticket && (
        <ModalShell title="Hapus Tiket" onClose={() => setModalConfig({ type: null, ticket: null })}>
          <div className="space-y-6">
            <p className="text-sm text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus tiket ini? Relasi kursi akan dilepaskan. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setModalConfig({ type: null, ticket: null })}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteSubmit}
                className="flex-1 py-3 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 transition-colors shadow-md shadow-rose-200"
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

export default TicketManagementPage;
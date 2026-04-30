import React, { useState, useEffect } from 'react';
import { Search, Plus, Ticket, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import Navbar from '../../components/Navbar';
import PanelCard from '../../components/ui/PanelCard';
import StatCard from '../../components/ui/StatCard';
import { getCurrentSession } from '../../services/api';
import { fetchTicketAssetsData, fetchCreateTicketFormData, createTicketAsset } from '../../services/api/ticketAssetApi';

function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <PanelCard className="w-full max-w-lg p-6 relative">
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

const TicketAssetPage = () => {
  const session = getCurrentSession();
  const canEdit = session.userRole === 'admin' || session.userRole === 'organizer';

  const [tickets, setTickets] = useState([]);
  const [formData, setFormData] = useState({ orders: [], categories: [], seats: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [banner, setBanner] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSeat, setSelectedSeat] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    const [assetsRes, formRes] = await Promise.all([
      fetchTicketAssetsData({ userRole: session.userRole, userId: session.userId }),
      fetchCreateTicketFormData({ userRole: session.userRole, userId: session.userId })
    ]);

    setTickets(assetsRes);
    setFormData(formRes);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter Table Data
  const filteredTickets = tickets.filter(ticket => {
    const q = searchQuery.toLowerCase();
    return ticket.ticketCode.toLowerCase().includes(q) ||
           ticket.customerName.toLowerCase().includes(q) ||
           ticket.eventName.toLowerCase().includes(q);
  });

  // Dynamic Form Computed Values
  const activeOrderObj = formData.orders.find(o => o.id === selectedOrder);
  const isReservedSeating = activeOrderObj?.seatingType === 'RESERVED_SEATING';

  const availableCategories = formData.categories.filter(c => c.eventId === activeOrderObj?.eventId);
  const availableSeats = formData.seats.filter(s => s.venueId === activeOrderObj?.venueId);

  // Form Handlers
  const handleOrderChange = (e) => {
    setSelectedOrder(e.target.value);
    setSelectedCategory(''); // Reset cascaded fields
    setSelectedSeat('');
  };

  const handleCreateSubmit = async () => {
    setBanner(null);
    const result = await createTicketAsset({
      orderId: selectedOrder,
      categoryId: selectedCategory,
      seatId: selectedSeat || null
    });

    if (!result.ok) {
      setBanner({ type: 'error', message: result.message });
      return;
    }

    setBanner({ type: 'success', message: result.message });
    setIsModalOpen(false);
    setSelectedOrder('');
    setSelectedCategory('');
    setSelectedSeat('');
    loadData(); // Refresh table
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Manajemen Tiket</h1>
            <p className="text-slate-500 mt-1">Kelola data aset tiket pelanggan</p>
          </div>
          {canEdit && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
            >
              <Plus size={18} /> Tambah Tiket
            </button>
          )}
        </div>

        {/* Banner */}
        {banner && (
          <div className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-bold flex items-center gap-2 ${
            banner.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}>
            {banner.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            {banner.message}
          </div>
        )}

        {/* Stats & Search */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <StatCard label="Total Tiket Terbit" value={tickets.length} />

          <div className="md:col-span-2 relative flex items-center">
            <Search className="absolute left-4 text-slate-400" size={18} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              type="text"
              placeholder="Cari kode tiket, nama pelanggan, atau event..."
              className="w-full pl-11 pr-4 py-4 rounded-3xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all shadow-sm bg-white font-medium"
            />
          </div>
        </div>

        {/* Table */}
        <PanelCard className="overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-medium">
              Tidak ada tiket yang ditemukan.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
                    <th className="text-left px-6 py-4">Kode Tiket</th>
                    <th className="text-left px-6 py-4">Customer</th>
                    <th className="text-left px-6 py-4">Event</th>
                    <th className="text-left px-6 py-4">Kategori</th>
                    <th className="text-left px-6 py-4">Kursi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTickets.map((ticket) => (
                    <tr key={ticket.id} className="bg-white hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-slate-900 flex items-center gap-2">
                        <Ticket size={14} className="text-blue-500" /> {ticket.ticketCode}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-700">{ticket.customerName}</td>
                      <td className="px-6 py-4 font-bold text-slate-900">{ticket.eventName}</td>
                      <td className="px-6 py-4">
                        <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-xs font-bold border border-blue-100">
                          {ticket.categoryName}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-medium">{ticket.seatLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PanelCard>

      </main>

      {/* CREATE TICKET MODAL */}
      {isModalOpen && (
        <ModalShell title="Tambah Tiket Baru" onClose={() => setIsModalOpen(false)}>
          <div className="space-y-5">

            {/* Order Dropdown */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Order</label>
              <select
                value={selectedOrder}
                onChange={handleOrderChange}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none text-sm focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="" disabled>Pilih Order</option>
                {formData.orders.map(o => (
                  <option key={o.id} value={o.id}>{o.displayLabel}</option>
                ))}
              </select>
            </div>

            {/* Category Dropdown (Cascaded) */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Kategori Tiket</label>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                disabled={!selectedOrder}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none text-sm focus:ring-2 focus:ring-blue-500 font-medium disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="" disabled>Pilih Kategori</option>
                {availableCategories.map(c => (
                  <option key={c.id} value={c.id} disabled={c.isFull}>
                    {c.displayLabel}
                  </option>
                ))}
              </select>
            </div>

            {/* Seat Dropdown (Conditional) */}
            {isReservedSeating && (
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Kursi (opsional — reserved seating)</label>
                <select
                  value={selectedSeat}
                  onChange={e => setSelectedSeat(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none text-sm focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="">Pilih Kursi (Kosongkan jika bebas)</option>
                  {availableSeats.map(s => (
                    <option key={s.id} value={s.id}>{s.displayLabel}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Ticket Code Info */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Kode Tiket</label>
              <input
                type="text"
                disabled
                value="Auto-generate saat dibuat"
                className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 outline-none text-sm text-slate-400 font-mono"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 mt-2 border-t border-slate-100">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleCreateSubmit}
                disabled={!selectedOrder || !selectedCategory}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-md shadow-blue-200 disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed"
              >
                Buat Tiket
              </button>
            </div>

          </div>
        </ModalShell>
      )}

    </div>
  );
};

export default TicketAssetPage;
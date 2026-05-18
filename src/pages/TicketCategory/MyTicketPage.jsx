import React, { useState, useEffect } from "react";
import { Search, Calendar, MapPin, QrCode, Download, Share2, Ticket, Loader2 } from "lucide-react";

// Components
import Navbar from "../../components/Navbar";
import PanelCard from "../../components/ui/PanelCard";

// Services & API
import { getCurrentSession } from "../../services/api";
import { fetchManageTicketsData } from "../../services/api/ticketManagementApi";

const MyTicketsPage = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua Status');

  useEffect(() => {
    const loadMyTickets = async () => {
      try {
        setLoading(true);
        const session = getCurrentSession();

        const userTickets = await fetchManageTicketsData({
          userRole: session?.userRole,
          userId: session?.userId
        });

        const normalizedTickets = (Array.isArray(userTickets) ? userTickets : []).map((ticket) => ({
          id: ticket.ticketCode,
          eventName: ticket.eventName || 'Unknown Event',
          status: ticket.status || 'PENDING',
          category: ticket.categoryName || '-',
          date: ticket.date || '-',
          location: ticket.location || '-',
          price: ticket.price || new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            maximumFractionDigits: 0
          }).format(0),
          orderId: ticket.orderId || '-',
          seat: ticket.seatLabel || 'Free Seating',
          customerName: ticket.customerName || 'Customer'
        }));

        setTickets(normalizedTickets);
      } catch (error) {
        console.error("Failed to load tickets:", error);
      } finally {
        setLoading(false);
      }
    };

    loadMyTickets();
  }, []);

  // Derived state for the summary cards
  const totalTickets = tickets.length;
  const validTickets = tickets.filter(t => t.status === 'VALID').length;
  const usedTickets = tickets.filter(t => t.status === 'TERPAKAI').length;

  // Filter logic
  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.eventName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          ticket.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'Semua Status' || ticket.status === statusFilter.toUpperCase();
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <Navbar />
        <main className="max-w-5xl mx-auto px-4 py-20 flex justify-center items-center">
          <Loader2 className="animate-spin text-blue-600" size={40} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">

        {/* Header Section */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-1">Tiket Saya</h1>
          <p className="text-sm text-slate-500">Kelola dan akses tiket pertunjukan Anda</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PanelCard className="p-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Total Tiket</p>
            <p className="text-3xl font-black text-slate-900">{totalTickets}</p>
          </PanelCard>
          <PanelCard className="p-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Valid</p>
            <p className="text-3xl font-black text-slate-900">{validTickets}</p>
          </PanelCard>
          <PanelCard className="p-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Terpakai</p>
            <p className="text-3xl font-black text-slate-900">{usedTickets}</p>
          </PanelCard>
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
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white font-medium text-slate-700"
          >
            <option>Semua Status</option>
            <option>Valid</option>
            <option>Pending</option>
            <option>Terpakai</option>
          </select>
        </div>

        {/* Ticket List */}
        <div className="space-y-4">
          {filteredTickets.map((ticket) => (
            <PanelCard key={ticket.id} className="p-6 flex flex-col md:flex-row gap-6">

              {/* Left/Main Ticket Info */}
              <div className="flex-grow space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white flex-shrink-0">
                    <Ticket size={24} />
                  </div>
                  <div>
                    <div className="flex gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        ticket.status === 'VALID' ? 'bg-green-100 text-green-700' :
                        ticket.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {ticket.status}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                        {ticket.category}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">{ticket.eventName}</h3>
                    <p className="text-xs text-slate-400 font-mono">{ticket.id}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-2 pt-4 border-t border-slate-100">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Jadwal</p>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                      <Calendar size={14} className="text-slate-400" />
                      {ticket.date}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Lokasi</p>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                      <MapPin size={14} className="text-slate-400" />
                      {ticket.location}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Kursi</p>
                    <p className="text-sm font-medium text-slate-700">{ticket.seat}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Harga</p>
                    <p className="text-sm font-bold text-slate-900">{ticket.price}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Order</p>
                    <p className="text-sm font-medium text-slate-700">{ticket.orderId}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Pelanggan</p>
                    <p className="text-sm font-medium text-slate-700">{ticket.customerName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    disabled={ticket.status !== 'VALID'}
                    className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
                  >
                    <QrCode size={14} /> Tampilkan QR
                  </button>
                  <button className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
                    <Download size={16} />
                  </button>
                  <button className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
                    <Share2 size={16} />
                  </button>
                </div>
              </div>

              {/* Right QR Code Section */}
              <div className="hidden md:flex flex-col items-center justify-center bg-slate-50 p-6 rounded-xl border border-slate-100 min-w-[160px]">
                <QrCode size={64} className={ticket.status === 'VALID' ? "text-slate-800 mb-3" : "text-slate-300 mb-3"} />
                <p className="text-[10px] font-bold text-slate-400 tracking-widest">
                  {ticket.status === 'VALID' ? 'SCAN ENTRY' : 'UNAVAILABLE'}
                </p>
              </div>

            </PanelCard>
          ))}

          {filteredTickets.length === 0 && !loading && (
            <div className="text-center py-12">
              <p className="text-slate-500">Tidak ada tiket yang ditemukan.</p>
            </div>
          )}
        </div>

      </main>
    </div>
  );
};

export default MyTicketsPage;

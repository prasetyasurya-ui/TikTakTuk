import React, { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import { fetchCustomerDashboard } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const FALLBACK_CUSTOMER = {
  nama: 'User',
  stats: {
    tiket_aktif: 0,
    acara_diikuti: 0,
    promo_tersedia: 0,
    total_belanja_bulan_ini: 'Rp 0',
  },
  upcoming_tickets: [],
};

const CustomerDashboard = () => {
  const { session } = useAuth();

  const [customer, setCustomer] = useState({
    nama: 'User',
    stats: {
      tiket_aktif: 0,
      acara_diikuti: 0,
      promo_tersedia: 0,
      total_belanja_bulan_ini: 'Rp 0',
    },
    upcoming_tickets: [],
  });

  useEffect(() => {
    const loadCustomerDashboard = async () => {
      if (!session?.userId) {
        setCustomer(FALLBACK_CUSTOMER);
        return;
      }

      const data = await fetchCustomerDashboard(session.userId);
      setCustomer(data || FALLBACK_CUSTOMER);
    };

    loadCustomerDashboard();
  }, [session?.userId]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        {/* Header: Nama User */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900">Halo, {customer.nama}!</h1>
          <p className="text-slate-500 mt-1">Berikut adalah ringkasan aktivitas pertunjukkan Anda.</p>
        </div>

        {/* Section: Ringkasan Statistik */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tiket Aktif</p>
            <h3 className="text-2xl font-black text-blue-600 mt-1">{customer.stats.tiket_aktif}</h3>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Acara Diikuti</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{customer.stats.acara_diikuti}</h3>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Promo Tersedia</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">{customer.stats.promo_tersedia}</h3>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Belanja Bulan Ini</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{customer.stats.total_belanja_bulan_ini}</h3>
          </div>
        </div>

        {/* Section: Tiket Mendatang */}
        <section>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-900">Tiket Mendatang</h2>
            <button className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors">
              Lihat Semua Tiket →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {customer.upcoming_tickets.map((ticket) => (
              <div key={ticket.id} className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm flex flex-col sm:flex-row">
                {/* Visual Accent */}
                <div className="bg-blue-600 sm:w-4 flex items-center justify-center">
                   <div className="hidden sm:block w-px h-1/2 border-l border-dashed border-white/50"></div>
                </div>

                <div className="p-8 flex-grow">
                  <div className="flex justify-between items-start mb-4">
                    <span className="px-3 py-1 bg-blue-50 text-blue-700 text-[10px] font-black uppercase rounded-lg">
                      {ticket.jenis_tiket}
                    </span>
                    <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">{ticket.id}</p>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 mb-4">{ticket.nama_event}</h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-center text-sm text-slate-600 gap-3">
                      <span className="text-lg">📅</span>
                      <div>
                        <p className="font-semibold">{ticket.tanggal_event}</p>
                        <p className="text-xs text-slate-400">{ticket.waktu_mulai}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center text-sm text-slate-600 gap-3">
                      <span className="text-lg">📍</span>
                      <p className="font-medium">{ticket.lokasi_event}</p>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-slate-50">
                    <button className="w-full bg-slate-900 text-white font-bold py-3 rounded-2xl hover:bg-blue-600 transition-all active:scale-95 shadow-lg shadow-slate-200">
                      Tampilkan Barcode
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Empty State Handler */}
          {customer.upcoming_tickets.length === 0 && (
            <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-100">
              <p className="text-slate-400">Tidak ada tiket mendatang. Mulai jelajahi event!</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default CustomerDashboard;
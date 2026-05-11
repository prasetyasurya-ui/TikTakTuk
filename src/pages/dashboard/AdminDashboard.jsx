import React, { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import { fetchAdminDashboard } from '../../services/api';
import PanelCard from '../../components/ui/PanelCard';
import StatCard from '../../components/ui/StatCard';

const AdminDashboard = () => {
  const [adminStats, setAdminStats] = useState({
    platform: {
      total_pengguna: '0',
      total_acara_bulan_ini: '0',
      omzet_platform: 'Rp 0',
      promosi_aktif: '0',
    },
    infrastruktur_venue: {
      total_venue: 0,
      reserved_seating: 0,
      kapasitas_terbesar: '-',
    },
    marketing_promosi: {
      promo_persentase: 0,
      promo_nominal: 0,
      total_penggunaan: '0 kali',
    },
  });

  useEffect(() => {
    const loadAdminDashboard = async () => {
      const data = await fetchAdminDashboard();
      setAdminStats(data);
    };

    loadAdminDashboard();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Navbar />

      <main className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        
        {/* Header Section: System Console Style */}
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-1 text-grey-500 text-[10px] font-black rounded uppercase tracking-widest">
                Administrator
              </span>
            </div>
            <h1 className="text-4xl font-black uppercase">
              System Console
            </h1>
            <p className="text-slate-500 font-medium">Pantau dan kelola platform TikTakTuk secara real-time.</p>
          </div>
          
          <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3 rounded-2xl shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center gap-2">
            Buat Promosi Baru
          </button>
        </header>

        {/* Section 1: Platform Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <StatCard
            label="Total Pengguna"
            value={adminStats.platform.total_pengguna}
            hint="↑ 12% dari bulan lalu"
          />
          <StatCard
            label="Total Acara (Bulan Ini)"
            value={adminStats.platform.total_acara_bulan_ini}
            hint="Running campaigns"
          />
          <StatCard
            label="Omzet Platform (GV)"
            value={adminStats.platform.omzet_platform}
            valueClassName="text-blue-600"
            hint="Gross Volume"
          />
          <StatCard
            label="Promosi Aktif"
            value={adminStats.platform.promosi_aktif}
            valueClassName="text-emerald-600"
            hint="Running campaigns"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Section 2: Infrastruktur Venue */}
          <PanelCard className="overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                Infrastruktur Venue
              </h3>
            </div>
            <div className="p-8 space-y-6 flex-grow">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Total Venue Terdaftar</p>
                  <p className="text-xl font-bold">{adminStats.infrastruktur_venue.total_venue} Lokasi</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Reserved Seating</p>
                  <p className="text-xl font-bold">{adminStats.infrastruktur_venue.reserved_seating} Venue</p>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Kapasitas Terbesar</p>
                <p className="text-sm font-medium text-slate-700">{adminStats.infrastruktur_venue.kapasitas_terbesar}</p>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100">
              <button className="w-full bg-white border border-slate-200 text-slate-700 font-bold py-3 rounded-2xl hover:bg-slate-100 transition-all text-sm">
                Kelola Seluruh Venue
              </button>
            </div>
          </PanelCard>

          {/* Section 3: Marketing & Promosi */}
          <PanelCard className="overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                 Marketing & Promosi
              </h3>
            </div>
            <div className="p-8 space-y-6 flex-grow">
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-blue-50 rounded-2xl">
                  <span className="text-sm font-bold text-blue-900">Promo Persentase (%)</span>
                  <span className="px-3 py-1 bg-blue-600 text-white text-xs font-black rounded-lg">
                    {adminStats.marketing_promosi.promo_persentase} AKTIF
                  </span>
                </div>
                <div className="flex justify-between items-center p-4 bg-emerald-50 rounded-2xl">
                  <span className="text-sm font-bold text-emerald-900">Potongan Nominal (Rp)</span>
                  <span className="px-3 py-1 bg-emerald-600 text-white text-xs font-black rounded-lg">
                    {adminStats.marketing_promosi.promo_nominal} AKTIF
                  </span>
                </div>
              </div>
              <div className="pt-2 flex justify-between items-center">
                <p className="text-[10px] font-black text-slate-400 uppercase">Total Penggunaan Promo</p>
                <p className="font-black text-slate-900">{adminStats.marketing_promosi.total_penggunaan}</p>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100">
              <button className="w-full bg-slate-900 text-white font-bold py-3 rounded-2xl hover:bg-blue-600 transition-all text-sm">
                Buka Manager Promosi
              </button>
            </div>
          </PanelCard>

        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
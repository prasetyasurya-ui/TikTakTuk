import React from 'react';
import Navbar from '../../components/Navbar';

const AdminDashboard = () => {
  // Data dummy sesuai requirement admin console
  const adminStats = {
    platform: {
      total_pengguna: "12,450",
      total_acara_bulan_ini: "142",
      omzet_platform: "Rp 1.285.000.000",
      promosi_aktif: "8"
    },
    infrastruktur_venue: {
      total_venue: 24,
      reserved_seating: 15,
      kapasitas_terbesar: "50,000 (Stadion Utama GBK)",
    },
    marketing_promosi: {
      promo_persentase: 3,
      promo_nominal: 5,
      total_penggunaan: "1,120 kali"
    }
  };

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
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Pengguna</p>
            <h3 className="text-2xl font-black text-slate-900">{adminStats.platform.total_pengguna}</h3>
            <p className="text-[10px] text-emerald-600 font-bold mt-2">↑ 12% dari bulan lalu</p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Acara (Bulan Ini)</p>
            <h3 className="text-2xl font-black text-slate-900">{adminStats.platform.total_acara_bulan_ini}</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-2">Running campaigns</p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Omzet Platform (GV)</p>
            <h3 className="text-2xl font-black text-blue-600">{adminStats.platform.omzet_platform}</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-2">Gross Volume</p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Promosi Aktif</p>
            <h3 className="text-2xl font-black text-emerald-600">{adminStats.platform.promosi_aktif}</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-2">Running campaigns</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Section 2: Infrastruktur Venue */}
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
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
          </section>

          {/* Section 3: Marketing & Promosi */}
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
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
          </section>

        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
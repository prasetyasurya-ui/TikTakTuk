import React from 'react';
import Navbar from '../../components/Navbar';

const OrganizerDashboard = () => {
  // Data dummy sesuai requirement penyelenggara (organizer)
  const organizerStats = {
    ringkasan: {
      acara_aktif: 4,
      tiket_terjual: 2850,
      revenue_bulan_ini: "Rp 312.450.000",
      venue_mitra: 6
    },
    top_acara: [
      {
        id: 1,
        nama_event: "Dua Dekade Fest: Fasilkom UI",
        status: "Live",
        persentase_terjual: 85,
        total_tiket: 1000
      },
      {
        id: 2,
        nama_event: "Konser Jazz Malam Universitas",
        status: "Live",
        persentase_terjual: 62,
        total_tiket: 500
      },
      {
        id: 3,
        nama_event: "Workshop UI/UX Designer Pro",
        status: "Live",
        persentase_terjual: 40,
        total_tiket: 150
      }
    ]
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />

      <main className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        
        {/* Header Section */}
        <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-950 tracking-tight">Organizer Dashboard</h1>
            <p className="text-slate-500 font-medium">Kelola acara dan pantau performa tiket Anda.</p>
          </div>
          
          <div className="flex gap-3">
            <button className="bg-blue-600 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 text-sm">
              Kelola acara
            </button>
          </div>
        </header>

        {/* Statistik Utama */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm transition-transform hover:scale-[1.02]">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Acara Aktif</p>
            <h3 className="text-2xl font-black text-slate-900">{organizerStats.ringkasan.acara_aktif} Acara</h3>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm transition-transform hover:scale-[1.02]">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tiket Terjual</p>
            <h3 className="text-2xl font-black text-blue-600">{organizerStats.ringkasan.tiket_terjual.toLocaleString()}</h3>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm transition-transform hover:scale-[1.02]">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Revenue (Bulan Ini)</p>
            <h3 className="text-2xl font-black text-emerald-600">{organizerStats.ringkasan.revenue_bulan_ini}</h3>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm transition-transform hover:scale-[1.02]">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Venue Mitra</p>
            <h3 className="text-2xl font-black text-slate-900">{organizerStats.ringkasan.venue_mitra} Lokasi</h3>
          </div>
        </div>

        {/* Performa Acara Section */}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
            <h3 className="font-bold text-lg text-slate-900">Performa Acara (Live)</h3>
            <button className="text-sm font-bold text-blue-600 hover:underline">Lihat Semua Acara →</button>
          </div>

          <div className="divide-y divide-slate-100">
            {organizerStats.top_acara.map((event) => (
              <div key={event.id} className="p-8 flex flex-col md:flex-row items-center gap-8 hover:bg-slate-50/50 transition-colors">
                {/* Info Utama */}
                <div className="flex-grow">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-bold text-slate-900 text-lg">{event.nama_event}</h4>
                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 bg-red-100 text-red-600 text-[10px] font-black rounded-full animate-pulse">
                      <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                      {event.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 font-medium">Monitoring penjualan tiket secara real-time</p>
                </div>

                {/* Progress Bar Persentase */}
                <div className="w-full md:w-64 space-y-2">
                  <div className="flex justify-between items-end">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Tiket Terjual</p>
                    <p className="text-sm font-black text-slate-900">{event.persentase_terjual}%</p>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full rounded-full transition-all duration-1000"
                      style={{ width: `${event.persentase_terjual}%` }}
                    ></div>
                  </div>
                </div>

                {/* Tombol Kelola */}
                <div className="flex-shrink-0">
                  <button className="bg-slate-900 text-white font-bold px-6 py-2 rounded-xl text-xs hover:bg-blue-600 transition-colors">
                    Kelola Acara
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Empty State Handler */}
          {organizerStats.top_acara.length === 0 && (
            <div className="p-20 text-center">
              <p className="text-slate-400 font-medium italic">Belum ada acara yang sedang aktif.</p>
            </div>
          )}
        </section>

      </main>
    </div>
  );
};

export default OrganizerDashboard;
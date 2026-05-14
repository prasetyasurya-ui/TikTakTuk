import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { fetchOrganizerDashboard } from '../../services/api';
import PanelCard from '../../components/ui/PanelCard';
import StatCard from '../../components/ui/StatCard';
import { useAuth } from '../../contexts/AuthContext';

const OrganizerDashboard = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [isLoading, setIsLoading] = useState(true); // Tambahan state loading
  const [error, setError] = useState(null);
  const [organizerStats, setOrganizerStats] = useState({
    ringkasan: {
      acara_aktif: 0,
      tiket_terjual: 0,
      revenue_bulan_ini: 'Rp 0',
      venue_mitra: 0,
    },
    top_acara: [],
  });

  useEffect(() => {
    // Check if user is authenticated
    if (!session.isLoggedIn || !session.userId) {
      navigate('/login', { replace: true });
      return;
    }
  }, [session.isLoggedIn, session.userId, navigate]);

  useEffect(() => {
    const loadOrganizerDashboard = async () => {
      if (!session.userId) {
        setIsLoading(false);
        setError('User tidak terautentikasi');
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchOrganizerDashboard(session.userId);
        setOrganizerStats(data);
      } catch (err) {
        setError('Gagal memuat dashboard: ' + err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadOrganizerDashboard();
  }, [session.userId]);

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

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Statistik Utama & Skeleton */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[...Array(4)].map((_, idx) => (
              <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 animate-pulse flex flex-col justify-center h-[104px]">
                <div className="h-3 bg-slate-200 rounded w-1/2 mb-3"></div>
                <div className="h-6 bg-slate-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <div className="transition-transform hover:scale-[1.02]">
              <StatCard
                label="Acara Aktif"
                value={`${organizerStats.ringkasan.acara_aktif} Acara`}
              />
            </div>
            <div className="transition-transform hover:scale-[1.02]">
              <StatCard
                label="Tiket Terjual"
                value={organizerStats.ringkasan.tiket_terjual.toLocaleString()}
                valueClassName="text-blue-600"
              />
            </div>
            <div className="transition-transform hover:scale-[1.02]">
              <StatCard
                label="Revenue (Bulan Ini)"
                value={organizerStats.ringkasan.revenue_bulan_ini}
                valueClassName="text-emerald-600"
              />
            </div>
            <div className="transition-transform hover:scale-[1.02]">
              <StatCard
                label="Venue Mitra"
                value={`${organizerStats.ringkasan.venue_mitra} Lokasi`}
              />
            </div>
          </div>
        )}

        {/* Performa Acara Section */}
        <PanelCard className="overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
            <h3 className="font-bold text-lg text-slate-900">Performa Acara (Live)</h3>
            <button className="text-sm font-bold text-blue-600 hover:underline" ><a href="/manage-event">Lihat Semua Acara →</a></button>
          </div>

          <div className="divide-y divide-slate-100">
            {isLoading ? (
              /* SKELETON LIST ACARA */
              [...Array(3)].map((_, idx) => (
                <div key={idx} className="p-8 flex flex-col md:flex-row items-center gap-8 animate-pulse">
                  <div className="flex-grow w-full">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-5 bg-slate-200 rounded w-1/3"></div>
                      <div className="h-4 bg-slate-200 rounded-full w-16"></div>
                    </div>
                    <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                  </div>
                  <div className="w-full md:w-80 space-y-2">
                    <div className="flex justify-between items-end mb-1">
                      <div className="h-3 bg-slate-200 rounded w-1/4"></div>
                      <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                    </div>
                    <div className="w-full bg-slate-200 h-2.5 rounded-full"></div>
                  </div>
                  <div className="flex-shrink-0 mt-4 md:mt-0 w-full md:w-auto">
                    <div className="h-9 bg-slate-200 rounded-xl w-full md:w-32"></div>
                  </div>
                </div>
              ))
            ) : (
              organizerStats.top_acara.map((event) => (
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
                  <div className="w-full md:w-80 space-y-2">
                    <div className="flex justify-between items-end">
                      <p className="text-[10px] font-black text-slate-400 uppercase">Tiket Terjual</p>
                      <p className="text-sm font-black text-slate-900">{event.persentase_terjual}% ({event.total_tiket.toLocaleString('id-ID')})</p>
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
              ))
            )}
          </div>

          {/* Empty State Handler */}
          {!isLoading && organizerStats.top_acara.length === 0 && (
            <div className="p-20 text-center">
              <p className="text-slate-400 font-medium italic">Belum ada acara yang sedang aktif.</p>
            </div>
          )}
        </PanelCard>

      </main>
    </div>
  );
};

export default OrganizerDashboard;
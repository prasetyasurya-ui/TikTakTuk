import React from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import PanelCard from '../components/ui/PanelCard';

const LABEL_BY_PATH = {
  '/manage-seats': 'Manajemen Kursi',
  '/ticket-categories': 'Kategori Tiket',
  '/manage-tickets': 'Manajemen Tiket',
  '/orders': 'Pesanan / Order',
  '/asset-tickets': 'Tiket (Aset)',
  '/asset-orders': 'Order (Aset)',
  '/my-tickets': 'Tiket Saya',
  '/promotion': 'Promosi',
  '/artist': 'Artis',
  '/explore': 'Jelajahi Event',
};

const PlaceholderPage = () => {
  const location = useLocation();
  const pageLabel = LABEL_BY_PATH[location.pathname] || 'Halaman';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PanelCard className="p-8">
          <h1 className="text-2xl font-black tracking-tight mb-2">{pageLabel}</h1>
          <p className="text-slate-500 text-sm">
            Halaman ini sudah terhubung ke navbar dan siap untuk pengembangan fitur selanjutnya.
          </p>
        </PanelCard>
      </main>
    </div>
  );
};

export default PlaceholderPage;

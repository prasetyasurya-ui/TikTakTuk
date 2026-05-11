import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      
      <main className="flex-grow flex flex-col items-center justify-center text-center px-4 py-20 mt-10">
        <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 mb-6 tracking-tight">
          Selamat Datang di <span className="text-blue-600">TikTakTuk</span>
        </h1>
        <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
          Temukan dan kelola tiket untuk konser, seminar, dan acara lainnya dengan mudah dan cepat. Platform terbaik untuk pengalaman tak terlupakan Anda.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
          <Link 
            to="/login"
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-200 transition-all active:scale-95 text-lg"
          >
            Mulai Sekarang
          </Link>
          <Link 
            to="/promotion"
            className="w-full sm:w-auto bg-white hover:bg-slate-50 text-blue-600 border-2 border-blue-100 px-8 py-3 rounded-xl font-bold shadow-sm transition-all active:scale-95 text-lg"
          >
            Lihat Promosi
          </Link>
        </div>
      </main>

      {/* Optional Feature Highlights */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="p-6 rounded-2xl bg-blue-50 border border-blue-100">
              <h3 className="text-xl font-bold text-slate-900 mb-3">Mudah & Cepat</h3>
              <p className="text-slate-600">Pesan tiket event favorit Anda hanya dengan beberapa klik.</p>
            </div>
            <div className="p-6 rounded-2xl bg-blue-50 border border-blue-100">
              <h3 className="text-xl font-bold text-slate-900 mb-3">Kategori Beragam</h3>
              <p className="text-slate-600">Mulai dari konser musik hingga workshop teknologi.</p>
            </div>
            <div className="p-6 rounded-2xl bg-blue-50 border border-blue-100">
              <h3 className="text-xl font-bold text-slate-900 mb-3">Aman & Terpercaya</h3>
              <p className="text-slate-600">Sistem pembayaran yang aman dan tiket resmi terjamin.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
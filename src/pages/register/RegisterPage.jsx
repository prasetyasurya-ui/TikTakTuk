import React from 'react';
import { useNavigate } from 'react-router-dom';

const RegisterPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-slate-900">Bergabung dengan <span className='text-4xl font-extrabold text-blue-600'>TikTakTuk</span></h1>
          <p className="text-slate-500 mt-4 text-lg">Pilih jenis akun yang sesuai dengan kebutuhan Anda</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Opsi Customer */}
          <div
            onClick={() => navigate('/register/customer')}
            className="group cursor-pointer bg-white p-10 rounded-3xl border-2 border-transparent hover:border-blue-500 shadow-sm hover:shadow-2xl transition-all duration-300 text-center"
          >
            <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-6 group-hover:scale-110 transition-transform">
              🎫
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-3">Customer</h2>
            <p className="text-slate-500">Cari pertunjukkan menarik, booking tiket dengan cepat, dan kelola riwayat pesanan Anda.</p>
            <div className="mt-8 text-blue-600 font-semibold flex items-center justify-center gap-2">
              Daftar sebagai Penonton <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>

          {/* Opsi Organizer */}
          <div
            onClick={() => navigate('/register/organizer')}
            className="group cursor-pointer bg-white p-10 rounded-3xl border-2 border-transparent hover:border-emerald-500 shadow-sm hover:shadow-2xl transition-all duration-300 text-center"
          >
            <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-6 group-hover:scale-110 transition-transform">
              🏢
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-3">Organizer</h2>
            <p className="text-slate-500">Kelola venue, buat event pertunjukkan, dan pantau penjualan tiket Anda secara real-time.</p>
            <div className="mt-8 text-emerald-600 font-semibold flex items-center justify-center gap-2">
              Daftar sebagai Penyelenggara <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>

          {/* Opsi Administrator */}
          <div
            onClick={() => navigate('/register/admin')}
            className="group flex flex-col justify-between cursor-pointer bg-white p-10 rounded-3xl border-2 border-transparent hover:border-emerald-500 shadow-sm hover:shadow-2xl transition-all duration-300 text-center"
            >
            <div>
            <div className="w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-6 group-hover:scale-110 transition-transform">
              🛡️
            </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-3">Administrator</h2>
              <p className="text-slate-500">Kelola sistem dan pantau aktivitas platform.</p>
            </div>
            <div className="mt-8 text-red-600 font-semibold flex items-center justify-center gap-2">
              Daftar sebagai Administrator <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
import React from 'react';
import { useNavigate, Link } from 'react-router-dom';

const Navbar = () => {
  const navigate = useNavigate();
  
  // Mengambil data auth dari localStorage
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  const userRole = localStorage.getItem('userRole') || 'customer'; // 'customer' atau 'organizer'
  const userName = localStorage.getItem('userName') || 'User';

  const handleLogout = () => {
    localStorage.clear(); // Hapus semua data session
    navigate('/');
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/dashboard" className="text-2xl font-bold text-blue-600 tracking-tighter">
              TikTakTuk
            </Link>
          </div>

          {/* Navigation Links (Desktop) */}
          <div className="hidden md:flex items-center space-x-8">
            {isLoggedIn ? (
              <>
                <Link to="/dashboard" className="text-slate-600 hover:text-blue-600 font-medium">Dashboard</Link>

                {userRole === 'admin' && (
                  <>
                    <Link to="/manage-events" className="text-slate-600 hover:text-blue-600 font-medium">Manajemen Venue</Link>
                    <Link to="/reports" className="text-slate-600 hover:text-blue-600 font-medium">Manajemen Kursi</Link>
                    <Link to="/reports" className="text-slate-600 hover:text-blue-600 font-medium">Kategori Tiket</Link>
                    <Link to="/reports" className="text-slate-600 hover:text-blue-600 font-medium">Manajemen Tiket</Link>
                    <Link to="/reports" className="text-slate-600 hover:text-blue-600 font-medium">Semua Order</Link>
                    <Link to="/reports" className="text-slate-600 hover:text-blue-600 font-medium">Tiket (Aset)</Link>
                    <Link to="/reports" className="text-slate-600 hover:text-blue-600 font-medium">Order (Aset)</Link>
                    <Link to="/reports" className="text-slate-600 hover:text-blue-600 font-medium">Profile</Link>
                  </>
                )}

                {userRole === 'customer' && (
                  <>
                    <Link to="/my-tickets" className="text-slate-600 hover:text-blue-600 font-medium">Tiket Saya</Link>
                    <Link to="/explore" className="text-slate-600 hover:text-blue-600 font-medium">Pesanan</Link>
                    <Link to="/explore" className="text-slate-600 hover:text-blue-600 font-medium">Cari Event</Link>
                    <Link to="/explore" className="text-slate-600 hover:text-blue-600 font-medium">Promosi</Link>
                    <Link to="/explore" className="text-slate-600 hover:text-blue-600 font-medium">Venue</Link>
                    <Link to="/explore" className="text-slate-600 hover:text-blue-600 font-medium">Artis</Link>
                  </>
                )}

                {userRole === 'organizer' && (
                  <>
                    <Link to="/manage-events" className="text-slate-600 hover:text-blue-600 font-medium">Event Saya</Link>
                    <Link to="/reports" className="text-slate-600 hover:text-blue-600 font-medium">Manajemen Venue</Link>
                    <Link to="/reports" className="text-slate-600 hover:text-blue-600 font-medium">Manajemen Kursi</Link>
                    <Link to="/reports" className="text-slate-600 hover:text-blue-600 font-medium">Kategori Tiket</Link>
                    <Link to="/reports" className="text-slate-600 hover:text-blue-600 font-medium">Manajemen Tiket</Link>
                    <Link to="/reports" className="text-slate-600 hover:text-blue-600 font-medium">Semua Order</Link>
                    <Link to="/reports" className="text-slate-600 hover:text-blue-600 font-medium">Tiket (Aset)</Link>
                    <Link to="/reports" className="text-slate-600 hover:text-blue-600 font-medium">Order (Aset)</Link>
                    <Link to="/reports" className="text-slate-600 hover:text-blue-600 font-medium">Profile</Link>
                  </>
                )}
              </>
            ) : (
              <Link to="/explore" className="text-slate-600 hover:text-blue-600 font-medium">Jelajahi Event</Link>
            )}
          </div>

          {/* User Profile / Auth Buttons */}
          <div className="flex items-center space-x-4">
            {isLoggedIn ? (
              <div className="flex items-center space-x-4">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-slate-900">{userName}</p>
                  <p className="text-xs text-slate-500 capitalize">{userRole}</p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <>
                <Link to="/" className="text-slate-600 hover:text-blue-600 font-medium text-sm">Masuk</Link>
                <Link 
                  to="/register"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium shadow-md shadow-blue-100 transition-all"
                >
                  Daftar
                </Link>
              </>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
};

export default Navbar;
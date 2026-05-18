import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { logout } from '../services/api';
import NavLinkItem from './navigation/NavLinkItem';
import { useAuth } from '../contexts/AuthContext';

const NAV_LINKS = {
  guest: [],
  admin: [
    { to: '/manage-event', label: 'Manajemen Event' },
    { to: '/venue', label: 'Manajemen Venue' },
    { to: '/manage-seats', label: 'Manajemen Kursi' },
    { to: '/artist', label: 'Manajemen Artis' },
    { to: '/ticket-categories', label: 'Kategori Tiket' },
    { to: '/manage-tickets', label: 'Manajemen Tiket' },
    { to: '/orders', label: 'Semua Order' },
    { to: '/promotion', label: 'Promosi' },
    { to: '/profile', label: 'Profile' },
  ],
  customer: [
    { to: '/orders', label: 'Pesanan' },
    { to: '/my-tickets', label: 'Tiket Saya' },
    { to: '/event', label: 'Jelajahi Event' },
    { to: '/promotion', label: 'Promosi' },
    { to: '/venue', label: 'Venue' },
    { to: '/artist', label: 'Artis' },
    { to: '/profile', label: 'Profile' },
  ],
  organizer: [
    { to: '/manage-event', label: 'Event Saya' },
    { to: '/venue', label: 'Manajemen Venue' },
    { to: '/manage-seats', label: 'Manajemen Kursi' },
    { to: '/artist', label: 'Artis' },
    { to: '/ticket-categories', label: 'Kategori Tiket' },
    { to: '/manage-tickets', label: 'Manajemen Tiket' },
    { to: '/orders', label: 'Daftar Order' },
    { to: '/promotion', label: 'Promosi' },
    { to: '/profile', label: 'Profile' },
  ],
};

const Navbar = () => {
  const navigate = useNavigate();
  const { session, signOut } = useAuth();
  
  const isLoggedIn = session.isLoggedIn;
  const userRole = session.userRole;
  const userName = session.userName;
  const roleLinks = NAV_LINKS[isLoggedIn ? userRole : 'guest'] || [];

  const handleLogout = async () => {
    await logout();
    signOut();
    navigate('/');
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      {/* Container max-w-7xl ini harus sama dengan yang ada di VenuePage */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center gap-4">
          
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link to={isLoggedIn ? "/dashboard" : "/"} className="text-2xl font-bold text-blue-600 tracking-tighter">
              TikTakTuk
            </Link>
          </div>

          {/* Navigation Links (Desktop) */}
          <div className="hidden md:flex items-center space-x-6 overflow-x-auto no-scrollbar py-2">
            {isLoggedIn ? (
              <>
                <NavLinkItem to="/dashboard" label="Dashboard" />
                {roleLinks.map((item) => (
                  <NavLinkItem key={`${userRole}-${item.label}`} to={item.to} label={item.label} />
                ))}
              </>
            ) : (
              <>
                {roleLinks.map((item) => (
                  <NavLinkItem key={`guest-${item.label}`} to={item.to} label={item.label} />
                ))}
              </>
            )}
          </div>

          {/* User Profile / Auth Buttons */}
          <div className="flex items-center space-x-4 flex-shrink-0">
            {isLoggedIn ? (
              <div className="flex items-center space-x-4">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-slate-900 leading-none">{userName}</p>
                  <p className="text-[10px] text-slate-500 capitalize font-bold mt-1 tracking-wider">{userRole}</p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold transition-all active:scale-95"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link to="/login" className="text-slate-600 hover:text-blue-600 font-bold text-sm">Masuk</Link>
                <Link 
                  to="/register"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-md shadow-blue-100 transition-all active:scale-95"
                >
                  Daftar
                </Link>
              </div>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
};

// Sub-komponen NavLink agar kode lebih bersih
export default Navbar;

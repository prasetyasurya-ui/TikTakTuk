import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const OrganizerForm = () => {
  const navigate = useNavigate();
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<any>({});
  
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    username: "",
    password: "",
  });

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (name == "email" && !emailRegex.test(name)) {
        setErrors((prev: any) => ({ ...prev, email: "Email tidak valid" }));
        return;
    }
    
    if (name === 'confirmPassword') {
      setConfirmPassword(value);
      if (value !== formData.password) {
        setErrors((prev: any) => ({ ...prev, confirmPassword: "Password tidak cocok" }));
      } else {
        setErrors((prev: any) => ({ ...prev, confirmPassword: "" }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
      if (errors[name]) setErrors((prev: any) => ({ ...prev, [name]: "" }));
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== confirmPassword) {
      setErrors((prev: any) => ({ ...prev, confirmPassword: "Password tidak cocok" }));
      return;
    }

    if (!emailRegex.test(formData.email)) {
      setErrors((prev: any) => ({ ...prev, email: "Email tidak valid" }));
      return;
    }

    const users = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
    users.push(formData);
    localStorage.setItem('registeredUsers', JSON.stringify(users));
    
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('userRole', 'customer');
    
    alert("Registrasi Berhasil!");
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden p-8 border border-slate-100">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-blue-600 tracking-tight">TikTakTuk</h1>
          <p className="text-slate-500 mt-2">Daftar Sebagai Organizer</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
            <input
              name="full_name"
              type="text"
              placeholder="Masukkan nama lengkap"
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              required
              onChange={handleChange}
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              name="email"
              type="email"
              placeholder="user@mail.com"
              className={`w-full px-4 py-2 rounded-lg border ${errors.email ? 'border-red-500' : 'border-slate-300'} outline-none`}
              required
              onChange={handleChange}
            />
            {errors.email && <p className="text-red-500 text-xs">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
            <input
              name="username"
              type="text"
              placeholder="Pilih username"
              className="w-full px-4 py-2 rounded-lg border border-slate-300 outline-none"
              required
              maxLength={100}
              onChange={handleChange}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              name="password"
              type="password"
              className="w-full px-4 py-2 rounded-lg border border-slate-300 outline-none"
              required
              placeholder='Minimal 6 karakter'
              minLength={6}
              maxLength={255}
              onChange={handleChange}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Konfirmasi</label>
            <input
              name="confirmPassword"
              type="password"
              className={`w-full px-4 py-2 rounded-lg border ${errors.confirmPassword ? 'border-red-500' : 'border-slate-300'} outline-none`}
              maxLength={255}
              placeholder='Konfirmasi password'
              onChange={handleChange}
            />
            {errors.confirmPassword && <p className="text-red-500 text-xs">{errors.confirmPassword}</p>}
          </div>

          <button 
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg shadow-md transition-all active:scale-[0.98] mt-4"
          >
            Daftar
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
          <p className="text-sm text-slate-600">
            Sudah punya akun? <a href="/" className="text-blue-600 font-semibold hover:underline">Login</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default OrganizerForm;
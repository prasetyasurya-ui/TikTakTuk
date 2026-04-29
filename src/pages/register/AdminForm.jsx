import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerCustomer } from '../../services/api';
import {
  normalizeText,
  normalizePhone,
  isValidEmail,
  isValidPhone,
  isValidUsername,
  isValidPassword,
  SQL_MAX_LENGTH,
  hasMaxLength,
} from '../../utils/formValidation';

const  AdminForm = () => {
  const navigate = useNavigate();
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone_number: "",
    username: "",
    password: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'confirmPassword') {
      setConfirmPassword(value);
      if (value !== formData.password) {
        setErrors((prev) => ({ ...prev, confirmPassword: "Password tidak cocok" }));
      } else {
        setErrors((prev) => ({ ...prev, confirmPassword: "" }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
      if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    const normalized = {
      full_name: normalizeText(formData.full_name),
      email: normalizeText(formData.email),
      phone_number: normalizePhone(formData.phone_number),
      username: normalizeText(formData.username),
      password: formData.password,
    };

    const nextErrors = {};

    if (normalized.full_name.length < 3) {
      nextErrors.full_name = 'Nama lengkap minimal 3 karakter';
    }

    if (!hasMaxLength(normalized.full_name, SQL_MAX_LENGTH.FULL_NAME)) {
      nextErrors.full_name = `Nama lengkap maksimal ${SQL_MAX_LENGTH.FULL_NAME} karakter`;
    }

    if (!isValidEmail(normalized.email)) {
      nextErrors.email = 'Email tidak valid';
    }

    if (!hasMaxLength(normalized.email, SQL_MAX_LENGTH.CONTACT_EMAIL)) {
      nextErrors.email = `Email maksimal ${SQL_MAX_LENGTH.CONTACT_EMAIL} karakter`;
    }

    if (!isValidPhone(normalized.phone_number)) {
      nextErrors.phone_number = 'Nomor telepon harus 10-15 digit angka';
    }

    if (!hasMaxLength(normalized.phone_number, SQL_MAX_LENGTH.PHONE_NUMBER)) {
      nextErrors.phone_number = `Nomor telepon maksimal ${SQL_MAX_LENGTH.PHONE_NUMBER} karakter`;
    }

    if (!isValidUsername(normalized.username)) {
      nextErrors.username = 'Username minimal 4 karakter (huruf/angka/underscore)';
    }

    if (!isValidPassword(normalized.password)) {
      nextErrors.password = 'Password minimal 6 karakter';
    }

    if (normalized.password !== confirmPassword) {
      nextErrors.confirmPassword = 'Password tidak cocok';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const result = await registerCustomer(normalized);
    if (!result.ok) {
      setErrors((prev) => ({ ...prev, username: result.message }));
      return;
    }
    
    alert("Registrasi Berhasil!");
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden p-8 border border-slate-100">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-blue-600 tracking-tight">TikTakTuk</h1>
          <p className="text-slate-500 mt-2">Daftar Sebagai Administrator</p>
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
              value={formData.full_name}
              onChange={handleChange}
              maxLength={100}
            />
            {errors.full_name && <p className="text-red-500 text-xs">{errors.full_name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              name="email"
              type="email"
              placeholder="user@mail.com"
              className={`w-full px-4 py-2 rounded-lg border ${errors.email ? 'border-red-500' : 'border-slate-300'} outline-none`}
              required
              value={formData.email}
              maxLength={SQL_MAX_LENGTH.CONTACT_EMAIL}
              onChange={handleChange}
            />
            {errors.email && <p className="text-red-500 text-xs">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">No. Telepon</label>
            <input
              name="phone_number"
              type="text"
              placeholder="Masukkan nomor telepon"
              className="w-full px-4 py-2 rounded-lg border border-slate-300 outline-none"
              maxLength={20}
              pattern="\+?[0-9\s-]{10,20}"
              required
              value={formData.phone_number}
              onChange={handleChange}
            />
            {errors.phone_number && <p className="text-red-500 text-xs">{errors.phone_number}</p>}
          </div>


          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
            <input
              name="username"
              type="text"
              placeholder="Pilih username"
              className={`w-full px-4 py-2 rounded-lg border ${errors.username ? 'border-red-500' : 'border-slate-300'} outline-none`}
              required
              maxLength={100}
              minLength={4}
              pattern="[A-Za-z0-9_]+"
              value={formData.username}
              onChange={handleChange}
            />
            {errors.username && <p className="text-red-500 text-xs">{errors.username}</p>}
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
              value={formData.password}
              onChange={handleChange}
            />
            {errors.password && <p className="text-red-500 text-xs">{errors.password}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Konfirmasi</label>
            <input
              name="confirmPassword"
              type="password"
              className={`w-full px-4 py-2 rounded-lg border ${errors.confirmPassword ? 'border-red-500' : 'border-slate-300'} outline-none`}
              maxLength={255}
              placeholder='Konfirmasi password'
              required
              value={confirmPassword}
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

export default  AdminForm;
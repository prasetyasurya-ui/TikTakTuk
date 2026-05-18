import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerCustomer } from '../../services/api';
import {
  normalizeText,
  normalizePhone,
  isValidEmail,
  isValidPhone,
  isValidPassword,
  SQL_MAX_LENGTH,
  hasMaxLength,
} from '../../utils/formValidation';

const CustomerForm = () => {
  const navigate = useNavigate();
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false); // Tambahan state loading
  
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

    setIsLoading(true); // Set loading ke true saat mulai request

    try {
      const result = await registerCustomer(normalized);
      if (!result.ok) {
        setErrors((prev) => ({ ...prev, username: result.message || 'Registrasi gagal' }));
        setIsLoading(false); // Set loading ke false jika gagal
        return;
      }

      alert("Registrasi Berhasil!");
      navigate('/login');
    } catch {
      setErrors((prev) => ({ ...prev, username: 'Terjadi kesalahan jaringan atau server.' }));
      setIsLoading(false); // Set loading ke false jika error jaringan
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden p-8 border border-slate-100">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-blue-600 tracking-tight">TikTakTuk</h1>
          <p className="text-slate-500 mt-2">Daftar Sebagai Pelanggan</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
            <input
              name="full_name"
              type="text"
              placeholder="Masukkan nama lengkap"
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-500"
              required
              value={formData.full_name}
              onChange={handleChange}
              maxLength={100}
              disabled={isLoading}
            />
            {errors.full_name && <p className="text-red-500 text-xs">{errors.full_name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              name="email"
              type="email"
              placeholder="user@mail.com"
              className={`w-full px-4 py-2 rounded-lg border ${errors.email ? 'border-red-500' : 'border-slate-300'} outline-none disabled:bg-slate-50 disabled:text-slate-500`}
              required
              value={formData.email}
              maxLength={SQL_MAX_LENGTH.CONTACT_EMAIL}
              onChange={handleChange}
              disabled={isLoading}
            />
            {errors.email && <p className="text-red-500 text-xs">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">No. Telepon</label>
            <input
              name="phone_number"
              type="text"
              placeholder="Masukkan nomor telepon"
              className="w-full px-4 py-2 rounded-lg border border-slate-300 outline-none disabled:bg-slate-50 disabled:text-slate-500"
              maxLength={20}
              inputMode="tel"
              required
              value={formData.phone_number}
              onChange={handleChange}
              disabled={isLoading}
            />
            {errors.phone_number && <p className="text-red-500 text-xs">{errors.phone_number}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
            <input
              name="username"
              type="text"
              placeholder="Pilih username"
              className={`w-full px-4 py-2 rounded-lg border ${errors.username ? 'border-red-500' : 'border-slate-300'} outline-none disabled:bg-slate-50 disabled:text-slate-500`}
              required
              maxLength={100}
              minLength={4}
              value={formData.username}
              onChange={handleChange}
              disabled={isLoading}
            />
            {errors.username && <p className="text-red-500 text-xs">{errors.username}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              name="password"
              type="password"
              className="w-full px-4 py-2 rounded-lg border border-slate-300 outline-none disabled:bg-slate-50 disabled:text-slate-500"
              required
              placeholder='Minimal 6 karakter'
              minLength={6}
              maxLength={255}
              value={formData.password}
              onChange={handleChange}
              disabled={isLoading}
            />
            {errors.password && <p className="text-red-500 text-xs">{errors.password}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Konfirmasi</label>
            <input
              name="confirmPassword"
              type="password"
              className={`w-full px-4 py-2 rounded-lg border ${errors.confirmPassword ? 'border-red-500' : 'border-slate-300'} outline-none disabled:bg-slate-50 disabled:text-slate-500`}
              maxLength={255}
              placeholder='Konfirmasi password'
              required
              value={confirmPassword}
              onChange={handleChange}
              disabled={isLoading}
            />
            {errors.confirmPassword && <p className="text-red-500 text-xs">{errors.confirmPassword}</p>}
          </div>

          <button 
            type="submit"
            disabled={isLoading}
            className={`w-full text-white font-semibold py-3 rounded-lg transition-all active:scale-[0.98] mt-4 flex justify-center items-center gap-2
              ${isLoading 
                ? 'bg-blue-400 cursor-not-allowed shadow-none' 
                : 'bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200'
              }`}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Memproses...
              </>
            ) : (
              'Daftar'
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
          <p className="text-sm text-slate-600">
            Sudah punya akun? <a href="/login" className={`text-blue-600 font-semibold hover:underline ${isLoading ? 'pointer-events-none opacity-50' : ''}`}>Login</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default CustomerForm;

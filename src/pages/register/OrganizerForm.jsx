import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerOrganizer } from '../../services/api';
import {
  normalizeText,
  isValidEmail,
  isValidUsername,
  isValidPassword,
  SQL_MAX_LENGTH,
  hasMaxLength,
} from '../../utils/formValidation';

const OrganizerForm = () => {
  const navigate = useNavigate();
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    role: 'organizer',
    baseData: {
      username: "",
      password: "",
    },
    additionalData: {
      organizer_name: "",
      contact_email: "",
    }
  });

  const isBaseField = (field) => {
    return field === 'username' || field === 'password';
  };

  const isOrganizerField = (field) => {
    return field === 'organizer_name' || field === 'contact_email';
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'confirmPassword') {
      setConfirmPassword(value);
      if (value !== formData.baseData.password) {
        setErrors((prev) => ({ ...prev, confirmPassword: "Password tidak cocok" }));
      } else {
        setErrors((prev) => ({ ...prev, confirmPassword: "" }));
      }
      return;
    }

    if (isBaseField(name)) {
      setFormData(prev => ({
        ...prev,
        baseData: { ...prev.baseData, [name]: value }
      }));
      if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
    } else if (isOrganizerField(name)) {
      setFormData(prev => ({
        ...prev,
        additionalData: { ...prev.additionalData, [name]: value }
      }));

      if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const normalized = {
      organizer_name: normalizeText(formData.additionalData.organizer_name),
      contact_email: normalizeText(formData.additionalData.contact_email),
      username: normalizeText(formData.baseData.username),
      password: formData.baseData.password,
    };

    const nextErrors = {};

    if (normalized.organizer_name.length < 3) {
      nextErrors.organizer_name = 'Nama organizer minimal 3 karakter';
    }

    if (!hasMaxLength(normalized.organizer_name, SQL_MAX_LENGTH.ORGANIZER_NAME)) {
      nextErrors.organizer_name = `Nama organizer maksimal ${SQL_MAX_LENGTH.ORGANIZER_NAME} karakter`;
    }

    if (!isValidEmail(normalized.contact_email)) {
      nextErrors.contact_email = 'Email tidak valid';
    }

    if (!hasMaxLength(normalized.contact_email, SQL_MAX_LENGTH.CONTACT_EMAIL)) {
      nextErrors.contact_email = `Email maksimal ${SQL_MAX_LENGTH.CONTACT_EMAIL} karakter`;
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

    const result = await registerOrganizer(normalized);

    if (!result.ok) {
      setErrors((prev) => ({ ...prev, username: result.message }));
      return;
    }
    
    alert("Registrasi Organizer Berhasil!");
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden p-8 border border-slate-100">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-blue-600 tracking-tight">TikTakTuk</h1>
          <p className="text-slate-500 mt-2">Daftar Sebagai Penyelenggara</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          {/* Organizer Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nama Organisasi</label>
            <input
              name="organizer_name"
              type="text"
              placeholder="Contoh: BEM UI / Promotor Musik"
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              required
              maxLength={SQL_MAX_LENGTH.ORGANIZER_NAME}
              value={formData.additionalData.organizer_name}
              onChange={handleChange}
            />
            {errors.organizer_name && <p className="text-red-500 text-xs">{errors.organizer_name}</p>}
          </div>

          {/* Contact Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Kontak</label>
            <input
              name="contact_email"
              type="email"
              placeholder="org@mail.com"
              className={`w-full px-4 py-2 rounded-lg border ${errors.contact_email ? 'border-red-500' : 'border-slate-300'} outline-none`}
              required
              maxLength={SQL_MAX_LENGTH.CONTACT_EMAIL}
              value={formData.additionalData.contact_email}
              onChange={handleChange}
            />
            {errors.contact_email && <p className="text-red-500 text-xs">{errors.contact_email}</p>}
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
            <input
              name="username"
              type="text"
              placeholder="Pilih username"
              className={`w-full px-4 py-2 rounded-lg border ${errors.username ? 'border-red-500' : 'border-slate-300'} outline-none`}
              required
              maxLength={SQL_MAX_LENGTH.USERNAME}
              minLength={4}
              pattern="[A-Za-z0-9_]+"
              value={formData.baseData.username}
              onChange={handleChange}
            />
            {errors.username && <p className="text-red-500 text-xs">{errors.username}</p>}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              name="password"
              type="password"
              placeholder='Minimal 6 karakter'
              className="w-full px-4 py-2 rounded-lg border border-slate-300 outline-none"
              required
              minLength={6}
              maxLength={255}
              value={formData.baseData.password}
              onChange={handleChange}
            />
            {errors.password && <p className="text-red-500 text-xs">{errors.password}</p>}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Konfirmasi Password</label>
            <input
              name="confirmPassword"
              type="password"
              placeholder='Konfirmasi password'
              className={`w-full px-4 py-2 rounded-lg border ${errors.confirmPassword ? 'border-red-500' : 'border-slate-300'} outline-none`}
              required
              maxLength={255}
              value={confirmPassword}
              onChange={handleChange}
            />
            {errors.confirmPassword && <p className="text-red-500 text-xs">{errors.confirmPassword}</p>}
          </div>

          <button 
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg shadow-md transition-all active:scale-[0.98] mt-4"
          >
            Daftar Organizer
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
          <p className="text-sm text-slate-600">
            Sudah punya akun?<a href="/register" className="text-blue-600 font-semibold hover:underline"> Login</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default OrganizerForm;
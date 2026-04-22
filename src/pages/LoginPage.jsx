import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/api';
import { normalizeText, isValidPassword } from '../utils/formValidation';

const LoginPage = () => {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ username: '', password: '' });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    const username = normalizeText(formData.username);
    const password = formData.password;

    if (!username) {
      setError('Username wajib diisi.');
      return;
    }

    if (!isValidPassword(password)) {
      setError('Password minimal 6 karakter.');
      return;
    }

    const result = await login(username, password);
    if (!result.ok) {
      setError(result.message);
      return;
    }

    navigate('/dashboard');
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden p-8 border border-slate-100">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600 tracking-tight">TikTakTuk</h1>
          <p className="text-slate-500 mt-2">Platform Manajemen Pertunjukkan & Tiket</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
            <input
              name="username"
              type="text"
              placeholder="Masukkan username"
              className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              required
              maxLength={100}
              value={formData.username}
              onChange={handleChange}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              name="password"
              type="password"
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              required
              maxLength={255}
              value={formData.password}
              onChange={handleChange}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button 
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg shadow-lg shadow-blue-200 transition-all active:scale-[0.98]"
          >
            Masuk Sekarang
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-sm text-slate-600">
            Belum punya akun? <a href="/register" className="text-blue-600 font-semibold hover:underline">Daftar Sekarang</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
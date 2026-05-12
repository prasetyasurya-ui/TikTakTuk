import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/api';
import { normalizeText, isValidPassword } from '../utils/formValidation';
import { useAuth } from '../contexts/AuthContext';

const LoginPage = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Tambahan state loading
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

    setIsLoading(true); // Set loading ke true saat mulai request

    try {
      const result = await login(username, password);
      
      if (!result.ok) {
        setError(result.message || 'Login gagal.');
        setIsLoading(false); // Set loading ke false jika gagal
        return;
      }

      const role = Array.isArray(result.user?.roles) && result.user.roles.length > 0
        ? String(result.user.roles[0]).toLowerCase()
        : 'customer';

      signIn({
        userId: result.user?.user_id || '',
        userRole: role,
        userName: result.user?.username || username,
        username: result.user?.username || username,
        token: result.token || '',
      });

      navigate('/dashboard');
    } catch (err) {
      setError('Terjadi kesalahan jaringan atau server.');
      setIsLoading(false); // Set loading ke false jika terjadi error jaringan
    }
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
              className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-500"
              required
              maxLength={100}
              value={formData.username}
              onChange={handleChange}
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              name="password"
              type="password"
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-500"
              required
              maxLength={255}
              value={formData.password}
              onChange={handleChange}
              disabled={isLoading}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button 
            type="submit"
            disabled={isLoading}
            className={`w-full text-white font-semibold py-3 rounded-lg transition-all active:scale-[0.98] flex justify-center items-center gap-2
              ${isLoading 
                ? 'bg-blue-400 cursor-not-allowed shadow-none' 
                : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200'
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
              'Masuk Sekarang'
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-sm text-slate-600">
            Belum punya akun? <a href="/register" className={`text-blue-600 font-semibold hover:underline ${isLoading ? 'pointer-events-none opacity-50' : ''}`}>Daftar Sekarang</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
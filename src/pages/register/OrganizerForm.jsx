import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

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

      if (name === 'contact_email') {
        if (!emailRegex.test(value)) {
          setErrors(prev => ({ ...prev, contact_email: "Email tidak valid" }));
        } else {
          setErrors(prev => ({ ...prev, contact_email: "" }));
        }
      }
    }
  };

  const handleRegister = (e) => {
    e.preventDefault();
    const orgData = formData.additionalData;

    if (formData.baseData.password !== confirmPassword) {
      setErrors((prev) => ({ ...prev, confirmPassword: "Password tidak cocok" }));
      return;
    }

    if (!emailRegex.test(orgData.contact_email)) {
      setErrors((prev) => ({ ...prev, contact_email: "Email tidak valid" }));
      return;
    }

    // Simulasi penyimpanan
    const users = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
    users.push(formData);
    localStorage.setItem('registeredUsers', JSON.stringify(users));
    
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('userRole', 'organizer');
    localStorage.setItem('userName', orgData.organizer_name);
    
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
              onChange={handleChange}
            />
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
              className="w-full px-4 py-2 rounded-lg border border-slate-300 outline-none"
              required
              onChange={handleChange}
            />
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
              onChange={handleChange}
            />
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
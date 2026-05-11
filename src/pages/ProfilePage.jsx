import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Save, X } from 'lucide-react';
import Navbar from '../components/Navbar';
import PanelCard from '../components/ui/PanelCard';
import {
  ProfileField,
  ProfileEditableField,
  ProfilePasswordField,
} from '../components/profile/ProfileFields';
import {
  getCurrentSession,
  fetchProfile,
  updateProfile,
  changePassword,
} from '../services/api';
import {
  normalizeText,
  normalizePhone,
  isValidPhone,
  isValidEmail,
  isValidPassword,
  SQL_MAX_LENGTH,
} from '../utils/formValidation';

const ProfilePage = () => {
  const session = getCurrentSession();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [profileErrors, setProfileErrors] = useState({});
  const [passwordErrors, setPasswordErrors] = useState({});

  const [profileForm, setProfileForm] = useState({
    full_name: '',
    phone_number: '',
    organizer_name: '',
    contact_email: '',
  });

  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      const response = await fetchProfile(session.userId);
      if (response.ok) {
        setProfile(response.data);
        setProfileForm({
          full_name: response.data.full_name || '',
          phone_number: response.data.phone_number || '',
          organizer_name: response.data.organizer_name || '',
          contact_email: response.data.contact_email || '',
        });
      } else {
        setProfileMessage(response.message || 'Gagal memuat profile.');
      }
      setLoading(false);
    };

    loadProfile();
  }, [session.userId]);

  const isCustomer = useMemo(() => profile?.role === 'customer', [profile]);
  const isOrganizer = useMemo(() => profile?.role === 'organizer', [profile]);

  const handleSaveProfile = async () => {
    setProfileMessage('');
    setProfileErrors({});

    const nextErrors = {};

    const payload = isCustomer
      ? {
          full_name: normalizeText(profileForm.full_name),
          phone_number: normalizePhone(profileForm.phone_number),
        }
      : {
          organizer_name: normalizeText(profileForm.organizer_name),
          contact_email: normalizeText(profileForm.contact_email),
        };

    if (isCustomer) {
      if (payload.full_name.length < 3 || payload.full_name.length > SQL_MAX_LENGTH.FULL_NAME) {
        nextErrors.full_name = `Nama lengkap wajib 3-${SQL_MAX_LENGTH.FULL_NAME} karakter`;
      }

      if (!isValidPhone(payload.phone_number) || payload.phone_number.length > SQL_MAX_LENGTH.PHONE_NUMBER) {
        nextErrors.phone_number = 'Nomor telepon harus valid (10-15 digit angka)';
      }
    }

    if (isOrganizer) {
      if (
        payload.organizer_name.length < 3 ||
        payload.organizer_name.length > SQL_MAX_LENGTH.ORGANIZER_NAME
      ) {
        nextErrors.organizer_name = `Nama organizer wajib 3-${SQL_MAX_LENGTH.ORGANIZER_NAME} karakter`;
      }

      if (
        !isValidEmail(payload.contact_email) ||
        payload.contact_email.length > SQL_MAX_LENGTH.CONTACT_EMAIL
      ) {
        nextErrors.contact_email = 'Contact email tidak valid';
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setProfileErrors(nextErrors);
      return;
    }

    const response = await updateProfile(session.userId, payload);

    if (!response.ok) {
      setProfileMessage(response.message || 'Gagal menyimpan profile.');
      return;
    }

    setProfile(response.data);
    setIsEditing(false);
    setProfileMessage('Profile berhasil diperbarui.');
  };

  const handleCancelEdit = () => {
    if (!profile) return;

    setProfileForm({
      full_name: profile.full_name || '',
      phone_number: profile.phone_number || '',
      organizer_name: profile.organizer_name || '',
      contact_email: profile.contact_email || '',
    });
    setIsEditing(false);
    setProfileMessage('');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMessage('');
    setPasswordErrors({});

    const nextErrors = {};

    if (!isValidPassword(passwordForm.oldPassword)) {
      nextErrors.oldPassword = 'Password lama wajib diisi (min. 6 karakter).';
    }

    if (!isValidPassword(passwordForm.newPassword)) {
      nextErrors.newPassword = 'Password baru minimal 6 karakter.';
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      nextErrors.confirmPassword = 'Konfirmasi password tidak cocok.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setPasswordErrors(nextErrors);
      return;
    }

    const response = await changePassword(session.userId, passwordForm);
    if (!response.ok) {
      setPasswordMessage(response.message || 'Gagal mengubah password.');
      return;
    }

    setPasswordMessage(response.message || 'Password berhasil diubah.');
    setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <p className="text-slate-500">Memuat profile...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <PanelCard className="p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Profile</h1>
              <p className="text-sm text-slate-500 mt-1">Informasi akun Anda.</p>
            </div>

            {(isCustomer || isOrganizer) && !isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-xl"
              >
                <Pencil size={16} /> Edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ProfileField label="Role / Peran" value={profile?.role || '-'} capitalize />
            <ProfileField label="Username" value={profile?.username || '-'} />

            {isCustomer && (
              <>
                <ProfileEditableField
                  label="Nama Lengkap"
                  isEditing={isEditing}
                  value={profileForm.full_name}
                  maxLength={SQL_MAX_LENGTH.FULL_NAME}
                  error={profileErrors.full_name}
                  onChange={(value) =>
                    setProfileForm((prev) => ({ ...prev, full_name: value }))
                  }
                />
                <ProfileEditableField
                  label="Nomor Telepon"
                  isEditing={isEditing}
                  value={profileForm.phone_number}
                  maxLength={SQL_MAX_LENGTH.PHONE_NUMBER}
                  error={profileErrors.phone_number}
                  onChange={(value) =>
                    setProfileForm((prev) => ({ ...prev, phone_number: value }))
                  }
                />
              </>
            )}

            {isOrganizer && (
              <>
                <ProfileEditableField
                  label="Nama Organizer"
                  isEditing={isEditing}
                  value={profileForm.organizer_name}
                  maxLength={SQL_MAX_LENGTH.ORGANIZER_NAME}
                  error={profileErrors.organizer_name}
                  onChange={(value) =>
                    setProfileForm((prev) => ({ ...prev, organizer_name: value }))
                  }
                />
                <ProfileEditableField
                  label="Contact Email"
                  type="email"
                  isEditing={isEditing}
                  value={profileForm.contact_email}
                  maxLength={SQL_MAX_LENGTH.CONTACT_EMAIL}
                  error={profileErrors.contact_email}
                  onChange={(value) =>
                    setProfileForm((prev) => ({ ...prev, contact_email: value }))
                  }
                />
              </>
            )}
          </div>

          {isEditing && (
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={handleSaveProfile}
                className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-700 text-white text-sm font-bold px-4 py-2 rounded-xl"
              >
                <Save size={16} /> Simpan
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="inline-flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-bold px-4 py-2 rounded-xl"
              >
                <X size={16} /> Batal
              </button>
            </div>
          )}

          {profileMessage && (
            <p className="text-sm text-slate-600 mt-4">{profileMessage}</p>
          )}
        </PanelCard>

        <PanelCard className="p-6 sm:p-8">
          <h2 className="text-xl font-black tracking-tight mb-1">Ubah Password</h2>
          <p className="text-sm text-slate-500 mb-6">Perbarui password akun Anda.</p>

          <form className="grid grid-cols-1 gap-4" onSubmit={handleChangePassword}>
            <ProfilePasswordField
              label="Password Lama"
              value={passwordForm.oldPassword}
              error={passwordErrors.oldPassword}
              onChange={(value) =>
                setPasswordForm((prev) => ({ ...prev, oldPassword: value }))
              }
            />
            <ProfilePasswordField
              label="Password Baru"
              value={passwordForm.newPassword}
              error={passwordErrors.newPassword}
              onChange={(value) =>
                setPasswordForm((prev) => ({ ...prev, newPassword: value }))
              }
            />
            <ProfilePasswordField
              label="Konfirmasi Password"
              value={passwordForm.confirmPassword}
              error={passwordErrors.confirmPassword}
              onChange={(value) =>
                setPasswordForm((prev) => ({ ...prev, confirmPassword: value }))
              }
            />

            <div className="pt-2">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl"
              >
                Simpan Password
              </button>
            </div>
          </form>

          {passwordMessage && (
            <p className="text-sm text-slate-600 mt-4">{passwordMessage}</p>
          )}
        </PanelCard>
      </main>
    </div>
  );
};

export default ProfilePage;

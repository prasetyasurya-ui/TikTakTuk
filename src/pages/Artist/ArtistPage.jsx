import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, X, AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import Navbar from '../../components/Navbar';
import { artistApi, getCurrentSession } from '../../services/api';
import { normalizeText, SQL_MAX_LENGTH } from '../../utils/formValidation';

const ArtistPage = () => {
  const [artists, setArtists] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeModal, setActiveModal] = useState(null);
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [formData, setFormData] = useState({ name: "", genre: "" });
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const [loadError, setLoadError] = useState('');

  const session = getCurrentSession();
  const userRole = session.userRole;
  const isAdmin = userRole === 'admin';

  const loadArtists = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const result = await artistApi.getArtists();
      if (result.data?.ok) {
        setArtists(Array.isArray(result.data.data) ? result.data.data : []);
      } else {
        setArtists([]);
        setLoadError(result.data?.message || 'Gagal memuat data artis.');
      }
    } catch (error) {
      setArtists([]);
      setLoadError(error?.message || 'Gagal memuat data artis.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadArtists();
  }, []);

  // Auto-dismiss success messages
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const filteredArtists = useMemo(() => {
    return artists.filter(artist => 
      artist.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (artist.genre && artist.genre.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [artists, searchQuery]);

  const stats = {
    total: artists.length,
    genres: new Set(artists.map(a => a.genre).filter(Boolean)).size,
    eventAppearances: artists.reduce((sum, a) => sum + (a.event_count || 0), 0),
  };

  const handleCloseModal = () => {
    setActiveModal(null);
    setSelectedArtist(null);
    setFormData({ name: "", genre: "" });
    setErrors({});
  };

  const openCreateModal = () => {
    setFormData({ name: "", genre: "" });
    setErrors({});
    setActiveModal('create');
  };

  const openEditModal = (artist) => {
    setFormData({ name: artist.name, genre: artist.genre || "" });
    setSelectedArtist(artist);
    setErrors({});
    setActiveModal('edit');
  };

  const openDeleteModal = (artist) => {
    setSelectedArtist(artist);
    setErrors({});
    setActiveModal('delete');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const normalized = {
      name: normalizeText(formData.name),
      genre: normalizeText(formData.genre),
    };

    const nextErrors = {};
    if (!normalized.name) {
      nextErrors.name = 'Nama artist wajib diisi';
    } else if (normalized.name.length > SQL_MAX_LENGTH.ARTIST_NAME) {
      nextErrors.name = `Nama artist maksimal ${SQL_MAX_LENGTH.ARTIST_NAME} karakter`;
    }
    if (normalized.genre.length > SQL_MAX_LENGTH.GENRE) {
      nextErrors.genre = `Genre maksimal ${SQL_MAX_LENGTH.GENRE} karakter`;
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    let result;
    if (activeModal === 'create') {
      result = await artistApi.createArtist(normalized);
    } else {
      result = await artistApi.updateArtist(selectedArtist.artist_id, normalized);
    }

    if (result.data?.ok) {
      setSuccessMessage(activeModal === 'create' ? 'Artis berhasil ditambahkan!' : 'Artis berhasil diperbarui!');
      loadArtists();
      handleCloseModal();
    } else {
      setErrors({ submit: result.data?.message || 'Gagal menyimpan data.' });
    }
  };

  const handleDelete = async () => {
    const result = await artistApi.deleteArtist(selectedArtist.artist_id);
    if (result.data?.ok) {
      setSuccessMessage('Artis berhasil dihapus!');
      loadArtists();
      handleCloseModal();
    } else {
      setErrors({ submit: result.data?.message || 'Gagal menghapus data.' });
    }
  };

  // Genre badge colors matching the screenshot
  const getGenreColor = (genre) => {
    if (!genre) return 'bg-slate-100 text-slate-500';
    const g = genre.toUpperCase();
    if (g.includes('INDIE FOLK')) return 'bg-emerald-50 text-emerald-600 border-emerald-200';
    if (g.includes('INDIE POP')) return 'bg-blue-50 text-blue-600 border-blue-200';
    if (g.includes('R&B')) return 'bg-orange-50 text-orange-600 border-orange-200';
    if (g.includes('POP')) return 'bg-rose-50 text-rose-600 border-rose-200';
    if (g.includes('FOLK')) return 'bg-amber-50 text-amber-600 border-amber-200';
    if (g.includes('SONGWRITER')) return 'bg-purple-50 text-purple-600 border-purple-200';
    if (g.includes('ROCK')) return 'bg-red-50 text-red-600 border-red-200';
    if (g.includes('JAZZ')) return 'bg-indigo-50 text-indigo-600 border-indigo-200';
    return 'bg-slate-50 text-slate-600 border-slate-200';
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Success Toast */}
        {successMessage && (
          <div className="fixed top-20 right-6 z-[70] bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-lg shadow-emerald-200 font-bold text-sm animate-slide-in flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
            {successMessage}
          </div>
        )}

        {/* Header Section */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-8 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Daftar Artis</h1>
              <p className="text-slate-400 text-sm mt-1">Kelola artis yang ada di platform TikTakTuk</p>
            </div>
            {isAdmin && (
              <button 
                id="btn-add-artist"
                onClick={openCreateModal}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-3 rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2 text-sm"
              >
                <Plus size={18} strokeWidth={2.5} /> Tambah Artis
              </button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard label="TOTAL ARTIS" value={stats.total} />
          <StatCard label="GENRE" value={stats.genres} />
          <StatCard label="TAMPIL DI EVENT" value={stats.eventAppearances} />
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-xl font-black text-slate-900">Tabel Artis</h2>
            {/* Tab Switcher */}
            <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
              <button className="px-4 py-1.5 bg-white shadow-sm rounded-lg text-xs font-bold text-slate-900">Tabel</button>
              <button className="px-4 py-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">Daftar</button>
            </div>
          </div>

          <div className="px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input 
                id="search-artist"
                type="text" 
                placeholder="Cari nama atau genre..."
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none text-sm transition-all bg-white placeholder:text-slate-300"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="text-xs font-medium text-slate-400">
              {filteredArtists.length} artis ditemukan
            </div>
          </div>

          {loadError && (
            <div className="mx-6 mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {loadError}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-y border-slate-100">
                  <th className="px-6 py-3">Artis</th>
                  <th className="px-6 py-3">Genre</th>
                  {isAdmin && <th className="px-6 py-3 text-right"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  <tr>
                    <td colSpan={isAdmin ? 3 : 2} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                        <span className="text-slate-400 text-sm font-medium">Memuat data...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredArtists.length > 0 ? (
                  filteredArtists.map((artist) => (
                    <tr key={artist.artist_id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-black shadow-md shadow-blue-200 flex-shrink-0">
                            {artist.name.charAt(0)}
                          </div>
                          <span className="font-semibold text-slate-900 text-sm">{artist.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getGenreColor(artist.genre)}`}>
                          {artist.genre || 'Tanpa Genre'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-5">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              id={`btn-edit-${artist.artist_id}`}
                              onClick={() => openEditModal(artist)}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              title="Edit Artis"
                            >
                              <Pencil size={16} strokeWidth={2} />
                            </button>
                            <button 
                              id={`btn-delete-${artist.artist_id}`}
                              onClick={() => openDeleteModal(artist)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Hapus Artis"
                            >
                              <Trash2 size={16} strokeWidth={2} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={isAdmin ? 3 : 2} className="px-6 py-16 text-center">
                      <p className="text-slate-400 text-sm font-medium">Tidak ada artis ditemukan.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal Create/Edit */}
      {(activeModal === 'create' || activeModal === 'edit') && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={handleCloseModal}>
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">
                {activeModal === 'create' ? 'Tambah Artis Baru' : 'Edit Artis'}
              </h3>
              <button 
                id="btn-close-modal"
                onClick={handleCloseModal} 
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>

            <form className="px-6 pb-6 space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Nama Artis <span className="text-red-500">*</span>
                </label>
                <input 
                  id="input-artist-name"
                  type="text" 
                  className={`w-full px-4 py-3 rounded-xl border ${errors.name ? 'border-red-300 focus:ring-red-500/20 focus:border-red-400' : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-400'} focus:ring-2 outline-none transition-all text-sm placeholder:text-slate-300`}
                  placeholder="cth. Zutomayo"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  maxLength={SQL_MAX_LENGTH.ARTIST_NAME}
                />
                {errors.name && <p className="text-red-500 text-xs font-medium mt-1">{errors.name}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Genre</label>
                <input 
                  id="input-artist-genre"
                  type="text" 
                  className={`w-full px-4 py-3 rounded-xl border ${errors.genre ? 'border-red-300 focus:ring-red-500/20 focus:border-red-400' : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-400'} focus:ring-2 outline-none transition-all text-sm placeholder:text-slate-300`}
                  placeholder="cth. Pop"
                  maxLength={SQL_MAX_LENGTH.GENRE}
                  value={formData.genre}
                  onChange={(e) => setFormData((prev) => ({ ...prev, genre: e.target.value }))}
                />
                {errors.genre && <p className="text-red-500 text-xs font-medium mt-1">{errors.genre}</p>}
              </div>

              {errors.submit && (
                <div className="text-red-600 text-xs font-medium bg-red-50 p-3 rounded-xl border border-red-100">
                  {errors.submit}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button 
                  id="btn-cancel-form"
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-all active:scale-[0.98]"
                >
                  Batal
                </button>
                <button 
                  id="btn-submit-form"
                  type="submit"
                  className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-[0.98]"
                >
                  {activeModal === 'create' ? 'Tambah Artis' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Delete */}
      {activeModal === 'delete' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={handleCloseModal}>
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-red-600">Hapus Artis</h3>
              <button 
                id="btn-close-delete-modal"
                onClick={handleCloseModal} 
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              Apakah Anda yakin ingin menghapus artis ini? Tindakan ini tidak dapat dibatalkan.
            </p>
            {errors.submit && (
              <div className="text-red-600 text-xs font-medium bg-red-50 p-3 rounded-xl border border-red-100 mb-4">
                {errors.submit}
              </div>
            )}
            <div className="flex gap-3">
              <button 
                id="btn-cancel-delete"
                onClick={handleCloseModal}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-all active:scale-[0.98]"
              >
                Batal
              </button>
              <button 
                id="btn-confirm-delete"
                onClick={handleDelete}
                className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 shadow-lg shadow-red-200 transition-all active:scale-[0.98]"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

// Stat Card matching the screenshot exactly
const StatCard = ({ label, value }) => {
  return (
    <div className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 flex flex-col items-start gap-1">
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{label}</p>
      <h3 className="text-4xl font-black text-slate-900 leading-none">{value}</h3>
    </div>
  );
};

export default ArtistPage;

import React, { useEffect, useMemo, useState } from 'react';
import { Search, Music, Plus, X, AlertTriangle, Settings, User } from 'lucide-react';
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

  const session = getCurrentSession();
  const userRole = session.userRole;
  const isAdmin = userRole === 'admin';

  const loadArtists = async () => {
    setIsLoading(true);
    const result = await artistApi.getArtists();
    if (result.data?.ok) {
      setArtists(result.data.data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadArtists();
  }, []);

  const filteredArtists = useMemo(() => {
    return artists.filter(artist => 
      artist.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      artist.genre.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [artists, searchQuery]);

  const stats = {
    total: artists.length,
    genres: new Set(artists.map(a => a.genre).filter(Boolean)).size,
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
    setActiveModal('delete');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const normalized = {
      name: normalizeText(formData.name),
      genre: normalizeText(formData.genre),
    };

    const nextErrors = {};
    if (!normalized.name || normalized.name.length > SQL_MAX_LENGTH.ARTIST_NAME) {
      nextErrors.name = `Nama artist wajib diisi (maks ${SQL_MAX_LENGTH.ARTIST_NAME} karakter)`;
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

    if (result.ok) {
      loadArtists();
      handleCloseModal();
    } else {
      setErrors({ submit: result.message });
    }
  };

  const handleDelete = async () => {
    const result = await artistApi.deleteArtist(selectedArtist.artist_id);
    if (result.ok) {
      loadArtists();
      handleCloseModal();
    } else {
      setErrors({ submit: result.message });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Daftar Artis</h1>
              <p className="text-slate-500 mt-1">Kelola dan telusuri artis/band yang terdaftar</p>
            </div>
            {isAdmin && (
              <button 
                onClick={openCreateModal}
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-200 transition-all active:scale-95"
              >
                <Plus size={20} /> Tambah Artis
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <StatCard icon={<Music size={22}/>} label="Total Artis" value={stats.total} color="blue" />
            <StatCard icon={<User size={22}/>} label="Total Genre" value={stats.genres} color="purple" />
          </div>
        </div>

        <div className="mb-8 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col lg:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari nama artis atau genre..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Artis</th>
                  <th className="px-6 py-4">Genre</th>
                  {isAdmin && <th className="px-6 py-4 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  <tr>
                    <td colSpan={isAdmin ? 3 : 2} className="px-6 py-10 text-center text-slate-400 font-medium">Memuat data...</td>
                  </tr>
                ) : filteredArtists.length > 0 ? (
                  filteredArtists.map((artist) => (
                    <tr key={artist.artist_id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                            {artist.name.charAt(0)}
                          </div>
                          <span className="font-bold text-slate-800">{artist.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold uppercase tracking-tight">
                          {artist.genre || 'Tanpa Genre'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button 
                              onClick={() => openEditModal(artist)}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            >
                              <Settings size={18} />
                            </button>
                            <button 
                              onClick={() => openDeleteModal(artist)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <AlertTriangle size={18} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={isAdmin ? 3 : 2} className="px-6 py-10 text-center text-slate-400 font-medium">Tidak ada artis ditemukan.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal Create/Edit */}
      {(activeModal === 'create' || activeModal === 'edit') && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
              <h3 className="text-xl font-bold text-slate-900">
                {activeModal === 'create' ? 'Tambah Artis Baru' : 'Edit Artis'}
              </h3>
              <button onClick={handleCloseModal} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <form className="p-6 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nama Artis *</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                  placeholder="Contoh: Official Hige Dandism"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  required
                  maxLength={SQL_MAX_LENGTH.ARTIST_NAME}
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Genre</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                  placeholder="Contoh: Rock, Pop, Jazz"
                  maxLength={SQL_MAX_LENGTH.GENRE}
                  value={formData.genre}
                  onChange={(e) => setFormData((prev) => ({ ...prev, genre: e.target.value }))}
                />
                {errors.genre && <p className="text-red-500 text-xs mt-1">{errors.genre}</p>}
              </div>

              {errors.submit && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{errors.submit}</p>}

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all text-sm"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all text-sm"
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Hapus Artis?</h3>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              Anda akan menghapus <span className="font-bold text-slate-800">"{selectedArtist?.name}"</span>. Artis ini juga akan dihapus dari seluruh daftar penampil acara.
            </p>
            {errors.submit && <p className="text-red-500 text-sm mb-4 bg-red-50 p-2 rounded">{errors.submit}</p>}
            <div className="flex gap-3">
              <button 
                onClick={handleCloseModal}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all text-sm"
              >
                Batal
              </button>
              <button 
                onClick={handleDelete}
                className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-lg shadow-red-100 transition-all text-sm"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ icon, label, value, color }) => {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 transition-transform hover:scale-[1.02]">
      <div className={`p-3 rounded-xl ${colorMap[color]}`}>{icon}</div>
      <div>
        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{label}</p>
        <h3 className="text-2xl font-bold text-slate-900 leading-none mt-1">{value}</h3>
      </div>
    </div>
  );
};

export default ArtistPage;

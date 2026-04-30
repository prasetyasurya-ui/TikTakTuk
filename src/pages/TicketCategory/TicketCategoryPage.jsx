import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, X, Pencil, Trash2, ChevronDown } from 'lucide-react';
import Navbar from '../../components/Navbar';
import { ticketCategoryApi, fetchEvents, getCurrentSession } from '../../services/api';
import { normalizeText, SQL_MAX_LENGTH, isPositiveInteger, isNonNegativeNumber } from '../../utils/formValidation';

const TicketCategoryPage = () => {
  const [categories, setCategories] = useState([]);
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEventFilter, setSelectedEventFilter] = useState("Semua Acara");
  const [activeModal, setActiveModal] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [formData, setFormData] = useState({ 
    category_name: "", 
    quota: "", 
    price: "", 
    tevent_id: "" 
  });
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");

  const session = getCurrentSession();
  const userRole = session.userRole;
  const isAdminOrOrganizer = userRole === 'admin' || userRole === 'organizer';

  const loadData = async () => {
    setIsLoading(true);
    const [catResult, eventList] = await Promise.all([
      ticketCategoryApi.getTicketCategories(),
      fetchEvents()
    ]);
    
    if (catResult.data?.ok) {
      setCategories(catResult.data.data);
    }
    setEvents(eventList);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Auto-dismiss success messages
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const filteredCategories = useMemo(() => {
    return categories.filter(cat => {
      const matchesSearch = cat.category_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          cat.event_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesEvent = selectedEventFilter === "Semua Acara" || cat.event_name === selectedEventFilter;
      return matchesSearch && matchesEvent;
    });
  }, [categories, searchQuery, selectedEventFilter]);

  const stats = {
    total: categories.length,
    totalQuota: categories.reduce((sum, c) => sum + Number(c.quota), 0),
    maxPrice: categories.length > 0 ? Math.max(...categories.map(c => Number(c.price))) : 0,
  };

  const handleCloseModal = () => {
    setActiveModal(null);
    setSelectedCategory(null);
    setFormData({ category_name: "", quota: "", price: "", tevent_id: "" });
    setErrors({});
  };

  const openCreateModal = () => {
    setFormData({ 
      category_name: "", 
      quota: "", 
      price: "", 
      tevent_id: events[0]?.id || "" 
    });
    setErrors({});
    setActiveModal('create');
  };

  const openEditModal = (cat) => {
    setFormData({ 
      category_name: cat.category_name, 
      quota: String(cat.quota), 
      price: String(cat.price), 
      tevent_id: cat.tevent_id 
    });
    setSelectedCategory(cat);
    setErrors({});
    setActiveModal('edit');
  };

  const openDeleteModal = (cat) => {
    setSelectedCategory(cat);
    setErrors({});
    setActiveModal('delete');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const normalized = {
      category_name: normalizeText(formData.category_name),
      quota: Number(formData.quota),
      price: Number(formData.price),
      tevent_id: formData.tevent_id,
    };

    const nextErrors = {};
    if (!normalized.category_name) {
      nextErrors.category_name = 'Nama kategori wajib diisi';
    } else if (normalized.category_name.length > SQL_MAX_LENGTH.CATEGORY_NAME) {
      nextErrors.category_name = `Nama kategori maksimal ${SQL_MAX_LENGTH.CATEGORY_NAME} karakter`;
    }
    if (!isPositiveInteger(normalized.quota)) {
      nextErrors.quota = "Kuota harus bilangan bulat positif (> 0)";
    }
    if (!isNonNegativeNumber(normalized.price)) {
      nextErrors.price = "Harga harus berupa bilangan tidak negatif (>= 0)";
    }
    if (!normalized.tevent_id) {
      nextErrors.tevent_id = "Event wajib dipilih";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    let result;
    if (activeModal === 'create') {
      result = await ticketCategoryApi.createTicketCategory(normalized);
    } else {
      result = await ticketCategoryApi.updateTicketCategory(selectedCategory.category_id, normalized);
    }

    if (result.data?.ok) {
      setSuccessMessage(activeModal === 'create' ? 'Kategori tiket berhasil ditambahkan!' : 'Kategori tiket berhasil diperbarui!');
      loadData();
      handleCloseModal();
    } else {
      setErrors({ submit: result.data?.message || 'Gagal menyimpan data.' });
    }
  };

  const handleDelete = async () => {
    const result = await ticketCategoryApi.deleteTicketCategory(selectedCategory.category_id);
    if (result.data?.ok) {
      setSuccessMessage('Kategori tiket berhasil dihapus!');
      loadData();
      handleCloseModal();
    } else {
      setErrors({ submit: result.data?.message || 'Gagal menghapus data.' });
    }
  };

  const formatIDR = (val) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Get unique event names for filter dropdown
  const eventNames = useMemo(() => {
    return [...new Set(categories.map(c => c.event_name))].sort();
  }, [categories]);

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
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Kategori Tiket</h1>
              <p className="text-slate-400 text-sm mt-1">Kelola kategori dan harga tiket per acara</p>
            </div>
            {isAdminOrOrganizer && (
              <button 
                id="btn-add-category"
                onClick={openCreateModal}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-blue-100 transition-all active:scale-95 flex items-center gap-2 text-sm"
              >
                <Plus size={18} strokeWidth={2.5} /> Tambah Kategori
              </button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard label="TOTAL KATEGORI" value={stats.total} />
          <StatCard label="TOTAL KUOTA" value={stats.totalQuota.toLocaleString('id-ID')} />
          <StatCard label="HARGA TERTINGGI" value={formatIDR(stats.maxPrice)} isCurrency />
        </div>

        {/* Search & Filter Row */}
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input 
              id="search-category"
              type="text" 
              placeholder="Cari kategori..."
              className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none text-sm transition-all bg-white placeholder:text-slate-300"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="relative">
            <select 
              id="filter-event"
              className="appearance-none px-4 py-2.5 pr-10 rounded-xl border border-slate-200 bg-white outline-none text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer font-medium text-slate-700 transition-all"
              value={selectedEventFilter}
              onChange={(e) => setSelectedEventFilter(e.target.value)}
            >
              <option>Semua Acara</option>
              {eventNames.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          </div>
        </div>

        {/* Count + Toggle Row */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-medium text-slate-400">
            {filteredCategories.length} kategori ditemukan
          </div>
          <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
            <button className="px-4 py-1.5 bg-white shadow-sm rounded-lg text-xs font-bold text-slate-900">Tabel</button>
            <button className="px-4 py-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">Daftar</button>
          </div>
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="px-6 py-3">Kategori</th>
                  <th className="px-6 py-3">Acara</th>
                  <th className="px-6 py-3">Harga</th>
                  <th className="px-6 py-3">Kuota</th>
                  {isAdminOrOrganizer && <th className="px-6 py-3">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  <tr>
                    <td colSpan={isAdminOrOrganizer ? 5 : 4} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                        <span className="text-slate-400 text-sm font-medium">Memuat data...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredCategories.length > 0 ? (
                  filteredCategories.map((cat) => (
                    <tr key={cat.category_id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-5">
                        <span className="font-bold text-slate-900 text-sm">{cat.category_name}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-slate-500 text-sm">{cat.event_name}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="font-bold text-blue-600 text-sm">{formatIDR(cat.price)}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-slate-500 text-sm">{cat.quota.toLocaleString('id-ID')} tiket</span>
                      </td>
                      {isAdminOrOrganizer && (
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <button 
                              id={`btn-edit-${cat.category_id}`}
                              onClick={() => openEditModal(cat)}
                              className="flex items-center gap-1.5 text-slate-400 hover:text-blue-600 transition-colors text-sm"
                              title="Edit Kategori"
                            >
                              <Pencil size={14} strokeWidth={2} />
                              <span className="font-medium">Edit</span>
                            </button>
                            <button 
                              id={`btn-delete-${cat.category_id}`}
                              onClick={() => openDeleteModal(cat)}
                              className="flex items-center gap-1.5 text-slate-400 hover:text-red-600 transition-colors text-sm"
                              title="Hapus Kategori"
                            >
                              <Trash2 size={14} strokeWidth={2} />
                              <span className="font-medium text-red-400 hover:text-red-600">Hapus</span>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={isAdminOrOrganizer ? 5 : 4} className="px-6 py-16 text-center">
                      <p className="text-slate-400 text-sm font-medium">Tidak ada kategori ditemukan.</p>
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
                {activeModal === 'create' ? 'Tambah Kategori Baru' : 'Edit Kategori'}
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
                  Acara <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select 
                    id="input-event"
                    className={`w-full appearance-none px-4 py-3 pr-10 rounded-xl border ${errors.tevent_id ? 'border-red-300 focus:ring-red-500/20 focus:border-red-400' : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-400'} bg-white focus:ring-2 outline-none transition-all text-sm font-medium cursor-pointer`}
                    value={formData.tevent_id}
                    onChange={(e) => setFormData((prev) => ({ ...prev, tevent_id: e.target.value }))}
                    disabled={activeModal === 'edit'}
                    required
                  >
                    <option value="">Pilih acara...</option>
                    {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                </div>
                {errors.tevent_id && <p className="text-red-500 text-xs font-medium mt-1">{errors.tevent_id}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Nama Kategori <span className="text-red-500">*</span>
                </label>
                <input 
                  id="input-category-name"
                  type="text" 
                  className={`w-full px-4 py-3 rounded-xl border ${errors.category_name ? 'border-red-300 focus:ring-red-500/20 focus:border-red-400' : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-400'} focus:ring-2 outline-none transition-all text-sm placeholder:text-slate-300`}
                  placeholder="cth. WVIP"
                  value={formData.category_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, category_name: e.target.value }))}
                  maxLength={SQL_MAX_LENGTH.CATEGORY_NAME}
                />
                {errors.category_name && <p className="text-red-500 text-xs font-medium mt-1">{errors.category_name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Harga (Rp) <span className="text-red-500">*</span>
                  </label>
                  <input 
                    id="input-price"
                    type="number" 
                    className={`w-full px-4 py-3 rounded-xl border ${errors.price ? 'border-red-300 focus:ring-red-500/20 focus:border-red-400' : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-400'} focus:ring-2 outline-none transition-all text-sm`}
                    placeholder="750000"
                    value={formData.price}
                    onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                    min={0}
                  />
                  {errors.price && <p className="text-red-500 text-xs font-medium mt-1">{errors.price}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Kuota <span className="text-red-500">*</span>
                  </label>
                  <input 
                    id="input-quota"
                    type="number" 
                    className={`w-full px-4 py-3 rounded-xl border ${errors.quota ? 'border-red-300 focus:ring-red-500/20 focus:border-red-400' : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-400'} focus:ring-2 outline-none transition-all text-sm`}
                    placeholder="100"
                    value={formData.quota}
                    onChange={(e) => setFormData((prev) => ({ ...prev, quota: e.target.value }))}
                    min={1}
                  />
                  {errors.quota && <p className="text-red-500 text-xs font-medium mt-1">{errors.quota}</p>}
                </div>
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
                  {activeModal === 'create' ? 'Tambah' : 'Simpan'}
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
              <h3 className="text-xl font-bold text-red-600">Hapus Kategori</h3>
              <button 
                id="btn-close-delete-modal"
                onClick={handleCloseModal} 
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed mb-2">
              Apakah Anda yakin ingin menghapus kategori ini? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="bg-slate-50 rounded-xl p-3 mb-6 text-sm">
              <p className="text-slate-500"><span className="font-semibold text-slate-700">ID:</span> {selectedCategory?.category_id}</p>
              <p className="text-slate-500"><span className="font-semibold text-slate-700">Nama:</span> {selectedCategory?.category_name}</p>
            </div>
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

// Stat Card matching the screenshot
const StatCard = ({ label, value, isCurrency = false }) => {
  return (
    <div className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 flex flex-col items-start gap-1">
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{label}</p>
      <h3 className={`${isCurrency ? 'text-2xl' : 'text-4xl'} font-black text-slate-900 leading-none`}>{value}</h3>
    </div>
  );
};

export default TicketCategoryPage;

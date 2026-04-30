import React, { useEffect, useMemo, useState } from 'react';
import { Search, Ticket, Plus, X, AlertTriangle, Settings, Calendar, Users } from 'lucide-react';
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
  const [selectedCategory, setSelectedArtist] = useState(null);
  const [formData, setFormData] = useState({ 
    category_name: "", 
    quota: "", 
    price: "", 
    tevent_id: "" 
  });
  const [errors, setErrors] = useState({});

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
    setSelectedArtist(null);
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
    setSelectedArtist(cat);
    setErrors({});
    setActiveModal('edit');
  };

  const openDeleteModal = (cat) => {
    setSelectedArtist(cat);
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
    if (!normalized.category_name || normalized.category_name.length > SQL_MAX_LENGTH.CATEGORY_NAME) {
      nextErrors.category_name = `Nama kategori wajib diisi (maks ${SQL_MAX_LENGTH.CATEGORY_NAME} karakter)`;
    }
    if (!isPositiveInteger(normalized.quota)) {
      nextErrors.quota = "Kuota harus bilangan bulat positif (> 0)";
    }
    if (!isNonNegativeNumber(normalized.price)) {
      nextErrors.price = "Harga tidak boleh negatif";
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

    if (result.ok) {
      loadData();
      handleCloseModal();
    } else {
      setErrors({ submit: result.message });
    }
  };

  const handleDelete = async () => {
    const result = await ticketCategoryApi.deleteTicketCategory(selectedCategory.category_id);
    if (result.ok) {
      loadData();
      handleCloseModal();
    } else {
      setErrors({ submit: result.message });
    }
  };

  const formatIDR = (val) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Kategori Tiket</h1>
              <p className="text-slate-500 mt-1">Kelola pembagian kelas dan harga tiket per acara</p>
            </div>
            {isAdminOrOrganizer && (
              <button 
                onClick={openCreateModal}
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-200 transition-all active:scale-95"
              >
                <Plus size={20} /> Tambah Kategori
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard icon={<Ticket size={22}/>} label="Total Kategori" value={stats.total} color="blue" />
            <StatCard icon={<Users size={22}/>} label="Total Kuota" value={stats.totalQuota.toLocaleString()} color="amber" />
            <StatCard icon={<Music size={22}/>} label="Harga Tertinggi" value={formatIDR(stats.maxPrice)} color="emerald" />
          </div>
        </div>

        <div className="mb-8 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col lg:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari kategori atau event..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select 
            className="px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none text-sm focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
            value={selectedEventFilter}
            onChange={(e) => setSelectedEventFilter(e.target.value)}
          >
            <option>Semua Acara</option>
            {events.map(ev => <option key={ev.id} value={ev.title}>{ev.title}</option>)}
          </select>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Kategori</th>
                  <th className="px-6 py-4">Acara</th>
                  <th className="px-6 py-4 text-right">Harga</th>
                  <th className="px-6 py-4 text-center">Kuota</th>
                  {isAdminOrOrganizer && <th className="px-6 py-4 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  <tr>
                    <td colSpan={isAdminOrOrganizer ? 5 : 4} className="px-6 py-10 text-center text-slate-400 font-medium">Memuat data...</td>
                  </tr>
                ) : filteredCategories.length > 0 ? (
                  filteredCategories.map((cat) => (
                    <tr key={cat.category_id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-800">{cat.category_name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Calendar size={14} className="text-slate-400" />
                          <span className="text-sm font-medium">{cat.event_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-bold text-blue-600">{formatIDR(cat.price)}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-bold">
                          {cat.quota.toLocaleString()} tiket
                        </span>
                      </td>
                      {isAdminOrOrganizer && (
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button 
                              onClick={() => openEditModal(cat)}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            >
                              <Settings size={18} />
                            </button>
                            <button 
                              onClick={() => openDeleteModal(cat)}
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
                    <td colSpan={isAdminOrOrganizer ? 5 : 4} className="px-6 py-10 text-center text-slate-400 font-medium">Tidak ada kategori ditemukan.</td>
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
                {activeModal === 'create' ? 'Tambah Kategori Tiket' : 'Edit Kategori Tiket'}
              </h3>
              <button onClick={handleCloseModal} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <form className="p-6 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Acara *</label>
                <select 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                  value={formData.tevent_id}
                  onChange={(e) => setFormData((prev) => ({ ...prev, tevent_id: e.target.value }))}
                  disabled={activeModal === 'edit'}
                  required
                >
                  {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                </select>
                {errors.tevent_id && <p className="text-red-500 text-xs mt-1">{errors.tevent_id}</p>}
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nama Kategori *</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                  placeholder="Contoh: VIP, Regular, Festival"
                  value={formData.category_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, category_name: e.target.value }))}
                  required
                  maxLength={SQL_MAX_LENGTH.CATEGORY_NAME}
                />
                {errors.category_name && <p className="text-red-500 text-xs mt-1">{errors.category_name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Harga (Rp) *</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                    placeholder="0"
                    value={formData.price}
                    onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                    min={0}
                    required
                  />
                  {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price}</p>}
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Kuota *</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                    placeholder="0"
                    value={formData.quota}
                    onChange={(e) => setFormData((prev) => ({ ...prev, quota: e.target.value }))}
                    min={1}
                    required
                  />
                  {errors.quota && <p className="text-red-500 text-xs mt-1">{errors.quota}</p>}
                </div>
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
                  {activeModal === 'create' ? 'Tambah Kategori' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Delete */}
      {activeModal === 'delete' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-sm rounded-2xl shadow-2xl p-6 text-center animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Hapus Kategori?</h3>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              Anda akan menghapus kategori <span className="font-bold text-slate-800">"{selectedCategory?.category_name}"</span> dari event <span className="font-bold text-slate-800">"{selectedCategory?.event_name}"</span>.
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
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
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

export default TicketCategoryPage;

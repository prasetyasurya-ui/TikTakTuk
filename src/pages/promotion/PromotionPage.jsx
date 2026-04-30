import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import Navbar from '../../components/Navbar';
import PanelCard from '../../components/ui/PanelCard';
import StatCard from '../../components/ui/StatCard';
import { getCurrentSession } from '../../services/api';
import {
  createPromotion,
  deletePromotion,
  fetchPromotions,
  updatePromotion,
} from '../../services/api/promotionApi';

function formatIDR(value) {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateOnly(value) {
  if (!value) return '-';
  const str = String(value);
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return str;
  return str;
}

function DiscountTypePill({ type }) {
  const normalized = String(type || '').toUpperCase();

  const labelByType = {
    PERCENTAGE: 'PERSENTASE',
    NOMINAL: 'NOMINAL',
  };

  const styles = {
    PERCENTAGE: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
    NOMINAL: 'bg-amber-50 text-amber-700 border-amber-200',
  };

  const className = styles[normalized] || 'bg-slate-50 text-slate-700 border-slate-200';
  const label = labelByType[normalized] || normalized || 'UNKNOWN';

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black tracking-widest border ${className}`.trim()}>
      {label}
    </span>
  );
}

function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <PanelCard className="w-full max-w-md p-6 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-2 rounded-lg hover:bg-slate-50 text-slate-600"
          aria-label="Tutup"
        >
          <X size={18} />
        </button>
        <h2 className="text-lg font-black tracking-tight text-slate-900 mb-4">{title}</h2>
        {children}
      </PanelCard>
    </div>
  );
}

const TYPE_OPTIONS = [
  { label: 'Semua Tipe', value: '' },
  { label: 'Persentase (%)', value: 'PERCENTAGE' },
  { label: 'Nominal', value: 'NOMINAL' },
];

const PromotionPage = () => {
  const session = getCurrentSession();
  const isAdmin = session.isLoggedIn && session.userRole === 'admin';

  const [promotions, setPromotions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [banner, setBanner] = useState(null);

  const [formModal, setFormModal] = useState({
    open: false,
    mode: 'create',
    promotionId: '',
    promoCode: '',
    discountType: 'PERCENTAGE',
    discountValue: '',
    startDate: '',
    endDate: '',
    usageLimit: '',
  });

  const [deleteModal, setDeleteModal] = useState({ open: false, promotion: null });

  const load = async () => {
    setIsLoading(true);
    const data = await fetchPromotions();
    setPromotions(Array.isArray(data) ? data : []);
    setIsLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const totalPromo = promotions.length;
    const totalUsage = promotions.reduce((sum, p) => sum + (Number(p.usedCount) || 0), 0);
    const percentageCount = promotions.filter((p) => String(p.discountType).toUpperCase() === 'PERCENTAGE').length;
    return { totalPromo, totalUsage, percentageCount };
  }, [promotions]);

  const filteredPromotions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const type = String(typeFilter || '').toUpperCase();

    return promotions.filter((p) => {
      const matchesSearch = !q ? true : String(p.promoCode || '').toLowerCase().includes(q);
      const matchesType = !type ? true : String(p.discountType || '').toUpperCase() === type;
      return matchesSearch && matchesType;
    });
  }, [promotions, searchQuery, typeFilter]);

  const openCreate = () => {
    setBanner(null);
    setFormModal({
      open: true,
      mode: 'create',
      promotionId: '',
      promoCode: '',
      discountType: 'PERCENTAGE',
      discountValue: '',
      startDate: '',
      endDate: '',
      usageLimit: '',
    });
  };

  const openEdit = (promotion) => {
    setBanner(null);
    setFormModal({
      open: true,
      mode: 'edit',
      promotionId: promotion.promotionId,
      promoCode: promotion.promoCode,
      discountType: String(promotion.discountType || 'PERCENTAGE').toUpperCase(),
      discountValue: String(promotion.discountValue ?? ''),
      startDate: promotion.startDate,
      endDate: promotion.endDate,
      usageLimit: String(promotion.usageLimit ?? ''),
    });
  };

  const closeForm = () => {
    setFormModal((prev) => ({ ...prev, open: false }));
  };

  const submitForm = async () => {
    setBanner(null);

    const payload = {
      promoCode: formModal.promoCode,
      discountType: formModal.discountType,
      discountValue: formModal.discountValue,
      startDate: formModal.startDate,
      endDate: formModal.endDate,
      usageLimit: formModal.usageLimit,
    };

    const result =
      formModal.mode === 'create'
        ? await createPromotion(payload, { userRole: session.userRole })
        : await updatePromotion(formModal.promotionId, payload, { userRole: session.userRole });

    if (!result.ok) {
      setBanner({ type: 'error', message: result.message || 'Gagal menyimpan promo.' });
      return;
    }

    closeForm();
    setBanner({
      type: 'success',
      message: formModal.mode === 'create' ? 'Promo berhasil dibuat.' : 'Promo berhasil diperbarui.',
    });
    await load();
  };

  const confirmDelete = async () => {
    if (!deleteModal.promotion) return;
    setBanner(null);

    const result = await deletePromotion(deleteModal.promotion.promotionId, { userRole: session.userRole });
    if (!result.ok) {
      setBanner({ type: 'error', message: result.message || 'Gagal menghapus promo.' });
      return;
    }

    setDeleteModal({ open: false, promotion: null });
    setBanner({ type: 'success', message: 'Promo berhasil dihapus.' });
    await load();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Manajemen Promosi</h1>
            <p className="text-slate-500 mt-1">Kelola kode promo dan kampanye diskon</p>
          </div>

          {isAdmin ? (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-sm"
            >
              <Plus size={16} />
              Buat Promo
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <StatCard label="Total Promo" value={stats.totalPromo} />
          <StatCard label="Total Penggunaan" value={`${stats.totalUsage.toLocaleString('id-ID')}x`} />
          <StatCard label="Tipe Persentase" value={stats.percentageCount} />
        </div>

        {banner ? (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-bold ${
              banner.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`.trim()}
          >
            {banner.message}
          </div>
        ) : null}

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              type="text"
              placeholder="Cari kode promo..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all shadow-sm bg-white"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white outline-none text-sm cursor-pointer md:w-56 shadow-sm"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <PanelCard className="overflow-hidden">
          {isLoading ? (
            <div className="p-8">
              <p className="text-slate-500 text-sm font-medium">Memuat data promosi...</p>
            </div>
          ) : filteredPromotions.length === 0 ? (
            <div className="p-8">
              <p className="text-slate-500 text-sm font-medium">Tidak ada promosi yang cocok.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
                    <th className="text-left px-6 py-4">Kode Promo</th>
                    <th className="text-left px-6 py-4">Tipe</th>
                    <th className="text-left px-6 py-4">Nilai Diskon</th>
                    <th className="text-left px-6 py-4">Mulai</th>
                    <th className="text-left px-6 py-4">Berakhir</th>
                    <th className="text-right px-6 py-4">Penggunaan</th>
                    {isAdmin ? <th className="text-right px-6 py-4">Action</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPromotions.map((promo) => (
                    <tr key={promo.promotionId} className="bg-white">
                      <td className="px-6 py-4 font-black text-slate-900">{promo.promoCode}</td>
                      <td className="px-6 py-4">
                        <DiscountTypePill type={promo.discountType} />
                      </td>
                      <td className="px-6 py-4 text-slate-700 font-bold">
                        {String(promo.discountType).toUpperCase() === 'PERCENTAGE'
                          ? `${promo.discountValue}%`
                          : formatIDR(promo.discountValue)}
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium">{formatDateOnly(promo.startDate)}</td>
                      <td className="px-6 py-4 text-slate-600 font-medium">{formatDateOnly(promo.endDate)}</td>
                      <td className="px-6 py-4 text-right font-black text-slate-900">
                        {promo.usedCount} / {promo.usageLimit}
                      </td>
                      {isAdmin ? (
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(promo)}
                              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
                              aria-label="Update"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteModal({ open: true, promotion: promo })}
                              className="p-2 rounded-lg border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-slate-700 hover:text-rose-600"
                              aria-label="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PanelCard>

        {formModal.open ? (
          <ModalShell
            title={formModal.mode === 'create' ? 'Buat Promo Baru' : 'Edit Promo'}
            onClose={closeForm}
          >
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Kode Promo</p>
                <input
                  value={formModal.promoCode}
                  onChange={(e) => setFormModal((prev) => ({ ...prev, promoCode: e.target.value }))}
                  type="text"
                  placeholder="CTH: TIKTAK20"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white outline-none text-sm shadow-sm"
                />
              </div>

              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tipe Diskon</p>
                <select
                  value={formModal.discountType}
                  onChange={(e) => setFormModal((prev) => ({ ...prev, discountType: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white outline-none text-sm cursor-pointer shadow-sm"
                >
                  <option value="PERCENTAGE">Persentase (%)</option>
                  <option value="NOMINAL">Nominal</option>
                </select>
              </div>

              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nilai Diskon</p>
                <input
                  value={formModal.discountValue}
                  onChange={(e) => setFormModal((prev) => ({ ...prev, discountValue: e.target.value }))}
                  type="number"
                  min="0"
                  placeholder="cth. 20"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white outline-none text-sm shadow-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tanggal Mulai</p>
                  <input
                    value={formModal.startDate}
                    onChange={(e) => setFormModal((prev) => ({ ...prev, startDate: e.target.value }))}
                    type="date"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white outline-none text-sm shadow-sm"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tanggal Berakhir</p>
                  <input
                    value={formModal.endDate}
                    onChange={(e) => setFormModal((prev) => ({ ...prev, endDate: e.target.value }))}
                    type="date"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white outline-none text-sm shadow-sm"
                  />
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Batas Penggunaan</p>
                <input
                  value={formModal.usageLimit}
                  onChange={(e) => setFormModal((prev) => ({ ...prev, usageLimit: e.target.value }))}
                  type="number"
                  min="1"
                  placeholder="1"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white outline-none text-sm shadow-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={submitForm}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  {formModal.mode === 'create' ? 'Buat' : 'Simpan'}
                </button>
              </div>
            </div>
          </ModalShell>
        ) : null}

        {deleteModal.open && deleteModal.promotion ? (
          <ModalShell
            title="Hapus Promo"
            onClose={() => setDeleteModal({ open: false, promotion: null })}
          >
            <div className="space-y-5">
              <div>
                <p className="text-rose-600 font-black">Apakah Anda yakin ingin menghapus kode promo ini?</p>
                <p className="text-slate-500 text-sm mt-1">Tindakan ini tidak dapat dibatalkan.</p>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteModal({ open: false, promotion: null })}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
                >
                  Hapus
                </button>
              </div>
            </div>
          </ModalShell>
        ) : null}
      </main>
    </div>
  );
};

export default PromotionPage;

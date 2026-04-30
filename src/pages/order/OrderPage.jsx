import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Search, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import PanelCard from '../../components/ui/PanelCard';
import StatCard from '../../components/ui/StatCard';
import { getCurrentSession } from '../../services/api';
import {
  deleteOrder,
  fetchOrders,
  updateOrderPaymentStatus,
} from '../../services/api/ordersApi';

function formatIDR(value) {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatTableDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const pad2 = (n) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const min = pad2(date.getMinutes());

  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function PaymentStatusPill({ status }) {
  const normalized = String(status || '').toUpperCase();
  const labelByStatus = {
    PAID: 'LUNAS',
    PENDING: 'PENDING',
    CANCELLED: 'DIBATALKAN',
  };
  const styles = {
    PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
    CANCELLED: 'bg-rose-50 text-rose-700 border-rose-200',
  };

  const className = styles[normalized] || 'bg-slate-50 text-slate-700 border-slate-200';
  const label = labelByStatus[normalized] || normalized || 'UNKNOWN';

  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black tracking-widest border ${className}`.trim()}
    >
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

const STATUS_OPTIONS = [
  { label: 'Semua Status', value: '' },
  { label: 'Lunas', value: 'PAID' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Dibatalkan', value: 'CANCELLED' },
];

const OrderPage = () => {
  const session = getCurrentSession();
  const isLoggedIn = session.isLoggedIn;
  const userRole = session.userRole;
  const userId = session.userId;
  const isAdmin = userRole === 'admin';
  const showCustomerColumn = userRole === 'admin' || userRole === 'organizer';
  const showRevenue = userRole === 'admin' || userRole === 'organizer';

  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [banner, setBanner] = useState(null);

  const [updateModal, setUpdateModal] = useState({
    open: false,
    order: null,
    paymentStatus: 'PENDING',
  });
  const [deleteModal, setDeleteModal] = useState({ open: false, order: null });

  const loadOrders = async () => {
    setIsLoading(true);
    const data = await fetchOrders({ userRole, userId });
    setOrders(Array.isArray(data) ? data : []);
    setIsLoading(false);
  };

  useEffect(() => {
    if (!isLoggedIn) {
      setIsLoading(false);
      setOrders([]);
      return;
    }

    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, userRole, userId]);

  const stats = useMemo(() => {
    const total = orders.length;
    const paid = orders.filter((o) => String(o.paymentStatus).toUpperCase() === 'PAID').length;
    const pending = orders.filter((o) => String(o.paymentStatus).toUpperCase() === 'PENDING').length;
    const revenue = orders
      .filter((o) => String(o.paymentStatus).toUpperCase() === 'PAID')
      .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

    return { total, paid, pending, revenue };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const status = String(statusFilter || '').toUpperCase();

    return orders.filter((order) => {
      const idMatch = String(order.orderId || '').toLowerCase().includes(q);
      const customerMatch = showCustomerColumn
        ? String(order.customerName || '').toLowerCase().includes(q)
        : false;
      const matchesSearch = !q ? true : idMatch || customerMatch;

      const matchesStatus = !status ? true : String(order.paymentStatus).toUpperCase() === status;
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, statusFilter, showCustomerColumn]);

  const pageSubtitle = useMemo(() => {
    if (userRole === 'customer') return 'Riwayat pembelian tiket Anda';
    if (userRole === 'organizer') return 'Order dari event yang Anda selenggarakan';
    if (userRole === 'admin') return 'Kelola seluruh order yang terdaftar';
    return 'Daftar order';
  }, [userRole]);

  const handleOpenUpdate = (order) => {
    setUpdateModal({
      open: true,
      order,
      paymentStatus: String(order.paymentStatus || 'PENDING').toUpperCase(),
    });
  };

  const handleSubmitUpdate = async () => {
    if (!updateModal.order) return;
    setBanner(null);
    const result = await updateOrderPaymentStatus(
      updateModal.order.id,
      updateModal.paymentStatus,
      { userRole }
    );

    if (!result.ok) {
      setBanner({ type: 'error', message: result.message || 'Gagal memperbarui order.' });
      return;
    }

    setUpdateModal({ open: false, order: null, paymentStatus: 'PENDING' });
    setBanner({ type: 'success', message: 'Order berhasil diperbarui.' });
    await loadOrders();
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.order) return;
    setBanner(null);

    const result = await deleteOrder(deleteModal.order.id, { userRole });
    if (!result.ok) {
      setBanner({ type: 'error', message: result.message || 'Gagal menghapus order.' });
      return;
    }

    setDeleteModal({ open: false, order: null });
    setBanner({ type: 'success', message: 'Order berhasil dihapus.' });
    await loadOrders();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Daftar Order</h1>
          <p className="text-slate-500 mt-1">{pageSubtitle}</p>
        </div>

        {!isLoggedIn ? (
          <PanelCard className="p-8">
            <p className="text-slate-700 font-bold">Anda belum login.</p>
            <p className="text-slate-500 text-sm mt-1">Silakan login untuk melihat daftar order.</p>
            <Link
              to="/"
              className="inline-flex mt-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-lg"
            >
              Ke Halaman Login
            </Link>
          </PanelCard>
        ) : (
          <>
            <div
              className={
                showRevenue
                  ? 'grid grid-cols-1 md:grid-cols-4 gap-6 mb-6'
                  : 'grid grid-cols-1 md:grid-cols-3 gap-6 mb-6'
              }
            >
              <StatCard label="Total Order" value={stats.total} />
              <StatCard label="LUNAS" value={stats.paid} valueClassName="text-emerald-600" />
              <StatCard label="PENDING" value={stats.pending} valueClassName="text-amber-600" />
              {showRevenue ? (
                <StatCard
                  label="Total Revenue"
                  value={formatIDR(stats.revenue)}
                  valueClassName="text-slate-900"
                />
              ) : null}
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
                  placeholder={showCustomerColumn ? 'Cari ID atau pelanggan...' : 'Cari order ID...'}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all shadow-sm bg-white"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white outline-none text-sm cursor-pointer md:w-56 shadow-sm"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value || 'all'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <PanelCard className="overflow-hidden">
              {isLoading ? (
                <div className="p-8">
                  <p className="text-slate-500 text-sm font-medium">Memuat data order...</p>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="p-8">
                  <p className="text-slate-500 text-sm font-medium">Tidak ada order yang cocok.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
                        <th className="text-left px-6 py-4">Order ID</th>
                        {showCustomerColumn ? (
                          <th className="text-left px-6 py-4">Pelanggan</th>
                        ) : null}
                        <th className="text-left px-6 py-4">Tanggal</th>
                        <th className="text-left px-6 py-4">Status</th>
                        <th className="text-right px-6 py-4">Total</th>
                        {isAdmin ? <th className="text-right px-6 py-4">Action</th> : null}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredOrders.map((order) => (
                        <tr key={order.id} className="bg-white">
                          <td className="px-6 py-4 font-bold text-slate-900">{order.orderId}</td>
                          {showCustomerColumn ? (
                            <td className="px-6 py-4 text-slate-700 font-semibold">{order.customerName}</td>
                          ) : null}
                          <td className="px-6 py-4 text-slate-600 font-medium">
                            {formatTableDateTime(order.orderDate)}
                          </td>
                          <td className="px-6 py-4">
                            <PaymentStatusPill status={order.paymentStatus} />
                          </td>
                          <td className="px-6 py-4 text-right font-black text-slate-900">
                            {formatIDR(order.totalAmount)}
                          </td>
                          {isAdmin ? (
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleOpenUpdate(order)}
                                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
                                  aria-label="Update"
                                >
                                  <Pencil size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteModal({ open: true, order })}
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

            {updateModal.open && updateModal.order ? (
              <ModalShell
                title="Update Status Order"
                onClose={() => setUpdateModal({ open: false, order: null, paymentStatus: 'PENDING' })}
              >
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Order ID</p>
                    <p className="text-sm font-black text-slate-900 mt-1">{updateModal.order.orderId}</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Payment Status</p>
                    <select
                      value={updateModal.paymentStatus}
                      onChange={(e) => setUpdateModal((prev) => ({ ...prev, paymentStatus: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white outline-none text-sm cursor-pointer shadow-sm"
                    >
                      <option value="PAID">Lunas</option>
                      <option value="PENDING">Pending</option>
                      <option value="CANCELLED">Dibatalkan</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setUpdateModal({ open: false, order: null, paymentStatus: 'PENDING' })}
                      className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitUpdate}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
                    >
                      Update
                    </button>
                  </div>
                </div>
              </ModalShell>
            ) : null}

            {deleteModal.open && deleteModal.order ? (
              <ModalShell
                title="Hapus Order"
                onClose={() => setDeleteModal({ open: false, order: null })}
              >
                <div className="space-y-5">
                  <div>
                    <p className="text-rose-600 font-black">Apakah Anda yakin ingin menghapus catatan order ini?</p>
                    <p className="text-slate-500 text-sm mt-1">Tindakan ini tidak dapat dibatalkan.</p>
                  </div>

                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setDeleteModal({ open: false, order: null })}
                      className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDelete}
                      className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              </ModalShell>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
};

export default OrderPage;

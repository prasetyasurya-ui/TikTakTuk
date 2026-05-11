import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Navbar from '../../components/Navbar';
import PanelCard from '../../components/ui/PanelCard';
import { getCurrentSession } from '../../services/api';
import { fetchAssetOrders } from '../../services/api/assetOrdersApi';

function formatIDR(value) {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return `${date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })} • ${date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })} WIB`;
}

function formatDateOnly(value) {
  if (!value) return '-';
  const str = String(value);
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(str);

  if (Number.isNaN(date.getTime())) return str;

  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function StatusPill({ status }) {
  const normalized = String(status || '').toUpperCase();

  const styles = {
    PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  const className = styles[normalized] || 'bg-slate-50 text-slate-700 border-slate-200';

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black tracking-widest border ${className}`.trim()}>
      {normalized || 'UNKNOWN'}
    </span>
  );
}

function MiniStat({ label, value, valueClassName = 'text-slate-900' }) {
  return (
    <PanelCard className="p-5">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-black ${valueClassName}`.trim()}>{value}</p>
    </PanelCard>
  );
}

const AssetOrdersPage = () => {
  const session = getCurrentSession();
  const [orders, setOrders] = useState([]);
  const [expandedOrderId, setExpandedOrderId] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const data = await fetchAssetOrders({ userRole: session.userRole, userId: session.userId });
      setOrders(Array.isArray(data) ? data : []);
      setIsLoading(false);
    };

    load();
  }, [session.userId, session.userRole]);

  const totalRevenue = useMemo(() => {
    return orders.reduce((sum, order) => sum + (Number(order.totalAmount) || 0), 0);
  }, [orders]);

  const toggleExpanded = (orderId) => {
    setExpandedOrderId((prev) => (prev === orderId ? '' : orderId));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Asset Orders</h1>
          <p className="text-slate-500 mt-1">
            Menampilkan order dengan status <span className="font-bold">PAID</span> sebagai pendapatan.
            Klik untuk melihat detail.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <MiniStat label="Total Pendapatan" value={formatIDR(totalRevenue)} valueClassName="text-blue-600" />
          <MiniStat label="Jumlah Order (PAID)" value={orders.length} valueClassName="text-emerald-600" />
        </div>

        {isLoading ? (
          <PanelCard className="p-8">
            <p className="text-slate-500 text-sm font-medium">Memuat asset orders...</p>
          </PanelCard>
        ) : orders.length === 0 ? (
          <PanelCard className="p-8">
            <p className="text-slate-500 text-sm font-medium">Tidak ada order PAID.</p>
          </PanelCard>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => {
              const isExpanded = expandedOrderId === order.id;
              const promoCode = order.promotion?.promoCode || null;
              const promoRemaining = order.promotion?.remaining;
              const eventLabel = order.summary?.eventTitles?.length
                ? order.summary.eventTitles.slice(0, 2).join(', ') +
                  (order.summary.eventTitles.length > 2 ? ` +${order.summary.eventTitles.length - 2}` : '')
                : '-';

              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-3xl border shadow-sm overflow-hidden transition-all ${
                    isExpanded
                      ? 'border-blue-200 shadow-md'
                      : 'border-slate-200 hover:shadow-md hover:border-slate-300'
                  }`.trim()}
                >
                  <button
                    type="button"
                    onClick={() => toggleExpanded(order.id)}
                    className="w-full text-left"
                    aria-expanded={isExpanded}
                  >
                    <div className="p-6">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Order ID</p>
                          <h2 className="text-lg font-black tracking-tight text-slate-900 truncate">{order.orderId}</h2>

                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <span className="px-3 py-1 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-700">
                              {formatDateTime(order.orderDate)}
                            </span>
                            <span className="px-3 py-1 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-700">
                              {order.summary?.ticketCount || 0} tiket
                            </span>
                            <span className="px-3 py-1 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-700">
                              Event: {eventLabel}
                            </span>
                          </div>

                          <div className="mt-4 text-[11px] text-slate-600 font-medium">
                            <span className="font-black text-slate-400 uppercase tracking-widest">Promo:</span>{' '}
                            <span className="font-bold text-slate-800">
                              {promoCode ? promoCode : 'Tanpa promo'}
                            </span>
                            {promoCode ? (
                              <span className="text-slate-400"> • </span>
                            ) : null}
                            {promoCode ? (
                              <span className="font-bold text-slate-800">
                                Sisa: {typeof promoRemaining === 'number' ? promoRemaining : '-'}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex md:flex-col items-start md:items-end justify-between gap-3">
                          <StatusPill status={order.paymentStatus} />
                          <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pendapatan</p>
                            <p className="text-xl font-black text-slate-900">{formatIDR(order.totalAmount)}</p>
                          </div>
                          <div className="flex items-center gap-2 text-slate-500 text-sm font-bold">
                            <span>{isExpanded ? 'Tutup' : 'Detail'}</span>
                            <ChevronDown
                              size={18}
                              className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`.trim()}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>

                  {isExpanded ? (
                    <div className="border-t border-slate-100 bg-slate-50/50 p-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <PanelCard className="p-6">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                            Info Promo
                          </p>

                          {order.promotion ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-slate-700">Kode</span>
                                <span className="text-sm font-black text-slate-900">{order.promotion.promoCode}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-slate-700">Sisa Kuota</span>
                                <span className="text-sm font-black text-slate-900">
                                  {typeof order.promotion.remaining === 'number' ? order.promotion.remaining : '-'}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500 font-medium">Order ini tidak menggunakan promo.</p>
                          )}

                          <div className="mt-6">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                              Promo Masih Berlaku
                            </p>
                            {order.validPromotions?.length ? (
                              <div className="space-y-3">
                                {order.validPromotions.map((promo) => (
                                  <div
                                    key={promo.promotionId}
                                    className="bg-white rounded-2xl border border-slate-200 p-4"
                                  >
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="min-w-0">
                                        <p className="text-sm font-black text-slate-900 truncate">{promo.promoCode}</p>
                                        <p className="text-[11px] text-slate-500 font-medium mt-1">
                                          {formatDateOnly(promo.startDate)} - {formatDateOnly(promo.endDate)}
                                        </p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sisa</p>
                                        <p className="text-sm font-black text-slate-900">{promo.remaining}</p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500 font-medium">
                                Tidak ada promo yang berlaku pada tanggal order ini.
                              </p>
                            )}
                          </div>
                        </PanelCard>

                        <PanelCard className="p-6">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                            Detail Order
                          </p>
                          {order.tickets?.length ? (
                            <div className="space-y-3">
                              {order.tickets.map((t) => (
                                <div
                                  key={t.ticketId}
                                  className="bg-white rounded-2xl border border-slate-200 p-4"
                                >
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                      <p className="text-sm font-black text-slate-900 truncate">{t.eventTitle}</p>
                                      <p className="text-[11px] text-slate-500 font-medium mt-1 truncate">
                                        {t.venueName} • {t.categoryName}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Harga</p>
                                      <p className="text-sm font-black text-slate-900">{formatIDR(t.categoryPrice)}</p>
                                    </div>
                                  </div>

                                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 font-medium">
                                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                                      <span className="text-slate-500 font-bold">Kode Tiket</span>
                                      <span className="text-slate-900 font-black">{t.ticketCode}</span>
                                    </div>
                                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                                      <span className="text-slate-500 font-bold">Kursi</span>
                                      <span className="text-slate-900 font-black">
                                        {t.seat
                                          ? `${t.seat.section} • ${t.seat.rowNumber}-${t.seat.seatNumber}`
                                          : '-'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500 font-medium">Tidak ada tiket pada order ini.</p>
                          )}
                        </PanelCard>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default AssetOrdersPage;

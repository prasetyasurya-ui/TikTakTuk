import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { CheckCircle2, Minus, Plus, Ticket } from 'lucide-react';
import Navbar from '../../components/Navbar';
import PanelCard from '../../components/ui/PanelCard';
import { getCurrentSession } from '../../services/api';
import {
  createOrder,
  fetchCheckoutData,
  validatePromotionCode,
} from '../../services/api/ordersApi';

function formatIDR(value) {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatEventDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const dateStr = date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return `${dateStr} • ${timeStr} WIB`;
}

function calcDiscount(subtotal, promotion) {
  if (!promotion) return 0;
  const type = String(promotion.discountType || '').toUpperCase();
  const value = Number(promotion.discountValue) || 0;

  let discount = 0;
  if (type === 'PERCENTAGE') {
    discount = (subtotal * value) / 100;
  } else if (type === 'NOMINAL') {
    discount = value;
  }

  return Math.min(subtotal, Math.max(0, discount));
}

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { eventId } = useParams();

  const session = getCurrentSession();
  const isLoggedIn = session.isLoggedIn;
  const userRole = session.userRole;
  const userId = session.userId;

  const [isLoading, setIsLoading] = useState(true);
  const [checkoutData, setCheckoutData] = useState(null);
  const [loadError, setLoadError] = useState('');

  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [quantity, setQuantity] = useState(2);

  const [selectedSeatIds, setSelectedSeatIds] = useState([]);

  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoMessage, setPromoMessage] = useState(null);

  const [banner, setBanner] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setLoadError('');
      setCheckoutData(null);

      const result = await fetchCheckoutData(eventId);
      if (!result.ok) {
        setLoadError(result.message || 'Gagal memuat data checkout.');
        setIsLoading(false);
        return;
      }

      setCheckoutData(result);
      setIsLoading(false);
    };

    if (eventId) load();
  }, [eventId]);

  const event = checkoutData?.event || null;
  const categories = checkoutData?.categories || [];
  const seats = checkoutData?.seats || [];

  const selectedCategory = useMemo(() => {
    return categories.find((c) => c.id === selectedCategoryId) || null;
  }, [categories, selectedCategoryId]);

  const isReservedSeating = String(event?.seatingType || '').toUpperCase() === 'RESERVED_SEATING';

  useEffect(() => {
    if (selectedSeatIds.length > quantity) {
      setSelectedSeatIds((prev) => prev.slice(0, quantity));
    }
  }, [quantity, selectedSeatIds.length]);

  const subtotal = useMemo(() => {
    if (!selectedCategory) return 0;
    return (Number(selectedCategory.price) || 0) * (Number(quantity) || 0);
  }, [selectedCategory, quantity]);

  const discount = useMemo(() => calcDiscount(subtotal, appliedPromo), [subtotal, appliedPromo]);
  const serviceFee = 0;
  const total = Math.max(0, subtotal + serviceFee - discount);

  const summaryLabel = useMemo(() => {
    if (!selectedCategory) return '-';
    return `${selectedCategory.name} x ${quantity}`;
  }, [selectedCategory, quantity]);

  const canSubmit = useMemo(() => {
    if (!isLoggedIn) return false;
    if (userRole !== 'customer') return false;
    if (!selectedCategoryId) return false;
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 10) return false;
    if (isReservedSeating && selectedSeatIds.length > 0 && selectedSeatIds.length !== quantity) return false;
    return true;
  }, [
    isLoggedIn,
    userRole,
    selectedCategoryId,
    quantity,
    isReservedSeating,
    selectedSeatIds.length,
  ]);

  const handleToggleSeat = (seatId) => {
    setBanner(null);

    setSelectedSeatIds((prev) => {
      const exists = prev.includes(seatId);
      if (exists) return prev.filter((id) => id !== seatId);

      if (prev.length >= quantity) {
        setBanner({ type: 'error', message: 'Jumlah kursi tidak boleh melebihi jumlah tiket.' });
        return prev;
      }

      return [...prev, seatId];
    });
  };

  const handleApplyPromo = async () => {
    setPromoMessage(null);
    setAppliedPromo(null);

    const code = promoInput.trim();
    if (!code) {
      setPromoMessage({ type: 'error', message: 'Kode promo wajib diisi.' });
      return;
    }

    const result = await validatePromotionCode(code);
    if (!result.ok) {
      setPromoMessage({ type: 'error', message: result.message || 'Kode promo tidak valid.' });
      return;
    }

    setAppliedPromo(result.promotion);
    setPromoMessage({ type: 'success', message: 'Promo berhasil diterapkan.' });
  };

  const handleSubmit = async () => {
    setBanner(null);

    if (!isLoggedIn) {
      setBanner({ type: 'error', message: 'Silakan login terlebih dahulu.' });
      return;
    }

    if (userRole !== 'customer') {
      setBanner({ type: 'error', message: 'Hanya Customer yang dapat membeli tiket.' });
      return;
    }

    if (!selectedCategoryId) {
      setBanner({ type: 'error', message: 'Kategori tiket wajib dipilih.' });
      return;
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      setBanner({ type: 'error', message: 'Jumlah tiket wajib bilangan bulat positif.' });
      return;
    }

    if (quantity > 10) {
      setBanner({ type: 'error', message: 'Maksimal 10 tiket per transaksi.' });
      return;
    }

    if (isReservedSeating && selectedSeatIds.length > 0 && selectedSeatIds.length !== quantity) {
      setBanner({ type: 'error', message: 'Jika memilih kursi, jumlah kursi harus sama dengan jumlah tiket.' });
      return;
    }

    setIsSubmitting(true);
    const result = await createOrder(
      {
        eventId,
        categoryId: selectedCategoryId,
        quantity,
        seatIds: selectedSeatIds,
        promoCode: promoInput.trim() || appliedPromo?.promoCode || '',
      },
      { userRole, userId }
    );
    setIsSubmitting(false);

    if (!result.ok) {
      setBanner({ type: 'error', message: result.message || 'Gagal membuat order.' });
      return;
    }

    navigate('/orders');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Checkout Tiket</h1>
            <p className="text-slate-500 mt-1 text-sm">Lengkapi detail pemesanan sebelum pembayaran.</p>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[11px] font-black tracking-widest text-slate-400">
            <span className="text-blue-600">Pilih</span>
            <span>•</span>
            <span>Bayar</span>
            <span>•</span>
            <span>Selesai</span>
          </div>
        </div>

        {isLoading ? (
          <PanelCard className="p-8">
            <p className="text-slate-500 text-sm font-medium">Memuat data checkout...</p>
          </PanelCard>
        ) : loadError ? (
          <PanelCard className="p-8">
            <p className="text-rose-600 font-bold">{loadError}</p>
            <Link
              to="/event"
              className="inline-flex mt-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-lg"
            >
              Kembali ke Events
            </Link>
          </PanelCard>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <PanelCard className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                    <Ticket />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 truncate">{event?.title}</p>
                    <p className="text-slate-500 text-sm font-medium mt-1">
                      {formatEventDateTime(event?.datetime)} • {event?.venueName}
                    </p>
                  </div>
                </div>
              </PanelCard>

              <PanelCard className="p-6">
                <h2 className="text-sm font-black text-slate-900">Pilih Kategori Tiket</h2>
                <p className="text-slate-500 text-xs mt-1">Setiap kategori memiliki fasilitas berbeda.</p>

                <div className="mt-4 space-y-3">
                  {categories.map((cat) => {
                    const selected = selectedCategoryId === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setBanner(null);
                          setSelectedCategoryId(cat.id);
                        }}
                        className={`w-full text-left rounded-2xl border p-4 transition-all ${selected
                            ? 'border-blue-400 bg-blue-50/30'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                          }`.trim()}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-black text-slate-900 truncate">{cat.name}</p>
                            <p className="text-[11px] text-slate-500 font-medium mt-1">Sisa Kuota: {cat.remaining !== undefined ? cat.remaining : cat.quota} tiket</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="text-sm font-black text-slate-900">{formatIDR(cat.price)}</p>
                            {selected ? <CheckCircle2 className="text-blue-600" size={18} /> : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </PanelCard>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PanelCard className="p-6">
                  <h2 className="text-sm font-black text-slate-900">Jumlah Tiket</h2>
                  <p className="text-slate-500 text-xs mt-1">Max 10 tiket per transaksi.</p>

                  <div className="mt-4 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                      className="w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center"
                      aria-label="Kurangi"
                    >
                      <Minus size={16} />
                    </button>
                    <div className="text-center">
                      <p className="text-2xl font-black text-slate-900 leading-none">{quantity}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Tiket</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setQuantity((prev) => Math.min(10, prev + 1))}
                      className="w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center"
                      aria-label="Tambah"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </PanelCard>

                <PanelCard className="p-6">
                  <h2 className="text-sm font-black text-slate-900">Pilih Kursi</h2>
                  <p className="text-slate-500 text-xs mt-1">
                    {isReservedSeating ? 'Opsional (reserved seating tersedia).' : 'Venue tidak memiliki reserved seating.'}
                  </p>

                  {isReservedSeating ? (
                    <div className="mt-4 grid grid-cols-4 gap-2">
                      {seats.map((seat) => {
                        const selected = selectedSeatIds.includes(seat.seatId);
                        const disabled = !seat.isAvailable;

                        return (
                          <button
                            key={seat.seatId}
                            type="button"
                            disabled={disabled}
                            onClick={() => handleToggleSeat(seat.seatId)}
                            className={`h-9 rounded-lg border text-[11px] font-black transition-all ${disabled
                                ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                                : selected
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`.trim()}
                            aria-pressed={selected}
                          >
                            {seat.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
                      <p className="text-slate-500 text-sm font-medium">Tidak tersedia kursi pilihan.</p>
                    </div>
                  )}
                </PanelCard>
              </div>

              <PanelCard className="p-6">
                <h2 className="text-sm font-black text-slate-900">Kode Promo</h2>
                <p className="text-slate-500 text-xs mt-1">Masukkan kode promo jika ada.</p>

                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <input
                    value={promoInput}
                    onChange={(e) => {
                      setPromoInput(e.target.value);
                      setPromoMessage(null);
                      setAppliedPromo(null);
                    }}
                    type="text"
                    placeholder="CONTOH: TIKTAK20"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-white outline-none text-sm shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={handleApplyPromo}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm"
                  >
                    Terapkan
                  </button>
                </div>

                {promoMessage ? (
                  <p
                    className={`mt-2 text-xs font-bold ${promoMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'
                      }`.trim()}
                  >
                    {promoMessage.message}
                  </p>
                ) : null}
              </PanelCard>

              {banner ? (
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm font-bold ${banner.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-rose-50 border-rose-200 text-rose-700'
                    }`.trim()}
                >
                  {banner.message}
                </div>
              ) : null}
            </div>

            <div className="space-y-6">
              <PanelCard className="p-6">
                <h2 className="text-sm font-black text-slate-900">Ringkasan Pesanan</h2>

                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-600 font-semibold">{summaryLabel}</span>
                    <span className="text-slate-900 font-black">{formatIDR(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-600 font-semibold">Biaya Layanan</span>
                    <span className="text-slate-900 font-black">{formatIDR(serviceFee)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-600 font-semibold">Diskon</span>
                    <span className="text-slate-900 font-black">-{formatIDR(discount)}</span>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-4">
                    <span className="text-slate-900 font-black">Total</span>
                    <span className="text-slate-900 font-black text-lg">{formatIDR(total)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit || isSubmitting}
                  className={`w-full mt-5 py-3 rounded-xl text-sm font-black transition-all ${!canSubmit || isSubmitting
                      ? 'bg-blue-200 text-white cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`.trim()}
                >
                  {isSubmitting ? 'Memproses...' : 'Bayar Sekarang'}
                </button>

                {!isLoggedIn ? (
                  <p className="text-xs text-slate-500 font-medium mt-3">
                    Login diperlukan untuk melakukan checkout.
                  </p>
                ) : userRole !== 'customer' ? (
                  <p className="text-xs text-slate-500 font-medium mt-3">
                    Hanya role <span className="font-bold">Customer</span> yang dapat membuat order.
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 font-medium mt-3">
                    Order akan dibuat otomatis dengan status <span className="font-bold">Pending</span>.
                  </p>
                )}
              </PanelCard>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default CheckoutPage;

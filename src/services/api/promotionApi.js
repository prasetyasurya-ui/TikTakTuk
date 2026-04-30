import { loadDb } from '../core/mockDb';

function upper(value) {
  return String(value || '').trim().toUpperCase();
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toPositiveInt(value) {
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : null;
}

function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

function parseLocalDateOnly(value, { endOfDay = false } = {}) {
  const str = String(value || '').trim();
  if (!str) return null;

  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) return null;

  return endOfDay
    ? new Date(year, monthIndex, day, 23, 59, 59, 999)
    : new Date(year, monthIndex, day);
}

function validatePromotionPayload(db, payload, { existingPromotionId = '' } = {}) {
  const promoCode = upper(payload.promoCode);
  if (!promoCode) return { ok: false, message: 'Kode promo wajib diisi.' };

  const discountType = upper(payload.discountType);
  if (!discountType) return { ok: false, message: 'Tipe diskon wajib dipilih.' };
  if (discountType !== 'PERCENTAGE' && discountType !== 'NOMINAL') {
    return { ok: false, message: 'Tipe diskon tidak valid.' };
  }

  const discountValue = toNumber(payload.discountValue);
  if (!(discountValue > 0)) {
    return { ok: false, message: 'Nilai diskon wajib berupa bilangan positif > 0.' };
  }

  const startDate = String(payload.startDate || '').trim();
  const endDate = String(payload.endDate || '').trim();
  if (!startDate) return { ok: false, message: 'Tanggal mulai wajib diisi.' };
  if (!endDate) return { ok: false, message: 'Tanggal berakhir wajib diisi.' };

  const start = parseLocalDateOnly(startDate);
  const end = parseLocalDateOnly(endDate, { endOfDay: true });
  if (!start || !end) {
    return { ok: false, message: 'Format tanggal tidak valid.' };
  }

  if (end.getTime() < start.getTime()) {
    return { ok: false, message: 'Tanggal berakhir harus sama atau setelah tanggal mulai.' };
  }

  const usageLimit = toPositiveInt(payload.usageLimit);
  if (!usageLimit) {
    return { ok: false, message: 'Batas penggunaan wajib bilangan bulat positif > 0.' };
  }

  const promotions = Array.isArray(db.promotion) ? db.promotion : [];
  const exists = promotions.some((p) => {
    const sameCode = upper(p?.promo_code) === promoCode;
    const differentId = String(p?.promotion_id || '') !== String(existingPromotionId || '');
    return sameCode && differentId;
  });
  if (exists) {
    return { ok: false, message: 'Kode promo sudah digunakan (harus unik).' };
  }

  return {
    ok: true,
    data: {
      promoCode,
      discountType,
      discountValue,
      startDate,
      endDate,
      usageLimit,
    },
  };
}

export async function fetchPromotions() {
  const db = loadDb();

  const promotions = Array.isArray(db.promotion) ? db.promotion : [];
  const orderPromotions = Array.isArray(db.order_promotion) ? db.order_promotion : [];

  const usedCountById = orderPromotions.reduce((acc, op) => {
    const pid = op?.promotion_id;
    if (!pid) return acc;
    acc[pid] = (acc[pid] || 0) + 1;
    return acc;
  }, {});

  const normalized = promotions
    .map((p) => {
      const usageLimit = toNumber(p?.usage_limit);
      const usedCount = usedCountById[p?.promotion_id] || 0;
      const remaining = Math.max(0, usageLimit - usedCount);

      return {
        promotionId: p?.promotion_id || '',
        promoCode: p?.promo_code || '',
        discountType: p?.discount_type || '',
        discountValue: toNumber(p?.discount_value),
        startDate: p?.start_date || '',
        endDate: p?.end_date || '',
        usageLimit,
        usedCount,
        remaining,
      };
    })
    .filter((p) => p.promotionId)
    .sort((a, b) => String(a.promoCode).localeCompare(String(b.promoCode)));

  return normalized;
}

export async function createPromotion(payload, { userRole = '' } = {}) {
  if (String(userRole || '').toLowerCase() !== 'admin') {
    return { ok: false, message: 'Hanya admin yang dapat membuat promo.' };
  }

  const db = loadDb();
  const validated = validatePromotionPayload(db, payload);
  if (!validated.ok) return validated;

  const promotionId = generateUUID();

  // UI-only: do not persist changes (no backend required)
  return { ok: true, promotionId };
}

export async function updatePromotion(promotionId, payload, { userRole = '' } = {}) {
  if (String(userRole || '').toLowerCase() !== 'admin') {
    return { ok: false, message: 'Hanya admin yang dapat memperbarui promo.' };
  }

  const db = loadDb();
  db.promotion = Array.isArray(db.promotion) ? db.promotion : [];

  const target = db.promotion.find((p) => p?.promotion_id === promotionId);
  if (!target) {
    return { ok: false, message: 'Promo tidak ditemukan.' };
  }

  const validated = validatePromotionPayload(db, payload, { existingPromotionId: promotionId });
  if (!validated.ok) return validated;

  // UI-only: do not persist changes (no backend required)
  return { ok: true };
}

export async function deletePromotion(promotionId, { userRole = '' } = {}) {
  if (String(userRole || '').toLowerCase() !== 'admin') {
    return { ok: false, message: 'Hanya admin yang dapat menghapus promo.' };
  }

  const db = loadDb();
  db.promotion = Array.isArray(db.promotion) ? db.promotion : [];
  db.order_promotion = Array.isArray(db.order_promotion) ? db.order_promotion : [];

  const exists = db.promotion.some((p) => p?.promotion_id === promotionId);
  if (!exists) {
    return { ok: false, message: 'Promo tidak ditemukan.' };
  }

  // UI-only: do not persist changes (no backend required)
  return { ok: true };
}

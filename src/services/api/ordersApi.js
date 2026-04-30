import { loadDb } from '../core/mockDb';

const ORDER_PAYMENT_STATUSES = new Set(['PENDING', 'PAID', 'CANCELLED']);

function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback: not RFC4122, but unique enough for mock data
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function upper(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizePaymentStatus(value) {
  const normalized = upper(value);
  if (!normalized) return null;
  return ORDER_PAYMENT_STATUSES.has(normalized) ? normalized : null;
}

function toPositiveInt(value) {
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : null;
}

function getCustomerByUserId(db, userId) {
  if (!userId) return null;
  return (db.customer || []).find((row) => row?.user_id === userId) || null;
}

function getOrganizerByUserId(db, userId) {
  if (!userId) return null;
  return (db.organizer || []).find((row) => row?.user_id === userId) || null;
}

function parseLocalDateOnly(value, { endOfDay = false } = {}) {
  const str = String(value || '').trim();
  if (!str) return null;

  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    const parsed = new Date(str);
    if (Number.isNaN(parsed.getTime())) return null;
    return endOfDay
      ? new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 23, 59, 59, 999)
      : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) return null;

  return endOfDay
    ? new Date(year, monthIndex, day, 23, 59, 59, 999)
    : new Date(year, monthIndex, day);
}

function isDateWithinRange(date, start, end) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
  if (!(start instanceof Date) || Number.isNaN(start.getTime())) return false;
  if (!(end instanceof Date) || Number.isNaN(end.getTime())) return false;

  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

export async function fetchOrders({ userRole = '', userId = '' } = {}) {
  const db = loadDb();

  const customers = Array.isArray(db.customer) ? db.customer : [];
  const users = Array.isArray(db.user_account) ? db.user_account : [];
  const promotions = Array.isArray(db.promotion) ? db.promotion : [];
  const orderPromotions = Array.isArray(db.order_promotion) ? db.order_promotion : [];
  const allOrders = Array.isArray(db.order) ? db.order : [];
  const tickets = Array.isArray(db.ticket) ? db.ticket : [];
  const categories = Array.isArray(db.ticket_category) ? db.ticket_category : [];
  const events = Array.isArray(db.event) ? db.event : [];
  const venues = Array.isArray(db.venue) ? db.venue : [];
  const seats = Array.isArray(db.seat) ? db.seat : [];
  const seatRelations = Array.isArray(db.has_relationship) ? db.has_relationship : [];

  const customerMap = new Map(customers.map((c) => [c.customer_id, c]));
  const userMap = new Map(users.map((u) => [u.user_id, u]));
  const promotionMap = new Map(promotions.map((p) => [p.promotion_id, p]));
  const categoryMap = new Map(categories.map((c) => [c.category_id, c]));
  const eventMap = new Map(events.map((e) => [e.event_id, e]));
  const venueMap = new Map(venues.map((v) => [v.venue_id, v]));
  const seatMap = new Map(seats.map((s) => [s.seat_id, s]));

  const promotionIdByOrderId = new Map(orderPromotions.map((op) => [op.order_id, op.promotion_id]));
  const promoUsedCount = orderPromotions.reduce((acc, op) => {
    if (!op?.promotion_id) return acc;
    acc[op.promotion_id] = (acc[op.promotion_id] || 0) + 1;
    return acc;
  }, {});

  const promotionsWithUsage = promotions
    .map((promotion) => {
      const usageLimit = toNumber(promotion?.usage_limit);
      const usedCount = promoUsedCount[promotion?.promotion_id] || 0;
      const remaining = Math.max(0, usageLimit - usedCount);

      return {
        promotionId: promotion?.promotion_id || '',
        promoCode: promotion?.promo_code || '',
        discountType: promotion?.discount_type || '',
        discountValue: toNumber(promotion?.discount_value),
        startDate: promotion?.start_date || '',
        endDate: promotion?.end_date || '',
        usageLimit,
        usedCount,
        remaining,
      };
    })
    .filter((p) => p.promotionId);

  const seatIdByTicketId = new Map(seatRelations.map((rel) => [rel.ticket_id, rel.seat_id]));

  const ticketsByOrderId = new Map();
  for (const ticket of tickets) {
    const orderId = ticket?.torder_id;
    if (!orderId) continue;

    const category = categoryMap.get(ticket.tcategory_id);
    const event = category ? eventMap.get(category.tevent_id) : null;
    const venue = event ? venueMap.get(event.venue_id) : null;

    const seatId = seatIdByTicketId.get(ticket.ticket_id);
    const seat = seatId ? seatMap.get(seatId) : null;

    const line = {
      ticketId: ticket.ticket_id,
      ticketCode: ticket.ticket_code,
      categoryId: category?.category_id || ticket.tcategory_id || '',
      categoryName: category?.category_name || '-',
      categoryPrice: toNumber(category?.price),
      eventId: event?.event_id || category?.tevent_id || '',
      eventTitle: event?.event_title || '-',
      eventDatetime: event?.event_datetime || '',
      venueName: venue?.venue_name || '-',
      seat: seat
        ? {
            seatId: seat.seat_id,
            section: seat.section,
            rowNumber: seat.row_number,
            seatNumber: seat.seat_number,
          }
        : null,
    };

    const existing = ticketsByOrderId.get(orderId) || [];
    existing.push(line);
    ticketsByOrderId.set(orderId, existing);
  }

  const role = String(userRole || '').toLowerCase();
  let visibleOrders = allOrders;

  if (role === 'customer') {
    const customer = getCustomerByUserId(db, userId);
    visibleOrders = customer ? allOrders.filter((row) => row.customer_id === customer.customer_id) : [];
  } else if (role === 'organizer') {
    const organizer = getOrganizerByUserId(db, userId);
    if (!organizer) {
      visibleOrders = [];
    } else {
      const ownEventIds = new Set(
        events.filter((event) => event.organizer_id === organizer.organizer_id).map((event) => event.event_id)
      );
      const ownCategoryIds = new Set(
        categories.filter((cat) => ownEventIds.has(cat.tevent_id)).map((cat) => cat.category_id)
      );
      const relevantOrderIds = new Set(
        tickets
          .filter((ticket) => ownCategoryIds.has(ticket.tcategory_id))
          .map((ticket) => ticket.torder_id)
          .filter(Boolean)
      );
      visibleOrders = allOrders.filter((row) => relevantOrderIds.has(row.order_id));
    }
  }

  const normalized = visibleOrders
    .map((order) => {
      const customer = customerMap.get(order.customer_id);
      const customerUser = customer?.user_id ? userMap.get(customer.user_id) : null;

      const promotionId = promotionIdByOrderId.get(order.order_id);
      const promotion = promotionId ? promotionMap.get(promotionId) : null;
      const usedCount = promotionId ? promoUsedCount[promotionId] || 0 : 0;
      const usageLimit = promotion ? toNumber(promotion.usage_limit) : null;
      const remaining =
        promotion && usageLimit !== null
          ? Math.max(0, usageLimit - usedCount)
          : null;

      const orderDate = new Date(order.order_date);
      const validPromotions = promotionsWithUsage.filter((promo) => {
        const start = parseLocalDateOnly(promo.startDate);
        const end = parseLocalDateOnly(promo.endDate, { endOfDay: true });
        return isDateWithinRange(orderDate, start, end);
      });

      const orderTickets = ticketsByOrderId.get(order.order_id) || [];
      const eventTitles = [...new Set(orderTickets.map((t) => t.eventTitle).filter((t) => t && t !== '-'))];

      return {
        id: order.order_id,
        orderId: order.order_id,
        orderDate: order.order_date,
        paymentStatus: upper(order.payment_status),
        totalAmount: toNumber(order.total_amount),
        customerId: order.customer_id,
        customerUserId: customer?.user_id || customerUser?.user_id || '',
        customerName: customer?.full_name || '-',
        promotion: promotion
          ? {
              promotionId: promotion.promotion_id,
              promoCode: promotion.promo_code,
              discountType: promotion.discount_type,
              discountValue: toNumber(promotion.discount_value),
              usageLimit: usageLimit ?? 0,
              usedCount,
              remaining,
            }
          : null,
        validPromotions,
        tickets: orderTickets,
        summary: {
          ticketCount: orderTickets.length,
          eventTitles,
        },
      };
    })
    .sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));

  return normalized;
}

export async function fetchCheckoutData(eventId) {
  const db = loadDb();
  const events = Array.isArray(db.event) ? db.event : [];
  const venues = Array.isArray(db.venue) ? db.venue : [];
  const categories = Array.isArray(db.ticket_category) ? db.ticket_category : [];
  const seats = Array.isArray(db.seat) ? db.seat : [];
  const seatRelations = Array.isArray(db.has_relationship) ? db.has_relationship : [];

  const event = events.find((row) => row?.event_id === eventId);
  if (!event) {
    return { ok: false, message: 'Event tidak ditemukan.' };
  }

  const venue = venues.find((row) => row?.venue_id === event.venue_id) || null;
  const seatingType = upper(venue?.jenis_seating || 'FREE_SEATING');

  const eventCategories = categories
    .filter((cat) => cat?.tevent_id === event.event_id)
    .map((cat) => ({
      id: cat.category_id,
      name: cat.category_name,
      quota: toNumber(cat.quota),
      price: toNumber(cat.price),
    }))
    .sort((a, b) => a.price - b.price);

  const usedSeatIds = new Set(seatRelations.map((rel) => rel?.seat_id).filter(Boolean));

  const seatLabel = (seat) => {
    const rowMatch = String(seat?.row_number || '').match(/(\d+)/);
    const rowIndex = rowMatch ? Math.max(0, Number(rowMatch[1]) - 1) : 0;
    const rowLetter = String.fromCharCode(65 + Math.min(25, rowIndex));

    const seatMatch = String(seat?.seat_number || '').match(/(\d+)/);
    const seatNumber = seatMatch ? seatMatch[1] : String(seat?.seat_number || '').replace(/^S-?/i, '') || '-';

    return `${rowLetter}${seatNumber}`;
  };

  const venueSeats = seatingType === 'RESERVED_SEATING'
    ? seats
        .filter((seat) => seat?.venue_id === event.venue_id)
        .map((seat) => ({
          seatId: seat.seat_id,
          label: seatLabel(seat),
          section: seat.section,
          rowNumber: seat.row_number,
          seatNumber: seat.seat_number,
          isAvailable: !usedSeatIds.has(seat.seat_id),
        }))
        .sort((a, b) => a.label.localeCompare(b.label))
    : [];

  return {
    ok: true,
    event: {
      id: event.event_id,
      title: event.event_title,
      datetime: event.event_datetime,
      venueId: event.venue_id,
      venueName: venue?.venue_name || '-',
      seatingType,
    },
    categories: eventCategories,
    seats: venueSeats,
  };
}

export async function validatePromotionCode(promoCode, { now = new Date() } = {}) {
  const code = upper(promoCode);
  if (!code) return { ok: false, message: 'Kode promo wajib diisi.' };

  const db = loadDb();
  const promotions = Array.isArray(db.promotion) ? db.promotion : [];
  const orderPromotions = Array.isArray(db.order_promotion) ? db.order_promotion : [];

  const promotion = promotions.find((p) => upper(p?.promo_code) === code);
  if (!promotion) {
    return { ok: false, message: 'Kode promo tidak valid.' };
  }

  const start = parseLocalDateOnly(promotion.start_date);
  const end = parseLocalDateOnly(promotion.end_date, { endOfDay: true });
  if (!isDateWithinRange(now, start, end)) {
    return { ok: false, message: 'Promo tidak berlaku pada tanggal ini.' };
  }

  const usageLimit = toNumber(promotion.usage_limit);
  const usedCount = orderPromotions.filter((op) => op?.promotion_id === promotion.promotion_id).length;
  const remaining = Math.max(0, usageLimit - usedCount);
  if (remaining <= 0) {
    return { ok: false, message: 'Kuota promo sudah habis.' };
  }

  return {
    ok: true,
    promotion: {
      promotionId: promotion.promotion_id,
      promoCode: promotion.promo_code,
      discountType: promotion.discount_type,
      discountValue: toNumber(promotion.discount_value),
      startDate: promotion.start_date,
      endDate: promotion.end_date,
      usageLimit,
      usedCount,
      remaining,
    },
  };
}

export async function createOrder(
  { eventId = '', categoryId = '', quantity = 0, seatIds = [], promoCode = '' } = {},
  { userRole = '', userId = '' } = {}
) {
  const role = String(userRole || '').toLowerCase();
  if (role !== 'customer') {
    return { ok: false, message: 'Hanya customer yang dapat membuat order.' };
  }

  const qty = toPositiveInt(quantity);
  if (!qty) {
    return { ok: false, message: 'Jumlah tiket wajib bilangan bulat positif.' };
  }

  if (qty > 10) {
    return { ok: false, message: 'Maksimal 10 tiket per transaksi.' };
  }

  if (!eventId) {
    return { ok: false, message: 'Event wajib dipilih.' };
  }

  if (!categoryId) {
    return { ok: false, message: 'Kategori tiket wajib dipilih.' };
  }

  const db = loadDb();
  const customer = getCustomerByUserId(db, userId);
  if (!customer) {
    return { ok: false, message: 'Customer tidak ditemukan. Silakan login ulang.' };
  }

  const event = (db.event || []).find((row) => row?.event_id === eventId);
  if (!event) {
    return { ok: false, message: 'Event tidak ditemukan.' };
  }

  const category = (db.ticket_category || []).find(
    (row) => row?.category_id === categoryId && row?.tevent_id === eventId
  );
  if (!category) {
    return { ok: false, message: 'Kategori tiket tidak valid.' };
  }

  const venue = (db.venue || []).find((row) => row?.venue_id === event.venue_id) || null;
  const seatingType = upper(venue?.jenis_seating || 'FREE_SEATING');

  let selectedSeatIds = Array.isArray(seatIds) ? seatIds.filter(Boolean) : [];
  selectedSeatIds = [...new Set(selectedSeatIds)];

  if (seatingType !== 'RESERVED_SEATING') {
    selectedSeatIds = [];
  }

  if (selectedSeatIds.length > qty) {
    return { ok: false, message: 'Jumlah kursi yang dipilih melebihi jumlah tiket.' };
  }

  const venueSeatIds = new Set(
    (db.seat || []).filter((seat) => seat?.venue_id === event.venue_id).map((seat) => seat.seat_id)
  );

  for (const seatId of selectedSeatIds) {
    if (!venueSeatIds.has(seatId)) {
      return { ok: false, message: 'Kursi yang dipilih tidak valid untuk venue ini.' };
    }
  }

  const usedSeatIds = new Set((db.has_relationship || []).map((rel) => rel?.seat_id).filter(Boolean));
  for (const seatId of selectedSeatIds) {
    if (usedSeatIds.has(seatId)) {
      return { ok: false, message: 'Salah satu kursi yang dipilih sudah terpakai.' };
    }
  }

  if (promoCode) {
    const promoResult = await validatePromotionCode(promoCode);
    if (!promoResult.ok) return promoResult;
  }

  const orderId = generateUUID();

  // UI-only: do not persist changes (no backend required)
  return { ok: true, orderId };
}

export async function updateOrderPaymentStatus(
  orderId,
  paymentStatus,
  { userRole = '' } = {}
) {
  const role = String(userRole || '').toLowerCase();
  if (role !== 'admin') {
    return { ok: false, message: 'Hanya admin yang dapat memperbarui status order.' };
  }

  const normalizedStatus = normalizePaymentStatus(paymentStatus);
  if (!normalizedStatus) {
    return { ok: false, message: 'Payment status tidak valid.' };
  }

  const db = loadDb();
  const orders = Array.isArray(db.order) ? db.order : [];
  const target = orders.find((row) => row?.order_id === orderId);
  if (!target) {
    return { ok: false, message: 'Order tidak ditemukan.' };
  }

  // UI-only: do not persist changes (no backend required)
  return { ok: true };
}

export async function deleteOrder(orderId, { userRole = '' } = {}) {
  const role = String(userRole || '').toLowerCase();
  if (role !== 'admin') {
    return { ok: false, message: 'Hanya admin yang dapat menghapus order.' };
  }

  const db = loadDb();
  db.order = Array.isArray(db.order) ? db.order : [];

  const exists = db.order.some((row) => row?.order_id === orderId);
  if (!exists) {
    return { ok: false, message: 'Order tidak ditemukan.' };
  }

  // UI-only: do not persist changes (no backend required)
  return { ok: true };
}

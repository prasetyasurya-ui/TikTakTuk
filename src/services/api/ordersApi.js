import { loadDb } from '../core/mockDb';

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function upper(value) {
  return String(value || '').trim().toUpperCase();
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

export async function fetchOrders() {
  const db = loadDb();

  const customers = Array.isArray(db.customer) ? db.customer : [];
  const users = Array.isArray(db.user_account) ? db.user_account : [];
  const promotions = Array.isArray(db.promotion) ? db.promotion : [];
  const orderPromotions = Array.isArray(db.order_promotion) ? db.order_promotion : [];
  const orders = Array.isArray(db.order) ? db.order : [];
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

  const normalized = orders
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

import { loadDb } from '../core/mockDb';

function generateUUID() {
  return `TIX-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

export async function fetchTicketAssetsData({ userRole, userId } = {}) {
  const db = loadDb();

  const tickets = Array.isArray(db.ticket) ? db.ticket : [];
  const categories = Array.isArray(db.ticket_category) ? db.ticket_category : [];
  const events = Array.isArray(db.event) ? db.event : [];
  const orders = Array.isArray(db.order) ? db.order : [];
  const customers = Array.isArray(db.customer) ? db.customer : [];
  const seats = Array.isArray(db.seat) ? db.seat : [];
  const relations = Array.isArray(db.has_relationship) ? db.has_relationship : [];

  // Mappers
  const categoryMap = new Map(categories.map(c => [c.category_id, c]));
  const eventMap = new Map(events.map(e => [e.event_id, e]));
  const orderMap = new Map(orders.map(o => [o.order_id, o]));
  const customerMap = new Map(customers.map(c => [c.customer_id, c]));
  const seatMap = new Map(seats.map(s => [s.seat_id, s]));
  const relationMap = new Map(relations.map(r => [r.ticket_id, r.seat_id]));

  // Build the table data
  let enrichedTickets = tickets.map(ticket => {
    const category = categoryMap.get(ticket.tcategory_id);
    const event = category ? eventMap.get(category.tevent_id) : null;
    const order = orderMap.get(ticket.torder_id);
    const customer = order ? customerMap.get(order.customer_id) : null;

    const seatId = relationMap.get(ticket.ticket_id);
    const seat = seatId ? seatMap.get(seatId) : null;

    let seatLabel = '-';
    if (seat) {
      seatLabel = `${seat.section} - Baris ${seat.row_number}, No. ${seat.seat_number}`;
    }

    // FIX: Added explicit fallbacks (|| '-') to ensure no string is ever undefined.
    // This prevents the UI from crashing when it tries to run .toLowerCase() in the search filter.
    return {
      id: ticket.ticket_id || generateUUID(),
      ticketCode: ticket.ticket_code || '-',
      orderId: ticket.torder_id || '-',
      customerName: customer?.full_name || '-',
      eventName: event?.event_title || '-',
      categoryName: category?.category_name || '-',
      seatLabel,
      organizerId: event?.organizer_id
    };
  });

  // Filter for Organizer role
  if (userRole === 'organizer') {
    const organizer = (db.organizer || []).find(o => o.user_id === userId);
    if (organizer) {
      enrichedTickets = enrichedTickets.filter(t => t.organizerId === organizer.organizer_id);
    }
  }

  return enrichedTickets;
}

export async function fetchCreateTicketFormData({ userRole, userId } = {}) {
  const db = loadDb();

  const orders = Array.isArray(db.order) ? db.order : [];
  const customers = Array.isArray(db.customer) ? db.customer : [];
  const tickets = Array.isArray(db.ticket) ? db.ticket : [];
  const categories = Array.isArray(db.ticket_category) ? db.ticket_category : [];
  const events = Array.isArray(db.event) ? db.event : [];
  const venues = Array.isArray(db.venue) ? db.venue : [];
  const seats = Array.isArray(db.seat) ? db.seat : [];
  const relations = Array.isArray(db.has_relationship) ? db.has_relationship : [];

  const customerMap = new Map(customers.map(c => [c.customer_id, c]));
  const categoryMap = new Map(categories.map(c => [c.category_id, c]));
  const eventMap = new Map(events.map(e => [e.event_id, e]));
  const venueMap = new Map(venues.map(v => [v.venue_id, v]));

  // Calculate used quotas for categories
  const categoryUsedCount = tickets.reduce((acc, t) => {
    acc[t.tcategory_id] = (acc[t.tcategory_id] || 0) + 1;
    return acc;
  }, {});

  // 1. Map Orders (Deriving event from existing tickets in the order)
  const formOrders = [];
  for (const order of orders) {
    const customer = customerMap.get(order.customer_id);
    const orderTickets = tickets.filter(t => t.torder_id === order.order_id);

    // Assume an order belongs to one event based on its first ticket
    const firstTicketCategory = categoryMap.get(orderTickets[0]?.tcategory_id);
    const event = firstTicketCategory ? eventMap.get(firstTicketCategory.tevent_id) : null;
    const venue = event ? venueMap.get(event.venue_id) : null;

    if (event && customer) {
      formOrders.push({
        id: order.order_id,
        displayLabel: `${order.order_id} — ${customer.full_name} — ${event.event_title}`,
        eventId: event.event_id,
        venueId: venue?.venue_id,
        seatingType: String(venue?.jenis_seating || '').toUpperCase()
      });
    }
  }

  // 2. Map Categories (with quota strings)
  const formCategories = categories.map(cat => {
    const used = categoryUsedCount[cat.category_id] || 0;
    const isFull = used >= cat.quota;
    const formattedPrice = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(cat.price);

    return {
      id: cat.category_id,
      eventId: cat.tevent_id,
      displayLabel: `${cat.category_name} — ${formattedPrice} (${used}/${cat.quota})`,
      isFull
    };
  });

  // 3. Map Seats (filtering out assigned ones)
  const assignedSeatIds = new Set(relations.map(r => r.seat_id).filter(Boolean));
  const formSeats = seats
    .filter(seat => !assignedSeatIds.has(seat.seat_id)) // Only available seats
    .map(seat => ({
      id: seat.seat_id,
      venueId: seat.venue_id,
      displayLabel: `${seat.section} — Baris ${seat.row_number}, No. ${seat.seat_number}`
    }));

  return {
      orders: formOrders,
      categories: formCategories,
      seats: formSeats
    };
}

export async function createTicketAsset(payload) {
  const { orderId, categoryId, seatId } = payload;
  if (!orderId || !categoryId) {
    return { ok: false, message: 'Order dan Kategori wajib dipilih.' };
  }
  // Mock success response
  return { ok: true, message: 'Tiket berhasil dibuat.' };
}
import { loadDb } from '../core/mockDb';

export async function fetchManageTicketsData({ userRole, userId } = {}) {
  const db = loadDb();

  const tickets = Array.isArray(db.ticket) ? db.ticket : [];
  const categories = Array.isArray(db.ticket_category) ? db.ticket_category : [];
  const events = Array.isArray(db.event) ? db.event : [];
  const orders = Array.isArray(db.order) ? db.order : [];
  const customers = Array.isArray(db.customer) ? db.customer : [];
  const venues = Array.isArray(db.venue) ? db.venue : [];
  const seats = Array.isArray(db.seat) ? db.seat : [];
  const relations = Array.isArray(db.has_relationship) ? db.has_relationship : [];

  const categoryMap = new Map(categories.map(c => [c.category_id, c]));
  const eventMap = new Map(events.map(e => [e.event_id, e]));
  const orderMap = new Map(orders.map(o => [o.order_id, o]));
  const customerMap = new Map(customers.map(c => [c.customer_id, c]));
  const venueMap = new Map(venues.map(v => [v.venue_id, v]));
  const seatMap = new Map(seats.map(s => [s.seat_id, s]));
  const relationMap = new Map(relations.map(r => [r.ticket_id, r.seat_id]));

  let enrichedTickets = tickets.map(ticket => {
    const category = categoryMap.get(ticket.tcategory_id);
    const event = category ? eventMap.get(category.tevent_id) : null;
    const order = orderMap.get(ticket.torder_id);
    const customer = order ? customerMap.get(order.customer_id) : null;
    const venue = event ? venueMap.get(event.venue_id) : null;

    const seatId = relationMap.get(ticket.ticket_id);
    const seat = seatId ? seatMap.get(seatId) : null;

    // Formatting
    let seatLabel = 'Tanpa Kursi';
    if (seat) seatLabel = `${seat.section} - Baris ${seat.row_number}, No. ${seat.seat_number}`;

    let formattedDate = '-';
    if (event?.event_datetime) {
      const d = new Date(event.event_datetime);
      formattedDate = isNaN(d.getTime()) ? event.event_datetime : d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
    }

    let uiStatus = 'VALID'; // Default mock status
    if (order?.payment_status === 'CANCELLED') uiStatus = 'DIBATALKAN';

    return {
      id: ticket.ticket_id,
      ticketCode: ticket.ticket_code || '-',
      eventName: event?.event_title || '-',
      status: uiStatus,
      categoryName: category?.category_name || '-',
      date: formattedDate,
      location: venue?.venue_name || '-',
      price: new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(category?.price || 0),
      orderId: ticket.torder_id || '-',
      customerName: customer?.full_name || '-',
      seatLabel,
      seatId: seat?.seat_id || '',
      venueId: venue?.venue_id || '',
      organizerId: event?.organizer_id
    };
  });

  // Filter for Organizer
  if (userRole === 'organizer') {
    const organizer = (db.organizer || []).find(o => o.user_id === userId);
    if (organizer) {
      enrichedTickets = enrichedTickets.filter(t => t.organizerId === organizer.organizer_id);
    }
  }

  return enrichedTickets;
}

export async function fetchAvailableSeatsForTicket(venueId, currentSeatId) {
  const db = loadDb();
  const seats = Array.isArray(db.seat) ? db.seat : [];
  const relations = Array.isArray(db.has_relationship) ? db.has_relationship : [];

  const assignedSeatIds = new Set(relations.map(r => r.seat_id).filter(Boolean));

  // Get seats for this venue that are EITHER not assigned, OR belong to the current ticket
  const availableSeats = seats
    .filter(s => s.venue_id === venueId)
    .filter(s => !assignedSeatIds.has(s.seat_id) || s.seat_id === currentSeatId)
    .map(s => ({
      id: s.seat_id,
      label: `${s.section} — Baris ${s.row_number}, No. ${s.seat_number}`
    }));

  return availableSeats;
}

export async function updateTicket(ticketId, payload) {
  // Mock Update API
  return { ok: true, message: 'Tiket berhasil diperbarui.' };
}

export async function deleteTicket(ticketId) {
  // Mock Delete API
  return { ok: true, message: 'Tiket beserta relasi kursi berhasil dihapus.' };
}
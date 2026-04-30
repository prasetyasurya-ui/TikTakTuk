import { loadDb } from '../core/mockDb';

function generateUUID() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function fetchSeatsManagementData() {
  const db = loadDb();

  const seats = Array.isArray(db.seat) ? db.seat : [];
  const venues = Array.isArray(db.venue) ? db.venue : [];
  const relations = Array.isArray(db.has_relationship) ? db.has_relationship : [];

  const venueMap = new Map(venues.map(v => [v.venue_id, v]));
  const assignedSeatIds = new Set(relations.map(r => r.seat_id).filter(Boolean));

  const enrichedSeats = seats.map(seat => {
    const venue = venueMap.get(seat.venue_id);
    return {
      id: seat.seat_id,
      venueId: seat.venue_id,
      venueName: venue?.venue_name || '-',
      section: seat.section,
      rowNumber: seat.row_number,
      seatNumber: seat.seat_number,
      status: assignedSeatIds.has(seat.seat_id) ? 'TERISI' : 'TERSEDIA'
    };
  });

  return {
    seats: enrichedSeats,
    venues: venues.map(v => ({ id: v.venue_id, name: v.venue_name }))
  };
}

export async function createSeat(payload) {
  const { venueId, section, rowNumber, seatNumber } = payload;

  if (!venueId || !section || !rowNumber || !seatNumber) {
    return { ok: false, message: 'Semua field wajib diisi.' };
  }

  // UI-only mock: We pretend it succeeds and return a mock ID
  const newSeatId = `seat_${generateUUID()}`;
  return { ok: true, message: 'Kursi berhasil ditambahkan.', id: newSeatId };
}

export async function updateSeat(seatId, payload) {
  const { venueId, section, rowNumber, seatNumber } = payload;

  if (!venueId || !section || !rowNumber || !seatNumber) {
    return { ok: false, message: 'Semua field wajib diisi.' };
  }

  return { ok: true, message: 'Data kursi berhasil diperbarui.' };
}

export async function deleteSeat(seatId) {
  const db = loadDb();
  const relations = Array.isArray(db.has_relationship) ? db.has_relationship : [];

  // SPEC CHECK: Jika seat sudah di-assign ke tiket, tidak bisa dihapus
  const isAssigned = relations.some(r => r.seat_id === seatId);
  if (isAssigned) {
    return {
      ok: false,
      message: 'Kursi ini sudah di-assign ke tiket dan tidak dapat dihapus. Hapus atau ubah tiket terlebih dahulu.'
    };
  }

  return { ok: true, message: 'Kursi berhasil dihapus.' };
}
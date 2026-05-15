import { apiClient } from '../core/apiClient';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Fetch all seats + venues for the Seat Management page.
 * Returns { seats: [...], venues: [...] }
 */
export async function fetchSeatsManagementData() {
  try {
    const response = await apiClient.get('/seats', { headers: getAuthHeaders() });
    const data = response.data;

    if (data.ok === false) {
      return { seats: [], venues: [] };
    }

    return {
      seats: data.seats || [],
      venues: data.venues || []
    };
  } catch (error) {
    console.error('Error fetching seats:', error);
    return { seats: [], venues: [] };
  }
}

/**
 * Create a new seat.
 * @param {{ venueId: string, section: string, rowNumber: string, seatNumber: string }} payload
 */
export async function createSeat(payload) {
  try {
    const response = await apiClient.post('/seats', {
      venueId: payload.venueId,
      section: payload.section,
      rowNumber: payload.rowNumber,
      seatNumber: payload.seatNumber
    }, { headers: getAuthHeaders() });

    const data = response.data;
    if (response.status >= 400 || data.ok === false) {
      return { ok: false, message: data.message || data.error || 'Gagal menambahkan kursi.' };
    }

    return { ok: true, message: data.message || 'Kursi berhasil ditambahkan.', id: data.data?.seat_id };
  } catch (error) {
    console.error('Error creating seat:', error);
    return { ok: false, message: error.message || 'Terjadi kesalahan saat menambahkan kursi.' };
  }
}

/**
 * Update an existing seat.
 * @param {string} seatId
 * @param {{ venueId: string, section: string, rowNumber: string, seatNumber: string }} payload
 */
export async function updateSeat(seatId, payload) {
  try {
    const response = await apiClient.put(`/seats/${seatId}`, {
      venueId: payload.venueId,
      section: payload.section,
      rowNumber: payload.rowNumber,
      seatNumber: payload.seatNumber
    }, { headers: getAuthHeaders() });

    const data = response.data;
    if (response.status >= 400 || data.ok === false) {
      return { ok: false, message: data.message || data.error || 'Gagal memperbarui kursi.' };
    }

    return { ok: true, message: data.message || 'Data kursi berhasil diperbarui.' };
  } catch (error) {
    console.error('Error updating seat:', error);
    return { ok: false, message: error.message || 'Terjadi kesalahan saat memperbarui kursi.' };
  }
}

/**
 * Delete a seat. Trigger 5.1 will block if seat is assigned to a ticket.
 * @param {string} seatId
 */
export async function deleteSeat(seatId) {
  try {
    const response = await apiClient.delete(`/seats/${seatId}`, { headers: getAuthHeaders() });

    const data = response.data;
    if (response.status >= 400 || data.ok === false) {
      return { ok: false, message: data.message || data.error || 'Gagal menghapus kursi.' };
    }

    return { ok: true, message: data.message || 'Kursi berhasil dihapus.' };
  } catch (error) {
    console.error('Error deleting seat:', error);
    return { ok: false, message: error.message || 'Terjadi kesalahan saat menghapus kursi.' };
  }
}

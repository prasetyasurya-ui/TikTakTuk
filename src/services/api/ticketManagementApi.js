import { apiClient } from '../core/apiClient';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// READ : fetch tickets
export async function fetchManageTicketsData({ userRole, userId } = {}) {
  try {
    const response = await apiClient.get('/tickets', {
      params: { userRole, userId },
      headers: getAuthHeaders()
    });

    const data = response.data;
    if (data.ok === false) {
      return [];
    }

    return data.tickets || [];
  } catch (error) {
    console.error('Error fetching tickets:', error);
    return [];
  }
}

// READ : basically, fetch available seats that is assigned to the ticket
export async function fetchAvailableSeatsForTicket(venueId, currentSeatId) {
  try {
    const response = await apiClient.get('/seats/available', {
      params: { venueId, currentSeatId },
      headers: getAuthHeaders()
    });

    const data = response.data;
    if (data.ok === false) {
      return [];
    }

    return data.seats || [];
  } catch (error) {
    console.error('Error fetching available seats:', error);
    return [];
  }
}


// UPDATE : update ticket info
export async function updateTicket(ticketId, payload) {
  try {
    const response = await apiClient.put(`/tickets/${ticketId}`, {
      status: payload.status,
      seatId: payload.seatId || null
    }, { headers: getAuthHeaders() });

    const data = response.data;
    if (response.status >= 400 || data.ok === false) {
      return { ok: false, message: data.message || data.error || 'Gagal memperbarui tiket.' };
    }

    return { ok: true, message: data.message || 'Tiket berhasil diperbarui.' };
  } catch (error) {
    console.error('Error updating ticket:', error);
    return { ok: false, message: error.message || 'Terjadi kesalahan saat memperbarui tiket.' };
  }
}

// DELETE : delete tickets
export async function deleteTicket(ticketId) {
  try {
    const response = await apiClient.delete(`/tickets/${ticketId}`, { headers: getAuthHeaders() });

    const data = response.data;
    if (response.status >= 400 || data.ok === false) {
      return { ok: false, message: data.message || data.error || 'Gagal menghapus tiket.' };
    }

    return { ok: true, message: data.message || 'Tiket beserta relasi kursi berhasil dihapus.' };
  } catch (error) {
    console.error('Error deleting ticket:', error);
    return { ok: false, message: error.message || 'Terjadi kesalahan saat menghapus tiket.' };
  }
}

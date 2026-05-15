import { apiClient } from '../core/apiClient';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// READ : fetch ticket asset info
export async function fetchTicketAssetsData({ userRole, userId } = {}) {
  try {
    const response = await apiClient.get('/tickets/assets', {
      params: { userRole, userId },
      headers: getAuthHeaders()
    });

    const data = response.data;
    if (data.ok === false) {
      return [];
    }

    return data.tickets || [];
  } catch (error) {
    console.error('Error fetching ticket assets:', error);
    return [];
  }
}

// READ : fetchs info for the dropdown menu for creating new ticket
export async function fetchCreateTicketFormData({ userRole, userId } = {}) {
  try {
    const response = await apiClient.get('/tickets/form-data', {
      params: { userRole, userId },
      headers: getAuthHeaders()
    });

    const data = response.data;
    if (data.ok === false) {
      return { orders: [], categories: [], seats: [] };
    }

    return {
      orders: data.orders || [],
      categories: data.categories || [],
      seats: data.seats || []
    };
  } catch (error) {
    console.error('Error fetching ticket form data:', error);
    return { orders: [], categories: [], seats: [] };
  }
}

// CREATE : create ticket
// Create a new ticket. Trigger 5.2 will block if category quota is full.
export async function createTicketAsset(payload) {
  try {
    const response = await apiClient.post('/tickets', {
      orderId: payload.orderId,
      categoryId: payload.categoryId,
      seatId: payload.seatId || null
    }, { headers: getAuthHeaders() });

    const data = response.data;
    if (response.status >= 400 || data.ok === false) {
      return { ok: false, message: data.message || data.error || 'Gagal membuat tiket.' };
    }

    return { ok: true, message: data.message || 'Tiket berhasil dibuat.' };
  } catch (error) {
    console.error('Error creating ticket:', error);
    return { ok: false, message: error.message || 'Terjadi kesalahan saat membuat tiket.' };
  }
}

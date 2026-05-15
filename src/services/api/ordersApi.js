import { apiClient } from '../core/apiClient';

/**
 * Fetch orders filtered by role.
 * Error messages from triggers/stored procedures are forwarded directly.
 */
export async function fetchOrders({ userRole = '', userId = '' } = {}) {
  try {
    const response = await apiClient.get('/orders', {
      params: { userRole, userId },
    });
    return response.data.orders || [];
  } catch (error) {
    console.error('Error fetching orders:', error);
    return [];
  }
}

/**
 * Fetch checkout data for a specific event.
 * Uses the stored procedure get_ticket_quota for remaining quota info.
 */
export async function fetchCheckoutData(eventId) {
  try {
    const response = await apiClient.get(`/checkout/${eventId}`);
    if (response.status >= 400) {
      return { ok: false, message: response.data?.error || 'Gagal memuat data checkout.' };
    }
    return response.data;
  } catch (error) {
    console.error('Error fetching checkout data:', error);
    return { ok: false, message: 'Gagal memuat data checkout.' };
  }
}

/**
 * Validate a promotion code against the backend.
 * Returns the trigger/stored procedure error message directly.
 */
export async function validatePromotionCode(promoCode) {
  try {
    const response = await apiClient.post('/orders/validate-promo', { promoCode });
    if (response.status >= 400) {
      return { ok: false, message: response.data?.error || 'Kode promo tidak valid.' };
    }
    return response.data;
  } catch (error) {
    console.error('Error validating promo code:', error);
    return { ok: false, message: 'Gagal memvalidasi kode promo.' };
  }
}

/**
 * Create an order. Error messages from triggers/stored procedures are
 * forwarded directly to the UI.
 */
export async function createOrder(
  { eventId = '', categoryId = '', quantity = 0, seatIds = [], promoCode = '' } = {},
  { userRole = '', userId = '' } = {}
) {
  const role = String(userRole || '').toLowerCase();
  if (role !== 'customer') {
    return { ok: false, message: 'Hanya customer yang dapat membuat order.' };
  }

  try {
    const response = await apiClient.post('/orders', {
      eventId,
      categoryId,
      quantity,
      seatIds,
      promoCode,
      userId,
    });

    if (response.status >= 400) {
      // Return the error message from the backend (trigger/SP)
      return { ok: false, message: response.data?.error || 'Gagal membuat order.' };
    }

    return { ok: true, orderId: response.data.orderId };
  } catch (error) {
    console.error('Error creating order:', error);
    return { ok: false, message: 'Gagal membuat order.' };
  }
}

/**
 * Update order payment status (Admin only).
 * Error messages from triggers are forwarded directly.
 */
export async function updateOrderPaymentStatus(
  orderId,
  paymentStatus,
  { userRole = '' } = {}
) {
  const role = String(userRole || '').toLowerCase();
  if (role !== 'admin') {
    return { ok: false, message: 'Hanya admin yang dapat memperbarui status order.' };
  }

  try {
    const response = await apiClient.put(`/orders/${orderId}`, { paymentStatus });
    if (response.status >= 400) {
      return { ok: false, message: response.data?.error || 'Gagal memperbarui order.' };
    }
    return { ok: true, message: response.data?.message || 'Order berhasil diperbarui.' };
  } catch (error) {
    console.error('Error updating order:', error);
    return { ok: false, message: 'Gagal memperbarui order.' };
  }
}

/**
 * Delete an order (Admin only).
 * Error messages from triggers are forwarded directly.
 */
export async function deleteOrder(orderId, { userRole = '' } = {}) {
  const role = String(userRole || '').toLowerCase();
  if (role !== 'admin') {
    return { ok: false, message: 'Hanya admin yang dapat menghapus order.' };
  }

  try {
    const response = await apiClient.delete(`/orders/${orderId}`);
    if (response.status >= 400) {
      return { ok: false, message: response.data?.error || 'Gagal menghapus order.' };
    }
    return { ok: true, message: response.data?.message || 'Order berhasil dihapus.' };
  } catch (error) {
    console.error('Error deleting order:', error);
    return { ok: false, message: 'Gagal menghapus order.' };
  }
}

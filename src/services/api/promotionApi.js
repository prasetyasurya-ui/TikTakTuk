import { apiClient } from '../core/apiClient';

/**
 * Fetch all promotions from the backend.
 * Includes usage count information.
 */
export async function fetchPromotions() {
  try {
    const response = await apiClient.get('/promotions');
    return response.data.promotions || [];
  } catch (error) {
    console.error('Error fetching promotions:', error);
    return [];
  }
}

/**
 * Create a new promotion (Admin only).
 * Error messages from triggers/stored procedures are forwarded directly.
 */
export async function createPromotion(payload, { userRole = '' } = {}) {
  if (String(userRole || '').toLowerCase() !== 'admin') {
    return { ok: false, message: 'Hanya admin yang dapat membuat promo.' };
  }

  try {
    const response = await apiClient.post('/promotions', {
      promoCode: payload.promoCode,
      discountType: payload.discountType,
      discountValue: payload.discountValue,
      startDate: payload.startDate,
      endDate: payload.endDate,
      usageLimit: payload.usageLimit,
    });

    if (response.status >= 400) {
      return { ok: false, message: response.data?.error || 'Gagal membuat promo.' };
    }

    return { ok: true, promotionId: response.data?.promotion?.promotion_id };
  } catch (error) {
    console.error('Error creating promotion:', error);
    return { ok: false, message: 'Gagal membuat promo.' };
  }
}

/**
 * Update an existing promotion (Admin only).
 * Error messages from triggers/stored procedures are forwarded directly.
 */
export async function updatePromotion(promotionId, payload, { userRole = '' } = {}) {
  if (String(userRole || '').toLowerCase() !== 'admin') {
    return { ok: false, message: 'Hanya admin yang dapat memperbarui promo.' };
  }

  try {
    const response = await apiClient.put(`/promotions/${promotionId}`, {
      promoCode: payload.promoCode,
      discountType: payload.discountType,
      discountValue: payload.discountValue,
      startDate: payload.startDate,
      endDate: payload.endDate,
      usageLimit: payload.usageLimit,
    });

    if (response.status >= 400) {
      return { ok: false, message: response.data?.error || 'Gagal memperbarui promo.' };
    }

    return { ok: true, message: response.data?.message || 'Promo berhasil diperbarui.' };
  } catch (error) {
    console.error('Error updating promotion:', error);
    return { ok: false, message: 'Gagal memperbarui promo.' };
  }
}

/**
 * Delete a promotion (Admin only).
 * Error messages from triggers/stored procedures are forwarded directly.
 */
export async function deletePromotion(promotionId, { userRole = '' } = {}) {
  if (String(userRole || '').toLowerCase() !== 'admin') {
    return { ok: false, message: 'Hanya admin yang dapat menghapus promo.' };
  }

  try {
    const response = await apiClient.delete(`/promotions/${promotionId}`);
    if (response.status >= 400) {
      return { ok: false, message: response.data?.error || 'Gagal menghapus promo.' };
    }

    return { ok: true, message: response.data?.message || 'Promo berhasil dihapus.' };
  } catch (error) {
    console.error('Error deleting promotion:', error);
    return { ok: false, message: 'Gagal menghapus promo.' };
  }
}

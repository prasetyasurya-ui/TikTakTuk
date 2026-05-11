import { fetchOrders } from './ordersApi';

function upper(value) {
  return String(value || '').trim().toUpperCase();
}

export async function fetchAssetOrders({ userRole = '', userId = '' } = {}) {
  const orders = await fetchOrders({ userRole, userId });
  return orders.filter((order) => upper(order.paymentStatus) === 'PAID');
}

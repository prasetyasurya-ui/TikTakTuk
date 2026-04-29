import { fetchOrders } from './ordersApi';

function upper(value) {
  return String(value || '').trim().toUpperCase();
}

export async function fetchAssetOrders() {
  const orders = await fetchOrders();
  return orders.filter((order) => upper(order.paymentStatus) === 'PAID');
}

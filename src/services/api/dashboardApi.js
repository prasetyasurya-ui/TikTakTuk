import { apiClient } from '../core/apiClient';

export async function fetchAdminDashboard() {
  const response = await apiClient.get('/dashboard/admin');
  return response.data.data;
}

export async function fetchOrganizerDashboard(userId) {
  const response = await apiClient.get('/dashboard/organizer', {
    params: { userId },
  });
  return response.data.data;
}

export async function fetchCustomerDashboard(userId) {
  const response = await apiClient.get('/dashboard/customer', {
    params: { userId },
  });
  return response.data.data;
}

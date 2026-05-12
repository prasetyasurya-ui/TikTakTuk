import { apiClient } from '../core/apiClient';

export async function fetchProfile(userId) {
  const response = await apiClient.get('/profile', {
    params: { userId },
  });
  return response;
}

export async function updateProfile(userId, payload) {
  const response = await apiClient.post('/profile/update', payload, {
    params: { userId },
  });
  return response;
}

export async function changePassword(userId, payload) {
  const response = await apiClient.post('/profile/change-password', payload, {
    params: { userId },
  });
  return response;
}

import { apiClient } from '../core/apiClient';

export async function fetchVenues() {
  const response = await apiClient.get('/venues');
  return response.data.venues || [];
}

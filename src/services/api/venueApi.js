import { apiClient } from '../core/apiClient';

export async function fetchVenues() {
  const response = await apiClient.get('/venues');
  const venues = response.data.venues || [];

  // Preserve DB `jenis_seating` value for frontend (if present), fall back to existing seating_type
  return venues.map((v) => ({
    ...v,
    seating_type: v.jenis_seating || v.seating_type,
    capacity: Number(v.capacity || 0),
  }));
}

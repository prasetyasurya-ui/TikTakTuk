import { apiClient } from '../core/apiClient';

export async function fetchEvents() {
  const response = await apiClient.get('/events');
  return response.data.events || [];
}

export async function fetchEventManagementData({ userRole, userId }) {
  const response = await apiClient.get('/events/management', {
    params: { userRole, userId },
  });

  return {
    venues: response.data.venues || [],
    artists: response.data.artists || [],
    events: response.data.events || [],
  };
}

export async function createVenue({ name, seating_type, address, city, capacity }) {
  const response = await apiClient.get('/events/create', {
    params: { name, seating_type, address, city, capacity },
  });
  
  return {
    venue: response.data.venue
  };
}

export async function updateVenue({ name, seating_type, address, city, capacity }) {
  const response = await apiClient.get('/events/edit', {
    params: { name, seating_type, address, city, capacity },
  });
  
  return {
    venue: response.data.venue
  };
}
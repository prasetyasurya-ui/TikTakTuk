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
  const mapLabelToJenis = (label) => {
    if (!label) return undefined;
    const l = String(label).toLowerCase();
    if (l.includes('reserv')) return 'RESERVED_SEATING';
    return 'FREE_SEATING';
  };

  const payload = {
    name,
    seating_type,
    jenis_seating: mapLabelToJenis(seating_type),
    address,
    city,
    capacity,
  };

  const response = await apiClient.post('/events/create', {
    params: payload,
  });

  return {
    venue: response.data.venue || response.data,
  };
}

export async function updateVenue({ name, seating_type, address, city, capacity }) {
  const mapLabelToJenis = (label) => {
    if (!label) return undefined;
    const l = String(label).toLowerCase();
    if (l.includes('reserv')) return 'RESERVED_SEATING';
    return 'FREE_SEATING';
  };

  const payload = {
    name,
    seating_type,
    jenis_seating: mapLabelToJenis(seating_type),
    address,
    city,
    capacity,
  };

  const response = await apiClient.post('/events/edit', {
    params: payload,
  });

  return {
    venue: response.data.venue || response.data,
  };
}
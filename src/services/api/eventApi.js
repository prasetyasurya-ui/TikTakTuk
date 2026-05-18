import { apiClient } from '../core/apiClient';

// READ: Fetch all events
export async function fetchEvents() {
  try {
    const response = await apiClient.get('/events');
    return response.data.events || [];
  } catch (error) {
    console.error('Error fetching events:', error);
    return [];
  }
}

// READ: Fetch single event by ID
export async function fetchEventById(eventId) {
  try {
    const response = await apiClient.get(`/events/${eventId}`);
    return response.data.event || null;
  } catch (error) {
    console.error('Error fetching event:', error);
    return null;
  }
}
  
// CREATE: Create new event
export async function createEvent(eventData) {
  try {
    const { event_title, event_datetime, venue_id, organizer_id, description, artists, categories } = eventData;
    
    const response = await apiClient.post('/events', {
      event_title,
      event_datetime,
      venue_id,
      organizer_id,
      description: description || '',
      artists: Array.isArray(artists) ? artists : [],
      categories: Array.isArray(categories) ? categories : []
    });

    return {
      success: true,
      event: response.data.event
    };
  } catch (error) {
    console.error('Error creating event:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
}

// UPDATE: Update existing event
export async function updateEvent(eventId, eventData) {
  try {
    const { event_title, event_datetime, venue_id, organizer_id, description, artists, categories } = eventData;
    
    const response = await apiClient.put(`/events/${eventId}`, {
      event_title,
      event_datetime,
      venue_id,
      organizer_id,
      description: description || '',
      artists: Array.isArray(artists) ? artists : [],
      categories: Array.isArray(categories) ? categories : []
    });

    return {
      success: true,
      event: response.data.event
    };
  } catch (error) {
    console.error('Error updating event:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
}

// Legacy: Fetch management data (for EventManagementPage)
export async function fetchEventManagementData({ userRole, userId }) {
  try {
    const response = await apiClient.get('/events/management', {
      params: { userRole, userId },
    });

    return {
      venues: response.data.venues || [],
      artists: response.data.artists || [],
      organizers: response.data.organizers || [],
      events: response.data.events || [],
    };
  } catch (error) {
    console.error('Error fetching management data:', error);
    return {
      venues: [],
      artists: [],
      organizers: [],
      events: []
    };
  }
}

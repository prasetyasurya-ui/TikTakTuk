import { apiClient } from '../core/apiClient';

// READ: Fetch all venues
export async function fetchVenues() {
  try {
    const response = await apiClient.get('/venues');
    const venues = response.data.venues || [];

    // Preserve DB `jenis_seating` value for frontend (if present), fall back to existing seating_type
    return venues.map((v) => ({
      ...v,
      seating_type: v.jenis_seating || v.seating_type,
      capacity: Number(v.capacity || 0),
    }));
  } catch (error) {
    console.error('Error fetching venues:', error);
    return [];
  }
}

// READ: Fetch single venue by ID
export async function fetchVenueById(venueId) {
  try {
    const response = await apiClient.get(`/venues/${venueId}`);
    const venue = response.data.venue || null;
    
    if (venue) {
      return {
        ...venue,
        seating_type: venue.jenis_seating || venue.seating_type,
        capacity: Number(venue.capacity || 0),
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching venue:', error);
    return null;
  }
}

// CREATE: Create new venue
export async function createVenue(venueData) {
  try {
    const { venue_name, capacity, address, city, jenis_seating } = venueData;

    const response = await apiClient.post('/venues', {
      venue_name,
      capacity: Number(capacity),
      address,
      city,
      jenis_seating: jenis_seating || 'FREE_SEATING'
    });

    return {
      success: true,
      venue: response.data.venue
    };
  } catch (error) {
    console.error('Error creating venue:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
}

// UPDATE: Update existing venue
export async function updateVenue(venueId, venueData) {
  try {
    const { venue_name, capacity, address, city, jenis_seating } = venueData;

    const response = await apiClient.put(`/venues/${venueId}`, {
      venue_name,
      capacity: Number(capacity),
      address,
      city,
      jenis_seating: jenis_seating || 'FREE_SEATING'
    });

    return {
      success: true,
      venue: response.data.venue
    };
  } catch (error) {
    console.error('Error updating venue:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
}

// DELETE: Delete venue
export async function deleteVenue(venueId) {
  try {
    const response = await apiClient.delete(`/venues/${venueId}`);
    return {
      success: true,
      message: response.data.message
    };
  } catch (error) {
    console.error('Error deleting venue:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
}

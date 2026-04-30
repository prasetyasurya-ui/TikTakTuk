import { apiClient } from '../core/apiClient';

export const artistApi = {
  getArtists: async () => {
    const response = await apiClient.get('/artists');
    return response;
  },

  createArtist: async (payload) => {
    const response = await apiClient.post('/artists', { data: payload });
    return response;
  },

  updateArtist: async (id, payload) => {
    const response = await apiClient.put(`/artists/${id}`, { data: payload });
    return response;
  },

  deleteArtist: async (id) => {
    const response = await apiClient.delete(`/artists/${id}`);
    return response;
  },
};

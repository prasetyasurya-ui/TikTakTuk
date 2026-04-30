import { apiClient } from '../core/apiClient';

export const ticketCategoryApi = {
  getTicketCategories: async () => {
    const response = await apiClient.get('/ticket-categories');
    return response;
  },

  createTicketCategory: async (payload) => {
    const response = await apiClient.post('/ticket-categories', { data: payload });
    return response;
  },

  updateTicketCategory: async (id, payload) => {
    const response = await apiClient.put(`/ticket-categories/${id}`, { data: payload });
    return response;
  },

  deleteTicketCategory: async (id) => {
    const response = await apiClient.delete(`/ticket-categories/${id}`);
    return response;
  },
};

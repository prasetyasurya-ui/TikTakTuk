import {
  loginWithDummy,
  registerCustomerDummy,
  registerOrganizerDummy,
  clearSession,
  getVenues,
  getEvents,
  getEventManagementData,
  getAdminDashboardData,
  getOrganizerDashboardData,
  getCustomerDashboardData,
  getProfileData,
  updateProfileData,
  changePasswordData,
  getArtistsData,
  createArtistData,
  updateArtistData,
  deleteArtistData,
  getTicketCategoriesData,
  createTicketCategoryData,
  updateTicketCategoryData,
  deleteTicketCategoryData,
} from './mockDb';

export function handleMockRequest(method, url, options = {}) {
  const { params = {}, data } = options;

  if (method === 'GET' && url === '/artists') {
    return { ok: true, data: getArtistsData() };
  }

  if (method === 'POST' && url === '/artists') {
    return createArtistData(data);
  }

  if (method === 'PUT' && url.startsWith('/artists/')) {
    const id = url.split('/').pop();
    return updateArtistData(id, data);
  }

  if (method === 'DELETE' && url.startsWith('/artists/')) {
    const id = url.split('/').pop();
    return deleteArtistData(id);
  }

  if (method === 'GET' && url === '/ticket-categories') {
    return { ok: true, data: getTicketCategoriesData() };
  }

  if (method === 'POST' && url === '/ticket-categories') {
    return createTicketCategoryData(data);
  }

  if (method === 'PUT' && url.startsWith('/ticket-categories/')) {
    const id = url.split('/').pop();
    return updateTicketCategoryData(id, data);
  }

  if (method === 'DELETE' && url.startsWith('/ticket-categories/')) {
    const id = url.split('/').pop();
    return deleteTicketCategoryData(id);
  }

  if (method === 'POST' && url === '/auth/login') {
    return loginWithDummy(data.username, data.password);
  }

  if (method === 'POST' && url === '/auth/register/customer') {
    return registerCustomerDummy(data);
  }

  if (method === 'POST' && url === '/auth/register/organizer') {
    return registerOrganizerDummy(data);
  }

  if (method === 'POST' && url === '/auth/logout') {
    clearSession();
    return { ok: true };
  }

  if (method === 'GET' && url === '/events') {
    return { ok: true, events: getEvents() };
  }

  if (method === 'GET' && url === '/venues') {
    return { ok: true, venues: getVenues() };
  }

  if (method === 'GET' && url === '/events/management') {
    return {
      ok: true,
      ...getEventManagementData(params.userRole, params.userId),
    };
  }

  if (method === 'GET' && url === '/dashboard/admin') {
    return {
      ok: true,
      data: getAdminDashboardData(),
    };
  }

  if (method === 'GET' && url === '/dashboard/organizer') {
    return {
      ok: true,
      data: getOrganizerDashboardData(params.userId),
    };
  }

  if (method === 'GET' && url === '/dashboard/customer') {
    return {
      ok: true,
      data: getCustomerDashboardData(params.userId),
    };
  }

  if (method === 'GET' && url === '/profile') {
    return getProfileData(params.userId);
  }

  if (method === 'POST' && url === '/profile/update') {
    return updateProfileData(params.userId, data);
  }

  if (method === 'POST' && url === '/profile/change-password') {
    return changePasswordData(
      params.userId,
      data.oldPassword,
      data.newPassword,
      data.confirmPassword
    );
  }


  if (method === 'POST' && url === '/events/create') {
    return {
      ok: true,
      data: data
    };
  }


  if (method === 'POST' && url === '/events/edit') {
    return {
      ok: true,
      data: data
    }
  }

  return {
    ok: false,
    message: `Endpoint tidak ditemukan: ${method} ${url}`,
  };
}

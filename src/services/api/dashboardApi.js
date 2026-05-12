import { apiClient } from '../core/apiClient';

const DEFAULT_ADMIN_DASHBOARD = {
  platform: {
    total_pengguna: '0',
    total_acara_bulan_ini: '0',
    omzet_platform: 'Rp 0',
    promosi_aktif: '0',
  },
  infrastruktur_venue: {
    total_venue: 0,
    reserved_seating: 0,
    kapasitas_terbesar: '-',
  },
  marketing_promosi: {
    promo_persentase: 0,
    promo_nominal: 0,
    total_penggunaan: '0 kali',
  },
};

const DEFAULT_ORGANIZER_DASHBOARD = {
  ringkasan: {
    acara_aktif: 0,
    tiket_terjual: 0,
    revenue_bulan_ini: 'Rp 0',
    venue_mitra: 0,
  },
  top_acara: [],
};

const DEFAULT_CUSTOMER_DASHBOARD = {
  nama: 'User',
  stats: {
    tiket_aktif: 0,
    acara_diikuti: 0,
    promo_tersedia: 0,
    total_belanja_bulan_ini: 'Rp 0',
  },
  upcoming_tickets: [],
};

function unwrapDashboardData(response) {
  if (!response || response.status >= 400) return null;
  if (response.data && typeof response.data === 'object') {
    return response.data.data ?? response.data;
  }
  return null;
}

export async function fetchAdminDashboard() {
  const response = await apiClient.get('/dashboard/admin');
  const data = unwrapDashboardData(response);
  if (!data || typeof data !== 'object') return DEFAULT_ADMIN_DASHBOARD;

  return {
    ...DEFAULT_ADMIN_DASHBOARD,
    ...data,
    platform: {
      ...DEFAULT_ADMIN_DASHBOARD.platform,
      ...(data.platform || {}),
    },
    infrastruktur_venue: {
      ...DEFAULT_ADMIN_DASHBOARD.infrastruktur_venue,
      ...(data.infrastruktur_venue || {}),
    },
    marketing_promosi: {
      ...DEFAULT_ADMIN_DASHBOARD.marketing_promosi,
      ...(data.marketing_promosi || {}),
    },
  };
}

export async function fetchOrganizerDashboard(userId) {
  const response = await apiClient.get('/dashboard/organizer', {
    params: { userId },
  });
  const data = unwrapDashboardData(response);
  if (!data || typeof data !== 'object') return DEFAULT_ORGANIZER_DASHBOARD;

  return {
    ...DEFAULT_ORGANIZER_DASHBOARD,
    ...data,
    ringkasan: {
      ...DEFAULT_ORGANIZER_DASHBOARD.ringkasan,
      ...(data.ringkasan || {}),
    },
    top_acara: Array.isArray(data.top_acara) ? data.top_acara : [],
  };
}

export async function fetchCustomerDashboard(userId) {
  const response = await apiClient.get('/dashboard/customer', {
    params: { userId },
  });
  const data = unwrapDashboardData(response);
  if (!data || typeof data !== 'object') return DEFAULT_CUSTOMER_DASHBOARD;

  return {
    ...DEFAULT_CUSTOMER_DASHBOARD,
    ...data,
    nama: data.nama || DEFAULT_CUSTOMER_DASHBOARD.nama,
    stats: {
      ...DEFAULT_CUSTOMER_DASHBOARD.stats,
      ...(data.stats || {}),
    },
    upcoming_tickets: Array.isArray(data.upcoming_tickets) ? data.upcoming_tickets : [],
  };
}

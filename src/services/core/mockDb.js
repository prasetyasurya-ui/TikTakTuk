import seedData from '../../data/dummyData.json';

const STORAGE_KEY = 'tiktaktuk_mock_db_v1';

const ROLE_PRIORITY = {
  Admin: 3,
  Organizer: 2,
  Customer: 1,
};

const EVENT_GRADIENTS = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-cyan-600',
  'from-amber-500 to-orange-600',
  'from-fuchsia-500 to-rose-600',
  'from-slate-700 to-slate-900',
  'from-teal-500 to-emerald-700',
];

function clone(data) {
  return JSON.parse(JSON.stringify(data));
}

export function loadDb() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);

      // If stored DB lacks `jenis_seating` in venues (from older seed), enrich from seedData
      if (Array.isArray(parsed.venue) && parsed.venue.some((v) => v.jenis_seating === undefined)) {
        const seedVenueMap = new Map((seedData.venue || []).map((v) => [v.venue_id, v.jenis_seating]));
        parsed.venue = parsed.venue.map((v) => ({
          ...v,
          jenis_seating: v.jenis_seating !== undefined ? v.jenis_seating : seedVenueMap.get(v.venue_id) || null,
        }));
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        } catch {
          // ignore write failures
        }
      }

      return parsed;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  const initial = clone(seedData);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

function saveDb(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function getRoleNamesByUserId(db, userId) {
  const roleMap = new Map(db.role.map((r) => [r.role_id, r.role_name]));
  return db.account_role
    .filter((row) => row.user_id === userId)
    .map((row) => roleMap.get(row.role_id))
    .filter(Boolean);
}

function pickPrimaryRole(roles) {
  if (!roles.length) return 'Customer';
  return [...roles].sort((a, b) => ROLE_PRIORITY[b] - ROLE_PRIORITY[a])[0];
}

function buildProfile(db, user) {
  const roles = getRoleNamesByUserId(db, user.user_id);
  const primaryRole = pickPrimaryRole(roles);

  const customer = db.customer.find((c) => c.user_id === user.user_id);
  const organizer = db.organizer.find((o) => o.user_id === user.user_id);

  const userName =
    organizer?.organizer_name ||
    customer?.full_name ||
    user.username;

  return {
    userId: user.user_id,
    username: user.username,
    userName,
    role: primaryRole.toLowerCase(),
    roles: roles.map((r) => r.toLowerCase()),
  };
}

export function persistSession(profile) {
  localStorage.setItem('isLoggedIn', 'true');
  localStorage.setItem('userId', profile.userId);
  localStorage.setItem('userRole', profile.role);
  localStorage.setItem('userName', profile.userName);
  localStorage.setItem('username', profile.username);
}

export function clearSession() {
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('userId');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userName');
  localStorage.removeItem('username');
}

export function getSession() {
  return {
    isLoggedIn: localStorage.getItem('isLoggedIn') === 'true',
    userId: localStorage.getItem('userId') || '',
    userRole: localStorage.getItem('userRole') || 'customer',
    userName: localStorage.getItem('userName') || 'User',
    username: localStorage.getItem('username') || '',
  };
}

export function getProfileData(userId) {
  const db = loadDb();
  const user = db.user_account.find((row) => row.user_id === userId);

  if (!user) {
    return {
      ok: false,
      message: 'User tidak ditemukan.',
    };
  }

  const roleNames = getRoleNamesByUserId(db, user.user_id);
  const role = pickPrimaryRole(roleNames).toLowerCase();

  const customer = db.customer.find((row) => row.user_id === user.user_id);
  const organizer = db.organizer.find((row) => row.user_id === user.user_id);

  if (role === 'organizer' && organizer) {
    return {
      ok: true,
      data: {
        role,
        username: user.username,
        organizer_name: organizer.organizer_name,
        contact_email: organizer.contact_email || '',
      },
    };
  }

  if (role === 'customer' && customer) {
    return {
      ok: true,
      data: {
        role,
        username: user.username,
        full_name: customer.full_name,
        phone_number: customer.phone_number || '',
      },
    };
  }

  return {
    ok: true,
    data: {
      role,
      username: user.username,
    },
  };
}

export function updateProfileData(userId, payload) {
  const db = loadDb();
  const user = db.user_account.find((row) => row.user_id === userId);

  if (!user) {
    return { ok: false, message: 'User tidak ditemukan.' };
  }

  const session = getSession();

  if (session.userRole === 'customer') {
    const customer = db.customer.find((row) => row.user_id === user.user_id);
    if (!customer) {
      return { ok: false, message: 'Profil customer tidak ditemukan.' };
    }

    customer.full_name = (payload.full_name || customer.full_name).trim();
    customer.phone_number = (payload.phone_number || customer.phone_number || '').trim();

    localStorage.setItem('userName', customer.full_name);
  } else if (session.userRole === 'organizer') {
    const organizer = db.organizer.find((row) => row.user_id === user.user_id);
    if (!organizer) {
      return { ok: false, message: 'Profil organizer tidak ditemukan.' };
    }

    organizer.organizer_name = (payload.organizer_name || organizer.organizer_name).trim();
    organizer.contact_email = (payload.contact_email || organizer.contact_email || '').trim();

    localStorage.setItem('userName', organizer.organizer_name);
  } else {
    return { ok: false, message: 'Role ini tidak memiliki profil yang bisa diedit.' };
  }

  saveDb(db);
  return getProfileData(userId);
}

export function changePasswordData(userId, oldPassword, newPassword, confirmPassword) {
  const db = loadDb();
  const user = db.user_account.find((row) => row.user_id === userId);

  if (!user) {
    return { ok: false, message: 'User tidak ditemukan.' };
  }

  if (!oldPassword || !newPassword || !confirmPassword) {
    return { ok: false, message: 'Semua field password wajib diisi.' };
  }

  if (user.password !== oldPassword) {
    return { ok: false, message: 'Password lama tidak sesuai.' };
  }

  if (newPassword !== confirmPassword) {
    return { ok: false, message: 'Konfirmasi password tidak cocok.' };
  }

  user.password = newPassword;
  saveDb(db);

  return { ok: true, message: 'Password berhasil diubah.' };
}

export function loginWithDummy(username, password) {
  const db = loadDb();
  const user = db.user_account.find((u) => u.username === username);

  if (!user || user.password !== password) {
    return { ok: false, message: 'Username atau password salah.' };
  }

  const profile = buildProfile(db, user);
  persistSession(profile);

  return { ok: true, user: profile };
}

export function registerCustomerDummy(payload) {
  const db = loadDb();

  if (db.user_account.some((u) => u.username === payload.username)) {
    return { ok: false, message: 'Username sudah digunakan.' };
  }

  const userId = `usr_custom_${Date.now()}`;
  const customerId = `cust_custom_${Date.now()}`;

  db.user_account.push({
    user_id: userId,
    username: payload.username,
    password: payload.password,
  });

  db.account_role.push({ role_id: 'role_customer', user_id: userId });

  db.customer.push({
    customer_id: customerId,
    phone_number: payload.phone_number,
    full_name: payload.full_name,
    user_id: userId,
  });

  saveDb(db);

  const profile = {
    userId,
    username: payload.username,
    userName: payload.full_name,
    role: 'customer',
    roles: ['customer'],
  };

  persistSession(profile);
  return { ok: true, user: profile };
}

export function registerOrganizerDummy(payload) {
  const db = loadDb();

  if (db.user_account.some((u) => u.username === payload.username)) {
    return { ok: false, message: 'Username sudah digunakan.' };
  }

  const userId = `usr_custom_${Date.now()}`;
  const organizerId = `org_custom_${Date.now()}`;

  db.user_account.push({
    user_id: userId,
    username: payload.username,
    password: payload.password,
  });

  db.account_role.push({ role_id: 'role_organizer', user_id: userId });

  db.organizer.push({
    organizer_id: organizerId,
    organizer_name: payload.organizer_name,
    contact_email: payload.contact_email,
    user_id: userId,
  });

  saveDb(db);

  const profile = {
    userId,
    username: payload.username,
    userName: payload.organizer_name,
    role: 'organizer',
    roles: ['organizer'],
  };

  persistSession(profile);
  return { ok: true, user: profile };
}

export function getVenues() {
  const db = loadDb();
  const seatByVenue = db.seat.reduce((acc, seat) => {
    acc[seat.venue_id] = (acc[seat.venue_id] || 0) + 1;
    return acc;
  }, {});

  return db.venue.map((venue) => {
    const fallbackIsReserved = (seatByVenue[venue.venue_id] || 0) > 0;
    const seatingType = venue.jenis_seating
      ? String(venue.jenis_seating)
      : fallbackIsReserved
      ? 'RESERVED_SEATING'
      : 'FREE_SEATING';

    return {
      id: venue.venue_id,
      name: venue.venue_name,
      address: venue.address,
      city: venue.city,
      capacity: Number(venue.capacity || 0),
      seating_type: seatingType,
      jenis_seating: venue.jenis_seating,
    };
  });
}

export function getEvents() {
  const db = loadDb();
  const venueMap = new Map(db.venue.map((v) => [v.venue_id, v.venue_name]));
  const artistMap = new Map(db.artist.map((a) => [a.artist_id, a.name]));

  return db.event
    .map((event, index) => {
      const categories = db.ticket_category.filter((c) => c.tevent_id === event.event_id);
      const artists = db.event_artist
        .filter((ea) => ea.event_id === event.event_id)
        .map((ea) => artistMap.get(ea.artist_id))
        .filter(Boolean);

      return {
        id: event.event_id,
        title: event.event_title,
        date: event.event_datetime.slice(0, 10),
        time: event.event_datetime.slice(11, 16),
        venue: venueMap.get(event.venue_id) || '-',
        artists,
        categories: categories.map((c) => c.category_name),
        startPrice: Math.min(...categories.map((c) => Number(c.price))),
        organizerId: event.organizer_id,
        gradient: EVENT_GRADIENTS[index % EVENT_GRADIENTS.length],
      };
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

export function getEventManagementData(userRole, userId) {
  const db = loadDb();
  const venueMap = new Map(db.venue.map((v) => [v.venue_id, v.venue_name]));
  const organizerMap = new Map(db.organizer.map((o) => [o.organizer_id, o.organizer_name]));
  const artistMap = new Map(db.artist.map((a) => [a.artist_id, a]));

  const organizer = db.organizer.find((row) => row.user_id === userId);
  const organizerId = organizer?.organizer_id;

  const events = db.event
    .map((event, index) => {
      const categories = db.ticket_category.filter((c) => c.tevent_id === event.event_id);
      const eventArtists = db.event_artist
        .filter((ea) => ea.event_id === event.event_id)
        .map((ea) => {
          const artist = artistMap.get(ea.artist_id);
          return artist ? { name: artist.name, role: ea.role } : null;
        })
        .filter(Boolean);

      return {
        id: event.event_id,
        title: event.event_title,
        date: event.event_datetime.slice(0, 10),
        time: event.event_datetime.slice(11, 16),
        venue: venueMap.get(event.venue_id) || '-',
        artists: eventArtists,
        categories: categories.map((c) => ({
          name: c.category_name,
          price: Number(c.price),
          quota: Number(c.quota),
        })),
        startPrice: Math.min(...categories.map((c) => Number(c.price))),
        organizerId: event.organizer_id,
        organizerName: organizerMap.get(event.organizer_id) || '-',
        gradient: EVENT_GRADIENTS[index % EVENT_GRADIENTS.length],
      };
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const filteredEvents =
    userRole === 'admin' ? events : events.filter((event) => event.organizerId === organizerId);

  return {
    venues: db.venue.map((v) => v.venue_name),
    artists: db.artist.map((a) => a.name),
    events: filteredEvents,
  };
}

function toIDRCurrency(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function getAdminDashboardData() {
  const db = loadDb();
  const totalRevenue = db.order
    .filter((order) => order.payment_status === 'PAID')
    .reduce((sum, order) => sum + Number(order.total_amount), 0);

  const maxVenue = db.venue.reduce((best, venue) => {
    if (!best || venue.capacity > best.capacity) return venue;
    return best;
  }, null);

  return {
    platform: {
      total_pengguna: db.user_account.length.toLocaleString('id-ID'),
      total_acara_bulan_ini: db.event.length.toLocaleString('id-ID'),
      omzet_platform: toIDRCurrency(totalRevenue),
      promosi_aktif: db.promotion.length.toString(),
    },
    infrastruktur_venue: {
      total_venue: db.venue.length,
      reserved_seating: db.venue.length,
      kapasitas_terbesar: `${maxVenue?.capacity.toLocaleString('id-ID')} (${maxVenue?.venue_name})`,
    },
    marketing_promosi: {
      promo_persentase: db.promotion.filter((p) => p.discount_type === 'PERCENTAGE').length,
      promo_nominal: db.promotion.filter((p) => p.discount_type === 'NOMINAL').length,
      total_penggunaan: `${db.order_promotion.length.toLocaleString('id-ID')} kali`,
    },
  };
}

export function getOrganizerDashboardData(userId) {
  const db = loadDb();
  const organizer = db.organizer.find((row) => row.user_id === userId);

  if (!organizer) {
    return {
      ringkasan: {
        acara_aktif: 0,
        tiket_terjual: 0,
        revenue_bulan_ini: toIDRCurrency(0),
        venue_mitra: 0,
      },
      top_acara: [],
    };
  }

  const ownEvents = db.event.filter((event) => event.organizer_id === organizer.organizer_id);
  const ownEventIds = new Set(ownEvents.map((event) => event.event_id));
  const ownCategories = db.ticket_category.filter((cat) => ownEventIds.has(cat.tevent_id));
  const ownCategoryIds = new Set(ownCategories.map((cat) => cat.category_id));

  const soldTickets = db.ticket.filter(
    (ticket) => ownCategoryIds.has(ticket.tcategory_id)
  );

  const categoryMap = new Map(ownCategories.map((cat) => [cat.category_id, cat]));
  const soldRevenue = soldTickets.reduce((sum, ticket) => {
    const category = categoryMap.get(ticket.tcategory_id);
    return sum + Number(category?.price || 0);
  }, 0);

  const venueCount = new Set(ownEvents.map((event) => event.venue_id)).size;

  const top_acara = ownEvents.map((event) => {
    const categories = ownCategories.filter((cat) => cat.tevent_id === event.event_id);
    const quotas = categories.reduce((sum, cat) => sum + Number(cat.quota), 0);
    const soldCount = soldTickets.filter((ticket) => {
      const cat = categoryMap.get(ticket.tcategory_id);
      return cat?.tevent_id === event.event_id;
    }).length;

    // Hitung persentase: (tiket terjual / total kuota) * 100 dengan 1 desimal
    // Jika hasil < 0.1% tapi ada tiket terjual, tampilkan minimal 0.1%
    let percentage = quotas > 0 ? Math.round((soldCount / quotas) * 100 * 10) / 10 : 0;
    if (soldCount > 0 && percentage === 0) {
      percentage = 0.1;
    }

    return {
      id: event.event_id,
      nama_event: event.event_title,
      status: 'Live',
      persentase_terjual: percentage,
      total_tiket: quotas,
    };
  });

  return {
    ringkasan: {
      acara_aktif: ownEvents.length,
      tiket_terjual: soldTickets.length,
      revenue_bulan_ini: toIDRCurrency(soldRevenue),
      venue_mitra: venueCount,
    },
    top_acara,
  };
}

export function getCustomerDashboardData(userId) {
  const db = loadDb();

  const customer = db.customer.find((row) => row.user_id === userId) || db.customer[0];
  if (!customer) {
    return {
      nama: 'User',
      stats: {
        tiket_aktif: 0,
        acara_diikuti: 0,
        promo_tersedia: 0,
        total_belanja_bulan_ini: toIDRCurrency(0),
      },
      upcoming_tickets: [],
    };
  }

  const orders = db.order.filter((order) => order.customer_id === customer.customer_id);
  const paidOrderIds = new Set(
    orders.filter((order) => order.payment_status === 'PAID').map((order) => order.order_id)
  );

  const categoryMap = new Map(db.ticket_category.map((cat) => [cat.category_id, cat]));
  const eventMap = new Map(db.event.map((event) => [event.event_id, event]));
  const venueMap = new Map(db.venue.map((venue) => [venue.venue_id, venue]));

  const soldTickets = db.ticket.filter(
    (ticket) => ticket.status === 'sold' && paidOrderIds.has(ticket.torder_id)
  );

  const upcoming_tickets = soldTickets
    .map((ticket) => {
      const category = categoryMap.get(ticket.tcategory_id);
      const event = eventMap.get(category?.tevent_id);
      const venue = venueMap.get(event?.venue_id);

      if (!category || !event || !venue) return null;

      const eventDate = new Date(event.event_datetime);
      return {
        id: ticket.ticket_code,
        nama_event: event.event_title,
        tanggal_event: eventDate.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        lokasi_event: venue.venue_name,
        jenis_tiket: category.category_name,
        waktu_mulai: `${eventDate.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })} WIB`,
        sortTime: eventDate.getTime(),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.sortTime - b.sortTime)
    .slice(0, 2)
    .map(({ sortTime, ...rest }) => rest);

  const joinedEventCount = new Set(
    soldTickets
      .map((ticket) => categoryMap.get(ticket.tcategory_id)?.tevent_id)
      .filter(Boolean)
  ).size;

  const totalSpent = orders
    .filter((order) => order.payment_status === 'PAID')
    .reduce((sum, order) => sum + Number(order.total_amount), 0);

  return {
    nama: customer.full_name,
    stats: {
      tiket_aktif: soldTickets.length,
      acara_diikuti: joinedEventCount,
      promo_tersedia: db.promotion.length,
      total_belanja_bulan_ini: toIDRCurrency(totalSpent),
    },
    upcoming_tickets,
  };
}

// --- Artist ---
export function getArtistsData() {
  const db = loadDb();
  const eventArtistCounts = db.event_artist.reduce((acc, ea) => {
    acc[ea.artist_id] = (acc[ea.artist_id] || 0) + 1;
    return acc;
  }, {});

  // Filter out artists with missing names and map with event counts
  const artists = db.artist
    .filter(a => a && a.name) // Filter out invalid entries
    .map(a => ({
      ...a,
      event_count: eventArtistCounts[a.artist_id] || 0
    }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  
  return artists;
}

export function createArtistData(payload) {
  const db = loadDb();
  // Handle nested data structure from API
  const data = payload.data || payload;
  const newArtist = {
    artist_id: `art_${Date.now()}`,
    name: data.name,
    genre: data.genre || '',
  };
  db.artist.push(newArtist);
  saveDb(db);
  return { ok: true, data: newArtist };
}

export function updateArtistData(id, payload) {
  const db = loadDb();
  // Handle nested data structure from API
  const data = payload.data || payload;
  const index = db.artist.findIndex((a) => a.artist_id === id);
  if (index === -1) return { ok: false, message: 'Artist tidak ditemukan.' };

  db.artist[index] = { ...db.artist[index], ...data };
  saveDb(db);
  return { ok: true, data: db.artist[index] };
}

export function deleteArtistData(id) {
  const db = loadDb();
  db.artist = db.artist.filter((a) => a.artist_id !== id);
  // Also cleanup event_artist relations
  db.event_artist = db.event_artist.filter((ea) => ea.artist_id !== id);
  saveDb(db);
  return { ok: true, message: 'Artist berhasil dihapus.' };
}

// --- Ticket Category ---
export function getTicketCategoriesData() {
  const db = loadDb();
  const eventMap = new Map(db.event.map((e) => [e.event_id, e.event_title]));
  
  return db.ticket_category
    .map((cat) => ({
      ...cat,
      event_name: eventMap.get(cat.tevent_id) || '-',
    }))
    .sort((a, b) => {
      const eventCompare = a.event_name.localeCompare(b.event_name);
      if (eventCompare !== 0) return eventCompare;
      return a.category_name.localeCompare(b.category_name);
    });
}

export function createTicketCategoryData(payload) {
  const db = loadDb();
  
  // Validation: Total quota for an event cannot exceed venue capacity
  const event = db.event.find(e => e.event_id === payload.tevent_id);
  if (!event) return { ok: false, message: 'Event tidak ditemukan.' };
  
  const venue = db.venue.find(v => v.venue_id === event.venue_id);
  if (!venue) return { ok: false, message: 'Venue tidak ditemukan.' };
  
  const existingQuota = db.ticket_category
    .filter(c => c.tevent_id === payload.tevent_id)
    .reduce((sum, c) => sum + Number(c.quota), 0);
    
  if (existingQuota + Number(payload.quota) > venue.capacity) {
    return { 
      ok: false, 
      message: `Total kuota (${existingQuota + Number(payload.quota)}) melebihi kapasitas venue ${venue.venue_name} (${venue.capacity}).` 
    };
  }

  const newCategory = {
    category_id: `cat_${Date.now()}`,
    category_name: payload.category_name,
    quota: Number(payload.quota),
    price: Number(payload.price),
    tevent_id: payload.tevent_id,
  };
  
  db.ticket_category.push(newCategory);
  saveDb(db);
  return { ok: true, data: newCategory };
}

export function updateTicketCategoryData(id, payload) {
  const db = loadDb();
  const index = db.ticket_category.findIndex((c) => c.category_id === id);
  if (index === -1) return { ok: false, message: 'Kategori tiket tidak ditemukan.' };

  const cat = db.ticket_category[index];
  
  // If quota is being updated, validate against venue capacity
  if (payload.quota !== undefined) {
    const event = db.event.find(e => e.event_id === cat.tevent_id);
    const venue = db.venue.find(v => v.venue_id === event.venue_id);
    
    const otherQuota = db.ticket_category
      .filter(c => c.tevent_id === cat.tevent_id && c.category_id !== id)
      .reduce((sum, c) => sum + Number(c.quota), 0);
      
    if (otherQuota + Number(payload.quota) > venue.capacity) {
      return { 
        ok: false, 
        message: `Total kuota (${otherQuota + Number(payload.quota)}) melebihi kapasitas venue ${venue.venue_name} (${venue.capacity}).` 
      };
    }
  }

  db.ticket_category[index] = { ...cat, ...payload };
  saveDb(db);
  return { ok: true, data: db.ticket_category[index] };
}

export function deleteTicketCategoryData(id) {
  const db = loadDb();
  // Check if there are tickets using this category
  if (db.ticket.some(t => t.tcategory_id === id)) {
    return { ok: false, message: 'Kategori tidak bisa dihapus karena sudah ada tiket yang terbit.' };
  }
  
  db.ticket_category = db.ticket_category.filter((c) => c.category_id !== id);
  saveDb(db);
  return { ok: true, message: 'Kategori tiket berhasil dihapus.' };
}

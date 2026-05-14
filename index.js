import express from 'express';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import { query } from './server/db.js';

dotenv.config();

const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : true,
}));
app.use(express.json());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

// helper: check if a column exists in a table (schema, table, column)
async function columnExists(schema, table, column) {
  try {
    const relation = `${String(schema).toLowerCase()}.${String(table).toLowerCase()}`;
    const r = await query(
      `
        SELECT 1
        FROM pg_attribute
        WHERE attrelid = to_regclass($1)
          AND attname = $2
          AND NOT attisdropped
        LIMIT 1
      `,
      [relation, String(column).toLowerCase()]
    );
    return r.rowCount > 0;
  } catch (_err) {
    return false;
  }
}

async function tableExists(schema, table) {
  try {
    const r = await query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2 LIMIT 1`,
      [schema.toLowerCase(), table.toLowerCase()]
    );
    return r.rowCount > 0;
  } catch (_err) {
    return false;
  }
}

async function getUserRoles(userId) {
  const rolesRes = await query(
    'SELECT r.role_name FROM TIKTAKTUK.ROLE r JOIN TIKTAKTUK.ACCOUNT_ROLE ar ON ar.role_id = r.role_id WHERE ar.user_id = $1',
    [userId]
  );
  return rolesRes.rows.map((row) => row.role_name.toLowerCase());
}

async function getUserByUsername(username) {
  const result = await query('SELECT user_id, username, password FROM TIKTAKTUK.USER_ACCOUNT WHERE LOWER(username)=LOWER($1)', [username]);
  return result.rowCount > 0 ? result.rows[0] : null;
}

async function getUserById(userId) {
  const result = await query('SELECT user_id, username FROM TIKTAKTUK.USER_ACCOUNT WHERE user_id = $1', [userId]);
  return result.rowCount > 0 ? result.rows[0] : null;
}

async function resolveOrganizerId(inputId) {
  if (!inputId) return null;

  const direct = await query('SELECT organizer_id FROM TIKTAKTUK.ORGANIZER WHERE organizer_id = $1', [inputId]);
  if (direct.rowCount > 0) return direct.rows[0].organizer_id;

  const byUser = await query('SELECT organizer_id FROM TIKTAKTUK.ORGANIZER WHERE user_id = $1', [inputId]);
  if (byUser.rowCount > 0) return byUser.rows[0].organizer_id;

  return null;
}

function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

async function syncEventArtists(eventId, artists) {
  const artistsTableExists = await tableExists('TIKTAKTUK', 'ARTIST');
  const eventArtistTableExists = await tableExists('TIKTAKTUK', 'EVENT_ARTIST');

  if (!artistsTableExists || !eventArtistTableExists || !eventId) return;

  await query('DELETE FROM TIKTAKTUK.EVENT_ARTIST WHERE event_id = $1', [eventId]);

  const candidateIds = [...new Set((Array.isArray(artists) ? artists : [])
    .map((artistId) => String(artistId || '').trim())
    .filter((artistId) => isUuidLike(artistId)))];

  if (candidateIds.length === 0) return;

  const validArtists = await query(
    'SELECT artist_id::text AS artist_id FROM TIKTAKTUK.ARTIST WHERE artist_id::text = ANY($1::text[])',
    [candidateIds]
  );

  for (const row of validArtists.rows) {
    await query(
      'INSERT INTO TIKTAKTUK.EVENT_ARTIST (event_id, artist_id, role) VALUES ($1,$2,$3) ON CONFLICT (event_id, artist_id) DO UPDATE SET role = EXCLUDED.role',
      [eventId, row.artist_id, 'Performer']
    );
  }
}

async function persistCustomerProfile(userId, body) {
  const { full_name, phone_number } = body;
  await query(
    'INSERT INTO TIKTAKTUK.CUSTOMER (user_id, full_name, phone_number) VALUES ($1,$2,$3) ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name, phone_number = EXCLUDED.phone_number',
    [userId, full_name || '', phone_number || '']
  );
}

async function persistOrganizerProfile(userId, body) {
  const { organizer_name, contact_email } = body;
  const hasContactEmail = await columnExists('TIKTAKTUK', 'ORGANIZER', 'contact_email');
  if (hasContactEmail) {
    await query(
      'INSERT INTO TIKTAKTUK.ORGANIZER (user_id, organizer_name, contact_email) VALUES ($1,$2,$3) ON CONFLICT (user_id) DO UPDATE SET organizer_name = EXCLUDED.organizer_name, contact_email = EXCLUDED.contact_email',
      [userId, organizer_name || '', contact_email || '']
    );
    return;
  }

  await query(
    'INSERT INTO TIKTAKTUK.ORGANIZER (user_id, organizer_name) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET organizer_name = EXCLUDED.organizer_name',
    [userId, organizer_name || '']
  );
}

function ensureRole(roles, expectedRole) {
  return roles.includes(expectedRole);
}

app.get('/api/health', async (req, res) => {
  try {
    const result = await query('SELECT NOW()');
    res.json({ status: 'success', message: 'Koneksi ke database OK', db_time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Gagal konek ke database', error: err.message });
  }
});

// Register user
async function registerAccount(req, res, roleOverride) {
  const { username, password } = req.body;
  const role = roleOverride || req.body.role;

  if (!username || !password || !role) return res.status(400).json({ error: 'Missing fields' });

  if (!/^[A-Za-z0-9]+$/.test(username)) {
    return res.status(400).json({ error: `ERROR: Username "${username}" hanya boleh mengandung huruf dan angka tanpa simbol atau spasi.` });
  }

  try {
    const exists = await query('SELECT user_id FROM TIKTAKTUK.USER_ACCOUNT WHERE LOWER(username) = LOWER($1)', [username]);
    if (exists.rowCount > 0) {
      return res.status(400).json({ error: `ERROR: Username "${username}" sudah terdaftar, gunakan username lain.` });
    }

    const hashed = await bcrypt.hash(password, 10);
    const insert = await query('INSERT INTO TIKTAKTUK.USER_ACCOUNT (username, password) VALUES ($1, $2) RETURNING user_id, username', [username, hashed]);
    const user = insert.rows[0];

    const roleRes = await query('SELECT role_id FROM TIKTAKTUK.ROLE WHERE LOWER(role_name)=LOWER($1)', [role]);
    let roleId;
    if (roleRes.rowCount === 0) {
      const newRole = await query('INSERT INTO TIKTAKTUK.ROLE (role_name) VALUES ($1) RETURNING role_id', [role]);
      roleId = newRole.rows[0].role_id;
    } else {
      roleId = roleRes.rows[0].role_id;
    }

    await query('INSERT INTO TIKTAKTUK.ACCOUNT_ROLE (role_id, user_id) VALUES ($1, $2)', [roleId, user.user_id]);

    if (role.toLowerCase() === 'customer') {
      const { full_name, phone_number } = req.body;
      if (full_name) {
        await query(
          'INSERT INTO TIKTAKTUK.CUSTOMER (full_name, phone_number, user_id) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name, phone_number = EXCLUDED.phone_number',
          [full_name, phone_number || '', user.user_id]
        );
      }
    }

    if (role.toLowerCase() === 'organizer') {
      const { organizer_name, contact_email } = req.body;
      if (organizer_name) {
        const hasContactEmail = await columnExists('TIKTAKTUK', 'ORGANIZER', 'contact_email');
        if (hasContactEmail) {
          await query(
            'INSERT INTO TIKTAKTUK.ORGANIZER (organizer_name, contact_email, user_id) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET organizer_name = EXCLUDED.organizer_name, contact_email = EXCLUDED.contact_email',
            [organizer_name, contact_email || '', user.user_id]
          );
        } else {
          await query(
            'INSERT INTO TIKTAKTUK.ORGANIZER (organizer_name, user_id) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET organizer_name = EXCLUDED.organizer_name',
            [organizer_name, user.user_id]
          );
        }
      }
    }

    res.status(201).json({ message: 'Registrasi berhasil', user: { user_id: user.user_id, username: user.username } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

app.post('/api/auth/register', async (req, res) => registerAccount(req, res));
app.post('/api/auth/register/customer', async (req, res) => registerAccount(req, res, 'customer'));
app.post('/api/auth/register/organizer', async (req, res) => registerAccount(req, res, 'organizer'));
app.post('/api/auth/register/admin', async (req, res) => registerAccount(req, res, 'admin'));

app.get('/api/dashboard/customer', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const userResult = await query(
      'SELECT u.username, c.full_name FROM TIKTAKTUK.USER_ACCOUNT u LEFT JOIN TIKTAKTUK.CUSTOMER c ON c.user_id = u.user_id WHERE u.user_id = $1',
      [userId]
    );
    if (userResult.rowCount === 0) return res.status(404).json({ error: 'User not found' });

    const customer = userResult.rows[0];
    res.json({
      data: {
        nama: customer.full_name || customer.username,
        stats: {
          tiket_aktif: 0,
          acara_diikuti: 0,
          promo_tersedia: 0,
          total_belanja_bulan_ini: 'Rp 0',
        },
        upcoming_tickets: [],
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/dashboard/organizer', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const userResult = await query(
      'SELECT u.username, o.organizer_name FROM TIKTAKTUK.USER_ACCOUNT u LEFT JOIN TIKTAKTUK.ORGANIZER o ON o.user_id = u.user_id WHERE u.user_id = $1',
      [userId]
    );
    if (userResult.rowCount === 0) return res.status(404).json({ error: 'User not found' });

    const organizerName = userResult.rows[0].organizer_name || userResult.rows[0].username;
    res.json({
      data: {
        ringkasan: {
          acara_aktif: 0,
          tiket_terjual: 0,
          revenue_bulan_ini: 'Rp 0',
          venue_mitra: 0,
        },
        top_acara: [],
        organizer_name: organizerName,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/dashboard/admin', async (req, res) => {
  try {
    const users = await query('SELECT COUNT(*)::int AS total FROM TIKTAKTUK.USER_ACCOUNT');
    const events = await query('SELECT COUNT(*)::int AS total FROM TIKTAKTUK.EVENT');
    const venues = await query('SELECT COUNT(*)::int AS total FROM TIKTAKTUK.VENUE');
    const promos = await query('SELECT COUNT(*)::int AS total FROM TIKTAKTUK.PROMOTION');
    
    // Get reserved seating venues count
    const reservedSeatingRes = await query(
      "SELECT COUNT(*)::int AS total FROM TIKTAKTUK.VENUE WHERE jenis_seating = 'RESERVED_SEATING'"
    );
    
    // Get venue with largest capacity
    const largestVenueRes = await query(
      'SELECT venue_name FROM TIKTAKTUK.VENUE ORDER BY capacity DESC LIMIT 1'
    );

    res.json({
      data: {
        platform: {
          total_pengguna: String(users.rows[0]?.total || 0),
          total_acara_bulan_ini: String(events.rows[0]?.total || 0),
          omzet_platform: 'Rp 0',
          promosi_aktif: String(promos.rows[0]?.total || 0),
        },
        infrastruktur_venue: {
          total_venue: venues.rows[0]?.total || 0,
          reserved_seating: reservedSeatingRes.rows[0]?.total || 0,
          kapasitas_terbesar: largestVenueRes.rows[0]?.venue_name || '-',
        },
        marketing_promosi: {
          promo_persentase: 0,
          promo_nominal: 0,
          total_penggunaan: '0 kali',
        },
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

  try {
    const result = await query('SELECT user_id, username, password FROM TIKTAKTUK.USER_ACCOUNT WHERE LOWER(username)=LOWER($1)', [username]);
    if (result.rowCount === 0) return res.status(400).json({ error: 'Invalid credentials' });

    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });

    const rolesRes = await query('SELECT r.role_name FROM TIKTAKTUK.ROLE r JOIN TIKTAKTUK.ACCOUNT_ROLE ar ON ar.role_id = r.role_id WHERE ar.user_id = $1', [user.user_id]);
    const roles = rolesRes.rows.map(r => r.role_name);

    const token = jwt.sign({ user_id: user.user_id, username: user.username, roles }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user: { user_id: user.user_id, username: user.username, roles } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function loginForRole(req, res, expectedRole) {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

  try {
    const user = await getUserByUsername(username);
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });

    const roles = await getUserRoles(user.user_id);
    if (!ensureRole(roles, expectedRole)) {
      return res.status(403).json({ error: `Account is not a ${expectedRole}` });
    }

    const token = jwt.sign({ user_id: user.user_id, username: user.username, roles }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user: { user_id: user.user_id, username: user.username, roles } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

app.post('/api/auth/login/customer', async (req, res) => loginForRole(req, res, 'customer'));
app.post('/api/auth/login/organizer', async (req, res) => loginForRole(req, res, 'organizer'));
app.post('/api/auth/login/admin', async (req, res) => loginForRole(req, res, 'admin'));

// Get user by id
app.get('/api/users/:id', async (req, res) => {
  try {
    const u = await query('SELECT user_id, username FROM TIKTAKTUK.USER_ACCOUNT WHERE user_id = $1', [req.params.id]);
    if (u.rowCount === 0) return res.status(404).json({ error: 'User not found' });
    const rolesRes = await query('SELECT r.role_name FROM TIKTAKTUK.ROLE r JOIN TIKTAKTUK.ACCOUNT_ROLE ar ON ar.role_id = r.role_id WHERE ar.user_id = $1', [req.params.id]);
    res.json({ user: u.rows[0], roles: rolesRes.rows.map(r => r.role_name) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Profile endpoints (combine user + customer/organizer data)
app.get('/api/profile', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const u = await query('SELECT user_id, username, password FROM TIKTAKTUK.USER_ACCOUNT WHERE user_id = $1', [userId]);
    if (u.rowCount === 0) return res.status(404).json({ error: 'User not found' });

    const rolesRes = await query('SELECT r.role_name FROM TIKTAKTUK.ROLE r JOIN TIKTAKTUK.ACCOUNT_ROLE ar ON ar.role_id = r.role_id WHERE ar.user_id = $1', [userId]);
    const roles = rolesRes.rows.map(r => r.role_name);

    // determine role and only fetch relevant rows to avoid touching organizer columns for customers
    const normalizedRoles = roles.map(r => r.toLowerCase());
    const isCustomer = normalizedRoles.includes('customer');
    const isOrganizer = normalizedRoles.includes('organizer');

    let profile = {
      user_id: u.rows[0].user_id,
      username: u.rows[0].username,
      roles,
      role: normalizedRoles[0] || 'customer',
    };

    if (isCustomer) {
      const cust = await query('SELECT customer_id, full_name, phone_number FROM TIKTAKTUK.CUSTOMER WHERE user_id = $1', [userId]);
      profile = {
        ...profile,
        full_name: cust.rowCount > 0 ? cust.rows[0].full_name : null,
        phone_number: cust.rowCount > 0 ? cust.rows[0].phone_number : null,
      };
    }

    if (isOrganizer) {
      const hasContactEmail = await columnExists('TIKTAKTUK', 'ORGANIZER', 'contact_email');
      const org = hasContactEmail
        ? await query('SELECT organizer_id, organizer_name, contact_email FROM TIKTAKTUK.ORGANIZER WHERE user_id = $1', [userId])
        : await query('SELECT organizer_id, organizer_name FROM TIKTAKTUK.ORGANIZER WHERE user_id = $1', [userId]);
      profile = {
        ...profile,
        organizer_name: org.rowCount > 0 ? org.rows[0].organizer_name : null,
        contact_email: org.rowCount > 0 && hasContactEmail ? org.rows[0].contact_email : null,
      };
    }

    res.json({ data: profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/profile/update', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    // check roles and only update relevant tables
    const rolesRes = await query('SELECT r.role_name FROM TIKTAKTUK.ROLE r JOIN TIKTAKTUK.ACCOUNT_ROLE ar ON ar.role_id = r.role_id WHERE ar.user_id = $1', [userId]);
    const normalized = rolesRes.rows.map(r => r.role_name.toLowerCase());
    const updatingCustomer = normalized.includes('customer');
    const updatingOrganizer = normalized.includes('organizer');

    if (updatingCustomer) {
      const { full_name, phone_number } = req.body;
      await query(
        'INSERT INTO TIKTAKTUK.CUSTOMER (user_id, full_name, phone_number) VALUES ($1,$2,$3) ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name, phone_number = EXCLUDED.phone_number',
        [userId, full_name || '', phone_number || '']
      );
    }

    if (updatingOrganizer) {
      const { organizer_name, contact_email } = req.body;
      const hasContactEmail2 = await columnExists('TIKTAKTUK', 'ORGANIZER', 'contact_email');
      if (hasContactEmail2) {
        await query(
          'INSERT INTO TIKTAKTUK.ORGANIZER (user_id, organizer_name, contact_email) VALUES ($1,$2,$3) ON CONFLICT (user_id) DO UPDATE SET organizer_name = EXCLUDED.organizer_name, contact_email = EXCLUDED.contact_email',
          [userId, organizer_name || '', contact_email || '']
        );
      } else {
        await query(
          'INSERT INTO TIKTAKTUK.ORGANIZER (user_id, organizer_name) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET organizer_name = EXCLUDED.organizer_name',
          [userId, organizer_name || '']
        );
      }
    }

    // return updated profile
    const updated = await query('SELECT u.user_id, u.username FROM TIKTAKTUK.USER_ACCOUNT u WHERE u.user_id = $1', [userId]);
    const profile = { user_id: updated.rows[0].user_id, username: updated.rows[0].username };

    if (updatingCustomer) {
      const cust = await query('SELECT full_name, phone_number FROM TIKTAKTUK.CUSTOMER WHERE user_id = $1', [userId]);
      profile.full_name = cust.rowCount > 0 ? cust.rows[0].full_name : null;
      profile.phone_number = cust.rowCount > 0 ? cust.rows[0].phone_number : null;
    }

    if (updatingOrganizer) {
      const hasContactEmail3 = await columnExists('TIKTAKTUK', 'ORGANIZER', 'contact_email');
      const org = hasContactEmail3
        ? await query('SELECT organizer_name, contact_email FROM TIKTAKTUK.ORGANIZER WHERE user_id = $1', [userId])
        : await query('SELECT organizer_name FROM TIKTAKTUK.ORGANIZER WHERE user_id = $1', [userId]);
      profile.organizer_name = org.rowCount > 0 ? org.rows[0].organizer_name : null;
      profile.contact_email = org.rowCount > 0 && hasContactEmail3 ? org.rows[0].contact_email : null;
    }

    res.json({ data: profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/profile/change-password', async (req, res) => {
  const { userId } = req.query;
  const { oldPassword, newPassword } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Missing password fields' });

  try {
    const u = await query('SELECT user_id, password FROM TIKTAKTUK.USER_ACCOUNT WHERE user_id = $1', [userId]);
    if (u.rowCount === 0) return res.status(404).json({ error: 'User not found' });

    const ok = await bcrypt.compare(oldPassword, u.rows[0].password);
    if (!ok) return res.status(400).json({ error: 'Old password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await query('UPDATE TIKTAKTUK.USER_ACCOUNT SET password = $1 WHERE user_id = $2', [hashed, userId]);
    res.json({ message: 'Password berhasil diubah' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/profile/customer', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const roles = await getUserRoles(userId);
    if (!ensureRole(roles, 'customer')) return res.status(403).json({ error: 'Account is not a customer' });

    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const cust = await query('SELECT customer_id, full_name, phone_number FROM TIKTAKTUK.CUSTOMER WHERE user_id = $1', [userId]);
    return res.json({
      data: {
        user_id: user.user_id,
        username: user.username,
        role: 'customer',
        full_name: cust.rowCount > 0 ? cust.rows[0].full_name : null,
        phone_number: cust.rowCount > 0 ? cust.rows[0].phone_number : null,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/profile/organizer', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const roles = await getUserRoles(userId);
    if (!ensureRole(roles, 'organizer')) return res.status(403).json({ error: 'Account is not an organizer' });

    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const hasContactEmail = await columnExists('TIKTAKTUK', 'ORGANIZER', 'contact_email');
    const org = hasContactEmail
      ? await query('SELECT organizer_id, organizer_name, contact_email FROM TIKTAKTUK.ORGANIZER WHERE user_id = $1', [userId])
      : await query('SELECT organizer_id, organizer_name FROM TIKTAKTUK.ORGANIZER WHERE user_id = $1', [userId]);

    return res.json({
      data: {
        user_id: user.user_id,
        username: user.username,
        role: 'organizer',
        organizer_name: org.rowCount > 0 ? org.rows[0].organizer_name : null,
        contact_email: org.rowCount > 0 && hasContactEmail ? org.rows[0].contact_email : null,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/profile/admin', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const roles = await getUserRoles(userId);
    if (!ensureRole(roles, 'admin')) return res.status(403).json({ error: 'Account is not an admin' });

    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.json({
      data: {
        user_id: user.user_id,
        username: user.username,
        role: 'admin',
        roles,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/profile/customer/update', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const roles = await getUserRoles(userId);
    if (!ensureRole(roles, 'customer')) return res.status(403).json({ error: 'Account is not a customer' });
    await persistCustomerProfile(userId, req.body);
    const user = await getUserById(userId);
    const cust = await query('SELECT full_name, phone_number FROM TIKTAKTUK.CUSTOMER WHERE user_id = $1', [userId]);
    res.json({
      data: {
        user_id: user.user_id,
        username: user.username,
        role: 'customer',
        full_name: cust.rowCount > 0 ? cust.rows[0].full_name : null,
        phone_number: cust.rowCount > 0 ? cust.rows[0].phone_number : null,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/profile/organizer/update', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const roles = await getUserRoles(userId);
    if (!ensureRole(roles, 'organizer')) return res.status(403).json({ error: 'Account is not an organizer' });
    await persistOrganizerProfile(userId, req.body);
    const user = await getUserById(userId);
    const hasContactEmail = await columnExists('TIKTAKTUK', 'ORGANIZER', 'contact_email');
    const org = hasContactEmail
      ? await query('SELECT organizer_name, contact_email FROM TIKTAKTUK.ORGANIZER WHERE user_id = $1', [userId])
      : await query('SELECT organizer_name FROM TIKTAKTUK.ORGANIZER WHERE user_id = $1', [userId]);
    res.json({
      data: {
        user_id: user.user_id,
        username: user.username,
        role: 'organizer',
        organizer_name: org.rowCount > 0 ? org.rows[0].organizer_name : null,
        contact_email: org.rowCount > 0 && hasContactEmail ? org.rows[0].contact_email : null,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/profile/admin/change-password', async (req, res) => {
  const { userId } = req.query;
  const { oldPassword, newPassword } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Missing password fields' });

  try {
    const roles = await getUserRoles(userId);
    if (!ensureRole(roles, 'admin')) return res.status(403).json({ error: 'Account is not an admin' });
    const u = await query('SELECT user_id, password FROM TIKTAKTUK.USER_ACCOUNT WHERE user_id = $1', [userId]);
    if (u.rowCount === 0) return res.status(404).json({ error: 'User not found' });
    const ok = await bcrypt.compare(oldPassword, u.rows[0].password);
    if (!ok) return res.status(400).json({ error: 'Old password is incorrect' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await query('UPDATE TIKTAKTUK.USER_ACCOUNT SET password = $1 WHERE user_id = $2', [hashed, userId]);
    res.json({ message: 'Password berhasil diubah' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// VENUE endpoints
app.get('/api/venues', async (req, res) => {
  try {
    const v = await query('SELECT * FROM TIKTAKTUK.VENUE ORDER BY venue_name');
    res.json({ venues: v.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/venues', async (req, res) => {
  const { venue_name, capacity, address, city, jenis_seating } = req.body;
  if (!venue_name || !city) return res.status(400).json({ error: 'Missing fields' });

  try {
    const dup = await query('SELECT venue_id FROM TIKTAKTUK.VENUE WHERE LOWER(venue_name)=LOWER($1) AND LOWER(city)=LOWER($2)', [venue_name, city]);
    if (dup.rowCount > 0) {
      const id = dup.rows[0].venue_id;
      return res.status(400).json({ error: `ERROR: Venue "${venue_name}" di kota "${city}" sudah terdaftar dengan ID ${id}.` });
    }

    const ins = await query('INSERT INTO TIKTAKTUK.VENUE (venue_name, capacity, address, city, jenis_seating) VALUES ($1,$2,$3,$4,$5) RETURNING *', [venue_name, capacity, address, city, jenis_seating]);
    res.status(201).json({ venue: ins.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/venues/:id', async (req, res) => {
  try {
    const v = await query('SELECT * FROM TIKTAKTUK.VENUE WHERE venue_id = $1', [req.params.id]);
    if (v.rowCount === 0) return res.status(404).json({ error: 'Venue not found' });
    res.json({ venue: v.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/venues/:id', async (req, res) => {
  try {
    const v = await query('SELECT venue_id, venue_name FROM TIKTAKTUK.VENUE WHERE venue_id = $1', [req.params.id]);
    if (v.rowCount === 0) return res.status(404).json({ error: 'Venue not found' });
    const venue = v.rows[0];

    const active = await query("SELECT 1 FROM TIKTAKTUK.EVENT WHERE venue_id = $1 AND event_datetime >= NOW() LIMIT 1", [req.params.id]);
    if (active.rowCount > 0) return res.status(400).json({ error: `ERROR: Venue "${venue.venue_name}" masih memiliki event aktif sehingga tidak dapat dihapus.` });

    await query('DELETE FROM TIKTAKTUK.VENUE WHERE venue_id = $1', [req.params.id]);
    res.json({ message: 'Venue deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// EVENT endpoints
app.get('/api/events', async (req, res) => {
  try {
    const descriptionExists = await columnExists('TIKTAKTUK', 'EVENT', 'description');
    const eventColumns = descriptionExists
      ? 'event_id, event_title, event_datetime, venue_id, organizer_id, description'
      : 'event_id, event_title, event_datetime, venue_id, organizer_id';
    const e = await query(`SELECT ${eventColumns} FROM TIKTAKTUK.EVENT ORDER BY event_datetime`);
    res.json({ events: e.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/events', async (req, res) => {
  const { event_title, event_datetime, venue_id, organizer_id, description, artists } = req.body;
  if (!event_title || !event_datetime || !venue_id || !organizer_id) return res.status(400).json({ error: 'Missing fields' });

  try {
    const v = await query('SELECT venue_id FROM TIKTAKTUK.VENUE WHERE venue_id = $1', [venue_id]);
    if (v.rowCount === 0) return res.status(400).json({ error: `Venue with id ${venue_id} not found` });

    const normalizedOrganizerId = await resolveOrganizerId(organizer_id);
    if (!normalizedOrganizerId) return res.status(400).json({ error: `Organizer with id ${organizer_id} not found` });

    const descriptionExists = await columnExists('TIKTAKTUK', 'EVENT', 'description');
    const ins = descriptionExists
      ? await query('INSERT INTO TIKTAKTUK.EVENT (event_title, event_datetime, venue_id, organizer_id, description) VALUES ($1,$2,$3,$4,$5) RETURNING *', [event_title, event_datetime, venue_id, normalizedOrganizerId, description || null])
      : await query('INSERT INTO TIKTAKTUK.EVENT (event_title, event_datetime, venue_id, organizer_id) VALUES ($1,$2,$3,$4) RETURNING *', [event_title, event_datetime, venue_id, normalizedOrganizerId]);

    await syncEventArtists(ins.rows[0]?.event_id, artists);
    res.status(201).json({ event: ins.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/events/management', async (req, res) => {
  try {
    const userRole = String(req.query.userRole || '').toLowerCase();
    const userId = req.query.userId;

    const venuesRes = await query(
      'SELECT venue_id, venue_name, city, jenis_seating FROM TIKTAKTUK.VENUE ORDER BY venue_name'
    );

    const descriptionExists = await columnExists('TIKTAKTUK', 'EVENT', 'description');
    const artistsTableExists = await tableExists('TIKTAKTUK', 'ARTIST');
    const eventArtistTableExists = await tableExists('TIKTAKTUK', 'EVENT_ARTIST');

    const artistsRes = artistsTableExists
      ? await query('SELECT artist_id, name, genre FROM TIKTAKTUK.ARTIST ORDER BY name')
      : { rows: [] };

    const eventDescriptionSelect = descriptionExists ? 'e.description,' : '';
    const eventDescriptionGroupBy = descriptionExists ? 'e.description,' : '';

    let eventFilterClause = '';
    let eventFilterParams = [];
    if (userRole === 'organizer') {
      const organizerId = await resolveOrganizerId(userId);
      if (!organizerId) {
        return res.json({
          venues: venuesRes.rows,
          artists: artistsRes.rows,
          events: [],
        });
      }
      eventFilterClause = 'WHERE e.organizer_id = $1';
      eventFilterParams = [organizerId];
    }

    const eventsRes = await query(
      eventArtistTableExists && artistsTableExists
        ? `
      SELECT
        e.event_id,
        e.event_title,
        e.event_datetime,
        ${eventDescriptionSelect}
        e.venue_id,
        v.venue_name,
        e.organizer_id,
        o.organizer_name,
        COALESCE(
          json_agg(
            json_build_object(
              'artist_id', a.artist_id,
              'name', a.name,
              'role', ea.role
            )
          ) FILTER (WHERE a.artist_id IS NOT NULL),
          '[]'::json
        ) AS artists
      FROM TIKTAKTUK.EVENT e
      LEFT JOIN TIKTAKTUK.VENUE v ON v.venue_id = e.venue_id
      LEFT JOIN TIKTAKTUK.ORGANIZER o ON o.organizer_id = e.organizer_id
      LEFT JOIN TIKTAKTUK.EVENT_ARTIST ea ON ea.event_id = e.event_id
      LEFT JOIN TIKTAKTUK.ARTIST a ON a.artist_id = ea.artist_id
      ${eventFilterClause}
      GROUP BY e.event_id, e.event_title, e.event_datetime, ${eventDescriptionGroupBy} e.venue_id, v.venue_name, e.organizer_id, o.organizer_name
      ORDER BY e.event_datetime
    `
        : `
      SELECT
        e.event_id,
        e.event_title,
        e.event_datetime,
        ${eventDescriptionSelect}
        e.venue_id,
        v.venue_name,
        e.organizer_id,
        o.organizer_name,
        '[]'::json AS artists
      FROM TIKTAKTUK.EVENT e
      LEFT JOIN TIKTAKTUK.VENUE v ON v.venue_id = e.venue_id
      LEFT JOIN TIKTAKTUK.ORGANIZER o ON o.organizer_id = e.organizer_id
      ${eventFilterClause}
      ORDER BY e.event_datetime
    `
      ,
      eventFilterParams
    );

    res.json({
      venues: venuesRes.rows,
      artists: artistsRes.rows,
      events: eventsRes.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/events/:id', async (req, res) => {
  try {
    const descriptionExists = await columnExists('TIKTAKTUK', 'EVENT', 'description');
    const eventColumns = descriptionExists
      ? 'event_id, event_title, event_datetime, venue_id, organizer_id, description'
      : 'event_id, event_title, event_datetime, venue_id, organizer_id';
    const e = await query(`SELECT ${eventColumns} FROM TIKTAKTUK.EVENT WHERE event_id = $1`, [req.params.id]);
    if (e.rowCount === 0) return res.status(404).json({ error: 'Event not found' });
    res.json({ event: e.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/events/:id', async (req, res) => {
  const { event_title, event_datetime, venue_id, organizer_id, description, artists } = req.body;
  if (!event_title || !event_datetime || !venue_id) return res.status(400).json({ error: 'Missing required fields' });

  try {
    const e = await query('SELECT event_id FROM TIKTAKTUK.EVENT WHERE event_id = $1', [req.params.id]);
    if (e.rowCount === 0) return res.status(404).json({ error: 'Event not found' });

    const v = await query('SELECT venue_id FROM TIKTAKTUK.VENUE WHERE venue_id = $1', [venue_id]);
    if (v.rowCount === 0) return res.status(400).json({ error: `Venue with id ${venue_id} not found` });

    const normalizedOrganizerId = await resolveOrganizerId(organizer_id);
    if (!normalizedOrganizerId) return res.status(400).json({ error: `Organizer with id ${organizer_id} not found` });

    const descriptionExists = await columnExists('TIKTAKTUK', 'EVENT', 'description');
    const upd = descriptionExists
      ? await query('UPDATE TIKTAKTUK.EVENT SET event_title = $1, event_datetime = $2, venue_id = $3, organizer_id = $4, description = $5 WHERE event_id = $6 RETURNING *', [event_title, event_datetime, venue_id, normalizedOrganizerId, description, req.params.id])
      : await query('UPDATE TIKTAKTUK.EVENT SET event_title = $1, event_datetime = $2, venue_id = $3, organizer_id = $4 WHERE event_id = $5 RETURNING *', [event_title, event_datetime, venue_id, normalizedOrganizerId, req.params.id]);

    await syncEventArtists(req.params.id, artists);
    res.json({ event: upd.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/events/:id', async (req, res) => {
  return res.status(405).json({ error: 'Deleting events is disabled' });
});

app.put('/api/venues/:id', async (req, res) => {
  const { venue_name, capacity, address, city, jenis_seating } = req.body;
  if (!venue_name || !city) return res.status(400).json({ error: 'Missing required fields' });

  try {
    const v = await query('SELECT venue_id FROM TIKTAKTUK.VENUE WHERE venue_id = $1', [req.params.id]);
    if (v.rowCount === 0) return res.status(404).json({ error: 'Venue not found' });

    const dup = await query('SELECT venue_id FROM TIKTAKTUK.VENUE WHERE LOWER(venue_name)=LOWER($1) AND LOWER(city)=LOWER($2) AND venue_id != $3', [venue_name, city, req.params.id]);
    if (dup.rowCount > 0) {
      return res.status(400).json({ error: `Venue "${venue_name}" di kota "${city}" sudah terdaftar.` });
    }

    const upd = await query('UPDATE TIKTAKTUK.VENUE SET venue_name = $1, capacity = $2, address = $3, city = $4, jenis_seating = $5 WHERE venue_id = $6 RETURNING *', [venue_name, capacity, address, city, jenis_seating, req.params.id]);
    res.json({ venue: upd.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── JWT Auth Middleware ─────────────────────────────────────────────────────
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ ok: false, message: 'Akses ditolak. Silakan login terlebih dahulu.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { user_id, username, roles }
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, message: 'Token tidak valid atau sudah kedaluwarsa.' });
  }
}

function requireAdmin(req, res, next) {
  const roles = (req.user.roles || []).map(r => r.toLowerCase());
  if (!roles.includes('admin')) {
    return res.status(403).json({ ok: false, message: 'Hanya Admin yang dapat melakukan aksi ini.' });
  }
  next();
}

// ─── ARTIST endpoints ────────────────────────────────────────────────────────

// READ — all logged-in users (Admin, Organizer, Customer) can view artist list
app.get('/api/artists', authenticateToken, async (req, res) => {
  try {
    const eventArtistExists = await tableExists('TIKTAKTUK', 'EVENT_ARTIST');

    const result = eventArtistExists
      ? await query(`
          SELECT a.artist_id, a.name, a.genre,
                 COUNT(ea.event_id)::int AS event_count
          FROM TIKTAKTUK.ARTIST a
          LEFT JOIN TIKTAKTUK.EVENT_ARTIST ea ON ea.artist_id = a.artist_id
          GROUP BY a.artist_id, a.name, a.genre
          ORDER BY a.name ASC
        `)
      : await query(`
          SELECT artist_id, name, genre, 0 AS event_count
          FROM TIKTAKTUK.ARTIST
          ORDER BY name ASC
        `);

    res.json({ ok: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// CREATE — Admin only
app.post('/api/artists', authenticateToken, requireAdmin, async (req, res) => {
  const payload = req.body.data || req.body;
  const name = (payload.name || '').trim();
  const genre = (payload.genre || '').trim() || null;

  if (!name) {
    return res.status(400).json({ ok: false, message: 'Nama artist wajib diisi.' });
  }

  if (name.length > 100) {
    return res.status(400).json({ ok: false, message: 'Nama artist maksimal 100 karakter.' });
  }

  if (genre && genre.length > 50) {
    return res.status(400).json({ ok: false, message: 'Genre maksimal 50 karakter.' });
  }

  try {
    const ins = await query(
      'INSERT INTO TIKTAKTUK.ARTIST (name, genre) VALUES ($1, $2) RETURNING artist_id, name, genre',
      [name, genre]
    );
    res.status(201).json({ ok: true, data: ins.rows[0], message: 'Artis berhasil ditambahkan.' });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// UPDATE — Admin only
app.put('/api/artists/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const payload = req.body.data || req.body;
  const name = (payload.name || '').trim();
  const genre = (payload.genre || '').trim() || null;

  if (!name) {
    return res.status(400).json({ ok: false, message: 'Nama artist wajib diisi.' });
  }

  if (name.length > 100) {
    return res.status(400).json({ ok: false, message: 'Nama artist maksimal 100 karakter.' });
  }

  if (genre && genre.length > 50) {
    return res.status(400).json({ ok: false, message: 'Genre maksimal 50 karakter.' });
  }

  try {
    const existing = await query('SELECT artist_id FROM TIKTAKTUK.ARTIST WHERE artist_id = $1', [id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ ok: false, message: 'Artis tidak ditemukan.' });
    }

    const upd = await query(
      'UPDATE TIKTAKTUK.ARTIST SET name = $1, genre = $2 WHERE artist_id = $3 RETURNING artist_id, name, genre',
      [name, genre, id]
    );
    res.json({ ok: true, data: upd.rows[0], message: 'Artis berhasil diperbarui.' });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// DELETE — Admin only
app.delete('/api/artists/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await query('SELECT artist_id, name FROM TIKTAKTUK.ARTIST WHERE artist_id = $1', [id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ ok: false, message: 'Artis tidak ditemukan.' });
    }

    await query('DELETE FROM TIKTAKTUK.ARTIST WHERE artist_id = $1', [id]);
    res.json({ ok: true, message: `Artis "${existing.rows[0].name}" berhasil dihapus.` });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

app.listen(PORT, () => console.log(`Server TikTakTuk berjalan di port ${PORT}`));
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

// helper: format a Date or ISO string to YYYY-MM-DD
function toDateString(value) {
  if (!value) return '';
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(value);
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : str;
}

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

// ===================== TICKET QUOTA (Stored Procedure) =====================
app.get('/api/events/:id/ticket-quota', async (req, res) => {
  try {
    const result = await query('SELECT * FROM TIKTAKTUK.get_ticket_quota($1)', [req.params.id]);
    res.json({ categories: result.rows });
  } catch (err) {
    // Forward the stored procedure error message directly
    const msg = err.message || '';
    const match = msg.match(/ERROR:\s*(.*)/);
    const errorMessage = match ? match[1].trim() : msg;
    res.status(400).json({ error: errorMessage });
  }
});

// ===================== CHECKOUT DATA =====================
app.get('/api/checkout/:eventId', async (req, res) => {
  try {
    const eventId = req.params.eventId;

    // Fetch event
    const descriptionExists = await columnExists('TIKTAKTUK', 'EVENT', 'description');
    const eventColumns = descriptionExists
      ? 'event_id, event_title, event_datetime, venue_id, organizer_id, description'
      : 'event_id, event_title, event_datetime, venue_id, organizer_id';
    const eventRes = await query(`SELECT ${eventColumns} FROM TIKTAKTUK.EVENT WHERE event_id = $1`, [eventId]);
    if (eventRes.rowCount === 0) return res.status(404).json({ error: 'Event tidak ditemukan.' });

    const event = eventRes.rows[0];

    // Fetch venue
    const venueRes = await query('SELECT * FROM TIKTAKTUK.VENUE WHERE venue_id = $1', [event.venue_id]);
    const venue = venueRes.rowCount > 0 ? venueRes.rows[0] : null;
    const seatingType = (venue?.jenis_seating || 'FREE_SEATING').toUpperCase();

    // Fetch ticket categories with remaining quota via stored procedure
    let categories = [];
    try {
      const quotaRes = await query('SELECT * FROM TIKTAKTUK.get_ticket_quota($1)', [eventId]);
      categories = quotaRes.rows.map(row => ({
        id: row.category_id,
        name: row.category_name,
        quota: Number(row.quota),
        sold: Number(row.sold),
        remaining: Number(row.remaining),
        price: Number(row.price),
      }));
    } catch (_err) {
      // fallback: fetch categories without quota info
      const catRes = await query('SELECT * FROM TIKTAKTUK.TICKET_CATEGORY WHERE tevent_id = $1 ORDER BY price', [eventId]);
      categories = catRes.rows.map(row => ({
        id: row.category_id,
        name: row.category_name,
        quota: Number(row.quota),
        sold: 0,
        remaining: Number(row.quota),
        price: Number(row.price),
      }));
    }

    // Fetch seats if reserved seating
    let seats = [];
    if (seatingType === 'RESERVED_SEATING') {
      const seatRes = await query('SELECT * FROM TIKTAKTUK.SEAT WHERE venue_id = $1 ORDER BY seat_number', [event.venue_id]);
      // Get used seat IDs
      const usedRes = await query(
        `SELECT hr.ticket_id, s.seat_id FROM TIKTAKTUK.HAS_RELATIONSHIP hr
         JOIN TIKTAKTUK.SEAT s ON s.seat_id::text = hr.customer_id::text
         WHERE s.venue_id = $1`,
        [event.venue_id]
      );
      const usedSeatIds = new Set(usedRes.rows.map(r => r.seat_id));

      seats = seatRes.rows.map(seat => ({
        seatId: seat.seat_id,
        label: seat.seat_number,
        section: seat.zone,
        seatNumber: seat.seat_number,
        isAvailable: !usedSeatIds.has(seat.seat_id),
      }));
    }

    res.json({
      ok: true,
      event: {
        id: event.event_id,
        title: event.event_title,
        datetime: event.event_datetime,
        venueId: event.venue_id,
        venueName: venue?.venue_name || '-',
        seatingType,
      },
      categories,
      seats,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===================== VALIDATE PROMO CODE =====================
app.post('/api/orders/validate-promo', async (req, res) => {
  try {
    const { promoCode } = req.body;
    if (!promoCode) return res.status(400).json({ error: 'Kode promo wajib diisi.' });

    const code = promoCode.trim().toUpperCase();

    const promoRes = await query('SELECT * FROM TIKTAKTUK.PROMOTION WHERE UPPER(promo_code) = $1', [code]);
    if (promoRes.rowCount === 0) return res.status(400).json({ error: 'Kode promo tidak valid.' });

    const promotion = promoRes.rows[0];

    // Check date validity
    const now = new Date();
    const start = new Date(promotion.start_date);
    const end = new Date(promotion.end_date);
    end.setHours(23, 59, 59, 999);

    if (now < start || now > end) {
      return res.status(400).json({ error: 'Promo tidak berlaku pada tanggal ini.' });
    }

    // Check usage limit
    const usageRes = await query(
      'SELECT COUNT(*)::int AS used FROM TIKTAKTUK.ORDER_PROMOTION WHERE promotion_id = $1',
      [promotion.promotion_id]
    );
    const usedCount = usageRes.rows[0]?.used || 0;
    const remaining = Math.max(0, Number(promotion.usage_limit) - usedCount);

    if (remaining <= 0) {
      return res.status(400).json({ error: 'Kuota promo sudah habis.' });
    }

    res.json({
      ok: true,
      promotion: {
        promotionId: promotion.promotion_id,
        promoCode: promotion.promo_code,
        discountType: promotion.discount_type,
        discountValue: Number(promotion.discount_value),
        startDate: toDateString(promotion.start_date),
        endDate: toDateString(promotion.end_date),
        usageLimit: Number(promotion.usage_limit),
        usedCount,
        remaining,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===================== ORDER ENDPOINTS =====================
// GET /api/orders - Fetch orders (role-filtered)
app.get('/api/orders', async (req, res) => {
  try {
    const { userRole, userId } = req.query;
    const role = String(userRole || '').toLowerCase();

    let filterClause = '';
    let filterParams = [];

    if (role === 'customer') {
      // Get customer_id from user_id
      const custRes = await query('SELECT customer_id FROM TIKTAKTUK.CUSTOMER WHERE user_id = $1', [userId]);
      if (custRes.rowCount === 0) return res.json({ orders: [] });
      filterClause = 'WHERE o.customer_id = $1';
      filterParams = [custRes.rows[0].customer_id];
    } else if (role === 'organizer') {
      const orgRes = await query('SELECT organizer_id FROM TIKTAKTUK.ORGANIZER WHERE user_id = $1', [userId]);
      if (orgRes.rowCount === 0) return res.json({ orders: [] });
      filterClause = `WHERE o.event_id IN (SELECT event_id FROM TIKTAKTUK.EVENT WHERE organizer_id = $1)`;
      filterParams = [orgRes.rows[0].organizer_id];
    }
    // admin: no filter

    const ordersRes = await query(
      `SELECT o.order_id, o.order_date, o.payment_status, o.total_amount, o.customer_id, o.event_id,
              c.full_name AS customer_name,
              e.event_title
       FROM TIKTAKTUK."ORDER" o
       LEFT JOIN TIKTAKTUK.CUSTOMER c ON c.customer_id = o.customer_id
       LEFT JOIN TIKTAKTUK.EVENT e ON e.event_id = o.event_id
       ${filterClause}
       ORDER BY o.order_date DESC`,
      filterParams
    );

    const orders = ordersRes.rows.map(row => ({
      id: row.order_id,
      orderId: row.order_id,
      orderDate: row.order_date,
      paymentStatus: (row.payment_status || '').toUpperCase(),
      totalAmount: Number(row.total_amount) || 0,
      customerId: row.customer_id,
      customerName: row.customer_name || '-',
      eventTitle: row.event_title || '-',
    }));

    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/orders - Create order
app.post('/api/orders', async (req, res) => {
  try {
    const { eventId, categoryId, quantity, seatIds, promoCode, userId } = req.body;

    if (!eventId) return res.status(400).json({ error: 'Event wajib dipilih.' });
    if (!categoryId) return res.status(400).json({ error: 'Kategori tiket wajib dipilih.' });

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Jumlah tiket wajib bilangan bulat positif.' });
    }
    if (qty > 10) {
      return res.status(400).json({ error: 'Maksimal 10 tiket per transaksi.' });
    }

    // Verify customer
    const custRes = await query('SELECT customer_id FROM TIKTAKTUK.CUSTOMER WHERE user_id = $1', [userId]);
    if (custRes.rowCount === 0) {
      return res.status(400).json({ error: 'Customer tidak ditemukan. Silakan login ulang.' });
    }
    const customerId = custRes.rows[0].customer_id;

    // Verify event
    const eventRes = await query('SELECT event_id FROM TIKTAKTUK.EVENT WHERE event_id = $1', [eventId]);
    if (eventRes.rowCount === 0) {
      return res.status(400).json({ error: 'Event tidak ditemukan.' });
    }

    // Verify category belongs to event
    const catRes = await query(
      'SELECT category_id, price, quota FROM TIKTAKTUK.TICKET_CATEGORY WHERE category_id = $1 AND tevent_id = $2',
      [categoryId, eventId]
    );
    if (catRes.rowCount === 0) {
      return res.status(400).json({ error: 'Kategori tiket tidak valid untuk event ini.' });
    }

    const category = catRes.rows[0];
    const unitPrice = Number(category.price);

    // Check quota using stored procedure
    try {
      const quotaRes = await query('SELECT * FROM TIKTAKTUK.get_ticket_quota($1)', [eventId]);
      const catQuota = quotaRes.rows.find(r => r.category_id === categoryId);
      if (catQuota && Number(catQuota.remaining) < qty) {
        return res.status(400).json({ error: `Sisa kuota kategori "${catQuota.category_name}" tidak mencukupi (sisa: ${catQuota.remaining}).` });
      }
    } catch (quotaErr) {
      const msg = quotaErr.message || '';
      const match = msg.match(/ERROR:\s*(.*)/);
      return res.status(400).json({ error: match ? match[1].trim() : msg });
    }

    // Calculate total
    let subtotal = unitPrice * qty;
    let promotionId = null;

    // Validate and apply promo code
    if (promoCode) {
      const code = promoCode.trim().toUpperCase();
      const promoRes = await query('SELECT * FROM TIKTAKTUK.PROMOTION WHERE UPPER(promo_code) = $1', [code]);
      if (promoRes.rowCount === 0) {
        return res.status(400).json({ error: 'Kode promo tidak valid.' });
      }

      const promotion = promoRes.rows[0];
      const now = new Date();
      const start = new Date(promotion.start_date);
      const end = new Date(promotion.end_date);
      end.setHours(23, 59, 59, 999);

      if (now < start || now > end) {
        return res.status(400).json({ error: 'Promo tidak berlaku pada tanggal ini.' });
      }

      const usageRes = await query(
        'SELECT COUNT(*)::int AS used FROM TIKTAKTUK.ORDER_PROMOTION WHERE promotion_id = $1',
        [promotion.promotion_id]
      );
      const usedCount = usageRes.rows[0]?.used || 0;
      if (usedCount >= Number(promotion.usage_limit)) {
        return res.status(400).json({ error: 'Kuota promo sudah habis.' });
      }

      // Calculate discount
      const discType = promotion.discount_type.toUpperCase();
      const discValue = Number(promotion.discount_value);
      let discount = 0;
      if (discType === 'PERCENTAGE') {
        discount = (subtotal * discValue) / 100;
      } else if (discType === 'NOMINAL') {
        discount = discValue;
      }
      discount = Math.min(subtotal, Math.max(0, discount));
      subtotal = Math.max(0, subtotal - discount);
      promotionId = promotion.promotion_id;
    }

    // Create order
    const orderRes = await query(
      `INSERT INTO TIKTAKTUK."ORDER" (order_date, payment_status, total_amount, customer_id, event_id)
       VALUES (NOW(), 'PENDING', $1, $2, $3)
       RETURNING order_id`,
      [subtotal, customerId, eventId]
    );
    const orderId = orderRes.rows[0].order_id;

    // Create tickets
    for (let i = 0; i < qty; i++) {
      const ticketCode = `TKT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      await query(
        `INSERT INTO TIKTAKTUK.TICKET (ticket_code, status, issued_at, order_id, category_id)
         VALUES ($1, 'ACTIVE', NOW(), $2, $3)`,
        [ticketCode, orderId, categoryId]
      );
    }

    // Link promo to order
    if (promotionId) {
      await query(
        'INSERT INTO TIKTAKTUK.ORDER_PROMOTION (promotion_id, order_id) VALUES ($1, $2)',
        [promotionId, orderId]
      );
    }

    res.status(201).json({ ok: true, orderId });
  } catch (err) {
    // Forward trigger error messages
    const msg = err.message || '';
    const match = msg.match(/ERROR:\s*(.*)/);
    const errorMessage = match ? match[1].trim() : msg;
    res.status(400).json({ error: errorMessage });
  }
});

// PUT /api/orders/:id - Update order payment status (Admin only)
app.put('/api/orders/:id', async (req, res) => {
  try {
    const { paymentStatus } = req.body;
    const validStatuses = ['PENDING', 'PAID', 'CANCELLED'];
    const normalized = (paymentStatus || '').toUpperCase();

    if (!validStatuses.includes(normalized)) {
      return res.status(400).json({ error: 'Payment status tidak valid.' });
    }

    const existing = await query('SELECT order_id FROM TIKTAKTUK."ORDER" WHERE order_id = $1', [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: 'Order tidak ditemukan.' });
    }

    await query('UPDATE TIKTAKTUK."ORDER" SET payment_status = $1 WHERE order_id = $2', [normalized, req.params.id]);
    res.json({ ok: true, message: 'Order berhasil diperbarui.' });
  } catch (err) {
    const msg = err.message || '';
    const match = msg.match(/ERROR:\s*(.*)/);
    res.status(400).json({ error: match ? match[1].trim() : msg });
  }
});

// DELETE /api/orders/:id - Delete order (Admin only)
app.delete('/api/orders/:id', async (req, res) => {
  try {
    const existing = await query('SELECT order_id FROM TIKTAKTUK."ORDER" WHERE order_id = $1', [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: 'Order tidak ditemukan.' });
    }

    await query('DELETE FROM TIKTAKTUK."ORDER" WHERE order_id = $1', [req.params.id]);
    res.json({ ok: true, message: 'Order berhasil dihapus.' });
  } catch (err) {
    const msg = err.message || '';
    const match = msg.match(/ERROR:\s*(.*)/);
    res.status(400).json({ error: match ? match[1].trim() : msg });
  }
});

// ===================== PROMOTION ENDPOINTS =====================
// GET /api/promotions - Fetch all promotions
app.get('/api/promotions', async (req, res) => {
  try {
    const promosRes = await query('SELECT * FROM TIKTAKTUK.PROMOTION ORDER BY promo_code');
    const orderPromosRes = await query('SELECT promotion_id, COUNT(*)::int AS used FROM TIKTAKTUK.ORDER_PROMOTION GROUP BY promotion_id');
    const usageMap = new Map(orderPromosRes.rows.map(r => [r.promotion_id, r.used]));

    const promotions = promosRes.rows.map(p => {
      const usageLimit = Number(p.usage_limit) || 0;
      const usedCount = usageMap.get(p.promotion_id) || 0;
      return {
        promotionId: p.promotion_id,
        promoCode: p.promo_code,
        discountType: p.discount_type,
        discountValue: Number(p.discount_value),
        startDate: toDateString(p.start_date),
        endDate: toDateString(p.end_date),
        usageLimit,
        usedCount,
        remaining: Math.max(0, usageLimit - usedCount),
      };
    });

    res.json({ promotions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/promotions - Create promotion (Admin only)
app.post('/api/promotions', async (req, res) => {
  try {
    const { promoCode, discountType, discountValue, startDate, endDate, usageLimit } = req.body;

    if (!promoCode) return res.status(400).json({ error: 'Kode promo wajib diisi.' });
    if (!discountType) return res.status(400).json({ error: 'Tipe diskon wajib dipilih.' });

    const discType = discountType.toUpperCase();
    if (discType !== 'PERCENTAGE' && discType !== 'NOMINAL') {
      return res.status(400).json({ error: 'Tipe diskon tidak valid.' });
    }

    const discVal = Number(discountValue);
    if (!(discVal > 0)) {
      return res.status(400).json({ error: 'Nilai diskon wajib berupa bilangan positif > 0.' });
    }

    if (!startDate) return res.status(400).json({ error: 'Tanggal mulai wajib diisi.' });
    if (!endDate) return res.status(400).json({ error: 'Tanggal berakhir wajib diisi.' });

    if (new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({ error: 'Tanggal berakhir harus sama atau setelah tanggal mulai.' });
    }

    const usageLim = Number(usageLimit);
    if (!Number.isInteger(usageLim) || usageLim <= 0) {
      return res.status(400).json({ error: 'Batas penggunaan wajib bilangan bulat positif > 0.' });
    }

    // Check unique promo code
    const dupRes = await query('SELECT promotion_id FROM TIKTAKTUK.PROMOTION WHERE UPPER(promo_code) = UPPER($1)', [promoCode]);
    if (dupRes.rowCount > 0) {
      return res.status(400).json({ error: 'Kode promo sudah digunakan (harus unik).' });
    }

    const insertRes = await query(
      `INSERT INTO TIKTAKTUK.PROMOTION (promo_code, discount_type, discount_value, start_date, end_date, usage_limit)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [promoCode.toUpperCase(), discType, discVal, startDate, endDate, usageLim]
    );

    res.status(201).json({ ok: true, promotion: insertRes.rows[0] });
  } catch (err) {
    const msg = err.message || '';
    const match = msg.match(/ERROR:\s*(.*)/);
    res.status(400).json({ error: match ? match[1].trim() : msg });
  }
});

// PUT /api/promotions/:id - Update promotion (Admin only)
app.put('/api/promotions/:id', async (req, res) => {
  try {
    const { promoCode, discountType, discountValue, startDate, endDate, usageLimit } = req.body;

    const existing = await query('SELECT promotion_id FROM TIKTAKTUK.PROMOTION WHERE promotion_id = $1', [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: 'Promo tidak ditemukan.' });
    }

    if (!promoCode) return res.status(400).json({ error: 'Kode promo wajib diisi.' });
    if (!discountType) return res.status(400).json({ error: 'Tipe diskon wajib dipilih.' });

    const discType = discountType.toUpperCase();
    if (discType !== 'PERCENTAGE' && discType !== 'NOMINAL') {
      return res.status(400).json({ error: 'Tipe diskon tidak valid.' });
    }

    const discVal = Number(discountValue);
    if (!(discVal > 0)) {
      return res.status(400).json({ error: 'Nilai diskon wajib berupa bilangan positif > 0.' });
    }

    if (!startDate) return res.status(400).json({ error: 'Tanggal mulai wajib diisi.' });
    if (!endDate) return res.status(400).json({ error: 'Tanggal berakhir wajib diisi.' });

    if (new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({ error: 'Tanggal berakhir harus sama atau setelah tanggal mulai.' });
    }

    const usageLim = Number(usageLimit);
    if (!Number.isInteger(usageLim) || usageLim <= 0) {
      return res.status(400).json({ error: 'Batas penggunaan wajib bilangan bulat positif > 0.' });
    }

    // Check unique promo code (excluding self)
    const dupRes = await query(
      'SELECT promotion_id FROM TIKTAKTUK.PROMOTION WHERE UPPER(promo_code) = UPPER($1) AND promotion_id != $2',
      [promoCode, req.params.id]
    );
    if (dupRes.rowCount > 0) {
      return res.status(400).json({ error: 'Kode promo sudah digunakan (harus unik).' });
    }

    await query(
      `UPDATE TIKTAKTUK.PROMOTION
       SET promo_code = $1, discount_type = $2, discount_value = $3, start_date = $4, end_date = $5, usage_limit = $6
       WHERE promotion_id = $7`,
      [promoCode.toUpperCase(), discType, discVal, startDate, endDate, usageLim, req.params.id]
    );

    res.json({ ok: true, message: 'Promo berhasil diperbarui.' });
  } catch (err) {
    const msg = err.message || '';
    const match = msg.match(/ERROR:\s*(.*)/);
    res.status(400).json({ error: match ? match[1].trim() : msg });
  }
});

// DELETE /api/promotions/:id - Delete promotion (Admin only)
app.delete('/api/promotions/:id', async (req, res) => {
  try {
    const existing = await query('SELECT promotion_id FROM TIKTAKTUK.PROMOTION WHERE promotion_id = $1', [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: 'Promo tidak ditemukan.' });
    }

    await query('DELETE FROM TIKTAKTUK.PROMOTION WHERE promotion_id = $1', [req.params.id]);
    res.json({ ok: true, message: 'Promo berhasil dihapus.' });
  } catch (err) {
    const msg = err.message || '';
    const match = msg.match(/ERROR:\s*(.*)/);
    res.status(400).json({ error: match ? match[1].trim() : msg });
  }
});

// ===================== EVENT ARTIST (with trigger validation) =====================
app.post('/api/event-artists', async (req, res) => {
  try {
    const { event_id, artist_id, role } = req.body;
    if (!event_id || !artist_id) return res.status(400).json({ error: 'Missing fields' });

    await query(
      'INSERT INTO TIKTAKTUK.EVENT_ARTIST (event_id, artist_id, role) VALUES ($1, $2, $3)',
      [event_id, artist_id, role || 'Performer']
    );
    res.status(201).json({ ok: true, message: 'Artist berhasil ditambahkan ke event.' });
  } catch (err) {
    // Forward trigger error message directly
    const msg = err.message || '';
    const match = msg.match(/ERROR:\s*(.*)/);
    const errorMessage = match ? match[1].trim() : msg;
    res.status(400).json({ error: errorMessage });
  }
});

app.listen(PORT, () => console.log(`Server TikTakTuk berjalan di port ${PORT}`));
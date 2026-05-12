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
    const r = await query(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = $3 LIMIT 1`,
      [schema.toLowerCase(), table.toLowerCase(), column.toLowerCase()]
    );
    return r.rowCount > 0;
  } catch (err) {
    return false;
  }
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
        await query(
          'INSERT INTO TIKTAKTUK.ORGANIZER (organizer_name, contact_email, user_id) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET organizer_name = EXCLUDED.organizer_name, contact_email = EXCLUDED.contact_email',
          [organizer_name, contact_email || '', user.user_id]
        );
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
          reserved_seating: 0,
          kapasitas_terbesar: '-',
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
    const e = await query('SELECT event_id, event_title, event_datetime, venue_id, organizer_id FROM TIKTAKTUK.EVENT ORDER BY event_datetime');
    res.json({ events: e.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/events', async (req, res) => {
  const { event_title, event_datetime, venue_id, organizer_id } = req.body;
  if (!event_title || !event_datetime || !venue_id || !organizer_id) return res.status(400).json({ error: 'Missing fields' });

  try {
    const v = await query('SELECT venue_id FROM TIKTAKTUK.VENUE WHERE venue_id = $1', [venue_id]);
    if (v.rowCount === 0) return res.status(400).json({ error: `Venue with id ${venue_id} not found` });

    const o = await query('SELECT organizer_id FROM TIKTAKTUK.ORGANIZER WHERE organizer_id = $1', [organizer_id]);
    if (o.rowCount === 0) return res.status(400).json({ error: `Organizer with id ${organizer_id} not found` });

    const ins = await query('INSERT INTO TIKTAKTUK.EVENT (event_title, event_datetime, venue_id, organizer_id) VALUES ($1,$2,$3,$4) RETURNING *', [event_title, event_datetime, venue_id, organizer_id]);
    res.status(201).json({ event: ins.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/events/:id', async (req, res) => {
  try {
    const e = await query('SELECT * FROM TIKTAKTUK.EVENT WHERE event_id = $1', [req.params.id]);
    if (e.rowCount === 0) return res.status(404).json({ error: 'Event not found' });
    res.json({ event: e.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server TikTakTuk berjalan di port ${PORT}`));
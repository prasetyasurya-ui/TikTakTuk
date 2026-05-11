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

    res.status(201).json({ message: 'Registrasi berhasil', user: { user_id: user.user_id, username: user.username } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

app.post('/api/auth/register', async (req, res) => registerAccount(req, res));
app.post('/api/auth/register/customer', async (req, res) => registerAccount(req, res, 'customer'));
app.post('/api/auth/register/organizer', async (req, res) => registerAccount(req, res, 'organizer'));

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
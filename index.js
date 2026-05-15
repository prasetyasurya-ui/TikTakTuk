import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { query } from './server/db.js';
import authRouter from './routes/auth.js';
import dashboardRouter from './routes/dashboard.js';
import profileRouter from './routes/profile.js';
import { columnExists, tableExists, isUuidLike } from './utils/dbHelpers.js';
import { poolInstance } from './server/db.js';

// Helper functions for venues and events
async function resolveOrganizerId(inputId) {
  if (!inputId) return null;
  const direct = await query('SELECT organizer_id FROM TIKTAKTUK.ORGANIZER WHERE organizer_id = $1', [inputId]);
  if (direct.rowCount > 0) return direct.rows[0].organizer_id;
  const byUser = await query('SELECT organizer_id FROM TIKTAKTUK.ORGANIZER WHERE user_id = $1', [inputId]);
  if (byUser.rowCount > 0) return byUser.rows[0].organizer_id;
  return null;
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

function toDateString(value) {
  if (!value) return null;
  const str = String(value);
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return str;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return str;
  return date.toISOString().slice(0, 10);
}

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : true,
}));
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Mount route modules
app.use('/api/auth', authRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/profile', profileRouter);


app.get('/api/health', async (req, res) => {
  try {
    const result = await query('SELECT NOW()');
    res.json({ status: 'success', message: 'Koneksi ke database OK', db_time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Gagal konek ke database', error: err.message });
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

function requireAdminOrOrganizer(req, res, next) {
  const roles = (req.user.roles || []).map(r => r.toLowerCase());
  if (!roles.includes('admin') && !roles.includes('organizer')) {
    return res.status(403).json({ ok: false, message: 'Hanya Admin atau Organizer yang dapat melakukan aksi ini.' });
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

// ─── TICKET CATEGORY endpoints ──────────────────────────────────────────────

// READ — public (guest can view)
app.get('/api/ticket-categories', async (_req, res) => {
  try {
    const result = await query(
      `
        SELECT
          c.category_id,
          c.category_name,
          c.quota,
          c.price,
          c.tevent_id,
          COALESCE(e.event_title, '-') AS event_name
        FROM TIKTAKTUK.TICKET_CATEGORY c
        LEFT JOIN TIKTAKTUK.EVENT e ON e.event_id = c.tevent_id
        ORDER BY e.event_title ASC, c.category_name ASC
      `
    );

    res.json({ ok: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// CREATE — Admin/Organizer only
app.post('/api/ticket-categories', authenticateToken, requireAdminOrOrganizer, async (req, res) => {
  const payload = req.body.data || req.body;
  const categoryName = (payload.category_name || '').trim();
  const quota = Number(payload.quota);
  const price = Number(payload.price);
  const eventId = String(payload.tevent_id || '').trim();

  if (!categoryName || !eventId) {
    return res.status(400).json({ ok: false, message: 'Nama kategori dan event wajib diisi.' });
  }

  if (categoryName.length > 100) {
    return res.status(400).json({ ok: false, message: 'Nama kategori maksimal 100 karakter.' });
  }

  if (!Number.isInteger(quota) || quota <= 0) {
    return res.status(400).json({ ok: false, message: 'Kuota harus berupa bilangan bulat positif (> 0).' });
  }

  if (Number.isNaN(price) || price < 0) {
    return res.status(400).json({ ok: false, message: 'Harga harus berupa bilangan tidak negatif (>= 0).' });
  }

  try {
    const eventRes = await query('SELECT event_id, venue_id FROM TIKTAKTUK.EVENT WHERE event_id = $1', [eventId]);
    if (eventRes.rowCount === 0) {
      return res.status(400).json({ ok: false, message: 'Event tidak ditemukan.' });
    }

    const venueRes = await query('SELECT venue_name, capacity FROM TIKTAKTUK.VENUE WHERE venue_id = $1', [eventRes.rows[0].venue_id]);
    if (venueRes.rowCount === 0) {
      return res.status(400).json({ ok: false, message: 'Venue tidak ditemukan.' });
    }

    const quotaRes = await query(
      'SELECT COALESCE(SUM(quota), 0)::int AS total FROM TIKTAKTUK.TICKET_CATEGORY WHERE tevent_id = $1',
      [eventId]
    );
    const currentTotal = Number(quotaRes.rows[0]?.total || 0);

    if (currentTotal + quota > Number(venueRes.rows[0].capacity)) {
      return res.status(400).json({
        ok: false,
        message: `Total kuota (${currentTotal + quota}) melebihi kapasitas venue ${venueRes.rows[0].venue_name} (${venueRes.rows[0].capacity}).`,
      });
    }

    const ins = await query(
      'INSERT INTO TIKTAKTUK.TICKET_CATEGORY (category_name, quota, price, tevent_id) VALUES ($1,$2,$3,$4) RETURNING category_id, category_name, quota, price, tevent_id',
      [categoryName, quota, price, eventId]
    );

    res.status(201).json({ ok: true, data: ins.rows[0], message: 'Kategori tiket berhasil ditambahkan.' });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// UPDATE — Admin/Organizer only
app.put('/api/ticket-categories/:id', authenticateToken, requireAdminOrOrganizer, async (req, res) => {
  const { id } = req.params;
  const payload = req.body.data || req.body;
  const categoryName = (payload.category_name || '').trim();
  const quota = Number(payload.quota);
  const price = Number(payload.price);
  const eventId = String(payload.tevent_id || '').trim();

  if (!categoryName || !eventId) {
    return res.status(400).json({ ok: false, message: 'Nama kategori dan event wajib diisi.' });
  }

  if (categoryName.length > 100) {
    return res.status(400).json({ ok: false, message: 'Nama kategori maksimal 100 karakter.' });
  }

  if (!Number.isInteger(quota) || quota <= 0) {
    return res.status(400).json({ ok: false, message: 'Kuota harus berupa bilangan bulat positif (> 0).' });
  }

  if (Number.isNaN(price) || price < 0) {
    return res.status(400).json({ ok: false, message: 'Harga harus berupa bilangan tidak negatif (>= 0).' });
  }

  try {
    const existing = await query('SELECT category_id FROM TIKTAKTUK.TICKET_CATEGORY WHERE category_id = $1', [id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ ok: false, message: 'Kategori tiket tidak ditemukan.' });
    }

    const eventRes = await query('SELECT event_id, venue_id FROM TIKTAKTUK.EVENT WHERE event_id = $1', [eventId]);
    if (eventRes.rowCount === 0) {
      return res.status(400).json({ ok: false, message: 'Event tidak ditemukan.' });
    }

    const venueRes = await query('SELECT venue_name, capacity FROM TIKTAKTUK.VENUE WHERE venue_id = $1', [eventRes.rows[0].venue_id]);
    if (venueRes.rowCount === 0) {
      return res.status(400).json({ ok: false, message: 'Venue tidak ditemukan.' });
    }

    const quotaRes = await query(
      'SELECT COALESCE(SUM(quota), 0)::int AS total FROM TIKTAKTUK.TICKET_CATEGORY WHERE tevent_id = $1 AND category_id <> $2',
      [eventId, id]
    );
    const otherTotal = Number(quotaRes.rows[0]?.total || 0);

    if (otherTotal + quota > Number(venueRes.rows[0].capacity)) {
      return res.status(400).json({
        ok: false,
        message: `Total kuota (${otherTotal + quota}) melebihi kapasitas venue ${venueRes.rows[0].venue_name} (${venueRes.rows[0].capacity}).`,
      });
    }

    const upd = await query(
      'UPDATE TIKTAKTUK.TICKET_CATEGORY SET category_name = $1, quota = $2, price = $3, tevent_id = $4 WHERE category_id = $5 RETURNING category_id, category_name, quota, price, tevent_id',
      [categoryName, quota, price, eventId, id]
    );

    res.json({ ok: true, data: upd.rows[0], message: 'Kategori tiket berhasil diperbarui.' });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// DELETE — Admin/Organizer only
app.delete('/api/ticket-categories/:id', authenticateToken, requireAdminOrOrganizer, async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await query('SELECT category_id, category_name FROM TIKTAKTUK.TICKET_CATEGORY WHERE category_id = $1', [id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ ok: false, message: 'Kategori tiket tidak ditemukan.' });
    }

    const hasTickets = await query('SELECT 1 FROM TIKTAKTUK.TICKET WHERE category_id = $1 LIMIT 1', [id]);
    if (hasTickets.rowCount > 0) {
      return res.status(400).json({ ok: false, message: 'Kategori tidak bisa dihapus karena sudah ada tiket yang terbit.' });
    }

    await query('DELETE FROM TIKTAKTUK.TICKET_CATEGORY WHERE category_id = $1', [id]);
    res.json({ ok: true, message: `Kategori "${existing.rows[0].category_name}" berhasil dihapus.` });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
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

    // Fetch ticket categories with remaining quota
    // Detect FK column name in TICKET (could be category_id or tcategory_id)
    let categories = [];
    const hasCategoryId = await columnExists('TIKTAKTUK', 'TICKET', 'category_id');
    const ticketFkCol = hasCategoryId ? 'category_id' : 'tcategory_id';

    const catRes = await query(
      `SELECT tc.category_id, tc.category_name, tc.quota, tc.price,
              COALESCE(COUNT(t.ticket_id), 0)::int AS sold
       FROM TIKTAKTUK.TICKET_CATEGORY tc
       LEFT JOIN TIKTAKTUK.TICKET t ON t.${ticketFkCol} = tc.category_id
       WHERE tc.tevent_id = $1
       GROUP BY tc.category_id, tc.category_name, tc.quota, tc.price
       ORDER BY tc.price`,
      [eventId]
    );
    categories = catRes.rows.map(row => ({
      id: row.category_id,
      name: row.category_name,
      quota: Number(row.quota),
      sold: Number(row.sold),
      remaining: Number(row.quota) - Number(row.sold),
      price: Number(row.price),
    }));

    // Fetch seats if reserved seating
    let seats = [];
    if (seatingType === 'RESERVED_SEATING') {
      const seatRes = await query('SELECT * FROM TIKTAKTUK.SEAT WHERE venue_id = $1 ORDER BY seat_number', [event.venue_id]);
      // Get used seat IDs
      const hasSeatId = await columnExists('TIKTAKTUK', 'HAS_RELATIONSHIP', 'seat_id');
      const hrSeatCol = hasSeatId ? 'seat_id' : 'customer_id';

      const usedRes = await query(
        `SELECT hr.ticket_id, s.seat_id FROM TIKTAKTUK.HAS_RELATIONSHIP hr
         JOIN TIKTAKTUK.SEAT s ON s.seat_id::text = hr.${hrSeatCol}::text
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

    // This endpoint only checks if the code exists and returns its details for UI calculation.

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

    const hasLowercaseOrder = await query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'tiktaktuk' AND table_name = 'order'
    `);
    const orderTableName = hasLowercaseOrder.rowCount > 0 ? '"order"' : '"ORDER"';

    const hasTktOrderId = await columnExists('TIKTAKTUK', 'TICKET', 'order_id');
    const tktOrderCol = hasTktOrderId ? 'order_id' : 'torder_id';

    const hasTktCatId = await columnExists('TIKTAKTUK', 'TICKET', 'category_id');
    const tktCatCol = hasTktCatId ? 'category_id' : 'tcategory_id';

    // We join with TICKET and TICKET_CATEGORY to get event_id, because lowercase "order" table doesn't have event_id
    const ordersRes = await query(
      `SELECT DISTINCT o.order_id, o.order_date, o.payment_status, o.total_amount, o.customer_id, tc.tevent_id AS event_id,
              c.full_name AS customer_name,
              e.event_title
       FROM TIKTAKTUK.${orderTableName} o
       LEFT JOIN TIKTAKTUK.CUSTOMER c ON c.customer_id = o.customer_id
       LEFT JOIN TIKTAKTUK.TICKET t ON t.${tktOrderCol} = o.order_id
       LEFT JOIN TIKTAKTUK.TICKET_CATEGORY tc ON tc.category_id = t.${tktCatCol}
       LEFT JOIN TIKTAKTUK.EVENT e ON e.event_id = tc.tevent_id
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
  // 1. Ambil koneksi dari pool di awal untuk transaksi
  const client = await poolInstance.connect();

  try {
    await client.query('BEGIN');

    // 2. Destructuring input (Hanya sekali di awal)
    // Catatan: userId diambil dari req.body atau req.user tergantung middleware Anda
    const { eventId, categoryId, quantity, promoCode, userId } = req.body;

    // 3. Validasi Dasar Input
    if (!eventId || !categoryId) {
      throw new Error('Event dan Kategori tiket wajib dipilih.');
    }

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new Error('Jumlah tiket wajib bilangan bulat positif.');
    }
    if (qty > 10) {
      throw new Error('Maksimal 10 tiket per transaksi.');
    }

    // 4. Verifikasi Customer
    const customerRes = await client.query(
      'SELECT customer_id FROM TIKTAKTUK.CUSTOMER WHERE user_id = $1',
      [userId]
    );
    if (customerRes.rowCount === 0) {
      throw new Error('Customer tidak ditemukan. Silakan login ulang.');
    }
    const customerId = customerRes.rows[0].customer_id;

    // 5. Verifikasi Kategori & Ambil Harga
    const catRes = await client.query(
      'SELECT category_id, category_name, price, quota FROM TIKTAKTUK.TICKET_CATEGORY WHERE category_id = $1 AND tevent_id = $2',
      [categoryId, eventId]
    );
    if (catRes.rowCount === 0) {
      throw new Error('Kategori tiket tidak valid untuk event ini.');
    }
    const { price: unitPrice, quota, category_name } = catRes.rows[0];

    // 6. Validasi Kuota (Menggunakan Join untuk menghitung tiket terjual)
    const hasCategoryCol = await columnExists('TIKTAKTUK', 'TICKET', 'category_id');
    const tktFkCol = hasCategoryCol ? 'category_id' : 'tcategory_id';

    const soldRes = await client.query(
      `SELECT COUNT(*) AS sold FROM TIKTAKTUK.TICKET WHERE ${tktFkCol} = $1`,
      [categoryId]
    );
    const remaining = Number(quota) - Number(soldRes.rows[0].sold);
    if (remaining < qty) {
      throw new Error(`Sisa kuota kategori "${category_name}" tidak mencukupi (sisa: ${remaining}).`);
    }

    // 7. Perhitungan Harga & Promo
    let subtotal = Number(unitPrice) * qty;
    let promotionId = null;

    if (promoCode) {
      const code = promoCode.trim().toUpperCase();
      const promoRes = await client.query(
        'SELECT * FROM TIKTAKTUK.PROMOTION WHERE UPPER(promo_code) = $1',
        [code]
      );

      if (promoRes.rowCount === 0) {
        // Memicu DB exception dengan dummy UUID jika promo tidak valid
        promotionId = '00000000-0000-0000-0000-000000000000';
      } else {
        const promotion = promoRes.rows[0];
        promotionId = promotion.promotion_id;
        const discValue = Number(promotion.discount_value);

        let discount = 0;
        if (promotion.discount_type.toUpperCase() === 'PERCENTAGE') {
          discount = (subtotal * discValue) / 100;
        } else {
          discount = discValue;
        }
        subtotal = Math.max(0, subtotal - discount);
      }
    }

    // 8. Penentuan Nama Tabel Order (Case Sensitivity)
    const hasLowercaseOrder = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'tiktaktuk' AND table_name = 'order'
    `);
    const orderTableName = hasLowercaseOrder.rowCount > 0 ? '"order"' : '"ORDER"';
    const hasEventIdInOrder = await columnExists('TIKTAKTUK', orderTableName.replace(/"/g, ''), 'event_id');

    // 9. Insert ke Tabel Order
    let orderRes;
    if (hasEventIdInOrder) {
      orderRes = await client.query(
        `INSERT INTO TIKTAKTUK.${orderTableName} (order_date, payment_status, total_amount, customer_id, event_id)
         VALUES (NOW(), 'PENDING', $1, $2, $3) RETURNING order_id`,
        [subtotal, customerId, eventId]
      );
    } else {
      orderRes = await client.query(
        `INSERT INTO TIKTAKTUK.${orderTableName} (order_date, payment_status, total_amount, customer_id)
         VALUES (NOW(), 'PENDING', $1, $2) RETURNING order_id`,
        [subtotal, customerId]
      );
    }
    const orderId = orderRes.rows[0].order_id;

    // 10. Generate Tiket
    const hasStatusCol = await columnExists('TIKTAKTUK', 'TICKET', 'status');
    const hasOrderIdCol = await columnExists('TIKTAKTUK', 'TICKET', 'order_id');
    const tktOrderCol = hasOrderIdCol ? 'order_id' : 'torder_id';

    for (let i = 0; i < qty; i++) {
      const ticketCode = `TKT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      if (hasStatusCol) {
        await client.query(
          `INSERT INTO TIKTAKTUK.TICKET (ticket_code, status, issued_at, ${tktOrderCol}, ${tktFkCol})
           VALUES ($1, 'ACTIVE', NOW(), $2, $3)`,
          [ticketCode, orderId, categoryId]
        );
      } else {
        await client.query(
          `INSERT INTO TIKTAKTUK.TICKET (ticket_code, ${tktOrderCol}, ${tktFkCol})
           VALUES ($1, $2, $3)`,
          [ticketCode, orderId, categoryId]
        );
      }
    }

    // 11. Link Promo ke Order
    if (promotionId) {
      await client.query(
        'INSERT INTO TIKTAKTUK.ORDER_PROMOTION (promotion_id, order_id) VALUES ($1, $2)',
        [promotionId, orderId]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ ok: true, orderId });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Order Error:', err.message);

    // Formatting error message dari trigger database
    const msg = err.message || '';
    const match = msg.match(/(ERROR:\s*.*)/);
    const errorMessage = match ? match[1].trim() : msg;

    res.status(400).json({ error: errorMessage });
  } finally {
    client.release();
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

    const hasLowercaseOrder = await query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'tiktaktuk' AND table_name = 'order'
    `);
    const orderTableName = hasLowercaseOrder.rowCount > 0 ? '"order"' : '"ORDER"';

    const existing = await query(`SELECT order_id FROM TIKTAKTUK.${orderTableName} WHERE order_id = $1`, [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: 'Order tidak ditemukan.' });
    }

    await query(`UPDATE TIKTAKTUK.${orderTableName} SET payment_status = $1 WHERE order_id = $2`, [normalized, req.params.id]);
    res.json({ ok: true, message: 'Order berhasil diperbarui.' });
  } catch (err) {
    const msg = err.message || '';
    const match = msg.match(/ERROR:\s*(.*)/);
    res.status(400).json({ error: match ? match[1].trim() : msg });
  }
});

// DELETE /api/orders/:id - Delete order (Admin only)
app.delete('/api/orders/:id', async (req, res) => {
  const client = await poolInstance.connect();
  try {
    await client.query('BEGIN');

    const hasLowercaseOrder = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'tiktaktuk' AND table_name = 'order'
    `);
    const orderTableName = hasLowercaseOrder.rowCount > 0 ? '"order"' : '"ORDER"';

    const existing = await client.query(`SELECT order_id FROM TIKTAKTUK.${orderTableName} WHERE order_id = $1`, [req.params.id]);
    if (existing.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order tidak ditemukan.' });
    }

    // Determine correct ticket order column
    const hasTktOrderId = await columnExists('TIKTAKTUK', 'TICKET', 'order_id');
    const tktOrderCol = hasTktOrderId ? 'order_id' : 'torder_id';

    // 1. Find all ticket IDs for this order
    const ticketsRes = await client.query(`SELECT ticket_id FROM TIKTAKTUK.TICKET WHERE ${tktOrderCol} = $1`, [req.params.id]);
    const ticketIds = ticketsRes.rows.map(r => r.ticket_id);

    // 2. Delete from HAS_RELATIONSHIP for these tickets
    if (ticketIds.length > 0) {
      // Create parameterized list $1, $2, etc.
      const paramList = ticketIds.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(`DELETE FROM TIKTAKTUK.HAS_RELATIONSHIP WHERE ticket_id IN (${paramList})`, ticketIds);
    }

    // 3. Delete from TICKET
    await client.query(`DELETE FROM TIKTAKTUK.TICKET WHERE ${tktOrderCol} = $1`, [req.params.id]);

    // 4. Delete from ORDER_PROMOTION
    await client.query(`DELETE FROM TIKTAKTUK.ORDER_PROMOTION WHERE order_id = $1`, [req.params.id]);

    // 5. Finally, delete the ORDER itself
    await client.query(`DELETE FROM TIKTAKTUK.${orderTableName} WHERE order_id = $1`, [req.params.id]);

    await client.query('COMMIT');
    res.json({ ok: true, message: 'Order berhasil dihapus beserta seluruh data terkait.' });
  } catch (err) {
    await client.query('ROLLBACK');
    const msg = err.message || '';
    const match = msg.match(/ERROR:\s*(.*)/);
    res.status(400).json({ error: match ? match[1].trim() : msg });
  } finally {
    client.release();
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
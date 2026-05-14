import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { query } from './server/db.js';
import authRouter from './routes/auth.js';
import dashboardRouter from './routes/dashboard.js';
import profileRouter from './routes/profile.js';
import { columnExists, tableExists, isUuidLike } from './utils/dbHelpers.js';

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

dotenv.config();

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

app.listen(PORT, () => console.log(`Server TikTakTuk berjalan di port ${PORT}`));
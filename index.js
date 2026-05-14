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

app.listen(PORT, () => console.log(`Server TikTakTuk berjalan di port ${PORT}`));
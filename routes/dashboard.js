import express from 'express';
import { query } from '../server/db.js';

const router = express.Router();

// Customer Dashboard
router.get('/customer', async (req, res) => {
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

// Organizer Dashboard
router.get('/organizer', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const userResult = await query(
      'SELECT u.username, o.organizer_id, o.organizer_name FROM TIKTAKTUK.USER_ACCOUNT u LEFT JOIN TIKTAKTUK.ORGANIZER o ON o.user_id::text = u.user_id::text WHERE u.user_id::text = $1',
      [userId]
    );
    if (userResult.rowCount === 0) return res.status(404).json({ error: 'User not found' });

    const { organizer_id, organizer_name, username } = userResult.rows[0];

    if (!organizer_id) {
      return res.json({
        data: {
          ringkasan: {
            acara_aktif: 0,
            tiket_terjual: 0,
            revenue_bulan_ini: 'Rp 0',
            venue_mitra: 0,
          },
          top_acara: [],
          organizer_name: username,
        },
      });
    }

    const eventsResult = await query(
      'SELECT event_id, event_title, venue_id FROM TIKTAKTUK.EVENT WHERE organizer_id::text = $1',
      [organizer_id]
    );
    const acara_aktif = eventsResult.rowCount;

    const venueResult = await query(
      'SELECT COUNT(DISTINCT venue_id)::int AS total FROM TIKTAKTUK.EVENT WHERE organizer_id::text = $1',
      [organizer_id]
    );
    const venue_mitra = venueResult.rows[0]?.total || 0;

    let tiket_terjual = 0;
    let revenue_bulan_ini = 0;

    if (eventsResult.rowCount > 0) {
      const ticketsResult = await query(
        `
        SELECT 
          COUNT(t.ticket_id)::int AS total_tickets,
          COALESCE(SUM(tc.price), 0)::bigint AS total_revenue
        FROM TIKTAKTUK.TICKET t
        JOIN TIKTAKTUK.TICKET_CATEGORY tc ON t.tcategory_id = tc.category_id
        JOIN TIKTAKTUK.EVENT e ON tc.tevent_id = e.event_id
        JOIN TIKTAKTUK."order" o ON t.torder_id = o.order_id
        WHERE e.organizer_id::text = $1 AND o.payment_status = 'PAID'
        `,
        [organizer_id]
      );
      tiket_terjual = ticketsResult.rows[0]?.total_tickets || 0;
      revenue_bulan_ini = ticketsResult.rows[0]?.total_revenue || 0;
    }

    const topAcaraResult = await query(
      `
      SELECT 
        e.event_id,
        e.event_title,
        e.venue_id,
        COALESCE(SUM(tc.quota), 0)::int AS total_quota,
        COALESCE(COUNT(t.ticket_id), 0)::int AS sold_count
      FROM TIKTAKTUK.EVENT e
      LEFT JOIN TIKTAKTUK.TICKET_CATEGORY tc ON e.event_id = tc.tevent_id
      LEFT JOIN TIKTAKTUK.TICKET t ON tc.category_id = t.tcategory_id
      LEFT JOIN TIKTAKTUK."order" o ON t.torder_id = o.order_id AND o.payment_status = 'PAID'
      WHERE e.organizer_id::text = $1
      GROUP BY e.event_id, e.event_title, e.venue_id
      ORDER BY e.event_id
      `,
      [organizer_id]
    );

    const top_acara = topAcaraResult.rows.map(row => {
      const percentage = row.total_quota > 0 
        ? Math.round((row.sold_count / row.total_quota) * 100 * 10) / 10 
        : 0;
      return {
        id: row.event_id,
        nama_event: row.event_title,
        status: 'Live',
        persentase_terjual: percentage || (row.sold_count > 0 ? 0.1 : 0),
        total_tiket: row.total_quota,
      };
    });

    res.json({
      data: {
        ringkasan: {
          acara_aktif,
          tiket_terjual,
          revenue_bulan_ini: `Rp ${(revenue_bulan_ini / 1).toLocaleString('id-ID')}`,
          venue_mitra,
        },
        top_acara,
        organizer_name,
      },
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin Dashboard
router.get('/admin', async (req, res) => {
  try {
    const users = await query('SELECT COUNT(*)::int AS total FROM TIKTAKTUK.USER_ACCOUNT');
    const events = await query('SELECT COUNT(*)::int AS total FROM TIKTAKTUK.EVENT');
    const venues = await query('SELECT COUNT(*)::int AS total FROM TIKTAKTUK.VENUE');
    const promos = await query('SELECT COUNT(*)::int AS total FROM TIKTAKTUK.PROMOTION');
    
    const reservedSeatingRes = await query(
      "SELECT COUNT(*)::int AS total FROM TIKTAKTUK.VENUE WHERE jenis_seating = 'RESERVED_SEATING'"
    );
    
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

export default router;

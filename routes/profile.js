import express from 'express';
import bcrypt from 'bcrypt';
import { query } from '../server/db.js';
import { 
  getUserRoles, 
  getUserById, 
  ensureRole, 
  columnExists 
} from '../utils/dbHelpers.js';

const router = express.Router();

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

// Get profile
router.get('/', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const u = await query('SELECT user_id, username, password FROM TIKTAKTUK.USER_ACCOUNT WHERE user_id = $1', [userId]);
    if (u.rowCount === 0) return res.status(404).json({ error: 'User not found' });

    const rolesRes = await query('SELECT r.role_name FROM TIKTAKTUK.ROLE r JOIN TIKTAKTUK.ACCOUNT_ROLE ar ON ar.role_id = r.role_id WHERE ar.user_id = $1', [userId]);
    const roles = rolesRes.rows.map(r => r.role_name);
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

// Update profile
router.post('/update', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const rolesRes = await query('SELECT r.role_name FROM TIKTAKTUK.ROLE r JOIN TIKTAKTUK.ACCOUNT_ROLE ar ON ar.role_id = r.role_id WHERE ar.user_id = $1', [userId]);
    const normalized = rolesRes.rows.map(r => r.role_name.toLowerCase());
    const updatingCustomer = normalized.includes('customer');
    const updatingOrganizer = normalized.includes('organizer');

    if (updatingCustomer) {
      await persistCustomerProfile(userId, req.body);
    }

    if (updatingOrganizer) {
      await persistOrganizerProfile(userId, req.body);
    }

    const updated = await query('SELECT u.user_id, u.username FROM TIKTAKTUK.USER_ACCOUNT u WHERE u.user_id = $1', [userId]);
    const profile = { user_id: updated.rows[0].user_id, username: updated.rows[0].username };

    if (updatingCustomer) {
      const cust = await query('SELECT full_name, phone_number FROM TIKTAKTUK.CUSTOMER WHERE user_id = $1', [userId]);
      profile.full_name = cust.rowCount > 0 ? cust.rows[0].full_name : null;
      profile.phone_number = cust.rowCount > 0 ? cust.rows[0].phone_number : null;
    }

    if (updatingOrganizer) {
      const hasContactEmail = await columnExists('TIKTAKTUK', 'ORGANIZER', 'contact_email');
      const org = hasContactEmail
        ? await query('SELECT organizer_name, contact_email FROM TIKTAKTUK.ORGANIZER WHERE user_id = $1', [userId])
        : await query('SELECT organizer_name FROM TIKTAKTUK.ORGANIZER WHERE user_id = $1', [userId]);
      profile.organizer_name = org.rowCount > 0 ? org.rows[0].organizer_name : null;
      profile.contact_email = org.rowCount > 0 && hasContactEmail ? org.rows[0].contact_email : null;
    }

    res.json({ data: profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Change password
router.post('/change-password', async (req, res) => {
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

// Get customer profile
router.get('/customer', async (req, res) => {
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

// Update customer profile
router.post('/customer/update', async (req, res) => {
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

// Get organizer profile
router.get('/organizer', async (req, res) => {
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

// Update organizer profile
router.post('/organizer/update', async (req, res) => {
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

// Get admin profile
router.get('/admin', async (req, res) => {
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

export default router;

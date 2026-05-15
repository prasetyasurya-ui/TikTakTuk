import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../server/db.js';
import { getUserByUsername, getUserRoles, ensureRole } from '../utils/dbHelpers.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

// Register user
async function registerAccount(req, res, roleOverride) {
  const { username, password } = req.body;
  const role = roleOverride || req.body.role;

  if (!username || !password || !role) return res.status(400).json({ error: 'Missing fields' });

  try {
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

router.post('/register', async (req, res) => registerAccount(req, res));
router.post('/register/customer', async (req, res) => registerAccount(req, res, 'customer'));
router.post('/register/organizer', async (req, res) => registerAccount(req, res, 'organizer'));
router.post('/register/admin', async (req, res) => registerAccount(req, res, 'admin'));

// Login
router.post('/login', async (req, res) => {
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

// Login for specific role
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

router.post('/login/customer', async (req, res) => loginForRole(req, res, 'customer'));
router.post('/login/organizer', async (req, res) => loginForRole(req, res, 'organizer'));
router.post('/login/admin', async (req, res) => loginForRole(req, res, 'admin'));

export default router;

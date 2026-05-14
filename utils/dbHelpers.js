import { query } from '../server/db.js';

export async function columnExists(schema, table, column) {
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

export async function tableExists(schema, table) {
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

export async function getUserRoles(userId) {
  const rolesRes = await query(
    'SELECT r.role_name FROM TIKTAKTUK.ROLE r JOIN TIKTAKTUK.ACCOUNT_ROLE ar ON ar.role_id = r.role_id WHERE ar.user_id = $1',
    [userId]
  );
  return rolesRes.rows.map((row) => row.role_name.toLowerCase());
}

export async function getUserByUsername(username) {
  const result = await query('SELECT user_id, username, password FROM TIKTAKTUK.USER_ACCOUNT WHERE LOWER(username)=LOWER($1)', [username]);
  return result.rowCount > 0 ? result.rows[0] : null;
}

export async function getUserById(userId) {
  const result = await query('SELECT user_id, username FROM TIKTAKTUK.USER_ACCOUNT WHERE user_id = $1', [userId]);
  return result.rowCount > 0 ? result.rows[0] : null;
}

export function ensureRole(roles, expectedRole) {
  return roles.includes(expectedRole);
}

export function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

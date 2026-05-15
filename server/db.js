import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL || '';
const useSsl = !/localhost|127\.0\.0\.1/i.test(databaseUrl);

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: useSsl ? { rejectUnauthorized: false } : false
});

export const poolInstance = pool;
export const query = (text, params) => pool.query(text, params);
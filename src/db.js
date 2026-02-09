import pg from 'pg';

const { Pool } = pg;

function safeStr(v) {
  return typeof v === 'string' ? v : '';
}

const config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'komek_db',
      user: process.env.DB_USER || 'komek_user',
      password: process.env.DB_PASSWORD || 'komek-123'
    };

const pool = new Pool(config);

export { pool };

export async function query(text, params) {
  const res = await pool.query(text, params);
  return res;
}

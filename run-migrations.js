#!/usr/bin/env node
import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
const config = connectionString
  ? { connectionString, ssl: { rejectUnauthorized: false } }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'komek_db',
      user: process.env.DB_USER || 'komek_user',
      password: process.env.DB_PASSWORD || '',
      ssl: false,
    };
const pool = new Pool(config);

const migrationsDir = path.join(__dirname, 'migrations');

const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

async function run() {
  const client = await pool.connect();
  try {
    for (const file of migrationFiles) {
      console.log(`Running ${file}...`);
      const sql = fs.readFileSync(
        path.join(migrationsDir, file),
        'utf8'
      );
      await client.query(sql);
      console.log('  OK');
    }
    console.log('✅ All migrations applied');
  } catch (err) {
    console.error('❌ Migration error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();

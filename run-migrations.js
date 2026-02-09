#!/usr/bin/env node
/**
 * Применяет миграции из migrations/ по порядку (000, 001, 002, …).
 * Использует те же DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD что и приложение.
 */
import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'komek_db',
  user: process.env.DB_USER || 'komek_user',
  password: process.env.DB_PASSWORD || 'komek-123',
});

const migrationsDir = path.join(__dirname, 'migrations');

const migrationFiles = fs.readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

async function run() {
  const client = await pool.connect();
  try {
    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      console.log(`Running ${file}...`);
      await client.query(sql);
      console.log(`  OK`);
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();

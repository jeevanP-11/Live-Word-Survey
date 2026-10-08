import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

let migrated = false;

export function getTestPool(): Pool {
  return new Pool({ connectionString: process.env.DATABASE_URL });
}

export async function ensureMigrated(pool: Pool): Promise<void> {
  if (migrated) return;
  const sqlPath = path.join(__dirname, '..', '..', 'init-db', '001_init.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  await pool.query(sql);
  migrated = true;
}

/** Wipe all rows between tests while keeping the schema. */
export async function truncateAll(pool: Pool): Promise<void> {
  await pool.query(
    `TRUNCATE TABLE responses, word_clusters, otp_sessions, questions, surveys, admins RESTART IDENTITY CASCADE`
  );
}

export async function waitForTestDb(pool: Pool, retries = 15, delayMs = 1000): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error(
    'Test database not reachable. Start it with `docker compose -f docker-compose.test.yml up -d` ' +
      'or run `./scripts/run-tests.sh` which does this automatically.'
  );
}

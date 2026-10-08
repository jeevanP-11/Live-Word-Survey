import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // sensible defaults for a small single-instance deployment
  max: 10,
  idleTimeoutMillis: 30000
});

pool.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('Unexpected error on idle PG client', err);
});

export default pool;

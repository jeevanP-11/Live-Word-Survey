import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import pool from './db';
import adminRoutes from './routes/admin';
import surveyRoutes from './routes/surveys';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/admin', adminRoutes);
app.use('/api/surveys', surveyRoutes);

// Central error handler — keeps route handlers free of repetitive try/catch noise.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    // eslint-disable-next-line no-console
    console.warn('ADMIN_USERNAME / ADMIN_PASSWORD not set — skipping admin seed');
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO admins (username, password_hash) VALUES ($1, $2)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [username, passwordHash]
  );
  // eslint-disable-next-line no-console
  console.log(`Admin account ready: ${username}`);
}

async function waitForDb(retries = 20, delayMs = 1500) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch {
      // eslint-disable-next-line no-console
      console.log(`Waiting for database... (${i + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('Database not reachable after retries');
}

const PORT = process.env.PORT ?? 4000;

if (require.main === module) {
  waitForDb()
    .then(seedAdmin)
    .then(() => {
      app.listen(PORT, () => {
        // eslint-disable-next-line no-console
        console.log(`API listening on port ${PORT}`);
      });
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Fatal startup error', err);
      process.exit(1);
    });
}

export default app;

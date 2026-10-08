import request from 'supertest';
import { Pool } from 'pg';
import app from '../index';
import appPool from '../db';
import { getTestPool, ensureMigrated, truncateAll, waitForTestDb } from './dbTestUtils';

describe('Admin API', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = getTestPool();
    await waitForTestDb(pool);
    await ensureMigrated(pool);
  });

  beforeEach(async () => {
    await truncateAll(pool);
  });

  afterAll(async () => {
    await pool.end();
    await appPool.end();
  });

  async function loginAsAdmin(): Promise<string> {
    // The app seeds the admin from env vars on startup normally; in tests we insert directly.
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('admin-test-password', 10);
    await pool.query('INSERT INTO admins (username, password_hash) VALUES ($1, $2)', ['admin', hash]);

    const res = await request(app).post('/api/admin/login').send({
      username: 'admin',
      password: 'admin-test-password'
    });
    expect(res.status).toBe(200);
    return res.body.token;
  }

  it('rejects login with wrong credentials', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('admin-test-password', 10);
    await pool.query('INSERT INTO admins (username, password_hash) VALUES ($1, $2)', ['admin', hash]);

    const res = await request(app).post('/api/admin/login').send({
      username: 'admin',
      password: 'wrong-password'
    });
    expect(res.status).toBe(401);
  });

  it('rejects survey creation without a token', async () => {
    const res = await request(app).post('/api/admin/surveys').send({
      title: 'Favorite Season',
      questions: [{ text: 'What is your favorite season?' }],
      durationMinutes: 10
    });
    expect(res.status).toBe(401);
  });

  it('creates a survey with 1-2 questions and a generated slug', async () => {
    const token = await loginAsAdmin();

    const res = await request(app)
      .post('/api/admin/surveys')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Team Mood Check',
        questions: [{ text: 'How do you feel today?' }, { text: 'One word for this sprint?' }],
        durationMinutes: 15
      });

    expect(res.status).toBe(201);
    expect(res.body.slug).toMatch(/^[a-z]+-[a-z]+-\d{4}$/);
    expect(res.body.questions).toHaveLength(2);
    expect(res.body.status).toBe('active');
    expect(res.body.shareUrl).toBe(`/s/${res.body.slug}`);
  });

  it('rejects a survey with 0 or 3+ questions', async () => {
    const token = await loginAsAdmin();

    const zero = await request(app)
      .post('/api/admin/surveys')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'x', questions: [], durationMinutes: 5 });
    expect(zero.status).toBe(400);

    const three = await request(app)
      .post('/api/admin/surveys')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'x',
        questions: [{ text: 'a' }, { text: 'b' }, { text: 'c' }],
        durationMinutes: 5
      });
    expect(three.status).toBe(400);
  });

  it('lists surveys filtered by status', async () => {
    const token = await loginAsAdmin();

    await request(app)
      .post('/api/admin/surveys')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Active One', questions: [{ text: 'q' }], durationMinutes: 30 });

    // A survey that started in the past and is already closed
    const client = await pool.connect();
    await client.query(
      `INSERT INTO surveys (slug, title, start_time, duration_minutes) VALUES ($1, $2, now() - interval '1 hour', 5)`,
      ['closed-slug-0001', 'Closed One']
    );
    client.release();

    const activeRes = await request(app)
      .get('/api/admin/surveys?status=active')
      .set('Authorization', `Bearer ${token}`);
    expect(activeRes.status).toBe(200);
    expect(activeRes.body.surveys.some((s: { title: string }) => s.title === 'Active One')).toBe(true);
    expect(activeRes.body.surveys.some((s: { title: string }) => s.title === 'Closed One')).toBe(false);

    const closedRes = await request(app)
      .get('/api/admin/surveys?status=closed')
      .set('Authorization', `Bearer ${token}`);
    expect(closedRes.body.surveys.some((s: { title: string }) => s.title === 'Closed One')).toBe(true);
  });

  it('returns survey detail with results and respondent phone list', async () => {
    const token = await loginAsAdmin();
    const created = await request(app)
      .post('/api/admin/surveys')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Detail Test', questions: [{ text: 'q1' }], durationMinutes: 30 });

    const detail = await request(app)
      .get(`/api/admin/surveys/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(detail.status).toBe(200);
    expect(detail.body.results).toHaveLength(1);
    expect(detail.body.respondentPhones).toEqual([]);
  });

  it('returns 404 for an unknown survey id', async () => {
    const token = await loginAsAdmin();
    const res = await request(app)
      .get('/api/admin/surveys/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

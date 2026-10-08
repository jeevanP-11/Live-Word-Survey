import request from 'supertest';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import app from '../index';
import appPool from '../db';
import { getTestPool, ensureMigrated, truncateAll, waitForTestDb } from './dbTestUtils';

describe('Public survey flow', () => {
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

  async function createSurvey(durationMinutes = 30, questionCount: 1 | 2 = 1) {
    const hash = await bcrypt.hash('admin-test-password', 10);
    await pool.query('INSERT INTO admins (username, password_hash) VALUES ($1, $2)', ['admin', hash]);
    const login = await request(app)
      .post('/api/admin/login')
      .send({ username: 'admin', password: 'admin-test-password' });
    const token = login.body.token;

    const questions =
      questionCount === 1 ? [{ text: 'Favorite word?' }] : [{ text: 'Favorite word?' }, { text: 'Mood today?' }];

    const created = await request(app)
      .post('/api/admin/surveys')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Flow Test', questions, durationMinutes });

    return { survey: created.body, adminToken: token };
  }

  async function otpLogin(slug: string, phone: string): Promise<string> {
    const req = await request(app).post(`/api/surveys/${slug}/otp/request`).send({ phone });
    expect(req.status).toBe(200);
    const otp = req.body.otp;

    const verify = await request(app).post(`/api/surveys/${slug}/otp/verify`).send({ phone, otp });
    expect(verify.status).toBe(200);
    return verify.body.token;
  }

  it('returns public survey metadata without auth', async () => {
    const { survey } = await createSurvey();
    const res = await request(app).get(`/api/surveys/${survey.slug}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
    expect(res.body.questions).toHaveLength(1);
  });

  it('issues and verifies an OTP, and rejects a wrong code', async () => {
    const { survey } = await createSurvey();
    const reqRes = await request(app)
      .post(`/api/surveys/${survey.slug}/otp/request`)
      .send({ phone: '9876543210' });
    expect(reqRes.status).toBe(200);
    expect(reqRes.body.otp).toMatch(/^\d{6}$/);

    const wrong = await request(app)
      .post(`/api/surveys/${survey.slug}/otp/verify`)
      .send({ phone: '9876543210', otp: '000000' });
    expect(wrong.status).toBe(400);

    const right = await request(app)
      .post(`/api/surveys/${survey.slug}/otp/verify`)
      .send({ phone: '9876543210', otp: reqRes.body.otp });
    expect(right.status).toBe(200);
    expect(right.body.token).toBeDefined();
  });

  it('requesting a new OTP invalidates the previous one', async () => {
    const { survey } = await createSurvey();
    const first = await request(app)
      .post(`/api/surveys/${survey.slug}/otp/request`)
      .send({ phone: '9876543210' });
    await request(app).post(`/api/surveys/${survey.slug}/otp/request`).send({ phone: '9876543210' });

    const verifyOld = await request(app)
      .post(`/api/surveys/${survey.slug}/otp/verify`)
      .send({ phone: '9876543210', otp: first.body.otp });
    expect(verifyOld.status).toBe(400);
  });

  it('rejects submission without a session token', async () => {
    const { survey } = await createSurvey();
    const res = await request(app)
      .post(`/api/surveys/${survey.slug}/responses`)
      .send({ answers: [{ questionId: survey.questions[0].id, word: 'happy' }] });
    expect(res.status).toBe(401);
  });

  it('accepts a valid submission and reflects it in results', async () => {
    const { survey } = await createSurvey();
    const token = await otpLogin(survey.slug, '9876543210');

    const submit = await request(app)
      .post(`/api/surveys/${survey.slug}/responses`)
      .set('Authorization', `Bearer ${token}`)
      .send({ answers: [{ questionId: survey.questions[0].id, word: 'Happy!' }] });
    expect(submit.status).toBe(201);

    const results = await request(app).get(`/api/surveys/${survey.slug}/results`);
    expect(results.status).toBe(200);
    expect(results.body.results[0].totalResponses).toBe(1);
    expect(results.body.results[0].clusters[0]).toEqual({ word: 'happy', count: 1, percentage: 100 });
  });

  it('rejects a second submission from the same phone number', async () => {
    const { survey } = await createSurvey();
    const token = await otpLogin(survey.slug, '9876543210');

    await request(app)
      .post(`/api/surveys/${survey.slug}/responses`)
      .set('Authorization', `Bearer ${token}`)
      .send({ answers: [{ questionId: survey.questions[0].id, word: 'happy' }] });

    const second = await request(app)
      .post(`/api/surveys/${survey.slug}/responses`)
      .set('Authorization', `Bearer ${token}`)
      .send({ answers: [{ questionId: survey.questions[0].id, word: 'sad' }] });

    expect(second.status).toBe(409);

    const results = await request(app).get(`/api/surveys/${survey.slug}/results`);
    expect(results.body.results[0].totalResponses).toBe(1);
  });

  it('fuzzy-clusters near-typo submissions into the same bucket', async () => {
    const { survey } = await createSurvey();
    const words = ['happy', 'hapy', 'happpy', 'excited'];
    const phones = ['1111111111', '2222222222', '3333333333', '4444444444'];

    for (let i = 0; i < words.length; i++) {
      const token = await otpLogin(survey.slug, phones[i]);
      const res = await request(app)
        .post(`/api/surveys/${survey.slug}/responses`)
        .set('Authorization', `Bearer ${token}`)
        .send({ answers: [{ questionId: survey.questions[0].id, word: words[i] }] });
      expect(res.status).toBe(201);
    }

    const results = await request(app).get(`/api/surveys/${survey.slug}/results`);
    const clusters = results.body.results[0].clusters;
    expect(results.body.results[0].totalResponses).toBe(4);

    const happyCluster = clusters.find((c: { word: string }) => c.word === 'happy');
    expect(happyCluster.count).toBe(3);
    expect(happyCluster.percentage).toBe(75);

    const excitedCluster = clusters.find((c: { word: string }) => c.word === 'excited');
    expect(excitedCluster.count).toBe(1);
    expect(excitedCluster.percentage).toBe(25);
  });

  it('allows submitting answers for both questions of a 2-question survey in one call', async () => {
    const { survey } = await createSurvey(30, 2);
    const token = await otpLogin(survey.slug, '9876543210');

    const submit = await request(app)
      .post(`/api/surveys/${survey.slug}/responses`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        answers: [
          { questionId: survey.questions[0].id, word: 'happy' },
          { questionId: survey.questions[1].id, word: 'energized' }
        ]
      });
    expect(submit.status).toBe(201);

    const results = await request(app).get(`/api/surveys/${survey.slug}/results`);
    expect(results.body.results).toHaveLength(2);
    expect(results.body.results[0].totalResponses).toBe(1);
    expect(results.body.results[1].totalResponses).toBe(1);
  });

  it('shows closed status and rejects new OTP requests / submissions once the window elapses', async () => {
    // Duration of 0 minutes isn't allowed by validation, so create then backdate start_time.
    const { survey } = await createSurvey(5);
    await pool.query(`UPDATE surveys SET start_time = now() - interval '1 hour' WHERE id = $1`, [
      survey.id
    ]);

    const meta = await request(app).get(`/api/surveys/${survey.slug}`);
    expect(meta.body.status).toBe('closed');

    const otpReq = await request(app)
      .post(`/api/surveys/${survey.slug}/otp/request`)
      .send({ phone: '9876543210' });
    expect(otpReq.status).toBe(409);

    const results = await request(app).get(`/api/surveys/${survey.slug}/results`);
    expect(results.status).toBe(200);
    expect(results.body.status).toBe('closed');
  });
});

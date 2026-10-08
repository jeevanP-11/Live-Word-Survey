import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db';
import { signAdminToken } from '../lib/auth';
import { computeEndTime, computeStatus, generateSlug } from '../lib/survey';
import { getRespondentPhones, getSurveyResults } from '../lib/results';
import { requireAdmin } from '../middleware/authMiddleware';
import { isNonEmptyString } from '../lib/validate';

const router = Router();

// POST /api/admin/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!isNonEmptyString(username) || !isNonEmptyString(password)) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const { rows } = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);
  const admin = rows[0];
  if (!admin) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, admin.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signAdminToken(admin.username);
  return res.json({ token, username: admin.username });
});

// POST /api/admin/surveys
router.post('/surveys', requireAdmin, async (req, res) => {
  const { title, questions, durationMinutes } = req.body ?? {};

  if (!isNonEmptyString(title)) {
    return res.status(400).json({ error: 'title is required' });
  }
  if (!Array.isArray(questions) || questions.length < 1 || questions.length > 2) {
    return res.status(400).json({ error: 'Provide 1 or 2 questions' });
  }
  if (!questions.every((q) => isNonEmptyString(q?.text))) {
    return res.status(400).json({ error: 'Every question needs non-empty text' });
  }
  const duration = Number(durationMinutes);
  if (!Number.isFinite(duration) || duration <= 0) {
    return res.status(400).json({ error: 'durationMinutes must be a positive number' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: adminRows } = await client.query('SELECT id FROM admins WHERE username = $1', [
      req.admin!.username
    ]);
    const adminId = adminRows[0]?.id ?? null;

    let slug = generateSlug();
    // guard against the (rare) collision
    for (let attempt = 0; attempt < 5; attempt++) {
      const { rows: existing } = await client.query('SELECT 1 FROM surveys WHERE slug = $1', [slug]);
      if (existing.length === 0) break;
      slug = generateSlug();
    }

    const { rows: surveyRows } = await client.query(
      `INSERT INTO surveys (slug, title, created_by, start_time, duration_minutes)
       VALUES ($1, $2, $3, now(), $4) RETURNING *`,
      [slug, title, adminId, duration]
    );
    const survey = surveyRows[0];

    const insertedQuestions = [];
    for (let i = 0; i < questions.length; i++) {
      const { rows: qRows } = await client.query(
        `INSERT INTO questions (survey_id, text, order_index) VALUES ($1, $2, $3) RETURNING *`,
        [survey.id, questions[i].text.trim(), i]
      );
      insertedQuestions.push(qRows[0]);
    }

    await client.query('COMMIT');

    return res.status(201).json({
      id: survey.id,
      slug: survey.slug,
      title: survey.title,
      startTime: survey.start_time,
      durationMinutes: survey.duration_minutes,
      endTime: computeEndTime(survey),
      status: computeStatus(survey),
      questions: insertedQuestions.map((q) => ({ id: q.id, text: q.text, order: q.order_index })),
      shareUrl: `/s/${survey.slug}`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// GET /api/admin/surveys?status=active|closed
router.get('/surveys', requireAdmin, async (req, res) => {
  const statusFilter = req.query.status as string | undefined;
  const { rows } = await pool.query('SELECT * FROM surveys ORDER BY created_at DESC');

  const withStatus = rows.map((s) => ({
    id: s.id,
    slug: s.slug,
    title: s.title,
    startTime: s.start_time,
    durationMinutes: s.duration_minutes,
    endTime: computeEndTime(s),
    status: computeStatus(s),
    createdAt: s.created_at
  }));

  const filtered =
    statusFilter && (statusFilter === 'active' || statusFilter === 'closed')
      ? withStatus.filter((s) => s.status === statusFilter)
      : withStatus;

  return res.json({ surveys: filtered });
});

// GET /api/admin/surveys/:id
router.get('/surveys/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { rows } = await pool.query('SELECT * FROM surveys WHERE id = $1', [id]);
  const survey = rows[0];
  if (!survey) {
    return res.status(404).json({ error: 'Survey not found' });
  }

  const { rows: questions } = await pool.query(
    'SELECT id, text, order_index FROM questions WHERE survey_id = $1 ORDER BY order_index',
    [id]
  );

  const client = await pool.connect();
  let results;
  let phones;
  try {
    results = await getSurveyResults(client, id);
    phones = await getRespondentPhones(client, id);
  } finally {
    client.release();
  }

  return res.json({
    id: survey.id,
    slug: survey.slug,
    title: survey.title,
    startTime: survey.start_time,
    durationMinutes: survey.duration_minutes,
    endTime: computeEndTime(survey),
    status: computeStatus(survey),
    questions: questions.map((q) => ({ id: q.id, text: q.text, order: q.order_index })),
    results,
    respondentPhones: phones
  });
});

export default router;

import { Router } from 'express';
import pool from '../db';
import { computeEndTime, computeStatus } from '../lib/survey';
import { generateOtp, signSessionToken, OTP_EXPIRY_MS } from '../lib/auth';
import { normalizeWord, findBestCluster } from '../lib/fuzzy';
import { getSurveyResults } from '../lib/results';
import { requireRespondentSession } from '../middleware/authMiddleware';
import { isValidPhone, isValidOtp, isValidWord } from '../lib/validate';

const router = Router();

async function loadSurveyBySlug(slug: string) {
  const { rows } = await pool.query('SELECT * FROM surveys WHERE slug = $1', [slug]);
  return rows[0] ?? null;
}

// GET /api/surveys/:slug — public metadata
router.get('/:slug', async (req, res) => {
  const survey = await loadSurveyBySlug(req.params.slug);
  if (!survey) return res.status(404).json({ error: 'Survey not found' });

  const { rows: questions } = await pool.query(
    'SELECT id, text, order_index FROM questions WHERE survey_id = $1 ORDER BY order_index',
    [survey.id]
  );

  return res.json({
    id: survey.id,
    slug: survey.slug,
    title: survey.title,
    startTime: survey.start_time,
    endTime: computeEndTime(survey),
    status: computeStatus(survey),
    questions: questions.map((q) => ({ id: q.id, text: q.text, order: q.order_index }))
  });
});

// POST /api/surveys/:slug/otp/request
router.post('/:slug/otp/request', async (req, res) => {
  const survey = await loadSurveyBySlug(req.params.slug);
  if (!survey) return res.status(404).json({ error: 'Survey not found' });
  if (computeStatus(survey) === 'closed') {
    return res.status(409).json({ error: 'Survey is closed' });
  }

  const { phone } = req.body ?? {};
  if (!isValidPhone(phone)) {
    return res.status(400).json({ error: 'A valid phone number is required' });
  }
  const normalizedPhone = phone.trim();

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  // One active OTP per phone+survey: upsert overwrites/invalidates any previous one.
  await pool.query(
    `INSERT INTO otp_sessions (phone_number, survey_id, otp_code, expires_at, verified)
     VALUES ($1, $2, $3, $4, false)
     ON CONFLICT (phone_number, survey_id)
     DO UPDATE SET otp_code = EXCLUDED.otp_code, expires_at = EXCLUDED.expires_at, verified = false`,
    [normalizedPhone, survey.id, otp, expiresAt]
  );

  // Test-bed only: OTP is returned directly in the response, never do this with real SMS.
  return res.json({ otp, expiresAt, testBedNotice: 'OTP shown here for testing only — no SMS is sent.' });
});

// POST /api/surveys/:slug/otp/verify
router.post('/:slug/otp/verify', async (req, res) => {
  const survey = await loadSurveyBySlug(req.params.slug);
  if (!survey) return res.status(404).json({ error: 'Survey not found' });

  const { phone, otp } = req.body ?? {};
  if (!isValidPhone(phone) || !isValidOtp(otp)) {
    return res.status(400).json({ error: 'A valid phone and 6-digit otp are required' });
  }
  const normalizedPhone = phone.trim();

  const { rows } = await pool.query(
    'SELECT * FROM otp_sessions WHERE phone_number = $1 AND survey_id = $2',
    [normalizedPhone, survey.id]
  );
  const session = rows[0];
  if (!session) {
    return res.status(400).json({ error: 'No OTP requested for this phone number' });
  }
  if (new Date(session.expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: 'OTP has expired, please request a new one' });
  }
  if (session.otp_code !== otp.trim()) {
    return res.status(400).json({ error: 'Incorrect OTP' });
  }

  await pool.query('UPDATE otp_sessions SET verified = true WHERE id = $1', [session.id]);

  const token = signSessionToken(normalizedPhone, survey.id);
  return res.json({ token });
});

// POST /api/surveys/:slug/responses — { answers: [{ questionId, word }] }
router.post('/:slug/responses', requireRespondentSession, async (req, res) => {
  const survey = await loadSurveyBySlug(req.params.slug);
  if (!survey) return res.status(404).json({ error: 'Survey not found' });
  if (req.session!.surveyId !== survey.id) {
    return res.status(403).json({ error: 'Session does not match this survey' });
  }
  if (computeStatus(survey) === 'closed') {
    return res.status(409).json({ error: 'Survey is closed, no further submissions accepted' });
  }

  const { answers } = req.body ?? {};
  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: 'answers must be a non-empty array' });
  }
  for (const a of answers) {
    if (!isValidWord(a?.word) || typeof a?.questionId !== 'string') {
      return res.status(400).json({ error: 'Each answer needs a questionId and a non-empty word' });
    }
  }

  const phone = req.session!.phone;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: questionRows } = await client.query(
      'SELECT id FROM questions WHERE survey_id = $1',
      [survey.id]
    );
    const validQuestionIds = new Set(questionRows.map((q) => q.id));

    for (const a of answers) {
      if (!validQuestionIds.has(a.questionId)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `questionId ${a.questionId} does not belong to this survey` });
      }
    }

    // Reject if this phone has already answered any of these questions.
    const { rows: existing } = await client.query(
      `SELECT question_id FROM responses WHERE phone_number = $1 AND question_id = ANY($2::uuid[])`,
      [phone, answers.map((a: { questionId: string }) => a.questionId)]
    );
    if (existing.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: "You've already answered this survey" });
    }

    for (const a of answers) {
      const normalized = normalizeWord(a.word);
      if (!normalized) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Submitted word is empty after normalization' });
      }

      const { rows: clusters } = await client.query(
        'SELECT id, canonical_word FROM word_clusters WHERE question_id = $1',
        [a.questionId]
      );

      const match = findBestCluster(normalized, clusters);
      let clusterId: string;
      if (match) {
        clusterId = match.id;
        await client.query('UPDATE word_clusters SET count = count + 1 WHERE id = $1', [clusterId]);
      } else {
        const { rows: newCluster } = await client.query(
          `INSERT INTO word_clusters (question_id, canonical_word, count) VALUES ($1, $2, 1) RETURNING id`,
          [a.questionId, normalized]
        );
        clusterId = newCluster[0].id;
      }

      await client.query(
        `INSERT INTO responses (question_id, phone_number, raw_word, normalized_word, cluster_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [a.questionId, phone, a.word.trim(), normalized, clusterId]
      );
    }

    await client.query('COMMIT');
    return res.status(201).json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// GET /api/surveys/:slug/results — polled every 5s by respondent & admin views
router.get('/:slug/results', async (req, res) => {
  const survey = await loadSurveyBySlug(req.params.slug);
  if (!survey) return res.status(404).json({ error: 'Survey not found' });

  const client = await pool.connect();
  try {
    const results = await getSurveyResults(client, survey.id);
    return res.json({
      slug: survey.slug,
      title: survey.title,
      status: computeStatus(survey),
      endTime: computeEndTime(survey),
      results
    });
  } finally {
    client.release();
  }
});

export default router;

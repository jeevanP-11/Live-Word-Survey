import { PoolClient } from 'pg';

export interface ClusterResult {
  word: string;
  count: number;
  percentage: number;
}

export interface QuestionResult {
  questionId: string;
  text: string;
  totalResponses: number;
  clusters: ClusterResult[];
}

/** Compute live/final aggregated results for every question in a survey. */
export async function getSurveyResults(db: PoolClient, surveyId: string): Promise<QuestionResult[]> {
  const { rows: questions } = await db.query(
    `SELECT id, text FROM questions WHERE survey_id = $1 ORDER BY order_index ASC`,
    [surveyId]
  );

  const results: QuestionResult[] = [];
  for (const q of questions) {
    const { rows: clusters } = await db.query(
      `SELECT canonical_word, count FROM word_clusters
       WHERE question_id = $1 AND count > 0
       ORDER BY count DESC`,
      [q.id]
    );
    const total = clusters.reduce((sum: number, c: { count: number }) => sum + c.count, 0);
    results.push({
      questionId: q.id,
      text: q.text,
      totalResponses: total,
      clusters: clusters.map((c: { canonical_word: string; count: number }) => ({
        word: c.canonical_word,
        count: c.count,
        percentage: total > 0 ? Math.round((c.count / total) * 1000) / 10 : 0
      }))
    });
  }
  return results;
}

/** Distinct respondent phone numbers across all questions of a survey. */
export async function getRespondentPhones(db: PoolClient, surveyId: string): Promise<string[]> {
  const { rows } = await db.query(
    `SELECT DISTINCT r.phone_number FROM responses r
     JOIN questions q ON q.id = r.question_id
     WHERE q.survey_id = $1
     ORDER BY r.phone_number`,
    [surveyId]
  );
  return rows.map((r: { phone_number: string }) => r.phone_number);
}

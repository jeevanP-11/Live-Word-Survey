export type SurveyStatus = 'active' | 'closed';

export interface SurveyTiming {
  start_time: Date | string;
  duration_minutes: number;
}

export function computeEndTime(survey: SurveyTiming): Date {
  const start = new Date(survey.start_time);
  return new Date(start.getTime() + survey.duration_minutes * 60 * 1000);
}

export function computeStatus(survey: SurveyTiming, now: Date = new Date()): SurveyStatus {
  const end = computeEndTime(survey);
  return now.getTime() >= end.getTime() ? 'closed' : 'active';
}

const ADJECTIVES = ['quick', 'bright', 'calm', 'bold', 'sunny', 'lively', 'keen', 'brisk'];
const NOUNS = ['otter', 'maple', 'comet', 'harbor', 'ember', 'canyon', 'willow', 'pixel'];

/** Generate a short, URL-safe, human-friendly slug e.g. "bold-otter-4821". */
export function generateSlug(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${adj}-${noun}-${num}`;
}

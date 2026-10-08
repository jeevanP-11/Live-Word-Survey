import { computeEndTime, computeStatus, generateSlug } from '../lib/survey';

describe('computeEndTime', () => {
  it('adds duration_minutes to start_time', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const end = computeEndTime({ start_time: start, duration_minutes: 30 });
    expect(end.toISOString()).toBe('2026-01-01T00:30:00.000Z');
  });
});

describe('computeStatus', () => {
  const start = new Date('2026-01-01T00:00:00Z');
  const survey = { start_time: start, duration_minutes: 10 };

  it('is active before the window elapses', () => {
    const now = new Date('2026-01-01T00:05:00Z');
    expect(computeStatus(survey, now)).toBe('active');
  });

  it('is active at the exact start', () => {
    expect(computeStatus(survey, start)).toBe('active');
  });

  it('is closed exactly at end_time', () => {
    const now = new Date('2026-01-01T00:10:00Z');
    expect(computeStatus(survey, now)).toBe('closed');
  });

  it('is closed after the window elapses', () => {
    const now = new Date('2026-01-01T01:00:00Z');
    expect(computeStatus(survey, now)).toBe('closed');
  });
});

describe('generateSlug', () => {
  it('produces a url-safe adjective-noun-number slug', () => {
    const slug = generateSlug();
    expect(slug).toMatch(/^[a-z]+-[a-z]+-\d{4}$/);
  });

  it('has some entropy across repeated calls', () => {
    const slugs = new Set(Array.from({ length: 20 }, () => generateSlug()));
    expect(slugs.size).toBeGreaterThan(1);
  });
});

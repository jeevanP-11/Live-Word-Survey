const API_BASE = '/api';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {})
    }
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : undefined;
  if (!res.ok) {
    throw new ApiError(body?.error ?? `Request failed with status ${res.status}`, res.status);
  }
  return body as T;
}

export interface Question {
  id: string;
  text: string;
  order: number;
}

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

export interface SurveySummary {
  id: string;
  slug: string;
  title: string;
  startTime: string;
  durationMinutes: number;
  endTime: string;
  status: 'active' | 'closed';
}

export interface SurveyDetail extends SurveySummary {
  questions: Question[];
  results: QuestionResult[];
  respondentPhones: string[];
}

export interface PublicSurvey {
  id: string;
  slug: string;
  title: string;
  startTime: string;
  endTime: string;
  status: 'active' | 'closed';
  questions: Question[];
}

export interface ResultsResponse {
  slug: string;
  title: string;
  status: 'active' | 'closed';
  endTime: string;
  results: QuestionResult[];
}

// ---- Admin ----

export function adminLogin(username: string, password: string) {
  return request<{ token: string; username: string }>('/admin/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
}

export function createSurvey(
  token: string,
  payload: { title: string; questions: { text: string }[]; durationMinutes: number }
) {
  return request<SurveyDetail & { shareUrl: string }>('/admin/surveys', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
}

export function listSurveys(token: string, status?: 'active' | 'closed') {
  const qs = status ? `?status=${status}` : '';
  return request<{ surveys: SurveySummary[] }>(`/admin/surveys${qs}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export function getSurveyDetail(token: string, id: string) {
  return request<SurveyDetail>(`/admin/surveys/${id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

// ---- Public / respondent ----

export function getPublicSurvey(slug: string) {
  return request<PublicSurvey>(`/surveys/${slug}`);
}

export function requestOtp(slug: string, phone: string) {
  return request<{ otp: string; expiresAt: string; testBedNotice: string }>(
    `/surveys/${slug}/otp/request`,
    { method: 'POST', body: JSON.stringify({ phone }) }
  );
}

export function verifyOtp(slug: string, phone: string, otp: string) {
  return request<{ token: string }>(`/surveys/${slug}/otp/verify`, {
    method: 'POST',
    body: JSON.stringify({ phone, otp })
  });
}

export function submitResponses(
  slug: string,
  sessionToken: string,
  answers: { questionId: string; word: string }[]
) {
  return request<{ success: true }>(`/surveys/${slug}/responses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ answers })
  });
}

export function getResults(slug: string) {
  return request<ResultsResponse>(`/surveys/${slug}/results`);
}

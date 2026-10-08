-- Live Word Survey — initial schema

CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  created_by UUID REFERENCES admins(id),
  start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS word_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  canonical_word TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  raw_word TEXT NOT NULL,
  normalized_word TEXT NOT NULL,
  cluster_id UUID NOT NULL REFERENCES word_clusters(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (question_id, phone_number)
);

CREATE TABLE IF NOT EXISTS otp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (phone_number, survey_id)
);

CREATE INDEX IF NOT EXISTS idx_questions_survey ON questions(survey_id);
CREATE INDEX IF NOT EXISTS idx_clusters_question ON word_clusters(question_id);
CREATE INDEX IF NOT EXISTS idx_responses_question ON responses(question_id);
CREATE INDEX IF NOT EXISTS idx_responses_phone ON responses(phone_number);

CREATE EXTENSION IF NOT EXISTS pgcrypto;

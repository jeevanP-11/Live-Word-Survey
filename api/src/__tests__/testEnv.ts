process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://survey:survey@localhost:5433/survey_test';
process.env.JWT_SECRET = 'test-secret';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'admin-test-password';
process.env.FUZZY_MATCH_THRESHOLD = '0.8';
process.env.OTP_EXPIRY_MINUTES = '2';
process.env.SESSION_TOKEN_TTL = '30m';
process.env.ADMIN_TOKEN_TTL = '4h';

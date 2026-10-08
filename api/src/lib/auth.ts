import jwt, { SignOptions } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me';
// jsonwebtoken's types require a branded string/number for `expiresIn`; since
// these come from free-form env vars (e.g. "4h", "30m"), we cast at the
// boundary rather than fight the branded type through the whole module.
const ADMIN_TOKEN_TTL = (process.env.ADMIN_TOKEN_TTL ?? '4h') as SignOptions['expiresIn'];
const SESSION_TOKEN_TTL = (process.env.SESSION_TOKEN_TTL ?? '30m') as SignOptions['expiresIn'];

export interface AdminTokenPayload {
  role: 'admin';
  username: string;
}

export interface SessionTokenPayload {
  role: 'respondent';
  phone: string;
  surveyId: string;
}

export function signAdminToken(username: string): string {
  const payload: AdminTokenPayload = { role: 'admin', username };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ADMIN_TOKEN_TTL });
}

export function signSessionToken(phone: string, surveyId: string): string {
  const payload: SessionTokenPayload = { role: 'respondent', phone, surveyId };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: SESSION_TOKEN_TTL });
}

export function verifyToken<T>(token: string): T {
  return jwt.verify(token, JWT_SECRET) as T;
}

/** Generate a 6-digit numeric OTP as a zero-padded string. */
export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const OTP_EXPIRY_MS = Number(process.env.OTP_EXPIRY_MINUTES ?? 2) * 60 * 1000;

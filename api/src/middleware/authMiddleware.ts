import { NextFunction, Request, Response } from 'express';
import { AdminTokenPayload, SessionTokenPayload, verifyToken } from '../lib/auth';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminTokenPayload;
      session?: SessionTokenPayload;
    }
  }
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing admin token' });
  }
  try {
    const payload = verifyToken<AdminTokenPayload>(token);
    if (payload.role !== 'admin') {
      return res.status(403).json({ error: 'Not an admin token' });
    }
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired admin token' });
  }
}

/**
 * Requires a respondent session token scoped to the survey identified by
 * req.params.slug via req.surveyId (set by an earlier lookup middleware).
 */
export function requireRespondentSession(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing session token. Verify OTP first.' });
  }
  try {
    const payload = verifyToken<SessionTokenPayload>(token);
    if (payload.role !== 'respondent') {
      return res.status(403).json({ error: 'Not a respondent token' });
    }
    req.session = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }
}

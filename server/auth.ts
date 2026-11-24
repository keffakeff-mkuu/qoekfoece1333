import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { db } from './db.ts';

export type OrgRole =
  | 'owner'
  | 'admin'
  | 'operations_manager'
  | 'hr_manager'
  | 'supervisor'
  | 'guard'
  | 'finance_manager'
  | 'client';

export interface SessionClaims {
  userId: string;
  orgId: string | null;
  isDemo: boolean;
  exp: number;
}

export interface AuthContext {
  userId: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  orgId: string | null;
  role: OrgRole | null;
  clientId?: string | null;
  isDemo: boolean;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (derivedBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(derivedBuf, expectedBuf);
}

export function signSessionToken(claims: Omit<SessionClaims, 'exp'>): string {
  const fullClaims: SessionClaims = {
    ...claims,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
  };
  const payload = Buffer.from(JSON.stringify(fullClaims), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): SessionClaims | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionClaims;
    if (!decoded.userId || typeof decoded.exp !== 'number' || decoded.exp < Date.now()) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  const claims = verifySessionToken(token);
  if (!claims) {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return;
  }

  const user = db
    .prepare('SELECT id, email, full_name, phone_number FROM users WHERE id = ?')
    .get(claims.userId) as
    | { id: string; email: string; full_name: string; phone_number: string | null }
    | undefined;

  if (!user) {
    res.status(401).json({ error: 'User account not found.' });
    return;
  }

  let orgId = claims.orgId;
  let role: OrgRole | null = null;
  let clientId: string | null = null;

  if (orgId) {
    const membership = db
      .prepare('SELECT role, client_id, status FROM organization_memberships WHERE organization_id = ? AND user_id = ?')
      .get(orgId, user.id) as { role: OrgRole; client_id: string | null; status: string } | undefined;
    if (!membership || membership.status !== 'active') {
      orgId = null;
    } else {
      role = membership.role;
      clientId = membership.client_id ?? null;
    }
  } else {
    const firstMembership = db
      .prepare("SELECT organization_id, role, client_id FROM organization_memberships WHERE user_id = ? AND status = 'active' LIMIT 1")
      .get(user.id) as { organization_id: string; role: OrgRole; client_id: string | null } | undefined;
    if (firstMembership) {
      orgId = firstMembership.organization_id;
      role = firstMembership.role;
      clientId = firstMembership.client_id ?? null;
    }
  }

  req.auth = {
    userId: user.id,
    email: user.email,
    fullName: user.full_name,
    phoneNumber: user.phone_number || '',
    orgId,
    role,
    clientId,
    isDemo: Boolean(claims.isDemo && orgId === 'org-nairobi-001'),
  };

  next();
}

export function requireOrg(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth || !req.auth.orgId || !req.auth.role) {
    res.status(403).json({ error: 'Active organisation membership is required.' });
    return;
  }
  next();
}

export function hasRole(req: Request, allowed: OrgRole[]): boolean {
  return Boolean(req.auth?.role && allowed.includes(req.auth.role));
}

import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { db, dbPath, initDatabase, writeAuditEvent } from './server/db.ts';
import {
  hasRole,
  hashPassword,
  requireAuth,
  requireOrg,
  signSessionToken,
  verifyPassword,
  type OrgRole,
} from './server/auth.ts';
import { fieldforceRouter, haversineMeters, validatePhotoData } from './server/fieldforceRoutes.ts';

initDatabase();

const app = express();
app.use(express.json({ limit: '2mb' }));

const DEMO_ROLE_USER_MAP: Record<OrgRole, string> = {
  owner: 'usr-demo-owner',
  admin: 'usr-demo-owner',
  operations_manager: 'usr-demo-ops',
  hr_manager: 'usr-demo-hr',
  supervisor: 'usr-demo-sup',
  guard: 'usr-demo-guard',
  finance_manager: 'usr-demo-owner',
  client: 'usr-demo-client',
};

function getGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function redactPIIForPrompt(text: string): string {
  return text
    .replace(/\+?\d[\d\s\-()]{7,}\d/g, '[REDACTED_PHONE]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]');
}

function getOrgPayload(orgId: string | null) {
  if (!orgId) return null;
  const row = db
    .prepare('SELECT id, name, legal_name, country_code, timezone, currency, is_active, is_demo FROM organizations WHERE id = ?')
    .get(orgId) as
    | {
        id: string;
        name: string;
        legal_name: string | null;
        country_code: string;
        timezone: string;
        currency: string;
        is_active: number;
        is_demo: number;
      }
    | undefined;
  if (!row) return null;
  return {
    ...row,
    is_active: Boolean(row.is_active),
    is_demo: Boolean(row.is_demo),
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timezone: 'Africa/Nairobi' });
});

// ==================== AUTH & ONBOARDING ====================

app.post('/api/auth/register', (req, res) => {
  const schema = z.object({
    email: z.string().trim().email(),
    password: z.string().min(8),
    fullName: z.string().trim().min(2).max(120),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid registration fields.' });
    return;
  }
  const email = parsed.data.email.toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const userId = `usr-${crypto.randomUUID().slice(0, 12)}`;
  const pwHash = hashPassword(parsed.data.password);
  db.prepare('INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)').run(
    userId,
    email,
    pwHash,
    parsed.data.fullName
  );

  const token = signSessionToken({ userId, orgId: null, isDemo: false });
  res.status(201).json({
    token,
    user: { id: userId, email, fullName: parsed.data.fullName, phoneNumber: '' },
    organization: null,
    role: null,
    isDemo: false,
  });
});

app.post('/api/auth/login', (req, res) => {
  const schema = z.object({
    email: z.string().trim().email(),
    password: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Valid email and password are required.' });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  const user = db
    .prepare('SELECT id, email, password_hash, full_name, phone_number FROM users WHERE email = ?')
    .get(email) as
    | { id: string; email: string; password_hash: string; full_name: string; phone_number: string | null }
    | undefined;

  if (!user || !verifyPassword(parsed.data.password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const membership = db
    .prepare("SELECT organization_id, role FROM organization_memberships WHERE user_id = ? AND status = 'active' LIMIT 1")
    .get(user.id) as { organization_id: string; role: OrgRole } | undefined;

  const orgId = membership?.organization_id ?? null;
  const role = membership?.role ?? null;
  const token = signSessionToken({ userId: user.id, orgId, isDemo: false });

  res.json({
    token,
    user: { id: user.id, email: user.email, fullName: user.full_name, phoneNumber: user.phone_number || '' },
    organization: getOrgPayload(orgId),
    role,
    isDemo: false,
  });
});

app.post('/api/auth/demo-session', (req, res) => {
  const requestedRole = (req.body?.role as OrgRole) || 'owner';
  const validRoles: OrgRole[] = ['owner', 'admin', 'operations_manager', 'hr_manager', 'supervisor', 'guard', 'finance_manager', 'client'];
  const role: OrgRole = validRoles.includes(requestedRole) ? requestedRole : 'owner';
  const userId = DEMO_ROLE_USER_MAP[role];
  const orgId = 'org-nairobi-001';

  const user = db
    .prepare('SELECT id, email, full_name, phone_number FROM users WHERE id = ?')
    .get(userId) as { id: string; email: string; full_name: string; phone_number: string | null } | undefined;

  if (!user) {
    res.status(500).json({ error: 'Demo sandbox user not found.' });
    return;
  }

  const token = signSessionToken({ userId: user.id, orgId, isDemo: true });
  res.json({
    token,
    user: { id: user.id, email: user.email, fullName: user.full_name, phoneNumber: user.phone_number || '' },
    organization: getOrgPayload(orgId),
    role,
    isDemo: true,
  });
});

app.post('/api/auth/demo-role', requireAuth, (req, res) => {
  if (!req.auth?.isDemo) {
    res.status(403).json({ error: 'Role switching is restricted to the Demo Sandbox.' });
    return;
  }
  const role = req.body?.role as OrgRole;
  const userId = DEMO_ROLE_USER_MAP[role];
  if (!userId) {
    res.status(400).json({ error: 'Unsupported role.' });
    return;
  }
  const user = db
    .prepare('SELECT id, email, full_name, phone_number FROM users WHERE id = ?')
    .get(userId) as { id: string; email: string; full_name: string; phone_number: string | null };

  const token = signSessionToken({ userId: user.id, orgId: 'org-nairobi-001', isDemo: true });
  res.json({
    token,
    user: { id: user.id, email: user.email, fullName: user.full_name, phoneNumber: user.phone_number || '' },
    organization: getOrgPayload('org-nairobi-001'),
    role,
    isDemo: true,
  });
});

app.post('/api/auth/forgot-password', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) {
    res.status(400).json({ error: 'Email is required.' });
    return;
  }
  const user = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(email) as
    | { id: string; password_hash: string }
    | undefined;

  let previewToken: string | null = null;
  if (user && !user.password_hash.startsWith('DEMO_LOCKED_')) {
    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString();
    db.prepare('INSERT INTO password_resets (id, email, token, expires_at) VALUES (?, ?, ?, ?)').run(
      `rst-${crypto.randomUUID().slice(0, 10)}`,
      email,
      token,
      expiresAt
    );
    previewToken = token;
  }

  res.json({
    message: 'If an account exists for that email, reset instructions have been issued.',
    previewResetToken: process.env.NODE_ENV !== 'production' ? previewToken : undefined,
  });
});

app.post('/api/auth/reset-password', (req, res) => {
  const schema = z.object({
    token: z.string().min(6),
    password: z.string().min(8),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Valid reset token and password (min 8 chars) are required.' });
    return;
  }

  const resetRow = db
    .prepare('SELECT id, email, expires_at, used FROM password_resets WHERE token = ?')
    .get(parsed.data.token) as { id: string; email: string; expires_at: string; used: number } | undefined;

  if (!resetRow || resetRow.used || new Date(resetRow.expires_at).getTime() < Date.now()) {
    res.status(400).json({ error: 'Reset token is invalid or expired.' });
    return;
  }

  const newHash = hashPassword(parsed.data.password);
  const tx = db.transaction(() => {
    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE email = ?").run(newHash, resetRow.email);
    db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(resetRow.id);
  });
  tx();

  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.auth!.userId,
      email: req.auth!.email,
      fullName: req.auth!.fullName,
      phoneNumber: req.auth!.phoneNumber,
    },
    organization: getOrgPayload(req.auth!.orgId),
    role: req.auth!.role,
    isDemo: req.auth!.isDemo,
  });
});

app.patch('/api/profile', requireAuth, (req, res) => {
  const schema = z.object({
    fullName: z.string().trim().min(2).max(120),
    phoneNumber: z.string().trim().max(30).optional(),
    newPassword: z.string().min(8).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid profile input.' });
    return;
  }
  if (parsed.data.newPassword && req.auth!.isDemo) {
    res.status(403).json({ error: 'Password changes are disabled on Demo Sandbox accounts.' });
    return;
  }
  db.prepare("UPDATE users SET full_name = ?, phone_number = ?, updated_at = datetime('now') WHERE id = ?").run(
    parsed.data.fullName,
    parsed.data.phoneNumber ?? '',
    req.auth!.userId
  );
  if (parsed.data.newPassword) {
    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(
      hashPassword(parsed.data.newPassword),
      req.auth!.userId
    );
  }
  res.json({
    user: {
      id: req.auth!.userId,
      email: req.auth!.email,
      fullName: parsed.data.fullName,
      phoneNumber: parsed.data.phoneNumber ?? '',
    },
  });
});

app.post('/api/organizations', requireAuth, (req, res) => {
  const schema = z.object({
    name: z.string().trim().min(2).max(120),
    legalName: z.string().trim().max(160).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Organisation trading name is required.' });
    return;
  }

  const orgId = `org-${crypto.randomUUID().slice(0, 12)}`;
  const memId = `mem-${crypto.randomUUID().slice(0, 12)}`;
  const entId = `ent-${crypto.randomUUID().slice(0, 12)}`;

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO organizations (id, name, legal_name, country_code, timezone, currency, is_active, is_demo, created_by)
      VALUES (?, ?, ?, 'KE', 'Africa/Nairobi', 'KES', 1, 0, ?)
    `).run(orgId, parsed.data.name, parsed.data.legalName || null, req.auth!.userId);

    db.prepare(`
      INSERT INTO organization_memberships (id, organization_id, user_id, role, status)
      VALUES (?, ?, ?, 'owner', 'active')
    `).run(memId, orgId, req.auth!.userId);

    db.prepare(`
      INSERT INTO organization_app_entitlements (id, organization_id, product_id, status, enabled_at)
      VALUES (?, ?, 'prod-01', 'active', datetime('now'))
    `).run(entId, orgId);

    writeAuditEvent({
      organizationId: orgId,
      actorId: req.auth!.userId,
      actorName: req.auth!.fullName,
      action: 'organization.created',
      entityType: 'organizations',
      entityId: orgId,
      metadata: { name: parsed.data.name },
    });
  });
  tx();

  const token = signSessionToken({ userId: req.auth!.userId, orgId, isDemo: false });
  res.status(201).json({
    token,
    organization: getOrgPayload(orgId),
    role: 'owner' as OrgRole,
    isDemo: false,
  });
});

app.patch('/api/organizations/current', requireAuth, requireOrg, (req, res) => {
  if (!hasRole(req, ['owner', 'admin'])) {
    res.status(403).json({ error: 'Only Owners or Admins can update organisation settings.' });
    return;
  }
  const schema = z.object({
    name: z.string().trim().min(2).max(120),
    legal_name: z.string().trim().max(160).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid organisation details.' });
    return;
  }

  db.prepare("UPDATE organizations SET name = ?, legal_name = ?, updated_at = datetime('now') WHERE id = ?").run(
    parsed.data.name,
    parsed.data.legal_name ?? null,
    req.auth!.orgId
  );

  writeAuditEvent({
    organizationId: req.auth!.orgId!,
    actorId: req.auth!.userId,
    actorName: req.auth!.fullName,
    action: 'organization.updated',
    entityType: 'organizations',
    entityId: req.auth!.orgId,
    metadata: { name: parsed.data.name },
  });

  res.json({ organization: getOrgPayload(req.auth!.orgId) });
});

// ==================== CATALOGUE, MEMBERS & AUDIT ====================

app.get('/api/catalog', (req, res) => {
  const products = db
    .prepare('SELECT id, slug, name, category, short_description, display_order, status, launch_action FROM product_catalog ORDER BY display_order ASC')
    .all();

  let entitlements: Array<{ product_id: string; slug: string; status: string }> = [];
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    // Optionally attach org entitlements if authenticated
    requireAuth(req, res, () => {
      if (req.auth?.orgId) {
        entitlements = db
          .prepare(`
            SELECT e.product_id, p.slug, e.status
            FROM organization_app_entitlements e
            JOIN product_catalog p ON p.id = e.product_id
            WHERE e.organization_id = ?
          `)
          .all(req.auth.orgId) as Array<{ product_id: string; slug: string; status: string }>;
      }
      res.json({ products, entitlements });
    });
    return;
  }

  res.json({ products, entitlements });
});

app.post('/api/entitlements/waitlist', requireAuth, requireOrg, (req, res) => {
  const slug = String(req.body?.slug || '').trim();
  if (!slug || slug === 'fieldforce') {
    res.status(400).json({ error: 'Waitlist applies only to upcoming suite products.' });
    return;
  }
  const product = db.prepare('SELECT id, name FROM product_catalog WHERE slug = ?').get(slug) as
    | { id: string; name: string }
    | undefined;
  if (!product) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  const existing = db
    .prepare('SELECT id, status FROM organization_app_entitlements WHERE organization_id = ? AND product_id = ?')
    .get(req.auth!.orgId, product.id) as { id: string; status: string } | undefined;

  let waitlisted = false;
  if (existing && existing.status === 'waitlisted') {
    db.prepare('DELETE FROM organization_app_entitlements WHERE id = ?').run(existing.id);
    waitlisted = false;
  } else if (!existing) {
    db.prepare(`
      INSERT INTO organization_app_entitlements (id, organization_id, product_id, status)
      VALUES (?, ?, ?, 'waitlisted')
    `).run(`ent-${crypto.randomUUID().slice(0, 12)}`, req.auth!.orgId, product.id);
    waitlisted = true;
  }

  writeAuditEvent({
    organizationId: req.auth!.orgId!,
    actorId: req.auth!.userId,
    actorName: req.auth!.fullName,
    action: waitlisted ? 'catalog.waitlist_joined' : 'catalog.waitlist_removed',
    entityType: 'organization_app_entitlements',
    entityId: product.id,
    metadata: { slug, product: product.name },
  });

  const entitlements = db
    .prepare(`
      SELECT e.product_id, p.slug, e.status
      FROM organization_app_entitlements e
      JOIN product_catalog p ON p.id = e.product_id
      WHERE e.organization_id = ?
    `)
    .all(req.auth!.orgId);

  res.json({ waitlisted, entitlements });
});

app.get('/api/members', requireAuth, requireOrg, (req, res) => {
  const isRestricted = req.auth!.role === 'guard' || req.auth!.role === 'client';
  const rows = isRestricted
    ? db
        .prepare(`
          SELECT m.id, m.organization_id, m.user_id, m.role, m.client_id, m.status, u.full_name, u.email
          FROM organization_memberships m
          JOIN users u ON u.id = m.user_id
          WHERE m.organization_id = ? AND m.user_id = ?
        `)
        .all(req.auth!.orgId, req.auth!.userId)
    : db
        .prepare(`
          SELECT m.id, m.organization_id, m.user_id, m.role, m.client_id, m.status, u.full_name, u.email
          FROM organization_memberships m
          JOIN users u ON u.id = m.user_id
          WHERE m.organization_id = ?
          ORDER BY m.created_at ASC
        `)
        .all(req.auth!.orgId);

  res.json({ members: rows });
});

app.post('/api/members', requireAuth, requireOrg, (req, res) => {
  if (!hasRole(req, ['owner', 'admin'])) {
    res.status(403).json({ error: 'Only Owners or Admins can invite team members.' });
    return;
  }
  const schema = z.object({
    fullName: z.string().trim().min(2),
    email: z.string().trim().email(),
    role: z.enum(['owner', 'admin', 'operations_manager', 'hr_manager', 'supervisor', 'guard', 'finance_manager', 'client']),
    client_id: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Valid name, email, and role are required.' });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  let user = db.prepare('SELECT id, full_name, email FROM users WHERE email = ?').get(email) as
    | { id: string; full_name: string; email: string }
    | undefined;

  if (!user) {
    const newUserId = `usr-${crypto.randomUUID().slice(0, 12)}`;
    const inviteTempHash = 'INVITE_PENDING_' + crypto.randomBytes(16).toString('hex');
    db.prepare('INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)').run(
      newUserId,
      email,
      inviteTempHash,
      parsed.data.fullName
    );
    user = { id: newUserId, full_name: parsed.data.fullName, email };
  }

  const exists = db
    .prepare('SELECT id FROM organization_memberships WHERE organization_id = ? AND user_id = ?')
    .get(req.auth!.orgId, user.id);
  if (exists) {
    res.status(409).json({ error: 'User is already a member of this organisation.' });
    return;
  }

  const memId = `mem-${crypto.randomUUID().slice(0, 12)}`;
  db.prepare(`
    INSERT INTO organization_memberships (id, organization_id, user_id, role, client_id, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `).run(memId, req.auth!.orgId, user.id, parsed.data.role, parsed.data.client_id ?? null);

  writeAuditEvent({
    organizationId: req.auth!.orgId!,
    actorId: req.auth!.userId,
    actorName: req.auth!.fullName,
    action: 'member.invited',
    entityType: 'organization_memberships',
    entityId: memId,
    metadata: { email, role: parsed.data.role },
  });

  res.status(201).json({
    member: {
      id: memId,
      organization_id: req.auth!.orgId,
      user_id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: parsed.data.role,
      client_id: parsed.data.client_id ?? null,
      status: 'active',
    },
  });
});

app.patch('/api/members/:id/role', requireAuth, requireOrg, (req, res) => {
  if (!hasRole(req, ['owner', 'admin'])) {
    res.status(403).json({ error: 'Only Owners or Admins can modify roles.' });
    return;
  }
  const schema = z.object({
    role: z.enum(['owner', 'admin', 'operations_manager', 'hr_manager', 'supervisor', 'guard', 'finance_manager', 'client']),
    client_id: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid role.' });
    return;
  }

  const target = db
    .prepare('SELECT id, user_id FROM organization_memberships WHERE id = ? AND organization_id = ?')
    .get(req.params.id, req.auth!.orgId) as { id: string; user_id: string } | undefined;
  if (!target) {
    res.status(404).json({ error: 'Membership not found.' });
    return;
  }

  db.prepare("UPDATE organization_memberships SET role = ?, client_id = COALESCE(?, client_id), updated_at = datetime('now') WHERE id = ?").run(
    parsed.data.role,
    parsed.data.client_id === undefined ? null : parsed.data.client_id,
    target.id
  );

  writeAuditEvent({
    organizationId: req.auth!.orgId!,
    actorId: req.auth!.userId,
    actorName: req.auth!.fullName,
    action: 'member.role_updated',
    entityType: 'organization_memberships',
    entityId: target.id,
    metadata: { role: parsed.data.role },
  });

  res.json({ ok: true });
});

app.get('/api/audit-events', requireAuth, requireOrg, (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'operations_manager', 'hr_manager'])) {
    res.status(403).json({ error: 'Audit logs are restricted to management roles.' });
    return;
  }
  const rows = db
    .prepare('SELECT id, organization_id, actor_id, actor_name, action, entity_type, entity_id, metadata, created_at FROM audit_events WHERE organization_id = ? ORDER BY created_at DESC LIMIT 200')
    .all(req.auth!.orgId) as Array<{
    id: string;
    organization_id: string;
    actor_id: string;
    actor_name: string;
    action: string;
    entity_type: string;
    entity_id: string | null;
    metadata: string;
    created_at: string;
  }>;

  res.json({
    auditEvents: rows.map((r) => ({
      ...r,
      metadata: JSON.parse(r.metadata || '{}'),
    })),
  });
});

// ==================== FIELDFORCE BOOTSTRAP & MASTER DATA ====================

app.use('/api/fieldforce', requireAuth, requireOrg, fieldforceRouter);

app.get('/api/fieldforce/bootstrap', requireAuth, requireOrg, (req, res) => {
  const orgId = req.auth!.orgId!;
  const role = req.auth!.role!;
  const userId = req.auth!.userId;
  const clientIdScope = req.auth!.clientId ?? null;

  let employees = db
    .prepare('SELECT * FROM ff_employees WHERE organization_id = ? ORDER BY created_at DESC')
    .all(orgId) as Array<Record<string, unknown>>;

  let clients = db
    .prepare('SELECT * FROM ff_clients WHERE organization_id = ? ORDER BY created_at DESC')
    .all(orgId) as Array<Record<string, unknown>>;

  let sites = db
    .prepare('SELECT * FROM ff_sites WHERE organization_id = ? ORDER BY created_at DESC')
    .all(orgId) as Array<Record<string, unknown>>;

  let posts = db
    .prepare('SELECT * FROM ff_posts WHERE organization_id = ? ORDER BY created_at ASC')
    .all(orgId) as Array<Record<string, unknown>>;

  const siteSupervisors = db
    .prepare('SELECT * FROM ff_site_supervisors WHERE organization_id = ?')
    .all(orgId) as Array<{ id: string; organization_id: string; site_id: string; user_id: string }>;

  let shifts = db
    .prepare('SELECT * FROM ff_shifts WHERE organization_id = ? ORDER BY shift_date DESC, start_time ASC')
    .all(orgId) as Array<Record<string, unknown>>;

  let assignments = db
    .prepare('SELECT * FROM ff_assignments WHERE organization_id = ?')
    .all(orgId) as Array<Record<string, unknown>>;

  let attendance = db
    .prepare('SELECT * FROM ff_attendance_events WHERE organization_id = ? ORDER BY recorded_at DESC')
    .all(orgId) as Array<Record<string, unknown>>;

  let incidents = db
    .prepare('SELECT * FROM ff_incidents WHERE organization_id = ? ORDER BY occurrence_time DESC')
    .all(orgId) as Array<Record<string, unknown>>;

  let contracts = db.prepare('SELECT * FROM ff_employee_contracts WHERE organization_id = ? ORDER BY start_date DESC').all(orgId) as Array<Record<string, unknown>>;
  let documents = db.prepare('SELECT * FROM ff_employee_documents WHERE organization_id = ? ORDER BY expiry_date ASC').all(orgId) as Array<Record<string, unknown>>;
  let qualifications = db.prepare('SELECT * FROM ff_employee_qualifications WHERE organization_id = ? ORDER BY achieved_date DESC').all(orgId) as Array<Record<string, unknown>>;
  let leaveRecords = db.prepare('SELECT * FROM ff_leave_records WHERE organization_id = ? ORDER BY created_at DESC').all(orgId) as Array<Record<string, unknown>>;
  let disciplinaryRecords = db.prepare('SELECT * FROM ff_disciplinary_records WHERE organization_id = ? ORDER BY incident_date DESC').all(orgId) as Array<Record<string, unknown>>;
  let attendanceVerifications = db.prepare('SELECT * FROM ff_attendance_verifications WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>;
  let patrolCheckpoints = db.prepare('SELECT * FROM ff_patrol_checkpoints WHERE organization_id = ? ORDER BY sequence_order ASC').all(orgId) as Array<Record<string, unknown>>;
  let patrolSchedules = db.prepare('SELECT * FROM ff_patrol_schedules WHERE organization_id = ? ORDER BY created_at DESC').all(orgId) as Array<Record<string, unknown>>;
  let patrolScans = db.prepare('SELECT * FROM ff_patrol_scans WHERE organization_id = ? ORDER BY scanned_at DESC').all(orgId) as Array<Record<string, unknown>>;
  let payrollRuns = db.prepare('SELECT * FROM ff_payroll_runs WHERE organization_id = ? ORDER BY created_at DESC').all(orgId) as Array<Record<string, unknown>>;
  let payslips = db.prepare('SELECT * FROM ff_payslips WHERE organization_id = ? ORDER BY created_at DESC').all(orgId) as Array<Record<string, unknown>>;
  let clientContracts = db.prepare('SELECT * FROM ff_client_contracts WHERE organization_id = ? ORDER BY start_date DESC').all(orgId) as Array<Record<string, unknown>>;
  let invoices = db.prepare('SELECT * FROM ff_invoices WHERE organization_id = ? ORDER BY issue_date DESC').all(orgId) as Array<Record<string, unknown>>;
  let receipts = db.prepare('SELECT * FROM ff_receipts WHERE organization_id = ? ORDER BY received_at DESC').all(orgId) as Array<Record<string, unknown>>;
  let expenses = db.prepare('SELECT * FROM ff_expenses WHERE organization_id = ? ORDER BY expense_date DESC').all(orgId) as Array<Record<string, unknown>>;

  // Enforce role-scoped data isolation per RLS matrix
  if (role === 'client') {
    clients = clientIdScope ? clients.filter((c) => c.id === clientIdScope) : [];
    const allowedClientIds = new Set(clients.map((c) => c.id));
    sites = sites.filter((s) => allowedClientIds.has(s.client_id));
    const allowedSiteIds = new Set(sites.map((s) => s.id));
    posts = posts.filter((p) => allowedSiteIds.has(p.site_id));
    shifts = shifts.filter((s) => allowedSiteIds.has(s.site_id));
    const allowedShiftIds = new Set(shifts.map((s) => s.id));
    assignments = assignments.filter((a) => allowedShiftIds.has(a.shift_id));
    attendance = attendance.filter((a) => a.shift_id && allowedShiftIds.has(a.shift_id));
    incidents = incidents.filter((i) => allowedSiteIds.has(i.site_id));
    patrolCheckpoints = patrolCheckpoints.filter((cp) => allowedSiteIds.has(cp.site_id));
    patrolSchedules = patrolSchedules.filter((ps) => allowedSiteIds.has(ps.site_id));
    patrolScans = patrolScans.filter((ps) => allowedSiteIds.has(ps.site_id));
    clientContracts = clientContracts.filter((cc) => allowedClientIds.has(cc.client_id));
    invoices = invoices.filter((inv) => allowedClientIds.has(inv.client_id));
    receipts = receipts.filter((rcp) => allowedClientIds.has(rcp.client_id));
    employees = [];
    contracts = [];
    documents = [];
    qualifications = [];
    leaveRecords = [];
    disciplinaryRecords = [];
    attendanceVerifications = [];
    payrollRuns = [];
    payslips = [];
    expenses = [];
  } else if (role === 'guard') {
    const myEmpIds = new Set(employees.filter((e) => e.user_id === userId).map((e) => e.id));
    employees = employees.filter((e) => myEmpIds.has(e.id));
    assignments = assignments.filter((a) => myEmpIds.has(a.employee_id));
    const myShiftIds = new Set(assignments.map((a) => a.shift_id));
    shifts = shifts.filter((s) => myShiftIds.has(s.id));
    const mySiteIds = new Set(shifts.map((s) => s.site_id));
    sites = sites.filter((s) => mySiteIds.has(s.id));
    posts = posts.filter((p) => mySiteIds.has(p.site_id));
    const myClientIds = new Set(sites.map((s) => s.client_id));
    clients = clients.filter((c) => myClientIds.has(c.id));
    attendance = attendance.filter((a) => myEmpIds.has(a.employee_id));
    const attIds = new Set(attendance.map((a) => a.id));
    attendanceVerifications = attendanceVerifications.filter((v) => attIds.has(v.attendance_event_id));
    incidents = incidents.filter((i) => i.reported_by === userId);
    contracts = contracts.filter((c) => myEmpIds.has(c.employee_id));
    documents = documents.filter((d) => myEmpIds.has(d.employee_id));
    qualifications = qualifications.filter((q) => myEmpIds.has(q.employee_id));
    leaveRecords = leaveRecords.filter((l) => myEmpIds.has(l.employee_id));
    disciplinaryRecords = disciplinaryRecords.filter((d) => myEmpIds.has(d.employee_id));
    patrolCheckpoints = patrolCheckpoints.filter((cp) => mySiteIds.has(cp.site_id));
    patrolSchedules = patrolSchedules.filter((ps) => mySiteIds.has(ps.site_id));
    patrolScans = patrolScans.filter((ps) => myEmpIds.has(ps.employee_id) || mySiteIds.has(ps.site_id));
    payslips = payslips.filter((ps) => myEmpIds.has(ps.employee_id));
    payrollRuns = [];
    clientContracts = [];
    invoices = [];
    receipts = [];
    expenses = [];
  } else if (role === 'supervisor') {
    const assignedSites = siteSupervisors.filter((ss) => ss.user_id === userId).map((ss) => ss.site_id);
    if (assignedSites.length > 0) {
      const siteSet = new Set(assignedSites);
      sites = sites.filter((s) => siteSet.has(String(s.id)));
      posts = posts.filter((p) => siteSet.has(String(p.site_id)));
      shifts = shifts.filter((s) => siteSet.has(String(s.site_id)));
      const shiftSet = new Set(shifts.map((s) => s.id));
      assignments = assignments.filter((a) => shiftSet.has(a.shift_id));
      const empSet = new Set(assignments.map((a) => a.employee_id));
      attendance = attendance.filter((a) => (a.shift_id ? shiftSet.has(a.shift_id) : empSet.has(a.employee_id)));
      incidents = incidents.filter((i) => siteSet.has(String(i.site_id)));
      patrolCheckpoints = patrolCheckpoints.filter((cp) => siteSet.has(String(cp.site_id)));
      patrolSchedules = patrolSchedules.filter((ps) => siteSet.has(String(ps.site_id)));
      patrolScans = patrolScans.filter((ps) => siteSet.has(String(ps.site_id)));
    }
    payrollRuns = [];
    payslips = [];
    clientContracts = [];
    invoices = [];
    receipts = [];
  }

  res.json({
    employees,
    clients: clients.map((c) => ({ ...c, is_active: Boolean(c.is_active) })),
    sites: sites.map((s) => ({ ...s, is_active: Boolean(s.is_active) })),
    posts,
    siteSupervisors,
    shifts,
    assignments: assignments.map((a) => ({ ...a, is_relief: Boolean(a.is_relief) })),
    attendance: attendance.map((a) => ({
      ...a,
      is_offline_sync: Boolean(a.is_offline_sync),
      location_metadata: a.location_metadata ? JSON.parse(String(a.location_metadata)) : null,
    })),
    incidents,
    contracts,
    documents,
    qualifications,
    leaveRecords,
    disciplinaryRecords,
    attendanceVerifications,
    patrolCheckpoints: patrolCheckpoints.map((cp) => ({ ...cp, is_active: Boolean(cp.is_active) })),
    patrolSchedules: patrolSchedules.map((ps) => ({ ...ps, is_active: Boolean(ps.is_active) })),
    patrolScans,
    payrollRuns,
    payslips,
    clientContracts,
    invoices: invoices.map((inv) => ({
      ...inv,
      line_items: inv.line_items_json ? JSON.parse(String(inv.line_items_json)) : [],
    })),
    receipts,
    expenses,
  });
});

app.post('/api/fieldforce/employees', requireAuth, requireOrg, (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'operations_manager', 'hr_manager'])) {
    res.status(403).json({ error: 'Only HR, Ops Managers, or Owners can onboard guards.' });
    return;
  }
  const schema = z.object({
    employee_number: z.string().trim().min(2).max(40),
    first_name: z.string().trim().min(1).max(80),
    last_name: z.string().trim().min(1).max(80),
    phone: z.string().trim().min(6).max(30),
    status: z.enum(['active', 'on_leave', 'suspended', 'inactive']).default('active'),
    hire_date: z.string().trim().min(4),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid guard details.' });
    return;
  }

  const dup = db
    .prepare('SELECT id FROM ff_employees WHERE organization_id = ? AND lower(employee_number) = lower(?)')
    .get(req.auth!.orgId, parsed.data.employee_number);
  if (dup) {
    res.status(409).json({ error: `Badge number ${parsed.data.employee_number} already exists in this organisation.` });
    return;
  }

  const id = `emp-${crypto.randomUUID().slice(0, 12)}`;
  db.prepare(`
    INSERT INTO ff_employees (id, organization_id, employee_number, first_name, last_name, phone, status, hire_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    req.auth!.orgId,
    parsed.data.employee_number,
    parsed.data.first_name,
    parsed.data.last_name,
    parsed.data.phone,
    parsed.data.status,
    parsed.data.hire_date
  );

  writeAuditEvent({
    organizationId: req.auth!.orgId!,
    actorId: req.auth!.userId,
    actorName: req.auth!.fullName,
    action: 'employee.created',
    entityType: 'ff_employees',
    entityId: id,
    metadata: { employee_number: parsed.data.employee_number },
  });

  const employee = db.prepare('SELECT * FROM ff_employees WHERE id = ?').get(id);
  res.status(201).json({ employee });
});

app.patch('/api/fieldforce/employees/:id/status', requireAuth, requireOrg, (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'operations_manager', 'hr_manager'])) {
    res.status(403).json({ error: 'Insufficient permissions to change guard status.' });
    return;
  }
  const schema = z.object({ status: z.enum(['active', 'on_leave', 'suspended', 'inactive']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid employee status.' });
    return;
  }

  const target = db
    .prepare('SELECT id FROM ff_employees WHERE id = ? AND organization_id = ?')
    .get(req.params.id, req.auth!.orgId);
  if (!target) {
    res.status(404).json({ error: 'Employee not found.' });
    return;
  }

  db.prepare("UPDATE ff_employees SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
    parsed.data.status,
    req.params.id
  );
  writeAuditEvent({
    organizationId: req.auth!.orgId!,
    actorId: req.auth!.userId,
    actorName: req.auth!.fullName,
    action: 'employee.status_updated',
    entityType: 'ff_employees',
    entityId: req.params.id,
    metadata: { status: parsed.data.status },
  });
  res.json({ ok: true });
});

app.patch('/api/fieldforce/employees/:id', requireAuth, requireOrg, (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'operations_manager', 'hr_manager'])) {
    res.status(403).json({ error: 'Insufficient permissions to edit guard details.' });
    return;
  }
  const schema = z.object({
    first_name: z.string().trim().min(1).max(80),
    last_name: z.string().trim().min(1).max(80),
    phone: z.string().trim().min(6).max(30),
    user_id: z.string().trim().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid guard update payload.' });
    return;
  }

  const target = db
    .prepare('SELECT id FROM ff_employees WHERE id = ? AND organization_id = ?')
    .get(req.params.id, req.auth!.orgId);
  if (!target) {
    res.status(404).json({ error: 'Employee not found.' });
    return;
  }

  let linkedUserId: string | null = null;
  if (parsed.data.user_id) {
    const member = db
      .prepare("SELECT user_id FROM organization_memberships WHERE organization_id = ? AND user_id = ? AND status = 'active'")
      .get(req.auth!.orgId, parsed.data.user_id) as { user_id: string } | undefined;
    if (!member) {
      res.status(404).json({ error: 'Selected user account is not an active member of this organisation.' });
      return;
    }
    linkedUserId = member.user_id;
  }

  db.prepare(`
    UPDATE ff_employees
    SET first_name = ?, last_name = ?, phone = ?, user_id = ?, updated_at = datetime('now')
    WHERE id = ? AND organization_id = ?
  `).run(
    parsed.data.first_name,
    parsed.data.last_name,
    parsed.data.phone,
    linkedUserId,
    req.params.id,
    req.auth!.orgId
  );

  writeAuditEvent({
    organizationId: req.auth!.orgId!,
    actorId: req.auth!.userId,
    actorName: req.auth!.fullName,
    action: 'employee.updated',
    entityType: 'ff_employees',
    entityId: req.params.id,
    metadata: { linked_user: Boolean(linkedUserId) },
  });

  const employee = db.prepare('SELECT * FROM ff_employees WHERE id = ?').get(req.params.id);
  res.json({ employee });
});

app.post('/api/fieldforce/clients', requireAuth, requireOrg, (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'operations_manager'])) {
    res.status(403).json({ error: 'Only Operations Managers, Admins, or Owners can add clients.' });
    return;
  }
  const schema = z.object({
    client_code: z.string().trim().min(2).max(30),
    company_name: z.string().trim().min(2).max(140),
    contact_person: z.string().trim().min(2).max(120),
    contact_phone: z.string().trim().min(6).max(30),
    contact_email: z.string().trim().email().optional().or(z.literal('')),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid client fields.' });
    return;
  }

  const dup = db
    .prepare('SELECT id FROM ff_clients WHERE organization_id = ? AND lower(client_code) = lower(?)')
    .get(req.auth!.orgId, parsed.data.client_code);
  if (dup) {
    res.status(409).json({ error: `Client code ${parsed.data.client_code} already exists.` });
    return;
  }

  const id = `cli-${crypto.randomUUID().slice(0, 12)}`;
  db.prepare(`
    INSERT INTO ff_clients (id, organization_id, client_code, company_name, contact_person, contact_phone, contact_email, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    id,
    req.auth!.orgId,
    parsed.data.client_code,
    parsed.data.company_name,
    parsed.data.contact_person,
    parsed.data.contact_phone,
    parsed.data.contact_email || null
  );

  writeAuditEvent({
    organizationId: req.auth!.orgId!,
    actorId: req.auth!.userId,
    actorName: req.auth!.fullName,
    action: 'client.created',
    entityType: 'ff_clients',
    entityId: id,
    metadata: { company_name: parsed.data.company_name },
  });

  const client = db.prepare('SELECT * FROM ff_clients WHERE id = ?').get(id) as Record<string, unknown>;
  res.status(201).json({ client: { ...client, is_active: Boolean(client.is_active) } });
});

app.patch('/api/fieldforce/clients/:id/status', requireAuth, requireOrg, (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'operations_manager'])) {
    res.status(403).json({ error: 'Insufficient permissions to update client status.' });
    return;
  }
  const schema = z.object({ is_active: z.boolean() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Valid active boolean is required.' });
    return;
  }
  const existing = db
    .prepare('SELECT id FROM ff_clients WHERE id = ? AND organization_id = ?')
    .get(req.params.id, req.auth!.orgId);
  if (!existing) {
    res.status(404).json({ error: 'Client not found.' });
    return;
  }
  db.prepare("UPDATE ff_clients SET is_active = ?, updated_at = datetime('now') WHERE id = ?").run(
    parsed.data.is_active ? 1 : 0,
    req.params.id
  );
  writeAuditEvent({
    organizationId: req.auth!.orgId!,
    actorId: req.auth!.userId,
    actorName: req.auth!.fullName,
    action: 'client.status_updated',
    entityType: 'ff_clients',
    entityId: req.params.id,
    metadata: { is_active: parsed.data.is_active },
  });
  res.json({ ok: true });
});

app.post('/api/fieldforce/sites', requireAuth, requireOrg, (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'operations_manager'])) {
    res.status(403).json({ error: 'Only Operations Managers, Admins, or Owners can add sites.' });
    return;
  }
  const schema = z.object({
    client_id: z.string().min(1),
    name: z.string().trim().min(2).max(140),
    location_description: z.string().trim().max(240).optional(),
    city: z.string().trim().min(2).max(80).default('Nairobi'),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    geofence_radius_m: z.number().int().min(30).max(5000).default(250),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Valid client and site name are required.' });
    return;
  }

  const client = db
    .prepare('SELECT id FROM ff_clients WHERE id = ? AND organization_id = ?')
    .get(parsed.data.client_id, req.auth!.orgId);
  if (!client) {
    res.status(404).json({ error: 'Client not found in this organisation.' });
    return;
  }

  const id = `site-${crypto.randomUUID().slice(0, 12)}`;
  db.prepare(`
    INSERT INTO ff_sites (id, organization_id, client_id, name, location_description, city, latitude, longitude, geofence_radius_m, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    id,
    req.auth!.orgId,
    parsed.data.client_id,
    parsed.data.name,
    parsed.data.location_description ?? '',
    parsed.data.city,
    parsed.data.latitude ?? null,
    parsed.data.longitude ?? null,
    parsed.data.geofence_radius_m
  );

  writeAuditEvent({
    organizationId: req.auth!.orgId!,
    actorId: req.auth!.userId,
    actorName: req.auth!.fullName,
    action: 'site.created',
    entityType: 'ff_sites',
    entityId: id,
    metadata: { name: parsed.data.name },
  });

  const site = db.prepare('SELECT * FROM ff_sites WHERE id = ?').get(id) as Record<string, unknown>;
  res.status(201).json({ site: { ...site, is_active: Boolean(site.is_active) } });
});

app.patch('/api/fieldforce/sites/:id/status', requireAuth, requireOrg, (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'operations_manager'])) {
    res.status(403).json({ error: 'Insufficient permissions to update site status.' });
    return;
  }
  const schema = z.object({ is_active: z.boolean() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Valid active boolean is required.' });
    return;
  }
  const existing = db
    .prepare('SELECT id FROM ff_sites WHERE id = ? AND organization_id = ?')
    .get(req.params.id, req.auth!.orgId);
  if (!existing) {
    res.status(404).json({ error: 'Site not found.' });
    return;
  }
  db.prepare("UPDATE ff_sites SET is_active = ?, updated_at = datetime('now') WHERE id = ?").run(
    parsed.data.is_active ? 1 : 0,
    req.params.id
  );
  writeAuditEvent({
    organizationId: req.auth!.orgId!,
    actorId: req.auth!.userId,
    actorName: req.auth!.fullName,
    action: 'site.status_updated',
    entityType: 'ff_sites',
    entityId: req.params.id,
    metadata: { is_active: parsed.data.is_active },
  });
  res.json({ ok: true });
});

app.post('/api/fieldforce/posts', requireAuth, requireOrg, (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'operations_manager'])) {
    res.status(403).json({ error: 'Only Operations Managers, Admins, or Owners can add posts.' });
    return;
  }
  const schema = z.object({
    site_id: z.string().min(1),
    name: z.string().trim().min(2).max(120),
    required_guards: z.number().int().min(1).max(20).default(1),
    instructions: z.string().trim().max(500).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Valid site and post name are required.' });
    return;
  }

  const site = db.prepare('SELECT id FROM ff_sites WHERE id = ? AND organization_id = ?').get(parsed.data.site_id, req.auth!.orgId);
  if (!site) {
    res.status(404).json({ error: 'Site not found in this organisation.' });
    return;
  }

  const id = `post-${crypto.randomUUID().slice(0, 12)}`;
  db.prepare(`
    INSERT INTO ff_posts (id, organization_id, site_id, name, required_guards, instructions)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, req.auth!.orgId, parsed.data.site_id, parsed.data.name, parsed.data.required_guards, parsed.data.instructions ?? '');

  writeAuditEvent({
    organizationId: req.auth!.orgId!,
    actorId: req.auth!.userId,
    actorName: req.auth!.fullName,
    action: 'post.created',
    entityType: 'ff_posts',
    entityId: id,
    metadata: { name: parsed.data.name, required_guards: parsed.data.required_guards },
  });

  const post = db.prepare('SELECT * FROM ff_posts WHERE id = ?').get(id);
  res.status(201).json({ post });
});

app.patch('/api/fieldforce/posts/:id', requireAuth, requireOrg, (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'operations_manager'])) {
    res.status(403).json({ error: 'Only Operations Managers, Admins, or Owners can edit posts.' });
    return;
  }
  const schema = z.object({
    name: z.string().trim().min(2).max(120),
    required_guards: z.number().int().min(1).max(20),
    instructions: z.string().trim().max(500).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Valid post name and required guards (1-20) are required.' });
    return;
  }
  const existing = db
    .prepare('SELECT id FROM ff_posts WHERE id = ? AND organization_id = ?')
    .get(req.params.id, req.auth!.orgId);
  if (!existing) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }
  db.prepare(`
    UPDATE ff_posts
    SET name = ?, required_guards = ?, instructions = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(parsed.data.name, parsed.data.required_guards, parsed.data.instructions ?? '', req.params.id);

  writeAuditEvent({
    organizationId: req.auth!.orgId!,
    actorId: req.auth!.userId,
    actorName: req.auth!.fullName,
    action: 'post.updated',
    entityType: 'ff_posts',
    entityId: req.params.id,
    metadata: { required_guards: parsed.data.required_guards },
  });

  const post = db.prepare('SELECT * FROM ff_posts WHERE id = ?').get(req.params.id);
  res.json({ post });
});

app.post('/api/fieldforce/site-supervisors', requireAuth, requireOrg, (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'operations_manager'])) {
    res.status(403).json({ error: 'Insufficient permissions to assign site supervisors.' });
    return;
  }
  const schema = z.object({ site_id: z.string().min(1), user_id: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Site and supervisor user are required.' });
    return;
  }

  const site = db.prepare('SELECT id FROM ff_sites WHERE id = ? AND organization_id = ?').get(parsed.data.site_id, req.auth!.orgId);
  const member = db
    .prepare("SELECT user_id FROM organization_memberships WHERE organization_id = ? AND user_id = ? AND status = 'active'")
    .get(req.auth!.orgId, parsed.data.user_id);
  if (!site || !member) {
    res.status(404).json({ error: 'Site or supervisor membership not found in this organisation.' });
    return;
  }

  const existing = db
    .prepare('SELECT id FROM ff_site_supervisors WHERE organization_id = ? AND site_id = ? AND user_id = ?')
    .get(req.auth!.orgId, parsed.data.site_id, parsed.data.user_id);
  if (existing) {
    res.status(409).json({ error: 'Supervisor is already linked to this site.' });
    return;
  }

  const id = `ss-${crypto.randomUUID().slice(0, 10)}`;
  db.prepare(`
    INSERT INTO ff_site_supervisors (id, organization_id, site_id, user_id)
    VALUES (?, ?, ?, ?)
  `).run(id, req.auth!.orgId, parsed.data.site_id, parsed.data.user_id);

  writeAuditEvent({
    organizationId: req.auth!.orgId!,
    actorId: req.auth!.userId,
    actorName: req.auth!.fullName,
    action: 'site_supervisor.linked',
    entityType: 'ff_site_supervisors',
    entityId: id,
    metadata: { site_id: parsed.data.site_id, user_id: parsed.data.user_id },
  });

  const siteSupervisors = db.prepare('SELECT * FROM ff_site_supervisors WHERE organization_id = ?').all(req.auth!.orgId);
  res.status(201).json({ siteSupervisors });
});

app.delete('/api/fieldforce/site-supervisors/:id', requireAuth, requireOrg, (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'operations_manager'])) {
    res.status(403).json({ error: 'Insufficient permissions to unlink site supervisors.' });
    return;
  }
  const existing = db
    .prepare('SELECT id FROM ff_site_supervisors WHERE id = ? AND organization_id = ?')
    .get(req.params.id, req.auth!.orgId);
  if (!existing) {
    res.status(404).json({ error: 'Site supervisor link not found.' });
    return;
  }
  db.prepare('DELETE FROM ff_site_supervisors WHERE id = ? AND organization_id = ?').run(req.params.id, req.auth!.orgId);
  writeAuditEvent({
    organizationId: req.auth!.orgId!,
    actorId: req.auth!.userId,
    actorName: req.auth!.fullName,
    action: 'site_supervisor.unlinked',
    entityType: 'ff_site_supervisors',
    entityId: req.params.id,
  });
  res.json({ ok: true });
});

// ==================== SHIFTS, ASSIGNMENTS, ATTENDANCE & INCIDENTS ====================

app.post('/api/fieldforce/shifts', requireAuth, requireOrg, (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'operations_manager'])) {
    res.status(403).json({ error: 'Only Operations Managers, Admins, or Owners can publish shifts.' });
    return;
  }
  const schema = z.object({
    site_id: z.string().min(1),
    post_id: z.string().min(1),
    shift_date: z.string().min(8),
    start_time: z.string().min(10),
    end_time: z.string().min(10),
    shift_type: z.enum(['day', 'night', 'special']),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid shift timing or post selection.' });
    return;
  }

  const post = db
    .prepare('SELECT id, site_id FROM ff_posts WHERE id = ? AND organization_id = ?')
    .get(parsed.data.post_id, req.auth!.orgId) as { id: string; site_id: string } | undefined;
  if (!post || post.site_id !== parsed.data.site_id) {
    res.status(404).json({ error: 'Post does not belong to selected site.' });
    return;
  }

  const startMs = new Date(parsed.data.start_time).getTime();
  const endMs = new Date(parsed.data.end_time).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    res.status(400).json({ error: 'Shift end time must be after shift start time.' });
    return;
  }

  const id = `shf-${crypto.randomUUID().slice(0, 12)}`;
  db.prepare(`
    INSERT INTO ff_shifts (id, organization_id, site_id, post_id, shift_date, start_time, end_time, shift_type, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published')
  `).run(id, req.auth!.orgId, parsed.data.site_id, parsed.data.post_id, parsed.data.shift_date, parsed.data.start_time, parsed.data.end_time, parsed.data.shift_type);

  writeAuditEvent({
    organizationId: req.auth!.orgId!,
    actorId: req.auth!.userId,
    actorName: req.auth!.fullName,
    action: 'shift.published',
    entityType: 'ff_shifts',
    entityId: id,
    metadata: { shift_date: parsed.data.shift_date, shift_type: parsed.data.shift_type },
  });

  const shift = db.prepare('SELECT * FROM ff_shifts WHERE id = ?').get(id);
  res.status(201).json({ shift });
});

app.post('/api/fieldforce/assignments', requireAuth, requireOrg, (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'operations_manager', 'supervisor'])) {
    res.status(403).json({ error: 'Insufficient permissions to assign guards.' });
    return;
  }
  const schema = z.object({
    shift_id: z.string().min(1),
    employee_id: z.string().min(1),
    is_relief: z.boolean().default(false),
    relief_for_assignment_id: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Shift and guard are required.' });
    return;
  }

  const shift = db
    .prepare('SELECT * FROM ff_shifts WHERE id = ? AND organization_id = ?')
    .get(parsed.data.shift_id, req.auth!.orgId) as { id: string; start_time: string; end_time: string } | undefined;
  const emp = db
    .prepare('SELECT * FROM ff_employees WHERE id = ? AND organization_id = ?')
    .get(parsed.data.employee_id, req.auth!.orgId) as { id: string; status: string } | undefined;

  if (!shift || !emp) {
    res.status(404).json({ error: 'Shift or guard not found.' });
    return;
  }
  if (emp.status !== 'active') {
    res.status(409).json({ error: `Cannot assign guard while deployment status is "${emp.status}".` });
    return;
  }

  const targetStart = new Date(shift.start_time).getTime();
  const targetEnd = new Date(shift.end_time).getTime();

  const existingAssignments = db
    .prepare(`
      SELECT a.shift_id, s.start_time, s.end_time
      FROM ff_assignments a
      JOIN ff_shifts s ON s.id = a.shift_id
      WHERE a.organization_id = ? AND a.employee_id = ? AND a.status != 'cancelled'
    `)
    .all(req.auth!.orgId, emp.id) as Array<{ shift_id: string; start_time: string; end_time: string }>;

  const hasOverlap = existingAssignments.some((a) => {
    if (a.shift_id === shift.id) return true;
    const sStart = new Date(a.start_time).getTime();
    const sEnd = new Date(a.end_time).getTime();
    return targetStart < sEnd && targetEnd > sStart;
  });

  if (hasOverlap) {
    res.status(409).json({ error: 'Double-booking prevented: guard is already assigned to an overlapping shift.' });
    return;
  }

  const id = `asg-${crypto.randomUUID().slice(0, 12)}`;
  db.prepare(`
    INSERT INTO ff_assignments (id, organization_id, shift_id, employee_id, status, is_relief, relief_for_assignment_id, assigned_by)
    VALUES (?, ?, ?, ?, 'scheduled', ?, ?, ?)
  `).run(
    id,
    req.auth!.orgId,
    shift.id,
    emp.id,
    parsed.data.is_relief ? 1 : 0,
    parsed.data.relief_for_assignment_id ?? null,
    req.auth!.userId
  );

  writeAuditEvent({
    organizationId: req.auth!.orgId!,
    actorId: req.auth!.userId,
    actorName: req.auth!.fullName,
    action: parsed.data.is_relief ? 'assignment.relief_created' : 'assignment.created',
    entityType: 'ff_assignments',
    entityId: id,
    metadata: { shift_id: shift.id, employee_id: emp.id, is_relief: parsed.data.is_relief },
  });

  const assignment = db.prepare('SELECT * FROM ff_assignments WHERE id = ?').get(id) as Record<string, unknown>;
  res.status(201).json({ assignment: { ...assignment, is_relief: Boolean(assignment.is_relief) } });
});

app.delete('/api/fieldforce/assignments/:id', requireAuth, requireOrg, (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'operations_manager', 'supervisor'])) {
    res.status(403).json({ error: 'Insufficient permissions to remove assignments.' });
    return;
  }
  const existing = db
    .prepare('SELECT id FROM ff_assignments WHERE id = ? AND organization_id = ?')
    .get(req.params.id, req.auth!.orgId);
  if (!existing) {
    res.status(404).json({ error: 'Assignment not found.' });
    return;
  }

  db.prepare('DELETE FROM ff_assignments WHERE id = ? AND organization_id = ?').run(req.params.id, req.auth!.orgId);
  writeAuditEvent({
    organizationId: req.auth!.orgId!,
    actorId: req.auth!.userId,
    actorName: req.auth!.fullName,
    action: 'assignment.removed',
    entityType: 'ff_assignments',
    entityId: req.params.id,
  });
  res.json({ ok: true });
});

app.post('/api/fieldforce/attendance', requireAuth, requireOrg, (req, res) => {
  if (req.auth!.role === 'client') {
    res.status(403).json({ error: 'Client portal accounts cannot record guard attendance.' });
    return;
  }
  const schema = z.object({
    employee_id: z.string().min(1),
    shift_id: z.string().nullable().optional(),
    event_type: z.enum(['clock_in', 'clock_out', 'supervisor_override']),
    location_metadata: z
      .object({
        lat: z.number(),
        lng: z.number(),
        accuracy: z.number(),
      })
      .nullable()
      .optional(),
    override_reason: z.string().trim().max(400).optional(),
    offline_captured_at: z.string().nullable().optional(),
    is_offline_sync: z.boolean().default(false),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid attendance payload.' });
    return;
  }

  const emp = db
    .prepare('SELECT id, user_id FROM ff_employees WHERE id = ? AND organization_id = ?')
    .get(parsed.data.employee_id, req.auth!.orgId) as { id: string; user_id: string | null } | undefined;
  if (!emp) {
    res.status(404).json({ error: 'Guard record not found.' });
    return;
  }

  if (req.auth!.role === 'guard') {
    if (parsed.data.event_type === 'supervisor_override') {
      res.status(403).json({ error: 'Guards cannot record supervisor overrides.' });
      return;
    }
    if (emp.user_id !== req.auth!.userId) {
      res.status(403).json({ error: 'Guards can only record attendance for themselves.' });
      return;
    }
  }

  if (parsed.data.event_type === 'supervisor_override') {
    if (!hasRole(req, ['owner', 'admin', 'operations_manager', 'supervisor'])) {
      res.status(403).json({ error: 'Only supervisors or managers can log overrides.' });
      return;
    }
    if (!parsed.data.override_reason || parsed.data.override_reason.length < 5) {
      res.status(400).json({ error: 'Supervisor override requires a documented reason (min 5 characters).' });
      return;
    }
  }

  const id = `att-${crypto.randomUUID().slice(0, 12)}`;
  const recordedAt =
    parsed.data.is_offline_sync && parsed.data.offline_captured_at && !Number.isNaN(new Date(parsed.data.offline_captured_at).getTime())
      ? new Date(parsed.data.offline_captured_at).toISOString()
      : new Date().toISOString();
  const userAgent = String(req.headers['user-agent'] || 'web').slice(0, 80);

  // Compute geofence status & lateness relative to referenced shift/site
  let geofenceStatus = 'unknown';
  let distanceMeters: number | null = null;
  let lateMinutes = 0;

  if (parsed.data.shift_id) {
    const shiftSite = db
      .prepare(`
        SELECT sh.start_time, st.latitude, st.longitude, st.geofence_radius_m
        FROM ff_shifts sh
        JOIN ff_sites st ON st.id = sh.site_id
        WHERE sh.id = ? AND sh.organization_id = ?
      `)
      .get(parsed.data.shift_id, req.auth!.orgId) as
      | { start_time: string; latitude: number | null; longitude: number | null; geofence_radius_m: number }
      | undefined;

    if (shiftSite) {
      if (parsed.data.location_metadata && shiftSite.latitude !== null && shiftSite.longitude !== null) {
        distanceMeters = haversineMeters(
          parsed.data.location_metadata.lat,
          parsed.data.location_metadata.lng,
          shiftSite.latitude,
          shiftSite.longitude
        );
        geofenceStatus = distanceMeters <= (shiftSite.geofence_radius_m || 250) ? 'inside' : 'outside';
      }
      if (parsed.data.event_type === 'clock_in') {
        const diffMin = Math.round((new Date(recordedAt).getTime() - new Date(shiftSite.start_time).getTime()) / 60_000);
        lateMinutes = diffMin > 0 ? diffMin : 0;
      }
    }
  }

  db.prepare(`
    INSERT INTO ff_attendance_events (
      id, organization_id, employee_id, shift_id, event_type, recorded_at, source,
      location_metadata, geofence_status, distance_meters, late_minutes, offline_captured_at, is_offline_sync,
      supervisor_id, override_reason
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    req.auth!.orgId,
    emp.id,
    parsed.data.shift_id ?? null,
    parsed.data.event_type,
    recordedAt,
    userAgent,
    parsed.data.location_metadata ? JSON.stringify(parsed.data.location_metadata) : null,
    geofenceStatus,
    distanceMeters,
    lateMinutes,
    parsed.data.offline_captured_at ?? null,
    parsed.data.is_offline_sync ? 1 : 0,
    parsed.data.event_type === 'supervisor_override' ? req.auth!.userId : null,
    parsed.data.override_reason ?? null
  );

  writeAuditEvent({
    organizationId: req.auth!.orgId!,
    actorId: req.auth!.userId,
    actorName: req.auth!.fullName,
    action: `attendance.${parsed.data.event_type}`,
    entityType: 'ff_attendance_events',
    entityId: id,
    metadata: { employee_id: emp.id, geofence_status: geofenceStatus, late_minutes: lateMinutes, is_offline_sync: parsed.data.is_offline_sync },
  });

  const eventRow = db.prepare('SELECT * FROM ff_attendance_events WHERE id = ?').get(id) as Record<string, unknown>;
  res.status(201).json({
    event: {
      ...eventRow,
      is_offline_sync: Boolean(eventRow.is_offline_sync),
      location_metadata: eventRow.location_metadata ? JSON.parse(String(eventRow.location_metadata)) : null,
    },
  });
});

app.post('/api/fieldforce/incidents', requireAuth, requireOrg, (req, res) => {
  if (req.auth!.role === 'client') {
    res.status(403).json({ error: 'Client accounts cannot log internal field occurrence records.' });
    return;
  }
  const schema = z.object({
    site_id: z.string().min(1),
    post_id: z.string().nullable().optional(),
    entry_type: z.enum(['incident', 'occurrence']).default('incident'),
    category: z.enum([
      'theft',
      'trespassing',
      'medical',
      'property_damage',
      'uniform_breach',
      'equipment_failure',
      'handover',
      'visitor_log',
      'patrol_note',
    ]),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    narrative: z.string().trim().min(10).max(2000),
    occurrence_time: z.string().min(10),
    voice_transcript: z.string().trim().max(2000).nullable().optional(),
    photo_data: z.string().nullable().optional(),
    escalation_level: z.enum(['site', 'operations', 'executive', 'client_notified']).default('site'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Please provide a site, category, severity, and factual narrative (min 10 chars).' });
    return;
  }

  const photoValidation = validatePhotoData(parsed.data.photo_data);
  if (!photoValidation.ok) {
    res.status(400).json({ error: photoValidation.error });
    return;
  }

  const site = db.prepare('SELECT id FROM ff_sites WHERE id = ? AND organization_id = ?').get(parsed.data.site_id, req.auth!.orgId);
  if (!site) {
    res.status(404).json({ error: 'Site not found in this organisation.' });
    return;
  }

  if (parsed.data.post_id) {
    const post = db
      .prepare('SELECT id FROM ff_posts WHERE id = ? AND site_id = ? AND organization_id = ?')
      .get(parsed.data.post_id, parsed.data.site_id, req.auth!.orgId);
    if (!post) {
      res.status(400).json({ error: 'Selected post does not belong to this site.' });
      return;
    }
  }

  const id = `inc-${crypto.randomUUID().slice(0, 12)}`;
  const obCount = (db.prepare('SELECT COUNT(*) AS c FROM ff_incidents WHERE organization_id = ?').get(req.auth!.orgId) as { c: number }).c;
  const obNumber = `OB-${new Date().getFullYear()}-${String(obCount + 1).padStart(4, '0')}`;
  const escalatedAt = parsed.data.escalation_level !== 'site' ? new Date().toISOString() : null;

  db.prepare(`
    INSERT INTO ff_incidents (
      id, organization_id, site_id, post_id, reported_by, reported_by_name, occurrence_time,
      entry_type, ob_number, category, severity, narrative, voice_transcript, photo_data, escalation_level, escalated_at, status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
  `).run(
    id,
    req.auth!.orgId,
    parsed.data.site_id,
    parsed.data.post_id ?? null,
    req.auth!.userId,
    req.auth!.fullName,
    parsed.data.occurrence_time,
    parsed.data.entry_type,
    obNumber,
    parsed.data.category,
    parsed.data.severity,
    parsed.data.narrative,
    parsed.data.voice_transcript ?? null,
    photoValidation.value,
    parsed.data.escalation_level,
    escalatedAt
  );

  writeAuditEvent({
    organizationId: req.auth!.orgId!,
    actorId: req.auth!.userId,
    actorName: req.auth!.fullName,
    action: parsed.data.entry_type === 'occurrence' ? 'occurrence.logged' : 'incident.reported',
    entityType: 'ff_incidents',
    entityId: id,
    metadata: { ob_number: obNumber, category: parsed.data.category, severity: parsed.data.severity, has_photo: Boolean(photoValidation.value) },
  });

  const incident = db.prepare('SELECT * FROM ff_incidents WHERE id = ?').get(id);
  res.status(201).json({ incident });
});

app.patch('/api/fieldforce/incidents/:id/review', requireAuth, requireOrg, (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'operations_manager', 'supervisor'])) {
    res.status(403).json({ error: 'Only supervisors or managers can update incident status.' });
    return;
  }
  const schema = z.object({
    status: z.enum(['open', 'under_investigation', 'resolved', 'closed']),
    review_notes: z.string().trim().max(2000).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid incident status update.' });
    return;
  }

  const target = db
    .prepare('SELECT id FROM ff_incidents WHERE id = ? AND organization_id = ?')
    .get(req.params.id, req.auth!.orgId);
  if (!target) {
    res.status(404).json({ error: 'Incident not found.' });
    return;
  }

  db.prepare(`
    UPDATE ff_incidents
    SET status = ?, review_notes = COALESCE(?, review_notes), reviewed_by = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(parsed.data.status, parsed.data.review_notes || null, req.auth!.userId, req.params.id);

  writeAuditEvent({
    organizationId: req.auth!.orgId!,
    actorId: req.auth!.userId,
    actorName: req.auth!.fullName,
    action: 'incident.reviewed',
    entityType: 'ff_incidents',
    entityId: req.params.id,
    metadata: { status: parsed.data.status },
  });

  const incident = db.prepare('SELECT * FROM ff_incidents WHERE id = ?').get(req.params.id);
  res.json({ incident });
});

// ==================== SERVER-SIDE GEMINI INCIDENT SUMMARY DRAFT ====================

app.post('/api/fieldforce/incidents/:id/ai-draft', requireAuth, requireOrg, async (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'operations_manager', 'supervisor'])) {
    res.status(403).json({ error: 'Only supervisors or managers can generate AI incident drafts.' });
    return;
  }
  if (!process.env.GEMINI_API_KEY) {
    res.status(503).json({ error: 'Gemini API key is not configured on the server. Configure GEMINI_API_KEY in Settings > Secrets.' });
    return;
  }

  const inc = db
    .prepare(`
      SELECT i.*, s.name AS site_name, p.name AS post_name
      FROM ff_incidents i
      LEFT JOIN ff_sites s ON s.id = i.site_id
      LEFT JOIN ff_posts p ON p.id = i.post_id
      WHERE i.id = ? AND i.organization_id = ?
    `)
    .get(req.params.id, req.auth!.orgId) as
    | {
        id: string;
        category: string;
        severity: string;
        occurrence_time: string;
        narrative: string;
        site_name: string | null;
        post_name: string | null;
      }
    | undefined;

  if (!inc) {
    res.status(404).json({ error: 'Incident not found.' });
    return;
  }

  // Data Minimisation (Section 11): Strip names/phones/emails before invoking LLM
  const redactedNarrative = redactPIIForPrompt(inc.narrative);
  const prompt = [
    `Site: ${inc.site_name || 'Assigned Site'}`,
    `Post: ${inc.post_name || 'General Post'}`,
    `Category: ${inc.category.replace('_', ' ')}`,
    `Severity: ${inc.severity}`,
    `Occurrence Time: ${inc.occurrence_time}`,
    `Redacted Field Notes: ${redactedNarrative}`,
  ].join('\n');

  try {
    const ai = getGeminiClient();
    let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            systemInstruction:
              'You are a Kenya private security operations report editor. Convert the redacted field notes into a concise, factual, 3-bullet operational incident brief with: (1) Event Summary, (2) Immediate Action Taken, (3) Recommended Supervisor Follow-Up. Do not invent facts or personal names not present in the input.',
          },
        });
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const isTransient = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
        if (!isTransient || attempt === 2) throw err;
        await new Promise((resolve) => setTimeout(resolve, 500 * Math.pow(2, attempt)));
      }
    }

    const draftText = (response?.text || '').trim();
    if (!draftText) {
      res.status(502).json({ error: 'Empty response received from Gemini model.' });
      return;
    }

    const generatedAt = new Date().toISOString();
    db.prepare(`
      UPDATE ff_incidents
      SET ai_draft_summary = ?, ai_draft_generated_at = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(draftText, generatedAt, inc.id);

    writeAuditEvent({
      organizationId: req.auth!.orgId!,
      actorId: req.auth!.userId,
      actorName: req.auth!.fullName,
      action: 'incident.ai_draft_generated',
      entityType: 'ff_incidents',
      entityId: inc.id,
      metadata: { pii_redacted: true },
    });

    const updated = db.prepare('SELECT * FROM ff_incidents WHERE id = ?').get(inc.id);
    res.json({ incident: updated });
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : 'Failed to generate AI incident summary draft.';
    let cleanMsg = rawMsg;
    try {
      const parsedErr = JSON.parse(rawMsg);
      if (parsedErr?.error?.message) cleanMsg = String(parsedErr.error.message);
    } catch {
      // keep rawMsg
    }
    const isUnavailable = rawMsg.includes('503') || rawMsg.includes('UNAVAILABLE');
    res.status(isUnavailable ? 503 : 502).json({ error: cleanMsg });
  }
});

app.post('/api/fieldforce/incidents/:id/approve-ai-draft', requireAuth, requireOrg, (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'operations_manager', 'supervisor'])) {
    res.status(403).json({ error: 'Only supervisors or managers can approve AI incident drafts.' });
    return;
  }
  const schema = z.object({
    approved_summary: z.string().trim().min(5).max(3000),
    next_status: z.enum(['open', 'under_investigation', 'resolved', 'closed']).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Approved summary text is required.' });
    return;
  }

  const target = db
    .prepare('SELECT id, status FROM ff_incidents WHERE id = ? AND organization_id = ?')
    .get(req.params.id, req.auth!.orgId) as { id: string; status: string } | undefined;
  if (!target) {
    res.status(404).json({ error: 'Incident not found.' });
    return;
  }

  const now = new Date().toISOString();
  const nextStatus = parsed.data.next_status || target.status;

  db.prepare(`
    UPDATE ff_incidents
    SET review_notes = ?,
        ai_draft_summary = ?,
        ai_approved_by = ?,
        ai_approved_at = ?,
        reviewed_by = ?,
        status = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    parsed.data.approved_summary,
    parsed.data.approved_summary,
    req.auth!.userId,
    now,
    req.auth!.userId,
    nextStatus,
    target.id
  );

  writeAuditEvent({
    organizationId: req.auth!.orgId!,
    actorId: req.auth!.userId,
    actorName: req.auth!.fullName,
    action: 'incident.ai_draft_approved',
    entityType: 'ff_incidents',
    entityId: target.id,
    metadata: { status: nextStatus },
  });

  const incident = db.prepare('SELECT * FROM ff_incidents WHERE id = ?').get(target.id);
  res.json({ incident });
});

// ==================== AI ORCHESTRATOR & SPECIALIST AGENTS ====================

app.post('/api/assistant/query', requireAuth, requireOrg, (req, res) => {
  const topic = String(req.body?.topic || '').trim();
  const question = String(req.body?.question || '').trim();
  const queryText = (question || topic || 'unassigned').toLowerCase();

  const orgId = req.auth!.orgId!;
  const role = req.auth!.role!;
  const userId = req.auth!.userId;

  const activeSlugs = new Set(
    (
      db
        .prepare(`
          SELECT p.slug
          FROM organization_app_entitlements e
          JOIN product_catalog p ON p.id = e.product_id
          WHERE e.organization_id = ? AND e.status = 'active'
        `)
        .all(orgId) as Array<{ slug: string }>
    ).map((r) => r.slug)
  );

  // Route 1: BiasharaOS queries (profit, revenue, cashflow, invoices, m-pesa, expense) -> Gated Coming Soon
  if (
    queryText.includes('profit') ||
    queryText.includes('revenue') ||
    queryText.includes('biashara') ||
    queryText.includes('m-pesa') ||
    queryText.includes('mpesa') ||
    queryText.includes('invoice')
  ) {
    const isActive = activeSlugs.has('biashara-os');
    res.json({
      topic: topic || 'biashara',
      orchestrator: {
        routedTo: 'Biashara Agent',
        productSlug: 'biashara-os',
        agentStatus: isActive ? 'active' : 'coming_soon',
        gateReason: 'BiasharaOS (Wave 2) is Planned Next and not yet active for live ledger queries.',
      },
      answer:
        'Routed to Biashara Agent (Coming Soon — Wave 2): BiasharaOS is not activated on your organisation yet, so profit, invoice, and M-Pesa figures cannot be reported or invented. You can join the BiasharaOS roadmap waitlist under Discover Apps.',
    });
    return;
  }

  // Route 2: TradePilot queries (tender, bid, supply contract) -> Gated Coming Soon
  if (queryText.includes('tender') || queryText.includes('tradepilot') || queryText.includes('contract')) {
    res.json({
      topic: topic || 'tradepilot',
      orchestrator: {
        routedTo: 'TradePilot Agent',
        productSlug: 'tradepilot-ai',
        agentStatus: 'coming_soon',
        gateReason: 'TradePilot AI (Wave 5) is currently Planned and not yet active.',
      },
      answer:
        'Routed to TradePilot Agent (Coming Soon — Wave 5): TradePilot AI is on the AI Africa roadmap and not yet active for tender discovery. Visit Discover Apps to waitlist your organisation.',
    });
    return;
  }

  // Route 3: FieldForce Agent (Active V1) — enforce RBAC scoping!
  if (topic === 'privacy' || queryText.includes('dpa') || queryText.includes('privacy') || queryText.includes('psra')) {
    res.json({
      topic: topic || 'privacy',
      orchestrator: {
        routedTo: 'FieldForce Compliance Policy',
        productSlug: 'fieldforce',
        agentStatus: 'active',
      },
      answer:
        'Routed to FieldForce Agent (Active V1): Per Kenya DPA 2019 & PSRA V1 policy, National ID scans, biometric templates, police clearance PDFs, and continuous background GPS tracking are disabled. Location snapshots record strictly on explicit Clock-In / Clock-Out action, and PII is redacted server-side before AI incident drafting.',
    });
    return;
  }

  if (topic === 'override' || queryText.includes('override') || queryText.includes('attendance')) {
    const attCount =
      role === 'guard'
        ? (
            db
              .prepare(`
                SELECT COUNT(*) as cnt
                FROM ff_attendance_events a
                JOIN ff_employees e ON e.id = a.employee_id
                WHERE a.organization_id = ? AND e.user_id = ?
              `)
              .get(orgId, userId) as { cnt: number }
          ).cnt
        : (
            db
              .prepare('SELECT COUNT(*) as cnt FROM ff_attendance_events WHERE organization_id = ?')
              .get(orgId) as { cnt: number }
          ).cnt;

    const overrides =
      role === 'guard'
        ? 0
        : (
            db
              .prepare("SELECT COUNT(*) as cnt FROM ff_attendance_events WHERE organization_id = ? AND event_type = 'supervisor_override'")
              .get(orgId) as { cnt: number }
          ).cnt;

    res.json({
      topic: topic || 'override',
      orchestrator: {
        routedTo: 'FieldForce Agent',
        productSlug: 'fieldforce',
        agentStatus: 'active',
      },
      answer: `Routed to FieldForce Agent (Active V1): Your authorised scope holds ${attCount} immutable attendance event(s)${role === 'guard' ? '' : ` including ${overrides} supervisor override(s)`}. SQLite triggers forbid UPDATE/DELETE on ff_attendance_events; every supervisor override requires a documented audit reason (min 5 characters).`,
    });
    return;
  }

  if (topic === 'incidents' || queryText.includes('incident') || queryText.includes('breach') || queryText.includes('trespass')) {
    const row =
      role === 'guard'
        ? (db
            .prepare("SELECT COUNT(*) as cnt FROM ff_incidents WHERE organization_id = ? AND reported_by = ? AND status IN ('open', 'under_investigation')")
            .get(orgId, userId) as { cnt: number })
        : (db
            .prepare("SELECT COUNT(*) as cnt FROM ff_incidents WHERE organization_id = ? AND status IN ('open', 'under_investigation')")
            .get(orgId) as { cnt: number });

    const pendingAi =
      role === 'guard'
        ? 0
        : (
            db
              .prepare('SELECT COUNT(*) as cnt FROM ff_incidents WHERE organization_id = ? AND ai_draft_summary IS NOT NULL AND ai_approved_at IS NULL')
              .get(orgId) as { cnt: number }
          ).cnt;

    res.json({
      topic: topic || 'incidents',
      orchestrator: {
        routedTo: 'FieldForce Agent',
        productSlug: 'fieldforce',
        agentStatus: 'active',
      },
      answer: `Routed to FieldForce Agent (Active V1): ${row.cnt} incident(s) in your authorised queue are open or under investigation${pendingAi > 0 ? `, with ${pendingAi} AI summary draft(s) awaiting supervisor approval` : ''}. Open FieldForce -> Incidents to triage or approve drafts.`,
    });
    return;
  }

  if (
    queryText.includes('deploy') ||
    queryText.includes('guard') ||
    queryText.includes('payroll') ||
    queryText.includes('how many')
  ) {
    if (role === 'guard') {
      const myAssigned = db
        .prepare(`
          SELECT COUNT(*) as cnt
          FROM ff_assignments a
          JOIN ff_employees e ON e.id = a.employee_id
          WHERE a.organization_id = ? AND e.user_id = ? AND a.status != 'cancelled'
        `)
        .get(orgId, userId) as { cnt: number };

      res.json({
        topic: 'deployment',
        orchestrator: {
          routedTo: 'FieldForce Agent (Guard Scope)',
          productSlug: 'fieldforce',
          agentStatus: 'active',
        },
        answer: `Routed to FieldForce Agent (Guard-Scoped): You currently have ${myAssigned.cnt} active shift assignment(s). Organisation-wide guard counts and payroll runs are restricted to management roles.`,
      });
      return;
    }

    const activeGuards = (
      db.prepare("SELECT COUNT(*) as cnt FROM ff_employees WHERE organization_id = ? AND status = 'active'").get(orgId) as { cnt: number }
    ).cnt;
    const assignedShifts = (
      db.prepare("SELECT COUNT(DISTINCT employee_id) as cnt FROM ff_assignments WHERE organization_id = ? AND status != 'cancelled'").get(orgId) as { cnt: number }
    ).cnt;
    let payrollNote = '';
    if (queryText.includes('payroll')) {
      const latestRun = db
        .prepare('SELECT period_label, status, total_net_kes FROM ff_payroll_runs WHERE organization_id = ? ORDER BY created_at DESC LIMIT 1')
        .get(orgId) as { period_label: string; status: string; total_net_kes: number } | undefined;
      payrollNote = latestRun
        ? ` Latest FieldForce Payroll Run "${latestRun.period_label}" (${latestRun.status}) totals KES ${latestRun.total_net_kes.toLocaleString()} net.`
        : ' No payroll runs generated yet under FieldForce -> Payroll.';
    }

    res.json({
      topic: 'deployment',
      orchestrator: {
        routedTo: 'FieldForce Agent',
        productSlug: 'fieldforce',
        agentStatus: 'active',
      },
      answer: `Routed to FieldForce Agent (Active V1): Your organisation currently has ${activeGuards} active guard(s) in the directory and ${assignedShifts} guard(s) assigned to scheduled shifts.${payrollNote}`,
    });
    return;
  }

  // Default: Unassigned / understaffed shifts check (RBAC scoped)
  const shifts = db.prepare("SELECT id, post_id FROM ff_shifts WHERE organization_id = ? AND status != 'cancelled'").all(orgId) as Array<{
    id: string;
    post_id: string;
  }>;
  const posts = db.prepare('SELECT id, required_guards FROM ff_posts WHERE organization_id = ?').all(orgId) as Array<{
    id: string;
    required_guards: number;
  }>;
  const assignments = db
    .prepare("SELECT shift_id FROM ff_assignments WHERE organization_id = ? AND status != 'cancelled'")
    .all(orgId) as Array<{ shift_id: string }>;

  const understaffed = shifts.filter((sh) => {
    const post = posts.find((p) => p.id === sh.post_id);
    const assignedCount = assignments.filter((a) => a.shift_id === sh.id).length;
    return assignedCount < (post?.required_guards ?? 1);
  });

  res.json({
    topic: topic || 'unassigned',
    orchestrator: {
      routedTo: 'FieldForce Agent',
      productSlug: 'fieldforce',
      agentStatus: 'active',
    },
    answer: `Routed to FieldForce Agent (Active V1): ${understaffed.length} published shift(s) are currently below required post staffing (${shifts.length} total published shifts). Open FieldForce -> Shifts to assign active guards with overlap protection.`,
  });
});

// ==================== ADMIN SYSTEM DIAGNOSTICS ====================

app.get('/api/admin/diagnostics', requireAuth, requireOrg, (req, res) => {
  if (!hasRole(req, ['owner', 'admin'])) {
    res.status(403).json({ error: 'System diagnostics are restricted to Owners and Admins.' });
    return;
  }

  const orgId = req.auth!.orgId!;
  const startNs = process.hrtime.bigint();
  const probe = db.prepare('SELECT 1 AS ok').get() as { ok: number } | undefined;
  const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;

  const journalMode = String(db.pragma('journal_mode', { simple: true }) ?? 'unknown');
  const foreignKeys = Boolean(db.pragma('foreign_keys', { simple: true }));
  const busyTimeoutMs = Number(db.pragma('busy_timeout', { simple: true }) ?? 0);
  const synchronousMode = String(db.pragma('synchronous', { simple: true }) ?? 'unknown');
  const pageSize = Number(db.pragma('page_size', { simple: true }) ?? 0);
  const pageCount = Number(db.pragma('page_count', { simple: true }) ?? 0);

  const tableCountRow = db
    .prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .get() as { count: number };

  let dbExists = false;
  let dbSizeBytes = 0;
  let dbModifiedAt: string | null = null;
  let walExists = false;
  let walSizeBytes = 0;

  try {
    const stat = fs.statSync(dbPath);
    dbExists = stat.isFile();
    dbSizeBytes = stat.size;
    dbModifiedAt = stat.mtime.toISOString();
  } catch {
    dbExists = false;
  }

  try {
    const walStat = fs.statSync(`${dbPath}-wal`);
    walExists = walStat.isFile();
    walSizeBytes = walStat.size;
  } catch {
    walExists = false;
  }

  const countForOrg = (table: string): number => {
    const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE organization_id = ?`).get(orgId) as {
      count: number;
    };
    return row.count;
  };

  res.json({
    express: {
      status: 'online',
      port: Number(process.env.PORT || 3000),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
      uptimeSeconds: Math.floor(process.uptime()),
      serverTime: new Date().toISOString(),
      timezone: 'Africa/Nairobi',
    },
    database: {
      engine: 'SQLite (better-sqlite3)',
      connected: Boolean(db.open && probe?.ok === 1),
      path: dbPath,
      exists: dbExists,
      sizeBytes: dbSizeBytes,
      lastModifiedAt: dbModifiedAt,
      walExists,
      walSizeBytes,
      journalMode,
      foreignKeys,
      busyTimeoutMs,
      synchronousMode,
      pageSize,
      pageCount,
      tableCount: tableCountRow.count,
      queryLatencyMs: Number(elapsedMs.toFixed(3)),
    },
    tenantCounts: {
      employees: countForOrg('ff_employees'),
      clients: countForOrg('ff_clients'),
      sites: countForOrg('ff_sites'),
      posts: countForOrg('ff_posts'),
      shifts: countForOrg('ff_shifts'),
      attendanceEvents: countForOrg('ff_attendance_events'),
      incidents: countForOrg('ff_incidents'),
      auditEvents: countForOrg('audit_events'),
    },
  });
});

// ==================== VITE DEV / STATIC SERVING ====================

const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Africa FieldForce server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

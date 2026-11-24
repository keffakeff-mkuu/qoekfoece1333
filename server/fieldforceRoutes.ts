import crypto from 'node:crypto';
import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { db, writeAuditEvent } from './db.ts';
import { hasRole } from './auth.ts';

export const fieldforceRouter = express.Router();

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function validatePhotoData(dataUrl: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (dataUrl === undefined || dataUrl === null || dataUrl === '') {
    return { ok: true, value: null };
  }
  if (typeof dataUrl !== 'string') {
    return { ok: false, error: 'Invalid photo payload type.' };
  }
  if (dataUrl.length > 900_000) {
    return { ok: false, error: 'Photo exceeds maximum allowed upload size (~650 KB).' };
  }
  if (!/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) {
    return { ok: false, error: 'Only PNG, JPEG, or WebP base64 image uploads are permitted.' };
  }
  return { ok: true, value: dataUrl };
}

function getGeminiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) return null;
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateWithGeminiFallback(systemInstruction: string, prompt: string): Promise<string | null> {
  const ai = getGeminiClient();
  if (!ai) return null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: { systemInstruction },
      });
      const text = (response?.text || '').trim();
      if (text) return text;
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
      if (!isTransient || attempt === 2) return null;
      await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)));
    }
  }
  return null;
}

function calculateKenyaPayrollTaxes(grossKes: number): { paye: number; nssf: number; shif: number } {
  const nssf = Math.min(2160, Math.round(grossKes * 0.06));
  const shif = Math.max(300, Math.round(grossKes * 0.0275));
  const taxable = Math.max(0, grossKes - nssf);

  // Kenya monthly PAYE bands (simplified statutory structure with KES 2,400 personal relief)
  let rawTax = 0;
  let remaining = taxable;
  const band1 = Math.min(remaining, 24000);
  rawTax += band1 * 0.1;
  remaining -= band1;
  if (remaining > 0) {
    const band2 = Math.min(remaining, 8333);
    rawTax += band2 * 0.25;
    remaining -= band2;
  }
  if (remaining > 0) {
    rawTax += remaining * 0.3;
  }
  const paye = Math.max(0, Math.round(rawTax - 2400));
  return { paye, nssf, shif };
}

export function computeOperationalIntelligence(orgId: string) {
  const todayIso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const in30Days = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);

  const employees = db.prepare('SELECT id, first_name, last_name, employee_number, status FROM ff_employees WHERE organization_id = ?').all(orgId) as Array<{
    id: string;
    first_name: string;
    last_name: string;
    employee_number: string;
    status: string;
  }>;
  const sites = db.prepare('SELECT id, name, is_active, latitude, longitude, geofence_radius_m FROM ff_sites WHERE organization_id = ?').all(orgId) as Array<{
    id: string;
    name: string;
    is_active: number;
    latitude: number | null;
    longitude: number | null;
    geofence_radius_m: number;
  }>;
  const posts = db.prepare('SELECT id, site_id, name, required_guards FROM ff_posts WHERE organization_id = ?').all(orgId) as Array<{
    id: string;
    site_id: string;
    name: string;
    required_guards: number;
  }>;
  const shifts = db.prepare("SELECT id, site_id, post_id, shift_date, start_time, end_time, shift_type FROM ff_shifts WHERE organization_id = ? AND status != 'cancelled'").all(orgId) as Array<{
    id: string;
    site_id: string;
    post_id: string;
    shift_date: string;
    start_time: string;
    end_time: string;
    shift_type: string;
  }>;
  const assignments = db.prepare("SELECT id, shift_id, employee_id, is_relief FROM ff_assignments WHERE organization_id = ? AND status != 'cancelled'").all(orgId) as Array<{
    id: string;
    shift_id: string;
    employee_id: string;
    is_relief: number;
  }>;
  const attendance = db.prepare('SELECT id, employee_id, shift_id, event_type, recorded_at, geofence_status, distance_meters, late_minutes, is_offline_sync FROM ff_attendance_events WHERE organization_id = ? ORDER BY recorded_at DESC').all(orgId) as Array<{
    id: string;
    employee_id: string;
    shift_id: string | null;
    event_type: string;
    recorded_at: string;
    geofence_status: string | null;
    distance_meters: number | null;
    late_minutes: number;
    is_offline_sync: number;
  }>;
  const verifications = db.prepare('SELECT attendance_event_id, status FROM ff_attendance_verifications WHERE organization_id = ?').all(orgId) as Array<{
    attendance_event_id: string;
    status: string;
  }>;
  const docs = db.prepare('SELECT id, employee_id, doc_type, title, expiry_date FROM ff_employee_documents WHERE organization_id = ? AND expiry_date IS NOT NULL').all(orgId) as Array<{
    id: string;
    employee_id: string;
    doc_type: string;
    title: string;
    expiry_date: string;
  }>;
  const quals = db.prepare('SELECT id, employee_id, qualification_name, expiry_date FROM ff_employee_qualifications WHERE organization_id = ? AND expiry_date IS NOT NULL').all(orgId) as Array<{
    id: string;
    employee_id: string;
    qualification_name: string;
    expiry_date: string;
  }>;
  const checkpoints = db.prepare('SELECT id, site_id, name FROM ff_patrol_checkpoints WHERE organization_id = ? AND is_active = 1').all(orgId) as Array<{
    id: string;
    site_id: string;
    name: string;
  }>;
  const schedules = db.prepare('SELECT id, site_id, title, frequency_minutes FROM ff_patrol_schedules WHERE organization_id = ? AND is_active = 1').all(orgId) as Array<{
    id: string;
    site_id: string;
    title: string;
    frequency_minutes: number;
  }>;
  const scans = db.prepare('SELECT id, checkpoint_id, schedule_id, site_id, scanned_at, status FROM ff_patrol_scans WHERE organization_id = ? ORDER BY scanned_at DESC').all(orgId) as Array<{
    id: string;
    checkpoint_id: string;
    schedule_id: string | null;
    site_id: string;
    scanned_at: string;
    status: string;
  }>;
  const incidents = db.prepare('SELECT id, site_id, entry_type, category, severity, status, escalation_level, occurrence_time FROM ff_incidents WHERE organization_id = ?').all(orgId) as Array<{
    id: string;
    site_id: string;
    entry_type: string;
    category: string;
    severity: string;
    status: string;
    escalation_level: string;
    occurrence_time: string;
  }>;
  const invoices = db.prepare('SELECT id, invoice_number, total_kes, amount_paid_kes, due_date, status FROM ff_invoices WHERE organization_id = ?').all(orgId) as Array<{
    id: string;
    invoice_number: string;
    total_kes: number;
    amount_paid_kes: number;
    due_date: string;
    status: string;
  }>;

  const expiringDocs = [
    ...docs
      .filter((d) => d.expiry_date <= in30Days)
      .map((d) => {
        const emp = employees.find((e) => e.id === d.employee_id);
        return {
          id: d.id,
          kind: 'document' as const,
          title: d.title,
          employeeName: emp ? `${emp.first_name} ${emp.last_name} (${emp.employee_number})` : d.employee_id,
          expiryDate: d.expiry_date,
          expired: d.expiry_date < todayIso,
        };
      }),
    ...quals
      .filter((q) => q.expiry_date <= in30Days)
      .map((q) => {
        const emp = employees.find((e) => e.id === q.employee_id);
        return {
          id: q.id,
          kind: 'qualification' as const,
          title: q.qualification_name,
          employeeName: emp ? `${emp.first_name} ${emp.last_name} (${emp.employee_number})` : q.employee_id,
          expiryDate: q.expiry_date,
          expired: q.expiry_date < todayIso,
        };
      }),
  ].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  const understaffedShifts = shifts
    .map((sh) => {
      const post = posts.find((p) => p.id === sh.post_id);
      const site = sites.find((s) => s.id === sh.site_id);
      const assigned = assignments.filter((a) => a.shift_id === sh.id).length;
      const required = post?.required_guards ?? 1;
      return {
        shiftId: sh.id,
        siteName: site?.name || sh.site_id,
        postName: post?.name || sh.post_id,
        shiftDate: sh.shift_date,
        shiftType: sh.shift_type,
        assigned,
        required,
        deficit: Math.max(0, required - assigned),
      };
    })
    .filter((s) => s.deficit > 0);

  const outsideGeofence = attendance.filter((a) => a.geofence_status === 'outside');
  const lateClockIns = attendance.filter((a) => a.event_type === 'clock_in' && a.late_minutes > 10);
  const flaggedVerifications = verifications.filter((v) => v.status === 'flagged');
  const overrides = attendance.filter((a) => a.event_type === 'supervisor_override');

  // Missed patrol rounds: checkpoints with no scan today or active schedules with missed rounds
  const missedPatrolCheckpoints = checkpoints
    .filter((cp) => !scans.some((sc) => sc.checkpoint_id === cp.id && sc.scanned_at.startsWith(todayIso)))
    .map((cp) => {
      const site = sites.find((s) => s.id === cp.site_id);
      return {
        checkpointId: cp.id,
        checkpointName: cp.name,
        siteName: site?.name || cp.site_id,
      };
    });

  const anomalies: Array<{
    id: string;
    category: 'geofence' | 'lateness' | 'patrol' | 'compliance' | 'coverage' | 'incident' | 'finance';
    severity: 'high' | 'medium' | 'low';
    title: string;
    detail: string;
    route: string;
  }> = [];

  if (understaffedShifts.length > 0) {
    anomalies.push({
      id: 'anom-coverage',
      category: 'coverage',
      severity: 'high',
      title: `${understaffedShifts.length} post shift(s) understaffed`,
      detail: `${understaffedShifts.map((s) => `${s.siteName} (${s.postName}: ${s.assigned}/${s.required})`).slice(0, 3).join('; ')}`,
      route: '/app/fieldforce/schedule',
    });
  }

  if (missedPatrolCheckpoints.length > 0) {
    anomalies.push({
      id: 'anom-patrol',
      category: 'patrol',
      severity: 'high',
      title: `${missedPatrolCheckpoints.length} checkpoint(s) pending patrol scan today`,
      detail: `${missedPatrolCheckpoints.map((c) => `${c.siteName}: ${c.checkpointName}`).slice(0, 3).join('; ')}`,
      route: '/app/fieldforce/patrols',
    });
  }

  if (expiringDocs.length > 0) {
    anomalies.push({
      id: 'anom-docs',
      category: 'compliance',
      severity: expiringDocs.some((d) => d.expired) ? 'high' : 'medium',
      title: `${expiringDocs.length} employee document/qualification(s) expiring within 30 days`,
      detail: expiringDocs.map((d) => `${d.employeeName} — ${d.title} (${d.expiryDate})`).slice(0, 2).join('; '),
      route: '/app/fieldforce/employees?tab=documents',
    });
  }

  if (outsideGeofence.length > 0) {
    anomalies.push({
      id: 'anom-geofence',
      category: 'geofence',
      severity: 'high',
      title: `${outsideGeofence.length} attendance event(s) logged outside site geofence`,
      detail: 'Supervisor verification or site coordinate calibration recommended.',
      route: '/app/fieldforce/attendance',
    });
  }

  if (lateClockIns.length > 0) {
    anomalies.push({
      id: 'anom-late',
      category: 'lateness',
      severity: 'medium',
      title: `${lateClockIns.length} late clock-in(s) (>10 mins past shift start)`,
      detail: `Max delay recorded: ${Math.max(...lateClockIns.map((l) => l.late_minutes))} mins.`,
      route: '/app/fieldforce/attendance',
    });
  }

  if (flaggedVerifications.length > 0 || overrides.length > 0) {
    anomalies.push({
      id: 'anom-overrides',
      category: 'geofence',
      severity: 'low',
      title: `${overrides.length} supervisor override(s) & ${flaggedVerifications.length} flagged verification(s)`,
      detail: 'Review immutable attendance exceptions before closing payroll.',
      route: '/app/fieldforce/attendance',
    });
  }

  const openHighIncidents = incidents.filter(
    (i) => i.entry_type === 'incident' && i.status !== 'closed' && i.status !== 'resolved' && (i.severity === 'high' || i.severity === 'critical')
  );
  if (openHighIncidents.length > 0) {
    anomalies.push({
      id: 'anom-inc',
      category: 'incident',
      severity: 'high',
      title: `${openHighIncidents.length} open high/critical security incident(s)`,
      detail: 'Escalate to operations/client notification and document resolution.',
      route: '/app/fieldforce/incidents',
    });
  }

  const unpaidInvoices = invoices.filter((inv) => inv.status !== 'paid');
  if (unpaidInvoices.length > 0) {
    const outstandingKes = unpaidInvoices.reduce((acc, inv) => acc + Math.max(0, inv.total_kes - inv.amount_paid_kes), 0);
    anomalies.push({
      id: 'anom-finance',
      category: 'finance',
      severity: unpaidInvoices.some((i) => i.due_date < todayIso) ? 'high' : 'medium',
      title: `${unpaidInvoices.length} open client invoice(s) · KES ${outstandingKes.toLocaleString()} receivable`,
      detail: 'Track M-Pesa / EFT settlements under Finance & Billing.',
      route: '/app/fieldforce/finance',
    });
  }

  const totalRequired = shifts.reduce((sum, s) => sum + (posts.find((p) => p.id === s.post_id)?.required_guards ?? 1), 0);
  const totalAssigned = shifts.reduce((sum, s) => sum + Math.min(assignments.filter((a) => a.shift_id === s.id).length, posts.find((p) => p.id === s.post_id)?.required_guards ?? 1), 0);
  const coverageRate = totalRequired > 0 ? Math.round((totalAssigned / totalRequired) * 100) : 100;

  const totalClockIns = attendance.filter((a) => a.event_type === 'clock_in').length;
  const onTimeClockIns = attendance.filter((a) => a.event_type === 'clock_in' && a.late_minutes <= 10).length;
  const onTimeRate = totalClockIns > 0 ? Math.round((onTimeClockIns / totalClockIns) * 100) : 100;

  const scannedCpToday = checkpoints.length - missedPatrolCheckpoints.length;
  const patrolComplianceRate = checkpoints.length > 0 ? Math.round((scannedCpToday / checkpoints.length) * 100) : 100;

  const recommendations: string[] = [];
  if (understaffedShifts.length > 0) {
    recommendations.push(
      `Deploy relief guards to ${understaffedShifts[0].siteName} (${understaffedShifts[0].postName}) where ${understaffedShifts[0].deficit} post slot(s) remain unfilled.`
    );
  }
  if (expiringDocs.length > 0) {
    recommendations.push(
      `Initiate renewal for ${expiringDocs[0].employeeName}'s ${expiringDocs[0].title} expiring on ${expiringDocs[0].expiryDate} to remain PSRA compliant.`
    );
  }
  if (missedPatrolCheckpoints.length > 0) {
    recommendations.push(
      `Prompt site supervisor to complete QR verification at ${missedPatrolCheckpoints[0].checkpointName} (${missedPatrolCheckpoints[0].siteName}).`
    );
  }
  if (unpaidInvoices.length > 0) {
    recommendations.push(
      `Follow up settlement on ${unpaidInvoices[0].invoice_number} to reduce open accounts receivable.`
    );
  }
  if (recommendations.length === 0) {
    recommendations.push('All manned posts, patrol checkpoints, and compliance documents are within operational thresholds.');
  }

  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      activeEmployees: employees.filter((e) => e.status === 'active').length,
      activeSites: sites.filter((s) => s.is_active === 1).length,
      coverageRate,
      onTimeRate,
      patrolComplianceRate,
      expiringDocsCount: expiringDocs.length,
      missedPatrolCount: missedPatrolCheckpoints.length,
      openIncidentsCount: incidents.filter((i) => i.entry_type === 'incident' && i.status !== 'closed' && i.status !== 'resolved').length,
      activeSchedulesCount: schedules.length,
    },
    expiringDocs,
    understaffedShifts,
    missedPatrolCheckpoints,
    anomalies,
    recommendations,
  };
}

// ==================== MODULE 02: SITE GEOFENCE UPDATE ====================

fieldforceRouter.patch('/sites/:id/geofence', (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'operations_manager'])) {
    res.status(403).json({ error: 'Only Operations Managers, Admins, or Owners can update site geofences.' });
    return;
  }
  const schema = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    geofence_radius_m: z.number().int().min(30).max(5000),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Valid latitude, longitude, and radius (30–5000m) are required.' });
    return;
  }
  const existing = db.prepare('SELECT id FROM ff_sites WHERE id = ? AND organization_id = ?').get(req.params.id, req.auth!.orgId);
  if (!existing) {
    res.status(404).json({ error: 'Site not found.' });
    return;
  }
  db.prepare(`
    UPDATE ff_sites
    SET latitude = ?, longitude = ?, geofence_radius_m = ?, updated_at = datetime('now')
    WHERE id = ? AND organization_id = ?
  `).run(parsed.data.latitude, parsed.data.longitude, parsed.data.geofence_radius_m, req.params.id, req.auth!.orgId);

  writeAuditEvent({
    organizationId: req.auth!.orgId!,
    actorId: req.auth!.userId,
    actorName: req.auth!.fullName,
    action: 'site.geofence_updated',
    entityType: 'ff_sites',
    entityId: req.params.id,
    metadata: parsed.data,
  });

  const site = db.prepare('SELECT * FROM ff_sites WHERE id = ?').get(req.params.id) as Record<string, unknown>;
  res.json({ site: { ...site, is_active: Boolean(site.is_active) } });
});

// ==================== MODULE 01: EMPLOYEE HR SUB-RECORDS ====================

fieldforceRouter.post('/hr/contracts', (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'operations_manager', 'hr_manager'])) {
    res.status(403).json({ error: 'Only HR, Ops Managers, or Owners can add employee contracts.' });
    return;
  }
  const schema = z.object({
    employee_id: z.string().min(1),
    contract_type: z.enum(['permanent', 'fixed_term', 'casual', 'probation']),
    base_salary_kes: z.number().min(0),
    shift_allowance_kes: z.number().min(0).default(0),
    overtime_rate_kes: z.number().min(0).default(0),
    start_date: z.string().min(8),
    end_date: z.string().nullable().optional(),
    notes: z.string().max(400).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid contract details.' });
    return;
  }
  const emp = db.prepare('SELECT id FROM ff_employees WHERE id = ? AND organization_id = ?').get(parsed.data.employee_id, req.auth!.orgId);
  if (!emp) {
    res.status(404).json({ error: 'Employee not found.' });
    return;
  }
  const id = `ctr-${crypto.randomUUID().slice(0, 12)}`;
  db.prepare(`
    INSERT INTO ff_employee_contracts (id, organization_id, employee_id, contract_type, base_salary_kes, shift_allowance_kes, overtime_rate_kes, start_date, end_date, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `).run(
    id,
    req.auth!.orgId,
    parsed.data.employee_id,
    parsed.data.contract_type,
    parsed.data.base_salary_kes,
    parsed.data.shift_allowance_kes,
    parsed.data.overtime_rate_kes,
    parsed.data.start_date,
    parsed.data.end_date ?? null,
    parsed.data.notes ?? ''
  );

  writeAuditEvent({
    organizationId: req.auth!.orgId!,
    actorId: req.auth!.userId,
    actorName: req.auth!.fullName,
    action: 'employee.contract_created',
    entityType: 'ff_employee_contracts',
    entityId: id,
    metadata: { employee_id: parsed.data.employee_id, contract_type: parsed.data.contract_type },
  });

  const contract = db.prepare('SELECT * FROM ff_employee_contracts WHERE id = ?').get(id);
  res.status(201).json({ contract });
});

fieldforceRouter.post('/hr/documents', (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'operations_manager', 'hr_manager'])) {
    res.status(403).json({ error: 'Insufficient permissions to add compliance documents.' });
    return;
  }
  const schema = z.object({
    employee_id: z.string().min(1),
    doc_type: z.enum(['psra_license', 'good_conduct', 'contract_signed', 'medical_cert', 'id_copy', 'other']),
    title: z.string().trim().min(2).max(160),
    reference_number: z.string().trim().max(80).optional(),
    issue_date: z.string().nullable().optional(),
    expiry_date: z.string().nullable().optional(),
    file_name: z.string().trim().max(160).optional(),
    notes: z.string().trim().max(400).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid document fields.' });
    return;
  }
  const emp = db.prepare('SELECT id FROM ff_employees WHERE id = ? AND organization_id = ?').get(parsed.data.employee_id, req.auth!.orgId);
  if (!emp) {
    res.status(404).json({ error: 'Employee not found.' });
    return;
  }
  const id = `doc-${crypto.randomUUID().slice(0, 12)}`;
  db.prepare(`
    INSERT INTO ff_employee_documents (id, organization_id, employee_id, doc_type, title, reference_number, issue_date, expiry_date, file_name, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    req.auth!.orgId,
    parsed.data.employee_id,
    parsed.data.doc_type,
    parsed.data.title,
    parsed.data.reference_number ?? '',
    parsed.data.issue_date ?? null,
    parsed.data.expiry_date ?? null,
    parsed.data.file_name ?? '',
    parsed.data.notes ?? ''
  );

  writeAuditEvent({
    organizationId: req.auth!.orgId!,
    actorId: req.auth!.userId,
    actorName: req.auth!.fullName,
    action: 'employee.document_logged',
    entityType: 'ff_employee_documents',
    entityId: id,
    metadata: { title: parsed.data.title, expiry_date: parsed.data.expiry_date },
  });

  const document = db.prepare('SELECT * FROM ff_employee_documents WHERE id = ?').get(id);
  res.status(201).json({ document });
});

fieldforceRouter.post('/hr/qualifications', (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'operations_manager', 'hr_manager'])) {
    res.status(403).json({ error: 'Insufficient permissions to add qualifications.' });
    return;
  }
  const schema = z.object({
    employee_id: z.string().min(1),
    qualification_name: z.string().trim().min(2).max(160),
    provider: z.string().trim().max(160).optional(),
    achieved_date: z.string().min(8),
    expiry_date: z.string().nullable().optional(),
    certificate_ref: z.string().trim().max(80).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid qualification fields.' });
    return;
  }
  const emp = db.prepare('SELECT id FROM ff_employees WHERE id = ? AND organization_id = ?').get(parsed.data.employee_id, req.auth!.orgId);
  if (!emp) {
    res.status(404).json({ error: 'Employee not found.' });
    return;
  }
  const id = `qual-${crypto.randomUUID().slice(0, 12)}`;
  db.prepare(`
    INSERT INTO ff_employee_qualifications (id, organization_id, employee_id, qualification_name, provider, achieved_date, expiry_date, certificate_ref)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    req.auth!.orgId,
    parsed.data.employee_id,
    parsed.data.qualification_name,
    parsed.data.provider ?? '',
    parsed.data.achieved_date,
    parsed.data.expiry_date ?? null,
    parsed.data.certificate_ref ?? ''
  );

  const qualification = db.prepare('SELECT * FROM ff_employee_qualifications WHERE id = ?').get(id);
  res.status(201).json({ qualification });
});

fieldforceRouter.post('/hr/leave', (req, res) => {
  if (req.auth!.role === 'client') {
    res.status(403).json({ error: 'Clients cannot submit internal employee leave.' });
    return;
  }
  const schema = z.object({
    employee_id: z.string().min(1),
    leave_type: z.enum(['annual', 'sick', 'compassionate', 'unpaid', 'off_duty']),
    start_date: z.string().min(8),
    end_date: z.string().min(8),
    days_count: z.number().int().min(1).max(180),
    reason: z.string().trim().max(400).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid leave request.' });
    return;
  }
  const emp = db.prepare('SELECT id, user_id FROM ff_employees WHERE id = ? AND organization_id = ?').get(parsed.data.employee_id, req.auth!.orgId) as { id: string; user_id: string | null } | undefined;
  if (!emp) {
    res.status(404).json({ error: 'Employee not found.' });
    return;
  }
  if (req.auth!.role === 'guard' && emp.user_id !== req.auth!.userId) {
    res.status(403).json({ error: 'Guards can only request leave for their own profile.' });
    return;
  }

  const id = `lv-${crypto.randomUUID().slice(0, 12)}`;
  db.prepare(`
    INSERT INTO ff_leave_records (id, organization_id, employee_id, leave_type, start_date, end_date, days_count, reason, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(id, req.auth!.orgId, parsed.data.employee_id, parsed.data.leave_type, parsed.data.start_date, parsed.data.end_date, parsed.data.days_count, parsed.data.reason ?? '');

  const leave = db.prepare('SELECT * FROM ff_leave_records WHERE id = ?').get(id);
  res.status(201).json({ leave });
});

fieldforceRouter.patch('/hr/leave/:id/status', (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'operations_manager', 'hr_manager'])) {
    res.status(403).json({ error: 'Only HR or Operations Managers can approve or reject leave.' });
    return;
  }
  const schema = z.object({ status: z.enum(['approved', 'rejected']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid leave decision.' });
    return;
  }
  const existing = db.prepare('SELECT id, employee_id FROM ff_leave_records WHERE id = ? AND organization_id = ?').get(req.params.id, req.auth!.orgId) as { id: string; employee_id: string } | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Leave request not found.' });
    return;
  }
  db.transaction(() => {
    db.prepare('UPDATE ff_leave_records SET status = ?, approved_by = ? WHERE id = ?').run(parsed.data.status, req.auth!.fullName, existing.id);
    if (parsed.data.status === 'approved') {
      db.prepare("UPDATE ff_employees SET status = 'on_leave', updated_at = datetime('now') WHERE id = ? AND status = 'active'").run(existing.employee_id);
    }
    writeAuditEvent({
      organizationId: req.auth!.orgId!,
      actorId: req.auth!.userId,
      actorName: req.auth!.fullName,
      action: `leave.${parsed.data.status}`,
      entityType: 'ff_leave_records',
      entityId: existing.id,
      metadata: { employee_id: existing.employee_id },
    });
  })();
  const leave = db.prepare('SELECT * FROM ff_leave_records WHERE id = ?').get(existing.id);
  res.json({ leave });
});

fieldforceRouter.post('/hr/disciplinary', (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'operations_manager', 'hr_manager', 'supervisor'])) {
    res.status(403).json({ error: 'Insufficient permissions to log disciplinary or commendation records.' });
    return;
  }
  const schema = z.object({
    employee_id: z.string().min(1),
    incident_date: z.string().min(8),
    category: z.enum(['lateness', 'uniform', 'sleeping_on_duty', 'insubordination', 'absence', 'commendation']),
    severity: z.enum(['verbal_warning', 'written_warning', 'final_warning', 'suspension', 'cleared']),
    summary: z.string().trim().min(5).max(800),
    action_taken: z.string().trim().max(400).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid disciplinary record.' });
    return;
  }
  const emp = db.prepare('SELECT id FROM ff_employees WHERE id = ? AND organization_id = ?').get(parsed.data.employee_id, req.auth!.orgId);
  if (!emp) {
    res.status(404).json({ error: 'Employee not found.' });
    return;
  }
  const id = `dsc-${crypto.randomUUID().slice(0, 12)}`;
  db.prepare(`
    INSERT INTO ff_disciplinary_records (id, organization_id, employee_id, incident_date, category, severity, summary, action_taken, recorded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.auth!.orgId, parsed.data.employee_id, parsed.data.incident_date, parsed.data.category, parsed.data.severity, parsed.data.summary, parsed.data.action_taken ?? '', req.auth!.fullName);

  writeAuditEvent({
    organizationId: req.auth!.orgId!,
    actorId: req.auth!.userId,
    actorName: req.auth!.fullName,
    action: 'employee.disciplinary_logged',
    entityType: 'ff_disciplinary_records',
    entityId: id,
    metadata: { category: parsed.data.category, severity: parsed.data.severity },
  });

  const record = db.prepare('SELECT * FROM ff_disciplinary_records WHERE id = ?').get(id);
  res.status(201).json({ record });
});

// ==================== MODULE 03: SUPERVISOR ATTENDANCE VERIFICATION ====================

fieldforceRouter.post('/attendance/:id/verify', (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'operations_manager', 'supervisor'])) {
    res.status(403).json({ error: 'Only supervisors or managers can verify attendance records.' });
    return;
  }
  const schema = z.object({
    status: z.enum(['verified', 'flagged']),
    notes: z.string().trim().max(400).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Verification status (verified or flagged) is required.' });
    return;
  }
  const event = db.prepare('SELECT id FROM ff_attendance_events WHERE id = ? AND organization_id = ?').get(req.params.id, req.auth!.orgId);
  if (!event) {
    res.status(404).json({ error: 'Attendance event not found.' });
    return;
  }

  const id = `ver-${crypto.randomUUID().slice(0, 12)}`;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO ff_attendance_verifications (id, organization_id, attendance_event_id, status, notes, verified_by, verified_by_name, verified_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(attendance_event_id) DO UPDATE SET
      status = excluded.status,
      notes = excluded.notes,
      verified_by = excluded.verified_by,
      verified_by_name = excluded.verified_by_name,
      verified_at = excluded.verified_at
  `).run(id, req.auth!.orgId, req.params.id, parsed.data.status, parsed.data.notes ?? '', req.auth!.userId, req.auth!.fullName, now);

  writeAuditEvent({
    organizationId: req.auth!.orgId!,
    actorId: req.auth!.userId,
    actorName: req.auth!.fullName,
    action: `attendance.${parsed.data.status}`,
    entityType: 'ff_attendance_verifications',
    entityId: req.params.id,
    metadata: { status: parsed.data.status },
  });

  const verification = db.prepare('SELECT * FROM ff_attendance_verifications WHERE attendance_event_id = ?').get(req.params.id);
  res.json({ verification });
});

// ==================== MODULE 04: PATROL MANAGEMENT ====================

fieldforceRouter.post('/patrols/checkpoints', (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'operations_manager', 'supervisor'])) {
    res.status(403).json({ error: 'Insufficient permissions to configure patrol checkpoints.' });
    return;
  }
  const schema = z.object({
    site_id: z.string().min(1),
    name: z.string().trim().min(2).max(120),
    location_hint: z.string().trim().max(200).optional(),
    qr_code: z.string().trim().min(3).max(60).optional(),
    sequence_order: z.number().int().min(1).max(100).default(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid checkpoint data.' });
    return;
  }
  const site = db.prepare('SELECT id FROM ff_sites WHERE id = ? AND organization_id = ?').get(parsed.data.site_id, req.auth!.orgId);
  if (!site) {
    res.status(404).json({ error: 'Site not found.' });
    return;
  }
  const qrCode = parsed.data.qr_code || `QR-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const dup = db.prepare('SELECT id FROM ff_patrol_checkpoints WHERE organization_id = ? AND qr_code = ?').get(req.auth!.orgId, qrCode);
  if (dup) {
    res.status(409).json({ error: `QR code ${qrCode} is already assigned to another checkpoint.` });
    return;
  }
  const id = `cp-${crypto.randomUUID().slice(0, 12)}`;
  db.prepare(`
    INSERT INTO ff_patrol_checkpoints (id, organization_id, site_id, name, location_hint, qr_code, sequence_order, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(id, req.auth!.orgId, parsed.data.site_id, parsed.data.name, parsed.data.location_hint ?? '', qrCode, parsed.data.sequence_order);

  const checkpoint = db.prepare('SELECT * FROM ff_patrol_checkpoints WHERE id = ?').get(id);
  res.status(201).json({ checkpoint });
});

fieldforceRouter.post('/patrols/schedules', (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'operations_manager', 'supervisor'])) {
    res.status(403).json({ error: 'Insufficient permissions to create patrol schedules.' });
    return;
  }
  const schema = z.object({
    site_id: z.string().min(1),
    title: z.string().trim().min(2).max(140),
    frequency_minutes: z.number().int().min(15).max(720).default(60),
    start_hour: z.number().int().min(0).max(23).default(18),
    end_hour: z.number().int().min(0).max(23).default(6),
    assigned_employee_id: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid patrol schedule.' });
    return;
  }
  const site = db.prepare('SELECT id FROM ff_sites WHERE id = ? AND organization_id = ?').get(parsed.data.site_id, req.auth!.orgId);
  if (!site) {
    res.status(404).json({ error: 'Site not found.' });
    return;
  }
  const id = `psch-${crypto.randomUUID().slice(0, 12)}`;
  db.prepare(`
    INSERT INTO ff_patrol_schedules (id, organization_id, site_id, title, frequency_minutes, start_hour, end_hour, assigned_employee_id, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    id,
    req.auth!.orgId,
    parsed.data.site_id,
    parsed.data.title,
    parsed.data.frequency_minutes,
    parsed.data.start_hour,
    parsed.data.end_hour,
    parsed.data.assigned_employee_id ?? null
  );
  const schedule = db.prepare('SELECT * FROM ff_patrol_schedules WHERE id = ?').get(id);
  res.status(201).json({ schedule });
});

fieldforceRouter.post('/patrols/scans', (req, res) => {
  if (req.auth!.role === 'client') {
    res.status(403).json({ error: 'Clients cannot record patrol scans.' });
    return;
  }
  const schema = z.object({
    qr_code: z.string().trim().optional(),
    checkpoint_id: z.string().trim().optional(),
    schedule_id: z.string().nullable().optional(),
    employee_id: z.string().nullable().optional(),
    verification_method: z.enum(['qr_scan', 'manual_code', 'nfc']).default('qr_scan'),
    notes: z.string().trim().max(500).optional(),
    proof_photo_data: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success || (!parsed.data.qr_code && !parsed.data.checkpoint_id)) {
    res.status(400).json({ error: 'Provide either a scanned QR code or select a checkpoint.' });
    return;
  }

  const photoValidation = validatePhotoData(parsed.data.proof_photo_data);
  if (!photoValidation.ok) {
    res.status(400).json({ error: photoValidation.error });
    return;
  }

  const checkpoint = parsed.data.qr_code
    ? (db.prepare('SELECT * FROM ff_patrol_checkpoints WHERE organization_id = ? AND upper(qr_code) = upper(?)').get(req.auth!.orgId, parsed.data.qr_code) as { id: string; site_id: string; name: string } | undefined)
    : (db.prepare('SELECT * FROM ff_patrol_checkpoints WHERE organization_id = ? AND id = ?').get(req.auth!.orgId, parsed.data.checkpoint_id) as { id: string; site_id: string; name: string } | undefined);

  if (!checkpoint) {
    res.status(404).json({ error: 'Patrol checkpoint QR code not recognised for this organisation.' });
    return;
  }

  let empId = parsed.data.employee_id ?? null;
  if (!empId && req.auth!.role === 'guard') {
    const myEmp = db.prepare('SELECT id FROM ff_employees WHERE organization_id = ? AND user_id = ?').get(req.auth!.orgId, req.auth!.userId) as { id: string } | undefined;
    empId = myEmp?.id ?? null;
  }

  const id = `pscn-${crypto.randomUUID().slice(0, 12)}`;
  const scannedAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO ff_patrol_scans (id, organization_id, schedule_id, checkpoint_id, site_id, employee_id, scanned_at, verification_method, notes, proof_photo_data, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
  `).run(
    id,
    req.auth!.orgId,
    parsed.data.schedule_id ?? null,
    checkpoint.id,
    checkpoint.site_id,
    empId,
    scannedAt,
    parsed.data.verification_method,
    parsed.data.notes ?? '',
    photoValidation.value
  );

  writeAuditEvent({
    organizationId: req.auth!.orgId!,
    actorId: req.auth!.userId,
    actorName: req.auth!.fullName,
    action: 'patrol.checkpoint_scanned',
    entityType: 'ff_patrol_scans',
    entityId: id,
    metadata: { checkpoint_id: checkpoint.id, checkpoint_name: checkpoint.name, method: parsed.data.verification_method },
  });

  const scan = db.prepare('SELECT * FROM ff_patrol_scans WHERE id = ?').get(id);
  res.status(201).json({ scan });
});

// ==================== MODULE 05: INCIDENT ESCALATION ====================

fieldforceRouter.patch('/incidents/:id/escalate', (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'operations_manager', 'supervisor'])) {
    res.status(403).json({ error: 'Only supervisors or managers can escalate incidents.' });
    return;
  }
  const schema = z.object({
    escalation_level: z.enum(['site', 'operations', 'executive', 'client_notified']),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Valid escalation level is required.' });
    return;
  }
  const existing = db.prepare('SELECT id FROM ff_incidents WHERE id = ? AND organization_id = ?').get(req.params.id, req.auth!.orgId);
  if (!existing) {
    res.status(404).json({ error: 'Incident not found.' });
    return;
  }
  const escalatedAt = new Date().toISOString();
  db.prepare(`
    UPDATE ff_incidents
    SET escalation_level = ?, escalated_at = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(parsed.data.escalation_level, escalatedAt, req.params.id);

  writeAuditEvent({
    organizationId: req.auth!.orgId!,
    actorId: req.auth!.userId,
    actorName: req.auth!.fullName,
    action: 'incident.escalated',
    entityType: 'ff_incidents',
    entityId: req.params.id,
    metadata: { escalation_level: parsed.data.escalation_level },
  });

  const incident = db.prepare('SELECT * FROM ff_incidents WHERE id = ?').get(req.params.id);
  res.json({ incident });
});

// ==================== MODULE 06: PAYROLL ====================

fieldforceRouter.post('/payroll/generate', (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'finance_manager', 'hr_manager'])) {
    res.status(403).json({ error: 'Only Finance, HR Managers, Admins, or Owners can generate payroll runs.' });
    return;
  }
  const schema = z.object({
    period_label: z.string().trim().min(3).max(80),
    period_start: z.string().min(8),
    period_end: z.string().min(8),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Period label, start date, and end date are required.' });
    return;
  }
  const orgId = req.auth!.orgId!;
  const activeEmps = db
    .prepare("SELECT * FROM ff_employees WHERE organization_id = ? AND status IN ('active', 'on_leave')")
    .all(orgId) as Array<{ id: string }>;

  if (activeEmps.length === 0) {
    res.status(400).json({ error: 'No eligible employees found to compute payroll.' });
    return;
  }

  const runId = `pr-${crypto.randomUUID().slice(0, 12)}`;
  const contracts = db
    .prepare("SELECT * FROM ff_employee_contracts WHERE organization_id = ? AND status = 'active'")
    .all(orgId) as Array<{ employee_id: string; base_salary_kes: number; shift_allowance_kes: number; overtime_rate_kes: number }>;

  const attendanceInPeriod = db
    .prepare('SELECT employee_id, shift_id, event_type, recorded_at FROM ff_attendance_events WHERE organization_id = ? AND recorded_at >= ? AND recorded_at <= ?')
    .all(orgId, `${parsed.data.period_start}T00:00:00`, `${parsed.data.period_end}T23:59:59Z`) as Array<{
    employee_id: string;
    shift_id: string | null;
    event_type: string;
    recorded_at: string;
  }>;

  const assignments = db
    .prepare("SELECT a.employee_id, s.shift_date, s.start_time, s.end_time FROM ff_assignments a JOIN ff_shifts s ON s.id = a.shift_id WHERE a.organization_id = ? AND a.status != 'cancelled' AND s.shift_date >= ? AND s.shift_date <= ?")
    .all(orgId, parsed.data.period_start, parsed.data.period_end) as Array<{ employee_id: string; shift_date: string; start_time: string; end_time: string }>;

  let totalGross = 0;
  let totalDeductions = 0;
  let totalNet = 0;

  db.transaction(() => {
    db.prepare(`
      INSERT INTO ff_payroll_runs (id, organization_id, period_label, period_start, period_end, status)
      VALUES (?, ?, ?, ?, ?, 'draft')
    `).run(runId, orgId, parsed.data.period_label, parsed.data.period_start, parsed.data.period_end);

    for (const emp of activeEmps) {
      const ctr = contracts.find((c) => c.employee_id === emp.id);
      const basePay = ctr ? ctr.base_salary_kes : 24000;
      const allowances = ctr ? ctr.shift_allowance_kes : 2500;
      const otRate = ctr ? ctr.overtime_rate_kes : 280;

      const empClockIns = attendanceInPeriod.filter((a) => a.employee_id === emp.id && a.event_type === 'clock_in').length;
      const empShifts = Math.max(empClockIns, assignments.filter((a) => a.employee_id === emp.id).length);
      const hoursWorked = empShifts * 12;
      const overtimeHours = Math.max(0, hoursWorked - 160);
      const overtimePay = Math.round(overtimeHours * otRate);

      const grossPay = Math.round(basePay + allowances + overtimePay);
      const { paye, nssf, shif } = calculateKenyaPayrollTaxes(grossPay);
      const empDeductions = paye + nssf + shif;
      const netPay = Math.max(0, grossPay - empDeductions);

      totalGross += grossPay;
      totalDeductions += empDeductions;
      totalNet += netPay;

      db.prepare(`
        INSERT INTO ff_payslips (
          id, organization_id, payroll_run_id, employee_id, shifts_worked, hours_worked, overtime_hours,
          base_pay_kes, allowances_kes, overtime_pay_kes, gross_pay_kes, paye_kes, nssf_kes, shif_kes,
          other_deductions_kes, total_deductions_kes, net_pay_kes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'draft')
      `).run(
        `ps-${crypto.randomUUID().slice(0, 12)}`,
        orgId,
        runId,
        emp.id,
        empShifts,
        hoursWorked,
        overtimeHours,
        basePay,
        allowances,
        overtimePay,
        grossPay,
        paye,
        nssf,
        shif,
        empDeductions,
        netPay
      );
    }

    db.prepare(`
      UPDATE ff_payroll_runs
      SET total_gross_kes = ?, total_deductions_kes = ?, total_net_kes = ?
      WHERE id = ?
    `).run(totalGross, totalDeductions, totalNet, runId);

    writeAuditEvent({
      organizationId: orgId,
      actorId: req.auth!.userId,
      actorName: req.auth!.fullName,
      action: 'payroll.run_generated',
      entityType: 'ff_payroll_runs',
      entityId: runId,
      metadata: { period_label: parsed.data.period_label, employees: activeEmps.length, total_net_kes: totalNet },
    });
  })();

  const run = db.prepare('SELECT * FROM ff_payroll_runs WHERE id = ?').get(runId);
  const payslips = db.prepare('SELECT * FROM ff_payslips WHERE payroll_run_id = ?').all(runId);
  res.status(201).json({ run, payslips });
});

fieldforceRouter.patch('/payroll/runs/:id/status', (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'finance_manager'])) {
    res.status(403).json({ error: 'Only Finance Managers, Admins, or Owners can approve or mark payroll paid.' });
    return;
  }
  const schema = z.object({ status: z.enum(['approved', 'paid']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payroll status.' });
    return;
  }
  const existing = db.prepare('SELECT id, status FROM ff_payroll_runs WHERE id = ? AND organization_id = ?').get(req.params.id, req.auth!.orgId) as { id: string; status: string } | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Payroll run not found.' });
    return;
  }
  const now = new Date().toISOString();
  db.transaction(() => {
    db.prepare(`
      UPDATE ff_payroll_runs
      SET status = ?, approved_by = COALESCE(approved_by, ?), approved_at = COALESCE(approved_at, ?)
      WHERE id = ?
    `).run(parsed.data.status, req.auth!.fullName, now, existing.id);

    db.prepare('UPDATE ff_payslips SET status = ? WHERE payroll_run_id = ?').run(parsed.data.status, existing.id);

    writeAuditEvent({
      organizationId: req.auth!.orgId!,
      actorId: req.auth!.userId,
      actorName: req.auth!.fullName,
      action: `payroll.run_${parsed.data.status}`,
      entityType: 'ff_payroll_runs',
      entityId: existing.id,
    });
  })();
  const run = db.prepare('SELECT * FROM ff_payroll_runs WHERE id = ?').get(existing.id);
  res.json({ run });
});

fieldforceRouter.patch('/payslips/:id', (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'finance_manager', 'hr_manager'])) {
    res.status(403).json({ error: 'Insufficient permissions to adjust payslips.' });
    return;
  }
  const schema = z.object({
    allowances_kes: z.number().min(0),
    overtime_pay_kes: z.number().min(0),
    other_deductions_kes: z.number().min(0),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Valid non-negative KES values required.' });
    return;
  }
  const ps = db.prepare('SELECT * FROM ff_payslips WHERE id = ? AND organization_id = ?').get(req.params.id, req.auth!.orgId) as {
    id: string;
    payroll_run_id: string;
    base_pay_kes: number;
    status: string;
  } | undefined;
  if (!ps) {
    res.status(404).json({ error: 'Payslip not found.' });
    return;
  }
  if (ps.status !== 'draft') {
    res.status(409).json({ error: 'Cannot modify payslip after payroll run has been approved.' });
    return;
  }

  db.transaction(() => {
    const gross = Math.round(ps.base_pay_kes + parsed.data.allowances_kes + parsed.data.overtime_pay_kes);
    const { paye, nssf, shif } = calculateKenyaPayrollTaxes(gross);
    const totDed = paye + nssf + shif + Math.round(parsed.data.other_deductions_kes);
    const net = Math.max(0, gross - totDed);

    db.prepare(`
      UPDATE ff_payslips
      SET allowances_kes = ?, overtime_pay_kes = ?, gross_pay_kes = ?, paye_kes = ?, nssf_kes = ?, shif_kes = ?,
          other_deductions_kes = ?, total_deductions_kes = ?, net_pay_kes = ?
      WHERE id = ?
    `).run(parsed.data.allowances_kes, parsed.data.overtime_pay_kes, gross, paye, nssf, shif, parsed.data.other_deductions_kes, totDed, net, ps.id);

    const agg = db
      .prepare('SELECT SUM(gross_pay_kes) AS g, SUM(total_deductions_kes) AS d, SUM(net_pay_kes) AS n FROM ff_payslips WHERE payroll_run_id = ?')
      .get(ps.payroll_run_id) as { g: number; d: number; n: number };

    db.prepare('UPDATE ff_payroll_runs SET total_gross_kes = ?, total_deductions_kes = ?, total_net_kes = ? WHERE id = ?').run(
      agg.g || 0,
      agg.d || 0,
      agg.n || 0,
      ps.payroll_run_id
    );
  })();

  const updated = db.prepare('SELECT * FROM ff_payslips WHERE id = ?').get(ps.id);
  res.json({ payslip: updated });
});

// ==================== MODULE 07: FINANCE & BILLING ====================

fieldforceRouter.post('/finance/contracts', (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'finance_manager', 'operations_manager'])) {
    res.status(403).json({ error: 'Insufficient permissions to create client contracts.' });
    return;
  }
  const schema = z.object({
    client_id: z.string().min(1),
    site_id: z.string().nullable().optional(),
    contract_ref: z.string().trim().min(2).max(60),
    monthly_fee_kes: z.number().min(0),
    guards_billed: z.number().int().min(1).default(1),
    billing_cycle: z.enum(['monthly', 'quarterly']).default('monthly'),
    start_date: z.string().min(8),
    end_date: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid contract fields.' });
    return;
  }
  const client = db.prepare('SELECT id FROM ff_clients WHERE id = ? AND organization_id = ?').get(parsed.data.client_id, req.auth!.orgId);
  if (!client) {
    res.status(404).json({ error: 'Client not found.' });
    return;
  }
  const id = `cc-${crypto.randomUUID().slice(0, 12)}`;
  db.prepare(`
    INSERT INTO ff_client_contracts (id, organization_id, client_id, site_id, contract_ref, monthly_fee_kes, guards_billed, billing_cycle, start_date, end_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
  `).run(id, req.auth!.orgId, parsed.data.client_id, parsed.data.site_id ?? null, parsed.data.contract_ref, parsed.data.monthly_fee_kes, parsed.data.guards_billed, parsed.data.billing_cycle, parsed.data.start_date, parsed.data.end_date ?? null);

  const contract = db.prepare('SELECT * FROM ff_client_contracts WHERE id = ?').get(id);
  res.status(201).json({ contract });
});

fieldforceRouter.post('/finance/invoices', (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'finance_manager'])) {
    res.status(403).json({ error: 'Only Finance Managers, Admins, or Owners can issue client invoices.' });
    return;
  }
  const schema = z.object({
    client_id: z.string().min(1),
    contract_id: z.string().nullable().optional(),
    issue_date: z.string().min(8),
    due_date: z.string().min(8),
    description: z.string().trim().min(3).max(200),
    subtotal_kes: z.number().min(1),
    include_vat: z.boolean().default(true),
    notes: z.string().trim().max(400).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid invoice payload.' });
    return;
  }
  const client = db.prepare('SELECT id FROM ff_clients WHERE id = ? AND organization_id = ?').get(parsed.data.client_id, req.auth!.orgId);
  if (!client) {
    res.status(404).json({ error: 'Client not found.' });
    return;
  }
  const subtotal = Math.round(parsed.data.subtotal_kes);
  const tax = parsed.data.include_vat ? Math.round(subtotal * 0.16) : 0;
  const total = subtotal + tax;
  const existingCount = (db.prepare('SELECT COUNT(*) AS c FROM ff_invoices WHERE organization_id = ?').get(req.auth!.orgId) as { c: number }).c;
  const invNo = `INV-${new Date().getFullYear()}-${String(101 + existingCount).padStart(4, '0')}`;
  const id = `inv-${crypto.randomUUID().slice(0, 12)}`;

  db.prepare(`
    INSERT INTO ff_invoices (id, organization_id, client_id, contract_id, invoice_number, issue_date, due_date, subtotal_kes, tax_kes, total_kes, amount_paid_kes, status, line_items_json, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'sent', ?, ?)
  `).run(
    id,
    req.auth!.orgId,
    parsed.data.client_id,
    parsed.data.contract_id ?? null,
    invNo,
    parsed.data.issue_date,
    parsed.data.due_date,
    subtotal,
    tax,
    total,
    JSON.stringify([{ description: parsed.data.description, qty: 1, unit_kes: subtotal }]),
    parsed.data.notes ?? ''
  );

  writeAuditEvent({
    organizationId: req.auth!.orgId!,
    actorId: req.auth!.userId,
    actorName: req.auth!.fullName,
    action: 'finance.invoice_issued',
    entityType: 'ff_invoices',
    entityId: id,
    metadata: { invoice_number: invNo, total_kes: total },
  });

  const invoice = db.prepare('SELECT * FROM ff_invoices WHERE id = ?').get(id);
  res.status(201).json({ invoice });
});

fieldforceRouter.post('/finance/receipts', (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'finance_manager'])) {
    res.status(403).json({ error: 'Only Finance Managers, Admins, or Owners can record receipts.' });
    return;
  }
  const schema = z.object({
    invoice_id: z.string().min(1),
    amount_kes: z.number().positive(),
    payment_method: z.enum(['mpesa', 'eft', 'cheque', 'cash']),
    reference_code: z.string().trim().min(3).max(80),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid receipt input.' });
    return;
  }
  const inv = db.prepare('SELECT * FROM ff_invoices WHERE id = ? AND organization_id = ?').get(parsed.data.invoice_id, req.auth!.orgId) as {
    id: string;
    client_id: string;
    total_kes: number;
    amount_paid_kes: number;
  } | undefined;
  if (!inv) {
    res.status(404).json({ error: 'Invoice not found.' });
    return;
  }

  const rcpCount = (db.prepare('SELECT COUNT(*) AS c FROM ff_receipts WHERE organization_id = ?').get(req.auth!.orgId) as { c: number }).c;
  const rcpNo = `RCP-${new Date().getFullYear()}-${String(1 + rcpCount).padStart(3, '0')}`;
  const id = `rcp-${crypto.randomUUID().slice(0, 12)}`;
  const now = new Date().toISOString();

  db.transaction(() => {
    db.prepare(`
      INSERT INTO ff_receipts (id, organization_id, invoice_id, client_id, receipt_number, amount_kes, payment_method, reference_code, received_at, recorded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.auth!.orgId, inv.id, inv.client_id, rcpNo, parsed.data.amount_kes, parsed.data.payment_method, parsed.data.reference_code, now, req.auth!.fullName);

    const nextPaid = Math.round(inv.amount_paid_kes + parsed.data.amount_kes);
    const nextStatus = nextPaid >= inv.total_kes ? 'paid' : 'partial';
    db.prepare('UPDATE ff_invoices SET amount_paid_kes = ?, status = ? WHERE id = ?').run(nextPaid, nextStatus, inv.id);

    writeAuditEvent({
      organizationId: req.auth!.orgId!,
      actorId: req.auth!.userId,
      actorName: req.auth!.fullName,
      action: 'finance.receipt_recorded',
      entityType: 'ff_receipts',
      entityId: id,
      metadata: { receipt_number: rcpNo, invoice_id: inv.id, amount_kes: parsed.data.amount_kes },
    });
  })();

  const receipt = db.prepare('SELECT * FROM ff_receipts WHERE id = ?').get(id);
  const invoice = db.prepare('SELECT * FROM ff_invoices WHERE id = ?').get(inv.id);
  res.status(201).json({ receipt, invoice });
});

fieldforceRouter.post('/finance/expenses', (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'finance_manager', 'operations_manager'])) {
    res.status(403).json({ error: 'Insufficient permissions to record site expenses.' });
    return;
  }
  const schema = z.object({
    site_id: z.string().nullable().optional(),
    category: z.enum(['uniforms', 'fuel_patrol', 'equipment', 'communications', 'welfare', 'other']),
    description: z.string().trim().min(3).max(240),
    amount_kes: z.number().positive(),
    expense_date: z.string().min(8),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid expense fields.' });
    return;
  }
  const id = `exp-${crypto.randomUUID().slice(0, 12)}`;
  db.prepare(`
    INSERT INTO ff_expenses (id, organization_id, site_id, category, description, amount_kes, expense_date, status, recorded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'recorded', ?)
  `).run(id, req.auth!.orgId, parsed.data.site_id ?? null, parsed.data.category, parsed.data.description, parsed.data.amount_kes, parsed.data.expense_date, req.auth!.fullName);

  const expense = db.prepare('SELECT * FROM ff_expenses WHERE id = ?').get(id);
  res.status(201).json({ expense });
});

fieldforceRouter.patch('/finance/expenses/:id/approve', (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'finance_manager'])) {
    res.status(403).json({ error: 'Only Finance Managers, Admins, or Owners can approve expenses.' });
    return;
  }
  const existing = db.prepare('SELECT id FROM ff_expenses WHERE id = ? AND organization_id = ?').get(req.params.id, req.auth!.orgId);
  if (!existing) {
    res.status(404).json({ error: 'Expense not found.' });
    return;
  }
  db.prepare("UPDATE ff_expenses SET status = 'approved' WHERE id = ?").run(req.params.id);
  const expense = db.prepare('SELECT * FROM ff_expenses WHERE id = ?').get(req.params.id);
  res.json({ expense });
});

// ==================== MODULE 08: CLIENT PORTAL ====================

fieldforceRouter.get('/client-portal', (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'operations_manager', 'finance_manager', 'client'])) {
    res.status(403).json({ error: 'Client Portal view is restricted to Clients and Management.' });
    return;
  }
  const orgId = req.auth!.orgId!;
  let targetClientId = req.auth!.role === 'client' ? req.auth!.clientId : String(req.query.clientId || '');

  if (req.auth!.role === 'client' && !targetClientId) {
    res.status(403).json({ error: 'No client account is linked to your portal user.' });
    return;
  }

  const allClients = db.prepare('SELECT * FROM ff_clients WHERE organization_id = ? ORDER BY company_name ASC').all(orgId) as Array<{ id: string }>;
  if (!targetClientId && allClients[0]?.id) {
    targetClientId = allClients[0].id;
  }

  const client = targetClientId
    ? db.prepare('SELECT * FROM ff_clients WHERE id = ? AND organization_id = ?').get(targetClientId, orgId)
    : null;

  if (!client) {
    res.json({
      client: null,
      sites: [],
      posts: [],
      attendanceSummary: { totalEvents: 0, onTimeRate: 100, geofenceInsideRate: 100, shiftCoverageRate: 100 },
      patrolSummary: { totalCheckpoints: 0, totalScans: 0 },
      incidents: [],
      contracts: [],
      invoices: [],
      receipts: [],
    });
    return;
  }

  const sites = db.prepare('SELECT * FROM ff_sites WHERE organization_id = ? AND client_id = ?').all(orgId, targetClientId) as Array<{ id: string; name: string; city: string; location_description: string; is_active: number }>;
  const siteIds = sites.map((s) => s.id);

  let posts: Array<Record<string, unknown>> = [];
  let shifts: Array<{ id: string; post_id: string }> = [];
  let assignments: Array<{ shift_id: string }> = [];
  let attendanceEvents: Array<{ geofence_status: string | null; late_minutes: number; event_type: string }> = [];
  let incidents: Array<Record<string, unknown>> = [];
  let checkpointsCount = 0;
  let scansCount = 0;

  if (siteIds.length > 0) {
    const placeholders = siteIds.map(() => '?').join(',');
    posts = db.prepare(`SELECT * FROM ff_posts WHERE organization_id = ? AND site_id IN (${placeholders})`).all(orgId, ...siteIds) as Array<Record<string, unknown>>;
    shifts = db.prepare(`SELECT id, post_id FROM ff_shifts WHERE organization_id = ? AND site_id IN (${placeholders}) AND status != 'cancelled'`).all(orgId, ...siteIds) as Array<{ id: string; post_id: string }>;
    if (shifts.length > 0) {
      const shPlaceholders = shifts.map(() => '?').join(',');
      const shIds = shifts.map((s) => s.id);
      assignments = db.prepare(`SELECT shift_id FROM ff_assignments WHERE organization_id = ? AND shift_id IN (${shPlaceholders}) AND status != 'cancelled'`).all(orgId, ...shIds) as Array<{ shift_id: string }>;
      attendanceEvents = db.prepare(`SELECT geofence_status, late_minutes, event_type FROM ff_attendance_events WHERE organization_id = ? AND shift_id IN (${shPlaceholders})`).all(orgId, ...shIds) as Array<{ geofence_status: string | null; late_minutes: number; event_type: string }>;
    }
    incidents = db
      .prepare(`SELECT id, site_id, post_id, occurrence_time, entry_type, ob_number, category, severity, narrative, escalation_level, status, review_notes, ai_approved_at FROM ff_incidents WHERE organization_id = ? AND site_id IN (${placeholders}) ORDER BY occurrence_time DESC LIMIT 30`)
      .all(orgId, ...siteIds) as Array<Record<string, unknown>>;
    checkpointsCount = (db.prepare(`SELECT COUNT(*) AS c FROM ff_patrol_checkpoints WHERE organization_id = ? AND site_id IN (${placeholders})`).get(orgId, ...siteIds) as { c: number }).c;
    scansCount = (db.prepare(`SELECT COUNT(*) AS c FROM ff_patrol_scans WHERE organization_id = ? AND site_id IN (${placeholders})`).get(orgId, ...siteIds) as { c: number }).c;
  }

  const totalReq = shifts.reduce((acc, s) => acc + Number((posts.find((p) => p.id === s.post_id)?.required_guards as number) || 1), 0);
  const totalAsg = shifts.reduce((acc, s) => acc + Math.min(assignments.filter((a) => a.shift_id === s.id).length, Number((posts.find((p) => p.id === s.post_id)?.required_guards as number) || 1)), 0);
  const clockIns = attendanceEvents.filter((a) => a.event_type === 'clock_in');
  const onTime = clockIns.filter((a) => a.late_minutes <= 10).length;
  const insideGeo = clockIns.filter((a) => a.geofence_status === 'inside').length;

  const contracts = db.prepare('SELECT * FROM ff_client_contracts WHERE organization_id = ? AND client_id = ? ORDER BY start_date DESC').all(orgId, targetClientId);
  const invoices = db.prepare('SELECT * FROM ff_invoices WHERE organization_id = ? AND client_id = ? ORDER BY issue_date DESC').all(orgId, targetClientId);
  const receipts = db.prepare('SELECT * FROM ff_receipts WHERE organization_id = ? AND client_id = ? ORDER BY received_at DESC').all(orgId, targetClientId);

  res.json({
    client: { ...(client as Record<string, unknown>), is_active: Boolean((client as { is_active: number }).is_active) },
    sites: sites.map((s) => ({ ...s, is_active: Boolean(s.is_active) })),
    posts,
    attendanceSummary: {
      totalEvents: attendanceEvents.length,
      onTimeRate: clockIns.length > 0 ? Math.round((onTime / clockIns.length) * 100) : 100,
      geofenceInsideRate: clockIns.length > 0 ? Math.round((insideGeo / clockIns.length) * 100) : 100,
      shiftCoverageRate: totalReq > 0 ? Math.round((totalAsg / totalReq) * 100) : 100,
    },
    patrolSummary: {
      totalCheckpoints: checkpointsCount,
      totalScans: scansCount,
    },
    incidents,
    contracts,
    invoices,
    receipts,
  });
});

// ==================== MODULE 09: FIELDFORCE AI INTELLIGENCE ====================

fieldforceRouter.get('/intelligence', (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'operations_manager', 'hr_manager', 'finance_manager', 'supervisor'])) {
    res.status(403).json({ error: 'Operational intelligence is restricted to FieldForce staff and management.' });
    return;
  }
  const intel = computeOperationalIntelligence(req.auth!.orgId!);
  res.json(intel);
});

fieldforceRouter.post('/intelligence/query', async (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'operations_manager', 'hr_manager', 'finance_manager', 'supervisor'])) {
    res.status(403).json({ error: 'Management intelligence queries are restricted to staff and management.' });
    return;
  }
  const question = String(req.body?.question || '').trim();
  if (question.length < 3) {
    res.status(400).json({ error: 'Please enter a management question (min 3 characters).' });
    return;
  }
  const intel = computeOperationalIntelligence(req.auth!.orgId!);
  const factsJson = JSON.stringify({
    metrics: intel.metrics,
    understaffedShifts: intel.understaffedShifts.slice(0, 5),
    expiringDocs: intel.expiringDocs.slice(0, 5),
    missedPatrolCheckpoints: intel.missedPatrolCheckpoints.slice(0, 5),
    anomalies: intel.anomalies,
    recommendations: intel.recommendations,
  });

  const aiAnswer = await generateWithGeminiFallback(
    'You are FieldForce AI Operations Intelligence for a Kenyan private security firm. Answer the manager question concisely and accurately using ONLY the live SQLite facts provided. Never invent numbers, staff names, or currency totals.',
    `Question: ${question}\n\nLive SQLite Facts:\n${factsJson}`
  );

  const deterministicFallback = [
    `Live Operational Summary (${intel.metrics.activeEmployees} active guards · ${intel.metrics.activeSites} active sites):`,
    `• Shift Coverage: ${intel.metrics.coverageRate}% (${intel.understaffedShifts.length} understaffed shift(s))`,
    `• On-Time Arrival: ${intel.metrics.onTimeRate}% · Patrol Completion: ${intel.metrics.patrolComplianceRate}%`,
    `• Compliance & Risk: ${intel.expiringDocs.length} expiring doc(s)/cert(s), ${intel.metrics.openIncidentsCount} open incident(s)`,
    `Top Recommendation: ${intel.recommendations[0]}`,
  ].join('\n');

  res.json({
    answer: aiAnswer || deterministicFallback,
    source: aiAnswer ? 'gemini-4-hydrogen' : 'sqlite-deterministic',
    intelligence: intel,
  });
});

fieldforceRouter.post('/intelligence/prepare-report', async (req, res) => {
  if (!hasRole(req, ['owner', 'admin', 'operations_manager', 'hr_manager', 'finance_manager', 'supervisor'])) {
    res.status(403).json({ error: 'Report preparation is restricted to staff and management.' });
    return;
  }
  const reportType = String(req.body?.reportType || 'daily_operations');
  const intel = computeOperationalIntelligence(req.auth!.orgId!);
  const org = db.prepare('SELECT name, timezone, currency FROM organizations WHERE id = ?').get(req.auth!.orgId!) as {
    name: string;
    timezone: string;
    currency: string;
  };

  const deterministicReport = [
    `${org.name} — ${reportType.replace('_', ' ').toUpperCase()} BRIEF`,
    `Generated: ${intel.generatedAt} (${org.timezone})`,
    '',
    '1. DEPLOYMENT & COVERAGE',
    `- Active Guards: ${intel.metrics.activeEmployees} across ${intel.metrics.activeSites} active site(s)`,
    `- Shift Staffing Coverage: ${intel.metrics.coverageRate}% (${intel.understaffedShifts.length} gap(s) requiring attention)`,
    '',
    '2. ATTENDANCE, PATROLS & INCIDENTS',
    `- On-Time Clock-In Rate: ${intel.metrics.onTimeRate}%`,
    `- Patrol Checkpoint Completion Today: ${intel.metrics.patrolComplianceRate}% (${intel.missedPatrolCheckpoints.length} pending)`,
    `- Open Security Incidents: ${intel.metrics.openIncidentsCount}`,
    '',
    '3. COMPLIANCE & FINANCIAL ALERTS',
    `- Expiring Documents/Qualifications (<=30d): ${intel.expiringDocs.length}`,
    ...intel.anomalies.map((a) => `- [${a.severity.toUpperCase()}] ${a.title}: ${a.detail}`),
    '',
    '4. RECOMMENDED MANAGEMENT ACTIONS',
    ...intel.recommendations.map((r, i) => `${i + 1}. ${r}`),
  ].join('\n');

  const aiReport = await generateWithGeminiFallback(
    'You are an executive security operations analyst. Produce a crisp, well-structured management briefing report strictly grounded in the provided SQLite telemetry. Preserve all numbers and do not invent figures.',
    `Report Type: ${reportType}\nOrganisation: ${org.name}\nTelemetry:\n${deterministicReport}`
  );

  writeAuditEvent({
    organizationId: req.auth!.orgId!,
    actorId: req.auth!.userId,
    actorName: req.auth!.fullName,
    action: 'intelligence.report_prepared',
    entityType: 'intelligence',
    entityId: null,
    metadata: { report_type: reportType, engine: aiReport ? 'gemini-4-hydrogen' : 'sqlite-deterministic' },
  });

  res.json({
    reportType,
    reportText: aiReport || deterministicReport,
    source: aiReport ? 'gemini-4-hydrogen' : 'sqlite-deterministic',
    generatedAt: intel.generatedAt,
  });
});

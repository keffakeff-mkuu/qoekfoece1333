import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface ProductSeed {
  id: string;
  order: number;
  name: string;
  slug: string;
  category: string;
  status: 'in_development' | 'planned_next' | 'planned' | 'live';
  shortDescription: string;
  launchAction: string;
}

export const PRODUCT_CATALOG_SEED: ProductSeed[] = [
  { id: 'prod-01', order: 1, name: 'FieldForce AI', slug: 'fieldforce', category: 'Operations & Workforce', status: 'in_development', shortDescription: 'Security guard rostering, attendance verification, and field incident management.', launchAction: 'Open Workspace' },
  { id: 'prod-02', order: 2, name: 'BiasharaOS', slug: 'biashara-os', category: 'SME ERP & Commerce', status: 'planned_next', shortDescription: 'Invoicing, M-Pesa reconciliation, and SME operational ledger.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-03', order: 3, name: 'AI Sales Agent', slug: 'ai-sales-agent', category: 'Sales & CRM', status: 'planned', shortDescription: 'Structured lead qualification and B2B pipeline tracking.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-04', order: 4, name: 'FarmLink AI', slug: 'farmlink-ai', category: 'Agribusiness', status: 'planned', shortDescription: 'Aggregator collection logs and smallholder payout ledgers.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-05', order: 5, name: 'TradePilot AI', slug: 'tradepilot-ai', category: 'B2B Trade & Tenders', status: 'planned', shortDescription: 'Tender compliance checklists and supplier bid tracking.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-06', order: 6, name: 'StockSmart AI', slug: 'stocksmart-ai', category: 'Supply Chain & Stock', status: 'planned', shortDescription: 'Multi-branch stock counts, expiry alerts, and reorder control.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-07', order: 7, name: 'MediFlow AI', slug: 'mediflow-ai', category: 'Healthcare Admin', status: 'planned', shortDescription: 'Outpatient clinic queues, triage logs, and billing workflows.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-08', order: 8, name: 'RouteIQ Africa', slug: 'routeiq-africa', category: 'Logistics & Dispatch', status: 'planned', shortDescription: 'Dispatch planning and verified proof-of-delivery logs.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-09', order: 9, name: 'BuildWise AI', slug: 'buildwise-ai', category: 'Construction & Projects', status: 'planned', shortDescription: 'Site material logs, subcontractor milestones, and BOQ control.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-10', order: 10, name: 'SafariBiz AI', slug: 'safaribiz-ai', category: 'Hospitality & Tourism', status: 'planned', shortDescription: 'Lodge reservations, guide rosters, and guest operations.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-11', order: 11, name: 'CyberGuard AI', slug: 'cyberguard-ai', category: 'Security & Compliance', status: 'planned', shortDescription: 'ODPC compliance registers and vendor audit tracking.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-12', order: 12, name: 'SolarCare AI', slug: 'solarcare-ai', category: 'Clean Energy & Assets', status: 'planned', shortDescription: 'PAYGo solar asset health and field technician dispatch.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-13', order: 13, name: 'TalentBridge AI', slug: 'talentbridge-ai', category: 'Recruitment & HR', status: 'planned', shortDescription: 'Candidate screening pipelines and vetting checklists.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-14', order: 14, name: 'PropManager AI', slug: 'propmanager-ai', category: 'Real Estate & Tenancy', status: 'planned', shortDescription: 'Rent ledgers, service charges, and maintenance requests.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-15', order: 15, name: 'SkillCoach AI', slug: 'skillcoach-ai', category: 'EdTech & Training', status: 'planned', shortDescription: 'Cohort attendance and practical skills assessments.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-16', order: 16, name: 'RecycleLink AI', slug: 'recyclelink-ai', category: 'Waste & Circularity', status: 'planned', shortDescription: 'Collection route logs and material recovery weight records.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-17', order: 17, name: 'AgriCredit Intelligence', slug: 'agricredit-intel', category: 'Agri-Finance & Risk', status: 'planned', shortDescription: 'SACCO and MFI agri-loan risk records.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-18', order: 18, name: 'DiasporaConnect AI', slug: 'diasporaconnect-ai', category: 'Diaspora Services', status: 'planned', shortDescription: 'Verified milestone reporting for diaspora-funded projects.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-19', order: 19, name: 'InsureFlow AI', slug: 'insureflow-ai', category: 'InsurTech Admin', status: 'planned', shortDescription: 'Policy renewals and structured claims intake.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-20', order: 20, name: 'CommercePilot AI', slug: 'commercepilot-ai', category: 'E-Commerce & Retail', status: 'planned', shortDescription: 'Order confirmation and last-mile rider dispatch.', launchAction: 'View Roadmap / Waitlist' },
];

const dbPath = path.resolve(process.env.SQLITE_DB_PATH || './data/fieldforce.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

function todayNairobiDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone_number TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      legal_name TEXT,
      country_code TEXT NOT NULL DEFAULT 'KE',
      timezone TEXT NOT NULL DEFAULT 'Africa/Nairobi',
      currency TEXT NOT NULL DEFAULT 'KES',
      is_active INTEGER NOT NULL DEFAULT 1,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS organization_memberships (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'operations_manager', 'hr_manager', 'supervisor', 'guard', 'finance_manager')),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (organization_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS product_catalog (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      short_description TEXT NOT NULL,
      display_order INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('in_development', 'planned_next', 'planned', 'live')),
      launch_action TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS organization_app_entitlements (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES product_catalog(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('active', 'waitlisted', 'inactive')),
      enabled_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (organization_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      actor_id TEXT,
      actor_name TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TRIGGER IF NOT EXISTS audit_events_no_update
    BEFORE UPDATE ON audit_events
    BEGIN
      SELECT RAISE(ABORT, 'audit_events is append-only; UPDATE is prohibited');
    END;

    CREATE TRIGGER IF NOT EXISTS audit_events_no_delete
    BEFORE DELETE ON audit_events
    BEGIN
      SELECT RAISE(ABORT, 'audit_events is append-only; DELETE is prohibited');
    END;

    CREATE TABLE IF NOT EXISTS ff_employees (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      employee_number TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'suspended', 'inactive')),
      hire_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (organization_id, employee_number)
    );

    CREATE TABLE IF NOT EXISTS ff_clients (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      client_code TEXT NOT NULL,
      company_name TEXT NOT NULL,
      contact_person TEXT NOT NULL,
      contact_phone TEXT NOT NULL,
      contact_email TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (organization_id, client_code)
    );

    CREATE TABLE IF NOT EXISTS ff_sites (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      client_id TEXT NOT NULL REFERENCES ff_clients(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      location_description TEXT DEFAULT '',
      city TEXT NOT NULL DEFAULT 'Nairobi',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ff_posts (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      site_id TEXT NOT NULL REFERENCES ff_sites(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      required_guards INTEGER NOT NULL DEFAULT 1 CHECK (required_guards >= 1),
      instructions TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ff_site_supervisors (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      site_id TEXT NOT NULL REFERENCES ff_sites(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE (site_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS ff_shifts (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      site_id TEXT NOT NULL REFERENCES ff_sites(id) ON DELETE CASCADE,
      post_id TEXT NOT NULL REFERENCES ff_posts(id) ON DELETE CASCADE,
      shift_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      shift_type TEXT NOT NULL CHECK (shift_type IN ('day', 'night', 'special')),
      status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'completed', 'cancelled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ff_assignments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      shift_id TEXT NOT NULL REFERENCES ff_shifts(id) ON DELETE CASCADE,
      employee_id TEXT NOT NULL REFERENCES ff_employees(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'reassigned', 'cancelled')),
      assigned_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (shift_id, employee_id)
    );

    CREATE TABLE IF NOT EXISTS ff_attendance_events (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      employee_id TEXT NOT NULL REFERENCES ff_employees(id) ON DELETE CASCADE,
      shift_id TEXT REFERENCES ff_shifts(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL CHECK (event_type IN ('clock_in', 'clock_out', 'supervisor_override')),
      recorded_at TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'web',
      location_metadata TEXT,
      supervisor_id TEXT,
      override_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TRIGGER IF NOT EXISTS ff_attendance_no_update
    BEFORE UPDATE ON ff_attendance_events
    BEGIN
      SELECT RAISE(ABORT, 'ff_attendance_events is append-only; UPDATE is prohibited');
    END;

    CREATE TRIGGER IF NOT EXISTS ff_attendance_no_delete
    BEFORE DELETE ON ff_attendance_events
    BEGIN
      SELECT RAISE(ABORT, 'ff_attendance_events is append-only; DELETE is prohibited');
    END;

    CREATE TABLE IF NOT EXISTS ff_incidents (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      site_id TEXT NOT NULL REFERENCES ff_sites(id) ON DELETE CASCADE,
      post_id TEXT REFERENCES ff_posts(id) ON DELETE SET NULL,
      reported_by TEXT NOT NULL REFERENCES users(id),
      reported_by_name TEXT NOT NULL,
      occurrence_time TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('theft', 'trespassing', 'medical', 'property_damage', 'uniform_breach', 'equipment_failure')),
      severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
      narrative TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_investigation', 'resolved', 'closed')),
      ai_draft_summary TEXT,
      ai_draft_generated_at TEXT,
      ai_approved_by TEXT,
      ai_approved_at TEXT,
      reviewed_by TEXT,
      review_notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const upsertCatalog = db.prepare(`
    INSERT INTO product_catalog (id, slug, name, category, short_description, display_order, status, launch_action)
    VALUES (@id, @slug, @name, @category, @shortDescription, @order, @status, @launchAction)
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      short_description = excluded.short_description,
      display_order = excluded.display_order,
      status = excluded.status,
      launch_action = excluded.launch_action
  `);

  const seedCatalogTx = db.transaction(() => {
    for (const item of PRODUCT_CATALOG_SEED) {
      upsertCatalog.run(item);
    }
  });
  seedCatalogTx();

  const existingOrg = db.prepare('SELECT id FROM organizations WHERE id = ?').get('org-nairobi-001');
  if (!existingOrg) {
    seedDemoOrganization();
  }
}

function seedDemoOrganization(): void {
  const today = todayNairobiDate();
  const orgId = 'org-nairobi-001';
  const unclaimableHash = 'DEMO_LOCKED_' + crypto.randomBytes(16).toString('hex');

  const seedTx = db.transaction(() => {
    const insertUser = db.prepare(`
      INSERT INTO users (id, email, password_hash, full_name, phone_number)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertUser.run('usr-demo-owner', 'ops@kestrelsecurity.co.ke', unclaimableHash, 'Wanjiku Kamau', '+254720111001');
    insertUser.run('usr-demo-ops', 'dispatch@kestrelsecurity.co.ke', unclaimableHash, 'Kevin Mutua', '+254720111002');
    insertUser.run('usr-demo-hr', 'hr@kestrelsecurity.co.ke', unclaimableHash, 'Faith Akinyi', '+254720111003');
    insertUser.run('usr-demo-sup', 'brian@kestrelsecurity.co.ke', unclaimableHash, 'Brian Ochieng', '+254720111004');
    insertUser.run('usr-demo-guard', 'samuel@kestrelsecurity.co.ke', unclaimableHash, 'Samuel Kiprop', '+254712345001');

    db.prepare(`
      INSERT INTO organizations (id, name, legal_name, country_code, timezone, currency, is_active, is_demo, created_by)
      VALUES (?, ?, ?, 'KE', 'Africa/Nairobi', 'KES', 1, 1, ?)
    `).run(orgId, 'Kestrel Guarding Kenya Ltd', 'Kestrel Guarding Kenya Limited', 'usr-demo-owner');

    const insertMember = db.prepare(`
      INSERT INTO organization_memberships (id, organization_id, user_id, role, status)
      VALUES (?, ?, ?, ?, 'active')
    `);
    insertMember.run('mem-demo-1', orgId, 'usr-demo-owner', 'owner');
    insertMember.run('mem-demo-2', orgId, 'usr-demo-ops', 'operations_manager');
    insertMember.run('mem-demo-3', orgId, 'usr-demo-hr', 'hr_manager');
    insertMember.run('mem-demo-4', orgId, 'usr-demo-sup', 'supervisor');
    insertMember.run('mem-demo-5', orgId, 'usr-demo-guard', 'guard');

    db.prepare(`
      INSERT INTO organization_app_entitlements (id, organization_id, product_id, status, enabled_at)
      VALUES ('ent-demo-01', ?, 'prod-01', 'active', datetime('now'))
    `).run(orgId);
    db.prepare(`
      INSERT INTO organization_app_entitlements (id, organization_id, product_id, status, enabled_at)
      VALUES ('ent-demo-02', ?, 'prod-02', 'waitlisted', NULL)
    `).run(orgId);

    const insertEmp = db.prepare(`
      INSERT INTO ff_employees (id, organization_id, user_id, employee_number, first_name, last_name, phone, status, hire_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertEmp.run('emp-1', orgId, 'usr-demo-guard', 'KG-0101', 'Samuel', 'Kiprop', '+254712345001', 'active', '2024-03-10');
    insertEmp.run('emp-2', orgId, null, 'KG-0102', 'Grace', 'Muthoni', '+254712345002', 'active', '2024-06-15');
    insertEmp.run('emp-3', orgId, null, 'KG-0103', 'Peter', 'Otieno', '+254712345003', 'on_leave', '2023-11-01');
    insertEmp.run('emp-4', orgId, null, 'KG-0104', 'Mercy', 'Chebet', '+254712345004', 'active', '2025-01-12');

    const insertClient = db.prepare(`
      INSERT INTO ff_clients (id, organization_id, client_code, company_name, contact_person, contact_phone, contact_email, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);
    insertClient.run('cli-1', orgId, 'CL-WST', 'Westlands Commercial Towers', 'David Njoroge', '+254722100200', 'facilities@westlandstowers.co.ke');
    insertClient.run('cli-2', orgId, 'CL-KLM', 'Kilimani Medical Plaza', 'Amina Hassan', '+254733400500', 'admin@kilimanimplaza.co.ke');

    const insertSite = db.prepare(`
      INSERT INTO ff_sites (id, organization_id, client_id, name, location_description, city, is_active)
      VALUES (?, ?, ?, ?, ?, 'Nairobi', 1)
    `);
    insertSite.run('site-1', orgId, 'cli-1', 'Westlands HQ Tower', 'Waiyaki Way, Westlands');
    insertSite.run('site-2', orgId, 'cli-2', 'Kilimani Main Wing', 'Argwings Kodhek Rd');

    db.prepare(`
      INSERT INTO ff_site_supervisors (id, organization_id, site_id, user_id)
      VALUES ('ss-1', ?, 'site-1', 'usr-demo-sup'), ('ss-2', ?, 'site-2', 'usr-demo-sup')
    `).run(orgId, orgId);

    const insertPost = db.prepare(`
      INSERT INTO ff_posts (id, organization_id, site_id, name, required_guards, instructions)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertPost.run('post-1', orgId, 'site-1', 'Gate A — Vehicle Barrier', 1, 'Verify visitor ID and log vehicle registration before raising barrier.');
    insertPost.run('post-2', orgId, 'site-1', 'Main Lobby Desk', 1, 'Issue temporary visitor passes and monitor lobby access control.');
    insertPost.run('post-3', orgId, 'site-2', 'Emergency Entrance', 1, 'Keep ambulance bay unobstructed and log night-shift handovers.');

    const insertShift = db.prepare(`
      INSERT INTO ff_shifts (id, organization_id, site_id, post_id, shift_date, start_time, end_time, shift_type, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published')
    `);
    insertShift.run('shf-1', orgId, 'site-1', 'post-1', today, `${today}T06:00:00+03:00`, `${today}T18:00:00+03:00`, 'day');
    insertShift.run('shf-2', orgId, 'site-1', 'post-2', today, `${today}T06:00:00+03:00`, `${today}T18:00:00+03:00`, 'day');
    insertShift.run('shf-3', orgId, 'site-2', 'post-3', today, `${today}T18:00:00+03:00`, `${today}T23:59:00+03:00`, 'night');

    db.prepare(`
      INSERT INTO ff_assignments (id, organization_id, shift_id, employee_id, status, assigned_by)
      VALUES ('asg-1', ?, 'shf-1', 'emp-1', 'confirmed', 'usr-demo-owner')
    `).run(orgId);

    db.prepare(`
      INSERT INTO ff_attendance_events (id, organization_id, employee_id, shift_id, event_type, recorded_at, source, location_metadata)
      VALUES ('att-1', ?, 'emp-1', 'shf-1', 'clock_in', ?, 'Android Chrome Mobile Web', ?)
    `).run(orgId, `${today}T05:56:00+03:00`, JSON.stringify({ lat: -1.2647, lng: 36.8019, accuracy: 18 }));

    db.prepare(`
      INSERT INTO ff_incidents (id, organization_id, site_id, post_id, reported_by, reported_by_name, occurrence_time, category, severity, narrative, status)
      VALUES (?, ?, 'site-1', 'post-1', 'usr-demo-guard', 'Samuel Kiprop', ?, 'trespassing', 'medium', ?, 'open')
    `).run(
      'inc-1',
      orgId,
      `${today}T09:15:00+03:00`,
      'Unregistered delivery rider attempted tailgating behind tenant vehicle at Gate A without gate pass; stopped calmly at barrier and logged registration.'
    );

    db.prepare(`
      INSERT INTO audit_events (id, organization_id, actor_id, actor_name, action, entity_type, entity_id, metadata)
      VALUES ('aud-1', ?, 'usr-demo-owner', 'Wanjiku Kamau', 'shift.published', 'ff_shifts', 'shf-1', ?)
    `).run(orgId, JSON.stringify({ post: 'Gate A — Vehicle Barrier', shift_date: today }));
  });

  seedTx();
}

export function writeAuditEvent(params: {
  organizationId: string;
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): void {
  db.prepare(`
    INSERT INTO audit_events (id, organization_id, actor_id, actor_name, action, entity_type, entity_id, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `aud-${crypto.randomUUID().slice(0, 12)}`,
    params.organizationId,
    params.actorId,
    params.actorName,
    params.action,
    params.entityType,
    params.entityId ?? null,
    JSON.stringify(params.metadata ?? {})
  );
}

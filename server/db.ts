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
  { id: 'prod-01', order: 1, name: 'FieldForce AI', slug: 'fieldforce', category: 'Business & workforce', status: 'in_development', shortDescription: 'Security guard rostering, attendance verification, and field incident management.', launchAction: 'Open Workspace' },
  { id: 'prod-02', order: 2, name: 'BiasharaOS', slug: 'biashara-os', category: 'Business & workforce', status: 'planned_next', shortDescription: 'Invoicing, M-Pesa reconciliation, and SME operational ledger.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-03', order: 3, name: 'AI Sales Agent', slug: 'ai-sales-agent', category: 'Business & workforce', status: 'planned', shortDescription: 'Structured lead qualification and B2B pipeline tracking.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-04', order: 4, name: 'FarmLink AI', slug: 'farmlink-ai', category: 'Agriculture, trade & logistics', status: 'planned', shortDescription: 'Aggregator collection logs and smallholder payout ledgers.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-05', order: 5, name: 'TradePilot AI', slug: 'tradepilot-ai', category: 'Agriculture, trade & logistics', status: 'planned', shortDescription: 'Tender compliance checklists and supplier bid tracking.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-06', order: 6, name: 'StockSmart AI', slug: 'stocksmart-ai', category: 'Agriculture, trade & logistics', status: 'planned', shortDescription: 'Multi-branch stock counts, expiry alerts, and reorder control.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-07', order: 7, name: 'MediFlow AI', slug: 'mediflow-ai', category: 'Finance, property & infrastructure', status: 'planned', shortDescription: 'Outpatient clinic queues, triage logs, and billing workflows.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-08', order: 8, name: 'RouteIQ Africa', slug: 'routeiq-africa', category: 'Agriculture, trade & logistics', status: 'planned', shortDescription: 'Dispatch planning and verified proof-of-delivery logs.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-09', order: 9, name: 'BuildWise AI', slug: 'buildwise-ai', category: 'Finance, property & infrastructure', status: 'planned', shortDescription: 'Site material logs, subcontractor milestones, and BOQ control.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-10', order: 10, name: 'SafariBiz AI', slug: 'safaribiz-ai', category: 'Education, tourism & commerce', status: 'planned', shortDescription: 'Lodge reservations, guide rosters, and guest operations.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-11', order: 11, name: 'CyberGuard AI', slug: 'cyberguard-ai', category: 'Finance, property & infrastructure', status: 'planned', shortDescription: 'ODPC compliance registers and vendor audit tracking.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-12', order: 12, name: 'SolarCare AI', slug: 'solarcare-ai', category: 'Finance, property & infrastructure', status: 'planned', shortDescription: 'PAYGo solar asset health and field technician dispatch.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-13', order: 13, name: 'TalentBridge AI', slug: 'talentbridge-ai', category: 'Business & workforce', status: 'planned', shortDescription: 'Candidate screening pipelines and vetting checklists.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-14', order: 14, name: 'PropManager AI', slug: 'propmanager-ai', category: 'Finance, property & infrastructure', status: 'planned', shortDescription: 'Rent ledgers, service charges, and maintenance requests.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-15', order: 15, name: 'SkillCoach AI', slug: 'skillcoach-ai', category: 'Education, tourism & commerce', status: 'planned', shortDescription: 'Cohort attendance and practical skills assessments.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-16', order: 16, name: 'RecycleLink AI', slug: 'recyclelink-ai', category: 'Agriculture, trade & logistics', status: 'planned', shortDescription: 'Collection route logs and material recovery weight records.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-17', order: 17, name: 'AgriCredit Intelligence', slug: 'agricredit-intel', category: 'Agriculture, trade & logistics', status: 'planned', shortDescription: 'SACCO and MFI agri-loan risk records.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-18', order: 18, name: 'DiasporaConnect AI', slug: 'diasporaconnect-ai', category: 'Finance, property & infrastructure', status: 'planned', shortDescription: 'Verified milestone reporting for diaspora-funded projects.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-19', order: 19, name: 'InsureFlow AI', slug: 'insureflow-ai', category: 'Finance, property & infrastructure', status: 'planned', shortDescription: 'Policy renewals and structured claims intake.', launchAction: 'View Roadmap / Waitlist' },
  { id: 'prod-20', order: 20, name: 'CommercePilot AI', slug: 'commercepilot-ai', category: 'Education, tourism & commerce', status: 'planned', shortDescription: 'Order confirmation and last-mile rider dispatch.', launchAction: 'View Roadmap / Waitlist' },
];

export const dbPath = path.resolve(process.env.SQLITE_DB_PATH || './data/fieldforce.db');
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
      role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'operations_manager', 'hr_manager', 'supervisor', 'guard', 'finance_manager', 'client')),
      client_id TEXT,
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

    CREATE TABLE IF NOT EXISTS ff_employee_contracts (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      employee_id TEXT NOT NULL REFERENCES ff_employees(id) ON DELETE CASCADE,
      contract_type TEXT NOT NULL CHECK (contract_type IN ('permanent', 'fixed_term', 'casual', 'probation')),
      base_salary_kes REAL NOT NULL DEFAULT 0,
      shift_allowance_kes REAL NOT NULL DEFAULT 0,
      overtime_rate_kes REAL NOT NULL DEFAULT 0,
      start_date TEXT NOT NULL,
      end_date TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'terminated')),
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ff_employee_documents (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      employee_id TEXT NOT NULL REFERENCES ff_employees(id) ON DELETE CASCADE,
      doc_type TEXT NOT NULL CHECK (doc_type IN ('psra_license', 'good_conduct', 'contract_signed', 'medical_cert', 'id_copy', 'other')),
      title TEXT NOT NULL,
      reference_number TEXT DEFAULT '',
      issue_date TEXT,
      expiry_date TEXT,
      file_name TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ff_employee_qualifications (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      employee_id TEXT NOT NULL REFERENCES ff_employees(id) ON DELETE CASCADE,
      qualification_name TEXT NOT NULL,
      provider TEXT DEFAULT '',
      achieved_date TEXT NOT NULL,
      expiry_date TEXT,
      certificate_ref TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ff_leave_records (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      employee_id TEXT NOT NULL REFERENCES ff_employees(id) ON DELETE CASCADE,
      leave_type TEXT NOT NULL CHECK (leave_type IN ('annual', 'sick', 'compassionate', 'unpaid', 'off_duty')),
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      days_count INTEGER NOT NULL DEFAULT 1,
      reason TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      approved_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ff_disciplinary_records (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      employee_id TEXT NOT NULL REFERENCES ff_employees(id) ON DELETE CASCADE,
      incident_date TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('lateness', 'uniform', 'sleeping_on_duty', 'insubordination', 'absence', 'commendation')),
      severity TEXT NOT NULL CHECK (severity IN ('verbal_warning', 'written_warning', 'final_warning', 'suspension', 'cleared')),
      summary TEXT NOT NULL,
      action_taken TEXT DEFAULT '',
      recorded_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
      latitude REAL,
      longitude REAL,
      geofence_radius_m INTEGER NOT NULL DEFAULT 250,
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
      is_relief INTEGER NOT NULL DEFAULT 0,
      relief_for_assignment_id TEXT,
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
      geofence_status TEXT DEFAULT 'unknown',
      distance_meters REAL,
      late_minutes INTEGER NOT NULL DEFAULT 0,
      offline_captured_at TEXT,
      is_offline_sync INTEGER NOT NULL DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS ff_attendance_verifications (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      attendance_event_id TEXT UNIQUE NOT NULL REFERENCES ff_attendance_events(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('verified', 'flagged')),
      notes TEXT DEFAULT '',
      verified_by TEXT NOT NULL,
      verified_by_name TEXT NOT NULL,
      verified_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ff_patrol_checkpoints (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      site_id TEXT NOT NULL REFERENCES ff_sites(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      location_hint TEXT DEFAULT '',
      qr_code TEXT NOT NULL,
      sequence_order INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (organization_id, qr_code)
    );

    CREATE TABLE IF NOT EXISTS ff_patrol_schedules (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      site_id TEXT NOT NULL REFERENCES ff_sites(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      frequency_minutes INTEGER NOT NULL DEFAULT 60,
      start_hour INTEGER NOT NULL DEFAULT 18,
      end_hour INTEGER NOT NULL DEFAULT 6,
      assigned_employee_id TEXT REFERENCES ff_employees(id) ON DELETE SET NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ff_patrol_scans (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      schedule_id TEXT REFERENCES ff_patrol_schedules(id) ON DELETE SET NULL,
      checkpoint_id TEXT NOT NULL REFERENCES ff_patrol_checkpoints(id) ON DELETE CASCADE,
      site_id TEXT NOT NULL REFERENCES ff_sites(id) ON DELETE CASCADE,
      employee_id TEXT REFERENCES ff_employees(id) ON DELETE SET NULL,
      scanned_at TEXT NOT NULL,
      verification_method TEXT NOT NULL DEFAULT 'qr_scan' CHECK (verification_method IN ('qr_scan', 'manual_code', 'nfc')),
      notes TEXT DEFAULT '',
      proof_photo_data TEXT,
      status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'late', 'missed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ff_incidents (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      site_id TEXT NOT NULL REFERENCES ff_sites(id) ON DELETE CASCADE,
      post_id TEXT REFERENCES ff_posts(id) ON DELETE SET NULL,
      reported_by TEXT NOT NULL REFERENCES users(id),
      reported_by_name TEXT NOT NULL,
      occurrence_time TEXT NOT NULL,
      entry_type TEXT NOT NULL DEFAULT 'incident' CHECK (entry_type IN ('incident', 'occurrence')),
      ob_number TEXT,
      category TEXT NOT NULL CHECK (category IN ('theft', 'trespassing', 'medical', 'property_damage', 'uniform_breach', 'equipment_failure', 'handover', 'visitor_log', 'patrol_note')),
      severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
      narrative TEXT NOT NULL,
      voice_transcript TEXT,
      photo_data TEXT,
      escalation_level TEXT NOT NULL DEFAULT 'site' CHECK (escalation_level IN ('site', 'operations', 'executive', 'client_notified')),
      escalated_at TEXT,
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

    CREATE TABLE IF NOT EXISTS ff_payroll_runs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      period_label TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid')),
      total_gross_kes REAL NOT NULL DEFAULT 0,
      total_deductions_kes REAL NOT NULL DEFAULT 0,
      total_net_kes REAL NOT NULL DEFAULT 0,
      approved_by TEXT,
      approved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ff_payslips (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      payroll_run_id TEXT NOT NULL REFERENCES ff_payroll_runs(id) ON DELETE CASCADE,
      employee_id TEXT NOT NULL REFERENCES ff_employees(id) ON DELETE CASCADE,
      shifts_worked INTEGER NOT NULL DEFAULT 0,
      hours_worked REAL NOT NULL DEFAULT 0,
      overtime_hours REAL NOT NULL DEFAULT 0,
      base_pay_kes REAL NOT NULL DEFAULT 0,
      allowances_kes REAL NOT NULL DEFAULT 0,
      overtime_pay_kes REAL NOT NULL DEFAULT 0,
      gross_pay_kes REAL NOT NULL DEFAULT 0,
      paye_kes REAL NOT NULL DEFAULT 0,
      nssf_kes REAL NOT NULL DEFAULT 0,
      shif_kes REAL NOT NULL DEFAULT 0,
      other_deductions_kes REAL NOT NULL DEFAULT 0,
      total_deductions_kes REAL NOT NULL DEFAULT 0,
      net_pay_kes REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ff_client_contracts (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      client_id TEXT NOT NULL REFERENCES ff_clients(id) ON DELETE CASCADE,
      site_id TEXT REFERENCES ff_sites(id) ON DELETE SET NULL,
      contract_ref TEXT NOT NULL,
      monthly_fee_kes REAL NOT NULL DEFAULT 0,
      guards_billed INTEGER NOT NULL DEFAULT 1,
      billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'quarterly')),
      start_date TEXT NOT NULL,
      end_date TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expiring', 'expired')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ff_invoices (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      client_id TEXT NOT NULL REFERENCES ff_clients(id) ON DELETE CASCADE,
      contract_id TEXT REFERENCES ff_client_contracts(id) ON DELETE SET NULL,
      invoice_number TEXT NOT NULL,
      issue_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      subtotal_kes REAL NOT NULL DEFAULT 0,
      tax_kes REAL NOT NULL DEFAULT 0,
      total_kes REAL NOT NULL DEFAULT 0,
      amount_paid_kes REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('draft', 'sent', 'partial', 'paid', 'overdue')),
      line_items_json TEXT NOT NULL DEFAULT '[]',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (organization_id, invoice_number)
    );

    CREATE TABLE IF NOT EXISTS ff_receipts (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      invoice_id TEXT NOT NULL REFERENCES ff_invoices(id) ON DELETE CASCADE,
      client_id TEXT NOT NULL REFERENCES ff_clients(id) ON DELETE CASCADE,
      receipt_number TEXT NOT NULL,
      amount_kes REAL NOT NULL,
      payment_method TEXT NOT NULL CHECK (payment_method IN ('mpesa', 'eft', 'cheque', 'cash')),
      reference_code TEXT NOT NULL,
      received_at TEXT NOT NULL,
      recorded_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ff_expenses (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      site_id TEXT REFERENCES ff_sites(id) ON DELETE SET NULL,
      category TEXT NOT NULL CHECK (category IN ('uniforms', 'fuel_patrol', 'equipment', 'communications', 'welfare', 'other')),
      description TEXT NOT NULL,
      amount_kes REAL NOT NULL,
      expense_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded', 'approved')),
      recorded_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
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

  runSafeSchemaMigrations();

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
  seedDemoPhase2IfMissing();
}

function ensureColumn(table: string, column: string, definition: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function runSafeSchemaMigrations(): void {
  // Upgrade organization_memberships if missing 'client' role check or client_id column
  const memSchema = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'organization_memberships'")
    .get() as { sql?: string } | undefined;
  if (memSchema?.sql && (!memSchema.sql.includes("'client'") || !memSchema.sql.includes('client_id'))) {
    db.pragma('foreign_keys = OFF');
    db.transaction(() => {
      db.exec(`
        CREATE TABLE organization_memberships_new (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'operations_manager', 'hr_manager', 'supervisor', 'guard', 'finance_manager', 'client')),
          client_id TEXT,
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE (organization_id, user_id)
        );
        INSERT INTO organization_memberships_new (id, organization_id, user_id, role, status, created_at, updated_at)
        SELECT id, organization_id, user_id, role, status, created_at, updated_at FROM organization_memberships;
        DROP TABLE organization_memberships;
        ALTER TABLE organization_memberships_new RENAME TO organization_memberships;
      `);
    })();
    db.pragma('foreign_keys = ON');
  }

  // Upgrade ff_incidents if missing new OB categories or entry_type column
  const incSchema = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'ff_incidents'")
    .get() as { sql?: string } | undefined;
  if (incSchema?.sql && (!incSchema.sql.includes("'occurrence'") || !incSchema.sql.includes('escalation_level'))) {
    db.pragma('foreign_keys = OFF');
    db.transaction(() => {
      db.exec(`
        CREATE TABLE ff_incidents_new (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          site_id TEXT NOT NULL REFERENCES ff_sites(id) ON DELETE CASCADE,
          post_id TEXT REFERENCES ff_posts(id) ON DELETE SET NULL,
          reported_by TEXT NOT NULL REFERENCES users(id),
          reported_by_name TEXT NOT NULL,
          occurrence_time TEXT NOT NULL,
          entry_type TEXT NOT NULL DEFAULT 'incident' CHECK (entry_type IN ('incident', 'occurrence')),
          ob_number TEXT,
          category TEXT NOT NULL CHECK (category IN ('theft', 'trespassing', 'medical', 'property_damage', 'uniform_breach', 'equipment_failure', 'handover', 'visitor_log', 'patrol_note')),
          severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
          narrative TEXT NOT NULL,
          voice_transcript TEXT,
          photo_data TEXT,
          escalation_level TEXT NOT NULL DEFAULT 'site' CHECK (escalation_level IN ('site', 'operations', 'executive', 'client_notified')),
          escalated_at TEXT,
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
        INSERT INTO ff_incidents_new (
          id, organization_id, site_id, post_id, reported_by, reported_by_name, occurrence_time,
          category, severity, narrative, status, ai_draft_summary, ai_draft_generated_at,
          ai_approved_by, ai_approved_at, reviewed_by, review_notes, created_at, updated_at
        )
        SELECT
          id, organization_id, site_id, post_id, reported_by, reported_by_name, occurrence_time,
          category, severity, narrative, status, ai_draft_summary, ai_draft_generated_at,
          ai_approved_by, ai_approved_at, reviewed_by, review_notes, created_at, updated_at
        FROM ff_incidents;
        DROP TABLE ff_incidents;
        ALTER TABLE ff_incidents_new RENAME TO ff_incidents;
      `);
    })();
    db.pragma('foreign_keys = ON');
  }

  ensureColumn('ff_sites', 'latitude', 'REAL');
  ensureColumn('ff_sites', 'longitude', 'REAL');
  ensureColumn('ff_sites', 'geofence_radius_m', 'INTEGER NOT NULL DEFAULT 250');

  ensureColumn('ff_assignments', 'is_relief', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('ff_assignments', 'relief_for_assignment_id', 'TEXT');

  ensureColumn('ff_attendance_events', 'geofence_status', "TEXT DEFAULT 'unknown'");
  ensureColumn('ff_attendance_events', 'distance_meters', 'REAL');
  ensureColumn('ff_attendance_events', 'late_minutes', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('ff_attendance_events', 'offline_captured_at', 'TEXT');
  ensureColumn('ff_attendance_events', 'is_offline_sync', 'INTEGER NOT NULL DEFAULT 0');
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
      INSERT INTO ff_sites (id, organization_id, client_id, name, location_description, city, latitude, longitude, geofence_radius_m, is_active)
      VALUES (?, ?, ?, ?, ?, 'Nairobi', ?, ?, 250, 1)
    `);
    insertSite.run('site-1', orgId, 'cli-1', 'Westlands HQ Tower', 'Waiyaki Way, Westlands', -1.2647, 36.8019);
    insertSite.run('site-2', orgId, 'cli-2', 'Kilimani Main Wing', 'Argwings Kodhek Rd', -1.2921, 36.7872);

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
      INSERT INTO ff_attendance_events (id, organization_id, employee_id, shift_id, event_type, recorded_at, source, location_metadata, geofence_status, distance_meters, late_minutes)
      VALUES ('att-1', ?, 'emp-1', 'shf-1', 'clock_in', ?, 'Android Chrome Mobile Web', ?, 'inside', 22, 0)
    `).run(orgId, `${today}T05:56:00+03:00`, JSON.stringify({ lat: -1.2647, lng: 36.8019, accuracy: 18 }));

    db.prepare(`
      INSERT INTO ff_incidents (id, organization_id, site_id, post_id, reported_by, reported_by_name, occurrence_time, entry_type, ob_number, category, severity, narrative, escalation_level, status)
      VALUES (?, ?, 'site-1', 'post-1', 'usr-demo-guard', 'Samuel Kiprop', ?, 'incident', 'OB-2026-0001', 'trespassing', 'medium', ?, 'operations', 'open')
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

function seedDemoPhase2IfMissing(): void {
  const orgId = 'org-nairobi-001';
  const org = db.prepare('SELECT id FROM organizations WHERE id = ?').get(orgId);
  if (!org) return;

  const today = todayNairobiDate();
  const in14Days = new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);
  const in180Days = new Date(Date.now() + 180 * 86400_000).toISOString().slice(0, 10);

  db.transaction(() => {
    // Ensure demo sites have geofence coordinates
    db.prepare('UPDATE ff_sites SET latitude = COALESCE(latitude, -1.2647), longitude = COALESCE(longitude, 36.8019), geofence_radius_m = COALESCE(geofence_radius_m, 250) WHERE id = ?').run('site-1');
    db.prepare('UPDATE ff_sites SET latitude = COALESCE(latitude, -1.2921), longitude = COALESCE(longitude, 36.7872), geofence_radius_m = COALESCE(geofence_radius_m, 250) WHERE id = ?').run('site-2');

    // Demo Client Portal User
    const hasClientUser = db.prepare('SELECT id FROM users WHERE id = ?').get('usr-demo-client');
    if (!hasClientUser) {
      const unclaimableHash = 'DEMO_LOCKED_' + crypto.randomBytes(16).toString('hex');
      db.prepare(`
        INSERT INTO users (id, email, password_hash, full_name, phone_number)
        VALUES ('usr-demo-client', 'facilities@westlandstowers.co.ke', ?, 'David Njoroge (Client)', '+254722100200')
      `).run(unclaimableHash);
    }
    const hasClientMem = db.prepare('SELECT id FROM organization_memberships WHERE id = ?').get('mem-demo-6');
    if (!hasClientMem) {
      db.prepare(`
        INSERT OR IGNORE INTO organization_memberships (id, organization_id, user_id, role, client_id, status)
        VALUES ('mem-demo-6', ?, 'usr-demo-client', 'client', 'cli-1', 'active')
      `).run(orgId);
    }

    const contractCount = (db.prepare('SELECT COUNT(*) AS c FROM ff_employee_contracts WHERE organization_id = ?').get(orgId) as { c: number }).c;
    if (contractCount === 0) {
      db.prepare(`
        INSERT INTO ff_employee_contracts (id, organization_id, employee_id, contract_type, base_salary_kes, shift_allowance_kes, overtime_rate_kes, start_date, status, notes)
        VALUES
          ('ctr-1', ?, 'emp-1', 'permanent', 28000, 3500, 320, '2024-03-10', 'active', 'Day/Night Guard Grade II'),
          ('ctr-2', ?, 'emp-2', 'permanent', 26500, 3000, 300, '2024-06-15', 'active', 'Lobby Access Specialist'),
          ('ctr-3', ?, 'emp-4', 'probation', 24000, 2500, 280, '2025-01-12', 'active', 'Relief & Patrol Officer')
      `).run(orgId, orgId, orgId);
    }

    const docCount = (db.prepare('SELECT COUNT(*) AS c FROM ff_employee_documents WHERE organization_id = ?').get(orgId) as { c: number }).c;
    if (docCount === 0) {
      db.prepare(`
        INSERT INTO ff_employee_documents (id, organization_id, employee_id, doc_type, title, reference_number, issue_date, expiry_date, file_name, notes)
        VALUES
          ('doc-1', ?, 'emp-1', 'psra_license', 'PSRA Guard Registration Card', 'PSRA-KE-88421', '2025-01-15', ?, 'samuel_psra.pdf', 'Active PSRA clearance'),
          ('doc-2', ?, 'emp-2', 'good_conduct', 'DCI Police Clearance Certificate', 'DCI-PCC-44210', '2025-12-01', ?, 'grace_pcc.pdf', 'Renewal due soon — schedule DCI appointment')
      `).run(orgId, in180Days, orgId, in14Days);
    }

    const qualCount = (db.prepare('SELECT COUNT(*) AS c FROM ff_employee_qualifications WHERE organization_id = ?').get(orgId) as { c: number }).c;
    if (qualCount === 0) {
      db.prepare(`
        INSERT INTO ff_employee_qualifications (id, organization_id, employee_id, qualification_name, provider, achieved_date, expiry_date, certificate_ref)
        VALUES
          ('qual-1', ?, 'emp-1', 'Access Control & Fire Marshal L1', 'Kenya Security Training Institute', '2024-05-12', ?, 'KSTI-FM-2041'),
          ('qual-2', ?, 'emp-2', 'First Aid & Emergency Triage', 'St John Ambulance Kenya', '2025-02-18', ?, 'SJA-8821')
      `).run(orgId, in180Days, orgId, in180Days);
    }

    const leaveCount = (db.prepare('SELECT COUNT(*) AS c FROM ff_leave_records WHERE organization_id = ?').get(orgId) as { c: number }).c;
    if (leaveCount === 0) {
      db.prepare(`
        INSERT INTO ff_leave_records (id, organization_id, employee_id, leave_type, start_date, end_date, days_count, reason, status, approved_by)
        VALUES ('lv-1', ?, 'emp-3', 'annual', ?, ?, 5, 'Scheduled annual leave', 'approved', 'Faith Akinyi')
      `).run(orgId, today, in14Days);
    }

    const discCount = (db.prepare('SELECT COUNT(*) AS c FROM ff_disciplinary_records WHERE organization_id = ?').get(orgId) as { c: number }).c;
    if (discCount === 0) {
      db.prepare(`
        INSERT INTO ff_disciplinary_records (id, organization_id, employee_id, incident_date, category, severity, summary, action_taken, recorded_by)
        VALUES ('dsc-1', ?, 'emp-4', ?, 'commendation', 'cleared', 'Identified and prevented unverified tailgating vehicle during shift handover.', 'Logged commendation for monthly review', 'Brian Ochieng')
      `).run(orgId, today);
    }

    const patrolCpCount = (db.prepare('SELECT COUNT(*) AS c FROM ff_patrol_checkpoints WHERE organization_id = ?').get(orgId) as { c: number }).c;
    if (patrolCpCount === 0) {
      db.prepare(`
        INSERT INTO ff_patrol_checkpoints (id, organization_id, site_id, name, location_hint, qr_code, sequence_order, is_active)
        VALUES
          ('cp-1', ?, 'site-1', 'Main Vehicle Barrier', 'Waiyaki Way Entry', 'QR-WST-01', 1, 1),
          ('cp-2', ?, 'site-1', 'Basement Parking B2', 'Generator & Lift Core', 'QR-WST-02', 2, 1),
          ('cp-3', ?, 'site-2', 'Emergency Ambulance Bay', 'North Wing Gate', 'QR-KLM-01', 1, 1)
      `).run(orgId, orgId, orgId);

      db.prepare(`
        INSERT INTO ff_patrol_schedules (id, organization_id, site_id, title, frequency_minutes, start_hour, end_hour, assigned_employee_id, is_active)
        VALUES
          ('psch-1', ?, 'site-1', 'Westlands Hourly Perimeter Round', 60, 6, 18, 'emp-1', 1),
          ('psch-2', ?, 'site-2', 'Kilimani Night Wing Sweep', 60, 18, 6, 'emp-4', 1)
      `).run(orgId, orgId);

      db.prepare(`
        INSERT INTO ff_patrol_scans (id, organization_id, schedule_id, checkpoint_id, site_id, employee_id, scanned_at, verification_method, notes, status)
        VALUES ('pscn-1', ?, 'psch-1', 'cp-1', 'site-1', 'emp-1', ?, 'qr_scan', 'Perimeter seal intact, lighting normal.', 'completed')
      `).run(orgId, `${today}T07:05:00+03:00`);
    }

    const obCount = (db.prepare("SELECT COUNT(*) AS c FROM ff_incidents WHERE organization_id = ? AND entry_type = 'occurrence'").get(orgId) as { c: number }).c;
    if (obCount === 0) {
      db.prepare(`
        INSERT INTO ff_incidents (id, organization_id, site_id, post_id, reported_by, reported_by_name, occurrence_time, entry_type, ob_number, category, severity, narrative, escalation_level, status)
        VALUES ('inc-ob-1', ?, 'site-1', 'post-1', 'usr-demo-guard', 'Samuel Kiprop', ?, 'occurrence', 'OB-2026-0002', 'handover', 'low', 'Morning shift handover completed at 05:55 EAT. 2 patrol radios, 1 torch, and gate key set signed over in good order.', 'site', 'closed')
      `).run(orgId, `${today}T05:55:00+03:00`);
    }

    const clientContractCount = (db.prepare('SELECT COUNT(*) AS c FROM ff_client_contracts WHERE organization_id = ?').get(orgId) as { c: number }).c;
    if (clientContractCount === 0) {
      db.prepare(`
        INSERT INTO ff_client_contracts (id, organization_id, client_id, site_id, contract_ref, monthly_fee_kes, guards_billed, billing_cycle, start_date, end_date, status)
        VALUES
          ('cc-1', ?, 'cli-1', 'site-1', 'MSA-WST-2026', 195000, 3, 'monthly', '2026-01-01', ?, 'active'),
          ('cc-2', ?, 'cli-2', 'site-2', 'MSA-KLM-2026', 135000, 2, 'monthly', '2026-02-01', ?, 'active')
      `).run(orgId, in180Days, orgId, in180Days);

      db.prepare(`
        INSERT INTO ff_invoices (id, organization_id, client_id, contract_id, invoice_number, issue_date, due_date, subtotal_kes, tax_kes, total_kes, amount_paid_kes, status, line_items_json, notes)
        VALUES
          ('inv-1', ?, 'cli-1', 'cc-1', 'INV-2026-0101', ?, ?, 195000, 31200, 226200, 226200, 'paid', ?, 'Monthly guarding SLA — Westlands HQ Tower'),
          ('inv-2', ?, 'cli-2', 'cc-2', 'INV-2026-0102', ?, ?, 135000, 21600, 156600, 50000, 'partial', ?, 'Monthly guarding SLA — Kilimani Medical Plaza')
      `).run(
        orgId, today, in14Days, JSON.stringify([{ description: '24/7 Manned Guarding (3 posts)', qty: 1, unit_kes: 195000 }]),
        orgId, today, in14Days, JSON.stringify([{ description: 'Day & Night Guarding (2 posts)', qty: 1, unit_kes: 135000 }])
      );

      db.prepare(`
        INSERT INTO ff_receipts (id, organization_id, invoice_id, client_id, receipt_number, amount_kes, payment_method, reference_code, received_at, recorded_by)
        VALUES
          ('rcp-1', ?, 'inv-1', 'cli-1', 'RCP-2026-001', 226200, 'eft', 'KCB-EFT-998120', ?, 'Wanjiku Kamau'),
          ('rcp-2', ?, 'inv-2', 'cli-2', 'RCP-2026-002', 50000, 'mpesa', 'SL89KMPESA', ?, 'Wanjiku Kamau')
      `).run(orgId, `${today}T10:30:00+03:00`, orgId, `${today}T11:15:00+03:00`);

      db.prepare(`
        INSERT INTO ff_expenses (id, organization_id, site_id, category, description, amount_kes, expense_date, status, recorded_by)
        VALUES
          ('exp-1', ?, 'site-1', 'equipment', 'VHF Patrol Radios & Reflector Vests', 28500, ?, 'approved', 'Kevin Mutua'),
          ('exp-2', ?, 'site-2', 'fuel_patrol', 'Supervisor Mobile Response Fuel', 12400, ?, 'recorded', 'Brian Ochieng')
      `).run(orgId, today, orgId, today);
    }

    const payCount = (db.prepare('SELECT COUNT(*) AS c FROM ff_payroll_runs WHERE organization_id = ?').get(orgId) as { c: number }).c;
    if (payCount === 0) {
      db.prepare(`
        INSERT INTO ff_payroll_runs (id, organization_id, period_label, period_start, period_end, status, total_gross_kes, total_deductions_kes, total_net_kes, approved_by, approved_at)
        VALUES ('pr-1', ?, 'November 2026 Pilot Cycle', ?, ?, 'draft', 89500, 14850, 74650, NULL, NULL)
      `).run(orgId, `${today.slice(0, 8)}01`, today);

      db.prepare(`
        INSERT INTO ff_payslips (id, organization_id, payroll_run_id, employee_id, shifts_worked, hours_worked, overtime_hours, base_pay_kes, allowances_kes, overtime_pay_kes, gross_pay_kes, paye_kes, nssf_kes, shif_kes, other_deductions_kes, total_deductions_kes, net_pay_kes, status)
        VALUES
          ('ps-1', ?, 'pr-1', 'emp-1', 12, 144, 4, 28000, 3500, 1280, 32780, 3420, 1080, 901, 0, 5401, 27379, 'draft'),
          ('ps-2', ?, 'pr-1', 'emp-2', 11, 132, 0, 26500, 3000, 0, 29500, 2890, 1080, 811, 0, 4781, 24719, 'draft'),
          ('ps-3', ?, 'pr-1', 'emp-4', 10, 120, 2, 24000, 2500, 720, 27220, 2360, 1080, 748, 480, 4668, 22552, 'draft')
      `).run(orgId, orgId, orgId);
    }
  })();
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

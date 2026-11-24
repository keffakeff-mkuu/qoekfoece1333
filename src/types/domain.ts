export type OrgRole =
  | 'owner'
  | 'admin'
  | 'operations_manager'
  | 'hr_manager'
  | 'supervisor'
  | 'guard'
  | 'finance_manager'
  | 'client';

export type ProductStatus = 'in_development' | 'planned_next' | 'planned' | 'live';

export interface ProductCatalogItem {
  id: string;
  display_order: number;
  name: string;
  slug: string;
  category: string;
  status: ProductStatus;
  short_description: string;
  launch_action: string;
}

export interface ProductEntitlement {
  product_id: string;
  slug: string;
  status: 'active' | 'waitlisted' | 'inactive';
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
}

export interface Organization {
  id: string;
  name: string;
  legal_name?: string | null;
  country_code: string;
  timezone: string;
  currency: string;
  is_active: boolean;
  is_demo?: boolean;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: OrgRole;
  client_id?: string | null;
  status: 'active' | 'invited' | 'suspended';
}

export interface Employee {
  id: string;
  organization_id: string;
  user_id?: string | null;
  employee_number: string;
  first_name: string;
  last_name: string;
  phone: string;
  status: 'active' | 'on_leave' | 'suspended' | 'inactive';
  hire_date: string;
}

export interface EmployeeContract {
  id: string;
  organization_id: string;
  employee_id: string;
  contract_type: 'permanent' | 'fixed_term' | 'casual' | 'probation';
  base_salary_kes: number;
  shift_allowance_kes: number;
  overtime_rate_kes: number;
  start_date: string;
  end_date?: string | null;
  status: 'active' | 'expired' | 'terminated';
  notes?: string;
}

export interface EmployeeDocument {
  id: string;
  organization_id: string;
  employee_id: string;
  doc_type: 'psra_license' | 'good_conduct' | 'contract_signed' | 'medical_cert' | 'id_copy' | 'other';
  title: string;
  reference_number: string;
  issue_date?: string | null;
  expiry_date?: string | null;
  file_name: string;
  notes?: string;
}

export interface EmployeeQualification {
  id: string;
  organization_id: string;
  employee_id: string;
  qualification_name: string;
  provider: string;
  achieved_date: string;
  expiry_date?: string | null;
  certificate_ref: string;
}

export interface LeaveRecord {
  id: string;
  organization_id: string;
  employee_id: string;
  leave_type: 'annual' | 'sick' | 'compassionate' | 'unpaid' | 'off_duty';
  start_date: string;
  end_date: string;
  days_count: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string | null;
}

export interface DisciplinaryRecord {
  id: string;
  organization_id: string;
  employee_id: string;
  incident_date: string;
  category: 'lateness' | 'uniform' | 'sleeping_on_duty' | 'insubordination' | 'absence' | 'commendation';
  severity: 'verbal_warning' | 'written_warning' | 'final_warning' | 'suspension' | 'cleared';
  summary: string;
  action_taken?: string;
  recorded_by: string;
}

export interface Client {
  id: string;
  organization_id: string;
  client_code: string;
  company_name: string;
  contact_person: string;
  contact_phone: string;
  contact_email?: string | null;
  is_active: boolean;
}

export interface Site {
  id: string;
  organization_id: string;
  client_id: string;
  name: string;
  location_description: string;
  city: string;
  latitude?: number | null;
  longitude?: number | null;
  geofence_radius_m?: number;
  is_active: boolean;
}

export interface Post {
  id: string;
  organization_id: string;
  site_id: string;
  name: string;
  required_guards: number;
  instructions: string;
}

export interface SiteSupervisor {
  id: string;
  organization_id: string;
  site_id: string;
  user_id: string;
}

export interface Shift {
  id: string;
  organization_id: string;
  site_id: string;
  post_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  shift_type: 'day' | 'night' | 'special';
  status: 'draft' | 'published' | 'completed' | 'cancelled';
}

export interface Assignment {
  id: string;
  organization_id: string;
  shift_id: string;
  employee_id: string;
  status: 'scheduled' | 'confirmed' | 'reassigned' | 'cancelled';
  is_relief?: boolean;
  relief_for_assignment_id?: string | null;
  assigned_by: string;
}

export interface AttendanceEvent {
  id: string;
  organization_id: string;
  employee_id: string;
  shift_id?: string | null;
  event_type: 'clock_in' | 'clock_out' | 'supervisor_override';
  recorded_at: string;
  source: string;
  location_metadata?: { lat: number; lng: number; accuracy: number } | null;
  geofence_status?: 'inside' | 'outside' | 'unknown';
  distance_meters?: number | null;
  late_minutes?: number;
  offline_captured_at?: string | null;
  is_offline_sync?: boolean;
  supervisor_id?: string | null;
  override_reason?: string | null;
}

export interface AttendanceVerification {
  id: string;
  organization_id: string;
  attendance_event_id: string;
  status: 'verified' | 'flagged';
  notes?: string;
  verified_by: string;
  verified_by_name: string;
  verified_at: string;
}

export interface PatrolCheckpoint {
  id: string;
  organization_id: string;
  site_id: string;
  name: string;
  location_hint: string;
  qr_code: string;
  sequence_order: number;
  is_active: boolean;
}

export interface PatrolSchedule {
  id: string;
  organization_id: string;
  site_id: string;
  title: string;
  frequency_minutes: number;
  start_hour: number;
  end_hour: number;
  assigned_employee_id?: string | null;
  is_active: boolean;
}

export interface PatrolScan {
  id: string;
  organization_id: string;
  schedule_id?: string | null;
  checkpoint_id: string;
  site_id: string;
  employee_id?: string | null;
  scanned_at: string;
  verification_method: 'qr_scan' | 'manual_code' | 'nfc';
  notes?: string;
  proof_photo_data?: string | null;
  status: 'completed' | 'late' | 'missed';
}

export type IncidentCategory =
  | 'theft'
  | 'trespassing'
  | 'medical'
  | 'property_damage'
  | 'uniform_breach'
  | 'equipment_failure'
  | 'handover'
  | 'visitor_log'
  | 'patrol_note';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'open' | 'under_investigation' | 'resolved' | 'closed';
export type EscalationLevel = 'site' | 'operations' | 'executive' | 'client_notified';

export interface Incident {
  id: string;
  organization_id: string;
  site_id: string;
  post_id?: string | null;
  reported_by: string;
  reported_by_name: string;
  occurrence_time: string;
  entry_type?: 'incident' | 'occurrence';
  ob_number?: string | null;
  category: IncidentCategory;
  severity: IncidentSeverity;
  narrative: string;
  voice_transcript?: string | null;
  photo_data?: string | null;
  escalation_level?: EscalationLevel;
  escalated_at?: string | null;
  status: IncidentStatus;
  ai_draft_summary?: string | null;
  ai_draft_generated_at?: string | null;
  ai_approved_by?: string | null;
  ai_approved_at?: string | null;
  reviewed_by?: string | null;
  review_notes?: string | null;
}

export interface PayrollRun {
  id: string;
  organization_id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  status: 'draft' | 'approved' | 'paid';
  total_gross_kes: number;
  total_deductions_kes: number;
  total_net_kes: number;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at: string;
}

export interface Payslip {
  id: string;
  organization_id: string;
  payroll_run_id: string;
  employee_id: string;
  shifts_worked: number;
  hours_worked: number;
  overtime_hours: number;
  base_pay_kes: number;
  allowances_kes: number;
  overtime_pay_kes: number;
  gross_pay_kes: number;
  paye_kes: number;
  nssf_kes: number;
  shif_kes: number;
  other_deductions_kes: number;
  total_deductions_kes: number;
  net_pay_kes: number;
  status: 'draft' | 'approved' | 'paid';
}

export interface ClientContract {
  id: string;
  organization_id: string;
  client_id: string;
  site_id?: string | null;
  contract_ref: string;
  monthly_fee_kes: number;
  guards_billed: number;
  billing_cycle: 'monthly' | 'quarterly';
  start_date: string;
  end_date?: string | null;
  status: 'active' | 'expiring' | 'expired';
}

export interface Invoice {
  id: string;
  organization_id: string;
  client_id: string;
  contract_id?: string | null;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  subtotal_kes: number;
  tax_kes: number;
  total_kes: number;
  amount_paid_kes: number;
  status: 'draft' | 'sent' | 'partial' | 'paid' | 'overdue';
  line_items?: Array<{ description: string; qty: number; unit_kes: number }>;
  notes?: string;
}

export interface ReceiptRecord {
  id: string;
  organization_id: string;
  invoice_id: string;
  client_id: string;
  receipt_number: string;
  amount_kes: number;
  payment_method: 'mpesa' | 'eft' | 'cheque' | 'cash';
  reference_code: string;
  received_at: string;
  recorded_by: string;
}

export interface ExpenseRecord {
  id: string;
  organization_id: string;
  site_id?: string | null;
  category: 'uniforms' | 'fuel_patrol' | 'equipment' | 'communications' | 'welfare' | 'other';
  description: string;
  amount_kes: number;
  expense_date: string;
  status: 'recorded' | 'approved';
  recorded_by: string;
}

export interface OperationalIntelligence {
  generatedAt: string;
  metrics: {
    activeEmployees: number;
    activeSites: number;
    coverageRate: number;
    onTimeRate: number;
    patrolComplianceRate: number;
    expiringDocsCount: number;
    missedPatrolCount: number;
    openIncidentsCount: number;
    activeSchedulesCount: number;
  };
  expiringDocs: Array<{
    id: string;
    kind: 'document' | 'qualification';
    title: string;
    employeeName: string;
    expiryDate: string;
    expired: boolean;
  }>;
  understaffedShifts: Array<{
    shiftId: string;
    siteName: string;
    postName: string;
    shiftDate: string;
    shiftType: string;
    assigned: number;
    required: number;
    deficit: number;
  }>;
  missedPatrolCheckpoints: Array<{
    checkpointId: string;
    checkpointName: string;
    siteName: string;
  }>;
  anomalies: Array<{
    id: string;
    category: 'geofence' | 'lateness' | 'patrol' | 'compliance' | 'coverage' | 'incident' | 'finance';
    severity: 'high' | 'medium' | 'low';
    title: string;
    detail: string;
    route: string;
  }>;
  recommendations: string[];
}

export interface AuditEvent {
  id: string;
  organization_id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SystemDiagnostics {
  express: {
    status: 'online' | 'degraded';
    port: number;
    nodeVersion: string;
    environment: 'development' | 'production';
    uptimeSeconds: number;
    serverTime: string;
    timezone: string;
  };
  database: {
    engine: string;
    connected: boolean;
    path: string;
    exists: boolean;
    sizeBytes: number;
    lastModifiedAt: string | null;
    walExists: boolean;
    walSizeBytes: number;
    journalMode: string;
    foreignKeys: boolean;
    busyTimeoutMs: number;
    synchronousMode: string;
    pageSize: number;
    pageCount: number;
    tableCount: number;
    queryLatencyMs: number;
  };
  tenantCounts: {
    employees: number;
    clients: number;
    sites: number;
    posts: number;
    shifts: number;
    attendanceEvents: number;
    incidents: number;
    auditEvents: number;
  };
}

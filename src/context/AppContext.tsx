import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest, setAuthToken } from '../lib/api';
import type {
  Assignment,
  AttendanceEvent,
  AttendanceVerification,
  AuditEvent,
  AuthUser,
  Client,
  ClientContract,
  DisciplinaryRecord,
  Employee,
  EmployeeContract,
  EmployeeDocument,
  EmployeeQualification,
  EscalationLevel,
  ExpenseRecord,
  Incident,
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
  Invoice,
  LeaveRecord,
  OperationalIntelligence,
  Organization,
  OrganizationMember,
  OrgRole,
  PatrolCheckpoint,
  PatrolScan,
  PatrolSchedule,
  PayrollRun,
  Payslip,
  Post,
  ProductCatalogItem,
  ProductEntitlement,
  ReceiptRecord,
  Shift,
  Site,
  SiteSupervisor,
  SystemDiagnostics,
} from '../types/domain';

interface AppContextValue {
  loading: boolean;
  user: AuthUser | null;
  organization: Organization | null;
  currentRole: OrgRole | null;
  isDemo: boolean;
  catalog: ProductCatalogItem[];
  entitlements: ProductEntitlement[];
  members: OrganizationMember[];
  employees: Employee[];
  contracts: EmployeeContract[];
  documents: EmployeeDocument[];
  qualifications: EmployeeQualification[];
  leaveRecords: LeaveRecord[];
  disciplinaryRecords: DisciplinaryRecord[];
  clients: Client[];
  sites: Site[];
  posts: Post[];
  siteSupervisors: SiteSupervisor[];
  shifts: Shift[];
  assignments: Assignment[];
  attendance: AttendanceEvent[];
  attendanceVerifications: AttendanceVerification[];
  patrolCheckpoints: PatrolCheckpoint[];
  patrolSchedules: PatrolSchedule[];
  patrolScans: PatrolScan[];
  incidents: Incident[];
  payrollRuns: PayrollRun[];
  payslips: Payslip[];
  clientContracts: ClientContract[];
  invoices: Invoice[];
  receipts: ReceiptRecord[];
  expenses: ExpenseRecord[];
  auditEvents: AuditEvent[];
  diagnostics: SystemDiagnostics | null;
  diagnosticsLoading: boolean;
  diagnosticsError: string | null;
  refreshWorkspace: () => Promise<void>;
  fetchDiagnostics: () => Promise<{ data?: SystemDiagnostics; error?: string }>;
  enterDemoWorkspace: (role?: OrgRole) => Promise<{ error?: string }>;
  switchDemoRole: (role: OrgRole) => Promise<{ error?: string }>;
  login: (email: string, password: string) => Promise<{ error?: string; needsOnboarding?: boolean }>;
  register: (email: string, password: string, fullName: string) => Promise<{ error?: string }>;
  logout: () => void;
  createOrganization: (name: string, legalName?: string) => Promise<{ error?: string }>;
  updateOrganization: (name: string, legalName?: string) => Promise<{ error?: string }>;
  updateProfile: (input: { fullName: string; phoneNumber?: string; newPassword?: string }) => Promise<{ error?: string }>;
  inviteMember: (fullName: string, email: string, role: OrgRole, clientId?: string | null) => Promise<{ error?: string }>;
  updateMemberRole: (memberId: string, role: OrgRole, clientId?: string | null) => Promise<{ error?: string }>;
  toggleWaitlist: (slug: string) => Promise<{ error?: string }>;
  addEmployee: (input: {
    employee_number: string;
    first_name: string;
    last_name: string;
    phone: string;
    status: Employee['status'];
    hire_date: string;
  }) => Promise<{ error?: string }>;
  updateEmployeeStatus: (id: string, status: Employee['status']) => Promise<{ error?: string }>;
  updateEmployee: (
    id: string,
    input: { first_name: string; last_name: string; phone: string; user_id?: string | null }
  ) => Promise<{ error?: string }>;
  addEmployeeContract: (input: {
    employee_id: string;
    contract_type: EmployeeContract['contract_type'];
    base_salary_kes: number;
    shift_allowance_kes: number;
    overtime_rate_kes: number;
    start_date: string;
    end_date?: string | null;
    notes?: string;
  }) => Promise<{ error?: string }>;
  addEmployeeDocument: (input: {
    employee_id: string;
    doc_type: EmployeeDocument['doc_type'];
    title: string;
    reference_number?: string;
    issue_date?: string | null;
    expiry_date?: string | null;
    file_name?: string;
    notes?: string;
  }) => Promise<{ error?: string }>;
  addEmployeeQualification: (input: {
    employee_id: string;
    qualification_name: string;
    provider?: string;
    achieved_date: string;
    expiry_date?: string | null;
    certificate_ref?: string;
  }) => Promise<{ error?: string }>;
  submitLeaveRequest: (input: {
    employee_id: string;
    leave_type: LeaveRecord['leave_type'];
    start_date: string;
    end_date: string;
    days_count: number;
    reason?: string;
  }) => Promise<{ error?: string }>;
  decideLeaveRequest: (id: string, status: 'approved' | 'rejected') => Promise<{ error?: string }>;
  addDisciplinaryRecord: (input: {
    employee_id: string;
    incident_date: string;
    category: DisciplinaryRecord['category'];
    severity: DisciplinaryRecord['severity'];
    summary: string;
    action_taken?: string;
  }) => Promise<{ error?: string }>;
  addClient: (input: {
    client_code: string;
    company_name: string;
    contact_person: string;
    contact_phone: string;
    contact_email?: string;
  }) => Promise<{ error?: string }>;
  toggleClientStatus: (id: string, is_active: boolean) => Promise<{ error?: string }>;
  addSite: (input: {
    client_id: string;
    name: string;
    location_description?: string;
    city: string;
    latitude?: number | null;
    longitude?: number | null;
    geofence_radius_m?: number;
  }) => Promise<{ error?: string }>;
  updateSiteGeofence: (
    id: string,
    input: { latitude: number; longitude: number; geofence_radius_m: number }
  ) => Promise<{ error?: string }>;
  toggleSiteStatus: (id: string, is_active: boolean) => Promise<{ error?: string }>;
  addPost: (input: {
    site_id: string;
    name: string;
    required_guards: number;
    instructions?: string;
  }) => Promise<{ error?: string }>;
  updatePost: (
    id: string,
    input: { name: string; required_guards: number; instructions?: string }
  ) => Promise<{ error?: string }>;
  assignSiteSupervisor: (siteId: string, userId: string) => Promise<{ error?: string }>;
  removeSiteSupervisor: (id: string) => Promise<{ error?: string }>;
  addShift: (input: {
    site_id: string;
    post_id: string;
    shift_date: string;
    start_time: string;
    end_time: string;
    shift_type: Shift['shift_type'];
  }) => Promise<{ error?: string }>;
  assignGuard: (
    shiftId: string,
    employeeId: string,
    options?: { is_relief?: boolean; relief_for_assignment_id?: string | null }
  ) => Promise<{ error?: string }>;
  removeAssignment: (assignmentId: string) => Promise<{ error?: string }>;
  recordAttendance: (input: {
    employee_id: string;
    shift_id?: string | null;
    event_type: AttendanceEvent['event_type'];
    location_metadata?: { lat: number; lng: number; accuracy: number } | null;
    override_reason?: string;
    offline_captured_at?: string | null;
    is_offline_sync?: boolean;
  }) => Promise<{ error?: string }>;
  verifyAttendanceEvent: (
    id: string,
    status: 'verified' | 'flagged',
    notes?: string
  ) => Promise<{ error?: string }>;
  addPatrolCheckpoint: (input: {
    site_id: string;
    name: string;
    location_hint?: string;
    qr_code?: string;
    sequence_order?: number;
  }) => Promise<{ error?: string }>;
  addPatrolSchedule: (input: {
    site_id: string;
    title: string;
    frequency_minutes: number;
    start_hour: number;
    end_hour: number;
    assigned_employee_id?: string | null;
  }) => Promise<{ error?: string }>;
  recordPatrolScan: (input: {
    qr_code?: string;
    checkpoint_id?: string;
    schedule_id?: string | null;
    employee_id?: string | null;
    verification_method?: PatrolScan['verification_method'];
    notes?: string;
    proof_photo_data?: string | null;
  }) => Promise<{ error?: string }>;
  reportIncident: (input: {
    site_id: string;
    post_id?: string | null;
    entry_type?: 'incident' | 'occurrence';
    category: IncidentCategory;
    severity: IncidentSeverity;
    narrative: string;
    occurrence_time: string;
    voice_transcript?: string | null;
    photo_data?: string | null;
    escalation_level?: EscalationLevel;
  }) => Promise<{ error?: string }>;
  reviewIncident: (id: string, status: IncidentStatus, reviewNotes?: string) => Promise<{ error?: string }>;
  escalateIncident: (id: string, escalationLevel: EscalationLevel) => Promise<{ error?: string }>;
  generateIncidentAIDraft: (id: string) => Promise<{ error?: string }>;
  approveIncidentAIDraft: (id: string, approvedSummary: string, nextStatus?: IncidentStatus) => Promise<{ error?: string }>;
  generatePayrollRun: (input: {
    period_label: string;
    period_start: string;
    period_end: string;
  }) => Promise<{ error?: string }>;
  updatePayrollRunStatus: (id: string, status: 'approved' | 'paid') => Promise<{ error?: string }>;
  updatePayslipValues: (
    id: string,
    input: { allowances_kes: number; overtime_pay_kes: number; other_deductions_kes: number }
  ) => Promise<{ error?: string }>;
  addClientContract: (input: {
    client_id: string;
    site_id?: string | null;
    contract_ref: string;
    monthly_fee_kes: number;
    guards_billed: number;
    billing_cycle: 'monthly' | 'quarterly';
    start_date: string;
    end_date?: string | null;
  }) => Promise<{ error?: string }>;
  issueInvoice: (input: {
    client_id: string;
    contract_id?: string | null;
    issue_date: string;
    due_date: string;
    description: string;
    subtotal_kes: number;
    include_vat: boolean;
    notes?: string;
  }) => Promise<{ error?: string }>;
  recordReceipt: (input: {
    invoice_id: string;
    amount_kes: number;
    payment_method: ReceiptRecord['payment_method'];
    reference_code: string;
  }) => Promise<{ error?: string }>;
  addExpense: (input: {
    site_id?: string | null;
    category: ExpenseRecord['category'];
    description: string;
    amount_kes: number;
    expense_date: string;
  }) => Promise<{ error?: string }>;
  approveExpense: (id: string) => Promise<{ error?: string }>;
  fetchClientPortalData: (clientId?: string) => Promise<{
    data?: {
      client: Client | null;
      sites: Site[];
      posts: Post[];
      attendanceSummary: { totalEvents: number; onTimeRate: number; geofenceInsideRate: number; shiftCoverageRate: number };
      patrolSummary: { totalCheckpoints: number; totalScans: number };
      incidents: Incident[];
      contracts: ClientContract[];
      invoices: Invoice[];
      receipts: ReceiptRecord[];
    };
    error?: string;
  }>;
  fetchOperationalIntelligence: () => Promise<{ data?: OperationalIntelligence; error?: string }>;
  queryFieldForceIntelligence: (question: string) => Promise<{
    answer?: string;
    source?: string;
    intelligence?: OperationalIntelligence;
    error?: string;
  }>;
  prepareIntelligenceReport: (reportType: string) => Promise<{
    reportText?: string;
    source?: string;
    generatedAt?: string;
    error?: string;
  }>;
  querySOPAssistant: (
    topicOrQuestion: string,
    isFreeText?: boolean
  ) => Promise<{
    answer?: string;
    orchestrator?: { routedTo: string; productSlug: string; agentStatus: 'active' | 'coming_soon'; gateReason?: string };
    error?: string;
  }>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [currentRole, setCurrentRole] = useState<OrgRole | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [catalog, setCatalog] = useState<ProductCatalogItem[]>([]);
  const [entitlements, setEntitlements] = useState<ProductEntitlement[]>([]);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [contracts, setContracts] = useState<EmployeeContract[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [qualifications, setQualifications] = useState<EmployeeQualification[]>([]);
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>([]);
  const [disciplinaryRecords, setDisciplinaryRecords] = useState<DisciplinaryRecord[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [siteSupervisors, setSiteSupervisors] = useState<SiteSupervisor[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [attendance, setAttendance] = useState<AttendanceEvent[]>([]);
  const [attendanceVerifications, setAttendanceVerifications] = useState<AttendanceVerification[]>([]);
  const [patrolCheckpoints, setPatrolCheckpoints] = useState<PatrolCheckpoint[]>([]);
  const [patrolSchedules, setPatrolSchedules] = useState<PatrolSchedule[]>([]);
  const [patrolScans, setPatrolScans] = useState<PatrolScan[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [clientContracts, setClientContracts] = useState<ClientContract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null);

  const loadPublicCatalog = useCallback(async () => {
    const res = await apiRequest<{ products: ProductCatalogItem[]; entitlements: ProductEntitlement[] }>('/api/catalog');
    if (res.data) {
      setCatalog(res.data.products);
      setEntitlements(res.data.entitlements || []);
    }
  }, []);

  useEffect(() => {
    loadPublicCatalog();
  }, [loadPublicCatalog]);

  const refreshWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, ffRes, memRes] = await Promise.all([
        apiRequest<{ products: ProductCatalogItem[]; entitlements: ProductEntitlement[] }>('/api/catalog'),
        apiRequest<{
          employees: Employee[];
          clients: Client[];
          sites: Site[];
          posts: Post[];
          siteSupervisors: SiteSupervisor[];
          shifts: Shift[];
          assignments: Assignment[];
          attendance: AttendanceEvent[];
          incidents: Incident[];
          contracts: EmployeeContract[];
          documents: EmployeeDocument[];
          qualifications: EmployeeQualification[];
          leaveRecords: LeaveRecord[];
          disciplinaryRecords: DisciplinaryRecord[];
          attendanceVerifications: AttendanceVerification[];
          patrolCheckpoints: PatrolCheckpoint[];
          patrolSchedules: PatrolSchedule[];
          patrolScans: PatrolScan[];
          payrollRuns: PayrollRun[];
          payslips: Payslip[];
          clientContracts: ClientContract[];
          invoices: Invoice[];
          receipts: ReceiptRecord[];
          expenses: ExpenseRecord[];
        }>('/api/fieldforce/bootstrap'),
        apiRequest<{ members: OrganizationMember[] }>('/api/members'),
      ]);

      if (catRes.data) {
        setCatalog(catRes.data.products);
        setEntitlements(catRes.data.entitlements);
      }
      if (ffRes.data) {
        setEmployees(ffRes.data.employees || []);
        setClients(ffRes.data.clients || []);
        setSites(ffRes.data.sites || []);
        setPosts(ffRes.data.posts || []);
        setSiteSupervisors(ffRes.data.siteSupervisors || []);
        setShifts(ffRes.data.shifts || []);
        setAssignments(ffRes.data.assignments || []);
        setAttendance(ffRes.data.attendance || []);
        setIncidents(ffRes.data.incidents || []);
        setContracts(ffRes.data.contracts || []);
        setDocuments(ffRes.data.documents || []);
        setQualifications(ffRes.data.qualifications || []);
        setLeaveRecords(ffRes.data.leaveRecords || []);
        setDisciplinaryRecords(ffRes.data.disciplinaryRecords || []);
        setAttendanceVerifications(ffRes.data.attendanceVerifications || []);
        setPatrolCheckpoints(ffRes.data.patrolCheckpoints || []);
        setPatrolSchedules(ffRes.data.patrolSchedules || []);
        setPatrolScans(ffRes.data.patrolScans || []);
        setPayrollRuns(ffRes.data.payrollRuns || []);
        setPayslips(ffRes.data.payslips || []);
        setClientContracts(ffRes.data.clientContracts || []);
        setInvoices(ffRes.data.invoices || []);
        setReceipts(ffRes.data.receipts || []);
        setExpenses(ffRes.data.expenses || []);
      }
      if (memRes.data) {
        setMembers(memRes.data.members);
      }

      const auditRes = await apiRequest<{ auditEvents: AuditEvent[] }>('/api/audit-events');
      if (auditRes.data) {
        setAuditEvents(auditRes.data.auditEvents);
      } else {
        setAuditEvents([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const enterDemoWorkspace = async (role: OrgRole = 'owner') => {
    const res = await apiRequest<{
      token: string;
      user: AuthUser;
      organization: Organization;
      role: OrgRole;
      isDemo: boolean;
    }>('/api/auth/demo-session', { method: 'POST', body: { role } });

    if (res.error || !res.data) return { error: res.error || 'Unable to launch demo.' };
    setAuthToken(res.data.token);
    setUser(res.data.user);
    setOrganization(res.data.organization);
    setCurrentRole(res.data.role);
    setIsDemo(true);
    await refreshWorkspace();
    return {};
  };

  const switchDemoRole = async (role: OrgRole) => {
    const res = await apiRequest<{
      token: string;
      user: AuthUser;
      organization: Organization;
      role: OrgRole;
      isDemo: boolean;
    }>('/api/auth/demo-role', { method: 'POST', body: { role } });
    if (res.error || !res.data) return { error: res.error };
    setAuthToken(res.data.token);
    setUser(res.data.user);
    setOrganization(res.data.organization);
    setCurrentRole(res.data.role);
    setIsDemo(true);
    setDiagnostics(null);
    setDiagnosticsError(null);
    await refreshWorkspace();
    return {};
  };

  const login = async (email: string, password: string) => {
    const res = await apiRequest<{
      token: string;
      user: AuthUser;
      organization: Organization | null;
      role: OrgRole | null;
      isDemo: boolean;
    }>('/api/auth/login', { method: 'POST', body: { email, password } });
    if (res.error || !res.data) return { error: res.error };
    setAuthToken(res.data.token);
    setUser(res.data.user);
    setOrganization(res.data.organization);
    setCurrentRole(res.data.role);
    setIsDemo(false);
    if (res.data.organization) {
      await refreshWorkspace();
      return { needsOnboarding: false };
    }
    return { needsOnboarding: true };
  };

  const register = async (email: string, password: string, fullName: string) => {
    const res = await apiRequest<{
      token: string;
      user: AuthUser;
      organization: null;
      role: null;
      isDemo: boolean;
    }>('/api/auth/register', { method: 'POST', body: { email, password, fullName } });
    if (res.error || !res.data) return { error: res.error };
    setAuthToken(res.data.token);
    setUser(res.data.user);
    setOrganization(null);
    setCurrentRole(null);
    setIsDemo(false);
    return {};
  };

  const logout = () => {
    setAuthToken(null);
    setUser(null);
    setOrganization(null);
    setCurrentRole(null);
    setIsDemo(false);
    setEmployees([]);
    setContracts([]);
    setDocuments([]);
    setQualifications([]);
    setLeaveRecords([]);
    setDisciplinaryRecords([]);
    setClients([]);
    setSites([]);
    setPosts([]);
    setSiteSupervisors([]);
    setEntitlements([]);
    setShifts([]);
    setAssignments([]);
    setAttendance([]);
    setAttendanceVerifications([]);
    setPatrolCheckpoints([]);
    setPatrolSchedules([]);
    setPatrolScans([]);
    setIncidents([]);
    setPayrollRuns([]);
    setPayslips([]);
    setClientContracts([]);
    setInvoices([]);
    setReceipts([]);
    setExpenses([]);
    setMembers([]);
    setAuditEvents([]);
    setDiagnostics(null);
    setDiagnosticsError(null);
    loadPublicCatalog();
  };

  const createOrganization = async (name: string, legalName?: string) => {
    const res = await apiRequest<{
      token: string;
      organization: Organization;
      role: OrgRole;
      isDemo: boolean;
    }>('/api/organizations', { method: 'POST', body: { name, legalName } });
    if (res.error || !res.data) return { error: res.error };
    setAuthToken(res.data.token);
    setOrganization(res.data.organization);
    setCurrentRole(res.data.role);
    setIsDemo(false);
    await refreshWorkspace();
    return {};
  };

  const updateOrganization = async (name: string, legalName?: string) => {
    const res = await apiRequest<{ organization: Organization }>('/api/organizations/current', {
      method: 'PATCH',
      body: { name, legal_name: legalName },
    });
    if (res.error || !res.data) return { error: res.error };
    setOrganization(res.data.organization);
    await refreshWorkspace();
    return {};
  };

  const updateProfile = async (input: { fullName: string; phoneNumber?: string; newPassword?: string }) => {
    const res = await apiRequest<{ user: AuthUser }>('/api/profile', { method: 'PATCH', body: input });
    if (res.error || !res.data) return { error: res.error };
    setUser(res.data.user);
    return {};
  };

  const inviteMember = async (fullName: string, email: string, role: OrgRole, clientId?: string | null) => {
    const res = await apiRequest('/api/members', { method: 'POST', body: { fullName, email, role, client_id: clientId ?? null } });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const updateMemberRole = async (memberId: string, role: OrgRole, clientId?: string | null) => {
    const res = await apiRequest(`/api/members/${memberId}/role`, { method: 'PATCH', body: { role, client_id: clientId ?? null } });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const toggleWaitlist = async (slug: string) => {
    const res = await apiRequest<{ entitlements: ProductEntitlement[] }>('/api/entitlements/waitlist', {
      method: 'POST',
      body: { slug },
    });
    if (res.error || !res.data) return { error: res.error };
    setEntitlements(res.data.entitlements);
    return {};
  };

  const addEmployee = async (input: {
    employee_number: string;
    first_name: string;
    last_name: string;
    phone: string;
    status: Employee['status'];
    hire_date: string;
  }) => {
    const res = await apiRequest('/api/fieldforce/employees', { method: 'POST', body: input });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const updateEmployeeStatus = async (id: string, status: Employee['status']) => {
    const res = await apiRequest(`/api/fieldforce/employees/${id}/status`, { method: 'PATCH', body: { status } });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const updateEmployee = async (
    id: string,
    input: { first_name: string; last_name: string; phone: string; user_id?: string | null }
  ) => {
    const res = await apiRequest(`/api/fieldforce/employees/${id}`, { method: 'PATCH', body: input });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const addEmployeeContract: AppContextValue['addEmployeeContract'] = async (input) => {
    const res = await apiRequest('/api/fieldforce/hr/contracts', { method: 'POST', body: input });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const addEmployeeDocument: AppContextValue['addEmployeeDocument'] = async (input) => {
    const res = await apiRequest('/api/fieldforce/hr/documents', { method: 'POST', body: input });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const addEmployeeQualification: AppContextValue['addEmployeeQualification'] = async (input) => {
    const res = await apiRequest('/api/fieldforce/hr/qualifications', { method: 'POST', body: input });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const submitLeaveRequest: AppContextValue['submitLeaveRequest'] = async (input) => {
    const res = await apiRequest('/api/fieldforce/hr/leave', { method: 'POST', body: input });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const decideLeaveRequest: AppContextValue['decideLeaveRequest'] = async (id, status) => {
    const res = await apiRequest(`/api/fieldforce/hr/leave/${id}/status`, { method: 'PATCH', body: { status } });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const addDisciplinaryRecord: AppContextValue['addDisciplinaryRecord'] = async (input) => {
    const res = await apiRequest('/api/fieldforce/hr/disciplinary', { method: 'POST', body: input });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const addClient = async (input: {
    client_code: string;
    company_name: string;
    contact_person: string;
    contact_phone: string;
    contact_email?: string;
  }) => {
    const res = await apiRequest('/api/fieldforce/clients', { method: 'POST', body: input });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const toggleClientStatus = async (id: string, is_active: boolean) => {
    const res = await apiRequest(`/api/fieldforce/clients/${id}/status`, { method: 'PATCH', body: { is_active } });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const addSite: AppContextValue['addSite'] = async (input) => {
    const res = await apiRequest('/api/fieldforce/sites', { method: 'POST', body: input });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const updateSiteGeofence: AppContextValue['updateSiteGeofence'] = async (id, input) => {
    const res = await apiRequest(`/api/fieldforce/sites/${id}/geofence`, { method: 'PATCH', body: input });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const toggleSiteStatus = async (id: string, is_active: boolean) => {
    const res = await apiRequest(`/api/fieldforce/sites/${id}/status`, { method: 'PATCH', body: { is_active } });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const addPost = async (input: {
    site_id: string;
    name: string;
    required_guards: number;
    instructions?: string;
  }) => {
    const res = await apiRequest('/api/fieldforce/posts', { method: 'POST', body: input });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const updatePost = async (id: string, input: { name: string; required_guards: number; instructions?: string }) => {
    const res = await apiRequest(`/api/fieldforce/posts/${id}`, { method: 'PATCH', body: input });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const assignSiteSupervisor = async (siteId: string, userId: string) => {
    const res = await apiRequest('/api/fieldforce/site-supervisors', {
      method: 'POST',
      body: { site_id: siteId, user_id: userId },
    });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const removeSiteSupervisor = async (id: string) => {
    const res = await apiRequest(`/api/fieldforce/site-supervisors/${id}`, { method: 'DELETE' });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const addShift = async (input: {
    site_id: string;
    post_id: string;
    shift_date: string;
    start_time: string;
    end_time: string;
    shift_type: Shift['shift_type'];
  }) => {
    const res = await apiRequest('/api/fieldforce/shifts', { method: 'POST', body: input });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const assignGuard: AppContextValue['assignGuard'] = async (shiftId, employeeId, options) => {
    const res = await apiRequest('/api/fieldforce/assignments', {
      method: 'POST',
      body: {
        shift_id: shiftId,
        employee_id: employeeId,
        is_relief: Boolean(options?.is_relief),
        relief_for_assignment_id: options?.relief_for_assignment_id ?? null,
      },
    });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const removeAssignment = async (assignmentId: string) => {
    const res = await apiRequest(`/api/fieldforce/assignments/${assignmentId}`, { method: 'DELETE' });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const recordAttendance: AppContextValue['recordAttendance'] = async (input) => {
    const res = await apiRequest('/api/fieldforce/attendance', { method: 'POST', body: input });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const verifyAttendanceEvent: AppContextValue['verifyAttendanceEvent'] = async (id, status, notes) => {
    const res = await apiRequest(`/api/fieldforce/attendance/${id}/verify`, { method: 'POST', body: { status, notes } });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const addPatrolCheckpoint: AppContextValue['addPatrolCheckpoint'] = async (input) => {
    const res = await apiRequest('/api/fieldforce/patrols/checkpoints', { method: 'POST', body: input });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const addPatrolSchedule: AppContextValue['addPatrolSchedule'] = async (input) => {
    const res = await apiRequest('/api/fieldforce/patrols/schedules', { method: 'POST', body: input });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const recordPatrolScan: AppContextValue['recordPatrolScan'] = async (input) => {
    const res = await apiRequest('/api/fieldforce/patrols/scans', { method: 'POST', body: input });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const reportIncident: AppContextValue['reportIncident'] = async (input) => {
    const res = await apiRequest('/api/fieldforce/incidents', { method: 'POST', body: input });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const reviewIncident = async (id: string, status: IncidentStatus, reviewNotes?: string) => {
    const res = await apiRequest(`/api/fieldforce/incidents/${id}/review`, {
      method: 'PATCH',
      body: { status, review_notes: reviewNotes },
    });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const escalateIncident: AppContextValue['escalateIncident'] = async (id, escalationLevel) => {
    const res = await apiRequest(`/api/fieldforce/incidents/${id}/escalate`, {
      method: 'PATCH',
      body: { escalation_level: escalationLevel },
    });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const generateIncidentAIDraft = async (id: string) => {
    const res = await apiRequest<{ incident: Incident }>(`/api/fieldforce/incidents/${id}/ai-draft`, { method: 'POST' });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const approveIncidentAIDraft = async (id: string, approvedSummary: string, nextStatus?: IncidentStatus) => {
    const res = await apiRequest<{ incident: Incident }>(`/api/fieldforce/incidents/${id}/approve-ai-draft`, {
      method: 'POST',
      body: { approved_summary: approvedSummary, next_status: nextStatus },
    });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const generatePayrollRun: AppContextValue['generatePayrollRun'] = async (input) => {
    const res = await apiRequest('/api/fieldforce/payroll/generate', { method: 'POST', body: input });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const updatePayrollRunStatus: AppContextValue['updatePayrollRunStatus'] = async (id, status) => {
    const res = await apiRequest(`/api/fieldforce/payroll/runs/${id}/status`, { method: 'PATCH', body: { status } });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const updatePayslipValues: AppContextValue['updatePayslipValues'] = async (id, input) => {
    const res = await apiRequest(`/api/fieldforce/payslips/${id}`, { method: 'PATCH', body: input });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const addClientContract: AppContextValue['addClientContract'] = async (input) => {
    const res = await apiRequest('/api/fieldforce/finance/contracts', { method: 'POST', body: input });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const issueInvoice: AppContextValue['issueInvoice'] = async (input) => {
    const res = await apiRequest('/api/fieldforce/finance/invoices', { method: 'POST', body: input });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const recordReceipt: AppContextValue['recordReceipt'] = async (input) => {
    const res = await apiRequest('/api/fieldforce/finance/receipts', { method: 'POST', body: input });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const addExpense: AppContextValue['addExpense'] = async (input) => {
    const res = await apiRequest('/api/fieldforce/finance/expenses', { method: 'POST', body: input });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const approveExpense: AppContextValue['approveExpense'] = async (id) => {
    const res = await apiRequest(`/api/fieldforce/finance/expenses/${id}/approve`, { method: 'PATCH' });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const fetchClientPortalData: AppContextValue['fetchClientPortalData'] = useCallback(async (clientId) => {
    const qs = clientId ? `?clientId=${encodeURIComponent(clientId)}` : '';
    const res = await apiRequest<{
      client: Client | null;
      sites: Site[];
      posts: Post[];
      attendanceSummary: { totalEvents: number; onTimeRate: number; geofenceInsideRate: number; shiftCoverageRate: number };
      patrolSummary: { totalCheckpoints: number; totalScans: number };
      incidents: Incident[];
      contracts: ClientContract[];
      invoices: Invoice[];
      receipts: ReceiptRecord[];
    }>(`/api/fieldforce/client-portal${qs}`);
    if (res.error || !res.data) return { error: res.error || 'Unable to load client portal.' };
    return { data: res.data };
  }, []);

  const fetchOperationalIntelligence: AppContextValue['fetchOperationalIntelligence'] = useCallback(async () => {
    const res = await apiRequest<OperationalIntelligence>('/api/fieldforce/intelligence');
    if (res.error || !res.data) return { error: res.error || 'Unable to load intelligence.' };
    return { data: res.data };
  }, []);

  const queryFieldForceIntelligence: AppContextValue['queryFieldForceIntelligence'] = async (question) => {
    const res = await apiRequest<{
      answer: string;
      source: string;
      intelligence: OperationalIntelligence;
    }>('/api/fieldforce/intelligence/query', { method: 'POST', body: { question } });
    if (res.error || !res.data) return { error: res.error };
    return res.data;
  };

  const prepareIntelligenceReport: AppContextValue['prepareIntelligenceReport'] = async (reportType) => {
    const res = await apiRequest<{
      reportText: string;
      source: string;
      generatedAt: string;
    }>('/api/fieldforce/intelligence/prepare-report', { method: 'POST', body: { reportType } });
    if (res.error || !res.data) return { error: res.error };
    return res.data;
  };

  const fetchDiagnostics = useCallback(async () => {
    setDiagnosticsLoading(true);
    setDiagnosticsError(null);
    try {
      const res = await apiRequest<SystemDiagnostics>('/api/admin/diagnostics');
      if (res.error || !res.data) {
        const msg = res.error || 'Unable to load system diagnostics.';
        setDiagnostics(null);
        setDiagnosticsError(msg);
        return { error: msg };
      }
      setDiagnostics(res.data);
      return { data: res.data };
    } finally {
      setDiagnosticsLoading(false);
    }
  }, []);

  const querySOPAssistant = async (topicOrQuestion: string, isFreeText = false) => {
    const body = isFreeText ? { question: topicOrQuestion } : { topic: topicOrQuestion };
    const res = await apiRequest<{
      answer: string;
      orchestrator?: { routedTo: string; productSlug: string; agentStatus: 'active' | 'coming_soon'; gateReason?: string };
    }>('/api/assistant/query', { method: 'POST', body });
    if (res.error || !res.data) return { error: res.error };
    return { answer: res.data.answer, orchestrator: res.data.orchestrator };
  };

  return (
    <AppContext.Provider
      value={{
        loading,
        user,
        organization,
        currentRole,
        isDemo,
        catalog,
        entitlements,
        members,
        employees,
        contracts,
        documents,
        qualifications,
        leaveRecords,
        disciplinaryRecords,
        clients,
        sites,
        posts,
        siteSupervisors,
        shifts,
        assignments,
        attendance,
        attendanceVerifications,
        patrolCheckpoints,
        patrolSchedules,
        patrolScans,
        incidents,
        payrollRuns,
        payslips,
        clientContracts,
        invoices,
        receipts,
        expenses,
        auditEvents,
        diagnostics,
        diagnosticsLoading,
        diagnosticsError,
        refreshWorkspace,
        fetchDiagnostics,
        enterDemoWorkspace,
        switchDemoRole,
        login,
        register,
        logout,
        createOrganization,
        updateOrganization,
        updateProfile,
        inviteMember,
        updateMemberRole,
        toggleWaitlist,
        addEmployee,
        updateEmployeeStatus,
        updateEmployee,
        addEmployeeContract,
        addEmployeeDocument,
        addEmployeeQualification,
        submitLeaveRequest,
        decideLeaveRequest,
        addDisciplinaryRecord,
        addClient,
        toggleClientStatus,
        addSite,
        updateSiteGeofence,
        toggleSiteStatus,
        addPost,
        updatePost,
        assignSiteSupervisor,
        removeSiteSupervisor,
        addShift,
        assignGuard,
        removeAssignment,
        recordAttendance,
        verifyAttendanceEvent,
        addPatrolCheckpoint,
        addPatrolSchedule,
        recordPatrolScan,
        reportIncident,
        reviewIncident,
        escalateIncident,
        generateIncidentAIDraft,
        approveIncidentAIDraft,
        generatePayrollRun,
        updatePayrollRunStatus,
        updatePayslipValues,
        addClientContract,
        issueInvoice,
        recordReceipt,
        addExpense,
        approveExpense,
        fetchClientPortalData,
        fetchOperationalIntelligence,
        queryFieldForceIntelligence,
        prepareIntelligenceReport,
        querySOPAssistant,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

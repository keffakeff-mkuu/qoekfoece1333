import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest, setAuthToken } from '../lib/api';
import type {
  Assignment,
  AttendanceEvent,
  AuditEvent,
  AuthUser,
  Client,
  Employee,
  Incident,
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
  Organization,
  OrganizationMember,
  OrgRole,
  Post,
  ProductCatalogItem,
  ProductEntitlement,
  Shift,
  Site,
  SiteSupervisor,
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
  clients: Client[];
  sites: Site[];
  posts: Post[];
  siteSupervisors: SiteSupervisor[];
  shifts: Shift[];
  assignments: Assignment[];
  attendance: AttendanceEvent[];
  incidents: Incident[];
  auditEvents: AuditEvent[];
  refreshWorkspace: () => Promise<void>;
  enterDemoWorkspace: (role?: OrgRole) => Promise<{ error?: string }>;
  switchDemoRole: (role: OrgRole) => Promise<{ error?: string }>;
  login: (email: string, password: string) => Promise<{ error?: string; needsOnboarding?: boolean }>;
  register: (email: string, password: string, fullName: string) => Promise<{ error?: string }>;
  logout: () => void;
  createOrganization: (name: string, legalName?: string) => Promise<{ error?: string }>;
  updateOrganization: (name: string, legalName?: string) => Promise<{ error?: string }>;
  updateProfile: (input: { fullName: string; phoneNumber?: string; newPassword?: string }) => Promise<{ error?: string }>;
  inviteMember: (fullName: string, email: string, role: OrgRole) => Promise<{ error?: string }>;
  updateMemberRole: (memberId: string, role: OrgRole) => Promise<{ error?: string }>;
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
  addClient: (input: {
    client_code: string;
    company_name: string;
    contact_person: string;
    contact_phone: string;
    contact_email?: string;
  }) => Promise<{ error?: string }>;
  addSite: (input: {
    client_id: string;
    name: string;
    location_description?: string;
    city: string;
  }) => Promise<{ error?: string }>;
  addPost: (input: {
    site_id: string;
    name: string;
    required_guards: number;
    instructions?: string;
  }) => Promise<{ error?: string }>;
  assignSiteSupervisor: (siteId: string, userId: string) => Promise<{ error?: string }>;
  addShift: (input: {
    site_id: string;
    post_id: string;
    shift_date: string;
    start_time: string;
    end_time: string;
    shift_type: Shift['shift_type'];
  }) => Promise<{ error?: string }>;
  assignGuard: (shiftId: string, employeeId: string) => Promise<{ error?: string }>;
  removeAssignment: (assignmentId: string) => Promise<{ error?: string }>;
  recordAttendance: (input: {
    employee_id: string;
    shift_id?: string | null;
    event_type: AttendanceEvent['event_type'];
    location_metadata?: { lat: number; lng: number; accuracy: number } | null;
    override_reason?: string;
  }) => Promise<{ error?: string }>;
  reportIncident: (input: {
    site_id: string;
    post_id?: string | null;
    category: IncidentCategory;
    severity: IncidentSeverity;
    narrative: string;
    occurrence_time: string;
  }) => Promise<{ error?: string }>;
  reviewIncident: (id: string, status: IncidentStatus, reviewNotes?: string) => Promise<{ error?: string }>;
  generateIncidentAIDraft: (id: string) => Promise<{ error?: string }>;
  approveIncidentAIDraft: (id: string, approvedSummary: string, nextStatus?: IncidentStatus) => Promise<{ error?: string }>;
  querySOPAssistant: (topic: string) => Promise<{ answer?: string; error?: string }>;
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
  const [clients, setClients] = useState<Client[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [siteSupervisors, setSiteSupervisors] = useState<SiteSupervisor[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [attendance, setAttendance] = useState<AttendanceEvent[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);

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
        }>('/api/fieldforce/bootstrap'),
        apiRequest<{ members: OrganizationMember[] }>('/api/members'),
      ]);

      if (catRes.data) {
        setCatalog(catRes.data.products);
        setEntitlements(catRes.data.entitlements);
      }
      if (ffRes.data) {
        setEmployees(ffRes.data.employees);
        setClients(ffRes.data.clients);
        setSites(ffRes.data.sites);
        setPosts(ffRes.data.posts);
        setSiteSupervisors(ffRes.data.siteSupervisors);
        setShifts(ffRes.data.shifts);
        setAssignments(ffRes.data.assignments);
        setAttendance(ffRes.data.attendance);
        setIncidents(ffRes.data.incidents);
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
    setClients([]);
    setSites([]);
    setPosts([]);
    setShifts([]);
    setAssignments([]);
    setAttendance([]);
    setIncidents([]);
    setMembers([]);
    setAuditEvents([]);
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

  const inviteMember = async (fullName: string, email: string, role: OrgRole) => {
    const res = await apiRequest('/api/members', { method: 'POST', body: { fullName, email, role } });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const updateMemberRole = async (memberId: string, role: OrgRole) => {
    const res = await apiRequest(`/api/members/${memberId}/role`, { method: 'PATCH', body: { role } });
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

  const addSite = async (input: {
    client_id: string;
    name: string;
    location_description?: string;
    city: string;
  }) => {
    const res = await apiRequest('/api/fieldforce/sites', { method: 'POST', body: input });
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

  const assignSiteSupervisor = async (siteId: string, userId: string) => {
    const res = await apiRequest('/api/fieldforce/site-supervisors', {
      method: 'POST',
      body: { site_id: siteId, user_id: userId },
    });
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

  const assignGuard = async (shiftId: string, employeeId: string) => {
    const res = await apiRequest('/api/fieldforce/assignments', {
      method: 'POST',
      body: { shift_id: shiftId, employee_id: employeeId },
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

  const recordAttendance = async (input: {
    employee_id: string;
    shift_id?: string | null;
    event_type: AttendanceEvent['event_type'];
    location_metadata?: { lat: number; lng: number; accuracy: number } | null;
    override_reason?: string;
  }) => {
    const res = await apiRequest('/api/fieldforce/attendance', { method: 'POST', body: input });
    if (res.error) return { error: res.error };
    await refreshWorkspace();
    return {};
  };

  const reportIncident = async (input: {
    site_id: string;
    post_id?: string | null;
    category: IncidentCategory;
    severity: IncidentSeverity;
    narrative: string;
    occurrence_time: string;
  }) => {
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

  const querySOPAssistant = async (topic: string) => {
    const res = await apiRequest<{ answer: string }>('/api/assistant/query', { method: 'POST', body: { topic } });
    if (res.error || !res.data) return { error: res.error };
    return { answer: res.data.answer };
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
        clients,
        sites,
        posts,
        siteSupervisors,
        shifts,
        assignments,
        attendance,
        incidents,
        auditEvents,
        refreshWorkspace,
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
        addClient,
        addSite,
        addPost,
        assignSiteSupervisor,
        addShift,
        assignGuard,
        removeAssignment,
        recordAttendance,
        reportIncident,
        reviewIncident,
        generateIncidentAIDraft,
        approveIncidentAIDraft,
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

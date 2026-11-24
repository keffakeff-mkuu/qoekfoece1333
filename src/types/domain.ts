export type OrgRole =
  | 'owner'
  | 'admin'
  | 'operations_manager'
  | 'hr_manager'
  | 'supervisor'
  | 'guard'
  | 'finance_manager';

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
  supervisor_id?: string | null;
  override_reason?: string | null;
}

export type IncidentCategory =
  | 'theft'
  | 'trespassing'
  | 'medical'
  | 'property_damage'
  | 'uniform_breach'
  | 'equipment_failure';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'open' | 'under_investigation' | 'resolved' | 'closed';

export interface Incident {
  id: string;
  organization_id: string;
  site_id: string;
  post_id?: string | null;
  reported_by: string;
  reported_by_name: string;
  occurrence_time: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  narrative: string;
  status: IncidentStatus;
  ai_draft_summary?: string | null;
  ai_draft_generated_at?: string | null;
  ai_approved_by?: string | null;
  ai_approved_at?: string | null;
  reviewed_by?: string | null;
  review_notes?: string | null;
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

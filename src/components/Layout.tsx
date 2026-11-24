import React, { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Briefcase,
  Building2,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Compass,
  CreditCard,
  FileBarChart2,
  FileCheck2,
  FileText,
  GraduationCap,
  Home,
  LayoutGrid,
  LogOut,
  MapPin,
  Menu,
  Receipt,
  Route,
  Settings,
  Shield,
  ShieldCheck,
  Timer,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { recordVisitedApp } from '../lib/recentApps';
import { formatNairobiDateTime } from '../lib/date';
import type { OrgRole } from '../types/domain';
import { Badge, Drawer, StatusLabel } from './ui';

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  upcoming?: boolean;
  matchExact?: boolean;
}

interface NavGroup {
  id: string;
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'overview',
    title: 'PLATFORM CORE',
    items: [
      { label: 'Home', to: '/app/home', icon: Home, matchExact: true },
      { label: 'My AI Apps', to: '/app/my-apps', icon: LayoutGrid },
      { label: 'Discover Apps', to: '/app/discover', icon: Compass },
      { label: 'FieldForce Command', to: '/app/fieldforce/dashboard', icon: Shield },
      { label: 'Notifications', to: '/app/notifications', icon: Bell },
    ],
  },
  {
    id: 'workforce',
    title: 'WORKFORCE',
    items: [
      { label: 'Employees', to: '/app/fieldforce/employees', icon: Users },
      { label: 'Documents', to: '/app/upcoming/documents', icon: FileCheck2, upcoming: true },
      { label: 'Training', to: '/app/upcoming/training', icon: GraduationCap, upcoming: true },
    ],
  },
  {
    id: 'operations',
    title: 'OPERATIONS',
    items: [
      { label: 'Clients', to: '/app/fieldforce/clients', icon: Building2 },
      { label: 'Sites', to: '/app/fieldforce/sites', icon: MapPin, matchExact: true },
      { label: 'Posts', to: '/app/fieldforce/sites?view=posts', icon: ShieldCheck },
      { label: 'Deployment', to: '/app/upcoming/deployment', icon: Briefcase, upcoming: true },
    ],
  },
  {
    id: 'scheduling',
    title: 'SCHEDULING',
    items: [
      { label: 'Shifts', to: '/app/fieldforce/schedule', icon: CalendarClock, matchExact: true },
      { label: 'Rosters', to: '/app/fieldforce/schedule?view=roster', icon: LayoutGrid },
      { label: 'Attendance', to: '/app/fieldforce/attendance', icon: ClipboardCheck },
    ],
  },
  {
    id: 'security',
    title: 'SECURITY',
    items: [
      { label: 'Patrols', to: '/app/upcoming/patrols', icon: Route, upcoming: true },
      { label: 'Incidents', to: '/app/fieldforce/incidents', icon: AlertTriangle },
      { label: 'Occurrence Book', to: '/app/upcoming/occurrence-book', icon: BookOpen, upcoming: true },
    ],
  },
  {
    id: 'finance',
    title: 'FINANCE',
    items: [
      { label: 'Timesheets', to: '/app/upcoming/timesheets', icon: Timer, upcoming: true },
      { label: 'Payroll', to: '/app/upcoming/payroll', icon: CreditCard, upcoming: true },
      { label: 'Invoices', to: '/app/upcoming/invoices', icon: FileText, upcoming: true },
      { label: 'Receipts', to: '/app/upcoming/receipts', icon: Receipt, upcoming: true },
    ],
  },
  {
    id: 'intelligence',
    title: 'INTELLIGENCE',
    items: [
      { label: 'AI Assistant', to: '/app/ai-assistant', icon: Bot },
      { label: 'Reports', to: '/app/reports', icon: FileBarChart2 },
      { label: 'Analytics', to: '/app/upcoming/analytics', icon: BarChart3, upcoming: true },
    ],
  },
  {
    id: 'administration',
    title: 'ADMINISTRATION',
    items: [
      { label: 'Billing', to: '/app/billing', icon: CreditCard },
      { label: 'Team', to: '/app/settings/members', icon: Users, matchExact: true },
      { label: 'Roles', to: '/app/settings/members?view=roles', icon: UserCheck },
      { label: 'Audit Logs', to: '/app/settings/audit-log', icon: Shield },
      { label: 'Settings', to: '/app/settings/organisation', icon: Settings },
    ],
  },
];

const ROUTE_TITLES: Record<string, string> = {
  '/app/home': 'Home · Platform Overview',
  '/app/my-apps': 'My AI Apps',
  '/app/discover': 'Discover Apps · 20-Solution Marketplace',
  '/app/notifications': 'Platform Notifications',
  '/app/billing': 'Billing & Subscriptions',
  '/app/fieldforce/dashboard': 'FieldForce Command Centre',
  '/app/fieldforce/employees': 'Workforce · Employees',
  '/app/fieldforce/clients': 'Operations · Clients',
  '/app/fieldforce/sites': 'Operations · Sites & Posts',
  '/app/fieldforce/schedule': 'Scheduling · Shifts & Rosters',
  '/app/fieldforce/attendance': 'Scheduling · Attendance',
  '/app/fieldforce/incidents': 'Security · Incident Workspace',
  '/app/ai-assistant': 'AI Africa Main Assistant',
  '/app/reports': 'Combined Reports & CSV',
  '/app/settings/organisation': 'Settings · Organisation',
  '/app/settings/members': 'Settings · Team & Roles',
  '/app/settings/audit-log': 'Settings · Audit Logs',
  '/app/profile': 'Account Profile',
};

export const AppLayout: React.FC = () => {
  const { user, organization, isDemo, currentRole, switchDemoRole, logout, shifts, posts, assignments, incidents } =
    useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    finance: true,
  });

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    recordVisitedApp(location.pathname);
  }, [location.pathname]);

  const notifications = useMemo(() => {
    const items: Array<{ id: string; title: string; detail: string; to: string; tone: 'amber' | 'rose' | 'navy' }> = [];

    const understaffed = shifts.filter((s) => {
      const post = posts.find((p) => p.id === s.post_id);
      const count = assignments.filter((a) => a.shift_id === s.id && a.status !== 'cancelled').length;
      return count < (post?.required_guards ?? 1);
    });
    if (understaffed.length > 0) {
      items.push({
        id: 'notif-unassigned',
        title: `${understaffed.length} shift(s) require guard assignment`,
        detail: 'Published shifts are below required post headcount.',
        to: '/app/fieldforce/schedule',
        tone: 'amber',
      });
    }

    const pendingAi = incidents.filter((i) => Boolean(i.ai_draft_summary) && !i.ai_approved_at);
    if (pendingAi.length > 0) {
      items.push({
        id: 'notif-ai-approval',
        title: `${pendingAi.length} AI incident draft(s) awaiting human approval`,
        detail: 'Supervisor sign-off required before archiving.',
        to: '/app/fieldforce/incidents',
        tone: 'amber',
      });
    }

    const openIncidents = incidents.filter((i) => i.status === 'open' || i.status === 'under_investigation');
    for (const inc of openIncidents.slice(0, 4)) {
      items.push({
        id: `notif-inc-${inc.id}`,
        title: `${inc.severity.toUpperCase()} · ${inc.category.replace('_', ' ')}`,
        detail: `${inc.narrative.slice(0, 72)}... (${formatNairobiDateTime(inc.occurrence_time)})`,
        to: '/app/fieldforce/incidents',
        tone: inc.severity === 'critical' || inc.severity === 'high' ? 'rose' : 'navy',
      });
    }
    return items;
  }, [shifts, posts, assignments, incidents]);

  const toggleGroup = (id: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isLinkActive = (item: NavItem) => {
    const currentFull = `${location.pathname}${location.search}`;
    if (item.to.includes('?')) {
      return currentFull === item.to;
    }
    if (item.matchExact) {
      return location.pathname === item.to && !location.search;
    }
    return location.pathname === item.to;
  };

  const handleLogout = () => {
    logout();
    navigate('/auth/login');
  };

  const breadcrumb = location.pathname.startsWith('/app/upcoming/')
    ? 'Roadmap Module Preview'
    : ROUTE_TITLES[location.pathname] || 'Workspace';

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0B132B] text-white w-64 border-r border-[#1C2541]">
      <div className="px-4 h-14 border-b border-[#1C2541] flex items-center justify-between shrink-0">
        <Link to="/app/home" className="flex items-center gap-2.5 min-w-0" onClick={() => setMobileOpen(false)}>
          <div className="h-8 w-8 rounded-lg bg-[#059669] flex items-center justify-center shrink-0">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm leading-tight">AI Africa</div>
            <div className="text-[11px] text-slate-400 truncate">{organization?.name || 'Workspace'}</div>
          </div>
        </Link>
        <button
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
          className="lg:hidden p-2 text-slate-400 hover:text-white tap-target"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {NAV_GROUPS.map((group) => {
          const isCollapsed = Boolean(collapsedGroups[group.id]);
          return (
            <div key={group.id}>
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] font-semibold tracking-wider text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <span>{group.title}</span>
                {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>

              {!isCollapsed && (
                <div className="mt-1 space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isLinkActive(item);
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors duration-150 min-h-[40px] ${
                          active
                            ? 'bg-[#059669] text-white'
                            : item.upcoming
                              ? 'text-slate-400 hover:bg-[#1C2541]/70 hover:text-slate-200'
                              : 'text-slate-200 hover:bg-[#1C2541] hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </span>
                        {item.upcoming && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#1C2541] text-slate-300 shrink-0">
                            Upcoming
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-3 border-t border-[#1C2541] shrink-0">
        <Link
          to="/app/profile"
          onClick={() => setMobileOpen(false)}
          className="block px-2.5 py-1.5 rounded-lg hover:bg-[#1C2541] transition-colors mb-1"
        >
          <div className="text-xs font-semibold text-slate-100 truncate">{user?.fullName}</div>
          <div className="text-[11px] text-slate-400 capitalize truncate">
            {currentRole?.replace('_', ' ')} · Profile
          </div>
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-slate-300 hover:bg-[#1C2541] hover:text-white tap-target cursor-pointer"
        >
          <LogOut className="h-4 w-4" /> Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] overflow-x-hidden">
      <aside className="hidden lg:block shrink-0 sticky top-0 h-screen">{sidebarContent}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-[#0B132B]/60" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-4 lg:px-6 h-14 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 tap-target"
            >
              <Menu className="h-5 w-5 text-slate-700" />
            </button>
            <span className="text-sm font-semibold text-[#0B132B] truncate">{breadcrumb}</span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <span className="hidden md:inline text-xs font-mono tabular-nums text-slate-500">
              {organization?.timezone ?? 'Africa/Nairobi'} · {organization?.currency ?? 'KES'}
            </span>

            <button
              type="button"
              onClick={() => setNotifOpen(true)}
              aria-label="View notifications and pending actions"
              className="relative tap-target px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer"
            >
              <Bell className="h-4 w-4 text-slate-600" />
              <span className="hidden sm:inline">Alerts</span>
              {notifications.length > 0 && (
                <span className="font-mono tabular-nums text-xs font-bold text-[#D97706]">
                  ({notifications.length})
                </span>
              )}
            </button>

            <Badge tone="navy">{currentRole?.replace('_', ' ')}</Badge>
          </div>
        </header>

        {isDemo && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 lg:px-6 py-2 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">
              Demo Sandbox ({organization?.name}) · Role switching enabled for preview
            </span>
            <div className="flex items-center gap-2">
              <label htmlFor="demo-role-select" className="text-amber-900 font-semibold">
                Preview Role:
              </label>
              <select
                id="demo-role-select"
                value={currentRole || 'owner'}
                onChange={(e) => switchDemoRole(e.target.value as OrgRole)}
                className="bg-white border border-amber-300 rounded-md px-2.5 py-1 text-xs font-medium text-slate-900 min-h-[32px]"
              >
                <option value="owner">Owner</option>
                <option value="operations_manager">Operations Manager</option>
                <option value="hr_manager">HR Manager</option>
                <option value="supervisor">Field Supervisor</option>
                <option value="guard">Security Guard</option>
              </select>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 lg:p-6 max-w-[1280px] w-full mx-auto">
          <Outlet />
        </main>
      </div>

      <Drawer
        open={notifOpen}
        title="Operational Notifications"
        subtitle="Computed directly from unassigned shifts, open incidents, and pending AI reviews"
        onClose={() => setNotifOpen(false)}
      >
        {notifications.length === 0 ? (
          <p className="text-sm text-slate-600">All shifts are staffed and no open incidents require attention.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((n) => (
              <div key={n.id} className="py-3.5 space-y-1.5">
                <StatusLabel label={n.title} tone={n.tone} />
                <p className="text-xs text-slate-600">{n.detail}</p>
                <Link
                  to={n.to}
                  onClick={() => setNotifOpen(false)}
                  className="inline-block text-xs font-semibold text-[#059669] hover:underline"
                >
                  Open workflow →
                </Link>
              </div>
            ))}
          </div>
        )}
      </Drawer>
    </div>
  );
};

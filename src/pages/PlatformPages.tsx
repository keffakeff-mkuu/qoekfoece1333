import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Bot,
  CalendarClock,
  Check,
  Compass,
  Download,
  Megaphone,
  Search,
  Shield,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { exportToCsv } from '../lib/csv';
import { formatNairobiDateTime } from '../lib/date';
import { getRecentApps } from '../lib/recentApps';
import type { OrgRole } from '../types/domain';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FormField,
  InlineAlert,
  LoadingSkeleton,
  PageHeader,
  Pagination,
  StatusLabel,
} from '../components/ui';

const UPCOMING_MODULES: Record<string, { title: string; group: string; summary: string; dependencies: string[] }> = {
  documents: {
    title: 'Workforce Documents',
    group: 'WORKFORCE',
    summary: 'Controlled storage for PSRA guard vetting numbers, training certificates, and expiry reminders.',
    dependencies: ['Private tenant-scoped storage buckets', 'Kenya DPA 2019 retention policies'],
  },
  training: {
    title: 'Guard Training & Assessments',
    group: 'WORKFORCE',
    summary: 'Track site inductions, physical drill attendance, and refresher certification dates.',
    dependencies: ['Guard Directory (active)', 'Site SOP standing orders'],
  },
  deployment: {
    title: 'Site Deployment Planning',
    group: 'OPERATIONS',
    summary: 'Long-range headcount forecasting across multi-site client contracts.',
    dependencies: ['Sites & Posts (active)', 'Shift Scheduling (active)'],
  },
  patrols: {
    title: 'Checkpoint & Patrol Verification',
    group: 'SECURITY',
    summary: 'Scheduled guard patrol checkpoints and missed-beat escalation logs.',
    dependencies: ['Sites & Posts (active)', 'Mobile Attendance (active)'],
  },
  'occurrence-book': {
    title: 'Digital Occurrence Book (OB)',
    group: 'SECURITY',
    summary: 'Continuous post handover log replacing paper gate occurrence books.',
    dependencies: ['Field Incidents (active)', 'Append-Only Audit Ledger (active)'],
  },
  timesheets: {
    title: 'Verified Shift Timesheets',
    group: 'FINANCE',
    summary: 'Roll up confirmed clock-in/out attendance events into payable shift hours.',
    dependencies: ['Attendance Verification (active)', 'Supervisor Overrides (active)'],
  },
  payroll: {
    title: 'Guard Payroll Run (KES)',
    group: 'FINANCE',
    summary: 'Statutory deductions (PAYE, NSSF, SHIF) and shift overtime calculations.',
    dependencies: ['Verified Shift Timesheets', 'Finance Manager RBAC'],
  },
  invoices: {
    title: 'Client Billing & Invoices',
    group: 'FINANCE',
    summary: 'Automated monthly client billing derived from manned post coverage hours.',
    dependencies: ['Client Accounts (active)', 'Verified Shift Timesheets'],
  },
  receipts: {
    title: 'Payment Receipts & Reconciliation',
    group: 'FINANCE',
    summary: 'Track client invoice settlements and M-Pesa reference reconciliation.',
    dependencies: ['Client Billing & Invoices'],
  },
  analytics: {
    title: 'Operational SLA Analytics',
    group: 'INTELLIGENCE',
    summary: 'Multi-month post coverage rates, incident trend breakdowns, and client SLA reporting.',
    dependencies: ['FieldForce Operations (active)', 'CSV Audit Reports (active)'],
  },
};

export const UpcomingModulePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const info = (slug && UPCOMING_MODULES[slug]) || {
    title: 'Upcoming Platform Module',
    group: 'ROADMAP',
    summary: 'This module is scheduled on the AI Africa roadmap and is not yet enabled for live data entry.',
    dependencies: ['FieldForce Core V1'],
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        eyebrow={`${info.group} · Roadmap Preview`}
        title={info.title}
        description={info.summary}
        actions={
          <Link to="/app/discover">
            <Button variant="secondary">View 20-Product Suite</Button>
          </Link>
        }
      />

      <Card className="p-6 space-y-4">
        <StatusLabel label="Upcoming Functionality — Not Enabled in V1" tone="amber" />
        <p className="text-sm text-slate-600 leading-relaxed">
          Per the V1 scope governance, this module is intentionally visible in the navigation architecture so
          operations teams can plan rollout readiness without introducing unverified workflows or schema changes.
        </p>
        <div className="border-t border-slate-100 pt-4">
          <div className="text-xs font-semibold text-slate-700 mb-2">Platform Prerequisites</div>
          <ul className="space-y-1.5 text-sm text-slate-600">
            {info.dependencies.map((d) => (
              <li key={d}>• {d}</li>
            ))}
          </ul>
        </div>
        <div className="pt-2 flex flex-wrap gap-3">
          <Link to="/app/fieldforce/dashboard">
            <Button>Return to FieldForce Command</Button>
          </Link>
          <Link to="/app/ai-assistant">
            <Button variant="secondary">Ask SOP Assistant</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
};

export const HomePage: React.FC = () => {
  const { loading, user, organization, catalog, entitlements, employees, shifts, assignments, posts, incidents } =
    useApp();

  const waitlistedSlugs = new Set(entitlements.filter((e) => e.status === 'waitlisted').map((e) => e.slug));
  const fieldforce = catalog.find((p) => p.slug === 'fieldforce');
  const recentApps = getRecentApps();

  const understaffedCount = shifts.filter((s) => {
    const post = posts.find((p) => p.id === s.post_id);
    const assignedCount = assignments.filter((a) => a.shift_id === s.id && a.status !== 'cancelled').length;
    return assignedCount < (post?.required_guards ?? 1);
  }).length;

  const openIncidents = incidents.filter((i) => i.status === 'open' || i.status === 'under_investigation');
  const pendingAiDrafts = incidents.filter((i) => Boolean(i.ai_draft_summary) && !i.ai_approved_at);
  const activeGuards = employees.filter((e) => e.status === 'active').length;

  const pendingActions = [
    ...(understaffedCount > 0
      ? [
          {
            id: 'act-shifts',
            title: `${understaffedCount} shift(s) below required guard count`,
            to: '/app/fieldforce/schedule',
            cta: 'Assign Guards',
            tone: 'amber' as const,
          },
        ]
      : []),
    ...(pendingAiDrafts.length > 0
      ? [
          {
            id: 'act-ai',
            title: `${pendingAiDrafts.length} AI incident draft(s) awaiting human approval`,
            to: '/app/fieldforce/incidents',
            cta: 'Review & Approve',
            tone: 'amber' as const,
          },
        ]
      : []),
    ...(openIncidents.length > 0
      ? [
          {
            id: 'act-inc',
            title: `${openIncidents.length} open/investigating security incident(s)`,
            to: '/app/fieldforce/incidents',
            cta: 'Open Incidents',
            tone: 'rose' as const,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner + AI Assistant Entry */}
      <Card className="p-6 bg-[#0B132B] text-white border-[#1C2541]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="text-xs font-medium text-emerald-400">
              {organization?.name} · {organization?.currency} · {organization?.timezone}
            </div>
            <h1 className="text-2xl font-bold mt-1.5">Welcome back, {user?.fullName}</h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              {activeGuards} active guard(s) · {shifts.length} published shift(s) · {openIncidents.length} active incident(s).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link to="/app/fieldforce/dashboard">
              <Button>Open FieldForce Command</Button>
            </Link>
            <Link to="/app/ai-assistant">
              <Button variant="secondary">
                <Bot className="h-4 w-4 text-[#059669]" /> SOP Assistant
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {loading ? (
        <LoadingSkeleton rows={3} />
      ) : (
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left Column: Active Apps, Recently Used, Discover */}
          <div className="lg:col-span-8 space-y-6">
            {/* My Active Applications */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[#0B132B]">My Active Applications</h2>
                <Link to="/app/my-apps" className="text-xs font-semibold text-[#059669] hover:underline">
                  View all →
                </Link>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Card className="p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">{fieldforce?.name || 'FieldForce AI'}</span>
                      <StatusLabel label="Active · V1" tone="emerald" />
                    </div>
                    <p className="text-xs text-slate-600 mt-1.5">
                      {fieldforce?.short_description || 'Security guard rostering, attendance verification, and incident workflows.'}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-mono text-slate-500">Product 01 of 20</span>
                    <Link to="/app/fieldforce/dashboard" className="text-xs font-semibold text-[#059669] hover:underline">
                      Launch →
                    </Link>
                  </div>
                </Card>

                <Card className="p-5 flex flex-col justify-between bg-slate-50/70">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">BiasharaOS</span>
                      <StatusLabel label={waitlistedSlugs.has('biashara-os') ? 'Waitlisted' : 'Planned Next'} tone="amber" />
                    </div>
                    <p className="text-xs text-slate-600 mt-1.5">
                      SME invoicing, M-Pesa reconciliation, and commercial ledger.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200/70 flex items-center justify-between">
                    <span className="text-xs font-mono text-slate-500">Product 02 of 20</span>
                    <Link to="/app/discover" className="text-xs font-semibold text-slate-700 hover:underline">
                      Roadmap →
                    </Link>
                  </div>
                </Card>
              </div>
            </section>

            {/* Recently Used Applications */}
            <section className="space-y-3">
              <h2 className="text-base font-bold text-[#0B132B]">Recently Used Workspaces</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {recentApps.map((entry) => (
                  <Link key={entry.path} to={entry.path}>
                    <Card className="p-4 hover:border-[#059669] transition-colors flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs text-slate-500">{entry.group}</div>
                        <div className="text-sm font-semibold text-slate-900 truncate">{entry.label}</div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
                    </Card>
                  </Link>
                ))}
              </div>
            </section>

            {/* Discover Applications Preview */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[#0B132B]">Discover Applications</h2>
                <Link to="/app/discover" className="text-xs font-semibold text-[#059669] hover:underline">
                  Explore all 20 →
                </Link>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                {catalog.slice(2, 5).map((item) => (
                  <Card key={item.id} className="p-4 flex flex-col justify-between">
                    <div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {String(item.display_order).padStart(2, '0')} · {item.category}
                      </div>
                      <div className="font-semibold text-sm text-slate-900 mt-1">{item.name}</div>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">{item.short_description}</p>
                    </div>
                    <Link to="/app/discover" className="mt-3 text-xs font-medium text-[#059669] hover:underline">
                      {waitlistedSlugs.has(item.slug) ? 'On Waitlist →' : 'View Roadmap →'}
                    </Link>
                  </Card>
                ))}
              </div>
            </section>
          </div>

          {/* Right Column: Notifications, Pending Actions, Announcements */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#0B132B] flex items-center gap-2">
                  <Bell className="h-4 w-4 text-[#059669]" /> Notifications &amp; Pending Actions
                </h2>
                <span className="text-xs font-mono tabular-nums text-slate-500">{pendingActions.length}</span>
              </div>

              {pendingActions.length === 0 ? (
                <p className="text-xs text-slate-600">No urgent actions pending. All shifts and incidents are up to date.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {pendingActions.map((act) => (
                    <div key={act.id} className="py-3 first:pt-1 last:pb-0 space-y-1.5">
                      <StatusLabel label={act.title} tone={act.tone} />
                      <Link to={act.to} className="block text-xs font-semibold text-[#059669] hover:underline">
                        {act.cta} →
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5 space-y-3">
              <h2 className="text-sm font-bold text-[#0B132B] flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-slate-600" /> Platform Announcements
              </h2>
              <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
                <div className="pb-3 border-b border-slate-100">
                  <div className="font-semibold text-slate-900">FieldForce V1 Privacy Boundary Active</div>
                  <p className="mt-1">
                    National ID scans, biometrics, and background GPS tracking remain disabled in V1 per Kenya DPA 2019 minimisation rules.
                  </p>
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Human-in-the-Loop Incident Drafting</div>
                  <p className="mt-1">
                    AI incident summaries strip phone numbers and emails server-side and require explicit supervisor approval before saving.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export const MyAppsPage: React.FC = () => {
  const { catalog, entitlements } = useApp();
  const waitlistedSlugs = new Set(entitlements.filter((e) => e.status === 'waitlisted').map((e) => e.slug));
  const fieldforce = catalog.find((p) => p.slug === 'fieldforce');
  const waitlisted = catalog.filter((p) => waitlistedSlugs.has(p.slug));

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Applications"
        description="Active workspace entitlements and tracked roadmap waitlists for your organisation."
        actions={
          <Link to="/app/discover">
            <Button variant="secondary">
              <Compass className="h-4 w-4" /> Browse All 20 Products
            </Button>
          </Link>
        }
      />

      <div className="grid md:grid-cols-2 gap-4">
        {fieldforce && (
          <Card className="p-6 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center gap-2 mb-2">
                <span className="font-bold text-lg text-[#0B132B]">{fieldforce.name}</span>
                <StatusLabel label="Enabled · In Development" tone="emerald" />
              </div>
              <p className="text-sm text-slate-600">{fieldforce.short_description}</p>
            </div>
            <div className="mt-5">
              <Link to="/app/fieldforce/dashboard">
                <Button>Open Workspace</Button>
              </Link>
            </div>
          </Card>
        )}

        {waitlisted.length === 0 ? (
          <Card className="p-6 flex flex-col justify-between bg-slate-50/70">
            <div>
              <h3 className="font-semibold text-slate-900">No Waitlisted Modules Yet</h3>
              <p className="text-sm text-slate-600 mt-1">
                Explore the 20-product catalogue to join early-access waitlists such as BiasharaOS.
              </p>
            </div>
            <div className="mt-4">
              <Link to="/app/discover" className="text-xs font-semibold text-[#059669] hover:underline">
                Open Discover Catalogue →
              </Link>
            </div>
          </Card>
        ) : (
          waitlisted.map((p) => (
            <Card key={p.id} className="p-6 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center gap-2 mb-2">
                  <span className="font-bold text-slate-900">{p.name}</span>
                  <StatusLabel label="Waitlisted" tone="amber" />
                </div>
                <p className="text-sm text-slate-600">{p.short_description}</p>
              </div>
              <div className="mt-4">
                <Link to="/app/discover" className="text-xs font-semibold text-[#059669] hover:underline">
                  Manage in Suite Catalogue →
                </Link>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export const DiscoverPage: React.FC = () => {
  const { catalog, entitlements, toggleWaitlist } = useApp();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'planned_next' | 'waitlisted'>('all');
  const [busySlug, setBusySlug] = useState<string | null>(null);

  const waitlistedSlugs = new Set(entitlements.filter((e) => e.status === 'waitlisted').map((e) => e.slug));

  const filtered = catalog.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.category.toLowerCase().includes(query.toLowerCase()) ||
      p.short_description.toLowerCase().includes(query.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === 'active') return p.status === 'in_development' || p.status === 'live';
    if (filter === 'planned_next') return p.status === 'planned_next';
    if (filter === 'waitlisted') return waitlistedSlugs.has(p.slug);
    return true;
  });

  const handleToggle = async (slug: string) => {
    setBusySlug(slug);
    await toggleWaitlist(slug);
    setBusySlug(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Discover — 20-Product Suite"
        description="Only FieldForce AI is currently open for workspace operations. Join waitlists for upcoming vertical modules."
        actions={
          <div className="relative w-full sm:w-72">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products or categories..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm bg-white min-h-[42px]"
            />
          </div>
        }
      />

      <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
        {(
          [
            { key: 'all', label: `All (${catalog.length})` },
            { key: 'active', label: 'Active Workspace' },
            { key: 'planned_next', label: 'Planned Next' },
            { key: 'waitlisted', label: `Waitlisted (${waitlistedSlugs.size})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              filter === tab.key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No matching products"
          description="Try clearing your search filter or switching tabs to view all 20 suite modules."
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const isWaitlisted = waitlistedSlugs.has(p.slug);
            const tone = p.status === 'in_development' ? 'emerald' : p.status === 'planned_next' ? 'amber' : 'slate';
            const statusText =
              p.status === 'in_development' ? 'In Development' : p.status === 'planned_next' ? 'Planned Next' : 'Planned';

            return (
              <Card key={p.id} className="p-5 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-mono tabular-nums text-slate-500">
                    {String(p.display_order).padStart(2, '0')} · {p.category}
                  </div>
                  <h3 className="font-semibold text-base text-slate-900 mt-2">{p.name}</h3>
                  <p className="text-sm text-slate-600 mt-1.5">{p.short_description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                  <StatusLabel label={statusText} tone={tone} />
                  {p.slug === 'fieldforce' ? (
                    <Link to="/app/fieldforce/dashboard">
                      <Button size="sm">Open Workspace</Button>
                    </Link>
                  ) : (
                    <Button
                      variant={isWaitlisted ? 'secondary' : 'primary'}
                      size="sm"
                      disabled={busySlug === p.slug}
                      onClick={() => handleToggle(p.slug)}
                    >
                      {isWaitlisted ? (
                        <>
                          <Check className="h-3.5 w-3.5" /> On Waitlist
                        </>
                      ) : (
                        'Join Waitlist'
                      )}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const AIAssistantPage: React.FC = () => {
  const { querySOPAssistant } = useApp();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(
    'Select a deterministic operational check below. Responses are computed directly from stored SQLite tenant records and Kenya Security SOP rules.'
  );
  const [busy, setBusy] = useState(false);

  const runCheck = async (topic: string, label: string) => {
    setBusy(true);
    setQuestion(label);
    const res = await querySOPAssistant(topic);
    setBusy(false);
    if (res.answer) setAnswer(res.answer);
    else if (res.error) setAnswer(res.error);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        eyebrow="Zero-Hallucination Deterministic Mode"
        title="Procedural SOP Assistant"
        description="Queries live SQLite rostering, incident queues, and Kenya DPA 2019 / PSRA operational policies."
      />

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => runCheck('unassigned', 'Check Unassigned Shifts')}>
          <CalendarClock className="h-4 w-4" /> Check Unassigned Shifts
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => runCheck('incidents', 'Check Open Incident Queue')}>
          <AlertTriangle className="h-4 w-4" /> Check Open Incident Queue
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => runCheck('privacy', 'Kenya DPA 2019 & PSRA V1 Rules')}>
          <Shield className="h-4 w-4" /> Kenya DPA &amp; PSRA Rules
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => runCheck('override', 'Attendance Override SOP')}>
          Attendance Override SOP
        </Button>
      </div>

      <Card className="p-6 space-y-2">
        {question && <div className="text-xs font-semibold text-slate-500">Query · {question}</div>}
        <p className="text-sm text-slate-800 leading-relaxed">{busy ? 'Querying stored tenant state...' : answer}</p>
      </Card>
    </div>
  );
};

export const ReportsPage: React.FC = () => {
  const { attendance, incidents, employees, sites } = useApp();

  const exportAttendance = () => {
    exportToCsv(
      'fieldforce_attendance_audit.csv',
      attendance.map((a) => {
        const emp = employees.find((e) => e.id === a.employee_id);
        return {
          event_id: a.id,
          badge: emp?.employee_number ?? '',
          guard: emp ? `${emp.first_name} ${emp.last_name}` : a.employee_id,
          event_type: a.event_type,
          recorded_at_eat: formatNairobiDateTime(a.recorded_at),
          location: a.location_metadata ? `${a.location_metadata.lat},${a.location_metadata.lng}` : '',
          override_reason: a.override_reason ?? '',
        };
      })
    );
  };

  const exportIncidents = () => {
    exportToCsv(
      'fieldforce_incidents_audit.csv',
      incidents.map((i) => ({
        id: i.id,
        site: sites.find((s) => s.id === i.site_id)?.name ?? i.site_id,
        category: i.category,
        severity: i.severity,
        status: i.status,
        occurrence_eat: formatNairobiDateTime(i.occurrence_time),
        reported_by: i.reported_by_name,
        narrative: i.narrative,
        approved_summary_or_notes: i.review_notes ?? '',
      }))
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational Reports & CSV Exports"
        description="Exportable operational audits generated strictly from persisted tenant records."
      />

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-6 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-slate-900">Attendance Event Ledger</h3>
            <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
              {attendance.length} stored event(s) · Africa/Nairobi
            </p>
          </div>
          <Button onClick={exportAttendance} disabled={attendance.length === 0}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </Card>

        <Card className="p-6 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-slate-900">Incident &amp; Resolution Register</h3>
            <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
              {incidents.length} recorded incident(s)
            </p>
          </div>
          <Button onClick={exportIncidents} disabled={incidents.length === 0}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </Card>
      </div>
    </div>
  );
};

export const SettingsPage: React.FC<{ tab: 'organisation' | 'members' | 'audit' }> = ({ tab }) => {
  const { organization, updateOrganization, members, inviteMember, updateMemberRole, auditEvents, currentRole } = useApp();
  const [searchParams] = useSearchParams();
  const isRolesView = searchParams.get('view') === 'roles';

  const [orgName, setOrgName] = useState(organization?.name ?? '');
  const [legalName, setLegalName] = useState(organization?.legal_name ?? '');

  useEffect(() => {
    setOrgName(organization?.name ?? '');
    setLegalName(organization?.legal_name ?? '');
  }, [organization?.id, organization?.name, organization?.legal_name]);
  const [mName, setMName] = useState('');
  const [mEmail, setMEmail] = useState('');
  const [mRole, setMRole] = useState<OrgRole>('supervisor');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; msg: string } | null>(null);

  const isAdmin = currentRole === 'owner' || currentRole === 'admin';
  const PAGE_SIZE = 10;

  const filteredAudit = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return auditEvents;
    return auditEvents.filter(
      (ev) =>
        ev.action.toLowerCase().includes(q) ||
        ev.actor_name.toLowerCase().includes(q) ||
        ev.entity_type.toLowerCase().includes(q)
    );
  }, [auditEvents, auditSearch]);

  const pagedAudit = filteredAudit.slice((auditPage - 1) * PAGE_SIZE, auditPage * PAGE_SIZE);

  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const res = await updateOrganization(orgName, legalName);
    if (res.error) setFeedback({ tone: 'error', msg: res.error });
    else setFeedback({ tone: 'success', msg: 'Organisation details updated.' });
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const res = await inviteMember(mName, mEmail, mRole);
    if (res.error) setFeedback({ tone: 'error', msg: res.error });
    else {
      setMName('');
      setMEmail('');
      setFeedback({ tone: 'success', msg: 'Team member added to organisation.' });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organisation & Governance"
        description="Manage company settings, role-based access control, and immutable audit trails."
      />

      <div className="inline-flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg">
        <Link
          to="/app/settings/organisation"
          className={`px-3 py-1.5 rounded-md text-xs font-medium ${tab === 'organisation' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
        >
          Organisation
        </Link>
        <Link
          to="/app/settings/members"
          className={`px-3 py-1.5 rounded-md text-xs font-medium ${tab === 'members' && !isRolesView ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
        >
          Team Members
        </Link>
        <Link
          to="/app/settings/members?view=roles"
          className={`px-3 py-1.5 rounded-md text-xs font-medium ${tab === 'members' && isRolesView ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
        >
          Roles Matrix
        </Link>
        <Link
          to="/app/settings/audit-log"
          className={`px-3 py-1.5 rounded-md text-xs font-medium ${tab === 'audit' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
        >
          Audit Logs
        </Link>
      </div>

      {feedback && <InlineAlert tone={feedback.tone}>{feedback.msg}</InlineAlert>}

      {tab === 'organisation' && (
        <Card className="p-6 max-w-xl">
          <h2 className="font-bold text-lg text-slate-900 mb-4">Organisation Profile</h2>
          <form onSubmit={handleSaveOrg} className="space-y-4">
            <FormField label="Trading Name" htmlFor="org-trading-name">
              <input
                id="org-trading-name"
                required
                disabled={!isAdmin}
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:bg-slate-50"
              />
            </FormField>
            <FormField label="Legal Name" htmlFor="org-legal-name">
              <input
                id="org-legal-name"
                disabled={!isAdmin}
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:bg-slate-50"
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-700">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                Currency · <strong className="font-mono">{organization?.currency}</strong>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                Timezone · <strong className="font-mono">{organization?.timezone}</strong>
              </div>
            </div>
            {isAdmin && <Button type="submit">Save Changes</Button>}
          </form>
        </Card>
      )}

      {tab === 'members' && (
        <div className="space-y-4">
          {isRolesView && (
            <Card className="p-5">
              <h3 className="font-bold text-sm text-slate-900 mb-3">RBAC Access Scope Summary</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-slate-600">
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <strong className="text-slate-900 block">Owner / Admin</strong>
                  Full organisation governance, team RBAC, master data, shifts, and audit logs.
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <strong className="text-slate-900 block">Operations / HR Manager</strong>
                  Manage clients, sites, shifts, employee directory, and audit log reads.
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <strong className="text-slate-900 block">Supervisor / Guard</strong>
                  Site-scoped overrides &amp; incident approvals (Supervisor); self clock-in &amp; incident intake (Guard).
                </div>
              </div>
            </Card>
          )}

          {isAdmin && (
            <Card className="p-5">
              <h3 className="font-semibold text-sm text-slate-900 mb-3">Add Team Member</h3>
              <form onSubmit={handleInvite} className="grid sm:grid-cols-4 gap-3">
                <input
                  required
                  placeholder="Full Name"
                  value={mName}
                  onChange={(e) => setMName(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
                <input
                  required
                  type="email"
                  placeholder="Work Email"
                  value={mEmail}
                  onChange={(e) => setMEmail(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
                <select
                  value={mRole}
                  onChange={(e) => setMRole(e.target.value as OrgRole)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="operations_manager">Operations Manager</option>
                  <option value="hr_manager">HR Manager</option>
                  <option value="supervisor">Field Supervisor</option>
                  <option value="guard">Security Guard</option>
                  <option value="finance_manager">Finance Manager</option>
                  <option value="admin">Admin</option>
                </select>
                <Button type="submit">Add Member</Button>
              </form>
            </Card>
          )}

          <Card className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3 font-medium">Name</th>
                  <th className="p-3 font-medium">Email</th>
                  <th className="p-3 font-medium">Role</th>
                  <th className="p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="p-3 font-medium text-slate-900">{m.full_name}</td>
                    <td className="p-3 text-slate-600">{m.email}</td>
                    <td className="p-3">
                      {isAdmin ? (
                        <select
                          value={m.role}
                          onChange={async (e) => {
                            const res = await updateMemberRole(m.id, e.target.value as OrgRole);
                            if (res.error) setFeedback({ tone: 'error', msg: res.error });
                          }}
                          className="border border-slate-300 rounded px-2 py-1 text-xs bg-white min-h-[34px]"
                        >
                          <option value="owner">owner</option>
                          <option value="admin">admin</option>
                          <option value="operations_manager">operations_manager</option>
                          <option value="hr_manager">hr_manager</option>
                          <option value="supervisor">supervisor</option>
                          <option value="guard">guard</option>
                          <option value="finance_manager">finance_manager</option>
                        </select>
                      ) : (
                        <span className="font-mono text-xs">{m.role}</span>
                      )}
                    </td>
                    <td className="p-3">
                      <StatusLabel label={m.status} tone="emerald" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === 'audit' && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Shield className="h-4 w-4 text-[#059669]" />
              <span>Append-Only Platform Audit Log (SQLite Immutability Enforced)</span>
            </div>
            <input
              value={auditSearch}
              onChange={(e) => {
                setAuditSearch(e.target.value);
                setAuditPage(1);
              }}
              placeholder="Filter by action, actor, or entity..."
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white w-full sm:w-64"
            />
          </div>

          {filteredAudit.length === 0 ? (
            <div className="p-6 text-sm text-slate-600">
              No audit events match your filter, or audit logs require management permissions.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="p-3 font-medium">Time (EAT)</th>
                      <th className="p-3 font-medium">Actor</th>
                      <th className="p-3 font-medium">Action</th>
                      <th className="p-3 font-medium">Entity</th>
                      <th className="p-3 font-medium">Metadata</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pagedAudit.map((ev) => (
                      <tr key={ev.id} className="hover:bg-slate-50">
                        <td className="p-3 whitespace-nowrap font-mono tabular-nums">
                          {formatNairobiDateTime(ev.created_at)}
                        </td>
                        <td className="p-3 font-medium text-slate-900">{ev.actor_name}</td>
                        <td className="p-3 font-mono text-slate-700">{ev.action}</td>
                        <td className="p-3 text-slate-600">{ev.entity_type}</td>
                        <td className="p-3 font-mono text-slate-500">{JSON.stringify(ev.metadata)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={auditPage}
                pageSize={PAGE_SIZE}
                total={filteredAudit.length}
                onPageChange={setAuditPage}
              />
            </>
          )}
        </Card>
      )}
    </div>
  );
};

export const ProfilePage: React.FC = () => {
  const { user, currentRole, organization, isDemo, updateProfile } = useApp();
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber ?? '');

  useEffect(() => {
    setFullName(user?.fullName ?? '');
    setPhoneNumber(user?.phoneNumber ?? '');
  }, [user?.id, user?.fullName, user?.phoneNumber]);
  const [newPassword, setNewPassword] = useState('');
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; msg: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const res = await updateProfile({
      fullName,
      phoneNumber,
      newPassword: newPassword.trim() ? newPassword : undefined,
    });
    if (res.error) setFeedback({ tone: 'error', msg: res.error });
    else {
      setNewPassword('');
      setFeedback({ tone: 'success', msg: 'Profile updated successfully.' });
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <PageHeader
        title="Account Profile"
        description="Manage your display name, operational phone number, and credentials."
      />
      <Card className="p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 pb-3 border-b border-slate-100">
          <span>{user?.email}</span>
          <span>·</span>
          <Badge tone="navy">{currentRole?.replace('_', ' ')}</Badge>
          <span>·</span>
          <span>{organization?.name}</span>
        </div>
        {feedback && <InlineAlert tone={feedback.tone}>{feedback.msg}</InlineAlert>}
        <form onSubmit={submit} className="space-y-4">
          <FormField label="Full Name" htmlFor="prof-name">
            <input
              id="prof-name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </FormField>
          <FormField label="Operational Phone" htmlFor="prof-phone">
            <input
              id="prof-phone"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+2547..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
            />
          </FormField>
          {!isDemo && (
            <FormField label="New Password (optional, min 8 chars)" htmlFor="prof-pw">
              <input
                id="prof-pw"
                type="password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </FormField>
          )}
          <Button type="submit">Save Profile</Button>
        </form>
      </Card>
    </div>
  );
};

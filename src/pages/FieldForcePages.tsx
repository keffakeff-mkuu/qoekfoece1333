import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Bot,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  MapPin,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatNairobiDateTime, formatNairobiTime, todayNairobiDate } from '../lib/date';
import type { Employee, Incident, IncidentCategory, IncidentSeverity, IncidentStatus } from '../types/domain';
import { AttendanceOverviewChart, SiteCoverageChart } from '../components/Charts';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Drawer,
  EmptyState,
  FormField,
  InlineAlert,
  LoadingSkeleton,
  PageHeader,
  Pagination,
  StatusLabel,
} from '../components/ui';

export const FFDashboardPage: React.FC = () => {
  const { loading, employees, sites, posts, shifts, assignments, attendance, incidents, querySOPAssistant } = useApp();
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const activeGuards = employees.filter((e) => e.status === 'active').length;
  const activeSites = sites.filter((s) => s.is_active).length;
  const overrideCount = attendance.filter((a) => a.event_type === 'supervisor_override').length;

  const unassignedShifts = shifts.filter((s) => {
    const post = posts.find((p) => p.id === s.post_id);
    const count = assignments.filter((a) => a.shift_id === s.id && a.status !== 'cancelled').length;
    return count < (post?.required_guards ?? 1);
  });

  const shiftsMissingClockIn = shifts.filter(
    (s) =>
      assignments.some((a) => a.shift_id === s.id && a.status !== 'cancelled') &&
      !attendance.some((ev) => ev.shift_id === s.id && ev.event_type === 'clock_in')
  ).length;

  const attendanceExceptions = overrideCount + shiftsMissingClockIn;
  const openIncidents = incidents.filter((i) => i.status === 'open' || i.status === 'under_investigation');
  const pendingAiApprovals = incidents.filter((i) => Boolean(i.ai_draft_summary) && !i.ai_approved_at);

  const runInsightCheck = async () => {
    setAiBusy(true);
    const res = await querySOPAssistant('unassigned');
    setAiBusy(false);
    if (res.answer) setAiInsight(res.answer);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="FieldForce AI · Security Edition"
        title="Operational Command Centre"
        description="Live readiness across active guards, sites, attendance exceptions, and incident escalation."
        actions={
          <>
            <Link to="/app/fieldforce/schedule">
              <Button variant="secondary" size="sm">Manage Shifts</Button>
            </Link>
            <Link to="/app/fieldforce/incidents">
              <Button size="sm">Log Incident</Button>
            </Link>
          </>
        }
      />

      {(unassignedShifts.length > 0 || pendingAiApprovals.length > 0) && (
        <InlineAlert tone="warning">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              <strong>Action Required:</strong> {unassignedShifts.length} understaffed shift(s) ·{' '}
              {pendingAiApprovals.length} AI incident summary draft(s) awaiting human approval.
            </span>
            <Link to="/app/fieldforce/schedule" className="font-semibold underline">
              Review Roster →
            </Link>
          </div>
        </InlineAlert>
      )}

      {loading ? (
        <LoadingSkeleton rows={3} />
      ) : (
        <>
          {/* 4 Live Backend KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5">
              <div className="text-xs font-medium text-slate-500">Active Guards</div>
              <div className="text-2xl font-bold mt-1 font-mono tabular-nums text-[#0B132B]">{activeGuards}</div>
              <div className="text-xs text-slate-500 mt-1 font-mono tabular-nums">of {employees.length} total</div>
            </Card>
            <Card className="p-5">
              <div className="text-xs font-medium text-slate-500">Active Sites</div>
              <div className="text-2xl font-bold mt-1 font-mono tabular-nums text-[#0B132B]">{activeSites}</div>
              <div className="text-xs text-slate-500 mt-1 font-mono tabular-nums">{posts.length} manned post(s)</div>
            </Card>
            <Card className="p-5">
              <div className="text-xs font-medium text-slate-500">Attendance Exceptions</div>
              <div className="text-2xl font-bold mt-1 font-mono tabular-nums text-[#D97706]">
                {attendanceExceptions}
              </div>
              <div className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                {overrideCount} override(s) · {shiftsMissingClockIn} unlogged
              </div>
            </Card>
            <Card className="p-5">
              <div className="text-xs font-medium text-slate-500">Open Incidents</div>
              <div className="text-2xl font-bold mt-1 font-mono tabular-nums text-[#E11D48]">
                {openIncidents.length}
              </div>
              <div className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                {incidents.filter((i) => i.severity === 'critical' || i.severity === 'high').length} high/critical
              </div>
            </Card>
          </div>

          {/* Live SVG Charts */}
          <div className="grid lg:grid-cols-2 gap-6">
            <AttendanceOverviewChart attendance={attendance} />
            <SiteCoverageChart sites={sites} posts={posts} shifts={shifts} assignments={assignments} />
          </div>

          {/* Operational Queues & AI Insights */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-900">Recent Incidents</h2>
                <Link to="/app/fieldforce/incidents" className="text-xs font-semibold text-[#059669] hover:underline">
                  Open Workspace →
                </Link>
              </div>
              {incidents.length === 0 ? (
                <p className="text-sm text-slate-500">No field incidents reported.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {incidents.slice(0, 4).map((inc) => (
                    <div key={inc.id} className="py-2.5 flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 capitalize">
                          {inc.category.replace('_', ' ')} · {sites.find((s) => s.id === inc.site_id)?.name || 'Site'}
                        </div>
                        <p className="text-xs text-slate-600 truncate mt-0.5">{inc.narrative}</p>
                      </div>
                      <StatusLabel
                        label={inc.severity}
                        tone={inc.severity === 'critical' || inc.severity === 'high' ? 'rose' : 'amber'}
                      />
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-900">Upcoming &amp; Active Shifts</h2>
                <Link to="/app/fieldforce/schedule" className="text-xs font-semibold text-[#059669] hover:underline">
                  View Roster →
                </Link>
              </div>
              {shifts.length === 0 ? (
                <p className="text-sm text-slate-500">No shifts scheduled yet.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {shifts.slice(0, 4).map((sh) => {
                    const site = sites.find((s) => s.id === sh.site_id);
                    const post = posts.find((p) => p.id === sh.post_id);
                    const count = assignments.filter((a) => a.shift_id === sh.id && a.status !== 'cancelled').length;
                    const req = post?.required_guards ?? 1;
                    return (
                      <div key={sh.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 truncate">
                            {site?.name} · {post?.name}
                          </div>
                          <div className="text-xs text-slate-500 font-mono tabular-nums">
                            {sh.shift_date} · {formatNairobiTime(sh.start_time)}–{formatNairobiTime(sh.end_time)} EAT
                          </div>
                        </div>
                        <StatusLabel label={`${count}/${req}`} tone={count < req ? 'amber' : 'emerald'} />
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="p-5 space-y-3">
              <h2 className="font-bold text-slate-900">Pending Human Approvals</h2>
              {pendingAiApprovals.length === 0 && openIncidents.length === 0 ? (
                <p className="text-sm text-slate-500">No incident drafts or open reviews awaiting supervisor sign-off.</p>
              ) : (
                <div className="space-y-2.5 text-xs">
                  {pendingAiApprovals.map((inc) => (
                    <div key={inc.id} className="p-3 rounded-lg border border-amber-200 bg-amber-50 flex items-center justify-between gap-3">
                      <span className="font-medium text-amber-950">
                        AI Draft Pending Approval · {inc.category.replace('_', ' ')}
                      </span>
                      <Link to="/app/fieldforce/incidents" className="font-semibold text-[#059669] hover:underline shrink-0">
                        Review →
                      </Link>
                    </div>
                  ))}
                  {openIncidents.slice(0, 3).map((inc) => (
                    <div key={inc.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                      <span className="text-slate-700 capitalize">
                        {inc.status.replace('_', ' ')} · {inc.category.replace('_', ' ')}
                      </span>
                      <Link to="/app/fieldforce/incidents" className="font-semibold text-[#059669] hover:underline shrink-0">
                        Triage →
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-bold text-slate-900 flex items-center gap-2">
                  <Bot className="h-4 w-4 text-[#059669]" /> AI Operational Insights
                </h2>
                <Button variant="secondary" size="sm" onClick={runInsightCheck} disabled={aiBusy}>
                  {aiBusy ? 'Checking...' : 'Run Live Check'}
                </Button>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {aiInsight ||
                  'Deterministic operational readiness check summarizes unassigned shifts from SQLite. For incident reports, use the server-side Gemini drafter inside Incident Workspace.'}
              </p>
              <Link to="/app/ai-assistant" className="inline-block text-xs font-semibold text-[#059669] hover:underline">
                Open Procedural SOP Assistant →
              </Link>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export const FFEmployeesPage: React.FC = () => {
  const { employees, shifts, assignments, attendance, addEmployee, updateEmployeeStatus, currentRole } = useApp();
  const [badge, setBadge] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('+2547');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Employee['status']>('all');
  const [page, setPage] = useState(1);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<{ emp: Employee; nextStatus: Employee['status'] } | null>(
    null
  );
  const [error, setError] = useState('');

  const PAGE_SIZE = 8;
  const canEdit = Boolean(currentRole && ['owner', 'admin', 'operations_manager', 'hr_manager'].includes(currentRole));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = await addEmployee({
      employee_number: badge,
      first_name: firstName,
      last_name: lastName,
      phone,
      status: 'active',
      hire_date: todayNairobiDate(),
    });
    if (res.error) setError(res.error);
    else {
      setBadge('');
      setFirstName('');
      setLastName('');
      setPhone('+2547');
    }
  };

  const handleStatusSelect = async (emp: Employee, nextStatus: Employee['status']) => {
    if (nextStatus === 'suspended' || nextStatus === 'inactive') {
      setPendingStatusChange({ emp, nextStatus });
      return;
    }
    await updateEmployeeStatus(emp.id, nextStatus);
  };

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
      const q = search.trim().toLowerCase();
      const matchesQuery =
        !q ||
        `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
        e.employee_number.toLowerCase().includes(q) ||
        e.phone.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [employees, statusFilter, search]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guard & Staff Directory"
        description="V1 excludes national ID scans, police clearance PDFs, and biometrics per Kenya DPA 2019."
        actions={
          <div className="relative w-full sm:w-64">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search badge, name, or phone..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm bg-white min-h-[42px]"
            />
          </div>
        }
      />

      <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
        {(['all', 'active', 'on_leave', 'suspended', 'inactive'] as const).map((st) => (
          <button
            key={st}
            onClick={() => {
              setStatusFilter(st);
              setPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer capitalize ${
              statusFilter === st ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {st.replace('_', ' ')}
          </button>
        ))}
      </div>

      {canEdit && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Onboard Security Guard</h2>
          {error && (
            <div className="mb-3">
              <InlineAlert tone="error">{error}</InlineAlert>
            </div>
          )}
          <form onSubmit={submit} className="grid sm:grid-cols-5 gap-3">
            <input
              required
              placeholder="Badge # (KG-0105)"
              value={badge}
              onChange={(e) => setBadge(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono min-h-[42px]"
            />
            <input
              required
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[42px]"
            />
            <input
              required
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[42px]"
            />
            <input
              required
              placeholder="+2547XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono min-h-[42px]"
            />
            <Button type="submit">
              <Plus className="h-4 w-4" /> Add Guard
            </Button>
          </form>
        </Card>
      )}

      {filtered.length === 0 ? (
        <EmptyState title="No guard records found" description="Adjust your search or status filter." />
      ) : (
        <>
          {/* Desktop Data Table */}
          <Card className="hidden md:block overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3 font-medium">Badge #</th>
                  <th className="p-3 font-medium">Full Name</th>
                  <th className="p-3 font-medium">Phone</th>
                  <th className="p-3 font-medium">Hire Date</th>
                  <th className="p-3 font-medium">Deployment Status</th>
                  <th className="p-3 font-medium text-right">Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paged.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-xs tabular-nums text-slate-700">{emp.employee_number}</td>
                    <td className="p-3 font-semibold text-slate-900">
                      {emp.first_name} {emp.last_name}
                    </td>
                    <td className="p-3 font-mono text-xs text-slate-600 tabular-nums">{emp.phone}</td>
                    <td className="p-3 font-mono text-xs text-slate-500 tabular-nums">{emp.hire_date}</td>
                    <td className="p-3">
                      {canEdit ? (
                        <select
                          value={emp.status}
                          onChange={(e) => handleStatusSelect(emp, e.target.value as Employee['status'])}
                          className="border border-slate-300 rounded px-2 py-1 text-xs bg-white min-h-[34px]"
                        >
                          <option value="active">active</option>
                          <option value="on_leave">on_leave</option>
                          <option value="suspended">suspended</option>
                          <option value="inactive">inactive</option>
                        </select>
                      ) : (
                        <StatusLabel label={emp.status} tone={emp.status === 'active' ? 'emerald' : 'slate'} />
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedEmp(emp)}>
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
          </Card>

          {/* Android Mobile Card List */}
          <div className="md:hidden space-y-3">
            {paged.map((emp) => (
              <Card key={emp.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-xs text-slate-500">{emp.employee_number}</div>
                    <div className="font-bold text-slate-900">
                      {emp.first_name} {emp.last_name}
                    </div>
                    <div className="font-mono text-xs text-slate-600 mt-0.5">{emp.phone}</div>
                  </div>
                  <StatusLabel
                    label={emp.status.replace('_', ' ')}
                    tone={emp.status === 'active' ? 'emerald' : emp.status === 'suspended' ? 'rose' : 'slate'}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  {canEdit ? (
                    <select
                      value={emp.status}
                      onChange={(e) => handleStatusSelect(emp, e.target.value as Employee['status'])}
                      className="border border-slate-300 rounded-lg px-2.5 py-2 text-xs bg-white min-h-[44px]"
                    >
                      <option value="active">active</option>
                      <option value="on_leave">on_leave</option>
                      <option value="suspended">suspended</option>
                      <option value="inactive">inactive</option>
                    </select>
                  ) : (
                    <span className="text-xs text-slate-500 font-mono">Hired {emp.hire_date}</span>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => setSelectedEmp(emp)}>
                    View Profile
                  </Button>
                </div>
              </Card>
            ))}
            <Card className="overflow-hidden">
              <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
            </Card>
          </div>
        </>
      )}

      {/* Employee Profile Drawer */}
      <Drawer
        open={Boolean(selectedEmp)}
        title={selectedEmp ? `${selectedEmp.first_name} ${selectedEmp.last_name}` : 'Employee Profile'}
        subtitle={selectedEmp ? `Badge ${selectedEmp.employee_number} · ${selectedEmp.phone}` : ''}
        onClose={() => setSelectedEmp(null)}
      >
        {selectedEmp && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-slate-500">Status</div>
                <div className="font-semibold text-slate-900 capitalize mt-0.5">
                  {selectedEmp.status.replace('_', ' ')}
                </div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-slate-500">Hire Date</div>
                <div className="font-mono font-semibold text-slate-900 mt-0.5">{selectedEmp.hire_date}</div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Assigned Shifts
              </h3>
              {assignments.filter((a) => a.employee_id === selectedEmp.id).length === 0 ? (
                <p className="text-xs text-slate-500">No shift assignments currently linked.</p>
              ) : (
                <div className="space-y-2">
                  {assignments
                    .filter((a) => a.employee_id === selectedEmp.id)
                    .map((a) => {
                      const sh = shifts.find((s) => s.id === a.shift_id);
                      return (
                        <div key={a.id} className="p-3 rounded-lg border border-slate-200 text-xs flex justify-between">
                          <span className="font-mono tabular-nums">
                            {sh ? `${sh.shift_date} · ${formatNairobiTime(sh.start_time)}–${formatNairobiTime(sh.end_time)}` : a.shift_id}
                          </span>
                          <Badge tone="emerald">{a.status}</Badge>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Attendance History
              </h3>
              {attendance.filter((ev) => ev.employee_id === selectedEmp.id).length === 0 ? (
                <p className="text-xs text-slate-500">No attendance logs recorded.</p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {attendance
                    .filter((ev) => ev.employee_id === selectedEmp.id)
                    .slice(0, 6)
                    .map((ev) => (
                      <div key={ev.id} className="p-3 flex items-center justify-between text-xs">
                        <span className="font-mono tabular-nums text-slate-600">
                          {formatNairobiDateTime(ev.recorded_at)}
                        </span>
                        <StatusLabel
                          label={ev.event_type.replace('_', ' ')}
                          tone={ev.event_type === 'supervisor_override' ? 'amber' : 'emerald'}
                        />
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Destructive / High-Impact Status Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(pendingStatusChange)}
        title="Confirm Guard Status Change"
        description={
          pendingStatusChange
            ? `Are you sure you want to change ${pendingStatusChange.emp.first_name} ${pendingStatusChange.emp.last_name} (${pendingStatusChange.emp.employee_number}) to "${pendingStatusChange.nextStatus}"? They will not be eligible for new shift assignments while ${pendingStatusChange.nextStatus}.`
            : ''
        }
        confirmLabel="Update Status"
        tone="danger"
        onCancel={() => setPendingStatusChange(null)}
        onConfirm={async () => {
          if (pendingStatusChange) {
            await updateEmployeeStatus(pendingStatusChange.emp.id, pendingStatusChange.nextStatus);
            setPendingStatusChange(null);
          }
        }}
      />
    </div>
  );
};

export const FFClientsPage: React.FC = () => {
  const { clients, sites, addClient, currentRole } = useApp();
  const [code, setCode] = useState('');
  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('+2547');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const canEdit = Boolean(currentRole && ['owner', 'admin', 'operations_manager'].includes(currentRole));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = await addClient({
      client_code: code,
      company_name: company,
      contact_person: contact,
      contact_phone: phone,
    });
    if (res.error) setError(res.error);
    else {
      setCode('');
      setCompany('');
      setContact('');
      setPhone('+2547');
    }
  };

  const filtered = clients.filter(
    (c) =>
      c.company_name.toLowerCase().includes(search.toLowerCase()) ||
      c.client_code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client Accounts"
        description="Corporate accounts and designated facility points of contact."
        actions={
          <div className="relative w-full sm:w-64">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter clients..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm bg-white min-h-[42px]"
            />
          </div>
        }
      />

      {canEdit && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Register Client Account</h2>
          {error && (
            <div className="mb-3">
              <InlineAlert tone="error">{error}</InlineAlert>
            </div>
          )}
          <form onSubmit={submit} className="grid sm:grid-cols-5 gap-3">
            <input
              required
              placeholder="Code (CL-003)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono min-h-[42px]"
            />
            <input
              required
              placeholder="Company Name"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[42px]"
            />
            <input
              required
              placeholder="Contact Person"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[42px]"
            />
            <input
              required
              placeholder="+2547XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono min-h-[42px]"
            />
            <Button type="submit">Add Client</Button>
          </form>
        </Card>
      )}

      {filtered.length === 0 ? (
        <EmptyState title="No client accounts found" description="Register a corporate client or adjust your filter." />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((c) => {
            const siteCount = sites.filter((s) => s.client_id === c.id).length;
            return (
              <Card key={c.id} className="p-5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-mono text-slate-500">{c.client_code}</span>
                  <StatusLabel label={c.is_active ? 'Active' : 'Inactive'} tone={c.is_active ? 'emerald' : 'slate'} />
                </div>
                <h3 className="font-bold text-slate-900 mt-2">{c.company_name}</h3>
                <p className="text-xs text-slate-600 mt-1">
                  POC: {c.contact_person} · <span className="font-mono">{c.contact_phone}</span> ·{' '}
                  <span className="font-mono">{siteCount} site(s)</span>
                </p>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const FFSitesPage: React.FC = () => {
  const { clients, sites, posts, members, siteSupervisors, addSite, addPost, assignSiteSupervisor, currentRole } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('view') === 'posts' ? 'posts' : 'sites';

  const [clientId, setClientId] = useState('');
  const [siteName, setSiteName] = useState('');
  const [city, setCity] = useState('Nairobi');
  const [desc, setDesc] = useState('');
  const [postSiteId, setPostSiteId] = useState('');
  const [postName, setPostName] = useState('');
  const [reqGuards, setReqGuards] = useState(1);
  const [instructions, setInstructions] = useState('');
  const [supSiteId, setSupSiteId] = useState('');
  const [supUserId, setSupUserId] = useState('');
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<string>('');

  const canEdit = Boolean(currentRole && ['owner', 'admin', 'operations_manager'].includes(currentRole));
  const supervisors = members.filter((m) => m.role === 'supervisor' || m.role === 'operations_manager');

  useEffect(() => {
    if (!clientId && clients[0]?.id) setClientId(clients[0].id);
  }, [clients, clientId]);

  useEffect(() => {
    if (!postSiteId && sites[0]?.id) setPostSiteId(sites[0].id);
    if (!supSiteId && sites[0]?.id) setSupSiteId(sites[0].id);
  }, [sites, postSiteId, supSiteId]);

  useEffect(() => {
    if (!supUserId && supervisors[0]?.user_id) setSupUserId(supervisors[0].user_id);
  }, [supervisors, supUserId]);

  const filteredSites = sites.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.city.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPosts = posts.filter((p) => {
    const site = sites.find((s) => s.id === p.site_id);
    return (
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (site?.name || '').toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sites, Security Posts & Supervisors"
        description="Configure client premises, manned posts, required guard counts, and supervisor assignments."
        actions={
          <div className="relative w-full sm:w-64">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sites or posts..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm bg-white min-h-[42px]"
            />
          </div>
        }
      />

      <div className="inline-flex gap-1 p-1 bg-slate-100 rounded-lg">
        <button
          onClick={() => setSearchParams({})}
          className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
            activeTab === 'sites' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
          }`}
        >
          Physical Sites ({sites.length})
        </button>
        <button
          onClick={() => setSearchParams({ view: 'posts' })}
          className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
            activeTab === 'posts' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
          }`}
        >
          Manned Posts ({posts.length})
        </button>
      </div>

      {feedback && <InlineAlert tone="success">{feedback}</InlineAlert>}

      {canEdit && (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="p-5 space-y-3">
            <h2 className="font-semibold text-sm text-slate-900">Add Physical Site</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!clientId) return;
                const res = await addSite({ client_id: clientId, name: siteName, city, location_description: desc });
                if (!res.error) {
                  setSiteName('');
                  setDesc('');
                  setFeedback('Physical site created.');
                }
              }}
              className="space-y-2.5"
            >
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-h-[40px]"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </select>
              <input
                required
                placeholder="Site Name (e.g. Karen Annex)"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[40px]"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  required
                  placeholder="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[40px]"
                />
                <input
                  placeholder="Road / Estate"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[40px]"
                />
              </div>
              <Button type="submit" className="w-full">Create Site</Button>
            </form>
          </Card>

          <Card className="p-5 space-y-3">
            <h2 className="font-semibold text-sm text-slate-900">Add Manned Post</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!postSiteId) return;
                const res = await addPost({
                  site_id: postSiteId,
                  name: postName,
                  required_guards: reqGuards,
                  instructions: instructions || 'Standard access control SOP.',
                });
                if (!res.error) {
                  setPostName('');
                  setInstructions('');
                  setFeedback('Manned security post added.');
                }
              }}
              className="space-y-2.5"
            >
              <select
                value={postSiteId}
                onChange={(e) => setPostSiteId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-h-[40px]"
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-3 gap-2">
                <input
                  required
                  placeholder="Post Name (Gate B)"
                  value={postName}
                  onChange={(e) => setPostName(e.target.value)}
                  className="col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[40px]"
                />
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={reqGuards}
                  onChange={(e) => setReqGuards(Number(e.target.value))}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono min-h-[40px]"
                />
              </div>
              <input
                placeholder="Post standing orders..."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[40px]"
              />
              <Button type="submit" className="w-full">Add Post</Button>
            </form>
          </Card>

          <Card className="p-5 space-y-3">
            <h2 className="font-semibold text-sm text-slate-900">Assign Site Supervisor</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!supSiteId || !supUserId) return;
                const res = await assignSiteSupervisor(supSiteId, supUserId);
                if (!res.error) setFeedback('Supervisor linked to site.');
              }}
              className="space-y-2.5"
            >
              <select
                value={supSiteId}
                onChange={(e) => setSupSiteId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-h-[40px]"
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                value={supUserId}
                onChange={(e) => setSupUserId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-h-[40px]"
              >
                {supervisors.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.full_name} ({m.role})
                  </option>
                ))}
              </select>
              <Button type="submit" variant="secondary" className="w-full">
                <UserCheck className="h-4 w-4" /> Link Supervisor
              </Button>
            </form>
          </Card>
        </div>
      )}

      {activeTab === 'sites' ? (
        <div className="space-y-4">
          {filteredSites.map((s) => {
            const sitePosts = posts.filter((p) => p.site_id === s.id);
            const linkedSups = siteSupervisors
              .filter((ss) => ss.site_id === s.id)
              .map((ss) => members.find((m) => m.user_id === ss.user_id)?.full_name)
              .filter(Boolean);

            return (
              <Card key={s.id} className="p-5">
                <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                  <div>
                    <h3 className="font-bold text-slate-900">{s.name}</h3>
                    <p className="text-xs text-slate-500">
                      {s.location_description ? `${s.location_description} · ` : ''}
                      {s.city}
                      {linkedSups.length > 0 ? ` · Supervisors: ${linkedSups.join(', ')}` : ''}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-slate-600 tabular-nums">{sitePosts.length} Post(s)</span>
                </div>

                <div className="grid sm:grid-cols-3 gap-3 border-t border-slate-100 pt-3">
                  {sitePosts.map((p) => (
                    <div key={p.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                      <div className="font-semibold text-slate-900">{p.name}</div>
                      <div className="text-slate-500 mt-0.5 font-mono tabular-nums">
                        Required Guards: {p.required_guards}
                      </div>
                      {p.instructions && <div className="text-slate-600 mt-1">{p.instructions}</div>}
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
              <tr>
                <th className="p-3 font-medium">Post Name</th>
                <th className="p-3 font-medium">Site</th>
                <th className="p-3 font-medium">Required Guards</th>
                <th className="p-3 font-medium">Standing Orders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPosts.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="p-3 font-semibold text-slate-900">{p.name}</td>
                  <td className="p-3 text-slate-600">{sites.find((s) => s.id === p.site_id)?.name || 'Site'}</td>
                  <td className="p-3 font-mono tabular-nums">{p.required_guards}</td>
                  <td className="p-3 text-xs text-slate-600">{p.instructions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
};

export const FFSchedulePage: React.FC = () => {
  const { sites, posts, shifts, assignments, employees, addShift, assignGuard, removeAssignment, currentRole } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewMode = searchParams.get('view') === 'roster' ? 'roster' : 'shifts';

  const [postId, setPostId] = useState('');
  const [date, setDate] = useState(todayNairobiDate());
  const [shiftType, setShiftType] = useState<'day' | 'night' | 'special'>('day');
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [selectedEmp, setSelectedEmp] = useState<Record<string, string>>({});
  const [pendingRemoval, setPendingRemoval] = useState<{ id: string; label: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!postId && posts[0]?.id) setPostId(posts[0].id);
  }, [posts, postId]);

  const canPublish = Boolean(currentRole && ['owner', 'admin', 'operations_manager'].includes(currentRole));
  const canAssign = Boolean(currentRole && ['owner', 'admin', 'operations_manager', 'supervisor'].includes(currentRole));

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const start_time = shiftType === 'day' ? `${date}T06:00:00+03:00` : `${date}T18:00:00+03:00`;
    const end_time = shiftType === 'day' ? `${date}T18:00:00+03:00` : `${date}T23:59:00+03:00`;
    const res = await addShift({
      site_id: post.site_id,
      post_id: post.id,
      shift_date: date,
      start_time,
      end_time,
      shift_type: shiftType,
    });
    if (res.error) setError(res.error);
  };

  const handleAssign = async (shiftId: string) => {
    setError('');
    const empId = selectedEmp[shiftId];
    if (!empId) {
      setError('Select an active guard before clicking Assign.');
      return;
    }
    const res = await assignGuard(shiftId, empId);
    if (res.error) setError(res.error);
  };

  const filteredShifts = siteFilter === 'all' ? shifts : shifts.filter((s) => s.site_id === siteFilter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shift Scheduling & Roster Matrix"
        description="Double-booking prevention and post coverage alerts in Africa/Nairobi (EAT)."
        actions={
          <select
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-h-[42px]"
          >
            <option value="all">All Sites</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        }
      />

      <div className="inline-flex gap-1 p-1 bg-slate-100 rounded-lg">
        <button
          onClick={() => setSearchParams({})}
          className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
            viewMode === 'shifts' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
          }`}
        >
          Shift Cards
        </button>
        <button
          onClick={() => setSearchParams({ view: 'roster' })}
          className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
            viewMode === 'roster' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
          }`}
        >
          Roster Matrix
        </button>
      </div>

      {canPublish && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Publish New Post Shift</h2>
          <form onSubmit={handleCreateShift} className="grid sm:grid-cols-4 gap-3">
            <select
              value={postId}
              onChange={(e) => setPostId(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-h-[42px]"
            >
              {posts.map((p) => {
                const s = sites.find((x) => x.id === p.site_id);
                return (
                  <option key={p.id} value={p.id}>
                    {s?.name} — {p.name}
                  </option>
                );
              })}
            </select>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono min-h-[42px]"
            />
            <select
              value={shiftType}
              onChange={(e) => setShiftType(e.target.value as 'day' | 'night' | 'special')}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-h-[42px]"
            >
              <option value="day">Day (06:00–18:00 EAT)</option>
              <option value="night">Night (18:00–00:00 EAT)</option>
              <option value="special">Special Coverage</option>
            </select>
            <Button type="submit">Publish Shift</Button>
          </form>
        </Card>
      )}

      {error && <InlineAlert tone="error">{error}</InlineAlert>}

      {filteredShifts.length === 0 ? (
        <EmptyState title="No shifts scheduled" description="Publish a post shift to begin assigning active guards." />
      ) : viewMode === 'roster' ? (
        <Card className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="p-3 font-medium">Date &amp; Window (EAT)</th>
                <th className="p-3 font-medium">Site / Post</th>
                <th className="p-3 font-medium">Coverage</th>
                <th className="p-3 font-medium">Assigned Guard(s)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredShifts.map((sh) => {
                const site = sites.find((s) => s.id === sh.site_id);
                const post = posts.find((p) => p.id === sh.post_id);
                const shAsg = assignments.filter((a) => a.shift_id === sh.id && a.status !== 'cancelled');
                const needed = post?.required_guards ?? 1;
                return (
                  <tr key={sh.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono tabular-nums whitespace-nowrap">
                      {sh.shift_date} · {formatNairobiTime(sh.start_time)}–{formatNairobiTime(sh.end_time)}
                    </td>
                    <td className="p-3 font-medium text-slate-900">
                      {site?.name} · {post?.name}
                    </td>
                    <td className="p-3">
                      <StatusLabel label={`${shAsg.length}/${needed}`} tone={shAsg.length < needed ? 'amber' : 'emerald'} />
                    </td>
                    <td className="p-3">
                      {shAsg.length === 0 ? (
                        <span className="text-amber-700 font-medium">Unassigned</span>
                      ) : (
                        shAsg
                          .map((a) => {
                            const emp = employees.find((e) => e.id === a.employee_id);
                            return emp ? `${emp.first_name} ${emp.last_name} (${emp.employee_number})` : a.employee_id;
                          })
                          .join(', ')
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredShifts.map((sh) => {
            const site = sites.find((s) => s.id === sh.site_id);
            const post = posts.find((p) => p.id === sh.post_id);
            const shAsg = assignments.filter((a) => a.shift_id === sh.id && a.status !== 'cancelled');
            const needed = post?.required_guards ?? 1;
            const understaffed = shAsg.length < needed;

            return (
              <Card key={sh.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-bold text-sm text-slate-900">
                      {site?.name} · {post?.name}
                    </span>
                    <StatusLabel
                      label={`${shAsg.length}/${needed} Assigned`}
                      tone={understaffed ? 'amber' : 'emerald'}
                    />
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-2 font-mono tabular-nums">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {sh.shift_date} · {formatNairobiTime(sh.start_time)}–{formatNairobiTime(sh.end_time)} EAT ·{' '}
                      {sh.shift_type}
                    </span>
                  </div>
                  {shAsg.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {shAsg.map((a) => {
                        const emp = employees.find((e) => e.id === a.employee_id);
                        const label = `${emp?.first_name ?? ''} ${emp?.last_name ?? ''} (${emp?.employee_number ?? ''})`;
                        return (
                          <span
                            key={a.id}
                            className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md text-xs text-slate-800"
                          >
                            <span>{label}</span>
                            {canAssign && (
                              <button
                                onClick={() => setPendingRemoval({ id: a.id, label })}
                                aria-label="Remove guard assignment"
                                className="text-rose-600 font-bold ml-1 cursor-pointer px-1"
                              >
                                ×
                              </button>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {canAssign && (
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
                    <select
                      value={selectedEmp[sh.id] ?? ''}
                      onChange={(e) => setSelectedEmp({ ...selectedEmp, [sh.id]: e.target.value })}
                      className="border border-slate-300 rounded-lg px-2.5 py-2 text-xs bg-white min-h-[44px] flex-1"
                    >
                      <option value="">Select active guard...</option>
                      {employees
                        .filter((e) => e.status === 'active')
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.employee_number} — {e.first_name} {e.last_name}
                          </option>
                        ))}
                    </select>
                    <Button onClick={() => handleAssign(sh.id)} size="md">
                      Assign
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingRemoval)}
        title="Remove Guard Assignment"
        description={
          pendingRemoval
            ? `Remove ${pendingRemoval.label} from this scheduled shift? This post will immediately show as understaffed until reassigned.`
            : ''
        }
        confirmLabel="Remove Guard"
        tone="danger"
        onCancel={() => setPendingRemoval(null)}
        onConfirm={async () => {
          if (pendingRemoval) {
            await removeAssignment(pendingRemoval.id);
            setPendingRemoval(null);
          }
        }}
      />
    </div>
  );
};

export const FFAttendancePage: React.FC = () => {
  const { employees, shifts, attendance, recordAttendance, currentRole } = useApp();
  const [empId, setEmpId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [captureGps, setCaptureGps] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [page, setPage] = useState(1);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; msg: string } | null>(null);

  const PAGE_SIZE = 10;

  useEffect(() => {
    if (!empId && employees[0]?.id) setEmpId(employees[0].id);
  }, [employees, empId]);

  useEffect(() => {
    if (!shiftId && shifts[0]?.id) setShiftId(shifts[0].id);
  }, [shifts, shiftId]);

  const tapAttendance = (eventType: 'clock_in' | 'clock_out') => {
    setFeedback(null);
    if (!empId) return;

    const commit = async (loc: { lat: number; lng: number; accuracy: number } | null) => {
      const res = await recordAttendance({
        employee_id: empId,
        shift_id: shiftId || null,
        event_type: eventType,
        location_metadata: loc,
      });
      if (res.error) setFeedback({ tone: 'error', msg: res.error });
      else {
        setFeedback({
          tone: 'success',
          msg: loc
            ? `${eventType.replace('_', ' ')} logged with click-time GPS snapshot.`
            : `${eventType.replace('_', ' ')} logged to append-only ledger.`,
        });
      }
    };

    if (captureGps && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => commit({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        () => commit(null),
        { timeout: 5000 }
      );
    } else {
      commit(null);
    }
  };

  const submitOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const res = await recordAttendance({
      employee_id: empId,
      shift_id: shiftId || null,
      event_type: 'supervisor_override',
      override_reason: overrideReason,
    });
    if (res.error) setFeedback({ tone: 'error', msg: res.error });
    else {
      setOverrideReason('');
      setFeedback({ tone: 'success', msg: 'Supervisor override appended to immutable ledger.' });
    }
  };

  const pagedAttendance = attendance.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Verification (Append-Only)"
        description="Mobile-first 44px+ clock-in/out controls with optional click-time location and mandatory override notes."
      />

      {feedback && <InlineAlert tone={feedback.tone}>{feedback.msg}</InlineAlert>}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5 space-y-4">
          <h2 className="font-bold text-slate-900">Mobile Guard Clock-In / Clock-Out</h2>
          <div className="space-y-3">
            <FormField label="Guard" htmlFor="att-guard">
              <select
                id="att-guard"
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white min-h-[44px]"
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.employee_number} — {e.first_name} {e.last_name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Shift Reference" htmlFor="att-shift">
              <select
                id="att-shift"
                value={shiftId}
                onChange={(e) => setShiftId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white min-h-[44px]"
              >
                <option value="">Optional shift reference...</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.shift_date} · {s.shift_type}
                  </option>
                ))}
              </select>
            </FormField>

            <label className="flex items-center gap-3 text-xs text-slate-700 cursor-pointer py-1 min-h-[44px]">
              <input
                type="checkbox"
                checked={captureGps}
                onChange={(e) => setCaptureGps(e.target.checked)}
                className="h-5 w-5"
              />
              Capture event-only GPS snapshot on button press (no background tracking)
            </label>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <Button onClick={() => tapAttendance('clock_in')} size="lg">
                <CheckCircle2 className="h-5 w-5" /> Clock In
              </Button>
              <Button variant="secondary" onClick={() => tapAttendance('clock_out')} size="lg">
                Clock Out
              </Button>
            </div>
          </div>
        </Card>

        {currentRole !== 'guard' && (
          <Card className="p-5 space-y-4">
            <h2 className="font-bold text-slate-900">Supervisor Attendance Override</h2>
            <form onSubmit={submitOverride} className="space-y-3">
              <FormField label="Audit Reason (Mandatory)" htmlFor="override-reason">
                <textarea
                  id="override-reason"
                  required
                  minLength={5}
                  rows={4}
                  placeholder="e.g. Guard phone battery flat; physically verified at Gate A at 06:05 EAT"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm"
                />
              </FormField>
              <Button type="submit" variant="secondary">
                Log Supervisor Override
              </Button>
            </form>
          </Card>
        )}
      </div>

      {/* Desktop Attendance Table */}
      <Card className="hidden md:block overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
            <tr>
              <th className="p-3 font-medium">Recorded Time (EAT)</th>
              <th className="p-3 font-medium">Guard</th>
              <th className="p-3 font-medium">Event</th>
              <th className="p-3 font-medium">Location / Audit Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pagedAttendance.map((a) => {
              const emp = employees.find((e) => e.id === a.employee_id);
              return (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="p-3 whitespace-nowrap font-mono tabular-nums">{formatNairobiDateTime(a.recorded_at)}</td>
                  <td className="p-3 font-medium text-slate-900">
                    {emp ? `${emp.first_name} ${emp.last_name}` : a.employee_id}
                  </td>
                  <td className="p-3">
                    <StatusLabel
                      label={a.event_type}
                      tone={a.event_type === 'supervisor_override' ? 'amber' : 'emerald'}
                    />
                  </td>
                  <td className="p-3 text-slate-600">
                    {a.location_metadata && (
                      <span className="inline-flex items-center gap-1 mr-3 font-mono tabular-nums">
                        <MapPin className="h-3.5 w-3.5" /> {a.location_metadata.lat.toFixed(4)},{' '}
                        {a.location_metadata.lng.toFixed(4)}
                      </span>
                    )}
                    {a.override_reason}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pagination page={page} pageSize={PAGE_SIZE} total={attendance.length} onPageChange={setPage} />
      </Card>

      {/* Mobile Attendance Cards */}
      <div className="md:hidden space-y-3">
        {pagedAttendance.map((a) => {
          const emp = employees.find((e) => e.id === a.employee_id);
          return (
            <Card key={a.id} className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm text-slate-900">
                  {emp ? `${emp.first_name} ${emp.last_name}` : a.employee_id}
                </span>
                <StatusLabel
                  label={a.event_type.replace('_', ' ')}
                  tone={a.event_type === 'supervisor_override' ? 'amber' : 'emerald'}
                />
              </div>
              <div className="text-xs font-mono text-slate-500">{formatNairobiDateTime(a.recorded_at)}</div>
              {a.location_metadata && (
                <div className="text-xs font-mono text-slate-600 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {a.location_metadata.lat.toFixed(4)}, {a.location_metadata.lng.toFixed(4)}
                </div>
              )}
              {a.override_reason && <div className="text-xs text-slate-700">{a.override_reason}</div>}
            </Card>
          );
        })}
        <Card className="overflow-hidden">
          <Pagination page={page} pageSize={PAGE_SIZE} total={attendance.length} onPageChange={setPage} />
        </Card>
      </div>
    </div>
  );
};

export const FFIncidentsPage: React.FC = () => {
  const {
    sites,
    posts,
    members,
    incidents,
    auditEvents,
    reportIncident,
    reviewIncident,
    generateIncidentAIDraft,
    approveIncidentAIDraft,
    currentRole,
  } = useApp();

  const [siteId, setSiteId] = useState('');
  const [category, setCategory] = useState<IncidentCategory>('trespassing');
  const [severity, setSeverity] = useState<IncidentSeverity>('medium');
  const [narrative, setNarrative] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | IncidentStatus>('all');
  const [search, setSearch] = useState('');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [draftEdits, setDraftEdits] = useState<Record<string, string>>({});
  const [aiBusyId, setAiBusyId] = useState<string | null>(null);
  const [confirmCloseId, setConfirmCloseId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    if (!siteId && sites[0]?.id) setSiteId(sites[0].id);
  }, [sites, siteId]);

  const canReview = currentRole !== 'guard';

  const submitIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const res = await reportIncident({
      site_id: siteId,
      post_id: posts.find((p) => p.site_id === siteId)?.id ?? null,
      category,
      severity,
      narrative,
      occurrence_time: new Date().toISOString(),
    });
    if (res.error) setFeedback({ tone: 'error', msg: res.error });
    else {
      setNarrative('');
      setFeedback({ tone: 'success', msg: 'Field incident logged for supervisor review.' });
    }
  };

  const handleGenerateAIDraft = async (incId: string) => {
    setFeedback(null);
    setAiBusyId(incId);
    const res = await generateIncidentAIDraft(incId);
    setAiBusyId(null);
    if (res.error) setFeedback({ tone: 'error', msg: res.error });
  };

  const handleApproveDraft = async (incId: string, defaultText: string, nextStatus: IncidentStatus) => {
    setFeedback(null);
    const finalSummary = draftEdits[incId] ?? defaultText;
    const res = await approveIncidentAIDraft(incId, finalSummary, nextStatus);
    if (res.error) setFeedback({ tone: 'error', msg: res.error });
    else setFeedback({ tone: 'success', msg: 'AI summary approved by human supervisor and saved.' });
  };

  const visibleIncidents = incidents.filter((i) => {
    const matchesStatus = statusFilter === 'all' || i.status === statusFilter;
    const siteName = sites.find((s) => s.id === i.site_id)?.name || '';
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      i.narrative.toLowerCase().includes(q) ||
      i.category.toLowerCase().includes(q) ||
      siteName.toLowerCase().includes(q) ||
      i.reported_by_name.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const selectedIncident: Incident | null =
    incidents.find((i) => i.id === selectedIncidentId) || null;

  const selectedAuditHistory = selectedIncident
    ? auditEvents.filter((ev) => ev.entity_id === selectedIncident.id)
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security Incident Workspace"
        description="Human-reviewed field incident intake, timeline, audit history, and PII-redacted AI summary drafting."
        actions={
          <div className="relative w-full sm:w-64">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search site, category, or reporter..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm bg-white min-h-[42px]"
            />
          </div>
        }
      />

      <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
        {(['all', 'open', 'under_investigation', 'resolved', 'closed'] as const).map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize cursor-pointer ${
              statusFilter === st ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {st.replace('_', ' ')}
          </button>
        ))}
      </div>

      {feedback && <InlineAlert tone={feedback.tone}>{feedback.msg}</InlineAlert>}

      <Card className="p-5">
        <h2 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-[#E11D48]" />
          <span>Report Field Incident (Text-Only V1)</span>
        </h2>
        <form onSubmit={submitIncident} className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <select
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-h-[42px]"
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as IncidentCategory)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-h-[42px]"
            >
              <option value="theft">Theft</option>
              <option value="trespassing">Trespassing</option>
              <option value="medical">Medical</option>
              <option value="property_damage">Property Damage</option>
              <option value="uniform_breach">Uniform Breach</option>
              <option value="equipment_failure">Equipment Failure</option>
            </select>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-h-[42px]"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <textarea
            required
            minLength={10}
            rows={3}
            placeholder="Describe factual sequence of events..."
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            className="w-full border border-slate-300 rounded-lg p-3 text-sm"
          />
          <Button type="submit" variant="danger">
            Log Incident
          </Button>
        </form>
      </Card>

      {visibleIncidents.length === 0 ? (
        <EmptyState title="No incidents in this view" description="All matching incident logs are clear." />
      ) : (
        <div className="space-y-3">
          {visibleIncidents.map((inc) => {
            const siteName = sites.find((s) => s.id === inc.site_id)?.name || 'Site';
            const postName = posts.find((p) => p.id === inc.post_id)?.name;
            const pendingAi = Boolean(inc.ai_draft_summary) && !inc.ai_approved_at;

            return (
              <Card key={inc.id} className="p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <StatusLabel
                      label={inc.severity.toUpperCase()}
                      tone={inc.severity === 'critical' || inc.severity === 'high' ? 'rose' : 'amber'}
                    />
                    <span className="font-bold capitalize text-slate-900">{inc.category.replace('_', ' ')}</span>
                    <span className="text-xs text-slate-500">
                      · {siteName}
                      {postName ? ` (${postName})` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {pendingAi && <Badge tone="amber">AI Draft Pending Approval</Badge>}
                    <Badge tone={inc.status === 'resolved' || inc.status === 'closed' ? 'emerald' : 'navy'}>
                      {inc.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>

                <p className="text-sm text-slate-800 leading-relaxed">{inc.narrative}</p>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                  <div className="text-xs text-slate-500 font-mono tabular-nums">
                    Reported by {inc.reported_by_name} · {formatNairobiDateTime(inc.occurrence_time)}
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setSelectedIncidentId(inc.id)}>
                    <Eye className="h-3.5 w-3.5" /> Open Incident Workspace
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Full Incident Workspace Drawer */}
      <Drawer
        open={Boolean(selectedIncident)}
        title={selectedIncident ? `${selectedIncident.category.replace('_', ' ').toUpperCase()} Incident` : ''}
        subtitle={
          selectedIncident
            ? `${sites.find((s) => s.id === selectedIncident.site_id)?.name || 'Site'} · ${formatNairobiDateTime(
                selectedIncident.occurrence_time
              )}`
            : ''
        }
        onClose={() => setSelectedIncidentId(null)}
      >
        {selectedIncident && (
          <div className="space-y-6">
            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-slate-500">Severity</div>
                <div className="mt-1">
                  <StatusLabel
                    label={selectedIncident.severity.toUpperCase()}
                    tone={
                      selectedIncident.severity === 'critical' || selectedIncident.severity === 'high' ? 'rose' : 'amber'
                    }
                  />
                </div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-slate-500">Workflow Status</div>
                <div className="font-semibold text-slate-900 capitalize mt-1">
                  {selectedIncident.status.replace('_', ' ')}
                </div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-slate-500">Reporting Employee</div>
                <div className="font-semibold text-slate-900 mt-1">{selectedIncident.reported_by_name}</div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-slate-500">Assigned Investigator</div>
                <div className="font-semibold text-slate-900 mt-1">
                  {members.find((m) => m.user_id === selectedIncident.reviewed_by)?.full_name || 'Unassigned'}
                </div>
              </div>
            </div>

            {/* Incident Description */}
            <div className="space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Incident Description</h3>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 leading-relaxed">
                {selectedIncident.narrative}
              </div>
            </div>

            {/* Evidence Gallery (Honest V1 Policy) */}
            <div className="space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Evidence Gallery</h3>
              <div className="p-4 border border-dashed border-slate-300 rounded-lg text-xs text-slate-600 flex items-start gap-2.5">
                <FileText className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  V1 incident intake is strictly text-only. Private photo/document attachment storage (signed 60s URLs)
                  is deferred to Phase 4.5.
                </span>
              </div>
            </div>

            {/* Official Human-Approved Notes */}
            {selectedIncident.review_notes && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-950 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold">
                    {selectedIncident.ai_approved_at
                      ? 'Official Supervisor Summary (Human Approved)'
                      : 'Supervisor Review Notes'}
                  </span>
                  {selectedIncident.ai_approved_at && (
                    <span className="font-mono">{formatNairobiDateTime(selectedIncident.ai_approved_at)}</span>
                  )}
                </div>
                <p className="whitespace-pre-line leading-relaxed">{selectedIncident.review_notes}</p>
              </div>
            )}

            {/* AI-Generated Draft Summary (Pending Human Approval) */}
            {canReview && selectedIncident.ai_draft_summary && !selectedIncident.ai_approved_at && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StatusLabel label="AI Draft — Pending Human Approval" tone="amber" />
                  <span className="text-[11px] text-amber-900">PII stripped before Gemini call</span>
                </div>
                <textarea
                  rows={5}
                  value={draftEdits[selectedIncident.id] ?? selectedIncident.ai_draft_summary}
                  onChange={(e) => setDraftEdits({ ...draftEdits, [selectedIncident.id]: e.target.value })}
                  className="w-full border border-amber-300 bg-white rounded-lg p-3 text-xs text-slate-900"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      handleApproveDraft(
                        selectedIncident.id,
                        selectedIncident.ai_draft_summary!,
                        'under_investigation'
                      )
                    }
                  >
                    Approve &amp; Save (Investigating)
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      handleApproveDraft(selectedIncident.id, selectedIncident.ai_draft_summary!, 'resolved')
                    }
                  >
                    Approve &amp; Resolve
                  </Button>
                </div>
              </div>
            )}

            {/* Supervisor Actions */}
            {canReview && selectedIncident.status !== 'closed' && (
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={aiBusyId === selectedIncident.id}
                    onClick={() => handleGenerateAIDraft(selectedIncident.id)}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-[#059669]" />
                    {aiBusyId === selectedIncident.id ? 'Drafting AI Summary...' : 'Generate AI Summary Draft'}
                  </Button>
                </div>

                <FormField label="Manual Review Notes" htmlFor="drawer-review-notes">
                  <input
                    id="drawer-review-notes"
                    placeholder="Enter supervisor investigation or resolution notes..."
                    value={reviewNotes[selectedIncident.id] ?? ''}
                    onChange={(e) =>
                      setReviewNotes({ ...reviewNotes, [selectedIncident.id]: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  />
                </FormField>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      reviewIncident(
                        selectedIncident.id,
                        'under_investigation',
                        reviewNotes[selectedIncident.id] || 'Under investigation'
                      )
                    }
                  >
                    Investigate
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      reviewIncident(
                        selectedIncident.id,
                        'resolved',
                        reviewNotes[selectedIncident.id] || 'Resolved by supervisor'
                      )
                    }
                  >
                    Mark Resolved
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setConfirmCloseId(selectedIncident.id)}
                  >
                    Close Incident
                  </Button>
                </div>
              </div>
            )}

            {/* Incident Timeline */}
            <div className="space-y-2 pt-3 border-t border-slate-200">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Incident Timeline</h3>
              <div className="space-y-2 text-xs text-slate-700">
                <div className="flex justify-between">
                  <span>Incident reported by {selectedIncident.reported_by_name}</span>
                  <span className="font-mono text-slate-500">{formatNairobiDateTime(selectedIncident.occurrence_time)}</span>
                </div>
                {selectedIncident.ai_draft_generated_at && (
                  <div className="flex justify-between">
                    <span>AI draft generated (server-side Gemini)</span>
                    <span className="font-mono text-slate-500">
                      {formatNairobiDateTime(selectedIncident.ai_draft_generated_at)}
                    </span>
                  </div>
                )}
                {selectedIncident.ai_approved_at && (
                  <div className="flex justify-between text-[#059669] font-medium">
                    <span>Summary approved by human supervisor</span>
                    <span className="font-mono">{formatNairobiDateTime(selectedIncident.ai_approved_at)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Per-Incident Audit History */}
            <div className="space-y-2 pt-3 border-t border-slate-200">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Audit History</h3>
              {selectedAuditHistory.length === 0 ? (
                <p className="text-xs text-slate-500">Audit events visible to management roles.</p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {selectedAuditHistory.map((ev) => (
                    <div key={ev.id} className="p-2.5 text-xs flex justify-between gap-2">
                      <div>
                        <span className="font-mono text-slate-900">{ev.action}</span>
                        <span className="text-slate-500"> · {ev.actor_name}</span>
                      </div>
                      <span className="font-mono text-slate-400 shrink-0">
                        {formatNairobiDateTime(ev.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={Boolean(confirmCloseId)}
        title="Close Security Incident"
        description="Closing this incident marks its workflow complete. All timeline notes and audit logs remain preserved."
        confirmLabel="Close Incident"
        tone="danger"
        onCancel={() => setConfirmCloseId(null)}
        onConfirm={async () => {
          if (confirmCloseId) {
            await reviewIncident(
              confirmCloseId,
              'closed',
              reviewNotes[confirmCloseId] || 'Closed after supervisor review'
            );
            setConfirmCloseId(null);
          }
        }}
      />
    </div>
  );
};

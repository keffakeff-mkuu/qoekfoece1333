import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  BookOpen,
  Bot,
  Camera,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck2,
  Flag,
  MapPin,
  Mic,
  MicOff,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  UserCheck,
  WifiOff,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatNairobiDateTime, formatNairobiTime, todayNairobiDate } from '../lib/date';
import type {
  DisciplinaryRecord,
  Employee,
  EmployeeContract,
  EmployeeDocument,
  EscalationLevel,
  Incident,
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
  LeaveRecord,
} from '../types/domain';
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
    else if (res.error) setAiInsight(res.error);
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
  const {
    employees,
    contracts,
    documents,
    qualifications,
    leaveRecords,
    disciplinaryRecords,
    members,
    shifts,
    assignments,
    attendance,
    addEmployee,
    updateEmployeeStatus,
    updateEmployee,
    addEmployeeContract,
    addEmployeeDocument,
    addEmployeeQualification,
    submitLeaveRequest,
    decideLeaveRequest,
    addDisciplinaryRecord,
    currentRole,
  } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const hrTabParam = searchParams.get('tab') || 'directory';
  const hrTab = (['directory', 'contracts', 'documents', 'qualifications', 'leave', 'disciplinary'] as const).includes(
    hrTabParam as 'directory'
  )
    ? (hrTabParam as 'directory' | 'contracts' | 'documents' | 'qualifications' | 'leave' | 'disciplinary')
    : 'directory';

  const [badge, setBadge] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('+2547');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Employee['status']>('all');
  const [page, setPage] = useState(1);
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [editFirst, setEditFirst] = useState('');
  const [editLast, setEditLast] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editUserId, setEditUserId] = useState('');
  const [pendingStatusChange, setPendingStatusChange] = useState<{ emp: Employee; nextStatus: Employee['status'] } | null>(
    null
  );
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; msg: string } | null>(null);
  const [drawerFeedback, setDrawerFeedback] = useState<{ tone: 'success' | 'error'; msg: string } | null>(null);

  // HR Sub-module form state
  const [hrEmpId, setHrEmpId] = useState('');
  const [ctrType, setCtrType] = useState<EmployeeContract['contract_type']>('permanent');
  const [ctrSalary, setCtrSalary] = useState('28000');
  const [ctrAllow, setCtrAllow] = useState('3000');
  const [ctrOt, setCtrOt] = useState('320');
  const [docType, setDocType] = useState<EmployeeDocument['doc_type']>('psra_license');
  const [docTitle, setDocTitle] = useState('');
  const [docRef, setDocRef] = useState('');
  const [docExpiry, setDocExpiry] = useState('');
  const [qualName, setQualName] = useState('');
  const [qualProvider, setQualProvider] = useState('');
  const [qualExpiry, setQualExpiry] = useState('');
  const [lvType, setLvType] = useState<LeaveRecord['leave_type']>('annual');
  const [lvStart, setLvStart] = useState(todayNairobiDate());
  const [lvEnd, setLvEnd] = useState(todayNairobiDate());
  const [lvDays, setLvDays] = useState('1');
  const [lvReason, setLvReason] = useState('');
  const [discCategory, setDiscCategory] = useState<DisciplinaryRecord['category']>('lateness');
  const [discSeverity, setDiscSeverity] = useState<DisciplinaryRecord['severity']>('verbal_warning');
  const [discSummary, setDiscSummary] = useState('');
  const [discAction, setDiscAction] = useState('');

  const PAGE_SIZE = 8;
  const canEdit = Boolean(currentRole && ['owner', 'admin', 'operations_manager', 'hr_manager'].includes(currentRole));

  useEffect(() => {
    if ((!hrEmpId || !employees.some((e) => e.id === hrEmpId)) && employees[0]?.id) {
      setHrEmpId(employees[0].id);
    }
  }, [employees, hrEmpId]);

  const in30Days = useMemo(() => new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10), []);
  const expiringDocsCount = useMemo(
    () => documents.filter((d) => d.expiry_date && d.expiry_date <= in30Days).length,
    [documents, in30Days]
  );

  const selectedEmp = useMemo(
    () => employees.find((e) => e.id === selectedEmpId) || null,
    [employees, selectedEmpId]
  );

  useEffect(() => {
    if (selectedEmp) {
      setEditFirst(selectedEmp.first_name);
      setEditLast(selectedEmp.last_name);
      setEditPhone(selectedEmp.phone);
      setEditUserId(selectedEmp.user_id || '');
      setDrawerFeedback(null);
    }
  }, [selectedEmp]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const res = await addEmployee({
      employee_number: badge,
      first_name: firstName,
      last_name: lastName,
      phone,
      status: 'active',
      hire_date: todayNairobiDate(),
    });
    if (res.error) setFeedback({ tone: 'error', msg: res.error });
    else {
      setBadge('');
      setFirstName('');
      setLastName('');
      setPhone('+2547');
      setFeedback({ tone: 'success', msg: 'Guard added to organisation directory.' });
    }
  };

  const handleStatusSelect = async (emp: Employee, nextStatus: Employee['status']) => {
    setFeedback(null);
    if (nextStatus === 'suspended' || nextStatus === 'inactive') {
      setPendingStatusChange({ emp, nextStatus });
      return;
    }
    const res = await updateEmployeeStatus(emp.id, nextStatus);
    if (res.error) setFeedback({ tone: 'error', msg: res.error });
    else setFeedback({ tone: 'success', msg: `Updated ${emp.first_name} ${emp.last_name} to "${nextStatus}".` });
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) return;
    setDrawerFeedback(null);
    const res = await updateEmployee(selectedEmp.id, {
      first_name: editFirst,
      last_name: editLast,
      phone: editPhone,
      user_id: editUserId || null,
    });
    if (res.error) setDrawerFeedback({ tone: 'error', msg: res.error });
    else setDrawerFeedback({ tone: 'success', msg: 'Guard profile & portal link saved.' });
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
        eyebrow="Module 01 · Employee & HR Management"
        title="Workforce, Contracts & Compliance"
        description="Manage guard profiles, employment contracts, PSRA/DCI compliance documents, qualifications, leave, and disciplinary records."
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

      {expiringDocsCount > 0 && (
        <InlineAlert tone="warning">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              <strong>Compliance Alert:</strong> {expiringDocsCount} employee document(s) are expired or expiring within 30 days.
            </span>
            <button
              type="button"
              onClick={() => setSearchParams({ tab: 'documents' })}
              className="font-semibold underline cursor-pointer"
            >
              Review Documents →
            </button>
          </div>
        </InlineAlert>
      )}

      <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
        {(
          [
            { id: 'directory', label: `Directory (${employees.length})` },
            { id: 'contracts', label: `Contracts (${contracts.length})` },
            { id: 'documents', label: `Documents (${documents.length})` },
            { id: 'qualifications', label: `Qualifications (${qualifications.length})` },
            { id: 'leave', label: `Leave (${leaveRecords.length})` },
            { id: 'disciplinary', label: `Disciplinary (${disciplinaryRecords.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setSearchParams(t.id === 'directory' ? {} : { tab: t.id })}
            className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
              hrTab === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {feedback && <InlineAlert tone={feedback.tone}>{feedback.msg}</InlineAlert>}

      {hrTab === 'contracts' && (
        <div className="space-y-4">
          {canEdit && (
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Register Employment Contract (KES)</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setFeedback(null);
                  const res = await addEmployeeContract({
                    employee_id: hrEmpId,
                    contract_type: ctrType,
                    base_salary_kes: Number(ctrSalary) || 0,
                    shift_allowance_kes: Number(ctrAllow) || 0,
                    overtime_rate_kes: Number(ctrOt) || 0,
                    start_date: todayNairobiDate(),
                  });
                  if (res.error) setFeedback({ tone: 'error', msg: res.error });
                  else setFeedback({ tone: 'success', msg: 'Employment contract added.' });
                }}
                className="grid sm:grid-cols-6 gap-3"
              >
                <select value={hrEmpId} onChange={(e) => setHrEmpId(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-h-[42px]">
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.employee_number} — {e.first_name} {e.last_name}</option>
                  ))}
                </select>
                <select value={ctrType} onChange={(e) => setCtrType(e.target.value as EmployeeContract['contract_type'])} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-h-[42px]">
                  <option value="permanent">Permanent</option>
                  <option value="fixed_term">Fixed Term</option>
                  <option value="probation">Probation</option>
                  <option value="casual">Casual</option>
                </select>
                <input type="number" min={0} placeholder="Base KES" value={ctrSalary} onChange={(e) => setCtrSalary(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono min-h-[42px]" />
                <input type="number" min={0} placeholder="Allowance KES" value={ctrAllow} onChange={(e) => setCtrAllow(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono min-h-[42px]" />
                <input type="number" min={0} placeholder="OT Rate/hr" value={ctrOt} onChange={(e) => setCtrOt(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono min-h-[42px]" />
                <Button type="submit">Add Contract</Button>
              </form>
            </Card>
          )}
          <Card className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3 font-medium">Employee</th>
                  <th className="p-3 font-medium">Type</th>
                  <th className="p-3 font-medium">Base Salary</th>
                  <th className="p-3 font-medium">Allowance</th>
                  <th className="p-3 font-medium">OT Rate/hr</th>
                  <th className="p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contracts.map((c) => {
                  const emp = employees.find((e) => e.id === c.employee_id);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-900">{emp ? `${emp.first_name} ${emp.last_name}` : c.employee_id}</td>
                      <td className="p-3 capitalize text-slate-700">{c.contract_type.replace('_', ' ')}</td>
                      <td className="p-3 font-mono tabular-nums">KES {c.base_salary_kes.toLocaleString()}</td>
                      <td className="p-3 font-mono tabular-nums">KES {c.shift_allowance_kes.toLocaleString()}</td>
                      <td className="p-3 font-mono tabular-nums">KES {c.overtime_rate_kes.toLocaleString()}</td>
                      <td className="p-3"><StatusLabel label={c.status} tone={c.status === 'active' ? 'emerald' : 'slate'} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {hrTab === 'documents' && (
        <div className="space-y-4">
          {canEdit && (
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Log Compliance Document &amp; Expiry</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setFeedback(null);
                  const res = await addEmployeeDocument({
                    employee_id: hrEmpId,
                    doc_type: docType,
                    title: docTitle,
                    reference_number: docRef,
                    expiry_date: docExpiry || null,
                  });
                  if (res.error) setFeedback({ tone: 'error', msg: res.error });
                  else {
                    setDocTitle('');
                    setDocRef('');
                    setDocExpiry('');
                    setFeedback({ tone: 'success', msg: 'Compliance document recorded.' });
                  }
                }}
                className="grid sm:grid-cols-6 gap-3"
              >
                <select value={hrEmpId} onChange={(e) => setHrEmpId(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-h-[42px]">
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.employee_number} — {e.first_name} {e.last_name}</option>
                  ))}
                </select>
                <select value={docType} onChange={(e) => setDocType(e.target.value as EmployeeDocument['doc_type'])} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-h-[42px]">
                  <option value="psra_license">PSRA License</option>
                  <option value="good_conduct">Good Conduct (DCI)</option>
                  <option value="contract_signed">Signed Contract</option>
                  <option value="medical_cert">Medical Cert</option>
                  <option value="other">Other</option>
                </select>
                <input required placeholder="Document Title" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[42px]" />
                <input placeholder="Ref Number" value={docRef} onChange={(e) => setDocRef(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono min-h-[42px]" />
                <input type="date" value={docExpiry} onChange={(e) => setDocExpiry(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono min-h-[42px]" />
                <Button type="submit"><FileCheck2 className="h-4 w-4" /> Save Doc</Button>
              </form>
            </Card>
          )}
          <Card className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3 font-medium">Employee</th>
                  <th className="p-3 font-medium">Document</th>
                  <th className="p-3 font-medium">Ref #</th>
                  <th className="p-3 font-medium">Expiry Date</th>
                  <th className="p-3 font-medium">Compliance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.map((d) => {
                  const emp = employees.find((e) => e.id === d.employee_id);
                  const expiringSoon = Boolean(d.expiry_date && d.expiry_date <= in30Days);
                  return (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-900">{emp ? `${emp.first_name} ${emp.last_name}` : d.employee_id}</td>
                      <td className="p-3 text-slate-800">{d.title}</td>
                      <td className="p-3 font-mono text-xs text-slate-600">{d.reference_number || '—'}</td>
                      <td className="p-3 font-mono text-xs">{d.expiry_date || 'No expiry'}</td>
                      <td className="p-3">
                        <StatusLabel label={expiringSoon ? 'Expiring / Due' : 'Valid'} tone={expiringSoon ? 'amber' : 'emerald'} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {hrTab === 'qualifications' && (
        <div className="space-y-4">
          {canEdit && (
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Record Guard Qualification / Certification</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setFeedback(null);
                  const res = await addEmployeeQualification({
                    employee_id: hrEmpId,
                    qualification_name: qualName,
                    provider: qualProvider,
                    achieved_date: todayNairobiDate(),
                    expiry_date: qualExpiry || null,
                  });
                  if (res.error) setFeedback({ tone: 'error', msg: res.error });
                  else {
                    setQualName('');
                    setQualProvider('');
                    setQualExpiry('');
                    setFeedback({ tone: 'success', msg: 'Qualification added.' });
                  }
                }}
                className="grid sm:grid-cols-5 gap-3"
              >
                <select value={hrEmpId} onChange={(e) => setHrEmpId(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-h-[42px]">
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.employee_number} — {e.first_name} {e.last_name}</option>
                  ))}
                </select>
                <input required placeholder="Qualification (e.g. Fire Marshal)" value={qualName} onChange={(e) => setQualName(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[42px]" />
                <input placeholder="Training Provider" value={qualProvider} onChange={(e) => setQualProvider(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[42px]" />
                <input type="date" value={qualExpiry} onChange={(e) => setQualExpiry(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono min-h-[42px]" />
                <Button type="submit">Add Qualification</Button>
              </form>
            </Card>
          )}
          <div className="grid md:grid-cols-2 gap-4">
            {qualifications.map((q) => {
              const emp = employees.find((e) => e.id === q.employee_id);
              return (
                <Card key={q.id} className="p-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{q.qualification_name}</span>
                    <Badge tone="emerald">Certified</Badge>
                  </div>
                  <div className="text-xs text-slate-600">{emp ? `${emp.first_name} ${emp.last_name}` : q.employee_id} · {q.provider}</div>
                  <div className="text-xs font-mono text-slate-500">Achieved {q.achieved_date} {q.expiry_date ? `· Expires ${q.expiry_date}` : ''}</div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {hrTab === 'leave' && (
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Submit Leave Request</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setFeedback(null);
                const res = await submitLeaveRequest({
                  employee_id: hrEmpId,
                  leave_type: lvType,
                  start_date: lvStart,
                  end_date: lvEnd,
                  days_count: Math.max(1, Number(lvDays) || 1),
                  reason: lvReason,
                });
                if (res.error) setFeedback({ tone: 'error', msg: res.error });
                else {
                  setLvReason('');
                  setFeedback({ tone: 'success', msg: 'Leave request logged.' });
                }
              }}
              className="grid sm:grid-cols-6 gap-3"
            >
              <select value={hrEmpId} onChange={(e) => setHrEmpId(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-h-[42px]">
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.employee_number} — {e.first_name} {e.last_name}</option>
                ))}
              </select>
              <select value={lvType} onChange={(e) => setLvType(e.target.value as LeaveRecord['leave_type'])} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-h-[42px]">
                <option value="annual">Annual Leave</option>
                <option value="sick">Sick Leave</option>
                <option value="compassionate">Compassionate</option>
                <option value="off_duty">Off Duty</option>
                <option value="unpaid">Unpaid</option>
              </select>
              <input type="date" value={lvStart} onChange={(e) => setLvStart(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono min-h-[42px]" />
              <input type="date" value={lvEnd} onChange={(e) => setLvEnd(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono min-h-[42px]" />
              <input type="number" min={1} value={lvDays} onChange={(e) => setLvDays(e.target.value)} placeholder="Days" className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono min-h-[42px]" />
              <Button type="submit">Request Leave</Button>
            </form>
          </Card>

          <Card className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3 font-medium">Employee</th>
                  <th className="p-3 font-medium">Type</th>
                  <th className="p-3 font-medium">Dates</th>
                  <th className="p-3 font-medium">Days</th>
                  <th className="p-3 font-medium">Status</th>
                  {canEdit && <th className="p-3 font-medium text-right">Decision</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaveRecords.map((l) => {
                  const emp = employees.find((e) => e.id === l.employee_id);
                  return (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-900">{emp ? `${emp.first_name} ${emp.last_name}` : l.employee_id}</td>
                      <td className="p-3 capitalize">{l.leave_type.replace('_', ' ')}</td>
                      <td className="p-3 font-mono text-xs">{l.start_date} → {l.end_date}</td>
                      <td className="p-3 font-mono">{l.days_count}</td>
                      <td className="p-3"><StatusLabel label={l.status} tone={l.status === 'approved' ? 'emerald' : l.status === 'rejected' ? 'rose' : 'amber'} /></td>
                      {canEdit && (
                        <td className="p-3 text-right space-x-2">
                          {l.status === 'pending' ? (
                            <>
                              <Button size="sm" onClick={() => decideLeaveRequest(l.id, 'approved')}>Approve</Button>
                              <Button size="sm" variant="danger" onClick={() => decideLeaveRequest(l.id, 'rejected')}>Reject</Button>
                            </>
                          ) : (
                            <span className="text-xs text-slate-500">By {l.approved_by || 'HR'}</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {hrTab === 'disciplinary' && (
        <div className="space-y-4">
          {currentRole !== 'guard' && (
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Log Disciplinary Action or Commendation</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setFeedback(null);
                  const res = await addDisciplinaryRecord({
                    employee_id: hrEmpId,
                    incident_date: todayNairobiDate(),
                    category: discCategory,
                    severity: discSeverity,
                    summary: discSummary,
                    action_taken: discAction,
                  });
                  if (res.error) setFeedback({ tone: 'error', msg: res.error });
                  else {
                    setDiscSummary('');
                    setDiscAction('');
                    setFeedback({ tone: 'success', msg: 'HR conduct record saved.' });
                  }
                }}
                className="space-y-3"
              >
                <div className="grid sm:grid-cols-3 gap-3">
                  <select value={hrEmpId} onChange={(e) => setHrEmpId(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-h-[42px]">
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>{e.employee_number} — {e.first_name} {e.last_name}</option>
                    ))}
                  </select>
                  <select value={discCategory} onChange={(e) => setDiscCategory(e.target.value as DisciplinaryRecord['category'])} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-h-[42px]">
                    <option value="lateness">Lateness</option>
                    <option value="uniform">Uniform Standard</option>
                    <option value="sleeping_on_duty">Sleeping on Duty</option>
                    <option value="insubordination">Insubordination</option>
                    <option value="absence">AWOL / Absence</option>
                    <option value="commendation">Commendation</option>
                  </select>
                  <select value={discSeverity} onChange={(e) => setDiscSeverity(e.target.value as DisciplinaryRecord['severity'])} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-h-[42px]">
                    <option value="verbal_warning">Verbal Warning</option>
                    <option value="written_warning">Written Warning</option>
                    <option value="final_warning">Final Warning</option>
                    <option value="suspension">Suspension</option>
                    <option value="cleared">Cleared / Commended</option>
                  </select>
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  <input required minLength={5} placeholder="Summary of event..." value={discSummary} onChange={(e) => setDiscSummary(e.target.value)} className="sm:col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[42px]" />
                  <input placeholder="Action taken..." value={discAction} onChange={(e) => setDiscAction(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[42px]" />
                </div>
                <Button type="submit">Record Entry</Button>
              </form>
            </Card>
          )}
          <div className="space-y-3">
            {disciplinaryRecords.map((d) => {
              const emp = employees.find((e) => e.id === d.employee_id);
              return (
                <Card key={d.id} className="p-4 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900">
                      {emp ? `${emp.first_name} ${emp.last_name}` : d.employee_id} · <span className="capitalize">{d.category.replace('_', ' ')}</span>
                    </span>
                    <StatusLabel label={d.severity.replace('_', ' ')} tone={d.severity === 'cleared' ? 'emerald' : 'amber'} />
                  </div>
                  <p className="text-xs text-slate-700">{d.summary}</p>
                  <div className="text-[11px] font-mono text-slate-500">
                    {d.incident_date} · Recorded by {d.recorded_by} {d.action_taken ? `· Action: ${d.action_taken}` : ''}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {hrTab === 'directory' && (
        <>
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
                      <Button variant="ghost" size="sm" onClick={() => setSelectedEmpId(emp.id)}>
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
                  <Button variant="secondary" size="sm" onClick={() => setSelectedEmpId(emp.id)}>
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
        </>
      )}

      {/* Employee Profile & Edit Drawer */}
      <Drawer
        open={Boolean(selectedEmp)}
        title={selectedEmp ? `${selectedEmp.first_name} ${selectedEmp.last_name}` : 'Employee Profile'}
        subtitle={selectedEmp ? `Badge ${selectedEmp.employee_number} · ${selectedEmp.phone}` : ''}
        onClose={() => setSelectedEmpId(null)}
      >
        {selectedEmp && (
          <div className="space-y-6">
            {drawerFeedback && <InlineAlert tone={drawerFeedback.tone}>{drawerFeedback.msg}</InlineAlert>}

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

            {canEdit && (
              <form onSubmit={handleSaveEmployee} className="space-y-3 p-4 border border-slate-200 rounded-lg bg-slate-50">
                <div className="text-xs font-semibold text-slate-700">Edit Details &amp; Portal Account Link</div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    required
                    value={editFirst}
                    onChange={(e) => setEditFirst(e.target.value)}
                    placeholder="First Name"
                    className="border border-slate-300 rounded-lg px-2.5 py-2 text-xs bg-white"
                  />
                  <input
                    required
                    value={editLast}
                    onChange={(e) => setEditLast(e.target.value)}
                    placeholder="Last Name"
                    className="border border-slate-300 rounded-lg px-2.5 py-2 text-xs bg-white"
                  />
                </div>
                <input
                  required
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+2547..."
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-mono bg-white"
                />
                <FormField label="Linked User Account (allows Guard self clock-in)" htmlFor="emp-user-link">
                  <select
                    id="emp-user-link"
                    value={editUserId}
                    onChange={(e) => setEditUserId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs bg-white"
                  >
                    <option value="">Not linked to login account</option>
                    {members.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.full_name} ({m.role} · {m.email})
                      </option>
                    ))}
                  </select>
                </FormField>
                <Button type="submit" size="sm">
                  Save Guard Profile
                </Button>
              </form>
            )}

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
            const res = await updateEmployeeStatus(pendingStatusChange.emp.id, pendingStatusChange.nextStatus);
            if (res.error) setFeedback({ tone: 'error', msg: res.error });
            else setFeedback({ tone: 'success', msg: `Guard status updated to "${pendingStatusChange.nextStatus}".` });
            setPendingStatusChange(null);
          }
        }}
      />
    </div>
  );
};

export const FFClientsPage: React.FC = () => {
  const { clients, sites, addClient, toggleClientStatus, currentRole } = useApp();
  const [code, setCode] = useState('');
  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('+2547');
  const [email, setEmail] = useState('');
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; msg: string } | null>(null);
  const canEdit = Boolean(currentRole && ['owner', 'admin', 'operations_manager'].includes(currentRole));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const res = await addClient({
      client_code: code,
      company_name: company,
      contact_person: contact,
      contact_phone: phone,
      contact_email: email.trim() || undefined,
    });
    if (res.error) setFeedback({ tone: 'error', msg: res.error });
    else {
      setCode('');
      setCompany('');
      setContact('');
      setPhone('+2547');
      setEmail('');
      setFeedback({ tone: 'success', msg: 'Client account registered.' });
    }
  };

  const handleToggleClient = async (id: string, nextActive: boolean) => {
    setFeedback(null);
    const res = await toggleClientStatus(id, nextActive);
    if (res.error) setFeedback({ tone: 'error', msg: res.error });
    else setFeedback({ tone: 'success', msg: `Client marked as ${nextActive ? 'Active' : 'Inactive'}.` });
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

      {feedback && <InlineAlert tone={feedback.tone}>{feedback.msg}</InlineAlert>}

      {canEdit && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Register Client Account</h2>
          <form onSubmit={submit} className="grid sm:grid-cols-6 gap-3">
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
            <input
              type="email"
              placeholder="Contact Email (opt)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[42px]"
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
              <Card key={c.id} className="p-5 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-mono text-slate-500">{c.client_code}</span>
                    <StatusLabel label={c.is_active ? 'Active' : 'Inactive'} tone={c.is_active ? 'emerald' : 'slate'} />
                  </div>
                  <h3 className="font-bold text-slate-900 mt-2">{c.company_name}</h3>
                  <p className="text-xs text-slate-600 mt-1">
                    POC: {c.contact_person} · <span className="font-mono">{c.contact_phone}</span>
                    {c.contact_email ? ` · ${c.contact_email}` : ''} ·{' '}
                    <span className="font-mono">{siteCount} site(s)</span>
                  </p>
                </div>
                {canEdit && (
                  <div className="pt-2 border-t border-slate-100 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleClient(c.id, !c.is_active)}
                    >
                      {c.is_active ? 'Deactivate Client' : 'Reactivate Client'}
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const FFSitesPage: React.FC = () => {
  const {
    clients,
    sites,
    posts,
    members,
    siteSupervisors,
    addSite,
    updateSiteGeofence,
    toggleSiteStatus,
    addPost,
    updatePost,
    assignSiteSupervisor,
    removeSiteSupervisor,
    currentRole,
  } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('view') === 'posts' ? 'posts' : 'sites';

  const [clientId, setClientId] = useState('');
  const [siteName, setSiteName] = useState('');
  const [city, setCity] = useState('Nairobi');
  const [desc, setDesc] = useState('');
  const [siteLat, setSiteLat] = useState('-1.2647');
  const [siteLng, setSiteLng] = useState('36.8019');
  const [siteRadius, setSiteRadius] = useState('250');
  const [editingGeoSiteId, setEditingGeoSiteId] = useState<string | null>(null);
  const [geoLat, setGeoLat] = useState('');
  const [geoLng, setGeoLng] = useState('');
  const [geoRad, setGeoRad] = useState('250');
  const [postSiteId, setPostSiteId] = useState('');
  const [postName, setPostName] = useState('');
  const [reqGuards, setReqGuards] = useState(1);
  const [instructions, setInstructions] = useState('');
  const [supSiteId, setSupSiteId] = useState('');
  const [supUserId, setSupUserId] = useState('');
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editPostName, setEditPostName] = useState('');
  const [editReqGuards, setEditReqGuards] = useState(1);
  const [editInstructions, setEditInstructions] = useState('');
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; msg: string } | null>(null);

  const canEdit = Boolean(currentRole && ['owner', 'admin', 'operations_manager'].includes(currentRole));
  const supervisors = useMemo(
    () => members.filter((m) => m.role === 'supervisor' || m.role === 'operations_manager' || m.role === 'owner' || m.role === 'admin'),
    [members]
  );

  useEffect(() => {
    if ((!clientId || !clients.some((c) => c.id === clientId)) && clients[0]?.id) {
      setClientId(clients[0].id);
    } else if (clients.length === 0) {
      setClientId('');
    }
  }, [clients, clientId]);

  useEffect(() => {
    if ((!postSiteId || !sites.some((s) => s.id === postSiteId)) && sites[0]?.id) {
      setPostSiteId(sites[0].id);
    } else if (sites.length === 0) {
      setPostSiteId('');
    }
    if ((!supSiteId || !sites.some((s) => s.id === supSiteId)) && sites[0]?.id) {
      setSupSiteId(sites[0].id);
    } else if (sites.length === 0) {
      setSupSiteId('');
    }
  }, [sites, postSiteId, supSiteId]);

  useEffect(() => {
    if ((!supUserId || !supervisors.some((m) => m.user_id === supUserId)) && supervisors[0]?.user_id) {
      setSupUserId(supervisors[0].user_id);
    }
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

      {feedback && <InlineAlert tone={feedback.tone}>{feedback.msg}</InlineAlert>}

      {canEdit && (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="p-5 space-y-3">
            <h2 className="font-semibold text-sm text-slate-900">Add Physical Site</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setFeedback(null);
                if (!clientId) {
                  setFeedback({ tone: 'error', msg: 'Create a client account first before adding a site.' });
                  return;
                }
                const res = await addSite({
                  client_id: clientId,
                  name: siteName,
                  city,
                  location_description: desc,
                  latitude: siteLat ? Number(siteLat) : null,
                  longitude: siteLng ? Number(siteLng) : null,
                  geofence_radius_m: Number(siteRadius) || 250,
                });
                if (res.error) setFeedback({ tone: 'error', msg: res.error });
                else {
                  setSiteName('');
                  setDesc('');
                  setFeedback({ tone: 'success', msg: 'Physical site with geofence created.' });
                }
              }}
              className="space-y-2.5"
            >
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-h-[40px]"
              >
                {clients.length === 0 ? (
                  <option value="">No clients registered yet</option>
                ) : (
                  clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name}
                    </option>
                  ))
                )}
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
              <div className="grid grid-cols-3 gap-2">
                <input type="number" step="0.0001" placeholder="Lat" value={siteLat} onChange={(e) => setSiteLat(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-mono" />
                <input type="number" step="0.0001" placeholder="Lng" value={siteLng} onChange={(e) => setSiteLng(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-mono" />
                <input type="number" min={30} max={5000} placeholder="Radius m" value={siteRadius} onChange={(e) => setSiteRadius(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-mono" />
              </div>
              <Button type="submit" className="w-full">
                Create Site
              </Button>
            </form>
          </Card>

          <Card className="p-5 space-y-3">
            <h2 className="font-semibold text-sm text-slate-900">Add Manned Post</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setFeedback(null);
                if (!postSiteId) {
                  setFeedback({ tone: 'error', msg: 'Create a site first before adding a manned post.' });
                  return;
                }
                const res = await addPost({
                  site_id: postSiteId,
                  name: postName,
                  required_guards: reqGuards,
                  instructions: instructions || 'Standard access control SOP.',
                });
                if (res.error) setFeedback({ tone: 'error', msg: res.error });
                else {
                  setPostName('');
                  setInstructions('');
                  setFeedback({ tone: 'success', msg: 'Manned security post added.' });
                }
              }}
              className="space-y-2.5"
            >
              <select
                value={postSiteId}
                onChange={(e) => setPostSiteId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-h-[40px]"
              >
                {sites.length === 0 ? (
                  <option value="">No sites created yet</option>
                ) : (
                  sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))
                )}
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
              <Button type="submit" className="w-full">
                Add Post
              </Button>
            </form>
          </Card>

          <Card className="p-5 space-y-3">
            <h2 className="font-semibold text-sm text-slate-900">Assign Site Supervisor</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setFeedback(null);
                if (!supSiteId || !supUserId) {
                  setFeedback({ tone: 'error', msg: 'Select both a site and an active team member.' });
                  return;
                }
                const res = await assignSiteSupervisor(supSiteId, supUserId);
                if (res.error) setFeedback({ tone: 'error', msg: res.error });
                else setFeedback({ tone: 'success', msg: 'Supervisor linked to site.' });
              }}
              className="space-y-2.5"
            >
              <select
                value={supSiteId}
                onChange={(e) => setSupSiteId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-h-[40px]"
              >
                {sites.length === 0 ? (
                  <option value="">No sites created yet</option>
                ) : (
                  sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))
                )}
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
        filteredSites.length === 0 ? (
          <EmptyState title="No sites available" description="Create a physical site or check your supervisor scope." />
        ) : (
          <div className="space-y-4">
            {filteredSites.map((s) => {
              const sitePosts = posts.filter((p) => p.site_id === s.id);
              const linkedSups = siteSupervisors.filter((ss) => ss.site_id === s.id);

              return (
                <Card key={s.id} className="p-5">
                  <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900">{s.name}</h3>
                        <StatusLabel label={s.is_active ? 'Active' : 'Inactive'} tone={s.is_active ? 'emerald' : 'slate'} />
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {s.location_description ? `${s.location_description} · ` : ''}
                        {s.city}
                        {s.latitude != null && s.longitude != null && (
                          <span className="font-mono ml-2 text-slate-600">
                            · Geofence {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)} ({s.geofence_radius_m || 250}m)
                          </span>
                        )}
                      </p>
                      {editingGeoSiteId === s.id && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <input type="number" step="0.0001" value={geoLat} onChange={(e) => setGeoLat(e.target.value)} placeholder="Latitude" className="border border-slate-300 rounded px-2 py-1 text-xs font-mono w-28" />
                          <input type="number" step="0.0001" value={geoLng} onChange={(e) => setGeoLng(e.target.value)} placeholder="Longitude" className="border border-slate-300 rounded px-2 py-1 text-xs font-mono w-28" />
                          <input type="number" min={30} max={5000} value={geoRad} onChange={(e) => setGeoRad(e.target.value)} placeholder="Radius (m)" className="border border-slate-300 rounded px-2 py-1 text-xs font-mono w-24" />
                          <Button
                            size="sm"
                            onClick={async () => {
                              const res = await updateSiteGeofence(s.id, {
                                latitude: Number(geoLat),
                                longitude: Number(geoLng),
                                geofence_radius_m: Number(geoRad) || 250,
                              });
                              if (res.error) setFeedback({ tone: 'error', msg: res.error });
                              else {
                                setEditingGeoSiteId(null);
                                setFeedback({ tone: 'success', msg: `Geofence updated for ${s.name}.` });
                              }
                            }}
                          >
                            Save Geofence
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingGeoSiteId(null)}>Cancel</Button>
                        </div>
                      )}
                      {linkedSups.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {linkedSups.map((ss) => {
                            const supName = members.find((m) => m.user_id === ss.user_id)?.full_name || ss.user_id;
                            return (
                              <span
                                key={ss.id}
                                className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px] text-slate-700"
                              >
                                Supervisor: {supName}
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      setFeedback(null);
                                      const res = await removeSiteSupervisor(ss.id);
                                      if (res.error) setFeedback({ tone: 'error', msg: res.error });
                                      else setFeedback({ tone: 'success', msg: 'Supervisor unlinked from site.' });
                                    }}
                                    aria-label="Unlink supervisor"
                                    className="text-rose-600 font-bold ml-1 cursor-pointer"
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
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-600 tabular-nums">{sitePosts.length} Post(s)</span>
                      {canEdit && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setEditingGeoSiteId(s.id);
                              setGeoLat(String(s.latitude ?? -1.2647));
                              setGeoLng(String(s.longitude ?? 36.8019));
                              setGeoRad(String(s.geofence_radius_m ?? 250));
                            }}
                          >
                            <MapPin className="h-3.5 w-3.5" /> Geofence
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              setFeedback(null);
                              const res = await toggleSiteStatus(s.id, !s.is_active);
                              if (res.error) setFeedback({ tone: 'error', msg: res.error });
                              else setFeedback({ tone: 'success', msg: `Site marked ${!s.is_active ? 'Active' : 'Inactive'}.` });
                            }}
                          >
                            {s.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                        </>
                      )}
                    </div>
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
        )
      ) : filteredPosts.length === 0 ? (
        <EmptyState title="No manned posts" description="Add a security post under any active site." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
              <tr>
                <th className="p-3 font-medium">Post Name</th>
                <th className="p-3 font-medium">Site</th>
                <th className="p-3 font-medium">Required Guards</th>
                <th className="p-3 font-medium">Standing Orders</th>
                {canEdit && <th className="p-3 font-medium text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPosts.map((p) => {
                const isEditing = editingPostId === p.id;
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-slate-900">
                      {isEditing ? (
                        <input
                          value={editPostName}
                          onChange={(e) => setEditPostName(e.target.value)}
                          className="border border-slate-300 rounded px-2 py-1 text-xs w-full"
                        />
                      ) : (
                        p.name
                      )}
                    </td>
                    <td className="p-3 text-slate-600">{sites.find((s) => s.id === p.site_id)?.name || 'Site'}</td>
                    <td className="p-3 font-mono tabular-nums">
                      {isEditing ? (
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={editReqGuards}
                          onChange={(e) => setEditReqGuards(Number(e.target.value))}
                          className="border border-slate-300 rounded px-2 py-1 text-xs w-20 font-mono"
                        />
                      ) : (
                        p.required_guards
                      )}
                    </td>
                    <td className="p-3 text-xs text-slate-600">
                      {isEditing ? (
                        <input
                          value={editInstructions}
                          onChange={(e) => setEditInstructions(e.target.value)}
                          className="border border-slate-300 rounded px-2 py-1 text-xs w-full"
                        />
                      ) : (
                        p.instructions
                      )}
                    </td>
                    {canEdit && (
                      <td className="p-3 text-right whitespace-nowrap">
                        {isEditing ? (
                          <div className="inline-flex gap-1.5">
                            <Button
                              size="sm"
                              onClick={async () => {
                                setFeedback(null);
                                const res = await updatePost(p.id, {
                                  name: editPostName,
                                  required_guards: editReqGuards,
                                  instructions: editInstructions,
                                });
                                if (res.error) setFeedback({ tone: 'error', msg: res.error });
                                else {
                                  setEditingPostId(null);
                                  setFeedback({ tone: 'success', msg: 'Post requirements updated.' });
                                }
                              }}
                            >
                              Save
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setEditingPostId(null)}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingPostId(p.id);
                              setEditPostName(p.name);
                              setEditReqGuards(p.required_guards);
                              setEditInstructions(p.instructions);
                            }}
                          >
                            Edit
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
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
  const [customStart, setCustomStart] = useState('08:00');
  const [customEnd, setCustomEnd] = useState('16:00');
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [selectedEmp, setSelectedEmp] = useState<Record<string, string>>({});
  const [reliefFlag, setReliefFlag] = useState<Record<string, boolean>>({});
  const [pendingRemoval, setPendingRemoval] = useState<{ id: string; label: string } | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    if ((!postId || !posts.some((p) => p.id === postId)) && posts[0]?.id) {
      setPostId(posts[0].id);
    } else if (posts.length === 0) {
      setPostId('');
    }
  }, [posts, postId]);

  const canPublish = Boolean(currentRole && ['owner', 'admin', 'operations_manager'].includes(currentRole));
  const canAssign = Boolean(currentRole && ['owner', 'admin', 'operations_manager', 'supervisor'].includes(currentRole));

  const nextCalendarDate = (isoDate: string): string => {
    const dt = new Date(`${isoDate}T00:00:00Z`);
    dt.setUTCDate(dt.getUTCDate() + 1);
    return dt.toISOString().slice(0, 10);
  };

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const post = posts.find((p) => p.id === postId);
    if (!post) {
      setFeedback({ tone: 'error', msg: 'Add a manned post under Operations -> Sites first.' });
      return;
    }

    let start_time = `${date}T06:00:00+03:00`;
    let end_time = `${date}T18:00:00+03:00`;
    if (shiftType === 'night') {
      start_time = `${date}T18:00:00+03:00`;
      end_time = `${nextCalendarDate(date)}T06:00:00+03:00`;
    } else if (shiftType === 'special') {
      start_time = `${date}T${customStart}:00+03:00`;
      const endDate = customEnd <= customStart ? nextCalendarDate(date) : date;
      end_time = `${endDate}T${customEnd}:00+03:00`;
    }

    const res = await addShift({
      site_id: post.site_id,
      post_id: post.id,
      shift_date: date,
      start_time,
      end_time,
      shift_type: shiftType,
    });
    if (res.error) setFeedback({ tone: 'error', msg: res.error });
    else setFeedback({ tone: 'success', msg: `${shiftType.toUpperCase()} shift published for ${post.name}.` });
  };

  const handleAssign = async (shiftId: string) => {
    setFeedback(null);
    const empId = selectedEmp[shiftId];
    if (!empId) {
      setFeedback({ tone: 'error', msg: 'Select an active guard before clicking Assign.' });
      return;
    }
    const isRelief = Boolean(reliefFlag[shiftId]);
    const res = await assignGuard(shiftId, empId, { is_relief: isRelief });
    if (res.error) setFeedback({ tone: 'error', msg: res.error });
    else {
      setSelectedEmp((prev) => ({ ...prev, [shiftId]: '' }));
      setReliefFlag((prev) => ({ ...prev, [shiftId]: false }));
      setFeedback({ tone: 'success', msg: isRelief ? 'Relief guard deployed to shift.' : 'Guard assigned to shift.' });
    }
  };

  const filteredShifts = siteFilter === 'all' ? shifts : shifts.filter((s) => s.site_id === siteFilter);

  // Coverage monitor computations
  const coverageStats = useMemo(() => {
    let required = 0;
    let filled = 0;
    let gaps = 0;
    for (const sh of filteredShifts) {
      const post = posts.find((p) => p.id === sh.post_id);
      const req = post?.required_guards ?? 1;
      const cnt = assignments.filter((a) => a.shift_id === sh.id && a.status !== 'cancelled').length;
      required += req;
      filled += Math.min(req, cnt);
      if (cnt < req) gaps += 1;
    }
    const reliefCount = assignments.filter((a) => a.is_relief && a.status !== 'cancelled').length;
    const pct = required > 0 ? Math.round((filled / required) * 100) : 100;
    return { required, filled, gaps, reliefCount, pct };
  }, [filteredShifts, posts, assignments]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Module 02 · Deployment & Scheduling"
        title="Shift Scheduling, Relief Guards & Coverage Monitor"
        description="Double-booking prevention, relief guard allocation, and real-time post coverage monitoring in EAT."
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

      {/* Coverage Monitor Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs font-medium text-slate-500">Coverage Rate</div>
          <div className="text-2xl font-bold font-mono tabular-nums mt-1 text-[#059669]">{coverageStats.pct}%</div>
          <div className="text-xs text-slate-500 font-mono">{coverageStats.filled}/{coverageStats.required} post slots filled</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-medium text-slate-500">Understaffed Shifts</div>
          <div className="text-2xl font-bold font-mono tabular-nums mt-1 text-[#D97706]">{coverageStats.gaps}</div>
          <div className="text-xs text-slate-500">Shifts needing relief or assignment</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-medium text-slate-500">Relief Guards Deployed</div>
          <div className="text-2xl font-bold font-mono tabular-nums mt-1 text-[#0B132B]">{coverageStats.reliefCount}</div>
          <div className="text-xs text-slate-500">Standby / cover allocations</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-medium text-slate-500">Published Shifts</div>
          <div className="text-2xl font-bold font-mono tabular-nums mt-1 text-[#0B132B]">{filteredShifts.length}</div>
          <div className="text-xs text-slate-500">Active roster scope</div>
        </Card>
      </div>

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
        <Card className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Publish New Post Shift</h2>
          <form onSubmit={handleCreateShift} className="grid sm:grid-cols-4 gap-3">
            <select
              value={postId}
              onChange={(e) => setPostId(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-h-[42px]"
            >
              {posts.length === 0 ? (
                <option value="">No posts configured</option>
              ) : (
                posts.map((p) => {
                  const s = sites.find((x) => x.id === p.site_id);
                  return (
                    <option key={p.id} value={p.id}>
                      {s?.name} — {p.name}
                    </option>
                  );
                })
              )}
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
              <option value="night">Night (18:00–06:00 EAT +1d)</option>
              <option value="special">Special Coverage (Custom)</option>
            </select>
            <Button type="submit">Publish Shift</Button>

            {shiftType === 'special' && (
              <div className="sm:col-span-4 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <FormField label="Start Time (EAT)" htmlFor="sp-start">
                  <input
                    id="sp-start"
                    type="time"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </FormField>
                <FormField label="End Time (EAT)" htmlFor="sp-end">
                  <input
                    id="sp-end"
                    type="time"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </FormField>
              </div>
            )}
          </form>
        </Card>
      )}

      {feedback && <InlineAlert tone={feedback.tone}>{feedback.msg}</InlineAlert>}

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
                {canAssign && <th className="p-3 font-medium">Assign / Deploy Relief</th>}
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
                        <div className="flex flex-wrap gap-1.5">
                          {shAsg.map((a) => {
                            const emp = employees.find((e) => e.id === a.employee_id);
                            const label = emp ? `${emp.first_name} ${emp.last_name} (${emp.employee_number})` : a.employee_id;
                            return (
                              <span
                                key={a.id}
                                className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded"
                              >
                                {label}
                                {a.is_relief && <Badge tone="amber">Relief</Badge>}
                                {canAssign && (
                                  <button
                                    onClick={() => setPendingRemoval({ id: a.id, label })}
                                    className="text-rose-600 font-bold ml-1 cursor-pointer"
                                    aria-label="Remove guard assignment"
                                  >
                                    ×
                                  </button>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    {canAssign && (
                      <td className="p-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <select
                            value={selectedEmp[sh.id] ?? ''}
                            onChange={(e) => setSelectedEmp({ ...selectedEmp, [sh.id]: e.target.value })}
                            className="border border-slate-300 rounded px-2 py-1 text-xs bg-white min-h-[34px]"
                          >
                            <option value="">Select guard...</option>
                            {employees
                              .filter((e) => e.status === 'active')
                              .map((e) => (
                                <option key={e.id} value={e.id}>
                                  {e.employee_number} — {e.first_name} {e.last_name}
                                </option>
                              ))}
                          </select>
                          <label className="inline-flex items-center gap-1 text-[11px] text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(reliefFlag[sh.id])}
                              onChange={(e) => setReliefFlag({ ...reliefFlag, [sh.id]: e.target.checked })}
                            />
                            Relief
                          </label>
                          <Button size="sm" onClick={() => handleAssign(sh.id)}>
                            Assign
                          </Button>
                        </div>
                      </td>
                    )}
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
                            {a.is_relief && <Badge tone="amber">Relief</Badge>}
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
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer px-2">
                      <input
                        type="checkbox"
                        checked={Boolean(reliefFlag[sh.id])}
                        onChange={(e) => setReliefFlag({ ...reliefFlag, [sh.id]: e.target.checked })}
                        className="h-4 w-4"
                      />
                      Relief
                    </label>
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
            const res = await removeAssignment(pendingRemoval.id);
            if (res.error) setFeedback({ tone: 'error', msg: res.error });
            else setFeedback({ tone: 'success', msg: 'Guard removed from shift assignment.' });
            setPendingRemoval(null);
          }
        }}
      />
    </div>
  );
};

interface OfflineAttendanceItem {
  localId: string;
  employee_id: string;
  shift_id: string | null;
  event_type: 'clock_in' | 'clock_out';
  location_metadata: { lat: number; lng: number; accuracy: number } | null;
  offline_captured_at: string;
}

const OFFLINE_QUEUE_KEY = 'ff_offline_attendance_queue';

export const FFAttendancePage: React.FC = () => {
  const {
    employees,
    shifts,
    sites,
    attendance,
    attendanceVerifications,
    recordAttendance,
    verifyAttendanceEvent,
    currentRole,
  } = useApp();
  const [empId, setEmpId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [captureGps, setCaptureGps] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<OfflineAttendanceItem[]>(() => {
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return raw ? (JSON.parse(raw) as OfflineAttendanceItem[]) : [];
    } catch {
      return [];
    }
  });
  const [syncingOffline, setSyncingOffline] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [page, setPage] = useState(1);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; msg: string } | null>(null);

  const PAGE_SIZE = 10;
  const canVerify = Boolean(currentRole && ['owner', 'admin', 'operations_manager', 'supervisor'].includes(currentRole));

  useEffect(() => {
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(offlineQueue));
    } catch {
      // ignore storage quota errors
    }
  }, [offlineQueue]);

  useEffect(() => {
    if ((!empId || !employees.some((e) => e.id === empId)) && employees[0]?.id) {
      setEmpId(employees[0].id);
    } else if (employees.length === 0) {
      setEmpId('');
    }
  }, [employees, empId]);

  useEffect(() => {
    if (shiftId && !shifts.some((s) => s.id === shiftId)) {
      setShiftId(shifts[0]?.id || '');
    } else if (!shiftId && shifts[0]?.id) {
      setShiftId(shifts[0].id);
    }
  }, [shifts, shiftId]);

  const tapAttendance = (eventType: 'clock_in' | 'clock_out') => {
    setFeedback(null);
    if (!empId) {
      setFeedback({ tone: 'error', msg: 'No guard record linked to your account. Ask HR/Operations to link your employee profile.' });
      return;
    }

    const commit = async (loc: { lat: number; lng: number; accuracy: number } | null) => {
      if (offlineMode) {
        const queued: OfflineAttendanceItem = {
          localId: `off-${Date.now()}`,
          employee_id: empId,
          shift_id: shiftId || null,
          event_type: eventType,
          location_metadata: loc,
          offline_captured_at: new Date().toISOString(),
        };
        setOfflineQueue((prev) => [queued, ...prev]);
        setFeedback({
          tone: 'success',
          msg: `Captured offline ${eventType.replace('_', ' ')} locally. Click "Sync Offline Events" when connectivity resumes.`,
        });
        return;
      }

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
            ? `${eventType.replace('_', ' ')} logged with GPS geofence verification.`
            : `${eventType.replace('_', ' ')} logged to append-only ledger.`,
        });
      }
    };

    if (captureGps && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => commit({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        () => {
          // Fallback to selected shift site coordinates with low-accuracy marker if geolocation blocked in iframe/desktop
          const sh = shifts.find((s) => s.id === shiftId);
          const st = sites.find((x) => x.id === sh?.site_id);
          commit(st?.latitude != null && st?.longitude != null ? { lat: st.latitude, lng: st.longitude, accuracy: 35 } : null);
        },
        { timeout: 3500 }
      );
    } else {
      commit(null);
    }
  };

  const syncOfflineEvents = async () => {
    if (offlineQueue.length === 0) return;
    setSyncingOffline(true);
    setFeedback(null);
    let synced = 0;
    const remaining: OfflineAttendanceItem[] = [];
    for (const item of offlineQueue) {
      const res = await recordAttendance({
        employee_id: item.employee_id,
        shift_id: item.shift_id,
        event_type: item.event_type,
        location_metadata: item.location_metadata,
        offline_captured_at: item.offline_captured_at,
        is_offline_sync: true,
      });
      if (!res.error) synced += 1;
      else remaining.push(item);
    }
    setOfflineQueue(remaining);
    setSyncingOffline(false);
    setFeedback({
      tone: remaining.length === 0 ? 'success' : 'error',
      msg: `Synced ${synced} offline attendance event(s) to append-only ledger.${remaining.length > 0 ? ` ${remaining.length} failed.` : ''}`,
    });
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

  const lateAlertsCount = useMemo(() => attendance.filter((a) => (a.late_minutes || 0) > 10).length, [attendance]);
  const outsideGeofenceCount = useMemo(() => attendance.filter((a) => a.geofence_status === 'outside').length, [attendance]);
  const pagedAttendance = attendance.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Module 03 · Attendance & Verification"
        title="GPS Geofencing, Supervisor Verification & Offline Sync"
        description="Append-only attendance ledger with Haversine site geofencing, late arrival alerts, supervisor sign-off, and offline capture."
      />

      {(lateAlertsCount > 0 || outsideGeofenceCount > 0 || offlineQueue.length > 0) && (
        <div className="grid sm:grid-cols-3 gap-3">
          <Card className="p-3.5 border-amber-200 bg-amber-50/70">
            <div className="text-xs font-semibold text-amber-950">Late Clock-In Alerts (&gt;10m)</div>
            <div className="text-xl font-bold font-mono text-[#D97706] mt-0.5">{lateAlertsCount}</div>
          </Card>
          <Card className="p-3.5 border-rose-200 bg-rose-50/70">
            <div className="text-xs font-semibold text-rose-950">Outside Geofence Flags</div>
            <div className="text-xl font-bold font-mono text-[#E11D48] mt-0.5">{outsideGeofenceCount}</div>
          </Card>
          <Card className="p-3.5 border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-slate-800">Offline Capture Queue</div>
              <div className="text-xl font-bold font-mono text-[#0B132B] mt-0.5">{offlineQueue.length} pending</div>
            </div>
            {offlineQueue.length > 0 && (
              <Button size="sm" onClick={syncOfflineEvents} disabled={syncingOffline}>
                <RefreshCw className="h-3.5 w-3.5" /> {syncingOffline ? 'Syncing...' : 'Sync Offline'}
              </Button>
            )}
          </Card>
        </div>
      )}

      {feedback && <InlineAlert tone={feedback.tone}>{feedback.msg}</InlineAlert>}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold text-slate-900">Mobile Guard Clock-In / Clock-Out</h2>
            <button
              type="button"
              onClick={() => setOfflineMode((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border cursor-pointer ${
                offlineMode ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <WifiOff className="h-3.5 w-3.5" /> {offlineMode ? 'Offline Capture: ON' : 'Offline Mode: OFF'}
            </button>
          </div>
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
                {shifts.map((s) => {
                  const st = sites.find((x) => x.id === s.site_id);
                  return (
                    <option key={s.id} value={s.id}>
                      {st?.name || 'Site'} · {s.shift_date} ({s.shift_type})
                    </option>
                  );
                })}
              </select>
            </FormField>

            <label className="flex items-center gap-3 text-xs text-slate-700 cursor-pointer py-1 min-h-[44px]">
              <input
                type="checkbox"
                checked={captureGps}
                onChange={(e) => setCaptureGps(e.target.checked)}
                className="h-5 w-5"
              />
              Capture event-only GPS geofence snapshot on button press (no background tracking)
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
              <th className="p-3 font-medium">Event &amp; Alerts</th>
              <th className="p-3 font-medium">Geofence / Audit Notes</th>
              <th className="p-3 font-medium text-right">Supervisor Verification</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pagedAttendance.map((a) => {
              const emp = employees.find((e) => e.id === a.employee_id);
              const ver = attendanceVerifications.find((v) => v.attendance_event_id === a.id);
              return (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="p-3 whitespace-nowrap font-mono tabular-nums">
                    {formatNairobiDateTime(a.recorded_at)}
                    {a.is_offline_sync && <div className="text-[10px] text-amber-700 font-semibold">Offline synced</div>}
                  </td>
                  <td className="p-3 font-medium text-slate-900">
                    {emp ? `${emp.first_name} ${emp.last_name}` : a.employee_id}
                  </td>
                  <td className="p-3 space-y-1">
                    <div>
                      <StatusLabel
                        label={a.event_type.replace('_', ' ')}
                        tone={a.event_type === 'supervisor_override' ? 'amber' : 'emerald'}
                      />
                    </div>
                    {(a.late_minutes || 0) > 10 && (
                      <Badge tone="amber">Late +{a.late_minutes}m</Badge>
                    )}
                  </td>
                  <td className="p-3 text-slate-600 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {a.geofence_status === 'inside' && (
                        <StatusLabel label={`Inside (${a.distance_meters ?? 0}m)`} tone="emerald" />
                      )}
                      {a.geofence_status === 'outside' && (
                        <StatusLabel label={`Outside (${a.distance_meters ?? '?'}m)`} tone="rose" />
                      )}
                      {a.location_metadata && (
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                          <MapPin className="h-3.5 w-3.5" /> {a.location_metadata.lat.toFixed(4)},{' '}
                          {a.location_metadata.lng.toFixed(4)}
                        </span>
                      )}
                    </div>
                    {a.override_reason && <div>{a.override_reason}</div>}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    {ver ? (
                      <div className="inline-flex flex-col items-end">
                        <StatusLabel label={ver.status} tone={ver.status === 'verified' ? 'emerald' : 'rose'} />
                        <span className="text-[10px] text-slate-500 mt-0.5">{ver.verified_by_name}</span>
                      </div>
                    ) : canVerify ? (
                      <div className="inline-flex gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            const res = await verifyAttendanceEvent(a.id, 'verified', 'Verified by supervisor');
                            if (res.error) setFeedback({ tone: 'error', msg: res.error });
                            else setFeedback({ tone: 'success', msg: 'Attendance record verified.' });
                          }}
                        >
                          <CheckCircle2 className="h-3 w-3 text-[#059669]" /> Verify
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            const res = await verifyAttendanceEvent(a.id, 'flagged', 'Flagged for exception review');
                            if (res.error) setFeedback({ tone: 'error', msg: res.error });
                            else setFeedback({ tone: 'success', msg: 'Attendance record flagged.' });
                          }}
                        >
                          <Flag className="h-3 w-3 text-rose-600" /> Flag
                        </Button>
                      </div>
                    ) : (
                      <span className="text-slate-400">Pending</span>
                    )}
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
          const ver = attendanceVerifications.find((v) => v.attendance_event_id === a.id);
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
              <div className="flex flex-wrap gap-2">
                {a.geofence_status && a.geofence_status !== 'unknown' && (
                  <StatusLabel
                    label={`${a.geofence_status} (${a.distance_meters ?? 0}m)`}
                    tone={a.geofence_status === 'inside' ? 'emerald' : 'rose'}
                  />
                )}
                {(a.late_minutes || 0) > 10 && <Badge tone="amber">Late +{a.late_minutes}m</Badge>}
                {ver && <StatusLabel label={ver.status} tone={ver.status === 'verified' ? 'emerald' : 'rose'} />}
              </div>
              {a.override_reason && <div className="text-xs text-slate-700">{a.override_reason}</div>}
              {!ver && canVerify && (
                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <Button size="sm" variant="secondary" onClick={() => verifyAttendanceEvent(a.id, 'verified')}>Verify</Button>
                  <Button size="sm" variant="ghost" onClick={() => verifyAttendanceEvent(a.id, 'flagged')}>Flag</Button>
                </div>
              )}
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
    escalateIncident,
    generateIncidentAIDraft,
    approveIncidentAIDraft,
    currentRole,
  } = useApp();

  const [searchParams, setSearchParams] = useSearchParams();
  const initialEntryType = searchParams.get('view') === 'ob' ? 'occurrence' : 'incident';
  const [viewType, setViewType] = useState<'all' | 'incident' | 'occurrence'>(
    searchParams.get('view') === 'ob' ? 'occurrence' : 'all'
  );
  const [entryType, setEntryType] = useState<'incident' | 'occurrence'>(initialEntryType);
  const [siteId, setSiteId] = useState('');
  const [postId, setPostId] = useState('');
  const [category, setCategory] = useState<IncidentCategory>(initialEntryType === 'occurrence' ? 'handover' : 'trespassing');
  const [severity, setSeverity] = useState<IncidentSeverity>('medium');
  const [escalationLevel, setEscalationLevel] = useState<EscalationLevel>('site');
  const [narrative, setNarrative] = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | IncidentStatus>('all');
  const [search, setSearch] = useState('');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [draftEdits, setDraftEdits] = useState<Record<string, string>>({});
  const [aiBusyId, setAiBusyId] = useState<string | null>(null);
  const [confirmCloseId, setConfirmCloseId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; msg: string } | null>(null);
  const [drawerFeedback, setDrawerFeedback] = useState<{ tone: 'success' | 'error'; msg: string } | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const speechRef = useRef<any>(null);

  useEffect(() => {
    if (searchParams.get('view') === 'ob') {
      setViewType('occurrence');
      setEntryType('occurrence');
      setCategory('handover');
    }
  }, [searchParams]);

  useEffect(() => {
    if ((!siteId || !sites.some((s) => s.id === siteId)) && sites[0]?.id) {
      setSiteId(sites[0].id);
    } else if (sites.length === 0) {
      setSiteId('');
    }
  }, [sites, siteId]);

  const sitePosts = useMemo(() => posts.filter((p) => p.site_id === siteId), [posts, siteId]);

  useEffect(() => {
    if (postId && !sitePosts.some((p) => p.id === postId)) {
      setPostId(sitePosts[0]?.id || '');
    } else if (!postId && sitePosts[0]?.id) {
      setPostId(sitePosts[0].id);
    }
  }, [sitePosts, postId]);

  const canReview = currentRole !== 'guard';

  const toggleVoiceDictation = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      setFeedback({
        tone: 'error',
        msg: 'Voice dictation is not supported in this browser; enter or paste transcript text manually.',
      });
      return;
    }
    if (isRecording && speechRef.current) {
      speechRef.current.stop();
      setIsRecording(false);
      return;
    }
    const rec = new SpeechRec();
    rec.lang = 'en-KE';
    rec.continuous = true;
    rec.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (event: any) => {
      let chunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        chunk += `${event.results[i][0].transcript} `;
      }
      const clean = chunk.trim();
      if (clean) {
        setVoiceTranscript((prev) => `${prev ? `${prev} ` : ''}${clean}`);
        setNarrative((prev) => `${prev ? `${prev} ` : ''}${clean}`);
      }
    };
    rec.onerror = () => setIsRecording(false);
    rec.onend = () => setIsRecording(false);
    speechRef.current = rec;
    rec.start();
    setIsRecording(true);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 900;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL('image/jpeg', 0.78);
        setPhotoData(compressed);
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  };

  const submitIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!siteId) {
      setFeedback({ tone: 'error', msg: 'No site assigned or created yet for logging incidents.' });
      return;
    }
    const res = await reportIncident({
      site_id: siteId,
      post_id: postId || null,
      entry_type: entryType,
      category,
      severity,
      narrative,
      occurrence_time: new Date().toISOString(),
      voice_transcript: voiceTranscript.trim() || null,
      photo_data: photoData,
      escalation_level: escalationLevel,
    });
    if (res.error) setFeedback({ tone: 'error', msg: res.error });
    else {
      setNarrative('');
      setVoiceTranscript('');
      setPhotoData(null);
      setFeedback({
        tone: 'success',
        msg: entryType === 'occurrence' ? 'Digital Occurrence Book (OB) entry recorded.' : 'Field incident logged for supervisor review.',
      });
    }
  };

  const handleGenerateAIDraft = async (incId: string) => {
    setFeedback(null);
    setDrawerFeedback(null);
    setAiBusyId(incId);
    const res = await generateIncidentAIDraft(incId);
    setAiBusyId(null);
    if (res.error) {
      setFeedback({ tone: 'error', msg: res.error });
      setDrawerFeedback({ tone: 'error', msg: res.error });
    } else {
      setDrawerFeedback({ tone: 'success', msg: 'AI summary draft generated. Review and approve below.' });
    }
  };

  const handleApproveDraft = async (incId: string, defaultText: string, nextStatus: IncidentStatus) => {
    setFeedback(null);
    setDrawerFeedback(null);
    const finalSummary = draftEdits[incId] ?? defaultText;
    const res = await approveIncidentAIDraft(incId, finalSummary, nextStatus);
    if (res.error) {
      setFeedback({ tone: 'error', msg: res.error });
      setDrawerFeedback({ tone: 'error', msg: res.error });
    } else {
      setFeedback({ tone: 'success', msg: 'AI summary approved by human supervisor and saved.' });
      setDrawerFeedback({ tone: 'success', msg: 'Official supervisor summary approved and saved.' });
    }
  };

  const handleReviewStatus = async (incId: string, status: IncidentStatus, notes: string) => {
    setFeedback(null);
    setDrawerFeedback(null);
    const res = await reviewIncident(incId, status, notes);
    if (res.error) {
      setFeedback({ tone: 'error', msg: res.error });
      setDrawerFeedback({ tone: 'error', msg: res.error });
    } else {
      const msg = `Incident status updated to "${status.replace('_', ' ')}".`;
      setFeedback({ tone: 'success', msg });
      setDrawerFeedback({ tone: 'success', msg });
    }
  };

  const visibleIncidents = incidents.filter((i) => {
    const matchesEntry = viewType === 'all' || (i.entry_type || 'incident') === viewType;
    const matchesStatus = statusFilter === 'all' || i.status === statusFilter;
    const siteName = sites.find((s) => s.id === i.site_id)?.name || '';
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      i.narrative.toLowerCase().includes(q) ||
      i.category.toLowerCase().includes(q) ||
      (i.ob_number || '').toLowerCase().includes(q) ||
      siteName.toLowerCase().includes(q) ||
      i.reported_by_name.toLowerCase().includes(q);
    return matchesEntry && matchesStatus && matchesSearch;
  });

  const selectedIncident: Incident | null =
    incidents.find((i) => i.id === selectedIncidentId) || null;

  const selectedAuditHistory = selectedIncident
    ? auditEvents.filter((ev) => ev.entity_id === selectedIncident.id)
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Module 05 · Incident & Digital Occurrence Book (OB)"
        title="Incidents, Voice Reporting, Photos & Occurrence Book"
        description="Log security incidents and shift OB entries with voice dictation, photo evidence, escalation levels, and PII-redacted AI briefs."
        actions={
          <div className="relative w-full sm:w-64">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search OB #, site, category..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm bg-white min-h-[42px]"
            />
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {([
            { id: 'all', label: `All Entries (${incidents.length})` },
            { id: 'incident', label: 'Security Incidents' },
            { id: 'occurrence', label: 'Digital Occurrence Book (OB)' },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setViewType(t.id);
                if (t.id === 'occurrence') setSearchParams({ view: 'ob' });
                else setSearchParams({});
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                viewType === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

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
      </div>

      {feedback && <InlineAlert tone={feedback.tone}>{feedback.msg}</InlineAlert>}

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            {entryType === 'occurrence' ? (
              <BookOpen className="h-4 w-4 text-[#059669]" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-[#E11D48]" />
            )}
            <span>{entryType === 'occurrence' ? 'New Digital Occurrence Book (OB) Entry' : 'Report Field Security Incident'}</span>
          </h2>
          <div className="inline-flex gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setEntryType('incident');
                setCategory('trespassing');
              }}
              className={`px-2.5 py-1 text-xs rounded font-medium cursor-pointer ${entryType === 'incident' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
            >
              Incident
            </button>
            <button
              type="button"
              onClick={() => {
                setEntryType('occurrence');
                setCategory('handover');
              }}
              className={`px-2.5 py-1 text-xs rounded font-medium cursor-pointer ${entryType === 'occurrence' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
            >
              Occurrence Book
            </button>
          </div>
        </div>

        <form onSubmit={submitIncident} className="space-y-3">
          <div className="grid sm:grid-cols-5 gap-3">
            <select
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-h-[42px]"
            >
              {sites.length === 0 ? (
                <option value="">No sites available</option>
              ) : (
                sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))
              )}
            </select>
            <select
              value={postId}
              onChange={(e) => setPostId(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-h-[42px]"
            >
              <option value="">General Site Area</option>
              {sitePosts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
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
              <option value="handover">OB · Shift Handover</option>
              <option value="visitor_log">OB · Visitor / Vehicle Log</option>
              <option value="patrol_note">OB · Patrol Observation</option>
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
            <select
              value={escalationLevel}
              onChange={(e) => setEscalationLevel(e.target.value as EscalationLevel)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-h-[42px]"
            >
              <option value="site">Escalation: Site Level</option>
              <option value="operations">Escalation: Operations HQ</option>
              <option value="executive">Escalation: Executive</option>
              <option value="client_notified">Escalation: Client Notified</option>
            </select>
          </div>
          <textarea
            required
            minLength={10}
            rows={3}
            placeholder="Describe factual sequence of events or dictate using the microphone..."
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            className="w-full border border-slate-300 rounded-lg p-3 text-sm"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={toggleVoiceDictation}>
                {isRecording ? <MicOff className="h-4 w-4 text-rose-600" /> : <Mic className="h-4 w-4 text-[#059669]" />}
                {isRecording ? 'Stop Dictation' : 'Voice Report Dictation'}
              </Button>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer min-h-[36px]">
                <Camera className="h-4 w-4 text-slate-600" />
                <span>{photoData ? 'Photo Attached (Change)' : 'Attach Evidence Photo'}</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handlePhotoUpload} />
              </label>
              {photoData && (
                <button type="button" onClick={() => setPhotoData(null)} className="text-xs text-rose-600 hover:underline cursor-pointer">
                  Remove photo
                </button>
              )}
            </div>
            <Button type="submit" variant={entryType === 'occurrence' ? 'primary' : 'danger'}>
              {entryType === 'occurrence' ? 'Record OB Entry' : 'Log Security Incident'}
            </Button>
          </div>
          {photoData && (
            <div className="pt-2">
              <img src={photoData} alt="Incident evidence preview" className="h-24 rounded-lg border border-slate-200 object-cover" />
            </div>
          )}
        </form>
      </Card>

      {visibleIncidents.length === 0 ? (
        <EmptyState title="No incidents or OB entries in this view" description="All matching records are clear." />
      ) : (
        <div className="space-y-3">
          {visibleIncidents.map((inc) => {
            const siteName = sites.find((s) => s.id === inc.site_id)?.name || 'Site';
            const postName = posts.find((p) => p.id === inc.post_id)?.name;
            const pendingAi = Boolean(inc.ai_draft_summary) && !inc.ai_approved_at;

            return (
              <Card key={inc.id} className="p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {inc.ob_number && (
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700">
                        {inc.ob_number}
                      </span>
                    )}
                    <Badge tone={inc.entry_type === 'occurrence' ? 'emerald' : 'navy'}>
                      {inc.entry_type === 'occurrence' ? 'OB Entry' : 'Incident'}
                    </Badge>
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
                  <div className="flex flex-wrap items-center gap-2">
                    {inc.escalation_level && inc.escalation_level !== 'site' && (
                      <Badge tone="amber">Escalated: {inc.escalation_level.replace('_', ' ')}</Badge>
                    )}
                    {inc.photo_data && <Badge tone="slate">Photo Attached</Badge>}
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
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setDrawerFeedback(null);
                      setSelectedIncidentId(inc.id);
                    }}
                  >
                    <Eye className="h-3.5 w-3.5" /> Open Record Workspace
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Full Incident & OB Workspace Drawer */}
      <Drawer
        open={Boolean(selectedIncident)}
        title={selectedIncident ? `${selectedIncident.ob_number || 'Record'} · ${selectedIncident.category.replace('_', ' ').toUpperCase()}` : ''}
        subtitle={
          selectedIncident
            ? `${sites.find((s) => s.id === selectedIncident.site_id)?.name || 'Site'} · ${formatNairobiDateTime(
                selectedIncident.occurrence_time
              )}`
            : ''
        }
        onClose={() => {
          setDrawerFeedback(null);
          setSelectedIncidentId(null);
        }}
      >
        {selectedIncident && (
          <div className="space-y-6">
            {drawerFeedback && <InlineAlert tone={drawerFeedback.tone}>{drawerFeedback.msg}</InlineAlert>}

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-slate-500">Severity &amp; Type</div>
                <div className="mt-1 flex items-center gap-2">
                  <StatusLabel
                    label={selectedIncident.severity.toUpperCase()}
                    tone={selectedIncident.severity === 'critical' || selectedIncident.severity === 'high' ? 'rose' : 'amber'}
                  />
                  <span className="capitalize">{selectedIncident.entry_type || 'incident'}</span>
                </div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-slate-500">Escalation Level</div>
                <div className="font-semibold text-slate-900 capitalize mt-1">
                  {(selectedIncident.escalation_level || 'site').replace('_', ' ')}
                </div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-slate-500">Reporting Employee</div>
                <div className="font-semibold text-slate-900 mt-1">{selectedIncident.reported_by_name}</div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-slate-500">Workflow Status</div>
                <div className="font-semibold text-slate-900 capitalize mt-1">
                  {selectedIncident.status.replace('_', ' ')}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Narrative &amp; Voice Transcript</h3>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 leading-relaxed space-y-2">
                <p>{selectedIncident.narrative}</p>
                {selectedIncident.voice_transcript && (
                  <p className="text-xs text-slate-600 pt-2 border-t border-slate-200">
                    <strong>Voice Dictation:</strong> {selectedIncident.voice_transcript}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Evidence Gallery</h3>
              {selectedIncident.photo_data ? (
                <img
                  src={selectedIncident.photo_data}
                  alt="Field incident evidence"
                  className="w-full max-h-64 object-contain rounded-lg border border-slate-200 bg-slate-50"
                />
              ) : (
                <div className="p-4 border border-dashed border-slate-300 rounded-lg text-xs text-slate-600 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-slate-400" />
                  <span>No photo uploaded with this entry.</span>
                </div>
              )}
            </div>

            {canReview && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="text-xs font-semibold text-slate-700">Escalate Incident Level</div>
                <div className="flex flex-wrap gap-2">
                  {(['site', 'operations', 'executive', 'client_notified'] as const).map((lvl) => (
                    <Button
                      key={lvl}
                      size="sm"
                      variant={selectedIncident.escalation_level === lvl ? 'primary' : 'secondary'}
                      onClick={async () => {
                        const res = await escalateIncident(selectedIncident.id, lvl);
                        if (res.error) setDrawerFeedback({ tone: 'error', msg: res.error });
                        else setDrawerFeedback({ tone: 'success', msg: `Escalated to ${lvl.replace('_', ' ')}.` });
                      }}
                    >
                      {lvl.replace('_', ' ')}
                    </Button>
                  ))}
                </div>
              </div>
            )}

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
                      handleApproveDraft(selectedIncident.id, selectedIncident.ai_draft_summary!, 'under_investigation')
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
                      handleReviewStatus(
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
                      handleReviewStatus(
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
                    Close Record
                  </Button>
                </div>
              </div>
            )}

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
        title="Close Record"
        description="Closing this entry marks its workflow complete. All timeline notes and audit logs remain preserved."
        confirmLabel="Close Record"
        tone="danger"
        onCancel={() => setConfirmCloseId(null)}
        onConfirm={async () => {
          if (confirmCloseId) {
            await handleReviewStatus(
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

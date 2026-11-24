import React from 'react';
import type { Assignment, AttendanceEvent, Post, Shift, Site } from '../types/domain';
import { Card } from './ui';

export const AttendanceOverviewChart: React.FC<{
  attendance: AttendanceEvent[];
}> = ({ attendance }) => {
  const clockIns = attendance.filter((a) => a.event_type === 'clock_in').length;
  const clockOuts = attendance.filter((a) => a.event_type === 'clock_out').length;
  const overrides = attendance.filter((a) => a.event_type === 'supervisor_override').length;
  const total = attendance.length;
  const maxVal = Math.max(1, clockIns, clockOuts, overrides);

  const series = [
    { label: 'Clock Ins', count: clockIns, color: '#059669' },
    { label: 'Clock Outs', count: clockOuts, color: '#1C2541' },
    { label: 'Supervisor Overrides', count: overrides, color: '#D97706' },
  ];

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-2 mb-4">
        <div>
          <h2 className="font-bold text-slate-900">Attendance Event Breakdown</h2>
          <p className="text-xs text-slate-500">Computed from append-only attendance logs</p>
        </div>
        <span className="text-xs font-mono tabular-nums text-slate-600">{total} total</span>
      </div>

      {total === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">
          No attendance events recorded yet for this organisation.
        </div>
      ) : (
        <div className="space-y-3.5">
          {series.map((row) => {
            const widthPct = Math.round((row.count / maxVal) * 100);
            const sharePct = Math.round((row.count / total) * 100);
            return (
              <div key={row.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">{row.label}</span>
                  <span className="font-mono tabular-nums text-slate-600">
                    {row.count} ({sharePct}%)
                  </span>
                </div>
                <svg className="w-full h-3 block" viewBox="0 0 100 6" preserveAspectRatio="none" aria-label={`${row.label}: ${row.count}`}>
                  <rect x="0" y="0" width="100" height="6" rx="2" fill="#F1F5F9" />
                  <rect x="0" y="0" width={Math.max(row.count > 0 ? 3 : 0, widthPct)} height="6" rx="2" fill={row.color} />
                </svg>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export const SiteCoverageChart: React.FC<{
  sites: Site[];
  posts: Post[];
  shifts: Shift[];
  assignments: Assignment[];
}> = ({ sites, posts, shifts, assignments }) => {
  const siteStats = sites.map((site) => {
    const siteShifts = shifts.filter((s) => s.site_id === site.id && s.status !== 'cancelled');
    let required = 0;
    let assigned = 0;

    for (const sh of siteShifts) {
      const post = posts.find((p) => p.id === sh.post_id);
      required += post?.required_guards ?? 1;
      assigned += assignments.filter((a) => a.shift_id === sh.id && a.status !== 'cancelled').length;
    }

    const pct = required > 0 ? Math.min(100, Math.round((assigned / required) * 100)) : 0;
    return { id: site.id, name: site.name, required, assigned, pct };
  });

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-2 mb-4">
        <div>
          <h2 className="font-bold text-slate-900">Deployment &amp; Site Coverage</h2>
          <p className="text-xs text-slate-500">Assigned guards vs. post requirements across published shifts</p>
        </div>
        <span className="text-xs font-mono tabular-nums text-slate-600">{sites.length} site(s)</span>
      </div>

      {siteStats.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">
          Add client sites and shifts to track deployment coverage.
        </div>
      ) : (
        <div className="space-y-3.5">
          {siteStats.map((st) => {
            const barColor = st.required === 0 ? '#94A3B8' : st.pct >= 100 ? '#059669' : '#D97706';
            return (
              <div key={st.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-slate-800 truncate">{st.name}</span>
                  <span className="font-mono tabular-nums text-slate-600 shrink-0">
                    {st.assigned}/{st.required} slots ({st.pct}%)
                  </span>
                </div>
                <svg className="w-full h-3 block" viewBox="0 0 100 6" preserveAspectRatio="none" aria-label={`${st.name}: ${st.pct}% covered`}>
                  <rect x="0" y="0" width="100" height="6" rx="2" fill="#F1F5F9" />
                  <rect x="0" y="0" width={Math.max(st.assigned > 0 ? 3 : 0, st.pct)} height="6" rx="2" fill={barColor} />
                </svg>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export interface RecentAppEntry {
  path: string;
  label: string;
  group: string;
  visitedAt: string;
}

const ROUTE_META: Record<string, { label: string; group: string }> = {
  '/app/fieldforce/dashboard': { label: 'FieldForce Command Centre', group: 'FieldForce AI' },
  '/app/fieldforce/employees': { label: 'Guard Directory', group: 'Workforce' },
  '/app/fieldforce/clients': { label: 'Client Accounts', group: 'Operations' },
  '/app/fieldforce/sites': { label: 'Sites & Guarded Posts', group: 'Operations' },
  '/app/fieldforce/schedule': { label: 'Shift Scheduling & Roster', group: 'Scheduling' },
  '/app/fieldforce/attendance': { label: 'Attendance Verification', group: 'Scheduling' },
  '/app/fieldforce/incidents': { label: 'Incident Workspace', group: 'Security' },
  '/app/ai-assistant': { label: 'Procedural SOP Assistant', group: 'Intelligence' },
  '/app/reports': { label: 'Operational Reports & CSV', group: 'Intelligence' },
  '/app/discover': { label: '20-Product Suite Catalogue', group: 'Platform' },
  '/app/settings/audit-log': { label: 'Audit Logs', group: 'Administration' },
  '/app/settings/members': { label: 'Team & Roles', group: 'Administration' },
};

let recentEntries: RecentAppEntry[] = [
  {
    path: '/app/fieldforce/dashboard',
    label: 'FieldForce Command Centre',
    group: 'FieldForce AI',
    visitedAt: new Date().toISOString(),
  },
];

export function recordVisitedApp(pathname: string): void {
  const meta = ROUTE_META[pathname];
  if (!meta) return;
  recentEntries = [
    { path: pathname, label: meta.label, group: meta.group, visitedAt: new Date().toISOString() },
    ...recentEntries.filter((e) => e.path !== pathname),
  ].slice(0, 4);
}

export function getRecentApps(): RecentAppEntry[] {
  return recentEntries;
}

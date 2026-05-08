'use client';

import { ActionCard } from '@/components/ActionCard';
import { InsightsPanels } from '@/components/InsightsPanels';
import { KpiCards } from '@/components/KpiCards';
import { Sidebar } from '@/components/Sidebar';
import { endpointGroups } from '@/lib/endpoints';
import { callHrApi, fetchAuthMe, getDashboardKpis } from '@/lib/hr-api';
import { AuthMeProfile, EndpointAction } from '@/types/hr';
import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEYS = {
  baseUrl: 'hr-dashboard.baseUrl',
  token: 'hr-dashboard.token',
};

const GROUP_MUTATION_PERMISSIONS: Record<string, string[]> = {
  attendance: ['hr:attendance:manage'],
  leave: ['hr:leave:manage', 'hr:leave:approve'],
  permission: ['hr:permission:manage', 'hr:permission:approve'],
  payroll: ['hr:payroll:manage', 'hr:payroll:approve'],
  statutory: ['hr:statutory:manage'],
  essl: ['hr:essl:manage'],
  'staff-finance': ['hr:payroll:manage', 'hr:payroll:approve'],
};

type AttendancePoint = {
  label: string;
  present: number;
};

type LeaveRow = {
  id: string;
  staffName: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  days: number;
  status: string;
};

function monthToDateLabel(raw: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return String(d.getDate()).padStart(2, '0');
}

function buildAttendanceSeries(data: unknown): AttendancePoint[] {
  if (!Array.isArray(data)) return [];
  const counters = new Map<string, number>();

  data.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const row = item as Record<string, unknown>;
    const status = String(row.status ?? '').toUpperCase();
    const date = String(row.date ?? '');
    if (!date) return;
    if (status === 'PRESENT' || status === 'HALF_DAY') {
      counters.set(date, (counters.get(date) ?? 0) + 1);
    }
  });

  return Array.from(counters.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-10)
    .map(([date, present]) => ({
      label: monthToDateLabel(date),
      present,
    }));
}

function toShortDate(raw: unknown): string {
  const text = String(raw ?? '');
  if (!text) return '-';
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return text;
  return d.toISOString().slice(0, 10);
}

function buildPendingLeaveRows(data: unknown): LeaveRow[] {
  if (!Array.isArray(data)) return [];

  return data.slice(0, 8).map((item, index) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const staffObj = (row.staff && typeof row.staff === 'object' ? row.staff : {}) as Record<string, unknown>;
    const leaveTypeObj = (row.leaveType && typeof row.leaveType === 'object' ? row.leaveType : {}) as Record<string, unknown>;

    return {
      id: String(row.id ?? `row-${index}`),
      staffName: String(staffObj.name ?? row.staffName ?? 'Unknown'),
      leaveType: String(leaveTypeObj.name ?? row.leaveTypeName ?? '-'),
      fromDate: toShortDate(row.fromDate),
      toDate: toShortDate(row.toDate),
      days: Number(row.days ?? 0),
      status: String(row.status ?? '-'),
    };
  });
}

export default function HrPage() {
  const [activeGroupId, setActiveGroupId] = useState(endpointGroups[0]?.id ?? 'attendance');
  const [baseUrl, setBaseUrl] = useState('/erp/api');
  const [token, setToken] = useState('');
  const [consoleData, setConsoleData] = useState<string>('No request sent yet.');
  const [busyKpi, setBusyKpi] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profile, setProfile] = useState<AuthMeProfile | null>(null);
  const [attendanceSeries, setAttendanceSeries] = useState<AttendancePoint[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRow[]>([]);

  const [kpis, setKpis] = useState({
    totalStaff: '-',
    presentToday: '-',
    pendingLeaves: '-',
    draftPayroll: '-',
  });

  const permissions = profile?.permissions ?? [];

  function hasAnyPermission(required?: string[]): boolean {
    if (!required || required.length === 0) return true;
    if (!profile) return true;
    return required.some((perm) => permissions.includes(perm));
  }

  const visibleGroups = useMemo(() => {
    return endpointGroups.filter((group) => hasAnyPermission(group.requiredAnyPermissions));
  }, [profile, permissions]);

  const hrDashboardAccess = hasAnyPermission(['hr:dashboard']);

  function canRunAction(groupId: string, action: EndpointAction): boolean {
    if (!profile) return true;
    if (action.method === 'GET') return true;
    const required = GROUP_MUTATION_PERMISSIONS[groupId] ?? [];
    return required.some((perm) => permissions.includes(perm));
  }

  const activeGroup = useMemo(() => {
    return visibleGroups.find((group) => group.id === activeGroupId) ?? visibleGroups[0];
  }, [activeGroupId, visibleGroups]);

  useEffect(() => {
    const storedBaseUrl = window.localStorage.getItem(STORAGE_KEYS.baseUrl);
    const storedToken = window.localStorage.getItem(STORAGE_KEYS.token);
    if (storedBaseUrl) setBaseUrl(storedBaseUrl);
    if (storedToken) setToken(storedToken);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.baseUrl, baseUrl);
  }, [baseUrl]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.token, token);
  }, [token]);

  useEffect(() => {
    if (!activeGroup && visibleGroups.length > 0) {
      setActiveGroupId(visibleGroups[0].id);
    }
  }, [activeGroup, visibleGroups]);

  async function loadMyAccess() {
    setProfileBusy(true);
    try {
      const me = await fetchAuthMe({ baseUrl, token });
      setProfile(me);
      setConsoleData(JSON.stringify({ auth: me }, null, 2));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setConsoleData(JSON.stringify({ error: 'Failed to load /auth/me', message }, null, 2));
    } finally {
      setProfileBusy(false);
    }
  }

  async function runAction(args: {
    action: EndpointAction;
    pathParams: Record<string, string>;
    query: Record<string, string>;
    body?: unknown;
  }) {
    const result = await callHrApi(
      { baseUrl, token },
      args.action.method,
      args.action.path,
      {
        pathParams: args.pathParams,
        query: args.query,
        body: args.body,
      },
    );
    setConsoleData(JSON.stringify(result, null, 2));
  }

  async function refreshKpis() {
    setBusyKpi(true);
    try {
      const month = new Date().toISOString().slice(0, 7);

      const [dashboardRes, payrollRes, attendanceRes, leaveRes] = await Promise.all([
        callHrApi({ baseUrl, token }, 'GET', '/hr/dashboard'),
        callHrApi({ baseUrl, token }, 'GET', '/hr/payroll', {
          query: {
            month,
            status: 'DRAFT',
          },
        }),
        callHrApi({ baseUrl, token }, 'GET', '/hr/attendance', {
          query: { month },
        }),
        callHrApi({ baseUrl, token }, 'GET', '/hr/leave/applications', {
          query: { status: 'PENDING' },
        }),
      ]);

      const parsed = getDashboardKpis(dashboardRes.data);
      const payrollRows = Array.isArray(payrollRes.data) ? payrollRes.data.length : 0;
      const attendancePoints = buildAttendanceSeries(attendanceRes.data);
      const pendingLeaveRows = buildPendingLeaveRows(leaveRes.data);

      setKpis({
        ...parsed,
        draftPayroll: String(payrollRows),
      });
      setAttendanceSeries(attendancePoints);
      setPendingLeaves(pendingLeaveRows);

      setConsoleData(
        JSON.stringify(
          {
            dashboard: dashboardRes,
            draftPayrollCount: payrollRows,
            attendancePoints,
            pendingLeaves: pendingLeaveRows,
          },
          null,
          2,
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setConsoleData(JSON.stringify({ error: message }, null, 2));
    } finally {
      setBusyKpi(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface text-slate-900">
      <Sidebar groups={visibleGroups} activeGroupId={activeGroupId} onChange={setActiveGroupId} />

      <header className="sticky top-0 z-20 border-b border-line/50 bg-surface/85 backdrop-blur md:ml-64">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3 md:px-8">
          <h2 className="text-2xl font-black tracking-tight text-primary">HR Intelligence</h2>
          <input
            className="min-w-[220px] flex-1 rounded-full border border-line bg-white px-4 py-2 text-sm"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="Base URL (default /erp/api)"
          />
          <input
            className="min-w-[220px] flex-1 rounded-full border border-line bg-white px-4 py-2 text-sm"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Bearer token"
          />
          <button
            type="button"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-70"
            disabled={busyKpi}
            onClick={refreshKpis}
          >
            {busyKpi ? 'Refreshing...' : 'Refresh KPIs'}
          </button>
          <button
            type="button"
            className="rounded-xl border border-primary px-4 py-2 text-sm font-bold text-primary disabled:opacity-70"
            disabled={profileBusy}
            onClick={loadMyAccess}
          >
            {profileBusy ? 'Loading access...' : 'Load My Access'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-8 px-4 py-6 md:ml-64 md:px-8">
        {!hrDashboardAccess && profile ? (
          <section className="rounded-xl border border-rose-200 bg-rose-50 p-6">
            <h3 className="text-xl font-extrabold text-rose-700">Access Blocked</h3>
            <p className="mt-1 text-sm text-rose-700/90">
              Your account does not include the required permission: hr:dashboard.
            </p>
          </section>
        ) : null}

        <section>
          <h3 className="text-3xl font-extrabold text-primary">Institutional Overview</h3>
          <p className="mt-1 text-sm text-slate-600">Production-ready frontend module with full HR backend action coverage.</p>
          {profile ? (
            <p className="mt-1 text-xs text-slate-500">
              Signed in as {profile.email ?? 'unknown'} ({profile.role ?? 'unknown role'})
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">Access profile not loaded yet. Click "Load My Access" to enforce permission guards.</p>
          )}
          <div className="mt-4">
            <KpiCards
              totalStaff={kpis.totalStaff}
              presentToday={kpis.presentToday}
              pendingLeaves={kpis.pendingLeaves}
              draftPayroll={kpis.draftPayroll}
            />
          </div>
        </section>

        <InsightsPanels attendanceSeries={attendanceSeries} pendingLeaves={pendingLeaves} />

        <section className="rounded-xl border border-line/50 bg-panel p-4 shadow">
          <h4 className="text-base font-extrabold text-primary">Response Console</h4>
          <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-[#0b2239] p-4 text-xs text-[#d9ecff]">{consoleData}</pre>
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h4 className="text-xl font-extrabold text-primary">{activeGroup?.label} actions</h4>
              <p className="text-sm text-slate-600">All backend filters and DTO fields are exposed in these forms.</p>
            </div>
            <div className="md:hidden">
              <select
                value={activeGroupId}
                onChange={(e) => setActiveGroupId(e.target.value)}
                className="rounded-lg border border-line bg-white p-2 text-sm"
              >
                {visibleGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {activeGroup?.actions.map((action) => (
              <ActionCard
                key={`${action.method}-${action.path}-${action.title}`}
                action={action}
                onRun={runAction}
                disabled={!canRunAction(activeGroup.id, action)}
                disabledReason="Missing manage/approve permission"
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

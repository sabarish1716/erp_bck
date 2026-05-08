import { ApiResult, AuthMeProfile, HrClientConfig, HttpMethod } from '@/types/hr';

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim() || '/erp/api';
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function buildQuery(query: Record<string, string>): string {
  const entries = Object.entries(query).filter(([, value]) => value !== '');
  if (!entries.length) return '';
  const search = new URLSearchParams(entries);
  return `?${search.toString()}`;
}

function resolvePath(path: string, pathParams: Record<string, string>): string {
  let result = path;
  for (const [key, value] of Object.entries(pathParams)) {
    result = result.replace(`:${key}`, encodeURIComponent(value));
  }
  return result;
}

export async function callHrApi(
  config: HrClientConfig,
  method: HttpMethod,
  path: string,
  options?: {
    pathParams?: Record<string, string>;
    query?: Record<string, string>;
    body?: unknown;
  },
): Promise<ApiResult> {
  const base = normalizeBaseUrl(config.baseUrl);
  const finalPath = resolvePath(path, options?.pathParams ?? {});
  const query = buildQuery(options?.query ?? {});
  const url = `${base}${finalPath}${query}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (config.token) {
    headers.Authorization = `Bearer ${config.token}`;
  }

  if (method !== 'GET' && method !== 'DELETE') {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method,
    headers,
    body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify(options?.body ?? {}),
  });

  const raw = await res.text();
  let data: unknown = null;

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }

  if (!res.ok) {
    throw new Error(`${method} ${finalPath} failed (${res.status}): ${JSON.stringify(data)}`);
  }

  return {
    ok: true,
    status: res.status,
    method,
    endpoint: `${finalPath}${query}`,
    data,
  };
}

export function getDashboardKpis(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return {
      totalStaff: '-',
      presentToday: '-',
      pendingLeaves: '-',
    };
  }

  const row = payload as Record<string, unknown>;

  const totalStaff = row.totalStaff ?? row.staffCount ?? row.totalEmployees ?? '-';
  const present = row.presentPercentage ?? row.attendancePercent ?? row.presentToday ?? '-';
  const pendingLeaves = row.pendingLeave ?? row.pendingLeaves ?? row.leavePendingCount ?? '-';

  return {
    totalStaff: String(totalStaff),
    presentToday: String(present).includes('%') ? String(present) : `${present}%`,
    pendingLeaves: String(pendingLeaves),
  };
}

export async function fetchAuthMe(config: HrClientConfig): Promise<AuthMeProfile> {
  const response = await callHrApi(config, 'GET', '/auth/me');
  const data = response.data as Record<string, unknown> | null;
  if (!data || typeof data !== 'object') {
    return {};
  }

  const permissions = Array.isArray(data.permissions)
    ? data.permissions.filter((p): p is string => typeof p === 'string')
    : [];

  return {
    id: (data.id as string | number | undefined) ?? undefined,
    email: (data.email as string | undefined) ?? undefined,
    role: (data.role as string | undefined) ?? undefined,
    permissions,
  };
}

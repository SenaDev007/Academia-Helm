/**
 * staffAdminAssignmentService — Client frontend pour les affectations admin
 */
import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';

export interface StaffAdminAssignment {
  id: string;
  tenantId: string;
  staffId: string;
  schoolLevelCode: string;
  adminRole: string;
  academicYearId: string | null;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  staff?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    employeeNumber?: string;
  };
}

async function saaFetch<T>(path: string, options?: { method?: string; body?: any; query?: Record<string, string | undefined> }): Promise<T> {
  const method = options?.method ?? 'GET';
  const qs = options?.query
    ? '?' + Object.entries(options.query).filter(([, v]) => v).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
    : '';
  const url = `/api/staff-admin-assignments/${path.replace(/^\//, '')}${qs}`;
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...getClientAuthorizationHeader() },
    credentials: 'include',
    cache: 'no-store',
    ...(options?.body && { body: JSON.stringify(options.body) }),
  });
  const text = await res.text();
  if (!res.ok) {
    let err: { message?: string; error?: string } = {};
    if (text.trim()) { try { err = JSON.parse(text); } catch {} }
    throw new Error(err.message ?? err.error ?? res.statusText ?? 'Erreur réseau');
  }
  if (!text.trim()) return null as T;
  try { return JSON.parse(text) as T; } catch { throw new Error('Réponse invalide'); }
}

export const staffAdminAssignmentService = {
  list: (filters?: { staffId?: string; schoolLevelCode?: string; adminRole?: string; isActive?: boolean }): Promise<StaffAdminAssignment[]> =>
    saaFetch<StaffAdminAssignment[]>('', { query: filters as any }),
  getByStaff: (staffId: string): Promise<StaffAdminAssignment[]> =>
    saaFetch<StaffAdminAssignment[]>(`staff/${staffId}`),
  resolveLevels: (staffId: string): Promise<{ staffId: string; levelCodes: string[] }> =>
    saaFetch<{ staffId: string; levelCodes: string[] }>(`resolve-levels/${staffId}`),
  create: (data: { staffId: string; schoolLevelCode: string; adminRole: string; academicYearId?: string }): Promise<StaffAdminAssignment> =>
    saaFetch<StaffAdminAssignment>('', { method: 'POST', body: data }),
  update: (id: string, data: Partial<{ schoolLevelCode: string; adminRole: string; academicYearId: string | null; isActive: boolean }>): Promise<StaffAdminAssignment> =>
    saaFetch<StaffAdminAssignment>(id, { method: 'PUT', body: data }),
  delete: (id: string): Promise<{ success: boolean }> =>
    saaFetch<{ success: boolean }>(id, { method: 'DELETE' }),
};

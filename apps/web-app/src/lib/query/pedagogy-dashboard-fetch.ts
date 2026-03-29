/**
 * Fetchers HTTP pour le tableau de bord pédagogique (routes Next /api).
 */
export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(err.message ?? err.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export function pedagogyControlDashboardUrl(academicYearId: string) {
  return `/api/pedagogy/control/dashboard?academicYearId=${encodeURIComponent(academicYearId)}`;
}

export function pedagogyControlSnapshotsUrl(academicYearId: string) {
  return `/api/pedagogy/control/snapshots?academicYearId=${encodeURIComponent(academicYearId)}`;
}

export function pedagogyOrionAdvancedUrl(academicYearId: string) {
  return `/api/pedagogy/orion-advanced/dashboard?academicYearId=${encodeURIComponent(academicYearId)}`;
}

export function pedagogyOrionKpisUrl(academicYearId: string) {
  return `/api/pedagogy/orion/kpis?academicYearId=${encodeURIComponent(academicYearId)}`;
}

export function pedagogyStructureLevelsUrl(academicYearId: string) {
  return `/api/pedagogy/academic-structure/levels?academicYearId=${encodeURIComponent(academicYearId)}`;
}

export function timetablesForYearUrl(academicYearId: string) {
  return `/api/timetables?academicYearId=${encodeURIComponent(academicYearId)}`;
}

export function roomsForYearUrl(academicYearId: string) {
  return `/api/rooms?academicYearId=${encodeURIComponent(academicYearId)}`;
}

export const SUBJECTS_API = '/api/subjects';

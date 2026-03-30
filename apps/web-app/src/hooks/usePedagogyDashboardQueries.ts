'use client';

import { useQueries, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { pedagogyKeys } from '@/lib/query/pedagogy-keys';
import {
  fetchJson,
  pedagogyControlDashboardUrl,
  pedagogyControlSnapshotsUrl,
  pedagogyOrionAdvancedUrl,
  pedagogyOrionKpisUrl,
  pedagogyStructureLevelsUrl,
  SUBJECTS_API,
  timetablesForYearUrl,
  roomsForYearUrl,
} from '@/lib/query/pedagogy-dashboard-fetch';

type LoadSlice<T> = { ok: true; data: T } | { ok: false; error: string };

function sliceFromQuery<T>(
  q: UseQueryResult<T>,
  errorLabel: string,
): LoadSlice<T> | null {
  if (q.isLoading) return null;
  if (q.isError) {
    const msg = q.error instanceof Error ? q.error.message : errorLabel;
    return { ok: false, error: msg };
  }
  if (q.data !== undefined) return { ok: true, data: q.data };
  return null;
}

const STALE_MS = 60 * 1000;

/**
 * Agrégats parallèles du tableau de bord pédagogique (cache TanStack Query, invalidation globale possible).
 */
export function usePedagogyDashboardQueries(
  academicYearId: string | undefined,
  tenantIdForStructure?: string,
) {
  const enabled = !!academicYearId;
  const y = academicYearId ?? '';

  const results = useQueries({
    queries: [
      {
        queryKey: pedagogyKeys.controlDashboard(y),
        queryFn: () => fetchJson(pedagogyControlDashboardUrl(y)),
        enabled,
        staleTime: STALE_MS,
      },
      {
        queryKey: pedagogyKeys.controlSnapshots(y),
        queryFn: () => fetchJson<unknown[]>(pedagogyControlSnapshotsUrl(y)),
        enabled,
        staleTime: STALE_MS,
      },
      {
        queryKey: pedagogyKeys.orionAdvancedDashboard(y),
        queryFn: () => fetchJson(pedagogyOrionAdvancedUrl(y)),
        enabled,
        staleTime: STALE_MS,
      },
      {
        queryKey: pedagogyKeys.orionKpis(y),
        queryFn: () => fetchJson(pedagogyOrionKpisUrl(y)),
        enabled,
        staleTime: STALE_MS,
      },
      {
        queryKey: pedagogyKeys.structureLevels(y, tenantIdForStructure),
        queryFn: async () => {
          const levels = await fetchJson<Array<{ id: string; cycles?: { id: string }[] }>>(
            pedagogyStructureLevelsUrl(y, tenantIdForStructure),
          );
          const arr = Array.isArray(levels) ? levels : [];
          const cycles = arr.reduce(
            (n, l) => n + (Array.isArray(l.cycles) ? l.cycles.length : 0),
            0,
          );
          return { levels: arr.length, cycles };
        },
        enabled,
        staleTime: STALE_MS,
      },
      {
        queryKey: pedagogyKeys.subjectsList(),
        queryFn: () => fetchJson<unknown[]>(SUBJECTS_API),
        enabled,
        staleTime: STALE_MS,
      },
      {
        queryKey: pedagogyKeys.timetablesList(y),
        queryFn: () => fetchJson<unknown[]>(timetablesForYearUrl(y)),
        enabled,
        staleTime: STALE_MS,
      },
      {
        queryKey: pedagogyKeys.roomsList(y),
        queryFn: () => fetchJson<unknown[]>(roomsForYearUrl(y)),
        enabled,
        staleTime: STALE_MS,
      },
    ],
  });

  const [qControl, qSnap, qOrionAdv, qOrionKpis, qStruct, qSubjects, qTt, qRooms] = results;

  const loading = enabled && results.some((r) => r.isLoading);

  const control = sliceFromQuery(qControl, 'Erreur contrôle');

  const rawSnap = sliceFromQuery(qSnap, 'Erreur historique');
  const snapshots =
    rawSnap && rawSnap.ok
      ? { ok: true as const, data: Array.isArray(rawSnap.data) ? rawSnap.data : [] }
      : rawSnap;

  const orionAdv = sliceFromQuery(qOrionAdv, 'Erreur ORION');
  const orionKpis = sliceFromQuery(qOrionKpis, 'Erreur KPI');
  const structure = sliceFromQuery(qStruct, 'Erreur structure');

  const rawSubj = sliceFromQuery(qSubjects, 'Erreur matières');
  const subjectsCount =
    rawSubj && rawSubj.ok
      ? {
          ok: true as const,
          data: Array.isArray(rawSubj.data) ? rawSubj.data.length : 0,
        }
      : rawSubj;

  const rawTt = sliceFromQuery(qTt, 'Erreur EDT');
  const timetableCount =
    rawTt && rawTt.ok
      ? {
          ok: true as const,
          data: Array.isArray(rawTt.data) ? rawTt.data.length : 0,
        }
      : rawTt;

  const rawRooms = sliceFromQuery(qRooms, 'Erreur salles');
  const roomCount =
    rawRooms && rawRooms.ok
      ? {
          ok: true as const,
          data: Array.isArray(rawRooms.data) ? rawRooms.data.length : 0,
        }
      : rawRooms;

  return {
    control,
    snapshots,
    orionAdv,
    orionKpis,
    structure,
    subjectsCount,
    timetableCount,
    roomCount,
    loading,
  };
}

export function useInvalidatePedagogyDashboard() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: pedagogyKeys.all,
    });
}

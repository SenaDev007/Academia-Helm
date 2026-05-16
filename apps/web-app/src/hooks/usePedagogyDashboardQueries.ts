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

export interface ControlDashboardData {
  overallRate: number;
  totalActiveProfiles: number;
  lessonPlanRate: number;
  journalRate: number;
  classLogRate: number;
  weeklyReportRate: number;
}

export interface OrionDashboardData {
  summary: {
    riskFlagsCount: number;
    insightsCount: number;
    criticalRisks: boolean;
  };
  insights: any[];
  riskFlags: any[];
}

export interface KpiSnapshot {
  date: string;
  rate: number;
}

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

export interface PedagogyDashboardQueries {
  control: LoadSlice<ControlDashboardData> | null;
  snapshots: LoadSlice<KpiSnapshot[]> | null;
  advancedOrion: LoadSlice<OrionDashboardData> | null;
  orionKpis: LoadSlice<any> | null;
  structure: LoadSlice<any> | null;
  subjectsCount: LoadSlice<number> | null;
  timetableCount: LoadSlice<number> | null;
  roomCount: LoadSlice<number> | null;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  error: any;
}

/**
 * Agrégats parallèles du tableau de bord pédagogique (cache TanStack Query, invalidation globale possible).
 */
export function usePedagogyDashboardQueries(
  tenantIdForStructure: string | undefined,
  academicYearId: string | undefined,
): PedagogyDashboardQueries {
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

  const isLoading = enabled && results.some((r) => r.isLoading);
  const isError = results.some((r) => r.isError);
  const isFetching = results.some((r) => r.isFetching);
  const error = results.find((r) => r.isError)?.error;

  const control = sliceFromQuery<ControlDashboardData>(qControl as any, 'Erreur contrôle');

  const rawSnap = sliceFromQuery<KpiSnapshot[]>(qSnap as any, 'Erreur historique');
  const snapshots =
    rawSnap && rawSnap.ok
      ? { ok: true as const, data: Array.isArray(rawSnap.data) ? (rawSnap.data as KpiSnapshot[]) : [] }
      : (rawSnap as LoadSlice<KpiSnapshot[]> | null);

  const advancedOrion = sliceFromQuery<OrionDashboardData>(qOrionAdv as any, 'Erreur ORION');
  const orionKpis = sliceFromQuery<any>(qOrionKpis as any, 'Erreur KPI');
  const structure = sliceFromQuery<any>(qStruct as any, 'Erreur structure');

  const rawSubj = sliceFromQuery<any[]>(qSubjects as any, 'Erreur matières');
  const subjectsCount: LoadSlice<number> | null =
    rawSubj && rawSubj.ok
      ? {
          ok: true as const,
          data: Array.isArray(rawSubj.data) ? rawSubj.data.length : 0,
        }
      : (rawSubj as LoadSlice<number> | null);

  const rawTt = sliceFromQuery<any[]>(qTt as any, 'Erreur EDT');
  const timetableCount: LoadSlice<number> | null =
    rawTt && rawTt.ok
      ? {
          ok: true as const,
          data: Array.isArray(rawTt.data) ? rawTt.data.length : 0,
        }
      : (rawTt as LoadSlice<number> | null);

  const rawRooms = sliceFromQuery<any[]>(qRooms as any, 'Erreur salles');
  const roomCount: LoadSlice<number> | null =
    rawRooms && rawRooms.ok
      ? {
          ok: true as const,
          data: Array.isArray(rawRooms.data) ? rawRooms.data.length : 0,
        }
      : (rawRooms as LoadSlice<number> | null);

  return {
    control,
    snapshots,
    advancedOrion,
    orionKpis,
    structure,
    subjectsCount,
    timetableCount,
    roomCount,
    isLoading,
    isError,
    isFetching,
    error,
  };
}

export function useInvalidatePedagogyDashboard() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: pedagogyKeys.all,
    });
}

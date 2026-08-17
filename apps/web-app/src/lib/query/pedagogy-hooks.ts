/**
 * ============================================================================
 * PEDAGOGY HOOKS — Hooks React Query pour le module Pédagogie
 * ============================================================================
 *
 * Hooks pour DirectorPedagogyControl + AttendanceRegisterTab :
 *   - useDirectorPedagogyDashboard
 *   - usePendingCahierJournals / usePendingFiches / usePendingRegisters
 *   - usePendingEvaluations / usePendingCahierTextes
 *   - useMyClasses / useAttendanceRegister / useMonthlyEvaluation
 *   - useMonthlySummary / useAvailableSubjects
 *
 * Tous utilisent pedagogySpaceService + React Query (cache 2 min).
 * ============================================================================
 */

'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { pedagogySpaceService } from '@/services/pedagogy-space.service';
import { pedagogyKeys } from './pedagogy-query-keys';

const DEFAULT_STALE_TIME = 2 * 60 * 1000; // 2 min
const DEFAULT_GC_TIME = 10 * 60 * 1000;   // 10 min

// ─── Director : Dashboard ─────────────────────────────────────────────────────

export function useDirectorPedagogyDashboard(academicYearId: string | null | undefined) {
  return useQuery({
    queryKey: pedagogyKeys.dashboard(academicYearId || ''),
    queryFn: async () => {
      if (!academicYearId) return null;
      try {
        return await pedagogySpaceService.getDirectorPedagogyDashboard(academicYearId);
      } catch (err: any) {
        console.warn('[useDirectorPedagogyDashboard] Error:', err.message);
        return null;
      }
    },
    enabled: !!academicYearId,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

// ─── Director : Pending lists ──────────────────────────────────────────────────

export function usePendingCahierJournals(
  academicYearId: string | null | undefined,
  statusFilter: 'SUBMITTED' | 'VALIDATED' | 'REJECTED' | 'ALL' = 'SUBMITTED',
) {
  return useQuery({
    queryKey: pedagogyKeys.pendingCahierJournals(academicYearId || '', statusFilter),
    queryFn: async () => {
      if (!academicYearId) return [];
      try {
        const data = await pedagogySpaceService.getPendingCahierJournals(academicYearId, statusFilter);
        return Array.isArray(data) ? data : (data?.data ?? []);
      } catch (err: any) {
        console.warn('[usePendingCahierJournals] Error:', err.message);
        return [];
      }
    },
    enabled: !!academicYearId,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

export function usePendingFiches(
  academicYearId: string | null | undefined,
  statusFilter: 'SUBMITTED' | 'VALIDATED' | 'REJECTED' | 'ALL' = 'SUBMITTED',
) {
  return useQuery({
    queryKey: pedagogyKeys.pendingFiches(academicYearId || '', statusFilter),
    queryFn: async () => {
      if (!academicYearId) return [];
      try {
        const data = await pedagogySpaceService.getPendingPedagogicalFiches(academicYearId, statusFilter);
        return Array.isArray(data) ? data : (data?.data ?? []);
      } catch (err: any) {
        console.warn('[usePendingFiches] Error:', err.message);
        return [];
      }
    },
    enabled: !!academicYearId,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

export function usePendingRegisters(
  academicYearId: string | null | undefined,
  statusFilter: 'SUBMITTED' | 'VALIDATED' | 'REJECTED' | 'ALL' = 'SUBMITTED',
) {
  return useQuery({
    queryKey: pedagogyKeys.pendingRegisters(academicYearId || '', statusFilter),
    queryFn: async () => {
      if (!academicYearId) return [];
      try {
        const data = await pedagogySpaceService.getPendingAttendanceRegisters(academicYearId, statusFilter);
        return Array.isArray(data) ? data : (data?.data ?? []);
      } catch (err: any) {
        console.warn('[usePendingRegisters] Error:', err.message);
        return [];
      }
    },
    enabled: !!academicYearId,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

export function usePendingEvaluations(
  academicYearId: string | null | undefined,
  statusFilter: 'SUBMITTED' | 'VALIDATED' | 'REJECTED' | 'ALL' = 'SUBMITTED',
) {
  return useQuery({
    queryKey: pedagogyKeys.pendingEvaluations(academicYearId || '', statusFilter),
    queryFn: async () => {
      if (!academicYearId) return [];
      try {
        const data = await pedagogySpaceService.getPendingMonthlyEvaluations(academicYearId, statusFilter);
        return Array.isArray(data) ? data : (data?.data ?? []);
      } catch (err: any) {
        console.warn('[usePendingEvaluations] Error:', err.message);
        return [];
      }
    },
    enabled: !!academicYearId,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

export function usePendingCahierTextes(academicYearId: string | null | undefined) {
  return useQuery({
    queryKey: pedagogyKeys.pendingCahierTextes(academicYearId || ''),
    queryFn: async () => {
      if (!academicYearId) return [];
      try {
        const data = await pedagogySpaceService.getPendingCahierTextes(academicYearId);
        return Array.isArray(data) ? data : (data?.data ?? []);
      } catch (err: any) {
        console.warn('[usePendingCahierTextes] Error:', err.message);
        return [];
      }
    },
    enabled: !!academicYearId,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

// ─── Director : Detail views (enabled on click) ─────────────────────────────

export function useCahierJournalDetail(id: string | null | undefined) {
  return useQuery({
    queryKey: pedagogyKeys.cahierJournalDetail(id || ''),
    queryFn: async () => {
      if (!id) return null;
      try {
        return await pedagogySpaceService.getCahierJournalDetail(id);
      } catch (err: any) {
        console.warn('[useCahierJournalDetail] Error:', err.message);
        return null;
      }
    },
    enabled: !!id,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useFicheDetail(id: string | null | undefined) {
  return useQuery({
    queryKey: pedagogyKeys.ficheDetail(id || ''),
    queryFn: async () => {
      if (!id) return null;
      try {
        return await pedagogySpaceService.getPedagogicalFicheDetail(id);
      } catch (err: any) {
        console.warn('[useFicheDetail] Error:', err.message);
        return null;
      }
    },
    enabled: !!id,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useRegisterDetail(id: string | null | undefined) {
  return useQuery({
    queryKey: pedagogyKeys.registerDetail(id || ''),
    queryFn: async () => {
      if (!id) return null;
      try {
        return await pedagogySpaceService.getAttendanceRegisterDetail(id);
      } catch (err: any) {
        console.warn('[useRegisterDetail] Error:', err.message);
        return null;
      }
    },
    enabled: !!id,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useEvaluationDetail(id: string | null | undefined) {
  return useQuery({
    queryKey: pedagogyKeys.evaluationDetail(id || ''),
    queryFn: async () => {
      if (!id) return null;
      try {
        return await pedagogySpaceService.getMonthlyEvaluationDetail(id);
      } catch (err: any) {
        console.warn('[useEvaluationDetail] Error:', err.message);
        return null;
      }
    },
    enabled: !!id,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useCahierTexteDetail(id: string | null | undefined) {
  return useQuery({
    queryKey: pedagogyKeys.cahierTexteDetail(id || ''),
    queryFn: async () => {
      if (!id) return null;
      try {
        return await pedagogySpaceService.getCahierTexteDetail(id);
      } catch (err: any) {
        console.warn('[useCahierTexteDetail] Error:', err.message);
        return null;
      }
    },
    enabled: !!id,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

// ─── Teacher : My classes ────────────────────────────────────────────────────

export function useMyClasses(teacherId: string | null | undefined, academicYearId: string | null | undefined) {
  return useQuery({
    queryKey: pedagogyKeys.myClasses(teacherId || '', academicYearId || ''),
    queryFn: async () => {
      if (!teacherId || !academicYearId) return [];
      try {
        const data = await pedagogySpaceService.getMyClasses(teacherId, academicYearId);
        return Array.isArray(data) ? data : (data?.data ?? []);
      } catch (err: any) {
        console.warn('[useMyClasses] Error:', err.message);
        return [];
      }
    },
    enabled: !!teacherId && !!academicYearId,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

// ─── Teacher : Monthly summary ───────────────────────────────────────────────

export function useMonthlySummary(academicYearId: string | null | undefined, classId: string | null | undefined) {
  return useQuery({
    queryKey: pedagogyKeys.monthlySummary(academicYearId || '', classId || ''),
    queryFn: async () => {
      if (!academicYearId || !classId) return null;
      try {
        return await pedagogySpaceService.getMonthlySummary(academicYearId, classId);
      } catch (err: any) {
        console.warn('[useMonthlySummary] Error:', err.message);
        return null;
      }
    },
    enabled: !!academicYearId && !!classId,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

// ─── Teacher : Available subjects (enabled on modal open) ─────────────────────

export function useAvailableSubjects(
  academicYearId: string | null | undefined,
  classId: string | null | undefined,
  teacherId: string | null | undefined,
  enabled: boolean = false
) {
  return useQuery({
    queryKey: pedagogyKeys.availableSubjects(academicYearId || '', classId || '', teacherId || ''),
    queryFn: async () => {
      if (!academicYearId || !classId || !teacherId) return [];
      try {
        const data = await pedagogySpaceService.getAvailableSubjects(academicYearId, classId, teacherId);
        return Array.isArray(data) ? data : (data?.data ?? []);
      } catch (err: any) {
        console.warn('[useAvailableSubjects] Error:', err.message);
        return [];
      }
    },
    enabled: !!academicYearId && !!classId && !!teacherId && enabled,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

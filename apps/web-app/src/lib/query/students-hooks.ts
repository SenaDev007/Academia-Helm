/**
 * ============================================================================
 * STUDENTS HOOKS — Hooks React Query pour le module Élèves
 * ============================================================================
 *
 * Hooks principaux :
 *   - useStudents : liste des élèves
 *   - useAdmissions : liste des admissions
 *   - useEnrollments : liste des inscriptions
 *   - useStudentDetail : détail d'un élève
 *   - useStudentGuardians : tuteurs d'un élève
 *   - useStudentDocuments : documents d'un élève
 *
 * Tous utilisent studentsService comme couche de transport + React Query
 * pour le cache (2-5 min) + dégradation gracieuse au timeout.
 * ============================================================================
 */

'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { studentsService } from '@/services/students.service';
import { studentsKeys } from './students-query-keys';

const DEFAULT_STALE_TIME = 2 * 60 * 1000; // 2 min
const DEFAULT_GC_TIME = 10 * 60 * 1000;   // 10 min

// ─── Students list ─────────────────────────────────────────────────────────

export function useStudents(params: any, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: studentsKeys.list(params),
    queryFn: async () => {
      try {
        const data = await studentsService.getAll(params);
        return Array.isArray(data) ? data : (data?.data ?? []);
      } catch (err: any) {
        console.warn('[useStudents] Error:', err.message);
        return [];
      }
    },
    enabled: options.enabled !== false,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

// ─── Student detail ────────────────────────────────────────────────────────

export function useStudentDetail(id: string | null | undefined) {
  return useQuery({
    queryKey: studentsKeys.detail(id || ''),
    queryFn: async () => {
      if (!id) return null;
      try {
        // Pas de méthode getStudentById — on utilise getAll avec filtre id
        const data = await studentsService.getAll({ id });
        return Array.isArray(data) ? data[0] : (data?.data?.[0] ?? null);
      } catch (err: any) {
        console.warn('[useStudentDetail] Error:', err.message);
        return null;
      }
    },
    enabled: !!id,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

// ─── Admissions ────────────────────────────────────────────────────────────

export function useAdmissions(params: any, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: studentsKeys.admissions(params),
    queryFn: async () => {
      try {
        const data = await studentsService.getAdmissions(params);
        return Array.isArray(data) ? data : (data?.data ?? []);
      } catch (err: any) {
        console.warn('[useAdmissions] Error:', err.message);
        return [];
      }
    },
    enabled: options.enabled !== false,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

export function useAdmissionDetail(id: string | null | undefined) {
  return useQuery({
    queryKey: [...studentsKeys.all, 'admission-detail', id],
    queryFn: async () => {
      if (!id) return null;
      try {
        return await studentsService.getAdmissionById(id);
      } catch (err: any) {
        console.warn('[useAdmissionDetail] Error:', err.message);
        return null;
      }
    },
    enabled: !!id,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

// ─── Enrollments ───────────────────────────────────────────────────────────

export function useEnrollments(params: any, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: studentsKeys.enrollments(params),
    queryFn: async () => {
      try {
        const data = await studentsService.getEnrollments(params);
        return Array.isArray(data) ? data : (data?.data ?? []);
      } catch (err: any) {
        console.warn('[useEnrollments] Error:', err.message);
        return [];
      }
    },
    enabled: options.enabled !== false,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

// ─── Class transfers history ───────────────────────────────────────────────

export function useClassTransfersHistory(academicYearId: string | null | undefined) {
  return useQuery({
    queryKey: [...studentsKeys.all, 'class-transfers', academicYearId],
    queryFn: async () => {
      if (!academicYearId) return [];
      try {
        const data = await studentsService.getClassTransfersHistory(academicYearId);
        return Array.isArray(data) ? data : (data?.data ?? []);
      } catch (err: any) {
        console.warn('[useClassTransfersHistory] Error:', err.message);
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

// ─── Students without physical class ────────────────────────────────────────

export function useStudentsWithoutPhysicalClass(academicYearId: string | null | undefined) {
  return useQuery({
    queryKey: [...studentsKeys.all, 'without-physical-class', academicYearId],
    queryFn: async () => {
      if (!academicYearId) return [];
      try {
        const data = await studentsService.getStudentsWithoutPhysicalClass(academicYearId);
        return Array.isArray(data) ? data : (data?.data ?? []);
      } catch (err: any) {
        console.warn('[useStudentsWithoutPhysicalClass] Error:', err.message);
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

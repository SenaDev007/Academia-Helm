/**
 * ============================================================================
 * SHARED STUDENT QUERIES — Hooks React Query pour données partagées entre onglets
 * ============================================================================
 *
 * AVANT : chaque composant d'onglet faisait ses propres fetch() dans useEffect.
 * → à chaque changement d'onglet, le composant est détruit puis recréé →
 *   rechargement complet des données depuis le backend → lenteur + données vides.
 *
 * MAINTENANT : useQuery avec cache React Query (staleTime 5min, gcTime 1h).
 * → Quand on revient sur un onglet, les données sont instantanément
 *   disponibles depuis le cache (pas de re-fetch si moins de 5 min).
 * ============================================================================
 */

'use client';

import { useCallback } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';

// ─── Invalidation famille « module Élèves » ──────────────────────────
/**
 * ⭐ FIX 2026-09-23 « il faut recharger toute l'app pour voir la modification » :
 * Invalide TOUTES les familles de requêtes du module Élèves d'un seul coup.
 *
 * AVANT : chaque onglet n'invalide que SA propre clé (ex. ['enrollments', yearId])
 * → les autres vues (liste Élèves, stats, classes…) gardent leur cache React
 * Query périmé jusqu'à 2-5 min → l'utilisateur devait recharger toute
 * l'application pour voir sa modification.
 *
 * MAINTENANT : une mutation sur un élève (update, photo, classe, guardian,
 * réinscription, suppression, import…) invalide toute la famille — le ou les
 * onglets affichés se rechargent immédiatement, et tout onglet remonté plus
 * tard refetch automatiquement (cf. refetchOnMount ci-dessous).
 */
export function useInvalidateStudentsData() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    // Préfixes — invalide toutes les variantes (toutes années, tous params)
    queryClient.invalidateQueries({ queryKey: ['enrollments'] });
    queryClient.invalidateQueries({ queryKey: ['students'] }); // couvre aussi studentsKeys.all = ['students', ...]
    queryClient.invalidateQueries({ queryKey: ['student-statistics'] });
    queryClient.invalidateQueries({ queryKey: ['academic-classes'] });
    queryClient.invalidateQueries({ queryKey: ['all-classes'] });
    queryClient.invalidateQueries({ queryKey: ['academic-years'] });
  }, [queryClient]);
}

// ─── Enrollments (inscriptions) ─────────────────────────────────────────
export function useEnrollments(academicYearId?: string) {
  return useQuery({
    queryKey: ['enrollments', academicYearId],
    queryFn: async () => {
      if (!academicYearId) return [];
      const res = await fetch(`/api/students/enrollments?academicYearId=${encodeURIComponent(academicYearId)}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.data || []);
    },
    enabled: !!academicYearId,
    staleTime: 2 * 60 * 1000, // 2 min
    placeholderData: keepPreviousData,
    // ⭐ FIX 2026-09-23 : le défaut GLOBAL est refetchOnMount: false (perf) →
    //    un onglet remonté avec des données > staleTime ne refetchait JAMAIS
    //    et restait périmé « à vie » (jusqu'au F5). Ici on revient au
    //    comportement React Query standard : donnée périmée au montage → refetch
    //    (keepPreviousData évite tout flash pendant le refetch).
    refetchOnMount: true,
  });
}

// ─── Academic Classes (classes officielles) ─────────────────────────────
export function useAcademicClasses(academicYearId?: string) {
  return useQuery({
    queryKey: ['academic-classes', academicYearId],
    queryFn: async () => {
      if (!academicYearId) return [];
      const res = await fetch(
        `/api/academic-classes?isActive=true&academicYearId=${encodeURIComponent(academicYearId)}`,
        { credentials: 'include', cache: 'no-store' },
      );
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.data || data?.classes || []);
    },
    enabled: !!academicYearId,
    staleTime: 5 * 60 * 1000, // 5 min (les classes changent rarement)
    placeholderData: keepPreviousData,
    refetchOnMount: true, // ⭐ cf. FIX 2026-09-23 ci-dessus
  });
}

// ─── Academic Years (années scolaires) ──────────────────────────────────
export function useAcademicYears() {
  return useQuery({
    queryKey: ['academic-years'],
    queryFn: async () => {
      const res = await fetch('/api/academic-years', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.data || []);
    },
    staleTime: 30 * 60 * 1000, // 30 min (les années changent très rarement)
    placeholderData: keepPreviousData,
    refetchOnMount: true, // ⭐ cf. FIX 2026-09-23 (garde 30 min de fraîcheur)
  });
}

// ─── All Classes (classes physiques) ────────────────────────────────────
export function useAllClasses(academicYearId?: string) {
  return useQuery({
    queryKey: ['all-classes', academicYearId],
    queryFn: async () => {
      const url = academicYearId
        ? `/api/all-classes?academicYearId=${encodeURIComponent(academicYearId)}`
        : '/api/all-classes';
      const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 5 * 60 * 1000, // 5 min
    placeholderData: keepPreviousData,
    refetchOnMount: true, // ⭐ cf. FIX 2026-09-23 ci-dessus
  });
}

// ─── Students (liste paginée) ──────────────────────────────────────────
export function useStudents(params: {
  academicYearId?: string;
  page?: number;
  limit?: number;
  schoolLevelId?: string;
  classId?: string;
  status?: string;
  search?: string;
}) {
  const { academicYearId, page = 1, limit = 50, schoolLevelId, classId, status, search } = params;
  const queryKey = ['students', academicYearId, page, limit, schoolLevelId, classId, status, search];

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!academicYearId) return { data: [], total: 0, page: 1, limit: 50, totalPages: 1 };
      const p = new URLSearchParams({
        academicYearId,
        page: String(page),
        limit: String(limit),
      });
      if (schoolLevelId && schoolLevelId !== 'ALL') p.set('schoolLevelId', schoolLevelId);
      if (classId) p.set('classId', classId);
      if (status && status !== 'ALL') p.set('status', status);
      if (search?.trim()) p.set('search', search.trim());

      const res = await fetch(`/api/students?${p}`, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return { data: [], total: 0, page: 1, limit: 50, totalPages: 1 };
      const data = await res.json();
      if (Array.isArray(data)) return { data, total: data.length, page: 1, limit: data.length, totalPages: 1 };
      return data;
    },
    enabled: !!academicYearId,
    staleTime: 2 * 60 * 1000, // 2 min
    placeholderData: keepPreviousData,
    refetchOnMount: true, // ⭐ cf. FIX 2026-09-23 ci-dessus
  });
}

// ─── Statistics (stats élèves) ──────────────────────────────────────────
export function useStudentStatistics(academicYearId?: string, schoolLevelId?: string) {
  return useQuery({
    queryKey: ['student-statistics', academicYearId, schoolLevelId],
    queryFn: async () => {
      if (!academicYearId) return null;
      const p = new URLSearchParams({ academicYearId });
      if (schoolLevelId) p.set('schoolLevelId', schoolLevelId);
      const res = await fetch(`/api/students/statistics?${p}`, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!academicYearId,
    staleTime: 2 * 60 * 1000, // 2 min
    placeholderData: keepPreviousData,
    refetchOnMount: true, // ⭐ cf. FIX 2026-09-23 ci-dessus
  });
}

/**
 * Contexte partagé pour l'année scolaire courante.
 * Un seul état pour le sélecteur (header), la sidebar et tout le contenu.
 * Au changement d'année, toute l'app affiche les données de l'année sélectionnée.
 *
 * COMPORTEMENT "ANNÉE STRICTE" :
 * - Quand l'utilisateur bascule vers une autre année, on invalide TOUTES les
 *   queries TanStack pour forcer le rechargement avec la nouvelle année.
 * - On dispatch aussi un CustomEvent 'academic-year-changed' pour informer
 *   les composants hors React (services, hooks personnalisés, etc.).
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppSession } from '@/contexts/AppSessionContext';
import { academicYearsKeys } from '@/lib/query/academic-years-keys';
import { fetchAcademicYearsSnapshot } from '@/lib/query/academic-years-fetch';
import type { AcademicYear } from '@/types/academic-year';

export type { AcademicYear };

/**
 * Nom du CustomEvent dispatch quand l'année scolaire change.
 * Permet aux composants hors React d'écouter le changement.
 */
export const ACADEMIC_YEAR_CHANGED_EVENT = 'academic-year-changed';

/**
 * Clés localStorage utilisées pour la persistance de l'année scolaire :
 * - STORAGE_KEY_ID ('currentAcademicYearId') : juste l'ID, lu par ce contexte
 *   pour restaurer la sélection utilisateur entre les rechargements.
 * - STORAGE_KEY_OBJ ('academicYear') : l'objet année JSON complet, lu par
 *   l'intercepteur Axios (`lib/api/client.ts`) pour injecter le header
 *   `x-academic-year-id` dans toutes les requêtes API sortantes.
 *
 * Les DEUX clés doivent être écrites en parallèle pour éviter le bug où
 * l'intercepteur ne trouve pas l'année (header jamais injecté).
 */
const STORAGE_KEY_ID = 'currentAcademicYearId';
const STORAGE_KEY_OBJ = 'academicYear';

interface AcademicYearContextType {
  currentYear: AcademicYear | null;
  setCurrentYear: (yearId: string) => void;
  availableYears: AcademicYear[];
  isLoading: boolean;
}

const AcademicYearContext = createContext<AcademicYearContextType | undefined>(undefined);

export function AcademicYearProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const { user, tenant } = useAppSession();
  const urlTenantId = searchParams.get('tenant_id');
  const isPlatformOwner = user?.role === 'PLATFORM_OWNER';
  const effectiveTenantId =
    (isPlatformOwner || !tenant?.id ? urlTenantId || tenant?.id : tenant?.id) ?? undefined;
  const tenantKey = effectiveTenantId ?? 'no-tenant';

  const queryClient = useQueryClient();

  const {
    data: availableYears = [],
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: academicYearsKeys.snapshot(tenantKey),
    queryFn: () => fetchAcademicYearsSnapshot(effectiveTenantId),
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const [currentYear, setCurrentYearState] = useState<AcademicYear | null>(null);
  const availableYearsRef = useRef<AcademicYear[]>([]);
  availableYearsRef.current = availableYears;

  /**
   * Invalide toutes les queries TanStack quand l'année scolaire change.
   * Cela force le rechargement des données de tous les modules avec la
   * nouvelle année (dashboard, students, finance, hr, exams, etc.).
   *
   * On préserve les queries liées aux années scolaires elles-mêmes
   * (academicYearsKeys) pour éviter une boucle de rechargement.
   */
  const invalidateQueriesForYearChange = useCallback(() => {
    // Invalider toutes les queries sauf celles liées aux années scolaires
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        if (!Array.isArray(key) || key.length === 0) return true;
        // Préserver les queries 'academic-years' (sinon boucle)
        const firstKey = String(key[0]);
        if (firstKey === 'academic-years') return false;
        return true;
      },
    });
  }, [queryClient]);

  useEffect(() => {
    if (!availableYears.length) {
      if (!isLoading) {
        setCurrentYearState(null);
        // Nettoyer aussi le localStorage quand aucune année n'est disponible
        if (typeof window !== 'undefined') {
          localStorage.removeItem(STORAGE_KEY_ID);
          localStorage.removeItem(STORAGE_KEY_OBJ);
        }
      }
      return;
    }
    const activeYear = availableYears.find((y) => y.isCurrent);
    const savedYearId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_ID) : null;
    const selectedYear =
      activeYear ?? (savedYearId ? availableYears.find((y) => y.id === savedYearId) : null) ?? availableYears[0] ?? null;

    if (selectedYear) {
      const previousYearId = currentYear?.id;
      setCurrentYearState(selectedYear);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_ID, selectedYear.id);
        // Synchroniser aussi l'objet JSON complet pour l'intercepteur Axios
        try {
          localStorage.setItem(STORAGE_KEY_OBJ, JSON.stringify(selectedYear));
        } catch {
          /* ignore quota errors */
        }
      }
      // Si l'année a changé (pas juste le premier chargement), invalider les queries
      if (previousYearId && previousYearId !== selectedYear.id) {
        invalidateQueriesForYearChange();
        // Dispatcher un CustomEvent pour informer les composants hors React
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent(ACADEMIC_YEAR_CHANGED_EVENT, {
              detail: { previousYearId, newYearId: selectedYear.id },
            }),
          );
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableYears, isLoading]);

  const setCurrentYear = useCallback((yearId: string) => {
    const years = availableYearsRef.current;
    const year = years.find((y) => y.id === yearId);
    if (year) {
      const previousYearId = currentYear?.id;
      setCurrentYearState(year);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_ID, yearId);
        // Synchroniser aussi l'objet JSON complet pour l'intercepteur Axios
        try {
          localStorage.setItem(STORAGE_KEY_OBJ, JSON.stringify(year));
        } catch {
          /* ignore quota errors */
        }
      }
      // Si l'année a vraiment changé, invalider toutes les queries TanStack
      // pour forcer le rechargement avec la nouvelle année
      if (previousYearId !== yearId) {
        invalidateQueriesForYearChange();
        // Dispatcher un CustomEvent pour informer les composants hors React
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent(ACADEMIC_YEAR_CHANGED_EVENT, {
              detail: { previousYearId, newYearId: yearId },
            }),
          );
        }
      }
    }
  }, [currentYear?.id, invalidateQueriesForYearChange]);

  const loading = isLoading || (isFetching && availableYears.length === 0);

  const value = useMemo<AcademicYearContextType>(
    () => ({
      currentYear,
      setCurrentYear,
      availableYears,
      isLoading: loading,
    }),
    [currentYear, setCurrentYear, availableYears, loading]
  );

  return <AcademicYearContext.Provider value={value}>{children}</AcademicYearContext.Provider>;
}

export function useAcademicYearContext(): AcademicYearContextType {
  const context = useContext(AcademicYearContext);
  if (context === undefined) {
    throw new Error('useAcademicYearContext must be used within AcademicYearProvider');
  }
  return context;
}


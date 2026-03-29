/**
 * Contexte partagé pour l'année scolaire courante.
 * Un seul état pour le sélecteur (header), la sidebar et tout le contenu.
 * Au changement d'année, toute l'app affiche les données de l'année sélectionnée.
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAppSession } from '@/contexts/AppSessionContext';
import { academicYearsKeys } from '@/lib/query/academic-years-keys';
import { fetchAcademicYearsSnapshot } from '@/lib/query/academic-years-fetch';
import type { AcademicYear } from '@/types/academic-year';

export type { AcademicYear };

const STORAGE_KEY = 'currentAcademicYearId';

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

  useEffect(() => {
    if (!availableYears.length) {
      if (!isLoading) setCurrentYearState(null);
      return;
    }
    const activeYear = availableYears.find((y) => y.isCurrent);
    const savedYearId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    const selectedYear =
      activeYear ?? (savedYearId ? availableYears.find((y) => y.id === savedYearId) : null) ?? availableYears[0] ?? null;

    if (selectedYear) {
      setCurrentYearState(selectedYear);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, selectedYear.id);
      }
    }
  }, [availableYears, isLoading]);

  const setCurrentYear = useCallback((yearId: string) => {
    const years = availableYearsRef.current;
    const year = years.find((y) => y.id === yearId);
    if (year) {
      setCurrentYearState(year);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, yearId);
      }
    }
  }, []);

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

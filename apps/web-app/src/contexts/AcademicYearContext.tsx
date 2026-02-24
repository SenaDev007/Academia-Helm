/**
 * Contexte partagé pour l'année scolaire courante.
 * Un seul état pour le sélecteur (header), la sidebar et tout le contenu.
 * Au changement d'année, toute l'app affiche les données de l'année sélectionnée.
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';

export interface AcademicYear {
  id: string;
  name: string;
  label?: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

const STORAGE_KEY = 'currentAcademicYearId';

interface AcademicYearContextType {
  currentYear: AcademicYear | null;
  setCurrentYear: (yearId: string) => void;
  availableYears: AcademicYear[];
  isLoading: boolean;
}

const AcademicYearContext = createContext<AcademicYearContextType | undefined>(undefined);

export function AcademicYearProvider({ children }: { children: ReactNode }) {
  const [currentYear, setCurrentYearState] = useState<AcademicYear | null>(null);
  const [availableYears, setAvailableYears] = useState<AcademicYear[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const availableYearsRef = useRef<AcademicYear[]>([]);
  availableYearsRef.current = availableYears;

  useEffect(() => {
    const loadAcademicYears = async () => {
      try {
        const response = await fetch('/api/academic-years', { cache: 'no-store', credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          const years: AcademicYear[] = Array.isArray(data)
            ? data.map((y: { id: string; name: string; startDate?: string; endDate?: string; isCurrent?: boolean }) => ({
                id: y.id,
                name: y.name,
                label: y.name,
                startDate: y.startDate ?? '',
                endDate: y.endDate ?? '',
                isCurrent: Boolean(y.isCurrent),
              }))
            : [];
          setAvailableYears(years);

          const activeYear = years.find((y) => y.isCurrent);
          const savedYearId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
          const selectedYear =
            activeYear ?? (savedYearId ? years.find((y) => y.id === savedYearId) : null) ?? years[0] ?? null;

          if (selectedYear) {
            setCurrentYearState(selectedYear);
            if (typeof window !== 'undefined') {
              localStorage.setItem(STORAGE_KEY, selectedYear.id);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load academic years:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAcademicYears();
  }, []);

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

  const value = useMemo<AcademicYearContextType>(
    () => ({
      currentYear,
      setCurrentYear,
      availableYears,
      isLoading,
    }),
    [currentYear, setCurrentYear, availableYears, isLoading]
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

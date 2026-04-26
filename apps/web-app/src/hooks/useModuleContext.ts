/**
 * ============================================================================
 * USE MODULE CONTEXT - HOOK DE CONTEXTE MODULE
 * ============================================================================
 * 
 * Hook pour accéder au contexte du module actif
 * Fournit : academicYear, schoolLevel, academicTrack, tenant
 * 
 * ============================================================================
 */

import { useMemo } from 'react';
import { useAcademicYear } from './useAcademicYear';
import { useSchoolLevel } from './useSchoolLevel';
import { useFeature } from './useFeature';
import { FeatureCode } from '@/lib/features/tenant-features.service';

export interface ModuleContext {
  /** Année scolaire active */
  academicYear: {
    id: string;
    label: string;
    name: string;
  } | null;
  /** Niveau scolaire actif */
  schoolLevel: {
    id: string;
    code: string;
    label: string;
  } | null;
  /** Track académique actif (FR/EN) */
  academicTrack: {
    id: string;
    code: string;
    name: string;
  } | null;
  /** Option bilingue activée */
  isBilingualEnabled: boolean;
  /** Chargement */
  isLoading: boolean;
}

/**
 * Hook pour accéder au contexte du module
 * 
 * @returns ModuleContext
 */
export function useModuleContext(): ModuleContext {
  const { currentYear, isLoading: yearLoading } = useAcademicYear();
  const { currentLevel, isLoading: levelLoading } = useSchoolLevel();
  const { isEnabled: isBilingualEnabled } = useFeature(FeatureCode.BILINGUAL_TRACK);

  // Stable references — prevent infinite re-render loops caused by new object identity on each render.
  // currentYear/currentLevel are stable useState values from their contexts.
  const academicYear = useMemo(
    () =>
      currentYear
        ? {
            id: currentYear.id,
            label: currentYear.label ?? currentYear.name,
            name: currentYear.name || currentYear.label || '',
          }
        : null,
    [currentYear],
  );

  const schoolLevel = useMemo(
    () =>
      currentLevel
        ? { id: currentLevel.id, code: currentLevel.code, label: currentLevel.label || currentLevel.code }
        : null,
    [currentLevel],
  );

  return useMemo(
    () => ({
      academicYear,
      schoolLevel,
      academicTrack: null,
      isBilingualEnabled: isBilingualEnabled || false,
      isLoading: yearLoading || levelLoading,
    }),
    [academicYear, schoolLevel, isBilingualEnabled, yearLoading, levelLoading],
  );
}


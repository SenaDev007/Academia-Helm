/**
 * ============================================================================
 * USE ACADEMIC YEAR HOOK
 * ============================================================================
 *
 * Utilise le contexte partagé (AcademicYearProvider) pour que le sélecteur
 * dans le header et tout le contenu (modules, dashboard, sidebar) voient
 * la même année courante. Au changement d'année, toutes les données
 * dans tous les modules basculent vers l'année sélectionnée.
 * Persiste dans localStorage.
 * ============================================================================
 */

import { useAcademicYearContext } from '@/contexts/AcademicYearContext';

export type { AcademicYear } from '@/contexts/AcademicYearContext';

export function useAcademicYear() {
  return useAcademicYearContext();
}

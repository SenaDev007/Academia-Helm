/**
 * ============================================================================
 * USE SCHOOL LEVEL HOOK
 * ============================================================================
 *
 * Utilise le contexte partagé (SchoolLevelProvider) pour que le sélecteur
 * dans le header, la sidebar et tout le contenu voient le même niveau actif.
 * Persiste dans localStorage.
 * ============================================================================
 */

import { useSchoolLevelContext } from '@/contexts/SchoolLevelContext';

export type { SchoolLevel } from '@/contexts/SchoolLevelContext';

export function useSchoolLevel() {
  return useSchoolLevelContext();
}

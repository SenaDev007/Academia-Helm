'use client';

/**
 * ============================================================================
 * USE VISIBLE PEDAGOGY TABS — onglets pédagogie filtrés rôle × niveau
 * ============================================================================
 *
 * ⭐ 2026-09-15 — Filtrage par niveau scolaire : la « Planification annuelle »
 * est une fonctionnalité MATERNELLE + PRIMAIRE (classes CI à CM2 + Maternelle).
 * Un utilisateur restreint au SEUL secondaire (directeur du secondaire,
 * enseignant du secondaire) ne doit pas voir l'onglet. Le promoteur voit tout.
 *
 * Ce hook combine le filtrage par rôle existant (getVisiblePedagogyTabs,
 * pedagogy-tabs.tsx — permissif / fail-open) avec le périmètre niveau réactif
 * (useSecondaryOnlyUser). Il remplace les appels directs
 * `getVisiblePedagogyTabs(userRole)` dans les pages du module pédagogie.
 */

import { useMemo } from 'react';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useSecondaryOnlyUser } from '@/hooks/useSecondaryOnlyUser';
import {
  getVisiblePedagogyTabs,
  PedagogySubmoduleTab,
} from '@/components/pedagogy/pedagogy-tabs';

export function useVisiblePedagogyTabs(): PedagogySubmoduleTab[] {
  const { user } = useAppSession();
  const isSecondaryOnly = useSecondaryOnlyUser();
  const userRole = user?.role || '';
  return useMemo(
    () => getVisiblePedagogyTabs(userRole, { secondaryOnly: isSecondaryOnly }),
    [userRole, isSecondaryOnly],
  );
}

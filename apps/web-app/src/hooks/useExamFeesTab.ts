'use client';

/**
 * ============================================================================
 * useExamFeesTab — visibilité de l'onglet « Frais des examens » (module Finance)
 * ============================================================================
 *
 * ⭐ Exigence promoteur (oct. 2026) :
 *    L'onglet « Frais des examens » apparaît quand les frais d'examens sont
 *    paramétrés — et, pour être découvrable dès la configuration de l'école,
 *    dès qu'au moins un sous-onglet d'examen est éligible (niveau activé dans
 *    Paramètres > Structure + classe à examen présente pour l'année).
 *    Une école purement maternelle ne voit donc jamais cet onglet.
 *
 * Signaux (en parallèle) :
 *   1. /api/school-levels        → niveaux ACTIVÉS (codes MATERNELLE/PRIMAIRE/SECONDAIRE)
 *   2. /api/all-classes?yearId=  → classes physiques de l'année
 *   3. /api/finance/fee-structures?feeType=EXAMEN → structures d'examen existantes
 *
 * Visible ⇔ (≥1 sous-onglet éligible) OU (≥1 structure EXAMEN pour l'année).
 */

import { useEffect, useState } from 'react';
import { financeService } from '@/services/finance.service';
import { getVisibleExamSubTabs } from '@/lib/finance/exam-fees';

export function useExamFeesTab(academicYearId?: string | null): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!academicYearId) {
      setVisible(false);
      return;
    }
    let cancelled = false;

    (async () => {
      const [levelsRes, classesRes, structuresRes] = await Promise.allSettled([
        fetch('/api/school-levels', { credentials: 'include' })
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        fetch(`/api/all-classes?academicYearId=${encodeURIComponent(academicYearId)}`, {
          credentials: 'include',
        })
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        financeService
          .getFeeStructures({ academicYearId, feeType: 'EXAMEN' })
          .catch(() => []),
      ]);
      if (cancelled) return;

      const levels = levelsRes.status === 'fulfilled' && Array.isArray(levelsRes.value)
        ? levelsRes.value
        : [];
      const classes = classesRes.status === 'fulfilled' && Array.isArray(classesRes.value)
        ? classesRes.value
        : (classesRes.status === 'fulfilled' && classesRes.value?.data
          ? classesRes.value.data
          : []);
      const structures = structuresRes.status === 'fulfilled' && Array.isArray(structuresRes.value)
        ? structuresRes.value
        : [];

      const levelCodes = levels.map((l: any) => l?.code || l?.name || '');
      const subTabs = getVisibleExamSubTabs(levelCodes, classes);
      setVisible(subTabs.length > 0 || structures.length > 0);
    })();

    return () => {
      cancelled = true;
    };
  }, [academicYearId]);

  return visible;
}

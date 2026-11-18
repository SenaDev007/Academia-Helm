'use client';

import GeneralExamFeesContent from '@/components/finance/GeneralExamFeesContent';

/**
 * ⭐ ONGLET « FRAIS GÉNÉRAUX » (juste après Comptes élèves) — route /app/finance/general-fees
 *
 * ⭐ Fusion (nov. 2026, demande promoteur) : les anciens onglets « Frais
 *    généraux » et « Frais des examens » sont fusionnés en UN SEUL onglet
 *    « Frais généraux » avec deux sous-onglets internes :
 *      • Frais généraux   — listing par élève (dus / payé / solde) ;
 *      • Frais des examens — suivi par examen national (CEP/BEPC/BAC/CAP),
 *        visible seulement si l'école a un examen éligible.
 *
 * L'ancienne route /app/finance/exam-fees rend le même composant avec le
 * sous-onglet examens pré-sélectionné (liens existants préservés).
 */
export default function GeneralFeesPage() {
  return <GeneralExamFeesContent initialSubTab="general" />;
}

/**
 * ============================================================================
 * SOUS-MODULE 7 — Rapports financiers (page wrapper)
 * ============================================================================
 *
 * Layout : le ModuleHeader + SubModuleNavigation sont déjà rendus par
 * `app/finance/layout.tsx` (pattern commun à tout le module Finance).
 * Cette page ne fait que rendre le contenu métier.
 *
 * Refonte :
 *   - 4 sous-onglets internes : Bilan périodique, État des arriérés,
 *     Journal de caisse, Comparatif & Projections.
 *   - Filtres dynamiques par sous-onglet.
 *   - Export PDF + Excel selon le pattern Encaissements (drawOfficialHeader,
 *     formatAmount, formatAmountFCFA — logo école + drapeau Bénin).
 * ============================================================================
 */
'use client';

import FinanceReportsContent from '@/components/finance/FinanceReportsContent';

export default function FinanceReportsPage() {
  return <FinanceReportsContent />;
}

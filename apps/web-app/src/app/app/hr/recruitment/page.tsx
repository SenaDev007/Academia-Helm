'use client';

import { useSearchParams } from 'next/navigation';
import { HRShell } from '../_components/HRShell';
import { RecruitmentWorkspace } from '../_components/workspaces/RecruitmentWorkspace';

/**
 * Page Recrutement.
 *
 * Accepte un paramètre `?tab=` pour pré-sélectionner un sous-tab
 * (utile pour la redirection depuis l'ancien onglet "Embauche").
 *
 * Valeurs valides: jobs, candidates, interviews, tests, embauches, talent_pool.
 * Toute autre valeur est ignorée (fallback vers 'jobs').
 */
export default function RecruitmentPage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as
    | 'jobs' | 'candidates' | 'interviews' | 'tests' | 'embauches' | 'talent_pool'
    | null;

  // Validation du tab — si invalide, on retourne undefined (fallback default)
  const VALID_TABS = new Set(['jobs', 'candidates', 'interviews', 'tests', 'embauches', 'talent_pool']);
  const initialTab = tabParam && VALID_TABS.has(tabParam) ? tabParam : undefined;

  return (
    <HRShell
      activeId="recruitment"
      title="Recrutement"
      description="Plateforme d'Intelligence de Talents Helm (HTIP) — Publiez des offres, gérez les candidatures, planifiez les entretiens et finalisez les embauches."
    >
      <RecruitmentWorkspace initialTab={initialTab} />
    </HRShell>
  );
}

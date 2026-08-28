'use client';

import { HRShell } from '../_components/HRShell';
import UnifiedAdministrationWorkspace from '@/components/hr/UnifiedAdministrationWorkspace';

export default function AdministrationPage() {
  return (
    <HRShell
      activeId="administration"
      title="Administration"
      description="Centralisez l'équipe administrative et enseignante par niveau scolaire et par piste linguistique (FR/EN) si bilingue. Affectez directeurs, secrétaires, comptables, censeurs, surveillants et enseignants."
    >
      <UnifiedAdministrationWorkspace />
    </HRShell>
  );
}

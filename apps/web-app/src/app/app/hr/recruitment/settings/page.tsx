'use client';

import { HRShell } from '../../_components/HRShell';
import RecruiterSettingsWorkspace from '@/components/hr/RecruiterSettingsWorkspace';

export default function RecruiterSettingsPage() {
  return (
    <HRShell
      activeId="recruiter-settings"
      title="Paramètres du Recruteur"
      description="Configurez l'identité du recruteur (promoteur, RH dédié ou délégué), ses coordonnées et sa signature pour personnaliser les emails envoyés aux candidats."
    >
      <RecruiterSettingsWorkspace />
    </HRShell>
  );
}

'use client';

import { HRShell } from '../../_components/HRShell';
import RecruiterSettingsWorkspace from '@/components/hr/RecruiterSettingsWorkspace';

export default function RecruiterSettingsPage() {
  return (
    <HRShell
      activeId="recruiter-settings"
      title="Paramètres du Recruteur"
      titleEn="Recruiter Settings"
      description="Configurez l'identité du recruteur (promoteur, RH dédié ou délégué), ses coordonnées et sa signature pour personnaliser les emails envoyés aux candidats."
      descriptionEn="Configure the recruiter identity (promoter, dedicated HR or delegate), contact details and signature to personalise the emails sent to candidates."
    >
      <RecruiterSettingsWorkspace />
    </HRShell>
  );
}

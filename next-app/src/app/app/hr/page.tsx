'use client';

import { HRShell } from './_components/HRShell';
import { HROverview } from './_components/HROverview';

export default function HRPage() {
  return (
    <HRShell
      activeId="overview"
      title="Personnel, RH & Paie"
      description="Gestion complète du personnel, des contrats, des présences, de la paie et des déclarations sociales."
    >
      <HROverview />
    </HRShell>
  );
}

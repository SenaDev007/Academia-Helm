'use client';

import { HRShell } from '../_components/HRShell';
import { IaWorkspace } from '../_components/workspaces/IaWorkspace';

export default function IaPage() {
  return (
    <HRShell
      activeId="ia"
      title="IA RH"
      description="Helm Document Intelligence Engine (HDIE) — Analyse CV/Lettres, scoring, matching intelligent et Copilote RH."
    >
      <IaWorkspace />
    </HRShell>
  );
}

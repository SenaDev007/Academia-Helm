'use client';

import { HRShell } from '../_components/HRShell';
import { IaWorkspace } from '../_components/workspaces/IaWorkspace';

export default function IaPage() {
  return (
    <HRShell
      activeId="ia"
      title="IA RH"
      titleEn="HR AI"
      description="Moteur d'Intelligence Documentaire Helm (HDIE) — Analyse CV/Lettres, notation, correspondance intelligente et Copilote RH."
      descriptionEn="Helm Document Intelligence Engine (HDIE) — CV/letter analysis, scoring, intelligent matching and HR Copilot."
    >
      <IaWorkspace />
    </HRShell>
  );
}

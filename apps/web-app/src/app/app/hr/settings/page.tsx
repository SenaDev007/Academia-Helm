'use client';

import { HRShell } from '../_components/HRShell';
import { SettingsWorkspace } from '../_components/workspaces/SettingsWorkspace';

export default function SettingsPage() {
  return (
    <HRShell
      activeId="settings"
      title="Paramètres RH"
      description="Définition globale des taux de cotisation et taux de fiscalité."
    >
      <SettingsWorkspace />
    </HRShell>
  );
}

'use client';

import { ModuleContainer } from '@/components/modules/blueprint';
import { HR_SUBMODULE_TABS } from '../../../hr-tabs';
import RecruiterSettingsWorkspace from '@/components/hr/RecruiterSettingsWorkspace';

export default function RecruiterSettingsPage() {
  const subModulesList = HR_SUBMODULE_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    href: t.path,
    icon: t.icon,
  }));

  return (
    <ModuleContainer
      header={{
        title: 'Paramètres du Recruteur',
        description:
          "Configurez l'identité du recruteur (promoteur, RH dédié ou délégué), ses coordonnées et sa signature pour personnaliser les emails envoyés aux candidats.",
        icon: 'userCog',
      }}
      subModules={{
        modules: subModulesList,
        activeModuleId: 'recruiter-settings',
      }}
      content={{
        layout: 'custom',
        children: <RecruiterSettingsWorkspace />,
      }}
    />
  );
}

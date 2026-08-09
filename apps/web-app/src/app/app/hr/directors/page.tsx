'use client';

import { ModuleContainer } from '@/components/modules/blueprint';
import { HR_SUBMODULE_TABS } from '../hr-tabs';
import DirectorsWorkspace from '@/components/hr/DirectorsWorkspace';

export default function DirectorsPage() {
  const subModulesList = HR_SUBMODULE_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    href: t.path,
    icon: t.icon,
  }));

  return (
    <ModuleContainer
      header={{
        title: 'Directeurs',
        description:
          "Définissez les directeurs de l'école par niveau scolaire et piste linguistique. Les signatures seront utilisées sur les bulletins et documents officiels.",
        icon: 'userCog',
      }}
      subModules={{
        modules: subModulesList,
        activeModuleId: 'directors',
      }}
      content={{
        layout: 'custom',
        children: <DirectorsWorkspace />,
      }}
    />
  );
}

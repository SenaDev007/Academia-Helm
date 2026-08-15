'use client';

import { ModuleContainer } from '@/components/modules/blueprint';
import { HR_SUBMODULE_TABS } from '../hr-tabs';
import AdministrativeStaffWorkspace from '@/components/hr/AdministrativeStaffWorkspace';

export default function AdministrationPage() {
  const subModulesList = HR_SUBMODULE_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    href: t.path,
    icon: t.icon,
  }));

  return (
    <ModuleContainer
      header={{
        title: 'Administration',
        description:
          "Configurez l'équipe administrative de votre établissement par niveau scolaire : directeurs, secrétaires, comptables, censeurs, surveillants, et bien plus. Les signatures et cachets sont générés automatiquement.",
        icon: 'userCog',
      }}
      subModules={{
        modules: subModulesList,
        activeModuleId: 'administration',
      }}
      content={{
        layout: 'custom',
        children: <AdministrativeStaffWorkspace />,
      }}
    />
  );
}

'use client';

import { GlobalLibraryHub } from '@/components/pedagogy/library/GlobalLibraryHub';
import { ModuleContainer } from '@/components/modules/blueprint';
import { PEDAGOGY_SUBMODULE_TABS } from '@/components/pedagogy/pedagogy-tabs';

export default function GlobalLibraryPage() {
  return (
    <ModuleContainer
      header={{
        title: 'Bibliothèque virtuelle',
        description: 'Hub pédagogique global & ressources institutionnelles',
        icon: 'book',
      }}
      subModules={{
        modules: PEDAGOGY_SUBMODULE_TABS.map((tab) => {
          const Icon = tab.icon;
          return {
            id: tab.id,
            label: tab.label,
            href: tab.path,
            icon: <Icon className="w-4 h-4" />,
          };
        }),
      }}
      content={{
        layout: 'custom',
        children: <GlobalLibraryHub />,
      }}
    />
  );
}

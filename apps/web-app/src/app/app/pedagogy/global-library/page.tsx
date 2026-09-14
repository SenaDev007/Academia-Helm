'use client';

import { GlobalLibraryHub } from '@/components/pedagogy/library/GlobalLibraryHub';
import { ModuleContainer } from '@/components/modules/blueprint';
import { useVisiblePedagogyTabs } from '@/hooks/usePedagogyTabs';

export default function GlobalLibraryPage() {
  const pedagogyVisibleTabs = useVisiblePedagogyTabs();

  return (
    <ModuleContainer
      header={{
        title: 'Bibliothèque virtuelle',
        description: 'Hub pédagogique global & ressources institutionnelles',
        icon: 'book',
      }}
      subModules={{
        modules: pedagogyVisibleTabs.map((tab) => {
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

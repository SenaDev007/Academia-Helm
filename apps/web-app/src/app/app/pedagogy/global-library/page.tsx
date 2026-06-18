'use client';

import { GlobalLibraryHub } from '@/components/pedagogy/library/GlobalLibraryHub';
import { ModuleContainer } from '@/components/modules/blueprint';
import { getVisiblePedagogyTabs } from '@/components/pedagogy/pedagogy-tabs';
import { useAppSession } from '@/contexts/AppSessionContext';

export default function GlobalLibraryPage() {
  const { user } = useAppSession();
  const userRole = user?.role || '';

  return (
    <ModuleContainer
      header={{
        title: 'Bibliothèque virtuelle',
        description: 'Hub pédagogique global & ressources institutionnelles',
        icon: 'book',
      }}
      subModules={{
        modules: getVisiblePedagogyTabs(userRole).map((tab) => {
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

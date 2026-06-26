'use client';

import { CmsWorkspace } from './_components/CmsWorkspace';
import { ModuleContainer } from '@/components/modules/blueprint';

export default function CmsPage() {
  return (
    <ModuleContainer
      header={{
        title: 'Site Institutionnel',
        description: 'Gérez le contenu du site web public de votre établissement.',
        icon: 'globe',
      }}
      content={{
        layout: 'custom',
        children: <CmsWorkspace />,
      }}
    />
  );
}

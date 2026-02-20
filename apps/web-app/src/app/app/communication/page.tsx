/**
 * ============================================================================
 * COMMUNICATION MODULE - MAIN PAGE
 * ============================================================================
 */

'use client';

import { MessageSquare, Smartphone, Calendar, Zap, FileText } from 'lucide-react';
import { ModuleHeader, SubModuleNavigation } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { usePathname } from 'next/navigation';

export default function CommunicationPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const pathname = usePathname();

  const subModuleTabs = [
    { id: 'messages', label: 'Messages', path: '/app/communication/messages', icon: MessageSquare },
    { id: 'templates', label: 'Templates', path: '/app/communication/templates', icon: FileText },
    { id: 'scheduling', label: 'Planification', path: '/app/communication/scheduling', icon: Calendar },
    { id: 'automation', label: 'Automatisation', path: '/app/communication/automation', icon: Zap },
    { id: 'channels', label: 'Canaux', path: '/app/communication/channels', icon: Smartphone },
  ];

  const currentTab = subModuleTabs.find(tab => pathname.startsWith(tab.path))?.id || 'messages';

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Communication & Engagement"
        description="Gestion complète des communications avec les parents, le personnel et les élèves. Messages, templates, planification et automatisation."
        icon="communication"
        kpis={[
          { label: 'Messages envoyés', value: '1,234', unit: 'ce mois' },
          { label: 'Taux de livraison', value: '98.5%', unit: '' },
          { label: 'Templates actifs', value: '12', unit: '' },
          { label: 'Automatisations', value: '8', unit: 'actives' },
        ]}
        actions={[
          { label: 'Nouveau message', onClick: () => console.log('Open new message modal'), primary: true },
          { label: 'Créer template', onClick: () => console.log('Open create template modal') },
        ]}
      />
      <SubModuleNavigation tabs={subModuleTabs} currentPath={pathname} />
      <div className="p-4">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">
          Bienvenue dans le module {subModuleTabs.find(tab => tab.id === currentTab)?.label}
        </h3>
        <p className="text-gray-600">
          Sélectionnez un sous-module ci-dessus pour commencer.
        </p>
      </div>
    </div>
  );
}

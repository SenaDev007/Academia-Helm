'use client';

import React from 'react';
import {
  MessageSquare,
  Smartphone,
  Calendar,
  Zap,
  FileText,
  LayoutDashboard,
  Bell,
  Share2,
  Users,
  User,
  GraduationCap,
  ShieldCheck,
  History,
  BarChart3,
  Settings,
  Inbox,
} from 'lucide-react';
import { ModuleHeader, SubModuleNavigation } from '@/components/modules/blueprint';
import { usePathname } from 'next/navigation';

export default function CommunicationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const subModuleTabs = [
    { id: 'dashboard', label: 'Pilotage', path: '/app/communication/dashboard', icon: LayoutDashboard },
    { id: 'inbox', label: 'Boîte de réception', path: '/app/communication/inbox', icon: Inbox },
    { id: 'messages', label: 'Messagerie', path: '/app/communication/messages', icon: MessageSquare },
    { id: 'announcements', label: 'Annonces', path: '/app/communication/announcements', icon: Bell },
    { id: 'automated-notifications', label: 'Automatisations', path: '/app/communication/automated-notifications', icon: Zap },
    { id: 'campaigns', label: 'Campagnes', path: '/app/communication/campaigns', icon: Share2 },
    { id: 'templates', label: 'Templates', path: '/app/communication/templates', icon: FileText },
    { id: 'parents', label: 'Parents', path: '/app/communication/parents', icon: Users },
    { id: 'teachers', label: 'Enseignants', path: '/app/communication/teachers', icon: GraduationCap },
    { id: 'students', label: 'Élèves', path: '/app/communication/students', icon: User },
    { id: 'administration', label: 'Administration', path: '/app/communication/administration', icon: ShieldCheck },
    { id: 'channels', label: 'Canaux', path: '/app/communication/channels', icon: Smartphone },
    { id: 'history', label: 'Historique', path: '/app/communication/history', icon: History },
    { id: 'reports', label: 'Rapports', path: '/app/communication/reports', icon: BarChart3 },
    { id: 'settings', label: 'Paramètres', path: '/app/communication/settings', icon: Settings },
  ];

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
      <div className="min-h-[600px]">
        {children}
      </div>
    </div>
  );
}

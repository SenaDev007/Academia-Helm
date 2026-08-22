'use client';

import React from 'react';
import { MessageSquare } from 'lucide-react';
import { ModuleHeader, SubModuleNavigation } from '@/components/modules/blueprint';
import { usePathname } from 'next/navigation';

export default function CommunicationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // ⭐ SIMPLIFICATION : on ne garde QUE la Messagerie unifiée (WhatsApp-like)
  //    Les autres onglets (Pilotage, Inbox, Annonces, Campagnes, Templates,
  //    Parents, Enseignants, Élèves, Administration, Canaux, Historique,
  //    Rapports, Paramètres) sont supprimés au profit d'une UX unifiée.
  //    Tout passe par la Messagerie interne qui gère :
  //    - Conversations 1-à-1 (intra + inter-écoles)
  //    - Groupes (création par l'utilisateur)
  //    - Invitations (cross-tenant)
  //    - Pièces jointes (audio, images, documents)
  const subModuleTabs = [
    { id: 'messages', label: 'Messagerie', path: '/app/communication/messages', icon: MessageSquare },
  ];

  return (
    <div className="space-y-4">
      <ModuleHeader
        title="Communication & Engagement"
        description="Messagerie interne unifiée type WhatsApp — échangez avec les enseignants, parents et contacts Academia Helm."
        icon="communication"
      />
      <SubModuleNavigation tabs={subModuleTabs} currentPath={pathname} />
      <div className="min-h-[600px]">
        {children}
      </div>
    </div>
  );
}

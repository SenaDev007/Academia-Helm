'use client';

/**
 * ============================================================================
 * MESSAGES PAGE — Messagerie interne type WhatsApp (côté direction)
 * ============================================================================
 *
 * Page "Messages" du module Communication pour la direction, le promoteur
 * et les administrateurs. Affiche l'interface WhatsApp Chat avec :
 *   - Liste des conversations (sidebar)
 *   - Vue conversation avec bulles de messages
 *   - Recherche d'utilisateurs + invitations
 *   - Création de groupes
 *
 * L'utilisateur peut :
 *   - Discuter avec n'importe quel enseignant de l'école
 *   - Discuter avec le directeur de l'école
 *   - Créer un groupe d'enseignants
 *   - Rechercher des utilisateurs d'autres écoles et leur envoyer des invitations
 * ============================================================================
 */

import { useAppSession } from '@/contexts/AppSessionContext';
import { ModuleContentArea } from '@/components/modules/blueprint';
import WhatsAppChat from '@/components/communication/WhatsAppChat';
import { Loader2 } from 'lucide-react';

export default function MessagesPage() {
  const { user } = useAppSession();
  const currentUserId = user?.id || '';

  if (!currentUserId) {
    return (
      <ModuleContentArea>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          <span className="ml-2 text-sm text-slate-500">Chargement…</span>
        </div>
      </ModuleContentArea>
    );
  }

  return (
    <ModuleContentArea>
      <div className="p-4 sm:p-6">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-slate-900">Messagerie interne</h1>
          <p className="text-sm text-slate-500">
            Communiquez avec les enseignants, la direction et vos contacts Academia Helm
          </p>
        </div>
        <WhatsAppChat
          currentUserId={currentUserId}
          heightClass="h-[calc(100vh-220px)]"
        />
      </div>
    </ModuleContentArea>
  );
}

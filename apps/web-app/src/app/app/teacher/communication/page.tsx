'use client';

/**
 * ============================================================================
 * TEACHER COMMUNICATION — Messagerie interne type WhatsApp
 * ============================================================================
 *
 * Page "Communication" pour les enseignants. Affiche l'interface WhatsApp Chat
 * avec :
 *   - Liste des conversations (sidebar)
 *   - Vue conversation avec bulles de messages
 *   - Discussion avec les collègues enseignants de la même école
 *   - Discussion avec la direction
 *   - Création de groupe d'enseignants
 *   - Recherche d'enseignants d'autres écoles (inter-écoles) + invitations
 *
 * Les enseignants peuvent échanger :
 *   - Des messages texte
 *   - Des fichiers (documents, images, audio)
 *   - Des audios enregistrés (MediaRecorder — non implémenté ici, V2)
 * ============================================================================
 */

import { useAppSession } from '@/contexts/AppSessionContext';
import WhatsAppChat from '@/components/communication/WhatsAppChat';
import { Loader2, MessageSquare } from 'lucide-react';

export default function TeacherCommunicationPage() {
  const { user } = useAppSession();
  const currentUserId = user?.id || '';

  if (!currentUserId) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
        <span className="ml-2 text-sm text-slate-500">Chargement…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-lg">
            <MessageSquare className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Messagerie enseignant</h2>
            <p className="text-xs text-slate-500">
              Échangez avec vos collègues, la direction et vos contacts Academia Helm
            </p>
          </div>
        </div>
      </div>
      <WhatsAppChat
        currentUserId={currentUserId}
        heightClass="h-[calc(100vh-280px)]"
      />
    </div>
  );
}

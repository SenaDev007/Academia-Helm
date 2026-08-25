'use client';

/**
 * ============================================================================
 * TEACHER COMMUNICATION — Yeshua Connect (messagerie type WhatsApp)
 * ============================================================================
 *
 * Page "Communication" pour les enseignants. Affiche Yeshua Connect directement
 * (pas d'en-tête dédié — WhatsAppChat a déjà le sien).
 *
 * Les enseignants peuvent échanger :
 *   - Des messages texte
 *   - Des fichiers (documents, images, audio)
 *   - Des audios enregistrés
 *   - Avec leurs collègues enseignants de la même école
 *   - Avec la direction
 *   - Avec les parents d'élèves de leurs classes
 * ============================================================================
 */

import { useAppSession } from '@/contexts/AppSessionContext';
import WhatsAppChat from '@/components/communication/WhatsAppChat';
import { Loader2 } from 'lucide-react';

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

  // Pas d'en-tête dédié — WhatsAppChat a déjà le sien.
  // Hauteur = viewport - top bar (h-16 = 64px) - padding layout.
  return (
    <WhatsAppChat
      currentUserId={currentUserId}
      heightClass="h-[calc(100vh-128px)]"
    />
  );
}

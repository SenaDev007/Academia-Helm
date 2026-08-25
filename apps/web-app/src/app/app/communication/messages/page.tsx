'use client';

import { useAppSession } from '@/contexts/AppSessionContext';
import WhatsAppChat from '@/components/communication/WhatsAppChat';
import { Loader2 } from 'lucide-react';

/**
 * ⭐ Helm Connect — page de messagerie (renommée depuis "Communication")
 *    Rend le chat WhatsApp-like directement.
 *    Pas de ModuleHeader, pas d'onglets, pas de ModuleContentArea wrapper.
 *    Le chat remplit tout l'écran (moins la sidebar 64px).
 *
 *    Helm Connect = système nerveux communicationnel d'Academia Helm.
 *    Slogan : « Communiquez. Collaborez. Restez connectés. »
 */

export default function MessagesPage() {
  const { user } = useAppSession();
  const currentUserId = user?.id || '';

  if (!currentUserId) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <WhatsAppChat
      currentUserId={currentUserId}
      heightClass="h-full"
    />
  );
}

"use client";

/**
 * ============================================================================
 * PORTAIL PARENT — Yeshua Connect [/app/parent/messages]
 * ============================================================================
 *
 * Refonte août 2026 : la page n'a plus d'en-tête dédié — Yeshua Connect
 * (WhatsAppChat) a son PROPRE en-tête interne (logo + slogan + actions).
 * On évite ainsi la superposition de headers (problème précédent).
 *
 * Pattern identique à /app/app/teacher/communication/page.tsx
 * ============================================================================
 */

import { useAppSession } from "@/contexts/AppSessionContext";
import WhatsAppChat from "@/components/communication/WhatsAppChat";
import { Loader2 } from "lucide-react";

export default function ParentMessagesPage() {
  const { user } = useAppSession();

  if (!user?.id) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  // Pas d'en-tête dédié — WhatsAppChat a déjà le sien (logo + slogan +
  // recherche + actions). On rend le chat en plein écran (moins la sidebar
  // parent 64px + le top bar h-16 du layout).
  return (
    <WhatsAppChat
      currentUserId={user.id}
      heightClass="h-[calc(100vh-128px)]"
      readOnly={false}
    />
  );
}

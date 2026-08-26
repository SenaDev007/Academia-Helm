"use client";

/**
 * ============================================================================
 * PORTAIL PARENT — Helm Connect [/app/parent/messages]
 * ============================================================================
 * ⭐ V3-11: Rend Helm Connect (WhatsAppChat) directement, sans wrapper card.
 *    Même pattern que /app/app/communication/messages/page.tsx (promoteur/directeur)
 *    et /app/app/teacher/communication/page.tsx (enseignant).
 *    Le chat remplit tout l'écran (moins la sidebar + header + main padding).
 * ============================================================================
 */

import { useAppSession } from "@/contexts/AppSessionContext";
import WhatsAppChat from "@/components/communication/WhatsAppChat";
import { Loader2 } from "lucide-react";

export default function ParentMessagesPage() {
  const { user } = useAppSession();
  const currentUserId = user?.id || "";

  if (!currentUserId) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <WhatsAppChat
      currentUserId={currentUserId}
      // ⭐ V3-11: Chat fills the available space (100vh - 64px header - 48px main padding on lg)
      heightClass="h-[calc(100vh-112px)]"
      readOnly={false}
    />
  );
}

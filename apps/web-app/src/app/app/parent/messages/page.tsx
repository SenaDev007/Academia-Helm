"use client";

/**
 * ============================================================================
 * PORTAIL PARENT — Helm Connect [/app/parent/messages]
 * ============================================================================
 *
 * ⭐ Refonte août 2026 : la page n'a plus d'onglets — elle affiche
 *    UNIQUEMENT Helm Connect (WhatsAppChat), comme dans l'UI enseignant.
 *    Les anciens onglets (Notifications, Annonces, Contacter l'école)
 *    ont été supprimés pour simplifier l'interface et mettre le focus
 *    sur la communication directe.
 *
 * Pattern identique à /app/app/teacher/communication/page.tsx
 * ============================================================================
 */

import { useAppSession } from "@/contexts/AppSessionContext";
import WhatsAppChat from "@/components/communication/WhatsAppChat";
import { MessageSquare, Loader2 } from "lucide-react";

export default function ParentMessagesPage() {
  const { user } = useAppSession();

  return (
    <div className="space-y-4">
      {/* En-tête — même pattern que la page enseignant */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-50 rounded-lg">
            <MessageSquare className="h-5 w-5 text-teal-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Helm Connect</h2>
            <p className="text-xs text-slate-500">
              Échangez avec les enseignants et la direction de l'école
            </p>
          </div>
        </div>
      </div>

      {/* ⭐ Helm Connect — seul composant affiché (plus d'onglets) */}
      {user?.id ? (
        <WhatsAppChat
          currentUserId={user.id}
          heightClass="h-[calc(100vh-280px)]"
          readOnly={false}
        />
      ) : (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      )}
    </div>
  );
}

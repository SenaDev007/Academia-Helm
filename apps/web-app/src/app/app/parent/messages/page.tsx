"use client";

/**
 * Parent Portal — Communication
 * Messages avec l'école (redirige vers le module communication existant).
 */

import { MessageSquare } from "lucide-react";
import { redirect } from "next/navigation";
import { useEffect } from "react";

export default function ParentMessagesPage() {
  useEffect(() => { redirect("/app/communication"); }, []);
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="h-5 w-5 text-teal-600" />
          <h2 className="text-lg font-bold text-slate-900">Communication</h2>
        </div>
        <p className="text-sm text-slate-500">Redirection vers la messagerie…</p>
      </div>
    </div>
  );
}

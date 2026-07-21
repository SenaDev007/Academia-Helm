"use client";

/**
 * Teacher Communication — redirects to the communication module.
 */

import { redirect } from "next/navigation";
import { useEffect } from "react";
import { MessageSquare } from "lucide-react";

export default function TeacherCommunicationPage() {
  useEffect(() => {
    redirect("/app/communication");
  }, []);
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="h-5 w-5 text-teal-600" />
          <h2 className="text-lg font-bold text-slate-900">Communication</h2>
        </div>
        <p className="text-sm text-slate-500">Redirection vers la communication…</p>
      </div>
    </div>
  );
}

"use client";

/**
 * Teacher Library — redirects to the library module.
 */

import { redirect } from "next/navigation";
import { useEffect } from "react";
import { Library } from "lucide-react";

export default function TeacherLibraryPage() {
  useEffect(() => {
    redirect("/app/library");
  }, []);
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Library className="h-5 w-5 text-slate-600" />
          <h2 className="text-lg font-bold text-slate-900">Bibliothèque</h2>
        </div>
        <p className="text-sm text-slate-500">Redirection vers la bibliothèque…</p>
      </div>
    </div>
  );
}

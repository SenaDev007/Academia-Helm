"use client";

/**
 * Teacher Tasks — embeds the TeacherTasksWorkspace.
 */

import TeacherTasksWorkspace from "@/components/pedagogy/tasks/TeacherTasksWorkspace";
import { ClipboardList } from "lucide-react";

export default function TeacherTasksPage() {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-2">
          <ClipboardList className="h-5 w-5 text-amber-600" />
          <h2 className="text-lg font-bold text-slate-900">Travaux & Suivi</h2>
        </div>
        <p className="text-sm text-slate-500">
          Vos tâches assignées et le suivi pédagogique.
        </p>
      </div>
      <TeacherTasksWorkspace />
    </div>
  );
}

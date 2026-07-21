"use client";

/**
 * Teacher Timetable — shows the teacher's own schedule.
 * Embeds the TimetablesWorkspace but filtered to the teacher's classes.
 */

import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import TimetablesWorkspace from "@/components/pedagogy/timetables/TimetablesWorkspace";
import { ModuleContainer } from "@/components/modules/blueprint";
import { CalendarDays } from "lucide-react";

export default function TeacherTimetablePage() {
  const { user } = useAppSession();
  const { academicYear } = useModuleContext();

  if (!academicYear?.id) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        Chargement…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-2">
          <CalendarDays className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-bold text-slate-900">Mon Emploi du Temps</h2>
        </div>
        <p className="text-sm text-slate-500">
          Consultez votre emploi du temps par classe et par jour.
        </p>
      </div>
      <TimetablesWorkspace />
    </div>
  );
}

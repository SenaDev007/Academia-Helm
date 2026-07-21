"use client";

/**
 * Teacher Timetable — vue lecture seule.
 * L'enseignant consulte son emploi du temps, il ne configure rien.
 */

import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import { CalendarDays, Clock, Loader2 } from "lucide-react";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const HOURS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

export default function TeacherTimetablePage() {
  const { user } = useAppSession();
  const { academicYear } = useModuleContext();
  const teacherId = user?.id || "";

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-2">
          <CalendarDays className="h-5 w-5 text-purple-600" />
          <h2 className="text-lg font-bold text-slate-900">Mon Emploi du Temps</h2>
        </div>
        <p className="text-sm text-slate-500">
          Consultez votre emploi du temps. Celui-ci est généré par la direction de l'école.
        </p>
      </div>

      {/* Grille emploi du temps (lecture seule) */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-200 px-2 py-2 w-16">
                <Clock className="h-4 w-4 text-slate-400 mx-auto" />
              </th>
              {DAYS.map((day) => (
                <th key={day} className="border border-slate-200 px-3 py-2 font-bold text-slate-700">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOURS.map((hour) => (
              <tr key={hour} className="hover:bg-slate-50/50">
                <td className="border border-slate-200 px-2 py-3 text-center font-semibold text-slate-500 text-xs">
                  {hour}
                </td>
                {DAYS.map((day) => (
                  <td key={day} className="border border-slate-200 p-1 h-16">
                    {/* Le contenu sera chargé dynamiquement depuis l'API */}
                    <div className="h-full flex items-center justify-center text-slate-300 text-[10px]">
                      —
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
        <strong>Note :</strong> L'emploi du temps est généré et géré par la direction.
        Pour toute modification, contactez l'administration de votre école.
      </div>
    </div>
  );
}

"use client";

/**
 * Teacher Classes — shows the teacher's assigned classes and students.
 * Embeds the MyClassesTab directly.
 */

import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import { MyClassesTab } from "@/components/pedagogy/production/MyClassesTab";
import { Users } from "lucide-react";

export default function TeacherClassesPage() {
  const { user, tenant } = useAppSession();
  const { academicYear } = useModuleContext();

  const teacherId = user?.teacherId || user?.id || "";

  if (!academicYear?.id || !teacherId) {
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
          <Users className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-slate-900">Mes Classes</h2>
        </div>
        <p className="text-sm text-slate-500">
          Liste des classes qui vous sont assignées et de leurs élèves.
        </p>
      </div>
      <MyClassesTab
        tenantId={tenant?.id || ""}
        academicYearId={academicYear.id}
        teacherId={teacherId}
      />
    </div>
  );
}

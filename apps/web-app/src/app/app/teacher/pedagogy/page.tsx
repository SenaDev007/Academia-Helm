"use client";

/**
 * Teacher Pedagogy — embeds the PedagogicalSpaceWorkspace directly.
 * The teacher sees ONLY their space (not the full pedagogy module
 * with admin tabs like academic structure, subjects management, etc.)
 */

import { PedagogicalSpaceWorkspace } from "@/components/pedagogy/production/PedagogicalSpaceWorkspace";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";

export default function TeacherPedagogyPage() {
  const { user, tenant } = useAppSession();
  const { academicYear, schoolLevel } = useModuleContext();

  const teacherId = user?.teacherId || user?.id || "";

  if (!academicYear?.id || !teacherId) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        Chargement de l'espace pédagogique…
      </div>
    );
  }

  return (
    <PedagogicalSpaceWorkspace
      tenantId={tenant?.id || ""}
      academicYearId={academicYear.id}
      teacherId={teacherId}
    />
  );
}

"use client";

/**
 * Teacher Pedagogy — embeds the PedagogicalSpaceWorkspace directly.
 * The teacher sees ONLY their space (not the full pedagogy module
 * with admin tabs like academic structure, subjects management, etc.)
 *
 * ⭐ P4 (filtre Rôles × Pistes × Niveaux) : la piste linguistique décide du
 *    workspace — un enseignant de la piste anglophone obtient l'espace EN
 *    (Scheme of Work, Weekly Record of Work, Text Log…), un enseignant de
 *    la piste francophone l'espace FR (fiches, cahier journal…).
 *    La piste courante vient du BilingualContext (initialisé depuis le
 *    périmètre serveur résolu à la connexion).
 */

import { PedagogicalSpaceWorkspace } from "@/components/pedagogy/production/PedagogicalSpaceWorkspace";
import { PedagogicalSpaceWorkspaceEN } from "@/components/pedagogy/production-en/PedagogicalSpaceWorkspaceEN";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import { useBilingual } from "@/contexts/BilingualContext";

export default function TeacherPedagogyPage() {
  const { user, tenant } = useAppSession();
  const { academicYear, schoolLevel } = useModuleContext();
  const { currentTrack } = useBilingual();

  const teacherId = user?.teacherId || user?.id || "";

  if (!academicYear?.id || !teacherId) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        Chargement de l&apos;espace pédagogique…
      </div>
    );
  }

  // ⭐ Piste anglophone → workspace EN (tout en anglais)
  if (currentTrack === "EN") {
    return (
      <PedagogicalSpaceWorkspaceEN
        tenantId={tenant?.id || ""}
        academicYearId={academicYear.id}
        teacherId={teacherId}
      />
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

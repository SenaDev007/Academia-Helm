'use client';

/**
 * ============================================================================
 * HELM ENSEIGNANT — ESPACE PÉDAGOGIQUE
 * ============================================================================
 *
 * Reproduction exacte de l'UI enseignant d'Academia Helm : le workspace
 * pédagogique existant est branché tel quel sur le contexte autonome
 * (tenantId + academicYearId + teacherId du mini-tenant TEACHER).
 *
 * Les onglets affichés suivent le niveau scolaire de l'enseignant
 * (maternelle/primaire → cahier journal, fiches…), exactement comme dans
 * l'espace enseignant d'une école.
 */

import { PedagogicalSpaceWorkspace } from '@/components/pedagogy/production/PedagogicalSpaceWorkspace';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useModuleContext } from '@/hooks/useModuleContext';

export default function ProfPedagogiePage() {
  const { user, tenant } = useAppSession();
  const { academicYear } = useModuleContext();

  const teacherId = user?.teacherId || user?.id || '';

  if (!academicYear?.id || !teacherId) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        Chargement de l&apos;espace pédagogique…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PedagogicalSpaceWorkspace
        tenantId={tenant?.id || user?.tenantId || ''}
        academicYearId={academicYear.id}
        teacherId={teacherId}
        isHelmEnseignant
      />
    </div>
  );
}

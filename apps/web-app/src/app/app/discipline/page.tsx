'use client';

import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import DisciplineWorkspace from '@/components/discipline/DisciplineWorkspace';
import { AlertTriangle } from 'lucide-react';

export default function DisciplinePage() {
  const { academicYear, tenant, schoolLevel } = useModuleContext();
  const { availableLevels } = useSchoolLevel();

  // ⭐ Garde-fou : la Vie Scolaire (surveillant) est spécifique au niveau Secondaire
  const secondaryEnabled = availableLevels.some(l => l.code === 'SECONDAIRE' && l.isActive);

  if (!secondaryEnabled) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-yellow-500" />
        <h2 className="text-lg font-bold text-gray-900 mb-2">
          Module Vie Scolaire indisponible
        </h2>
        <p className="text-sm text-gray-600 max-w-md mx-auto">
          La Vie Scolaire (sanctions comportementales, compteur de conduite, notifications WhatsApp)
          est spécifique au niveau Secondaire. Activez le niveau Secondaire dans{' '}
          <strong>Paramètres → Structure</strong> pour y accéder.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <DisciplineWorkspace
        tenant={tenant}
        academicYear={academicYear}
        schoolLevelId={schoolLevel?.schoolLevelId || schoolLevel?.id}
      />
    </div>
  );
}

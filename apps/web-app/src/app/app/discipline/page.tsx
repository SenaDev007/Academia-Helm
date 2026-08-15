'use client';

import { useModuleContext } from '@/hooks/useModuleContext';
import DisciplineWorkspace from '@/components/discipline/DisciplineWorkspace';

export default function DisciplinePage() {
  const { academicYear, tenant, schoolLevel } = useModuleContext();

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

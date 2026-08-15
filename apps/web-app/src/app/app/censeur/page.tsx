'use client';

import { useModuleContext } from '@/hooks/useModuleContext';
import CensorWorkspace from '@/components/censeur/CensorWorkspace';

export default function CenseurPage() {
  const { academicYear, tenant, schoolLevel } = useModuleContext();

  return (
    <div className="p-4 sm:p-6">
      <CensorWorkspace
        tenant={tenant}
        academicYear={academicYear}
        schoolLevelId={schoolLevel?.schoolLevelId || schoolLevel?.id}
      />
    </div>
  );
}

'use client';

import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import { CareersContent } from '../CareersContent';

export default function TenantCareersPage() {
  const params = useParams();
  const schoolSlug = typeof params?.schoolSlug === 'string' ? params.schoolSlug : undefined;

  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-400">Chargement du portail carrières...</div>}>
      <CareersContent forcedSchoolSlug={schoolSlug} />
    </Suspense>
  );
}

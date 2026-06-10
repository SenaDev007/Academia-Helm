'use client';

import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import { CareersContent } from '../../CareersContent';

export default function JobDetailPage() {
  const params = useParams();
  const schoolSlug = typeof params?.schoolSlug === 'string' ? params.schoolSlug : undefined;
  const jobSlug = typeof params?.jobSlug === 'string' ? params.jobSlug : undefined;

  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-400">Chargement de l'offre d'emploi...</div>}>
      <CareersContent forcedSchoolSlug={schoolSlug} forcedJobSlug={jobSlug} />
    </Suspense>
  );
}

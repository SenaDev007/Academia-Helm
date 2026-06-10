import { Suspense } from 'react';
import { CareersContent } from '../CareersContent';

interface PageProps {
  params: Promise<{ schoolSlug: string }>;
}

export default async function TenantCareersPage({ params }: PageProps) {
  const { schoolSlug } = await params;

  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-400">Chargement du portail carrières...</div>}>
      <CareersContent forcedSchoolSlug={schoolSlug} />
    </Suspense>
  );
}

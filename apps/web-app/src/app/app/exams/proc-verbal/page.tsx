'use client';

import { lazy, Suspense } from 'react';
const ProcVerbalPage = lazy(() => import('@/components/exams/ProcVerbalWorkspace'));

export default function Page() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
      <ProcVerbalPage />
    </Suspense>
  );
}

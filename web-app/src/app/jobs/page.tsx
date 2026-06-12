'use client';

import { Suspense } from 'react';
import { CareersContent } from './CareersContent';

export default function PublicCareersPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-400">Chargement du portail carrières...</div>}>
      <CareersContent />
    </Suspense>
  );
}

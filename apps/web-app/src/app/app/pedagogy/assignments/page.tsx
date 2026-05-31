/**
 * REDIRECTION DE L'ANCIENNE PAGE D'AFFECTATIONS VERS L'ONGLET UNIÉ
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AssignmentsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/app/pedagogy/teachers');
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50/50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-gray-500 tracking-wide uppercase">Redirection en cours...</p>
      </div>
    </div>
  );
}

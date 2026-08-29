'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirection: l'onglet "Embauche" a été fusionné avec l'onglet "Recrutement".
 * Les embauches sont maintenant accessibles via le sous-tab "Embauches"
 * dans /app/hr/recruitment.
 *
 * Conservé comme redirection pour ne pas casser les bookmarks existants.
 */
export default function EmbauchePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/app/hr/recruitment?tab=embauches');
  }, [router]);
  return (
    <div className="flex items-center justify-center py-16 text-sm text-slate-500">
      Redirection vers le module de recrutement…
    </div>
  );
}

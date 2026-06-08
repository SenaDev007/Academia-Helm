/**
 * HR Module Error Boundary
 *
 * Catches runtime errors specifically within the HR module,
 * preventing them from crashing the sidebar or other modules.
 */

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

export default function HRError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[HR Module Error]', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[50vh] px-4">
      <div className="max-w-md w-full text-center">
        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-900 mb-2">Erreur RH</h2>
        <p className="text-xs text-slate-600 mb-3">
          Le module RH a rencontré une erreur. Vous pouvez réessayer ou revenir au tableau de bord.
        </p>
        {error?.message && (
          <div className="mb-3 text-left bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-[10px] text-red-800 break-words">
            <p className="font-semibold mb-0.5">Détail :</p>
            <pre className="whitespace-pre-wrap">{error.message}</pre>
          </div>
        )}
        <div className="flex gap-2 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 bg-[#1A2BA6] text-white px-4 py-2 rounded-lg text-xs font-semibold hover:opacity-90 transition"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Réessayer
          </button>
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-xs font-semibold hover:bg-slate-200 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Tableau de bord
          </Link>
        </div>
      </div>
    </div>
  );
}

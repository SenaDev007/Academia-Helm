'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import {
  isChunkLoadFailure,
  scheduleChunkRecoveryReload,
  forceChunkRecoveryReload,
  hasExhaustedAutoReloads,
} from '@/lib/chunk-recovery';

export default function JobsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError = isChunkLoadFailure(error?.message || '');
  // Lecture pure au premier rendu (pas de setState dans un effet)
  const [autoReloadBlocked] = useState(hasExhaustedAutoReloads);

  useEffect(() => {
    console.error('Jobs page error:', error);

    // Auto-reload LIMITÉ (garde anti-boucle) — SANS purge de cache offline
    if (isChunkError) scheduleChunkRecoveryReload();
  }, [error, isChunkError]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {isChunkError ? (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-amber-100 flex items-center justify-center">
              <WifiOff className="w-8 h-8 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-3">
              Connexion instable
            </h1>
            <p className="text-sm text-slate-600 mb-2">
              Une partie du site n'a pas pu être chargée (connexion instable ou
              mise à jour récente).
            </p>
            <p className="text-xs text-slate-500 mb-6">
              {autoReloadBlocked
                ? 'Rechargement automatique suspendu (anti-boucle).'
                : 'Rechargement automatique en cours…'}
            </p>
            <button
              onClick={forceChunkRecoveryReload}
              className="inline-flex items-center gap-2 bg-[#1A2BA6] text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition-colors"
            >
              <RefreshCw className="h-4 w-4" /> Recharger la page
            </button>
          </>
        ) : (
          <>
            <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-slate-900 mb-3">
              Une erreur s'est produite
            </h1>
            <p className="text-sm text-slate-600 mb-4">
              Désolé, une erreur inattendue s'est produite. Veuillez réessayer.
            </p>
            {error?.message && (
              <div className="mb-6 text-left bg-red-50 border border-red-200 rounded-md px-4 py-3 text-xs text-red-800 break-words">
                <p className="font-semibold mb-1">Détail technique :</p>
                <pre className="whitespace-pre-wrap">{error.message}</pre>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 bg-[#1A2BA6] text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition-colors"
              >
                <RefreshCw className="h-4 w-4" /> Réessayer
              </button>
              <Link
                href="/"
                className="inline-flex items-center justify-center bg-slate-200 text-slate-900 px-6 py-3 rounded-xl font-semibold hover:bg-slate-300 transition-colors"
              >
                Retour à l'accueil
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

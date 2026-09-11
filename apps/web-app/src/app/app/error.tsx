/**
 * App Module Error Boundary
 *
 * Catches runtime errors from any module page (HR, Academics, Finance, etc.)
 * and displays a recoverable error UI without crashing the entire app.
 * This prevents a bug in one module from making all modules inaccessible.
 *
 * ⭐ Récupération chunk : format Turbopack (Next 15/16) ET webpack, rechargement
 *    automatique AVEC garde anti-boucle (max 2 / 60 s), SANS purge des caches
 *    (les chunks /_next/static/ sont immuables — purger casserait l'offline).
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, ArrowLeft, WifiOff } from 'lucide-react';
import {
  isChunkLoadFailure,
  scheduleChunkRecoveryReload,
  forceChunkRecoveryReload,
  hasExhaustedAutoReloads,
} from '@/lib/chunk-recovery';

export default function AppModuleError({
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
    console.error('[Module Error Boundary]', error);
  }, [error]);

  // Auto-reload LIMITÉ (garde anti-boucle) sur erreur de chunk — pas de purge de cache
  useEffect(() => {
    if (isChunkError) scheduleChunkRecoveryReload();
  }, [isChunkError]);

  if (isChunkError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-amber-100 flex items-center justify-center">
            <WifiOff className="w-6 h-6 text-amber-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Connexion instable</h2>
          <p className="text-sm text-slate-600 mb-2">
            Ce module n'a pas pu être chargé complètement (connexion instable ou
            mise à jour récente). Vos données enregistrées sont conservées.
          </p>
          <p className="text-xs text-slate-500 mb-4">
            {autoReloadBlocked
              ? 'Rechargement automatique suspendu (anti-boucle).'
              : 'Rechargement automatique en cours…'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={forceChunkRecoveryReload}
              className="inline-flex items-center justify-center gap-2 bg-[#1A2BA6] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition"
            >
              <RefreshCw className="h-4 w-4" /> Recharger
            </button>
            <button
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 bg-slate-100 text-slate-700 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-200 transition"
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md w-full text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-slate-900 mb-2">Erreur du module</h2>
        <p className="text-sm text-slate-600 mb-4">
          Une erreur s&apos;est produite dans ce module. Les autres modules restent accessibles.
        </p>
        {error?.message && (
          <div className="mb-4 text-left bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-800 break-words">
            <p className="font-semibold mb-1">Détail :</p>
            <pre className="whitespace-pre-wrap">{error.message}</pre>
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 bg-[#1A2BA6] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition"
          >
            <RefreshCw className="h-4 w-4" /> Réessayer
          </button>
          <Link
            href="/app"
            className="inline-flex items-center justify-center gap-2 bg-slate-100 text-slate-700 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-200 transition"
          >
            <ArrowLeft className="h-4 w-4" /> Retour au tableau de bord
          </Link>
        </div>
      </div>
    </div>
  );
}

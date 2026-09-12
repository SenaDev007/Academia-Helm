/**
 * Error Boundary
 *
 * Gestion des erreurs globales — inclut la récupération automatique
 * des échecs de chargement de chunks (réseau instable / déploiement
 * récent), format Turbopack « Failed to load chunk ... from module N »
 * ET format webpack « Loading chunk N failed ».
 *
 * ⛔ Plus de purge du Cache Storage : les chunks /_next/static/ sont
 * immuables et cachés par le SW — les purger casserait l'offline-first.
 * Un simple rechargement (avec garde anti-boucle) suffit dans les 2 cas :
 * déploiement récent (HTML frais → nouveaux chunks) ou réseau instable
 * (nouvelle tentative, le SW sert son cache si disponible).
 */

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

/** Erreur de navigation réseau (payload RSC inaccessible / réseau coupé) ? */
function isNetworkNavigationError(message?: string): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const m = (message || '').toLowerCase();
  return (
    m.includes('failed to fetch') ||
    m.includes('network') ||
    m.includes('load failed') ||
    m.includes('fetch server response') ||
    m.includes('503') ||
    m.includes('rsc')
  );
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError = isChunkLoadFailure(error?.message || '');
  // ⭐ v3.2.0 : échec de navigation hors ligne (payload RSC absent du cache)
  const isOfflineNav = !isChunkError && isNetworkNavigationError(error?.message);
  // Lecture pure au premier rendu (pas de setState dans un effet — règle
  // react-hooks/set-state-in-effect)
  const [autoReloadBlocked] = useState(hasExhaustedAutoReloads);

  useEffect(() => {
    console.error('Application error:', error);

    // Auto-reload LIMITÉ (garde anti-boucle : max 2 / 60 s) sur erreur de chunk
    if (isChunkError) scheduleChunkRecoveryReload();
  }, [error, isChunkError]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {isChunkError ? (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-amber-100 flex items-center justify-center">
              <WifiOff className="w-8 h-8 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-3">
              Connexion instable
            </h1>
            <p className="text-sm text-slate-600 mb-6">
              Une partie de l'application n'a pas pu être chargée (connexion
              instable ou mise à jour récente du site). Votre travail enregistré
              est conservé.
            </p>
            {autoReloadBlocked ? (
              <p className="text-xs text-slate-500 mb-6">
                Le rechargement automatique a été suspendu pour éviter une boucle.
              </p>
            ) : (
              <p className="text-xs text-slate-500 mb-6">
                Rechargement automatique en cours…
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={forceChunkRecoveryReload}
                className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-md font-semibold hover:bg-slate-800 transition-colors"
              >
                <RefreshCw className="h-4 w-4" /> Recharger la page
              </button>
              <button
                onClick={reset}
                className="bg-gray-200 text-gray-900 px-6 py-3 rounded-md font-semibold hover:bg-gray-300 transition-colors"
              >
                Réessayer sans recharger
              </button>
            </div>
          </>
        ) : isOfflineNav ? (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-amber-100 flex items-center justify-center">
              <WifiOff className="w-8 h-8 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-3">
              Page non disponible hors ligne
            </h1>
            <p className="text-sm text-slate-600 mb-6">
              Cette page n&apos;a pas encore été chargée sur cet appareil et le réseau
              est coupé. Vos données enregistrées restent accessibles — la page
              sera disponible hors ligne après l&apos;avoir visitée une fois en ligne.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/app"
                className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-md font-semibold hover:bg-slate-800 transition-colors"
              >
                Tableau de bord (hors ligne)
              </Link>
              <button
                onClick={reset}
                className="bg-gray-200 text-gray-900 px-6 py-3 rounded-md font-semibold hover:bg-gray-300 transition-colors"
              >
                Réessayer (une fois reconnecté)
              </button>
            </div>
          </>
        ) : (
          <>
            <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-slate-900 mb-4">
              Une erreur s'est produite
            </h1>
            <p className="text-slate-600 mb-4">
              Désolé, une erreur inattendue s'est produite. Veuillez réessayer.
            </p>
            {error?.message && (
              <div className="mb-6 text-left bg-red-50 border border-red-200 rounded-md px-4 py-3 text-xs text-red-800 break-words">
                <p className="font-semibold mb-1">Détail technique (à copier pour le support) :</p>
                <pre className="whitespace-pre-wrap">{error.message}</pre>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={reset}
                className="bg-slate-900 text-white px-6 py-3 rounded-md font-semibold hover:bg-slate-800 transition-colors"
              >
                Réessayer
              </button>
              <Link
                href="/"
                className="bg-gray-200 text-gray-900 px-6 py-3 rounded-md font-semibold hover:bg-gray-300 transition-colors"
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


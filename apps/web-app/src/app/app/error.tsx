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

export default function AppModuleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError = isChunkLoadFailure(error?.message || '');
  // ⭐ v3.2.0 : échec de navigation hors ligne (payload RSC absent du cache)
  const isOfflineNav = !isChunkError && isNetworkNavigationError(error?.message);
  // Lecture pure au premier rendu (pas de setState dans un effet)
  const [autoReloadBlocked] = useState(hasExhaustedAutoReloads);

  // ⭐ v4.8.0 — Hors ligne : le rechargement ne peut PAS récupérer le chunk
  //    manquant (aucun réseau) → message honnête et action utile (retour au
  //    tableau de bord) au lieu d'un « rechargement automatique » mensonger.
  const [isOffline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false,
  );

  useEffect(() => {
    console.error('[Module Error Boundary]', error);
  }, [error]);

  // Auto-reload LIMITÉ (garde anti-boucle) sur erreur de chunk — pas de purge de cache
  useEffect(() => {
    if (isChunkError) scheduleChunkRecoveryReload();
  }, [isChunkError]);

  // ⭐ (sept. 2026 — NetworkRecovery) : marquer l'app comme DÉGRADÉE quand
  //    une navigation hors ligne a échoué (error boundary actif). Au retour
  //    CONFIRMÉ du réseau, NetworkRecovery déclenche UN rechargement propre
  //    (garde 3 min) — « l'application se recharge au retour de la
  //    connexion » — au lieu de rester figée ici avec des données vides.
  //    Le flag est nettoyé au démontage (reset réussi → plus dégradé).
  useEffect(() => {
    if (isOfflineNav || isChunkError) {
      try { (window as any).__ah_degraded_nav = true; } catch { /* noop */ }
    }
    return () => {
      try { (window as any).__ah_degraded_nav = false; } catch { /* noop */ }
    };
  }, [isOfflineNav, isChunkError]);

  // ⭐ v3.7.0 — Auto-guérison : échec de navigation réseau → dès que le
  //    réseau revient, on RETENTE le rendu du module (les données locales
  //    sont déjà servies par la couche unifiée dataService — spec « lecture
  //    hors ligne par module » : une erreur réseau ne bloque jamais
  //    l'affichage durablement, la page se réaffiche seule à la reconnexion).
  useEffect(() => {
    if (!isOfflineNav) return;
    const onOnline = () => {
      try {
        reset();
      } catch {
        window.location.reload();
      }
    };
    window.addEventListener('online', onOnline, { once: true });
    return () => window.removeEventListener('online', onOnline);
  }, [isOfflineNav, reset]);

  if (isChunkError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-amber-100 flex items-center justify-center">
            <WifiOff className="w-6 h-6 text-amber-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Connexion instable</h2>
          {isOffline ? (
            <>
              <p className="text-sm text-slate-600 mb-2">
                Vous êtes hors ligne et ce module n&apos;a pas encore été téléchargé
                pour un usage hors ligne. Il sera téléchargé automatiquement lors de
                votre prochaine connexion.
              </p>
              <p className="text-xs text-slate-500 mb-4">
                Vos données enregistrées sont conservées — les modules déjà
                téléchargés restent accessibles depuis le menu.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600 mb-2">
                Ce module n'a pas pu être chargé complètement (connexion instable ou
                mise à jour récente). Vos données enregistrées sont conservées.
              </p>
              <p className="text-xs text-slate-500 mb-4">
                {autoReloadBlocked
                  ? 'Rechargement automatique suspendu (anti-boucle).'
                  : 'Rechargement automatique en cours…'}
              </p>
            </>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {!isOffline && (
              <button
                onClick={forceChunkRecoveryReload}
                className="inline-flex items-center justify-center gap-2 bg-[#1A2BA6] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition"
              >
                <RefreshCw className="h-4 w-4" /> Recharger
              </button>
            )}
            <button
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 bg-slate-100 text-slate-700 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-200 transition"
            >
              Réessayer
            </button>
            {isOffline && (
              <Link
                href="/app"
                className="inline-flex items-center justify-center gap-2 bg-[#1A2BA6] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition"
              >
                <ArrowLeft className="h-4 w-4" /> Tableau de bord (hors ligne)
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isOfflineNav) {
    return (
      <div data-ah-offline-error="true" className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-amber-100 flex items-center justify-center">
            <WifiOff className="w-6 h-6 text-amber-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Module en attente du réseau</h2>
          <p className="text-sm text-slate-600 mb-4">
            Connexion interrompue pendant l&apos;ouverture de cette page. Vos données
            enregistrées restent disponibles — la page se réaffiche automatiquement
            dès le retour de la connexion.
          </p>
          <p className="text-xs text-slate-500 mb-4">
            L&apos;application se rechargera proprement dès que la connexion sera rétablie.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/app"
              className="inline-flex items-center justify-center gap-2 bg-[#1A2BA6] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition"
            >
              <ArrowLeft className="h-4 w-4" /> Tableau de bord (hors ligne)
            </Link>
            <button
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 bg-slate-100 text-slate-700 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-200 transition"
            >
              <RefreshCw className="h-4 w-4" /> Réessayer (une fois reconnecté)
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

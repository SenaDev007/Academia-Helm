/**
 * Offline Indicator — Toast autonome non bloquant ≤ 10 s (expérience WhatsApp)
 *
 * ⭐ V3 (sept. 2026) : PLUS AUCUNE page « Mode hors ligne » plein écran,
 *    plus de badge permanent. Quand la connexion se coupe, on affiche UN
 *    toast (max 10 secondes) qui prévient l'utilisateur qu'il est hors
 *    ligne mais qu'il peut CONTINUER À TRAVAILLER — ses données sont dans
 *    le cache local (IndexedDB) et ses modifications seront synchronisées
 *    automatiquement au retour du réseau (outbox + background sync).
 *
 * ⭐ Le toast est AUTONOME (pas de dépendance au <Toaster> de sonner, absent
 *    de certains layouts mobiles/federis) : petit bandeau discret en bas de
 *    page, auto-fermé, non bloquant (seule la pastille capture les clics).
 *
 * Au retour de la connexion : même pastille verte « connexion rétablie,
 * synchronisation… » pendant 4 s. Rien d'autre — jamais de blocage.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { networkDetectionService } from '@/lib/offline/network-detection.service';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

/** Durée max du toast hors ligne (ms) — spec : « 10 secondes au plus ». */
const OFFLINE_TOAST_MS = 10_000;
/** Durée du toast retour en ligne (ms). */
const ONLINE_TOAST_MS = 4_000;

type ToastState = {
  kind: 'offline' | 'online';
  /** Identifiant d'occurrence (pour rejouer l'animation à chaque coupure). */
  key: number;
} | null;

export default function OfflineIndicator() {
  const [toastState, setToastState] = useState<ToastState>(null);
  const wasOnlineRef = useRef<boolean | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const scheduleHide = (ms: number) => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setToastState(null), ms);
    };

    const unsubscribe = networkDetectionService.onNetworkStatusChange((online) => {
      const wasOnline = wasOnlineRef.current;
      wasOnlineRef.current = online;

      const occurrence = Date.now();

      // Premier callback (état initial) → toast seulement si offline
      if (wasOnline === null) {
        if (!online) {
          setToastState({ kind: 'offline', key: occurrence });
          scheduleHide(OFFLINE_TOAST_MS);
        }
        return;
      }

      // Transition online → offline : toast ≤ 10 s, non bloquant
      if (wasOnline && !online) {
        setToastState({ kind: 'offline', key: occurrence });
        scheduleHide(OFFLINE_TOAST_MS);
        return;
      }

      // Transition offline → online : toast vert bref + lancement de la sync
      if (!wasOnline && online) {
        setToastState({ kind: 'online', key: occurrence });
        scheduleHide(ONLINE_TOAST_MS);
      }
    });
    return () => {
      unsubscribe();
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  if (!toastState) return null;

  const isOffline = toastState.kind === 'offline';

  return (
    <div
      key={toastState.key}
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] max-w-[92vw] md:max-w-md rounded-full shadow-lg flex items-center gap-2.5 pl-3.5 pr-4 py-2 text-sm font-medium transition-all ${
        isOffline
          ? 'bg-amber-500 text-white'
          : 'bg-emerald-500 text-white'
      }`}
    >
      {isOffline ? (
        <>
          <WifiOff className="h-4 w-4 shrink-0" />
          <span className="whitespace-nowrap">Hors ligne — vous pouvez continuer à travailler</span>
          <span className="hidden sm:inline text-amber-100/90 font-normal truncate">
            synchronisation auto au retour du réseau
          </span>
        </>
      ) : (
        <>
          <Wifi className="h-4 w-4 shrink-0" />
          <span className="whitespace-nowrap">Connexion rétablie — synchronisation…</span>
          <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin opacity-80" />
        </>
      )}
    </div>
  );
}

/**
 * ============================================================================
 * OFFLINE READINESS INDICATOR — « vous pouvez couper votre connexion » (v4.1.0)
 * ============================================================================
 *
 * ⭐ Exigence produit (sept. 2026) : l'utilisateur doit savoir À TEL MOMENT
 *    ses données locales sont prêtes, pour pouvoir COUPER SA CONNEXION
 *    (économiser son forfait internet) et continuer à travailler.
 *
 * Deux affichages, philosophie « jamais bloquant » (même famille que
 * OfflineIndicator — pas de badge permanent encombrant) :
 *
 * 1. PILL de progression (coin bas-droite, discret, semi-transparent) :
 *    « Préparation hors ligne · 42 % » pendant le téléchargement des données.
 *    Visible SEULEMENT en ligne (hors ligne il n'y a plus rien à préparer).
 *    title : rappelle d'attendre le message vert avant de couper.
 *
 * 2. TOAST vert UNE SEULE FOIS (bas-centre, 8 s) quand tout est prêt :
 *    « Données hors ligne prêtes — vous pouvez couper votre connexion et
 *    continuer à travailler ». Silencieux pour l'utilisateur déjà prêt
 *    (flags < 24 h au montage) : pas de bruit à chaque login.
 *
 * Source de vérité : lib/offline/offline-readiness (store) alimenté par
 * module-precache.service (routes 25 % + vague 1 50 % + vague 2 25 %).
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import {
  getOfflineReadiness,
  OFFLINE_READINESS_EVENT,
  OfflineReadinessState,
} from '@/lib/offline/offline-readiness';
import { evaluateOfflineReadinessInitial } from '@/lib/offline/module-precache.service';
import { networkDetectionService } from '@/lib/offline/network-detection.service';
import { CheckCircle2, CloudDownload, X } from 'lucide-react';

/** Durée d'affichage du toast « prêt » (ms). */
const READY_TOAST_MS = 8_000;

export default function OfflineReadinessIndicator() {
  const [state, setState] = useState<OfflineReadinessState | null>(null);
  const [online, setOnline] = useState(true);
  const [showReadyToast, setShowReadyToast] = useState(false);
  const [pillDismissed, setPillDismissed] = useState(false);
  const firstSnapshotRef = useRef(true);
  const lastReadyAtRef = useRef<number | null>(null);
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // ⭐ État initial : flags frais (< 24 h) → déjà prêt, SANS toast
    evaluateOfflineReadinessInitial();
    setState(getOfflineReadiness());

    const onReadinessChange = () => {
      const s = getOfflineReadiness();
      setState(s);

      if (firstSnapshotRef.current) {
        // Premier snapshot post-abonnement : pas de toast (état initial)
        firstSnapshotRef.current = false;
        lastReadyAtRef.current = s.readyAt;
        return;
      }
      // Transition vers « prêt » PENDANT cette session → toast une fois
      if (s.readyAt && s.readyAt !== lastReadyAtRef.current) {
        lastReadyAtRef.current = s.readyAt;
        setShowReadyToast(true);
        if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
        readyTimerRef.current = setTimeout(() => setShowReadyToast(false), READY_TOAST_MS);
      }
    };
    window.addEventListener(OFFLINE_READINESS_EVENT, onReadinessChange);

    // Réseau : la pill ne s'affiche qu'en ligne (offline → rien à préparer)
    const unsubscribe = networkDetectionService.onNetworkStatusChange((isOnline) => {
      setOnline(isOnline);
    });

    return () => {
      window.removeEventListener(OFFLINE_READINESS_EVENT, onReadinessChange);
      unsubscribe();
      if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
    };
  }, []);

  const s = state;
  if (!s) return null;

  const preparing = online && !pillDismissed && s.phase === 'preparing' && s.progress < 1;
  const ready = s.phase === 'ready' && showReadyToast && online;

  if (!preparing && !ready) return null;

  // ─── 1. Toast vert « prêt » : le message clé du forfait internet ───
  if (ready) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] max-w-[92vw] md:max-w-lg rounded-2xl shadow-lg bg-emerald-600 text-white px-4 py-3 flex items-start gap-3"
      >
        <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-semibold whitespace-nowrap">
            Données hors ligne prêtes
          </p>
          <p className="text-xs text-emerald-50/90 mt-0.5">
            Vous pouvez couper votre connexion internet et continuer à travailler —
            tout est enregistré sur cet appareil, la synchronisation reprendra au retour du réseau.
          </p>
        </div>
        <button
          type="button"
          aria-label="Fermer"
          className="shrink-0 p-1 -m-1 rounded-full hover:bg-emerald-500/60 transition-colors"
          onClick={() => setShowReadyToast(false)}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  // ─── 2. Pill de progression (discrète, coin bas-droite, refermable) ───
  const pct = Math.min(100, Math.round(s.progress * 100));
  return (
    <div
      role="status"
      aria-live="polite"
      title="Copie de vos données en cours sur cet appareil. Attendez le message vert « Données hors ligne prêtes » avant de couper votre connexion pour travailler hors ligne."
      className="fixed bottom-4 right-4 z-[9998] rounded-full shadow-md bg-slate-900/85 text-white backdrop-blur-sm pl-3 pr-2.5 py-1.5 flex items-center gap-2 text-xs font-medium max-w-[86vw]"
    >
      <CloudDownload className="h-3.5 w-3.5 shrink-0 animate-pulse" />
      <span className="whitespace-nowrap">
        Préparation hors ligne
        <span className="hidden sm:inline text-slate-300 font-normal"> · {pct} %</span>
      </span>
      {pct > 0 && (
        <span className="hidden sm:flex items-center gap-1 w-16 h-1.5 rounded-full bg-white/25 overflow-hidden shrink-0">
          <span
            className="h-full rounded-full bg-emerald-400 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </span>
      )}
      <button
        type="button"
        aria-label="Masquer la progression"
        className="shrink-0 p-1 -m-0.5 rounded-full hover:bg-white/20 transition-colors"
        onClick={() => setPillDismissed(true)}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

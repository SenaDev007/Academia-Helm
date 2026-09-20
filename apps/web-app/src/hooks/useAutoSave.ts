"use client";

/**
 * ============================================================================
 * useAutoSave — Sauvegarde automatique INVISIBLE
 * ============================================================================
 *
 * ⭐ Objectif métier (demande utilisateur) :
 *    « Sauvegarde automatique chaque 10 secondes afin que l'utilisateur ne
 *     puisse pas perdre son travail. Même s'il y a sauvegarde, l'utilisateur
 *     ne le remarque pas. Ça ne doit pas perturber son travail. Ça ne doit
 *     pas faire un rechargement de page. »
 *
 * Principes de conception :
 *   1. AUCUN toast / AUCUN re-render de la page pendant la sauvegarde —
 *      le hook ne déclenche un setState que pour le micro-indicateur
 *      (status / lastSavedAt), jamais pour les données éditées.
 *   2. Détection de modification par snapshot sérialisé (string) :
 *      on ne sauvegarde QUE si le contenu a réellement changé depuis la
 *      dernière sauvegarde réussie (aucune écriture BD inutile).
 *   3. Pas de rechargement / re-fetch après sauvegarde : la fonction
 *      `save` fournie par le composant est responsable de tout (et ne doit
 *      PAS appeler loadJournal()/loadFiches()).
 *   4. Anti-empilement : si une sauvegarde est en cours, le prochain tick
 *      est ignoré (jamais 2 requêtes concurrentes).
 *   5. Flush best-effort au déchargement de la page (fermeture onglet,
 *      navigation, F5) via `fetch(..., { keepalive: true })` — la requête
 *      survit à la fermeture de la page.
 *
 * Usage (CahierJournalTab) :
 *   const { status, lastSavedAt, saveNow, markSaved } = useAutoSave({
 *     snapshot: JSON.stringify({ entries, observations, ... }),
 *     enabled: !!journal && journal.status === "DRAFT" && !loading,
 *     save: async () => {
 *       const res = await fetch(`/api/pedagogy-space/cahier-journal/${journal.id}?source=autosave`, {
 *         method: "PUT", credentials: "include",
 *         headers: { "Content-Type": "application/json" },
 *         body: JSON.stringify({ entries, observations, ... }),
 *       });
 *       if (!res.ok) throw new Error("Erreur de sauvegarde");
 *     },
 *     unloadSave: () => fireKeepaliveSave(url, "PUT", body),
 *   });
 * ============================================================================
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error" | "paused";

export interface UseAutoSaveOptions {
  /** Snapshot sérialisé de l'état courant (ex: JSON.stringify(form)). */
  snapshot: string;
  /** Sauvegarde active uniquement quand true (ex: document en Brouillon, formulaire ouvert). */
  enabled: boolean;
  /** Effectue la sauvegarde silencieuse. Ne doit PAS recharger l'UI ni afficher de toast. */
  save: () => Promise<void>;
  /**
   * Requête de secours au déchargement de la page — utilisez
   * `fireKeepaliveSave(url, method, body)` : le keepalive survit à la
   * fermeture de l'onglet. Appelé SEULEMENT s'il reste des modifs non
   * sauvegardées.
   */
  unloadSave?: () => void;
  /** Intervalle de vérification. défaut : 10 000 ms (demande explicite utilisateur). */
  intervalMs?: number;
}

export interface UseAutoSaveResult {
  status: AutoSaveStatus;
  /** Date de la dernière sauvegarde automatique réussie. */
  lastSavedAt: Date | null;
  /** Force une sauvegarde immédiate (si modifs en attente). Retourne true si sauvegardé. */
  saveNow: () => Promise<boolean>;
  /**
   * À appeler après une sauvegarde MANUELLE réussie (bouton « Enregistrer »)
   * pour resynchroniser le snapshot de référence — évite une double
   * sauvegarde juste après le clic. Sans argument : prend le snapshot courant.
   */
  markSaved: (snapshot?: string) => void;
}

export function useAutoSave({
  snapshot,
  enabled,
  save,
  unloadSave,
  intervalMs = 10_000,
}: UseAutoSaveOptions): UseAutoSaveResult {
  // ── Réfs (évitent de relancer le timer à chaque frappe) ──
  const snapshotRef = useRef(snapshot);
  const lastSavedRef = useRef<string | null>(null);
  const savingRef = useRef(false);
  const saveRef = useRef(save);
  const enabledRef = useRef(enabled);
  const unloadSaveRef = useRef(unloadSave);

  // ── État UI minimal (micro-indicateur) ──
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // ── Synchronisation des réfs à chaque render ──
  snapshotRef.current = snapshot;
  saveRef.current = save;
  enabledRef.current = enabled;
  unloadSaveRef.current = unloadSave;

  /**
   * Sauvegarde interne silencieuse.
   * ⭐ Aucun toast ici : en cas d'échec on retentera au prochain tick
   *   (l'utilisateur ne remarque que le micro-indicateur discret).
   */
  const runSave = useCallback(async (): Promise<boolean> => {
    if (savingRef.current) return false;
    if (!enabledRef.current) return false;
    if (lastSavedRef.current !== null && snapshotRef.current === lastSavedRef.current) {
      return false; // rien à sauvegarder → aucune écriture BD
    }
    savingRef.current = true;
    setStatus("saving");
    try {
      await saveRef.current();
      lastSavedRef.current = snapshotRef.current;
      setLastSavedAt(new Date());
      setStatus("saved");
      return true;
    } catch (e) {
      // Échec silencieux — le snapshot non sauvegardé est conservé :
      // nouvelle tentative au prochain tick (10 s plus tard).
      console.warn("[autosave] sauvegarde silencieuse échouée (nouvelle tentative au prochain cycle) :", e);
      setStatus("error");
      return false;
    } finally {
      savingRef.current = false;
    }
  }, []);

  /**
   * Boucle principale : toutes les 10 s, si activé + modifs en attente,
   * on sauvegarde SANS aucune trace visible (pas de rechargement, pas de toast).
   * ⭐ Baseline paresseuse : à l'activation, l'état courant (déjà persisté côté
   *   serveur — journal chargé / formulaire ouvert) devient la référence ; on
   *   ne sauvegarde que les modifications faites ENSUITE (zéro écriture inutile).
   */
  useEffect(() => {
    if (!enabled) {
      setStatus("paused");
      return;
    }
    if (lastSavedRef.current === null) {
      lastSavedRef.current = snapshotRef.current;
    }
    const timer = window.setInterval(() => { void runSave(); }, intervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, intervalMs, runSave]);

  /**
   * ⭐ Flush au déchargement de la page (F5, fermeture onglet, navigation) :
   *    - beforeunload / pagehide → fetch keepalive (survit à la fermeture)
   *    - visibilitychange (hidden) → requête immédiate best-effort
   */
  useEffect(() => {
    const handler = () => {
      if (!enabledRef.current) return;
      if (lastSavedRef.current === snapshotRef.current) return;
      try { unloadSaveRef.current?.(); } catch { /* best effort */ }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") handler();
    };
    window.addEventListener("beforeunload", handler);
    window.addEventListener("pagehide", handler);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", handler);
      window.removeEventListener("pagehide", handler);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const markSaved = useCallback((s?: string) => {
    lastSavedRef.current = s ?? snapshotRef.current;
    setStatus("idle");
  }, []);

  const saveNow = useCallback(async () => runSave(), [runSave]);

  return { status, lastSavedAt, saveNow, markSaved };
}

/**
 * ⭐ fireKeepaliveSave — requête de secours au déchargement de la page.
 *    `keepalive: true` permet à la requête de se terminer même si la page
 *    est fermée juste après (limite ~64 Ko de body, largement suffisant
 *    pour un cahier journal / une fiche pédagogique).
 */
export function fireKeepaliveSave(url: string, method: "PUT" | "POST", body: unknown): void {
  try {
    void fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      keepalive: true,
      body: JSON.stringify(body),
    });
  } catch { /* best effort — rien à faire */ }
}

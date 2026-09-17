/**
 * Hook pour récupérer les codes des modules activés (feature flags) du tenant courant.
 * Utilisé par la sidebar pour n'afficher que les modules activés.
 *
 * PRINCIPE FAIL-OPEN : en cas d'erreur API (réseau, auth, etc.), on affiche
 * TOUS les modules plutôt que de verrouiller l'utilisateur hors de l'app.
 */

'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAppSession } from '@/contexts/AppSessionContext';
import * as settingsService from '@/services/settings.service';

interface FeatureItem {
  featureCode: string;
  isEnabled: boolean;
  status?: string;
}

/** Modules activés par défaut — utilisés comme fallback ULTIME en cas
 *  d'erreur API ET d'absence de snapshot (première utilisation). */
const DEFAULT_ENABLED_CODES = new Set([
  'STUDENTS',
  'FINANCE',
  'EXAMS',
  'PEDAGOGY',
  'HR_PAYROLL',
  'COMMUNICATION',
]);

/** ⭐ (sept. 2026 — retour promoteur « tous les modules disparaissent hors
 *  ligne ») — SNAPSHOT de la dernière liste d'features RÉUSSIE. Hors ligne
 *  (cache SW manquant + échec réseau), le fallback était la liste des 6
 *  modules par défaut ci-dessus → la sidebar PERDAIT les modules
 *  supplémentaires réellement activés (Cantine, EduCast, Academia Shop,
 *  CMS…). Désormais on relit le dernier état connu (30 jours) : la sidebar
 *  hors ligne = la sidebar en ligne. */
const FEATURES_SNAPSHOT_KEY = 'ah_features_snapshot';
const FEATURES_SNAPSHOT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

interface FeatureSnapshot {
  savedAt: number;
  features: FeatureItem[];
}

function readFeaturesSnapshot(): FeatureItem[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(FEATURES_SNAPSHOT_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw) as FeatureSnapshot;
    if (!Array.isArray(snap?.features) || snap.features.length === 0) return null;
    if (Date.now() - (snap.savedAt || 0) > FEATURES_SNAPSHOT_MAX_AGE_MS) return null;
    return snap.features;
  } catch {
    return null;
  }
}

function writeFeaturesSnapshot(features: FeatureItem[]): void {
  if (typeof window === 'undefined' || features.length === 0) return;
  try {
    localStorage.setItem(
      FEATURES_SNAPSHOT_KEY,
      JSON.stringify({ savedAt: Date.now(), features } satisfies FeatureSnapshot),
    );
  } catch {
    /* quota — non bloquant */
  }
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

export function useEnabledFeatureCodes() {
  const { tenant } = useAppSession();
  const [list, setList] = useState<FeatureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const retryCountRef = useRef(0);

  const fetchFeatures = useCallback(() => {
    const tid = tenant?.id;
    if (!tid) {
      setList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    settingsService
      .getFeatures(tid)
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        // Si le backend retourne un tableau vide, c'est probablement une erreur
        // (un tenant a toujours au moins les modules par défaut)
        // ⭐ 2026-09-12 : hors ligne, on ne perd pas 4 s en retries inutiles —
        //    le SW sert le cache sinon on fail-open immédiatement.
        if (arr.length === 0 && retryCountRef.current < MAX_RETRIES && navigator.onLine) {
          console.warn('[useEnabledFeatureCodes] API returned empty feature list, retrying...');
          retryCountRef.current += 1;
          setTimeout(() => fetchFeatures(), RETRY_DELAY_MS);
          return;
        }
        retryCountRef.current = 0;
        // ⭐ 2026-09-12 : liste VIDE après épuisement des retries → FAIL-OPEN
        //    vers les modules par défaut (sinon la sidebar tombe à 4 modules —
        //    seuls ceux sans featureCode — hors ligne, cf. retour terrain).
        if (arr.length === 0) {
          console.warn('[useEnabledFeatureCodes] Empty feature list after retries — using snapshot/defaults (fail-open)');
          setError(true);
          const snap = readFeaturesSnapshot();
          setList(
            snap ?? Array.from(DEFAULT_ENABLED_CODES).map((code) => ({
              featureCode: code,
              isEnabled: true,
              status: 'ACTIVE',
            }))
          );
          return;
        }
        // ⭐ Snapshot : persister la dernière liste RÉUSSIE (fallback hors
        //    ligne — cf. en-tête du fichier).
        writeFeaturesSnapshot(arr);
        setList(arr);
      })
      .catch((err) => {
        console.error('[useEnabledFeatureCodes] Failed to fetch features:', err?.message || err);
        // ⭐ 2026-09-12 : hors ligne → pas de retries (le SW a déjà tenté son
        //    cache) → fail-open direct pour ne pas laisser la sidebar vide.
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        if (!offline && retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current += 1;
          console.warn(`[useEnabledFeatureCodes] Retry ${retryCountRef.current}/${MAX_RETRIES} in ${RETRY_DELAY_MS}ms...`);
          setTimeout(() => fetchFeatures(), RETRY_DELAY_MS);
          return;
        }
        // FAIL-OPEN : après épuisement des retries (ou hors ligne), la
        // cascade est : SNAPSHOT de la dernière liste réussie (sidebar
        // identique à celle en ligne) PUIS défauts (première utilisation).
        console.warn('[useEnabledFeatureCodes] All retries failed — using snapshot/defaults (fail-open)');
        setError(true);
        const snap = readFeaturesSnapshot();
        setList(
          snap ?? Array.from(DEFAULT_ENABLED_CODES).map((code) => ({
            featureCode: code,
            isEnabled: true,
            status: 'ACTIVE',
          }))
        );
        retryCountRef.current = 0;
      })
      .finally(() => setLoading(false));
  }, [tenant?.id]);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  // ⭐ (sept. 2026 — retour promoteur « au retour de la connexion, il faut
  //    recharger avant que les données ne se chargent ») : au retour du
  //    réseau CONFIRMÉ (NetworkRecovery émet 'ah:network-restored' après
  //    une sonde de connectivité réussie), on RE-FETCH les features : la
  //    sidebar se met à jour sans rechargement manuel de la page.
  useEffect(() => {
    const onNetworkRestored = () => {
      retryCountRef.current = 0;
      fetchFeatures();
    };
    window.addEventListener('ah:network-restored', onNetworkRestored);
    return () => window.removeEventListener('ah:network-restored', onNetworkRestored);
  }, [fetchFeatures]);

  // Réagir aux changements depuis la page Paramètres (toggle module) pour mettre à jour la sidebar
  useEffect(() => {
    const handler = () => fetchFeatures();
    window.addEventListener('settings:features-updated', handler);
    return () => window.removeEventListener('settings:features-updated', handler);
  }, [fetchFeatures]);

  const enabledSet = useMemo(() => {
    const set = new Set<string>();
    for (const f of list) {
      if (f.isEnabled && (f.status === 'ACTIVE' || !f.status)) {
        set.add(f.featureCode);
      }
    }
    return set;
  }, [list]);

  return { enabledSet, loading, error, list, refresh: fetchFeatures };
}

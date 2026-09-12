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

/** Modules activés par défaut — utilisés comme fallback en cas d'erreur API */
const DEFAULT_ENABLED_CODES = new Set([
  'STUDENTS',
  'FINANCE',
  'EXAMS',
  'PEDAGOGY',
  'HR_PAYROLL',
  'COMMUNICATION',
]);

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
          console.warn('[useEnabledFeatureCodes] Empty feature list after retries — using defaults (fail-open)');
          setError(true);
          setList(
            Array.from(DEFAULT_ENABLED_CODES).map((code) => ({
              featureCode: code,
              isEnabled: true,
              status: 'ACTIVE',
            }))
          );
          return;
        }
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
        // FAIL-OPEN : après épuisement des retries (ou hors ligne), utiliser les
        // modules par défaut plutôt que de verrouiller l'utilisateur hors de l'app
        console.warn('[useEnabledFeatureCodes] All retries failed, using default enabled features (fail-open)');
        setError(true);
        setList(
          Array.from(DEFAULT_ENABLED_CODES).map((code) => ({
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

/**
 * Tenant Features Service (Frontend)
 * 
 * Service pour vérifier et gérer les features activées par tenant
 */

export enum FeatureCode {
  BILINGUAL_TRACK = 'BILINGUAL_TRACK',
}

import { getApiBaseUrl } from '@/lib/utils/urls';
const API_URL = getApiBaseUrl();

// ⭐ FIX PERFORMANCE CONCURRENCE — cache module-level 5 min + dédup en vol :
//    ce service est appelé par useFeature/useModuleContext à CHAQUE montage de
//    composant (257 usages) — avant, 1 fetch réseau par instance de composant.
//    Avec 20 enseignants connectés, chaque page = 3-5 fetchs identiques par
//    utilisateur vers le même endpoint. Le cache + la déduplication des
//    requêtes en vol ramènent ça à 1 fetch par onglet toutes les 5 min.
const FEATURE_CACHE_TTL_MS = 5 * 60 * 1000;
const featureCache = new Map<FeatureCode, { value: boolean; expiresAt: number }>();
const featureInFlight = new Map<FeatureCode, Promise<boolean>>();

/** Invalide le cache local des feature flags (après activation/désactivation). */
export function invalidateFeatureCache(featureCode?: FeatureCode) {
  if (featureCode) {
    featureCache.delete(featureCode);
  } else {
    featureCache.clear();
  }
}

/**
 * Vérifie si une feature est activée pour le tenant actuel
 */
export async function isFeatureEnabled(featureCode: FeatureCode): Promise<boolean> {
  const cached = featureCache.get(featureCode);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  // Dédup : si un fetch identique est déjà en vol, on attend son résultat
  const inFlight = featureInFlight.get(featureCode);
  if (inFlight) {
    return inFlight;
  }
  const request = (async () => {
    try {
      const response = await fetch(`${API_URL}/tenant-features/check/${featureCode}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        return false;
      }

      const value = await response.json();
      featureCache.set(featureCode, { value, expiresAt: Date.now() + FEATURE_CACHE_TTL_MS });
      return value;
    } catch (error) {
      console.error('Error checking feature:', error);
      return false;
    } finally {
      featureInFlight.delete(featureCode);
    }
  })();
  featureInFlight.set(featureCode, request);
  return request;
}

/**
 * Active une feature
 */
export async function enableFeature(
  featureCode: FeatureCode,
  reason?: string,
): Promise<{ feature: any; pricingImpact: { monthly: number; annual: number } }> {
  const response = await fetch(`${API_URL}/tenant-features/enable/${featureCode}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ reason }),
  });

  if (!response.ok) {
    throw new Error('Failed to enable feature');
  }

  invalidateFeatureCache(featureCode); // ⭐ FIX PERF — le cache local doit refléter la mutation
  return await response.json();
}

/**
 * Désactive une feature
 */
export async function disableFeature(
  featureCode: FeatureCode,
  reason?: string,
): Promise<{ feature: any; pricingImpact: { monthly: number; annual: number } }> {
  const response = await fetch(`${API_URL}/tenant-features/disable/${featureCode}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ reason }),
  });

  if (!response.ok) {
    throw new Error('Failed to disable feature');
  }

  invalidateFeatureCache(featureCode); // ⭐ FIX PERF — le cache local doit refléter la mutation
  return await response.json();
}

/**
 * Récupère l'impact pricing total
 */
export async function getPricingImpact(): Promise<{ monthly: number; annual: number }> {
  const response = await fetch(`${API_URL}/tenant-features/pricing-impact`, {
    credentials: 'include',
  });

  if (!response.ok) {
    return { monthly: 0, annual: 0 };
  }

  return await response.json();
}


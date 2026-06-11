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

/**
 * Vérifie si une feature est activée pour le tenant actuel
 */
export async function isFeatureEnabled(featureCode: FeatureCode): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/tenant-features/check/${featureCode}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      return false;
    }

    return await response.json();
  } catch (error) {
    console.error('Error checking feature:', error);
    return false;
  }
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


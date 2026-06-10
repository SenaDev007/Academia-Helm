/**
 * Tenant Resolver
 * 
 * Résout le tenant à partir du sous-domaine
 * Ex: ecole1.academiahub.com -> tenant avec subdomain="ecole1"
 */

import { headers } from 'next/headers';
import type { Tenant } from '@/types';

import { getApiBaseUrl } from '@/lib/utils/urls';
const API_URL = getApiBaseUrl();

/**
 * Extrait le sous-domaine depuis les headers (async — Next 15+ / `headers()`)
 */
export async function extractSubdomain(): Promise<string | null> {
  const headersList = await headers();
  const host = headersList.get('host') || headersList.get('x-forwarded-host');
  
  if (!host) return null;

  // En développement local, utiliser le header X-Tenant-Subdomain
  if (process.env.NODE_ENV === 'development') {
    const devSubdomain = headersList.get('x-tenant-subdomain');
    if (devSubdomain) return devSubdomain;
  }

  // Production: extraire depuis le host
  // Format: subdomain.academiahub.com
  const parts = host.split('.');
  
  // Si on a au moins 3 parties (subdomain.domain.tld)
  if (parts.length >= 3 && parts[0] !== 'www' && parts[0] !== 'localhost') {
    return parts[0];
  }

  return null;
}

/**
 * Résout le tenant depuis le sous-domaine
 */
export async function resolveTenant(subdomain: string | null): Promise<Tenant | null> {
  if (!subdomain) return null;

  try {
    const response = await fetch(`${API_URL}/tenants/by-subdomain/${subdomain}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Important: ne pas cacher les données tenant
    });

    if (!response.ok) {
      return null;
    }

    const tenant = await response.json() as Tenant;
    
    // Vérifier que le tenant est actif
    if (tenant.status !== 'active' && tenant.status !== 'trial') {
      return null;
    }

    return tenant;
  } catch (error) {
    console.error('Error resolving tenant:', error);
    return null;
  }
}

/**
 * Vérifie si la requête est pour le domaine principal (pas un sous-domaine)
 */
export async function isMainDomain(): Promise<boolean> {
  const subdomain = await extractSubdomain();
  return subdomain === null;
}


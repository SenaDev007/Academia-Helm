/**
 * Tenant Service
 * 
 * Service pour la gestion des tenants
 */

import { offlineFetch } from '@/lib/offline/offline-fetch';
import type { Tenant } from '@/types';

function getTenantId(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:(?:^|.*;\s*)x-tenant-id\s*\=\s*([^;]*).*$)|^.*$/);
  return match ? decodeURIComponent(match[1]) : '';
}

/**
 * Récupère un tenant par son sous-domaine
 */
export async function getTenantBySubdomain(subdomain: string): Promise<Tenant | null> {
  try {
    return await offlineFetch<Tenant>(`/tenants/by-subdomain/${subdomain}`, 'local_tenant_context', {
      tenantId: getTenantId(),
    });
  } catch (error) {
    return null;
  }
}

/**
 * Récupère un tenant par son ID
 */
export async function getTenantById(tenantId: string): Promise<Tenant | null> {
  try {
    return await offlineFetch<Tenant>(`/tenants/${tenantId}`, 'local_tenant_context', {
      tenantId: tenantId || getTenantId(),
    });
  } catch (error) {
    return null;
  }
}

/**
 * Tenant Service
 * 
 * Service pour la gestion des tenants
 */

import apiClient from '@/lib/api/client';
import type { Tenant } from '@/types';

/**
 * Récupère un tenant par son sous-domaine
 */
export async function getTenantBySubdomain(subdomain: string): Promise<Tenant | null> {
  try {
    const response = await apiClient.get<Tenant>(`/tenants/by-subdomain/${subdomain}`);
    return response.data;
  } catch (error) {
    return null;
  }
}

/**
 * Récupère un tenant par son ID
 */
export async function getTenantById(tenantId: string): Promise<Tenant | null> {
  try {
    const response = await apiClient.get<Tenant>(`/tenants/${tenantId}`);
    return response.data;
  } catch (error) {
    return null;
  }
}


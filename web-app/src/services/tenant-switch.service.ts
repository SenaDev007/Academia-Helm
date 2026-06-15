/**
 * Tenant Switch Service
 * 
 * Service pour gérer le changement de tenant actif
 * pour les utilisateurs SUPER_DIRECTOR (promoteurs)
 */

import apiClient from '@/lib/api/client';
import type { Tenant } from '@/types';
import { redirectToTenant } from '@/lib/utils/tenant-redirect';

/**
 * Change le tenant actif pour l'utilisateur connecté
 * Redirige vers le sous-domaine du nouveau tenant avec logging
 */
export async function switchTenant(tenantId: string, subdomain: string): Promise<void> {
  try {
    // Mettre à jour le tenant actif côté backend
    await apiClient.post('/auth/switch-tenant', { tenantId });
    
    // Rediriger vers le sous-domaine du nouveau tenant avec logging
    await redirectToTenant({
      tenantId,
      tenantSlug: subdomain,
      path: '/app',
    });
  } catch (error) {
    console.error('Error switching tenant:', error);
    throw new Error('Erreur lors du changement d\'établissement');
  }
}

/**
 * Récupère la liste des tenants accessibles pour l'utilisateur actuel
 */
export async function getAccessibleTenants(): Promise<Tenant[]> {
  try {
    const response = await apiClient.get<Tenant[]>('/auth/accessible-tenants');
    return response.data;
  } catch (error) {
    console.error('Error fetching accessible tenants:', error);
    return [];
  }
}


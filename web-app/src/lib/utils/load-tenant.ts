/**
 * ============================================================================
 * LOAD TENANT UTILITY - Chargement du tenant depuis l'API backend
 * ============================================================================
 * 
 * Fonction helper pour charger les informations complètes d'un tenant
 * depuis l'API backend après authentification.
 * 
 * ============================================================================
 */

import { getApiBaseUrlForRoutes } from './api-urls';
import type { Tenant } from '@/types';

const API_BASE_URL = getApiBaseUrlForRoutes();

/**
 * Charge un tenant depuis l'API backend par son ID
 * 
 * @param tenantId - ID du tenant (UUID)
 * @param token - Token JWT pour l'authentification (optionnel)
 * @returns Tenant complet ou null si erreur
 */
export async function loadTenantFromApi(
  tenantId: string,
  token?: string
): Promise<Tenant | null> {
  if (!tenantId || tenantId.trim() === '') {
    return null;
  }

  // Le token est requis pour appeler l'endpoint /tenants/:id
  if (!token) {
    console.warn('[loadTenantFromApi] Token is required to load tenant');
    return null;
  }

  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    const response = await fetch(`${API_BASE_URL}/tenants/${tenantId}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      // Si 404, le tenant n'existe pas
      if (response.status === 404) {
        console.warn(`[loadTenantFromApi] Tenant ${tenantId} not found`);
        return null;
      }
      // Pour les autres erreurs (401, 403, etc.), logger et retourner null
      console.warn(`[loadTenantFromApi] Failed to load tenant ${tenantId}: ${response.status} ${response.statusText}`);
      return null;
    }

    const tenantData = await response.json();

    // Helper pour convertir les dates
    const toISOString = (date: any): string | undefined => {
      if (!date) return undefined;
      if (typeof date === 'string') {
        // Si c'est déjà une string ISO, la retourner
        if (date.includes('T') || date.includes('Z')) return date;
        // Sinon essayer de la parser
        const parsed = new Date(date);
        return isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
      }
      if (date instanceof Date) return date.toISOString();
      return undefined;
    };

    // Mapper les données du backend vers le format Tenant attendu
    const tenant: Tenant = {
      id: tenantData.id,
      name: tenantData.name || 'Mon École',
      slug: tenantData.slug || '',
      subdomain: tenantData.subdomain || tenantData.slug || '',
      status: tenantData.status || 'active',
      subscriptionStatus: mapSubscriptionStatus(tenantData.subscriptionStatus, tenantData.status),
      createdAt: toISOString(tenantData.createdAt) || new Date().toISOString(),
      updatedAt: toISOString(tenantData.updatedAt) || new Date().toISOString(),
      trialEndsAt: toISOString(tenantData.trialEndsAt),
      nextPaymentDueAt: toISOString(tenantData.nextPaymentDueAt),
    };

    return tenant;
  } catch (error) {
    console.error(`[loadTenantFromApi] Error loading tenant ${tenantId}:`, error);
    return null;
  }
}

/**
 * Mappe le statut d'abonnement du backend vers le format SubscriptionStatus
 */
function mapSubscriptionStatus(
  subscriptionStatus?: string,
  status?: string
): Tenant['subscriptionStatus'] {
  // Si subscriptionStatus est déjà au bon format
  if (subscriptionStatus && ['PENDING', 'ACTIVE_TRIAL', 'ACTIVE_SUBSCRIBED', 'SUSPENDED', 'TERMINATED'].includes(subscriptionStatus)) {
    return subscriptionStatus as Tenant['subscriptionStatus'];
  }

  // Mapper depuis le statut legacy
  if (status === 'trial') return 'ACTIVE_TRIAL';
  if (status === 'active' && subscriptionStatus === 'active') return 'ACTIVE_SUBSCRIBED';
  if (status === 'suspended') return 'SUSPENDED';
  if (status === 'cancelled') return 'TERMINATED';

  // Par défaut
  return 'ACTIVE_TRIAL';
}

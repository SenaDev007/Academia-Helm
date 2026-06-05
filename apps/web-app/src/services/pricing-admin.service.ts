/**
 * Pricing Admin Service
 * 
 * Service pour gérer le pricing depuis le panel super admin
 */

import { offlineFetch, offlineMutation } from '@/lib/offline/offline-fetch';

export interface PricingConfig {
  id: string;
  initialSubscriptionFee: number;
  monthlyBasePrice: number;
  yearlyBasePrice: number;
  yearlyDiscountPercent: number;
  bilingualMonthlyAddon: number;
  bilingualYearlyAddon: number;
  schoolAdditionalPrice: number;
  trialDays: number;
  graceDays: number;
  reminderDays: number[];
  currency: string;
  isActive: boolean;
  version: number;
  createdAt: string;
  createdBy?: string;
  metadata?: any;
}

export interface PricingGroupTier {
  id: string;
  schoolsCount: number;
  monthlyPrice: number;
  yearlyPrice: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  metadata?: any;
}

export interface PricingOverride {
  id: string;
  tenantId?: string;
  code?: string;
  percentDiscount?: number;
  fixedPrice?: number;
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
  createdBy?: string;
  metadata?: any;
  tenant?: {
    id: string;
    name: string;
  };
}

function getTenantId(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:(?:^|.*;\s*)x-tenant-id\s*\=\s*([^;]*).*$)|^.*$/);
  return match ? decodeURIComponent(match[1]) : '';
}

/**
 * Récupère la configuration pricing active
 */
export async function getActivePricingConfig(): Promise<PricingConfig> {
  return offlineFetch<PricingConfig>('/admin/pricing/config', 'pricing_cache', {
    tenantId: getTenantId(),
  });
}

/**
 * Récupère toutes les versions de configuration (pour audit)
 */
export async function getAllPricingConfigs(): Promise<PricingConfig[]> {
  return offlineFetch<PricingConfig[]>('/admin/pricing/configs', 'pricing_cache', {
    tenantId: getTenantId(),
  });
}

/**
 * Crée une nouvelle version de configuration
 * Pricing mutation: networkOnly
 */
export async function createPricingConfig(data: Partial<PricingConfig>): Promise<PricingConfig> {
  const result = await offlineMutation<PricingConfig>('/admin/pricing/config', 'POST', data, {
    tenantId: getTenantId(),
    networkOnly: true,
  });
  if (result.error) throw new Error(result.error);
  return result.data!;
}

/**
 * Récupère tous les group tiers
 */
export async function getPricingGroupTiers(): Promise<PricingGroupTier[]> {
  return offlineFetch<PricingGroupTier[]>('/admin/pricing/group-tiers', 'pricing_cache', {
    tenantId: getTenantId(),
  });
}

/**
 * Crée ou met à jour un group tier
 * Pricing mutation: networkOnly
 */
export async function upsertPricingGroupTier(data: Partial<PricingGroupTier>): Promise<PricingGroupTier> {
  const result = await offlineMutation<PricingGroupTier>('/admin/pricing/group-tiers', 'POST', data, {
    tenantId: getTenantId(),
    networkOnly: true,
  });
  if (result.error) throw new Error(result.error);
  return result.data!;
}

/**
 * Récupère tous les overrides
 */
export async function getPricingOverrides(): Promise<PricingOverride[]> {
  return offlineFetch<PricingOverride[]>('/admin/pricing/overrides', 'pricing_cache', {
    tenantId: getTenantId(),
  });
}

/**
 * Crée un override (promo code ou tenant spécifique)
 * Pricing mutation: networkOnly
 */
export async function createPricingOverride(data: Partial<PricingOverride>): Promise<PricingOverride> {
  const result = await offlineMutation<PricingOverride>('/admin/pricing/overrides', 'POST', data, {
    tenantId: getTenantId(),
    networkOnly: true,
  });
  if (result.error) throw new Error(result.error);
  return result.data!;
}

/**
 * Désactive un override
 * Pricing mutation: networkOnly
 */
export async function deactivatePricingOverride(id: string): Promise<PricingOverride> {
  const result = await offlineMutation<PricingOverride>(`/admin/pricing/overrides/${id}/deactivate`, 'PUT', undefined, {
    tenantId: getTenantId(),
    networkOnly: true,
  });
  if (result.error) throw new Error(result.error);
  return result.data!;
}

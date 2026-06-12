/**
 * Pricing Admin Service
 * 
 * Service pour gérer le pricing depuis le panel super admin
 */

import { apiClient } from '@/lib/api/client';

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

/**
 * Récupère la configuration pricing active
 */
export async function getActivePricingConfig(): Promise<PricingConfig> {
  const response = await apiClient.get<PricingConfig>('/admin/pricing/config');
  return response.data;
}

/**
 * Récupère toutes les versions de configuration (pour audit)
 */
export async function getAllPricingConfigs(): Promise<PricingConfig[]> {
  const response = await apiClient.get<PricingConfig[]>('/admin/pricing/configs');
  return response.data;
}

/**
 * Crée une nouvelle version de configuration
 */
export async function createPricingConfig(data: Partial<PricingConfig>): Promise<PricingConfig> {
  const response = await apiClient.post<PricingConfig>('/admin/pricing/config', data);
  return response.data;
}

/**
 * Récupère tous les group tiers
 */
export async function getPricingGroupTiers(): Promise<PricingGroupTier[]> {
  const response = await apiClient.get<PricingGroupTier[]>('/admin/pricing/group-tiers');
  return response.data;
}

/**
 * Crée ou met à jour un group tier
 */
export async function upsertPricingGroupTier(data: Partial<PricingGroupTier>): Promise<PricingGroupTier> {
  const response = await apiClient.post<PricingGroupTier>('/admin/pricing/group-tiers', data);
  return response.data;
}

/**
 * Récupère tous les overrides
 */
export async function getPricingOverrides(): Promise<PricingOverride[]> {
  const response = await apiClient.get<PricingOverride[]>('/admin/pricing/overrides');
  return response.data;
}

/**
 * Crée un override (promo code ou tenant spécifique)
 */
export async function createPricingOverride(data: Partial<PricingOverride>): Promise<PricingOverride> {
  const response = await apiClient.post<PricingOverride>('/admin/pricing/overrides', data);
  return response.data;
}

/**
 * Désactive un override
 */
export async function deactivatePricingOverride(id: string): Promise<PricingOverride> {
  const response = await apiClient.put<PricingOverride>(`/admin/pricing/overrides/${id}/deactivate`);
  return response.data;
}

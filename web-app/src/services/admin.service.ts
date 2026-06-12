/**
 * Admin Service
 * 
 * Service pour les opérations Super Admin
 * Accès ultra sécurisé - uniquement pour le rôle SUPER_ADMIN
 */

import apiClient from '@/lib/api/client';
import type {
  AdminDashboardData,
  AdminTenantView,
  AdminAuditLog,
  TenantActionRequest,
  SubscriptionModificationRequest,
  GlobalStats,
  Testimonial,
} from '@/types';

/**
 * Récupère les données du dashboard Super Admin
 */
export async function getAdminDashboard(): Promise<AdminDashboardData> {
  const response = await apiClient.get<AdminDashboardData>('/admin/dashboard');
  return response.data;
}

/**
 * Récupère la liste de tous les tenants
 */
export async function getAllTenants(
  page = 1,
  limit = 50,
  filters?: {
    status?: string;
    search?: string;
  }
): Promise<{ tenants: AdminTenantView[]; total: number; page: number; limit: number }> {
  const params: Record<string, any> = { page, limit };
  if (filters?.status) params.status = filters.status;
  if (filters?.search) params.search = filters.search;

  const response = await apiClient.get<{ tenants: AdminTenantView[]; total: number; page: number; limit: number }>(
    '/admin/tenants',
    { params }
  );
  return response.data;
}

/**
 * Récupère les détails d'un tenant spécifique
 */
export async function getTenantDetails(tenantId: string): Promise<AdminTenantView> {
  const response = await apiClient.get<AdminTenantView>(`/admin/tenants/${tenantId}`);
  return response.data;
}

/**
 * Suspend un tenant
 */
export async function suspendTenant(request: TenantActionRequest): Promise<void> {
  await apiClient.post(`/admin/tenants/${request.tenantId}/suspend`, {
    reason: request.reason,
    notifyTenant: request.notifyTenant,
  });
}

/**
 * Active un tenant (lève la suspension)
 */
export async function activateTenant(request: TenantActionRequest): Promise<void> {
  await apiClient.post(`/admin/tenants/${request.tenantId}/activate`, {
    reason: request.reason,
    notifyTenant: request.notifyTenant,
  });
}

/**
 * Termine définitivement un tenant
 */
export async function terminateTenant(request: TenantActionRequest): Promise<void> {
  await apiClient.post(`/admin/tenants/${request.tenantId}/terminate`, {
    reason: request.reason,
    notifyTenant: request.notifyTenant,
  });
}

/**
 * Modifie le statut d'abonnement d'un tenant
 */
export async function modifySubscription(request: SubscriptionModificationRequest): Promise<void> {
  await apiClient.post(`/admin/tenants/${request.tenantId}/subscription`, {
    newStatus: request.newStatus,
    reason: request.reason,
    effectiveDate: request.effectiveDate,
    notifyTenant: request.notifyTenant,
  });
}

/**
 * Récupère les statistiques globales
 */
export async function getGlobalStats(): Promise<GlobalStats> {
  const response = await apiClient.get<GlobalStats>('/admin/stats');
  return response.data;
}

/**
 * Récupère les journaux d'audit
 */
export async function getAuditLogs(
  page = 1,
  limit = 50,
  filters?: {
    action?: string;
    targetType?: string;
    adminId?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<{ logs: AdminAuditLog[]; total: number; page: number; limit: number }> {
  const params: Record<string, any> = { page, limit };
  if (filters?.action) params.action = filters.action;
  if (filters?.targetType) params.targetType = filters.targetType;
  if (filters?.adminId) params.adminId = filters.adminId;
  if (filters?.startDate) params.startDate = filters.startDate;
  if (filters?.endDate) params.endDate = filters.endDate;

  const response = await apiClient.get<{ logs: AdminAuditLog[]; total: number; page: number; limit: number }>(
    '/admin/audit-logs',
    { params }
  );
  return response.data;
}

/**
 * Récupère les témoignages en attente de validation
 */
export async function getPendingTestimonials(): Promise<Testimonial[]> {
  const response = await apiClient.get<Testimonial[]>('/admin/testimonials/pending');
  return response.data;
}

/**
 * Approuve un témoignage
 */
export async function approveTestimonial(
  testimonialId: string,
  featured?: boolean
): Promise<void> {
  await apiClient.post(`/admin/testimonials/${testimonialId}/approve`, {
    featured,
  });
}

/**
 * Rejette un témoignage
 */
export async function rejectTestimonial(
  testimonialId: string,
  reason: string
): Promise<void> {
  await apiClient.post(`/admin/testimonials/${testimonialId}/reject`, {
    reason,
  });
}


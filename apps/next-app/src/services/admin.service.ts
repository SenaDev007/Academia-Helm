/**
 * Admin Service
 * 
 * Service pour les opérations Super Admin
 * Accès ultra sécurisé - uniquement pour le rôle SUPER_ADMIN
 */

import { offlineFetch, offlineMutation } from '@/lib/offline/offline-fetch';
import type {
  AdminDashboardData,
  AdminTenantView,
  AdminAuditLog,
  TenantActionRequest,
  SubscriptionModificationRequest,
  GlobalStats,
  Testimonial,
} from '@/types';

function getTenantId(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:(?:^|.*;\s*)x-tenant-id\s*\=\s*([^;]*).*$)|^.*$/);
  return match ? decodeURIComponent(match[1]) : '';
}

/**
 * Récupère les données du dashboard Super Admin
 */
export async function getAdminDashboard(): Promise<AdminDashboardData> {
  return offlineFetch<AdminDashboardData>('/admin/dashboard', 'admin_cache', {
    tenantId: getTenantId(),
  });
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

  const qs = new URLSearchParams(params).toString();
  return offlineFetch<{ tenants: AdminTenantView[]; total: number; page: number; limit: number }>(
    `/admin/tenants?${qs}`,
    'admin_cache',
    { tenantId: getTenantId() }
  );
}

/**
 * Récupère les détails d'un tenant spécifique
 */
export async function getTenantDetails(tenantId: string): Promise<AdminTenantView> {
  return offlineFetch<AdminTenantView>(`/admin/tenants/${tenantId}`, 'admin_cache', {
    tenantId: getTenantId(),
  });
}

/**
 * Suspend un tenant
 * Security-sensitive: networkOnly
 */
export async function suspendTenant(request: TenantActionRequest): Promise<void> {
  const result = await offlineMutation(
    `/admin/tenants/${request.tenantId}/suspend`,
    'POST',
    {
      reason: request.reason,
      notifyTenant: request.notifyTenant,
    },
    { tenantId: getTenantId(), networkOnly: true }
  );
  if (result.error) throw new Error(result.error);
}

/**
 * Active un tenant (lève la suspension)
 * Security-sensitive: networkOnly
 */
export async function activateTenant(request: TenantActionRequest): Promise<void> {
  const result = await offlineMutation(
    `/admin/tenants/${request.tenantId}/activate`,
    'POST',
    {
      reason: request.reason,
      notifyTenant: request.notifyTenant,
    },
    { tenantId: getTenantId(), networkOnly: true }
  );
  if (result.error) throw new Error(result.error);
}

/**
 * Termine définitivement un tenant
 * Security-sensitive: networkOnly
 */
export async function terminateTenant(request: TenantActionRequest): Promise<void> {
  const result = await offlineMutation(
    `/admin/tenants/${request.tenantId}/terminate`,
    'POST',
    {
      reason: request.reason,
      notifyTenant: request.notifyTenant,
    },
    { tenantId: getTenantId(), networkOnly: true }
  );
  if (result.error) throw new Error(result.error);
}

/**
 * Modifie le statut d'abonnement d'un tenant
 * Security-sensitive: networkOnly
 */
export async function modifySubscription(request: SubscriptionModificationRequest): Promise<void> {
  const result = await offlineMutation(
    `/admin/tenants/${request.tenantId}/subscription`,
    'POST',
    {
      newStatus: request.newStatus,
      reason: request.reason,
      effectiveDate: request.effectiveDate,
      notifyTenant: request.notifyTenant,
    },
    { tenantId: getTenantId(), networkOnly: true }
  );
  if (result.error) throw new Error(result.error);
}

/**
 * Récupère les statistiques globales
 */
export async function getGlobalStats(): Promise<GlobalStats> {
  return offlineFetch<GlobalStats>('/admin/stats', 'admin_cache', {
    tenantId: getTenantId(),
  });
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

  const qs = new URLSearchParams(params).toString();
  return offlineFetch<{ logs: AdminAuditLog[]; total: number; page: number; limit: number }>(
    `/admin/audit-logs?${qs}`,
    'admin_cache',
    { tenantId: getTenantId() }
  );
}

/**
 * Récupère les témoignages en attente de validation
 */
export async function getPendingTestimonials(): Promise<Testimonial[]> {
  return offlineFetch<Testimonial[]>('/admin/testimonials/pending', 'admin_cache', {
    tenantId: getTenantId(),
  });
}

/**
 * Approuve un témoignage
 * Security-sensitive: networkOnly
 */
export async function approveTestimonial(
  testimonialId: string,
  featured?: boolean
): Promise<void> {
  const result = await offlineMutation(
    `/admin/testimonials/${testimonialId}/approve`,
    'POST',
    { featured },
    { tenantId: getTenantId(), networkOnly: true }
  );
  if (result.error) throw new Error(result.error);
}

/**
 * Rejette un témoignage
 * Security-sensitive: networkOnly
 */
export async function rejectTestimonial(
  testimonialId: string,
  reason: string
): Promise<void> {
  const result = await offlineMutation(
    `/admin/testimonials/${testimonialId}/reject`,
    'POST',
    { reason },
    { tenantId: getTenantId(), networkOnly: true }
  );
  if (result.error) throw new Error(result.error);
}

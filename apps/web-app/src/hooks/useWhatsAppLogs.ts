/**
 * ============================================================================
 * USE WHATSAPP LOGS — Hook React Query pour l'historique WhatsApp
 * ============================================================================
 *
 * Miroir de useEmailLogs.ts mais pour WhatsApp.
 * Récupère les WhatsappLogs depuis le backend via la route BFF.
 * ============================================================================
 */

'use client';

import { useQuery } from '@tanstack/react-query';

export interface WhatsAppLog {
  id: string;
  tenantId: string;
  category: string;
  subCategory?: string;
  module?: string;
  recipient: string;
  recipientName?: string;
  recipientType?: string;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  templateId?: string;
  message?: string;
  provider?: string;
  providerId?: string;
  errorMessage?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppLogListResponse {
  data: WhatsAppLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface WhatsAppLogStats {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  byModule: Record<string, number>;
  deliveryRate: number;
  readRate: number;
  failureRate: number;
}

interface UseWhatsAppLogsOptions {
  tenantId?: string;
  category?: string;
  module?: string;
  status?: string;
  recipient?: string;
  templateId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
}

export function useWhatsAppLogs(options: UseWhatsAppLogsOptions = {}) {
  const {
    tenantId, category, module, status, recipient, templateId,
    dateFrom, dateTo, page = 1, pageSize = 20, enabled = true,
  } = options;

  const query = useQuery<WhatsAppLogListResponse>({
    queryKey: ['whatsapp-logs', tenantId, category, module, status, recipient, templateId, dateFrom, dateTo, page, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (tenantId) params.set('tenantId', tenantId);
      if (category) params.set('category', category);
      if (module) params.set('module', module);
      if (status) params.set('status', status);
      if (recipient) params.set('recipient', recipient);
      if (templateId) params.set('templateId', templateId);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));

      const res = await fetch(`/api/communication/whatsapp-logs?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!tenantId && enabled,
    staleTime: 30 * 1000, // 30s
    refetchOnWindowFocus: false,
  });

  return {
    logs: query.data?.data ?? [],
    total: query.data?.total ?? 0,
    page: query.data?.page ?? 1,
    pageSize: query.data?.pageSize ?? 20,
    totalPages: query.data?.totalPages ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useWhatsAppLogStats(options: { tenantId?: string; dateFrom?: string; dateTo?: string; enabled?: boolean } = {}) {
  const { tenantId, dateFrom, dateTo, enabled = true } = options;

  const query = useQuery<WhatsAppLogStats>({
    queryKey: ['whatsapp-logs-stats', tenantId, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (tenantId) params.set('tenantId', tenantId);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/communication/whatsapp-logs-stats?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!tenantId && enabled,
    staleTime: 60 * 1000, // 1 min
    refetchOnWindowFocus: false,
  });

  return {
    stats: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export default useWhatsAppLogs;

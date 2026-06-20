/**
 * useEmailLogs — Hook pour récupérer et filtrer les EmailLogs
 *
 * Usage :
 *   const { data, isLoading, error, refetch, filters, setFilters } = useEmailLogs({
 *     tenantId: '...',
 *     page: 1,
 *     pageSize: 25,
 *   });
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

// Helper : récupère le tenantId depuis le cookie `x-tenant-id`
// (posé par le middleware d'auth — utilisé par tous les proxies API)
function getTenantIdFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)x-tenant-id=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export interface EmailLog {
  id: string;
  tenantId: string;
  category: string | null;
  subCategory: string | null;
  module: string | null;
  fromEmail: string | null;
  fromName: string | null;
  recipient: string;
  recipientName: string | null;
  recipientType: string | null;
  recipientId: string | null;
  subject: string;
  status: string;
  provider: string | null;
  providerId: string | null;
  threadId: string | null;
  replyTo: string | null;
  replyToToken: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  bouncedAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  openCount: number;
  clickCount: number;
  errorMessage: string | null;
  triggeredBy: string | null;
  triggeredByUserId: string | null;
  relatedEntityId: string | null;
  relatedEntityType: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { replies: number };
}

export interface EmailLogFilters {
  category?: string;
  subCategory?: string;
  module?: string;
  status?: string;
  recipient?: string;
  recipientType?: string;
  search?: string;
  threadId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface EmailLogListResult {
  data: EmailLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface UseEmailLogsOptions {
  tenantId?: string;
  initialFilters?: EmailLogFilters;
  enabled?: boolean;
}

export function useEmailLogs({ tenantId, initialFilters = {}, enabled = true }: UseEmailLogsOptions) {
  const [data, setData] = useState<EmailLogListResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<EmailLogFilters>({
    page: 1,
    pageSize: 25,
    ...initialFilters,
  });

  // Résoudre tenantId : passé en prop, ou depuis le cookie
  const resolvedTenantId = tenantId || (typeof document !== 'undefined' ? getTenantIdFromCookie() : null);

  const refetch = useCallback(async () => {
    if (!resolvedTenantId || !enabled) return;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ tenantId: resolvedTenantId });
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });

      const res = await fetch(`/api/communication/email-logs?${params.toString()}`);
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.message || `HTTP ${res.status}`);
      }
      const result = await res.json();
      setData(result);
    } catch (err: any) {
      console.error('useEmailLogs error:', err);
      setError(err.message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [resolvedTenantId, enabled, filters]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, isLoading, error, refetch, filters, setFilters };
}

/**
 * useEmailLogStats — Hook pour récupérer les statistiques agrégées.
 */
export function useEmailLogStats(dateFrom?: string, dateTo?: string, tenantId?: string) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedTenantId = tenantId || (typeof document !== 'undefined' ? getTenantIdFromCookie() : null);

  const refetch = useCallback(async () => {
    if (!resolvedTenantId) return;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ tenantId: resolvedTenantId });
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);

      const res = await fetch(`/api/communication/email-logs-stats?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      setData(result);
    } catch (err: any) {
      console.error('useEmailLogStats error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [resolvedTenantId, dateFrom, dateTo]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, isLoading, error, refetch };
}

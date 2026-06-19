/**
 * useInboundEmails — Hook pour récupérer les InboundEmails (boîte de réception)
 *
 * Usage :
 *   const { data, isLoading, refetch, filters, setFilters } = useInboundEmails({
 *     tenantId: '...',
 *   });
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

// Helper : récupère le tenantId depuis le cookie `x-tenant-id`
function getTenantIdFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)x-tenant-id=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export interface InboundEmail {
  id: string;
  tenantId: string;
  originalEmailId: string | null;
  threadId: string | null;
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  subject: string;
  textContent: string | null;
  htmlContent: string | null;
  attachments: string | null;
  status: string;
  errorMessage: string | null;
  receivedAt: string;
  processedAt: string | null;
  originalEmail?: {
    id: string;
    subject: string;
    category: string | null;
    subCategory: string | null;
    recipientName: string | null;
  } | null;
}

export interface InboundEmailFilters {
  search?: string;
  threadId?: string;
  fromEmail?: string;
  page?: number;
  pageSize?: number;
}

interface UseInboundEmailsOptions {
  tenantId?: string;
  initialFilters?: InboundEmailFilters;
  enabled?: boolean;
}

export function useInboundEmails({
  tenantId,
  initialFilters = {},
  enabled = true,
}: UseInboundEmailsOptions) {
  const [data, setData] = useState<{ data: InboundEmail[]; total: number; page: number; pageSize: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<InboundEmailFilters>({
    page: 1,
    pageSize: 25,
    ...initialFilters,
  });

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

      const res = await fetch(`/api/communication/inbound-emails?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      setData(result);
    } catch (err: any) {
      console.error('useInboundEmails error:', err);
      setError(err.message);
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
 * useEmailThread — Hook pour récupérer un thread complet (sortant + entrant).
 */
export function useEmailThread(threadId: string | null) {
  const [data, setData] = useState<{
    outbound: any[];
    inbound: any[];
    chronological: any[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedTenantId = typeof document !== 'undefined' ? getTenantIdFromCookie() : null;

  const refetch = useCallback(async () => {
    if (!threadId || !resolvedTenantId) return;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ tenantId: resolvedTenantId });
      const res = await fetch(`/api/communication/email-logs/thread/${threadId}?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      setData(result);
    } catch (err: any) {
      console.error('useEmailThread error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [threadId, resolvedTenantId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, isLoading, error, refetch };
}

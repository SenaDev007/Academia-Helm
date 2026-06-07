/**
 * ============================================================================
 * TRANSFERS SERVICE
 * ============================================================================
 */

import { offlineFetch, offlineMutation } from '@/lib/offline/offline-fetch';

const BASE_URL = '/transfers';

function getTenantId(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:(?:^|.*;\s*)x-tenant-id\s*\=\s*([^;]*).*$)|^.*$/);
  return match ? decodeURIComponent(match[1]) : '';
}

class TransfersService {
  async getAll(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return offlineFetch(`${BASE_URL}${qs ? `?${qs}` : ''}`, 'transfers_cache', {
      tenantId: getTenantId(),
    });
  }

  async create(data: any): Promise<any> {
    const result = await offlineMutation(BASE_URL, 'POST', data, {
      tenantId: getTenantId(),
    });
    if (result.error) throw new Error(result.error);
    return result.data;
  }

  async approve(id: string, data: any): Promise<any> {
    const result = await offlineMutation(`${BASE_URL}/${id}/approve`, 'POST', data, {
      tenantId: getTenantId(),
    });
    if (result.error) throw new Error(result.error);
    return result.data;
  }

  async reject(id: string, data: any): Promise<any> {
    const result = await offlineMutation(`${BASE_URL}/${id}/reject`, 'POST', data, {
      tenantId: getTenantId(),
    });
    if (result.error) throw new Error(result.error);
    return result.data;
  }
}

export const transfersService = new TransfersService();

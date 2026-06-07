/**
 * ============================================================================
 * DISCIPLINE SERVICE
 * ============================================================================
 */

import { apiFetch } from '@/lib/api/client';
import { createEntityOffline } from '@/lib/offline/offline-business.service';
import { networkDetectionService } from '@/lib/offline/network-detection.service';
import { LocalSearchService } from '@/lib/offline/local-search.service';

const BASE_URL = '/discipline';

function getTenantId(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:(?:^|.*;\s*)x-tenant-id\s*\=\s*([^;]*).*$)|^.*$/);
  return match ? decodeURIComponent(match[1]) : "";
}

class DisciplineService {
  async getAll(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    
    if (!networkDetectionService.isConnected()) {
      return LocalSearchService.search("discipline", { tenantId: getTenantId() });
    }

    try {
      return await apiFetch(`${BASE_URL}${qs ? `?${qs}` : ''}`);
    } catch (error) {
      return LocalSearchService.search("discipline", { tenantId: getTenantId() });
    }
  }

  async create(data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return createEntityOffline(tenantId, 'DISCIPLINARY_INCIDENT', data);
    }
    
    return apiFetch(BASE_URL, {
      method: 'POST',
      body: data,
    });
  }
}

export const disciplineService = new DisciplineService();

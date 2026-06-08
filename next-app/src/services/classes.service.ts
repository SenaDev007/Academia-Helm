/**
 * ============================================================================
 * CLASSES SERVICE - Offline-First
 * ============================================================================
 */

import { apiFetch } from '@/lib/api/client';
import { createEntityOffline, updateEntityOffline } from '@/lib/offline/offline-business.service';
import { networkDetectionService } from '@/lib/offline/network-detection.service';
import { LocalSearchService } from '@/lib/offline/local-search.service';

const BASE_URL = '/classes';

function getTenantId(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:(?:^|.*;\s*)x-tenant-id\s*\=\s*([^;]*).*$)|^.*$/);
  return match ? decodeURIComponent(match[1]) : "";
}

class ClassesService {
  async getAll(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    
    if (!networkDetectionService.isConnected()) {
      return LocalSearchService.search("classes", { tenantId: getTenantId() });
    }
    
    try {
      return await apiFetch(`${BASE_URL}${qs ? `?${qs}` : ''}`);
    } catch (error) {
      return LocalSearchService.search("classes", { tenantId: getTenantId() });
    }
  }

  async create(data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return createEntityOffline(tenantId, 'CLASS', data);
    }
    return apiFetch(BASE_URL, {
      method: 'POST',
      body: data,
    });
  }

  async update(id: string, data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return updateEntityOffline(tenantId, 'CLASS', id, data);
    }
    return apiFetch(`${BASE_URL}/${id}`, {
      method: 'PUT',
      body: data,
    });
  }
}

export const classesService = new ClassesService();

/**
 * ============================================================================
 * TRANSFERS SERVICE
 * ============================================================================
 */

import { apiFetch } from '@/lib/api/client';

const BASE_URL = '/transfers';

class TransfersService {
  async getAll(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return apiFetch(`${BASE_URL}${qs ? `?${qs}` : ''}`);
  }

  async create(data: any): Promise<any> {
    return apiFetch(BASE_URL, {
      method: 'POST',
      body: data,
    });
  }

  async approve(id: string, data: any): Promise<any> {
    return apiFetch(`${BASE_URL}/${id}/approve`, {
      method: 'POST',
      body: data,
    });
  }

  async reject(id: string, data: any): Promise<any> {
    return apiFetch(`${BASE_URL}/${id}/reject`, {
      method: 'POST',
      body: data,
    });
  }
}

export const transfersService = new TransfersService();

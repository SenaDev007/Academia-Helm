/**
 * ============================================================================
 * CLASSES SERVICE
 * ============================================================================
 */

import { apiFetch } from '@/lib/api/client';

const BASE_URL = '/classes';

class ClassesService {
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
}

export const classesService = new ClassesService();

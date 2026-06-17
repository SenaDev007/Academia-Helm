/**
 * ============================================================================
 * MODULES COMPLÉMENTAIRES — Client API
 * ============================================================================
 *
 * Client fetch pour les 8 modules complémentaires (Library, Transport, Canteen,
 * Infirmary, QHSE, EduCast, Shop, Laboratory).
 *
 * Toutes les requêtes passent automatiquement :
 * - Le header Authorization (via apiClient Axios)
 * - Le header x-academic-year-id (via interceptor Axios)
 * - Le header x-tenant-id (via interceptor Axios)
 * - academicYearId en query param (requis par le backend modules-complementaires)
 *
 * Utilisation :
 *   import { modulesApi } from '@/lib/modules-complementaires/client';
 *   const stats = await modulesApi.get('library/stats', { academicYearId });
 * ============================================================================
 */

import { apiClient } from '@/lib/api/client';

const BASE_PATH = '/modules-complementaires';

export interface ModulesApiOptions {
  academicYearId?: string;
  tenantId?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Construit une query string à partir des options.
 * Les valeurs undefined/null/'' sont ignorées.
 */
function buildQueryString(options?: ModulesApiOptions): string {
  if (!options) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Client pour les modules complémentaires.
 *
 * Toutes les méthodes retournent une Promise<any>.
 * En cas d'erreur réseau ou 4xx/5xx, la Promise est rejetée avec un Error
 * dont le message contient le détail de l'erreur backend.
 */
export const modulesApi = {
  /**
   * GET /modules-complementaires/<path>
   */
  async get<T = any>(path: string, options?: ModulesApiOptions): Promise<T> {
    const url = `${BASE_PATH}/${path.replace(/^\//, '')}${buildQueryString(options)}`;
    const res = await apiClient.get(url);
    return res.data as T;
  },

  /**
   * POST /modules-complementaires/<path>
   */
  async post<T = any>(path: string, body?: any, options?: ModulesApiOptions): Promise<T> {
    const url = `${BASE_PATH}/${path.replace(/^\//, '')}${buildQueryString(options)}`;
    const res = await apiClient.post(url, body ?? {});
    return res.data as T;
  },

  /**
   * PUT /modules-complementaires/<path>
   */
  async put<T = any>(path: string, body?: any, options?: ModulesApiOptions): Promise<T> {
    const url = `${BASE_PATH}/${path.replace(/^\//, '')}${buildQueryString(options)}`;
    const res = await apiClient.put(url, body ?? {});
    return res.data as T;
  },

  /**
   * PATCH /modules-complementaires/<path>
   */
  async patch<T = any>(path: string, body?: any, options?: ModulesApiOptions): Promise<T> {
    const url = `${BASE_PATH}/${path.replace(/^\//, '')}${buildQueryString(options)}`;
    const res = await apiClient.patch(url, body ?? {});
    return res.data as T;
  },

  /**
   * DELETE /modules-complementaires/<path>
   */
  async delete<T = any>(path: string, options?: ModulesApiOptions): Promise<T> {
    const url = `${BASE_PATH}/${path.replace(/^\//, '')}${buildQueryString(options)}`;
    const res = await apiClient.delete(url);
    return res.data as T;
  },
};

/**
 * Helper pour construire les options API standard avec academicYearId.
 *
 * Usage :
 *   const { academicYear } = useModuleContext();
 *   const apiOpts = buildModulesApiOptions(academicYear?.id);
 *   const stats = await modulesApi.get('library/stats', apiOpts);
 *
 * Retourne { academicYearId } si academicYearId est fourni, sinon {}.
 */
export function buildModulesApiOptions(academicYearId?: string, tenantId?: string): ModulesApiOptions {
  const opts: ModulesApiOptions = {};
  if (academicYearId) opts.academicYearId = academicYearId;
  if (tenantId) opts.tenantId = tenantId;
  return opts;
}

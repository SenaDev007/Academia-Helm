/**
 * API Client
 * 
 * Client HTTP pour communiquer avec l'API backend
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { getClientToken } from '@/lib/auth/session-client';
import { getApiBaseUrl } from '@/lib/utils/urls';

const API_URL = getApiBaseUrl();

/**
 * Instance Axios configurée
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Intercepteur de requête : Ajoute le token JWT et le tenant ID
 */
apiClient.interceptors.request.use(
  (config) => {
    // Ajouter le token JWT
    const token = getClientToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Ajouter le tenant ID depuis les headers Next.js
    // (sera géré par le middleware)
    if (typeof window !== 'undefined') {
      const tenantId = document.cookie
        .split('; ')
        .find(row => row.startsWith('x-tenant-id='))
        ?.split('=')[1];
      
      if (tenantId && config.headers) {
        config.headers['X-Tenant-ID'] = tenantId;
      }

      // Ajouter le niveau scolaire depuis localStorage
      const schoolLevelStr = localStorage.getItem('schoolLevel');
      if (schoolLevelStr) {
        try {
          const sl = JSON.parse(schoolLevelStr);
          if (sl.id && config.headers) {
            config.headers['x-school-level-id'] = sl.id;
          }
        } catch (e) {}
      }

      // Ajouter l'année académique depuis localStorage
      const academicYearStr = localStorage.getItem('academicYear');
      if (academicYearStr) {
        try {
          const ay = JSON.parse(academicYearStr);
          if (ay.id && config.headers) {
            config.headers['x-academic-year-id'] = ay.id;
          }
        } catch (e) {}
      }
      
      // Injecter le type de module dynamiquement
      const pathParts = window.location.pathname.split('/');
      if (pathParts.length > 2 && pathParts[1] === 'app') {
        const moduleType = pathParts[2]; // ex: 'exams', 'hr', 'finance'
        if (moduleType && config.headers) {
          config.headers['x-module-type'] = moduleType.toUpperCase();
        }
      }
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

/**
 * Intercepteur de réponse : Gère les erreurs
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Non authentifié : rediriger vers login
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;

/**
 * Facade API minimale
 *
 * ⚠️ Pour l'instant, on expose uniquement la structure nécessaire ou on laisse
 * des méthodes factices qui lèvent une erreur explicite si utilisées sans implémentation.
 */
export const api: any = {
  finance: {
    async getPayments() {
      throw new Error('api.finance.getPayments is not implemented in web client yet');
    },
    async createPayment() {
      throw new Error('api.finance.createPayment is not implemented in web client yet');
    },
    async updatePayment() {
      throw new Error('api.finance.updatePayment is not implemented in web client yet');
    },
    async deletePayment() {
      throw new Error('api.finance.deletePayment is not implemented in web client yet');
    },
  },
};

/**
 * Wrapper fetch-like pour axios
 */
export async function apiFetch<T>(url: string, options: any = {}): Promise<T> {
  const method = options.method || 'GET';
  const response = await apiClient({
    url,
    method,
    data: options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : undefined,
    ...options,
  });
  return response.data;
}


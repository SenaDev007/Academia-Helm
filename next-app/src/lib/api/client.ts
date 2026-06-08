/**
 * API Client
 * 
 * Client HTTP pour communiquer avec l'API backend
 * Inclut un intercepteur offline-aware qui évite les crashes hors ligne
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getClientToken } from '@/lib/auth/session-client';
import { getApiBaseUrl } from '@/lib/utils/urls';
import { tryRefreshAccessToken } from '@/lib/auth/client-access-token';

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
 * Intercepteur de réponse : Gère les erreurs avec support offline + auto-refresh
 */
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

function processQueue(error: any, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(error);
  });
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    // Erreur réseau (pas de réponse = hors ligne ou timeout)
    if (!error.response) {
      // Ne PAS rediriger vers login quand hors ligne
      // L'utilisateur a simplement perdu la connexion, pas sa session
      console.warn('[API Client] Erreur réseau (connexion indisponible) :', error.message);
      
      // Marquer l'erreur comme offline pour que les callers puissent réagir
      const offlineError: any = new Error(
        'Connexion indisponible. Vérifiez votre connexion Internet et réessayez.'
      );
      offlineError.isOffline = true;
      offlineError.originalError = error;
      return Promise.reject(offlineError);
    }

    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Erreur 401 : Non authentifié
    if (error.response.status === 401) {
      // Vérifier si on est hors ligne — ne pas rediriger si c'est juste une erreur réseau
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        console.warn('[API Client] 401 reçu hors ligne — probablement un token expiré, utilisation du cache');
        const offlineError: any = new Error('Session expirée hors ligne. Les données en cache sont disponibles.');
        offlineError.isOffline = true;
        offlineError.isAuthExpired = true;
        return Promise.reject(offlineError);
      }

      // Si c'est déjà une requête retry, ne pas boucler → rediriger vers login
      if (originalRequest._retry) {
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      // Si un refresh est déjà en cours, mettre en queue
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve: (token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(originalRequest));
          }, reject });
        });
      }

      // Tenter le refresh du token
      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshed = await tryRefreshAccessToken();
        if (refreshed) {
          const newToken = localStorage.getItem('accessToken')?.trim();
          if (newToken) {
            processQueue(null, newToken);
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return apiClient(originalRequest);
          }
        }
        // Refresh échoué → rediriger vers login
        processQueue(error, null);
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      } catch (refreshError) {
        processQueue(refreshError, null);
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
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


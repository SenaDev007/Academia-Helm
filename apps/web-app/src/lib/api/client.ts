/**
 * API Client
 * 
 * Client HTTP pour communiquer avec l'API backend
 * Inclut un intercepteur offline-aware qui évite les crashes hors ligne
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getClientToken } from '@/lib/auth/session-client';
import { getApiBaseUrl } from '@/lib/utils/urls';
import { tryRefreshAccessToken, clearClientSessionSync } from '@/lib/auth/client-access-token';

const API_URL = getApiBaseUrl();

/**
 * Instance Axios configurée
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 8000,
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
      // Source 1 : cookie x-tenant-id
      let tenantId = document.cookie
        .split('; ')
        .find(row => row.startsWith('x-tenant-id='))
        ?.split('=')[1];

      // Source 2 (fallback) : localStorage session (quand le cookie n'est pas posé
      // car le login n'a pas envoyé tenant_id, le tenantId peut être stocké
      // dans localStorage par persistClientSession)
      if (!tenantId) {
        try {
          const sessionStr = localStorage.getItem('session');
          if (sessionStr) {
            const session = JSON.parse(sessionStr);
            if (session.tenantId && typeof session.tenantId === 'string') {
              tenantId = session.tenantId;
            }
          }
        } catch { /* ignore */ }
      }

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
      // ⭐ Distinguer timeout (ECONNABORTED / ETIMEDOUT) de hors ligne.
      //    Un timeout ne signifie PAS que l'utilisateur est hors ligne —
      //    juste que le serveur a mis trop de temps à répondre. Dans ce cas,
      //    on ne dit PAS "Connexion indisponible" mais "Délai d'attente dépassé".
      const isTimeout = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
        || (error.message && (error.message.includes('timeout') || error.message.includes('timeout of')));

      if (isTimeout) {
        console.warn('[API Client] Timeout (délai d\\'attente dépassé) :', error.message);
        const timeoutError: any = new Error(
          'Délai d\\'attente dépassé. Le serveur a mis trop de temps à répondre. Réessayez.'
        );
        timeoutError.isTimeout = true;
        timeoutError.originalError = error;
        return Promise.reject(timeoutError);
      }

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
      // ⭐ Guard offline renforcé — `navigator.onLine` peut être en retard sur
      //    l'événement `offline` (fenêtre de race ~100-500ms), donc on
      //    vérifie AUSSI si on a une réponse typique d'un service worker
      //    (réponse 401 avec corps vide/via cache) ou si l'erreur provient
      //    du SW. Dans tous les cas : ne JAMAIS rediriger ni clearer la
      //    session si on est offline.
      const isLikelyOffline =
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        // Heuristique : si l'erreur ne contient pas de données de réponse réelles
        // (cas typique d'un SW NetworkFirst qui échoue)
        (error.response.data === null || error.response.data === undefined) ||
        // Ou si l'erreur a un message réseau typique
        (error.message && (error.message.includes('Network Error') || error.message.includes('timeout')));

      if (isLikelyOffline) {
        console.warn('[API Client] 401 reçu en contexte probablement offline — pas de redirect, utilisation du cache');
        const offlineError: any = new Error('Session indisponible hors ligne. Les données en cache sont disponibles.');
        offlineError.isOffline = true;
        offlineError.isAuthExpired = true;
        return Promise.reject(offlineError);
      }

      // ⭐ Détermine la route de login selon le contexte (admin vs tenant).
      // Sur admin.academiahelm.com, on redirige vers /admin-login au lieu
      // de /login (qui est réservé aux tenants écoles). Cela évite la boucle
      // admin-login → platform → 401 tenant → /login → middleware → /admin-login
      // qui donnait l'impression d'une déconnexion immédiate.
      const getLoginRedirectUrl = (): string => {
        if (typeof window === 'undefined') return '/login?reason=session_expired';
        const host = window.location.hostname;
        // Sous-domaine admin → login admin
        if (host.startsWith('admin.') || host === 'admin.academiahelm.com') {
          return '/admin-login?reason=session_expired';
        }
        // Sous-domaine saisiemaster → landing SaisieMaster
        if (host.startsWith('saisiemaster.')) {
          return '/?reason=session_expired';
        }
        // Sinon → login tenant classique
        return '/login?reason=session_expired';
      };

      // ⭐ Sur admin.academiahelm.com, les 401 sur endpoints tenant (settings,
      // orion, etc.) sont NORMAUX — l'admin n'a pas de tenant. On ne doit
      // PAS le déconnecter pour autant. On rejette simplement la requête
      // sans rediriger.
      const isAdminContext =
        typeof window !== 'undefined' &&
        (window.location.hostname.startsWith('admin.') ||
          window.location.pathname.startsWith('/platform'));

      if (isAdminContext) {
        // L'admin a sa propre session (cookie academia_admin_session).
        // Un 401 sur un endpoint tenant signifie juste que cet endpoint
        // n'est pas accessible aux admins — c'est attendu. On rejette
        // sans clearClientSessionSync ni redirect.
        console.warn('[API Client] 401 ignoré en contexte admin (endpoint tenant non applicable)');
        return Promise.reject(error);
      }

      // Si c'est déjà une requête retry, ne pas boucler → rediriger vers login
      if (originalRequest._retry) {
        if (typeof window !== 'undefined') {
          clearClientSessionSync();
          window.location.href = getLoginRedirectUrl();
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
        // ⭐ Re-vérifier offline APRÈS le refresh — si on est passé offline
        //    pendant le refresh attempt, ne pas rediriger.
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          console.warn('[API Client] Passé offline pendant refresh — pas de redirect');
          const offlineError: any = new Error('Session indisponible hors ligne.');
          offlineError.isOffline = true;
          offlineError.isAuthExpired = true;
          return Promise.reject(offlineError);
        }
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
          clearClientSessionSync();
          window.location.href = getLoginRedirectUrl();
        }
        return Promise.reject(error);
      } catch (refreshError) {
        // ⭐ Même garde offline ici
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          console.warn('[API Client] Refresh échoué (offline) — pas de redirect');
          const offlineError: any = new Error('Session indisponible hors ligne.');
          offlineError.isOffline = true;
          offlineError.isAuthExpired = true;
          return Promise.reject(offlineError);
        }
        processQueue(refreshError, null);
        if (typeof window !== 'undefined') {
          clearClientSessionSync();
          window.location.href = getLoginRedirectUrl();
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // ⭐ P3.1 — Pour les erreurs 4xx/5xx (non 401), extraire le message backend
    //    au lieu de renvoyer le générique "Request failed with status code 400".
    //    Le backend NestJS renvoie { message: string | string[], error, statusCode }
    //    dans error.response.data — on l'extrait dans error.message pour que les
    //    toasts affichent le vrai message (ex: "property X should not exist").
    const backendData = error.response?.data;
    if (backendData) {
      const backendMsg = (backendData as any).message || (backendData as any).error;
      if (backendMsg) {
        // Si message est un tableau (class-validator), le joindre avec ", "
        const msgStr = Array.isArray(backendMsg)
          ? backendMsg.join(', ')
          : String(backendMsg);
        // Créer une nouvelle erreur avec le message backend
        const enrichedError: any = new Error(msgStr);
        enrichedError.originalError = error;
        enrichedError.status = error.response?.status;
        enrichedError.response = error.response;
        return Promise.reject(enrichedError);
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
 *
 * ⭐ Support d'un timeout personnalisé via options.timeout (en ms).
 * Par défaut : 8000ms (8s). Pour les opérations longues (génération de cartes
 * scolaires en lot, import Excel, génération PDF groupé), passer un timeout
 * plus élevé, ex : { timeout: 300000 } pour 5 minutes.
 */
export async function apiFetch<T>(url: string, options: any = {}): Promise<T> {
  const method = options.method || 'GET';
  // ⭐ Extraire timeout des options pour ne pas le passer à axios en double
  // (axios accepte `timeout` au niveau de la config de la requête)
  const { timeout, ...rest } = options;
  const axiosConfig: any = {
    url,
    method,
    data: rest.body ? (typeof rest.body === 'string' ? JSON.parse(rest.body) : rest.body) : undefined,
    ...rest,
  };
  if (timeout) {
    axiosConfig.timeout = timeout;
  }
  const response = await apiClient(axiosConfig);
  return response.data;
}

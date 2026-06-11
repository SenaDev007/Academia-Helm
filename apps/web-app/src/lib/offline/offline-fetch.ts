/**
 * ============================================================================
 * OFFLINE-AWARE FETCH - REQUÊTES API AVEC FALLBACK INDEXEDDB
 * ============================================================================
 *
 * Wrapper autour de fetch() qui :
 * 1. En ligne : exécute la requête API normalement et met en cache le résultat
 *    dans IndexedDB pour une utilisation hors ligne future
 * 2. Hors ligne : retourne les données depuis IndexedDB si disponibles
 * 3. Hors ligne sans données locales : retourne une réponse vide (pas de crash)
 *
 * UTILISATION :
 *   import { offlineFetch } from '@/lib/offline/offline-fetch';
 *   const data = await offlineFetch('/api/students', 'students', { tenantId: 'xxx' });
 *
 * PRINCIPE : L'application ne doit JAMAIS crasher ou se bloquer
 * quand la connexion est indisponible.
 * ============================================================================
 */

import { localDb } from './local-db.service';
import { networkDetectionService } from './network-detection.service';
import { getClientAuthorizationHeader, getClientTenantId } from '@/lib/auth/client-access-token';

export interface OfflineFetchOptions {
  /** ID du tenant pour filtrer les données locales */
  tenantId?: string;
  /** Options fetch standard */
  fetchOptions?: RequestInit;
  /** Durée de vie du cache local en ms (défaut : 5 min) */
  cacheTTL?: number;
  /** Si true, ne pas utiliser le cache local (toujours fetch réseau) */
  networkOnly?: boolean;
  /** Si true, ne pas écrire dans IndexedDB après un fetch réussi */
  skipCache?: boolean;
}

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  expiresAt: number;
}

const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Wrapper offline-aware pour les requêtes GET API.
 *
 * Comportement :
 * - EN LIGNE : fetch réseau → succès → cache dans IndexedDB → retourne données
 * - EN LIGNE : fetch réseau → échec → fallback IndexedDB → retourne données locales
 * - HORS LIGNE : lit directement depuis IndexedDB → retourne données (ou [])
 *
 * @param url URL de l'API (ex: '/api/students')
 * @param storeName Nom du store IndexedDB pour le fallback (ex: 'students')
 * @param options Options supplémentaires
 */
export async function offlineFetch<T = any>(
  url: string,
  storeName: string,
  options: OfflineFetchOptions = {}
): Promise<T> {
  const {
    tenantId,
    fetchOptions = {},
    cacheTTL = DEFAULT_CACHE_TTL,
    networkOnly = false,
    skipCache = false,
  } = options;

  const isOnline = networkDetectionService.isConnected();

  // Mode networkOnly : toujours fetch, pas de fallback
  if (networkOnly && isOnline) {
    return await networkFetch<T>(url, fetchOptions);
  }

  // HORS LIGNE : lecture depuis IndexedDB
  if (!isOnline) {
    return await localFallback<T>(storeName, tenantId);
  }

  // EN LIGNE : essayer le réseau, fallback local si échec
  try {
    const data = await networkFetch<T>(url, fetchOptions);

    // Mettre en cache les données réussies dans IndexedDB
    if (!skipCache && data !== null && data !== undefined) {
      cacheResponse(url, storeName, data, tenantId, cacheTTL).catch(() => {
        // Erreur de cache non bloquante
      });
    }

    return data;
  } catch (networkError) {
    console.warn(`[OfflineFetch] Network failed for ${url}, falling back to local:`, (networkError as Error).message);

    // Fallback vers les données locales
    return await localFallback<T>(storeName, tenantId);
  }
}

/**
 * Requête réseau standard avec headers d'authentification
 */
async function networkFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  // Ajouter X-Tenant-ID explicite pour garantir la résolution du tenant côté backend
  const tenantId = getClientTenantId();
  const extraHeaders: Record<string, string> = {};
  if (tenantId) {
    extraHeaders['x-tenant-id'] = tenantId;
  }

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getClientAuthorizationHeader(),
      ...extraHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Lecture depuis IndexedDB avec filtrage par tenant
 */
async function localFallback<T>(storeName: string, tenantId?: string): Promise<T> {
  try {
    const allData = await localDb.query<T>(storeName);

    // Filtrer par tenant et exclure les éléments supprimés localement
    let filtered = allData.filter((item: any) => !item._deleted);
    if (tenantId) {
      filtered = filtered.filter((item: any) => item.tenantId === tenantId);
    }

    // Si les données sont un tableau, les retourner directement
    if (Array.isArray(filtered)) {
      return filtered as unknown as T;
    }

    return filtered as unknown as T;
  } catch (error) {
    console.warn(`[OfflineFetch] IndexedDB read failed for ${storeName}:`, (error as Error).message);
    // Retourner un tableau vide plutôt que de crasher
    return [] as unknown as T;
  }
}

/**
 * Cache une réponse API dans IndexedDB
 */
async function cacheResponse<T>(
  _url: string,
  storeName: string,
  data: T,
  tenantId?: string,
  _cacheTTL?: number
): Promise<void> {
  try {
    // Si la donnée est un tableau, on met chaque élément individuellement
    if (Array.isArray(data)) {
      if (data.length === 0) return;

      // Ajouter tenantId si absent et fourni
      const items = tenantId
        ? data.map((item: any) => ({
            ...item,
            tenantId: item.tenantId || tenantId,
            _cachedAt: new Date().toISOString(),
          }))
        : data.map((item: any) => ({
            ...item,
            _cachedAt: new Date().toISOString(),
          }));

      await localDb.executeBulk(storeName, 'put', items);
    } else if (data && typeof data === 'object') {
      // Donnée unique
      const item = {
        ...(data as any),
        tenantId: (data as any).tenantId || tenantId,
        _cachedAt: new Date().toISOString(),
      };
      await localDb.execute(storeName, 'put', item);
    }
  } catch (error) {
    // Erreur de cache non bloquante
    console.warn(`[OfflineFetch] Cache write failed for ${storeName}:`, (error as Error).message);
  }
}

/**
 * Variante pour les mutations (POST, PUT, PATCH, DELETE).
 *
 * En ligne : exécute la mutation sur le serveur.
 * Hors ligne : écrit localement dans IndexedDB + crée un événement outbox
 * pour synchronisation automatique à la reconnexion.
 *
 * @returns true si la mutation a été traitée (soit en ligne, soit hors ligne)
 */
export async function offlineMutation<T = any>(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: any,
  options: OfflineFetchOptions = {}
): Promise<{ data?: T; offline: boolean; error?: string }> {
  const isOnline = networkDetectionService.isConnected();

  if (isOnline) {
    try {
      const data = await networkFetch<T>(url, {
        method,
        body: body ? JSON.stringify(body) : undefined,
        ...options.fetchOptions,
      });
      return { data, offline: false };
    } catch (error) {
      // Si le réseau échoue, on tente le fallback offline
      console.warn(`[OfflineMutation] Network failed for ${method} ${url}, trying offline fallback`);
      const result = await offlineMutationFallback<T>(url, method, body, options);
      return result;
    }
  }

  // Hors ligne : écrire localement + créer événement outbox
  return await offlineMutationFallback<T>(url, method, body, options);
}

/**
 * Fallback offline pour les mutations : écrit dans IndexedDB + outbox
 */
async function offlineMutationFallback<T = any>(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: any,
  options: OfflineFetchOptions = {}
): Promise<{ data?: T; offline: boolean; error?: string }> {
  try {
    const { createEntityOffline, updateEntityOffline, deleteEntityOffline } = await import('./offline-business.service');
    const tenantId = options.tenantId || getTenantIdFromCookie();

    if (!tenantId) {
      return {
        offline: true,
        error: 'Impossible de sauvegarder hors ligne : identifiant tenant manquant.',
      };
    }

    // Déterminer le type d'entité et le store depuis l'URL
    const entityType = inferEntityTypeFromUrl(url);
    const entityId = body?.id || inferIdFromUrl(url) || generateLocalId();

    let result: any;

    if (method === 'POST') {
      result = await createEntityOffline(tenantId, entityType, { ...body, id: entityId });
    } else if (method === 'PUT' || method === 'PATCH') {
      result = await updateEntityOffline(tenantId, entityType, entityId, body);
    } else if (method === 'DELETE') {
      await deleteEntityOffline(tenantId, entityType, entityId);
      result = { id: entityId, deleted: true };
    }

    return { data: result as T, offline: true };
  } catch (fallbackError) {
    console.error('[OfflineMutation] Fallback failed:', fallbackError);
    return {
      offline: true,
      error: 'Vous êtes hors ligne. Cette action sera synchronisée automatiquement à la reconnexion.',
    };
  }
}

/**
 * Infère le type d'entité SyncEntityType depuis l'URL
 */
function inferEntityTypeFromUrl(url: string): import('@/types').SyncEntityType {
  const mapping: Record<string, import('@/types').SyncEntityType> = {
    'students': 'STUDENT',
    'teachers': 'TEACHER',
    'classes': 'CLASS',
    'subjects': 'SUBJECT',
    'exams': 'EXAM',
    'grades': 'GRADE',
    'attendance': 'ATTENDANCE',
    'absences': 'ABSENCE',
    'payments': 'PAYMENT',
    'invoices': 'INVOICE',
    'finance/fee-structures': 'FEE_STRUCTURE',
    'finance/expenses': 'EXPENSE',
    'finance/settings': 'FINANCE_SETTING',
    'discipline': 'DISCIPLINARY_INCIDENT',
    'incidents': 'INCIDENT',
    'homeworks': 'HOMEWORK',
    'loans': 'LOAN',
    'sessions': 'SESSION',
    'messages': 'MESSAGE',
    'notifications': 'NOTIFICATION',
    'alerts': 'ALERT',
    'class-diaries': 'CLASS_DIARY',
    'lesson-plans': 'LESSON_PLAN',
    'pedagogy/teacher/documents': 'LESSON_JOURNAL',
    'pedagogy/academic-series': 'ACADEMIC_SERIES',
    'pedagogy/teacher-profiles': 'TEACHER_PROFILE',
    'pedagogy/pedagogical-materials': 'PEDAGOGICAL_MATERIAL',
    'pedagogy/assignments': 'TEACHER_CLASS_ASSIGNMENT',
    'daily-logs': 'HOMEWORK_ENTRY',
    'exam-candidates': 'EXAM_CANDIDATE',
    'exam-results': 'EXAM_RESULT',
  };

  // Parcourir les clés de la plus longue à la plus courte pour correspondance la plus spécifique
  const sortedKeys = Object.keys(mapping).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (url.toLowerCase().includes(key.toLowerCase())) {
      return mapping[key];
    }
  }

  // Fallback : extraire le premier segment après /api/ et le convertir
  const segments = url.replace(/^\/api\//, '').split('/');
  const firstSegment = segments[0]?.replace(/-/g, '_').toUpperCase();
  return (firstSegment || 'STUDENT') as import('@/types').SyncEntityType;
}

/**
 * Extrait l'ID depuis l'URL (dernier segment UUID-like)
 */
function inferIdFromUrl(url: string): string | null {
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const match = url.match(uuidRegex);
  return match ? match[0] : null;
}

/**
 * Génère un ID local temporaire
 */
function generateLocalId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Récupère le tenantId depuis les cookies
 */
function getTenantIdFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:(?:^|.*;\s*)x-tenant-id\s*\=\s*([^;]*).*$)|^.*$/);
  return match ? decodeURIComponent(match[1]) : null;
}

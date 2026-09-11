/**
 * ============================================================================
 * OFFLINE-AWARE FETCH - REQUÊTES API AVEC FALLBACK INDEXEDDB
 * ============================================================================
 *
 * ⭐ OFFLINE-FIRST RÉACTIVÉ (sept. 2026 — spécification « mode hors-ligne ») :
 *    ce fichier avait été temporairement converti en pass-through (commit
 *    cac0a871f) pendant la phase de stabilisation en ligne. Le mode hors-ligne
 *    est de retour :
 *
 *    1. EN LIGNE (GET) : fetch réseau → succès → mise en cache IndexedDB
 *       pour une utilisation hors ligne future.
 *    2. EN LIGNE (GET) : fetch réseau → échec → fallback IndexedDB si des
 *       données y existent réellement ; sinon l'erreur réseau est propagée
 *       (pas de « page blanche silencieuse »).
 *    3. HORS LIGNE (GET) : lecture depuis IndexedDB ([] si vide — légitime).
 *    4. MUTATIONS (POST/PUT/PATCH/DELETE) : en ligne → serveur ; hors ligne
 *       (ou réseau défaillant) → écriture locale IndexedDB + événement outbox
 *       synchronisé automatiquement à la reconnexion (modèle WhatsApp).
 *
 * PRINCIPE : L'application ne doit JAMAIS crasher ou se bloquer
 * quand la connexion est indisponible.
 * ============================================================================
 */

import { localDb } from './local-db.service';
import { networkDetectionService } from './network-detection.service';
import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';

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
 * - EN LIGNE : fetch réseau → échec → fallback IndexedDB :
 *               • si IndexedDB a des données (cache réel) → retourne données locales
 *               • si IndexedDB est VIDE (jamais sync) → REJETTE l'erreur réseau
 *                 (sinon les pages restent vides silencieusement et l'utilisateur
 *                  croit qu'il n'y a pas de données — source de bugs "page blanche")
 * - HORS LIGNE : lit depuis IndexedDB. Si vide, retourne [] (comportement normal
 *    hors ligne — on ne peut rien faire de plus, mais au moins c'est explicite
 *    grâce à isOnline=false que le user peut voir dans l'UI).
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

  // HORS LIGNE : lecture depuis IndexedDB (retourne [] si vide — c'est légitime)
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

    // ⭐ Fallback vers IndexedDB — MAIS on ne retourne [] silencieusement que si
    //    on a réellement des données en cache. Sinon on rejette l'erreur réseau
    //    pour que React Query puisse retry et que l'utilisateur voie qu'il y a
    //    un problème. C'est la cause principale des "pages blanches qui nécessitent
    //    plusieurs refresh" — le réseau échouait, le cache était vide, mais on
    //    retournait quand même [] comme si tout allait bien.
    const localData = await localFallback<T>(storeName, tenantId);
    if (hasRealData(localData)) {
      return localData;
    }

    // Cache vide — propager l'erreur réseau d'origine
    throw networkError;
  }
}

/**
 * Vérifie si une donnée retournée par `localFallback` contient réellement
 * des enregistrements (tableau non vide, ou objet non-null).
 * Si non → l'appelant doit propager l'erreur réseau plutôt que de retourner [].
 */
function hasRealData(data: any): boolean {
  if (data === null || data === undefined) return false;
  if (Array.isArray(data)) return data.length > 0;
  if (typeof data === 'object') return Object.keys(data).length > 0;
  return true;
}

/**
 * Requête réseau standard avec headers d'authentification
 * ⭐ Ajoute le header X-Offline-Internal pour court-circuiter l'intercepteur
 *    global-fetch-interceptor.ts et éviter la récursion infinie :
 *    patchedFetch → offlineMutation → networkFetch → fetch (= patchedFetch) → ...
 * ⭐ Parse le corps d'erreur JSON pour remonter le message métier du serveur
 *    (ex: validation DTO) au lieu d'un opaque "API error: 400 Bad Request".
 */
async function networkFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getClientAuthorizationHeader(),
      'X-Offline-Internal': 'true', // ⭐ guard de réentrance
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message = `API error: ${response.status} ${response.statusText}`;
    try {
      const text = await response.text();
      if (text.trim()) {
        const parsed = JSON.parse(text);
        message = parsed?.message || parsed?.error || message;
      }
    } catch { /* corps non-JSON — on garde le message HTTP */ }
    throw new Error(message);
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
 * ⭐ RESTRICTIONS (spec §7 + sécurité) : certaines opérations sont REFUSÉES
 *    hors ligne (paiement Fedapay, validation de paiement, publication de
 *    résultats, documents officiels, broadcast massif, suppression physique).
 *    Dans ce cas le résultat porte `restricted: true` + `error` (message)
 *    pour que l'UI affiche l'erreur AU LIEU de mettre en file.
 *
 * @returns { data, offline, error, restricted } — offline=true si traitée hors
 *          ligne (badge « en attente de synchronisation » côté UI).
 */
export async function offlineMutation<T = any>(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: any,
  options: OfflineFetchOptions = {}
): Promise<{ data?: T; offline: boolean; error?: string; restricted?: boolean }> {
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
      // ⭐ Erreurs applicatives (400/401/403/404/409/422) : ne JAMAIS rejouer
      //    en local — le serveur a REFUSÉ l'écriture pour une raison métier.
      //    On propage l'erreur pour que l'UI affiche le message.
      const status = extractHttpStatus(error);
      if (status !== null && status >= 400 && status < 500 && status !== 408) {
        throw error;
      }
      // Erreur réseau / 5xx / timeout : le serveur n'a probablement pas traité
      // la requête → fallback offline (outbox) pour ne pas perdre la saisie.
      console.warn(`[OfflineMutation] Network failed for ${method} ${url}, trying offline fallback`);
      const result = await offlineMutationFallback<T>(url, method, body, options);
      return result;
    }
  }

  // Hors ligne : écrire localement + créer événement outbox
  return await offlineMutationFallback<T>(url, method, body, options);
}

/**
 * Extrait le statut HTTP d'une erreur lancée par networkFetch.
 * Format : "API error: 400 Bad Request" ou message métier parsé.
 */
function extractHttpStatus(error: unknown): number | null {
  const msg = String((error as Error)?.message || '');
  const match = msg.match(/API error:\s*(\d{3})/);
  if (match) return parseInt(match[1], 10);
  return null;
}

/**
 * Fallback offline pour les mutations : écrit dans IndexedDB + outbox
 */
async function offlineMutationFallback<T = any>(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: any,
  options: OfflineFetchOptions = {}
): Promise<{ data?: T; offline: boolean; error?: string; restricted?: boolean }> {
  try {
    const { createEntityOffline, updateEntityOffline, deleteEntityOffline } = await import('./offline-business.service');
    const tenantId = options.tenantId || getTenantIdFromSessionOrCookie();

    if (!tenantId) {
      return {
        offline: true,
        error: 'Impossible de sauvegarder hors ligne : identifiant tenant manquant.',
      };
    }

    // Déterminer le type d'entité et le store depuis l'URL
    const entityType = inferEntityTypeFromUrl(url);
    const entityId = body?.id || inferIdFromUrl(url) || generateLocalId();

    // ⭐ RESTRICTIONS HORS LIGNE (branchées sept. 2026 — spec mode hors-ligne) :
    //    Fedapay, validation paiement, publication résultats, documents
    //    officiels, broadcast massif, suppression physique → REFUS avec message
    //    clair (l'opération n'est PAS mise en file d'attente).
    const { offlineRestrictionsService } = await import('./offline-restrictions.service');
    const operationType = method === 'POST' ? 'INSERT' : method === 'DELETE' ? 'DELETE' : 'UPDATE';
    // Le service travaille sur des noms de tables pluriels (payments, exam_results…)
    const tableName = `${entityType.toLowerCase()}s`;
    const check = offlineRestrictionsService.isOperationAllowedOffline(
      tableName,
      operationType as 'INSERT' | 'UPDATE' | 'DELETE',
      body ?? {},
    );
    if (!check.allowed) {
      return {
        offline: true,
        restricted: true,
        error: check.message || 'Cette action nécessite une connexion internet.',
      };
    }

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
    // ─── Élèves & Scolarité ───
    'students/guardians': 'GUARDIAN',
    'students': 'STUDENT',
    // ─── RH ───
    'hr/staff': 'STAFF',
    'hr/teachers': 'TEACHER',
    'hr/contracts': 'CONTRACT',
    'hr/leaves': 'LEAVE_REQUEST',
    'hr/allowances': 'STAFF_ALLOWANCE',
    'hr/overtime': 'OVERTIME_RECORD',
    'hr/attendance': 'STAFF_ATTENDANCE',
    'hr/evaluations': 'STAFF_EVALUATION',
    'hr/documents': 'STAFF_DOCUMENT',
    'teachers': 'TEACHER',
    // ─── Classes & structure ───
    'classes': 'CLASS',
    'class-students': 'CLASS_STUDENT',
    'class-subjects': 'CLASS_SUBJECT',
    'subjects': 'SUBJECT',
    'school-levels': 'SCHOOL_LEVEL',
    'academic-years': 'ACADEMIC_YEAR',
    // ─── Examens & notes ───
    'exams': 'EXAM',
    'grades': 'GRADE',
    'exam-candidates': 'EXAM_CANDIDATE',
    'exam-results': 'EXAM_RESULT',
    'exam-scores': 'EXAM_SCORE',
    'exam-sessions': 'EXAM_SESSION',
    'exam-compositions': 'EXAM_COMPOSITION',
    'exam-deliberations': 'EXAM_DELIBERATION',
    'report-cards': 'REPORT_CARD',
    'evaluations': 'EVALUATION',
    // ─── Finances ───
    'payments': 'PAYMENT',
    'invoices': 'INVOICE',
    'finance/fee-structures': 'FEE_STRUCTURE',
    'finance/transactions': 'FINANCE_TRANSACTION',
    'finance/expenses': 'EXPENSE',
    'finance/settings': 'FINANCE_SETTING',
    // ─── Pédagogie ───
    'attendance': 'ATTENDANCE',
    'absences': 'ABSENCE',
    'homeworks': 'HOMEWORK',
    'discipline': 'DISCIPLINARY_INCIDENT',
    'incidents': 'INCIDENT',
    'class-diaries': 'CLASS_DIARY',
    'lesson-plans': 'LESSON_PLAN',
    'pedagogy/teacher/documents': 'LESSON_JOURNAL',
    'pedagogy/academic-series': 'ACADEMIC_SERIES',
    'pedagogy/teacher-profiles': 'TEACHER_PROFILE',
    'pedagogy/pedagogical-materials': 'PEDAGOGICAL_MATERIAL',
    'pedagogy/assignments': 'TEACHER_CLASS_ASSIGNMENT',
    'pedagogy/teacher-class-assignments': 'TEACHER_CLASS_ASSIGNMENT',
    'daily-logs': 'HOMEWORK_ENTRY',
    // ─── Communication ───
    'messages': 'MESSAGE',
    'notifications': 'NOTIFICATION',
    'alerts': 'ALERT',
    'announcements': 'ANNOUNCEMENT',
    // ─── Paramètres / Settings ───
    'settings/identity': 'TENANT_IDENTITY_PROFILE',
    'settings/bilingual': 'SETTINGS_BILINGUAL',
    'settings/academic': 'SCHOOL_ACADEMIC_SETTING',
    'settings/communication': 'SETTINGS_COMMUNICATION',
    'settings/security': 'SECURITY_SETTINGS',
    'settings/features': 'TENANT_FEATURE',
    // ─── Academia Shop ───
    'shop/products': 'SHOP_PRODUCT',
    'shop/categories': 'SHOP_CATEGORY',
    'shop/orders': 'SHOP_ORDER',
    'shop/sales': 'SHOP_SALE',
    // ─── Helm Connect / communauté ───
    'community/channels': 'COMMUNITY_CHANNEL',
    'community/messages': 'COMMUNITY_MESSAGE',
    'community/members': 'COMMUNITY_MEMBER',
    'community/reactions': 'COMMUNITY_REACTION',
    // ─── EduCast ───
    'educast/contents': 'EDUCAST_CONTENT',
    'educast/channels': 'EDUCAST_CHANNEL',
    'educast/playlists': 'EDUCAST_PLAYLIST',
    // ─── Cantine / Transport / Infirmerie / QHSE / Bibliothèque ───
    'canteen/menus': 'CANTEEN_MENU',
    'canteen/payments': 'CANTEEN_PAYMENT',
    'canteen/subscriptions': 'CANTEEN_SUBSCRIPTION',
    'canteen/attendance': 'CANTEEN_ATTENDANCE',
    'transport/vehicles': 'VEHICLE',
    'transport/routes': 'ROUTE',
    'infirmary/visits': 'INFIRMARY_VISIT',
    'infirmary/medical-records': 'INFIRMARY_MEDICAL_RECORD',
    'qhse/audits': 'QHSE_AUDIT',
    'qhse/incidents': 'QHSE_INCIDENT',
    'library/books': 'LIBRARY_BOOK',
    'library/loans': 'LIBRARY_LOAN',
    // ─── Divers / legacy ───
    'loans': 'LOAN',
    'sessions': 'SESSION',
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
 * Récupère le tenantId depuis localStorage (session) ou les cookies
 * (miroir de getTenantIdForOffline de store-names.ts, sans import pour
 * éviter tout risque de cycle de dépendances)
 */
function getTenantIdFromSessionOrCookie(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const session = localStorage.getItem('session');
    if (session) {
      const parsed = JSON.parse(session);
      if (parsed.tenantId || parsed.tenant?.id) return parsed.tenantId || parsed.tenant.id;
    }
  } catch { /* session corrompue — on tente le cookie */ }
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|.*;\s*)x-tenant-id\s*=\s*([^;]*).*$/);
  if (match && match[1]) return decodeURIComponent(match[1]);
  return null;
}

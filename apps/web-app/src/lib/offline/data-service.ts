/**
 * ============================================================================
 * DATA SERVICE — COUCHE D'ACCÈS AUX DONNÉES UNIFIÉE (API publique)
 * ============================================================================
 *
 * Spec « Correctif — Lecture hors ligne non fonctionnelle par module » §1 :
 * « Aucun composant, page ou module ne doit appeler l'API directement.
 *   Toute lecture de données doit passer par une couche intermédiaire
 *   unique, avec une fonction par entité. »
 *
 * Cette couche existe et est UNIQUE. Deux points d'entrée :
 *
 *   1. dataService.get(url) / dataService.mutate(method, url, body) — API
 *      explicite pour les nouveaux développements (une fonction par besoin).
 *
 *   2. L'intercepteur global (global-fetch-interceptor.ts) — RÉTRO-COMPATIBLE :
 *      il route DÉJÀ tout fetch GET/POST/PUT/PATCH/DELETE /api/* de l'app
 *      (110+ fichiers, sans modification) vers ce même dataService. Aucun
 *      composant ne peut appeler l'API sans passer par la couche.
 *
 * Comportement (implémenté dans offline-fetch.ts, moteur de cette couche) :
 *   - EN LIGNE : appel API avec timeout court (5 s) → succès → mise à jour
 *     du cache local (response_cache IndexedDB) → retour des données.
 *   - HORS LIGNE / TIMEOUT / ÉCHEC RÉSEAU / 5xx : lecture directe du cache
 *     local (URL exacte → même chemin params proches → stores entités),
 *     JAMAIS d'erreur bloquante pour l'utilisateur.
 *   - ÉCRITURES : en ligne → serveur ; hors ligne → écriture locale + file
 *     de mutations (outbox) synchronisée automatiquement à la reconnexion,
 *     avec restrictions métier (paiements, publications… refusées offline).
 * ============================================================================
 */

import { offlineFetch, offlineMutation, OfflineFetchOptions } from './offline-fetch';
import { deriveStoreName, getTenantIdForOffline } from './store-names';

/** Options de lecture du dataService. */
export interface DataServiceGetOptions extends OfflineFetchOptions {
  /**
   * Store d'entités à utiliser en dernier recours local (dérivé de l'URL
   * automatiquement si omis — mapping centralisé store-names.ts).
   */
  storeName?: string;
}

const dataService = {
  /**
   * Lecture de données (GET). Le seul point d'entrée de lecture de l'app.
   * @param url URL API (relative '/api/…' ou absolue)
   */
  async get<T = any>(url: string, options: DataServiceGetOptions = {}): Promise<T> {
    const storeName = options.storeName ?? deriveStoreName(url) ?? 'api_cache';
    const tenantId = options.tenantId ?? getTenantIdForOffline();
    return offlineFetch<T>(url, storeName, { ...options, tenantId });
  },

  /**
   * Création / modification / suppression.
   * En ligne → serveur. Hors ligne → file de synchronisation (outbox) +
   * écriture locale optimiste ; le résultat porte `offline: true` pour le
   * badge « en attente de synchronisation ».
   */
  async mutate<T = any>(
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    body?: any,
    options: OfflineFetchOptions = {},
  ): Promise<{ data?: T; offline: boolean; error?: string; restricted?: boolean }> {
    const tenantId = options.tenantId ?? getTenantIdForOffline();
    return offlineMutation<T>(url, method, body, { ...options, tenantId });
  },

  // ─── Helpers nommés par entité (spec §1 « une fonction par entité ») ────
  // Le mapping URL→store reste centralisé dans store-names.ts ; ces helpers
  // couvrent les lectures les plus fréquentes des modules.

  /** Élèves & scolarité (module élèves). */
  getEleves: (tenantId?: string) =>
    dataService.get<any>('/api/students', { tenantId }),

  /** Paiements (module finances). */
  getPaiements: (params?: Record<string, string>, tenantId?: string) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return dataService.get<any>(`/api/finance/payments${qs}`, { tenantId });
  },

  /** Notes (module examens/notes — par évaluation). */
  getNotes: (evaluationId: string, tenantId?: string) =>
    dataService.get<any>(`/api/grades?evaluationId=${encodeURIComponent(evaluationId)}`, { tenantId }),

  /** Effectifs/KPI du tableau de pilotage. */
  getDashboardKpis: (tenantId?: string) =>
    dataService.get<any>('/api/dashboard/overview', { tenantId }),
};

export { dataService };
export default dataService;

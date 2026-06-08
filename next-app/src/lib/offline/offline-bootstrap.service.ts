/**
 * Offline Bootstrap Service
 *
 * Service responsable de l'initialisation de l'environnement offline
 * lors de la première connexion (ou lors d'un rafraîchissement complet).
 *
 * AMÉLIORATIONS :
 * - Bootstrap automatique après login si pas encore fait
 * - Pré-remplissage des données métier critiques dans IndexedDB
 * - Sync périodique des données essentielles quand en ligne
 */

import { localDb } from './local-db.service';
import { syncEngine } from './sync-engine.service';
import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';
import { OfflineSecurityService } from './offline-security.service';

const BOOTSTRAP_API = '/api/sync/bootstrap';

export interface BootstrapData {
  user: any;
  tenant: any;
  school?: any;
  patronat?: any;
  roles: any[];
  permissions: string[];
  academicYear: any;
  academicTerms: any[];
  modules: any[];
  config: any;
}

class OfflineBootstrapService {
  private bootstrapPromise: Promise<boolean> | null = null;

  /**
   * Vérifie si l'application est prête pour le mode offline
   */
  async isOfflineReady(): Promise<boolean> {
    try {
      const states = await localDb.query<any>('sync_state');
      return states.length > 0 && states[0].lastSyncSuccess === true;
    } catch {
      // Si IndexedDB n'est pas encore initialisé, vérifier localStorage
      return localStorage.getItem('offline_ready') === 'true';
    }
  }

  /**
   * Effectue le bootstrap initial (nécessite Internet)
   * Inclut maintenant la synchronisation des données métier critiques
   */
  async bootstrap(tenantId: string): Promise<boolean> {
    // Éviter les bootsrap simultanés
    if (this.bootstrapPromise) {
      return this.bootstrapPromise;
    }

    this.bootstrapPromise = this.performBootstrap(tenantId);
    try {
      return await this.bootstrapPromise;
    } finally {
      this.bootstrapPromise = null;
    }
  }

  private async performBootstrap(tenantId: string): Promise<boolean> {
    if (!syncEngine.isOnline()) {
      console.warn('[Bootstrap] Offline — skipping bootstrap (will retry when online)');
      return false;
    }

    try {
      console.log('[Bootstrap] Starting initial offline initialization...');

      // Demander la persistance du stockage pour éviter que le navigateur n'évince IndexedDB
      await this.requestPersistentStorage();

      const res = await fetch(BOOTSTRAP_API, {
        headers: {
          'Content-Type': 'application/json',
          ...getClientAuthorizationHeader(),
        },
      });

      if (!res.ok) throw new Error(`Bootstrap failed: ${res.status}`);

      const data: BootstrapData = await res.json();

      // 1. Sauvegarder dans les stores individuels
      await localDb.execute('user_profile_cache', 'put', { id: data.user.id, ...data.user });
      if (data.roles) await localDb.executeBulk('roles_cache', 'put', data.roles);
      if (data.permissions) {
        await localDb.execute('permissions_cache', 'put', {
          id: data.user.id,
          list: data.permissions,
          signature: OfflineSecurityService.signPermissions(data.permissions, data.user.id),
        });
      }
      if (data.tenant) await localDb.execute('local_tenant_context', 'put', { id: data.tenant.id, ...data.tenant });
      if (data.academicYear) await localDb.execute('local_academic_year', 'put', { id: data.academicYear.id, ...data.academicYear });
      if (data.academicTerms) await localDb.executeBulk('local_academic_term', 'put', data.academicTerms);

      // 2. Mettre à jour l'état global de sync
      await localDb.execute('sync_state', 'put', {
        tenantId,
        lastSyncTimestamp: new Date().toISOString(),
        lastSyncSuccess: true,
        updatedAt: new Date().toISOString(),
      });

      // 3. Sauvegarder les modules et configurations
      if (data.modules) {
        await localDb.executeBulk('modules', 'put', data.modules);
      }

      // 4. Sauvegarder les termes académiques
      if (data.academicTerms) {
        await localDb.executeBulk('academic_terms', 'put', data.academicTerms);
      }

      // 5. Marquer le device comme offline-ready
      localStorage.setItem('offline_ready', 'true');
      localStorage.setItem('last_bootstrap_at', new Date().toISOString());

      // 6. Pré-remplir les données métier critiques (async, ne pas bloquer)
      this.prefetchCriticalData(tenantId).catch((err) => {
        console.warn('[Bootstrap] Critical data prefetch failed (non-blocking):', err);
      });

      console.log('[Bootstrap] Offline initialization complete.');
      return true;
    } catch (error) {
      console.error('[Bootstrap] Error during bootstrap:', error);
      return false;
    }
  }

  /**
   * Pré-remplit les données métier critiques dans IndexedDB
   * pour que l'app fonctionne hors ligne dès le premier login.
   * Appelé de manière asynchrone après le bootstrap de base.
   */
  private async prefetchCriticalData(tenantId: string): Promise<void> {
    if (!syncEngine.isOnline()) return;

    const criticalEndpoints = [
      { url: `/api/students?limit=500`, store: 'students' },
      { url: `/api/teachers?limit=200`, store: 'teachers' },
      { url: `/api/classes?limit=200`, store: 'classes' },
      { url: `/api/subjects?limit=200`, store: 'subjects' },
      { url: `/api/finance/fee-structures?limit=100`, store: 'fee_structures' },
      { url: `/api/exams?limit=200`, store: 'exams' },
      { url: `/api/attendance?limit=500`, store: 'attendance' },
    ];

    // Exécuter les requêtes en parallèle avec un timeout
    const results = await Promise.allSettled(
      criticalEndpoints.map(async ({ url, store }) => {
        try {
          const res = await fetch(url, {
            headers: {
              'Content-Type': 'application/json',
              ...getClientAuthorizationHeader(),
            },
            credentials: 'include',
            signal: AbortSignal.timeout(15000), // 15s timeout
          });

          if (!res.ok) return;

          const data = await res.json();

          // Les réponses API peuvent être { data: [...] } ou directement [...]
          const items = Array.isArray(data) ? data : (data.data || data.items || data.results || []);

          if (items.length > 0) {
            // Ajouter tenantId et metadata de cache
            const enriched = items.map((item: any) => ({
              ...item,
              tenantId: item.tenantId || tenantId,
              _cachedAt: new Date().toISOString(),
              _isDirty: false,
              _deleted: false,
            }));

            await localDb.executeBulk(store, 'put', enriched);
            console.log(`[Bootstrap] Cached ${enriched.length} items in ${store}`);
          }
        } catch (err) {
          console.warn(`[Bootstrap] Failed to prefetch ${url}:`, (err as Error).message);
        }
      })
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    console.log(`[Bootstrap] Prefetch complete: ${succeeded}/${criticalEndpoints.length} endpoints cached`);
  }

  /**
   * Guard pour vérifier si l'accès est autorisé hors ligne
   * AMÉLIORÉ : ne bloque plus si l'utilisateur a une session existante
   */
  async checkOfflineAccess(): Promise<{ allowed: boolean; message?: string }> {
    const isReady = await this.isOfflineReady();
    const isOnline = syncEngine.isOnline();

    if (!isReady && !isOnline) {
      // Vérifier si l'utilisateur a déjà une session sur cet appareil
      // Si oui, autoriser l'accès en mode dégradé
      const hasSession = this.hasExistingSession();
      if (hasSession) {
        return { allowed: true };
      }

      return {
        allowed: false,
        message: "Première ouverture détectée. Une connexion Internet est nécessaire pour initialiser l'application.",
      };
    }

    return { allowed: true };
  }

  /**
   * Vérifie si l'utilisateur a déjà une session locale
   */
  private hasExistingSession(): boolean {
    if (typeof window === 'undefined') return false;

    const hasSessionCookie = document.cookie
      .split('; ')
      .some((row) => row.startsWith('academia_session='));

    const hasLocalStorageSession = Boolean(
      localStorage.getItem('session')?.trim() ||
      localStorage.getItem('accessToken')?.trim()
    );

    const isOfflineReady = localStorage.getItem('offline_ready') === 'true';
    const lastBootstrap = localStorage.getItem('last_bootstrap_at');

    return hasSessionCookie || hasLocalStorageSession || isOfflineReady || Boolean(lastBootstrap);
  }

  /**
   * Déclenche le bootstrap automatiquement si nécessaire
   * Appelé après le login ou quand la connexion revient
   */
  async ensureBootstrapped(tenantId: string): Promise<void> {
    const isReady = await this.isOfflineReady();
    if (!isReady && syncEngine.isOnline()) {
      console.log('[Bootstrap] Not yet bootstrapped — starting auto-bootstrap...');
      await this.bootstrap(tenantId);
    }
  }

  /**
   * Demande la persistance du stockage navigateur pour éviter
   * que le navigateur n'évince IndexedDB sous pression mémoire.
   * Appelé lors du bootstrap initial.
   */
  private async requestPersistentStorage(): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      try {
        const granted = await navigator.storage.persist();
        if (granted) {
          console.log('[Bootstrap] Storage persistence granted — IndexedDB is safe from eviction');
        } else {
          console.warn('[Bootstrap] Storage persistence NOT granted — browser may evict IndexedDB under storage pressure');
        }
      } catch (err) {
        console.warn('[Bootstrap] Failed to request storage persistence:', err);
      }
    }
  }

  /**
   * Efface le cache local (Section 20.2)
   * Appelé lors d'une déconnexion explicite ou d'une violation de sécurité.
   */
  async clearCache(): Promise<void> {
    const technicalStores = [
      'user_profile_cache',
      'roles_cache',
      'permissions_cache',
      'local_tenant_context',
      'local_academic_year',
      'local_academic_term',
      'sync_state',
    ];

    for (const store of technicalStores) {
      await localDb.clearStore(store);
    }

    localStorage.removeItem('offline_ready');
    localStorage.removeItem('last_bootstrap_at');
    console.log('[Security] Local offline cache cleared.');
  }
}

export const offlineBootstrapService = new OfflineBootstrapService();

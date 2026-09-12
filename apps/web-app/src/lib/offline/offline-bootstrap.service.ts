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
import { invalidateActiveYearCache } from './offline-fetch';

const BOOTSTRAP_API = '/api/sync/bootstrap';

/** ⭐ v3.5.0 — Flag versionné du prefetch critique (v2 = stores corrigés).
 *    Les appareils déjà bootstrappés avec l'ANCIEN code (stores au pluriel
 *    → prefetch silencieusement vide) doivent re-exécuter le prefetch UNE
 *    fois — d'où le suffixe de version dans la clé. */
const CRITICAL_DATA_FLAG_PREFIX = 'academia_helm_critical_data_';
const CRITICAL_DATA_VERSION = 'v2';

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

      // ⭐ TENANT-STRICT (sept. 2026) : si un AUTRE tenant a déjà bootstrappé
      //    cet appareil, on purge TOUTES ses données locales avant de remplir
      //    le cache du nouveau tenant. Sans cela, un appareil partagé entre
      //    deux écoles gardait les données de l'ancienne école servables en
      //    offline pour la nouvelle (fuite cross-tenant).
      await this.purgeIfTenantChanged(tenantId);

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
   *
   * ⭐ v3.5.0 — CORRECTIF CRITIQUE (retour terrain « fausses données » hors
   *    ligne) : les noms de stores étaient AU PLURIEL ('students', 'teachers',
   *    'classes'…) alors que les stores IDB réels sont au SINGULIER Prisma
   *    ('student', 'teacher', 'class'…) → this.db.transaction(['students'])
   *    levait NotFoundError → attrapé silencieusement → le prefetch
   *    « réussissait » dans les logs alors que RIEN n'était écrit dans IDB.
   *    Hors ligne, les modules qui tombent en fallback IndexedDB servaient
   *    donc des données VIDES (KPI à zéro).
   *    + liste étendue (paiements, personnel, salles, emplois du temps,
   *    référentiels) pour couvrir les dashboards de tous les modules.
   */
  private async prefetchCriticalData(tenantId: string): Promise<void> {
    if (!syncEngine.isOnline()) return;

    // ⚠️ Les stores correspondent EXACTEMENT aux noms déclarés dans
    //    local-db.service.ts (singulier, sans séparateur) — cf. store-names.ts.
    const criticalEndpoints: Array<{ url: string; store: string }> = [
      { url: '/api/students?limit=500', store: 'student' },
      { url: '/api/teachers?limit=200', store: 'teacher' },
      { url: '/api/classes?limit=200', store: 'class' },
      { url: '/api/subjects?limit=200', store: 'subject' },
      { url: '/api/school-levels?limit=100', store: 'schoollevel' },
      { url: '/api/finance/fee-structures?limit=100', store: 'feestructure' },
      { url: '/api/exams?limit=200', store: 'exam' },
      { url: '/api/attendance?limit=500', store: 'attendancerecord' },
      { url: '/api/finance/payments?limit=500', store: 'payment' },
      { url: '/api/hr/staff?limit=200', store: 'staff' },
      { url: '/api/rooms?limit=200', store: 'room' },
      { url: '/api/timetables?limit=200', store: 'timetable' },
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
   * ⭐ v3.5.0 — Pré-fetch des données critiques POUR LES APPAREILS DÉJÀ
   *    BOOTSTRAPPÉS : le flag de bootstrap principal est déjà posé sur les
   *    devices existants → prefetchCriticalData (interne au bootstrap) ne
   *    s'exécutera plus jamais. Or l'ANCIEN prefetch écrivait dans des stores
   *    INEXISTANTS (pluriel) → IDB vide → « fausses données » offline.
   *    Ce guard versionné (v2) re-exécute le prefetch corrigé UNE fois, puis
   *    pose son propre flag. À appeler au montage (layout-client), après le
   *    check de cohérence tenant.
   */
  async ensureCriticalDataPrefetched(tenantId: string): Promise<void> {
    try {
      const flagKey = `${CRITICAL_DATA_FLAG_PREFIX}${CRITICAL_DATA_VERSION}_${tenantId}`;
      if (localStorage.getItem(flagKey) === 'true') return;
    } catch {
      /* localStorage indisponible — on tente quand même */
    }
    if (!syncEngine.isOnline()) return; // re-tentative au prochain montage online

    console.log('[Bootstrap] Critical data prefetch v2 (corrected stores) — running...');
    await this.prefetchCriticalData(tenantId);

    try {
      localStorage.setItem(
        `${CRITICAL_DATA_FLAG_PREFIX}${CRITICAL_DATA_VERSION}_${tenantId}`,
        'true',
      );
    } catch {
      /* non-bloquant — re-tentative au prochain montage */
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
   * ⭐ TENANT-STRICT (sept. 2026) : appelé au MONTAGE de l'app (avant même le
   *    check du flag de bootstrap). Si le cache local appartient à une AUTRE
   *    école que celle connectée → purge totale + invalidation des flags de
   *    bootstrap (le tenant courant repartira sur un bootstrap complet).
   *    Léger : une seule lecture IDB (`local_tenant_context`) en cas nominal.
   */
  async ensureTenantCacheCoherence(tenantId: string): Promise<void> {
    try {
      const contexts = await localDb.query<{ id?: string }>('local_tenant_context');
      const lastTenantId = contexts[0]?.id;
      if (!lastTenantId) return; // Aucun cache → rien à faire
      if (String(lastTenantId) === String(tenantId)) return; // Cache cohérent

      console.warn(
        `[Bootstrap] Cache local d'une autre école détecté (${String(lastTenantId).substring(0, 8)}… ≠ ${tenantId.substring(0, 8)}…) — purge + re-bootstrap`
      );
      await localDb.clearAllStores();
      invalidateActiveYearCache();
      try {
        localStorage.removeItem(`academia_helm_bootstrapped_${lastTenantId}`);
        localStorage.removeItem(`academia_helm_bootstrapped_${tenantId}`);
      } catch { /* non-bloquant */ }
      localStorage.removeItem('offline_ready');
    } catch (error) {
      console.warn('[Bootstrap] ensureTenantCacheCoherence failed (non-blocking):', (error as Error).message);
    }
  }

  /**
   * ⭐ TENANT-STRICT (sept. 2026) : purge les données locales si le tenant qui
   *    bootstrap DIFFÈRE du dernier tenant bootstrappé sur cet appareil.
   *    Comparaison via le store `local_tenant_context` (écrit à chaque
   *    bootstrap réussi). Retourne true si une purge a eu lieu.
   */
  private async purgeIfTenantChanged(tenantId: string): Promise<boolean> {
    try {
      const contexts = await localDb.query<{ id?: string }>('local_tenant_context');
      const lastTenantId = contexts[0]?.id;
      if (!lastTenantId || String(lastTenantId) === String(tenantId)) {
        return false;
      }
      console.warn(
        `[Bootstrap] Changement de tenant détecté (${String(lastTenantId).substring(0, 8)}… → ${tenantId.substring(0, 8)}…) — purge complète du cache local de l'ancienne école`
      );
      // Purge TOTALE : stores métier + techniques (outbox/sync_state de l'ancien
      // tenant inclus — le serveur filtrerait de toute façon par JWT, mais on
      // ne garde rien de l'ancienne école sur l'appareil)
      await localDb.clearAllStores();
      invalidateActiveYearCache();
      // Le flag localStorage du bootstrap de l'ANCIEN tenant est sans objet :
      // le nouveau tenant repartira d'un bootstrap complet.
      try {
        localStorage.removeItem(`academia_helm_bootstrapped_${lastTenantId}`);
      } catch { /* non-bloquant */ }
      return true;
    } catch (error) {
      console.warn('[Bootstrap] purgeIfTenantChanged failed (non-blocking):', (error as Error).message);
      return false;
    }
  }

  /**
   * Efface le cache local (Section 20.2)
   * Appelé lors d'une déconnexion explicite ou d'une violation de sécurité.
   * ⭐ TENANT-STRICT (sept. 2026) : purge désormais TOTALE (stores métier +
   *    techniques) — les données de l'école ne restent pas sur l'appareil
   *    après une déconnexion. Les flags localStorage « bootstrapped » sont
   *    AUSSI retirés (sinon un re-login du même tenant ne re-bootstraperait
   *    pas et l'app resterait offline-vide).
   */
  async clearCache(): Promise<void> {
    await localDb.clearAllStores();
      invalidateActiveYearCache();

    localStorage.removeItem('offline_ready');
    localStorage.removeItem('last_bootstrap_at');
    // ⭐ Retirer TOUS les flags de bootstrap (tous tenants confondus —
    //    le cache IDB étant vidé, aucun ne doit rester 'true')
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith('academia_helm_bootstrapped_') ||
          key.startsWith(CRITICAL_DATA_FLAG_PREFIX) // ⭐ v3.5.0 — prefetch critique versionné
        )) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch { /* non-bloquant */ }
    console.log('[Security] Local offline cache cleared.');
  }
}

export const offlineBootstrapService = new OfflineBootstrapService();

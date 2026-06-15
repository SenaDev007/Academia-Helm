/**
 * Offline Bootstrap Service
 * 
 * Service responsable de l'initialisation de l'environnement offline
 * lors de la première connexion (ou lors d'un rafraîchissement complet).
 * 
 * RÈGLE : Section 5 du Cahier Technique (Première connexion obligatoire)
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
  /**
   * Vérifie si l'application est prête pour le mode offline
   */
  async isOfflineReady(): Promise<boolean> {
    const states = await localDb.query<any>('sync_state');
    return states.length > 0 && states[0].lastSyncSuccess === true;
  }

  /**
   * Effectue le bootstrap initial (nécessite Internet)
   */
  async bootstrap(tenantId: string): Promise<boolean> {
    if (!syncEngine.isOnline()) {
      throw new Error('Internet connection required for initial bootstrap');
    }

    try {
      console.log('[Bootstrap] Starting initial offline initialization...');
      
      const res = await fetch(BOOTSTRAP_API, {
        headers: {
          'Content-Type': 'application/json',
          ...getClientAuthorizationHeader(),
        },
      });

      if (!res.ok) throw new Error(`Bootstrap failed: ${res.status}`);
      
      const data: BootstrapData = await res.json();

      // 1. Sauvegarder dans les stores individuels (Section 9)
      await localDb.execute('user_profile_cache', 'put', { id: data.user.id, ...data.user });
      if (data.roles) await localDb.executeBulk('roles_cache', 'put', data.roles);
      if (data.permissions) {
        await localDb.execute('permissions_cache', 'put', { 
          id: data.user.id, 
          list: data.permissions,
          signature: OfflineSecurityService.signPermissions(data.permissions, data.user.id)
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

      // 2. Sauvegarder les modules et configurations
      if (data.modules) {
        await localDb.executeBulk('modules', 'put', data.modules);
      }

      // 3. Sauvegarder les termes académiques
      if (data.academicTerms) {
        await localDb.executeBulk('academic_terms', 'put', data.academicTerms);
      }

      // 4. Marquer le device comme offline-ready
      localStorage.setItem('offline_ready', 'true');
      localStorage.setItem('last_bootstrap_at', new Date().toISOString());

      console.log('[Bootstrap] Offline initialization complete.');
      return true;
    } catch (error) {
      console.error('[Bootstrap] Error during bootstrap:', error);
      return false;
    }
  }

  /**
   * Guard pour vérifier si l'accès est autorisé hors ligne
   */
  async checkOfflineAccess(): Promise<{ allowed: boolean; message?: string }> {
    const isReady = await this.isOfflineReady();
    const isOnline = syncEngine.isOnline();

    if (!isReady && !isOnline) {
      return {
        allowed: false,
        message: 'Première ouverture détectée. Une connexion Internet est nécessaire pour initialiser l’application.',
      };
    }

    return { allowed: true };
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
      'sync_state'
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

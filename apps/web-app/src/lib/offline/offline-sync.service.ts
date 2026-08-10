/**
 * Offline Sync Service
 * 
 * Service principal de synchronisation offline-first
 * 
 * PRINCIPE : Synchronisation automatique des événements de l'outbox
 * vers le serveur lorsque la connexion est disponible
 */

import { networkDetectionService } from './network-detection.service';
import { runSync } from './sync-engine.service';
import { setSyncModalState } from '@/components/offline/SyncModal';

class OfflineSyncService {
  private isSyncing: boolean = false;
  private syncInterval: any = null;
  private syncInterval30s: any = null;
  private syncInProgress: Promise<void> | null = null;
  private hasBootstrapped: boolean = false;

  constructor() {
    // Écouter les changements de connexion
    networkDetectionService.onConnectionChange(async (online) => {
      if (online && (await this.getTenantId())) {
        // ⭐ Au retour de connexion : PUSH automatique (envoyer les données locales)
        //    + PULL (récupérer les changements distants)
        await this.sync();
      }
    });

    // Synchronisation automatique périodique
    this.startAutoSync();
  }

  /**
   * ⭐ Bootstrap initial : téléchargement complet au premier login
   *    Appelé par layout-client.tsx après le login réussi.
   *    Fait un PULL complet (last_sync_at = epoch) pour récupérer TOUTES
   *    les données du tenant dans IndexedDB.
   */
  async bootstrap(tenantId: string): Promise<void> {
    if (this.hasBootstrapped) {
      console.log('[Sync] Already bootstrapped, skipping');
      return;
    }

    console.log('[Sync] Bootstrap: pulling ALL data for tenant', tenantId);
    setSyncModalState({
      isVisible: true,
      phase: 'pull',
      message: 'Téléchargement initial des données de l\'école...',
      pushed: 0,
      pulled: 0,
    });

    try {
      const deviceId = this.getDeviceId();
      const result = await runSync(tenantId, deviceId);

      // Marquer comme bootstrap terminé
      this.hasBootstrapped = true;
      try { localStorage.setItem('academia_helm_bootstrapped', 'true'); } catch {}

      const totalPulled = Object.values(result.pulled || {}).reduce((a: number, b: any) => a + (b as number), 0) as number;

      setSyncModalState({
        isVisible: true,
        phase: 'done',
        message: `${totalPulled} enregistrement(s) récupéré(s)`,
        pushed: result.pushed,
        pulled: totalPulled,
      });

      // Fermer le modal après 3s
      setTimeout(() => setSyncModalState({ isVisible: false }), 3000);

      console.log(`[Sync] Bootstrap complete: ${totalPulled} entities pulled`);
    } catch (error: any) {
      console.error('[Sync] Bootstrap failed:', error);
      setSyncModalState({
        isVisible: true,
        phase: 'error',
        message: `Erreur lors du téléchargement initial: ${error.message}`,
      });
      setTimeout(() => setSyncModalState({ isVisible: false }), 5000);
    }
  }

  /**
   * Lance la synchronisation
   */
  async sync(): Promise<void> {
    if (this.isSyncing) {
      console.log('[Sync] Already syncing, skipping...');
      return;
    }

    if (!networkDetectionService.isConnected()) {
      console.log('[Sync] Offline, skipping sync...');
      return;
    }

    // Si une sync est déjà en cours, attendre
    if (this.syncInProgress) {
      await this.syncInProgress;
      return;
    }

    this.syncInProgress = this.performSync();
    await this.syncInProgress;
    this.syncInProgress = null;
  }

  /**
   * Effectue la synchronisation (POST /sync/push puis /sync/pull)
   */
  private async performSync(): Promise<void> {
    this.isSyncing = true;
    try {
      const tenantId = await this.getTenantId();
      if (!tenantId) return;
      const deviceId = this.getDeviceId();

      // ⭐ Afficher le modal seulement s'il y a des pending events
      const { outboxService } = await import('./outbox.service');
      const pendingCount = await outboxService.getPendingCount();
      if (pendingCount > 0) {
        setSyncModalState({
          isVisible: true,
          phase: 'push',
          message: 'Envoi de vos modifications...',
          pushed: 0,
          pulled: 0,
        });
      }

      const result = await runSync(tenantId, deviceId);
      const total = result.pushed + result.conflicts + result.errors;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('sync-end', {
            detail: {
              success: result.success,
              total,
              successful: result.pushed,
              conflicted: result.conflicts,
              failed: result.errors,
            },
          })
        );
      }

      // ⭐ Fermer le modal si on l'a ouvert
      if (pendingCount > 0) {
        const totalPulled = Object.values(result.pulled || {}).reduce((a: number, b: any) => a + (b as number), 0) as number;
        setSyncModalState({
          isVisible: true,
          phase: 'done',
          message: `${result.pushed} envoi(s) • ${totalPulled} mise(s) à jour`,
          pushed: result.pushed,
          pulled: totalPulled,
        });
        setTimeout(() => setSyncModalState({ isVisible: false }), 2000);
      }

      console.log(
        `[Sync] Done: ${result.pushed} synced, ${result.conflicts} conflicts, ${result.errors} errors`
      );
    } catch (error: any) {
      console.error('[Sync] Sync error:', error);
      setSyncModalState({
        isVisible: true,
        phase: 'error',
        message: error?.message || 'Erreur de synchronisation',
      });
      setTimeout(() => setSyncModalState({ isVisible: false }), 3000);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('sync-end', { detail: { success: false, error: error?.message } })
        );
      }
    } finally {
      this.isSyncing = false;
    }
  }

  private getDeviceId(): string | undefined {
    if (typeof window === 'undefined') return undefined;
    return localStorage.getItem('device_id') ?? undefined;
  }

  /**
   * Démarre la synchronisation automatique (spec : ping 30s quand en ligne)
   */
  private startAutoSync(): void {
    if (typeof window === 'undefined') return;
    const interval30s = 30 * 1000;
    this.syncInterval30s = window.setInterval(async () => {
      if (networkDetectionService.isConnected() && !this.isSyncing) {
        const tenantId = await this.getTenantId();
        if (!tenantId) return;
        const { outboxService } = await import('./outbox.service');
        const pending = await outboxService.getPendingEvents(tenantId, 1);
        if (pending.length > 0) await this.sync();
      }
    }, interval30s);
    this.syncInterval = window.setInterval(async () => {
      if (!networkDetectionService.isConnected() || this.isSyncing) return;
      if (!(await this.getTenantId())) return;
      await this.sync();
    }, 5 * 60 * 1000);
  }

  /**
   * Récupère le tenantId
   */
  private async getTenantId(): Promise<string | null> {
    if (typeof window === 'undefined') return null;

    const rawTenantCookie = document.cookie
      .split('; ')
      .find((row) => row.startsWith('x-tenant-id='))
      ?.split('=')[1];
    if (rawTenantCookie) {
      try {
        return decodeURIComponent(rawTenantCookie);
      } catch {
        return rawTenantCookie;
      }
    }

    const session = localStorage.getItem('session');
    if (session) {
      try {
        const parsed = JSON.parse(session) as {
          tenantId?: string;
          tenant?: { id?: string };
        };
        return parsed.tenantId || parsed.tenant?.id || null;
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Nettoie les ressources
   */
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    if (this.syncInterval30s) {
      clearInterval(this.syncInterval30s);
      this.syncInterval30s = null;
    }
  }
}

// Instance singleton
export const offlineSyncService = new OfflineSyncService();


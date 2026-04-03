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

class OfflineSyncService {
  private isSyncing: boolean = false;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private syncInterval30s: ReturnType<typeof setInterval> | null = null;
  private syncInProgress: Promise<void> | null = null;

  constructor() {
    // Écouter les changements de connexion
    networkDetectionService.onConnectionChange(async (online) => {
      if (online && (await this.getTenantId())) {
        await this.sync();
      }
    });

    // Synchronisation automatique périodique
    this.startAutoSync();
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
      // Pas de tenant : pages publiques ou session sans établissement — comportement attendu, pas de log.
      if (!tenantId) return;
      const deviceId = this.getDeviceId();
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
      console.log(
        `[Sync] Done: ${result.pushed} synced, ${result.conflicts} conflicts, ${result.errors} errors`
      );
    } catch (error: any) {
      console.error('[Sync] Sync error:', error);
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


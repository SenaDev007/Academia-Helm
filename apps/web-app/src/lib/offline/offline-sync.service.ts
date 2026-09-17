/**
 * Offline Sync Service
 * 
 * Service principal de synchronisation offline-first
 * 
 * PRINCIPE : Synchronisation automatique des événements de l'outbox
 * vers le serveur lorsque la connexion est disponible
 *
 * ⭐ SIMPLIFICATION (sept. 2026) — UX « vraiment simpliste » :
 *    - Le déclenchement au RETOUR DU RÉSEAU est centralisé dans
 *      auto-sync-trigger.ts (push immédiat + pull delta espacé ≥ 5 min).
 *      Ce service n'écoute PLUS l'événement 'online' — avant, les DEUX
 *      services lançaient chacun leur sync en parallèle à chaque
 *      reconnexion (double push + double pull + modal plein écran).
 *    - Le pull n'est plus effectué à moins de 5 min du précédent (MIN_PULL_INTERVAL_MS).
 *    - L'UI de sync de routine est une PASTILLE discrète (isMinimized),
 *      JAMAIS un modal plein écran bloquant. Le modal plein écran est
 *      réservé au bootstrap initial (première connexion sur l'appareil).
 */

import { networkDetectionService } from './network-detection.service';
import { runSync } from './sync-engine.service';
import { setSyncModalState } from '@/lib/offline/sync-modal-state';

/** ⭐ Délai minimum entre deux PULLS automatiques (5 minutes).
 *    Le PUSH (envoi des modifications locales) n'est jamais throttlé —
 *    c'est lui qui est urgent au retour de la connexion. */
const MIN_PULL_INTERVAL_MS = 5 * 60 * 1000;

class OfflineSyncService {
  private isSyncing: boolean = false;
  private syncInterval: any = null;
  private syncInterval30s: any = null;
  private syncInProgress: Promise<void> | null = null;
  private hasBootstrapped: boolean = false;
  /** Horodatage du dernier pull réussi (throttle des pulls automatiques) */
  private lastPullAt: number = 0;

  constructor() {
    // ⭐ SIMPLIFICATION : plus d'écoute 'online' ici (doublon avec
    //    auto-sync-trigger.ts). Seuls les intervalles périodiques restent :
    //    - 30 s : PUSH express s'il reste des événements en attente
    //    - 5 min : PUSH + PULL delta (si ≥ 5 min depuis le dernier pull)
    this.startAutoSync();
  }

  /**
   * ⭐ Compatibilité : sync-worker.ts appelle start() au démarrage web.
   *    Le service tourne déjà via son constructor (intervalles) — no-op.
   *    (Avant : TypeError silencieux « offlineSyncService.start is not a function ».)
   */
  start(): void {
    console.log('[Sync] offlineSyncService actif (push 30s · pull delta ≥ 5 min)');
  }

  /**
   * ⭐ Bootstrap initial : premier téléchargement sur cet appareil
   *    Appelé par layout-client.tsx après le login réussi.
   *    PULL complet si IndexedDB est vide (première connexion : last_sync_at
   *    = epoch → TOUTES les données), ou PULL delta si des données existent
   *    déjà (appareil déjà bootstrapé mais flag perdu / IDB partiel).
   *
   *    Retourne true uniquement si le bootstrap a réussi — layout-client
   *    ne pose le flag « déjà bootstrappé » qu'après succès (retry si échec).
   *
   * ⭐ Task 73 (2026-09-17) — `background: true` : le téléchargement initial se
   *    fait SANS l'overlay plein écran bloquant (la progression reste visible via
   *    la petite carte minimisée en bas à droite + la pill « Préparation hors
   *    ligne »). C'est le mode par défaut pour le bootstrap automatique au login :
   *    les secrétaires/comptables/directeurs voyaient un « rideau de chargement »
   *    (« Téléchargement initial des données de l'école… ») en concurrence avec
   *    les requêtes critiques de l'UI (sélecteur de niveau, dashboards) — on veut
   *    le pattern du promoteur : l'app répond D'ABORD, le hors-ligne se prépare
   *    DISCRÈTEMENT ensuite.
   */
  async bootstrap(tenantId: string, options?: { background?: boolean }): Promise<boolean> {
    if (this.hasBootstrapped) {
      console.log('[Sync] Already bootstrapped, skipping');
      return true;
    }

    const background = options?.background === true;

    console.log('[Sync] Bootstrap: pulling ALL data for tenant', tenantId, background ? '(background — non bloquant)' : '');
    setSyncModalState({
      isVisible: true,
      // ⭐ Mode background → minimisé d'office : petite carte discrète au lieu
      //    de l'overlay plein écran avec fond flouté.
      isMinimized: background,
      phase: 'pull',
      message: 'Téléchargement initial des données de l\'école…',
      pushed: 0,
      pulled: 0,
      total: 0,
      current: 0,
      operations: [],
    });

    try {
      const deviceId = this.getDeviceId();
      // ⭐ onProgress : met à jour la barre de progression en temps réel
      //    pendant que le pull télécharge chaque table.
      let lastTotal = 0;
      const result = await runSync(tenantId, deviceId, (current, total, currentTable, pulledSoFar) => {
        lastTotal = total;
        setSyncModalState({
          current,
          total,
          pulled: pulledSoFar,
          message:
            total > 0
              ? `Téléchargement : ${current} / ${total} — ${currentTable} (${pulledSoFar} enregistrements)`
              : `Téléchargement : ${currentTable}…`,
        });
      });

      // Marquer comme bootstrap terminé (même si partiel)
      this.hasBootstrapped = true;
      try { localStorage.setItem('academia_helm_bootstrapped', 'true'); } catch {}

      const totalPulled = Object.values(result.pulled || {}).reduce((a: number, b: any) => a + (b as number), 0) as number;

      if (totalPulled > 0 || result.pushed > 0) {
        setSyncModalState({
          isVisible: true,
          phase: 'done',
          message: `${totalPulled} enregistrement(s) récupéré(s)`,
          pushed: result.pushed,
          pulled: totalPulled,
          total: totalPulled,
          current: totalPulled,
        });
        setTimeout(() => setSyncModalState({ isVisible: false }), 3000);
      } else {
        // ⭐ Cas « 0 enregistrement récupéré » — ne pas fermer silencieusement.
        //    2 scénarios :
        //    (a) Le serveur a renvoyé entities: {} (déjà synchronisé récemment)
        //    (b) Le serveur n'a pas pu récupérer les données (erreur silencieuse)
        //    Dans les 2 cas, on affiche un message clair pendant 2s pour que
        //    l'utilisateur comprenne que la sync s'est terminée mais n'a rien
        //    récupéré. Avant, le modal disparaissait instantanément ce qui
        //    donnait l'impression que ça avait planté.
        const tableCount = lastTotal || 0;
        setSyncModalState({
          isVisible: true,
          phase: 'done',
          message: tableCount > 0
            ? `Données déjà à jour — ${tableCount} tables vérifiées, 0 nouvel enregistrement`
            : 'Données déjà à jour',
          pushed: 0,
          pulled: 0,
          total: tableCount,
          current: tableCount,
        });
        setTimeout(() => setSyncModalState({ isVisible: false }), 2500);
      }

      console.log(`[Sync] Bootstrap complete: ${totalPulled} entities pulled`);
      this.lastPullAt = Date.now(); // le bootstrap vient de faire un pull complet
      return true;
    } catch (error: any) {
      // ⭐ Ne pas bloquer l'app si le bootstrap échoue — marquer quand même comme fait
      this.hasBootstrapped = true;
      try { localStorage.setItem('academia_helm_bootstrapped', 'true'); } catch {}
      console.error('[Sync] Bootstrap failed:', error);
      // ⭐ Ne PAS fermer le modal avant d'afficher l'erreur — sinon on a un
      //    flicker "modal disparaît puis réapparaît en erreur".
      setSyncModalState({
        isVisible: true,
        phase: 'error',
        message: `Erreur lors du téléchargement initial: ${error.message}`,
      });
      setTimeout(() => setSyncModalState({ isVisible: false }), 5000);
      return false;
    }
  }

  /**
   * Lance la synchronisation
   *
   * @param options.pull — false : PUSH uniquement (sync express, aucune lecture
   *        serveur). DÉFAUT : push + pull SI le dernier pull date de plus de
   *        MIN_PULL_INTERVAL_MS (5 min). Le PUSH, lui, n'est jamais throttlé.
   */
  async sync(options?: { pull?: boolean }): Promise<void> {
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

    this.syncInProgress = this.performSync(options);
    await this.syncInProgress;
    this.syncInProgress = null;
  }

  /**
   * Effectue la synchronisation (push puis — éventuellement — pull delta)
   *
   * ⭐ SIMPLIFICATION UX : la sync de routine s'affiche en PASTILLE discrète
   *    (bas-droite, non bloquante) et seulement s'il y a des modifications
   *    locales à envoyer. Le modal plein écran est réservé au bootstrap
   *    initial (première connexion sur l'appareil).
   */
  private async performSync(options?: { pull?: boolean }): Promise<void> {
    this.isSyncing = true;
    try {
      const tenantId = await this.getTenantId();
      if (!tenantId) return;
      const deviceId = this.getDeviceId();

      // ⭐ Afficher la PASTILLE seulement s'il y a des pending events
      //    FIX Task 74 : compter uniquement les événements du TENANT connecté
      //    (avant : comptage tous tenants → pastille affichée pour 1 événement
      //    d'une autre école pendant que le push de CE tenant en trouvait 0
      //    → « 0 sur 1 terminé » sans synchronisation réelle).
      const { outboxService } = await import('./outbox.service');
      const pendingCount = await outboxService.getPendingCount(tenantId);
      if (pendingCount > 0) {
        setSyncModalState({
          isVisible: true,
          isMinimized: true, // ⭐ PASTILLE non-bloquante (avant : modal plein écran)
          phase: 'push',
          message: `Envoi de ${pendingCount} modification(s)...`,
          pushed: 0,
          pulled: 0,
          current: 0,
          total: pendingCount,
        });
      }

      // ⭐ THROTTLE DU PULL : pas de pull si le dernier date de < 5 min,
      //    sauf demande explicite (options.pull === true) ou sync express (false).
      const shouldPull =
        options?.pull === true ||
        (options?.pull !== false && Date.now() - this.lastPullAt > MIN_PULL_INTERVAL_MS);
      if (shouldPull) {
        this.lastPullAt = Date.now();
      }

      const result = await runSync(
        tenantId,
        deviceId,
        (current, total, currentTable, pulledSoFar) => {
          // Progression : mise à jour de l'état du modal (invisible si rien à envoyer)
          setSyncModalState({
            current,
            total,
            pulled: pulledSoFar,
            message:
              total > 0
                ? `Synchronisation : ${current} / ${total} — ${currentTable}`
                : `Synchronisation : ${currentTable}...`,
          });
        },
        { pull: shouldPull },
      );
      if (shouldPull && result.success) {
        this.lastPullAt = Date.now(); // pull effectivement réalisé
      }
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

      // ⭐ Fermer la pastille si on l'a ouverte
      if (pendingCount > 0) {
        const totalPulled = Object.values(result.pulled || {}).reduce((a: number, b: any) => a + (b as number), 0) as number;
        setSyncModalState({
          isVisible: true,
          isMinimized: true, // pastille
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
        isMinimized: true, // pastille d'erreur (non bloquante en sync de routine)
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
   * Démarre la synchronisation automatique :
   * - toutes les 30 s : PUSH EXPRESS s'il reste des événements en attente
   *   (push-only — plus de pull complet toutes les 30 s, l'ancien comportement
   *   surchargeait le serveur et maintenait la pastille affichée en continu)
   * - toutes les 5 min : PUSH + PULL delta (le pull est lui-même throttlé
   *   à MIN_PULL_INTERVAL_MS dans performSync)
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
        if (pending.length > 0) await this.sync({ pull: false }); // PUSH express
      }
    }, interval30s);
    this.syncInterval = window.setInterval(async () => {
      if (!networkDetectionService.isConnected() || this.isSyncing) return;
      if (!(await this.getTenantId())) return;
      await this.sync(); // push + pull (throttle 5 min interne)
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


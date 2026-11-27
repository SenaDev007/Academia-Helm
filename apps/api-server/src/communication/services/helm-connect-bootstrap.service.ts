/**
 * ============================================================================
 * HELM CONNECT BOOTSTRAP SERVICE — ⭐ 2026-11-27 : PURGE UNIQUEMENT
 * ============================================================================
 *
 * Retour promoteur (Helm Connect « à la WhatsApp / Telegram ») :
 *   « On va supprimer toutes ces créations automatiques de groupes et de
 *    canaux, et remettre à jour carrément pour que ça soit exactement
 *    fonctionnel comme WhatsApp ou Telegram, simplement. Le promoteur ou
 *    celui qui est délégué sera libre de créer lui-même le canal, le
 *    groupe. »
 *
 * Ce service ne CRÉE donc PLUS RIEN. Au démarrage de l'API (après un
 * délai), périodiquement (toutes les 6 heures) et à l'activation d'un
 * nouvel établissement (onboarding), il garantit pour chaque tenant :
 *   - la PURGE DÉFINITIVE des canaux auto-créés (createdBy='system' dans
 *     chat_channels — Direction, Vie scolaire, Finance, Transport…) ;
 *   - la PURGE DÉFINITIVE des communautés auto-créées (conversations
 *     createdBy='system' — classes, « Parents – {niveau} », « Enseignants »,
 *     « Administration », conseils de classe/pédagogique, pistes FR/EN…).
 *
 * Les DMs automatiques (parent↔enseignant, enseignant↔colègue) ne sont
 * plus générés : chacun démarre ses discussions manuellement, comme sur
 * WhatsApp.
 *
 * Tout est idempotent : une base déjà propre ne déclenche aucune écriture.
 * ============================================================================
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { AutoChannelService } from './auto-channel.service';
import { AutoGroupService } from './auto-group.service';

/** Délai avant la première purge (laisse l'API démarrer + Neon s'éveiller). */
const INITIAL_DELAY_MS = 90_000;
/** Période de re-purge (6 heures) — rattrape tout résidu, idempotent. */
const RESYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

@Injectable()
export class HelmConnectBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(HelmConnectBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly autoChannelService: AutoChannelService,
    private readonly autoGroupService: AutoGroupService,
  ) {}

  /** Première purge différée — ne bloque PAS le boot de l'API. */
  onModuleInit(): void {
    setTimeout(() => {
      this.syncAllTenants().catch(e =>
        this.logger.warn(`Première purge Helm Connect échouée: ${e.message}`),
      );
    }, INITIAL_DELAY_MS);
  }

  /** Re-purge périodique — idempotent, aucune écriture sur une base propre. */
  @Interval(RESYNC_INTERVAL_MS)
  periodicResync(): void {
    this.syncAllTenants().catch(e =>
      this.logger.warn(`Re-purge périodique Helm Connect échouée: ${e.message}`),
    );
  }

  /**
   * Purge COMPLETE d'un seul tenant (appelée aussi par l'onboarding et
   * POST /chat/auto-channels/sync). Retourne un résumé consolidé.
   */
  async syncTenant(tenantId: string): Promise<{
    tenantId: string;
    channels: { created: number; existing: number; subscribed: number; retired: number };
    groups: { created: number; updated: number; skipped: number; purged: number; total: number };
  }> {
    // 1. Purge définitive des canaux officiels auto-créés (Direction, Vie
    //    scolaire, Finance…) : l'école crée ses propres canaux.
    const channels = await this.autoChannelService.ensureDefaultChannels(tenantId);

    // 2. Purge définitive des communautés auto-créées (classes, rôles,
    //    niveaux, conseils, pistes FR/EN) : l'école crée ses propres groupes.
    const { purged } = await this.autoGroupService.retireSystemGroups(tenantId);

    return {
      tenantId,
      channels,
      groups: { created: 0, updated: 0, skipped: 0, purged, total: 0 },
    };
  }

  /**
   * Purge de tous les tenants actifs — isolation par tenant.
   */
  async syncAllTenants(): Promise<{ processed: number; failed: number }> {
    let failed = 0;
    let tenants: Array<{ id: string; name: string }> = [];
    try {
      tenants = await this.prisma.$queryRawUnsafe<Array<{ id: string; name: string }>>(
        `SELECT "id", "name" FROM "tenants" WHERE lower("status") = 'active' OR lower("subscriptionStatus") IN ('active', 'active_subscribed', 'trial')`,
      );
    } catch (e: any) {
      this.logger.warn(`syncAllTenants: impossible de lister les tenants: ${e.message}`);
      return { processed: 0, failed: 0 };
    }

    for (const tenant of tenants) {
      try {
        const result = await this.syncTenant(tenant.id);
        if (result.channels.retired > 0 || result.groups.purged > 0) {
          this.logger.log(
            `Helm Connect purge « ${tenant.name} »: ${result.channels.retired} canal(aux) système et ${result.groups.purged} communauté(s) auto-créée(s) retirés — l'école crée désormais elle-même ses groupes et canaux`,
          );
        }
      } catch (e: any) {
        failed++;
        this.logger.warn(`Helm Connect purge échouée pour « ${tenant.name} » (${tenant.id}): ${e.message}`);
      }
    }
    return { processed: tenants.length, failed };
  }
}

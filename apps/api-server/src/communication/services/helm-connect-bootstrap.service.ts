/**
 * ============================================================================
 * HELM CONNECT BOOTSTRAP SERVICE — Automatisation continue (V6, spec §4/§6)
 * ============================================================================
 *
 * « Les différents canaux et groupes doivent être créés de façon automatique
 *  et dynamique pour les écoles. »
 *
 * Ce service rend la création VRAIMENT automatique et dynamique :
 *
 *   1. Au démarrage de l'API (après un délai pour ne pas bloquer le boot) ;
 *   2. Périodiquement (toutes les 6 heures) ;
 *   3. À l'activation d'un nouvel établissement (onboarding — fire & forget) ;
 *
 * … il garantit, pour chaque tenant actif :
 *   - l'existence des 6 CANAUX OFFICIELS (Direction, Vie scolaire, Transport,
 *     Finance, Informations pédagogiques, Calendrier scolaire) ;
 *   - l'abonnement automatique de tous les utilisateurs actifs à ces canaux
 *     (les nouveaux comptes sont rattrapés à chaque cycle) ;
 *   - la création/synchronisation des COMMUNAUTÉS AUTOMATIQUES de l'année
 *     scolaire active : classes, matières, « Parents – {niveau} »,
 *     « Enseignants de {matière} », Enseignants, Parents, Administration,
 *     Conseil pédagogique — avec retrait/ajout dynamique des membres
 *     (un enseignant qui quitte une classe est retiré du groupe).
 *
 * Chaque tenant est traité de façon isolée : une erreur n'interrompt pas
 * les autres. Tout est idempotent.
 * ============================================================================
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { AutoChannelService } from './auto-channel.service';
import { AutoGroupService } from './auto-group.service';

/** Délai avant la première sync (laisse l'API démarrer + Neon s'éveiller). */
const INITIAL_DELAY_MS = 90_000;
/** Période de re-sync (6 heures). */
const RESYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

@Injectable()
export class HelmConnectBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(HelmConnectBootstrapService.name);
  private firstRunTriggered = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly autoChannelService: AutoChannelService,
    private readonly autoGroupService: AutoGroupService,
  ) {}

  /** Première sync différée — ne bloque PAS le boot de l'API. */
  onModuleInit(): void {
    setTimeout(() => {
      this.syncAllTenants().catch(e =>
        this.logger.warn(`Première sync Helm Connect échouée: ${e.message}`),
      );
    }, INITIAL_DELAY_MS);
  }

  /** Re-sync périodique — rattrape les nouveaux utilisateurs/groupes dynamiques. */
  @Interval(RESYNC_INTERVAL_MS)
  periodicResync(): void {
    this.syncAllTenants().catch(e =>
      this.logger.warn(`Re-sync périodique Helm Connect échouée: ${e.message}`),
    );
  }

  /**
   * Sync COMPLETE d'un seul tenant (appelé aussi par l'onboarding et
   * POST /chat/auto-channels/sync). Retourne un résumé consolidé.
   */
  async syncTenant(tenantId: string): Promise<{
    tenantId: string;
    channels: { created: number; existing: number; subscribed: number };
    groups: { created: number; updated: number; skipped: number; total: number } | { message: string };
  }> {
    // 1. Canaux officiels + abonnement automatique des utilisateurs actifs
    const channels = await this.autoChannelService.ensureDefaultChannels(tenantId);

    // 2. Communautés automatiques de l'année scolaire active (peut être
    //    absent → message explicite, aucune erreur)
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { startDate: 'desc' },
      select: { id: true, name: true },
    });
    let groups: any;
    if (!academicYear) {
      groups = { message: 'Aucune année scolaire active — les communautés seront créées dès l\u2019activation d\u2019une année.' };
    } else {
      groups = await this.autoGroupService.syncAutoGroups(tenantId, academicYear.id);
    }

    return { tenantId, channels, groups };
  }

  /**
   * Sync de tous les tenants actifs — isolation par tenant.
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

    this.logger.log(`syncAllTenants: ${tenants.length} tenant(s) actif(s) à synchroniser`);
    for (const tenant of tenants) {
      try {
        const result = await this.syncTenant(tenant.id);
        this.logger.log(
          `Helm Connect sync « ${tenant.name} »: canaux +${result.channels.created}/=${result.channels.existing} (abos +${result.channels.subscribed}), ` +
          (result.groups && (result.groups as any).total !== undefined
            ? `groupes +${(result.groups as any).created}/=${(result.groups as any).updated}`
            : (result.groups as any).message),
        );
      } catch (e: any) {
        failed++;
        this.logger.warn(`Helm Connect sync échouée pour « ${tenant.name} » (${tenant.id}): ${e.message}`);
      }
    }
    return { processed: tenants.length, failed };
  }
}

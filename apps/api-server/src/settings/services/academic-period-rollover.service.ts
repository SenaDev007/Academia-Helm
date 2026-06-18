/**
 * ============================================================================
 * ACADEMIC PERIOD ROLLOVER SERVICE — Automatisation du cycle trimestriel
 * ============================================================================
 *
 * Règles métier :
 * - 3 trimestres par année scolaire : T1, T2, T3
 * - Quand un trimestre actif est dépassé (now > period.endDate) → le clôturer
 *   et activer le suivant
 * - Le rollover est quotidien à 2h05 du matin (5 min après le rollover annuel
 *   pour éviter les race conditions)
 *
 * Ce service est idempotent : si la bascule a déjà été faite, il ne fait rien.
 *
 * Workflow :
 *  1. Pour chaque tenant actif :
 *     a. Récupère l'année active
 *     b. Récupère la période actuellement active (isActive=true)
 *     c. Si now > period.endDate :
 *        - Clôture la période courante (close)
 *        - Active la période suivante par periodOrder (activate)
 *     d. Si aucune période n'est active mais qu'on est dans l'intervalle d'une
 *        période → l'active
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { AcademicPeriodSettingsService } from './academic-period-settings.service';

@Injectable()
export class AcademicPeriodRolloverService {
  private readonly logger = new Logger(AcademicPeriodRolloverService.name);

  /** ID système pour les logs d'audit. */
  private readonly SYSTEM_USER_ID = 'SYSTEM_CRON';

  constructor(
    private readonly prisma: PrismaService,
    private readonly periodSettings: AcademicPeriodSettingsService,
  ) {}

  /**
   * Cron principal — tourne chaque jour à 2h05 du matin.
   * Idempotent. Multi-tenant. Auto-bascule des trimestres.
   */
  @Cron('5 2 * * *')
  async runDailyRollover(): Promise<void> {
    this.logger.log('🔄 Démarrage du cron d\'auto-rollover des périodes académiques (trimestres)');
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true, name: true },
    });

    let totalBascules = 0;
    let totalAutoActivations = 0;
    let totalErrors = 0;

    for (const tenant of tenants) {
      try {
        const result = await this.processTenant(tenant.id, tenant.name);
        if (result.basculed) totalBascules++;
        if (result.autoActivated) totalAutoActivations++;
      } catch (error) {
        totalErrors++;
        this.logger.error(
          `❌ Erreur tenant ${tenant.name} (${tenant.id}): ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.logger.log(
      `✅ Cron trimestres terminé — bascules: ${totalBascules}, auto-activations: ${totalAutoActivations}, erreurs: ${totalErrors}`,
    );
  }

  /**
   * Traite un tenant individuel.
   * Retourne un résumé des actions effectuées pour ce tenant.
   */
  async processTenant(
    tenantId: string,
    tenantName?: string,
  ): Promise<{ basculed: boolean; autoActivated: boolean }> {
    const result = { basculed: false, autoActivated: false };

    // 1. Récupérer l'année active du tenant
    const activeYear = await this.prisma.academicYear.findFirst({
      where: { tenantId, isActive: true },
    });
    if (!activeYear) {
      // Pas d'année active → rien à faire (le cron annuel s'en occupe)
      return result;
    }

    // 2. Récupérer toutes les périodes de l'année, triées par periodOrder
    const periods = await this.prisma.academicPeriod.findMany({
      where: { tenantId, academicYearId: activeYear.id, isClosed: false },
      orderBy: { periodOrder: 'asc' },
    });

    if (periods.length === 0) {
      // Aucune période définie → rien à faire
      return result;
    }

    const now = new Date();
    const activePeriod = periods.find((p) => p.isActive);

    // 3. Si une période active existe et qu'elle est dépassée → bascule
    if (activePeriod && now > activePeriod.endDate) {
      const nextPeriod = periods.find((p) => p.periodOrder > activePeriod.periodOrder);
      if (nextPeriod) {
        this.logger.log(
          `🔁 Tenant ${tenantName ?? tenantId}: période "${activePeriod.name}" terminée → activation de "${nextPeriod.name}"`,
        );
        try {
          // Clôture la période courante
          await this.periodSettings.close(tenantId, activePeriod.id, this.SYSTEM_USER_ID);
          // Active la période suivante
          await this.periodSettings.activate(tenantId, nextPeriod.id, this.SYSTEM_USER_ID);
          result.basculed = true;
          this.logger.log(
            `✓ Tenant ${tenantName ?? tenantId}: ${activePeriod.name} → ${nextPeriod.name}`,
          );
        } catch (error) {
          this.logger.error(
            `❌ Échec bascule tenant ${tenantName ?? tenantId}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } else {
        // Pas de période suivante → on est dans le dernier trimestre.
        // On ne bascule pas : la clôture de l'année scolaire s'en chargera
        // (closeAndPromoteYear active la nouvelle année qui aura ses propres
        // périodes). On logge juste à debug.
        this.logger.debug(
          `Tenant ${tenantName ?? tenantId}: dernière période "${activePeriod.name}" terminée, attente du rollover annuel`,
        );
      }
      return result;
    }

    // 4. Si aucune période n'est active → activer celle qui contient "now"
    if (!activePeriod) {
      const currentPeriod = periods.find((p) => {
        const start = new Date(p.startDate);
        const end = new Date(p.endDate);
        return now >= start && now <= end;
      });
      if (currentPeriod) {
        this.logger.log(
          `▶ Tenant ${tenantName ?? tenantId}: activation automatique de la période courante "${currentPeriod.name}"`,
        );
        try {
          await this.periodSettings.activate(tenantId, currentPeriod.id, this.SYSTEM_USER_ID);
          result.autoActivated = true;
          this.logger.log(
            `✓ Tenant ${tenantName ?? tenantId}: période "${currentPeriod.name}" activée`,
          );
        } catch (error) {
          this.logger.error(
            `❌ Échec activation auto tenant ${tenantName ?? tenantId}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }

    return result;
  }

  /**
   * Endpoint manuel pour déclencher le rollover immédiatement (admin/debug).
   */
  async triggerManualRollover(): Promise<{
    processed: number;
    bascules: number;
    autoActivations: number;
    errors: number;
  }> {
    this.logger.log('👇 Rollover trimestres manuel déclenché');
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true, name: true },
    });
    let bascules = 0;
    let autoActivations = 0;
    let errors = 0;
    for (const tenant of tenants) {
      try {
        const r = await this.processTenant(tenant.id, tenant.name);
        if (r.basculed) bascules++;
        if (r.autoActivated) autoActivations++;
      } catch (error) {
        errors++;
        this.logger.error(
          `❌ Erreur tenant ${tenant.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return {
      processed: tenants.length,
      bascules,
      autoActivations,
      errors,
    };
  }
}

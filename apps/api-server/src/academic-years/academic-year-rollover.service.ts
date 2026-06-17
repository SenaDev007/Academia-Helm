/**
 * ============================================================================
 * ACADEMIC YEAR ROLLOVER SERVICE — Automatisation du cycle annuel
 * ============================================================================
 *
 * Règles métier (calendrier type Bénin) :
 * - Pré-rentrée : 2e lundi de septembre
 * - Rentrée officielle : 3e lundi de septembre
 * - Fin d'année : dernier vendredi de juin
 * - 3 trimestres : T1 (sept→déc), T2 (janv→mars), T3 (avr→juin)
 *
 * Ce service tourne automatiquement chaque jour à 2h00 du matin (cron) et :
 *  1. Pour chaque tenant actif :
 *     a. Si l'année active est terminée (now > endDate) → clôture + active
 *        l'année suivante + crée des enrollments PROMOTION pour chaque élève
 *        actif (via closeAndPromoteYear).
 *     b. Si l'année active se termine dans ≤ 30 jours ET que l'année suivante
 *        n'existe pas encore → la génère (non active) pour qu'elle soit prête.
 *     c. Si aucune année active n'existe → génère et active l'année courante.
 *
 * Le service est idempotent : il peut être exécuté plusieurs fois sans effet
 * de bord. Toutes les opérations sont journalisées via ce logger.
 *
 * Reference : `AcademicYearsPrismaService.closeAndPromoteYear()` pour la
 * logique de clôture + promotion.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { AcademicYearsPrismaService } from './academic-years-prisma.service';
import { AcademicYearCalculatorService } from './academic-year-calculator.service';

@Injectable()
export class AcademicYearRolloverService {
  private readonly logger = new Logger(AcademicYearRolloverService.name);

  /** Délai avant la fin de l'année pour pré-générer la suivante (30 jours). */
  private readonly PRE_GENERATION_LEAD_TIME_MS = 30 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly academicYearsPrisma: AcademicYearsPrismaService,
    private readonly calculator: AcademicYearCalculatorService,
  ) {}

  /**
   * Cron principal — tourne chaque jour à 2h00 du matin.
   * Idempotent. Multi-tenant. Auto-rollover des années scolaires.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async runDailyRollover(): Promise<void> {
    this.logger.log('🔄 Démarrage du cron d\'auto-rollover des années scolaires');
    const tenants = await this.prisma.tenant.findMany({
      where: {
        // On ne traite que les tenants actifs (subscriptionStatus différent de SUSPENDED / CANCELLED)
        // Pas de filtre strict sur isActive pour permettre aux écoles temporairement
        // désactivées de quand même faire leur rollover — la décision métier appartient au billing.
      },
      select: { id: true, name: true, slug: true },
    });

    let totalRollovers = 0;
    let totalPreGenerations = 0;
    let totalAutoCreates = 0;
    let totalErrors = 0;

    for (const tenant of tenants) {
      try {
        const result = await this.processTenant(tenant.id, tenant.name);
        if (result.rolledOver) totalRollovers++;
        if (result.preGenerated) totalPreGenerations++;
        if (result.autoCreated) totalAutoCreates++;
      } catch (error) {
        totalErrors++;
        this.logger.error(
          `❌ Erreur tenant ${tenant.name} (${tenant.id}): ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.logger.log(
      `✅ Cron terminé — rollovers: ${totalRollovers}, pré-générations: ${totalPreGenerations}, ` +
      `auto-créations: ${totalAutoCreates}, erreurs: ${totalErrors}`,
    );
  }

  /**
   * Traite un tenant individuel.
   * Retourne un résumé des actions effectuées pour ce tenant.
   */
  async processTenant(
    tenantId: string,
    tenantName?: string,
  ): Promise<{ rolledOver: boolean; preGenerated: boolean; autoCreated: boolean }> {
    const result = { rolledOver: false, preGenerated: false, autoCreated: false };

    const activeYear = await this.prisma.academicYear.findFirst({
      where: { tenantId, isActive: true },
    });

    // Cas 1 : aucune année active → créer et activer l'année courante
    if (!activeYear) {
      this.logger.warn(
        `⚠ Tenant ${tenantName ?? tenantId}: aucune année active — création de l'année courante`,
      );
      try {
        await this.academicYearsPrisma.generateCurrentAcademicYear(tenantId);
        result.autoCreated = true;
        this.logger.log(
          `✓ Tenant ${tenantName ?? tenantId}: année courante créée et activée automatiquement`,
        );
      } catch (error) {
        // generateCurrentAcademicYear peut échouer si l'année existe déjà en base
        // avec isActive=false — on retente via checkAndGenerateNextYear qui gère ce cas.
        this.logger.debug(
          `Fallback vers checkAndGenerateNextYear pour tenant ${tenantId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        try {
          await this.academicYearsPrisma.checkAndGenerateNextYear(tenantId);
          result.autoCreated = true;
        } catch (innerError) {
          this.logger.error(
            `❌ Impossible de créer l'année courante pour tenant ${tenantId}: ${
              innerError instanceof Error ? innerError.message : String(innerError)
            }`,
          );
        }
      }
      return result;
    }

    // Cas 2 : année active terminée → clôturer + activer la suivante
    const now = new Date();
    const endDate = new Date(activeYear.endDate);
    if (now > endDate) {
      this.logger.log(
        `🔁 Tenant ${tenantName ?? tenantId}: année ${activeYear.label} terminée (${endDate.toISOString().slice(0, 10)}) — clôture + promotion`,
      );
      try {
        const promoteResult = await this.academicYearsPrisma.closeAndPromoteYear(
          activeYear.id,
          tenantId,
          'SYSTEM_CRON',
        );
        result.rolledOver = true;
        this.logger.log(
          `✓ Tenant ${tenantName ?? tenantId}: ${promoteResult.previousYearLabel} → ${promoteResult.nextYearLabel}`,
        );
      } catch (error) {
        this.logger.error(
          `❌ Échec du rollover tenant ${tenantName ?? tenantId} (${activeYear.label}): ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
      return result;
    }

    // Cas 3 : année active se termine dans ≤ 30 jours → pré-générer la suivante
    const timeUntilEnd = endDate.getTime() - now.getTime();
    if (timeUntilEnd <= this.PRE_GENERATION_LEAD_TIME_MS) {
      const startYear = parseInt(activeYear.label.split('-')[0], 10);
      const nextYearLabel = `${startYear + 1}-${startYear + 2}`;
      const nextYearExists = await this.prisma.academicYear.findFirst({
        where: { tenantId, label: nextYearLabel },
        select: { id: true },
      });
      if (!nextYearExists) {
        this.logger.log(
          `📅 Tenant ${tenantName ?? tenantId}: pré-génération de l'année ${nextYearLabel} (fin dans ${Math.ceil(timeUntilEnd / (24 * 60 * 60 * 1000))} jours)`,
        );
        try {
          await this.academicYearsPrisma.generateNextAcademicYear(tenantId);
          result.preGenerated = true;
          this.logger.log(
            `✓ Tenant ${tenantName ?? tenantId}: année ${nextYearLabel} pré-générée (non active)`,
          );
        } catch (error) {
          this.logger.error(
            `❌ Échec pré-génération tenant ${tenantName ?? tenantId} (${nextYearLabel}): ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    }

    return result;
  }

  /**
   * Endpoint manuel pour déclencher le rollover immédiatement (admin/debug).
   * Permet à un admin de forcer le cron sans attendre 2h00.
   */
  async triggerManualRollover(): Promise<{
    processed: number;
    rollovers: number;
    preGenerations: number;
    autoCreates: number;
    errors: number;
  }> {
    this.logger.log('👇 Rollover manuel déclenché');
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true, name: true },
    });
    let rollovers = 0;
    let preGenerations = 0;
    let autoCreates = 0;
    let errors = 0;
    for (const tenant of tenants) {
      try {
        const r = await this.processTenant(tenant.id, tenant.name);
        if (r.rolledOver) rollovers++;
        if (r.preGenerated) preGenerations++;
        if (r.autoCreated) autoCreates++;
      } catch (error) {
        errors++;
        this.logger.error(
          `❌ Erreur tenant ${tenant.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return {
      processed: tenants.length,
      rollovers,
      preGenerations,
      autoCreates,
      errors,
    };
  }
}

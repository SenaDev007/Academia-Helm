/**
 * ============================================================================
 * ANNUAL PLAN SERVICE — Planification pédagogique annuelle
 * ============================================================================
 * 
 * Gère la planification officielle ministérielle (Bénin) pour chaque niveau :
 *   - Maternelle (Grands)
 *   - CI, CP, CE1, CE2, CM1, CM2
 * 
 * Les données sont seedées automatiquement pour tous les tenants.
 * La direction peut personnaliser (isCustom = true).
 * Les enseignants consultent en lecture seule (bibliothèque).
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { prismaCreateDefaults } from '../common/utils/prisma-helpers';
import { ANNUAL_PLAN_SEED_DATA } from './annual-plan-seed-data';

@Injectable()
export class AnnualPlanService {
  private readonly logger = new Logger(AnnualPlanService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère la planification pour une classe et un trimestre donnés.
   * Filtre par tenant + academicYearId + classLevel + trimester.
   */
  async getPlans(
    tenantId: string,
    academicYearId: string,
    classLevel: string,
    trimester?: number,
  ) {
    const where: any = { tenantId, academicYearId, classLevel };
    if (trimester) where.trimester = trimester;

    return this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "annual_plans"
      WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "classLevel" = $3
      ${trimester ? 'AND "trimester" = $4' : ''}
      ORDER BY "trimester" ASC, "month" ASC, "week" ASC, "domain" ASC
    `, ...(trimester ? [tenantId, academicYearId, classLevel, trimester] : [tenantId, academicYearId, classLevel]));
  }

  /**
   * Récupère toutes les classes disponibles dans la planification.
   * Retourne les classLevel distincts pour ce tenant.
   */
  async getAvailableClasses(tenantId: string, academicYearId: string) {
    const result = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT DISTINCT "classLevel" FROM "annual_plans"
      WHERE "tenantId" = $1 AND "academicYearId" = $2
      ORDER BY 
        CASE "classLevel"
          WHEN 'MATERNELLE_GRANDS' THEN 0
          WHEN 'CI' THEN 1
          WHEN 'CP' THEN 2
          WHEN 'CE1' THEN 3
          WHEN 'CE2' THEN 4
          WHEN 'CM1' THEN 5
          WHEN 'CM2' THEN 6
          ELSE 99
        END
    `, tenantId, academicYearId);
    return result.map(r => r.classLevel);
  }

  /**
   * Met à jour une cellule de la planification.
   * Si la cellule n'existe pas → create avec isCustom = true.
   * Si elle existe → update content + isCustom = true.
   */
  async updatePlan(
    id: string,
    tenantId: string,
    updates: { content?: string },
  ) {
    const existing = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "annual_plans" WHERE "id" = $1 AND "tenantId" = $2
    `, id, tenantId);

    if (!existing || existing.length === 0) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }

    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (updates.content !== undefined) {
      sets.push(`"content" = $${idx++}`);
      params.push(updates.content);
    }
    sets.push(`"isCustom" = true`);
    sets.push(`"updatedAt" = NOW()`);

    params.push(id);
    params.push(tenantId);

    await this.prisma.$executeRawUnsafe(`
      UPDATE "annual_plans" SET ${sets.join(', ')}
      WHERE "id" = $${idx++} AND "tenantId" = $${idx++}
    `, ...params);

    const updated = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "annual_plans" WHERE "id" = $1 AND "tenantId" = $2
    `, id, tenantId);

    return updated[0];
  }

  /**
   * ⭐ SEED : Insère la planification officielle pour un tenant + année.
   *    Idempotent : ne réinsère pas si les données existent déjà.
   *    Toutes les écoles ont ces données par défaut.
   *    Initialise TOUTES les classes (Maternelle + CI + CP + CE1 + CE2 + CM1 + CM2) en une seule fois.
   */
  async seedForTenant(
    tenantId: string,
    academicYearId: string,
    schoolLevelId: string,
  ) {
    // Vérifier si le seed a déjà été fait
    const existing = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*) as count FROM "annual_plans"
      WHERE "tenantId" = $1 AND "academicYearId" = $2
    `, tenantId, academicYearId);

    if (existing[0]?.count > 0) {
      this.logger.log(`Seed already done for tenant ${tenantId} — ${existing[0].count} plans exist`);
      return { skipped: true, count: existing[0].count };
    }

    // ⭐ Récupérer TOUS les schoolLevelIds du tenant (Maternelle + Primaire)
    //    pour que les FK soient valides. On prend le schoolLevelId passé en param,
    //    mais on pourrait aussi en résoudre d'autres si nécessaire.
    const allSchoolLevels = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT "id", "code" FROM "school_levels" WHERE "tenantId" = $1
    `, tenantId).catch(() => []);
    
    // Utiliser le schoolLevelId passé, ou le premier trouvé
    const resolvedSchoolLevelId = schoolLevelId || allSchoolLevels[0]?.id;
    if (!resolvedSchoolLevelId) {
      throw new BadRequestException('Aucun schoolLevelId trouvé pour ce tenant');
    }

    // Insérer toutes les données du seed — TOUTES les classes d'un coup
    let inserted = 0;
    let failed = 0;
    for (const item of ANNUAL_PLAN_SEED_DATA) {
      try {
        // ⭐ Générer un ID unique et déterministe
        const planId = `${tenantId.substring(0, 8)}-${item.classLevel}-${item.trimester}-${item.month.substring(0, 3)}-${item.week.substring(0, 3)}-${item.domain.substring(0, 5)}-${item.subDomain?.substring(0, 5) || 'ns'}-${inserted}`;
        await this.prisma.$executeRawUnsafe(`
          INSERT INTO "annual_plans" ("id", "tenantId", "academicYearId", "schoolLevelId",
            "classLevel", "trimester", "month", "week", "domain", "subDomain", "content",
            "isCustom", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false, NOW(), NOW())
          ON CONFLICT DO NOTHING
        `,
          planId,
          tenantId, academicYearId, resolvedSchoolLevelId,
          item.classLevel, item.trimester, item.month, item.week,
          item.domain, item.subDomain || null, item.content,
        );
        inserted++;
      } catch (e: any) {
        failed++;
        // Log first few errors for debugging
        if (failed <= 3) {
          this.logger.warn(`Seed insert failed for ${item.classLevel}-${item.month}-${item.domain}: ${e.message?.substring(0, 100)}`);
        }
      }
    }

    this.logger.log(`Seeded ${inserted} annual plans for tenant ${tenantId} (${failed} failed)`);
    return { skipped: false, count: inserted, failed };
  }
}

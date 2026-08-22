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
   *    Idempotent : ne réinsère pas si les données existent déjà (sauf si force=true).
   *    Toutes les écoles ont ces données par défaut.
   *    Initialise TOUTES les classes (Maternelle + CI + CP + CE1 + CE2 + CM1 + CM2) en une seule fois.
   *
   *    ⭐ force=true : supprime les anciennes données et réinsère les nouvelles
   *      (utile quand le contenu du seed a été mis à jour et qu'on veut rafraîchir
   *      la base sans toucher aux personnalisations manuelles isCustom=true).
   *      En mode force, on GARDE les personnalisations isCustom=true si elles existent
   *      (on ne les écrase pas), mais on MET À JOUR le contenu des cellules officielles.
   */
  async seedForTenant(
    tenantId: string,
    academicYearId: string,
    schoolLevelId: string,
    options?: { force?: boolean },
  ) {
    const force = options?.force === true;

    // Vérifier si le seed a déjà été fait
    const existing = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*) as count FROM "annual_plans"
      WHERE "tenantId" = $1 AND "academicYearId" = $2
    `, tenantId, academicYearId);

    if (existing[0]?.count > 0 && !force) {
      this.logger.log(`Seed already done for tenant ${tenantId} — ${existing[0].count} plans exist (use force=true to re-seed)`);
      return { skipped: true, count: existing[0].count };
    }

    // ⭐ Mode force : supprimer les cellules officielles (isCustom=false) pour réinsérer
    //    On GARDE les personnalisations isCustom=true.
    if (force) {
      const deleted = await this.prisma.$executeRawUnsafe(`
        DELETE FROM "annual_plans"
        WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "isCustom" = false
      `, tenantId, academicYearId);
      this.logger.log(`Force mode: deleted ${deleted} non-custom plans for re-seeding`);
    }

    // ⭐ Récupérer TOUS les schoolLevelIds du tenant (Maternelle + Primaire)
    const allSchoolLevels = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT "id", "code" FROM "school_levels" WHERE "tenantId" = $1
    `, tenantId).catch(() => []);
    
    // ⭐ Vérifier que le schoolLevelId passé existe VRAIMENT dans school_levels
    //    Le frontend peut envoyer un education_levels UUID (différent de school_levels UUID)
    //    Si le schoolLevelId n'existe pas dans school_levels, on prend le premier du tenant
    let resolvedSchoolLevelId: string | undefined = undefined;
    if (schoolLevelId && schoolLevelId.length > 0) {
      // Vérifier si cet ID existe dans school_levels
      const checkExists = allSchoolLevels.find((sl: any) => sl.id === schoolLevelId);
      if (checkExists) {
        resolvedSchoolLevelId = schoolLevelId;
        this.logger.log(`Using provided schoolLevelId: ${schoolLevelId} (${checkExists.code})`);
      } else {
        this.logger.warn(`Provided schoolLevelId ${schoolLevelId} not found in school_levels — using first available`);
      }
    }
    if (!resolvedSchoolLevelId) {
      resolvedSchoolLevelId = allSchoolLevels[0]?.id;
    }
    if (!resolvedSchoolLevelId) {
      throw new BadRequestException('Aucun schoolLevelId trouvé pour ce tenant — créez d\'abord les niveaux scolaires dans les paramètres.');
    }

    this.logger.log(`Seeding with schoolLevelId=${resolvedSchoolLevelId}, tenantId=${tenantId}, academicYearId=${academicYearId}, force=${force}`);

    // ⭐ Indexer les personnalisations existantes (pour ne pas les écraser en mode force)
    const customPlans: Set<string> = new Set();
    if (force) {
      const customs = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT "classLevel", "trimester", "month", "week", "domain", "subDomain"
        FROM "annual_plans"
        WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "isCustom" = true
      `, tenantId, academicYearId);
      for (const c of customs) {
        customPlans.add(`${c.classLevel}|${c.trimester}|${c.month}|${c.week}|${c.domain}|${c.subDomain || ''}`);
      }
    }

    // Insérer toutes les données du seed — TOUTES les classes d'un coup
    let inserted = 0;
    let failed = 0;
    let skippedCustom = 0;
    let firstError: string | null = null;
    for (const item of ANNUAL_PLAN_SEED_DATA) {
      // ⭐ En mode force, sauter les cellules qui ont été personnalisées (isCustom=true)
      if (force) {
        const key = `${item.classLevel}|${item.trimester}|${item.month}|${item.week}|${item.domain}|${item.subDomain || ''}`;
        if (customPlans.has(key)) {
          skippedCustom++;
          continue;
        }
      }
      try {
        // ⭐ Générer un ID unique — utiliser randomUUID pour éviter les collisions
        const { randomUUID } = require('crypto');
        const planId = randomUUID();
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
        if (!firstError) {
          firstError = e.message?.substring(0, 200);
          this.logger.error(`FIRST seed insert failure: ${firstError}`);
          this.logger.error(`Item: classLevel=${item.classLevel}, trimester=${item.trimester}, month=${item.month}, domain=${item.domain}`);
        }
      }
    }

    this.logger.log(`Seeded ${inserted} annual plans for tenant ${tenantId} (${failed} failed, ${skippedCustom} custom preserved)`);

    // ⭐ Si TOUT a échoué, lancer une erreur claire
    if (inserted === 0 && failed > 0) {
      throw new BadRequestException(
        `Échec total de l'initialisation: 0/${ANNUAL_PLAN_SEED_DATA.length} insérés. ` +
        `Première erreur: ${firstError}. ` +
        `schoolLevelId utilisé: ${resolvedSchoolLevelId}. ` +
        `Vérifiez que les FK (tenantId, academicYearId, schoolLevelId) sont valides.`
      );
    }

    return { skipped: false, count: inserted, failed, skippedCustom, forced: force };
  }
}

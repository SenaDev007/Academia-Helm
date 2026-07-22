/**
 * ============================================================================
 * EXAMS SPEC CONFIG CONTROLLER — Phase 2
 * ============================================================================
 *
 * Endpoints pour les tables spec créées en Phase 2 :
 *   - QualitativeScale           (échelles TS/S/PS/NS pour maternelle)
 *   - LevelEvaluationPolicy      (politique d'évaluation par niveau)
 *   - BilingualPedagogyPolicy    (politique bilingue FR/EN)
 *   - BulletinTemplate           (modèles de bulletins PDF)
 *   - BulletinPublicationPolicy  (politiques de publication)
 *   - ExamAdvancedSetting        (paramètres avancés)
 *   - AcademicMentionRule        (mentions configurables)
 *   - AcademicDecisionRule       (décisions configurables)
 *
 * Base path: /exams/spec-config
 * ============================================================================
 */

import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { PrismaService } from '../../database/prisma.service';

@Controller('exams/spec-config')
@UseGuards(JwtAuthGuard)
export class ExamsSpecConfigController {
  constructor(private readonly prisma: PrismaService) {}

  // ===========================================================================
  // QUALITATIVE SCALES (TS/S/PS/NS pour maternelle)
  // ===========================================================================
  @Get('qualitative-scales')
  async getQualitativeScales(@TenantId() tenantId: string) {
    const result: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "qualitative_scales" WHERE "tenantId" = $1 ORDER BY rank ASC`,
      tenantId,
    );
    return result;
  }

  @Post('qualitative-scales')
  async createQualitativeScale(@TenantId() tenantId: string, @Body() data: any) {
    const id = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "qualitative_scales" ("id", "tenantId", "code", "label", "rank", "isDefault", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      id, tenantId, data.code, data.label, data.rank || 0,
      data.isDefault || false, data.isActive !== false,
    );
    return { id, ...data };
  }

  @Put('qualitative-scales/:id')
  async updateQualitativeScale(@TenantId() tenantId: string, @Param('id') id: string, @Body() data: any) {
    await this.prisma.$executeRawUnsafe(
      `UPDATE "qualitative_scales" SET "code" = $1, "label" = $2, "rank" = $3, "isDefault" = $4, "isActive" = $5, "updatedAt" = NOW()
       WHERE "id" = $6 AND "tenantId" = $7`,
      data.code, data.label, data.rank || 0, data.isDefault || false,
      data.isActive !== false, id, tenantId,
    );
    return { id, ...data };
  }

  @Delete('qualitative-scales/:id')
  async deleteQualitativeScale(@TenantId() tenantId: string, @Param('id') id: string) {
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "qualitative_scales" WHERE "id" = $1 AND "tenantId" = $2`,
      id, tenantId,
    );
    return { deleted: true };
  }

  // ===========================================================================
  // LEVEL EVALUATION POLICIES (par niveau : MATERNELLE=qualitative, PRIMAIRE=coef 1, SECONDAIRE=coef)
  // ===========================================================================
  @Get('level-policies')
  async getLevelPolicies(@TenantId() tenantId: string, @Query('academicYearId') academicYearId?: string) {
    const params: any[] = [tenantId];
    let yearFilter = '';
    if (academicYearId) {
      params.push(academicYearId);
      yearFilter = `AND "academicYearId" = $2`;
    }
    const result: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "level_evaluation_policies" WHERE "tenantId" = $1 ${yearFilter} ORDER BY "schoolStage" ASC`,
      ...params,
    );
    return result;
  }

  @Post('level-policies')
  async createLevelPolicy(@TenantId() tenantId: string, @Body() data: any) {
    const id = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "level_evaluation_policies"
       ("id", "tenantId", "academicYearId", "schoolStage", "levelId", "classId", "seriesId",
        "evaluationMode", "defaultCoefficient", "qualitativeScaleId", "calculationRuleId",
        "defaultEvaluationCount", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())`,
      id, tenantId, data.academicYearId, data.schoolStage,
      data.levelId || null, data.classId || null, data.seriesId || null,
      data.evaluationMode, data.defaultCoefficient || null,
      data.qualitativeScaleId || null, data.calculationRuleId || null,
      data.defaultEvaluationCount || null, data.isActive !== false,
    );
    return { id, ...data };
  }

  @Put('level-policies/:id')
  async updateLevelPolicy(@TenantId() tenantId: string, @Param('id') id: string, @Body() data: any) {
    await this.prisma.$executeRawUnsafe(
      `UPDATE "level_evaluation_policies" SET
        "schoolStage" = $1, "evaluationMode" = $2, "defaultCoefficient" = $3,
        "qualitativeScaleId" = $4, "calculationRuleId" = $5, "defaultEvaluationCount" = $6,
        "isActive" = $7, "updatedAt" = NOW()
       WHERE "id" = $8 AND "tenantId" = $9`,
      data.schoolStage, data.evaluationMode, data.defaultCoefficient,
      data.qualitativeScaleId, data.calculationRuleId, data.defaultEvaluationCount,
      data.isActive !== false, id, tenantId,
    );
    return { id, ...data };
  }

  @Delete('level-policies/:id')
  async deleteLevelPolicy(@TenantId() tenantId: string, @Param('id') id: string) {
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "level_evaluation_policies" WHERE "id" = $1 AND "tenantId" = $2`,
      id, tenantId,
    );
    return { deleted: true };
  }

  // ===========================================================================
  // BILINGUAL PEDAGOGY POLICIES
  // ===========================================================================
  @Get('bilingual-policy')
  async getBilingualPolicy(@TenantId() tenantId: string, @Query('academicYearId') academicYearId?: string) {
    const params: any[] = [tenantId];
    let yearFilter = '';
    if (academicYearId) {
      params.push(academicYearId);
      yearFilter = `AND "academicYearId" = $2`;
    }
    const result: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "bilingual_pedagogy_policies" WHERE "tenantId" = $1 ${yearFilter} ORDER BY "createdAt" DESC LIMIT 1`,
      ...params,
    );
    return result[0] || null;
  }

  @Post('bilingual-policy')
  async upsertBilingualPolicy(@TenantId() tenantId: string, @Body() data: any) {
    // Upsert: si une policy existe pour ce tenant+year, on update ; sinon on crée
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT id FROM "bilingual_pedagogy_policies" WHERE "tenantId" = $1 AND "academicYearId" = $2 LIMIT 1`,
      tenantId, data.academicYearId,
    );
    if (existing && existing.length > 0) {
      const id = existing[0].id;
      await this.prisma.$executeRawUnsafe(
        `UPDATE "bilingual_pedagogy_policies" SET
          "isEnabled" = $1, "allowFrenchSubjects" = $2, "allowEnglishSubjects" = $3,
          "allowBilingualSubjects" = $4, "separateLanguageAverages" = $5,
          "showLanguageSectionsOnBulletin" = $6, "allowBilingualAppreciations" = $7,
          "updatedAt" = NOW()
         WHERE "id" = $8`,
        data.isEnabled, data.allowFrenchSubjects !== false, data.allowEnglishSubjects !== false,
        data.allowBilingualSubjects !== false, data.separateLanguageAverages || false,
        data.showLanguageSectionsOnBulletin !== false, data.allowBilingualAppreciations !== false,
        id,
      );
      return { id, ...data };
    }
    const id = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "bilingual_pedagogy_policies"
       ("id", "tenantId", "academicYearId", "isEnabled", "allowFrenchSubjects",
        "allowEnglishSubjects", "allowBilingualSubjects", "separateLanguageAverages",
        "showLanguageSectionsOnBulletin", "allowBilingualAppreciations", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
      id, tenantId, data.academicYearId, data.isEnabled,
      data.allowFrenchSubjects !== false, data.allowEnglishSubjects !== false,
      data.allowBilingualSubjects !== false, data.separateLanguageAverages || false,
      data.showLanguageSectionsOnBulletin !== false, data.allowBilingualAppreciations !== false,
    );
    return { id, ...data };
  }

  // ===========================================================================
  // BULLETIN TEMPLATES
  // ===========================================================================
  @Get('bulletin-templates')
  async getBulletinTemplates(@TenantId() tenantId: string) {
    const result: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "bulletin_templates" WHERE "tenantId" = $1 AND "isActive" = true ORDER BY "isDefault" DESC, "name" ASC`,
      tenantId,
    );
    return result;
  }

  @Post('bulletin-templates')
  async createBulletinTemplate(@TenantId() tenantId: string, @Body() data: any) {
    const id = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "bulletin_templates"
       ("id", "tenantId", "name", "levelId", "classId", "seriesId", "language",
        "layoutJson", "isDefault", "isActive", "createdById", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, NOW(), NOW())`,
      id, tenantId, data.name, data.levelId || null, data.classId || null,
      data.seriesId || null, data.language || 'FR',
      JSON.stringify(data.layoutJson || {}), data.isDefault || false,
      data.isActive !== false, data.createdById || null,
    );
    return { id, ...data };
  }

  @Put('bulletin-templates/:id')
  async updateBulletinTemplate(@TenantId() tenantId: string, @Param('id') id: string, @Body() data: any) {
    await this.prisma.$executeRawUnsafe(
      `UPDATE "bulletin_templates" SET
        "name" = $1, "language" = $2, "layoutJson" = $3::jsonb,
        "isDefault" = $4, "isActive" = $5, "updatedAt" = NOW()
       WHERE "id" = $6 AND "tenantId" = $7`,
      data.name, data.language || 'FR',
      JSON.stringify(data.layoutJson || {}), data.isDefault || false,
      data.isActive !== false, id, tenantId,
    );
    return { id, ...data };
  }

  @Post('bulletin-templates/:id/set-default')
  async setDefaultBulletinTemplate(@TenantId() tenantId: string, @Param('id') id: string) {
    // Désactiver les autres defaults
    await this.prisma.$executeRawUnsafe(
      `UPDATE "bulletin_templates" SET "isDefault" = false, "updatedAt" = NOW() WHERE "tenantId" = $1`,
      tenantId,
    );
    await this.prisma.$executeRawUnsafe(
      `UPDATE "bulletin_templates" SET "isDefault" = true, "updatedAt" = NOW() WHERE "id" = $1 AND "tenantId" = $2`,
      id, tenantId,
    );
    return { success: true };
  }

  @Delete('bulletin-templates/:id')
  async deleteBulletinTemplate(@TenantId() tenantId: string, @Param('id') id: string) {
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "bulletin_templates" WHERE "id" = $1 AND "tenantId" = $2`,
      id, tenantId,
    );
    return { deleted: true };
  }

  // ===========================================================================
  // BULLETIN PUBLICATION POLICIES
  // ===========================================================================
  @Get('publication-policy')
  async getPublicationPolicy(@TenantId() tenantId: string, @Query('academicYearId') academicYearId?: string) {
    const params: any[] = [tenantId];
    let yearFilter = '';
    if (academicYearId) {
      params.push(academicYearId);
      yearFilter = `AND "academicYearId" = $2`;
    }
    const result: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "bulletin_publication_policies" WHERE "tenantId" = $1 ${yearFilter} ORDER BY "createdAt" DESC LIMIT 1`,
      ...params,
    );
    return result[0] || null;
  }

  @Post('publication-policy')
  async upsertPublicationPolicy(@TenantId() tenantId: string, @Body() data: any) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT id FROM "bulletin_publication_policies" WHERE "tenantId" = $1 AND "academicYearId" = $2 LIMIT 1`,
      tenantId, data.academicYearId,
    );
    if (existing && existing.length > 0) {
      const id = existing[0].id;
      await this.prisma.$executeRawUnsafe(
        `UPDATE "bulletin_publication_policies" SET
          "requireGradeValidation" = $1, "requireClassCouncil" = $2,
          "requireDirectorApproval" = $3, "blockIfFinanceDebt" = $4,
          "allowParentDownload" = $5, "allowStudentDownload" = $6,
          "publicationMode" = $7, "updatedAt" = NOW()
         WHERE "id" = $8`,
        data.requireGradeValidation !== false, data.requireClassCouncil !== false,
        data.requireDirectorApproval !== false, data.blockIfFinanceDebt || false,
        data.allowParentDownload !== false, data.allowStudentDownload || false,
        data.publicationMode || 'MANUAL', id,
      );
      return { id, ...data };
    }
    const id = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "bulletin_publication_policies"
       ("id", "tenantId", "academicYearId", "requireGradeValidation", "requireClassCouncil",
        "requireDirectorApproval", "blockIfFinanceDebt", "allowParentDownload",
        "allowStudentDownload", "publicationMode", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
      id, tenantId, data.academicYearId,
      data.requireGradeValidation !== false, data.requireClassCouncil !== false,
      data.requireDirectorApproval !== false, data.blockIfFinanceDebt || false,
      data.allowParentDownload !== false, data.allowStudentDownload || false,
      data.publicationMode || 'MANUAL',
    );
    return { id, ...data };
  }

  // ===========================================================================
  // EXAM ADVANCED SETTINGS
  // ===========================================================================
  @Get('advanced-settings')
  async getAdvancedSettings(@TenantId() tenantId: string, @Query('academicYearId') academicYearId?: string) {
    const params: any[] = [tenantId];
    let yearFilter = '';
    if (academicYearId) {
      params.push(academicYearId);
      yearFilter = `AND "academicYearId" = $2`;
    }
    const result: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "exam_advanced_settings" WHERE "tenantId" = $1 ${yearFilter} ORDER BY "createdAt" DESC LIMIT 1`,
      ...params,
    );
    return result[0] || null;
  }

  @Post('advanced-settings')
  async upsertAdvancedSettings(@TenantId() tenantId: string, @Body() data: any) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT id FROM "exam_advanced_settings" WHERE "tenantId" = $1 AND "academicYearId" = $2 LIMIT 1`,
      tenantId, data.academicYearId,
    );
    if (existing && existing.length > 0) {
      const id = existing[0].id;
      await this.prisma.$executeRawUnsafe(
        `UPDATE "exam_advanced_settings" SET
          "allowTeacherGradeEditAfterSubmit" = $1,
          "allowGradeCorrectionAfterLock" = $2,
          "requireCorrectionApproval" = $3,
          "allowExcelImport" = $4, "allowExcelExport" = $5,
          "roundingPrecision" = $6, "roundingMode" = $7,
          "showClassAverageOnBulletin" = $8,
          "showSubjectRankOnBulletin" = $9,
          "showGeneralRankOnBulletin" = $10,
          "updatedAt" = NOW()
         WHERE "id" = $11`,
        data.allowTeacherGradeEditAfterSubmit || false,
        data.allowGradeCorrectionAfterLock || false,
        data.requireCorrectionApproval !== false,
        data.allowExcelImport !== false, data.allowExcelExport !== false,
        data.roundingPrecision || 2, data.roundingMode || 'HALF_UP',
        data.showClassAverageOnBulletin !== false,
        data.showSubjectRankOnBulletin !== false,
        data.showGeneralRankOnBulletin !== false,
        id,
      );
      return { id, ...data };
    }
    const id = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "exam_advanced_settings"
       ("id", "tenantId", "academicYearId", "allowTeacherGradeEditAfterSubmit",
        "allowGradeCorrectionAfterLock", "requireCorrectionApproval",
        "allowExcelImport", "allowExcelExport", "roundingPrecision", "roundingMode",
        "showClassAverageOnBulletin", "showSubjectRankOnBulletin",
        "showGeneralRankOnBulletin", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())`,
      id, tenantId, data.academicYearId,
      data.allowTeacherGradeEditAfterSubmit || false,
      data.allowGradeCorrectionAfterLock || false,
      data.requireCorrectionApproval !== false,
      data.allowExcelImport !== false, data.allowExcelExport !== false,
      data.roundingPrecision || 2, data.roundingMode || 'HALF_UP',
      data.showClassAverageOnBulletin !== false,
      data.showSubjectRankOnBulletin !== false,
      data.showGeneralRankOnBulletin !== false,
    );
    return { id, ...data };
  }

  // ===========================================================================
  // ACADEMIC MENTION RULES (mentions configurables)
  // ===========================================================================
  @Get('mentions')
  async getMentions(@TenantId() tenantId: string, @Query('academicYearId') academicYearId?: string) {
    const params: any[] = [tenantId];
    let yearFilter = '';
    if (academicYearId) {
      params.push(academicYearId);
      yearFilter = `AND ("academicYearId" = $2 OR "academicYearId" IS NULL)`;
    }
    const result: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "academic_mention_rules" WHERE "tenantId" = $1 ${yearFilter} AND "isActive" = true ORDER BY "minAverage" DESC`,
      ...params,
    );
    return result;
  }

  @Post('mentions')
  async createMention(@TenantId() tenantId: string, @Body() data: any) {
    const id = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "academic_mention_rules"
       ("id", "tenantId", "academicYearId", "name", "minAverage", "maxAverage",
        "appreciation", "language", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
      id, tenantId, data.academicYearId || null, data.name,
      data.minAverage, data.maxAverage, data.appreciation || null,
      data.language || 'FR', data.isActive !== false,
    );
    return { id, ...data };
  }

  @Put('mentions/:id')
  async updateMention(@TenantId() tenantId: string, @Param('id') id: string, @Body() data: any) {
    await this.prisma.$executeRawUnsafe(
      `UPDATE "academic_mention_rules" SET
        "name" = $1, "minAverage" = $2, "maxAverage" = $3,
        "appreciation" = $4, "language" = $5, "isActive" = $6, "updatedAt" = NOW()
       WHERE "id" = $7 AND "tenantId" = $8`,
      data.name, data.minAverage, data.maxAverage,
      data.appreciation, data.language || 'FR',
      data.isActive !== false, id, tenantId,
    );
    return { id, ...data };
  }

  @Delete('mentions/:id')
  async deleteMention(@TenantId() tenantId: string, @Param('id') id: string) {
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "academic_mention_rules" WHERE "id" = $1 AND "tenantId" = $2`,
      id, tenantId,
    );
    return { deleted: true };
  }

  // ===========================================================================
  // ACADEMIC DECISION RULES (décisions configurables)
  // ===========================================================================
  @Get('decision-rules')
  async getDecisionRules(@TenantId() tenantId: string, @Query('academicYearId') academicYearId?: string) {
    const params: any[] = [tenantId];
    let yearFilter = '';
    if (academicYearId) {
      params.push(academicYearId);
      yearFilter = `AND ("academicYearId" = $2 OR "academicYearId" IS NULL)`;
    }
    const result: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "academic_decision_rules" WHERE "tenantId" = $1 ${yearFilter} AND "isActive" = true ORDER BY "minAverage" DESC NULLS LAST`,
      ...params,
    );
    return result;
  }

  @Post('decision-rules')
  async createDecisionRule(@TenantId() tenantId: string, @Body() data: any) {
    const id = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "academic_decision_rules"
       ("id", "tenantId", "academicYearId", "code", "label", "description",
        "minAverage", "maxAverage", "requiresCouncil", "isPositive", "isActive",
        "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
      id, tenantId, data.academicYearId || null, data.code, data.label,
      data.description || null, data.minAverage || null, data.maxAverage || null,
      data.requiresCouncil !== false, data.isPositive || false, data.isActive !== false,
    );
    return { id, ...data };
  }

  @Put('decision-rules/:id')
  async updateDecisionRule(@TenantId() tenantId: string, @Param('id') id: string, @Body() data: any) {
    await this.prisma.$executeRawUnsafe(
      `UPDATE "academic_decision_rules" SET
        "code" = $1, "label" = $2, "description" = $3,
        "minAverage" = $4, "maxAverage" = $5, "requiresCouncil" = $6,
        "isPositive" = $7, "isActive" = $8, "updatedAt" = NOW()
       WHERE "id" = $9 AND "tenantId" = $10`,
      data.code, data.label, data.description,
      data.minAverage, data.maxAverage, data.requiresCouncil !== false,
      data.isPositive || false, data.isActive !== false, id, tenantId,
    );
    return { id, ...data };
  }

  @Delete('decision-rules/:id')
  async deleteDecisionRule(@TenantId() tenantId: string, @Param('id') id: string) {
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "academic_decision_rules" WHERE "id" = $1 AND "tenantId" = $2`,
      id, tenantId,
    );
    return { deleted: true };
  }

  // ===========================================================================
  // ACADEMIC ANALYTICS SNAPSHOTS
  // ===========================================================================
  @Get('analytics-snapshots')
  async getAnalyticsSnapshots(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('periodId') periodId?: string,
    @Query('scopeType') scopeType?: string,
  ) {
    const params: any[] = [tenantId, academicYearId];
    let filters = `WHERE "tenantId" = $1 AND "academicYearId" = $2`;
    if (periodId) { params.push(periodId); filters += ` AND "periodId" = $${params.length}`; }
    if (scopeType) { params.push(scopeType); filters += ` AND "scopeType" = $${params.length}`; }
    const result: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "academic_analytics_snapshots" ${filters} ORDER BY "calculatedAt" DESC LIMIT 50`,
      ...params,
    );
    return result;
  }

  @Post('analytics-snapshots')
  async createAnalyticsSnapshot(@TenantId() tenantId: string, @Body() data: any) {
    const id = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "academic_analytics_snapshots"
       ("id", "tenantId", "academicYearId", "periodId", "scopeType", "scopeId", "dataJson", "calculatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())`,
      id, tenantId, data.academicYearId, data.periodId || null,
      data.scopeType, data.scopeId || null, JSON.stringify(data.dataJson || {}),
    );
    return { id, ...data };
  }
}

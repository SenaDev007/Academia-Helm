/**
 * ============================================================================
 * MONTHLY PLAN CONTROLLER — Planification pédagogique mensuelle
 * ============================================================================
 *
 * Endpoints :
 *   GET    /pedagogy/monthly-plans?academicYearId=Y&classLevel=CM2&month=Octobre&teacherId=T
 *   POST   /pedagogy/monthly-plans/auto-propose   (génère la proposition depuis annual_plans)
 *   POST   /pedagogy/monthly-plans/save            (sauvegarde la planif mensuelle)
 *   PUT    /pedagogy/monthly-plans/:id             (édite une cellule individuelle)
 *
 * Terminologie SA/Séquence/U/D :
 *   - SA = Situation d'Apprentissage (SA1, SA2, SA3)
 *   - Séquence = Séquence pédagogique (séq 1, séq 2, ...) — séance de classe
 *   - U = Unité (U1, U2)
 *   - D = Dossier (D1, D2)
 * ============================================================================
 */

import {
  Controller, Get, Post, Put, Body, Param, Query, UseGuards, Logger, BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { MonthlyPlanService, MonthlyPlanCell } from './monthly-plan.service';

@Controller('pedagogy/monthly-plans')
@UseGuards(JwtAuthGuard, TenantGuard)
export class MonthlyPlanController {
  private readonly logger = new Logger(MonthlyPlanController.name);

  constructor(private readonly monthlyPlanService: MonthlyPlanService) {}

  /**
   * GET /pedagogy/monthly-plans?academicYearId=Y&classLevel=CM2&month=Octobre&teacherId=T
   *    Récupère la planification mensuelle existante pour l'enseignant + mois.
   *    Si vide, l'UI appellera POST /auto-propose pour générer la proposition.
   */
  @Get()
  async getMonthlyPlan(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('classLevel') classLevel: string,
    @Query('month') month: string,
    @Query('teacherId') teacherId?: string,
    @Query('academicClassId') academicClassId?: string,
  ) {
    if (!academicYearId || !classLevel || !month) {
      throw new BadRequestException('academicYearId, classLevel et month sont requis');
    }
    return this.monthlyPlanService.getMonthlyPlan(
      tenantId, academicYearId, classLevel, month,
      { teacherId, academicClassId },
    );
  }

  /**
   * POST /pedagogy/monthly-plans/auto-propose
   *    body: { academicYearId, classLevel, month }
   *    Génère la proposition automatique depuis annual_plans.
   *    Ne sauvegarde PAS en base — l'enseignant édite puis appelle /save.
   */
  @Post('auto-propose')
  async autoPropose(
    @TenantId() tenantId: string,
    @Body() body: { academicYearId: string; classLevel: string; month: string },
  ) {
    if (!body.academicYearId || !body.classLevel || !body.month) {
      throw new BadRequestException('academicYearId, classLevel, month requis');
    }
    const cells = await this.monthlyPlanService.autoProposeMonthlyPlan(
      tenantId, body.academicYearId, body.classLevel, body.month,
    );
    return { cells, count: cells.length };
  }

  /**
   * POST /pedagogy/monthly-plans/save
   *    body: { academicYearId, classLevel, month, teacherId, academicClassId, schoolLevelId, cells }
   *    Sauvegarde (ou met à jour) la planification mensuelle.
   *    Préserve les cellules personnalisées (isCustom=true) existantes.
   */
  @Post('save')
  async save(
    @TenantId() tenantId: string,
    @Body() body: {
      academicYearId: string;
      classLevel: string;
      month: string;
      teacherId?: string;
      academicClassId?: string;
      schoolLevelId?: string;
      cells: MonthlyPlanCell[];
    },
  ) {
    if (!body.academicYearId || !body.classLevel || !body.month || !Array.isArray(body.cells)) {
      throw new BadRequestException('academicYearId, classLevel, month, cells requis');
    }
    return this.monthlyPlanService.saveMonthlyPlan(
      tenantId, body.academicYearId, body.classLevel, body.month, body.cells,
      {
        teacherId: body.teacherId,
        academicClassId: body.academicClassId,
        schoolLevelId: body.schoolLevelId,
      },
    );
  }

  /**
   * PUT /pedagogy/monthly-plans/:id
   *    body: { content?, activityType?, activityNumber?, sequenceNumber? }
   *    Édite une cellule individuelle (marquée isCustom=true après édition).
   */
  @Put(':id')
  async updateCell(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() body: {
      content?: string;
      activityType?: string | null;
      activityNumber?: number | null;
      sequenceNumber?: number | null;
    },
  ) {
    return this.monthlyPlanService.updateCell(id, tenantId, body);
  }

  /**
   * ⭐ POST /pedagogy/monthly-plans/submit?academicYearId=Y&classLevel=CM2&month=Octobre&teacherId=T
   *    body: { teacherSignature }
   *    Soumet la planification mensuelle au directeur (workflow DRAFT → SUBMITTED).
   *    La signature du titulaire est capturée à ce moment.
   */
  @Post('submit')
  async submitPlan(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('classLevel') classLevel: string,
    @Query('month') month: string,
    @Query('teacherId') teacherId: string,
    @Body() body: { teacherSignature: string },
  ) {
    if (!academicYearId || !classLevel || !month || !teacherId) {
      throw new BadRequestException('academicYearId, classLevel, month, teacherId requis (query params)');
    }
    if (!body.teacherSignature) {
      throw new BadRequestException('teacherSignature requise (body)');
    }
    return this.monthlyPlanService.submitMonthlyPlan(
      tenantId, academicYearId, classLevel, month, teacherId, body.teacherSignature
    );
  }

  /**
   * ⭐ POST /pedagogy/monthly-plans/validate?academicYearId=Y&classLevel=CM2&month=Octobre&teacherId=T
   *    body: { action: 'VALIDATE' | 'REJECT', directorSignature?, directorObservation? }
   *    Valide ou rejette la planification mensuelle (côté directeur).
   */
  @Post('validate')
  async validatePlan(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('classLevel') classLevel: string,
    @Query('month') month: string,
    @Query('teacherId') teacherId: string,
    @Body() body: { action: 'VALIDATE' | 'REJECT'; directorSignature?: string; directorObservation?: string },
  ) {
    if (!academicYearId || !classLevel || !month || !teacherId) {
      throw new BadRequestException('academicYearId, classLevel, month, teacherId requis (query params)');
    }
    if (!body.action || !['VALIDATE', 'REJECT'].includes(body.action)) {
      throw new BadRequestException('action requis (VALIDATE ou REJECT)');
    }
    return this.monthlyPlanService.validateMonthlyPlan(
      tenantId, academicYearId, classLevel, month, teacherId, body
    );
  }

  /**
   * ⭐ GET /pedagogy/monthly-plans/pending?academicYearId=Y
   *    Liste les planifications mensuelles en attente de validation (côté directeur).
   */
  @Get('pending')
  async getPendingPlans(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) {
      throw new BadRequestException('academicYearId requis');
    }
    return this.monthlyPlanService.getPendingMonthlyPlans(tenantId, academicYearId);
  }
}

import { Controller, Get, Post, Body, Param, Query, UseGuards, Patch, Delete, NotFoundException } from '@nestjs/common';
import { EvaluationsService } from './services/evaluations.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { AcademicYearId } from '../../common/decorators/academic-year-id.decorator';
import { UserId } from '../../auth/decorators/user-id.decorator';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { PrismaService } from '../../database/prisma.service';

import { PermissionsGuard } from '../../auth/guards/permissions.guard';

/**
 * ============================================================================
 * EVALUATIONS CONTROLLER - MODULE 3
 * ============================================================================
 *
 * CRUD complet + cycle de vie des évaluations.
 *
 * Endpoints :
 *   GET    /                                   — liste filtrée
 *   GET    /:id                                — détail d'une évaluation
 *   POST   /                                   — créer une évaluation
 *   PATCH  /:id                                — mettre à jour
 *   DELETE /:id                                — supprimer (ou soft-cancel si notes)
 *   POST   /:id/open                           — ouvrir pour saisie (PLANNED → OPEN_FOR_GRADING)
 *   PATCH  /:id/submit                         — soumettre pour validation
 *   PATCH  /:id/validate                       — valider (admin/directeur)
 *   POST   /:id/cancel                         — annuler (any → CANCELLED)
 * ============================================================================
 */
@Controller('institutional-exams/evaluations')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class EvaluationsController {
  constructor(
    private readonly evaluationsService: EvaluationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Permissions('exams.read')
  async findAll(
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @Query() filters: any,
  ) {
    return this.evaluationsService.findAll(tenantId, academicYearId, filters);
  }

  @Get(':id')
  @Permissions('exams.read')
  async findOne(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.evaluationsService.findOne(id, tenantId);
  }

  @Post()
  @Permissions('exams.manage')
  async create(
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @UserId() userId: string,
    @Body() data: any,
  ) {
    // Injecter createdBy depuis l'utilisateur connecté
    return this.evaluationsService.create(tenantId, academicYearId, {
      ...data,
      createdBy: userId,
    });
  }

  /**
   * ⭐ Crée plusieurs évaluations en une fois (bulk create).
   * Body : { classIds: string[], subjectIds: string[], ... }
   * Génère une évaluation par combinaison classe × matière.
   * L'enseignant est auto-résolu via TeacherClassAssignment.
   */
  @Post('bulk')
  @Permissions('exams.manage')
  async createBulk(
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @UserId() userId: string,
    @Body() data: any,
  ) {
    return this.evaluationsService.createBulk(tenantId, academicYearId, {
      ...data,
      createdBy: userId,
    });
  }

  @Patch(':id')
  @Permissions('exams.manage')
  async update(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.evaluationsService.update(id, tenantId, data);
  }

  @Delete(':id')
  @Permissions('exams.manage')
  async remove(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.evaluationsService.remove(id, tenantId);
  }

  @Post(':id/open')
  @Permissions('exams.manage')
  async open(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.evaluationsService.open(id, tenantId);
  }

  @Patch(':id/submit')
  @Permissions('exams.manage')
  async submit(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.evaluationsService.submitForValidation(id, tenantId);
  }

  @Patch(':id/validate')
  @Permissions('exams.validate')
  async validate(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @UserId() userId: string,
  ) {
    return this.evaluationsService.validate(id, tenantId, userId);
  }

  @Post(':id/cancel')
  @Permissions('exams.manage')
  async cancel(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() body: { reason?: string },
  ) {
    return this.evaluationsService.cancel(id, tenantId, body?.reason);
  }

  /**
   * ⭐ Demande de déverrouillage d'une évaluation
   * L'enseignant demande à l'administration de déverrouiller les notes
   * pour pouvoir les modifier après soumission.
   * Persiste la demande dans evaluation_unlock_requests pour suivi.
   */
  @Post(':id/unlock-request')
  @Permissions('exams.manage')
  async unlockRequest(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @UserId() userId: string,
    @Body() body: { reason: string },
  ) {
    if (!body.reason || body.reason.trim().length < 10) {
      throw new NotFoundException('reason requis (min 10 caractères)');
    }

    // Récupérer l'évaluation pour les détails
    const evaluation = await this.evaluationsService.findOne(id, tenantId);
    if (!evaluation) throw new NotFoundException('Évaluation non trouvée');

    // Vérifier qu'il n'y a pas déjà une demande PENDING
    const existing = await this.prisma.$queryRawUnsafe(`
      SELECT id FROM evaluation_unlock_requests
      WHERE "evaluationId" = $1 AND "tenantId" = $2 AND status = 'PENDING'
      LIMIT 1
    `, id, tenantId);
    if (Array.isArray(existing) && existing.length > 0) {
      return {
        success: false,
        message: 'Une demande de déverrouillage est déjà en attente pour cette évaluation',
        existingRequestId: existing[0].id,
      };
    }

    // Persister la demande
    const created = await this.prisma.$queryRawUnsafe(`
      INSERT INTO evaluation_unlock_requests (
        id, "tenantId", "evaluationId", "requestedById",
        "classId", "subjectId", "periodId", "schoolLevelId",
        reason, status, "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7,
        $8, 'PENDING', NOW(), NOW()
      ) RETURNING id
    `,
      tenantId,
      id,
      userId,
      (evaluation as any).classId,
      (evaluation as any).subjectId,
      (evaluation as any).periodId,
      (evaluation as any).schoolLevelId || null,
      body.reason.trim(),
    );

    return {
      success: true,
      message: 'Demande de déverrouillage envoyée à l\'administration',
      evaluationId: id,
      requestId: Array.isArray(created) && created.length > 0 ? created[0].id : null,
      reason: body.reason,
    };
  }
}

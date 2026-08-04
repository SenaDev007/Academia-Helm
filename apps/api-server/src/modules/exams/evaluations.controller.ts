import { Controller, Get, Post, Body, Param, Query, UseGuards, Patch, Delete, NotFoundException, BadRequestException } from '@nestjs/common';
import { EvaluationsService } from './services/evaluations.service';
import { PrismaService } from '../../database/prisma.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { AcademicYearId } from '../../common/decorators/academic-year-id.decorator';
import { UserId } from '../../auth/decorators/user-id.decorator';
import { Permissions } from '../../auth/decorators/permissions.decorator';

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
   * ⭐ Demande de déverrouillage d'une évaluation (GRANULAIRE)
   * L'enseignant demande à déverrouiller des notes pour des élèves ET matières spécifiques.
   * Seuls les élèves + matières sélectionnés seront déverrouillés.
   */
  @Post(':id/unlock-request')
  @Permissions('exams.manage')
  async unlockRequest(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @UserId() userId: string,
    @Body() body: { reason: string; studentIds?: string[]; subjectIds?: string[]; studentNames?: string; subjectNames?: string },
  ) {
    if (!body?.reason || body.reason.trim().length < 10) {
      throw new BadRequestException('La raison doit contenir au moins 10 caractères');
    }

    // Récupérer l'évaluation
    const evaluation = await this.evaluationsService.findOne(id, tenantId);
    if (!evaluation) throw new NotFoundException('Évaluation non trouvée');

    // Vérifier qu'il n'y a pas déjà une demande PENDING pour cette évaluation
    // ✅ Si une demande existe déjà, on retourne success (pas d'erreur)
    // — l'enseignant ne doit pas voir une erreur s'il reclique
    const existing = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM "exam_unlock_requests"
       WHERE "evaluationId" = $1 AND "tenantId" = $2 AND "status" = 'PENDING'
       LIMIT 1`,
      id, tenantId,
    ).catch(() => []);
    if (existing && existing.length > 0) {
      return {
        success: true,
        message: 'Une demande de déverrouillage est déjà en cours pour cette évaluation',
        requestId: existing[0].id,
        evaluationId: id,
        alreadyPending: true,
      };
    }

    // Persister la demande avec studentIds + subjectIds
    const requestId = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "exam_unlock_requests"
       ("id", "tenantId", "evaluationId", "requestedById", "reason", "status",
        "studentIds", "subjectIds", "studentNames", "subjectNames", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, $7, $8, $9, NOW(), NOW())`,
      requestId, tenantId, id, userId, body.reason.trim(),
      body.studentIds || [],
      body.subjectIds || [],
      body.studentNames || null,
      body.subjectNames || null,
    );

    return {
      success: true,
      message: 'Demande de déverrouillage envoyée à l\'administration',
      requestId,
      evaluationId: id,
      reason: body.reason,
      studentIds: body.studentIds || [],
      subjectIds: body.subjectIds || [],
    };
  }

  // ⚠️ Les routes GET unlock-requests, PATCH unlock-requests/:id/approve, reject
  // ont été déplacées vers UnlockRequestsController (contrôleur séparé) pour
  // éviter qu'elles soient interceptées par @Get(':id') et @Patch(':id').
  // Voir unlock-requests.controller.ts
}

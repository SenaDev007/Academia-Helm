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
   * ⭐ Demande de déverrouillage d'une évaluation
   * L'enseignant demande à l'administration de déverrouiller les notes
   * pour pouvoir les modifier après soumission.
   * Persiste la demande dans exam_unlock_requests.
   */
  @Post(':id/unlock-request')
  @Permissions('exams.manage')
  async unlockRequest(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @UserId() userId: string,
    @Body() body: { reason: string },
  ) {
    if (!body?.reason || body.reason.trim().length < 10) {
      throw new BadRequestException('La raison doit contenir au moins 10 caractères');
    }

    // Récupérer l'évaluation
    const evaluation = await this.evaluationsService.findOne(id, tenantId);
    if (!evaluation) throw new NotFoundException('Évaluation non trouvée');

    // Vérifier qu'il n'y a pas déjà une demande PENDING pour cette évaluation
    const existing = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM "exam_unlock_requests"
       WHERE "evaluationId" = $1 AND "tenantId" = $2 AND "status" = 'PENDING'
       LIMIT 1`,
      id, tenantId,
    ).catch(() => []);
    if (existing && existing.length > 0) {
      throw new BadRequestException('Une demande de déverrouillage est déjà en cours pour cette évaluation');
    }

    // Persister la demande
    const requestId = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "exam_unlock_requests" ("id", "tenantId", "evaluationId", "requestedById", "reason", "status", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 'PENDING', NOW(), NOW())`,
      requestId, tenantId, id, userId, body.reason.trim(),
    );

    return {
      success: true,
      message: 'Demande de déverrouillage envoyée à l\'administration',
      requestId,
      evaluationId: id,
      reason: body.reason,
    };
  }

  /**
   * ⭐ Liste des demandes de déverrouillage (pour la direction)
   * GET /institutional-exams/evaluations/unlock-requests?status=PENDING
   */
  @Get('unlock-requests')
  @Permissions('exams.read')
  async getUnlockRequests(
    @TenantId() tenantId: string,
    @Query('status') status?: string,
  ) {
    const statusFilter = status || 'PENDING';
    const params = [tenantId];
    let statusClause = '';
    if (statusFilter !== 'ALL') {
      statusClause = 'AND r."status" = $2';
      params.push(statusFilter);
    }

    const requests = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT r."id", r."evaluationId", r."reason", r."status", r."createdAt",
              r."reviewedAt", r."reviewComment",
              u."firstName" as "requesterFirstName", u."lastName" as "requesterLastName",
              ru."firstName" as "reviewerFirstName", ru."lastName" as "reviewerLastName",
              et."name" as "evaluationTypeName",
              c."name" as "className",
              subj."name" as "subjectName"
       FROM "exam_unlock_requests" r
       LEFT JOIN "users" u ON u."id" = r."requestedById"
       LEFT JOIN "users" ru ON ru."id" = r."reviewedById"
       LEFT JOIN "evaluations" e ON e."id" = r."evaluationId"
       LEFT JOIN "evaluation_types" et ON et."id" = e."evaluationTypeId"
       LEFT JOIN "classes" c ON c."id" = e."classId"
       LEFT JOIN "subjects" subj ON subj."id" = e."subjectId"
       WHERE r."tenantId" = $1 ${statusClause}
       ORDER BY r."createdAt" DESC`,
      ...params,
    ).catch(() => []);

    return requests;
  }

  /**
   * ⭐ Approuver une demande de déverrouillage
   * PATCH /institutional-exams/evaluations/unlock-requests/:id/approve
   */
  @Patch('unlock-requests/:id/approve')
  @Permissions('exams.manage')
  async approveUnlockRequest(
    @Param('id') requestId: string,
    @TenantId() tenantId: string,
    @UserId() userId: string,
    @Body() body: { reviewComment?: string },
  ) {
    // Vérifier que la demande existe et est PENDING
    const requests = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "exam_unlock_requests"
       WHERE "id" = $1 AND "tenantId" = $2 AND "status" = 'PENDING'
       LIMIT 1`,
      requestId, tenantId,
    ).catch(() => []);

    if (!requests || requests.length === 0) {
      throw new NotFoundException('Demande non trouvée ou déjà traitée');
    }

    const request = requests[0];

    // Marquer comme APPROVED
    await this.prisma.$executeRawUnsafe(
      `UPDATE "exam_unlock_requests"
       SET "status" = 'APPROVED', "reviewedById" = $1, "reviewComment" = $2,
           "reviewedAt" = NOW(), "updatedAt" = NOW()
       WHERE "id" = $3`,
      userId, body?.reviewComment || null, requestId,
    );

    // Déverrouiller l'évaluation : remettre le statut à OPEN_FOR_GRADING
    await this.prisma.$executeRawUnsafe(
      `UPDATE "evaluations"
       SET "status" = 'OPEN_FOR_GRADING', "updatedAt" = NOW()
       WHERE "id" = $1`,
      request.evaluationId,
    ).catch(() => {});

    return {
      success: true,
      message: 'Demande approuvée. L\'enseignant peut maintenant modifier les notes.',
      requestId,
      evaluationId: request.evaluationId,
    };
  }

  /**
   * ⭐ Rejeter une demande de déverrouillage
   * PATCH /institutional-exams/evaluations/unlock-requests/:id/reject
   */
  @Patch('unlock-requests/:id/reject')
  @Permissions('exams.manage')
  async rejectUnlockRequest(
    @Param('id') requestId: string,
    @TenantId() tenantId: string,
    @UserId() userId: string,
    @Body() body: { reviewComment?: string },
  ) {
    const requests = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "exam_unlock_requests"
       WHERE "id" = $1 AND "tenantId" = $2 AND "status" = 'PENDING'
       LIMIT 1`,
      requestId, tenantId,
    ).catch(() => []);

    if (!requests || requests.length === 0) {
      throw new NotFoundException('Demande non trouvée ou déjà traitée');
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE "exam_unlock_requests"
       SET "status" = 'REJECTED', "reviewedById" = $1, "reviewComment" = $2,
           "reviewedAt" = NOW(), "updatedAt" = NOW()
       WHERE "id" = $3`,
      userId, body?.reviewComment || null, requestId,
    );

    return {
      success: true,
      message: 'Demande rejetée.',
      requestId,
    };
  }
}

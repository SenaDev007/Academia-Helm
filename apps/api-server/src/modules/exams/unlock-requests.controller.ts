/**
 * ============================================================================
 * UNLOCK REQUESTS CONTROLLER — Routes dédiées pour les demandes de déverrouillage
 * ============================================================================
 *
 * ⚠️ Ce contrôleur est SÉPARÉ de EvaluationsController pour éviter que
 * les routes 'unlock-requests' soient interceptées par @Get(':id') et
 * @Patch(':id') du EvaluationsController (NestJS route matching order).
 *
 * Endpoints :
 *   GET   /institutional-exams/unlock-requests          — Liste des demandes
 *   PATCH /institutional-exams/unlock-requests/:id/approve — Approuver
 *   PATCH /institutional-exams/unlock-requests/:id/reject  — Rejeter
 * ============================================================================
 */

import {
  Controller, Get, Patch, Param, Query, Body, UseGuards, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { UserId } from '../../auth/decorators/user-id.decorator';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';

@Controller('institutional-exams/unlock-requests')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class UnlockRequestsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /institutional-exams/unlock-requests?status=PENDING
   */
  @Get()
  @Permissions('exams.read')
  async getUnlockRequests(
    @TenantId() tenantId: string,
    @Query('status') status?: string,
  ) {
    const statusFilter = status || 'PENDING';
    const params: any[] = [tenantId];
    let statusClause = '';
    if (statusFilter !== 'ALL') {
      statusClause = 'AND r."status" = $2';
      params.push(statusFilter);
    }

    const requests = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT r."id", r."evaluationId", r."reason", r."status", r."createdAt",
              r."reviewedAt", r."reviewComment",
              r."studentIds", r."subjectIds", r."studentNames", r."subjectNames",
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
   * PATCH /institutional-exams/unlock-requests/:id/approve
   */
  @Patch(':id/approve')
  @Permissions('exams.manage')
  async approveUnlockRequest(
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

    const request = requests[0];

    await this.prisma.$executeRawUnsafe(
      `UPDATE "exam_unlock_requests"
       SET "status" = 'APPROVED', "reviewedById" = $1, "reviewComment" = $2,
           "reviewedAt" = NOW(), "updatedAt" = NOW()
       WHERE "id" = $3`,
      userId, body?.reviewComment || null, requestId,
    );

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
   * PATCH /institutional-exams/unlock-requests/:id/reject
   */
  @Patch(':id/reject')
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

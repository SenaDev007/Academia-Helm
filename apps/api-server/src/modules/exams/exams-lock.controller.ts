/**
 * ============================================================================
 * EXAMS LOCK CONTROLLER — Phase 5 (Onglet 10)
 * ============================================================================
 *
 * Verrouillage manuel par scope (classe / matière / période / global)
 * + déverrouillage tracé (audit) + export conformité.
 *
 * Base path: /exams/locks
 * ============================================================================
 */

import {
  Controller, Get, Post, Delete, Body, Param, Query,
  UseGuards, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';

@Controller('exams/locks')
@UseGuards(JwtAuthGuard)
export class ExamsLockController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liste tous les verrous actifs pour un tenant.
   */
  @Get()
  async listLocks(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('periodId') periodId?: string,
    @Query('classId') classId?: string,
  ) {
    const params: any[] = [tenantId];
    let filters = `WHERE "tenantId" = $1`;
    if (academicYearId) { params.push(academicYearId); filters += ` AND "academicYearId" = $${params.length}`; }
    if (periodId) { params.push(periodId); filters += ` AND "periodId" = $${params.length}`; }
    if (classId) { params.push(classId); filters += ` AND "classId" = $${params.length}`; }

    const result: any = await this.prisma.$queryRawUnsafe(
      `SELECT gl.*, u."firstName" AS "lockedByFirstName", u."lastName" AS "lockedByLastName"
       FROM "grade_locks" gl
       LEFT JOIN "users" u ON u.id = gl."lockedById"
       ${filters}
       ORDER BY gl."createdAt" DESC`,
      ...params,
    );
    return result.map((r: any) => ({
      ...r,
      lockedByName: r.lockedByFirstName
        ? `${r.lockedByFirstName} ${r.lockedByLastName}`
        : null,
    }));
  }

  /**
   * Crée un verrou manuel (class period / subject class / period global / evaluation).
   */
  @Post()
  async createLock(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: {
      academicYearId: string;
      periodId: string;
      classId: string;
      subjectId?: string;
      lockType: 'PERIOD_FINAL' | 'EVALUATION_FINAL' | 'CLASS_PERIOD' | 'SUBJECT_CLASS';
      reason: string;
    },
  ) {
    if (!data.lockType) throw new BadRequestException('lockType requis');
    if (!data.reason) throw new BadRequestException('reason requis (audit)');

    const id = crypto.randomUUID();
    try {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "grade_locks"
         ("id", "tenantId", "academicYearId", "periodId", "classId", "subjectId",
          "lockType", "lockedById", "reason", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        id, tenantId, data.academicYearId, data.periodId, data.classId,
        data.subjectId || null, data.lockType, user.id, data.reason,
      );
    } catch (err: any) {
      if (err.message.includes('unique')) {
        throw new BadRequestException('Un verrou existe déjà pour ce scope');
      }
      throw err;
    }

    // Audit log
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "academic_audit_logs"
       ("id", "tenantId", "academicYearId", "entityType", "entityId", "action",
        "newValue", "performedById", "createdAt")
       VALUES ($1, $2, $3, 'GRADE_LOCK', $4, 'LOCK_CREATED',
               $5::jsonb, $6, NOW())`,
      crypto.randomUUID(), tenantId, data.academicYearId, id,
      JSON.stringify({ lockType: data.lockType, reason: data.reason, classId: data.classId, subjectId: data.subjectId }),
      user.id,
    );

    return { id, ...data, lockedById: user.id };
  }

  /**
   * ⭐ Déverrouillage exceptionnel — TRACÉ dans academic_audit_logs.
   * Nécessite une raison obligatoire.
   */
  @Delete(':id')
  async releaseLock(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    if (!body.reason) throw new BadRequestException('reason requis pour déverrouillage (audit)');

    const lock: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "grade_locks" WHERE id = $1 AND "tenantId" = $2`,
      id, tenantId,
    );
    if (!lock || lock.length === 0) throw new NotFoundException('Verrou non trouvé');
    const lockData = lock[0];

    // Audit log BEFORE delete (capture oldValue)
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "academic_audit_logs"
       ("id", "tenantId", "academicYearId", "entityType", "entityId", "action",
        "oldValue", "newValue", "performedById", "createdAt")
       VALUES ($1, $2, $3, 'GRADE_LOCK', $4, 'LOCK_RELEASED',
               $5::jsonb, $6::jsonb, $7, NOW())`,
      crypto.randomUUID(), tenantId, lockData.academicYearId, id,
      JSON.stringify(lockData),
      JSON.stringify({ reason: body.reason, releasedBy: user.id }),
      user.id,
    );

    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "grade_locks" WHERE id = $1 AND "tenantId" = $2`,
      id, tenantId,
    );

    return { released: true, id, reason: body.reason };
  }

  /**
   * Historique des verrouillages/déverrouillages (audit).
   */
  @Get('audit')
  async getLockAudit(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    const params: any[] = [tenantId, 'GRADE_LOCK'];
    let yearFilter = '';
    if (academicYearId) {
      params.push(academicYearId);
      yearFilter = `AND "academicYearId" = $${params.length}`;
    }
    const result: any = await this.prisma.$queryRawUnsafe(
      `SELECT aal.*, u."firstName" AS "performedByFirstName", u."lastName" AS "performedByLastName"
       FROM "academic_audit_logs" aal
       LEFT JOIN "users" u ON u.id = aal."performedById"
       WHERE aal."tenantId" = $1 AND aal."entityType" = $2 ${yearFilter}
       ORDER BY aal."createdAt" DESC LIMIT 100`,
      ...params,
    );
    return result.map((r: any) => ({
      ...r,
      performedByName: r.performedByFirstName
        ? `${r.performedByFirstName} ${r.performedByLastName}`
        : null,
    }));
  }
}

/**
 * ============================================================================
 * CONDUCT CONTROLLER — Module Discipline (Compteur de conduite)
 * ============================================================================
 *
 * Endpoints :
 *   GET    /api/discipline/conduct/rules         — Liste des règles de fautes
 *   POST   /api/discipline/conduct/rules         — Créer une règle
 *   GET    /api/discipline/conduct/sanctions     — Liste des sanctions
 *   POST   /api/discipline/conduct/sanctions     — Saisir une sanction (SG only)
 *   DELETE /api/discipline/conduct/sanctions/:id — Annuler une sanction (SG only)
 *   GET    /api/discipline/conduct/ledger        — Compteur de conduite par élève
 *   GET    /api/discipline/conduct/settings      — Configuration conduite
 *   PUT    /api/discipline/conduct/settings      — Modifier configuration
 * ============================================================================
 */

import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Logger, BadRequestException,
} from '@nestjs/common';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../database/prisma.service';
import * as crypto from 'crypto';

@Controller('discipline/conduct')
export class ConductController {
  private readonly logger = new Logger(ConductController.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── RULES ──────────────────────────────────────────────────────────────

  @Get('rules')
  async listRules(
    @TenantId() tenantId: string,
    @Query('academicYearId') _academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
  ) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM discipline_rules WHERE "tenantId" = $1 AND "isActive" = true
       ${schoolLevelId ? 'AND ("schoolLevelId" = $2 OR "schoolLevelId" IS NULL)' : ''}
       ORDER BY severity, name`,
      schoolLevelId ? [tenantId, schoolLevelId] : [tenantId],
    );
    return rows;
  }

  @Post('rules')
  async createRule(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: {
      name: string;
      description?: string;
      hours_penalty?: number;
      points_deducted?: number;
      severity?: string;
      schoolLevelId?: string;
    },
  ) {
    if (!body.name?.trim()) throw new BadRequestException('Le nom de la faute est requis');
    const id = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO discipline_rules (id, "tenantId", name, description, hours_penalty, points_deducted, severity, "schoolLevelId", "isActive")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)`,
      id, tenantId, body.name, body.description || null,
      body.hours_penalty || 0, body.points_deducted || 0,
      body.severity || 'MINOR', body.schoolLevelId || null,
    );
    this.logger.log(`Rule created: ${body.name} by user ${user?.id}`);
    return { id, success: true };
  }

  // ── SANCTIONS ──────────────────────────────────────────────────────────

  @Get('sanctions')
  async listSanctions(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('studentId') studentId?: string,
  ) {
    if (!academicYearId) return [];
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT s.*, st."lastName" || ' ' || st."firstName" as "studentName",
              c.name as "className"
       FROM sanctions s
       LEFT JOIN students st ON st.id = s."studentId"
       LEFT JOIN classes c ON c.id = (
         SELECT se."classId" FROM student_enrollments se
         WHERE se."studentId" = s."studentId" AND se."academicYearId" = s."academicYearId"
         LIMIT 1
       )
       WHERE s."tenantId" = $1 AND s."academicYearId" = $2
       ${schoolLevelId ? 'AND (s."schoolLevelId" = $3 OR s."schoolLevelId" IS NULL)' : ''}
       ${studentId ? `AND s."studentId" = ${studentId ? '$4' : 'NULL'}` : ''}
       ORDER BY s.sanction_date DESC, s."createdAt" DESC`,
      schoolLevelId && studentId ? [tenantId, academicYearId, schoolLevelId, studentId] :
      schoolLevelId ? [tenantId, academicYearId, schoolLevelId] :
      studentId ? [tenantId, academicYearId, studentId] :
      [tenantId, academicYearId],
    );
    return rows.map(r => ({
      ...r,
      studentName: r.studentName || '—',
      className: r.className || '—',
    }));
  }

  @Post('sanctions')
  async createSanction(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: {
      studentId: string;
      ruleId?: string;
      faultName: string;
      hoursAttributed: number;
      pointsDeducted: number;
      academicYearId: string;
      schoolLevelId?: string;
      quarterId?: string;
      comment?: string;
    },
  ) {
    if (!body.studentId || !body.academicYearId || !body.faultName?.trim()) {
      throw new BadRequestException('studentId, academicYearId et faultName sont requis');
    }

    const id = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO sanctions (id, "tenantId", "academicYearId", "studentId", "ruleId",
        "schoolLevelId", "quarterId", fault_name, hours_attributed, points_deducted,
        sanction_date, "supervisorId", comment, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), $11, $12, 'ACTIVE')`,
      id, tenantId, body.academicYearId, body.studentId,
      body.ruleId || null, body.schoolLevelId || null, body.quarterId || null,
      body.faultName, body.hoursAttributed || 0, body.pointsDeducted || 0,
      user?.id || '00000000-0000-0000-0000-000000000000', body.comment || null,
    );

    // Mettre à jour le conduct_ledger
    await this.updateConductLedger(tenantId, body.academicYearId, body.studentId, body.quarterId, body.pointsDeducted || 0);

    this.logger.log(`Sanction created: ${body.faultName} (-${body.pointsDeducted}pts) for student ${body.studentId} by ${user?.id}`);
    return { id, success: true };
  }

  @Delete('sanctions/:id')
  async cancelSanction(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') sanctionId: string,
    @Body() body: { reason: string },
  ) {
    if (!body.reason?.trim()) {
      throw new BadRequestException('La justification d\'annulation est obligatoire');
    }

    // Récupérer la sanction pour ajuster le ledger
    const sanction = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM sanctions WHERE id = $1 AND "tenantId" = $2 AND status = 'ACTIVE'`,
      [sanctionId, tenantId],
    );
    if (sanction.length === 0) throw new BadRequestException('Sanction introuvable ou déjà annulée');

    await this.prisma.$executeRawUnsafe(
      `UPDATE sanctions SET status = 'CANCELLED', cancelled_by = $3, cancelled_reason = $4, cancelled_at = now(), "updatedAt" = now()
       WHERE id = $1 AND "tenantId" = $2`,
      [sanctionId, tenantId, user?.id || '00000000-0000-0000-0000-000000000000', body.reason],
    );

    // Ajuster le ledger (rembourser les points)
    const s = sanction[0];
    if (s.quarterId) {
      await this.updateConductLedger(tenantId, s.academicYearId, s.studentId, s.quarterId, -(s.points_deducted || 0));
    }

    this.logger.log(`Sanction cancelled: ${sanctionId} by ${user?.id}, reason: ${body.reason}`);
    return { success: true };
  }

  // ── CONDUCT LEDGER ─────────────────────────────────────────────────────

  @Get('ledger')
  async listConductLedger(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('schoolLevelId') _schoolLevelId?: string,
  ) {
    if (!academicYearId) return [];
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT cl.*, st."lastName" || ' ' || st."firstName" as "studentName",
              c.name as "className"
       FROM conduct_ledger cl
       LEFT JOIN students st ON st.id = cl."studentId"
       LEFT JOIN classes c ON c.id = (
         SELECT se."classId" FROM student_enrollments se
         WHERE se."studentId" = cl."studentId" AND se."academicYearId" = cl."academicYearId"
         LIMIT 1
       )
       WHERE cl."tenantId" = $1 AND cl."academicYearId" = $2
       ORDER BY cl.conduct_final ASC`,
      [tenantId, academicYearId],
    );
    return rows.map(r => ({
      ...r,
      studentName: r.studentName || '—',
      className: r.className || '—',
    }));
  }

  // ── SETTINGS ───────────────────────────────────────────────────────────

  @Get('settings')
  async getSettings(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) return { conduct_reference: 20, critical_threshold: 5 };
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM conduct_settings WHERE "tenantId" = $1 AND "academicYearId" = $2 LIMIT 1`,
      [tenantId, academicYearId],
    );
    return rows[0] || { conduct_reference: 20, critical_threshold: 5 };
  }

  @Put('settings')
  async updateSettings(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: {
      academicYearId: string;
      schoolLevelId?: string;
      conduct_reference?: number;
      critical_threshold?: number;
    },
  ) {
    if (!body.academicYearId) throw new BadRequestException('academicYearId est requis');
    const id = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO conduct_settings (id, "tenantId", "academicYearId", "schoolLevelId", conduct_reference, critical_threshold)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ("tenantId", "academicYearId", "schoolLevelId")
       DO UPDATE SET conduct_reference = $5, critical_threshold = $6, "updatedAt" = now()`,
      id, tenantId, body.academicYearId, body.schoolLevelId || null,
      body.conduct_reference || 20, body.critical_threshold || 5,
    );
    this.logger.log(`Conduct settings updated by ${user?.id}`);
    return { success: true };
  }

  // ── HELPER : Mettre à jour le conduct_ledger ───────────────────────────

  private async updateConductLedger(
    tenantId: string,
    academicYearId: string,
    studentId: string,
    quarterId: string | undefined,
    pointsDelta: number,
  ) {
    if (!quarterId) {
      // Si pas de trimestre, on prend le trimestre courant
      const quarter = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT id FROM quarters WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "isCurrent" = true LIMIT 1`,
        [tenantId, academicYearId],
      );
      if (quarter.length === 0) return; // Pas de trimestre, on ne met pas à jour le ledger
      quarterId = quarter[0].id;
    }

    // Upsert le ledger
    const id = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO conduct_ledger (id, "tenantId", "academicYearId", "studentId", "quarterId",
        conduct_reference, total_points_deducted, conduct_final)
       VALUES ($1, $2, $3, $4, $5, 20, $6, GREATEST(0, 20 - $6))
       ON CONFLICT ("tenantId", "studentId", "quarterId")
       DO UPDATE SET
         total_points_deducted = conduct_ledger.total_points_deducted + $6,
         conduct_final = GREATEST(0, conduct_ledger.conduct_reference - (conduct_ledger.total_points_deducted + $6)),
         calculated_at = now(), "updatedAt" = now()`,
      id, tenantId, academicYearId, studentId, quarterId, pointsDelta,
    );
  }
}

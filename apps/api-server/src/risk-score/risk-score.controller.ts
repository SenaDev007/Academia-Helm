/**
 * ============================================================================
 * RISK SCORE CONTROLLER
 * ============================================================================
 *
 * Endpoints :
 *   GET  /risk-score/students              — Liste des scores par élève
 *   GET  /risk-score/students/:id          — Détail du score d'un élève
 *   GET  /risk-score/dashboard             — Statistiques agrégées
 *   GET  /risk-score/settings              — Configuration du tenant
 *   PUT  /risk-score/settings              — Modifier la configuration
 *   POST /risk-score/recalculate           — Recalculer pour tout le tenant
 * ============================================================================
 */

import {
  Controller, Get, Post, Put, Body, Param, Query, Logger, BadRequestException,
} from '@nestjs/common';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../database/prisma.service';
import { RiskScoreCalculatorService } from './risk-score-calculator.service';

@Controller('risk-score')
export class RiskScoreController {
  private readonly logger = new Logger(RiskScoreController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: RiskScoreCalculatorService,
  ) {}

  /**
   * GET /risk-score/students
   * Liste les scores de risque pour un tenant + trimestre.
   * Filtres : quarterId (requis), riskLevel, classId, dropoutOnly.
   */
  @Get('students')
  async listStudentScores(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('quarterId') quarterId: string,
    @Query('riskLevel') riskLevel?: string,
    @Query('classId') classId?: string,
    @Query('dropoutOnly') dropoutOnly?: string,
    @Query('limit') limit?: string,
  ) {
    if (!academicYearId || !quarterId) {
      throw new BadRequestException('academicYearId et quarterId sont requis');
    }

    const maxLimit = Math.min(parseInt(limit || '500', 10), 1000);
    const params: any[] = [tenantId, academicYearId, quarterId];
    let extraWhere = '';

    if (riskLevel) {
      params.push(riskLevel);
      extraWhere += ` AND srs."riskLevel" = $${params.length}`;
    }
    if (classId) {
      params.push(classId);
      extraWhere += ` AND se."classId" = $${params.length}`;
    }
    if (dropoutOnly === 'true') {
      extraWhere += ` AND srs."dropoutRiskFlag" = true`;
    }

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT srs.*,
              st."firstName" || ' ' || st."lastName" as "studentName",
              st."matricule" as "studentMatricule",
              c.name as "className",
              c.id as "classId"
       FROM student_risk_scores srs
       JOIN students st ON st.id = srs."studentId"
       LEFT JOIN student_enrollments se ON se."studentId" = srs."studentId"
         AND se."academicYearId" = srs."academicYearId"
       LEFT JOIN classes c ON c.id = se."classId"
       WHERE srs."tenantId" = $1 AND srs."academicYearId" = $2 AND srs."quarterId" = $3
       ${extraWhere}
       ORDER BY srs."totalScore" DESC
       LIMIT ${maxLimit}`,
      params,
    );

    return rows.map(r => ({
      ...r,
      studentName: r.studentName || '—',
      studentMatricule: r.studentMatricule || '—',
      className: r.className || '—',
    }));
  }

  /**
   * GET /risk-score/students/:id
   * Détail du score d'un élève (avec sourceData pour audit).
   */
  @Get('students/:id')
  async getStudentScore(
    @TenantId() tenantId: string,
    @Param('id') studentId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('quarterId') quarterId: string,
  ) {
    if (!academicYearId || !quarterId) {
      throw new BadRequestException('academicYearId et quarterId sont requis');
    }

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT srs.*, 
              st."firstName" || ' ' || st."lastName" as "studentName",
              st."matricule" as "studentMatricule",
              c.name as "className"
       FROM student_risk_scores srs
       JOIN students st ON st.id = srs."studentId"
       LEFT JOIN student_enrollments se ON se."studentId" = srs."studentId"
         AND se."academicYearId" = srs."academicYearId"
       LEFT JOIN classes c ON c.id = se."classId"
       WHERE srs."tenantId" = $1 AND srs."studentId" = $2 
         AND srs."academicYearId" = $3 AND srs."quarterId" = $4
       LIMIT 1`,
      [tenantId, studentId, academicYearId, quarterId],
    );

    if (rows.length === 0) {
      // Pas de score en cache → calculer à la volée
      const result = await this.calculator.calculateForStudent(
        tenantId, studentId, academicYearId, quarterId,
      );
      if (!result) {
        return { found: false, message: 'Risk score module disabled or no data available' };
      }
      return {
        found: true,
        cached: false,
        ...result,
        studentId,
      };
    }

    return {
      found: true,
      cached: true,
      ...rows[0],
    };
  }

  /**
   * GET /risk-score/dashboard
   * Statistiques agrégées pour le tableau de bord Directeur.
   */
  @Get('dashboard')
  async getDashboard(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('quarterId') quarterId: string,
  ) {
    if (!academicYearId || !quarterId) {
      throw new BadRequestException('academicYearId et quarterId sont requis');
    }

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT 
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE "riskLevel" = 'LOW') as low,
         COUNT(*) FILTER (WHERE "riskLevel" = 'MODERATE') as moderate,
         COUNT(*) FILTER (WHERE "riskLevel" = 'HIGH') as high,
         COUNT(*) FILTER (WHERE "riskLevel" = 'CRITICAL') as critical,
         COUNT(*) FILTER (WHERE "dropoutRiskFlag" = true) as dropout,
         COALESCE(AVG("totalScore"), 0) as avg_score,
         COALESCE(AVG("conductScore"), 0) as avg_conduct,
         COALESCE(AVG("pedagogyScore"), 0) as avg_pedagogy,
         COALESCE(AVG("attendanceScore"), 0) as avg_attendance
       FROM student_risk_scores
       WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "quarterId" = $3`,
      [tenantId, academicYearId, quarterId],
    );

    const r = rows[0] || {};
    return {
      total: Number(r.total) || 0,
      byLevel: {
        LOW: Number(r.low) || 0,
        MODERATE: Number(r.moderate) || 0,
        HIGH: Number(r.high) || 0,
        CRITICAL: Number(r.critical) || 0,
      },
      dropoutCount: Number(r.dropout) || 0,
      averages: {
        total: Number(r.avg_score) || 0,
        conduct: Number(r.avg_conduct) || 0,
        pedagogy: Number(r.avg_pedagogy) || 0,
        attendance: Number(r.avg_attendance) || 0,
      },
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * GET /risk-score/settings
   * Récupère la configuration du tenant.
   */
  @Get('settings')
  async getSettings(@TenantId() tenantId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM risk_score_settings WHERE "tenantId" = $1 LIMIT 1`,
      [tenantId],
    );
    if (rows.length === 0) {
      // Retourner les valeurs par défaut
      return {
        conductWeight: 40,
        pedagogyWeight: 40,
        attendanceWeight: 20,
        lowThreshold: 20,
        moderateThreshold: 40,
        highThreshold: 70,
        dropoutScoreDeltaThreshold: 10,
        dropoutAbsenceRateThreshold: 0.15,
        dropoutConductDropThreshold: 5,
        pedagogyReferenceAverage: 10,
        isEnabled: true,
      };
    }
    return rows[0];
  }

  /**
   * PUT /risk-score/settings
   * Modifie la configuration (Directeur only).
   */
  @Put('settings')
  async updateSettings(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: {
      conductWeight?: number;
      pedagogyWeight?: number;
      attendanceWeight?: number;
      lowThreshold?: number;
      moderateThreshold?: number;
      highThreshold?: number;
      dropoutScoreDeltaThreshold?: number;
      dropoutAbsenceRateThreshold?: number;
      dropoutConductDropThreshold?: number;
      pedagogyReferenceAverage?: number;
      isEnabled?: boolean;
    },
  ) {
    // Validation : les poids doivent sommer à 100
    const cw = body.conductWeight ?? 40;
    const pw = body.pedagogyWeight ?? 40;
    const aw = body.attendanceWeight ?? 20;
    if (cw + pw + aw !== 100) {
      throw new BadRequestException(
        `Les pondérations doivent sommer à 100 (actuel: ${cw + pw + aw})`,
      );
    }

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO risk_score_settings 
        ("tenantId", "conductWeight", "pedagogyWeight", "attendanceWeight",
         "lowThreshold", "moderateThreshold", "highThreshold",
         "dropoutScoreDeltaThreshold", "dropoutAbsenceRateThreshold", "dropoutConductDropThreshold",
         "pedagogyReferenceAverage", "isEnabled", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), now())
       ON CONFLICT ("tenantId")
       DO UPDATE SET
         "conductWeight" = $2,
         "pedagogyWeight" = $3,
         "attendanceWeight" = $4,
         "lowThreshold" = $5,
         "moderateThreshold" = $6,
         "highThreshold" = $7,
         "dropoutScoreDeltaThreshold" = $8,
         "dropoutAbsenceRateThreshold" = $9,
         "dropoutConductDropThreshold" = $10,
         "pedagogyReferenceAverage" = $11,
         "isEnabled" = $12,
         "updatedAt" = now()`,
      tenantId,
      cw, pw, aw,
      body.lowThreshold ?? 20,
      body.moderateThreshold ?? 40,
      body.highThreshold ?? 70,
      body.dropoutScoreDeltaThreshold ?? 10,
      body.dropoutAbsenceRateThreshold ?? 0.15,
      body.dropoutConductDropThreshold ?? 5,
      body.pedagogyReferenceAverage ?? 10,
      body.isEnabled ?? true,
    );

    this.logger.log(`Risk score settings updated by ${user?.id} for tenant ${tenantId}`);
    return { success: true };
  }

  /**
   * POST /risk-score/recalculate
   * Recalcule les scores pour TOUS les élèves du tenant + trimestre.
   * (Directeur only — opération lourde)
   */
  @Post('recalculate')
  async recalculate(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { academicYearId: string; quarterId: string },
  ) {
    if (!body.academicYearId || !body.quarterId) {
      throw new BadRequestException('academicYearId et quarterId sont requis');
    }

    this.logger.log(
      `Risk score recalculation requested by ${user?.id} for tenant ${tenantId}, quarter ${body.quarterId}`,
    );

    const result = await this.calculator.calculateForAllStudents(
      tenantId,
      body.academicYearId,
      body.quarterId,
    );

    return {
      success: true,
      ...result,
      message: `${result.calculated} élève(s) recalculé(s), ${result.errors} erreur(s)`,
    };
  }
}

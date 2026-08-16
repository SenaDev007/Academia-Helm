/**
 * ============================================================================
 * DROPOUT INDICATOR CONTROLLER
 * ============================================================================
 *
 * Endpoints dédiés au suivi du décrochage scolaire :
 *   GET  /risk-score/dropout/students    — Liste des élèves en décrochage
 *   GET  /risk-score/dropout/stats       — Statistiques agrégées
 *   GET  /risk-score/dropout/trends      — Tendance inter-trimestres
 *
 * Un élève est flagué "décrochage" si :
 *   - Score total en dégradation > seuil (défaut 10pts) vs trimestre précédent
 *   - OU taux d'absence > seuil (défaut 15%)
 *   - OU chute de conduite > seuil (défaut 5pts)
 *
 * Les seuils sont configurables par école (risk_score_settings).
 * ============================================================================
 */

import {
  Controller, Get, Query, Logger, BadRequestException,
} from '@nestjs/common';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { PrismaService } from '../database/prisma.service';

@Controller('risk-score/dropout')
export class DropoutIndicatorController {
  private readonly logger = new Logger(DropoutIndicatorController.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /risk-score/dropout/students
   * Liste les élèves en décrochage (dropoutRiskFlag = true) avec détails.
   */
  @Get('students')
  async listDropoutStudents(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('quarterId') quarterId: string,
    @Query('classId') classId?: string,
    @Query('minScoreDelta') minScoreDelta?: string,
  ) {
    if (!academicYearId || !quarterId) {
      throw new BadRequestException('academicYearId et quarterId sont requis');
    }

    const params: any[] = [tenantId, academicYearId, quarterId];
    let extraWhere = '';

    if (classId) {
      params.push(classId);
      extraWhere += ` AND se."classId" = $${params.length}`;
    }
    if (minScoreDelta) {
      const delta = parseFloat(minScoreDelta);
      if (!isNaN(delta)) {
        params.push(delta);
        extraWhere += ` AND (srs."scoreDelta" IS NOT NULL AND srs."scoreDelta" < -$${params.length})`;
      }
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
         AND srs."dropoutRiskFlag" = true
       ${extraWhere}
       ORDER BY 
         CASE WHEN srs."scoreDelta" IS NOT NULL THEN srs."scoreDelta" ELSE 0 END ASC,
         srs."totalScore" DESC`,
      params,
    );

    return rows.map(r => ({
      ...r,
      studentName: r.studentName || '—',
      studentMatricule: r.studentMatricule || '—',
      className: r.className || '—',
      // Raison(s) du décrochage (dérivée des sourceData)
      dropoutReasons: this.deriveDropoutReasons(r),
    }));
  }

  /**
   * GET /risk-score/dropout/stats
   * Statistiques agrégées sur le décrochage.
   */
  @Get('stats')
  async getDropoutStats(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('quarterId') quarterId: string,
  ) {
    if (!academicYearId || !quarterId) {
      throw new BadRequestException('academicYearId et quarterId sont requis');
    }

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT 
         COUNT(*) as total_students,
         COUNT(*) FILTER (WHERE "dropoutRiskFlag" = true) as dropout_count,
         COUNT(*) FILTER (WHERE "dropoutRiskFlag" = true AND "riskLevel" = 'HIGH') as dropout_high,
         COUNT(*) FILTER (WHERE "dropoutRiskFlag" = true AND "riskLevel" = 'CRITICAL') as dropout_critical,
         COALESCE(AVG("scoreDelta") FILTER (WHERE "dropoutRiskFlag" = true), 0) as avg_score_delta,
         COALESCE(MIN("scoreDelta") FILTER (WHERE "dropoutRiskFlag" = true), 0) as worst_score_delta
       FROM student_risk_scores
       WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "quarterId" = $3`,
      [tenantId, academicYearId, quarterId],
    );

    const r = rows[0] || {};
    const total = Number(r.total_students) || 0;
    const dropoutCount = Number(r.dropout_count) || 0;

    return {
      totalStudents: total,
      dropoutCount,
      dropoutRate: total > 0 ? (dropoutCount / total) * 100 : 0,
      bySeverity: {
        HIGH: Number(r.dropout_high) || 0,
        CRITICAL: Number(r.dropout_critical) || 0,
      },
      avgScoreDelta: Number(r.avg_score_delta) || 0,
      worstScoreDelta: Number(r.worst_score_delta) || 0,
    };
  }

  /**
   * GET /risk-score/dropout/trends
   * Tendance du décrochage sur les trimestres de l'année.
   */
  @Get('trends')
  async getDropoutTrends(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) {
      throw new BadRequestException('academicYearId est requis');
    }

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT 
         q.id as "quarterId",
         q.name as "quarterName",
         q.number as "quarterNumber",
         COUNT(srs.id) as total_students,
         COUNT(srs.id) FILTER (WHERE srs."dropoutRiskFlag" = true) as dropout_count,
         COALESCE(AVG(srs."totalScore"), 0) as avg_score,
         COALESCE(AVG(srs."conductScore"), 0) as avg_conduct,
         COALESCE(AVG(srs."pedagogyScore"), 0) as avg_pedagogy,
         COALESCE(AVG(srs."attendanceScore"), 0) as avg_attendance
       FROM quarters q
       LEFT JOIN student_risk_scores srs ON srs."quarterId" = q.id
         AND srs."tenantId" = $1
         AND srs."academicYearId" = $2
       WHERE q."tenantId" = $1 AND q."academicYearId" = $2
       GROUP BY q.id, q.name, q.number, q."startDate"
       ORDER BY q."startDate" ASC`,
      [tenantId, academicYearId],
    );

    return rows.map(r => ({
      quarterId: r.quarterId,
      quarterName: r.quarterName,
      quarterNumber: r.quarterNumber,
      totalStudents: Number(r.total_students) || 0,
      dropoutCount: Number(r.dropout_count) || 0,
      dropoutRate: Number(r.total_students) > 0
        ? (Number(r.dropout_count) / Number(r.total_students)) * 100
        : 0,
      averages: {
        total: Number(r.avg_score) || 0,
        conduct: Number(r.avg_conduct) || 0,
        pedagogy: Number(r.avg_pedagogy) || 0,
        attendance: Number(r.avg_attendance) || 0,
      },
    }));
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────

  private deriveDropoutReasons(score: any): string[] {
    const reasons: string[] = [];
    const sourceData = typeof score.sourceData === 'string'
      ? JSON.parse(score.sourceData || '{}')
      : score.sourceData || {};

    // Raison 1 : dégradation du score
    if (score.scoreDelta !== null && score.scoreDelta !== undefined && score.scoreDelta < -5) {
      reasons.push(`Score en baisse de ${Math.abs(score.scoreDelta).toFixed(1)} pts vs trimestre précédent`);
    }

    // Raison 2 : taux d'absence élevé
    const attendance = sourceData.attendance;
    if (attendance && attendance.absenceRate > 0.15) {
      reasons.push(`Taux d'absence élevé : ${(attendance.absenceRate * 100).toFixed(0)}% (${attendance.absent} jours)`);
    }

    // Raison 3 : chute de conduite
    const conduct = sourceData.conduct;
    if (conduct && (conduct.reference - conduct.final) >= 5) {
      reasons.push(`Conduite en chute : ${conduct.final}/${conduct.reference} (-${conduct.reference - conduct.final} pts)`);
    }

    // Raison 4 : moyenne pédagogique faible
    const pedagogy = sourceData.pedagogy;
    if (pedagogy && pedagogy.generalAverage < 8) {
      reasons.push(`Moyenne pédagogique faible : ${pedagogy.generalAverage.toFixed(1)}/20`);
    }

    return reasons;
  }
}

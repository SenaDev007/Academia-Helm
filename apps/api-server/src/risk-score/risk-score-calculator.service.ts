/**
 * ============================================================================
 * RISK SCORE CALCULATOR SERVICE
 * ============================================================================
 *
 * Calcule le score de risque d'un élève en croisant 3 signaux :
 *   1. Conduite (conduct_ledger) — 40 pts
 *   2. Pédagogie (StudentPeriodAverage) — 40 pts
 *   3. Assiduité (AttendanceRecord) — 20 pts
 *
 * Formule :
 *   conductScore    = 40 × (1 - conduct_final / conduct_reference) + bonus severity
 *   pedagogyScore   = 40 × max(0, (reference - generalAverage) / reference)
 *   attendanceScore = 12×absenceRate + 5×lateRate + 3×unexcusedRate
 *   totalScore      = conductScore + pedagogyScore + attendanceScore (0-100)
 *
 * Catégories : LOW (0-19) / MODERATE (20-39) / HIGH (40-69) / CRITICAL (70+)
 *
 * Dropout flag : true si dégradation vs trimestre précédent > seuil
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface RiskScoreSourceData {
  conduct?: {
    reference: number;
    deducted: number;
    final: number;
    sanctionCount: number;
    criticalCount: number;
  };
  pedagogy?: {
    generalAverage: number;
    classAverage?: number;
    rank?: number;
    classSize?: number;
  };
  attendance?: {
    totalDays: number;
    absent: number;
    late: number;
    excused: number;
    absenceRate: number;
    lateRate: number;
    unexcusedRate: number;
  };
}

export interface RiskScoreResult {
  conductScore: number;
  pedagogyScore: number;
  attendanceScore: number;
  totalScore: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  dropoutRiskFlag: boolean;
  sourceData: RiskScoreSourceData;
  previousQuarterScore?: number;
  scoreDelta?: number;
}

export interface RiskScoreSettings {
  conductWeight: number;
  pedagogyWeight: number;
  attendanceWeight: number;
  lowThreshold: number;
  moderateThreshold: number;
  highThreshold: number;
  dropoutScoreDeltaThreshold: number;
  dropoutAbsenceRateThreshold: number;
  dropoutConductDropThreshold: number;
  pedagogyReferenceAverage: number;
  isEnabled: boolean;
}

@Injectable()
export class RiskScoreCalculatorService {
  private readonly logger = new Logger(RiskScoreCalculatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calcule le score de risque pour un élève + trimestre donné.
   */
  async calculateForStudent(
    tenantId: string,
    studentId: string,
    academicYearId: string,
    quarterId: string,
  ): Promise<RiskScoreResult | null> {
    // 1. Charger les settings du tenant
    const settings = await this.getSettings(tenantId);
    if (!settings.isEnabled) {
      return null;
    }

    // 2. Charger les 3 sources de données en parallèle
    const [conductData, pedagogyData, attendanceData] = await Promise.all([
      this.loadConductData(tenantId, studentId, quarterId),
      this.loadPedagogyData(tenantId, studentId, academicYearId, quarterId),
      this.loadAttendanceData(tenantId, studentId, academicYearId, quarterId),
    ]);

    const sourceData: RiskScoreSourceData = {
      conduct: conductData,
      pedagogy: pedagogyData,
      attendance: attendanceData,
    };

    // 3. Calculer les 3 sous-scores (normalisés sur 100 puis pondérés)
    const conductScoreRaw = this.calculateConductScore(conductData, settings);
    const pedagogyScoreRaw = this.calculatePedagogyScore(pedagogyData, settings);
    const attendanceScoreRaw = this.calculateAttendanceScore(attendanceData, settings);

    // Pondération selon les settings (par défaut 40/40/20)
    const totalWeight = settings.conductWeight + settings.pedagogyWeight + settings.attendanceWeight;
    const conductScore = totalWeight > 0 ? (conductScoreRaw * settings.conductWeight / 100) : 0;
    const pedagogyScore = totalWeight > 0 ? (pedagogyScoreRaw * settings.pedagogyWeight / 100) : 0;
    const attendanceScore = totalWeight > 0 ? (attendanceScoreRaw * settings.attendanceWeight / 100) : 0;

    const totalScore = Math.round((conductScore + pedagogyScore + attendanceScore) * 10) / 10;

    // 4. Catégorisation
    const riskLevel = this.categorize(totalScore, settings);

    // 5. Comparaison vs trimestre précédent (pour dropout flag)
    const previousScore = await this.loadPreviousQuarterScore(tenantId, studentId, academicYearId, quarterId);
    const scoreDelta = previousScore != null ? Math.round((totalScore - previousScore) * 10) / 10 : undefined;

    // 6. Dropout flag : dégradation significative
    const dropoutRiskFlag = this.computeDropoutFlag({
      scoreDelta,
      attendanceData,
      conductData,
      settings,
    });

    return {
      conductScore: Math.round(conductScore * 10) / 10,
      pedagogyScore: Math.round(pedagogyScore * 10) / 10,
      attendanceScore: Math.round(attendanceScore * 10) / 10,
      totalScore,
      riskLevel,
      dropoutRiskFlag,
      sourceData,
      previousQuarterScore: previousScore,
      scoreDelta,
    };
  }

  /**
   * Calcule les scores pour TOUS les élèves d'un tenant + trimestre.
   * Utilisé par le cron quotidien ou l'endpoint /recalculate.
   */
  async calculateForAllStudents(
    tenantId: string,
    academicYearId: string,
    quarterId: string,
  ): Promise<{ calculated: number; errors: number }> {
    // Récupérer tous les élèves actifs du tenant pour cette année
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { tenantId, academicYearId, status: 'ACTIVE' },
      select: { studentId: true },
      distinct: ['studentId'],
    });

    let calculated = 0;
    let errors = 0;

    for (const enrollment of enrollments) {
      try {
        const result = await this.calculateForStudent(
          tenantId,
          enrollment.studentId,
          academicYearId,
          quarterId,
        );
        if (result) {
          await this.persistScore(tenantId, enrollment.studentId, academicYearId, quarterId, result);
          calculated++;
        }
      } catch (err: any) {
        errors++;
        this.logger.error(
          `calculateForAllStudents: failed for student ${enrollment.studentId}: ${err.message}`,
        );
      }
    }

    this.logger.log(
      `Risk scores calculated for tenant ${tenantId}, quarter ${quarterId}: ${calculated} OK, ${errors} errors`,
    );
    return { calculated, errors };
  }

  // ─── SOUS-SCORES ──────────────────────────────────────────────────────

  /**
   * Score conduite (0-100).
   * - 100 × (1 - conduct_final / conduct_reference) si conduct_final < conduct_reference
   * - 0 si conduct_final >= conduct_reference (aucun point déduit)
   * - Bonus +10 si sanctions CRITICAL récentes
   */
  private calculateConductScore(
    data: RiskScoreSourceData['conduct'] | undefined,
    settings: RiskScoreSettings,
  ): number {
    if (!data) return 0; // Pas de données → pas de risque détecté

    const reference = data.reference || 20;
    const final = data.final ?? reference;

    // Ratio de points déduits
    const deductionRatio = reference > 0 ? Math.max(0, 1 - final / reference) : 0;
    let score = deductionRatio * 100;

    // Bonus si sanctions critiques
    if (data.criticalCount > 0) {
      score = Math.min(100, score + 10);
    }

    return Math.round(score * 10) / 10;
  }

  /**
   * Score pédagogie (0-100).
   * - 100 × max(0, (reference - generalAverage) / reference) si generalAverage < reference
   * - 0 si generalAverage >= reference
   * - Bonus +10 si rank < 75% de la classe (en difficulté relative)
   */
  private calculatePedagogyScore(
    data: RiskScoreSourceData['pedagogy'] | undefined,
    settings: RiskScoreSettings,
  ): number {
    if (!data) return 0;

    const reference = settings.pedagogyReferenceAverage || 10;
    const avg = data.generalAverage ?? reference;

    // Ratio d'écart par rapport à la référence
    const deficitRatio = reference > 0 ? Math.max(0, (reference - avg) / reference) : 0;
    let score = deficitRatio * 100;

    // Bonus si l'élève est dans le dernier quartile de sa classe
    if (data.rank && data.classSize && data.classSize > 0) {
      const rankRatio = data.rank / data.classSize;
      if (rankRatio > 0.75) {
        score = Math.min(100, score + 10);
      }
    }

    return Math.round(score * 10) / 10;
  }

  /**
   * Score assiduité (0-100).
   * - 60% × tauxAbsence (non justifiée)
   * - 25% × tauxRetard
   * - 15% × tauxNonExcusé (absences sans justification)
   * Plancher à 100 si tauxAbsence > 30%.
   */
  private calculateAttendanceScore(
    data: RiskScoreSourceData['attendance'] | undefined,
    settings: RiskScoreSettings,
  ): number {
    if (!data || data.totalDays === 0) return 0;

    const absenceRate = data.absenceRate || 0;
    const lateRate = data.lateRate || 0;
    const unexcusedRate = data.unexcusedRate || 0;

    let score = (absenceRate * 60) + (lateRate * 25) + (unexcusedRate * 15);
    score = Math.min(100, score * 100);

    // Plancher 100 si plus de 30% d'absences
    if (absenceRate > 0.30) {
      score = 100;
    }

    return Math.round(score * 10) / 10;
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────

  private categorize(score: number, settings: RiskScoreSettings): 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' {
    if (score >= settings.highThreshold) return 'CRITICAL';
    if (score >= settings.moderateThreshold) return 'HIGH';
    if (score >= settings.lowThreshold) return 'MODERATE';
    return 'LOW';
  }

  private computeDropoutFlag(params: {
    scoreDelta?: number;
    attendanceData?: RiskScoreSourceData['attendance'];
    conductData?: RiskScoreSourceData['conduct'];
    settings: RiskScoreSettings;
  }): boolean {
    const { scoreDelta, attendanceData, conductData, settings } = params;

    // Dégradation significative du score vs N-1
    if (scoreDelta !== undefined && scoreDelta < -settings.dropoutScoreDeltaThreshold) {
      return true;
    }

    // Taux d'absence élevé
    if (attendanceData && attendanceData.absenceRate > settings.dropoutAbsenceRateThreshold) {
      return true;
    }

    // Chute de conduite (si on a les données — comparer avec référence)
    if (conductData) {
      const conductDrop = conductData.reference - conductData.final;
      if (conductDrop >= settings.dropoutConductDropThreshold) {
        return true;
      }
    }

    return false;
  }

  private async getSettings(tenantId: string): Promise<RiskScoreSettings> {
    const raw = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM risk_score_settings WHERE "tenantId" = $1 LIMIT 1`,
      [tenantId],
    );
    const row = raw[0];
    if (!row) {
      // Valeurs par défaut
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
    return {
      conductWeight: row.conductWeight ?? 40,
      pedagogyWeight: row.pedagogyWeight ?? 40,
      attendanceWeight: row.attendanceWeight ?? 20,
      lowThreshold: row.lowThreshold ?? 20,
      moderateThreshold: row.moderateThreshold ?? 40,
      highThreshold: row.highThreshold ?? 70,
      dropoutScoreDeltaThreshold: row.dropoutScoreDeltaThreshold ?? 10,
      dropoutAbsenceRateThreshold: row.dropoutAbsenceRateThreshold ?? 0.15,
      dropoutConductDropThreshold: row.dropoutConductDropThreshold ?? 5,
      pedagogyReferenceAverage: row.pedagogyReferenceAverage ?? 10,
      isEnabled: row.isEnabled ?? true,
    };
  }

  private async loadConductData(
    tenantId: string,
    studentId: string,
    quarterId: string,
  ): Promise<RiskScoreSourceData['conduct'] | undefined> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT cl.*, 
              (SELECT COUNT(*) FROM sanctions s 
               WHERE s."studentId" = cl."studentId" 
                 AND s."quarterId" = cl."quarterId"
                 AND s."tenantId" = cl."tenantId"
                 AND s.status = 'ACTIVE') as sanction_count,
              (SELECT COUNT(*) FROM sanctions s 
               JOIN discipline_rules dr ON dr.id = s."ruleId"
               WHERE s."studentId" = cl."studentId" 
                 AND s."quarterId" = cl."quarterId"
                 AND s."tenantId" = cl."tenantId"
                 AND s.status = 'ACTIVE'
                 AND dr.severity = 'CRITICAL') as critical_count
       FROM conduct_ledger cl
       WHERE cl."tenantId" = $1 AND cl."studentId" = $2 AND cl."quarterId" = $3
       LIMIT 1`,
      [tenantId, studentId, quarterId],
    );
    if (rows.length === 0) return undefined;
    const r = rows[0];
    return {
      reference: Number(r.conduct_reference) || 20,
      deducted: Number(r.total_points_deducted) || 0,
      final: (Number(r.conduct_final) ?? Number(r.conduct_reference)) || 20,
      sanctionCount: Number(r.sanction_count) || 0,
      criticalCount: Number(r.critical_count) || 0,
    };
  }

  private async loadPedagogyData(
    tenantId: string,
    studentId: string,
    academicYearId: string,
    quarterId: string,
  ): Promise<RiskScoreSourceData['pedagogy'] | undefined> {
    const avg = await this.prisma.studentPeriodAverage.findFirst({
      where: {
        tenantId,
        studentId,
        academicYearId,
        periodId: quarterId,
      },
      select: {
        generalAverage: true,
        classRank: true,
        classId: true,
      },
    });
    if (!avg) return undefined;

    // Récupérer la taille de la classe + moyenne de classe
    const classStats = await this.prisma.studentPeriodAverage.aggregate({
      where: {
        tenantId,
        academicYearId,
        periodId: quarterId,
        classId: avg.classId,
      },
      _avg: { generalAverage: true },
      _count: { id: true },
    });

    return {
      generalAverage: avg.generalAverage,
      classAverage: classStats._avg.generalAverage ?? undefined,
      rank: avg.classRank || undefined,
      classSize: classStats._count.id || undefined,
    };
  }

  private async loadAttendanceData(
    tenantId: string,
    studentId: string,
    academicYearId: string,
    quarterId: string,
  ): Promise<RiskScoreSourceData['attendance'] | undefined> {
    // Récupérer les dates du trimestre
    const quarter = await this.prisma.quarter.findFirst({
      where: { id: quarterId, tenantId },
      select: { startDate: true, endDate: true },
    });
    if (!quarter) return undefined;

    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        tenantId,
        studentId,
        academicYearId,
        date: {
          gte: quarter.startDate,
          lte: quarter.endDate,
        },
      },
      select: { status: true },
    });

    if (records.length === 0) return undefined;

    const totalDays = records.length;
    const absent = records.filter(r => r.status === 'ABSENT').length;
    const late = records.filter(r => r.status === 'LATE').length;
    const excused = records.filter(r => r.status === 'EXCUSED').length;
    const unexcused = absent; // Pour l'instant, toutes les absences sont non justifiées
                             // (TODO: ajouter champ isJustified sur AttendanceRecord)

    return {
      totalDays,
      absent,
      late,
      excused,
      absenceRate: totalDays > 0 ? (absent + unexcused) / totalDays : 0,
      lateRate: totalDays > 0 ? late / totalDays : 0,
      unexcusedRate: totalDays > 0 ? unexcused / totalDays : 0,
    };
  }

  private async loadPreviousQuarterScore(
    tenantId: string,
    studentId: string,
    academicYearId: string,
    currentQuarterId: string,
  ): Promise<number | null> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT srs."totalScore"
       FROM student_risk_scores srs
       JOIN quarters q ON q.id = srs."quarterId"
       WHERE srs."tenantId" = $1 
         AND srs."studentId" = $2
         AND srs."academicYearId" = $3
         AND srs."quarterId" != $4
         AND q."startDate" < (SELECT "startDate" FROM quarters WHERE id = $4)
       ORDER BY q."startDate" DESC
       LIMIT 1`,
      [tenantId, studentId, academicYearId, currentQuarterId],
    );
    return rows.length > 0 ? Number(rows[0].totalScore) : null;
  }

  /**
   * Persiste le score calculé en DB (upsert).
   */
  async persistScore(
    tenantId: string,
    studentId: string,
    academicYearId: string,
    quarterId: string,
    result: RiskScoreResult,
  ): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO student_risk_scores 
        ("tenantId", "academicYearId", "quarterId", "studentId",
         "conductScore", "pedagogyScore", "attendanceScore", "totalScore",
         "riskLevel", "dropoutRiskFlag", "sourceData",
         "previousQuarterScore", "scoreDelta", "calculatedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, now(), now(), now())
       ON CONFLICT ("tenantId", "studentId", "quarterId")
       DO UPDATE SET
         "conductScore" = $5,
         "pedagogyScore" = $6,
         "attendanceScore" = $7,
         "totalScore" = $8,
         "riskLevel" = $9,
         "dropoutRiskFlag" = $10,
         "sourceData" = $11::jsonb,
         "previousQuarterScore" = $12,
         "scoreDelta" = $13,
         "calculatedAt" = now(),
         "updatedAt" = now()`,
      tenantId, academicYearId, quarterId, studentId,
      result.conductScore, result.pedagogyScore, result.attendanceScore, result.totalScore,
      result.riskLevel, result.dropoutRiskFlag,
      JSON.stringify(result.sourceData),
      result.previousQuarterScore ?? null,
      result.scoreDelta ?? null,
    );
  }
}

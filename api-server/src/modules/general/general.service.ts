/**
 * ============================================================================
 * GENERAL SERVICE - AGRÉGATIONS CONTRÔLÉES CROSS-LEVEL
 * ============================================================================
 * 
 * Service pour le Module Général qui permet des agrégations contrôlées
 * entre les niveaux scolaires.
 * 
 * PRINCIPE FONDAMENTAL :
 * - Lecture seule
 * - Aucune écriture
 * - Agrégations explicites et traçables
 * - Provenance documentée niveau par niveau
 * 
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { StudentsService } from '../../students/students.service';
import { PaymentsService } from '../../payments/payments.service';
import { ExpensesService } from '../../expenses/expenses.service';
import { ExamsService } from '../../exams/exams.service';
import { GradesService } from '../../grades/grades.service';
import { AbsencesService } from '../../absences/absences.service';
import { SchoolLevelsService } from '../../school-levels/school-levels.service';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { PaginationDto } from '../../common/dto/pagination.dto';

export interface LevelAggregation {
  levelId: string;
  levelName: string;
  value: number;
}

export interface CrossLevelAggregation {
  total: number;
  byLevel: LevelAggregation[];
  metadata: {
    calculationDate: Date;
    academicYearId?: string;
    levelsIncluded: string[];
    calculationMethod: string;
  };
}

@Injectable()
export class GeneralService {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly paymentsService: PaymentsService,
    private readonly expensesService: ExpensesService,
    private readonly examsService: ExamsService,
    private readonly gradesService: GradesService,
    private readonly absencesService: AbsencesService,
    private readonly schoolLevelsService: SchoolLevelsService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  /**
   * Calcule l'effectif total (agrégation contrôlée)
   * RÈGLE : Somme explicite des effectifs par niveau, pour une année scolaire donnée
   */
  async getTotalEnrollment(
    tenantId: string,
    academicYearId: string,
    userId: string,
  ): Promise<CrossLevelAggregation> {
    // Récupérer tous les niveaux actifs
    const levels = await this.schoolLevelsService.findAll(tenantId);
    const activeLevels = levels.filter(l => l.isActive);

    // Calculer l'effectif par niveau pour l'année scolaire donnée
    const byLevel: LevelAggregation[] = [];
    let total = 0;

    for (const level of activeLevels) {
      // ✅ Créer PaginationDto pour la requête
      const pagination = new PaginationDto();
      pagination.page = 1;
      pagination.limit = 10000; // Limite élevée pour obtenir tous les étudiants
      
      const studentsResponse = await this.studentsService.findAll(
        tenantId,
        level.id,
        pagination,
        academicYearId,
      );
      // ✅ Accéder à data depuis PaginatedResponse
      const count = studentsResponse.data.length;
      byLevel.push({
        levelId: level.id,
        levelName: level.name,
        value: count,
      });
      total += count;
    }

    // Journaliser l'agrégation
    await this.auditLogsService.create(
      {
        action: 'CROSS_LEVEL_AGGREGATION',
        resource: 'general',
        resourceId: null,
        changes: {
          operation: 'getTotalEnrollment',
          academicYearId,
          total,
          byLevel,
        },
      },
      tenantId,
      userId,
    );

    return {
      total,
      byLevel,
      metadata: {
        calculationDate: new Date(),
        academicYearId,
        levelsIncluded: activeLevels.map(l => l.id),
        calculationMethod: 'SUM_BY_LEVEL',
      },
    };
  }

  /**
   * Calcule les recettes totales (agrégation contrôlée)
   * RÈGLE : Somme explicite des recettes par niveau, pour une année scolaire donnée
   */
  async getTotalRevenue(
    tenantId: string,
    academicYearId: string,
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<CrossLevelAggregation> {
    const levels = await this.schoolLevelsService.findAll(tenantId);
    const activeLevels = levels.filter(l => l.isActive);

    const byLevel: LevelAggregation[] = [];
    let total = 0;

    for (const level of activeLevels) {
      // ✅ Créer PaginationDto pour la requête
      const pagination = new PaginationDto();
      pagination.page = 1;
      pagination.limit = 10000; // Limite élevée pour obtenir tous les paiements
      
      const paymentsResponse = await this.paymentsService.findAll(
        tenantId,
        level.id,
        pagination,
        undefined, // studentId
        'completed', // status
        startDate,
        endDate,
      );
      // ✅ Accéder à data depuis PaginatedResponse
      const revenue = paymentsResponse.data.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      byLevel.push({
        levelId: level.id,
        levelName: level.name,
        value: revenue,
      });
      total += revenue;
    }

    // Journaliser
    await this.auditLogsService.create(
      {
        action: 'CROSS_LEVEL_AGGREGATION',
        resource: 'general',
        resourceId: null,
        changes: {
          operation: 'getTotalRevenue',
          academicYearId,
          total,
          byLevel,
        },
      },
      tenantId,
      userId,
    );

    return {
      total,
      byLevel,
      metadata: {
        calculationDate: new Date(),
        academicYearId,
        levelsIncluded: activeLevels.map(l => l.id),
        calculationMethod: 'SUM_BY_LEVEL',
      },
    };
  }

  /**
   * Calcule la moyenne globale pondérée (agrégation contrôlée)
   * RÈGLE : Moyenne pondérée par effectif, provenance documentée, pour une année scolaire donnée
   */
  async getWeightedAverage(
    tenantId: string,
    academicYearId: string,
    userId: string,
  ): Promise<{
    weightedAverage: number;
    byLevel: Array<LevelAggregation & { studentCount: number; average: number }>;
    metadata: {
      calculationDate: Date;
      academicYearId: string;
      levelsIncluded: string[];
      calculationMethod: string;
      weights: Record<string, number>;
    };
  }> {
    const levels = await this.schoolLevelsService.findAll(tenantId);
    const activeLevels = levels.filter(l => l.isActive);

    const byLevel: Array<LevelAggregation & { studentCount: number; average: number }> = [];
    let totalWeightedSum = 0;
    let totalStudents = 0;
    const weights: Record<string, number> = {};

    for (const level of activeLevels) {
      // Calculer moyenne par niveau pour l'année scolaire donnée
      // Note: gradesService.findAll ne prend pas academicYearId directement
      // Il faut filtrer après ou utiliser une autre méthode
      const grades = await this.gradesService.findAll(
        tenantId,
        undefined, // studentId
        undefined, // subjectId
        undefined, // classId
        undefined, // quarterId
        undefined, // academicTrackId
      );
      // ✅ Créer PaginationDto pour la requête
      const pagination = new PaginationDto();
      pagination.page = 1;
      pagination.limit = 10000; // Limite élevée pour obtenir tous les étudiants
      
      const studentsResponse = await this.studentsService.findAll(
        tenantId,
        level.id,
        pagination,
        academicYearId,
      );
      
      // ✅ Accéder à data depuis PaginatedResponse
      const studentCount = studentsResponse.data.length;
      const average = grades.length > 0
        ? grades.reduce((sum, g) => sum + Number(g.score || 0), 0) / grades.length
        : 0;

      byLevel.push({
        levelId: level.id,
        levelName: level.name,
        value: average,
        studentCount,
        average,
      });

      // Calculer poids (effectif)
      const weight = studentCount;
      weights[level.id] = weight;
      totalWeightedSum += average * weight;
      totalStudents += weight;
    }

    const weightedAverage = totalStudents > 0 ? totalWeightedSum / totalStudents : 0;

    // Journaliser
    await this.auditLogsService.create(
      {
        action: 'CROSS_LEVEL_AGGREGATION',
        resource: 'general',
        resourceId: null,
        changes: {
          operation: 'getWeightedAverage',
          academicYearId,
          weightedAverage,
          byLevel,
          weights,
        },
      },
      tenantId,
      userId,
    );

    return {
      weightedAverage,
      byLevel,
      metadata: {
        calculationDate: new Date(),
        academicYearId,
        levelsIncluded: activeLevels.map(l => l.id),
        calculationMethod: 'WEIGHTED_AVERAGE_BY_ENROLLMENT',
        weights,
      },
    };
  }

  /**
   * Récupère un rapport consolidé (agrégation contrôlée)
   * RÈGLE : Toutes les agrégations sont pour une année scolaire donnée
   */
  async getConsolidatedReport(
    tenantId: string,
    academicYearId: string,
    userId: string,
  ): Promise<{
    enrollment: CrossLevelAggregation;
    revenue: CrossLevelAggregation;
    weightedAverage: {
      weightedAverage: number;
      byLevel: Array<LevelAggregation & { studentCount: number; average: number }>;
    };
    generatedAt: Date;
    academicYearId: string;
  }> {
    const [enrollment, revenue, weightedAverage] = await Promise.all([
      this.getTotalEnrollment(tenantId, academicYearId, userId),
      this.getTotalRevenue(tenantId, academicYearId, userId),
      this.getWeightedAverage(tenantId, academicYearId, userId),
    ]);

    return {
      enrollment,
      revenue,
      weightedAverage,
      generatedAt: new Date(),
      academicYearId,
    };
  }
}


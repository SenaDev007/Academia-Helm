/**
 * ============================================================================
 * EXAMS DASHBOARD SERVICE - MODULE 3
 * ============================================================================
 * 
 * Service stratégique pour le pilotage des examens, notes et bulletins.
 * Fournit les KPI en temps réel, les taux de complétion et les alertes.
 * 
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class ExamsDashboardService {
  private readonly logger = new Logger(ExamsDashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère les KPI globaux du dashboard Examens
   */
  async getDashboardKpi(tenantId: string, academicYearId: string, schoolLevelId: string) {
    const [
      totalEvaluations,
      pendingValidation,
      missingGradesCount,
      completionRate,
    ] = await Promise.all([
      // 1. Total des évaluations prévues sur la période active
      this.prisma.evaluation.count({
        where: { tenantId, academicYearId, class: { schoolLevelId } },
      }),

      // 2. Évaluations en attente de validation (workflow admin)
      this.prisma.evaluation.count({
        where: { 
          tenantId, 
          academicYearId, 
          class: { schoolLevelId },
          status: 'SUBMITTED',
        },
      }),

      // 3. Nombre d'élèves n'ayant pas encore toutes leurs notes (calcul approximatif)
      // Pour une version plus précise, il faudrait croiser Student x Evaluation
      this.prisma.grade.count({
        where: {
          tenantId,
          academicYearId,
          score: null,
          isAbsent: false,
        },
      }),

      // 4. Taux de complétion global (évaluations validées / total)
      this.calculateGlobalCompletionRate(tenantId, academicYearId, schoolLevelId),
    ]);

    return {
      totalEvaluations,
      pendingValidation,
      missingGradesCount,
      completionRate,
      lastUpdate: new Date(),
    };
  }

  /**
   * Taux de complétion des notes par classe
   */
  async getCompletionByClass(tenantId: string, academicYearId: string, schoolLevelId: string) {
    const classes = await this.prisma.class.findMany({
      where: { tenantId, academicYearId, schoolLevelId },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            classStudents: true,
          },
        },
      },
    });

    const completionStats = await Promise.all(
      classes.map(async (cls) => {
        const evaluations = await this.prisma.evaluation.findMany({
          where: { classId: cls.id, status: 'VALIDATED' },
          select: { id: true },
        });

        const totalExpectedGrades = evaluations.length * cls._count.classStudents;
        const actualGrades = await this.prisma.grade.count({
          where: { classId: cls.id, status: 'VALIDATED' },
        });

        return {
          classId: cls.id,
          className: cls.name,
          completion: totalExpectedGrades > 0 ? (actualGrades / totalExpectedGrades) * 100 : 0,
          totalEvaluations: evaluations.length,
        };
      }),
    );

    return completionStats;
  }

  /**
   * Alertes de retard (évaluations passées mais non saisies/validées)
   */
  async getPendingAlerts(tenantId: string, academicYearId: string, schoolLevelId: string) {
    const today = new Date();
    const delayedEvaluations = await this.prisma.evaluation.findMany({
      where: {
        tenantId,
        academicYearId,
        class: { schoolLevelId },
        evaluationDate: { lt: today },
        status: { in: ['PLANNED', 'OPEN_FOR_GRADING', 'SUBMITTED'] },
      },
      include: {
        class: true,
        evaluationType: true,
      },
      orderBy: { evaluationDate: 'asc' },
      take: 10,
    });

    return delayedEvaluations.map(ev => ({
      id: ev.id,
      title: ev.title,
      className: ev.class.name,
      type: ev.evaluationType.name,
      date: ev.evaluationDate,
      status: ev.status,
      delayDays: Math.floor((today.getTime() - new Date(ev.evaluationDate).getTime()) / (1000 * 60 * 60 * 24)),
    }));
  }

  private async calculateGlobalCompletionRate(tenantId: string, academicYearId: string, schoolLevelId: string) {
    const total = await this.prisma.evaluation.count({
      where: { tenantId, academicYearId, class: { schoolLevelId } },
    });
    if (total === 0) return 100;

    const validated = await this.prisma.evaluation.count({
      where: { tenantId, academicYearId, class: { schoolLevelId }, status: 'VALIDATED' },
    });

    return (validated / total) * 100;
  }

  /**
   * Intégration ORION : Détection d'anomalies pédagogiques
   */
  async getOrionInsights(tenantId: string, academicYearId: string, schoolLevelId: string) {
    const insights = [];

    // 1. Détection des chutes de performance (Mock logic for now, should compare with previous period)
    const lowAveragesCount = await this.prisma.studentPeriodAverage.count({
      where: {
        tenantId,
        academicYearId,
        generalAverage: { lt: 8 },
      },
    });

    if (lowAveragesCount > 0) {
      insights.push({
        type: 'PERFORMANCE_ALERT',
        priority: 'HIGH',
        title: 'Élèves en difficulté',
        content: `${lowAveragesCount} élèves présentent une moyenne générale inférieure à 08/20.`,
      });
    }

    // 2. Détection des retards critiques
    const criticalDelays = await this.prisma.evaluation.count({
      where: {
        tenantId,
        academicYearId,
        status: { in: ['PLANNED', 'OPEN_FOR_GRADING'] },
        evaluationDate: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // > 7 jours
      },
    });

    if (criticalDelays > 0) {
      insights.push({
        type: 'OPERATIONAL_RISK',
        priority: 'MEDIUM',
        title: 'Retards critiques',
        content: `${criticalDelays} évaluations sont en retard de saisie depuis plus d'une semaine.`,
      });
    }

    return insights;
  }
}

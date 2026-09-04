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
import { AcademicSettingsService } from '../../../exams-grades/academic-settings.service';

@Injectable()
export class ExamsDashboardService {
  private readonly logger = new Logger(ExamsDashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly academicSettingsService: AcademicSettingsService,
  ) {}

  /**
   * ⭐ Récupère le seuil de réussite configurable depuis la config académique active.
   * Par défaut 10/20 si aucune config trouvée.
   */
  private async getPassScore(tenantId: string, academicYearId: string): Promise<number> {
    try {
      const settings = await this.academicSettingsService.findActive(tenantId, academicYearId);
      const config = settings.config as any;
      return config?.scoreScale?.passScore ?? 10;
    } catch {
      return 10; // Fallback par défaut
    }
  }

  /**
   * ⭐ Récupère le seuil d'alerte (élève en difficulté).
   * Par défaut < 8/20 si aucune config trouvée.
   */
  private async getAlertThreshold(tenantId: string, academicYearId: string): Promise<number> {
    try {
      const settings = await this.academicSettingsService.findActive(tenantId, academicYearId);
      const config = settings.config as any;
      // Si une règle de promotion définit un seuil, l'utiliser ; sinon fallback 8
      return config?.promotionRules?.rules?.[0]?.condition?.match(/(\d+(?:\.\d+)?)/)?.[1]
        ? Number(RegExp.$1) - 2
        : 8;
    } catch {
      return 8;
    }
  }

  /**
   * ⭐ V10b — Isolation par niveau + piste linguistique.
   * Les sections EN (Nursery/Primary) partagent le schoolLevelId de leur
   * miroir FR : les requêtes doivent donc filtrer AUSSI par langue.
   *   FR : classes FR marquées + classes SANS marqueur (structure FR historique)
   *   EN : classes EN marquées uniquement
   * (règle identique à level-isolation.ts côté frontend)
   */
  private classLanguageOr(language?: string): any[] | undefined {
    if (!language) return undefined;
    const lang = String(language).toUpperCase();
    const conditions: any[] = [
      { academicTrack: { code: lang } },
      { language: lang },
    ];
    if (lang === 'FR') {
      conditions.push({ language: null, academicTrackId: null });
    }
    return conditions;
  }

  /** Filtre `class` combiné : schoolLevelId ET langue (si fournie). */
  private classWhere(schoolLevelId: string, language?: string): any {
    const langOr = this.classLanguageOr(language);
    return langOr ? { schoolLevelId, OR: langOr } : { schoolLevelId };
  }

  /**
   * Récupère les KPI globaux du dashboard Examens
   */
  async getDashboardKpi(tenantId: string, academicYearId: string, schoolLevelId: string, language?: string) {
    // ⭐ V10b — le filtre class intègre la piste linguistique du niveau
    const classFilter = this.classWhere(schoolLevelId, language);
    const [
      totalEvaluations,
      pendingValidation,
      missingGradesCount,
      completionRate,
    ] = await Promise.all([
      // 1. Total des évaluations prévues sur la période active
      this.prisma.evaluation.count({
        where: { tenantId, academicYearId, class: classFilter },
      }),

      // 2. Évaluations en attente de validation (workflow admin)
      this.prisma.evaluation.count({
        where: {
          tenantId,
          academicYearId,
          class: classFilter,
          status: 'SUBMITTED',
        },
      }),

      // 3. Nombre d'élèves n'ayant pas encore toutes leurs notes (calcul approximatif)
      // ⭐ V10b — AVANT : aucune jointure de niveau → mélangeait TOUS les niveaux.
      //    On filtre désormais par classe du niveau + piste sélectionnés.
      this.prisma.grade.count({
        where: {
          tenantId,
          academicYearId,
          score: null,
          isAbsent: false,
          class: classFilter,
        },
      }),

      // 4. Taux de complétion global (évaluations validées / total)
      this.calculateGlobalCompletionRate(tenantId, academicYearId, schoolLevelId, language),
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
  async getCompletionByClass(tenantId: string, academicYearId: string, schoolLevelId: string, language?: string) {
    // ⭐ V10b — isole les classes par piste linguistique
    const classes = await this.prisma.class.findMany({
      where: { tenantId, academicYearId, ...this.classWhere(schoolLevelId, language) },
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
  async getPendingAlerts(tenantId: string, academicYearId: string, schoolLevelId: string, language?: string) {
    const today = new Date();
    const delayedEvaluations = await this.prisma.evaluation.findMany({
      where: {
        tenantId,
        academicYearId,
        // ⭐ V10b — isole les alertes par niveau + piste linguistique
        class: this.classWhere(schoolLevelId, language),
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

  private async calculateGlobalCompletionRate(tenantId: string, academicYearId: string, schoolLevelId: string, language?: string) {
    // ⭐ V10b — piste linguistique appliquée au taux de complétion
    const classFilter = this.classWhere(schoolLevelId, language);
    const total = await this.prisma.evaluation.count({
      where: { tenantId, academicYearId, class: classFilter },
    });
    if (total === 0) return 100;

    const validated = await this.prisma.evaluation.count({
      where: { tenantId, academicYearId, class: classFilter, status: 'VALIDATED' },
    });

    return (validated / total) * 100;
  }

  /**
   * Intégration ORION : Détection d'anomalies pédagogiques
   */
  async getOrionInsights(tenantId: string, academicYearId: string, schoolLevelId: string, language?: string) {
    const insights = [];

    // ⭐ Seuil d'alerte configurable (défaut 8)
    const alertThreshold = await this.getAlertThreshold(tenantId, academicYearId);

    // 1. Détection des chutes de performance (Mock logic for now, should compare with previous period)
    // ⭐ V10b — isole par classe du niveau + piste linguistique
    const lowAveragesCount = await this.prisma.studentPeriodAverage.count({
      where: {
        tenantId,
        academicYearId,
        class: this.classWhere(schoolLevelId, language),
        generalAverage: { lt: alertThreshold },
      },
    });

    if (lowAveragesCount > 0) {
      insights.push({
        type: 'PERFORMANCE_ALERT',
        priority: 'HIGH',
        title: 'Élèves en difficulté',
        content: `${lowAveragesCount} élèves présentent une moyenne générale inférieure à ${alertThreshold.toFixed(1)}/20.`,
      });
    }

    // 2. Détection des retards critiques
    // ⭐ V10b — isole par classe du niveau + piste linguistique
    const criticalDelays = await this.prisma.evaluation.count({
      where: {
        tenantId,
        academicYearId,
        class: this.classWhere(schoolLevelId, language),
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

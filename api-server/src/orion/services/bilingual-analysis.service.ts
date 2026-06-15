/**
 * ============================================================================
 * ORION BILINGUAL ANALYSIS SERVICE
 * ============================================================================
 * 
 * Service pour analyser les performances FR vs EN
 * et générer des alertes pédagogiques, stratégiques et financières.
 * 
 * PRINCIPE :
 * - Lecture seule (ORION ne modifie jamais les données)
 * - Analyses factuelles uniquement
 * - Alertes basées sur des seuils configurables
 * 
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TenantFeaturesService } from '../../tenant-features/tenant-features.service';
import { FeatureCode } from '../../tenant-features/entities/tenant-feature.entity';

export interface BilingualPerformanceComparison {
  frAverage: number;
  enAverage: number;
  gap: number;
  gapPercentage: number;
}

export type AcademicTrackCode = 'FR' | 'EN' | 'BILINGUAL';

export interface TrackStatistics {
  trackCode: AcademicTrackCode;
  totalStudents: number;
  totalExams: number;
  averageScore: number;
  successRate: number;
  classesCount: number;
}

export interface BilingualAlert {
  type: 'PEDAGOGICAL' | 'STRATEGIC' | 'FINANCIAL';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  data: Record<string, any>;
}

@Injectable()
export class BilingualAnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantFeaturesService: TenantFeaturesService,
  ) {}

  /**
   * Vérifie si l'option bilingue est activée
   */
  async isBilingualEnabled(tenantId: string): Promise<boolean> {
    return this.tenantFeaturesService.isFeatureEnabled(FeatureCode.BILINGUAL_TRACK, tenantId);
  }

  /**
   * Compare les moyennes générales FR vs EN
   */
  async compareAverageScores(tenantId: string): Promise<BilingualPerformanceComparison> {
    // Récupérer les moyennes par track
    const frStats = await this.getTrackStatistics(tenantId, AcademicTrackCode.FR);
    const enStats = await this.getTrackStatistics(tenantId, AcademicTrackCode.EN);

    const gap = frStats.averageScore - enStats.averageScore;
    const gapPercentage = frStats.averageScore > 0 
      ? (gap / frStats.averageScore) * 100 
      : 0;

    return {
      frAverage: frStats.averageScore,
      enAverage: enStats.averageScore,
      gap,
      gapPercentage: Math.abs(gapPercentage),
    };
  }

  /**
   * Calcule les statistiques d'un track
   */
  async getTrackStatistics(tenantId: string, trackCode: AcademicTrackCode): Promise<TrackStatistics> {
    // Récupérer le track
    const track = await this.prisma.academicTrack.findFirst({
      where: { tenantId, code: trackCode },
    });

    if (!track) {
      return {
        trackCode,
        totalStudents: 0,
        totalExams: 0,
        averageScore: 0,
        successRate: 0,
        classesCount: 0,
      };
    }

    // Compter les élèves
    const totalStudents = await this.prisma.studentAcademicTrack.count({
      where: { academicTrackId: track.id },
    });

    // Compter les examens
    const totalExams = await this.prisma.exam.count({
      where: { tenantId, academicTrackId: track.id },
    });

    // Calculer la moyenne des notes
    const grades = await this.prisma.grade.findMany({
      where: {
        tenantId,
        exam: { academicTrackId: track.id },
      },
    });

    const averageScore = grades.length > 0
      ? grades.reduce((sum, g) => sum + Number(g.score || 0), 0) / grades.length
      : 0;

    // Taux de réussite (>= 10/20)
    const passingScore = 10;
    const successCount = grades.filter(g => Number(g.score || 0) >= passingScore).length;
    const successRate = grades.length > 0 ? (successCount / grades.length) * 100 : 0;

    // Compter les classes
    const classesCount = await this.prisma.class.count({
      where: { tenantId, academicTrackId: track.id },
    });

    return {
      trackCode,
      totalStudents,
      totalExams,
      averageScore: Math.round(averageScore * 100) / 100,
      successRate: Math.round(successRate * 100) / 100,
      classesCount,
    };
  }

  /**
   * Analyse l'écart de performance par classe
   */
  async analyzePerformanceGapByClass(tenantId: string): Promise<Array<{
    classId: string;
    className: string;
    frAverage: number;
    enAverage: number;
    gap: number;
  }>> {
    const classes = await this.prisma.class.findMany({
      where: { tenantId },
      include: { academicTrack: true },
    });

    const results = [];

    for (const cls of classes) {
      const frTrack = await this.prisma.academicTrack.findFirst({
        where: { tenantId, code: AcademicTrackCode.FR },
        select: { id: true },
      });
      const enTrack = await this.prisma.academicTrack.findFirst({
        where: { tenantId, code: AcademicTrackCode.EN },
        select: { id: true },
      });

      const frGrades = frTrack
        ? await this.prisma.grade.findMany({
            where: {
              exam: {
                classId: cls.id,
                academicTrackId: frTrack.id,
              },
            },
          })
        : [];

      const enGrades = enTrack
        ? await this.prisma.grade.findMany({
            where: {
              exam: {
                classId: cls.id,
                academicTrackId: enTrack.id,
              },
            },
          })
        : [];

      const frAverage = frGrades.length > 0
        ? frGrades.reduce((sum, g) => sum + Number(g.score || 0), 0) / frGrades.length
        : 0;

      const enAverage = enGrades.length > 0
        ? enGrades.reduce((sum, g) => sum + Number(g.score || 0), 0) / enGrades.length
        : 0;

      if (frAverage > 0 || enAverage > 0) {
        results.push({
          classId: cls.id,
          className: cls.name,
          frAverage: Math.round(frAverage * 100) / 100,
          enAverage: Math.round(enAverage * 100) / 100,
          gap: Math.round((frAverage - enAverage) * 100) / 100,
        });
      }
    }

    return results;
  }

  /**
   * Génère les alertes ORION pour le bilinguisme
   */
  async generateBilingualAlerts(tenantId: string): Promise<BilingualAlert[]> {
    const alerts: BilingualAlert[] = [];

    // Vérifier si l'option est activée
    const isEnabled = await this.isBilingualEnabled(tenantId);
    if (!isEnabled) {
      return alerts; // Pas d'alertes si non activé
    }

    // 1. ALERTES PÉDAGOGIQUES
    const comparison = await this.compareAverageScores(tenantId);
    
    // Écart moyen FR / EN > 20%
    if (comparison.gapPercentage > 20) {
      alerts.push({
        type: 'PEDAGOGICAL',
        severity: comparison.gapPercentage > 30 ? 'HIGH' : 'MEDIUM',
        title: 'Écart de performance FR/EN significatif',
        message: `L'écart entre les moyennes FR (${comparison.frAverage.toFixed(2)}) et EN (${comparison.enAverage.toFixed(2)}) est de ${comparison.gapPercentage.toFixed(1)}%`,
        data: { comparison },
      });
    }

    // 2. ALERTES STRATÉGIQUES
    const frStats = await this.getTrackStatistics(tenantId, AcademicTrackCode.FR);
    const enStats = await this.getTrackStatistics(tenantId, AcademicTrackCode.EN);

    // Déséquilibre fort FR vs EN (ratio > 3:1)
    const ratio = frStats.totalStudents > 0 
      ? enStats.totalStudents / frStats.totalStudents 
      : 0;
    
    if (ratio < 0.33 && enStats.totalStudents > 0) {
      alerts.push({
        type: 'STRATEGIC',
        severity: 'MEDIUM',
        title: 'Déséquilibre FR/EN',
        message: `Le track EN représente seulement ${(ratio * 100).toFixed(1)}% des élèves du track FR`,
        data: { frStats, enStats, ratio },
      });
    }

    // Sous-utilisation du track EN
    if (enStats.totalStudents < 5 && isEnabled) {
      alerts.push({
        type: 'STRATEGIC',
        severity: 'LOW',
        title: 'Sous-utilisation du track EN',
        message: `Le track EN compte seulement ${enStats.totalStudents} élève(s) après activation`,
        data: { enStats },
      });
    }

    // 3. ALERTES FINANCIÈRES
    // Vérifier si l'option est activée mais non payée
    // (à implémenter avec le système de paiement)

    return alerts;
  }

  /**
   * Génère un rapport comparatif complet
   */
  async generateComparativeReport(tenantId: string): Promise<{
    comparison: BilingualPerformanceComparison;
    frStats: TrackStatistics;
    enStats: TrackStatistics;
    classGaps: Array<{
      classId: string;
      className: string;
      frAverage: number;
      enAverage: number;
      gap: number;
    }>;
    alerts: BilingualAlert[];
  }> {
    const isEnabled = await this.isBilingualEnabled(tenantId);
    if (!isEnabled) {
      throw new Error('Option bilingue non activée');
    }

    const comparison = await this.compareAverageScores(tenantId);
    const frStats = await this.getTrackStatistics(tenantId, AcademicTrackCode.FR);
    const enStats = await this.getTrackStatistics(tenantId, AcademicTrackCode.EN);
    const classGaps = await this.analyzePerformanceGapByClass(tenantId);
    const alerts = await this.generateBilingualAlerts(tenantId);

    return {
      comparison,
      frStats,
      enStats,
      classGaps,
      alerts,
    };
  }
}


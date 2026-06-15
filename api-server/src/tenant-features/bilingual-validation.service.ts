/**
 * ============================================================================
 * BILINGUAL VALIDATION SERVICE
 * ============================================================================
 * 
 * Service pour valider les dépendances avant désactivation
 * de l'option bilingue
 * 
 * ============================================================================
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class BilingualValidationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Vérifie s'il existe des données EN pour un tenant
   * Retourne true si des données EN existent, false sinon
   */
  async hasEnglishTrackData(tenantId: string): Promise<boolean> {
    // Trouver le track EN
    const enTrack = await this.prisma.academicTrack.findFirst({
      where: {
        tenantId,
        code: 'EN',
      },
    });

    if (!enTrack) {
      return false; // Pas de track EN, donc pas de données EN
    }

    // Vérifier dans chaque table si des données EN existent
    const checks = await Promise.all([
      this.hasEnglishSubjects(tenantId, enTrack.id),
      this.hasEnglishExams(tenantId, enTrack.id),
      this.hasEnglishGrades(tenantId, enTrack.id),
      this.hasEnglishExamScores(tenantId, enTrack.id),
      this.hasEnglishReportCards(tenantId, enTrack.id),
      this.hasEnglishGradeCalculations(tenantId, enTrack.id),
    ]);

    return checks.some(check => check === true);
  }

  /**
   * Vérifie s'il y a des matières EN
   */
  private async hasEnglishSubjects(tenantId: string, enTrackId: string): Promise<boolean> {
    const count = await this.prisma.subject.count({
      where: {
        tenantId,
        academicTrackId: enTrackId,
      },
    });
    return count > 0;
  }

  /**
   * Vérifie s'il y a des examens EN
   */
  private async hasEnglishExams(tenantId: string, enTrackId: string): Promise<boolean> {
    const count = await this.prisma.exam.count({
      where: {
        tenantId,
        academicTrackId: enTrackId,
      },
    });
    return count > 0;
  }

  /**
   * Vérifie s'il y a des notes EN
   */
  private async hasEnglishGrades(tenantId: string, enTrackId: string): Promise<boolean> {
    const count = await this.prisma.grade.count({
      where: {
        tenantId,
        academicTrackId: enTrackId,
      },
    });
    return count > 0;
  }

  /**
   * Vérifie s'il y a des scores d'examen EN
   */
  private async hasEnglishExamScores(tenantId: string, enTrackId: string): Promise<boolean> {
    const count = await this.prisma.examScore.count({
      where: {
        tenantId,
        academicTrackId: enTrackId,
      },
    });
    return count > 0;
  }

  /**
   * Vérifie s'il y a des bulletins EN
   */
  private async hasEnglishReportCards(tenantId: string, enTrackId: string): Promise<boolean> {
    const count = await this.prisma.reportCard.count({
      where: {
        tenantId,
        academicTrackId: enTrackId,
      },
    });
    return count > 0;
  }

  /**
   * Vérifie s'il y a des calculs de moyenne EN
   */
  private async hasEnglishGradeCalculations(tenantId: string, enTrackId: string): Promise<boolean> {
    const count = await this.prisma.gradeCalculation.count({
      where: {
        tenantId,
        academicTrackId: enTrackId,
      },
    });
    return count > 0;
  }

  /**
   * Retourne un résumé détaillé des données EN existantes
   */
  async getEnglishTrackDataSummary(tenantId: string): Promise<{
    hasData: boolean;
    subjects: number;
    exams: number;
    grades: number;
    examScores: number;
    reportCards: number;
    gradeCalculations: number;
  }> {
    const enTrack = await this.prisma.academicTrack.findFirst({
      where: {
        tenantId,
        code: 'EN',
      },
    });

    if (!enTrack) {
      return {
        hasData: false,
        subjects: 0,
        exams: 0,
        grades: 0,
        examScores: 0,
        reportCards: 0,
        gradeCalculations: 0,
      };
    }

    const [subjects, exams, grades, examScores, reportCards, gradeCalculations] = await Promise.all([
      this.prisma.subject.count({
        where: { tenantId, academicTrackId: enTrack.id },
      }),
      this.prisma.exam.count({
        where: { tenantId, academicTrackId: enTrack.id },
      }),
      this.prisma.grade.count({
        where: { tenantId, academicTrackId: enTrack.id },
      }),
      this.prisma.examScore.count({
        where: { tenantId, academicTrackId: enTrack.id },
      }),
      this.prisma.reportCard.count({
        where: { tenantId, academicTrackId: enTrack.id },
      }),
      this.prisma.gradeCalculation.count({
        where: { tenantId, academicTrackId: enTrack.id },
      }),
    ]);

    return {
      hasData: subjects + exams + grades + examScores + reportCards + gradeCalculations > 0,
      subjects,
      exams,
      grades,
      examScores,
      reportCards,
      gradeCalculations,
    };
  }
}


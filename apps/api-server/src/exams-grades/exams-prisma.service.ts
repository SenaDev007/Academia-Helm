/**
 * ============================================================================
 * EXAMS PRISMA SERVICE - MODULE 3
 * ============================================================================
 * 
 * Service pour la gestion des examens
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ExamsPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée un examen
   */
  async createExam(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId: string;
    academicTrackId?: string;
    quarterId?: string;
    classSubjectId?: string;
    subjectId: string;
    classId?: string;
    name: string;
    examType: string; // DEVOIR | COMPOSITION | ORAL | PRATIQUE
    examDate: Date;
    maxScore?: number;
    coefficient?: number;
    description?: string;
  }) {
    // Vérifier que la matière existe
    const subject = await this.prisma.subject.findFirst({
      where: {
        id: data.subjectId,
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        schoolLevelId: data.schoolLevelId,
      },
    });

    if (!subject) {
      throw new NotFoundException(`Subject with ID ${data.subjectId} not found`);
    }

    // Vérifier que la classe existe si fournie
    if (data.classId) {
      const classExists = await this.prisma.class.findFirst({
        where: {
          id: data.classId,
          tenantId: data.tenantId,
          academicYearId: data.academicYearId,
          schoolLevelId: data.schoolLevelId,
        },
      });

      if (!classExists) {
        throw new NotFoundException(`Class with ID ${data.classId} not found`);
      }
    }

    return this.prisma.exam.create({
      data: {
        ...data,
        maxScore: data.maxScore || 20.0,
        coefficient: data.coefficient || 1.0,
      },
      include: {
        subject: true,
        quarter: true,
        classSubject: true,
        academicYear: true,
        schoolLevel: true,
      },
    });
  }

  /**
   * Récupère tous les examens
   */
  async findAllExams(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      schoolLevelId?: string;
      academicTrackId?: string;
      quarterId?: string;
      classId?: string;
      subjectId?: string;
      examType?: string;
      search?: string;
    }
  ) {
    const where: any = {
      tenantId,
    };

    if (filters?.academicYearId) {
      where.academicYearId = filters.academicYearId;
    }

    if (filters?.schoolLevelId && filters.schoolLevelId !== 'ALL') {
      where.schoolLevelId = filters.schoolLevelId;
    }

    if (filters?.academicTrackId !== undefined) {
      where.academicTrackId = filters.academicTrackId;
    }

    if (filters?.quarterId) {
      where.quarterId = filters.quarterId;
    }

    if (filters?.classId) {
      where.classId = filters.classId;
    }

    if (filters?.subjectId) {
      where.subjectId = filters.subjectId;
    }

    if (filters?.examType) {
      where.examType = filters.examType;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.exam.findMany({
      where,
      include: {
        subject: true,
        quarter: true,
        classSubject: true,
        academicYear: true,
        schoolLevel: true,
      },
      orderBy: [
        { examDate: 'desc' },
        { name: 'asc' },
      ],
    });
  }

  /**
   * Récupère un examen par ID
   */
  async findExamById(id: string, tenantId: string) {
    const exam = await this.prisma.exam.findFirst({
      where: { id, tenantId },
      include: {
        subject: true,
        quarter: true,
        classSubject: true,
        academicYear: true,
        schoolLevel: true,
        examScores: {
          include: {
            student: true,
          },
        },
      },
    });

    if (!exam) {
      throw new NotFoundException(`Exam with ID ${id} not found`);
    }

    return exam;
  }

  /**
   * Met à jour un examen
   */
  async updateExam(
    id: string,
    tenantId: string,
    data: {
      name?: string;
      examType?: string;
      examDate?: Date;
      maxScore?: number;
      coefficient?: number;
      description?: string;
    }
  ) {
    const exam = await this.findExamById(id, tenantId);

    return this.prisma.exam.update({
      where: { id },
      data,
      include: {
        subject: true,
        quarter: true,
        classSubject: true,
      },
    });
  }

  /**
   * Supprime un examen (archivage logique)
   */
  async deleteExam(id: string, tenantId: string) {
    const exam = await this.findExamById(id, tenantId);

    // Vérifier qu'aucune note n'est associée
    const scoresCount = await this.prisma.examScore.count({
      where: {
        examId: id,
        tenantId,
      },
    });

    if (scoresCount > 0) {
      throw new BadRequestException(
        `Cannot delete exam: ${scoresCount} score(s) are associated with it`
      );
    }

    await this.prisma.exam.delete({
      where: { id },
    });

    return { success: true };
  }

  /**
   * Récupère les statistiques d'un examen
   */
  async getExamStatistics(examId: string, tenantId: string) {
    const exam = await this.findExamById(examId, tenantId);

    const [totalScores, validatedScores, averageScore] = await Promise.all([
      this.prisma.examScore.count({
        where: {
          examId,
          tenantId,
        },
      }),
      this.prisma.examScore.count({
        where: {
          examId,
          tenantId,
          isValidated: true,
        },
      }),
      this.prisma.examScore.aggregate({
        where: {
          examId,
          tenantId,
          isValidated: true,
        },
        _avg: {
          score: true,
        },
      }),
    ]);

    return {
      exam,
      totalScores,
      validatedScores,
      pendingValidation: totalScores - validatedScores,
      averageScore: averageScore._avg.score || 0,
    };
  }

  /**
   * Tableau de bord global des examens (KPIs agrégés)
   * Endpoint: GET /api/exams/dashboard?academicYearId=...
   */
  async getDashboard(tenantId: string, academicYearId: string) {
    const where = { tenantId, academicYearId };

    const [totalExams, totalScores, validatedScores, reportCards] =
      await Promise.all([
        // Total examens planifiés
        this.prisma.exam.count({ where }),

        // Total notes saisies
        this.prisma.examScore.count({ where }),

        // Notes validées
        this.prisma.examScore.count({ where: { ...where, isValidated: true } }),

        // Bulletins générés
        this.prisma.reportCard.findMany({
          where,
          select: { id: true, status: true },
        }),
      ]);

    // Calcul de la moyenne globale sur les notes validées
    const avgResult = await this.prisma.examScore.aggregate({
      where: { ...where, isValidated: true },
      _avg: { score: true },
    });

    const globalAverage = avgResult._avg.score
      ? Number(avgResult._avg.score.toFixed(2))
      : 0;

    const missingGrades = totalScores === 0 ? 0 : totalScores - validatedScores;
    const successRate =
      validatedScores > 0
        ? Math.round(
            ((await this.prisma.examScore.count({
              where: { ...where, isValidated: true, score: { gte: 10 } },
            })) /
              validatedScores) *
              100,
          )
        : 0;

    const generatedBulletins = reportCards.filter(
      (r) => r.status === 'GENERATED' || r.status === 'PUBLISHED',
    ).length;

    return {
      plannedCount: totalExams,
      totalScores,
      validatedScores,
      missingGrades,
      globalAverage,
      successRate,
      generatedBulletins,
      lockedClasses: 0,   // À connecter à la table grade_locks si implémentée
      orionAlerts: 0,     // À connecter au service OrionAlerts
    };
  }
}


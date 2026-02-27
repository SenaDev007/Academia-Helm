/**
 * ============================================================================
 * REPORT CARDS PRISMA SERVICE - MODULE 3
 * ============================================================================
 * 
 * Service pour la génération des bulletins officiels
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ReportCardsPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Génère un bulletin pour un élève
   */
  async generateReportCard(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId: string;
    academicTrackId?: string;
    studentId: string;
    quarterId?: string;
    type: string; // QUARTERLY | SEMESTER | ANNUAL
  }) {
    // Vérifier que l'élève existe
    const student = await this.prisma.student.findFirst({
      where: {
        id: data.studentId,
        tenantId: data.tenantId,
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${data.studentId} not found`);
    }

    // Vérifier qu'un bulletin n'existe pas déjà
    const existing = await this.prisma.reportCard.findFirst({
      where: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        studentId: data.studentId,
        quarterId: data.quarterId || null,
        type: data.type,
      },
    });

    if (existing) {
      throw new BadRequestException('Report card already exists for this period');
    }

    // Calculer la moyenne générale et le classement
    const averages = await this.calculateAverages(
      data.studentId,
      data.tenantId,
      data.academicYearId,
      data.schoolLevelId,
      data.academicTrackId,
      data.quarterId
    );

    // Créer le bulletin
    const reportCard = await this.prisma.reportCard.create({
      data: {
        ...data,
        overallAverage: averages.generalAverage,
        rank: averages.rank,
        status: 'DRAFT',
      },
      include: {
        student: true,
        quarter: true,
        academicYear: true,
        schoolLevel: true,
      },
    });

    // Créer les items du bulletin (par matière)
    const items = await Promise.all(
      averages.subjectAverages.map((avg) =>
        this.prisma.reportCardItem.create({
          data: {
            tenantId: data.tenantId,
            academicYearId: data.academicYearId,
            schoolLevelId: data.schoolLevelId,
            reportCardId: reportCard.id,
            subjectId: avg.subjectId,
            average: avg.average,
            coefficient: avg.coefficient,
            rank: avg.rank,
          },
        })
      )
    );

    return {
      ...reportCard,
      items,
    };
  }

  /**
   * Valide un bulletin
   */
  async validateReportCard(
    reportCardId: string,
    tenantId: string,
    validatedBy: string
  ) {
    const reportCard = await this.prisma.reportCard.findFirst({
      where: {
        id: reportCardId,
        tenantId,
      },
    });

    if (!reportCard) {
      throw new NotFoundException(`Report card with ID ${reportCardId} not found`);
    }

    if (reportCard.status !== 'DRAFT') {
      throw new BadRequestException('Report card is not in DRAFT status');
    }

    return this.prisma.reportCard.update({
      where: { id: reportCardId },
      data: {
        status: 'VALIDATED',
        validatedBy,
        validatedAt: new Date(),
      },
      include: {
        student: true,
        quarter: true,
        items: {
          include: {
            subject: true,
          },
        },
      },
    });
  }

  /**
   * Publie un bulletin (génère le PDF)
   */
  async publishReportCard(
    reportCardId: string,
    tenantId: string,
    filePath: string
  ) {
    const reportCard = await this.prisma.reportCard.findFirst({
      where: {
        id: reportCardId,
        tenantId,
        status: 'VALIDATED',
      },
    });

    if (!reportCard) {
      throw new NotFoundException(
        `Validated report card with ID ${reportCardId} not found`
      );
    }

    return this.prisma.reportCard.update({
      where: { id: reportCardId },
      data: {
        status: 'PUBLISHED',
        filePath,
        generatedAt: new Date(),
        publishedAt: new Date(),
      },
      include: {
        student: true,
        quarter: true,
        items: {
          include: {
            subject: true,
          },
        },
      },
    });
  }

  /**
   * Récupère les bulletins d'un élève
   */
  async findReportCardsByStudent(
    studentId: string,
    tenantId: string,
    filters?: {
      academicYearId?: string;
      schoolLevelId?: string;
      quarterId?: string;
      type?: string;
      status?: string;
    }
  ) {
    const where: any = {
      studentId,
      tenantId,
    };

    if (filters?.academicYearId) {
      where.academicYearId = filters.academicYearId;
    }

    if (filters?.schoolLevelId && filters.schoolLevelId !== 'ALL') {
      where.schoolLevelId = filters.schoolLevelId;
    }

    if (filters?.quarterId) {
      where.quarterId = filters.quarterId;
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    return this.prisma.reportCard.findMany({
      where,
      include: {
        quarter: true,
        items: {
          include: {
            subject: true,
          },
        },
      },
      orderBy: [
        { quarter: { number: 'asc' } },
        { createdAt: 'desc' },
      ],
    });
  }

  /**
   * Calcule les moyennes pour un bulletin
   */
  private async calculateAverages(
    studentId: string,
    tenantId: string,
    academicYearId: string,
    schoolLevelId: string,
    academicTrackId?: string,
    quarterId?: string
  ) {
    // Récupérer toutes les notes validées de l'élève
    const scores = await this.prisma.examScore.findMany({
      where: {
        studentId,
        tenantId,
        academicYearId,
        schoolLevelId,
        isValidated: true,
        ...(academicTrackId && { academicTrackId }),
        ...(quarterId && {
          exam: {
            quarterId,
          },
        }),
      },
      include: {
        exam: {
          include: {
            quarter: true,
          },
        },
        subject: true,
      },
    });

    // Calculer les moyennes par matière
    const subjectMap = new Map<string, { scores: number[]; coefficients: number[] }>();

    scores.forEach((score) => {
      const subjectId = score.subjectId;
      if (!subjectMap.has(subjectId)) {
        subjectMap.set(subjectId, { scores: [], coefficients: [] });
      }
      const subjectData = subjectMap.get(subjectId)!;
      subjectData.scores.push(score.score);
      subjectData.coefficients.push(score.coefficient);
    });

    const subjectAverages = Array.from(subjectMap.entries()).map(([subjectId, data]) => {
      const total = data.scores.reduce((sum, score, i) => sum + score * data.coefficients[i], 0);
      const totalCoeff = data.coefficients.reduce((sum, coeff) => sum + coeff, 0);
      return {
        subjectId,
        average: totalCoeff > 0 ? total / totalCoeff : 0,
        coefficient: totalCoeff,
        rank: 0, // À calculer avec les autres élèves
      };
    });

    // Calculer la moyenne générale
    const totalAverage = subjectAverages.reduce(
      (sum, subj) => sum + subj.average * subj.coefficient,
      0
    );
    const totalCoeff = subjectAverages.reduce((sum, subj) => sum + subj.coefficient, 0);
    const generalAverage = totalCoeff > 0 ? totalAverage / totalCoeff : 0;

    // Calculer le classement (simplifié - à améliorer)
    const rank = 1; // TODO: Calculer le vrai classement

    return {
      generalAverage,
      rank,
      subjectAverages,
    };
  }
}


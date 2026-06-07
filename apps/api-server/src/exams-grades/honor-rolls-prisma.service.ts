/**
 * ============================================================================
 * HONOR ROLLS PRISMA SERVICE - MODULE 3
 * ============================================================================
 * 
 * Service pour les tableaux d'honneur
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class HonorRollsPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Génère le tableau d'honneur pour une période
   */
  async generateHonorRoll(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId: string;
    academicTrackId?: string;
    classId?: string;
    quarterId: string;
    minAverage?: number; // Seuil minimum pour être au tableau
  }) {
    // Vérifier que la période existe
    const quarter = await this.prisma.quarter.findFirst({
      where: {
        id: data.quarterId,
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
      },
    });

    if (!quarter) {
      throw new NotFoundException(`Quarter with ID ${data.quarterId} not found`);
    }

    // Récupérer tous les bulletins validés de la période
    const where: any = {
      tenantId: data.tenantId,
      academicYearId: data.academicYearId,
      schoolLevelId: data.schoolLevelId,
      quarterId: data.quarterId,
      status: 'VALIDATED',
      ...(data.academicTrackId && { academicTrackId: data.academicTrackId }),
      ...(data.classId && {
        student: {
          enrollments: {
            some: {
              classId: data.classId,
              status: 'VALIDATED',
            },
          },
        },
      }),
    };

    const reportCards = await this.prisma.reportCard.findMany({
      where,
      include: {
        student: true,
      },
      orderBy: {
        overallAverage: 'desc',
      },
    });

    // Filtrer par seuil minimum
    const minAverage = data.minAverage || 12.0;
    const eligibleCards = reportCards.filter(
      (card) => card.overallAverage >= minAverage
    );

    // Déterminer les mentions
    const honorRolls = eligibleCards.map((card, index) => {
      let mention = 'ASSEZ_BIEN';
      if (card.overallAverage >= 18) {
        mention = 'EXCELLENT';
      } else if (card.overallAverage >= 16) {
        mention = 'TRES_BIEN';
      } else if (card.overallAverage >= 14) {
        mention = 'BIEN';
      }

      return {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        schoolLevelId: data.schoolLevelId,
        academicTrackId: data.academicTrackId,
        classId: data.classId,
        quarterId: data.quarterId,
        studentId: card.studentId,
        mention,
        category: mention === 'EXCELLENT' ? 'EXCELLENCE' : mention === 'TRES_BIEN' ? 'HONOR' : 'MERIT',
        average: card.overallAverage,
        rank: index + 1,
      };
    });

    // Supprimer les anciens tableaux d'honneur pour cette période
    await this.prisma.honorRoll.deleteMany({
      where: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        schoolLevelId: data.schoolLevelId,
        quarterId: data.quarterId,
        ...(data.classId && { classId: data.classId }),
      },
    });

    // Créer les nouveaux tableaux d'honneur
    const created = await Promise.all(
      honorRolls.map((roll) => this.prisma.honorRoll.create({ data: roll }))
    );

    return created;
  }

  /**
   * Récupère les tableaux d'honneur
   */
  async findHonorRolls(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      schoolLevelId?: string;
      academicTrackId?: string;
      classId?: string;
      quarterId?: string;
      mention?: string;
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

    if (filters?.classId) {
      where.classId = filters.classId;
    }

    if (filters?.quarterId) {
      where.quarterId = filters.quarterId;
    }

    if (filters?.mention) {
      where.mention = filters.mention;
    }

    return this.prisma.honorRoll.findMany({
      where,
      include: {
        student: true,
        class: true,
        quarter: true,
        academicYear: true,
        schoolLevel: true,
      },
      orderBy: [
        { rank: 'asc' },
        { average: 'desc' },
      ],
    });
  }

  /**
   * Récupère le tableau d'honneur d'un élève
   */
  async findHonorRollsByStudent(
    studentId: string,
    tenantId: string,
    filters?: {
      academicYearId?: string;
      schoolLevelId?: string;
      quarterId?: string;
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

    return this.prisma.honorRoll.findMany({
      where,
      include: {
        class: true,
        quarter: true,
      },
      orderBy: {
        quarter: { number: 'desc' },
      },
    });
  }
}


/**
 * ============================================================================
 * DISCIPLINE PRISMA SERVICE - SOUS-MODULE DISCIPLINE
 * ============================================================================
 * 
 * Service pour la gestion de la discipline (incidents et actions)
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DisciplinePrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée une action disciplinaire
   */
  async createDisciplinaryAction(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId: string;
    studentId: string;
    actionType: string; // WARNING, SUSPENSION, EXPULSION, etc.
    description: string;
    actionDate: Date;
    duration?: number; // Durée en jours (pour suspensions)
    decidedBy?: string;
  }) {
    // Vérifier que l'élève existe
    const student = await this.prisma.student.findFirst({
      where: { id: data.studentId, tenantId: data.tenantId },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${data.studentId} not found`);
    }

    return this.prisma.disciplinaryAction.create({
      data: {
        ...data,
        status: 'ACTIVE',
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentCode: true,
          },
        },
      },
    });
  }

  /**
   * Récupère toutes les actions disciplinaires d'un élève
   */
  async getStudentDisciplinaryActions(
    studentId: string,
    tenantId: string,
    filters?: {
      academicYearId?: string;
      status?: string;
      actionType?: string;
    }
  ) {
    const where: any = {
      studentId,
      tenantId,
    };

    if (filters?.academicYearId) {
      where.academicYearId = filters.academicYearId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.actionType) {
      where.actionType = filters.actionType;
    }

    return this.prisma.disciplinaryAction.findMany({
      where,
      orderBy: { actionDate: 'desc' },
    });
  }

  /**
   * Récupère toutes les actions disciplinaires (filtres)
   */
  async getAllDisciplinaryActions(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      schoolLevelId?: string;
      status?: string;
      actionType?: string;
      startDate?: Date;
      endDate?: Date;
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

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.actionType) {
      where.actionType = filters.actionType;
    }

    if (filters?.startDate || filters?.endDate) {
      where.actionDate = {};
      if (filters.startDate) {
        where.actionDate.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.actionDate.lte = filters.endDate;
      }
    }

    return this.prisma.disciplinaryAction.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentCode: true,
          },
        },
      },
      orderBy: { actionDate: 'desc' },
    });
  }

  /**
   * Met à jour une action disciplinaire
   */
  async updateDisciplinaryAction(
    id: string,
    tenantId: string,
    data: {
      actionType?: string;
      description?: string;
      actionDate?: Date;
      duration?: number;
      status?: string;
    }
  ) {
    const action = await this.prisma.disciplinaryAction.findFirst({
      where: { id, tenantId },
    });

    if (!action) {
      throw new NotFoundException(`DisciplinaryAction with ID ${id} not found`);
    }

    return this.prisma.disciplinaryAction.update({
      where: { id },
      data,
      include: {
        student: true,
      },
    });
  }

  /**
   * Récupère les statistiques disciplinaires
   */
  async getDisciplineStatistics(
    tenantId: string,
    academicYearId: string,
    schoolLevelId?: string
  ) {
    const where: any = {
      tenantId,
      academicYearId,
    };

    if (schoolLevelId && schoolLevelId !== 'ALL') {
      where.schoolLevelId = schoolLevelId;
    }

    const [total, byType, bySeverity] = await Promise.all([
      this.prisma.disciplinaryAction.count({ where }),
      this.prisma.disciplinaryAction.groupBy({
        by: ['actionType'],
        where,
        _count: true,
      }),
      this.prisma.disciplineRecord.groupBy({
        by: ['severity'],
        where: {
          tenantId,
          academicYearId,
          ...(schoolLevelId && { schoolLevelId }),
        },
        _count: true,
      }),
    ]);

    return {
      total,
      byType,
      bySeverity,
    };
  }
}


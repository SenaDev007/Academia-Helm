/**
 * ============================================================================
 * DAILY LOGS PRISMA SERVICE - MODULE 2
 * ============================================================================
 * 
 * Service pour la gestion des cahiers journaux
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DailyLogsPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée un cahier journal
   */
  async createDailyLog(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId: string;
    teacherId: string;
    classId?: string;
    date: Date;
    summary: string;
  }) {
    // Vérifier l'unicité (un seul journal par enseignant/classe/date)
    const existing = await this.prisma.dailyLog.findFirst({
      where: {
        tenantId: data.tenantId,
        teacherId: data.teacherId,
        classId: data.classId || null,
        date: data.date,
      },
    });

    if (existing) {
      throw new BadRequestException('Daily log already exists for this teacher/class/date');
    }

    // Vérifier que l'enseignant existe
    const teacher = await this.prisma.teacher.findFirst({
      where: { id: data.teacherId, tenantId: data.tenantId },
    });

    if (!teacher) {
      throw new NotFoundException(`Teacher with ID ${data.teacherId} not found`);
    }

    return this.prisma.dailyLog.create({
      data,
      include: {
        teacher: true,
        class: true,
        academicYear: true,
        schoolLevel: true,
      },
    });
  }

  /**
   * Récupère tous les cahiers journaux
   */
  async findAllDailyLogs(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      schoolLevelId?: string;
      teacherId?: string;
      classId?: string;
      validated?: boolean;
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

    if (filters?.teacherId) {
      where.teacherId = filters.teacherId;
    }

    if (filters?.classId) {
      where.classId = filters.classId;
    }

    if (filters?.validated !== undefined) {
      where.validated = filters.validated;
    }

    if (filters?.startDate || filters?.endDate) {
      where.date = {};
      if (filters.startDate) {
        where.date.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.date.lte = filters.endDate;
      }
    }

    return this.prisma.dailyLog.findMany({
      where,
      include: {
        teacher: true,
        class: true,
        academicYear: true,
        validator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Récupère un cahier journal par ID
   */
  async findDailyLogById(id: string, tenantId: string) {
    const dailyLog = await this.prisma.dailyLog.findFirst({
      where: { id, tenantId },
      include: {
        teacher: true,
        class: true,
        academicYear: true,
        schoolLevel: true,
        validator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!dailyLog) {
      throw new NotFoundException(`DailyLog with ID ${id} not found`);
    }

    return dailyLog;
  }

  /**
   * Met à jour un cahier journal
   */
  async updateDailyLog(
    id: string,
    tenantId: string,
    data: {
      summary?: string;
    }
  ) {
    const dailyLog = await this.findDailyLogById(id, tenantId);

    // Ne pas permettre la modification si déjà validé
    if (dailyLog.validated) {
      throw new BadRequestException('Cannot update validated daily log');
    }

    return this.prisma.dailyLog.update({
      where: { id },
      data,
      include: {
        teacher: true,
        class: true,
      },
    });
  }

  /**
   * Valide un cahier journal (par la direction)
   */
  async validateDailyLog(id: string, tenantId: string, validatedBy: string) {
    const dailyLog = await this.findDailyLogById(id, tenantId);

    if (dailyLog.validated) {
      throw new BadRequestException('Daily log is already validated');
    }

    return this.prisma.dailyLog.update({
      where: { id },
      data: {
        validated: true,
        validatedBy,
        validatedAt: new Date(),
      },
      include: {
        teacher: true,
        class: true,
        validator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Supprime un cahier journal
   */
  async deleteDailyLog(id: string, tenantId: string) {
    const dailyLog = await this.findDailyLogById(id, tenantId);

    // Ne pas permettre la suppression si déjà validé
    if (dailyLog.validated) {
      throw new BadRequestException('Cannot delete validated daily log');
    }

    await this.prisma.dailyLog.delete({
      where: { id },
    });

    return { success: true };
  }
}


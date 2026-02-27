/**
 * ============================================================================
 * TIMETABLES PRISMA SERVICE - MODULE 2
 * ============================================================================
 * 
 * Service pour la gestion des emplois du temps
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class TimetablesPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée un créneau horaire
   */
  async createTimeSlot(data: {
    tenantId: string;
    dayOfWeek: number; // 0 = Lundi, 6 = Dimanche
    startTime: string; // Format: HH:mm
    endTime: string; // Format: HH:mm
  }) {
    // Vérifier l'unicité
    const existing = await this.prisma.timeSlot.findFirst({
      where: {
        tenantId: data.tenantId,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
      },
    });

    if (existing) {
      throw new BadRequestException('Time slot already exists');
    }

    return this.prisma.timeSlot.create({
      data,
    });
  }

  /**
   * Crée un emploi du temps
   */
  async createTimetable(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId: string;
    name: string;
    description?: string;
    startDate: Date;
    endDate?: Date;
  }) {
    return this.prisma.timetable.create({
      data: {
        ...data,
        isActive: true,
      },
      include: {
        academicYear: true,
        schoolLevel: true,
      },
    });
  }

  /**
   * Ajoute une entrée à l'emploi du temps
   */
  async createTimetableEntry(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId: string;
    timetableId: string;
    classId?: string;
    subjectId?: string;
    teacherId?: string;
    roomId?: string;
    timeSlotId?: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    duration?: number;
  }) {
    // Vérifier que l'emploi du temps existe
    const timetable = await this.prisma.timetable.findFirst({
      where: { id: data.timetableId, tenantId: data.tenantId },
    });

    if (!timetable) {
      throw new NotFoundException(`Timetable with ID ${data.timetableId} not found`);
    }

    // Vérifier les conflits (même classe, même jour, même heure)
    if (data.classId) {
      const conflict = await this.prisma.timetableEntry.findFirst({
        where: {
          timetableId: data.timetableId,
          classId: data.classId,
          dayOfWeek: data.dayOfWeek,
          OR: [
            {
              startTime: { lte: data.startTime },
              endTime: { gt: data.startTime },
            },
            {
              startTime: { lt: data.endTime },
              endTime: { gte: data.endTime },
            },
            {
              startTime: { gte: data.startTime },
              endTime: { lte: data.endTime },
            },
          ],
        },
      });

      if (conflict) {
        throw new BadRequestException('Time slot conflict: class already has a class at this time');
      }
    }

    return this.prisma.timetableEntry.create({
      data,
      include: {
        class: true,
        subject: true,
        teacher: true,
        room: true,
        timeSlot: true,
      },
    });
  }

  /**
   * Récupère un emploi du temps avec ses entrées
   */
  async getTimetable(id: string, tenantId: string) {
    const timetable = await this.prisma.timetable.findFirst({
      where: { id, tenantId },
      include: {
        academicYear: true,
        schoolLevel: true,
        entries: {
          include: {
            class: true,
            subject: true,
            teacher: true,
            room: true,
            timeSlot: true,
          },
          orderBy: [
            { dayOfWeek: 'asc' },
            { startTime: 'asc' },
          ],
        },
      },
    });

    if (!timetable) {
      throw new NotFoundException(`Timetable with ID ${id} not found`);
    }

    return timetable;
  }

  /**
   * Récupère tous les emplois du temps
   */
  async findAllTimetables(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      schoolLevelId?: string;
      isActive?: boolean;
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

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    return this.prisma.timetable.findMany({
      where,
      include: {
        academicYear: true,
        schoolLevel: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Met à jour un emploi du temps
   */
  async updateTimetable(
    id: string,
    tenantId: string,
    data: {
      name?: string;
      description?: string;
      isActive?: boolean;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    await this.getTimetable(id, tenantId);

    return this.prisma.timetable.update({
      where: { id },
      data,
      include: {
        academicYear: true,
        schoolLevel: true,
      },
    });
  }

  /**
   * Supprime une entrée d'emploi du temps
   */
  async deleteTimetableEntry(id: string, tenantId: string) {
    const entry = await this.prisma.timetableEntry.findFirst({
      where: { id, tenantId },
    });

    if (!entry) {
      throw new NotFoundException(`TimetableEntry with ID ${id} not found`);
    }

    await this.prisma.timetableEntry.delete({
      where: { id },
    });

    return { success: true };
  }
}


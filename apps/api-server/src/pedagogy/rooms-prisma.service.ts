/**
 * ============================================================================
 * ROOMS PRISMA SERVICE - MODULE 2
 * ============================================================================
 * 
 * Service pour la gestion des salles
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class RoomsPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée une salle
   */
  async createRoom(data: {
    tenantId: string;
    academicYearId?: string;
    roomCode: string;
    roomName: string;
    roomType: string; // CLASSROOM | LAB | IT | EXAM | OTHER
    capacity?: number;
    schoolLevelId?: string;
    equipment?: string[];
    status?: string; // ACTIVE | MAINTENANCE | UNAVAILABLE
    description?: string;
  }) {
    // Vérifier l'unicité du code
    const existing = await this.prisma.room.findFirst({
      where: {
        tenantId: data.tenantId,
        roomCode: data.roomCode,
      },
    });

    if (existing) {
      throw new BadRequestException(`Room with code ${data.roomCode} already exists`);
    }

    return this.prisma.room.create({
      data: {
        ...data,
        status: data.status || 'ACTIVE',
        equipment: data.equipment || [],
      },
      include: {
        schoolLevel: true,
        academicYear: true,
      },
    });
  }

  /**
   * Récupère toutes les salles
   */
  async findAllRooms(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      schoolLevelId?: string;
      roomType?: string;
      status?: string;
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

    if (filters?.roomType) {
      where.roomType = filters.roomType;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.search) {
      where.OR = [
        { roomName: { contains: filters.search, mode: 'insensitive' } },
        { roomCode: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.room.findMany({
      where,
      include: {
        schoolLevel: true,
        academicYear: true,
      },
      orderBy: [
        { roomCode: 'asc' },
        { roomName: 'asc' },
      ],
    });
  }

  /**
   * Récupère une salle par ID
   */
  async findRoomById(id: string, tenantId: string) {
    const room = await this.prisma.room.findFirst({
      where: { id, tenantId },
      include: {
        schoolLevel: true,
        academicYear: true,
        timetableEntries: {
          include: {
            timetable: true,
            class: true,
            subject: true,
          },
        },
        allocations: {
          include: {
            academicYear: true,
          },
          orderBy: { startTime: 'desc' },
        },
      },
    });

    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }

    return room;
  }

  /**
   * Récupère l'occupation d'une salle
   */
  async getRoomOccupation(
    roomId: string,
    tenantId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    const where: any = {
      roomId,
      tenantId,
      status: 'ACTIVE',
    };

    if (filters?.startDate || filters?.endDate) {
      where.OR = [
        {
          startTime: { lte: filters.endDate },
          endTime: { gte: filters.startDate },
        },
      ];
    }

    return this.prisma.roomAllocation.findMany({
      where,
      include: {
        academicYear: true,
      },
      orderBy: { startTime: 'asc' },
    });
  }

  /**
   * Crée une allocation de salle
   */
  async createRoomAllocation(data: {
    tenantId: string;
    academicYearId: string;
    roomId: string;
    allocationType: 'CLASS' | 'EXAM' | 'EVENT';
    referenceId?: string;
    startTime: Date;
    endTime: Date;
    notes?: string;
  }) {
    // Vérifier que la salle existe
    const room = await this.findRoomById(data.roomId, data.tenantId);

    // Vérifier que la salle n'est pas en maintenance
    if (room.status === 'MAINTENANCE' || room.status === 'UNAVAILABLE') {
      throw new BadRequestException(`Room is ${room.status.toLowerCase()}`);
    }

    // Vérifier les conflits d'occupation
    const conflict = await this.prisma.roomAllocation.findFirst({
      where: {
        roomId: data.roomId,
        tenantId: data.tenantId,
        status: 'ACTIVE',
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
      throw new BadRequestException(
        `Room is already allocated from ${conflict.startTime} to ${conflict.endTime}`
      );
    }

    return this.prisma.roomAllocation.create({
      data: {
        ...data,
        status: 'ACTIVE',
      },
      include: {
        room: true,
        academicYear: true,
      },
    });
  }

  /**
   * Récupère les statistiques d'occupation
   */
  async getRoomStatistics(
    tenantId: string,
    academicYearId: string,
    filters?: {
      roomType?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    const where: any = {
      tenantId,
      academicYearId,
      status: 'ACTIVE',
    };

    if (filters?.roomType) {
      where.room = {
        roomType: filters.roomType,
      };
    }

    if (filters?.startDate || filters?.endDate) {
      where.OR = [
        {
          startTime: { lte: filters.endDate },
          endTime: { gte: filters.startDate },
        },
      ];
    }

    const [totalAllocations, byType, byRoom] = await Promise.all([
      this.prisma.roomAllocation.count({ where }),
      this.prisma.roomAllocation.groupBy({
        by: ['allocationType'],
        where,
        _count: true,
      }),
      this.prisma.roomAllocation.groupBy({
        by: ['roomId'],
        where,
        _count: true,
      }),
    ]);

    const totalRooms = await this.prisma.room.count({
      where: {
        tenantId,
        status: 'ACTIVE',
        ...(filters?.roomType && { roomType: filters.roomType }),
      },
    });

    return {
      totalRooms,
      totalAllocations,
      byType,
      byRoom,
      occupancyRate: totalRooms > 0 ? (byRoom.length / totalRooms) * 100 : 0,
    };
  }

  /**
   * Met à jour une salle
   */
  async updateRoom(
    id: string,
    tenantId: string,
    data: {
      roomName?: string;
      roomCode?: string;
      roomType?: string;
      capacity?: number;
      schoolLevelId?: string;
      equipment?: string[];
      status?: string;
      description?: string;
    }
  ) {
    const room = await this.findRoomById(id, tenantId);

    // Vérifier l'unicité du code si modifié
    if (data.roomCode && data.roomCode !== room.roomCode) {
      const existing = await this.prisma.room.findFirst({
        where: {
          tenantId,
          roomCode: data.roomCode,
          id: { not: id },
        },
      });

      if (existing) {
        throw new BadRequestException(`Room with code ${data.roomCode} already exists`);
      }
    }

    return this.prisma.room.update({
      where: { id },
      data,
      include: {
        schoolLevel: true,
        academicYear: true,
      },
    });
  }

  /**
   * Met une salle en maintenance
   */
  async setMaintenance(id: string, tenantId: string, reason?: string) {
    const room = await this.findRoomById(id, tenantId);

    // Annuler les allocations futures
    await this.prisma.roomAllocation.updateMany({
      where: {
        roomId: id,
        tenantId,
        status: 'ACTIVE',
        startTime: { gt: new Date() },
      },
      data: {
        status: 'CANCELLED',
        notes: reason ? `Maintenance: ${reason}` : 'Maintenance programmée',
      },
    });

    return this.prisma.room.update({
      where: { id },
      data: {
        status: 'MAINTENANCE',
        description: reason
          ? `${room.description || ''}\n[Maintenance] ${reason}`
          : room.description,
      },
    });
  }

  /**
   * Récupère le planning hebdomadaire d'une salle
   */
  async getWeeklySchedule(
    roomId: string,
    tenantId: string,
    weekStart: Date
  ) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    return this.prisma.roomAllocation.findMany({
      where: {
        roomId,
        tenantId,
        status: 'ACTIVE',
        startTime: { gte: weekStart, lt: weekEnd },
      },
      include: {
        academicYear: true,
      },
      orderBy: { startTime: 'asc' },
    });
  }

  /**
   * Supprime une salle
   */
  async deleteRoom(id: string, tenantId: string) {
    const room = await this.findRoomById(id, tenantId);

    // Vérifier qu'aucun emploi du temps n'utilise cette salle
    const timetableEntries = await this.prisma.timetableEntry.count({
      where: {
        roomId: id,
        tenantId,
      },
    });

    if (timetableEntries > 0) {
      throw new BadRequestException(
        `Cannot delete room: ${timetableEntries} timetable entry(ies) are using it`
      );
    }

    await this.prisma.room.delete({
      where: { id },
    });

    return { success: true };
  }
}


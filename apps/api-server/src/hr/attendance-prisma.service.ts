/**
 * ============================================================================
 * ATTENDANCE PRISMA SERVICE - MODULE 5
 * ============================================================================
 * 
 * Service pour la gestion des présences et heures supplémentaires
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';
import { prismaCreateDefaults, prismaUpdateDefaults } from '../common/utils/prisma-helpers';

@Injectable()
export class AttendancePrismaService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // STAFF ATTENDANCE
  // ============================================================================

  /**
   * Enregistre une présence
   */
  async recordAttendance(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId?: string;
    staffId: string;
    date: string | Date;
    checkIn?: string | Date;
    checkOut?: string | Date;
    status: string;
    hoursWorked?: number;
    notes?: string;
  }) {
    // Convert date strings to Date objects (DTO sends strings via @IsDateString)
    const date = data.date instanceof Date ? data.date : new Date(data.date);
    const checkIn = data.checkIn ? (data.checkIn instanceof Date ? data.checkIn : new Date(data.checkIn)) : null;
    const checkOut = data.checkOut ? (data.checkOut instanceof Date ? data.checkOut : new Date(data.checkOut)) : null;

    // Vérifier qu'il n'y a pas déjà une présence pour cette date
    const existing = await this.prisma.staffAttendance.findUnique({
      where: {
        staffId_date: {
          staffId: data.staffId,
          date,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(`Attendance already recorded for this date`);
    }

    return this.prisma.staffAttendance.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        schoolLevelId: data.schoolLevelId ?? null,
        staffId: data.staffId,
        date,
        checkIn,
        checkOut,
        status: data.status || 'PRESENT',
        hoursWorked: data.hoursWorked ?? null,
        notes: data.notes ?? null,
      },
    });
  }

  /**
   * Met à jour une présence
   */
  async updateAttendance(id: string, tenantId: string, data: any) {
    const attendance = await this.prisma.staffAttendance.findFirst({
      where: { id, tenantId },
    });

    if (!attendance) {
      throw new NotFoundException(`Attendance with ID ${id} not found`);
    }

    return this.prisma.staffAttendance.update({
      where: { id },
      data: {
        ...prismaUpdateDefaults(),
        ...data,
      },
    });
  }

  /**
   * Récupère les présences d'un membre du personnel
   */
  async findStaffAttendances(staffId: string, tenantId: string, filters?: {
    academicYearId?: string;
    startDate?: Date;
    endDate?: Date;
    status?: string;
  }) {
    const where: any = {
      staffId,
      tenantId,
    };

    if (filters?.academicYearId) {
      where.academicYearId = filters.academicYearId;
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
    if (filters?.status) {
      where.status = filters.status;
    }

    return this.prisma.staffAttendance.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Récupère les statistiques de présence
   */
  async getAttendanceStatistics(tenantId: string, academicYearId: string, filters?: {
    staffId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: any = {
      tenantId,
      academicYearId,
    };

    if (filters?.staffId) {
      where.staffId = filters.staffId;
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

    const attendances = await this.prisma.staffAttendance.findMany({
      where,
    });

    const total = attendances.length;
    const present = attendances.filter(a => a.status === 'PRESENT').length;
    const absent = attendances.filter(a => a.status === 'ABSENT').length;

    return {
      total,
      present,
      absent,
      attendanceRate: total > 0 ? (present / total) * 100 : 0,
    };
  }

  // ============================================================================
  // OVERTIME RECORDS
  // ============================================================================

  /**
   * Enregistre des heures supplémentaires
   * OvertimeRecord n'a pas de champ status — utilise validated (boolean, default false)
   */
  async recordOvertime(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId?: string;
    staffId: string;
    date: string | Date;
    hours: number;
    reason?: string;
    notes?: string;
  }) {
    // Convert date string to Date object (DTO sends strings via @IsDateString)
    const date = data.date instanceof Date ? data.date : new Date(data.date);

    return this.prisma.overtimeRecord.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        schoolLevelId: data.schoolLevelId ?? null,
        staffId: data.staffId,
        date,
        hours: new Prisma.Decimal(data.hours),
        validated: false,
        notes: data.reason ?? data.notes ?? null,
      },
    });
  }

  /**
   * Valide ou rejette des heures supplémentaires
   * Utilise validated (boolean), validatedBy, validatedAt — PAS de champ status/approvedBy/approvedAt
   */
  async processOvertime(id: string, tenantId: string, action: 'VALIDATE' | 'REJECT', validatedBy?: string) {
    const overtime = await this.prisma.overtimeRecord.findFirst({
      where: { id, tenantId },
    });

    if (!overtime) {
      throw new NotFoundException(`Overtime record with ID ${id} not found`);
    }

    return this.prisma.overtimeRecord.update({
      where: { id },
      data: {
        ...prismaUpdateDefaults(),
        validated: action === 'VALIDATE',
        validatedBy: validatedBy ?? null,
        validatedAt: new Date(),
      },
    });
  }

  /**
   * Récupère les heures supplémentaires d'un membre du personnel
   * Filtre par validated (boolean) — PAS par status
   */
  async findStaffOvertime(staffId: string, tenantId: string, filters?: {
    academicYearId?: string;
    startDate?: Date;
    endDate?: Date;
    validated?: boolean;
  }) {
    const where: any = {
      staffId,
      tenantId,
    };

    if (filters?.academicYearId) {
      where.academicYearId = filters.academicYearId;
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
    if (filters?.validated !== undefined) {
      where.validated = filters.validated;
    }

    return this.prisma.overtimeRecord.findMany({
      where,
      include: {
        validator: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Calcule le total d'heures supplémentaires validées
   * Filtre par validated: true — PAS par status: 'APPROVED'
   */
  async calculateTotalOvertime(staffId: string, tenantId: string, startDate: Date, endDate: Date) {
    const overtimeRecords = await this.prisma.overtimeRecord.findMany({
      where: {
        staffId,
        tenantId,
        validated: true,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    return overtimeRecords.reduce((total, record) => {
      return total + Number(record.hours);
    }, 0);
  }
}


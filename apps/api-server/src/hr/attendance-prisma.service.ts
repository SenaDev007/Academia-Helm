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
    date: Date;
    checkIn?: Date;
    checkOut?: Date;
    status: string;
    hoursWorked?: number;
    notes?: string;
  }) {
    // Vérifier qu'il n'y a pas déjà une présence pour cette date
    const existing = await this.prisma.staffAttendance.findUnique({
      where: {
        staffId_date: {
          staffId: data.staffId,
          date: data.date,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(`Attendance already recorded for this date`);
    }

    return this.prisma.staffAttendance.create({
      data: {
        ...data,
        status: data.status || 'PRESENT',
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
      data,
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
   */
  async recordOvertime(data: {
    tenantId: string;
    academicYearId: string;
    staffId: string;
    date: Date;
    hours: number;
    reason?: string;
  }) {
    return this.prisma.overtimeRecord.create({
      data: {
        ...data,
        status: 'PENDING',
      },
    });
  }

  /**
   * Approuve ou rejette des heures supplémentaires
   */
  async processOvertime(id: string, tenantId: string, status: 'APPROVED' | 'REJECTED', approvedBy?: string) {
    const overtime = await this.prisma.overtimeRecord.findFirst({
      where: { id, tenantId },
    });

    if (!overtime) {
      throw new NotFoundException(`Overtime record with ID ${id} not found`);
    }

    return this.prisma.overtimeRecord.update({
      where: { id },
      data: {
        status,
        approvedBy,
        approvedAt: status === 'APPROVED' ? new Date() : null,
      },
    });
  }

  /**
   * Récupère les heures supplémentaires d'un membre du personnel
   */
  async findStaffOvertime(staffId: string, tenantId: string, filters?: {
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

    return this.prisma.overtimeRecord.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Calcule le total d'heures supplémentaires approuvées
   */
  async calculateTotalOvertime(staffId: string, tenantId: string, startDate: Date, endDate: Date) {
    const overtimeRecords = await this.prisma.overtimeRecord.findMany({
      where: {
        staffId,
        tenantId,
        status: 'APPROVED',
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


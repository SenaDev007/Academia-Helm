/**
 * ============================================================================
 * ATTENDANCE PRISMA SERVICE - SOUS-MODULE ASSIDUITÉ
 * ============================================================================
 * 
 * Service pour la gestion de l'assiduité (enregistrement quotidien)
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AttendancePrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enregistre l'assiduité d'un élève pour une date
   */
  async recordAttendance(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId: string;
    studentId: string;
    classId?: string;
    date: Date;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
    notes?: string;
    recordedBy?: string;
  }) {
    // Vérifier que l'élève existe
    const student = await this.prisma.student.findFirst({
      where: { id: data.studentId, tenantId: data.tenantId },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${data.studentId} not found`);
    }

    // Vérifier si un enregistrement existe déjà pour cette date
    const existing = await this.prisma.attendanceRecord.findFirst({
      where: {
        studentId: data.studentId,
        date: data.date,
      },
    });

    if (existing) {
      // Mettre à jour l'enregistrement existant
      return this.prisma.attendanceRecord.update({
        where: { id: existing.id },
        data: {
          status: data.status,
          notes: data.notes,
          recordedBy: data.recordedBy,
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
          class: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    }

    // Créer un nouvel enregistrement
    return this.prisma.attendanceRecord.create({
      data,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentCode: true,
          },
        },
        class: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Enregistre l'assiduité de plusieurs élèves (classe)
   */
  async recordClassAttendance(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId: string;
    classId: string;
    date: Date;
    records: Array<{
      studentId: string;
      status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
      notes?: string;
    }>;
    recordedBy?: string;
  }) {
    const results = [];

    for (const record of data.records) {
      try {
        const attendance = await this.recordAttendance({
          tenantId: data.tenantId,
          academicYearId: data.academicYearId,
          schoolLevelId: data.schoolLevelId,
          studentId: record.studentId,
          classId: data.classId,
          date: data.date,
          status: record.status,
          notes: record.notes,
          recordedBy: data.recordedBy,
        });
        results.push(attendance);
      } catch (error) {
        console.error(`Failed to record attendance for student ${record.studentId}:`, error);
      }
    }

    return results;
  }

  /**
   * Récupère l'assiduité d'un élève
   */
  async getStudentAttendance(
    studentId: string,
    tenantId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      status?: string;
    }
  ) {
    const where: any = {
      studentId,
      tenantId,
    };

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

    return this.prisma.attendanceRecord.findMany({
      where,
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Récupère l'assiduité d'une classe pour une date
   */
  async getClassAttendance(
    classId: string,
    tenantId: string,
    date: Date
  ) {
    return this.prisma.attendanceRecord.findMany({
      where: {
        classId,
        tenantId,
        date,
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
      orderBy: {
        student: {
          lastName: 'asc',
        },
      },
    });
  }

  /**
   * Récupère les statistiques d'assiduité
   */
  async getAttendanceStatistics(
    tenantId: string,
    academicYearId: string,
    schoolLevelId?: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      classId?: string;
    }
  ) {
    const where: any = {
      tenantId,
      academicYearId,
    };

    if (schoolLevelId && schoolLevelId !== 'ALL') {
      where.schoolLevelId = schoolLevelId;
    }

    if (filters?.classId) {
      where.classId = filters.classId;
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

    const [total, present, absent, late, excused] = await Promise.all([
      this.prisma.attendanceRecord.count({ where }),
      this.prisma.attendanceRecord.count({ where: { ...where, status: 'PRESENT' } }),
      this.prisma.attendanceRecord.count({ where: { ...where, status: 'ABSENT' } }),
      this.prisma.attendanceRecord.count({ where: { ...where, status: 'LATE' } }),
      this.prisma.attendanceRecord.count({ where: { ...where, status: 'EXCUSED' } }),
    ]);

    return {
      total,
      present,
      absent,
      late,
      excused,
      presentRate: total > 0 ? (present / total) * 100 : 0,
      absentRate: total > 0 ? (absent / total) * 100 : 0,
    };
  }
}


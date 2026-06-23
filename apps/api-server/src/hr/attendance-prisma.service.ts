/**
 * ============================================================================
 * ATTENDANCE PRISMA SERVICE - MODULE 5
 * ============================================================================
 * 
 * Service pour la gestion des présences et heures supplémentaires
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';
import { prismaCreateDefaults, prismaUpdateDefaults } from '../common/utils/prisma-helpers';
import { EmailService } from '../communication/services/email.service';
import { RecruitmentNotificationService } from './recruitment-notification.service';
import { renderOvertimeDecisionEmail } from './hr-email-templates';

@Injectable()
export class AttendancePrismaService {
  private readonly logger = new Logger(AttendancePrismaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly notificationService: RecruitmentNotificationService,
  ) {}

  // ============================================================================
  // STAFF ATTENDANCE
  // ============================================================================

  /**
   * Enregistre une présence
   */
  async recordAttendance(data: {
    tenantId: string;
    academicYearId?: string;
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

    // ─── Résoudre l'année académique active si non fournie ──
    const academicYearId = await this.resolveAcademicYear(data.tenantId, data.academicYearId);

    return this.prisma.staffAttendance.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId: data.tenantId,
        academicYearId,
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
  async getAttendanceStatistics(tenantId: string, academicYearId?: string, filters?: {
    staffId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: any = {
      tenantId,
    };

    // Résoudre l'année académique si non fournie
    const resolvedAcademicYearId = academicYearId || await this.resolveAcademicYear(tenantId).catch(() => null);
    if (resolvedAcademicYearId) {
      where.academicYearId = resolvedAcademicYearId;
    }

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

    // Use Prisma groupBy instead of loading all records into memory
    const grouped = await this.prisma.staffAttendance.groupBy({
      by: ['status'],
      where,
      _count: true,
    });

    let total = 0;
    let present = 0;
    let absent = 0;
    for (const g of grouped) {
      total += g._count;
      if (g.status === 'PRESENT') present = g._count;
      if (g.status === 'ABSENT') absent = g._count;
    }

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
    academicYearId?: string;
    schoolLevelId?: string;
    staffId: string;
    date: string | Date;
    hours: number;
    reason?: string;
    notes?: string;
  }) {
    // Convert date string to Date object (DTO sends strings via @IsDateString)
    const date = data.date instanceof Date ? data.date : new Date(data.date);

    // ─── Résoudre l'année académique active si non fournie ──
    const academicYearId = await this.resolveAcademicYear(data.tenantId, data.academicYearId);

    return this.prisma.overtimeRecord.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId: data.tenantId,
        academicYearId,
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
   * Résout l'année académique active si non fournie.
   * Fallback: dernière année créée pour ce tenant.
   */
  private async resolveAcademicYear(tenantId: string, academicYearId?: string): Promise<string> {
    if (academicYearId) return academicYearId;

    const activeYear = await this.prisma.academicYear.findFirst({
      where: { isActive: true, tenantId },
      select: { id: true },
    });
    if (activeYear) return activeYear.id;

    const lastYear = await this.prisma.academicYear.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!lastYear) {
      throw new BadRequestException(
        'Aucune année académique trouvée. Veuillez créer une année académique dans les paramètres.',
      );
    }
    return lastYear.id;
  }

  /**
   * Valide ou rejette des heures supplémentaires
   * Utilise validated (boolean), validatedBy, validatedAt — PAS de champ status/approvedBy/approvedAt
   */
  async processOvertime(id: string, tenantId: string, action: 'VALIDATE' | 'REJECT', validatedBy?: string) {
    const overtime = await this.prisma.overtimeRecord.findFirst({
      where: { id, tenantId },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!overtime) {
      throw new NotFoundException(`Overtime record with ID ${id} not found`);
    }

    const updated = await this.prisma.overtimeRecord.update({
      where: { id },
      data: {
        ...prismaUpdateDefaults(),
        validated: action === 'VALIDATE',
        validatedBy: validatedBy ?? null,
        validatedAt: new Date(),
      },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // ─── Envoi de l'email de notification au personnel ──
    this.sendOvertimeDecisionEmail(updated, tenantId, action).catch((err) => {
      this.logger.error(`Failed to send overtime decision email: ${err.message}`);
    });

    return updated;
  }

  /**
   * Envoie un email de notification au personnel pour la validation ou le rejet
   * de ses heures supplémentaires. Utilise le template Helm standardisé.
   */
  private async sendOvertimeDecisionEmail(
    overtime: any,
    tenantId: string,
    action: 'VALIDATE' | 'REJECT',
  ) {
    try {
      const staff = overtime.staff;
      if (!staff?.email) {
        this.logger.warn(`No email for staff ${staff?.id} — skipping overtime decision notification`);
        return;
      }

      const branding = await this.notificationService.getTenantBranding(tenantId);

      const decision = action === 'VALIDATE' ? 'VALIDATED' : 'REJECTED';

      const { subject, html } = renderOvertimeDecisionEmail({
        branding,
        staffName: `${staff.firstName} ${staff.lastName}`,
        date: overtime.date,
        hours: Number(overtime.hours),
        reason: overtime.notes,
        decision,
        validatorName: undefined, // could be enriched if we fetch the validator user
      });

      await this.emailService.sendEmail({
        to: staff.email,
        subject,
        html,
        fromName: branding.schoolName || 'Academia Helm',
      });

      this.logger.log(`Overtime decision email sent to ${staff.email} (${decision})`);
    } catch (err) {
      this.logger.error(`sendOvertimeDecisionEmail failed: ${err.message}`, err.stack);
    }
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

  /**
   * Supprime un enregistrement de présence
   */
  async deleteAttendance(id: string, tenantId: string) {
    const existing = await this.prisma.staffAttendance.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException(`Attendance record ${id} not found`);
    }
    return this.prisma.staffAttendance.delete({ where: { id } });
  }

  /**
   * Supprime un enregistrement d'heures supplémentaires
   */
  async deleteOvertime(id: string, tenantId: string) {
    const existing = await this.prisma.overtimeRecord.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException(`Overtime record ${id} not found`);
    }
    return this.prisma.overtimeRecord.delete({ where: { id } });
  }
}


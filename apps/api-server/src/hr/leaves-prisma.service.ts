/**
 * ============================================================================
 * LEAVES PRISMA SERVICE - MODULE 5
 * ============================================================================
 * 
 * Service pour la gestion des congés et absences
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class LeavesPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // LEAVE REQUESTS
  // ============================================================================

  /**
   * Crée une demande de congé
   */
  async createLeaveRequest(data: {
    tenantId: string;
    academicYearId: string;
    staffId: string;
    type: string;
    startDate: Date;
    endDate: Date;
    reason?: string;
  }) {
    // Vérifier les dates
    if (data.startDate > data.endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    return this.prisma.leaveRequest.create({
      data: {
        ...data,
        status: 'PENDING',
      },
    });
  }

  /**
   * Approuve ou rejette une demande de congé
   */
  async processLeaveRequest(id: string, tenantId: string, status: 'APPROVED' | 'REJECTED', approvedBy?: string) {
    const request = await this.prisma.leaveRequest.findFirst({
      where: { id, tenantId },
    });

    if (!request) {
      throw new NotFoundException(`Leave request with ID ${id} not found`);
    }

    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status,
        approvedBy,
        approvedAt: status === 'APPROVED' ? new Date() : null,
      },
    });
  }

  /**
   * Récupère toutes les demandes de congé
   */
  async findAllLeaveRequests(tenantId: string, filters?: {
    academicYearId?: string;
    staffId?: string;
    status?: string;
    type?: string;
  }) {
    const where: any = { tenantId };
    
    if (filters?.academicYearId) where.academicYearId = filters.academicYearId;
    if (filters?.staffId) where.staffId = filters.staffId;
    if (filters?.status) where.status = filters.status;
    if (filters?.type) where.type = filters.type;

    return this.prisma.leaveRequest.findMany({
      where,
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            staffCode: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  // ============================================================================
  // ABSENCES
  // ============================================================================

  /**
   * Enregistre une absence
   */
  async recordAbsence(data: {
    tenantId: string;
    academicYearId: string;
    staffId: string;
    date: Date;
    reason?: string;
    isJustified?: boolean;
    penaltyAmount?: number;
  }) {
    return this.prisma.absence.create({
      data,
    });
  }

  /**
   * Récupère les absences d'un membre du personnel
   */
  async findStaffAbsences(staffId: string, tenantId: string, filters?: {
    academicYearId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: any = { staffId, tenantId };
    
    if (filters?.academicYearId) where.academicYearId = filters.academicYearId;
    if (filters?.startDate || filters?.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = filters.startDate;
      if (filters.endDate) where.date.lte = filters.endDate;
    }

    return this.prisma.absence.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Calcule le solde de congés (Logique métier simplifiée)
   * En général : 2.5 jours par mois travaillé
   */
  async calculateLeaveBalance(staffId: string, tenantId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId },
      include: {
        leaveRequests: {
          where: { status: 'APPROVED' },
        },
      },
    });

    if (!staff) throw new NotFoundException('Staff not found');

    const hireDate = staff.hireDate || new Date();
    const now = new Date();
    const monthsWorked = (now.getFullYear() - hireDate.getFullYear()) * 12 + (now.getMonth() - hireDate.getMonth());
    
    const totalEarned = monthsWorked * 2.5;
    const totalTaken = staff.leaveRequests.reduce((acc, req) => {
      const diffTime = Math.abs(req.endDate.getTime() - req.startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return acc + diffDays;
    }, 0);

    return {
      earned: totalEarned,
      taken: totalTaken,
      balance: totalEarned - totalTaken,
    };
  }
}

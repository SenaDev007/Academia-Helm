/**
 * ============================================================================
 * TREASURY PRISMA SERVICE - MODULE 4
 * ============================================================================
 * 
 * Service pour la trésorerie et clôtures journalières
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class TreasuryPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée une clôture journalière
   */
  async createDailyClosure(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId: string;
    date: Date;
    openingBalance: number;
    totalCollected: number;
    totalSpent: number;
    notes?: string;
    createdBy?: string;
  }) {
    // Vérifier qu'une clôture n'existe pas déjà pour cette date
    const existing = await this.prisma.dailyClosure.findFirst({
      where: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        schoolLevelId: data.schoolLevelId,
        date: data.date,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'A daily closure already exists for this date, academic year, and school level'
      );
    }

    const closingBalance =
      data.openingBalance + data.totalCollected - data.totalSpent;
    const discrepancy = closingBalance - (data.openingBalance + data.totalCollected - data.totalSpent);

    return this.prisma.dailyClosure.create({
      data: {
        ...data,
        closingBalance,
        discrepancy,
        validated: false,
      },
      include: {
        academicYear: true,
        schoolLevel: true,
      },
    });
  }

  /**
   * Valide une clôture journalière
   */
  async validateDailyClosure(
    id: string,
    tenantId: string,
    validatedBy: string
  ) {
    const closure = await this.prisma.dailyClosure.findFirst({
      where: { id, tenantId },
    });

    if (!closure) {
      throw new NotFoundException(`Daily closure with ID ${id} not found`);
    }

    if (closure.validated) {
      throw new BadRequestException('Daily closure is already validated');
    }

    return this.prisma.dailyClosure.update({
      where: { id },
      data: {
        validated: true,
        validatedBy,
        validatedAt: new Date(),
      },
      include: {
        academicYear: true,
        schoolLevel: true,
        validator: true,
      },
    });
  }

  /**
   * Récupère les clôtures journalières
   */
  async findAllDailyClosures(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      schoolLevelId?: string;
      startDate?: Date;
      endDate?: Date;
      validated?: boolean;
    }
  ) {
    const where: any = {
      tenantId,
    };

    if (filters?.academicYearId) {
      where.academicYearId = filters.academicYearId;
    }

    // Niveau scolaire : filtrer sauf en mode 'ALL'
    if (filters?.schoolLevelId && filters.schoolLevelId !== 'ALL') {
      where.schoolLevelId = filters.schoolLevelId;
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

    return this.prisma.dailyClosure.findMany({
      where,
      include: {
        academicYear: true,
        schoolLevel: true,
        validator: true,
      },
      orderBy: {
        date: 'desc',
      },
    });
  }

  /**
   * Récupère les statistiques de trésorerie
   */
  async getTreasuryStatistics(
    tenantId: string,
    academicYearId?: string,
    schoolLevelId?: string
  ) {
    const where: any = {
      tenantId,
      validated: true,
    };

    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    if (schoolLevelId && schoolLevelId !== 'ALL') {
      where.schoolLevelId = schoolLevelId;
    }

    const [totalCollected, totalSpent, closures] = await Promise.all([
      this.prisma.dailyClosure.aggregate({
        where,
        _sum: {
          totalCollected: true,
        },
      }),
      this.prisma.dailyClosure.aggregate({
        where,
        _sum: {
          totalSpent: true,
        },
      }),
      this.prisma.dailyClosure.findMany({
        where,
        orderBy: { date: 'desc' },
        take: 30,
      }),
    ]);

    const netCashFlow =
      Number(totalCollected._sum.totalCollected || 0) -
      Number(totalSpent._sum.totalSpent || 0);

    return {
      totals: {
        collected: Number(totalCollected._sum.totalCollected || 0),
        spent: Number(totalSpent._sum.totalSpent || 0),
        netCashFlow,
      },
      recentClosures: closures,
    };
  }
}


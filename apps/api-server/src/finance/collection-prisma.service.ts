/**
 * ============================================================================
 * COLLECTION PRISMA SERVICE - MODULE 4 (SOUS-MODULE RECOUVREMENT)
 * ============================================================================
 * 
 * Service pour le recouvrement des impayés
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class CollectionPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Détecte et crée les impayés automatiquement
   */
  async detectArrears(tenantId: string, academicYearId: string) {
    // Récupérer tous les résumés de paiement avec solde > 0
    const summaries = await this.prisma.paymentSummary.findMany({
      where: {
        tenantId,
        academicYearId,
        balance: {
          gt: 0,
        },
      },
      include: {
        studentFee: {
          include: {
            feeDefinition: true,
          },
        },
        student: true,
      },
    });

    const arrears = [];

    for (const summary of summaries) {
      // Vérifier si un impayé existe déjà
      const existing = await this.prisma.feeArrear.findFirst({
        where: {
          studentId: summary.studentId,
          studentFeeId: summary.studentFeeId,
          academicYearId,
          tenantId,
        },
      });

      if (existing) {
        // Mettre à jour l'impayé existant
        const arrearsLevel = this.calculateArrearsLevel(
          Number(summary.balance),
          summary.lastPaymentDate
        );

        await this.prisma.feeArrear.update({
          where: { id: existing.id },
          data: {
            totalDue: Number(summary.expectedAmount),
            totalPaid: Number(summary.paidAmount),
            balanceDue: Number(summary.balance),
            arrearsLevel,
            lastPaymentDate: summary.lastPaymentDate,
          },
        });

        arrears.push(existing);
      } else {
        // Créer un nouvel impayé
        const arrearsLevel = this.calculateArrearsLevel(
          Number(summary.balance),
          summary.lastPaymentDate
        );

        const arrear = await this.prisma.feeArrear.create({
          data: {
            tenantId,
            academicYearId,
            studentId: summary.studentId,
            studentFeeId: summary.studentFeeId,
            totalDue: Number(summary.expectedAmount),
            totalPaid: Number(summary.paidAmount),
            balanceDue: Number(summary.balance),
            arrearsLevel,
            lastPaymentDate: summary.lastPaymentDate,
          },
          include: {
            student: true,
            studentFee: {
              include: {
                feeDefinition: true,
              },
            },
          },
        });

        arrears.push(arrear);
      }
    }

    return arrears;
  }

  /**
   * Calcule le niveau de gravité d'un impayé
   */
  private calculateArrearsLevel(
    balance: number,
    lastPaymentDate: Date | null
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (!lastPaymentDate) {
      return 'CRITICAL'; // Aucun paiement jamais effectué
    }

    const daysSinceLastPayment = Math.floor(
      (new Date().getTime() - new Date(lastPaymentDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastPayment > 30) {
      return 'CRITICAL';
    } else if (daysSinceLastPayment > 15) {
      return 'HIGH';
    } else if (daysSinceLastPayment > 7) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  /**
   * Récupère tous les impayés
   */
  async findAllArrears(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      schoolLevelId?: string;
      arrearsLevel?: string;
      studentId?: string;
      search?: string;
    }
  ) {
    const where: any = {
      tenantId,
    };

    if (filters?.academicYearId) {
      where.academicYearId = filters.academicYearId;
    }

    if (filters?.arrearsLevel) {
      where.arrearsLevel = filters.arrearsLevel;
    }

    if (filters?.studentId) {
      where.studentId = filters.studentId;
    }

    if (filters?.schoolLevelId && filters.schoolLevelId !== 'ALL') {
      where.student = {
        schoolLevelId: filters.schoolLevelId,
      };
    }

    if (filters?.search) {
      where.OR = [
        {
          student: {
            firstName: { contains: filters.search, mode: 'insensitive' },
          },
        },
        {
          student: {
            lastName: { contains: filters.search, mode: 'insensitive' },
          },
        },
      ];
    }

    return this.prisma.feeArrear.findMany({
      where,
      include: {
        student: true,
        studentFee: {
          include: {
            feeDefinition: {
              include: {
                feeCategory: true,
              },
            },
          },
        },
        reminders: {
          orderBy: { sentAt: 'desc' },
          take: 5,
        },
        promises: {
          where: {
            status: 'PENDING',
          },
          orderBy: { promisedDate: 'asc' },
        },
        actions: {
          orderBy: { performedAt: 'desc' },
          take: 10,
        },
      },
      orderBy: [
        { arrearsLevel: 'desc' },
        { balanceDue: 'desc' },
      ],
    });
  }

  /**
   * Enregistre un rappel de recouvrement
   */
  async createReminder(data: {
    feeArrearId: string;
    channel: string; // SMS | EMAIL | WHATSAPP | PUSH
    reminderStage: string; // J3 | J7 | J15 | J30
    message?: string;
    metadata?: any;
  }) {
    const arrear = await this.prisma.feeArrear.findFirst({
      where: { id: data.feeArrearId },
    });

    if (!arrear) {
      throw new NotFoundException(`Fee arrear with ID ${data.feeArrearId} not found`);
    }

    return this.prisma.collectionReminder.create({
      data: {
        ...data,
        status: 'SENT',
      },
      include: {
        feeArrear: {
          include: {
            student: true,
          },
        },
      },
    });
  }

  /**
   * Enregistre une promesse de paiement
   */
  async createPaymentPromise(data: {
    feeArrearId: string;
    promisedAmount: number;
    promisedDate: Date;
    notes?: string;
    createdBy?: string;
  }) {
    const arrear = await this.prisma.feeArrear.findFirst({
      where: { id: data.feeArrearId },
    });

    if (!arrear) {
      throw new NotFoundException(`Fee arrear with ID ${data.feeArrearId} not found`);
    }

    if (data.promisedAmount > Number(arrear.balanceDue)) {
      throw new BadRequestException(
        'Promised amount cannot exceed the balance due'
      );
    }

    return this.prisma.paymentPromise.create({
      data,
      include: {
        feeArrear: {
          include: {
            student: true,
          },
        },
      },
    });
  }

  /**
   * Enregistre une action de recouvrement
   */
  async createCollectionAction(data: {
    feeArrearId: string;
    actionType: string; // CALL | MEETING | SUSPENSION | OTHER
    notes?: string;
    performedBy?: string;
  }) {
    const arrear = await this.prisma.feeArrear.findFirst({
      where: { id: data.feeArrearId },
    });

    if (!arrear) {
      throw new NotFoundException(`Fee arrear with ID ${data.feeArrearId} not found`);
    }

    return this.prisma.collectionAction.create({
      data: {
        ...data,
        performedAt: new Date(),
      },
      include: {
        feeArrear: {
          include: {
            student: true,
          },
        },
        performer: true,
      },
    });
  }

  /**
   * Récupère les statistiques de recouvrement
   */
  async getCollectionStatistics(
    tenantId: string,
    academicYearId?: string
  ) {
    const where: any = {
      tenantId,
    };

    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    const [totalArrears, byLevel, totalDue, totalPaid] = await Promise.all([
      this.prisma.feeArrear.count({ where }),
      this.prisma.feeArrear.groupBy({
        by: ['arrearsLevel'],
        where,
        _count: true,
        _sum: {
          balanceDue: true,
        },
      }),
      this.prisma.feeArrear.aggregate({
        where,
        _sum: {
          balanceDue: true,
        },
      }),
      this.prisma.feeArrear.aggregate({
        where,
        _sum: {
          totalPaid: true,
        },
      }),
    ]);

    const totalBalanceDue = Number(totalDue._sum.balanceDue || 0);
    const totalPaidAmount = Number(totalPaid._sum.totalPaid || 0);
    const totalExpected = totalBalanceDue + totalPaidAmount;
    const collectionRate =
      totalExpected > 0 ? (totalPaidAmount / totalExpected) * 100 : 0;

    return {
      totalArrears,
      byLevel,
      totals: {
        expected: totalExpected,
        paid: totalPaidAmount,
        balanceDue: totalBalanceDue,
        collectionRate: parseFloat(collectionRate.toFixed(2)),
      },
    };
  }
}


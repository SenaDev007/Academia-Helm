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
    // FIX OOM: Process in batches of 200 instead of loading all at once
    const BATCH_SIZE = 200;
    let skip = 0;
    const arrears = [];

    while (true) {
      const summaries = await this.prisma.paymentSummary.findMany({
        where: {
          tenantId,
          academicYearId,
          balance: { gt: 0 },
        },
        include: {
          studentFee: { include: { feeDefinition: { select: { id: true, label: true } } } },
          student: { select: { id: true, firstName: true, lastName: true } },
        },
        take: BATCH_SIZE,
        skip,
      });

      if (summaries.length === 0) break;

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

      skip += BATCH_SIZE;
      if (global.gc) global.gc();
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
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentCode: true,
            schoolLevelId: true,
            studentEnrollments: {
              where: { academicYearId: filters?.academicYearId },
              select: { id: true, classId: true, class: { select: { id: true, name: true } } },
              take: 1,
              orderBy: { enrollmentDate: 'desc' },
            },
          },
        },
        studentFee: {
          include: {
            feeDefinition: {
              include: {
                feeCategory: { select: { id: true, name: true } },
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
      take: 500,
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

  /**
   * Liste toutes les promesses de paiement d'un tenant (avec filtres).
   */
  async findAllPaymentPromises(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      status?: string;
      feeArrearId?: string;
    },
  ) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.feeArrearId) where.feeArrearId = filters.feeArrearId;
    if (filters?.academicYearId) {
      where.feeArrear = { academicYearId: filters.academicYearId, tenantId };
    } else {
      where.feeArrear = { tenantId };
    }

    return this.prisma.paymentPromise.findMany({
      where,
      include: {
        feeArrear: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
            studentFee: { include: { feeDefinition: { select: { id: true, label: true } } } },
          },
        },
        creator: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { promisedDate: 'asc' },
    });
  }

  /**
   * Marque une promesse comme honorée ou rompue.
   */
  async updatePaymentPromiseStatus(
    promiseId: string,
    status: 'HONORED' | 'BROKEN' | 'PENDING',
  ) {
    return this.prisma.paymentPromise.update({
      where: { id: promiseId },
      data: { status },
      include: {
        feeArrear: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  /**
   * Liste toutes les actions de recouvrement d'un tenant (avec filtres).
   */
  async findAllCollectionActions(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      actionType?: string;
      feeArrearId?: string;
    },
  ) {
    const where: any = {};
    if (filters?.actionType) where.actionType = filters.actionType;
    if (filters?.feeArrearId) where.feeArrearId = filters.feeArrearId;
    if (filters?.academicYearId) {
      where.feeArrear = { academicYearId: filters.academicYearId, tenantId };
    } else {
      where.feeArrear = { tenantId };
    }

    return this.prisma.collectionAction.findMany({
      where,
      include: {
        feeArrear: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
            studentFee: { include: { feeDefinition: { select: { id: true, label: true } } } },
          },
        },
        performer: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { performedAt: 'desc' },
    });
  }

  /**
   * Liste toutes les relances (CollectionReminder) d'un tenant.
   */
  async findAllCollectionReminders(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      feeArrearId?: string;
      status?: string;
    },
  ) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.feeArrearId) where.feeArrearId = filters.feeArrearId;
    if (filters?.academicYearId) {
      where.feeArrear = { academicYearId: filters.academicYearId, tenantId };
    } else {
      where.feeArrear = { tenantId };
    }

    return this.prisma.collectionReminder.findMany({
      where,
      include: {
        feeArrear: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { sentAt: 'desc' },
    });
  }

  /**
   * Saisie manuelle d'un arriéré pour un élève (onboarding nouveaux clients).
   *
   * Permet aux écoles qui débutent avec Academia Helm en cours d'année de
   * saisir les arriérés existants (sur papier) dans le système.
   *
   * Étapes :
   *   1. Met à jour StudentEnrollment.previousArrears (traçabilité)
   *   2. Met à jour StudentAccount.arrearsAmount + ajuste totalDue et balance
   *   3. Crée un FeeArrear pour que l'arriéré apparaisse dans le tableau de recouvrement
   */
  async createManualArrear(
    tenantId: string,
    data: { studentId: string; academicYearId: string; amount: number; reason?: string },
    userId?: string,
  ) {
    const { studentId, academicYearId, amount, reason } = data;

    if (!amount || amount <= 0) {
      throw new BadRequestException('Le montant de l\'arriéré doit être positif.');
    }

    // 1. Charger l'inscription et le compte élève
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: { studentId, tenantId, academicYearId },
      orderBy: { enrollmentDate: 'desc' },
    });
    if (!enrollment) {
      throw new NotFoundException('Inscription non trouvée pour cet élève et cette année.');
    }

    // 2. Mettre à jour previousArrears sur l'inscription
    const currentPreviousArrears = Number(enrollment.previousArrears ?? 0);
    const newPreviousArrears = currentPreviousArrears + amount;
    await this.prisma.studentEnrollment.update({
      where: { id: enrollment.id },
      data: { previousArrears: newPreviousArrears },
    });

    // 3. Mettre à jour le StudentAccount (arrearsAmount + totalDue + balance)
    const account = await this.prisma.studentAccount.findUnique({
      where: { studentId_academicYearId: { studentId, academicYearId } },
    });

    if (account) {
      const currentArrears = Number(account.arrearsAmount ?? 0);
      const currentTotalDue = Number(account.totalDue ?? 0);
      const currentBalance = Number(account.balance ?? 0);
      await this.prisma.studentAccount.update({
        where: { id: account.id },
        data: {
          arrearsAmount: currentArrears + amount,
          totalDue: currentTotalDue + amount,
          balance: currentBalance + amount,
        },
      });
    }

    // 4. Créer un FeeArrear pour visibilité dans le tableau de recouvrement
    //    On cherche un StudentFee existant pour cet élève/année, sinon on crée
    //    un FeeArrear sans StudentFee (juste sur le solde).
    const arrear = await this.prisma.feeArrear.create({
      data: {
        tenantId,
        academicYearId,
        studentId,
        studentFeeId: null, // pas lié à un StudentFee spécifique — arriéré global
        totalDue: amount,
        totalPaid: 0,
        balanceDue: amount,
        arrearsLevel: this.calculateArrearsLevel(amount, null),
        lastPaymentDate: null,
        notes: reason || 'Arriéré antérieur (saisie manuelle)',
      },
    });

    return {
      success: true,
      arrearId: arrear.id,
      studentId,
      amount,
      reason: reason || 'Arriéré antérieur (saisie manuelle)',
      newPreviousArrears,
    };
  }
}


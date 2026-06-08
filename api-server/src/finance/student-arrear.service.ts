/**
 * ============================================================================
 * STUDENT ARREAR SERVICE - GESTION ARRIÉRÉS INTER-ANNÉES
 * ============================================================================
 * 
 * Service pour gérer les arriérés reportés d'une année scolaire à l'autre
 * Lignes immuables, jamais supprimées
 * 
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class StudentArrearService {
  private readonly logger = new Logger(StudentArrearService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Génère automatiquement les arriérés à la fin d'une année scolaire
   * Pour tous les élèves avec des impayés
   */
  async generateArrearsForYear(
    tenantId: string,
    fromAcademicYearId: string,
    toAcademicYearId: string,
  ) {
    // Récupérer tous les élèves avec des impayés pour l'année source
    const studentsWithUnpaidFees = await this.prisma.studentFee.findMany({
      where: {
        tenantId,
        academicYearId: fromAcademicYearId,
        status: { in: ['NOT_STARTED', 'PARTIAL'] },
      },
      include: {
        student: true,
        paymentSummary: true,
      },
    });

    const arrears = [];

    for (const studentFee of studentsWithUnpaidFees) {
      const balance = studentFee.paymentSummary?.balance || studentFee.totalAmount;

      if (balance.greaterThan(0)) {
        // Vérifier si un arriéré existe déjà
        const existing = await this.prisma.studentArrear.findFirst({
          where: {
            studentId: studentFee.studentId,
            fromAcademicYearId,
            toAcademicYearId,
          },
        });

        if (!existing) {
          const arrear = await this.prisma.studentArrear.create({
            data: {
              tenantId,
              studentId: studentFee.studentId,
              fromAcademicYearId,
              toAcademicYearId,
              amountDue: balance,
              amountPaid: new Prisma.Decimal(0),
              balanceDue: balance,
              status: 'OPEN',
            },
          });

          arrears.push(arrear);
          this.logger.log(
            `Arriéré ${arrear.id} créé pour élève ${studentFee.studentId}: ${balance} FCFA`,
          );
        }
      }
    }

    return arrears;
  }

  /**
   * Récupère les arriérés d'un élève pour une année
   */
  async getStudentArrears(
    studentId: string,
    toAcademicYearId: string,
  ) {
    return this.prisma.studentArrear.findMany({
      where: {
        studentId,
        toAcademicYearId,
        status: { in: ['OPEN', 'PARTIAL'] },
      },
      include: {
        fromAcademicYear: true,
        toAcademicYear: true,
        paymentAllocations: {
          include: {
            payment: true,
          },
        },
      },
      orderBy: {
        fromAcademicYear: {
          startDate: 'asc',
        },
      },
    });
  }

  /**
   * Récupère tous les arriérés d'un tenant pour une année
   */
  async getAllArrears(
    tenantId: string,
    toAcademicYearId: string,
    status?: string,
  ) {
    const where: any = {
      tenantId,
      toAcademicYearId,
    };

    if (status) {
      where.status = status;
    }

    return this.prisma.studentArrear.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentCode: true,
          },
        },
        fromAcademicYear: true,
        toAcademicYear: true,
      },
      orderBy: {
        balanceDue: 'desc',
      },
    });
  }

  /**
   * Met à jour le statut d'un arriéré après paiement
   */
  async updateArrearAfterPayment(arrearId: string, paymentAmount: Prisma.Decimal) {
    const arrear = await this.prisma.studentArrear.findUnique({
      where: { id: arrearId },
    });

    if (!arrear) {
      throw new NotFoundException(`Arriéré ${arrearId} non trouvé`);
    }

    const newAmountPaid = arrear.amountPaid.plus(paymentAmount);
    const newBalanceDue = arrear.amountDue.minus(newAmountPaid);

    let status = 'OPEN';
    if (newBalanceDue.lessThanOrEqualTo(0)) {
      status = 'PAID';
    } else if (newAmountPaid.greaterThan(0)) {
      status = 'PARTIAL';
    }

    return this.prisma.studentArrear.update({
      where: { id: arrearId },
      data: {
        amountPaid: newAmountPaid,
        balanceDue: newBalanceDue.greaterThan(0) ? newBalanceDue : new Prisma.Decimal(0),
        status,
      },
    });
  }

  /**
   * Récupère les statistiques des arriérés
   */
  async getArrearStats(tenantId: string, toAcademicYearId: string) {
    const arrears = await this.prisma.studentArrear.findMany({
      where: {
        tenantId,
        toAcademicYearId,
      },
    });

    const totalDue = arrears.reduce(
      (sum, a) => sum.plus(a.amountDue),
      new Prisma.Decimal(0),
    );
    const totalPaid = arrears.reduce(
      (sum, a) => sum.plus(a.amountPaid),
      new Prisma.Decimal(0),
    );
    const totalBalance = arrears.reduce(
      (sum, a) => sum.plus(a.balanceDue),
      new Prisma.Decimal(0),
    );

    return {
      totalArrears: arrears.length,
      totalDue: totalDue.toNumber(),
      totalPaid: totalPaid.toNumber(),
      totalBalance: totalBalance.toNumber(),
      byStatus: {
        OPEN: arrears.filter((a) => a.status === 'OPEN').length,
        PARTIAL: arrears.filter((a) => a.status === 'PARTIAL').length,
        PAID: arrears.filter((a) => a.status === 'PAID').length,
      },
    };
  }
}


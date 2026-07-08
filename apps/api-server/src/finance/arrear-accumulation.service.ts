/**
 * ============================================================================
 * ARREAR ACCUMULATION SERVICE — Phase 2 & 3
 * ============================================================================
 *
 * Gère l'accumulation des arriérés multi-années :
 *   - Phase 2 : Report d'arriérés au passage d'année (year rollover)
 *   - Phase 3 : Algorithme de paiement FIFO (First In First Out)
 *
 * Principe FIFO :
 *   Quand un élève paie, le paiement est d'abord appliqué aux arriérés
 *   les plus anciens (année la plus ancienne en premier), puis à l'année
 *   en cours. C'est le standard comptable.
 *
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ArrearAccumulationService {
  private readonly logger = new Logger(ArrearAccumulationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════
  //  PHASE 2 : REPORT D'ARRIÉRÉS AU PASSAGE D'ANNÉE
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Reporte les arriérés d'une année clôturée vers la nouvelle année.
   *
   * Pour chaque élève qui a un solde impayé sur l'année source :
   *   1. Calcule le solde impayé = StudentAccount.balance (année source)
   *   2. Crée un FeeArrear dans l'année destination (arriéré global)
   *   3. Crée un ArrearTransfer (traçabilité)
   *   4. Met à jour le StudentAccount de l'année destination :
   *      - carriedArrears += solde
   *      - totalDue += solde
   *      - balance += solde
   *   5. Marque les FeeArrear de l'année source comme TRANSFERRED
   *
   * @returns { processed, transferred, totalAmount, errors }
   */
  async transferArrearsToNewYear(
    tenantId: string,
    fromAcademicYearId: string,
    toAcademicYearId: string,
    userId?: string,
  ): Promise<{
    processed: number;
    transferred: number;
    totalAmount: number;
    errors: { studentId: string; error: string }[];
  }> {
    this.logger.log(
      `transferArrearsToNewYear: from=${fromAcademicYearId} to=${toAcademicYearId} tenant=${tenantId}`,
    );

    // 1. Récupérer tous les comptes élèves de l'année source avec un solde > 0
    const sourceAccounts = await this.prisma.studentAccount.findMany({
      where: {
        tenantId,
        academicYearId: fromAcademicYearId,
        balance: { gt: 0 },
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    this.logger.log(`Found ${sourceAccounts.length} students with unpaid balance`);

    let transferred = 0;
    let totalAmount = 0;
    const errors: { studentId: string; error: string }[] = [];

    for (const sourceAccount of sourceAccounts) {
      try {
        const balance = Number(sourceAccount.balance);
        if (balance <= 0) continue;

        // 2. Trouver ou créer le StudentAccount de l'année destination
        let destAccount = await this.prisma.studentAccount.findUnique({
          where: {
            studentId_academicYearId: {
              studentId: sourceAccount.studentId,
              academicYearId: toAcademicYearId,
            },
          },
        });

        if (!destAccount) {
          // Créer le compte pour la nouvelle année (sans frais, juste l'arriéré)
          destAccount = await this.prisma.studentAccount.create({
            data: {
              tenantId,
              studentId: sourceAccount.studentId,
              academicYearId: toAcademicYearId,
              totalDue: balance,
              totalPaid: 0,
              balance: balance,
              carriedArrears: balance,
              arrearsAmount: balance,
            },
          });
        } else {
          // Mettre à jour le compte existant
          destAccount = await this.prisma.studentAccount.update({
            where: { id: destAccount.id },
            data: {
              carriedArrears: { increment: balance },
              totalDue: { increment: balance },
              balance: { increment: balance },
              arrearsAmount: { increment: balance },
            },
          });
        }

        // 3. Créer un FeeArrear dans l'année destination
        const fromYear = await this.prisma.academicYear.findUnique({
          where: { id: fromAcademicYearId },
          select: { name: true },
        });

        await this.prisma.feeArrear.create({
          data: {
            tenantId,
            academicYearId: toAcademicYearId,
            studentId: sourceAccount.studentId,
            studentFeeId: null,
            totalDue: balance,
            totalPaid: 0,
            balanceDue: balance,
            arrearsLevel: 'CRITICAL', // Reporté = critique par défaut
            status: 'OPEN',
            notes: `Arriéré reporté depuis ${fromYear?.name || 'année précédente'}`,
          },
        });

        // 4. Créer un ArrearTransfer (traçabilité)
        await this.prisma.arrearTransfer.create({
          data: {
            tenantId,
            studentId: sourceAccount.studentId,
            studentAccountId: destAccount.id,
            fromAcademicYearId,
            toAcademicYearId,
            amount: balance,
            transferredBy: userId,
            notes: `Report automatique depuis ${fromYear?.name || 'année précédente'}`,
          },
        });

        // 5. Marquer les FeeArrear de l'année source comme TRANSFERRED
        await this.prisma.feeArrear.updateMany({
          where: {
            tenantId,
            studentId: sourceAccount.studentId,
            academicYearId: fromAcademicYearId,
            status: { in: ['OPEN', 'PARTIALLY_PAID'] },
          },
          data: { status: 'TRANSFERRED' },
        });

        transferred++;
        totalAmount += balance;

        this.logger.log(
          `Transferred ${balance} FCFA for student ${sourceAccount.student.firstName} ${sourceAccount.student.lastName}`,
        );
      } catch (err: any) {
        this.logger.error(
          `Failed to transfer arrears for student ${sourceAccount.studentId}: ${err.message}`,
        );
        errors.push({
          studentId: sourceAccount.studentId,
          error: err.message,
        });
      }
    }

    this.logger.log(
      `transferArrearsToNewYear completed: ${transferred} students, ${totalAmount} FCFA total, ${errors.length} errors`,
    );

    return {
      processed: sourceAccounts.length,
      transferred,
      totalAmount,
      errors,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PHASE 3 : ALGORITHME DE PAIEMENT FIFO
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Aloue un paiement selon le principe FIFO (First In First Out).
   *
   * Étapes :
   *   1. Récupère TOUS les FeeArrear de l'élève (toutes années confondues)
   *      avec status OPEN ou PARTIALLY_PAID, triés par année (la plus
   *      ancienne en premier).
   *   2. Pour chaque FeeArrear, alloue le paiement jusqu'à épuisement.
   *   3. Met à jour FeeArrear (totalPaid, balanceDue, status).
   *   4. Retourne les allocations pour que le service appelant puisse
   *      créer les FinanceTransactionAllocation correspondantes.
   *
   * @returns { allocations: [{ feeArrearId, amount, academicYearId }], remainingAmount }
   */
  async allocatePaymentFIFO(
    tenantId: string,
    studentId: string,
    paymentAmount: number,
  ): Promise<{
    allocations: { feeArrearId: string; amount: number; academicYearId: string }[];
    remainingAmount: number;
  }> {
    if (paymentAmount <= 0) {
      return { allocations: [], remainingAmount: 0 };
    }

    // 1. Récupérer tous les FeeArrear OPEN ou PARTIALLY_PAID
    //    triés par année (la plus ancienne en premier)
    const openArrears = await this.prisma.feeArrear.findMany({
      where: {
        tenantId,
        studentId,
        status: { in: ['OPEN', 'PARTIALLY_PAID'] },
        balanceDue: { gt: 0 },
      },
      include: {
        academicYear: { select: { id: true, name: true } },
      },
      orderBy: [
        { academicYear: { startDate: 'asc' } }, // Année la plus ancienne en premier
        { createdAt: 'asc' }, // Puis par date de création
      ],
    });

    const allocations: { feeArrearId: string; amount: number; academicYearId: string }[] = [];
    let remaining = paymentAmount;

    // 2. Allouer le paiement aux arriérés (FIFO)
    for (const arrear of openArrears) {
      if (remaining <= 0) break;

      const balanceDue = Number(arrear.balanceDue);
      const allocation = Math.min(remaining, balanceDue);

      allocations.push({
        feeArrearId: arrear.id,
        amount: allocation,
        academicYearId: arrear.academicYearId,
      });

      // 3. Mettre à jour le FeeArrear
      const newTotalPaid = Number(arrear.totalPaid) + allocation;
      const newBalanceDue = balanceDue - allocation;
      const newStatus = newBalanceDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';

      await this.prisma.feeArrear.update({
        where: { id: arrear.id },
        data: {
          totalPaid: newTotalPaid,
          balanceDue: newBalanceDue,
          status: newStatus,
          lastPaymentDate: new Date(),
        },
      });

      remaining -= allocation;

      this.logger.log(
        `FIFO allocation: ${allocation} FCFA → FeeArrear ${arrear.id.substring(0, 8)} ` +
        `(${arrear.academicYear?.name}) — remaining: ${remaining}`,
      );
    }

    return { allocations, remainingAmount: remaining };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  ABANDON DE CRÉANCE (WRITE-OFF)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Marque un FeeArrear comme "abandonné" (WRITTEN_OFF).
   * Le montant est retiré du total dû et du solde.
   */
  async writeOffArrear(
    tenantId: string,
    feeArrearId: string,
    reason: string,
    userId?: string,
  ): Promise<{ success: boolean; amount: number }> {
    const arrear = await this.prisma.feeArrear.findFirst({
      where: { id: feeArrearId, tenantId },
    });
    if (!arrear) throw new NotFoundException('Arriéré non trouvé');
    if (arrear.status === 'WRITTEN_OFF') {
      throw new BadRequestException('Cet arriéré est déjà abandonné');
    }

    const balanceDue = Number(arrear.balanceDue);

    // Marquer comme WRITTEN_OFF
    await this.prisma.feeArrear.update({
      where: { id: feeArrearId },
      data: {
        status: 'WRITTEN_OFF',
        notes: `${arrear.notes || ''} — Abandon de créance: ${reason}`,
      },
    });

    // Ajuster le StudentAccount
    await this.prisma.studentAccount.update({
      where: {
        studentId_academicYearId: {
          studentId: arrear.studentId,
          academicYearId: arrear.academicYearId,
        },
      },
      data: {
        totalDue: { decrement: balanceDue },
        balance: { decrement: balanceDue },
        arrearsAmount: { decrement: balanceDue },
      },
    });

    this.logger.log(
      `Write-off: ${balanceDue} FCFA for FeeArrear ${feeArrearId} — reason: ${reason}`,
    );

    return { success: true, amount: balanceDue };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  RAPPORT : RÉCAPITULATIF DES ARRÉRÉS PAR ANNÉE
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Récupère un récapitulatif des arriérés par année scolaire.
   * Utilisé pour le reporting et le tableau de bord.
   */
  async getArrearsSummaryByYear(tenantId: string): Promise<
    {
      academicYearId: string;
      academicYearName: string;
      totalArrears: number;
      totalBalanceDue: number;
      totalPaid: number;
      studentCount: number;
      byStatus: { status: string; count: number; amount: number }[];
    }[]
  > {
    const arrears = await this.prisma.feeArrear.findMany({
      where: {
        tenantId,
        status: { notIn: ['WRITTEN_OFF', 'TRANSFERRED'] },
      },
      include: {
        academicYear: { select: { id: true, name: true } },
      },
      orderBy: { academicYear: { startDate: 'asc' } },
    });

    // Grouper par année
    const byYear: Record<string, any> = {};
    for (const a of arrears) {
      const yearId = a.academicYearId;
      if (!byYear[yearId]) {
        byYear[yearId] = {
          academicYearId: yearId,
          academicYearName: a.academicYear?.name || '—',
          totalArrears: 0,
          totalBalanceDue: 0,
          totalPaid: 0,
          studentIds: new Set<string>(),
          byStatus: {} as Record<string, { count: number; amount: number }>,
        };
      }
      byYear[yearId].totalArrears++;
      byYear[yearId].totalBalanceDue += Number(a.balanceDue);
      byYear[yearId].totalPaid += Number(a.totalPaid);
      byYear[yearId].studentIds.add(a.studentId);

      const status = a.status || 'OPEN';
      if (!byYear[yearId].byStatus[status]) {
        byYear[yearId].byStatus[status] = { count: 0, amount: 0 };
      }
      byYear[yearId].byStatus[status].count++;
      byYear[yearId].byStatus[status].amount += Number(a.balanceDue);
    }

    return Object.values(byYear).map((y: any) => ({
      ...y,
      studentCount: y.studentIds.size,
      byStatus: Object.entries(y.byStatus).map(([status, data]: any) => ({
        status,
        count: data.count,
        amount: data.amount,
      })),
    }));
  }
}

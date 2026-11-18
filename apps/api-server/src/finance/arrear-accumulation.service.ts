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
import { ArrearsMirrorService } from './arrears-mirror.service';

@Injectable()
export class ArrearAccumulationService {
  private readonly logger = new Logger(ArrearAccumulationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly arrearsMirror: ArrearsMirrorService,
  ) {}

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
   *   4. Resynchronise les miroirs du compte destination
   *      (arrearsAmount / carriedArrears — cf. ArrearsMirrorService)
   *   5. Marque les FeeArrear de l'année source comme TRANSFERRED
   *
   * ⭐ Correctif moteur de calcul (nov. 2026) : le compte destination ne
   *    voit PLUS son totalDue/balance incrémentés — les arriérés vivent
   *    exclusivement dans les FeeArrear (l'affichage de Comptes élèves les
   *    ajoute au total dû : « 59 000 F dont 16 000 F d'arriérés »).
   *    AVANT, le report incrémentait totalDue + balance + arrearsAmount +
   *    carriedArrears → le même arriéré comptait DEUX FOIS dans les champs
   *    legacy et UNE FOIS en FeeArrear → totaux incohérents d'un élève à
   *    l'autre selon le flux qui les avait créés.
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
          // Créer le compte pour la nouvelle année — SANS frais et SANS
          // arriérés incrustés (les frais seront matérialisés par le
          // recalcul à la configuration ; les arriérés vivent en FeeArrear).
          // L'INSERT ne déclenche pas prevent_balance_update.
          destAccount = await this.prisma.studentAccount.create({
            data: {
              tenantId,
              studentId: sourceAccount.studentId,
              academicYearId: toAcademicYearId,
              totalDue: 0,
              totalPaid: 0,
              balance: 0,
            },
          });
        }
        // ⭐ Plus AUCUNE incrément de totalDue/balance/arrearsAmount/carriedArrears :
        //    les miroirs sont resynchronisés depuis les FeeArrear (ci-dessous).

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

        // ⭐ 6. Resynchroniser les miroirs du compte (moteur de calcul unifié)
        await this.arrearsMirror.syncForStudent(tenantId, sourceAccount.studentId);

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

    // ⭐ 4. Resynchroniser les miroirs du compte (arrearsAmount/carriedArrears)
    //    AVANT : les FeeArrear étaient décrémentés mais PAS les champs du
    //    compte → l'arriéré restait affiché à son montant d'origine dans les
    //    colonnes « dont arriérés »/« Arriérés » alors que le total dû, lui,
    //    avait bien baissé → totaux incohérents d'un élève à l'autre.
    if (allocations.length > 0) {
      try {
        await this.arrearsMirror.syncForStudent(tenantId, studentId);
      } catch (e: any) {
        this.logger.warn(`Miroirs arriérés non resynchronisés (non bloquant): ${e.message}`);
      }
    }

    return { allocations, remainingAmount: remaining };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  ABANDON DE CRÉANCE (WRITE-OFF)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Marque un FeeArrear comme "abandonné" (WRITTEN_OFF).
   * ⭐ Correctif moteur de calcul (nov. 2026) : le totalDue/balance du
   *    compte ne sont PLUS décrémentés — ils ne contiennent que les frais de
   *    l'année (l'affichage ajoute les FeeArrear ouverts par-dessus).
   *    Les miroirs sont resynchronisés depuis les FeeArrear restants.
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

    // ⭐ Resynchroniser les miroirs du compte (moteur de calcul unifié)
    //    AVANT : totalDue/balance/arrearsAmount décrémentés manuellement →
    //    si l'arriéré n'y avait jamais été incrusté, le solde de l'élève
    //    partait en négatif ; s'il y avait été incrusté deux fois, reste trop
    //    élevé. Désormais : une seule source de vérité (FeeArrear) + miroirs.
    try {
      await this.arrearsMirror.syncForStudent(tenantId, arrear.studentId);
    } catch (e: any) {
      this.logger.warn(`Miroirs arriérés non resynchronisés (non bloquant): ${e.message}`);
    }

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

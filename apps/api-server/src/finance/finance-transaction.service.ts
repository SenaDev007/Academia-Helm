/**
 * SOUS-MODULE 3 — Encaissements (FinanceTransaction)
 * Reçu AH-YYYY-NNNNNN, imputation prioritaire, hash d'intégrité (spec extension).
 *
 * EXTENSION MULTI-CAISSES :
 * - Accepte cashRegisterId optionnel pour lier la transaction à une caisse
 * - Met à jour le currentBalance de la caisse après chaque transaction
 * - Valide que la caisse est ouverte avant d'accepter un paiement
 */
import * as crypto from 'crypto';
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TransactionType, PaymentMethod } from '@prisma/client';
import { ReceiptFinanceService } from './receipt-finance.service';

const PRIORITY_ORDER = ['INSCRIPTION', 'REINSCRIPTION', 'TUITION', 'CANTEEN', 'EXAMEN', 'OTHER'];
const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'MOBILE_MONEY', 'WIRE', 'FEDAPAY'];

@Injectable()
export class FinanceTransactionService {
  private readonly logger = new Logger(FinanceTransactionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly receiptFinanceService: ReceiptFinanceService,
  ) {}

  /** Expose prisma pour le controller (downloadReceipt, resendReceipt) */
  get prismaClient() {
    return this.prisma;
  }

  private async nextReceiptNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `AH-${year}-`;
    const last = await this.prisma.financeTransaction.findFirst({
      where: { tenantId, receiptNumber: { startsWith: prefix } },
      orderBy: { receiptNumber: 'desc' },
    });
    let seq = 1;
    if (last) {
      const part = last.receiptNumber.replace(prefix, '');
      const n = parseInt(part, 10);
      if (!isNaN(n)) seq = n + 1;
    }
    return `${prefix}${seq.toString().padStart(6, '0')}`;
  }

  /**
   * Enregistre un encaissement et impute automatiquement sur les breakdowns (priorité Inscription > Arriérés > Scolarité > Annexes).
   */
  async create(
    tenantId: string,
    data: {
      academicYearId: string;
      studentAccountId: string;
      amount: number;
      paymentMethod: PaymentMethod | string;
      reference?: string;
      cashierId: string;
      deviceId?: string;
      receiptUrl?: string;
      cashRegisterId?: string;  // ← NOUVEAU : caisse utilisée pour ce paiement
    },
  ) {
    const paymentMethod = (typeof data.paymentMethod === 'string' && PAYMENT_METHODS.includes(data.paymentMethod as PaymentMethod))
      ? (data.paymentMethod as PaymentMethod) : 'CASH';

    // Validation de la caisse si fournie
    if (data.cashRegisterId) {
      const register = await this.prisma.cashRegister.findFirst({
        where: { id: data.cashRegisterId, tenantId },
      });
      if (!register) {
        throw new NotFoundException('Caisse non trouvée');
      }
      if (!register.isActive) {
        throw new BadRequestException('Caisse archivée — paiements interdits.');
      }
      if (!register.isOpen) {
        throw new BadRequestException('Caisse fermée — ouvrez-la avant d\'encaisser.');
      }
    }

    const account = await this.prisma.studentAccount.findFirst({
      where: { id: data.studentAccountId, tenantId },
      include: {
        breakdowns: {
          include: { feeStructure: true },
          orderBy: { feeStructure: { feeType: 'asc' } },
        },
      },
    });
    if (!account) throw new NotFoundException('StudentAccount not found');

    let remaining = data.amount;
    const updates: { breakdownId: string; paidDelta: number; remainingDelta: number }[] = [];

    const sortedBreakdowns = [...account.breakdowns].sort((a, b) => {
      const ia = PRIORITY_ORDER.indexOf(a.feeStructure.feeType);
      const ib = PRIORITY_ORDER.indexOf(b.feeStructure.feeType);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    for (const b of sortedBreakdowns) {
      if (remaining <= 0) break;
      const rem = Number(b.remainingAmount);
      if (rem <= 0) continue;
      const pay = Math.min(remaining, rem);
      updates.push({
        breakdownId: b.id,
        paidDelta: pay,
        remainingDelta: -pay,
      });
      remaining -= pay;
    }

    // Génération du numéro de reçu avec vérification d'unicité + retry
    // (évite l'erreur "champ unique existe déjà" en cas de race condition)
    let receiptNumber = await this.receiptFinanceService.generateReceiptNumber(tenantId, data.academicYearId)
      .then((r) => r.local)
      .catch((err) => {
        this.logger.warn(`MatriculeGeneratorService failed, fallback to AH-YYYY-NNNNNN: ${err.message}`);
        return this.nextReceiptNumber(tenantId);
      });

    // Vérifier l'unicité — si le numéro existe déjà, incrémenter jusqu'à trouver un numéro libre
    for (let attempt = 0; attempt < 10; attempt++) {
      const existing = await this.prisma.financeTransaction.findFirst({
        where: { receiptNumber },
        select: { id: true },
      });
      if (!existing) break; // Numéro libre
      // Numéro déjà pris — incrémenter la séquence
      this.logger.warn(`Receipt number ${receiptNumber} already exists, trying next (attempt ${attempt + 1})`);
      const parts = receiptNumber.split('-');
      const seq = parseInt(parts[parts.length - 1], 10);
      const nextSeq = (isNaN(seq) ? 0 : seq) + 1;
      parts[parts.length - 1] = String(nextSeq).padStart(5, '0');
      receiptNumber = parts.join('-');
    }

    const tx = await this.prisma.financeTransaction.create({
      data: {
        tenantId,
        academicYearId: data.academicYearId,
        studentAccountId: data.studentAccountId,
        type: TransactionType.PAYMENT,
        amount: data.amount,
        paymentMethod,
        reference: data.reference ?? null,
        cashierId: data.cashierId,
        deviceId: data.deviceId ?? null,
        receiptNumber,
        receiptUrl: data.receiptUrl ?? null,
        cashRegisterId: data.cashRegisterId ?? null,
        allocations: updates.length
          ? { create: updates.map((u) => ({ accountBreakdownId: u.breakdownId, amount: u.paidDelta })) }
          : undefined,
      },
    });
    const integrityHash = crypto
      .createHash('sha256')
      .update(
        `${tenantId}|${data.studentAccountId}|${data.amount}|${TransactionType.PAYMENT}|${tx.createdAt.toISOString()}`,
      )
      .digest('hex');
    await this.prisma.financeTransaction.update({
      where: { id: tx.id },
      data: { integrityHash },
    });

    for (const u of updates) {
      await this.prisma.accountBreakdown.update({
        where: { id: u.breakdownId },
        data: {
          paidAmount: { increment: u.paidDelta },
          remainingAmount: { decrement: u.paidDelta },
        },
      });
    }

    // Mise à jour du solde de la caisse (multi-caisses)
    if (data.cashRegisterId) {
      try {
        await this.prisma.cashRegister.update({
          where: { id: data.cashRegisterId },
          data: { currentBalance: { increment: data.amount } },
        });
      } catch (err: any) {
        this.logger.error(`Failed to update cash register balance: ${err.message}`);
      }
    }

    // Note: totalPaid, balance and status are now updated via the DB Trigger 'update_balance_after_transaction'
    // on the finance_transactions table to ensure atomicity.

    // ─── Génération du reçu PDF (fire-and-forget) ─────────────────────────
    // Le PDF est généré en arrière-plan pour ne pas bloquer la réponse API.
    // Le receiptUrl sera mis à jour sur la transaction une fois le PDF prêt.
    this.receiptFinanceService
      .generateForTransaction(tx.id, tenantId)
      .then(({ receiptUrl }) => {
        this.logger.log(`Reçu PDF généré pour transaction ${tx.receiptNumber}: ${receiptUrl}`);
      })
      .catch((err) => {
        this.logger.error(`Échec génération reçu PDF pour ${tx.receiptNumber}: ${err.message}`);
      });

    return this.prisma.financeTransaction.findUnique({
      where: { id: tx.id },
      include: {
        studentAccount: { include: { breakdowns: true, student: true } },
        allocations: true,
        cashRegister: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async findAll(
    tenantId: string,
    filters: {
      academicYearId?: string;
      studentAccountId?: string;
      type?: string;
    },
  ) {
    const where: any = { tenantId };
    if (filters.academicYearId) where.academicYearId = filters.academicYearId;
    if (filters.studentAccountId) where.studentAccountId = filters.studentAccountId;
    if (filters.type) where.type = filters.type;

    return this.prisma.financeTransaction.findMany({
      where,
      include: { studentAccount: { include: { student: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Annulation par écriture inverse (REVERSAL). Revertit les imputations sur les breakdowns via les allocations enregistrées.
   */
  async reverse(
    transactionId: string,
    tenantId: string,
    reason: string,
    cashierId: string,
  ) {
    const original = await this.prisma.financeTransaction.findFirst({
      where: { id: transactionId, tenantId },
      include: { studentAccount: true, allocations: { include: { accountBreakdown: true } } },
    });
    if (!original) throw new NotFoundException('Transaction not found');
    if (original.type === TransactionType.REVERSAL) throw new BadRequestException('Cannot reverse a reversal');

    const reversalAmount = -Number(original.amount);
    const receiptNumber = await this.nextReceiptNumber(tenantId);

    const reversal = await this.prisma.financeTransaction.create({
      data: {
        tenantId,
        academicYearId: original.academicYearId,
        studentAccountId: original.studentAccountId,
        type: TransactionType.REVERSAL,
        amount: reversalAmount,
        paymentMethod: original.paymentMethod,
        reference: `Annulation: ${original.receiptNumber}. ${reason}`,
        reversedFromId: original.id,
        cashierId,
        receiptNumber,
      },
    });

    for (const alloc of original.allocations) {
      const amt = Number(alloc.amount);
      await this.prisma.accountBreakdown.update({
        where: { id: alloc.accountBreakdownId },
        data: {
          paidAmount: { decrement: amt },
          remainingAmount: { increment: amt },
        },
      });
    }

    // Note: totalPaid, balance and status are now updated via the DB Trigger.


    return this.prisma.financeTransaction.findUnique({
      where: { id: reversal.id },
      include: { studentAccount: true, reversedFrom: true },
    });
  }
}

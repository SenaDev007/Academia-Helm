/**
 * SOUS-MODULE 3 — Encaissements (FinanceTransaction)
 * Reçu AH-YYYY-NNNNNN, imputation prioritaire, hash d'intégrité (spec extension).
 */
import * as crypto from 'crypto';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TransactionType, PaymentMethod } from '@prisma/client';

const PRIORITY_ORDER = ['INSCRIPTION', 'REINSCRIPTION', 'TUITION', 'ANNEX', 'EXCEPTIONAL'];
const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'MOBILE_MONEY', 'WIRE', 'FEDAPAY'];

@Injectable()
export class FinanceTransactionService {
  constructor(private readonly prisma: PrismaService) {}

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
    },
  ) {
    const paymentMethod = (typeof data.paymentMethod === 'string' && PAYMENT_METHODS.includes(data.paymentMethod as PaymentMethod))
      ? (data.paymentMethod as PaymentMethod) : 'CASH';
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

    const receiptNumber = await this.nextReceiptNumber(tenantId);

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

    const newTotalPaid = Number(account.totalPaid) + data.amount;
    const newBalance = Number(account.balance) - data.amount;
    const status = newBalance <= 0 ? 'PAID' : 'PARTIAL';

    await this.prisma.studentAccount.update({
      where: { id: data.studentAccountId },
      data: {
        totalPaid: newTotalPaid,
        balance: newBalance,
        status,
        updatedAt: new Date(),
      },
    });

    return this.prisma.financeTransaction.findUnique({
      where: { id: tx.id },
      include: { studentAccount: { include: { breakdowns: true, student: true } }, allocations: true },
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

    await this.prisma.studentAccount.update({
      where: { id: original.studentAccountId },
      data: {
        totalPaid: { increment: reversalAmount },
        balance: { increment: -reversalAmount },
        status: Number(original.studentAccount.balance) + (-reversalAmount) <= 0 ? 'PAID' : 'PARTIAL',
        updatedAt: new Date(),
      },
    });

    return this.prisma.financeTransaction.findUnique({
      where: { id: reversal.id },
      include: { studentAccount: true, reversedFrom: true },
    });
  }
}

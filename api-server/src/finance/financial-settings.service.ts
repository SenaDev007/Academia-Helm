/**
 * SOUS-MODULE 8 — Paramétrage financier (FinancialSettings)
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class FinancialSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getForTenant(tenantId: string) {
    return this.prisma.financialSettings.findUnique({
      where: { tenantId },
    });
  }

  async getOrCreate(tenantId: string) {
    let s = await this.prisma.financialSettings.findUnique({ where: { tenantId } });
    if (!s) {
      s = await this.prisma.financialSettings.create({
        data: { tenantId },
      });
    }
    return s;
  }

  async update(
    tenantId: string,
    data: Partial<{
      blockingThreshold: number;
      allowPartialPayment: boolean;
      minimumInstallmentAmount: number | null;
      autoClosureEnabled: boolean;
      autoClosureTime: string;
      reminderWarningDays: number;
      reminderUrgentDays: number;
      reminderFinalDays: number;
      cancellationDelayHours: number;
      budgetAlertThreshold: number;
      expenseReceiptThreshold: number | null;
      fedapayEnabled: boolean;
      fedapayPublicKey: string | null;
      fedapaySecretKey: string | null;
    }>,
    performedById?: string,
  ) {
    const existing = await this.prisma.financialSettings.findUnique({ where: { tenantId } });
    const payload: Record<string, unknown> = { updatedAt: new Date() };
    if (data.blockingThreshold != null) payload.blockingThreshold = new Prisma.Decimal(data.blockingThreshold);
    if (data.allowPartialPayment != null) payload.allowPartialPayment = data.allowPartialPayment;
    if (data.minimumInstallmentAmount !== undefined) payload.minimumInstallmentAmount = data.minimumInstallmentAmount == null ? null : new Prisma.Decimal(data.minimumInstallmentAmount);
    if (data.autoClosureEnabled != null) payload.autoClosureEnabled = data.autoClosureEnabled;
    if (data.autoClosureTime != null) payload.autoClosureTime = data.autoClosureTime;
    if (data.reminderWarningDays != null) payload.reminderWarningDays = data.reminderWarningDays;
    if (data.reminderUrgentDays != null) payload.reminderUrgentDays = data.reminderUrgentDays;
    if (data.reminderFinalDays != null) payload.reminderFinalDays = data.reminderFinalDays;
    if (data.cancellationDelayHours != null) payload.cancellationDelayHours = data.cancellationDelayHours;
    if (data.budgetAlertThreshold != null) payload.budgetAlertThreshold = data.budgetAlertThreshold;
    if (data.expenseReceiptThreshold !== undefined) payload.expenseReceiptThreshold = data.expenseReceiptThreshold == null ? null : new Prisma.Decimal(data.expenseReceiptThreshold);
    if (data.fedapayEnabled != null) payload.fedapayEnabled = data.fedapayEnabled;
    if (data.fedapayPublicKey !== undefined) payload.fedapayPublicKey = data.fedapayPublicKey;
    if (data.fedapaySecretKey !== undefined) payload.fedapaySecretKey = data.fedapaySecretKey;

    const result = await this.prisma.financialSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...(payload as Record<string, unknown>) as any },
      update: payload as any,
    });
    if (performedById) {
      await this.prisma.financialAuditLog.create({
        data: {
          tenantId,
          entityType: 'FinancialSettings',
          entityId: result.id,
          action: 'UPDATE',
          oldValue: existing ? { blockingThreshold: existing.blockingThreshold?.toString(), autoClosureEnabled: existing.autoClosureEnabled } : undefined,
          newValue: payload as any,
          performedById,
        },
      });
    }
    return result;
  }
}

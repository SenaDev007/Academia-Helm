/**
 * SOUS-MODULE 6 — Clôture journalière (FinanceDailyClosure)
 * Calcul auto, type MANUAL/AUTO, cron 23h59, anomalie.
 */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ClosureType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class FinanceDailyClosureService {
  constructor(private readonly prisma: PrismaService) {}

  /** Clôture automatique à 23h59 : un jour par tenant/année si pas déjà clôturé. */
  @Cron('59 23 * * *')
  async runDailyAutoClosure() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const years = await this.prisma.academicYear.findMany({
      where: { isClosed: false },
      select: { id: true, tenantId: true },
    });
    for (const y of years) {
      try {
        await this.runAutoClosure(y.tenantId, y.id, yesterday);
      } catch (e) {
        console.error(`Auto closure failed tenant ${y.tenantId} year ${y.id}:`, e);
      }
    }
  }

  private async computeDay(tenantId: string, academicYearId: string, date: Date) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    const incomeRows = await this.prisma.financeTransaction.aggregate({
      where: {
        tenantId,
        academicYearId,
        type: 'PAYMENT',
        createdAt: { gte: dayStart, lte: dayEnd },
      },
      _sum: { amount: true },
    });
    const expenseRows = await this.prisma.financeExpense.aggregate({
      where: {
        tenantId,
        academicYearId,
        status: 'APPROVED',
        approvedAt: { gte: dayStart, lte: dayEnd },
      },
      _sum: { amount: true },
    });
    const totalIncome = Number(incomeRows._sum.amount ?? 0);
    const totalExpense = Number(expenseRows._sum.amount ?? 0);
    return { totalIncome, totalExpense, netBalance: totalIncome - totalExpense };
  }

  async findClosures(tenantId: string, academicYearId: string, from?: string, to?: string) {
    const where: Record<string, unknown> = { tenantId, academicYearId };
    if (from || to) {
      where.date = {};
      if (from) (where.date as Record<string, Date>).gte = new Date(from);
      if (to) (where.date as Record<string, Date>).lte = new Date(to);
    }
    return this.prisma.financeDailyClosure.findMany({
      where,
      include: { validator: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { date: 'desc' },
    });
  }

  async createClosure(
    tenantId: string,
    academicYearId: string,
    date: Date,
    validatedById: string | null,
    physicalAmount?: number | null,
    closureType: ClosureType = 'MANUAL',
  ) {
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    const existing = await this.prisma.financeDailyClosure.findUnique({
      where: { tenantId_academicYearId_date: { tenantId, academicYearId, date: dateOnly } },
    });
    if (existing) throw new BadRequestException('Une cloture existe deja pour cette date');
    const computed = await this.computeDay(tenantId, academicYearId, dateOnly);
    let anomalyDetected = false;
    let anomalyNote: string | null = null;
    let discrepancy: Decimal | null = null;
    if (physicalAmount != null) {
      const diff = physicalAmount - computed.netBalance;
      discrepancy = new Decimal(diff);
      if (Math.abs(diff) > 0.01) {
        anomalyDetected = true;
        anomalyNote = 'Ecart caisse: ' + diff.toFixed(2) + ' XOF';
      }
    }
    return this.prisma.financeDailyClosure.create({
      data: {
        tenantId,
        academicYearId,
        date: dateOnly,
        totalIncome: new Decimal(computed.totalIncome),
        totalExpense: new Decimal(computed.totalExpense),
        netBalance: new Decimal(computed.netBalance),
        closureType,
        validatedById: validatedById ?? null,
        validatedAt: validatedById ? new Date() : null,
        anomalyDetected,
        anomalyNote,
        physicalAmount: physicalAmount != null ? new Decimal(physicalAmount) : null,
        discrepancy,
      },
      include: { validator: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async validateClosure(id: string, tenantId: string, validatedById: string) {
    const c = await this.prisma.financeDailyClosure.findFirst({ where: { id, tenantId } });
    if (!c) throw new NotFoundException('Cloture introuvable');
    if (c.validatedById) throw new BadRequestException('Cloture deja validee');
    return this.prisma.financeDailyClosure.update({
      where: { id },
      data: { validatedById, validatedAt: new Date() },
      include: { validator: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async runAutoClosure(tenantId: string, academicYearId: string, date: Date) {
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    const existing = await this.prisma.financeDailyClosure.findUnique({
      where: { tenantId_academicYearId_date: { tenantId, academicYearId, date: dateOnly } },
    });
    if (existing) return existing;
    return this.createClosure(tenantId, academicYearId, dateOnly, null, null, 'AUTO');
  }
}

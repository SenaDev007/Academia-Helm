/**
 * ============================================================================
 * PAYROLL PRISMA SERVICE - MODULE 5 (SCHEMA-ALIGNED)
 * ============================================================================
 *
 * Service de gestion des périodes de paie et des lignes de paie,
 * strictement aligné sur le schéma Prisma v2.
 *
 * Modèles clés:
 *  - PayrollPeriod : Groupes de paie (OPEN → CALCULATED → VALIDATED → PAID)
 *  - Payroll       : Ligne de paie individuelle par agent/période
 *  - Payslip       : Bulletin PDF généré depuis une ligne de paie
 *  - PayrollRate   : Taux CNSS par tenant
 *
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class PayrollPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // PAYROLL PERIODS
  // ============================================================================

  async createPayrollPeriod(data: {
    tenantId: string;
    startDate: Date;
    endDate: Date;
  }) {
    const overlapping = await this.prisma.payrollPeriod.findFirst({
      where: {
        tenantId: data.tenantId,
        startDate: { lte: data.endDate },
        endDate: { gte: data.startDate },
      },
    });

    if (overlapping) {
      throw new BadRequestException('Une période de paie existe déjà pour ces dates.');
    }

    return this.prisma.payrollPeriod.create({
      data: {
        tenantId: data.tenantId,
        startDate: data.startDate,
        endDate: data.endDate,
        status: 'OPEN',
      },
    });
  }

  async findAllPeriods(tenantId: string) {
    const periods = await this.prisma.payrollPeriod.findMany({
      where: { tenantId },
      include: {
        _count: { select: { payrolls: true } },
        payrolls: {
          select: { netSalary: true }
        }
      },
      orderBy: { startDate: 'desc' },
    });

    return periods.map(p => ({
      ...p,
      totalAmount: p.payrolls.reduce((sum, pr) => sum + Number(pr.netSalary), 0)
    }));
  }

  async findPeriodById(id: string, tenantId: string) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id, tenantId },
      include: {
        payrolls: {
          include: {
            staff: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                staffCode: true,
                position: true,
                cnssNumber: true,
              },
            },
          },
        },
      },
    });

    if (!period) throw new NotFoundException(`Période de paie ${id} introuvable.`);
    return period;
  }

  async updatePeriodStatus(id: string, tenantId: string, status: string) {
    return this.prisma.payrollPeriod.update({
      where: { id },
      data: { status },
    });
  }

  // ============================================================================
  // PAYROLL LINES (par agent, par période)
  // ============================================================================

  /**
   * Génère automatiquement les lignes de paie pour tous les agents actifs
   * avec un contrat actif dans la période.
   */
  async generatePayrollsForPeriod(
    periodId: string,
    tenantId: string,
    academicYearId?: string,
  ) {
    const period = await this.findPeriodById(periodId, tenantId);

    if (period.status !== 'OPEN') {
      throw new BadRequestException('La période doit être en statut OPEN pour générer les lignes.');
    }

    const staffWithContracts = await this.prisma.staff.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        contracts: { some: { status: 'ACTIVE' } },
      },
      include: {
        contracts: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        allowances: {
          where: { isActive: true },
        },
      },
    });

    const results = [];

    for (const staff of staffWithContracts) {
      // Skip si une ligne existe déjà
      const existing = await this.prisma.payroll.findFirst({
        where: { payrollPeriodId: periodId, staffId: staff.id, tenantId },
      });
      if (existing) {
        results.push(existing);
        continue;
      }

      const contract = staff.contracts[0];
      const baseSalary = contract?.baseSalary ?? new Prisma.Decimal(0);

      // Somme des indemnités récurrentes actives
      const totalAllowances = staff.allowances.reduce(
        (acc, al) => acc.plus(al.amount),
        new Prisma.Decimal(0),
      );

      // Bonus ponctuels dans la période
      const bonuses = await this.prisma.oneTimeBonus.aggregate({
        where: {
          staffId: staff.id,
          tenantId,
          payrollPeriod: {
            gte: period.startDate,
            lte: period.endDate,
          },
        },
        _sum: { amount: true },
      });
      const totalBonuses = bonuses._sum.amount ?? new Prisma.Decimal(0);

      const grossSalary = baseSalary.plus(totalAllowances).plus(totalBonuses);

      const payroll = await this.prisma.payroll.create({
        data: {
          tenantId,
          payrollPeriodId: periodId,
          staffId: staff.id,
          academicYearId,
          baseSalary,
          allowances: totalAllowances,
          bonuses: totalBonuses,
          deductions: new Prisma.Decimal(0),
          grossSalary,
          employeeCNSS: new Prisma.Decimal(0),
          employerCNSS: new Prisma.Decimal(0),
          taxWithheld: new Prisma.Decimal(0),
          netSalary: grossSalary,
          status: 'DRAFT',
        },
      });

      results.push(payroll);
    }

    return results;
  }

  async findPayrollById(id: string, tenantId: string) {
    const p = await this.prisma.payroll.findFirst({
      where: { id, tenantId },
      include: {
        staff: true,
        payrollPeriod: true,
        payslips: true,
      },
    });
    if (!p) throw new NotFoundException(`Ligne de paie ${id} introuvable.`);
    return p;
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  async getPayrollStatistics(tenantId: string, academicYearId?: string) {
    const payrolls = await this.prisma.payroll.findMany({
      where: {
        tenantId,
        ...(academicYearId ? { academicYearId } : {}),
        status: 'PAID',
      },
    });

    const totalAmount = payrolls.reduce((s, p) => s + Number(p.netSalary), 0);
    const totalStaff = new Set(payrolls.map((p) => p.staffId)).size;

    return {
      totalAmount,
      totalStaff,
      totalPayrolls: payrolls.length,
    };
  }

  // ============================================================================
  // PAYROLL RATES (CNSS par tenant)
  // ============================================================================

  async findActivePayrollRate(tenantId: string, effectiveDate?: Date) {
    const date = effectiveDate ?? new Date();
    return this.prisma.payrollRate.findFirst({
      where: {
        tenantId,
        effectiveFrom: { lte: date },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: date } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async upsertPayrollRate(data: {
    tenantId: string;
    cnssEmployeeRate: number;
    cnssEmployerRate: number;
    taxRate?: number;
    effectiveFrom: Date;
    effectiveTo?: Date;
  }) {
    const existing = await this.prisma.payrollRate.findFirst({
      where: { tenantId: data.tenantId, effectiveFrom: data.effectiveFrom },
    });

    if (existing) {
      return this.prisma.payrollRate.update({
        where: { id: existing.id },
        data: {
          cnssEmployeeRate: data.cnssEmployeeRate,
          cnssEmployerRate: data.cnssEmployerRate,
          taxRate: data.taxRate,
          effectiveTo: data.effectiveTo,
        },
      });
    }

    return this.prisma.payrollRate.create({ data });
  }
}

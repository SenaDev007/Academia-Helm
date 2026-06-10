/**
 * ============================================================================
 * PAYROLL PRISMA SERVICE - MODULE 5 (SCHEMA-ALIGNED v3)
 * ============================================================================
 *
 * Service de gestion des lots de paie et des lignes de paie,
 * strictement aligné sur le schéma Prisma réel.
 *
 * Modèles clés:
 *  - Payroll        : Batch mensuel (DRAFT → CALCULATED → VALIDATED → PAID)
 *  - PayrollItem    : Ligne de paie individuelle par agent/batch
 *  - SalarySlip     : Bulletin PDF généré depuis une ligne de paie
 *  - CNSSRate       : Taux CNSS par pays (global, pas par tenant)
 *  - TaxRate        : Tranches IRPP par pays (global, pas par tenant)
 *  - TaxWithholding : Retenue fiscale calculée par tranche
 *  - StaffAllowance : Indemnités affectées au personnel
 *
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';
import { prismaCreateDefaults, prismaUpdateDefaults } from '../common/utils/prisma-helpers';

@Injectable()
export class PayrollPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // PAYROLL BATCHES (Payroll model = batch mensuel)
  // ============================================================================

  /**
   * Crée un lot de paie pour un mois donné
   */
  async createPayroll(data: {
    tenantId: string;
    academicYearId: string;
    month: string;
    startDate: Date;
    endDate: Date;
    schoolLevelId?: string;
    payrollPeriodId?: string;
    notes?: string;
  }) {
    // Vérifier qu'il n'y a pas déjà un lot pour ce mois (unique constraint)
    const existing = await this.prisma.payroll.findFirst({
      where: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        month: data.month,
      },
    });

    if (existing) {
      throw new BadRequestException(`Un lot de paie existe déjà pour le mois ${data.month}.`);
    }

    return this.prisma.payroll.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        schoolLevelId: data.schoolLevelId ?? null,
        payrollPeriodId: data.payrollPeriodId ?? null,
        month: data.month,
        startDate: data.startDate,
        endDate: data.endDate,
        status: 'DRAFT',
        totalAmount: new Prisma.Decimal(0),
        notes: data.notes ?? null,
      },
    });
  }

  /**
   * Liste tous les lots de paie avec le nombre de lignes et le montant total
   */
  async findAllPayrolls(tenantId: string, academicYearId?: string) {
    const where: Prisma.PayrollWhereInput = { tenantId };
    if (academicYearId) where.academicYearId = academicYearId;

    const payrolls = await this.prisma.payroll.findMany({
      where,
      include: {
        _count: { select: { items: true } },
        academicYear: {
          select: { id: true, name: true },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    return payrolls.map((p) => ({
      ...p,
      itemCount: p._count.items,
    }));
  }

  /**
   * Récupère un lot de paie avec ses lignes et les infos staff
   * Utilise employeeNumber (NOT staffCode) et roleType (NOT category)
   */
  async findPayrollById(id: string, tenantId: string) {
    const payroll = await this.prisma.payroll.findFirst({
      where: { id, tenantId },
      include: {
        items: {
          include: {
            staff: {
              select: {
                id: true,
                employeeNumber: true,
                firstName: true,
                lastName: true,
                position: true,
                roleType: true,
                employeeCNSS: {
                  select: { cnssNumber: true },
                },
              },
            },
            salarySlip: true,
          },
        },
        academicYear: {
          select: { id: true, name: true },
        },
      },
    });

    if (!payroll) throw new NotFoundException(`Lot de paie ${id} introuvable.`);
    return payroll;
  }

  /**
   * Met à jour le statut d'un lot de paie
   * DRAFT → CALCULATED → VALIDATED → PAID
   */
  async updatePayrollStatus(
    id: string,
    tenantId: string,
    status: string,
    processedBy?: string,
  ) {
    const payroll = await this.prisma.payroll.findFirst({
      where: { id, tenantId },
    });

    if (!payroll) {
      throw new NotFoundException(`Lot de paie ${id} introuvable.`);
    }

    const data: Prisma.PayrollUpdateInput = { status };

    if (status === 'CALCULATED' || status === 'VALIDATED') {
      data.processedBy = processedBy ?? null;
      data.processedAt = new Date();
    }

    if (status === 'PAID') {
      data.paidAt = new Date();
    }

    return this.prisma.payroll.update({
      where: { id },
      data: {
        ...prismaUpdateDefaults(),
        ...data,
      },
    });
  }

  // ============================================================================
  // PAYROLL ITEMS (Lignes individuelles)
  // ============================================================================

  /**
   * Génère automatiquement les lignes de paie (PayrollItem) pour tous les
   * agents actifs avec un contrat actif dans le lot.
   * Calcule CNSS depuis CNSSRate et IRPP depuis TaxRate brackets.
   */
  async generatePayrollItems(
    payrollId: string,
    tenantId: string,
    academicYearId?: string,
  ) {
    const payroll = await this.findPayrollById(payrollId, tenantId);

    if (payroll.status !== 'DRAFT') {
      throw new BadRequestException('Le lot doit être en statut DRAFT pour générer les lignes.');
    }

    // Récupérer le code pays du tenant pour les taux CNSS/IRPP
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { country: { select: { code: true } } },
    });
    const countryCode = tenant?.country?.code ?? 'GN';

    // Récupérer les taux CNSS actifs
    const cnssRate = await this.findActiveCNSSRate(countryCode);

    // Récupérer les tranches IRPP actives
    const taxRates = await this.findActiveTaxRates(countryCode);

    // Trouver le personnel actif avec contrat actif ou en attente
    const staffWithContracts = await this.prisma.staff.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        contracts: { some: { status: { in: ['ACTIVE', 'PENDING'] } } },
      },
      include: {
        contracts: {
          where: { status: { in: ['ACTIVE', 'PENDING'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        staffAllowances: {
          where: { status: 'ACTIVE' },
          include: { allowanceType: true },
        },
      },
    });

    return this.prisma.$transaction(async (tx) => {
      const results = [];

      for (const staff of staffWithContracts) {
        // Skip si une ligne existe déjà pour ce staff dans ce lot
        const existing = await tx.payrollItem.findFirst({
          where: { payrollId, staffId: staff.id, tenantId },
        });
        if (existing) {
          results.push(existing);
          continue;
        }

        const contract = staff.contracts[0];
        // Utiliser staff.salary ou contract.baseSalary comme base
        const baseSalary =
          staff.salary ?? contract?.baseSalary ?? new Prisma.Decimal(0);

        // Somme des indemnités actives
        const totalAllowances = staff.staffAllowances.reduce(
          (acc, sa) => acc.plus(sa.amount),
          new Prisma.Decimal(0),
        );

        // Calculer les heures supplémentaires validées dans la période
        const overtimeRecords = await this.prisma.overtimeRecord.findMany({
          where: {
            staffId: staff.id,
            tenantId,
            validated: true,
            date: {
              gte: payroll.startDate,
              lte: payroll.endDate,
            },
          },
        });
        const overtimeHours = overtimeRecords.reduce(
          (acc, r) => acc.plus(r.hours),
          new Prisma.Decimal(0),
        );

        // Calculer le taux horaire depuis PayrollRate si disponible, sinon baseSalary / 173.33
        const payrollRate = await this.findActivePayrollRate(tenantId, countryCode, staff.roleType);
        const hourlyRate = payrollRate
          ? payrollRate.hourlyRate
          : baseSalary.div(new Prisma.Decimal(173.33));
        const overtimeMultiplier = payrollRate
          ? payrollRate.overtimeMultiplier
          : new Prisma.Decimal(1.5);
        const overtimeAmount = hourlyRate.times(overtimeHours).times(overtimeMultiplier);

        // Calculer les primes ponctuelles approuvées non affectées
        const bonuses = await this.calculateStaffBonuses(staff.id, tenantId);

        // Calcul CNSS
        let cnssEmployee = new Prisma.Decimal(0);
        let cnssEmployer = new Prisma.Decimal(0);

        if (cnssRate) {
          const ceiling = cnssRate.salaryCeiling
            ? Prisma.Decimal.min(baseSalary, cnssRate.salaryCeiling)
            : baseSalary;
          cnssEmployee = ceiling.times(cnssRate.employeeRate);
          cnssEmployer = ceiling.times(cnssRate.employerRate);
        }

        // Salaire brut = base + indemnités + heures supp + primes
        const grossSalary = baseSalary
          .plus(totalAllowances)
          .plus(overtimeAmount)
          .plus(bonuses);

        // Montant imposable = brut - cotisation CNSS employé
        const taxableAmount = grossSalary.minus(cnssEmployee);

        // Calcul IRPP par tranches progressives
        let irppAmount = new Prisma.Decimal(0);
        if (taxRates.length > 0 && taxableAmount.greaterThan(0)) {
          let remaining = taxableAmount;

          for (const bracket of taxRates) {
            if (remaining.lessThanOrEqualTo(0)) break;

            const bracketWidth = bracket.bracketMax
              ? Prisma.Decimal.min(remaining, bracket.bracketMax.minus(bracket.bracketMin))
              : remaining;

            const taxableInBracket = Prisma.Decimal.max(
              new Prisma.Decimal(0),
              Prisma.Decimal.min(remaining, bracketWidth),
            );

            irppAmount = irppAmount.plus(
              taxableInBracket.times(bracket.ratePercentage).div(100),
            );

            if (bracket.bracketMax) {
              remaining = remaining.minus(bracket.bracketMax.minus(bracket.bracketMin));
            } else {
              remaining = new Prisma.Decimal(0);
            }
          }
        }

        const otherDeductions = new Prisma.Decimal(0);
        const totalDeductions = cnssEmployee
          .plus(irppAmount)
          .plus(otherDeductions);
        const netSalary = grossSalary.minus(totalDeductions);

        const payrollItem = await tx.payrollItem.create({
          data: {
            ...prismaCreateDefaults(),
            tenantId,
            academicYearId: academicYearId ?? payroll.academicYearId,
            schoolLevelId: payroll.schoolLevelId,
            payrollId,
            staffId: staff.id,
            baseSalary,
            overtimeAmount,
            bonuses,
            grossSalary,
            cnssEmployee,
            cnssEmployer,
            taxableAmount,
            irppAmount,
            otherDeductions,
            totalDeductions,
            netSalary,
            status: 'PENDING',
          },
        });

        results.push(payrollItem);
      }

      // Mettre à jour le totalAmount du batch
      const totalAmount = results.reduce(
        (sum, item) => sum.plus(item.netSalary),
        new Prisma.Decimal(0),
      );
      await tx.payroll.update({
        where: { id: payrollId },
        data: {
          ...prismaUpdateDefaults(),
          totalAmount,
        },
      });

      return results;
    });
  }

  /**
   * Récupère une ligne de paie individuelle
   * Utilise employeeNumber (NOT staffCode) et roleType (NOT category)
   */
  async findPayrollItemById(id: string, tenantId: string) {
    const item = await this.prisma.payrollItem.findFirst({
      where: { id, tenantId },
      include: {
        staff: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            position: true,
            roleType: true,
            employeeCNSS: { select: { cnssNumber: true } },
          },
        },
        payroll: true,
        salarySlip: true,
      },
    });
    if (!item) throw new NotFoundException(`Ligne de paie ${id} introuvable.`);
    return item;
  }

  /**
   * Recalcule une ligne de paie individuelle
   * (gross, déductions CNSS/IRPP, net)
   */
  async calculatePayrollItem(id: string, tenantId: string, client?: any) {
    const db = client ?? this.prisma;
    const item = await db.payrollItem.findFirst({
      where: { id, tenantId },
      include: {
        payroll: true,
        staff: {
          include: {
            staffAllowances: {
              where: { status: 'ACTIVE' },
              include: { allowanceType: true },
            },
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException(`Ligne de paie ${id} introuvable.`);
    }

    // Récupérer le code pays du tenant pour les taux
    const tenantData = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { country: { select: { code: true } } },
    });
    const countryCode = tenantData?.country?.code ?? 'GN';

    const cnssRate = await this.findActiveCNSSRate(countryCode);
    const taxRates = await this.findActiveTaxRates(countryCode);

    // Base salary
    const baseSalary = item.baseSalary;

    // Allowances
    const totalAllowances = item.staff.staffAllowances.reduce(
      (acc, sa) => acc.plus(sa.amount),
      new Prisma.Decimal(0),
    );

    // Overtime
    const overtimeRecords = await this.prisma.overtimeRecord.findMany({
      where: {
        staffId: item.staffId,
        tenantId,
        validated: true,
        date: {
          gte: item.payroll.startDate,
          lte: item.payroll.endDate,
        },
      },
    });
    const overtimeHours = overtimeRecords.reduce(
      (acc, r) => acc.plus(r.hours),
      new Prisma.Decimal(0),
    );
    // Calculer le taux horaire depuis PayrollRate si disponible, sinon baseSalary / 173.33
    const payrollRate = await this.findActivePayrollRate(tenantId, countryCode, item.staff.roleType);
    const hourlyRate = payrollRate
      ? payrollRate.hourlyRate
      : baseSalary.div(new Prisma.Decimal(173.33));
    const overtimeMultiplier = payrollRate
      ? payrollRate.overtimeMultiplier
      : new Prisma.Decimal(1.5);
    const overtimeAmount = hourlyRate.times(overtimeHours).times(overtimeMultiplier);

    // Calculer les primes ponctuelles approuvées
    const bonuses = await this.calculateStaffBonuses(item.staffId, tenantId);

    // CNSS
    let cnssEmployee = new Prisma.Decimal(0);
    let cnssEmployer = new Prisma.Decimal(0);

    if (cnssRate) {
      const ceiling = cnssRate.salaryCeiling
        ? Prisma.Decimal.min(baseSalary, cnssRate.salaryCeiling)
        : baseSalary;
      cnssEmployee = ceiling.times(cnssRate.employeeRate);
      cnssEmployer = ceiling.times(cnssRate.employerRate);
    }

    // Gross salary
    const grossSalary = baseSalary
      .plus(totalAllowances)
      .plus(overtimeAmount)
      .plus(bonuses);

    // Taxable amount
    const taxableAmount = grossSalary.minus(cnssEmployee);

    // IRPP par tranches progressives
    let irppAmount = new Prisma.Decimal(0);
    if (taxRates.length > 0 && taxableAmount.greaterThan(0)) {
      let remaining = taxableAmount;

      for (const bracket of taxRates) {
        if (remaining.lessThanOrEqualTo(0)) break;

        const bracketWidth = bracket.bracketMax
          ? Prisma.Decimal.min(remaining, bracket.bracketMax.minus(bracket.bracketMin))
          : remaining;

        const taxableInBracket = Prisma.Decimal.max(
          new Prisma.Decimal(0),
          Prisma.Decimal.min(remaining, bracketWidth),
        );

        irppAmount = irppAmount.plus(
          taxableInBracket.times(bracket.ratePercentage).div(100),
        );

        if (bracket.bracketMax) {
          remaining = remaining.minus(bracket.bracketMax.minus(bracket.bracketMin));
        } else {
          remaining = new Prisma.Decimal(0);
        }
      }
    }

    const otherDeductions = item.otherDeductions;
    const totalDeductions = cnssEmployee
      .plus(irppAmount)
      .plus(otherDeductions);
    const netSalary = grossSalary.minus(totalDeductions);

    return db.payrollItem.update({
      where: { id },
      data: {
        ...prismaUpdateDefaults(),
        overtimeAmount,
        bonuses,
        grossSalary,
        cnssEmployee,
        cnssEmployer,
        taxableAmount,
        irppAmount,
        totalDeductions,
        netSalary,
        status: 'CALCULATED',
        calculatedAt: new Date(),
      },
    });
  }

  /**
   * Calcule toutes les lignes d'un lot de paie et met à jour le totalAmount
   */
  async calculateAllItems(payrollId: string, tenantId: string) {
    const payroll = await this.prisma.payroll.findFirst({
      where: { id: payrollId, tenantId },
      include: { items: true },
    });

    if (!payroll) {
      throw new NotFoundException(`Lot de paie ${payrollId} introuvable.`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Calculer chaque ligne
      const calculatedItems = [];
      for (const item of payroll.items) {
        const calculated = await this.calculatePayrollItem(item.id, tenantId, tx);
        calculatedItems.push(calculated);
      }

      // Mettre à jour le totalAmount du batch
      const totalAmount = calculatedItems.reduce(
        (sum, item) => sum.plus(item.netSalary),
        new Prisma.Decimal(0),
      );

      await tx.payroll.update({
        where: { id: payrollId },
        data: {
          ...prismaUpdateDefaults(),
          totalAmount,
          status: 'CALCULATED',
          processedAt: new Date(),
        },
      });

      return {
        payrollId,
        totalAmount,
        itemCount: calculatedItems.length,
        items: calculatedItems,
      };
    });
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  /**
   * Statistiques agrégées depuis les PayrollItems
   */
  async getPayrollStatistics(tenantId: string, academicYearId?: string) {
    const where: Prisma.PayrollItemWhereInput = { tenantId };
    if (academicYearId) where.academicYearId = academicYearId;

    const itemWhere = {
      ...where,
      status: { in: ['VALIDATED', 'PAID'] } as Prisma.PayrollItemWhereInput['status'],
    };

    // Use Prisma aggregate instead of loading all records into memory
    const [itemStats, itemCount, distinctStaff] = await Promise.all([
      this.prisma.payrollItem.aggregate({
        where: itemWhere,
        _sum: {
          netSalary: true,
          grossSalary: true,
          totalDeductions: true,
          cnssEmployee: true,
          cnssEmployer: true,
          irppAmount: true,
        },
      }),
      this.prisma.payrollItem.count({ where: itemWhere }),
      this.prisma.payrollItem.findMany({
        where: itemWhere,
        select: { staffId: true },
        distinct: ['staffId'],
      }),
    ]);

    // Stats par batch Payroll
    const payrollWhere: Prisma.PayrollWhereInput = { tenantId };
    if (academicYearId) payrollWhere.academicYearId = academicYearId;
    const payrollItemWhere2 = {
      ...payrollWhere,
      status: { in: ['VALIDATED', 'PAID'] } as Prisma.PayrollWhereInput['status'],
    };

    const [payrollStats, payrollCount] = await Promise.all([
      this.prisma.payroll.aggregate({
        where: payrollItemWhere2,
        _sum: { totalAmount: true },
      }),
      this.prisma.payroll.count({ where: payrollItemWhere2 }),
    ]);

    return {
      totalNetSalary: Number(itemStats._sum.netSalary ?? 0),
      totalGrossSalary: Number(itemStats._sum.grossSalary ?? 0),
      totalDeductions: Number(itemStats._sum.totalDeductions ?? 0),
      totalCnssEmployee: Number(itemStats._sum.cnssEmployee ?? 0),
      totalCnssEmployer: Number(itemStats._sum.cnssEmployer ?? 0),
      totalIrpp: Number(itemStats._sum.irppAmount ?? 0),
      totalPayrollAmount: Number(payrollStats._sum.totalAmount ?? 0),
      totalStaff: distinctStaff.length,
      totalPayrollItems: itemCount,
      totalPayrollBatches: payrollCount,
    };
  }

  // ============================================================================
  // PAYROLL PERIODS
  // ============================================================================

  /**
   * Crée une période de paie
   */
  async createPayrollPeriod(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId?: string;
    name: string;
    periodType?: string;
    month?: string;
    startDate: Date;
    endDate: Date;
  }) {
    return this.prisma.payrollPeriod.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        schoolLevelId: data.schoolLevelId ?? null,
        name: data.name,
        periodType: data.periodType ?? 'MONTHLY',
        month: data.month ?? null,
        startDate: data.startDate,
        endDate: data.endDate,
        status: 'OPEN',
      },
    });
  }

  /**
   * Liste toutes les périodes de paie d'un tenant
   */
  async findAllPayrollPeriods(tenantId: string, academicYearId?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (academicYearId) where.academicYearId = academicYearId;

    return this.prisma.payrollPeriod.findMany({
      where,
      include: {
        _count: { select: { payrolls: true } },
        academicYear: { select: { id: true, name: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  /**
   * Récupère une période de paie par ID
   */
  async findPayrollPeriodById(id: string, tenantId: string) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id, tenantId },
      include: {
        payrolls: true,
        academicYear: { select: { id: true, name: true } },
      },
    });
    if (!period) throw new NotFoundException(`Période de paie ${id} introuvable.`);
    return period;
  }

  /**
   * Ferme une période de paie (empêche toute modification)
   */
  async closePayrollPeriod(id: string, tenantId: string, closedBy: string) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id, tenantId },
    });
    if (!period) throw new NotFoundException(`Période de paie ${id} introuvable.`);
    if (period.status === 'CLOSED' || period.status === 'LOCKED') {
      throw new BadRequestException(`La période est déjà ${period.status}.`);
    }

    return this.prisma.payrollPeriod.update({
      where: { id },
      data: {
        ...prismaUpdateDefaults(),
        status: 'CLOSED',
        closedBy,
        closedAt: new Date(),
      },
    });
  }

  // ============================================================================
  // PAYROLL RATES (Taux salariaux par rôle/grade)
  // ============================================================================

  /**
   * Crée ou met à jour un taux salarial
   */
  async upsertPayrollRate(data: {
    tenantId: string;
    countryCode: string;
    roleType: string;
    grade?: string;
    monthlyBaseSalary: number;
    hourlyRate: number;
    overtimeMultiplier?: number;
    effectiveFrom: Date;
    effectiveTo?: Date;
  }) {
    const existing = await this.prisma.payrollRate.findFirst({
      where: {
        tenantId: data.tenantId,
        countryCode: data.countryCode,
        roleType: data.roleType,
        grade: data.grade ?? null,
        effectiveFrom: data.effectiveFrom,
      },
    });

    if (existing) {
      return this.prisma.payrollRate.update({
        where: { id: existing.id },
        data: {
          ...prismaUpdateDefaults(),
          monthlyBaseSalary: data.monthlyBaseSalary,
          hourlyRate: data.hourlyRate,
          overtimeMultiplier: data.overtimeMultiplier ?? 1.5,
          effectiveTo: data.effectiveTo ?? null,
        },
      });
    }

    return this.prisma.payrollRate.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId: data.tenantId,
        countryCode: data.countryCode,
        roleType: data.roleType,
        grade: data.grade ?? null,
        monthlyBaseSalary: data.monthlyBaseSalary,
        hourlyRate: data.hourlyRate,
        overtimeMultiplier: data.overtimeMultiplier ?? 1.5,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo ?? null,
      },
    });
  }

  /**
   * Liste tous les taux salariaux d'un tenant
   */
  async findAllPayrollRates(tenantId: string, countryCode?: string) {
    const where: Record<string, unknown> = { tenantId, isActive: true };
    if (countryCode) where.countryCode = countryCode;

    return this.prisma.payrollRate.findMany({
      where,
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  /**
   * Récupère le taux salarial actif pour un rôle/pays
   */
  async findActivePayrollRate(tenantId: string, countryCode: string, roleType: string) {
    const date = new Date();
    return this.prisma.payrollRate.findFirst({
      where: {
        tenantId,
        countryCode,
        roleType,
        isActive: true,
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  // ============================================================================
  // ONE-TIME BONUSES
  // ============================================================================

  /**
   * Crée une prime ponctuelle
   */
  async createOneTimeBonus(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId?: string;
    staffId: string;
    amount: number;
    reason: string;
    bonusType?: string;
    authorizedBy: string;
  }) {
    return this.prisma.oneTimeBonus.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        schoolLevelId: data.schoolLevelId ?? null,
        staffId: data.staffId,
        amount: new Prisma.Decimal(data.amount),
        reason: data.reason,
        bonusType: data.bonusType ?? 'OTHER',
        authorizedBy: data.authorizedBy,
        status: 'PENDING',
      },
      include: {
        staff: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } },
      },
    });
  }

  /**
   * Liste toutes les primes ponctuelles d'un tenant
   */
  async findAllOneTimeBonuses(
    tenantId: string,
    filters?: { staffId?: string; status?: string; bonusType?: string },
  ) {
    const where: Record<string, unknown> = { tenantId };
    if (filters?.staffId) where.staffId = filters.staffId;
    if (filters?.status) where.status = filters.status;
    if (filters?.bonusType) where.bonusType = filters.bonusType;

    return this.prisma.oneTimeBonus.findMany({
      where,
      include: {
        staff: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } },
        authorizer: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Approuve une prime ponctuelle
   */
  async approveOneTimeBonus(id: string, tenantId: string, approvedBy: string) {
    const bonus = await this.prisma.oneTimeBonus.findFirst({
      where: { id, tenantId },
    });
    if (!bonus) throw new NotFoundException(`Prime ${id} introuvable.`);
    if (bonus.status !== 'PENDING') {
      throw new BadRequestException(`La prime est déjà ${bonus.status}.`);
    }

    return this.prisma.oneTimeBonus.update({
      where: { id },
      data: {
        ...prismaUpdateDefaults(),
        status: 'APPROVED',
        approvedBy,
        approvedAt: new Date(),
      },
    });
  }

  /**
   * Supprime un lot de paie (seulement si DRAFT)
   */
  async deletePayrollBatch(id: string, tenantId: string) {
    const payroll = await this.prisma.payroll.findFirst({
      where: { id, tenantId },
    });
    if (!payroll) {
      throw new NotFoundException(`Payroll batch ${id} not found`);
    }
    if (payroll.status !== 'DRAFT') {
      throw new BadRequestException('Seuls les lots en brouillon peuvent être supprimés.');
    }
    // Delete associated items first
    await this.prisma.payrollItem.deleteMany({ where: { payrollId: id } });
    return this.prisma.payroll.delete({ where: { id } });
  }

  /**
   * Supprime une période de paie (seulement si OPEN)
   */
  async deletePayrollPeriod(id: string, tenantId: string) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id, tenantId },
    });
    if (!period) {
      throw new NotFoundException(`Payroll period ${id} not found`);
    }
    if (period.status !== 'OPEN') {
      throw new BadRequestException('Seules les périodes ouvertes peuvent être supprimées.');
    }
    return this.prisma.payrollPeriod.delete({ where: { id } });
  }

  /**
   * Supprime une prime ponctuelle
   */
  async deleteOneTimeBonus(id: string, tenantId: string) {
    const bonus = await this.prisma.oneTimeBonus.findFirst({
      where: { id, tenantId },
    });
    if (!bonus) {
      throw new NotFoundException(`Bonus ${id} not found`);
    }
    return this.prisma.oneTimeBonus.delete({ where: { id } });
  }

  /**
   * Calcule le total des primes approuvées pour un staff dans une période
   */
  async calculateStaffBonuses(staffId: string, tenantId: string, payrollItemId?: string) {
    const where: Record<string, unknown> = {
      staffId,
      tenantId,
      status: 'APPROVED',
    };
    if (payrollItemId) where.payrollItemId = null; // Non encore affectées

    const bonuses = await this.prisma.oneTimeBonus.findMany({ where });
    return bonuses.reduce((sum, b) => sum.plus(b.amount), new Prisma.Decimal(0));
  }

  // ============================================================================
  // CNSS RATES (CNSSRate model — global par pays, pas par tenant)
  // ============================================================================

  /**
   * Récupère le taux CNSS actif pour un pays à une date donnée
   */
  async findActiveCNSSRate(countryCode: string, effectiveDate?: Date) {
    const date = effectiveDate ?? new Date();
    return this.prisma.cNSSRate.findFirst({
      where: {
        countryCode,
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  /**
   * Crée ou met à jour un taux CNSS
   */
  async upsertCNSSRate(data: {
    countryCode: string;
    employeeRate: number;
    employerRate: number;
    salaryCeiling?: number;
    effectiveFrom: Date;
    effectiveTo?: Date;
  }) {
    const existing = await this.prisma.cNSSRate.findFirst({
      where: {
        countryCode: data.countryCode,
        effectiveFrom: data.effectiveFrom,
      },
    });

    if (existing) {
      return this.prisma.cNSSRate.update({
        where: { id: existing.id },
        data: {
          ...prismaUpdateDefaults(),
          employeeRate: data.employeeRate,
          employerRate: data.employerRate,
          salaryCeiling: data.salaryCeiling ?? null,
          effectiveTo: data.effectiveTo ?? null,
        },
      });
    }

    return this.prisma.cNSSRate.create({
      data: {
        ...prismaCreateDefaults(),
        countryCode: data.countryCode,
        employeeRate: data.employeeRate,
        employerRate: data.employerRate,
        salaryCeiling: data.salaryCeiling ?? null,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo ?? null,
      },
    });
  }

  // ============================================================================
  // TAX RATES (TaxRate model — global par pays, pas par tenant)
  // ============================================================================

  /**
   * Récupère les tranches IRPP actives pour un pays
   * triées par bracketMin croissant
   */
  async findActiveTaxRates(countryCode: string, taxType?: string) {
    const date = new Date();
    return this.prisma.taxRate.findMany({
      where: {
        countryCode,
        taxType: taxType ?? 'IRPP',
        isActive: true,
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      },
      orderBy: { bracketMin: 'asc' },
    });
  }

  // ============================================================================
  // SALARY SLIPS
  // ============================================================================

  /**
   * Récupère le bulletin de salaire d'une ligne de paie
   */
  async findSalarySlipByPayrollItemId(payrollItemId: string) {
    return this.prisma.salarySlip.findUnique({
      where: { payrollItemId },
    });
  }

  /**
   * Crée ou récupère le bulletin de salaire pour une ligne de paie
   */
  async ensureSalarySlip(
    payrollItemId: string,
    tenantId: string,
    issuedBy?: string,
  ) {
    const existing = await this.prisma.salarySlip.findUnique({
      where: { payrollItemId },
    });

    if (existing) return existing;

    const item = await this.findPayrollItemById(payrollItemId, tenantId);
    const receiptNumber = `SLP-${Date.now()}-${payrollItemId.substring(0, 8)}`;

    return this.prisma.salarySlip.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId,
        payrollItemId,
        receiptNumber,
        period: item.payroll?.month ?? '',
        pdfGenerated: false,
        issuedBy: issuedBy ?? null,
      },
    });
  }
}

/**
 * ============================================================================
 * PAYROLL TAX SERVICE - MODULE 5 (SCHEMA-ALIGNED v2)
 * ============================================================================
 *
 * Service d'intégration fiscale (IRPP + CNSS) dans le calcul de la paie.
 *
 * Processus :
 *  1. Récupérer le taux CNSS du pays (CNSSRate)
 *  2. Calculer les parts CNSS employé/employeur sur le PayrollItem
 *  3. Calculer le net imposable (brut - CNSS employé)
 *  4. Calculer l'IRPP via les barèmes progressifs (TaxRate countryCode='BJ')
 *  5. Mettre à jour le PayrollItem avec tous les montants
 *  6. Enregistrer la TaxWithholding pour l'audit
 *
 * ============================================================================
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TaxService } from './tax.service';
import { PayrollPrismaService } from '../payroll-prisma.service';

@Injectable()
export class PayrollTaxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxService: TaxService,
    private readonly payrollService: PayrollPrismaService,
  ) {}

  /**
   * Calcule les retenues sociales et fiscales pour un PayrollItem,
   * adaptable à n'importe quel pays de la zone UEMOA/CEDEAO.
   */
  async calculatePayroll(
    tenantId: string,
    academicYearId: string,
    payrollItemId: string,
    countryCode: string = 'BJ',
  ) {
    // 1. Récupérer le PayrollItem avec le staff
    const payrollItem = await this.prisma.payrollItem.findFirst({
      where: { id: payrollItemId, tenantId },
      include: {
        staff: {
          include: {
            employeeCNSS: true,
          },
        },
        payroll: {
          include: {
            tenant: {
              include: { country: true },
            },
          },
        },
      },
    });

    if (!payrollItem) {
      throw new NotFoundException(`Ligne de paie ${payrollItemId} introuvable.`);
    }

    // Récupérer le code pays (ex: 'BJ', 'SN', 'TG')
    if (payrollItem.payroll?.tenant?.country?.code) {
      countryCode = payrollItem.payroll.tenant.country.code;
    }

    // 2. Brut
    const grossSalary = Number(payrollItem.grossSalary);

    // 3. Retenues Sociales (CNSS/IPRES/CNPS selon pays)
    let socialEmployeeShare = 0;
    let socialEmployerShare = 0;

    if (payrollItem.staff.employeeCNSS?.isActive && payrollItem.staff.employeeCNSS?.cnssNumber) {
      const rate = await this.payrollService.findActiveCNSSRate(countryCode);
      if (rate) {
        let salaryBase = grossSalary;
        // Appliquer le plafond si défini
        if (rate.salaryCeiling && grossSalary > Number(rate.salaryCeiling)) {
          salaryBase = Number(rate.salaryCeiling);
        }
        socialEmployeeShare = salaryBase * Number(rate.employeeRate);
        socialEmployerShare = salaryBase * Number(rate.employerRate);
      }
    }

    // 4. Net imposable
    const taxableAmount = grossSalary - socialEmployeeShare;

    // 5. Impôt sur le Revenu (IRPP/ITS/etc.)
    let incomeTaxAmount = 0;
    let taxRateId: string | undefined;
    let breakdown: any[] = [];

    try {
      const taxResult = await this.taxService.calculateIRPP(
        countryCode,
        taxableAmount,
        payrollItem.payroll?.startDate,
      );
      incomeTaxAmount = taxResult.amount;
      taxRateId = taxResult.taxRateId;
      breakdown = taxResult.breakdown;
    } catch {
      incomeTaxAmount = 0;
    }

    // 6. Déductions manuelles
    const otherDeductions = Number(payrollItem.otherDeductions || 0);

    // 7. Total déductions
    const totalDeductions = socialEmployeeShare + incomeTaxAmount + otherDeductions;

    // 8. Net à payer
    const netSalary = grossSalary - totalDeductions;

    // 9. Mise à jour du PayrollItem
    const updated = await this.prisma.payrollItem.update({
      where: { id: payrollItemId },
      data: {
        cnssEmployee: socialEmployeeShare,
        cnssEmployer: socialEmployerShare,
        taxableAmount,
        irppAmount: incomeTaxAmount,
        otherDeductions,
        totalDeductions,
        netSalary,
        status: 'VALIDATED',
        validatedAt: new Date(),
      },
    });

    // 10. Enregistrement audit TaxWithholding
    if (taxableAmount > 0) {
      await this.taxService.recordTaxWithholding(
        tenantId,
        academicYearId,
        payrollItemId,
        payrollItem.staffId,
        taxRateId ?? null,
        'IRPP',
        taxableAmount,
        incomeTaxAmount,
        { breakdown, method: `PROGRESSIVE_${countryCode}` },
      );
    }

    return { ...updated, irppBreakdown: breakdown };
  }

  /**
   * Calcule tous les PayrollItems d'un lot de paie
   */
  async calculatePeriod(
    payrollId: string,
    tenantId: string,
    academicYearId: string,
  ) {
    const payroll = await this.prisma.payroll.findFirst({
      where: { id: payrollId, tenantId },
      include: { items: true },
    });

    if (!payroll) throw new NotFoundException('Lot de paie introuvable.');

    const results = [];
    for (const item of payroll.items) {
      const result = await this.calculatePayroll(tenantId, academicYearId, item.id);
      results.push(result);
    }

    // Marquer le lot comme calculé
    await this.prisma.payroll.update({
      where: { id: payrollId },
      data: { status: 'CALCULATED' },
    });

    return { calculated: results.length, payrollId };
  }
}

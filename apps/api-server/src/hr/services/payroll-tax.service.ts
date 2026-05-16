/**
 * ============================================================================
 * PAYROLL TAX SERVICE - MODULE 5 (SCHEMA-ALIGNED)
 * ============================================================================
 *
 * Service d'intégration fiscale (IRPP + CNSS) dans le calcul de la paie.
 *
 * Processus :
 *  1. Récupérer le taux CNSS du tenant (PayrollRate)
 *  2. Calculer les parts CNSS employé/employeur
 *  3. Calculer le net imposable (brut - CNSS employé)
 *  4. Calculer l'IRPP via les barèmes progressifs (TaxRate countryCode='BJ')
 *  5. Mettre à jour la ligne Payroll avec tous les montants
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
   * Calcule les retenues sociales et fiscales pour une ligne de paie,
   * adaptable à n'importe quel pays de la zone UEMOA/CEDEAO.
   */
  async calculatePayroll(
    tenantId: string,
    academicYearId: string,
    payrollId: string,
  ) {
    // 1. Récupérer la paie et le pays du tenant
    const payroll = await this.prisma.payroll.findFirst({
      where: { id: payrollId, tenantId },
      include: {
        staff: true,
        payrollPeriod: true,
        tenant: {
          select: {
            countryId: true,
          }
        }
      },
    });

    if (!payroll) {
      throw new NotFoundException(`Ligne de paie ${payrollId} introuvable.`);
    }

    // Récupérer le code pays (ex: 'BJ', 'SN', 'TG')
    let countryCode = 'BJ'; // Valeur par défaut
    if (payroll.tenant?.countryId) {
      const country = await this.prisma.country.findUnique({
        where: { id: payroll.tenant.countryId }
      });
      if (country) countryCode = country.code;
    }

    // 2. Brut
    const grossSalary = Number(payroll.grossSalary);

    // 3. Retenues Sociales (CNSS/IPRES/CNPS selon pays)
    // Le taux est configuré par tenant (PayrollRate) pour flexibilité maximale
    let socialEmployeeShare = 0;
    let socialEmployerShare = 0;

    if (payroll.staff.cnssNumber) {
      const rate = await this.payrollService.findActivePayrollRate(
        tenantId,
        payroll.payrollPeriod.startDate,
      );
      if (rate) {
        socialEmployeeShare = grossSalary * Number(rate.cnssEmployeeRate);
        socialEmployerShare = grossSalary * Number(rate.cnssEmployerRate);
      }
    }

    // 4. Net imposable
    const taxableAmount = grossSalary - socialEmployeeShare;

    // 5. Impôt sur le Revenu (IRPP/ITS/etc.)
    // Utilise les barèmes configurés pour le pays spécifique
    let incomeTaxAmount = 0;
    let taxRateId: string | undefined;
    let breakdown: any[] = [];

    try {
      const taxResult = await this.taxService.calculateIRPP(
        countryCode,
        taxableAmount,
        payroll.payrollPeriod.startDate,
      );
      incomeTaxAmount = taxResult.amount;
      taxRateId = taxResult.taxRateId;
      breakdown = taxResult.breakdown;
    } catch {
      incomeTaxAmount = 0;
    }

    // 6. Déductions manuelles
    const otherDeductions = Number(payroll.deductions || 0);

    // 7. Net à payer
    const netSalary = grossSalary - socialEmployeeShare - incomeTaxAmount - otherDeductions;

    // 8. Mise à jour de la ligne
    const updated = await this.prisma.payroll.update({
      where: { id: payrollId },
      data: {
        grossSalary,
        employeeCNSS: socialEmployeeShare,
        employerCNSS: socialEmployerShare,
        taxWithheld: incomeTaxAmount,
        netSalary,
        status: 'VALIDATED',
      },
    });

    // 9. Enregistrement audit TaxWithholding
    if (taxableAmount > 0) {
      await this.taxService.recordTaxWithholding(
        tenantId,
        academicYearId,
        payrollId,
        payroll.staffId,
        taxRateId ?? null,
        'INCOME_TAX', // Label générique pour IRPP/ITS
        taxableAmount,
        incomeTaxAmount,
        { breakdown, method: `PROGRESSIVE_${countryCode}` },
      );
    }

    return { ...updated, irppBreakdown: breakdown };
  }

  /**
   * Calcule toutes les lignes d'une période
   */
  async calculatePeriod(
    periodId: string,
    tenantId: string,
    academicYearId: string,
  ) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id: periodId, tenantId },
      include: { payrolls: true },
    });

    if (!period) throw new NotFoundException('Période introuvable.');

    const results = [];
    for (const p of period.payrolls) {
      const result = await this.calculatePayroll(tenantId, academicYearId, p.id);
      results.push(result);
    }

    // Marquer la période comme calculée
    await this.prisma.payrollPeriod.update({
      where: { id: periodId },
      data: { status: 'CALCULATED' },
    });

    return { calculated: results.length, periodId };
  }
}

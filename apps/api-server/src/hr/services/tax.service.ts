/**
 * ============================================================================
 * TAX SERVICE - MODULE 5
 * ============================================================================
 * 
 * Service pour la gestion de la fiscalité et retenues IRPP
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class TaxService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée ou met à jour un barème fiscal
   */
  async createOrUpdateTaxRate(countryCode: string, data: {
    taxType: string;
    bracketMin: number;
    bracketMax?: number;
    ratePercentage: number;
    fixedAmount?: number;
    effectiveFrom: Date;
    effectiveTo?: Date;
    description?: string;
  }) {
    // Vérifier l'unicité
    const existing = await this.prisma.taxRate.findFirst({
      where: {
        countryCode,
        taxType: data.taxType,
        bracketMin: data.bracketMin,
        effectiveFrom: data.effectiveFrom,
      },
    });

    if (existing) {
      return this.prisma.taxRate.update({
        where: { id: existing.id },
        data: {
          bracketMax: data.bracketMax,
          ratePercentage: data.ratePercentage,
          fixedAmount: data.fixedAmount,
          effectiveTo: data.effectiveTo,
          description: data.description,
          isActive: true,
        },
      });
    }

    return this.prisma.taxRate.create({
      data: {
        countryCode,
        ...data,
        isActive: true,
      },
    });
  }

  /**
   * Récupère tous les barèmes fiscaux actifs pour un pays
   */
  async findActiveTaxRates(countryCode: string, taxType: string = 'IRPP', effectiveDate?: Date) {
    const date = effectiveDate || new Date();
    
    return this.prisma.taxRate.findMany({
      where: {
        countryCode,
        taxType,
        isActive: true,
        effectiveFrom: { lte: date },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: date } },
        ],
      },
      orderBy: { bracketMin: 'asc' },
    });
  }

  /**
   * Calcule l'IRPP pour un montant imposable donné
   * Utilise les barèmes progressifs du pays
   */
  async calculateIRPP(
    countryCode: string,
    taxableAmount: number,
    effectiveDate?: Date,
  ): Promise<{
    amount: number;
    breakdown: Array<{
      bracketMin: number;
      bracketMax?: number;
      ratePercentage: number;
      taxableInBracket: number;
      taxAmount: number;
    }>;
    taxRateId?: string;
  }> {
    const rates = await this.findActiveTaxRates(countryCode, 'IRPP', effectiveDate);
    
    if (rates.length === 0) {
      throw new NotFoundException(`No tax rates found for country ${countryCode}`);
    }

    let totalTax = 0;
    const breakdown: Array<{
      bracketMin: number;
      bracketMax?: number;
      ratePercentage: number;
      taxableInBracket: number;
      taxAmount: number;
    }> = [];
    let usedTaxRateId: string | undefined;

    // Calcul progressif par tranche
    for (const rate of rates) {
      const bracketMin = Number(rate.bracketMin);
      const bracketMax = rate.bracketMax ? Number(rate.bracketMax) : Infinity;
      
      // Montant imposable dans cette tranche
      const taxableInBracket = Math.max(0, Math.min(taxableAmount - bracketMin, bracketMax - bracketMin));
      
      if (taxableInBracket > 0) {
        let taxInBracket = 0;
        
        // Si montant fixe, l'utiliser
        if (rate.fixedAmount) {
          taxInBracket = Number(rate.fixedAmount);
        } else {
          // Calcul par taux progressif
          taxInBracket = (taxableInBracket * Number(rate.ratePercentage)) / 100;
        }
        
        totalTax += taxInBracket;
        breakdown.push({
          bracketMin,
          bracketMax: bracketMax === Infinity ? undefined : bracketMax,
          ratePercentage: Number(rate.ratePercentage),
          taxableInBracket,
          taxAmount: taxInBracket,
        });
        
        usedTaxRateId = rate.id;
      }
    }

    return {
      amount: Math.round(totalTax * 100) / 100, // Arrondi à 2 décimales
      breakdown,
      taxRateId: usedTaxRateId,
    };
  }

  /**
   * Enregistre une retenue fiscale pour un item de paie
   */
  async recordTaxWithholding(
    tenantId: string,
    academicYearId: string,
    payrollItemId: string | null,
    staffId: string,
    taxRateId: string | null,
    taxType: string,
    taxableAmount: number,
    withheldAmount: number,
    calculationDetails?: any,
  ) {
    // Récupérer le barème utilisé si fourni
    let bracketMin: number | undefined;
    let bracketMax: number | undefined;
    let ratePercentage: number | undefined;
    let fixedAmount: number | undefined;

    if (taxRateId) {
      const taxRate = await this.prisma.taxRate.findUnique({
        where: { id: taxRateId },
      });

      if (taxRate) {
        bracketMin = Number(taxRate.bracketMin);
        bracketMax = taxRate.bracketMax ? Number(taxRate.bracketMax) : undefined;
        ratePercentage = Number(taxRate.ratePercentage);
        fixedAmount = taxRate.fixedAmount ? Number(taxRate.fixedAmount) : undefined;
      }
    }

    return this.prisma.taxWithholding.create({
      data: {
        tenantId,
        academicYearId,
        // payrollItemId is optional in schema
        ...(payrollItemId ? { payrollItemId } : {}),
        staffId,
        taxRateId,
        taxType,
        taxableAmount,
        bracketMin,
        bracketMax,
        ratePercentage,
        fixedAmount,
        withheldAmount,
        calculationDetails: calculationDetails || {},
      },
    });
  }

  /**
   * Récupère les retenues fiscales pour un item de paie
   */
  async getTaxWithholdings(payrollItemId: string, tenantId: string) {
    return this.prisma.taxWithholding.findMany({
      where: { payrollItemId, tenantId },
      include: {
        taxRate: true,
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            staffCode: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Récupère les statistiques fiscales pour un tenant
   */
  async getTaxStats(tenantId: string, academicYearId?: string) {
    const where: any = { tenantId };
    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    const withholdings = await this.prisma.taxWithholding.findMany({
      where,
      include: {
        taxRate: true,
      },
    });

    const totalTaxableAmount = withholdings.reduce(
      (sum, w) => sum + Number(w.taxableAmount),
      0,
    );
    const totalWithheldAmount = withholdings.reduce(
      (sum, w) => sum + Number(w.withheldAmount),
      0,
    );

    // Groupement par type d'impôt
    const byTaxType = withholdings.reduce((acc, w) => {
      if (!acc[w.taxType]) {
        acc[w.taxType] = { count: 0, totalTaxable: 0, totalWithheld: 0 };
      }
      acc[w.taxType].count += 1;
      acc[w.taxType].totalTaxable += Number(w.taxableAmount);
      acc[w.taxType].totalWithheld += Number(w.withheldAmount);
      return acc;
    }, {} as Record<string, { count: number; totalTaxable: number; totalWithheld: number }>);

    return {
      totalWithholdings: withholdings.length,
      totalTaxableAmount,
      totalWithheldAmount,
      averageTaxRate: totalTaxableAmount > 0 
        ? (totalWithheldAmount / totalTaxableAmount) * 100 
        : 0,
      byTaxType,
    };
  }
}


/**
 * ============================================================================
 * FINANCES CALCULATION SERVICE - CALCULS PAR MODULE FINANCES
 * ============================================================================
 * 
 * Service de calcul pour le module FINANCES.
 * Tous les calculs sont scoped à un tenant et un niveau scolaire.
 * Garantit des bilans propres par niveau.
 * 
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CalculationService, CalculationContext, CalculationResult } from '../../../common/services/calculation.service';

export interface FinancialSummary {
  totalRevenue: number;
  totalExpenses: number;
  netBalance: number;
  paymentCount: number;
  expenseCount: number;
  revenueByMethod: Record<string, number>;
  expensesByCategory: Record<string, number>;
}

@Injectable()
export class FinancesCalculationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculationService: CalculationService,
  ) {}

  /**
   * Calcule le bilan financier pour un niveau scolaire
   */
  async calculateFinancialSummary(
    context: CalculationContext,
    startDate?: Date,
    endDate?: Date,
  ): Promise<CalculationResult<FinancialSummary>> {
    this.calculationService.validateCalculationContext(context);

    const { tenantId, schoolLevelId } = context;

    // Construire les filtres Prisma pour les paiements
    const paymentWhere: any = {
      tenantId,
      schoolLevelId, // OBLIGATOIRE
      status: 'completed',
    };
    if (startDate || endDate) {
      paymentWhere.paymentDate = {
        ...(startDate && { gte: startDate }),
        ...(endDate && { lte: endDate }),
      };
    }

    // Construire les filtres Prisma pour les dépenses
    const expenseWhere: any = {
      tenantId,
      schoolLevelId, // OBLIGATOIRE
      status: 'approved',
    };
    if (startDate || endDate) {
      expenseWhere.expenseDate = {
        ...(startDate && { gte: startDate }),
        ...(endDate && { lte: endDate }),
      };
    }

    // Récupérer tous les paiements du niveau
    const payments = await this.prisma.payment.findMany({ where: paymentWhere });

    // Récupérer toutes les dépenses du niveau
    const expenses = await this.prisma.expense.findMany({ where: expenseWhere });

    // Calculer les totaux
    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const netBalance = totalRevenue - totalExpenses;

    // Calculer les revenus par méthode de paiement
    const revenueByMethod: Record<string, number> = {};
    payments.forEach((p) => {
      const method = p.paymentMethod || 'unknown';
      revenueByMethod[method] = (revenueByMethod[method] || 0) + Number(p.amount);
    });

    // Calculer les dépenses par catégorie
    const expensesByCategory: Record<string, number> = {};
    expenses.forEach((e) => {
      const category = e.category || 'unknown';
      expensesByCategory[category] = (expensesByCategory[category] || 0) + Number(e.amount);
    });

    const summary: FinancialSummary = {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netBalance: Math.round(netBalance * 100) / 100,
      paymentCount: payments.length,
      expenseCount: expenses.length,
      revenueByMethod,
      expensesByCategory,
    };

    // Log pour traçabilité
    this.calculationService.logCalculation(
      context,
      'finances_summary',
      summary,
      {
        calculationScope: 'school_level',
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
      },
    );

    return this.calculationService.createCalculationResult(
      summary,
      context,
      {
        calculationType: 'finances_summary',
        dateRange: startDate && endDate ? { startDate, endDate } : undefined,
      },
    );
  }

  /**
   * Calcule les revenus par période (trimestre, mois, etc.)
   */
  async calculateRevenueByPeriod(
    context: CalculationContext,
    period: 'month' | 'quarter' | 'year',
  ): Promise<CalculationResult<Record<string, number>>> {
    this.calculationService.validateCalculationContext(context);

    const { tenantId, schoolLevelId } = context;

    const payments = await this.prisma.payment.findMany({
      where: {
        tenantId,
        schoolLevelId, // OBLIGATOIRE
        status: 'completed',
      },
    });

    const revenueByPeriod: Record<string, number> = {};

    payments.forEach((p) => {
      const date = new Date(p.paymentDate);
      let key: string;

      if (period === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else if (period === 'quarter') {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        key = `${date.getFullYear()}-Q${quarter}`;
      } else {
        key = String(date.getFullYear());
      }

      revenueByPeriod[key] = (revenueByPeriod[key] || 0) + Number(p.amount);
    });

    // Arrondir les valeurs
    Object.keys(revenueByPeriod).forEach((key) => {
      revenueByPeriod[key] = Math.round(revenueByPeriod[key] * 100) / 100;
    });

    this.calculationService.logCalculation(
      context,
      'finances_revenue_by_period',
      revenueByPeriod,
      { period },
    );

    return this.calculationService.createCalculationResult(
      revenueByPeriod,
      context,
      { period, calculationType: 'finances_revenue_by_period' },
    );
  }
}


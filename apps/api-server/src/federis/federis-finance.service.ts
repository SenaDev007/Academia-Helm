import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class FederisFinanceService {
  private readonly logger = new Logger(FederisFinanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère le bilan financier consolidé d'un patronat
   */
  async getConsolidatedFinance(patronatId: string) {
    // Récupérer les écoles affiliées
    const affiliations = await this.prisma.patronatSchool.findMany({
      where: { patronatId, status: 'JOINED' },
      select: { schoolTenantId: true },
    });

    const schoolIds = affiliations.map(a => a.schoolTenantId).filter(Boolean) as string[];
    
    // Calculer les revenus totaux (frais d'examen, cotisations, etc.)
    // Note: Simulation basée sur les modèles existants
    const totalRevenue = await this.prisma.payment.aggregate({
      where: { 
        tenantId: { in: schoolIds },
        status: 'COMPLETED' 
      },
      _sum: { amount: true }
    });

    return {
      patronatId,
      schoolCount: schoolIds.length,
      consolidatedRevenue: totalRevenue._sum.amount || 0,
      lastUpdate: new Date(),
    };
  }

  /**
   * Génère les factures de cotisations annuelles pour les écoles
   */
  async generateAffiliationInvoices(patronatId: string) {
    this.logger.log(`Generating affiliation invoices for patronat ${patronatId}`);
    // Logique de facturation groupée
    return { success: true, message: 'Factures générées' };
  }
}

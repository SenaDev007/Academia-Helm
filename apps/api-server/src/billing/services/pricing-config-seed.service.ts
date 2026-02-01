/**
 * ============================================================================
 * PRICING CONFIG SEED SERVICE - INITIALISATION CONFIGURATION PRICING
 * ============================================================================
 * 
 * Service pour initialiser la première configuration pricing
 * 
 * ============================================================================
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PricingConfigSeedService implements OnModuleInit {
  private readonly logger = new Logger(PricingConfigSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaultConfig();
  }

  /**
   * Initialise la configuration pricing par défaut si aucune n'existe
   */
  async seedDefaultConfig() {
    const existing = await this.prisma.pricingConfig.findFirst({
      where: { isActive: true },
    });

    if (existing) {
      this.logger.log('✅ Active pricing config already exists');
      return;
    }

    // Créer la configuration par défaut
    const defaultConfig = await this.prisma.pricingConfig.create({
      data: {
        initialSubscriptionFee: 100000, // 100 000 FCFA
        multiSchoolInitialDiscountPercent: 10, // 10% de réduction sur la souscription initiale pour les promoteurs gérant plusieurs écoles
        monthlyBasePrice: 15000, // 15 000 FCFA
        yearlyBasePrice: 150000, // 150 000 FCFA
        yearlyDiscountPercent: 17, // -17%
        bilingualMonthlyAddon: 5000, // +5 000 FCFA/mois
        bilingualYearlyAddon: 50000, // +50 000 FCFA/an
        schoolAdditionalPrice: 10000, // +10 000 FCFA par école supplémentaire
        trialDays: 30,
        graceDays: 7,
        reminderDays: [7, 3, 1], // J-7, J-3, J-1
        currency: 'XOF',
        isActive: true,
        version: 1,
        createdBy: 'SYSTEM',
        metadata: {
          seeded: true,
          seededAt: new Date().toISOString(),
        },
      },
    });

    this.logger.log(`✅ Default pricing config created: version ${defaultConfig.version}`);

    // Créer les group tiers par défaut
    await this.seedDefaultGroupTiers();
  }

  /**
   * Initialise les group tiers par défaut
   */
  async seedDefaultGroupTiers() {
    const tiers = [
      { schoolsCount: 2, monthlyPrice: 25000, yearlyPrice: 250000 },
      { schoolsCount: 3, monthlyPrice: 35000, yearlyPrice: 350000 },
      { schoolsCount: 4, monthlyPrice: 45000, yearlyPrice: 450000 },
    ];

    for (const tierData of tiers) {
      const existing = await this.prisma.pricingGroupTier.findUnique({
        where: { schoolsCount: tierData.schoolsCount },
      });

      if (!existing) {
        await this.prisma.pricingGroupTier.create({
          data: {
            ...tierData,
            isActive: true,
            createdBy: 'SYSTEM',
            metadata: {
              seeded: true,
            },
          },
        });
        this.logger.log(`✅ Group tier created: ${tierData.schoolsCount} schools`);
      }
    }

    this.logger.log('✅ Default group tiers seeded');
  }
}

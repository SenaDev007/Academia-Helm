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
    try {
      await this.seedDefaultConfig();
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code === 'P2021') {
        this.logger.warn(
          'Table pricing_configs ou pricing_group_tiers manquante. Exécutez: cd apps/api-server && npx prisma migrate deploy'
        );
        return;
      }
      throw error;
    }
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
    // ⭐ Alignée sur le contrat d'abonnement Academia Helm (Article 4) :
    //   - Frais d'activation uniques : 300 000 FCFA (uniforme)
    //   - Facturation annuelle uniquement (monthlyBasePrice = 0)
    //   - Base annuelle (Helm Essentiel) : 50 000 FCFA/an
    //   - Option bilingue : 50 000 FCFA/an (pas d'option mensuelle)
    //   - Plus de réduction annuelle (l'annuel est le seul cycle)
    const defaultConfig = await this.prisma.pricingConfig.create({
      data: {
        initialSubscriptionFee: 300000, // 300 000 FCFA — frais d'activation uniformes
        multiSchoolInitialDiscountPercent: 10, // 10% de réduction sur la souscription initiale pour les promoteurs gérant plusieurs écoles
        monthlyBasePrice: 0, // 0 — plus d'option mensuelle (contrat en annuel uniquement)
        yearlyBasePrice: 50000, // 50 000 FCFA/an — base Helm Essentiel
        yearlyDiscountPercent: 0, // 0% — pas de remise (annuel = seul cycle)
        bilingualMonthlyAddon: 0, // 0 — plus d'option mensuelle
        bilingualYearlyAddon: 50000, // 50 000 FCFA/an (contrat Article 4)
        schoolAdditionalPrice: 0, // 0 — plus de surcoût par école (pricing par tranche d'élèves)
        trialDays: 30,
        graceDays: 15, // Contrat : 15 jours après échéance → suspension possible
        reminderDays: [15, 7, 3, 1], // J-15, J-7, J-3, J-1
        currency: 'XOF',
        isActive: true,
        version: 1,
        createdBy: 'SYSTEM',
        metadata: {
          seeded: true,
          seededAt: new Date().toISOString(),
          contractAligned: true,
          contractArticle: 'Article 4',
        },
      },
    });

    this.logger.log(`✅ Default pricing config created (contrat Article 4): version ${defaultConfig.version}`);

    // Créer les group tiers par défaut
    // ⭐ Contrat : le pricing est par tranche d'élèves (Helm Essentiel/Croissance/Performance/Institution),
    // pas par nombre d'écoles. Les group tiers sont conservés pour compatibilité ascendante
    // mais ne sont plus la logique principale de pricing.
    await this.seedDefaultGroupTiers();
  }

  /**
   * Initialise les group tiers par défaut
   *
   * ⭐ Contrat Article 4 : le pricing dépend du nombre d'élèves (tranches), pas du nombre d'écoles.
   * Les group tiers sont conservés pour rétro-compatibilité mais ne sont plus la logique principale.
   */
  async seedDefaultGroupTiers() {
    const tiers = [
      { schoolsCount: 2, monthlyPrice: 0, yearlyPrice: 0 },
      { schoolsCount: 3, monthlyPrice: 0, yearlyPrice: 0 },
      { schoolsCount: 4, monthlyPrice: 0, yearlyPrice: 0 },
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

/**
 * ============================================================================
 * SUBSCRIPTION PLAN SEED SERVICE - INITIALISATION DES PLANS
 * ============================================================================
 *
 * ⚠️ OBSOLÈTE — Cette table `subscription_plans` n'est plus utilisée pour le
 * pricing réel. La source de vérité est désormais `pricing_plans` (gérée par
 * la migration `20260620080000_add_pricing_plans` et seedée avec les 4 plans
 * du contrat d'abonnement Academia Helm : Helm Essentiel, Helm Croissance,
 * Helm Performance, Helm Institution).
 *
 * Ce service est conservé pour rétro-compatibilité mais ne crée plus de plans
 * actifs dans `subscription_plans`. Voir `pricing-config-seed.service.ts` et
 * `PricingService` pour la logique de pricing active.
 * ============================================================================
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SubscriptionPlanSeedService implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionPlanSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.seedPlans();
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code === 'P2021') {
        this.logger.warn(
          'Table subscription_plans manquante. Exécutez: cd apps/api-server && npx prisma migrate deploy'
        );
        return;
      }
      throw error;
    }
  }

  /**
   * ⚠️ No-op — La table `subscription_plans` est obsolète.
   *
   * Les plans actifs sont désormais gérés via `pricing_plans` (4 plans du
   * contrat : Helm Essentiel, Helm Croissance, Helm Performance, Helm Institution).
   * Voir la migration `20260620080000_add_pricing_plans` et la nouvelle
   * migration d'alignement au contrat.
   *
   * Cette méthode ne crée plus aucun plan pour éviter toute confusion avec
   * d'anciens codes (BASIC_MONTHLY, GROUP_*).
   */
  async seedPlans() {
    this.logger.log('ℹ️ subscription_plans table is deprecated — pricing_plans is the source of truth (contrat Academia Helm).');
    return;
  }
}


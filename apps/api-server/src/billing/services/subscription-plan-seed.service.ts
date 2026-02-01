/**
 * ============================================================================
 * SUBSCRIPTION PLAN SEED SERVICE - INITIALISATION DES PLANS
 * ============================================================================
 * 
 * Service pour initialiser les plans de souscription par défaut
 * 
 * ============================================================================
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SubscriptionPlanSeedService implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionPlanSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedPlans();
  }

  /**
   * Initialise les plans de souscription par défaut
   */
  async seedPlans() {
    const plans = [
      {
        code: 'BASIC_MONTHLY',
        name: 'Plan Mensuel - 1 École',
        monthlyPrice: 15000,
        yearlyPrice: 150000,
        maxSchools: 1,
        bilingualAllowed: true,
      },
      {
        code: 'BASIC_YEARLY',
        name: 'Plan Annuel - 1 École',
        monthlyPrice: 15000,
        yearlyPrice: 150000,
        maxSchools: 1,
        bilingualAllowed: true,
      },
      {
        code: 'GROUP_2_MONTHLY',
        name: 'Plan Mensuel - 2 Écoles',
        monthlyPrice: 25000,
        yearlyPrice: 250000,
        maxSchools: 2,
        bilingualAllowed: true,
      },
      {
        code: 'GROUP_3_MONTHLY',
        name: 'Plan Mensuel - 3 Écoles',
        monthlyPrice: 35000,
        yearlyPrice: 350000,
        maxSchools: 3,
        bilingualAllowed: true,
      },
      {
        code: 'GROUP_4_MONTHLY',
        name: 'Plan Mensuel - 4 Écoles',
        monthlyPrice: 45000,
        yearlyPrice: 450000,
        maxSchools: 4,
        bilingualAllowed: true,
      },
    ];

    for (const planData of plans) {
      const existing = await this.prisma.subscriptionPlan.findUnique({
        where: { code: planData.code },
      });

      if (!existing) {
        await this.prisma.subscriptionPlan.create({
          data: planData,
        });
        this.logger.log(`✅ Subscription plan created: ${planData.code}`);
      }
    }

    this.logger.log('✅ Subscription plans seeded');
  }
}

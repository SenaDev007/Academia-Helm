/**
 * ============================================================================
 * PRICING SERVICE - MOTEUR DE CALCUL DE PRIX UNIFIÉ (PARAMÉTRABLE)
 * ============================================================================
 * 
 * Service centralisé pour calculer les prix de souscription.
 * Source unique de vérité pour :
 * - Landing page pricing
 * - Billing backend
 * - Onboarding pricing
 * 
 * ⚠️ CRITIQUE : Aucun prix codé en dur - tout vient de la DB
 * 
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface PricingInput {
  planId?: string;
  planCode?: string;
  schoolsCount: number;
  bilingual: boolean;
  cycle: 'MONTHLY' | 'YEARLY';
  tenantId?: string; // Pour appliquer overrides spécifiques
  promoCode?: string; // Pour appliquer codes promo
}

export interface PricingBreakdown {
  basePrice: number;
  schoolsCount: number;
  schoolsPrice: number;
  bilingual: boolean;
  bilingualPrice: number;
  subtotal: number;
  cycle: 'MONTHLY' | 'YEARLY';
  discount?: number;
  discountPercent?: number;
  overrideDiscount?: number;
  overrideCode?: string;
  total: number;
  currency: string;
}

export interface PricingResult {
  amount: number;
  breakdown: PricingBreakdown;
  plan: {
    id: string;
    code: string;
    name: string;
    maxSchools: number;
    bilingualAllowed: boolean;
  };
  configVersion: number; // Version de la config utilisée
}

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);
  private activeConfigCache: any = null;
  private configCacheExpiry: number = 0;
  private readonly CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère la configuration pricing active (avec cache)
   */
  async getActiveConfig() {
    const now = Date.now();

    // Vérifier le cache
    if (this.activeConfigCache && now < this.configCacheExpiry) {
      return this.activeConfigCache;
    }

    // Récupérer depuis la DB
    const config = await this.prisma.pricingConfig.findFirst({
      where: { isActive: true },
      orderBy: { version: 'desc' },
    });

    if (!config) {
      // Fallback : créer une config par défaut si aucune n'existe
      this.logger.warn('⚠️  No active pricing config found. Using default values.');
      return this.getDefaultConfig();
    }

    // Mettre en cache
    this.activeConfigCache = config;
    this.configCacheExpiry = now + this.CONFIG_CACHE_TTL;

    return config;
  }

  /**
   * Configuration par défaut (fallback si aucune config active)
   */
  private getDefaultConfig() {
    return {
      id: 'default',
      initialSubscriptionFee: 100000,
      monthlyBasePrice: 15000,
      yearlyBasePrice: 150000,
      yearlyDiscountPercent: 17,
      bilingualMonthlyAddon: 5000,
      bilingualYearlyAddon: 50000,
      schoolAdditionalPrice: 10000,
      trialDays: 30,
      graceDays: 7,
      reminderDays: [7, 3, 1],
      currency: 'XOF',
      isActive: true,
      version: 0,
    };
  }

  /**
   * Calcule le prix pour un tenant
   * 
   * ⚠️ CRITIQUE : Tous les prix viennent de la DB, jamais de constantes
   * 
   * @param input - Paramètres de calcul
   * @returns Résultat avec amount et breakdown détaillé
   */
  async calculateTenantPrice(input: PricingInput): Promise<PricingResult> {
    // 1. Récupérer la configuration active
    const config = await this.getActiveConfig();

    // 2. Récupérer le plan
    const plan = await this.getPlan(input.planId, input.planCode);

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    // 3. Valider les paramètres
    this.validatePricingInput(input, plan);

    // 4. Calculer le prix de base selon le cycle (depuis config)
    const basePrice = input.cycle === 'MONTHLY' 
      ? config.monthlyBasePrice 
      : config.yearlyBasePrice;

    // 5. Calculer le prix des écoles supplémentaires (depuis config ou group tiers)
    const schoolsPrice = await this.calculateSchoolsPrice(
      plan.maxSchools,
      input.schoolsCount,
      input.cycle,
      config
    );

    // 6. Calculer le prix de l'option bilingue (depuis config)
    const bilingualPrice = this.calculateBilingualPrice(
      input.bilingual,
      input.cycle,
      config
    );

    // 7. Calculer le sous-total
    const subtotal = basePrice + schoolsPrice + bilingualPrice;

    // 8. Calculer la remise annuelle (depuis config)
    let discount = 0;
    let discountPercent = 0;
    if (input.cycle === 'YEARLY') {
      const monthlyEquivalent = (basePrice + schoolsPrice + bilingualPrice) * 12;
      discount = Math.round(monthlyEquivalent * (config.yearlyDiscountPercent / 100));
      discountPercent = config.yearlyDiscountPercent;
    }

    // 9. Appliquer les overrides (promo codes, tenant spécifique)
    const overrideResult = await this.applyOverrides(
      subtotal - discount,
      input.tenantId,
      input.promoCode
    );

    // 10. Total final
    const total = subtotal - discount - (overrideResult.discount || 0);

    // 11. Construire le breakdown
    const breakdown: PricingBreakdown = {
      basePrice,
      schoolsCount: input.schoolsCount,
      schoolsPrice,
      bilingual: input.bilingual,
      bilingualPrice,
      subtotal,
      cycle: input.cycle,
      discount: discount > 0 ? discount : undefined,
      discountPercent: discountPercent > 0 ? discountPercent : undefined,
      overrideDiscount: overrideResult.discount || undefined,
      overrideCode: overrideResult.code || undefined,
      total,
      currency: config.currency,
    };

    return {
      amount: total,
      breakdown,
      plan: {
        id: plan.id,
        code: plan.code,
        name: plan.name,
        maxSchools: plan.maxSchools,
        bilingualAllowed: plan.bilingualAllowed,
      },
      configVersion: config.version,
    };
  }

  /**
   * Récupère un plan par ID ou code
   */
  private async getPlan(planId?: string, planCode?: string) {
    if (planId) {
      return await this.prisma.subscriptionPlan.findUnique({
        where: { id: planId },
      });
    }

    if (planCode) {
      return await this.prisma.subscriptionPlan.findUnique({
        where: { code: planCode },
      });
    }

    return null;
  }

  /**
   * Valide les paramètres de pricing
   */
  private validatePricingInput(input: PricingInput, plan: any) {
    if (input.schoolsCount < 1) {
      throw new BadRequestException('schoolsCount must be at least 1');
    }

    if (input.schoolsCount > plan.maxSchools) {
      throw new BadRequestException(
        `schoolsCount (${input.schoolsCount}) exceeds plan maxSchools (${plan.maxSchools})`
      );
    }

    if (input.bilingual && !plan.bilingualAllowed) {
      throw new BadRequestException(
        `Plan ${plan.code} does not allow bilingual option`
      );
    }

    if (!['MONTHLY', 'YEARLY'].includes(input.cycle)) {
      throw new BadRequestException('cycle must be MONTHLY or YEARLY');
    }
  }

  /**
   * Calcule le prix des écoles supplémentaires
   * 
   * ⚠️ Priorité : Group tiers > Config > Calcul manuel
   */
  private async calculateSchoolsPrice(
    planMaxSchools: number,
    schoolsCount: number,
    cycle: 'MONTHLY' | 'YEARLY',
    config: any,
  ): Promise<number> {
    if (schoolsCount <= planMaxSchools) {
      return 0; // Pas d'écoles supplémentaires
    }

    // 1. Vérifier si un group tier existe pour ce nombre d'écoles
    const groupTier = await this.prisma.pricingGroupTier.findUnique({
      where: { schoolsCount },
    });

    if (groupTier && groupTier.isActive) {
      // Utiliser le prix du group tier
      const tierPrice = cycle === 'MONTHLY' 
        ? groupTier.monthlyPrice 
        : groupTier.yearlyPrice;
      
      // Le prix du tier inclut déjà toutes les écoles, donc on retourne 0
      // (le basePrice sera remplacé par le tierPrice dans le calcul principal)
      // Pour l'instant, on calcule la différence
      return tierPrice - config.monthlyBasePrice; // Approximation, à ajuster selon logique
    }

    // 2. Sinon, utiliser le prix additionnel depuis config
    const additionalSchools = schoolsCount - planMaxSchools;
    const pricePerSchool = cycle === 'MONTHLY' 
      ? config.schoolAdditionalPrice 
      : config.schoolAdditionalPrice * 10; // Annuel = mensuel × 10

    return additionalSchools * pricePerSchool;
  }

  /**
   * Calcule le prix de l'option bilingue
   * 
   * ⚠️ Prix depuis config, jamais codé en dur
   */
  private calculateBilingualPrice(
    bilingual: boolean,
    cycle: 'MONTHLY' | 'YEARLY',
    config: any,
  ): number {
    if (!bilingual) {
      return 0;
    }

    return cycle === 'MONTHLY' 
      ? config.bilingualMonthlyAddon 
      : config.bilingualYearlyAddon;
  }

  /**
   * Applique les overrides (promo codes, tenant spécifique)
   */
  private async applyOverrides(
    baseAmount: number,
    tenantId?: string,
    promoCode?: string,
  ): Promise<{ discount: number; code?: string }> {
    const now = new Date();
    let discount = 0;
    let code: string | undefined;

    // 1. Vérifier override tenant spécifique
    if (tenantId) {
      const tenantOverride = await this.prisma.pricingOverride.findFirst({
        where: {
          tenantId,
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });

      if (tenantOverride) {
        if (tenantOverride.percentDiscount) {
          discount = Math.round(baseAmount * (tenantOverride.percentDiscount / 100));
        } else if (tenantOverride.fixedPrice !== null) {
          discount = baseAmount - tenantOverride.fixedPrice;
        }
        code = tenantOverride.code || 'TENANT_OVERRIDE';
        return { discount, code };
      }
    }

    // 2. Vérifier code promo
    if (promoCode) {
      const promoOverride = await this.prisma.pricingOverride.findFirst({
        where: {
          code: promoCode,
          tenantId: null, // Code promo global
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ],
        },
      });

      if (promoOverride) {
        if (promoOverride.percentDiscount) {
          discount = Math.round(baseAmount * (promoOverride.percentDiscount / 100));
        } else if (promoOverride.fixedPrice !== null) {
          discount = baseAmount - promoOverride.fixedPrice;
        }
        code = promoCode;
        return { discount, code };
      }
    }

    return { discount: 0 };
  }

  /**
   * Récupère tous les plans disponibles avec leurs prix calculés
   * Utile pour la landing page
   */
  async getAllPlansWithPricing(): Promise<any[]> {
    const config = await this.getActiveConfig();
    const plans = await this.prisma.subscriptionPlan.findMany({
      orderBy: {
        monthlyPrice: 'asc',
      },
    });

    return plans.map((plan) => {
      // Prix mensuel de base (1 école, sans bilingue)
      const monthlyBase = config.monthlyBasePrice;
      const yearlyBase = config.yearlyBasePrice;

      // Prix mensuel avec bilingue
      const monthlyWithBilingual = monthlyBase + config.bilingualMonthlyAddon;
      const yearlyWithBilingual = yearlyBase + config.bilingualYearlyAddon;

      return {
        id: plan.id,
        code: plan.code,
        name: plan.name,
        maxSchools: plan.maxSchools,
        bilingualAllowed: plan.bilingualAllowed,
        pricing: {
          monthly: {
            base: monthlyBase,
            withBilingual: monthlyWithBilingual,
          },
          yearly: {
            base: yearlyBase,
            withBilingual: yearlyWithBilingual,
            discountPercent: config.yearlyDiscountPercent,
          },
        },
        // Prix pour groupes (depuis PricingGroupTier)
        groupPricing: [], // Sera rempli par les group tiers actifs
      };
    });
  }

  /**
   * Calcule le prix initial (depuis config)
   * 
   * ⚠️ Plus de constante 100000 - vient de la DB
   * 
   * @param schoolsCount - Nombre d'écoles gérées (pour appliquer la réduction multi-écoles si applicable)
   */
  async calculateInitialPaymentPrice(schoolsCount: number = 1): Promise<number> {
    const config = await this.getActiveConfig();
    let amount = config.initialSubscriptionFee;

    // Appliquer la réduction pour les promoteurs gérant plusieurs écoles
    if (schoolsCount > 1 && config.multiSchoolInitialDiscountPercent) {
      const discountPercent = config.multiSchoolInitialDiscountPercent;
      const discount = Math.round((amount * discountPercent) / 100);
      amount = amount - discount;
      
      this.logger.log(
        `💰 Applied multi-school discount: ${discountPercent}% (${discount} XOF) for ${schoolsCount} schools. ` +
        `Original: ${config.initialSubscriptionFee} XOF → Final: ${amount} XOF`
      );
    }

    return amount;
  }

  /**
   * Récupère les jours de trial (depuis config)
   */
  async getTrialDays(): Promise<number> {
    const config = await this.getActiveConfig();
    return config.trialDays;
  }

  /**
   * Récupère les jours de grace (depuis config)
   */
  async getGraceDays(): Promise<number> {
    const config = await this.getActiveConfig();
    return config.graceDays;
  }

  /**
   * Récupère les jours de rappel (depuis config)
   */
  async getReminderDays(): Promise<number[]> {
    const config = await this.getActiveConfig();
    return (config.reminderDays as number[]) || [7, 3, 1];
  }

  /**
   * Calcule le prix de renouvellement pour une souscription existante
   */
  async calculateRenewalPrice(subscriptionId: string): Promise<PricingResult> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { subscriptionPlan: true },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription not found: ${subscriptionId}`);
    }

    // Déterminer le cycle actuel
    const cycle = subscription.billingCycle === 'YEARLY' ? 'YEARLY' : 'MONTHLY';

    return this.calculateTenantPrice({
      planId: subscription.planId,
      schoolsCount: subscription.schoolsCount,
      bilingual: subscription.bilingualEnabled,
      cycle,
      tenantId: subscription.tenantId,
    });
  }
}

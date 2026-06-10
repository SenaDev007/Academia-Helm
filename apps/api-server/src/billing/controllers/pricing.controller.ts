/**
 * ============================================================================
 * PRICING CONTROLLER - ENDPOINTS PUBLICS POUR PRICING
 * ============================================================================
 * 
 * Controller pour exposer les prix de manière publique
 * Utilisé par :
 * - Landing page
 * - Onboarding
 * - Billing
 * 
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator';
import { PricingService, PricingInput } from '../services/pricing.service';

@Controller('public/pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  /**
   * Récupère tous les plans disponibles avec leurs prix
   * 
   * GET /public/pricing
   * 
   * Utilisé par la landing page pour afficher les prix
   */
  @Public()
  @Get()
  async getAllPlans() {
    return this.pricingService.getAllPlansWithPricing();
  }

  /**
   * Calcule le prix pour une configuration donnée
   * 
   * POST /public/pricing/calculate
   * 
   * Body:
   * {
   *   planId?: string,
   *   planCode?: string,
   *   schoolsCount: number,
   *   bilingual: boolean,
   *   cycle: 'MONTHLY' | 'YEARLY'
   * }
   * 
   * Utilisé par :
   * - Landing page (calculateur de prix)
   * - Onboarding (phase 3)
   * - Billing (renouvellement)
   */
  @Public()
  @Post('calculate')
  async calculatePrice(@Body() input: PricingInput) {
    try {
      return await this.pricingService.calculateTenantPrice(input);
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Failed to calculate price');
    }
  }

  /**
   * Récupère le prix initial pour l'onboarding
   * 
   * GET /public/pricing/initial
   * 
   * Retourne toujours 100 000 FCFA (paiement initial fixe)
   */
  @Public()
  @Get('initial')
  async getInitialPaymentPrice() {
    const config = await this.pricingService.getActiveConfig();
    return {
      amount: config.initialSubscriptionFee,
      currency: config.currency,
      description: `Paiement initial Academia Hub (inclut période d'essai ${config.trialDays} jours)`,
    };
  }
}

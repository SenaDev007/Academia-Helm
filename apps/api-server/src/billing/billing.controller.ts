/**
 * ============================================================================
 * BILLING CONTROLLER - GESTION DE LA FACTURATION
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionService } from './services/subscription.service';
import { FedaPayService } from './services/fedapay.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('billing')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly fedapayService: FedaPayService,
  ) {}

  /**
   * Récupère le statut de souscription d'un tenant
   */
  @UseGuards(JwtAuthGuard)
  @Get('status')
  async getStatus(@Req() req: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    return this.subscriptionService.getSubscriptionStatus(tenantId);
  }

  /**
   * Crée une session de paiement pour l'onboarding
   * 
   * ⚠️ CRITIQUE : Le montant est calculé côté serveur, jamais côté frontend
   * 
   * Endpoint : POST /billing/fedapay/create-onboarding-payment
   */
  @Public()
  @Post('fedapay/create-onboarding-payment')
  @HttpCode(HttpStatus.OK)
  async createOnboardingPayment(@Body() body: { draftId: string }) {
    const { draftId } = body;

    if (!draftId) {
      throw new BadRequestException('draftId is required');
    }

    // Le service FedaPay va :
    // 1. Charger le draft
    // 2. Calculer le montant serveur (100 000 FCFA)
    // 3. Créer la transaction FedaPay
    // 4. Stocker la référence
    // 5. Retourner payment_url
    return this.fedapayService.createOnboardingPaymentSession(draftId);
  }

  /**
   * Webhook FedaPay pour les paiements
   * 
   * ⚠️ CRITIQUE : Route publique, vérification signature obligatoire
   * 
   * Endpoint : POST /billing/fedapay/webhook (URL publique prod : https://api.academiahelm.com/api/billing/fedapay/webhook)
   */
  @Public()
  @Post('fedapay/webhook')
  @HttpCode(HttpStatus.OK)
  async handleFedaPayWebhook(
    @Headers('x-fedapay-signature') xFedaPaySignature: string | string[] | undefined,
    @Body() body: any,
    @Req() req: Request,
  ) {
    // FedaPay signe le body brut : req.rawBody si le middleware raw body est activé
    const rawBody =
      (req as any).rawBody != null
        ? Buffer.isBuffer((req as any).rawBody)
          ? (req as any).rawBody.toString('utf8')
          : String((req as any).rawBody)
        : typeof body === 'string'
          ? body
          : JSON.stringify(body);

    const fromHeader = Array.isArray(xFedaPaySignature) ? xFedaPaySignature[0] : xFedaPaySignature;
    const signatureRaw =
      fromHeader ??
      req.headers['x-fedapay-signature'] ??
      req.headers['x-signature'] ??
      req.headers['signature'] ??
      req.headers['x-webhook-signature'];
    const signatureHeader = Array.isArray(signatureRaw) ? signatureRaw[0] : signatureRaw;

    // Vérification signature (secret FEDAPAY_WEBHOOK_SECRET côté service / Railway, jamais en dur)
    await this.fedapayService.assertValidFedaPayWebhookSignature(rawBody, signatureHeader);

    if (signatureHeader && typeof signatureHeader === 'string') {
      this.logger.log(`📥 FedaPay webhook received with signature: ${signatureHeader.substring(0, 30)}...`);
    }

    const { event: type, transaction: data, transactionId, transactionReference } =
      this.fedapayService.parseFedaPayWebhookPayload(body);

    this.logger.log(
      `📥 FedaPay webhook received: ${type} - Transaction ID: ${transactionId} - Reference: ${transactionReference}`,
    );

    switch (type) {
      case 'transaction.approved':
      case 'transaction.completed':
        await this.fedapayService.handlePaymentSuccessWebhook(data);
        break;
      case 'transaction.declined':
      case 'transaction.failed':
        await this.fedapayService.handlePaymentFailedWebhook(data);
        break;
      case 'transaction.canceled':
        await this.fedapayService.handlePaymentCanceledWebhook(data);
        break;
      default:
        this.logger.warn(`⚠️  Unhandled FedaPay event: ${type}`);
        break;
    }

    return { received: true };
  }

  /**
   * Simule un webhook transaction.approved pour un paiement onboarding (DEV uniquement).
   * Body: { paymentId: string }. En production retourne 400.
   * Endpoint : POST /billing/fedapay/simulate-approved
   */
  @Public()
  @Post('fedapay/simulate-approved')
  @HttpCode(HttpStatus.OK)
  async simulateApproved(@Body() body: { paymentId: string }) {
    const { paymentId } = body || {};
    if (!paymentId || typeof paymentId !== 'string') {
      throw new BadRequestException('paymentId is required');
    }
    return this.fedapayService.simulateOnboardingApproved(paymentId);
  }

  /**
   * Active le mode DEV pour un tenant (super admin seulement)
   */
  @UseGuards(JwtAuthGuard)
  @Post('dev-override/:tenantId/enable')
  async enableDevOverride(@Param('tenantId') tenantId: string) {
    // TODO: Vérifier que l'utilisateur est PLATFORM_OWNER
    return this.subscriptionService.enableDevOverride(tenantId);
  }

  /**
   * Désactive le mode DEV pour un tenant
   */
  @UseGuards(JwtAuthGuard)
  @Post('dev-override/:tenantId/disable')
  async disableDevOverride(@Param('tenantId') tenantId: string) {
    // TODO: Vérifier que l'utilisateur est PLATFORM_OWNER
    return this.subscriptionService.disableDevOverride(tenantId);
  }

  /**
   * Crée une session de paiement pour le renouvellement mensuel/annuel
   * 
   * ⚠️ CRITIQUE : Le montant est calculé côté serveur via PricingService
   * 
   * Endpoint : POST /billing/fedapay/create-renewal-payment
   */
  @UseGuards(JwtAuthGuard)
  @Post('fedapay/create-renewal-payment')
  @HttpCode(HttpStatus.OK)
  async createRenewalPayment(@Body() body: { subscriptionId: string }) {
    const { subscriptionId } = body;

    if (!subscriptionId) {
      throw new BadRequestException('subscriptionId is required');
    }

    // Le service FedaPay va :
    // 1. Charger la souscription
    // 2. Calculer le montant serveur via PricingService
    // 3. Créer la transaction FedaPay
    // 4. Stocker la référence dans BillingEvent
    // 5. Retourner payment_url
    return this.fedapayService.createRenewalPaymentSession(subscriptionId);
  }
}

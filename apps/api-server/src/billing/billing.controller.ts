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
import { ModuleRef } from '@nestjs/core';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionService } from './services/subscription.service';
import { FedaPayService } from './services/fedapay.service';
import { BillingService } from './billing.service';
import { Public } from '../auth/decorators/public.decorator';
// ⭐ Routage des transactions Federis reçues sur LE webhook FedaPay historique
//    (celui déclaré dans le dashboard FedaPay). Résolution runtime via ModuleRef
//    pour éviter une dépendance statique BillingModule → FederisModule (cycle :
//    FederisModule importe déjà BillingModule pour la passerelle FedaPay).
import { FederisFedapayService, FEDERIS_TX_TYPE } from '../federis/federis-fedapay.service';

@Controller('billing')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly fedapayService: FedaPayService,
    private readonly billingService: BillingService,
    private readonly moduleRef: ModuleRef,
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

    this.logger.log('=== WEBHOOK REÇU ===');
    this.logger.log(`Event (name): ${body?.name ?? body?.event ?? body?.type}`);
    this.logger.log(`Entity ID: ${body?.entity?.id}`);

    // Vérification signature (secret FEDAPAY_WEBHOOK_SECRET côté service / Railway, jamais en dur)
    await this.fedapayService.assertValidFedaPayWebhookSignature(rawBody, signatureHeader);

    if (signatureHeader && typeof signatureHeader === 'string') {
      this.logger.log(`📥 FedaPay webhook received with signature: ${signatureHeader.substring(0, 30)}...`);
    }

    const { event: type, transaction: data, transactionId, transactionReference } =
      this.fedapayService.parseFedaPayWebhookPayload(body);

    this.logger.log(
      `📥 FedaPay webhook parsed: ${type} - Transaction ID: ${transactionId} - Reference: ${transactionReference}`,
    );

    // ⭐ ROUTAGE FEDERIS : le dashboard FedaPay pointe vers CE webhook historique
    //    Helm. Les transactions d'abonnement patronat Federis (metadata.type =
    //    federis_subscription, posé au checkout et répliqué dans custom_metadata)
    //    sont déléguées au module Federis — sinon elles échouent ici en
    //    « Cannot resolve payment » et la facture n'est JAMAIS activée par
    //    webhook (seul le fallback verify resterait). Résolution runtime via
    //    ModuleRef : aucun cycle de modules (FederisModule importe déjà
    //    BillingModule, pas l'inverse).
    if (this.extractWebhookTransactionType(data) === FEDERIS_TX_TYPE) {
      this.logger.log(
        `🔀 Transaction Federis détectée (ref ${transactionReference}) → délégation au module Federis`,
      );
      const federisFedapayService = this.moduleRef.get(FederisFedapayService, { strict: false });
      // handleWebhook re-vérifie la signature (HMAC idempotent) puis route
      // l'événement (approved → activation + sous-domaine + email identifiants).
      return federisFedapayService.handleWebhook(rawBody, signatureHeader, body);
    }

    switch (type) {
      case 'transaction.approved':
      case 'transaction.completed':
        this.logger.log(`✅ Transaction approuvée / complétée: ${data?.reference ?? transactionReference}`);
        await this.billingService.handlePaymentSuccess(data);
        break;
      case 'transaction.declined':
      case 'transaction.failed':
        this.logger.log(`❌ Transaction refusée / échouée: ${data?.reference ?? transactionReference}`);
        await this.billingService.handlePaymentFailed(data);
        break;
      case 'transaction.canceled':
        this.logger.log(`⚠️ Transaction annulée: ${data?.reference ?? transactionReference}`);
        await this.billingService.handlePaymentCanceled(data);
        break;
      default:
        this.logger.warn(`⚠️  Unhandled FedaPay event: ${type}`);
        break;
    }

    return { received: true };
  }

  /**
   * Extrait le type d'une transaction webhook (metadata / custom_metadata,
   * qui peuvent être objets ou JSON string — pattern normalizeMetadata Federis).
   */
  private extractWebhookTransactionType(transaction: any): string | null {
    const read = (v: unknown): Record<string, any> => {
      if (v == null) return {};
      if (typeof v === 'string') {
        try {
          const p = JSON.parse(v);
          return typeof p === 'object' && p !== null && !Array.isArray(p) ? p : {};
        } catch {
          return {};
        }
      }
      return typeof v === 'object' && !Array.isArray(v) ? { ...(v as Record<string, any>) } : {};
    };
    const meta = {
      ...read(transaction?.metadata),
      ...read(transaction?.custom_metadata),
    };
    return typeof meta.type === 'string' && meta.type.length > 0 ? meta.type : null;
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

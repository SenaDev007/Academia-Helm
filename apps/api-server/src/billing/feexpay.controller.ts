/**
 * ============================================================================
 * FEEXPAY CONTROLLER — Endpoints pour les paiements FeexPay
 * ============================================================================
 *
 * Endpoints :
 *   1. POST /api/billing/feexpay/webhook — Webhook FeexPay (callback paiement)
 *   2. POST /api/billing/feexpay/pay — Initier un paiement (Mobile Money ou carte)
 *   3. POST /api/billing/feexpay/payout — Initier un transfert (payout/salaire)
 *   4. GET  /api/billing/feexpay/status/:reference — Vérifier le statut d'une transaction
 *   5. GET  /api/billing/feexpay/shop — Infos marchand
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  Req,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { FeexPayService } from './services/feexpay.service';

@Controller('billing/feexpay')
export class FeexPayController {
  private readonly logger = new Logger(FeexPayController.name);

  constructor(private readonly feexpayService: FeexPayService) {}

  /**
   * POST /api/billing/feexpay/webhook
   *
   * Webhook FeexPay — appelé par FeexPay quand le statut d'une transaction change.
   * L'URL à configurer dans le dashboard FeexPay :
   *   https://api.academiahelm.com/api/billing/feexpay/webhook
   */
  @Public()
  @Post('webhook')
  async handleWebhook(@Body() body: any, @Req() req: Request) {
    this.logger.log(`FeexPay webhook received: ${JSON.stringify(body).substring(0, 500)}`);
    const result = await this.feexpayService.handleWebhook(body);
    return { received: true, ...result };
  }

  /**
   * POST /api/billing/feexpay/pay
   *
   * Initie un paiement.
   * Body:
   *   {
   *     "amount": 75000,
   *     "method": "MOBILE_MONEY" | "CARD",
   *     "phoneNumber": "229XXXXXXXX",   // requis pour Mobile Money
   *     "operator": "MTN" | "MOOV" | "ORANGE",  // requis pour Mobile Money
   *     "email": "user@example.com",
   *     "firstName": "Jean",
   *     "lastName": "Dupont",
   *     "description": "Souscription initiale",
   *     "metadata": { "type": "ONBOARDING", "tenantId": "..." }
   *   }
   */
  @Public()
  @Post('pay')
  async initiatePayment(@Body() body: any) {
    if (!body?.amount || !body?.email) {
      throw new BadRequestException('amount et email sont requis');
    }

    const method = (body.method || 'MOBILE_MONEY').toUpperCase();

    if (method === 'MOBILE_MONEY') {
      if (!body.phoneNumber || !body.operator) {
        throw new BadRequestException('phoneNumber et operator sont requis pour Mobile Money');
      }
      const result = await this.feexpayService.createMobileMoneyPayment({
        amount: body.amount,
        phoneNumber: body.phoneNumber,
        operator: body.operator,
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
        description: body.description,
        metadata: body.metadata,
      });
      return result;
    }

    if (method === 'CARD') {
      const result = await this.feexpayService.createCardPayment({
        amount: body.amount,
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
        description: body.description,
        metadata: body.metadata,
      });
      return result;
    }

    throw new BadRequestException('method doit être MOBILE_MONEY ou CARD');
  }

  /**
   * POST /api/billing/feexpay/payout
   *
   * Initie un transfert (payout) vers un Mobile Money.
   * Utilisé pour les salaires.
   * Body:
   *   {
   *     "amount": 50000,
   *     "phoneNumber": "229XXXXXXXX",
   *     "operator": "MTN" | "MOOV" | "ORANGE",
   *     "fullName": "Jean Dupont",
   *     "email": "jean@example.com",
   *     "reason": "Salaire mois de juin"
   *   }
   */
  @Public()
  @Post('payout')
  async initiatePayout(@Body() body: any) {
    if (!body?.amount || !body?.phoneNumber || !body?.operator || !body?.fullName) {
      throw new BadRequestException('amount, phoneNumber, operator et fullName sont requis');
    }
    const result = await this.feexpayService.createPayout({
      amount: body.amount,
      phoneNumber: body.phoneNumber,
      operator: body.operator,
      fullName: body.fullName,
      email: body.email,
      reason: body.reason,
    });
    return result;
  }

  /**
   * GET /api/billing/feexpay/status/:reference
   *
   * Vérifie le statut d'une transaction.
   */
  @Public()
  @Get('status/:reference')
  async getStatus(@Param('reference') reference: string) {
    return await this.feexpayService.getTransactionStatus(reference);
  }

  /**
   * GET /api/billing/feexpay/shop
   *
   * Récupère les infos du marchand (vérifie que la config est OK).
   */
  @Public()
  @Get('shop')
  async getShopInfo() {
    const info = await this.feexpayService.getShopInfo();
    return {
      configured: this.feexpayService.isConfigured(),
      shopInfo: info,
      webhookUrl: this.feexpayService.getWebhookUrl(),
    };
  }
}

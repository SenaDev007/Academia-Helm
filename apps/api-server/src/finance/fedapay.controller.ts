/**
 * FEDAPAY CONTROLLER — Endpoints pour Fedapay Checkout
 *
 * GET  /finance/payments/fedapay/public-key — récupère la clé publique (pour checkout frontend)
 * POST /finance/payments/fedapay/initiate — stocke les métadonnées avant widget (PaymentInitiation)
 * GET  /finance/payments/fedapay/:ref/status — vérifie le statut
 * POST /finance/payments/fedapay/webhook — webhook callback (sans auth)
 */
import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { FedapayService } from './fedapay.service';
import { PaymentInitiationService } from './payment-initiation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';

@Controller('finance/payments/fedapay')
export class FedapayController {
  constructor(
    private readonly fedapayService: FedapayService,
    private readonly paymentInitiationService: PaymentInitiationService,
  ) {}

  /**
   * GET /finance/payments/fedapay/public-key
   * Retourne la clé publique Fedapay pour le checkout côté frontend.
   */
  @Get('public-key')
  @UseGuards(JwtAuthGuard)
  async getPublicKey(@TenantId() tenantId: string) {
    return this.fedapayService.getPublicKey(tenantId);
  }

  /**
   * POST /finance/payments/fedapay/initiate
   * Stocke les métadonnées de l'initiation AVANT que le widget Fedapay ne s'ouvre.
   * Le frontend appelle cet endpoint avec une référence générée côté client,
   * puis ouvre le widget Fedapay avec cette même référence.
   * Quand le webhook Fedapay confirme, il peut récupérer les métadonnées via cette référence.
   *
   * Body: { reference, studentAccountId, academicYearId, studentName, amount }
   */
  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  async initiate(
    @TenantId() tenantId: string,
    @Body() body: {
      reference: string;
      studentAccountId: string;
      academicYearId: string;
      studentName: string;
      amount: number;
    },
  ) {
    const initiation = await this.paymentInitiationService.create({
      tenantId,
      reference: body.reference,
      provider: 'fedapay',
      studentAccountId: body.studentAccountId,
      academicYearId: body.academicYearId,
      studentName: body.studentName,
      amount: Number(body.amount),
    });
    return { success: true, initiationId: initiation.id, reference: body.reference };
  }

  /**
   * GET /finance/payments/fedapay/:reference/status
   * Vérifie le statut d'une transaction Fedapay.
   */
  @Get(':reference/status')
  @UseGuards(JwtAuthGuard)
  async status(
    @Param('reference') reference: string,
    @TenantId() tenantId: string,
  ) {
    return this.fedapayService.verifyTransaction(tenantId, reference);
  }

  /**
   * POST /finance/payments/fedapay/webhook
   * Webhook callback appelé par Fedapay. Pas d'auth JWT.
   */
  @Post('webhook')
  async webhook(
    @Query('tenantId') tenantId: string,
    @Body() body: any,
  ) {
    if (!tenantId) {
      return { success: false, message: 'tenantId manquant' };
    }
    return this.fedapayService.handleWebhook(body, tenantId);
  }
}

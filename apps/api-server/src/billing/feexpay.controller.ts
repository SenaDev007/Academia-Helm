/**
 * ============================================================================
 * FEEXPAY CONTROLLER — Endpoints pour les paiements FeexPay v2
 * ============================================================================
 *
 * Endpoints :
 *   1. POST /api/billing/feexpay/webhook — Webhook FeexPay (callback paiement)
 *   2. POST /api/billing/feexpay/pay — Initier un paiement (Mobile Money ou carte)
 *   3. POST /api/billing/feexpay/payout — Initier un transfert (payout/salaire)
 *   4. GET  /api/billing/feexpay/status/:reference — Vérifier le statut d'une transaction
 *   5. GET  /api/billing/feexpay/shop — Solde du marchand (vérifie la config)
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Headers,
  Req,
  UseGuards,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { FeexPayService, FeexPayOperator } from './services/feexpay.service';
import { PrismaService } from '../database/prisma.service';

@Controller('billing/feexpay')
@UseGuards(JwtAuthGuard, TenantGuard)
export class FeexPayController {
  private readonly logger = new Logger(FeexPayController.name);

  constructor(
    private readonly feexpayService: FeexPayService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * POST /api/billing/feexpay/webhook
   *
   * Webhook FeexPay — appelé par FeexPay quand le statut d'une transaction change.
   * URL à configurer dans le dashboard FeexPay v2 :
   *   https://api.academiahelm.com/api/billing/feexpay/webhook
   *
   * Payload (v2) :
   *   {
   *     "reference": "...", "order_id": "...", "status": "SUCCESSFUL"|"FAILED",
   *     "amount": 250, "email": "...", "phoneNumber": "...", "reseau": "MTN CI",
   *     "reason": "", "description": "...", "date": "..."
   *   }
   */
  @Public()
  @Post('webhook')
  async handleWebhook(@Body() body: any, @Req() req: Request) {
    this.logger.log(`FeexPay webhook received: ${JSON.stringify(body).substring(0, 500)}`);
    const result = await this.feexpayService.handleWebhook(body);

    // ─── Mettre à jour les enregistrements SalaryPayment si applicable ──
    // Le webhook FeexPay peut concerner un paiement (payin) ou un transfert (payout).
    // Pour les payouts de salaires, on cherche le SalaryPayment par référence.
    const reference = body?.reference || body?.order_id || body?.transref;
    const status = (body?.status || '').toUpperCase();

    if (reference && (status === 'SUCCESSFUL' || status === 'FAILED')) {
      try {
        const salaryPayment = await this.prisma.salaryPayment.findFirst({
          where: { reference },
        });

        if (salaryPayment) {
          const newStatus = status === 'SUCCESSFUL' ? 'COMPLETED' : 'FAILED';
          await this.prisma.salaryPayment.update({
            where: { id: salaryPayment.id },
            data: {
              status: newStatus,
              notes: status === 'SUCCESSFUL'
                ? `Payout confirmé par FeexPay (webhook) — ${new Date().toISOString()}`
                : `Payout échoué — ${body?.reason || 'Raison inconnue'}`,
            },
          });
          this.logger.log(`SalaryPayment ${salaryPayment.id} updated to ${newStatus} (ref=${reference})`);

          // Si le paiement est réussi, mettre à jour le PayrollItem
          if (status === 'SUCCESSFUL') {
            await this.prisma.payrollItem.update({
              where: { id: salaryPayment.payrollItemId },
              data: { status: 'PAID' },
            }).catch(() => {});
          }
        }
      } catch (err: any) {
        this.logger.error(`Failed to update SalaryPayment for ref=${reference}: ${err.message}`);
      }
    }

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
   *     "operator": "MTN" | "MOOV" | "CELTIIS" | "CORIS" | "ORANGE" | "WAVE",
   *     "email": "user@example.com",
   *     "firstName": "Jean",
   *     "lastName": "Dupont",
   *     "description": "Souscription initiale",
   *     "callbackUrl": "https://...",  // URL de retour (optionnel)
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
        operator: body.operator as FeexPayOperator,
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
        description: body.description,
        callbackUrl: body.callbackUrl,
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
        callbackUrl: body.callbackUrl,
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
   *     "operator": "MTN" | "MOOV" | "CELTIIS" | "CORIS" | "ORANGE" | "WAVE",
   *     "motif": "Salaire mois de juin"
   *   }
   */
  @Public()
  @Post('payout')
  async initiatePayout(@Body() body: any) {
    if (!body?.amount || !body?.phoneNumber || !body?.operator) {
      throw new BadRequestException('amount, phoneNumber et operator sont requis');
    }
    const result = await this.feexpayService.createPayout({
      amount: body.amount,
      phoneNumber: body.phoneNumber,
      operator: body.operator as FeexPayOperator,
      motif: body.motif || body.reason,
    });
    return result;
  }

  /**
   * GET /api/billing/feexpay/status/:reference
   *
   * Vérifie le statut d'une transaction Payin.
   */
  @Public()
  @Get('status/:reference')
  async getStatus(@Param('reference') reference: string) {
    return await this.feexpayService.getTransactionStatus(reference);
  }

  /**
   * GET /api/billing/feexpay/payout-status/:reference
   *
   * Vérifie le statut d'un payout.
   */
  @Public()
  @Get('payout-status/:reference')
  async getPayoutStatus(@Param('reference') reference: string) {
    return await this.feexpayService.getPayoutStatus(reference);
  }

  /**
   * GET /api/billing/feexpay/shop
   *
   * Récupère le solde du marchand (vérifie que la config est OK).
   */
  @Public()
  @Get('shop')
  async getShopInfo() {
    const balance = await this.feexpayService.getShopBalance();
    return {
      configured: this.feexpayService.isConfigured(),
      balance,
      webhookUrl: this.feexpayService.getWebhookUrl(),
    };
  }

  /**
   * GET /api/billing/feexpay/school-config
   * Récupère la config FeexPay de l'école (shopId configuré ou non).
   */
  @Get('school-config')
  async getSchoolFeexPayConfig(@GetTenant() tenant: any) {
    const tid = tenant?.id;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    const settings = await this.prisma.schoolSettings.findFirst({
      where: { tenantId: tid },
      select: { feexpayShopId: true, feexpayApiKey: true, schoolName: true },
    });
    return {
      configured: !!settings?.feexpayShopId,
      shopId: settings?.feexpayShopId || null,
      hasCustomApiKey: !!settings?.feexpayApiKey,
      schoolName: settings?.schoolName || '',
      globalConfigured: this.feexpayService.isConfigured(),
    };
  }

  /**
   * PUT /api/billing/feexpay/school-config
   * Configure le shopId FeexPay de l'école (pour recevoir les frais de scolarité
   * et envoyer les salaires depuis le compte de l'école, pas Academia Helm).
   */
  @Put('school-config')
  async updateSchoolFeexPayConfig(
    @GetTenant() tenant: any,
    @Body() body: { feexpayShopId: string; feexpayApiKey?: string },
  ) {
    const tid = tenant?.id;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    if (!body.feexpayShopId) throw new BadRequestException('feexpayShopId requis');

    const updated = await this.prisma.schoolSettings.upsert({
      where: { tenantId: tid },
      update: {
        feexpayShopId: body.feexpayShopId,
        ...(body.feexpayApiKey ? { feexpayApiKey: body.feexpayApiKey } : {}),
      },
      create: {
        tenantId: tid,
        schoolName: 'École',
        feexpayShopId: body.feexpayShopId,
        ...(body.feexpayApiKey ? { feexpayApiKey: body.feexpayApiKey } : {}),
      },
    });

    return {
      success: true,
      message: 'Configuration FeexPay de l\'école enregistrée',
      shopId: updated.feexpayShopId,
    };
  }
}


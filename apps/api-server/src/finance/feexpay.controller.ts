/**
 * FEEXPAY CONTROLLER — Endpoints pour paiements en ligne
 *
 * POST   /finance/payments/feexpay/initiate  — initier un paiement
 * GET    /finance/payments/feexpay/:ref/status — vérifier le statut
 * POST   /finance/payments/feexpay/webhook    — webhook callback (sans auth)
 */
import { Controller, Post, Get, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { FeexPayService } from './feexpay.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Request } from 'express';

@Controller('finance/payments/feexpay')
export class FeexPayController {
  constructor(private readonly feexpayService: FeexPayService) {}

  /**
   * POST /finance/payments/feexpay/initiate
   * Initie un paiement FeexPay. Le parent reçoit un push sur son téléphone.
   * Body: { studentAccountId, studentName, amount, phone, academicYearId }
   */
  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  async initiate(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: {
      studentAccountId: string;
      studentName: string;
      amount: number;
      phone: string;
      operator: 'mtn' | 'moov' | 'celtiis_bj';
      academicYearId: string;
      firstName?: string;
      lastName?: string;
    },
  ) {
    return this.feexpayService.initiatePayment({
      tenantId,
      studentAccountId: body.studentAccountId,
      studentName: body.studentName,
      amount: Number(body.amount),
      phone: body.phone,
      operator: body.operator || 'mtn',
      academicYearId: body.academicYearId,
      firstName: body.firstName,
      lastName: body.lastName,
    });
  }

  /**
   * GET /finance/payments/feexpay/:reference/status
   * Vérifie le statut d'un paiement FeexPay.
   */
  @Get(':reference/status')
  @UseGuards(JwtAuthGuard)
  async status(
    @Param('reference') reference: string,
    @TenantId() tenantId: string,
  ) {
    return this.feexpayService.verifyPayment(tenantId, reference);
  }

  /**
   * POST /finance/payments/feexpay/webhook
   * Webhook callback appelé par FeexPay quand le paiement est confirmé.
   * ⚠️ Pas d'auth JWT — FeexPay ne peut pas s'authentifier.
   * Le tenantId est passé en query param.
   */
  @Post('webhook')
  async webhook(
    @Req() req: Request,
    @Query('tenantId') tenantId: string,
    @Query('ref') refQuery: string,
    @Body() body: any,
  ) {
    if (!tenantId) {
      return { success: false, message: 'tenantId manquant' };
    }
    return this.feexpayService.handleWebhook(body, { ref: refQuery }, tenantId);
  }
}

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
  Delete,
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
import { CredentialEncryptionService } from '../common/services/credential-encryption.service';

@Controller('billing/feexpay')
@UseGuards(JwtAuthGuard, TenantGuard)
export class FeexPayController {
  private readonly logger = new Logger(FeexPayController.name);

  constructor(
    private readonly feexpayService: FeexPayService,
    private readonly prisma: PrismaService,
    private readonly encryptionService: CredentialEncryptionService,
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
      // 1. Check SalaryPayment (payout for salaries)
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

      // 2. Check OnlinePayment (payin for school fees via FeexPay)
      try {
        const onlinePayment = await this.prisma.onlinePayment.findFirst({
          where: { providerRef: reference, provider: 'FEEXPAY' },
        });

        if (onlinePayment) {
          const newStatus = status === 'SUCCESSFUL' ? 'SUCCESSFUL' : 'FAILED';
          await this.prisma.onlinePayment.update({
            where: { id: onlinePayment.id },
            data: { status: newStatus },
          });
          this.logger.log(`OnlinePayment ${onlinePayment.id} updated to ${newStatus} (ref=${reference})`);

          // Update the linked Payment record if exists
          if (onlinePayment.paymentId) {
            const paymentStatus = status === 'SUCCESSFUL' ? 'completed' : 'failed';
            await this.prisma.payment.update({
              where: { id: onlinePayment.paymentId },
              data: { status: paymentStatus },
            }).catch(() => {});
            this.logger.log(`Payment ${onlinePayment.paymentId} updated to ${paymentStatus} (ref=${reference})`);
          }
        }
      } catch (err: any) {
        this.logger.error(`Failed to update OnlinePayment for ref=${reference}: ${err.message}`);
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
   * Récupère la config FeexPay de l'école (shopId + API key masquée).
   */
  @Get('school-config')
  async getSchoolFeexPayConfig(@GetTenant() tenant: any) {
    const tid = tenant?.id;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    const settings = await this.prisma.schoolSettings.findFirst({
      where: { tenantId: tid },
      select: { feexpayShopId: true, feexpayApiKey: true, schoolName: true },
    });

    // Mask the API key for security — never return the full key
    let maskedApiKey: string | null = null;
    if (settings?.feexpayApiKey) {
      const decrypted = this.encryptionService.isEncrypted(settings.feexpayApiKey)
        ? this.encryptionService.decrypt(settings.feexpayApiKey)
        : settings.feexpayApiKey;
      if (decrypted.length > 8) {
        maskedApiKey = `${decrypted.substring(0, 4)}••••••••${decrypted.substring(decrypted.length - 4)}`;
      } else {
        maskedApiKey = '••••••••';
      }
    }

    return {
      configured: !!settings?.feexpayShopId,
      shopId: settings?.feexpayShopId || null,
      hasApiKey: !!settings?.feexpayApiKey,
      maskedApiKey,
      schoolName: settings?.schoolName || '',
      globalConfigured: this.feexpayService.isConfigured(),
    };
  }

  /**
   * PUT /api/billing/feexpay/school-config
   * Configure le shopId + API Key FeexPay de l'école.
   *
   * L'API Key est chiffrée (AES-256-GCM) avant stockage en base.
   * Elle n'est jamais retournée en clair par l'API.
   */
  @Put('school-config')
  async updateSchoolFeexPayConfig(
    @GetTenant() tenant: any,
    @Body() body: { feexpayShopId: string; feexpayApiKey?: string; settlementPhone?: string },
  ) {
    const tid = tenant?.id;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    if (!body.feexpayShopId) throw new BadRequestException('feexpayShopId requis');

    // Encrypt API key before storage
    const encryptedApiKey = body.feexpayApiKey
      ? this.encryptionService.encrypt(body.feexpayApiKey)
      : undefined;

    const updated = await this.prisma.schoolSettings.upsert({
      where: { tenantId: tid },
      update: {
        feexpayShopId: body.feexpayShopId,
        ...(encryptedApiKey ? { feexpayApiKey: encryptedApiKey } : {}),
      },
      create: {
        tenantId: tid,
        schoolName: 'École',
        feexpayShopId: body.feexpayShopId,
        ...(encryptedApiKey ? { feexpayApiKey: encryptedApiKey } : {}),
      },
    });

    return {
      success: true,
      message: 'Configuration FeexPay de l\'école enregistrée',
      shopId: updated.feexpayShopId,
    };
  }

  /**
   * POST /api/billing/feexpay/school-config/test
   * Teste la connexion FeexPay de l'école (vérifie shopId + API key).
   */
  @Post('school-config/test')
  async testSchoolFeexPayConnection(@GetTenant() tenant: any) {
    const tid = tenant?.id;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    const result = await this.feexpayService.testTenantConnection(tid);
    return result;
  }

  /**
   * DELETE /api/billing/feexpay/school-config
   * Supprime la config FeexPay de l'école (shopId + API key).
   */
  @Delete('school-config')
  async deleteSchoolFeexPayConfig(@GetTenant() tenant: any) {
    const tid = tenant?.id;
    if (!tid) throw new BadRequestException('Tenant ID requis');

    await this.prisma.schoolSettings.updateMany({
      where: { tenantId: tid },
      data: {
        feexpayShopId: null,
        feexpayApiKey: null,
      },
    });

    return {
      success: true,
      message: 'Configuration FeexPay supprimée',
    };
  }

  /**
   * GET /api/billing/feexpay/school-config/status
   * Vérifie si FeexPay est configuré pour ce tenant (léger, sans credentials).
   */
  @Get('school-config/status')
  async getSchoolFeexPayStatus(@GetTenant() tenant: any) {
    const tid = tenant?.id;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    const configured = await this.feexpayService.isTenantConfigured(tid);
    return { configured };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  FRAIS SCOLAIRES — Paiement Espèces + Mobile Money
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * POST /api/billing/feexpay/school-fees/pay-cash
   *
   * Valide un paiement en espèces pour les frais scolaires d'un élève.
   * L'école reçoit l'argent en espèces et valide manuellement la transaction.
   *
   * Body:
   *   {
   *     "studentId": "...",
   *     "studentFeeId": "...",       // optionnel — lien vers StudentFee
   *     "amount": 50000,
   *     "feeType": "INSCRIPTION" | "SCOLARITE" | "ACTIVITY" | "OTHER",
   *     "academicYearId": "...",      // optionnel
   *     "schoolLevelId": "...",
   *     "description": "Scolarité T1",
   *     "createdBy": "userId"         // ID de l'utilisateur qui valide
   *   }
   */
  @Post('school-fees/pay-cash')
  async paySchoolFeeCash(
    @GetTenant() tenant: any,
    @Body() body: {
      studentId: string;
      studentFeeId?: string;
      amount: number;
      feeType?: string;
      academicYearId?: string;
      schoolLevelId: string;
      description?: string;
      createdBy?: string;
    },
  ) {
    const tid = tenant?.id;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    if (!body.studentId || !body.amount || !body.schoolLevelId) {
      throw new BadRequestException('studentId, amount et schoolLevelId sont requis');
    }

    // Créer l'enregistrement Payment (status completed car espèces)
    const payment = await this.prisma.payment.create({
      data: {
        tenantId: tid,
        studentId: body.studentId,
        studentFeeId: body.studentFeeId || null,
        academicYearId: body.academicYearId || null,
        schoolLevelId: body.schoolLevelId,
        amount: body.amount,
        paymentMethod: 'CASH',
        paymentDate: new Date(),
        status: 'completed',
        transactionType: 'PAYMENT',
        notes: body.description || `Paiement en espèces — ${body.feeType || 'Frais scolaires'}`,
        createdBy: body.createdBy || null,
      },
    });

    this.logger.log(`Cash payment recorded: id=${payment.id}, student=${body.studentId}, amount=${body.amount}`);

    return {
      success: true,
      paymentId: payment.id,
      method: 'CASH',
      status: 'completed',
      amount: body.amount,
      message: 'Paiement en espèces enregistré avec succès',
    };
  }

  /**
   * POST /api/billing/feexpay/school-fees/pay-mobile
   *
   * Initie un paiement Mobile Money pour les frais scolaires.
   * Le parent reçoit une notification sur son téléphone pour confirmer.
   * L'argent va directement sur le compte FeexPay de l'école (pas Academia Helm).
   *
   * REQUIERT que l'école ait configuré son compte FeexPay (Shop ID + API Key).
   *
   * Body:
   *   {
   *     "studentId": "...",
   *     "studentFeeId": "...",       // optionnel
   *     "amount": 50000,
   *     "feeType": "INSCRIPTION" | "SCOLARITE" | "ACTIVITY" | "OTHER",
   *     "academicYearId": "...",      // optionnel
   *     "schoolLevelId": "...",
   *     "phoneNumber": "229XXXXXXXX",
   *     "operator": "MTN" | "MOOV" | "CELTIIS" | "CORIS",
   *     "description": "Scolarité T1",
   *     "payerFirstName": "Jean",
   *     "payerLastName": "Dupont"
   *   }
   */
  @Post('school-fees/pay-mobile')
  async paySchoolFeeMobile(
    @GetTenant() tenant: any,
    @Body() body: {
      studentId: string;
      studentFeeId?: string;
      amount: number;
      feeType?: string;
      academicYearId?: string;
      schoolLevelId: string;
      phoneNumber: string;
      operator: string;
      description?: string;
      payerFirstName?: string;
      payerLastName?: string;
    },
  ) {
    const tid = tenant?.id;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    if (!body.studentId || !body.amount || !body.schoolLevelId) {
      throw new BadRequestException('studentId, amount et schoolLevelId sont requis');
    }
    if (!body.phoneNumber || !body.operator) {
      throw new BadRequestException('phoneNumber et operator sont requis pour Mobile Money');
    }

    // Vérifier que FeexPay est configuré pour ce tenant
    const isConfigured = await this.feexpayService.isTenantConfigured(tid);
    if (!isConfigured) {
      throw new BadRequestException(
        'FeexPay non configuré pour votre école. Veuillez configurer votre compte FeexPay (Shop ID + API Key) dans les Paramètres > Paiements avant d\'accepter les paiements Mobile Money.',
      );
    }

    // 1. Créer l'enregistrement Payment (status pending en attendant la confirmation)
    const payment = await this.prisma.payment.create({
      data: {
        tenantId: tid,
        studentId: body.studentId,
        studentFeeId: body.studentFeeId || null,
        academicYearId: body.academicYearId || null,
        schoolLevelId: body.schoolLevelId,
        amount: body.amount,
        paymentMethod: 'MOBILE_MONEY',
        paymentDate: new Date(),
        status: 'pending',
        transactionType: 'PAYMENT',
        notes: body.description || `Paiement Mobile Money — ${body.feeType || 'Frais scolaires'}`,
      },
    });

    // 2. Initier le paiement FeexPay (utilise les credentials du tenant)
    const feexPayResult = await this.feexpayService.createMobileMoneyPayment(
      {
        amount: body.amount,
        phoneNumber: body.phoneNumber,
        operator: body.operator as FeexPayOperator,
        email: `${body.studentId}@school.local`, // Email technique requis par FeexPay
        firstName: body.payerFirstName,
        lastName: body.payerLastName,
        description: body.description || `Frais scolaires — ${body.feeType || ''}`,
        metadata: {
          callback_info: `tenant:${tid},student:${body.studentId},payment:${payment.id}`,
        },
      },
      undefined, // pas de customShopId — le service résout depuis tenantId
      tid,       // tenantId → utilise les credentials du tenant
    );

    if (!feexPayResult.success || !feexPayResult.reference) {
      // Marquer le paiement comme échoué
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'failed' },
      });
      return {
        success: false,
        paymentId: payment.id,
        method: 'MOBILE_MONEY',
        status: 'failed',
        message: feexPayResult.message || 'Échec de l\'initiation du paiement Mobile Money',
      };
    }

    // 3. Créer l'enregistrement OnlinePayment pour tracker la référence FeexPay
    await this.prisma.onlinePayment.create({
      data: {
        tenantId: tid,
        studentId: body.studentId,
        amount: body.amount,
        provider: 'FEEXPAY',
        providerRef: feexPayResult.reference,
        status: 'PENDING',
        paymentId: payment.id,
        metadata: {
          operator: body.operator,
          payerPhone: body.phoneNumber,
          feeType: body.feeType || 'OTHER',
          description: body.description || '',
        } as any,
      },
    });

    // 4. Mettre à jour le Payment avec la référence
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { reference: feexPayResult.reference },
    });

    this.logger.log(
      `Mobile money payment initiated: paymentId=${payment.id}, ref=${feexPayResult.reference}, student=${body.studentId}, amount=${body.amount}, operator=${body.operator}`,
    );

    return {
      success: true,
      paymentId: payment.id,
      feexPayReference: feexPayResult.reference,
      method: 'MOBILE_MONEY',
      status: 'pending',
      amount: body.amount,
      message: 'Paiement Mobile Money initié. Le parent va recevoir une notification pour confirmer.',
    };
  }

  /**
   * GET /api/billing/feexpay/school-fees/payment-status/:reference
   *
   * Vérifie le statut d'un paiement Mobile Money de frais scolaires.
   * Si le statut est encore PENDING, on interroge l'API FeexPay pour le statut réel.
   */
  @Get('school-fees/payment-status/:reference')
  async getSchoolFeePaymentStatus(
    @GetTenant() tenant: any,
    @Param('reference') reference: string,
  ) {
    const tid = tenant?.id;
    if (!tid) throw new BadRequestException('Tenant ID requis');

    // Chercher l'OnlinePayment par référence
    const onlinePayment = await this.prisma.onlinePayment.findFirst({
      where: { providerRef: reference, provider: 'FEEXPAY', tenantId: tid },
      include: { payment: true },
    });

    if (!onlinePayment) {
      throw new BadRequestException('Paiement non trouvé pour cette référence');
    }

    // Si encore en PENDING, interroger FeexPay pour le statut réel
    let currentStatus = onlinePayment.status;
    if (onlinePayment.status === 'PENDING') {
      const feexPayStatus = await this.feexpayService.getTransactionStatus(reference, tid);
      const apiStatus = (feexPayStatus.status || '').toUpperCase();

      if (apiStatus === 'SUCCESSFUL') {
        // Mettre à jour OnlinePayment + Payment
        await this.prisma.onlinePayment.update({
          where: { id: onlinePayment.id },
          data: { status: 'SUCCESSFUL' },
        });
        if (onlinePayment.paymentId) {
          await this.prisma.payment.update({
            where: { id: onlinePayment.paymentId },
            data: { status: 'completed' },
          }).catch(() => {});
        }
        currentStatus = 'SUCCESSFUL';
      } else if (apiStatus === 'FAILED') {
        await this.prisma.onlinePayment.update({
          where: { id: onlinePayment.id },
          data: { status: 'FAILED' },
        });
        if (onlinePayment.paymentId) {
          await this.prisma.payment.update({
            where: { id: onlinePayment.paymentId },
            data: { status: 'failed' },
          }).catch(() => {});
        }
        currentStatus = 'FAILED';
      }
    }

    return {
      reference,
      status: currentStatus,
      amount: onlinePayment.amount,
      paymentId: onlinePayment.paymentId,
      method: 'MOBILE_MONEY',
    };
  }
}


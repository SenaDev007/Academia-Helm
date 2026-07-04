/**
 * SOUS-MODULE 3 — Encaissements (FinanceTransaction) — API
 */
import { Controller, Get, Post, Body, Param, Query, UseGuards, Res, NotFoundException, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { FinanceTransactionService } from './finance-transaction.service';
import { ReceiptFinanceService } from './receipt-finance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateTransactionDto } from './dto';

@Controller('finance/transactions')
@UseGuards(JwtAuthGuard)
export class FinanceTransactionController {
  constructor(
    private readonly service: FinanceTransactionService,
    private readonly receiptFinanceService: ReceiptFinanceService,
  ) {}

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: CreateTransactionDto,
  ) {
    return this.service.create(tenantId, {
      academicYearId: body.academicYearId,
      studentAccountId: body.studentAccountId,
      amount: Number(body.amount),
      paymentMethod: body.paymentMethod,
      reference: body.reference,
      cashierId: user?.id ?? '',
      deviceId: body.deviceId,
      receiptUrl: body.receiptUrl,
      cashRegisterId: body.cashRegisterId,
    });
  }

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('studentAccountId') studentAccountId?: string,
    @Query('type') type?: string,
  ) {
    return this.service.findAll(tenantId, {
      academicYearId,
      studentAccountId,
      type,
    });
  }

  /**
   * GET /finance/transactions/:id/receipt.pdf
   * Télécharge le PDF du reçu. Si le PDF n'existe pas encore (génération
   * fire-and-forget en cours), on le génère à la volée.
   */
  @Get(':id/receipt.pdf')
  async downloadReceipt(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Res() res: Response,
  ) {
    // S'assurer que le PDF existe (le régénère si nécessaire)
    const { filePath } = await this.receiptFinanceService.generateForTransaction(id, tenantId);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Reçu PDF introuvable');
    }

    const tx = await this.service.prismaClient.financeTransaction.findUnique({
      where: { id },
      select: { receiptNumber: true },
    });
    const fileName = `recu-${tx?.receiptNumber || id}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    fs.createReadStream(filePath).pipe(res);
  }

  /**
   * POST /finance/transactions/:id/resend
   * Renvoie le reçu par email/WhatsApp/SMS au parent de l'élève.
   * Body: { channels: ['email', 'whatsapp', 'sms'] }
   */
  @Post(':id/resend')
  async resendReceipt(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() body: { channels?: string[] },
  ) {
    const channels = body?.channels || ['email'];
    const results: any = {};

    // Générer (ou récupérer) le PDF
    const { pdfBuffer } = await this.receiptFinanceService.generateForTransaction(id, tenantId);

    // Récupérer la transaction + contacts parent
    const tx = await this.service.prismaClient.financeTransaction.findUnique({
      where: { id },
      include: {
        studentAccount: { include: { student: true } },
      },
    });
    if (!tx) throw new NotFoundException('Transaction introuvable');

    const contacts = await this.receiptFinanceService.getParentContacts(tx.studentAccount.studentId);

    // TODO: brancher EmailService.sendCategorized + WhatsAppService + SmsService
    // Pour l'instant, on retourne juste un statut indiquant que le PDF est prêt
    // et les contacts détectés.
    for (const ch of channels) {
      if (ch === 'email' && contacts.email) {
        results.email = { status: 'pending', to: contacts.email };
        // FIXME: appeler emailService.sendCategorized({ to: contacts.email, attachments: [{ filename: 'recu.pdf', content: pdfBuffer }] })
      } else if (ch === 'whatsapp' && contacts.phone) {
        results.whatsapp = { status: 'pending', to: contacts.phone };
        // FIXME: appeler whatsappService.sendCategorizedForTenant()
      } else if (ch === 'sms' && contacts.phone) {
        results.sms = { status: 'pending', to: contacts.phone };
        // FIXME: appeler smsService.sendSMS()
      } else {
        results[ch] = { status: 'skipped', reason: 'Pas de contact disponible' };
      }
    }

    return {
      success: true,
      transactionId: id,
      receiptNumber: tx.receiptNumber,
      channels: results,
    };
  }

  @Post(':id/reverse')
  async reverse(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { reason: string },
  ) {
    return this.service.reverse(
      id,
      tenantId,
      body?.reason ?? 'Non précisé',
      user?.id ?? '',
    );
  }
}

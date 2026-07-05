/**
 * SOUS-MODULE 3 — Encaissements (FinanceTransaction) — API
 */
import { Controller, Get, Post, Body, Param, Query, UseGuards, Res, NotFoundException, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { FinanceTransactionService } from './finance-transaction.service';
import { ReceiptFinanceService } from './receipt-finance.service';
import { ReceiptNotificationFinanceService } from './receipt-notification-finance.service';
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
    private readonly receiptNotificationService: ReceiptNotificationFinanceService,
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
    const requestedChannels = (body?.channels || ['email']) as ('email' | 'whatsapp' | 'sms')[];
    const results = await this.receiptNotificationService.sendReceiptNotifications(
      id,
      tenantId,
      requestedChannels,
    );

    // Récupérer le n° reçu pour la réponse
    const tx = await this.service.prismaClient.financeTransaction.findUnique({
      where: { id },
      select: { receiptNumber: true },
    });

    return {
      success: true,
      transactionId: id,
      receiptNumber: tx?.receiptNumber,
      channels: results,
    };
  }

  /**
   * GET /finance/transactions/:id/whatsapp-link
   * Génère un lien wa.me avec le message pré-rempli pour envoi manuel
   * (contourne l'API Gupshup — gratuit, pas d'opt-in requis).
   */
  @Get(':id/whatsapp-link')
  async getWhatsAppLink(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    // Charger la transaction + élève + guardian + branding
    const tx = await this.service.prismaClient.financeTransaction.findUnique({
      where: { id },
      include: {
        studentAccount: {
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                matricule: true,
                studentGuardians: { include: { guardian: true } },
              },
            },
          },
        },
      },
    });
    if (!tx) throw new NotFoundException('Transaction introuvable');

    // Récupérer le téléphone du parent
    const contacts = await this.receiptFinanceService.getParentContacts(tx.studentAccount.studentId);

    // Récupérer le branding
    const branding = await this.receiptFinanceService.getTenantBranding(tenantId);

    const studentName = `${tx.studentAccount?.student?.lastName || ''} ${tx.studentAccount?.student?.firstName || ''}`.trim();
    const schoolName = branding.schoolName || 'l\'établissement';
    const amountStr = Number(tx.amount).toLocaleString('fr-FR');
    const dateStr = new Date(tx.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const totalDue = Number(tx.studentAccount?.totalDue ?? 0);
    const balanceAfter = Number(tx.studentAccount?.balance ?? 0);
    const balanceLine = balanceAfter > 0
      ? `Solde restant a payer : ${balanceAfter.toLocaleString('fr-FR')} FCFA`
      : `Compte solde - aucun solde restant.`;

    // Construire le message WhatsApp
    const message = `Bonjour${contacts.name ? ` ${contacts.name}` : ''},\n\n` +
      `Nous confirmons la reception du paiement pour ${studentName} aupres de ${schoolName}.\n\n` +
      `Recu n° : ${tx.receiptNumber}\n` +
      `Montant : ${amountStr} FCFA\n` +
      `Date : ${dateStr}\n` +
      `${balanceLine}\n\n` +
      `Le recu PDF detaille est disponible aupres de l'etablissement.\n\n` +
      `Cordialement,\nLa Direction`;

    // Normaliser le numéro pour wa.me (format international sans +)
    let phoneForWaMe = '';
    if (contacts.phone) {
      // Nettoyer le numéro : retirer espaces, tirets, points
      let cleaned = contacts.phone.replace(/[\s\-().]/g, '').trim();
      // Convertir 0195722234 → 22995722234
      if (/^01\d{8}$/.test(cleaned)) {
        cleaned = '229' + cleaned.substring(2);
      } else if (/^\d{8}$/.test(cleaned) && !cleaned.startsWith('00')) {
        cleaned = '229' + cleaned;
      } else if (cleaned.startsWith('+')) {
        cleaned = cleaned.substring(1);
      } else if (cleaned.startsWith('00')) {
        cleaned = cleaned.substring(2);
      }
      phoneForWaMe = cleaned;
    }

    const waMeUrl = phoneForWaMe
      ? `https://wa.me/${phoneForWaMe}?text=${encodeURIComponent(message)}`
      : '';

    return {
      url: waMeUrl,
      phone: contacts.phone || null,
      message,
      receiptNumber: tx.receiptNumber,
      hasPhone: !!contacts.phone,
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

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
      tenderedAmount: body.tenderedAmount != null ? Number(body.tenderedAmount) : undefined,
      changeGiven: body.changeGiven != null ? Number(body.changeGiven) : undefined,
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
      select: {
        receiptNumber: true,
        studentAccount: {
          select: {
            student: { select: { lastName: true, firstName: true } },
          },
        },
      },
    });
    const studentName = `${tx?.studentAccount?.student?.lastName || ''} ${tx?.studentAccount?.student?.firstName || ''}`.trim() || 'Eleve';
    const safeName = studentName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9\s-]/g, '').trim();
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `Recu de paiement_${safeName}_${tx?.receiptNumber || id}_${dateStr}.pdf`;

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

    // Récupérer la classe de l'élève pour cette année
    const enrollment = await this.service.prismaClient.studentEnrollment.findFirst({
      where: { studentId: tx.studentAccount.studentId, academicYearId: tx.academicYearId },
      include: { class: { select: { name: true, code: true } } },
    });
    const className = enrollment?.class?.name || '—';

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
      ? `Solde restant à payer : ${balanceAfter.toLocaleString('fr-FR')} FCFA`
      : `Compte soldé — aucun solde restant.`;

    // Construire le lien public de téléchargement du reçu (via verificationToken HMAC)
    // Le token est régénéré déterministiquement à partir de transactionId + receiptNumber
    const verificationToken = this.generateReceiptToken(tx.id, tx.receiptNumber);
    // Utiliser l'URL du FRONTEND (pas du backend) pour que le parent puisse
    // télécharger le reçu dans son navigateur sans erreur 404.
    // Le frontend a une route BFF /api/finance/transactions/[id]/receipt.pdf
    // et une page publique /receipt/[token]/[id] qui télécharge le PDF.
    const frontendUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://academia-helm.vercel.app';
    const receiptLink = `${frontendUrl}/receipt/${verificationToken}/${tx.id}`;

    // Construire le message WhatsApp (avec accents — le lien wa.me les supporte)
    // ⭐ Pour les paiements en espèces, inclure le montant remis et le reliquat
    const cashPart = (tx.paymentMethod === 'CASH' && tx.tenderedAmount != null)
      ? `Montant remis : ${Number(tx.tenderedAmount).toLocaleString('fr-FR')} FCFA\n` +
        `Reliquat rendu : ${Number(tx.changeGiven ?? 0).toLocaleString('fr-FR')} FCFA\n`
      : '';

    const message = `Bonjour${contacts.name ? ` ${contacts.name}` : ''},\n\n` +
      `Nous confirmons la réception du paiement pour ${studentName} (Classe: ${className}) auprès de ${schoolName}.\n\n` +
      `Reçu n° : ${tx.receiptNumber}\n` +
      `Montant : ${amountStr} FCFA\n` +
      `${cashPart}` +
      `Date : ${dateStr}\n` +
      `${balanceLine}\n\n` +
      `📄 Téléchargez le reçu PDF détaillé ici :\n${receiptLink}\n\n` +
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

  /**
   * Génère le token de vérification HMAC d'un reçu (déterministe).
   * Doit correspondre à ReceiptFinanceService.generateVerificationToken().
   */
  private generateReceiptToken(transactionId: string, receiptNumber: string): string {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('crypto');
    const secret = process.env.RECEIPT_VERIFICATION_SECRET || 'academia-helm-receipt-secret-2026';
    const data = `${transactionId}|${receiptNumber}`;
    return crypto.createHmac('sha256', secret).update(data).digest('base64url');
  }
}

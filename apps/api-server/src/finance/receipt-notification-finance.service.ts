/**
 * ============================================================================
 * RECEIPT NOTIFICATION FINANCE SERVICE
 * ============================================================================
 *
 * Envoie les notifications de reçu (email + WhatsApp + SMS) au parent de
 * l'élève après un encaissement. Fire-and-forget — ne bloque jamais l'API.
 *
 * Patterns réutilisés :
 * - EmailService.sendCategorized() avec PJ PDF (pattern RH/Admissions)
 * - WhatsAppService.sendCategorized() (message texte libre — pas de template
 *   dédié pour les reçus encore, à ajouter sur Meta/Gupshup plus tard)
 * - SmsService.sendSMS() (message court avec n° reçu + montant)
 * - getTenantBranding() (logo, nom école) depuis admission-notification
 *
 * ============================================================================
 */

import { Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../communication/services/email.service';
import { WhatsAppService } from '../communication/services/whatsapp.service';
import { SmsService } from '../communication/services/sms.service';
import { ReceiptFinanceService } from './receipt-finance.service';

@Injectable()
export class ReceiptNotificationFinanceService {
  private readonly logger = new Logger(ReceiptNotificationFinanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly receiptFinanceService: ReceiptFinanceService,
    private readonly emailService: EmailService,
    private readonly whatsappService: WhatsAppService,
    private readonly smsService: SmsService,
  ) {}

  /**
   * Envoie les notifications de reçu sur les canaux demandés.
   * Ne lance JAMAIS d'erreur — retourne un rapport par canal.
   */
  async sendReceiptNotifications(
    transactionId: string,
    tenantId: string,
    channels: ('email' | 'whatsapp' | 'sms')[],
  ): Promise<Record<string, { status: 'sent' | 'failed' | 'skipped'; to?: string; error?: string }>> {
    const results: Record<string, any> = {};

    // 1. Charger la transaction + élève + branding
    const tx = await this.prisma.financeTransaction.findUnique({
      where: { id: transactionId },
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

    if (!tx) {
      this.logger.error(`Transaction ${transactionId} introuvable`);
      return { error: { status: 'failed', error: 'Transaction introuvable' } };
    }

    const student = tx.studentAccount?.student;
    const studentName = student ? `${student.lastName} ${student.firstName}` : 'l\'élève';
    const contacts = await this.receiptFinanceService.getParentContacts(tx.studentAccount.studentId);
    const branding = await this.getTenantBranding(tenantId);

    // 2. Générer (ou récupérer) le PDF
    let pdfBuffer: Buffer | null = null;
    try {
      const result = await this.receiptFinanceService.generateForTransaction(transactionId, tenantId);
      pdfBuffer = result.pdfBuffer;
    } catch (err: any) {
      this.logger.error(`Échec génération PDF pour notifications: ${err.message}`);
    }

    // 3. Envoyer sur chaque canal demandé
    for (const channel of channels) {
      try {
        if (channel === 'email') {
          results.email = await this.sendByEmail({
            to: contacts.email,
            parentName: contacts.name,
            studentName,
            receiptNumber: tx.receiptNumber,
            amount: Number(tx.amount),
            paymentMethod: tx.paymentMethod,
            createdAt: tx.createdAt,
            branding,
            pdfBuffer,
            tenantId,
            transactionId,
          });
        } else if (channel === 'whatsapp') {
          results.whatsapp = await this.sendByWhatsApp({
            to: contacts.phone,
            parentName: contacts.name,
            studentName,
            receiptNumber: tx.receiptNumber,
            amount: Number(tx.amount),
            createdAt: tx.createdAt,
            branding,
            tenantId,
            transactionId,
          });
        } else if (channel === 'sms') {
          results.sms = await this.sendBySMS({
            to: contacts.phone,
            studentName,
            receiptNumber: tx.receiptNumber,
            amount: Number(tx.amount),
            branding,
          });
        }
      } catch (err: any) {
        results[channel] = { status: 'failed', error: err.message };
        this.logger.error(`Échec envoi ${channel}: ${err.message}`);
      }
    }

    return results;
  }

  /**
   * Envoie le reçu par email avec le PDF en pièce jointe.
   * Pattern identique à admission-notification.service.ts.
   */
  private async sendByEmail(params: {
    to?: string;
    parentName?: string;
    studentName: string;
    receiptNumber: string;
    amount: number;
    paymentMethod: string;
    createdAt: Date;
    branding: any;
    pdfBuffer: Buffer | null;
    tenantId: string;
    transactionId: string;
  }): Promise<{ status: 'sent' | 'failed' | 'skipped'; to?: string; error?: string }> {
    if (!params.to) {
      return { status: 'skipped', error: 'Aucun email parent disponible' };
    }

    const dateStr = new Date(params.createdAt).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    const amountStr = params.amount.toLocaleString('fr-FR');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px;">Reçu de paiement</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">${params.branding.schoolName || 'Établissement'}</p>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p>Bonjour${params.parentName ? ` ${params.parentName}` : ''},</p>
          <p>Nous vous confirmons la réception du paiement suivant pour <strong>${params.studentName}</strong> :</p>
          <table style="width: 100%; margin: 16px 0; border-collapse: collapse;">
            <tr><td style="padding: 8px; background: #f8fafc; font-weight: 600;">N° reçu :</td><td style="padding: 8px; background: #f8fafc; font-family: monospace;">${params.receiptNumber}</td></tr>
            <tr><td style="padding: 8px; font-weight: 600;">Montant :</td><td style="padding: 8px;">${amountStr} FCFA</td></tr>
            <tr><td style="padding: 8px; background: #f8fafc; font-weight: 600;">Mode de paiement :</td><td style="padding: 8px; background: #f8fafc;">${params.paymentMethod}</td></tr>
            <tr><td style="padding: 8px; font-weight: 600;">Date :</td><td style="padding: 8px;">${dateStr}</td></tr>
          </table>
          <p>Le reçu détaillé est joint à cet email au format PDF.</p>
          <p style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #64748b;">
            ${params.branding.schoolName || ''}<br>
            ${params.branding.schoolAddress || ''} ${params.branding.schoolPhone ? '· Tél : ' + params.branding.schoolPhone : ''}
          </p>
        </div>
      </div>
    `;

    const result = await this.emailService.sendCategorized({
      tenantId: params.tenantId,
      category: 'FINANCE',
      subCategory: 'RECEIPT',
      module: 'finance',
      to: params.to,
      toName: params.parentName,
      recipientType: 'PARENT',
      subject: `Reçu de paiement - ${params.receiptNumber} - ${params.studentName}`,
      html,
      text: `Reçu ${params.receiptNumber} - ${amountStr} FCFA pour ${params.studentName} - ${dateStr}`,
      triggeredBy: 'SYSTEM',
      relatedEntityId: params.transactionId,
      relatedEntityType: 'FinanceTransaction',
      attachments: params.pdfBuffer
        ? [{ filename: `recu-${params.receiptNumber}.pdf`, content: params.pdfBuffer, contentType: 'application/pdf' }]
        : undefined,
    } as any);

    if (result.success) {
      return { status: 'sent', to: params.to };
    }
    return { status: 'failed', to: params.to, error: result.error };
  }

  /**
   * Envoie le reçu par WhatsApp (message texte libre — pas de template dédié).
   * TODO: créer un template payment_receipt sur Meta/Gupshup pour utiliser
   * sendCategorized avec templateName + templateVariables.
   */
  private async sendByWhatsApp(params: {
    to?: string;
    parentName?: string;
    studentName: string;
    receiptNumber: string;
    amount: number;
    createdAt: Date;
    branding: any;
    tenantId: string;
    transactionId: string;
  }): Promise<{ status: 'sent' | 'failed' | 'skipped'; to?: string; error?: string }> {
    if (!params.to) {
      return { status: 'skipped', error: 'Aucun téléphone parent disponible' };
    }

    const dateStr = new Date(params.createdAt).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const amountStr = params.amount.toLocaleString('fr-FR');
    const schoolName = params.branding.schoolName || 'l\'établissement';

    const message = `Bonjour${params.parentName ? ` ${params.parentName}` : ''},\n\n` +
      `Nous confirmons la réception du paiement pour ${params.studentName}.\n\n` +
      `🧾 N° reçu : ${params.receiptNumber}\n` +
      `💰 Montant : ${amountStr} FCFA\n` +
      `📅 Date : ${dateStr}\n\n` +
      `Le reçu PDF détaillé est disponible auprès de ${schoolName}.\n\n` +
      `Merci pour votre confiance.`;

    const result = await this.whatsappService.sendCategorized({
      tenantId: params.tenantId,
      category: 'FINANCE',
      module: 'finance',
      to: params.to,
      toName: params.parentName,
      recipientType: 'PARENT',
      message,
      triggeredBy: 'SYSTEM',
      relatedEntityId: params.transactionId,
      relatedEntityType: 'FinanceTransaction',
    } as any);

    if (result.success) {
      return { status: 'sent', to: params.to };
    }
    return { status: 'failed', to: params.to, error: result.error };
  }

  /**
   * Envoie un SMS court avec n° reçu + montant.
   */
  private async sendBySMS(params: {
    to?: string;
    studentName: string;
    receiptNumber: string;
    amount: number;
    branding: any;
  }): Promise<{ status: 'sent' | 'failed' | 'skipped'; to?: string; error?: string }> {
    if (!params.to) {
      return { status: 'skipped', error: 'Aucun téléphone parent disponible' };
    }

    const amountStr = params.amount.toLocaleString('fr-FR');
    const schoolName = (params.branding.schoolName || 'Établissement').substring(0, 30);

    // SMS court (< 160 caractères si possible)
    const message = `${schoolName}: Recu ${params.receiptNumber} - ${amountStr} FCFA pour ${params.studentName.substring(0, 20)}. Recu PDF dispo a l'ecole.`;

    const result = await this.smsService.sendSMS(params.to, message);
    if (result.success) {
      return { status: 'sent', to: params.to };
    }
    return { status: 'failed', to: params.to, error: 'Échec envoi SMS' };
  }

  /**
   * Récupère le branding de l'école (même logique que admission-notification).
   */
  private async getTenantBranding(tenantId: string) {
    try {
      const profile = await this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId, isActive: true },
        select: {
          schoolName: true,
          logoUrl: true,
          address: true,
          phonePrimary: true,
          email: true,
        },
      });
      if (profile?.schoolName) {
        return {
          schoolName: profile.schoolName,
          logoUrl: profile.logoUrl,
          schoolAddress: profile.address,
          schoolPhone: profile.phonePrimary,
          schoolEmail: profile.email,
        };
      }
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });
      return { schoolName: tenant?.name || 'Établissement' };
    } catch {
      return { schoolName: 'Établissement' };
    }
  }
}

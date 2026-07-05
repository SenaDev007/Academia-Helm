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

    // Solde restant à payer (après ce paiement) — depuis studentAccount
    const totalDue = Number(tx.studentAccount?.totalDue ?? 0);
    const totalPaidAfter = Number(tx.studentAccount?.totalPaid ?? 0);
    const balanceAfter = Number(tx.studentAccount?.balance ?? 0);

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
            totalDue,
            totalPaidAfter,
            balanceAfter,
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
            balanceAfter,
          });
        } else if (channel === 'sms') {
          results.sms = await this.sendBySMS({
            to: contacts.phone,
            studentName,
            receiptNumber: tx.receiptNumber,
            amount: Number(tx.amount),
            branding,
            balanceAfter,
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
    totalDue?: number;
    totalPaidAfter?: number;
    balanceAfter?: number;
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
    const balanceStr = params.balanceAfter != null ? params.balanceAfter.toLocaleString('fr-FR') : null;
    const totalDueStr = params.totalDue != null ? params.totalDue.toLocaleString('fr-FR') : null;
    const totalPaidStr = params.totalPaidAfter != null ? params.totalPaidAfter.toLocaleString('fr-FR') : null;

    // Section solde restant (si données dispo)
    const balanceSection = balanceStr != null
      ? (params.balanceAfter > 0
        ? `<div style="margin-top: 16px; padding: 16px; background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 13px; color: #92400e; font-weight: 600;">💡 Solde restant à payer</p>
            <p style="margin: 8px 0 0; font-size: 22px; font-weight: 700; color: #92400e;">${balanceStr} FCFA</p>
            ${totalDueStr && totalPaidStr ? `<p style="margin: 4px 0 0; font-size: 11px; color: #92400e;">Total dû : ${totalDueStr} FCFA · Total payé : ${totalPaidStr} FCFA</p>` : ''}
            <p style="margin: 8px 0 0; font-size: 11px; color: #92400e;">Merci de régulariser ce montant auprès de l'établissement.</p>
          </div>`
        : `<div style="margin-top: 16px; padding: 16px; background: #d1fae5; border: 2px solid #10b981; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 13px; color: #065f46; font-weight: 600;">✅ Compte soldé</p>
            <p style="margin: 8px 0 0; font-size: 14px; font-weight: 600; color: #065f46;">Aucun solde restant à payer</p>
            <p style="margin: 4px 0 0; font-size: 11px; color: #065f46;">Tous les frais de l'année ont été réglés. Merci !</p>
          </div>`)
      : '';

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
          ${balanceSection}
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
      subject: `Reçu de Paiement | ${params.branding.schoolName || 'Établissement'}`,
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
    balanceAfter?: number;
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

    // Section solde restant
    const balanceLine = params.balanceAfter != null
      ? (params.balanceAfter > 0
        ? `Solde restant a payer : ${params.balanceAfter.toLocaleString('fr-FR')} FCFA`
        : `Compte solde - aucun solde restant.`)
      : '';

    // Utiliser le template Meta/Gupshup 'recu_paiement' (pré-approuvé)
    // Les variables doivent être passées par NOM (clé du bodyVariables du registry)
    // Le Gupshup sender les récupère par nom puis les envoie en tableau ordonné
    const result = await this.whatsappService.sendCategorized({
      tenantId: params.tenantId,
      category: 'FINANCE',
      module: 'finance',
      to: params.to,
      toName: params.parentName,
      recipientType: 'PARENT',
      message: `Reçu ${params.receiptNumber} - ${amountStr} FCFA pour ${params.studentName}`, // fallback texte
      templateName: 'recu_paiement',
      templateVariables: {
        parent_name: params.parentName || 'Parent',
        student_name: params.studentName,
        school_name: schoolName,
        receipt_number: params.receiptNumber,
        amount: amountStr,
        payment_date: dateStr,
        balance_line: balanceLine,
      },
      triggeredBy: 'SYSTEM',
      relatedEntityId: params.transactionId,
      relatedEntityType: 'FinanceTransaction',
    } as any);

    if (result.success) {
      console.log(`[ReceiptNotif] WhatsApp envoyé pour ${params.receiptNumber} à ${params.to}`);
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
    balanceAfter?: number;
  }): Promise<{ status: 'sent' | 'failed' | 'skipped'; to?: string; error?: string }> {
    if (!params.to) {
      return { status: 'skipped', error: 'Aucun téléphone parent disponible' };
    }

    const amountStr = params.amount.toLocaleString('fr-FR');
    const schoolName = (params.branding.schoolName || 'Établissement').substring(0, 25);
    const studentShort = params.studentName.substring(0, 18);

    // SMS court avec solde restant si dispo
    const balancePart = params.balanceAfter != null
      ? (params.balanceAfter > 0
        ? ` Solde restant: ${params.balanceAfter.toLocaleString('fr-FR')}F.`
        : ' Compte solde.')
      : '';

    // SMS peut être un peu plus long si solde (jusqu'à 200 car)
    const message = `${schoolName}: Recu ${params.receiptNumber} - ${amountStr}F pour ${studentShort}.${balancePart} Recu PDF a l'ecole.`;

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

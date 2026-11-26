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
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../communication/services/email.service';
import { WhatsAppService } from '../communication/services/whatsapp.service';
import { SmsService } from '../communication/services/sms.service';
import { ReceiptFinanceService } from './receipt-finance.service';
import { renderReceiptEmail } from './receipt-email-templates';
import { HelmConnectFinanceNotificationService } from './helm-connect-finance-notification.service';
// ⭐ 2026-11-26 (retour promoteur) — signature par rôle : les reçus sont signés
//    par la COMPTABILITÉ (comptable / secrétaire comptable selon l'émetteur),
//    jamais par « La Direction ».
import {
  resolveUserSignatureLabel,
  ACCOUNTING_FALLBACK_LABEL,
} from '../common/utils/signature-label.helper';
// ⭐ 2026-11-26 — double identité : e-mail du NIVEAU de la classe de l'élève.
import { resolveEmailLevelCategory } from '../common/utils/level-category.helper';

@Injectable()
export class ReceiptNotificationFinanceService {
  private readonly logger = new Logger(ReceiptNotificationFinanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly receiptFinanceService: ReceiptFinanceService,
    private readonly emailService: EmailService,
    private readonly whatsappService: WhatsAppService,
    private readonly smsService: SmsService,
    private readonly configService: ConfigService,
    // ⭐ Helm Connect finance notification service — replaces WhatsApp+SMS
    //    for receipt delivery. The parent receives the PDF receipt directly
    //    in their Helm Connect chat account.
    private readonly helmConnectFinanceNotificationService: HelmConnectFinanceNotificationService,
  ) {}

  /**
   * Envoie les notifications de reçu sur les canaux demandés.
   * Ne lance JAMAIS d'erreur — retourne un rapport par canal.
   *
   * ⭐ Channels:
   *   - 'email'         — PDF receipt as email attachment (kept as-is)
   *   - 'whatsapp'       — WhatsApp message with PDF (kept for backward compat,
   *                       but no longer called by default — see finance-transaction.service.ts)
   *   - 'sms'            — Plain SMS (kept for backward compat)
   *   - 'helm_connect'   — ⭐ NEW: sends a Helm Connect message to the parent's
   *                       account with the PDF receipt attached. Replaces SMS+WhatsApp.
   */
  async sendReceiptNotifications(
    transactionId: string,
    tenantId: string,
    channels: ('email' | 'whatsapp' | 'sms' | 'helm_connect')[],
  ): Promise<Record<string, { status: 'sent' | 'failed' | 'skipped'; to?: string; error?: string }>> {
    const results: Record<string, any> = {};

    // 1. Charger la transaction + élève + branding
    const tx = await this.prisma.financeTransaction.findUnique({
      where: { id: transactionId },
      include: {
        academicYear: { select: { name: true } },  // ⭐ for helm_connect caption
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

    // Récupérer la classe de l'élève pour cette année (+ niveau scolaire —
    // ⭐ 2026-11-26 : l'e-mail du reçu part de la connexion du NIVEAU).
    let className = '—';
    let emailLevelCategory: 'MATERNAL_PRIMARY' | 'SECONDARY' = 'MATERNAL_PRIMARY';
    if (tx.studentAccount?.studentId && tx.academicYearId) {
      const enrollment = await this.prisma.studentEnrollment.findFirst({
        where: { studentId: tx.studentAccount.studentId, academicYearId: tx.academicYearId },
        include: { class: { select: { name: true, schoolLevel: { select: { code: true, name: true } } } } },
      });
      className = enrollment?.class?.name || '—';
      const clsLevel: any = (enrollment as any)?.class?.schoolLevel;
      emailLevelCategory = resolveEmailLevelCategory(clsLevel?.code, clsLevel?.name);
    }

    // Solde restant à payer (après ce paiement) — depuis studentAccount
    const totalDue = Number(tx.studentAccount?.totalDue ?? 0);
    const totalPaidAfter = Number(tx.studentAccount?.totalPaid ?? 0);
    const balanceAfter = Number(tx.studentAccount?.balance ?? 0);

    // Détecter les personnalisations (FeeOverride) pour cet élève
    // et calculer la différence entre le montant normal et le montant personnalisé
    const overrides = await this.prisma.feeOverride.findMany({
      where: { studentId: tx.studentAccount.studentId },
      include: { feeStructure: { select: { feeType: true, totalAmount: true, name: true } } },
    });
    let totalOriginalDue = totalDue;
    let personalizationNote = '';
    if (overrides.length > 0) {
      totalOriginalDue = 0;
      const breakdowns = tx.studentAccount?.breakdowns ?? [];
      for (const bd of breakdowns) {
        const fs = bd.feeStructure;
        if (fs) {
          totalOriginalDue += Number(fs.totalAmount ?? 0);
        }
      }
      const reduction = totalOriginalDue - totalDue;
      if (reduction > 0) {
        personalizationNote = `Une réduction de ${reduction.toLocaleString('fr-FR')} FCFA a été appliquée. Le montant total dû est désormais de ${totalDue.toLocaleString('fr-FR')} FCFA (au lieu de ${totalOriginalDue.toLocaleString('fr-FR')} FCFA).`;
      }
    }

    // 2. Générer (ou récupérer) le PDF
    let pdfBuffer: Buffer | null = null;
    try {
      const result = await this.receiptFinanceService.generateForTransaction(transactionId, tenantId);
      pdfBuffer = result.pdfBuffer;
    } catch (err: any) {
      this.logger.error(`Échec génération PDF pour notifications: ${err.message}`);
    }

    // 2.bis Récupérer les arriérés antérieurs ouverts de l'élève (toutes années)
    const openArrears = tx.studentAccount?.studentId
      ? await this.prisma.feeArrear.findMany({
          where: {
            tenantId,
            studentId: tx.studentAccount.studentId,
            status: { in: ['OPEN', 'PARTIALLY_PAID'] },
            balanceDue: { gt: 0 },
          },
          include: { academicYear: { select: { name: true } } },
          orderBy: [{ academicYear: { startDate: 'asc' } }],
        })
      : [];

    // Calculer la part appliquée aux arriérés (FIFO) :
    // total payé - somme des allocations aux AccountBreakdowns
    const totalAllocatedToBreakdowns = (tx.allocations || []).reduce(
      (sum: number, a: any) => sum + Number(a.amount ?? 0),
      0,
    );
    const amountAppliedToArrears = Math.max(0, Number(tx.amount) - totalAllocatedToBreakdowns);

    const openArrearsForEmail = openArrears.map(a => ({
      academicYearName: a.academicYear?.name || '—',
      totalDue: Number(a.totalDue ?? 0),
      totalPaid: Number(a.totalPaid ?? 0),
      balanceDue: Number(a.balanceDue ?? 0),
      notes: a.notes || undefined,
    }));

    // ⭐ 2026-11-26 — signature du message fondée sur le RÔLE de l'encaisseur
    //    (tx.cashierId) : « Le Comptable », « Le Secrétaire Comptable »…
    //    Repli neutre « Le Service Comptable » (l'école encaisse, pas la direction).
    const cashierSignature = await resolveUserSignatureLabel(
      this.prisma,
      tx.cashierId,
      ACCOUNTING_FALLBACK_LABEL,
    );

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
            personalizationNote,
            className,
            amountAppliedToArrears,
            openArrears: openArrearsForEmail,
            signatureLabel: cashierSignature,
            levelCategory: emailLevelCategory,
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
            personalizationNote,
            pdfBuffer,
            amountAppliedToArrears,
            openArrearsTotal: openArrears.reduce((s, a) => s + Number(a.balanceDue ?? 0), 0),
          });
        } else if (channel === 'sms') {
          results.sms = await this.sendBySMS({
            to: contacts.phone,
            studentName,
            receiptNumber: tx.receiptNumber,
            amount: Number(tx.amount),
            branding,
            balanceAfter,
            personalizationNote,
            className,
            amountAppliedToArrears,
            // ⭐ Espèces : inclure montant remis + reliquat dans le SMS
            paymentMethod: tx.paymentMethod,
            tenderedAmount: tx.tenderedAmount != null ? Number(tx.tenderedAmount) : undefined,
            changeGiven: tx.changeGiven != null ? Number(tx.changeGiven) : undefined,
          });
        } else if (channel === 'helm_connect') {
          // ⭐ NEW: Helm Connect — send a chat message to the parent's account
          //    with the PDF receipt attached. The message uses the EXACT same
          //    wording as the WhatsApp 'recu_paiement' template (see
          //    whatsapp-template.registry.ts line 738).
          //
          //    Build the balance_line variable — same way the WhatsApp branch
          //    does it (lines 377-395 of this file).
          const dateStr = new Date(tx.createdAt).toLocaleDateString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
          });
          const balanceLineStr = balanceAfter != null
            ? (balanceAfter > 0
              ? `Solde restant a payer : ${balanceAfter.toLocaleString('fr-FR')} FCFA`
              : `Compte solde - aucun solde restant.`)
            : '';
          const fifoLineStr = amountAppliedToArrears && amountAppliedToArrears > 0
            ? `Arrieres anterieurs regles (FIFO) : ${amountAppliedToArrears.toLocaleString('fr-FR')} FCFA. `
            : '';
          const remainingArrearsLineStr = openArrears.length > 0
            ? `Arrieres encore dus : ${openArrears.reduce((s, a) => s + Number(a.balanceDue ?? 0), 0).toLocaleString('fr-FR')} FCFA. `
            : '';
          const fullBalanceLine = `${fifoLineStr}${remainingArrearsLineStr}${balanceLineStr}${personalizationNote ? ` ${personalizationNote}` : ''}`.trim();

          const helmResult = await this.helmConnectFinanceNotificationService.sendReceiptNotification({
            tenantId,
            studentId: tx.studentAccount?.studentId || '',
            studentName,
            receiptNumber: tx.receiptNumber,
            amount: Number(tx.amount),
            className,
            academicYearLabel: tx.academicYear?.name,
            cashierId: tx.cashierId,  // user who recorded the payment
            pdfBuffer: pdfBuffer || Buffer.from(''),
            pdfFilename: `recu-${tx.receiptNumber}.pdf`,
            paymentDate: tx.createdAt,
            // ⭐ Same fields as the WhatsApp template variables:
            parentName: contacts.name,
            schoolName: branding.schoolName,
            balanceLine: fullBalanceLine,
            signatureLabel: cashierSignature,
          });
          results.helm_connect = {
            status: helmResult.success ? 'sent' : 'failed',
            to: helmResult.conversationId,
            error: helmResult.error,
          };
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
    personalizationNote?: string;
    className?: string;
    amountAppliedToArrears?: number;
    openArrears?: Array<{ academicYearName: string; balanceDue: number; totalDue: number; totalPaid: number; notes?: string }>;
    signatureLabel?: string;
    /** ⭐ 2026-11-26 — connexion e-mail du NIVEAU de la classe (double identité). */
    levelCategory?: 'MATERNAL_PRIMARY' | 'SECONDARY';
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

    // Générer l'email HTML avec le même design que le module RH
    // (header logo + nom école, corps, footer Academia Helm)
    const { subject, html } = renderReceiptEmail({
      branding: params.branding,
      parentName: params.parentName,
      studentName: params.studentName,
      receiptNumber: params.receiptNumber,
      amount: params.amount,
      paymentMethod: params.paymentMethod,
      dateLabel: dateStr,
      totalDue: params.totalDue,
      totalPaidAfter: params.totalPaidAfter,
      balanceAfter: params.balanceAfter,
      personalizationNote: params.personalizationNote,
      className: params.className,
      amountAppliedToArrears: params.amountAppliedToArrears,
      openArrears: params.openArrears,
      signatureLabel: params.signatureLabel,
    });

    const result = await this.emailService.sendCategorized({
      tenantId: params.tenantId,
      category: 'FINANCE',
      subCategory: 'RECEIPT',
      module: 'finance',
      to: params.to,
      toName: params.parentName,
      recipientType: 'PARENT',
      subject,
      html,
      text: `Reçu ${params.receiptNumber} - ${amountStr} FCFA pour ${params.studentName} - ${dateStr}`,
      fromName: params.branding.schoolName || 'Academia Helm',
      triggeredBy: 'SYSTEM',
      relatedEntityId: params.transactionId,
      relatedEntityType: 'FinanceTransaction',
      // ⭐ 2026-11-26 — adresse d'envoi du NIVEAU de la classe (maternel/
      //    primaire OU secondaire — écoles à double identité).
      levelCategory: params.levelCategory,
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
    personalizationNote?: string;
    pdfBuffer?: Buffer | null;
    amountAppliedToArrears?: number;
    openArrearsTotal?: number;
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

    // Section règlement FIFO (si une partie du paiement a été appliquée aux arriérés)
    const fifoLine = params.amountAppliedToArrears && params.amountAppliedToArrears > 0
      ? `Arrieres anterieurs regles (FIFO) : ${params.amountAppliedToArrears.toLocaleString('fr-FR')} FCFA. `
      : '';

    // Section arriérés encore en cours
    const remainingArrearsLine = params.openArrearsTotal && params.openArrearsTotal > 0
      ? `Arrieres encore dus : ${params.openArrearsTotal.toLocaleString('fr-FR')} FCFA. `
      : '';

    // Ajouter la note de personnalisation au balance_line (variable 7 du template)
    const fullBalanceLine = `${fifoLine}${remainingArrearsLine}${balanceLine}${params.personalizationNote ? ` ${params.personalizationNote}` : ''}`.trim();

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
        balance_line: fullBalanceLine,
      },
      triggeredBy: 'SYSTEM',
      relatedEntityId: params.transactionId,
      relatedEntityType: 'FinanceTransaction',
      document: params.pdfBuffer
        ? { content: params.pdfBuffer, filename: `recu-${params.receiptNumber}.pdf` }
        : undefined,
      documentCaption: `Reçu de paiement - ${params.receiptNumber} - ${params.studentName}`,
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
    personalizationNote?: string;
    className?: string;
    amountAppliedToArrears?: number;
    // ⭐ Espèces : montant remis + reliquat (pour traçabilité SMS)
    paymentMethod?: string;
    tenderedAmount?: number;
    changeGiven?: number;
  }): Promise<{ status: 'sent' | 'failed' | 'skipped'; to?: string; error?: string }> {
    if (!params.to) {
      return { status: 'skipped', error: 'Aucun téléphone parent disponible' };
    }

    const amountStr = params.amount.toLocaleString('fr-FR');
    const schoolName = (params.branding.schoolName || 'Établissement').substring(0, 25);
    const studentShort = params.studentName.substring(0, 18);
    const classPart = params.className && params.className !== '—' ? ` (${params.className.substring(0, 10)})` : '';

    // SMS court avec solde restant si dispo
    const balancePart = params.balanceAfter != null
      ? (params.balanceAfter > 0
        ? ` Solde restant: ${params.balanceAfter.toLocaleString('fr-FR')}F.`
        : ' Compte solde.')
      : '';

    // Mention FIFO si une partie du paiement a été appliquée aux arriérés
    const fifoPart = params.amountAppliedToArrears && params.amountAppliedToArrears > 0
      ? ` Arrieres regles: ${params.amountAppliedToArrears.toLocaleString('fr-FR')}F.`
      : '';

    // Note de personnalisation courte pour SMS (réduction appliquée)
    const persoPart = params.personalizationNote
      ? ' Reduction appliquee.'
      : '';

    // ⭐ Espèces : inclure montant remis + reliquat (format court pour SMS)
    const cashPart = (params.paymentMethod === 'CASH' && params.tenderedAmount != null)
      ? ` Remis: ${params.tenderedAmount.toLocaleString('fr-FR')}F. Reliquat: ${(params.changeGiven ?? 0).toLocaleString('fr-FR')}F.`
      : '';

    // SMS peut être un peu plus long si solde (jusqu'à 200 car)
    const message = `${schoolName}: Recu ${params.receiptNumber} - ${amountStr}F pour ${studentShort}${classPart}.${cashPart}${fifoPart}${balancePart}${persoPart} Recu PDF a l'ecole.`;

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
        // Construire l'URL du logo comme le module RH
        // (profile.logoUrl peut être base64 ou un chemin — on utilise l'endpoint
        // /api/tenants/{tenantId}/logo qui sert toujours le bon logo)
        const apiBaseUrl = this.configService.get<string>('APP_PUBLIC_URL')
          || 'https://api.academiahelm.com';
        const schoolLogo = profile.logoUrl
          ? `${apiBaseUrl}/api/tenants/${tenantId}/logo`
          : null;

        return {
          schoolName: profile.schoolName,
          schoolLogo,
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

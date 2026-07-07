/**
 * ============================================================================
 * RECOVERY NOTIFICATION FINANCE SERVICE
 * ============================================================================
 *
 * Envoie les notifications de relance (email + WhatsApp + SMS) au parent de
 * l'élève ayant un arriéré. Reproduit le pattern de ReceiptNotificationFinanceService.
 *
 * Fire-and-forget — ne bloque jamais l'API. Retourne un rapport par canal.
 *
 * Patterns réutilisés :
 * - EmailService.sendCategorized() (pattern RH/Admissions/Receipts)
 * - WhatsAppService.sendCategorized() (message texte libre)
 * - SmsService.sendSMS() (message court)
 * - ReceiptFinanceService.getParentContacts() + getTenantBranding()
 *
 * Niveaux de relance (termes français) :
 * - 'PREMIERE_RELANCE' (J+3) — "Rappel de paiement"
 * - 'DEUXIEME_RELANCE' (J+7) — "Rappel urgent"
 * - 'MISE_EN_DEMEURE' (J+15) — "Mise en demeure finale"
 *
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../communication/services/email.service';
import { WhatsAppService } from '../communication/services/whatsapp.service';
import { SmsService } from '../communication/services/sms.service';
import { ReceiptFinanceService } from './receipt-finance.service';

export type RecoveryChannel = 'email' | 'whatsapp' | 'sms';
export type RecoveryLevel = 'PREMIERE_RELANCE' | 'DEUXIEME_RELANCE' | 'MISE_EN_DEMEURE';

@Injectable()
export class RecoveryNotificationFinanceService {
  private readonly logger = new Logger(RecoveryNotificationFinanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly receiptFinanceService: ReceiptFinanceService,
    private readonly emailService: EmailService,
    private readonly whatsappService: WhatsAppService,
    private readonly smsService: SmsService,
  ) {}

  /**
   * Envoie une relance multi-canal au parent d'un élève ayant un arriéré.
   *
   * @param arrearId - ID du FeeArrear
   * @param tenantId - ID du tenant
   * @param channels - canaux demandés (email + whatsapp + sms)
   * @param level - niveau de relance (PREMIERE_RELANCE / DEUXIEME_RELANCE / MISE_EN_DEMEURE)
   * @returns Rapport par canal : { email: {status, to?, error?}, whatsapp: {...}, sms: {...} }
   */
  async sendRecoveryNotifications(
    arrearId: string,
    tenantId: string,
    channels: RecoveryChannel[],
    level: RecoveryLevel = 'PREMIERE_RELANCE',
  ): Promise<Record<string, { status: 'sent' | 'failed' | 'skipped'; to?: string; error?: string }>> {
    const results: Record<string, any> = {};

    // 1. Charger l'arriéré + élève + frais
    // ⚠️ L'arriéré peut avoir studentFeeId = null (arriéré manuel global).
    // On charge l'élève directement via arrear.studentId (relation directe).
    const arrear = await this.prisma.feeArrear.findFirst({
      where: { id: arrearId, tenantId },
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
        studentFee: {
          include: {
            feeDefinition: { select: { label: true, feeCategory: true } },
          },
        },
        academicYear: { select: { name: true } },
      },
    });

    if (!arrear) {
      this.logger.error(`Arriéré ${arrearId} introuvable`);
      return { error: { status: 'failed', error: 'Arriéré introuvable' } };
    }

    // Récupérer l'élève directement depuis la relation (pas via studentFee)
    const student = arrear.student;
    if (!student) {
      return { error: { status: 'failed', error: 'Élève introuvable sur cet arriéré' } };
    }

    const studentName = `${student.lastName} ${student.firstName}`;
    const contacts = await this.receiptFinanceService.getParentContacts(student.id);
    const branding = await this.getTenantBranding(tenantId);

    // Récupérer la classe de l'élève pour cette année
    let className = '—';
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: { studentId: student.id, academicYearId: arrear.academicYearId },
      include: { class: { select: { name: true } } },
    });
    className = enrollment?.class?.name || '—';

    const balanceDue = Number(arrear.balanceDue ?? 0);
    const totalDue = Number(arrear.totalDue ?? 0);
    const totalPaid = Number(arrear.totalPaid ?? 0);
    const feeLabel = arrear.studentFee?.feeDefinition?.label || arrear.notes || 'frais scolaires';
    const lastPaymentDate = arrear.lastPaymentDate;

    // 2. Envoyer sur chaque canal demandé
    for (const channel of channels) {
      try {
        if (channel === 'email') {
          results.email = await this.sendByEmail({
            to: contacts.email,
            parentName: contacts.name,
            studentName,
            className,
            feeLabel,
            balanceDue,
            totalDue,
            totalPaid,
            lastPaymentDate,
            level,
            branding,
            tenantId,
            arrearId,
          });
        } else if (channel === 'whatsapp') {
          results.whatsapp = await this.sendByWhatsApp({
            to: contacts.phone,
            parentName: contacts.name,
            studentName,
            className,
            feeLabel,
            balanceDue,
            level,
            branding,
            tenantId,
            arrearId,
          });
        } else if (channel === 'sms') {
          results.sms = await this.sendBySMS({
            to: contacts.phone,
            studentName,
            className,
            balanceDue,
            level,
            branding,
          });
        }
      } catch (err: any) {
        this.logger.error(`Échec envoi ${channel} pour relance ${arrearId}: ${err.message}`);
        results[channel] = { status: 'failed', error: err.message };
      }
    }

    return results;
  }

  /**
   * Envoie la relance par email (HTML structuré avec branding école).
   */
  private async sendByEmail(params: {
    to?: string;
    parentName?: string;
    studentName: string;
    className: string;
    feeLabel: string;
    balanceDue: number;
    totalDue: number;
    totalPaid: number;
    lastPaymentDate?: Date | null;
    level: RecoveryLevel;
    branding: any;
    tenantId: string;
    arrearId: string;
  }): Promise<{ status: 'sent' | 'failed' | 'skipped'; to?: string; error?: string }> {
    if (!params.to) {
      return { status: 'skipped', error: 'Aucun email parent disponible' };
    }

    const levelConfig = this.getLevelConfig(params.level);
    const schoolName = params.branding.schoolName || 'l\'établissement';
    const dateStr = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    const balanceStr = params.balanceDue.toLocaleString('fr-FR');
    const totalDueStr = params.totalDue.toLocaleString('fr-FR');
    const totalPaidStr = params.totalPaid.toLocaleString('fr-FR');
    const lastPaymentStr = params.lastPaymentDate
      ? new Date(params.lastPaymentDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : 'Aucun paiement enregistré';

    const subject = `${levelConfig.emoji} ${levelConfig.emailTitle} — ${params.studentName} (${schoolName})`;

    const html = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="utf-8">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
        <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, ${levelConfig.headerColor}, ${levelConfig.headerColorDark}); padding: 24px 32px; color: white;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="font-size: 32px;">${levelConfig.emoji}</div>
              <div>
                <div style="font-size: 20px; font-weight: bold;">${levelConfig.emailTitle}</div>
                <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">${schoolName}</div>
              </div>
            </div>
          </div>

          <!-- Body -->
          <div style="padding: 32px;">
            <p style="margin: 0 0 16px; font-size: 15px; color: #1e293b;">
              Bonjour${params.parentName ? ` ${params.parentName}` : ''},
            </p>
            <p style="margin: 0 0 16px; font-size: 14px; color: #475569; line-height: 1.6;">
              Nous vous contactons concernant le paiement des <strong>${params.feeLabel}</strong> de votre enfant
              <strong>${params.studentName}</strong>${params.className !== '—' ? ` (Classe: ${params.className})` : ''}.
            </p>

            <!-- Tableau récapitulatif -->
            <div style="background: ${levelConfig.tableBg}; border: 1px solid ${levelConfig.tableBorder}; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <table style="width: 100%; font-size: 14px; color: #1e293b;">
                <tr>
                  <td style="padding: 6px 0; color: #64748b;">Montant total dû :</td>
                  <td style="padding: 6px 0; text-align: right; font-weight: 600;">${totalDueStr} FCFA</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b;">Montant déjà payé :</td>
                  <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #059669;">${totalPaidStr} FCFA</td>
                </tr>
                <tr style="border-top: 2px solid ${levelConfig.tableBorder};">
                  <td style="padding: 10px 0 6px; color: ${levelConfig.headerColorDark}; font-weight: 700;">Solde restant à payer :</td>
                  <td style="padding: 10px 0 6px; text-align: right; font-weight: 800; font-size: 16px; color: ${levelConfig.headerColorDark};">${balanceStr} FCFA</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 12px;">Dernier paiement :</td>
                  <td style="padding: 6px 0; text-align: right; color: #64748b; font-size: 12px;">${lastPaymentStr}</td>
                </tr>
              </table>
            </div>

            <p style="margin: 16px 0; font-size: 14px; color: #475569; line-height: 1.6;">
              ${levelConfig.emailBody}
            </p>

            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin: 20px 0;">
              <p style="margin: 0; font-size: 13px; color: #92400e;">
                <strong>⚠️ Important :</strong> Nous vous prions de régulariser cette situation dans les meilleurs délais.
                En cas de difficulté, contactez l'administration de l'établissement pour convenir d'un échéancier.
              </p>
            </div>

            <p style="margin: 24px 0 0; font-size: 13px; color: #64748b;">
              Cordialement,<br>
              <strong>La Direction — ${schoolName}</strong>
            </p>
          </div>

          <!-- Footer -->
          <div style="background: #f1f5f9; padding: 16px 32px; font-size: 11px; color: #94a3b8; text-align: center;">
            Cet email a été envoyé automatiquement par Academia Helm pour le compte de ${schoolName}.<br>
            Date : ${dateStr}
          </div>
        </div>
      </body>
      </html>
    `;

    const result = await this.emailService.sendCategorized({
      tenantId: params.tenantId,
      category: 'FINANCE',
      subCategory: 'RECOVERY_REMINDER',
      module: 'finance',
      to: params.to,
      toName: params.parentName,
      recipientType: 'PARENT',
      subject,
      html,
      text: `${levelConfig.emailTitle} - ${params.studentName} - Solde restant: ${balanceStr} FCFA - ${schoolName}`,
      fromName: params.branding.schoolName || 'Academia Helm',
      triggeredBy: 'SYSTEM',
      relatedEntityId: params.arrearId,
      relatedEntityType: 'FeeArrear',
    } as any);

    if (result.success) {
      return { status: 'sent', to: params.to };
    }
    return { status: 'failed', to: params.to, error: result.error };
  }

  /**
   * Envoie la relance par WhatsApp (message texte libre).
   */
  private async sendByWhatsApp(params: {
    to?: string;
    parentName?: string;
    studentName: string;
    className: string;
    feeLabel: string;
    balanceDue: number;
    level: RecoveryLevel;
    branding: any;
    tenantId: string;
    arrearId: string;
  }): Promise<{ status: 'sent' | 'failed' | 'skipped'; to?: string; error?: string }> {
    if (!params.to) {
      return { status: 'skipped', error: 'Aucun téléphone parent disponible' };
    }

    const levelConfig = this.getLevelConfig(params.level);
    const schoolName = params.branding.schoolName || 'l\'établissement';
    const balanceStr = params.balanceDue.toLocaleString('fr-FR');
    const classPart = params.className !== '—' ? ` (Classe: ${params.className})` : '';

    const message = `${levelConfig.emoji} ${levelConfig.waTitle}\n\n` +
      `Bonjour${params.parentName ? ` ${params.parentName}` : ''},\n\n` +
      `${levelConfig.waBody}\n\n` +
      `👤 Élève : ${params.studentName}${classPart}\n` +
      `💰 Solde restant : ${balanceStr} FCFA\n` +
      `📋 Frais : ${params.feeLabel}\n\n` +
      `Merci de régulariser cette situation dans les meilleurs délais. ` +
      `Pour toute question, contactez l'administration de ${schoolName}.\n\n` +
      `Cordialement,\n` +
      `La Direction — ${schoolName}`;

    const result = await this.whatsappService.sendCategorized({
      tenantId: params.tenantId,
      category: 'FINANCE',
      module: 'finance',
      to: params.to,
      toName: params.parentName,
      recipientType: 'PARENT',
      message,
      triggeredBy: 'SYSTEM',
      relatedEntityId: params.arrearId,
      relatedEntityType: 'FeeArrear',
    } as any);

    if (result.success) {
      return { status: 'sent', to: params.to };
    }
    return { status: 'failed', to: params.to, error: result.error };
  }

  /**
   * Envoie un SMS court de relance.
   */
  private async sendBySMS(params: {
    to?: string;
    studentName: string;
    className: string;
    balanceDue: number;
    level: RecoveryLevel;
    branding: any;
  }): Promise<{ status: 'sent' | 'failed' | 'skipped'; to?: string; error?: string }> {
    if (!params.to) {
      return { status: 'skipped', error: 'Aucun téléphone parent disponible' };
    }

    const levelConfig = this.getLevelConfig(params.level);
    const schoolName = (params.branding.schoolName || 'Établissement').substring(0, 25);
    const studentShort = params.studentName.substring(0, 18);
    const classPart = params.className !== '—' ? ` (${params.className.substring(0, 10)})` : '';
    const balanceStr = params.balanceDue.toLocaleString('fr-FR');

    const message = `${schoolName}: ${levelConfig.smsTitle} - ${studentShort}${classPart}. ` +
      `Solde restant: ${balanceStr}F. ` +
      `${levelConfig.smsBody} Contactez l'ecole pour regulariser.`;

    const result = await this.smsService.sendSMS(params.to, message);
    if (result.success) {
      return { status: 'sent', to: params.to };
    }
    return { status: 'failed', to: params.to, error: 'Échec envoi SMS' };
  }

  /**
   * Configuration par niveau de relance (termes français).
   */
  private getLevelConfig(level: RecoveryLevel): {
    emoji: string;
    emailTitle: string;
    waTitle: string;
    smsTitle: string;
    emailBody: string;
    waBody: string;
    smsBody: string;
    headerColor: string;
    headerColorDark: string;
    tableBg: string;
    tableBorder: string;
  } {
    switch (level) {
      case 'PREMIERE_RELANCE':
        return {
          emoji: '📧',
          emailTitle: 'Rappel de paiement',
          waTitle: '📧 Rappel de paiement',
          smsTitle: 'Rappel',
          emailBody: 'Nous vous rappelons qu\'un solde reste à régler pour les frais scolaires de votre enfant. Nous vous prions de bien vouloir procéder au règlement dans les meilleurs délais.',
          waBody: 'Nous vous rappelons qu\'un solde reste à régler pour les frais scolaires de votre enfant. Nous vous prions de bien vouloir procéder au règlement dans les meilleurs délais.',
          smsBody: 'Solde en attente.',
          headerColor: '#f59e0b',
          headerColorDark: '#d97706',
          tableBg: '#fffbeb',
          tableBorder: '#fde68a',
        };
      case 'DEUXIEME_RELANCE':
        return {
          emoji: '⚠️',
          emailTitle: 'Rappel urgent de paiement',
          waTitle: '⚠️ Rappel urgent de paiement',
          smsTitle: 'Rappel urgent',
          emailBody: 'Malgré notre précédent rappel, le solde de votre enfant reste impayé. Nous vous invitons à régulariser rapidement cette situation pour éviter toute mesure conservatoire.',
          waBody: 'Malgré notre précédent rappel, le solde de votre enfant reste impayé. Nous vous invitons à régulariser rapidement cette situation pour éviter toute mesure conservatoire.',
          smsBody: 'Régularisation urgente requise.',
          headerColor: '#ea580c',
          headerColorDark: '#c2410c',
          tableBg: '#fff7ed',
          tableBorder: '#fed7aa',
        };
      case 'MISE_EN_DEMEURE':
        return {
          emoji: '🚨',
          emailTitle: 'Mise en demeure finale',
          waTitle: '🚨 Mise en demeure finale',
          smsTitle: 'Mise en demeure',
          emailBody: 'Après plusieurs rappels restés sans suite, nous sommes au regret de vous informer qu\'une mise en demeure finale est émise. Sans régularisation sous 8 jours, des mesures administratives seront engagées (suspension des services, blocage de l\'accès aux résultats scolaires).',
          waBody: 'Après plusieurs rappels restés sans suite, nous sommes au regret de vous informer qu\'une mise en demeure finale est émise. Sans régularisation sous 8 jours, des mesures administratives seront engagées.',
          smsBody: 'Mise en demeure. Mesures admin à venir.',
          headerColor: '#dc2626',
          headerColorDark: '#b91c1c',
          tableBg: '#fef2f2',
          tableBorder: '#fecaca',
        };
      default:
        return this.getLevelConfig('PREMIERE_RELANCE');
    }
  }

  /**
   * Récupère le branding de l'école (réutilise ReceiptFinanceService).
   */
  private async getTenantBranding(tenantId: string) {
    try {
      // Déléguer à ReceiptFinanceService qui a déjà cette méthode
      return await (this.receiptFinanceService as any).getTenantBranding(tenantId);
    } catch {
      return { schoolName: 'l\'établissement', schoolLogo: null, schoolAddress: '', schoolPhone: '', schoolEmail: '' };
    }
  }
}

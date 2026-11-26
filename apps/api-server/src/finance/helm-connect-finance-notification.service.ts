/**
 * ============================================================================
 * HELM CONNECT FINANCE NOTIFICATION SERVICE
 * ============================================================================
 *
 * ⭐ Purpose:
 * Replace SMS/WhatsApp notifications in the Finance module with Helm Connect
 * chat messages. When an encaissement (payment receipt) is recorded, or when
 * a recovery reminder (relance/action/promesse) is triggered, this service
 * sends a chat message to the parent's Helm Connect account using the
 * EXACT SAME wording as the previous WhatsApp templates — so parents
 * receive a consistent notification regardless of channel.
 *
 * ⭐ Endpoints used:
 *   - POST /api/chat/conversations/guardian-direct (creates/gets the conv
 *     with the parent — auto-provisions a User if needed)
 *   - POST /api/chat/conversations/:id/messages/text (sends a text message)
 *   - POST /api/chat/conversations/:id/messages/attachment (sends a PDF
 *     attachment with a caption)
 *
 * ⭐ Sender identity:
 * For encaissement receipts, the sender is the cashier (tx.cashierId).
 * For recovery reminders, the sender is the tenant's director (looked up
 * from users table — PROMOTER > SCHOOL_OWNER > ADMIN priority).
 *
 * ⭐ Templates:
 * The message text is built to match EXACTLY the existing WhatsApp templates
 * registered at Gupshup:
 *   - Receipt: 'recu_paiement' template (header "Recu de paiement" + 7 vars)
 *   - Recovery: free-text message assembled from getLevelConfig() — same
 *     wording as the WhatsApp branch in recovery-notification-finance.service.ts
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { ChatService } from '../communication/services/chat.service';
import { ParentUserProvisioningService } from '../students/services/parent-user-provisioning.service';

export interface ReceiptNotificationPayload {
  tenantId: string;
  studentId: string;
  studentName: string;
  receiptNumber: string;
  amount: number;
  className?: string;
  academicYearLabel?: string;
  cashierId: string;       // The user who recorded the payment
  pdfBuffer: Buffer;
  pdfFilename: string;     // e.g. "recu-CSPEB-R-25-00001.pdf"
  paymentDate: Date;
  // ⭐ Same fields as the WhatsApp template variables (recu_paiement):
  parentName?: string;              // {{1}}
  schoolName?: string;              // {{3}}
  // The balance_line variable {{7}} — pre-formatted by the caller to include:
  //   - fifoLine (arriérés réglés FIFO)
  //   - remainingArrearsLine (arriérés encore dus)
  //   - balanceLine (solde restant à payer)
  //   - personalizationNote (note personnalisée)
  balanceLine?: string;
  // ⭐ 2026-11-26 (retour promoteur) — signature par rôle de l'encaisseur
  //    (« Le Comptable », « Le Secrétaire Comptable »…). Repli : Service Comptable.
  signatureLabel?: string;
}

export interface RecoveryNotificationPayload {
  tenantId: string;
  studentId: string;
  studentName: string;
  guardianId: string;
  directorId?: string;
  level: 'PREMIERE_RELANCE' | 'DEUXIEME_RELANCE' | 'MISE_EN_DEMEURE';
  amountDue: number;
  daysOverdue: number;
  className?: string;
  academicYearLabel?: string;
  // ⭐ Same fields as the WhatsApp free-text message:
  parentName?: string;
  schoolName?: string;
  feeLabel?: string;
  isPreviousYearArrear?: boolean;
}

@Injectable()
export class HelmConnectFinanceNotificationService {
  private readonly logger = new Logger(HelmConnectFinanceNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
    private readonly parentUserProvisioningService: ParentUserProvisioningService,
  ) {}

  /**
   * Send a payment receipt to the parent's Helm Connect account.
   * Uses the EXACT same wording as the WhatsApp 'recu_paiement' template.
   * The PDF receipt is attached as a DOCUMENT message with the caption.
   */
  async sendReceiptNotification(payload: ReceiptNotificationPayload): Promise<{
    success: boolean;
    conversationId?: string;
    messageId?: string;
    error?: string;
  }> {
    try {
      // 1. Ensure the parent has a User account
      const provisioningResult = await this.parentUserProvisioningService
        .ensureUserForPrimaryGuardianOfStudent(payload.tenantId, payload.studentId);
      if (!provisioningResult) {
        this.logger.warn(
          `No guardian found for student ${payload.studentId} (tenant ${payload.tenantId}). Skipping Helm Connect receipt notification.`,
        );
        return { success: false, error: 'No guardian linked to this student' };
      }

      // 2. Create or get the direct conversation (cashier ↔ parent)
      const conversation = await this.chatService.createOrGetDirectConversation(
        payload.tenantId,
        payload.cashierId,
        provisioningResult.userId,
      );

      // 3. Build the message using the EXACT WhatsApp template 'recu_paiement'
      //    Template body (from whatsapp-template.registry.ts line 744-755):
      //      Bonjour {{1}},
      //
      //      Nous confirmons la reception du paiement pour {{2}} aupres de {{3}}.
      //
      //      Recu n° : {{4}}
      //      Montant : {{5}} FCFA
      //      Date : {{6}}
      //      {{7}}
      //      Le recu PDF detaille est disponible aupres de l'etablissement.
      //
      //      Cordialement,
      //      Le Service Comptable  ⭐ 2026-11-26 — ce n'est PAS la direction qui
      //      encaisse : signature comptabilité (rôle de l'encaisseur).
      //    Header: "Recu de paiement"
      //    Footer: FOOTER (= "Academia Helm — Helm Connect")
      const dateStr = payload.paymentDate.toLocaleDateString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      });
      const amountStr = payload.amount.toLocaleString('fr-FR');
      const parentName = payload.parentName || 'Parent';
      const studentName = escapeHtml(payload.studentName);
      const schoolName = escapeHtml(payload.schoolName || "l'établissement");
      const balanceLine = payload.balanceLine || '';

      const caption = [
        `🧾 <b>Recu de paiement</b>`,
        ``,
        `Bonjour ${escapeHtml(parentName)},`,
        ``,
        `Nous confirmons la reception du paiement pour ${studentName} aupres de ${schoolName}.`,
        ``,
        `<b>Recu n° :</b> ${escapeHtml(payload.receiptNumber)}`,
        `<b>Montant :</b> ${amountStr} FCFA`,
        `<b>Date :</b> ${dateStr}`,
        balanceLine ? escapeHtml(balanceLine) : null,
        `Le recu PDF detaille est disponible aupres de l'etablissement.`,
        ``,
        `Cordialement,`,
        escapeHtml(payload.signatureLabel || 'Le Service Comptable'),
        ``,
        `<i>— Academia Helm — Helm Connect</i>`,
      ].filter(Boolean).join('\n');

      // 4. Send the PDF as a DOCUMENT message with the caption
      const fakeFile: Express.Multer.File = {
        buffer: payload.pdfBuffer,
        originalname: payload.pdfFilename,
        mimetype: 'application/pdf',
        size: payload.pdfBuffer.length,
        fieldname: 'file',
        encoding: '7bit',
        destination: '',
        filename: payload.pdfFilename,
        path: '',
      } as unknown as Express.Multer.File;

      const message = await this.chatService.sendAttachmentMessage(
        payload.tenantId,
        payload.cashierId,
        conversation.id,
        {
          type: 'DOCUMENT',
          file: fakeFile,
          content: caption,
        },
      );

      this.logger.log(
        `✅ Receipt notification sent to parent (guardian ${provisioningResult.guardianId}) for student ${payload.studentId} — receipt ${payload.receiptNumber}, conversation ${conversation.id}, message ${message.id}`,
      );

      return {
        success: true,
        conversationId: conversation.id,
        messageId: message.id,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to send Helm Connect receipt notification: ${error.message}`,
        error.stack,
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Send a recovery reminder to the parent's Helm Connect account.
   * Uses the EXACT same wording as the WhatsApp free-text message in
   * recovery-notification-finance.service.ts sendByWhatsApp().
   */
  async sendRecoveryNotification(payload: RecoveryNotificationPayload): Promise<{
    success: boolean;
    conversationId?: string;
    messageId?: string;
    error?: string;
  }> {
    try {
      if (!payload.directorId) {
        this.logger.warn('No directorId provided for recovery notification — skipping');
        return { success: false, error: 'directorId required for recovery notifications' };
      }

      // 1. Ensure the parent has a User account (use guardianId directly)
      const provisioningResult = await this.parentUserProvisioningService
        .ensureUserForGuardian(payload.guardianId);
      if (!provisioningResult.userId) {
        return { success: false, error: 'Failed to provision parent User account' };
      }

      // 2. Create or get the direct conversation (director ↔ parent)
      const conversation = await this.chatService.createOrGetDirectConversation(
        payload.tenantId,
        payload.directorId,
        provisioningResult.userId,
      );

      // 3. Build the message using the EXACT same wording as the WhatsApp branch
      //    (see recovery-notification-finance.service.ts lines 437-457 + 530-572)
      const levelConfig = getRecoveryLevelConfig(payload.level);
      const schoolName = payload.schoolName || "l'établissement";
      const balanceStr = payload.amountDue.toLocaleString('fr-FR');
      const classPart = payload.className && payload.className !== '—'
        ? ` (Classe: ${payload.className})`
        : '';
      const yearPart = payload.academicYearLabel
        ? `📅 Année scolaire : ${payload.academicYearLabel}${payload.isPreviousYearArrear ? ' (arriéré reporté)' : ''}\n`
        : '';
      const fifoNote = payload.isPreviousYearArrear
        ? `\nℹ️ Conformément à la politique de l'établissement, les paiements sont affectés en priorité aux arriérés des années antérieures (méthode FIFO).\n`
        : '';

      const parentName = payload.parentName ? ` ${payload.parentName}` : '';
      const feeLabel = payload.feeLabel || 'frais scolaires';

      // Mirror the WhatsApp free-text message exactly:
      //   {{emoji}} {{waTitle}}\n
      //   \n
      //   Bonjour{{parentName}},\n
      //   \n
      //   {{waBody}}\n
      //   \n
      //   {{yearPart}}
      //   👤 Élève : {{studentName}}{{classPart}}\n
      //   💰 Solde restant : {{balanceStr}} FCFA\n
      //   📋 Frais : {{feeLabel}}\n
      //   {{fifoNote}}
      //   \n
      //   Merci de régulariser cette situation dans les meilleurs délais. Pour toute question, contactez l'administration de {{schoolName}}.\n
      //   \n
      //   Cordialement,\n
      //   Le Service Comptable — {{schoolName}}  ⭐ 2026-11-26 — relance = comptabilité
      const messageText = [
        `${levelConfig.emoji} <b>${levelConfig.waTitle}</b>`,
        ``,
        `Bonjour${parentName},`,
        ``,
        levelConfig.waBody,
        ``,
        yearPart + // already ends with \n if present
          `👤 Élève : ${escapeHtml(payload.studentName)}${classPart}\n` +
          `💰 Solde restant : ${balanceStr} FCFA\n` +
          `📋 Frais : ${escapeHtml(feeLabel)}\n` +
          (fifoNote ? fifoNote : '') +
          `\nMerci de régulariser cette situation dans les meilleurs délais. Pour toute question, contactez l'administration de ${escapeHtml(schoolName)}.`,
        ``,
        `Cordialement,`,
        `Le Service Comptable — ${escapeHtml(schoolName)}`,
      ].join('\n');

      // 4. Send as a TEXT message
      const message = await this.chatService.sendTextMessage(
        payload.tenantId,
        payload.directorId,
        conversation.id,
        { content: messageText },
      );

      this.logger.log(
        `✅ Recovery notification (${payload.level}) sent to parent (guardian ${payload.guardianId}) for student ${payload.studentId} — conversation ${conversation.id}, message ${message.id}`,
      );

      return {
        success: true,
        conversationId: conversation.id,
        messageId: message.id,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to send Helm Connect recovery notification: ${error.message}`,
        error.stack,
      );
      return { success: false, error: error.message };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Recovery level configuration — EXACT copy of the WhatsApp config
 * from recovery-notification-finance.service.ts getLevelConfig()
 * (lines 517-576). Keeping the same wording for consistency across
 * notification channels (WhatsApp + Helm Connect).
 */
function getRecoveryLevelConfig(level: 'PREMIERE_RELANCE' | 'DEUXIEME_RELANCE' | 'MISE_EN_DEMEURE'): {
  emoji: string;
  waTitle: string;
  waBody: string;
} {
  switch (level) {
    case 'PREMIERE_RELANCE':
      return {
        emoji: '📧',
        waTitle: 'Rappel de paiement',
        waBody: "Nous vous rappelons qu'un solde reste à régler pour les frais scolaires de votre enfant. Nous vous prions de bien vouloir procéder au règlement dans les meilleurs délais.",
      };
    case 'DEUXIEME_RELANCE':
      return {
        emoji: '⚠️',
        waTitle: 'Rappel urgent de paiement',
        waBody: 'Malgré notre précédent rappel, le solde de votre enfant reste impayé. Nous vous invitons à régulariser rapidement cette situation pour éviter toute mesure conservatoire.',
      };
    case 'MISE_EN_DEMEURE':
      return {
        emoji: '🚨',
        waTitle: 'Mise en demeure finale',
        waBody: "Après plusieurs rappels restés sans suite, nous sommes au regret de vous informer qu'une mise en demeure finale est émise. Sans régularisation sous 8 jours, des mesures administratives seront engagées.",
      };
    default:
      return getRecoveryLevelConfig('PREMIERE_RELANCE');
  }
}

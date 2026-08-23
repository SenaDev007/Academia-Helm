/**
 * ============================================================================
 * HELM CONNECT FINANCE NOTIFICATION SERVICE
 * ============================================================================
 *
 * ⭐ Purpose:
 * Replace SMS/WhatsApp notifications in the Finance module with Helm Connect
 * chat messages. When an encaissement (payment receipt) is recorded, or when
 * a recovery reminder (relance/action/promesse) is triggered, this service
 * sends a professional, well-structured message to the parent's Helm Connect
 * account (instead of sending an SMS to their phone).
 *
 * ⭐ Why Helm Connect instead of SMS:
 *   - The parent already has a Helm Connect account (auto-provisioned by
 *     ParentUserProvisioningService when their child was enrolled).
 *   - The parent can login to the parent portal with their phone number.
 *   - Messages are free (no SMS gateway fees) and persistent (the parent
 *     can re-read them anytime).
 *   - PDF receipts can be attached (impossible with SMS).
 *
 * ⭐ Endpoints used:
 *   - POST /api/chat/conversations/guardian-direct (creates/gets the conv
 *     with the parent — auto-provisions a User if needed)
 *   - POST /api/chat/conversations/:id/messages/text (sends a text message)
 *   - POST /api/chat/conversations/:id/messages/attachment (sends a PDF
 *     attachment with a caption)
 *
 * ⭐ Sender identity:
 * For encaissement receipts, the sender is the cashier (the user who recorded
 * the payment). For recovery reminders, the sender is the school's director
 * or a per-tenant "Helm Connect" bot user.
 *
 * ⭐ Fallback strategy:
 * If the parent has no guardian record (rare edge case), the message is
 * skipped silently (with a warning log). The existing email/WhatsApp
 * notification channels are NOT disabled yet — they continue to fire in
 * parallel, so the parent always receives the notification through at
 * least one channel.
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
  balanceAfter?: number;   // Remaining balance after this payment (optional)
}

export interface RecoveryNotificationPayload {
  tenantId: string;
  studentId: string;
  studentName: string;
  guardianId: string;
  directorId?: string;     // The user sending the reminder (defaults to bot)
  level: 'PREMIERE_RELANCE' | 'DEUXIEME_RELANCE' | 'MISE_EN_DEMEURE';
  amountDue: number;
  daysOverdue: number;
  className?: string;
  academicYearLabel?: string;
  customMessage?: string;
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
   * The PDF receipt is attached as a DOCUMENT message with a caption.
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

      // 3. Build a professional, well-structured message
      const formattedAmount = formatCurrencyXOF(payload.amount);
      const formattedBalance = payload.balanceAfter !== undefined
        ? formatCurrencyXOF(payload.balanceAfter)
        : null;
      const dateStr = payload.paymentDate.toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'long', year: 'numeric',
      });

      const caption = [
        `🧾 <b>Reçu de paiement — ${escapeHtml(payload.receiptNumber)}</b>`,
        ``,
        `<b>Élève :</b> ${escapeHtml(payload.studentName)}`,
        payload.className ? `<b>Classe :</b> ${escapeHtml(payload.className)}` : null,
        payload.academicYearLabel ? `<b>Année scolaire :</b> ${escapeHtml(payload.academicYearLabel)}` : null,
        ``,
        `<b>Montant réglé :</b> ${formattedAmount}`,
        formattedBalance !== null
          ? `<b>Solde restant dû :</b> ${formattedBalance}`
          : `<b>Solde restant dû :</b> 0 FCFA (soldé)`,
        `<b>Date :</b> ${dateStr}`,
        ``,
        `Bonjour, veuillez trouver ci-joint le reçu de paiement pour l'encaissement effectué. Ce document fait foi de preuve de paiement. Pour toute question, veuillez contacter l'administration de l'école.`,
        ``,
        `<i>Message automatique envoyé via Helm Connect — Academia Helm</i>`,
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
   * Three levels: PREMIERE_RELANCE (J+3), DEUXIEME_RELANCE (J+7), MISE_EN_DEMEURE (J+15).
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

      // 3. Build the message based on the level
      const formattedAmount = formatCurrencyXOF(payload.amountDue);
      const messageText = buildRecoveryMessage(payload, formattedAmount);

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

function formatCurrencyXOF(amount: number): string {
  // XOF has no decimals — format with thousands separator (French style)
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`;
}

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildRecoveryMessage(
  payload: RecoveryNotificationPayload,
  formattedAmount: string,
): string {
  const studentName = escapeHtml(payload.studentName);
  const className = payload.className ? escapeHtml(payload.className) : null;
  const academicYear = payload.academicYearLabel ? escapeHtml(payload.academicYearLabel) : null;
  const customMessage = payload.customMessage ? escapeHtml(payload.customMessage) : null;

  const headerEmoji = {
    PREMIERE_RELANCE: '📧',
    DEUXIEME_RELANCE: '⚠️',
    MISE_EN_DEMEURE: '🚨',
  }[payload.level];

  const headerTitle = {
    PREMIERE_RELANCE: 'Rappel de paiement',
    DEUXIEME_RELANCE: 'Rappel urgent de paiement',
    MISE_EN_DEMEURE: 'Mise en demeure finale',
  }[payload.level];

  const bodyIntro = {
    PREMIERE_RELANCE: `Nous vous rappelons qu'un solde reste à régler pour la scolarité de votre enfant ${studentName}.`,
    DEUXIEME_RELANCE: `Malgré notre précédent rappel, le solde de la scolarité de ${studentName} reste impayé.`,
    MISE_EN_DEMEURE: `Après plusieurs rappels restés sans suite, nous vous informons que des mesures administratives seront engagées (suspension des services, blocage de l'accès aux résultats) si le règlement n'intervient pas sous 48h.`,
  }[payload.level];

  const lines: string[] = [
    `${headerEmoji} <b>${headerTitle}</b>`,
    ``,
    bodyIntro,
    ``,
    `<b>Élève :</b> ${studentName}`,
    className ? `<b>Classe :</b> ${className}` : null,
    academicYear ? `<b>Année scolaire :</b> ${academicYear}` : null,
    `<b>Montant dû :</b> ${formattedAmount}`,
    `<b>Jours de retard :</b> ${payload.daysOverdue} jour${payload.daysOverdue > 1 ? 's' : ''}`,
    ``,
    `Nous vous prions de bien vouloir régulariser la situation dans les meilleurs délais. Pour toute information complémentaire ou pour convenir d'un échéancier, veuillez contacter l'administration de l'école.`,
    customMessage ? `\n<b>Message complémentaire :</b> ${customMessage}` : null,
    ``,
    `<i>Message automatique envoyé via Helm Connect — Academia Helm</i>`,
  ].filter(Boolean);

  return lines.join('\n');
}

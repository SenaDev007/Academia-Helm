/**
 * ============================================================================
 * SCHEDULED EMAIL DISPATCHER — Cron qui envoie les emails programmés
 * ============================================================================
 *
 * Tourne toutes les minutes pour vérifier les emails PENDING dont
 * scheduledAt <= now() et les envoie via EmailService.sendCategorized().
 *
 * Logique :
 *   1. Récupère les emails PENDING dus (scheduledAt <= now())
 *   2. Pour chaque email :
 *      a. Si l'option replyToOverride est fournie → on la passe à
 *         sendCategorized (le candidat répondra directement au recruteur)
 *      b. Envoie l'email via EmailService
 *      c. Marque comme SENT (avec emailLogId) ou FAILED
 *
 * Sécurité :
 *   - Limité à 50 emails par run (évite OOM)
 *   - Gestion d'erreur par email (un échec ne bloque pas les autres)
 *   - Log détaillé pour audit
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScheduledEmailService } from './scheduled-email.service';
import { EmailService } from './email.service';

@Injectable()
export class ScheduledEmailDispatcherService {
  private readonly logger = new Logger(ScheduledEmailDispatcherService.name);
  private isRunning = false;

  constructor(
    private readonly scheduledEmailService: ScheduledEmailService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Cron toutes les minutes pour dispatcher les emails programmés dus.
   *
   * Utilise '0 * * * * *' (toutes les minutes à la seconde 0) pour éviter
   * le pic de charge au début de la minute.
   */
  @Cron('0 * * * * *')
  async dispatchPendingEmails(): Promise<void> {
    // Évite les runs concurrents si le précédent n'a pas fini
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;

    try {
      const pendingEmails = await this.scheduledEmailService.findPendingDue();

      if (pendingEmails.length === 0) {
        return; // rien à envoyer
      }

      this.logger.log(
        `Dispatching ${pendingEmails.length} scheduled email(s) due now`,
      );

      let sentCount = 0;
      let failedCount = 0;

      for (const email of pendingEmails) {
        try {
          await this.sendOne(email);
          sentCount++;
        } catch (err: any) {
          failedCount++;
          this.logger.error(
            `Failed to send scheduled email ${email.id} to ${email.to_email}: ${err.message}`,
            err.stack,
          );
        }
      }

      this.logger.log(
        `Scheduled email dispatch complete: ${sentCount} sent, ${failedCount} failed`,
      );
    } catch (err: any) {
      // Si la table scheduled_emails n'existe pas encore (migration non
      // appliquée), on logge en warning sans crasher — le prochain run
      // réessaiera une fois la migration appliquée.
      if (err?.message?.includes('relation') && err?.message?.includes('does not exist')) {
        this.logger.warn(
          `scheduled_emails table not found — skipping dispatch (migration may not be applied yet)`,
        );
      } else {
        this.logger.error(
          `Scheduled email dispatcher error: ${err.message}`,
          err.stack,
        );
      }
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Envoie un email programmé individuel.
   */
  private async sendOne(email: any): Promise<void> {
    // Utiliser sendCategorized si category + tenantId sont fournis
    // (traçabilité EmailLog + replyToOverride)
    const hasCategory = !!email.category;
    const tenantId = email.tenant_id;

    if (hasCategory && tenantId) {
      try {
        const result = await this.emailService.sendCategorized({
          tenantId,
          category: email.category as any,
          subCategory: email.subcategory || undefined,
          module: email.module || undefined,
          to: email.to_email,
          toName: email.to_name || undefined,
          recipientType: email.recipient_type as any,
          recipientId: email.recipient_id || undefined,
          fromName: 'Academia Helm',
          subject: email.subject,
          html: email.html_body,
          text: email.text_body || undefined,
          relatedEntityId: email.recipient_id || undefined,
          relatedEntityType: email.recipient_type || undefined,
          replyToOverride: email.reply_to_override || undefined,
        });

        if (result.success) {
          await this.scheduledEmailService.markAsSent(email.id, result.logId);
          this.logger.log(
            `✅ Scheduled email sent: id=${email.id}, to=${email.to_email}, subject="${email.subject.substring(0, 60)}", logId=${result.logId}`,
          );
        } else {
          await this.scheduledEmailService.markAsFailed(
            email.id,
            result.error || 'Provider returned success=false',
          );
        }
        return;
      } catch (err: any) {
        // Fallback vers sendEmail simple si sendCategorized échoue
        this.logger.warn(
          `sendCategorized failed for ${email.id}, falling back to sendEmail: ${err.message}`,
        );
      }
    }

    // Voie legacy (non catégorisée)
    try {
      const result = await this.emailService.sendEmail({
        to: email.to_email,
        subject: email.subject,
        html: email.html_body,
        text: email.text_body || undefined,
        fromName: 'Academia Helm',
        replyTo: email.reply_to_override || undefined,
      });

      if (result.success) {
        await this.scheduledEmailService.markAsSent(email.id);
        this.logger.log(
          `✅ Scheduled email sent (legacy): id=${email.id}, to=${email.to_email}`,
        );
      } else {
        await this.scheduledEmailService.markAsFailed(
          email.id,
          'Provider returned success=false',
        );
      }
    } catch (err: any) {
      await this.scheduledEmailService.markAsFailed(email.id, err.message);
      throw err; // re-throw pour le compteur failedCount
    }
  }
}

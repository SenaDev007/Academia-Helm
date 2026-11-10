/**
 * ============================================================================
 * SCHEDULED EMAIL DISPATCHER — Envoi des emails programmés
 * ============================================================================
 *
 * ⭐ AUDIT COÛT NEON — v3 événementielle (2026-11-10).
 *    Historique : @Cron(EVERY_MINUTE) → 1 440 requêtes/jour ; interim 15 min
 *    (4b2d12d) → encore 96 réveils/jour. Un compute Neon suspendu se réveille
 *    à chaque requête et reste ensuite actif ~5 min → même à 15 min, la base
 *    passait ~1/3 du temps éveillée SANS utilisateur.
 *
 *    Désormais (v3) : chaque email PENDING est armé en mémoire (setTimeout)
 *    à sa date exacte → zéro requête périodique. Le controller notifie ce
 *    dispatcher à chaque création/annulation/suppression, onModuleInit
 *    rattrape au démarrage (1 requête/déploiement), et @Cron 6 h = balayage
 *    de rattrapage anti-crash (4 requêtes/jour).
 *
 * Logique (conservée) :
 *   1. Récupère les emails PENDING dus (scheduledAt <= now())
 *   2. Pour chaque email : sendCategorized si category (replyToOverride),
 *      sinon sendEmail legacy
 *   3. Marque comme SENT (avec emailLogId) ou FAILED
 *
 * Sécurité :
 *   - Limité à 50 emails par run (évite OOM)
 *   - Gestion d'erreur par email (un échec ne bloque pas les autres)
 *   - Log détaillé pour audit
 * ============================================================================
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScheduledEmailService } from './scheduled-email.service';
import { EmailService } from './email.service';

@Injectable()
export class ScheduledEmailDispatcherService implements OnModuleInit {
  private readonly logger = new Logger(ScheduledEmailDispatcherService.name);
  private isRunning = false;

  // ⭐ Timers in-process : envoi à l'heure exacte sans AUCUN polling DB.
  private timers = new Map<string, NodeJS.Timeout>();

  /** Rattrapage au démarrage : arme les emails PENDING (1 requête/déploiement). */
  async onModuleInit(): Promise<void> {
    setTimeout(() => {
      this.notifyScheduledChanged().catch(() => {});
    }, 30_000);
  }

  /**
   * Réarmement complet — au démarrage et après création/annulation/suppression
   * (action utilisateur → requête légitime). Remplace le polling périodique.
   */
  async notifyScheduledChanged(): Promise<void> {
    try {
      const pending = await this.scheduledEmailService.findPendingAll();
      this.clearTimers();
      let hasDue = false;
      for (const email of pending as any[]) {
        const when = new Date(email.scheduled_at).getTime();
        if (!Number.isFinite(when)) continue;
        if (when <= Date.now()) hasDue = true;
        this.armEmail(email.id, when);
      }
      if (hasDue) await this.dispatchPendingEmails();
    } catch (e: any) {
      this.logger.warn(`Rattrapage emails programmés : ${e?.message}`);
    }
  }

  /** Arme l'envoi d'un email à sa date exacte (in-process, zéro polling DB). */
  private armEmail(id: string, when: number): void {
    const delay = when - Date.now();
    // Déjà dû → dispatch immédiat ; horizon > 24 j → balayage 6 h s'en charge
    if (delay > 24 * 24 * 60 * 60 * 1000) return;
    const fire = () => {
      this.timers.delete(id);
      this.dispatchPendingEmails().catch(() => {});
    };
    const t: NodeJS.Timeout = delay <= 0 ? setTimeout(fire, 0) : setTimeout(fire, delay);
    (t as any).unref?.(); // ne retient pas l'arrêt du process
    this.timers.set(id, t);
  }

  private clearTimers(): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }

  constructor(
    private readonly scheduledEmailService: ScheduledEmailService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Balayage de rattrapage 4×/jour (00/06/12/18 h) — rattrape crash/restart
   * et les emails au-delà de l'horizon de 24 j des timers.
   * ⚠️ Format 5 champs uniquement (pas de secondes) — @nestjs/schedule rejette
   *    les expressions 6 champs (crash au démarrage, cf. note Fly.io).
   */
  @Cron('0 */6 * * *')
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

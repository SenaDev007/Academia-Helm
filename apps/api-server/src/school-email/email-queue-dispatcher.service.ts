/**
 * ============================================================================
 * 📧 TÂCHE 181 — DISPATCHER DE LA FILE D'ATTENTE E-MAIL
 * ============================================================================
 *
 * Cahier des charges section 5 (file d'attente et envois en lot) :
 *   - Alternative PostgreSQL à BullMQ : SELECT ... FOR UPDATE SKIP LOCKED.
 *   - Débit limité à 20 e-mails par minute et par école.
 *   - Relance automatique avec délai croissant, 3 tentatives maximum.
 *     Erreur 4xx → relance. Erreur 5xx ou auth → arrêt + connexion Erreur.
 *   - Statuts : En attente, Envoyé, Reporté, Échec.
 *
 * ⭐ AUDIT COÛT NEON — pattern v3 événementiel (comme scheduled-email-
 *   dispatcher) : ZÉRO polling périodique. Chaque enqueue notifie le
 *   dispatcher (timers en mémoire), le démarrage rattrape les items dus,
 *   et un balayage anti-crash 4×/jour suffit en filet de sécurité.
 * ============================================================================
 */

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { prismaUpdateDefaults, uuid } from '../common/utils/prisma-helpers';
import { SchoolEmailSettingsService } from './school-email-settings.service';
import { GoogleOauthService } from './google-oauth.service';
import {
  GmailApiError,
  GoogleAuthExpiredError,
  classifyGmailApiError,
  safeGmailErrorMessage,
} from './google-oauth.helpers';
import {
  appendHtmlFooter,
  appendTextFooter,
  classifySmtpError,
  createSmtpTransport,
  queueAttachmentsToNodemailer,
  safeSmtpErrorMessage,
} from './smtp-helpers';
import { EmailQueuePayload } from './dto/school-email.dto';

/** Délais de relance croissants (3 tentatives max, CDC 5.3). */
const BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000]; // 1 min, 5 min, 15 min

/** Débit maximum par école (CDC 5.2 : 20 e-mails/minute). */
const RATE_PER_MINUTE = 20;

/** Taille max d'un lot traité d'un coup (évite OOM). */
const BATCH_LIMIT = 50;

/** Attente max du bouton « test » (waitForItem). */
const WAIT_POLL_MS = 500;

interface QueueRow {
  id: string;
  tenantId: string;
  module: string;
  category: string;
  payload: string;
  status: string;
  attempts: number;
  maxAttempts: number;
}

@Injectable()
export class EmailQueueDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailQueueDispatcherService.name);
  private isRunning = false;
  private timers = new Map<string, NodeJS.Timeout>();
  /** Résolution des attentes waitForItem (bouton test). */
  private waiters = new Map<string, (status: string) => void>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SchoolEmailSettingsService,
    private readonly googleOauth: GoogleOauthService,
  ) {}

  /** Rattrapage au démarrage : traite les items dus (1 requête/déploiement). */
  async onModuleInit(): Promise<void> {
    setTimeout(() => {
      this.dispatchDue().catch(() => {});
    }, 30_000);
  }

  onModuleDestroy(): void {
    this.clearTimers();
  }

  private clearTimers(): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }

  /**
   * Notification événementielle : appelée après chaque enqueue. Déclenche un
   * dispatch différé de 100 ms (déduplique les rafales d'envois en masse) et
   * arme les timers des items reportés.
   */
  async notifyChanged(): Promise<void> {
    try {
      const deferred = await this.prisma.$queryRaw<Array<{ id: string; nextAttemptAt: Date }>>`
        SELECT "id", "nextAttemptAt" FROM "email_queue"
        WHERE "status" = 'reporte' LIMIT 200`;
      for (const d of deferred) {
        this.armTimer(d.id, new Date(d.nextAttemptAt).getTime());
      }
      const t = setTimeout(() => {
        this.timers.delete('__notify__');
        this.dispatchDue().catch(() => {});
      }, 100);
      (t as any).unref?.();
      this.timers.set('__notify__', t);
    } catch (e: any) {
      this.logger.warn(`notifyChanged : ${e?.message}`);
    }
  }

  /** Arme l'envoi d'un item à sa date exacte (in-process, zéro polling DB). */
  private armTimer(id: string, when: number): void {
    if (this.timers.has(id)) return;
    const delay = Math.max(0, when - Date.now());
    if (delay > 24 * 24 * 60 * 60 * 1000) return; // > 24 j : le balayage 6 h s'en charge
    const t = setTimeout(() => {
      this.timers.delete(id);
      this.dispatchDue().catch(() => {});
    }, delay);
    (t as any).unref?.();
    this.timers.set(id, t);
  }

  /**
   * Balayage de rattrapage anti-crash 4×/jour (00/06/12/18 h).
   * ⚠️ Format 5 champs uniquement — @nestjs/schedule rejette le 6 champs.
   */
  @Cron('0 */6 * * *')
  async sweep(): Promise<void> {
    await this.dispatchDue().catch(() => {});
  }

  /**
   * Attend l'issue d'un élément de file (bouton « Envoyer un e-mail test »).
   * @returns le statut final ('envoye' | 'echec' | 'reporte') ou null (délai).
   */
  async waitForItem(queueItemId: string, timeoutMs: number): Promise<string | null> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const item = await this.prisma.emailQueue.findUnique({
        where: { id: queueItemId },
        select: { status: true },
      });
      if (!item) return null;
      if (item.status === 'envoye' || item.status === 'echec') return item.status;
      if (item.status === 'reporte') return 'reporte';
      await new Promise((r) => setTimeout(r, WAIT_POLL_MS));
    }
    return null;
  }

  /**
   * Traite les items dus : SELECT ... FOR UPDATE SKIP LOCKED.
   * Sécurité multi-instances : le verrou empêche deux workers de traiter le
   * même item ; sécurité mémoire : lot de 50 max.
   */
  async dispatchDue(): Promise<void> {
    if (this.isRunning) return; // pas de réentrance dans ce process
    this.isRunning = true;
    try {
      const rows = (await this.prisma.$queryRaw<QueueRow[]>`
        SELECT "id", "tenantId", "module", "category", "payload", "status", "attempts", "maxAttempts"
        FROM "email_queue"
        WHERE "status" IN ('en_attente', 'reporte') AND "nextAttemptAt" <= NOW()
        ORDER BY "createdAt" ASC
        LIMIT ${BATCH_LIMIT}
        FOR UPDATE SKIP LOCKED`) as QueueRow[];

      if (rows.length === 0) return;

      // Regroupement par école pour respecter le débit 20/min/école.
      const byTenant = new Map<string, QueueRow[]>();
      for (const row of rows) {
        const list = byTenant.get(row.tenantId) || [];
        list.push(row);
        byTenant.set(row.tenantId, list);
      }

      for (const [tenantId, items] of byTenant) {
        await this.dispatchForTenant(tenantId, items);
      }
    } catch (e: any) {
      this.logger.error(`dispatchDue : ${e?.message}`);
    } finally {
      this.isRunning = false;
    }
  }

  private async dispatchForTenant(tenantId: string, items: QueueRow[]): Promise<void> {
    const settingsRow = await this.settings.findRaw(tenantId);
    if (!settingsRow || settingsRow.mode === 'aucun') {
      // École déconnectée entre-temps → échec définitif (sans perte de log).
      for (const item of items) {
        await this.finalizeFailure(
          item,
          'EMAIL_SCHOOL_NOT_CONFIGURED',
          "Connexion e-mail de l'école déconnectée.",
        );
      }
      return;
    }

    // Débit : envois des 60 dernières secondes via le Gmail de l'école.
    const sentLastMinute = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "email_send_log"
      WHERE "tenantId" = ${tenantId} AND "provider" <> 'resend'
        AND "status" IN ('pending', 'envoye')
        AND "createdAt" > NOW() - INTERVAL '60 seconds'`;
    let budget = RATE_PER_MINUTE - Number(sentLastMinute[0]?.count ?? 0);

    for (const item of items) {
      if (budget <= 0) {
        // Débit atteint : re-diffère d'une minute pile (aucune perte).
        await this.prisma.emailQueue.update({
          where: { id: item.id },
          data: {
            ...prismaUpdateDefaults(),
            status: 'reporte',
            nextAttemptAt: new Date(Date.now() + 60_000),
          },
        });
        this.armTimer(item.id, Date.now() + 60_000);
        continue;
      }

      const payload = this.parsePayload(item.payload);
      const recipients = [...(payload.to || []), ...(payload.cc || []), ...(payload.bcc || [])];
      if (recipients.length === 0) {
        await this.finalizeFailure(item, 'NO_VALID_RECIPIENT', 'Aucun destinataire valide.');
        continue;
      }

      // Plafond 24 h glissant : re-vérification au moment d'envoyer (les items
      // « reporte » repassent ici quand la fenêtre se libère).
      const capOk = await this.hasCapRoom(tenantId, settingsRow.dailyCap, recipients.length);
      if (!capOk.ok) {
        await this.prisma.emailQueue.update({
          where: { id: item.id },
          data: {
            ...prismaUpdateDefaults(),
            status: 'reporte',
            nextAttemptAt: capOk.retryAt ?? new Date(Date.now() + 5 * 60_000),
          },
        });
        this.armTimer(item.id, (capOk.retryAt ?? new Date(Date.now() + 5 * 60_000)).getTime());
        continue;
      }

      // Envoi réel — SMTP (phase 1) OU API Gmail OAuth2 (phase 2, tâche 183)
      // avec découpage par destinataire si le plafond ou le débit ne permet
      // pas tout envoyer d'un coup (CDC 4.4 : le 491e passe en Reporté).
      try {
        const isGoogle = settingsRow.mode === 'google_oauth';
        const provider: 'google_oauth' | 'smtp' = isGoogle ? 'google_oauth' : 'smtp';

        const allRecipients = [
          ...(payload.to || []),
          ...(payload.cc || []),
          ...(payload.bcc || []),
        ];
        // Nombre de destinataires envoyables MAINTENANT : plafond ET débit.
        const roomCap = await this.hasCapRoom(tenantId, settingsRow.dailyCap, allRecipients.length);
        let sendable = allRecipients.length;
        if (!roomCap.ok) {
          sendable = Math.min(
            sendable,
            Math.max(0, settingsRow.dailyCap - (roomCap.used ?? settingsRow.dailyCap)),
          );
        }
        sendable = Math.min(sendable, Math.max(0, budget));

        if (sendable <= 0) {
          const retryAt = roomCap.retryAt ?? new Date(Date.now() + 60_000);
          await this.prisma.emailQueue.update({
            where: { id: item.id },
            data: { ...prismaUpdateDefaults(), status: 'reporte', nextAttemptAt: retryAt },
          });
          this.armTimer(item.id, retryAt.getTime());
          continue;
        }

        const sendNow = allRecipients.slice(0, sendable);
        const remaining = allRecipients.slice(sendable);

        const html = payload.html
          ? appendHtmlFooter(payload.html, settingsRow.fromName)
          : undefined;
        const text = payload.text
          ? appendTextFooter(payload.text, settingsRow.fromName)
          : undefined;

        // ⚠️ From BLOQUÉ côté serveur : Gmail impose l'adresse du compte
        // authentifié (CDC section 3, règles d'en-têtes).
        const from = `"${settingsRow.fromName.replace(/"/g, '')}" <${settingsRow.fromEmail}>`;
        const mailOptions = {
          from,
          replyTo: payload.replyTo || settingsRow.replyTo || undefined,
          to: sendNow,
          subject: payload.subject,
          html,
          text,
          attachments: queueAttachmentsToNodemailer(payload.attachments),
        };

        let messageId: string | undefined;
        if (isGoogle) {
          // Phase 2 — API Gmail REST (portée gmail.send, PKCE) : jeton rafraîchi
          // en interne, une reprise sur 401, invalid_grant → Expiré.
          const result = await this.googleOauth.sendMail(tenantId, mailOptions);
          messageId = result.messageId;
        } else {
          // Phase 1 — SMTP mot de passe d'application.
          const password = await this.settings.decryptSecret(tenantId);
          const transport = createSmtpTransport({
            host: settingsRow.smtpHost || 'smtp.gmail.com',
            port: settingsRow.smtpPort || 587,
            user: settingsRow.smtpUser || settingsRow.fromEmail,
            password,
          });
          const info = await transport.sendMail(mailOptions);
          transport.close();
          messageId = info?.messageId;
        }

        if (remaining.length > 0) {
          // Portion envoyée + reste reporté à la libération de fenêtre.
          await this.finalizePartialSuccess(item, sendNow, remaining, messageId, provider);
        } else {
          await this.finalizeSuccess(item, messageId, provider);
        }
        await this.settings.markVerified(tenantId);
        budget -= sendNow.length;
      } catch (err: any) {
        // Clé de chiffrement changée → connexion Expirée (CDC section 7.6)
        if (err?.name === 'EmailSecretDecryptError') {
          await this.finalizeFailure(
            item,
            'EMAIL_SECRET_EXPIRED',
            err?.message || 'Secret indéchiffrable',
          );
          continue;
        }
        // TÂCHE 183 — invalid_grant Google → connexion Expirée (CDC section 8)
        if (err instanceof GoogleAuthExpiredError || err?.name === 'GoogleAuthExpiredError') {
          await this.finalizeFailure(item, 'EMAIL_SCHOOL_EXPIRE', safeGmailErrorMessage(err));
          continue;
        }
        // TÂCHE 183 — erreurs API Gmail : 429/5xx → relance, 401 → auth,
        // invalid_grant → déjà traité ci-dessus, 4xx autre → définitif.
        if (err instanceof GmailApiError || err?.name === 'GmailApiError') {
          const kind = classifyGmailApiError(err);
          const safeMsg = safeGmailErrorMessage(err);
          if (kind === 'fatal_auth' || kind === 'fatal') {
            await this.settings.markError(tenantId, safeMsg);
            await this.finalizeFailure(
              item,
              kind === 'fatal_auth' ? 'GMAIL_AUTH_FAILED' : 'GMAIL_PERMANENT_ERROR',
              safeMsg,
            );
          } else {
            const attempts = item.attempts + 1;
            if (attempts >= item.maxAttempts) {
              await this.finalizeFailure(item, 'GMAIL_RETRIES_EXHAUSTED', safeMsg);
            } else {
              const next = new Date(
                Date.now() + BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)],
              );
              await this.prisma.emailQueue.update({
                where: { id: item.id },
                data: {
                  ...prismaUpdateDefaults(),
                  status: 'en_attente',
                  attempts,
                  lastError: safeMsg.slice(0, 500),
                  nextAttemptAt: next,
                },
              });
              this.armTimer(item.id, next.getTime());
            }
          }
          continue;
        }
        const kind = classifySmtpError(err);
        const safeMsg = safeSmtpErrorMessage(err);
        if (kind === 'fatal_auth' || kind === 'fatal') {
          // 5xx / auth → arrêt immédiat + connexion en statut Erreur (CDC 5.3)
          await this.settings.markError(tenantId, safeMsg);
          await this.finalizeFailure(
            item,
            kind === 'fatal_auth' ? 'SMTP_AUTH_FAILED' : 'SMTP_PERMANENT_ERROR',
            safeMsg,
          );
        } else {
          // 4xx / réseau → relance avec délai croissant (3 max)
          const attempts = item.attempts + 1;
          if (attempts >= item.maxAttempts) {
            await this.finalizeFailure(item, 'SMTP_RETRIES_EXHAUSTED', safeMsg);
          } else {
            const next = new Date(
              Date.now() + BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)],
            );
            await this.prisma.emailQueue.update({
              where: { id: item.id },
              data: {
                ...prismaUpdateDefaults(),
                status: 'en_attente',
                attempts,
                lastError: safeMsg.slice(0, 500),
                nextAttemptAt: next,
              },
            });
            this.armTimer(item.id, next.getTime());
          }
        }
      }
    }
  }

  // ─── Finalisation ─────────────────────────────────────────────────────────

  private async finalizeSuccess(
    item: QueueRow,
    messageId: string | undefined,
    provider: 'google_oauth' | 'smtp' = 'smtp',
  ): Promise<void> {
    const payload = this.parsePayload(item.payload);
    await this.prisma.$transaction(async (tx) => {
      await tx.emailQueue.update({
        where: { id: item.id },
        data: { ...prismaUpdateDefaults(), status: 'envoye', lastError: null },
      });
      // Journal : une ligne PAR DESTINATAIRE (To, Cc, Bcc — CDC section 4.1).
      const recipients = [...(payload.to || []), ...(payload.cc || []), ...(payload.bcc || [])];
      await this.insertSendLogRows(tx, item, recipients, 'envoye', null, provider);
      // Marque l'EmailLog du module Communication s'il est lié (bridge).
      if (payload.emailLogId) {
        await tx.emailLog
          .update({
            where: { id: payload.emailLogId },
            data: {
              status: 'SENT',
              provider,
              providerId: messageId ?? null,
              sentAt: new Date(),
              updatedAt: new Date(),
            },
          })
          .catch(() => {});
      }
    });
  }

  /**
   * Portion envoyée + reste reporté : journalise la portion envoyée puis
   * met à jour l'item avec les destinataires restants (status reporte,
   * prochaine tentative à la libération de la fenêtre 24 h).
   */
  private async finalizePartialSuccess(
    item: QueueRow,
    sentRecipients: string[],
    remaining: string[],
    messageId: string | undefined,
    provider: 'google_oauth' | 'smtp' = 'smtp',
  ): Promise<void> {
    const payload = this.parsePayload(item.payload);
    const retryAt = await this.windowReleaseTime(item.tenantId);
    await this.prisma.$transaction(async (tx) => {
      await this.insertSendLogRows(tx, item, sentRecipients, 'envoye', null, provider);
      const newPayload: EmailQueuePayload = {
        ...payload,
        to: remaining,
        cc: undefined,
        bcc: undefined,
      };
      await tx.emailQueue.update({
        where: { id: item.id },
        data: {
          ...prismaUpdateDefaults(),
          status: 'reporte',
          nextAttemptAt: retryAt,
          payload: JSON.stringify(newPayload),
        },
      });
      if (payload.emailLogId) {
        await tx.emailLog
          .update({
            where: { id: payload.emailLogId },
            data: {
              status: 'SENT',
              provider,
              providerId: messageId ?? null,
              sentAt: new Date(),
              updatedAt: new Date(),
            },
          })
          .catch(() => {});
      }
    });
    this.armTimer(item.id, retryAt.getTime());
    this.logger.log(
      `Envoi partiel (tenant ${item.tenantId}) : ${sentRecipients.length} envoyés, ${remaining.length} reportés à ${retryAt.toISOString()}`,
    );
  }

  private async finalizeFailure(
    item: QueueRow,
    errorCode: string,
    errorMessage: string,
  ): Promise<void> {
    const payload = this.parsePayload(item.payload);
    await this.prisma.$transaction(async (tx) => {
      await tx.emailQueue.update({
        where: { id: item.id },
        data: {
          ...prismaUpdateDefaults(),
          status: 'echec',
          lastError: `${errorCode}: ${errorMessage}`.slice(0, 500),
        },
      });
      const recipients = [...(payload.to || []), ...(payload.cc || []), ...(payload.bcc || [])];
      await this.insertSendLogRows(tx, item, recipients, 'echec', errorCode);
      if (payload.emailLogId) {
        await tx.emailLog
          .update({
            where: { id: payload.emailLogId },
            data: {
              status: 'FAILED',
              errorMessage: `${errorCode}: ${errorMessage}`.slice(0, 500),
              updatedAt: new Date(),
            },
          })
          .catch(() => {});
      }
    });
  }

  // ─── Aides ────────────────────────────────────────────────────────────────

  private parsePayload(raw: string): EmailQueuePayload {
    try {
      return JSON.parse(raw) as EmailQueuePayload;
    } catch {
      return { to: [], subject: '(payload illisible)' };
    }
  }

  /** Insère une ligne email_send_log par destinataire (statut donné). */
  private async insertSendLogRows(
    tx: any,
    item: QueueRow,
    recipients: string[],
    status: 'envoye' | 'echec',
    errorCode: string | null,
    provider: 'google_oauth' | 'smtp' = 'smtp',
  ): Promise<void> {
    if (recipients.length === 0) return;
    const payload = this.parsePayload(item.payload);
    const rows = recipients.map((recipient) => ({
      id: uuid(),
      tenantId: item.tenantId,
      module: item.module,
      category: item.category,
      recipient,
      subject: payload.subject.slice(0, 500),
      provider,
      status,
      errorCode,
      createdAt: new Date(),
    }));
    await tx.emailSendLog.createMany({ data: rows, skipDuplicates: true });
  }

  /** Date de libération de la fenêtre 24 h (entrée la plus ancienne + 24 h). */
  private async windowReleaseTime(tenantId: string): Promise<Date> {
    const rows = await this.prisma.$queryRaw<Array<{ oldest: Date | null }>>`
      SELECT MIN("createdAt") AS oldest FROM "email_send_log"
      WHERE "tenantId" = ${tenantId} AND "provider" <> 'resend'
        AND "status" IN ('pending', 'envoye')
        AND "createdAt" > NOW() - INTERVAL '24 hours'`;
    const oldest = rows[0]?.oldest ? new Date(rows[0].oldest) : null;
    return oldest
      ? new Date(oldest.getTime() + 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 60_000);
  }

  /**
   * Vérifie si le plafond 24 h glissantes permet `count` destinataires.
   * Public : réutilisé par le service central (décision anticipée « reporté »).
   */
  async hasCapRoom(
    tenantId: string,
    dailyCap: number,
    count: number,
  ): Promise<{ ok: boolean; retryAt?: Date; used?: number }> {
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint; oldest: Date | null }>>`
      SELECT COUNT(*)::bigint AS count, MIN("createdAt") AS oldest FROM "email_send_log"
      WHERE "tenantId" = ${tenantId} AND "provider" <> 'resend'
        AND "status" IN ('pending', 'envoye')
        AND "createdAt" > NOW() - INTERVAL '24 hours'`;
    const used = Number(rows[0]?.count ?? 0);
    if (used + count <= dailyCap) return { ok: true, used };
    const oldest = rows[0]?.oldest ? new Date(rows[0].oldest) : null;
    return {
      ok: false,
      used,
      retryAt: oldest
        ? new Date(oldest.getTime() + 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 5 * 60_000),
    };
  }
}

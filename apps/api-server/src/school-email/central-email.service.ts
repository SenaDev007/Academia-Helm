/**
 * ============================================================================
 * 📧 TÂCHE 181 — CENTRAL EMAIL SERVICE (le point d'entrée UNIQUE)
 * ============================================================================
 *
 * Cahier des charges section 3 : tout e-mail de l'application passe par une
 * seule fonction — EmailService.send(schoolId, module, category, to, subject,
 * html, text, replyTo?, attachments?) — implémentée ici.
 *
 * Règle de résolution du transporteur (PRÉCISION PROMOTEUR 2026-11-24) :
 *   1. Catégorie `system` → Resend plateforme Academia Helm (réinitialisation
 *      de mot de passe, invitations, vérification). Hors plafond, hors file.
 *   2. Autres catégories (écoles tenantes) → UNIQUEMENT le SMTP de l'école
 *      (Google OAuth2 en phase 2). AUCUN repli Resend.
 *      École non configurée → erreur explicite :
 *      « Configurez l'e-mail de votre école dans Paramètres, onglet E-mail. »
 *
 * Règles d'en-têtes (section 3) :
 *   - From : nom de l'école + adresse Gmail de l'école (bloqué côté serveur —
 *     Gmail impose l'adresse du compte authentifié).
 *   - Reply-To : adresse configurée dans l'onglet.
 *   - Pied de page automatique : nom de l'école + « Envoyé via Academia Helm ».
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { prismaCreateDefaults } from '../common/utils/prisma-helpers';
import { EmailService as PlatformEmailService } from '../communication/services/email.service';
import { SchoolEmailSettingsService } from './school-email-settings.service';
import { EmailQueueDispatcherService } from './email-queue-dispatcher.service';
import { normalizeRecipients } from './smtp-helpers';
import {
  CentralEmailSendInput,
  CentralEmailSendResult,
  EmailAttachment181,
  EmailCategory181,
  EmailModule181,
  EmailQueuePayload,
} from './dto/school-email.dto';

/** Erreur métier dédiée : école sans e-mail configuré (message du CDC). */
export class SchoolEmailNotConfiguredError extends Error {
  readonly errorCode = 'EMAIL_SCHOOL_NOT_CONFIGURED';
  constructor() {
    super("Configurez l'e-mail de votre école dans Paramètres, onglet E-mail.");
    this.name = 'SchoolEmailNotConfiguredError';
  }
}

@Injectable()
export class CentralEmailService {
  private readonly logger = new Logger(CentralEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SchoolEmailSettingsService,
    private readonly dispatcher: EmailQueueDispatcherService,
    private readonly platformEmail: PlatformEmailService,
  ) {}

  /**
   * ✅ LE point d'entrée unique exigé par le cahier des charges.
   *
   * @returns le statut de la demande :
   *   - 'envoye'  : parti immédiatement (system via Resend)
   *   - 'en_file' : accepté dans la file, envoi en cours/programmé
   *   - 'reporte' : plafond 24 h atteint — partira dès que la fenêtre le permet
   *   - 'echec'   : refusé (école non configurée, destinataires invalides…)
   */
  async send(input: CentralEmailSendInput): Promise<CentralEmailSendResult> {
    const { to, cc, bcc, total } = normalizeRecipients(input.to, input.cc, input.bcc);

    if (total === 0) {
      return {
        status: 'echec',
        recipientCount: 0,
        error: 'Aucun destinataire valide.',
        errorCode: 'NO_VALID_RECIPIENT',
      };
    }

    // ─── 1. E-mails système → Resend plateforme (hors plafond, hors file) ──
    if (input.category === 'system') {
      return this.sendViaPlatform(input, { to, cc, bcc, total });
    }

    // ─── 2. E-mails école → SMTP de l'école UNIQUEMENT ─────────────────────
    const settingsRow = await this.settings.findRaw(input.schoolId);
    if (!settingsRow || settingsRow.mode === 'aucun') {
      // PRÉCISION PROMOTEUR : aucun repli Resend pour les écoles tenantes.
      this.logger.warn(
        `Envoi refusé (tenant ${input.schoolId}, module ${input.module}) : e-mail de l'école non configuré.`,
      );
      return {
        status: 'echec',
        recipientCount: total,
        error: new SchoolEmailNotConfiguredError().message,
        errorCode: 'EMAIL_SCHOOL_NOT_CONFIGURED',
      };
    }
    if (settingsRow.status !== 'actif' && !input.allowUnhealthyConnection) {
      // Connexion en Erreur (5xx/auth) ou Expirée (clé changée / invalid_grant).
      const msg =
        settingsRow.status === 'erreur'
          ? "La connexion e-mail de votre école est en erreur — vérifiez l'onglet E-mail des Paramètres."
          : 'La connexion e-mail de votre école a expiré — reconnectez-la dans Paramètres, onglet E-mail.';
      this.logger.warn(
        `Envoi refusé (tenant ${input.schoolId}) : connexion e-mail en statut « ${settingsRow.status} ».`,
      );
      return {
        status: 'echec',
        recipientCount: total,
        error: msg,
        errorCode: `EMAIL_SCHOOL_${settingsRow.status.toUpperCase()}`,
      };
    }

    // ─── 3. Plafond 24 h glissantes (vérification anticipée) ───────────────
    // Le dispatcher re-vérifie au moment d'envoyer (découpage par destinataire
    // si nécessaire) : cette vérification ne sert qu'à marquer « reporté » dès
    // l'acceptation pour informer l'appelant immédiatement.
    const capOk = await this.dispatcher.hasCapRoom(input.schoolId, settingsRow.dailyCap, total);
    if (!capOk.ok) {
      // Statut Reporté — AUCUNE perte : la file renverra dès que possible.
      const queueItemId = await this.enqueue(input, { to, cc, bcc }, 'reporte', capOk.retryAt);
      this.logger.warn(
        `Plafond ${settingsRow.dailyCap}/24h atteint (tenant ${input.schoolId}) : message mis en file « reporté » (id ${queueItemId}).`,
      );
      return { status: 'reporte', recipientCount: total, queueItemId };
    }

    // ─── 4. File d'attente (jamais de boucle directe pour les écoles) ──────
    const queueItemId = await this.enqueue(input, { to, cc, bcc }, 'en_attente', new Date());
    // Les lignes email_send_log (pending, une par destinataire) sont créées
    // par le dispatcher au moment de l'envoi réel — voir dispatchDue().

    // Notification événementielle (zéro polling — pattern audit coût Neon).
    this.dispatcher.notifyChanged().catch(() => {});

    if (input.wait) {
      // Bouton « Envoyer un e-mail test » : attendre l'issue réelle.
      const finalStatus = await this.dispatcher.waitForItem(queueItemId, 45_000);
      if (finalStatus === 'envoye') {
        return { status: 'envoye', recipientCount: total, queueItemId };
      }
      if (finalStatus === 'echec') {
        // TÂCHE 185 — remonte la VRAIE cause (lastError de la file, déjà
        // assainie par safeGmailErrorMessage/safeSmtpErrorMessage) au lieu
        // du message générique qui masquait p.ex. « API Gmail désactivée ».
        const failed = await this.prisma.emailQueue
          .findUnique({ where: { id: queueItemId }, select: { lastError: true } })
          .catch(() => null);
        const isGoogle = settingsRow.mode === 'google_oauth';
        const fallback = isGoogle
          ? "Échec de l'envoi via Google — vérifiez la connexion de l'école."
          : "Échec de l'envoi SMTP — vérifiez la configuration.";
        return {
          status: 'echec',
          recipientCount: total,
          queueItemId,
          error: (failed?.lastError || fallback).slice(0, 500),
          errorCode: isGoogle ? 'GMAIL_SEND_FAILED' : 'SMTP_SEND_FAILED',
        };
      }
      return {
        status: (finalStatus ?? 'en_file') as CentralEmailSendResult['status'],
        recipientCount: total,
        queueItemId,
      };
    }

    return { status: 'en_file', recipientCount: total, queueItemId };
  }

  // ─── Voie Resend plateforme (catégorie system) ────────────────────────────

  private async sendViaPlatform(
    input: CentralEmailSendInput,
    rcpt: { to: string[]; cc: string[]; bcc: string[]; total: number },
  ): Promise<CentralEmailSendResult> {
    // Les e-mails système ne comptent pas dans le plafond (CDC section 4.5).
    const attachments = this.toNodemailerAttachments(input.attachments);
    try {
      const result = await this.platformEmail.sendEmail({
        to: rcpt.to,
        cc: rcpt.cc.length ? rcpt.cc : undefined,
        bcc: rcpt.bcc.length ? rcpt.bcc : undefined,
        subject: input.subject,
        html: input.html,
        text: input.text,
        replyTo: input.replyTo,
        attachments,
      });
      // Journal (une ligne par destinataire, provider=resend, hors plafond).
      const sendLogIds = await this.writeSendLogRows(
        input,
        rcpt,
        'resend',
        result.success ? 'envoye' : 'echec',
        result.success ? undefined : 'PLATFORM_SEND_FAILED',
      );
      if (!result.success) {
        return {
          status: 'echec',
          recipientCount: rcpt.total,
          sendLogIds,
          error: "Échec de l'envoi via le transporteur plateforme.",
          errorCode: 'PLATFORM_SEND_FAILED',
        };
      }
      return { status: 'envoye', recipientCount: rcpt.total, sendLogIds };
    } catch (err: any) {
      await this.writeSendLogRows(input, rcpt, 'resend', 'echec', 'PLATFORM_SEND_THREW').catch(
        () => {},
      );
      this.logger.error(`Envoi system (module ${input.module}) échoué : ${err?.message}`);
      return {
        status: 'echec',
        recipientCount: rcpt.total,
        error: err?.message || 'Erreur transporteur plateforme.',
        errorCode: 'PLATFORM_SEND_THREW',
      };
    }
  }

  /** Pièces jointes du format file (base64) vers le format EmailService. */
  private toNodemailerAttachments(
    attachments?: EmailAttachment181[],
  ):
    | Array<{ filename: string; content?: Buffer | string; path?: string; contentType?: string }>
    | undefined {
    if (!attachments || attachments.length === 0) return undefined;
    return attachments.map((a) => ({
      filename: a.filename,
      content:
        a.content !== undefined
          ? a.contentBase64
            ? Buffer.from(a.content, 'base64')
            : a.content
          : undefined,
      path: a.path,
      contentType: a.contentType,
    }));
  }

  // ─── File d'attente ───────────────────────────────────────────────────────

  private async enqueue(
    input: CentralEmailSendInput,
    rcpt: { to: string[]; cc: string[]; bcc: string[] },
    status: 'en_attente' | 'reporte',
    nextAttemptAt: Date,
  ): Promise<string> {
    const payload: EmailQueuePayload = {
      to: rcpt.to,
      cc: rcpt.cc.length ? rcpt.cc : undefined,
      bcc: rcpt.bcc.length ? rcpt.bcc : undefined,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
      attachments: input.attachments,
      triggeredByUserId: input.triggeredByUserId,
    };
    const row = await this.prisma.emailQueue.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId: input.schoolId,
        module: input.module,
        category: input.category,
        payload: JSON.stringify(payload),
        status,
        nextAttemptAt,
      },
      select: { id: true },
    });
    return row.id;
  }

  /** Écrit les lignes du journal (une par destinataire). */
  async writeSendLogRows(
    input: { schoolId: string; module: string; category: string; subject: string },
    rcpt: { to: string[]; cc: string[]; bcc: string[] },
    provider: 'google_oauth' | 'smtp' | 'resend',
    status: 'pending' | 'envoye' | 'reporte' | 'echec',
    errorCode?: string,
    queueItemId?: string,
  ): Promise<string[]> {
    const recipients = [...rcpt.to, ...rcpt.cc, ...rcpt.bcc];
    const rows = recipients.map((recipient) => ({
      ...prismaCreateDefaults(),
      tenantId: input.schoolId,
      module: input.module,
      category: input.category,
      recipient,
      subject: input.subject.slice(0, 500),
      provider,
      status,
      errorCode: errorCode ?? null,
    }));
    try {
      const created = await this.prisma.emailSendLog.createMany({
        data: rows,
        skipDuplicates: true,
      });
      // createMany ne retourne pas les ids — les ids exacts ne sont utiles
      // qu'au dispatcher, qui écrit par updateMany (par queueItemId).
      void created;
      void queueItemId;
      return [];
    } catch (err: any) {
      this.logger.error(`Écriture email_send_log échouée : ${err?.message}`);
      return [];
    }
  }

  // ─── Pont avec le module Communication (sendCategorized) ──────────────────

  /**
   * Transport pour le EmailService.sendCategorized existant : garde l'EmailLog
   * + le tracking du module Communication, mais route l'envoi physique via le
   * service central. Système → Resend ; école → SMTP (erreur si non configuré).
   *
   * @returns 'sent' | 'queued' | 'deferred' | 'failed' pour que l'appelant
   * marque l'EmailLog (SENT / PENDING / FAILED) en conséquence.
   */
  async deliverForCommunicationModule(params: {
    tenantId: string;
    module?: string;
    category: string; // EmailCategory du module Communication (RECRUTEMENT, PEDAGOGIE, FINANCE, ADMINISTRATIF, COMMUNICATION, SYSTEM)
    to: string;
    cc?: string[];
    bcc?: string[];
    subject: string;
    html: string;
    text?: string;
    replyTo?: string; // reply-to calculé par EmailLogService (token ou override)
    attachments?: Array<{
      filename: string;
      content?: Buffer | string;
      path?: string;
      contentType?: string;
    }>;
    emailLogId?: string;
    triggeredByUserId?: string;
  }): Promise<'sent' | 'queued' | 'deferred' | 'failed'> {
    const isSystem = params.category === 'SYSTEM';

    if (isSystem) {
      try {
        const result = await this.platformEmail.sendEmail({
          to: params.to,
          cc: params.cc?.length ? params.cc : undefined,
          bcc: params.bcc?.length ? params.bcc : undefined,
          subject: params.subject,
          html: params.html,
          text: params.text,
          replyTo: params.replyTo,
          attachments: params.attachments,
        });
        return result.success ? 'sent' : 'failed';
      } catch {
        return 'failed';
      }
    }

    // École tenante → SMTP uniquement.
    const module181 = this.mapCommunicationModule(params.module, params.category);
    const attachments: EmailAttachment181[] | undefined = params.attachments?.map((a) => ({
      filename: a.filename,
      content: Buffer.isBuffer(a.content) ? a.content.toString('base64') : a.content,
      contentBase64: Buffer.isBuffer(a.content),
      path: a.path,
      contentType: a.contentType,
    }));

    const result = await this.send({
      schoolId: params.tenantId,
      module: module181,
      category: this.mapCommunicationCategory(params.category),
      to: params.to,
      cc: params.cc,
      bcc: params.bcc,
      subject: params.subject,
      html: params.html,
      text: params.text,
      // ⚠️ Reply-to (retour promoteur 2026-11-26) : la valeur du module
      // Communication (token inbound ou override RH) est conservée dans le
      // payload, mais le DISPATCHER fait désormais primer l'adresse RÉELLE de
      // l'école (onglet E-mail) sur l'adresse jeton — les réponses des
      // destinataires arrivent dans la boîte de l'école. Les overrides
      // explicites (ex. recruteur RH) restent priorititaires.
      replyTo: params.replyTo,
      attachments,
      triggeredByUserId: params.triggeredByUserId,
    });

    // Relie l'EmailLog pour que le dispatcher le marque à l'envoi réel.
    if (result.queueItemId && params.emailLogId) {
      await this.prisma.emailQueue
        .update({
          where: { id: result.queueItemId },
          data: {
            payload: await this.mergePayloadWithEmailLogId(result.queueItemId, params.emailLogId),
          },
        })
        .catch(() => {});
    }

    switch (result.status) {
      case 'envoye':
        return 'sent';
      case 'en_file':
        return 'queued';
      case 'reporte':
        return 'deferred';
      default:
        return 'failed';
    }
  }

  /** Fusionne emailLogId dans le payload JSON de l'élément de file. */
  private async mergePayloadWithEmailLogId(
    queueItemId: string,
    emailLogId: string,
  ): Promise<string> {
    const item = await this.prisma.emailQueue.findUnique({
      where: { id: queueItemId },
      select: { payload: true },
    });
    if (!item) return JSON.stringify({ emailLogId });
    try {
      const payload = JSON.parse(item.payload) as EmailQueuePayload;
      return JSON.stringify({ ...payload, emailLogId });
    } catch {
      return JSON.stringify({ emailLogId });
    }
  }

  /** Mappe les modules du module Communication vers les modules CDC. */
  private mapCommunicationModule(module: string | undefined, category: string): EmailModule181 {
    const m = (module || '').toLowerCase();
    if (m === 'hr') return 'rh';
    if (m === 'finance') return 'finance';
    if (m === 'students') return 'eleves';
    if (m === 'communication') return 'communication';
    if (m === 'pedagogy' || m === 'pedagogie') return 'pedagogie';
    if (m === 'exams' || m === 'examens') return 'examens';
    // Repli par la catégorie Communication (RECRUTEMENT→rh, PEDAGOGIE→pedagogie…)
    const c = category.toUpperCase();
    if (c === 'RECRUTEMENT') return 'rh';
    if (c === 'PEDAGOGIE') return 'pedagogie';
    if (c === 'FINANCE') return 'finance';
    if (c === 'ADMINISTRATIF') return 'eleves';
    return 'communication';
  }

  /** Mappe les catégories Communication (RECRUTEMENT…) vers les catégories CDC. */
  private mapCommunicationCategory(category: string): EmailCategory181 {
    const c = category.toUpperCase();
    if (c === 'SYSTEM') return 'system';
    if (c === 'RECRUTEMENT') return 'rh';
    if (c === 'PEDAGOGIE') return 'pedagogie';
    if (c === 'FINANCE') return 'finance';
    if (c === 'ADMINISTRATIF') return 'eleves';
    return 'communication';
  }
}

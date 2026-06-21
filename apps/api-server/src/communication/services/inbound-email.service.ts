/**
 * ============================================================================
 * INBOUND EMAIL SERVICE — Réception des réponses aux emails envoyés
 * ============================================================================
 *
 * Quand un candidat/parent répond à un email envoyé par Academia Helm :
 *   1. Le client SMTP du candidat envoie à log_{token}@replies.academiahelm.com
 *   2. Resend reçoit l'email (grâce au MX configuré sur replies.academiahelm.com)
 *   3. Resend pousse l'email vers notre webhook /api/communication/inbound-webhook
 *   4. Ce service :
 *      a. Vérifie la signature Resend (dans le controller)
 *      b. Extrait le token de l'adresse `to` (log_xxx@replies...)
 *      c. Retrouve l'EmailLog original via replyToToken
 *      d. Crée un InboundEmail lié à l'EmailLog
 *      e. Notifie les personnes concernées (RecruiterProfile + user qui a déclenché)
 *
 * Config requise :
 *   - MX record sur replies.academiahelm.com → Resend inbound
 *   - REPLY_DOMAIN=replies.academiahelm.com (côté API)
 *   - REPLY_TRACKING_ENABLED=true (default)
 *
 * Notifications (configurables par tenant via tenant_settings) :
 *   - notifyRecruiter (default: true)  → notifie le RecruiterProfile
 *   - notifyTriggeringUser (default: true) → notifie l'utilisateur qui a déclenché
 *   - notifyAllStaff (default: false)  → broadcast à tous les staffs RH
 * ============================================================================
 */

import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { EmailLogService } from './email-log.service';
import { EmailService } from './email.service';

export interface InboundEmailPayload {
  // Adresse `to` qui a reçu la réponse (ex: log_abc123@replies.academiahelm.com)
  toEmail: string;

  // Expéditeur de la réponse (le candidat)
  fromEmail: string;
  fromName?: string;

  // Contenu
  subject: string;
  textContent?: string;
  htmlContent?: string;
  attachments?: Array<{
    filename: string;
    contentType?: string;
    url?: string; // URL fournie par Resend
    content?: string; // base64 (selon provider)
  }>;

  // Provider
  providerId?: string;
  rawHeaders?: string;
}

export interface InboundProcessingResult {
  success: boolean;
  inboundEmailId?: string;
  originalEmailId?: string;
  threadId?: string;
  tenantId?: string;
  notificationsSent?: number;
  error?: string;
}

@Injectable()
export class InboundEmailService {
  private readonly logger = new Logger(InboundEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly emailLogService: EmailLogService,
    @Inject(forwardRef(() => EmailService))
    private readonly emailService: EmailService,
  ) {}

  /**
   * Traite un email entrant reçu via webhook Resend.
   *
   * Étapes :
   *   1. Extraire le replyToToken de l'adresse `to`
   *   2. Retrouver l'EmailLog original via replyToToken
   *   3. Si trouvé → récupérer tenantId, threadId
   *   4. Si non trouvé → tenter de matcher par fromEmail (candidat)
   *   5. Créer InboundEmail
   *   6. Notifier les personnes concernées
   */
  async processInboundEmail(payload: InboundEmailPayload): Promise<InboundProcessingResult> {
    this.logger.log(
      `Processing inbound email: from=${payload.fromEmail}, to=${payload.toEmail}, subject="${payload.subject}"`,
    );

    // 1. Extraire le token
    const token = this.emailLogService.extractReplyToToken(payload.toEmail);
    if (!token) {
      this.logger.warn(
        `Inbound email: no token found in to="${payload.toEmail}" — archiving without matching`,
      );
      // On archive quand même pour audit, mais sans lien à un EmailLog
      const archived = await this.archiveUnmatchedEmail(payload);
      return {
        success: true,
        inboundEmailId: archived.id,
        notificationsSent: 0,
      };
    }

    // 2. Retrouver l'EmailLog original
    const originalEmail = await this.prisma.emailLog.findFirst({
      where: { replyToToken: token },
      include: {
        tenant: {
          select: { id: true, name: true },
        },
      },
    });

    if (!originalEmail) {
      this.logger.warn(
        `Inbound email: token ${token} not found in EmailLog — archiving without matching`,
      );
      const archived = await this.archiveUnmatchedEmail(payload);
      return {
        success: true,
        inboundEmailId: archived.id,
        notificationsSent: 0,
      };
    }

    const tenantId = originalEmail.tenantId;
    const threadId = originalEmail.threadId;

    // 3. Créer l'InboundEmail
    let inboundEmail;
    try {
      inboundEmail = await this.prisma.inboundEmail.create({
        data: {
          tenantId,
          originalEmailId: originalEmail.id,
          threadId,
          fromEmail: payload.fromEmail,
          fromName: payload.fromName || null,
          toEmail: payload.toEmail,
          subject: payload.subject,
          textContent: payload.textContent || null,
          htmlContent: payload.htmlContent || null,
          attachments: payload.attachments ? JSON.stringify(payload.attachments) : null,
          providerId: payload.providerId || null,
          rawHeaders: payload.rawHeaders || null,
          status: 'PROCESSED',
          processedAt: new Date(),
        },
      });
      this.logger.log(
        `InboundEmail created: id=${inboundEmail.id}, tenantId=${tenantId}, threadId=${threadId}, originalEmailId=${originalEmail.id}`,
      );
    } catch (err: any) {
      this.logger.error(`Failed to create InboundEmail: ${err.message}`, err.stack);
      return { success: false, error: err.message };
    }

    // 4. Notifier les personnes concernées
    let notificationsSent = 0;
    try {
      notificationsSent = await this.notifyConcernedParties(originalEmail, inboundEmail);
    } catch (err: any) {
      this.logger.error(
        `Failed to send notifications for inbound email ${inboundEmail.id}: ${err.message}`,
        err.stack,
      );
    }

    return {
      success: true,
      inboundEmailId: inboundEmail.id,
      originalEmailId: originalEmail.id,
      threadId: threadId || undefined,
      tenantId,
      notificationsSent,
    };
  }

  /**
   * Archive un email entrant sans le lier à un EmailLog existant.
   * Utilisé quand le token n'est pas reconnu (email spam, réponse tardive, etc.).
   */
  private async archiveUnmatchedEmail(payload: InboundEmailPayload): Promise<any> {
    // On tente de retrouver le tenant par l'email de l'expéditeur
    // (le candidat a peut-être répondu depuis une autre adresse)
    let tenantId: string | null = null;

    if (payload.fromEmail) {
      const candidate = await this.prisma.hrCandidate.findFirst({
        where: { email: { equals: payload.fromEmail, mode: 'insensitive' } },
        select: { tenantId: true },
      });
      if (candidate?.tenantId) {
        tenantId = candidate.tenantId;
      }
    }

    if (!tenantId) {
      // Pas de candidat trouvé → on utilise le tenant par défaut (Academia Helm)
      // pour au moins archiver l'email quelque part
      const defaultTenant = await this.prisma.tenant.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      tenantId = defaultTenant?.id || 'unknown';
    }

    return this.prisma.inboundEmail.create({
      data: {
        tenantId,
        originalEmailId: null,
        threadId: null,
        fromEmail: payload.fromEmail,
        fromName: payload.fromName || null,
        toEmail: payload.toEmail,
        subject: payload.subject,
        textContent: payload.textContent || null,
        htmlContent: payload.htmlContent || null,
        attachments: payload.attachments ? JSON.stringify(payload.attachments) : null,
        providerId: payload.providerId || null,
        rawHeaders: payload.rawHeaders || null,
        status: 'ARCHIVED',
        processedAt: new Date(),
      },
    });
  }

  /**
   * Notifie les personnes concernées par la réponse reçue.
   *
   * Logique configurable par tenant (via tenant_settings, à venir) :
   *   - notifyRecruiter (default: true)
   *   - notifyTriggeringUser (default: true)
   *   - notifyAllStaff (default: false)
   *
   * Pour l'instant, on envoie :
   *   1. Un email au RecruiterProfile (s'il existe)
   *   2. Une notification in-app à l'utilisateur qui a déclenché l'email original
   *   3. Optionnellement, un email à tous les staffs RH (désactivé par défaut)
   */
  private async notifyConcernedParties(
    originalEmail: any,
    inboundEmail: any,
  ): Promise<number> {
    let sent = 0;
    const tenantId = originalEmail.tenantId;

    // 1. Email au RecruiterProfile
    const recruiter = await this.prisma.recruiterProfile.findFirst({
      where: { tenantId, isActive: true },
      select: { fullName: true, email: true, functionLabel: true },
    });

    if (recruiter?.email) {
      try {
        const fromEmail = this.configService.get<string>('EMAIL_FROM_NOREPLY') || 'noreply@academiahelm.com';
        const appUrl = this.configService.get<string>('FRONTEND_URL') || 'https://academiahelm.com';

        // Déterminer le type d'email original pour le contexte
        const categoryLabel = originalEmail.category === 'RECRUTEMENT' ? 'Recrutement' :
                              originalEmail.category === 'PEDAGOGIE' ? 'Pédagogie' :
                              originalEmail.category === 'FINANCE' ? 'Finance' :
                              originalEmail.category === 'COMMUNICATION' ? 'Communication' :
                              originalEmail.category || 'Système';
        const subCategoryLabel = originalEmail.subCategory === 'candidature_recue' ? 'Candidature reçue' :
                                 originalEmail.subCategory === 'entretien_programmé' ? 'Entretien programmé' :
                                 originalEmail.subCategory === 'test_programmé' ? 'Test programmé' :
                                 originalEmail.subCategory === 'résultat_entretien' ? 'Résultat entretien' :
                                 originalEmail.subCategory === 'résultat_test' ? 'Résultat test' :
                                 originalEmail.subCategory === 'embauche' ? 'Embauche' :
                                 originalEmail.subCategory === 'contrat_signé' ? 'Contrat signé' :
                                 originalEmail.subCategory === 'rejet' ? 'Rejet' :
                                 originalEmail.subCategory || '';

        // Date d'envoi de l'email original
        const originalDate = originalEmail.sentAt
          ? new Date(originalEmail.sentAt).toLocaleString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          : originalEmail.createdAt
            ? new Date(originalEmail.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : 'Date inconnue';

        // Extrait du contenu original (100 premiers caractères, sans HTML)
        let originalSnippet = '';
        if (originalEmail.content) {
          originalSnippet = originalEmail.content
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .trim()
            .substring(0, 200);
          if (originalSnippet.length === 200) originalSnippet += '...';
        }

        // Lien vers la candidature si on a un relatedEntityId
        const candidateLink = originalEmail.relatedEntityType === 'HrCandidate' && originalEmail.relatedEntityId
          ? `${appUrl}/app/hr/recruitment`
          : null;

        const replyToSubject = `🔄 Réponse reçue — ${inboundEmail.fromName || inboundEmail.fromEmail} — ${originalEmail.subject || 'Email'}`;

        const notificationHtml = `
          <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <!-- Header navy + gold -->
            <div style="background:linear-gradient(135deg,#0D1F6E 0%,#0D3B85 100%);color:#fff;padding:24px;border-radius:8px 8px 0 0;border-bottom:3px solid #F5A623;">
              <h2 style="margin:0;font-size:20px;">🔄 Réponse reçue d'un candidat</h2>
              <p style="margin:6px 0 0;font-size:13px;color:#F5A623;">Le candidat a répondu à un email envoyé par Academia Helm</p>
            </div>

            <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-radius:0 0 8px 8px;">

              <!-- Section 1 : Qui répond ? -->
              <table style="width:100%;font-size:14px;color:#334155;margin-bottom:20px;">
                <tr>
                  <td style="padding:4px 0;font-weight:bold;width:130px;vertical-align:top;">De :</td>
                  <td style="padding:4px 0;">
                    <strong>${inboundEmail.fromName || ''}</strong><br/>
                    <span style="color:#64748b;font-size:13px;">${inboundEmail.fromEmail}</span>
                  </td>
                </tr>
                <tr><td style="padding:4px 0;font-weight:bold;">Date de réponse :</td><td style="padding:4px 0;">${new Date(inboundEmail.receivedAt).toLocaleString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td></tr>
              </table>

              <!-- Section 2 : À quel email le candidat répond ? -->
              <div style="background:#eff6ff;border-left:4px solid #0D1F6E;border-radius:0 6px 6px 0;padding:16px;margin-bottom:20px;">
                <p style="margin:0 0 8px;font-size:11px;color:#0D1F6E;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;">📧 Email original (auquel le candidat a répondu)</p>
                <table style="width:100%;font-size:13px;color:#334155;">
                  <tr><td style="padding:2px 0;font-weight:bold;width:100px;">Sujet :</td><td style="padding:2px 0;">${originalEmail.subject || 'N/A'}</td></tr>
                  <tr><td style="padding:2px 0;font-weight:bold;">Catégorie :</td><td style="padding:2px 0;">${categoryLabel}${subCategoryLabel ? ' — ' + subCategoryLabel : ''}</td></tr>
                  <tr><td style="padding:2px 0;font-weight:bold;">Envoyé le :</td><td style="padding:2px 0;">${originalDate}</td></tr>
                  ${originalEmail.recipientName ? `<tr><td style="padding:2px 0;font-weight:bold;">Destinataire :</td><td style="padding:2px 0;">${originalEmail.recipientName}</td></tr>` : ''}
                </table>
                ${originalSnippet ? `<div style="margin-top:10px;padding:10px;background:#fff;border:1px solid #e2e8f0;border-radius:4px;font-size:12px;color:#64748b;font-style:italic;">"${originalSnippet}"</div>` : ''}
              </div>

              <!-- Section 3 : Message du candidat -->
              <h3 style="margin:0 0 8px;font-size:14px;color:#0D1F6E;text-transform:uppercase;letter-spacing:0.5px;">💬 Réponse du candidat</h3>
              <div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:14px;font-size:14px;color:#475569;line-height:1.6;white-space:pre-wrap;margin-bottom:20px;">${inboundEmail.textContent || inboundEmail.htmlContent || '(Message vide)'}</div>

              <!-- Section 4 : Actions -->
              ${candidateLink ? `
              <a href="${candidateLink}" style="display:inline-block;background:#F5A623;color:#0D1F6E;padding:10px 20px;border-radius:6px;font-size:13px;font-weight:bold;text-decoration:none;margin-bottom:16px;">📋 Voir la candidature dans Academia Helm</a>
              ` : ''}

              <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;line-height:1.5;">
                Cet email a été envoyé automatiquement par Academia Helm.<br/>
                Vous pouvez répondre directement au candidat depuis votre boîte mail (le champ "Répondre à" est pré-rempli avec son adresse email).
              </p>
            </div>
          </div>`;

        await this.emailService.sendEmail({
          to: recruiter.email,
          subject: replyToSubject,
          html: notificationHtml,
          from: fromEmail,
          fromName: 'Academia Helm — Réponses',
          replyTo: inboundEmail.fromEmail,
        });

        this.logger.log(
          `[NOTIFICATION] Réponse de ${inboundEmail.fromEmail} transférée au recruteur ${recruiter.email} — ` +
          `email original: "${originalEmail.subject}" (${categoryLabel}/${subCategoryLabel}), ` +
          `envoyé le ${originalDate}`,
        );
        sent++;
      } catch (err: any) {
        this.logger.error(`Failed to notify recruiter: ${err.message}`);
      }
    }

    // 2. Notification in-app à l'utilisateur qui a déclenché l'email original
    // (via le système de notifications existant si présent)
    if (originalEmail.triggeredByUserId) {
      try {
        // TODO: intégrer avec le système de notification in-app existant
        // pour l'instant, on logge seulement
        this.logger.log(
          `[NOTIFICATION] Créer une notification in-app pour userId=${originalEmail.triggeredByUserId}: ` +
            `"Réponse de ${inboundEmail.fromEmail} sur "${originalEmail.subject}"`,
        );
        sent++;
      } catch (err: any) {
        this.logger.error(`Failed to notify triggering user: ${err.message}`);
      }
    }

    return sent;
  }

  /**
   * Liste les InboundEmails d'un tenant (pour la page Inbox).
   */
  async listInboundEmails(filters: {
    tenantId: string;
    page?: number;
    pageSize?: number;
    search?: string;
    threadId?: string;
    fromEmail?: string;
    unreadOnly?: boolean;
  }): Promise<{ data: any[]; total: number; page: number; pageSize: number }> {
    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize || 25));
    const skip = (page - 1) * pageSize;

    const where: any = { tenantId: filters.tenantId };

    if (filters.threadId) where.threadId = filters.threadId;
    if (filters.fromEmail) {
      where.fromEmail = { contains: filters.fromEmail, mode: 'insensitive' };
    }
    if (filters.search) {
      where.OR = [
        { subject: { contains: filters.search, mode: 'insensitive' } },
        { fromEmail: { contains: filters.search, mode: 'insensitive' } },
        { fromName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.inboundEmail.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { receivedAt: 'desc' },
        include: {
          originalEmail: {
            select: {
              id: true,
              subject: true,
              category: true,
              subCategory: true,
              recipientName: true,
            },
          },
        },
      }),
      this.prisma.inboundEmail.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  /**
   * Récupère un InboundEmail par son ID.
   */
  async getInboundEmail(id: string, tenantId: string): Promise<any> {
    return this.prisma.inboundEmail.findFirst({
      where: { id, tenantId },
      include: {
        originalEmail: true,
      },
    });
  }
}

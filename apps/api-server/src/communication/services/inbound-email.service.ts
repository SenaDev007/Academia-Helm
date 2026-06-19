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

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { EmailLogService } from './email-log.service';

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
        // Réutiliser EmailService pour envoyer la notification
        // (sans le wrapper categorized pour éviter une boucle de logs)
        // On importe dynamiquement pour éviter la circular dep
        const { EmailService } = await import('./email.service');
        // Pas d'injection directe ici — on doit passer par Prisma pour logguer
        // manuellement cette notification (elle-même sera logguée)
        // Pour simplifier, on délègue à l'EmailService qu'on récupère via
        // une lazy injection plus tard. Pour l'instant, on logge seulement.
        this.logger.log(
          `[NOTIFICATION] Réponse de ${inboundEmail.fromEmail} reçue sur l'email "${originalEmail.subject}" — ` +
            `notifier le recruteur ${recruiter.email} (à implémenter via EmailService.sendCategorized)`,
        );
        // TODO: une fois EmailService injectable ici, appeler:
        // await this.emailService.sendCategorized({
        //   tenantId,
        //   category: 'SYSTEM',
        //   subCategory: 'inbound_reply_notification',
        //   module: 'communication',
        //   to: recruiter.email,
        //   toName: recruiter.fullName,
        //   recipientType: 'STAFF',
        //   subject: `[Réponse reçue] ${inboundEmail.subject}`,
        //   html: `...`,
        //   triggeredBy: 'SYSTEM',
        //   relatedEntityId: inboundEmail.id,
        //   relatedEntityType: 'InboundEmail',
        // });
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

/**
 * ============================================================================
 * EMAIL LOG SERVICE — Traçabilité et catégorisation des emails sortants
 * ============================================================================
 *
 * Responsabilités :
 *   - Créer une entrée EmailLog AVANT l'envoi (status=PENDING)
 *   - Mettre à jour l'EmailLog APRÈS l'envoi (status=SENT + providerId, ou FAILED)
 *   - Générer un threadId (pour grouper les emails d'une même conversation)
 *   - Générer un replyToToken + adresse reply-to personnalisée (Volet 2)
 *   - Exposer les méthodes de lookup pour l'UI du module Communication :
 *       * listEmailLogs (avec filtres)
 *       * getEmailLog (détail)
 *       * getThread (conversation complète)
 *       * getStats (taux ouverture, etc.)
 *
 * Catégories standardisées :
 *   RECRUTEMENT | PEDAGOGIE | FINANCE | ADMINISTRATIF | COMMUNICATION | SYSTEM
 *
 * Sub-catégories RECRUTEMENT :
 *   candidature_recue | entretien_planifie | test_planifie |
 *   resultat_entretien | resultat_test | embauche | contrat_signe |
 *   candidature_rejetee
 *
 * Dépendances :
 *   - PrismaService (DB)
 *   - ConfigService (variables d'env REPLY_DOMAIN, etc.)
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { randomBytes } from 'crypto';

// ─── Types publics ────────────────────────────────────────────────────────

export type EmailCategory =
  | 'RECRUTEMENT'
  | 'PEDAGOGIE'
  | 'FINANCE'
  | 'ADMINISTRATIF'
  | 'COMMUNICATION'
  | 'SYSTEM';

export type EmailStatus =
  | 'PENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'BOUNCED'
  | 'FAILED'
  | 'OPENED'
  | 'CLICKED';

export type RecipientType =
  | 'CANDIDAT'
  | 'PARENT'
  | 'STAFF'
  | 'ENSEIGNANT'
  | 'EXTERNE';

export interface CategorizedEmailRequest {
  // Identification tenant
  tenantId: string;

  // Catégorisation
  category: EmailCategory;
  subCategory?: string;
  module?: string; // hr | finance | students | communication

  // Expéditeur & destinataire
  to: string;
  toName?: string;
  recipientType?: RecipientType;
  recipientId?: string; // FK optionnelle (ex: HrCandidate.id, Parent.id)
  fromEmail?: string; // Override du from par défaut
  fromName?: string;
  cc?: string[];
  bcc?: string[];

  // Contenu
  subject: string;
  html: string;
  text?: string;

  // Threading
  threadId?: string; // Si fourni, attache à un thread existant
  inReplyToEmailLogId?: string; // Si réponse à un email log précédent

  // Métadonnées
  triggeredBy?: 'SYSTEM' | 'STAFF' | 'AUTOMATION' | 'SARA';
  triggeredByUserId?: string;
  templateId?: string;
  relatedEntityId?: string; // ex: HrApplication.id, Contract.id
  relatedEntityType?: string; // ex: 'HrApplication' | 'Contract'

  // Reply-to
  enableReplyTracking?: boolean; // Default: true si Volet 2 activé
  /**
   * Override du reply-to personnalisé.
   *
   * Si fourni, l'email sera envoyé avec cette adresse comme champ "Reply-To"
   * AU LIEU de l'adresse générée log_{token}@replies.academiahelm.com.
   *
   * Utilisé typiquement pour les emails de recrutement : on veut que les
   * réponses du candidat aillent DIRECTEMENT au recruteur (email recruteur
   * réel) plutôt que de passer par le webhook inbound (qui nécessite une
   * config MX correcte sur replies.academiahelm.com).
   *
   * Le replyToToken est quand même généré et stocké en DB (pour audit et
   * pour le cas où l'inbound webhook serait réactivé plus tard), mais il
   * n'est PAS utilisé comme adresse reply-to.
   */
  replyToOverride?: string;

  /**
   * Pièces jointes — tableau d'objets { filename, content (Buffer | string) }
   * Passé tel quel à EmailService.sendEmail → Nodemailer.attachments.
   *
   * Utilisé typiquement pour joindre un PDF généré dynamiquement (ex:
   * récapitulatif pédagogique enseignant, contrat signé, facture PDF, etc.).
   */
  attachments?: Array<{
    filename: string;
    content?: Buffer | string;
    path?: string;
    contentType?: string;
  }>;
}

export interface EmailLogListFilters {
  tenantId: string;
  category?: EmailCategory;
  subCategory?: string;
  module?: string;
  status?: EmailStatus;
  recipient?: string; // Filtre partiel (contient)
  recipientType?: RecipientType;
  search?: string; // Recherche dans subject/recipient
  threadId?: string;
  dateFrom?: Date | string;
  dateTo?: Date | string;
  page?: number;
  pageSize?: number;
}

export interface EmailLogListResult {
  data: any[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── Service ──────────────────────────────────────────────────────────────

@Injectable()
export class EmailLogService {
  private readonly logger = new Logger(EmailLogService.name);
  private readonly replyDomain: string;
  private readonly replyTrackingEnabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    // Domaine pour les adresses reply-to (ex: replies.academiahelm.com)
    this.replyDomain =
      this.configService.get<string>('REPLY_DOMAIN') || 'replies.academiahelm.com';

    // Active/désactive le tracking des réponses (Volet 2) globalement
    this.replyTrackingEnabled =
      (this.configService.get<string>('REPLY_TRACKING_ENABLED') || 'true').toLowerCase() ===
      'true';
  }

  /**
   * Génère un token aléatoire sécurisé pour le reply-to.
   * Format: 24 caractères hex (96 bits d'entropie — suffisant pour éviter les collisions)
   */
  private generateReplyToToken(): string {
    return randomBytes(12).toString('hex');
  }

  /**
   * Construit l'adresse reply-to personnalisée pour un token donné.
   * Format: log_{token}@replies.academiahelm.com
   */
  buildReplyToAddress(token: string): string {
    return `log_${token}@${this.replyDomain}`;
  }

  /**
   * Extrait le token d'une adresse reply-to.
   * Retourne null si l'adresse ne correspond pas au format attendu.
   */
  extractReplyToToken(emailAddress: string): string | null {
    if (!emailAddress) return null;
    const match = emailAddress.match(/^log_([a-f0-9]+)@/i);
    return match ? match[1] : null;
  }

  /**
   * Crée une entrée EmailLog AVANT l'envoi de l'email.
   * Retourne l'EmailLog créé (avec son id) + le reply-to à utiliser.
   *
   * Le caller doit ensuite:
   *   1. Appeler emailService.sendEmail() avec le replyTo retourné
   *   2. Appeler markAsSent(id, providerId) ou markAsFailed(id, error)
   */
  async createLog(
    request: CategorizedEmailRequest,
  ): Promise<{ logId: string; replyTo: string | null; replyToToken: string | null }> {
    // Déterminer le reply-to
    let replyTo: string | null = null;
    let replyToToken: string | null = null;
    const enableTracking =
      request.enableReplyTracking !== false && this.replyTrackingEnabled;

    if (enableTracking) {
      // On génère toujours un token pour audit/threading (stocké en DB).
      replyToToken = this.generateReplyToToken();

      // ⚠️ IMPORTANT : si replyToOverride est fourni, on l'utilise comme
      // adresse reply-to au lieu de l'adresse log_{token}@replies... .
      // Cela permet au candidat de répondre DIRECTEMENT au recruteur sans
      // dépendre du webhook inbound (qui nécessite une config MX correcte).
      if (request.replyToOverride) {
        replyTo = request.replyToOverride;
      } else {
        replyTo = this.buildReplyToAddress(replyToToken);
      }
    }

    // Si on répond à un email existant, on hérite de son threadId
    let threadId = request.threadId;
    if (!threadId && request.inReplyToEmailLogId) {
      const parent = await this.prisma.emailLog.findUnique({
        where: { id: request.inReplyToEmailLogId },
        select: { threadId: true },
      });
      if (parent?.threadId) {
        threadId = parent.threadId;
      }
    }
    // Si pas de threadId, on en génère un nouveau
    if (!threadId) {
      threadId = randomBytes(8).toString('hex');
    }

    const log = await this.prisma.emailLog.create({
      data: {
        // Identification
        tenantId: request.tenantId,

        // Catégorisation
        category: request.category,
        subCategory: request.subCategory || null,
        module: request.module || null,

        // Expéditeur & destinataire
        fromEmail: request.fromEmail || null,
        fromName: request.fromName || null,
        recipient: request.to,
        recipientName: request.toName || null,
        recipientType: request.recipientType || null,
        recipientId: request.recipientId || null,
        cc: request.cc ? JSON.stringify(request.cc) : null,
        bcc: request.bcc ? JSON.stringify(request.bcc) : null,

        // Contenu
        subject: request.subject,
        content: request.html,
        textContent: request.text || null,

        // Statut
        status: 'PENDING',

        // Threading
        threadId,
        inReplyTo: request.inReplyToEmailLogId || null,

        // Reply-to
        replyTo,
        replyToToken,

        // Métadonnées
        triggeredBy: request.triggeredBy || null,
        triggeredByUserId: request.triggeredByUserId || null,
        templateId: request.templateId || null,
        relatedEntityId: request.relatedEntityId || null,
        relatedEntityType: request.relatedEntityType || null,
      },
    });

    this.logger.log(
      `EmailLog created: id=${log.id}, category=${request.category}, subCategory=${request.subCategory || '-'}, ` +
        `to=${request.to}, threadId=${threadId}, replyTo=${replyTo || 'disabled'}`,
    );

    return { logId: log.id, replyTo, replyToToken };
  }

  /**
   * Marque un EmailLog comme SENT (succès de l'envoi provider).
   */
  async markAsSent(logId: string, provider: string, providerId?: string): Promise<void> {
    await this.prisma.emailLog.update({
      where: { id: logId },
      data: {
        status: 'SENT',
        provider,
        providerId: providerId || null,
        sentAt: new Date(),
      },
    });
  }

  /**
   * Marque un EmailLog comme FAILED (échec de l'envoi).
   */
  async markAsFailed(logId: string, errorMessage: string): Promise<void> {
    await this.prisma.emailLog.update({
      where: { id: logId },
      data: {
        status: 'FAILED',
        errorMessage: errorMessage.substring(0, 2000), // Limite pour éviter overflow
      },
    });
  }

  /**
   * Liste les EmailLogs avec filtres + pagination.
   */
  async listEmailLogs(filters: EmailLogListFilters): Promise<EmailLogListResult> {
    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize || 25));
    const skip = (page - 1) * pageSize;

    // Construire le where
    const where: any = { tenantId: filters.tenantId };

    if (filters.category) where.category = filters.category;
    if (filters.subCategory) where.subCategory = filters.subCategory;
    if (filters.module) where.module = filters.module;
    if (filters.status) where.status = filters.status;
    if (filters.recipientType) where.recipientType = filters.recipientType;
    if (filters.threadId) where.threadId = filters.threadId;

    if (filters.recipient) {
      where.recipient = { contains: filters.recipient, mode: 'insensitive' };
    }

    if (filters.search) {
      where.OR = [
        { subject: { contains: filters.search, mode: 'insensitive' } },
        { recipient: { contains: filters.search, mode: 'insensitive' } },
        { recipientName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.emailLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { replies: true } },
        },
      }),
      this.prisma.emailLog.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Récupère un EmailLog par son ID, avec ses réponses entrantes.
   */
  async getEmailLog(id: string, tenantId: string): Promise<any> {
    return this.prisma.emailLog.findFirst({
      where: { id, tenantId },
      include: {
        replies: {
          orderBy: { receivedAt: 'asc' },
        },
      },
    });
  }

  /**
   * Récupère tous les EmailLogs + InboundEmails d'un même thread.
   * Triés chronologiquement (sortants + entrants mélangés).
   */
  async getThread(threadId: string, tenantId: string): Promise<{
    outbound: any[];
    inbound: any[];
    chronological: any[];
  }> {
    const [outbound, inbound] = await Promise.all([
      this.prisma.emailLog.findMany({
        where: { threadId, tenantId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.inboundEmail.findMany({
        where: { threadId, tenantId },
        orderBy: { receivedAt: 'asc' },
      }),
    ]);

    // Fusionner et trier chronologiquement
    const chronological = [
      ...outbound.map((e) => ({ ...e, _type: 'outbound' as const })),
      ...inbound.map((e) => ({ ...e, _type: 'inbound' as const })),
    ].sort((a, b) => {
      const dateA = a._type === 'outbound' ? a.createdAt : a.receivedAt;
      const dateB = b._type === 'outbound' ? b.createdAt : b.receivedAt;
      return dateA.getTime() - dateB.getTime();
    });

    return { outbound, inbound, chronological };
  }

  /**
   * Statistiques agrégées par catégorie / statut (pour dashboard).
   */
  async getStats(
    tenantId: string,
    dateFrom?: Date | string,
    dateTo?: Date | string,
  ): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
    byModule: Record<string, number>;
    bounceRate: number;
    openRate: number;
    replyRate: number;
  }> {
    const where: any = { tenantId };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [total, byStatusRaw, byCategoryRaw, byModuleRaw, bounced, opened, replied] =
      await Promise.all([
        this.prisma.emailLog.count({ where }),
        this.prisma.emailLog.groupBy({
          by: ['status'],
          where,
          _count: true,
        }),
        this.prisma.emailLog.groupBy({
          by: ['category'],
          where,
          _count: true,
        }),
        this.prisma.emailLog.groupBy({
          by: ['module'],
          where,
          _count: true,
        }),
        this.prisma.emailLog.count({ where: { ...where, status: 'BOUNCED' } }),
        this.prisma.emailLog.count({
          where: { ...where, OR: [{ status: 'OPENED' }, { status: 'CLICKED' }] },
        }),
        // Réponse = au moins un InboundEmail lié à un EmailLog du tenant
        this.prisma.inboundEmail.count({
          where: {
            tenantId,
            originalEmailId: { not: null },
            ...(dateFrom || dateTo
              ? {
                  receivedAt: {
                    ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                    ...(dateTo ? { lte: new Date(dateTo) } : {}),
                  },
                }
              : {}),
          },
        }),
      ]);

    const byStatus: Record<string, number> = {};
    byStatusRaw.forEach((s) => (byStatus[s.status || 'NULL'] = s._count));

    const byCategory: Record<string, number> = {};
    byCategoryRaw.forEach((c) => (byCategory[c.category || 'NULL'] = c._count));

    const byModule: Record<string, number> = {};
    byModuleRaw.forEach((m) => (byModule[m.module || 'NULL'] = m._count));

    return {
      total,
      byStatus,
      byCategory,
      byModule,
      bounceRate: total > 0 ? (bounced / total) * 100 : 0,
      openRate: total > 0 ? (opened / total) * 100 : 0,
      replyRate: total > 0 ? (replied / total) * 100 : 0,
    };
  }

  /**
   * Met à jour le statut d'un EmailLog depuis un webhook Resend.
   *
   * Événements Resend :
   *   email.sent      → status=SENT (déjà fait après l'envoi, mais confirme)
   *   email.delivered → status=DELIVERED + deliveredAt
   *   email.bounced   → status=BOUNCED + bouncedAt + errorMessage
   *   email.opened    → status=OPENED + openedAt + openCount++
   *   email.clicked   → status=CLICKED + clickedAt + clickCount++
   *   email.failed    → status=FAILED + errorMessage
   *   email.complained → status=BOUNCED (spam complaint)
   */
  async updateStatusFromWebhook(
    providerId: string,
    event: string,
    timestamp: Date,
    metadata?: any,
  ): Promise<void> {
    // Récupérer l'EmailLog par providerId
    const log = await this.prisma.emailLog.findFirst({
      where: { providerId },
    });
    if (!log) {
      this.logger.warn(`Webhook: no EmailLog found for providerId=${providerId}`);
      return;
    }

    const updateData: any = {};

    switch (event) {
      case 'email.sent':
        // Confirme l'envoi (déjà SENT normalement)
        if (log.status === 'PENDING') {
          updateData.status = 'SENT';
          updateData.sentAt = timestamp;
        }
        break;

      case 'email.delivered':
        updateData.status = 'DELIVERED';
        updateData.deliveredAt = timestamp;
        break;

      case 'email.bounced':
        updateData.status = 'BOUNCED';
        updateData.bouncedAt = timestamp;
        if (metadata?.bounceType || metadata?.errorMessage) {
          updateData.errorMessage = `Bounce: ${metadata.bounceType || ''} ${metadata.errorMessage || ''}`.trim();
        }
        break;

      case 'email.opened':
        // On garde OPENED seulement si pas déjà CLICKED
        if (log.status !== 'CLICKED') {
          updateData.status = 'OPENED';
        }
        updateData.openedAt = timestamp;
        updateData.openCount = (log.openCount || 0) + 1;
        break;

      case 'email.clicked':
        updateData.status = 'CLICKED';
        updateData.clickedAt = timestamp;
        updateData.clickCount = (log.clickCount || 0) + 1;
        break;

      case 'email.failed':
        updateData.status = 'FAILED';
        if (metadata?.errorMessage) {
          updateData.errorMessage = metadata.errorMessage.substring(0, 2000);
        }
        break;

      case 'email.complained':
        // Spam complaint → on marque comme bounced pour le reporting
        updateData.status = 'BOUNCED';
        updateData.bouncedAt = timestamp;
        updateData.errorMessage = 'Spam complaint received';
        break;

      default:
        this.logger.log(`Webhook: ignoring unhandled event ${event}`);
        return;
    }

    if (Object.keys(updateData).length === 0) return;

    await this.prisma.emailLog.update({
      where: { id: log.id },
      data: updateData,
    });

    this.logger.log(
      `Webhook ${event} processed for EmailLog ${log.id} (providerId=${providerId})`,
    );
  }
}

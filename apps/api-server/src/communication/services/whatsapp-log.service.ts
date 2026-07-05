/**
 * ============================================================================
 * WHATSAPP LOG SERVICE — Traçabilité des messages WhatsApp sortants
 * ============================================================================
 *
 * Miroir de EmailLogService pour les messages WhatsApp.
 *
 * Responsabilités :
 *   - Créer une entrée WhatsappLog AVANT l'envoi (status=PENDING)
 *   - Mettre à jour l'WhatsappLog APRÈS l'envoi (status=SENT + providerId, ou FAILED)
 *   - Lister les logs avec filtres (pagination)
 *   - Calculer des statistiques agrégées (taux livraison, etc.)
 *   - Mettre à jour le statut depuis les webhooks Gupshup (SENT/DELIVERED/READ/FAILED)
 *
 * Catégories standardisées (identiques à EmailLog) :
 *   RECRUTEMENT | PEDAGOGIE | FINANCE | ADMINISTRATIF | COMMUNICATION | SYSTEM
 *
 * Dépendances :
 *   - PrismaService (DB)
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

// ─── Types publics ────────────────────────────────────────────────────────

export type WhatsAppCategory =
  | 'RECRUTEMENT'
  | 'PEDAGOGIE'
  | 'FINANCE'
  | 'ADMINISTRATIF'
  | 'COMMUNICATION'
  | 'SYSTEM';

export type WhatsAppStatus =
  | 'PENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED';

export type WhatsAppRecipientType =
  | 'CANDIDAT'
  | 'PARENT'
  | 'STAFF'
  | 'ENSEIGNANT'
  | 'EXTERNE';

export interface CategorizedWhatsAppRequest {
  // Identification tenant
  tenantId: string;

  // Catégorisation
  category: WhatsAppCategory;
  subCategory?: string;
  module?: string; // hr | students | pedagogy | finance | communication

  // Destinataire
  to: string; // Format E.164 (+229XXXXXXXX)
  toName?: string;
  recipientType?: WhatsAppRecipientType;
  recipientId?: string; // FK optionnelle (ex: HrCandidate.id, Guardian.id, Staff.id)

  // Expéditeur (numéro WhatsApp Business source)
  fromPhone?: string;

  // Contenu
  message: string; // Rendu final ou résumé
  templateId?: string; // Gupshup elementName (ex: "admission_recue")
  templateLanguage?: string; // "fr"

  // Threading
  threadId?: string;

  // Métadonnées
  triggeredBy?: 'SYSTEM' | 'STAFF' | 'AUTOMATION' | 'SARA';
  triggeredByUserId?: string;
  relatedEntityId?: string; // ex: Admission.id, HrApplication.id
  relatedEntityType?: string; // ex: 'Admission' | 'HrApplication'

  // Document (PDF) à joindre
  document?: { content: Buffer; filename: string };
  documentCaption?: string;
}

export interface WhatsAppLogListFilters {
  tenantId: string;
  category?: WhatsAppCategory;
  module?: string;
  status?: WhatsAppStatus;
  recipient?: string;
  templateId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  pageSize?: number;
}

export interface WhatsAppLogListResult {
  data: any[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface WhatsAppLogStats {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  byModule: Record<string, number>;
  deliveryRate: number; // SENT+DELIVERED+READ / total
  readRate: number; // READ / total
  failureRate: number; // FAILED / total
}

// ─── Service ──────────────────────────────────────────────────────────────

@Injectable()
export class WhatsAppLogService {
  private readonly logger = new Logger(WhatsAppLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée une entrée WhatsappLog en statut PENDING avant l'envoi.
   *
   * @returns L'ID du log créé
   */
  async createLog(request: CategorizedWhatsAppRequest): Promise<{ logId: string }> {
    try {
      const log = await this.prisma.whatsappLog.create({
        data: {
          tenantId: request.tenantId,
          category: request.category,
          subCategory: request.subCategory,
          module: request.module,
          recipient: request.to,
          recipientName: request.toName,
          recipientType: request.recipientType,
          recipientId: request.recipientId,
          fromPhone: request.fromPhone,
          message: request.message,
          templateId: request.templateId,
          templateLanguage: request.templateLanguage || 'fr',
          status: 'PENDING',
          threadId: request.threadId,
          triggeredBy: request.triggeredBy,
          triggeredByUserId: request.triggeredByUserId,
          relatedEntityId: request.relatedEntityId,
          relatedEntityType: request.relatedEntityType,
        },
      });
      return { logId: log.id };
    } catch (err: any) {
      this.logger.error(
        `createLog failed for tenant ${request.tenantId}: ${err.message}`,
        err.stack,
      );
      throw err;
    }
  }

  /**
   * Marque un log comme SENT après envoi réussi.
   */
  async markAsSent(
    logId: string,
    provider: string,
    providerId?: string,
  ): Promise<void> {
    try {
      await this.prisma.whatsappLog.update({
        where: { id: logId },
        data: {
          status: 'SENT',
          provider,
          providerId,
          sentAt: new Date(),
        },
      });
    } catch (err: any) {
      this.logger.error(`markAsSent failed for log ${logId}: ${err.message}`);
      // Ne pas propager — l'envoi a réussi, c'est le log qui échoue
    }
  }

  /**
   * Marque un log comme FAILED après échec d'envoi.
   */
  async markAsFailed(logId: string, errorMessage: string): Promise<void> {
    try {
      await this.prisma.whatsappLog.update({
        where: { id: logId },
        data: {
          status: 'FAILED',
          errorMessage: errorMessage.substring(0, 2000), // Tronquer
        },
      });
    } catch (err: any) {
      this.logger.error(`markAsFailed failed for log ${logId}: ${err.message}`);
    }
  }

  /**
   * Met à jour le statut depuis un webhook provider (Gupshup, etc.).
   *
   * @param providerId - L'ID message retourné par le provider
   * @param event - Type d'événement (sent, delivered, read, failed)
   * @param errorMessage - Message d'erreur (en cas d'échec)
   */
  async updateStatusFromWebhook(
    providerId: string,
    event: 'sent' | 'delivered' | 'read' | 'failed',
    errorMessage?: string,
  ): Promise<void> {
    try {
      const log = await this.prisma.whatsappLog.findFirst({
        where: { providerId },
        select: { id: true },
      });
      if (!log) {
        this.logger.warn(
          `updateStatusFromWebhook: no log found for providerId=${providerId}`,
        );
        return;
      }

      const updates: any = {};
      switch (event) {
        case 'sent':
          updates.status = 'SENT';
          updates.sentAt = new Date();
          break;
        case 'delivered':
          updates.status = 'DELIVERED';
          updates.deliveredAt = new Date();
          break;
        case 'read':
          updates.status = 'READ';
          updates.readAt = new Date();
          break;
        case 'failed':
          updates.status = 'FAILED';
          updates.errorMessage = errorMessage?.substring(0, 2000);
          break;
      }

      await this.prisma.whatsappLog.update({
        where: { id: log.id },
        data: updates,
      });
    } catch (err: any) {
      this.logger.error(
        `updateStatusFromWebhook failed for providerId=${providerId}: ${err.message}`,
      );
    }
  }

  /**
   * Liste les logs WhatsApp avec filtres et pagination.
   */
  async listLogs(filters: WhatsAppLogListFilters): Promise<WhatsAppLogListResult> {
    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.min(100, Math.max(10, filters.pageSize || 20));
    const skip = (page - 1) * pageSize;

    const where: any = { tenantId: filters.tenantId };
    if (filters.category) where.category = filters.category;
    if (filters.module) where.module = filters.module;
    if (filters.status) where.status = filters.status;
    if (filters.templateId) where.templateId = filters.templateId;
    if (filters.recipient) where.recipient = filters.recipient;
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
      if (filters.dateTo) where.createdAt.lte = filters.dateTo;
    }

    const [data, total] = await Promise.all([
      this.prisma.whatsappLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.whatsappLog.count({ where }),
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
   * Récupère un log par son ID (avec vérification de tenant).
   */
  async getLog(id: string, tenantId: string): Promise<any | null> {
    return this.prisma.whatsappLog.findFirst({
      where: { id, tenantId },
    });
  }

  /**
   * Calcule des statistiques agrégées pour un tenant.
   */
  async getStats(
    tenantId: string,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<WhatsAppLogStats> {
    const where: any = { tenantId };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    const logs = await this.prisma.whatsappLog.findMany({
      where,
      select: {
        status: true,
        category: true,
        module: true,
      },
    });

    const total = logs.length;
    const byStatus: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byModule: Record<string, number> = {};

    let sentCount = 0;
    let readCount = 0;
    let failedCount = 0;

    for (const log of logs) {
      byStatus[log.status] = (byStatus[log.status] || 0) + 1;
      if (log.category) byCategory[log.category] = (byCategory[log.category] || 0) + 1;
      if (log.module) byModule[log.module] = (byModule[log.module] || 0) + 1;

      if (['SENT', 'DELIVERED', 'READ'].includes(log.status)) sentCount++;
      if (log.status === 'READ') readCount++;
      if (log.status === 'FAILED') failedCount++;
    }

    return {
      total,
      byStatus,
      byCategory,
      byModule,
      deliveryRate: total > 0 ? (sentCount / total) * 100 : 0,
      readRate: total > 0 ? (readCount / total) * 100 : 0,
      failureRate: total > 0 ? (failedCount / total) * 100 : 0,
    };
  }
}

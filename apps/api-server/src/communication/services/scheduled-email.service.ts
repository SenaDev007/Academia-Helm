/**
 * ============================================================================
 * SCHEDULED EMAIL SERVICE — Emails programmés à une date/heure précise
 * ============================================================================
 *
 * Permet au recruteur (ou tout staff) de programmer l'envoi d'un email à un
 * candidat/parent/staff à une date/heure précise.
 *
 * Exemples d'usage :
 *   - Rappel d'entretien J-1 à 8h du matin
 *   - Message de bienvenue à la date de prise de fonction
 *   - Relance candidature si pas de réponse après 3 jours
 *   - Convocation à une réunion pédagogique
 *
 * Le dispatcher (ScheduledEmailDispatcherService) tourne toutes les minutes
 * pour envoyer les emails PENDING dont scheduledAt <= now().
 *
 * Utilise raw SQL ($queryRawUnsafe / $executeRawUnsafe) car le Prisma client
 * n'est pas régénéré dans l'immédiat (même pattern que les modules CMS).
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface CreateScheduledEmailDto {
  toEmail: string;
  toName?: string;
  recipientType?: string; // CANDIDAT | PARENT | STAFF | ENSEIGNANT | EXTERNE
  recipientId?: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  category?: string; // RECRUTEMENT | PEDAGOGIE | FINANCE | COMMUNICATION | SYSTEM
  subCategory?: string;
  module?: string;
  replyToOverride?: string;
  scheduledAt: string; // ISO string
  timezone?: string;
  createdByUserId?: string;
  createdByName?: string;
}

export interface ScheduledEmail {
  id: string;
  tenantId: string;
  toEmail: string;
  toName: string | null;
  recipientType: string | null;
  recipientId: string | null;
  subject: string;
  htmlBody: string;
  textBody: string | null;
  category: string | null;
  subCategory: string | null;
  module: string | null;
  replyToOverride: string | null;
  scheduledAt: Date;
  timezone: string;
  status: string;
  sentAt: Date | null;
  emailLogId: string | null;
  errorMessage: string | null;
  createdByUserId: string | null;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ScheduledEmailService {
  private readonly logger = new Logger(ScheduledEmailService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée un email programmé.
   * Valide que scheduledAt est dans le futur (au moins 1 minute).
   */
  async create(tenantId: string, dto: CreateScheduledEmailDto): Promise<ScheduledEmail> {
    // Validation
    if (!dto.toEmail?.trim()) {
      throw new BadRequestException('Adresse email destinataire requise');
    }
    if (!dto.subject?.trim()) {
      throw new BadRequestException('Sujet requis');
    }
    if (!dto.htmlBody?.trim()) {
      throw new BadRequestException('Contenu HTML requis');
    }
    if (!dto.scheduledAt) {
      throw new BadRequestException('Date/heure d\'envoi requise');
    }

    const scheduledAt = new Date(dto.scheduledAt);
    if (isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Date/heure invalide');
    }

    const now = new Date();
    const minSchedule = new Date(now.getTime() + 60 * 1000); // +1 min
    if (scheduledAt < minSchedule) {
      throw new BadRequestException(
        'La date/heure d\'envoi doit être au moins 1 minute dans le futur',
      );
    }

    // Insert via raw SQL
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO scheduled_emails (
        tenant_id, to_email, to_name, recipient_type, recipient_id,
        subject, html_body, text_body, category, subcategory, module,
        reply_to_override, scheduled_at, timezone,
        created_by_user_id, created_by_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    `,
      tenantId,
      dto.toEmail.trim(),
      dto.toName?.trim() || null,
      dto.recipientType || null,
      dto.recipientId || null,
      dto.subject.trim(),
      dto.htmlBody,
      dto.textBody || null,
      dto.category || null,
      dto.subCategory || null,
      dto.module || null,
      dto.replyToOverride || null,
      scheduledAt,
      dto.timezone || 'Africa/Porto-Novo',
      dto.createdByUserId || null,
      dto.createdByName || null,
    );

    // Récupérer l'enregistrement créé
    const rows = await this.prisma.$queryRawUnsafe<ScheduledEmail[]>(`
      SELECT * FROM scheduled_emails
      WHERE tenant_id = $1 AND to_email = $2 AND subject = $3
      ORDER BY created_at DESC LIMIT 1
    `, tenantId, dto.toEmail.trim(), dto.subject.trim());

    this.logger.log(
      `ScheduledEmail créé: id=${rows[0]?.id}, to=${dto.toEmail}, subject="${dto.subject.substring(0, 60)}", scheduledAt=${scheduledAt.toISOString()}`,
    );

    return rows[0];
  }

  /**
   * Liste les emails programmés d'un tenant avec filtres optionnels.
   */
  async findAll(
    tenantId: string,
    filters?: {
      status?: string;
      recipientType?: string;
      fromScheduledAt?: Date;
      toScheduledAt?: Date;
      limit?: number;
    },
  ): Promise<ScheduledEmail[]> {
    const limit = Math.min(filters?.limit || 100, 500);
    const conditions = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIdx = 2;

    if (filters?.status) {
      conditions.push(`status = $${paramIdx++}`);
      params.push(filters.status);
    }
    if (filters?.recipientType) {
      conditions.push(`recipient_type = $${paramIdx++}`);
      params.push(filters.recipientType);
    }
    if (filters?.fromScheduledAt) {
      conditions.push(`scheduled_at >= $${paramIdx++}`);
      params.push(filters.fromScheduledAt);
    }
    if (filters?.toScheduledAt) {
      conditions.push(`scheduled_at <= $${paramIdx++}`);
      params.push(filters.toScheduledAt);
    }

    const where = conditions.join(' AND ');
    const sql = `
      SELECT * FROM scheduled_emails
      WHERE ${where}
      ORDER BY scheduled_at DESC
      LIMIT $${paramIdx}
    `;
    params.push(limit);

    return this.prisma.$queryRawUnsafe<ScheduledEmail[]>(sql, ...params);
  }

  /**
   * Récupère un email programmé par son ID.
   */
  async findOne(id: string, tenantId: string): Promise<ScheduledEmail> {
    const rows = await this.prisma.$queryRawUnsafe<ScheduledEmail[]>(`
      SELECT * FROM scheduled_emails WHERE id = $1 AND tenant_id = $2
    `, id, tenantId);

    if (!rows[0]) {
      throw new NotFoundException('Email programmé introuvable');
    }
    return rows[0];
  }

  /**
   * Récupère tous les emails PENDING dont scheduledAt <= now()
   * (utilisé par le dispatcher).
   */
  async findPendingDue(): Promise<ScheduledEmail[]> {
    return this.prisma.$queryRawUnsafe<ScheduledEmail[]>(`
      SELECT * FROM scheduled_emails
      WHERE status = 'PENDING' AND scheduled_at <= NOW()
      ORDER BY scheduled_at ASC
      LIMIT 50
    `);
  }

  /**
   * Marque un email comme envoyé.
   */
  async markAsSent(id: string, emailLogId?: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(`
      UPDATE scheduled_emails
      SET status = 'SENT', sent_at = NOW(), email_log_id = $2, error_message = NULL, updated_at = NOW()
      WHERE id = $1
    `, id, emailLogId || null);
  }

  /**
   * Marque un email comme échoué.
   */
  async markAsFailed(id: string, errorMessage: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(`
      UPDATE scheduled_emails
      SET status = 'FAILED', error_message = $2, updated_at = NOW()
      WHERE id = $1
    `, id, errorMessage.substring(0, 500));
  }

  /**
   * Annule un email programmé (seulement si PENDING).
   */
  async cancel(id: string, tenantId: string): Promise<ScheduledEmail> {
    const existing = await this.findOne(id, tenantId);
    if (existing.status !== 'PENDING') {
      throw new BadRequestException(
        `Impossible d'annuler un email avec le statut "${existing.status}"`,
      );
    }

    await this.prisma.$executeRawUnsafe(`
      UPDATE scheduled_emails SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1
    `, id);

    return this.findOne(id, tenantId);
  }

  /**
   * Supprime un email programmé.
   */
  async delete(id: string, tenantId: string): Promise<void> {
    await this.findOne(id, tenantId); // vérifie existence + tenant
    await this.prisma.$executeRawUnsafe(`
      DELETE FROM scheduled_emails WHERE id = $1 AND tenant_id = $2
    `, id, tenantId);
  }
}

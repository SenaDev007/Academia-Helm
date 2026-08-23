/**
 * ============================================================================
 * HELM CONNECT — Announcement Service (V1)
 * ============================================================================
 *
 * Système d'annonces officielles pour Academia Helm.
 * Permet à l'administration/direction de publier des annonces ciblées
 * avec accusé de lecture.
 *
 * Types de cibles :
 *   - ALL_SCHOOL   — Tous les utilisateurs du tenant
 *   - LEVEL        — Tous les utilisateurs d'un niveau (MATERNELLE|PRIMAIRE|SECONDAIRE)
 *   - CLASS        — Tous les utilisateurs d'une classe (élèves + enseignants + parents)
 *   - TEACHERS     — Tous les enseignants du tenant
 *   - PARENTS      — Tous les parents (guardians avec userId)
 *   - GROUP        — Membres d'une conversation de groupe
 *   - CHANNEL      — Abonnés d'un canal (broadcast Telegram-style)
 *
 * Rôles autorisés à publier :
 *   - DIRECTEUR_GENERAL, DIRECTEUR_ETABLISSEMENT, DIRECTEUR_*
 *   - SCHOOL_ADMIN, ADMIN, ADMINISTRATEUR
 *   - SUPER_ADMIN, PLATFORM_OWNER, PLATFORM_SUPER_ADMIN
 *   - PROMOTER, SCHOOL_OWNER
 *   - COMMUNICATION_MANAGER
 *
 * ⭐ Escalade : Si requiresConfirmation=true et un destinataire n'a pas lu dans
 *    un délai configurable (24h par défaut), une notification de rappel est envoyée.
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { randomUUID } from 'crypto';

export type AnnouncementPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type AnnouncementTargetType = 'ALL_SCHOOL' | 'LEVEL' | 'CLASS' | 'TEACHERS' | 'PARENTS' | 'GROUP' | 'CHANNEL';

export interface Announcement {
  id: string;
  tenantId: string;
  authorId: string;
  authorRole?: string;
  authorName?: string;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  targetType: AnnouncementTargetType;
  targetClassId?: string;
  targetLevel?: string;
  targetGroupId?: string;
  targetChannelId?: string;
  attachments?: Array<{ url: string; name: string; size?: number; mime?: string }>;
  requiresConfirmation: boolean;
  publishedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Computed fields
  readCount?: number;
  totalRecipients?: number;
  readByCurrentUser?: boolean;
  confirmedByCurrentUser?: boolean;
}

const PUBLISHER_ROLES = new Set([
  'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT', 'DIRECTEUR',
  'DIRECTEUR_MATERNELLE', 'DIRECTEUR_PRIMAIRE', 'DIRECTEUR_SECONDAIRE', 'DIRECTEUR_MAT_PRI',
  'SUPER_DIRECTOR', 'DEPUTY_DIRECTOR',
  'SCHOOL_ADMIN', 'ADMIN', 'ADMINISTRATEUR',
  'SUPER_ADMIN', 'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'PLATFORM_ADMIN',
  'PROMOTER', 'SCHOOL_OWNER', 'PROMOTEUR',
  'COMMUNICATION_MANAGER',
]);

@Injectable()
export class AnnouncementService {
  private readonly logger = new Logger(AnnouncementService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ═════════════════════════════════════════════════════════════════
  //  Helper — Vérifie que l'utilisateur peut publier des annonces
  // ═════════════════════════════════════════════════════════════════
  private canPublish(role: string | undefined | null): boolean {
    if (!role) return false;
    return PUBLISHER_ROLES.has(role.toUpperCase());
  }

  // ═════════════════════════════════════════════════════════════════
  //  CREATE — Publier une nouvelle annonce
  // ═════════════════════════════════════════════════════════════════
  async createAnnouncement(
    tenantId: string,
    authorId: string,
    data: {
      title: string;
      body: string;
      priority?: AnnouncementPriority;
      targetType: AnnouncementTargetType;
      targetClassId?: string;
      targetLevel?: string;
      targetGroupId?: string;
      targetChannelId?: string;
      attachments?: Array<{ url: string; name: string; size?: number; mime?: string }>;
      requiresConfirmation?: boolean;
      publishNow?: boolean;       // default true
      expiresAt?: Date;
    },
  ): Promise<Announcement> {
    if (!data.title || data.title.trim().length === 0) {
      throw new BadRequestException('Title is required');
    }
    if (!data.body || data.body.trim().length === 0) {
      throw new BadRequestException('Body is required');
    }
    if (!data.targetType) {
      throw new BadRequestException('targetType is required');
    }

    // Validate target specifics
    if (data.targetType === 'CLASS' && !data.targetClassId) {
      throw new BadRequestException('targetClassId is required for targetType=CLASS');
    }
    if (data.targetType === 'LEVEL' && !data.targetLevel) {
      throw new BadRequestException('targetLevel is required for targetType=LEVEL');
    }
    if (data.targetType === 'GROUP' && !data.targetGroupId) {
      throw new BadRequestException('targetGroupId is required for targetType=GROUP');
    }
    if (data.targetType === 'CHANNEL' && !data.targetChannelId) {
      throw new BadRequestException('targetChannelId is required for targetType=CHANNEL');
    }

    // Fetch author's role
    const authorRow: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT "role", "firstName", "lastName" FROM "users" WHERE id = $1
    `, authorId);
    if (authorRow.length === 0) {
      throw new NotFoundException('Author not found');
    }
    const authorRole = authorRow[0].role;
    const authorName = `${authorRow[0].firstName || ''} ${authorRow[0].lastName || ''}`.trim();
    if (!this.canPublish(authorRole)) {
      throw new ForbiddenException(`Role ${authorRole} is not allowed to publish announcements`);
    }

    const id = randomUUID();
    const publishNow = data.publishNow !== false; // default true
    const publishedAt = publishNow ? new Date() : null;

    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "chat_announcements"
        ("id", "tenantId", "authorId", "authorRole", "title", "body",
         "priority", "targetType", "targetClassId", "targetLevel",
         "targetGroupId", "targetChannelId", "attachments",
         "requiresConfirmation", "publishedAt", "expiresAt",
         "createdAt", "updatedAt")
      VALUES
        ($1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10,
         $11, $12, $13::jsonb,
         $14, $15, $16,
         NOW(), NOW())
    `, id, tenantId, authorId, authorRole, data.title, data.body,
       data.priority || 'NORMAL', data.targetType, data.targetClassId || null, data.targetLevel || null,
       data.targetGroupId || null, data.targetChannelId || null, JSON.stringify(data.attachments || []),
       data.requiresConfirmation || false, publishedAt, data.expiresAt || null);

    this.logger.log(`⭐ Announcement created: id=${id}, target=${data.targetType}, priority=${data.priority || 'NORMAL'}, author=${authorName} (${authorRole})`);

    // ⭐ If published immediately, send push notifications to recipients
    if (publishNow) {
      this.notifyRecipients(id, tenantId, data.targetType, data.priority || 'NORMAL').catch(err => {
        this.logger.error(`Failed to notify recipients for announcement ${id}: ${err.message}`);
      });
    }

    return this.getAnnouncement(tenantId, id, authorId);
  }

  // ═════════════════════════════════════════════════════════════════
  //  READ — Récupérer une annonce par ID
  // ═════════════════════════════════════════════════════════════════
  async getAnnouncement(tenantId: string, announcementId: string, userId: string): Promise<Announcement> {
    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT a.*, u."firstName" AS "authorFirstName", u."lastName" AS "authorLastName"
      FROM "chat_announcements" a
      LEFT JOIN "users" u ON u.id = a."authorId"
      WHERE a."id" = $1 AND a."tenantId" = $2 AND a."deletedAt" IS NULL
    `, announcementId, tenantId);

    if (rows.length === 0) {
      throw new NotFoundException('Announcement not found');
    }
    return this.enrichAnnouncement(rows[0], userId);
  }

  // ═════════════════════════════════════════════════════════════════
  //  LIST — Liste paginée des annonces
  //    - Pour les publishers : toutes les annonces (incluant DRAFT)
  //    - Pour les autres : seulement les PUBLISHED qui les ciblent
  // ═════════════════════════════════════════════════════════════════
  async listAnnouncements(
    tenantId: string,
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      onlyPublished?: boolean;
      targetType?: AnnouncementTargetType;
    } = {},
  ): Promise<{ items: Announcement[]; total: number }> {
    const limit = Math.min(options.limit || 50, 200);
    const offset = options.offset || 0;

    // Fetch user role
    const userRow: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT "role" FROM "users" WHERE id = $1
    `, userId);
    const userRole = (userRow[0]?.role || '').toUpperCase();
    const isPublisher = this.canPublish(userRole);

    // ⭐ Build the filter + matching params list dynamically.
    //    ⚠️ PostgreSQL's prepared statement will REJECT extra params
    //    ("bind message supplies N parameters, but prepared statement requires M")
    //    So we must build the params array to MATCH the placeholders exactly.
    //    Strategy: always reference $2 = userId when publisher (to show drafts),
    //    but skip $2 reference when not publisher → AND only pass 1 param.
    const isPublisherBranch = isPublisher && options.onlyPublished !== true;

    let publishedFilter: string;
    let targetFilter: string;
    let params: any[];

    if (isPublisherBranch && options.targetType) {
      publishedFilter = `AND (a."publishedAt" IS NOT NULL OR a."authorId" = $2)`;
      targetFilter = `AND a."targetType" = $3`;
      params = [tenantId, userId, options.targetType];
    } else if (isPublisherBranch && !options.targetType) {
      publishedFilter = `AND (a."publishedAt" IS NOT NULL OR a."authorId" = $2)`;
      targetFilter = '';
      params = [tenantId, userId];
    } else if (!isPublisherBranch && options.targetType) {
      publishedFilter = `AND a."publishedAt" IS NOT NULL AND (a."expiresAt" IS NULL OR a."expiresAt" > NOW())`;
      targetFilter = `AND a."targetType" = $2`;
      params = [tenantId, options.targetType];
    } else {
      publishedFilter = `AND a."publishedAt" IS NOT NULL AND (a."expiresAt" IS NULL OR a."expiresAt" > NOW())`;
      targetFilter = '';
      params = [tenantId];
    }

    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT a.*, u."firstName" AS "authorFirstName", u."lastName" AS "authorLastName"
      FROM "chat_announcements" a
      LEFT JOIN "users" u ON u.id = a."authorId"
      WHERE a."tenantId" = $1
        ${publishedFilter}
        ${targetFilter}
        AND a."deletedAt" IS NULL
      ORDER BY a."publishedAt" DESC NULLS LAST, a."createdAt" DESC
      LIMIT ${limit} OFFSET ${offset}
    `, ...params);

    const totalRows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT count(*)::int AS total
      FROM "chat_announcements" a
      WHERE a."tenantId" = $1
        ${publishedFilter}
        ${targetFilter}
        AND a."deletedAt" IS NULL
    `, ...params);

    const items = await Promise.all(rows.map(r => this.enrichAnnouncement(r, userId)));
    return { items, total: totalRows[0]?.total || 0 };
  }

  // ═════════════════════════════════════════════════════════════════
  //  READ RECEIPT — Marquer une annonce comme lue
  // ═════════════════════════════════════════════════════════════════
  async markAsRead(
    tenantId: string,
    userId: string,
    announcementId: string,
    confirmed: boolean = false,
  ): Promise<{ success: boolean }> {
    // Check announcement exists
    const ann: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT id, "requiresConfirmation" FROM "chat_announcements"
      WHERE "id" = $1 AND "tenantId" = $2 AND "publishedAt" IS NOT NULL
    `, announcementId, tenantId);
    if (ann.length === 0) {
      throw new NotFoundException('Announcement not found or not published');
    }

    // Upsert read receipt
    const readId = randomUUID();
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "chat_announcement_reads" ("id", "announcementId", "userId", "tenantId", "readAt", "confirmed")
      VALUES ($1, $2, $3, $4, NOW(), $5)
      ON CONFLICT ("announcementId", "userId")
      DO UPDATE SET "readAt" = NOW(), "confirmed" = EXCLUDED."confirmed"
    `, readId, announcementId, userId, tenantId, confirmed);

    return { success: true };
  }

  // ═════════════════════════════════════════════════════════════════
  //  STATS — Récupérer les statistiques de lecture (publishers only)
  // ═════════════════════════════════════════════════════════════════
  async getReadStats(tenantId: string, announcementId: string): Promise<{
    totalRecipients: number;
    readCount: number;
    confirmedCount: number;
    unreadCount: number;
    readers: Array<{ userId: string; firstName: string; lastName: string; readAt: Date; confirmed: boolean }>;
  }> {
    const ann: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "chat_announcements" WHERE "id" = $1 AND "tenantId" = $2
    `, announcementId, tenantId);
    if (ann.length === 0) {
      throw new NotFoundException('Announcement not found');
    }
    const a = ann[0];

    // Estimate recipient count (V1: rough estimate based on targetType)
    const totalRecipients = await this.estimateRecipients(tenantId, a.targetType, a.targetClassId, a.targetLevel, a.targetGroupId, a.targetChannelId);

    const readers: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT r."userId", r."readAt", r."confirmed", u."firstName", u."lastName"
      FROM "chat_announcement_reads" r
      LEFT JOIN "users" u ON u.id = r."userId"
      WHERE r."announcementId" = $1 AND r."tenantId" = $2
      ORDER BY r."readAt" DESC
    `, announcementId, tenantId);

    return {
      totalRecipients,
      readCount: readers.length,
      confirmedCount: readers.filter(r => r.confirmed).length,
      unreadCount: Math.max(0, totalRecipients - readers.length),
      readers: readers.map(r => ({
        userId: r.userId,
        firstName: r.firstName,
        lastName: r.lastName,
        readAt: r.readAt,
        confirmed: r.confirmed,
      })),
    };
  }

  // ═════════════════════════════════════════════════════════════════
  //  DELETE — Soft-delete an announcement
  // ═════════════════════════════════════════════════════════════════
  async deleteAnnouncement(tenantId: string, userId: string, announcementId: string): Promise<{ success: boolean }> {
    // Fetch announcement to check ownership
    const ann: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT "authorId" FROM "chat_announcements" WHERE "id" = $1 AND "tenantId" = $2
    `, announcementId, tenantId);
    if (ann.length === 0) {
      throw new NotFoundException('Announcement not found');
    }

    // Fetch user role
    const userRow: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT "role" FROM "users" WHERE id = $1
    `, userId);
    const userRole = (userRow[0]?.role || '').toUpperCase();
    const isPublisher = this.canPublish(userRole);

    // Only the author or another publisher can delete
    if (ann[0].authorId !== userId && !isPublisher) {
      throw new ForbiddenException('Only the author or another publisher can delete');
    }

    await this.prisma.$executeRawUnsafe(`
      UPDATE "chat_announcements" SET "deletedAt" = NOW(), "updatedAt" = NOW()
      WHERE "id" = $1 AND "tenantId" = $2
    `, announcementId, tenantId);

    return { success: true };
  }

  // ═════════════════════════════════════════════════════════════════
  //  HELPER — Enrichir une annonce avec les computed fields
  // ═════════════════════════════════════════════════════════════════
  private async enrichAnnouncement(row: any, userId: string): Promise<Announcement> {
    // Fetch current user's read receipt
    const readRows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT "readAt", "confirmed" FROM "chat_announcement_reads"
      WHERE "announcementId" = $1 AND "userId" = $2
    `, row.id, userId);

    // Compute total recipients (V1: rough estimate)
    const totalRecipients = await this.estimateRecipients(
      row.tenantId,
      row.targetType,
      row.targetClassId,
      row.targetLevel,
      row.targetGroupId,
      row.targetChannelId,
    );

    // Get total read count
    const countRows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT count(*)::int AS cnt,
             count(*) FILTER (WHERE "confirmed" = true)::int AS confirmed_cnt
      FROM "chat_announcement_reads"
      WHERE "announcementId" = $1 AND "tenantId" = $2
    `, row.id, row.tenantId);

    return {
      id: row.id,
      tenantId: row.tenantId,
      authorId: row.authorId,
      authorRole: row.authorRole,
      authorName: `${row.authorFirstName || ''} ${row.authorLastName || ''}`.trim() || row.authorRole,
      title: row.title,
      body: row.body,
      priority: row.priority,
      targetType: row.targetType,
      targetClassId: row.targetClassId,
      targetLevel: row.targetLevel,
      targetGroupId: row.targetGroupId,
      targetChannelId: row.targetChannelId,
      attachments: typeof row.attachments === 'string' ? JSON.parse(row.attachments) : row.attachments,
      requiresConfirmation: row.requiresConfirmation,
      publishedAt: row.publishedAt,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      readCount: countRows[0]?.cnt || 0,
      totalRecipients,
      readByCurrentUser: readRows.length > 0,
      confirmedByCurrentUser: readRows[0]?.confirmed || false,
    };
  }

  // ═════════════════════════════════════════════════════════════════
  //  HELPER — Estimer le nombre de destinataires d'une annonce
  // ═════════════════════════════════════════════════════════════════
  private async estimateRecipients(
    tenantId: string,
    targetType: string,
    targetClassId?: string | null,
    targetLevel?: string | null,
    targetGroupId?: string | null,
    targetChannelId?: string | null,
  ): Promise<number> {
    try {
      if (targetType === 'ALL_SCHOOL') {
        const r: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
          SELECT count(*)::int AS cnt FROM "users" WHERE "tenantId" = $1
        `, tenantId);
        return r[0]?.cnt || 0;
      }
      if (targetType === 'TEACHERS') {
        const r: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
          SELECT count(*)::int AS cnt FROM "users"
          WHERE "tenantId" = $1 AND UPPER("role") IN ('ENSEIGNANT','TEACHER','TEACHER_RESP','RESP_SECONDAIRE','RESP_PRIMAIRE','RESP_MATERNELLE','PEDAGOGIC_COORDINATOR','DIRECTEUR_PEDAGOGIQUE')
        `, tenantId);
        return r[0]?.cnt || 0;
      }
      if (targetType === 'PARENTS') {
        const r: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
          SELECT count(*)::int AS cnt FROM "guardians" g
          WHERE g."tenantId" = $1 AND g."userId" IS NOT NULL
        `, tenantId);
        return r[0]?.cnt || 0;
      }
      if (targetType === 'LEVEL' && targetLevel) {
        // Count users with students in this level (V1: rough estimate via students)
        const r: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
          SELECT count(DISTINCT g."userId")::int AS cnt
          FROM "students" s
          JOIN "student_guardians" sg ON sg."studentId" = s.id
          JOIN "guardians" g ON g.id = sg."guardianId"
          WHERE s."tenantId" = $1 AND s."schoolLevel" = $2 AND g."userId" IS NOT NULL
        `, tenantId, targetLevel);
        return r[0]?.cnt || 0;
      }
      if (targetType === 'CLASS' && targetClassId) {
        // Count teachers assigned to class + parents of students in class
        const teachersR: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
          SELECT count(DISTINCT t."userId")::int AS cnt
          FROM "teacher_class_assignments" tca
          JOIN "teachers" t ON t.id = tca."teacherId"
          WHERE tca."classId" = $1 AND t."userId" IS NOT NULL
        `, targetClassId);
        const parentsR: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
          SELECT count(DISTINCT g."userId")::int AS cnt
          FROM "students" s
          JOIN "student_guardians" sg ON sg."studentId" = s.id
          JOIN "guardians" g ON g.id = sg."guardianId"
          WHERE s."currentClassId" = $1 AND g."userId" IS NOT NULL
        `, targetClassId);
        return (teachersR[0]?.cnt || 0) + (parentsR[0]?.cnt || 0);
      }
      if (targetType === 'GROUP' && targetGroupId) {
        const r: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
          SELECT count(*)::int AS cnt FROM "chat_participants"
          WHERE "conversationId" = $1 AND "leftAt" IS NULL
        `, targetGroupId);
        return r[0]?.cnt || 0;
      }
      if (targetType === 'CHANNEL' && targetChannelId) {
        const r: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
          SELECT count(*)::int AS cnt FROM "chat_channel_subscribers"
          WHERE "channelId" = $1
        `, targetChannelId);
        return r[0]?.cnt || 0;
      }
    } catch (e: any) {
      this.logger.warn(`Failed to estimate recipients for target ${targetType}: ${e.message}`);
    }
    return 0;
  }

  // ═════════════════════════════════════════════════════════════════
  //  HELPER — Notifier les destinataires (V1: log only, V2: real push)
  // ═════════════════════════════════════════════════════════════════
  private async notifyRecipients(
    announcementId: string,
    tenantId: string,
    targetType: string,
    priority: string,
  ): Promise<void> {
    // V1: log only — V2 will send push notifications via PushNotificationService
    this.logger.log(`📢 Announcement ${announcementId} published (target=${targetType}, priority=${priority}). Push notifications will be sent in V2.`);
  }
}

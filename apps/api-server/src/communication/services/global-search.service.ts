/**
 * ============================================================================
 * HELM CONNECT V2.4 — Global Search Service
 * ============================================================================
 *
 * Recherche transversale dans Helm Connect :
 *   - Messages (contenu des messages de toutes mes conversations)
 *   - Personnes (users + guardians du tenant)
 *   - Groupes (conversations de groupe du tenant)
 *   - Fichiers (messages avec attachments)
 *   - Annonces (chat_announcements publiées)
 *
 * ⭐ Architecture :
 *   - Un seul appel API renvoie une réponse multi-sections
 *   - Chaque section est paginée indépendamment (limite 10 par section)
 *   - Les permissions sont respectées :
 *     • Messages : seulement dans les conversations où l'utilisateur est participant
 *     • Personnes : intra-tenant (sauf PLATFORM_OWNER)
 *     • Groupes : seulement ceux où l'utilisateur est membre
 *     • Fichiers : seulement dans les conversations où l'utilisateur est participant
 *     • Annonces : seulement les annonces publiées qui ciblent l'utilisateur
 *
 * ⭐ Filtres optionnels :
 *   - type=message|person|group|file|announcement
 *   - dateFrom / dateTo (ISO)
 * ============================================================================
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export type SearchType = 'message' | 'person' | 'group' | 'file' | 'announcement';

export interface GlobalSearchResult {
  messages: Array<{
    id: string;
    conversationId: string;
    conversationName?: string;
    senderId: string;
    senderName: string;
    content: string;
    type: string;
    createdAt: Date;
    attachmentUrl?: string;
    attachmentName?: string;
  }>;
  people: Array<{
    userId: string;
    firstName: string;
    lastName: string;
    email?: string;
    role: string;
    roleLabel: string;
    isSameTenant: boolean;
    avatarUrl?: string;
  }>;
  groups: Array<{
    id: string;
    name: string;
    description?: string;
    avatarUrl?: string;
    participantCount: number;
    lastMessageAt?: Date;
    lastMessagePreview?: string;
  }>;
  files: Array<{
    messageId: string;
    conversationId: string;
    conversationName?: string;
    senderName: string;
    attachmentUrl: string;
    attachmentName: string;
    attachmentMime: string;
    attachmentSize?: number;
    type: string;
    createdAt: Date;
  }>;
  announcements: Array<{
    id: string;
    title: string;
    body: string;
    priority: string;
    targetType: string;
    authorName: string;
    publishedAt: Date;
    readCount: number;
    totalRecipients: number;
  }>;
  total: number;
}

@Injectable()
export class GlobalSearchService {
  private readonly logger = new Logger(GlobalSearchService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ═════════════════════════════════════════════════════════════════
  //  SEARCH — Main entry point
  // ═════════════════════════════════════════════════════════════════
  async globalSearch(
    tenantId: string,
    userId: string,
    query: string,
    options: {
      types?: SearchType[];     // default: all 5 types
      dateFrom?: Date;
      dateTo?: Date;
      limit?: number;           // per section, default 10
    } = {},
  ): Promise<GlobalSearchResult> {
    if (!query || query.trim().length < 2) {
      throw new BadRequestException('Query must be at least 2 characters');
    }
    const limit = Math.min(options.limit || 10, 50);
    const types = options.types && options.types.length > 0
      ? options.types
      : (['message', 'person', 'group', 'file', 'announcement'] as SearchType[]);
    const likeQuery = `%${query.trim().toLowerCase()}%`;

    // Run all enabled searches in parallel for performance
    const tasks: Promise<Partial<GlobalSearchResult>>[] = [];

    if (types.includes('message')) {
      tasks.push(this.searchMessages(tenantId, userId, likeQuery, limit, options.dateFrom, options.dateTo).then(messages => ({ messages })));
    }
    if (types.includes('person')) {
      tasks.push(this.searchPeople(tenantId, userId, likeQuery, limit).then(people => ({ people })));
    }
    if (types.includes('group')) {
      tasks.push(this.searchGroups(tenantId, userId, likeQuery, limit).then(groups => ({ groups })));
    }
    if (types.includes('file')) {
      tasks.push(this.searchFiles(tenantId, userId, likeQuery, limit, options.dateFrom, options.dateTo).then(files => ({ files })));
    }
    if (types.includes('announcement')) {
      tasks.push(this.searchAnnouncements(tenantId, userId, likeQuery, limit).then(announcements => ({ announcements })));
    }

    const results = await Promise.all(tasks);
    const merged: GlobalSearchResult = {
      messages: [],
      people: [],
      groups: [],
      files: [],
      announcements: [],
      total: 0,
    };
    for (const r of results) {
      if (r.messages) { merged.messages = r.messages; }
      if (r.people) { merged.people = r.people; }
      if (r.groups) { merged.groups = r.groups; }
      if (r.files) { merged.files = r.files; }
      if (r.announcements) { merged.announcements = r.announcements; }
    }
    merged.total = merged.messages.length + merged.people.length + merged.groups.length + merged.files.length + merged.announcements.length;
    return merged;
  }

  // ═════════════════════════════════════════════════════════════════
  //  MESSAGES — Search across all my conversations
  // ═════════════════════════════════════════════════════════════════
  private async searchMessages(
    tenantId: string,
    userId: string,
    likeQuery: string,
    limit: number,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<GlobalSearchResult['messages']> {
    const dateFilter = dateFrom && dateTo
      ? `AND m."createdAt" BETWEEN $4 AND $5`
      : dateFrom
      ? `AND m."createdAt" >= $4`
      : dateTo
      ? `AND m."createdAt" <= $4`
      : '';

    const params: any[] = [tenantId, userId, likeQuery];
    if (dateFrom) params.push(dateFrom);
    if (dateTo) params.push(dateTo);

    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT m.id, m."conversationId", m."senderId", m.content, m.type,
             m."attachmentUrl", m."attachmentName", m."createdAt",
             u."firstName" AS "senderFirstName", u."lastName" AS "senderLastName",
             c.name AS "conversationName", c.type AS "conversationType"
      FROM chat_messages m
      JOIN chat_participants p ON p."conversationId" = m."conversationId" AND p."userId" = $2 AND p."leftAt" IS NULL
      JOIN "chat_conversations" c ON c.id = m."conversationId" AND c."tenantId" = $1
      LEFT JOIN "users" u ON u.id = m."senderId"
      WHERE m."deletedAt" IS NULL
        AND m.content IS NOT NULL
        AND LOWER(m.content) LIKE $3
        ${dateFilter}
      ORDER BY m."createdAt" DESC
      LIMIT ${limit}
    `, ...params);

    return rows.map(r => ({
      id: r.id,
      conversationId: r.conversationId,
      conversationName: r.conversationType === 'GROUP' ? r.conversationName : `${r.senderFirstName} ${r.senderLastName}`,
      senderId: r.senderId,
      senderName: `${r.senderFirstName || ''} ${r.senderLastName || ''}`.trim(),
      content: r.content,
      type: r.type,
      createdAt: r.createdAt,
      attachmentUrl: r.attachmentUrl,
      attachmentName: r.attachmentName,
    }));
  }

  // ═════════════════════════════════════════════════════════════════
  //  PEOPLE — Search users + guardians
  // ═════════════════════════════════════════════════════════════════
  private async searchPeople(
    tenantId: string,
    userId: string,
    likeQuery: string,
    limit: number,
  ): Promise<GlobalSearchResult['people']> {
    // ⭐ V6.1 (fix recherche téléphone) — normalisation des numéros :
    //    la production mélange +229 97…, 019…, 97 12 34 56. On teste des
    //    variantes de la requête (chiffres uniquement) contre le numéro
    //    NORMALISÉ. Enseignants : numéro dans teachers.phone (users n'a
    //    pas de colonne phone) + noms de secours via la fiche enseignant.
    const rawQuery = likeQuery.replace(/%/g, '').trim();
    const digits = rawQuery.replace(/\D/g, '');
    const isPhoneish = digits.length >= 4;
    const phoneVariants = isPhoneish
      ? Array.from(new Set([
          digits,
          digits.replace(/^00/, ''),
          digits.replace(/^229/, ''),
          digits.replace(/^0+/, ''),
          digits.length >= 10 ? digits.slice(-8) : null,
        ].filter((v): v is string => !!v && v.length >= 4)))
      : [];
    const phonePatterns = phoneVariants.map(v => `%${v}%`);
    const rawDigits = isPhoneish ? digits : null;

    // Search in users table
    // ⭐ FIX (sept. 2026 — isolation multi-tenant, retour utilisateur) :
    //    recherche limitée à l'établissement courant — les membres d'autres
    //    écoles n'apparaissent plus (un secrétaire comptable d'une autre école
    //    apparaissait dans la recherche Helm Connect de CSPEB). Le filtre
    //    inclut les comptes sans établissement ? NON — restons stricts : la
    //    discussion est interne à l'école.
    const userRows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT u.id, u."firstName", u."lastName", u.email, u.role,
             t."name" AS "tenantName",
             (u."tenantId" = $1) AS "isSameTenant",
             NULLIF(TRIM(tch."firstName"), '') AS "teacherFirstName",
             NULLIF(TRIM(tch."lastName"), '') AS "teacherLastName"
      FROM "users" u
      LEFT JOIN "tenants" t ON t.id = u."tenantId"
      LEFT JOIN LATERAL (
        SELECT "firstName", "lastName", "phone" FROM "teachers"
        WHERE u."email" IS NOT NULL AND LOWER("email") = LOWER(u."email")
        LIMIT 1
      ) tch ON true
      WHERE u.id != $2
        AND u."tenantId" = $1
        AND (
          LOWER(COALESCE(u."firstName", '')) LIKE $3
          OR LOWER(COALESCE(u."lastName", '')) LIKE $3
          OR LOWER(COALESCE(u."firstName", '') || ' ' || COALESCE(u."lastName", '')) LIKE $3
          OR LOWER(COALESCE(u."email", '')) LIKE $3
          OR (tch."firstName" IS NOT NULL AND LOWER(tch."firstName" || ' ' || tch."lastName") LIKE $3)
          OR (tch."phone" IS NOT NULL AND regexp_replace(tch."phone", '[^0-9]', '', 'g') LIKE ANY($4::text[]))
        )
      ORDER BY "isSameTenant" DESC, u."lastName" ASC, u."firstName" ASC
      LIMIT ${limit}
    `, tenantId, userId, likeQuery, phonePatterns);

    // Also search in guardians table (parents without account)
    let guardianRows: any[] = [];
    try {
      guardianRows = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT g.id AS "guardianId", g."userId", g."firstName", g."lastName", g.email, g.phone,
               g."tenantId", t."name" AS "tenantName",
               (g."tenantId" = $1) AS "isSameTenant"
        FROM "guardians" g
        LEFT JOIN "tenants" t ON t.id = g."tenantId"
        WHERE g."tenantId" = $1
        AND (
          LOWER(COALESCE(g."firstName", '')) LIKE $2
          OR LOWER(COALESCE(g."lastName", '')) LIKE $2
          OR LOWER(COALESCE(g."firstName", '') || ' ' || COALESCE(g."lastName", '')) LIKE $2
          OR LOWER(COALESCE(g."email", '')) LIKE $2
          OR (
            g."phone" IS NOT NULL AND (
              regexp_replace(g."phone", '[^0-9]', '', 'g') LIKE ANY($4::text[])
              OR $5 LIKE '%' || RIGHT(regexp_replace(g."phone", '[^0-9]', '', 'g'), 8) || '%'
            )
          )
        )
        ORDER BY g."lastName" ASC, g."firstName" ASC
        LIMIT ${limit}
      `, tenantId, likeQuery, limit, phonePatterns, rawDigits);
    } catch (e: any) {
      this.logger.warn(`Guardians search failed: ${e.message}`);
    }

    // Merge + dedupe by email
    const seenEmails = new Set<string>();
    const people: GlobalSearchResult['people'] = [];

    for (const u of userRows) {
      if (u.email && seenEmails.has(u.email.toLowerCase())) continue;
      if (u.email) seenEmails.add(u.email.toLowerCase());
      people.push({
        userId: u.id,
        firstName: u.firstName || u.teacherFirstName || '',
        lastName: u.lastName || u.teacherLastName || '',
        email: u.email,
        role: u.role || 'USER',
        roleLabel: this.getRoleLabel(u.role),
        isSameTenant: !!u.isSameTenant,
      });
    }

    // Add guardians without userId (parents without account)
    for (const g of guardianRows) {
      if (g.userId) continue; // Skip — already in users
      if (g.email && seenEmails.has(g.email.toLowerCase())) continue;
      if (g.email) seenEmails.add(g.email.toLowerCase());
      people.push({
        userId: g.guardianId, // Use guardianId as pseudo-userId
        firstName: g.firstName || '',
        lastName: g.lastName || '',
        email: g.email,
        role: 'PARENT',
        roleLabel: 'Parent d\'élève',
        isSameTenant: !!g.isSameTenant,
      });
    }

    return people.slice(0, limit);
  }

  private getRoleLabel(role: string | undefined): string {
    const upperRole = (role || '').toUpperCase();
    // ⭐ FIX (sept. 2026 — retour utilisateur Helm Connect) : suffixes de
    //    niveau (_MAT, _PRI, _SEC…) retirés + SECRETAIRE_COMPTABLE →
    //    « Secrétaire comptable » (s'affichait en brut dans la recherche).
    const baseRole = upperRole.replace(/_(MAT_PRI|MAT|PRI|SEC|GEN|EN)$/i, '');
    const r = baseRole || upperRole;
    if (r === 'ENSEIGNANT' || r === 'TEACHER') return 'Enseignant';
    if (r === 'PARENT' || r === 'GUARDIAN') return 'Parent d\'élève';
    if (r === 'PROMOTER' || r === 'SCHOOL_OWNER' || r === 'PROMOTEUR') return 'Promoteur';
    if (r === 'DIRECTEUR_GENERAL' || r === 'DIRECTOR_GENERAL' || r === 'DIRECTEUR_ETABLISSEMENT' || r === 'DIRECTEUR') return 'Directeur';
    if (r === 'SCHOOL_ADMIN' || r === 'ADMIN') return 'Administration';
    if (r === 'PLATFORM_OWNER' || r === 'SUPER_ADMIN') return 'Administration plateforme';
    if (r === 'SECRETAIRE_COMPTABLE') return 'Secrétaire comptable';
    if (r === 'SECRETAIRE') return 'Secrétaire';
    if (r === 'SURVEILLANT' || r === 'SURVEILLANT_GENERAL') return 'Surveillant';
    if (r === 'CENSEUR') return 'Censeur';
    if (r === 'COMPTABLE' || r === 'CAISSIER') return 'Comptable';
    return role || 'Utilisateur';
  }

  // ═════════════════════════════════════════════════════════════════
  //  GROUPS — Search my groups
  // ═════════════════════════════════════════════════════════════════
  private async searchGroups(
    tenantId: string,
    userId: string,
    likeQuery: string,
    limit: number,
  ): Promise<GlobalSearchResult['groups']> {
    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT c.id, c.name, c.description, c."avatarUrl",
             c."lastMessageAt", c."lastMessagePreview",
             (SELECT count(*)::int FROM chat_participants p
              WHERE p."conversationId" = c.id AND p."leftAt" IS NULL) AS "participantCount"
      FROM "chat_conversations" c
      JOIN chat_participants p ON p."conversationId" = c.id AND p."userId" = $2 AND p."leftAt" IS NULL
      WHERE c."tenantId" = $1
        AND c.type = 'GROUP'
        AND (LOWER(COALESCE(c.name, '')) LIKE $3
             OR LOWER(COALESCE(c.description, '')) LIKE $3)
      ORDER BY COALESCE(c."lastMessageAt", c."createdAt") DESC
      LIMIT ${limit}
    `, tenantId, userId, likeQuery);

    return rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      avatarUrl: r.avatarUrl,
      participantCount: r.participantCount || 0,
      lastMessageAt: r.lastMessageAt,
      lastMessagePreview: r.lastMessagePreview,
    }));
  }

  // ═════════════════════════════════════════════════════════════════
  //  FILES — Search files in my conversations
  // ═════════════════════════════════════════════════════════════════
  private async searchFiles(
    tenantId: string,
    userId: string,
    likeQuery: string,
    limit: number,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<GlobalSearchResult['files']> {
    const dateFilter = dateFrom && dateTo
      ? `AND m."createdAt" BETWEEN $4 AND $5`
      : dateFrom
      ? `AND m."createdAt" >= $4`
      : dateTo
      ? `AND m."createdAt" <= $4`
      : '';

    const params: any[] = [tenantId, userId, likeQuery];
    if (dateFrom) params.push(dateFrom);
    if (dateTo) params.push(dateTo);

    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT m.id AS "messageId", m."conversationId", m."attachmentUrl", m."attachmentName",
             m."attachmentMime", m."attachmentSize", m.type, m."createdAt",
             u."firstName" AS "senderFirstName", u."lastName" AS "senderLastName",
             c.name AS "conversationName", c.type AS "conversationType"
      FROM chat_messages m
      JOIN chat_participants p ON p."conversationId" = m."conversationId" AND p."userId" = $2 AND p."leftAt" IS NULL
      JOIN "chat_conversations" c ON c.id = m."conversationId" AND c."tenantId" = $1
      LEFT JOIN "users" u ON u.id = m."senderId"
      WHERE m."deletedAt" IS NULL
        AND m."attachmentUrl" IS NOT NULL
        AND m.type IN ('IMAGE', 'DOCUMENT', 'AUDIO')
        AND (LOWER(COALESCE(m."attachmentName", '')) LIKE $3
             OR LOWER(COALESCE(m.content, '')) LIKE $3)
        ${dateFilter}
      ORDER BY m."createdAt" DESC
      LIMIT ${limit}
    `, ...params);

    return rows.map(r => ({
      messageId: r.messageId,
      conversationId: r.conversationId,
      conversationName: r.conversationType === 'GROUP' ? r.conversationName : `${r.senderFirstName} ${r.senderLastName}`,
      senderName: `${r.senderFirstName || ''} ${r.senderLastName || ''}`.trim(),
      attachmentUrl: r.attachmentUrl,
      attachmentName: r.attachmentName,
      attachmentMime: r.attachmentMime,
      attachmentSize: r.attachmentSize,
      type: r.type,
      createdAt: r.createdAt,
    }));
  }

  // ═════════════════════════════════════════════════════════════════
  //  ANNOUNCEMENTS — Search published announcements
  // ═════════════════════════════════════════════════════════════════
  private async searchAnnouncements(
    tenantId: string,
    userId: string,
    likeQuery: string,
    limit: number,
  ): Promise<GlobalSearchResult['announcements']> {
    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT a.id, a.title, a.body, a.priority, a."targetType", a."publishedAt",
             u."firstName" AS "authorFirstName", u."lastName" AS "authorLastName",
             (SELECT count(*)::int FROM "chat_announcement_reads" r
              WHERE r."announcementId" = a.id) AS "readCount",
             0 AS "totalRecipients"
      FROM "chat_announcements" a
      LEFT JOIN "users" u ON u.id = a."authorId"
      WHERE a."tenantId" = $1
        AND a."publishedAt" IS NOT NULL
        AND (a."expiresAt" IS NULL OR a."expiresAt" > NOW())
        AND a."deletedAt" IS NULL
        AND (LOWER(COALESCE(a.title, '')) LIKE $2
             OR LOWER(COALESCE(a.body, '')) LIKE $2)
      ORDER BY a."publishedAt" DESC
      LIMIT ${limit}
    `, tenantId, likeQuery);

    return rows.map(r => ({
      id: r.id,
      title: r.title,
      body: r.body,
      priority: r.priority,
      targetType: r.targetType,
      authorName: `${r.authorFirstName || ''} ${r.authorLastName || ''}`.trim() || 'Administration',
      publishedAt: r.publishedAt,
      readCount: r.readCount || 0,
      totalRecipients: r.totalRecipients || 0,
    }));
  }
}

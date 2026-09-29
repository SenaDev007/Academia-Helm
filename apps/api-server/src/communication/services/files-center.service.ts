/**
 * ============================================================================
 * FILES CENTER SERVICE — Fichiers partagés transverses (V4 Phase 2)
 * ============================================================================
 *
 * Alimente la section « Fichiers » (centre documentaire) et la section
 * « Vocaux » du panneau Helm Connect : contrairement au Document Center
 * V2.5 (par conversation), ce service agrège les fichiers de TOUTES les
 * conversations dont l'utilisateur est membre.
 *
 *   getUserFiles(tenantId, userId, type)
 *     type:
 *       - 'media'     → images + vidéos (galerie)
 *       - 'document'  → PDF/Word/Excel/PowerPoint/ZIP…
 *       - 'audio'     → messages vocaux
 *       - 'all'       → tout
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class FilesCenterService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserFiles(
    tenantId: string,
    userId: string,
    type: 'media' | 'document' | 'audio' | 'all' = 'all',
    limit = 100,
    offset = 0,
  ): Promise<any[]> {
    const typeFilter = type === 'all' ? null : type;
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT m."id", m."conversationId", m."type", m."attachmentUrl", m."attachmentName",
              m."attachmentSize", m."attachmentMime", m."createdAt", m."senderId",
              c."type" AS "convType", c."name" AS "convName",
              (u."firstName" || ' ' || u."lastName") AS "senderName"
       FROM "chat_messages" m
       JOIN "chat_conversations" c ON c."id" = m."conversationId"
       LEFT JOIN "users" u ON u."id" = m."senderId"
       WHERE m."deletedAt" IS NULL
         AND m."attachmentUrl" IS NOT NULL
         AND c."tenantId" = $1
         AND EXISTS (
           SELECT 1 FROM "chat_participants" p
           WHERE p."conversationId" = m."conversationId" AND p."userId" = $2 AND p."leftAt" IS NULL
         )
         AND (
           $3::text IS NULL
           OR ($3 = 'media' AND m."type" IN ('IMAGE', 'VIDEO'))
           OR ($3 = 'document' AND m."type" = 'DOCUMENT')
           OR ($3 = 'audio' AND m."type" = 'AUDIO')
         )
       ORDER BY m."createdAt" DESC
       LIMIT $4 OFFSET $5`,
      tenantId, userId, typeFilter, Math.min(limit, 200), Math.max(offset, 0),
    );
    return rows.map((r) => ({
      id: r.id,
      conversationId: r.conversationId,
      convName: r.convName,
      convType: r.convType,
      type: r.type,
      url: r.attachmentUrl,
      name: r.attachmentName,
      size: r.attachmentSize,
      mime: r.attachmentMime,
      createdAt: r.createdAt,
      senderId: r.senderId,
      senderName: (r.senderName || '').trim() || 'Utilisateur',
    }));
  }

  /** Statistiques rapides pour la section Fichiers (totaux par type). */
  async getUserFilesStats(tenantId: string, userId: string): Promise<{
    media: number; documents: number; audio: number; total: number;
  }> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{
      media: number; documents: number; audio: number; total: number;
    }>>(
      `SELECT
         COUNT(*) FILTER (WHERE m."type" IN ('IMAGE', 'VIDEO'))::int AS "media",
         COUNT(*) FILTER (WHERE m."type" = 'DOCUMENT')::int AS "documents",
         COUNT(*) FILTER (WHERE m."type" = 'AUDIO')::int AS "audio",
         COUNT(*)::int AS "total"
       FROM "chat_messages" m
       JOIN "chat_conversations" c ON c."id" = m."conversationId"
       WHERE m."deletedAt" IS NULL
         AND m."attachmentUrl" IS NOT NULL
         AND c."tenantId" = $1
         AND EXISTS (
           SELECT 1 FROM "chat_participants" p
           WHERE p."conversationId" = m."conversationId" AND p."userId" = $2 AND p."leftAt" IS NULL
         )`,
      tenantId, userId,
    );
    return rows[0] || { media: 0, documents: 0, audio: 0, total: 0 };
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V6 (spec §22 — centre documentaire) — LIENS & ÉPINGLÉS transverses
  //  ==================================================================
  //  Les endpoints par conversation existaient (document-center.service)
  //  mais la section Fichiers n'avait AUCUNE vue Liens/Épinglés. Ces deux
  //  méthodes agrègent sur TOUTES les conversations du membre (même modèle
  //  que getUserFiles).
  // ═════════════════════════════════════════════════════════════════

  /** Tous les LIENS partagés dans les conversations du membre (URLs extraites des messages texte). */
  async getUserLinks(tenantId: string, userId: string, limit = 100): Promise<any[]> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT m."id", m."conversationId", m."content", m."createdAt", m."senderId",
              c."type" AS "convType", c."name" AS "convName",
              (u."firstName" || ' ' || u."lastName") AS "senderName"
       FROM "chat_messages" m
       JOIN "chat_conversations" c ON c."id" = m."conversationId"
       LEFT JOIN "users" u ON u."id" = m."senderId"
       WHERE m."deletedAt" IS NULL
         AND m."type" = 'TEXT'
         AND m."content" ~* 'https?://'
         AND c."tenantId" = $1
         AND EXISTS (
           SELECT 1 FROM "chat_participants" p
           WHERE p."conversationId" = m."conversationId" AND p."userId" = $2 AND p."leftAt" IS NULL
         )
       ORDER BY m."createdAt" DESC
       LIMIT $3`,
      tenantId, userId, Math.min(limit, 200),
    );
    // Extraire la première URL + le contexte (extrait JS, comme le V2.5)
    const urlRe = /https?:\/\/[^\s<>"')\]]+/g;
    return rows
      .map((r) => {
        const content = String(r.content || '');
        const match = content.match(urlRe);
        if (!match) return null;
        return {
          id: r.id,
          conversationId: r.conversationId,
          convName: r.convName,
          convType: r.convType,
          url: match[0],
          context: content.replace(/<[^>]*>/g, '').substring(0, 140),
          createdAt: r.createdAt,
          senderId: r.senderId,
          senderName: (r.senderName || '').trim() || 'Utilisateur',
        };
      })
      .filter(Boolean);
  }

  /** Tous les messages ÉPINGLÉS des conversations du membre. */
  async getUserPinned(tenantId: string, userId: string, limit = 100): Promise<any[]> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT m."id", m."conversationId", m."type", m."content", m."attachmentName", m."attachmentUrl",
              m."pinnedAt", m."createdAt", m."senderId",
              c."type" AS "convType", c."name" AS "convName",
              (u."firstName" || ' ' || u."lastName") AS "senderName"
       FROM "chat_messages" m
       JOIN "chat_conversations" c ON c."id" = m."conversationId"
       LEFT JOIN "users" u ON u."id" = m."senderId"
       WHERE m."deletedAt" IS NULL
         AND m."isPinned" = TRUE
         AND c."tenantId" = $1
         AND EXISTS (
           SELECT 1 FROM "chat_participants" p
           WHERE p."conversationId" = m."conversationId" AND p."userId" = $2 AND p."leftAt" IS NULL
         )
       ORDER BY m."pinnedAt" DESC NULLS LAST
       LIMIT $3`,
      tenantId, userId, Math.min(limit, 200),
    );
    return rows.map((r) => ({
      id: r.id,
      conversationId: r.conversationId,
      convName: r.convName,
      convType: r.convType,
      type: r.type,
      content: r.content ? String(r.content).replace(/<[^>]*>/g, '').substring(0, 160) : null,
      attachmentName: r.attachmentName,
      attachmentUrl: r.attachmentUrl,
      pinnedAt: r.pinnedAt || r.createdAt,
      senderId: r.senderId,
      senderName: (r.senderName || '').trim() || 'Utilisateur',
    }));
  }
}

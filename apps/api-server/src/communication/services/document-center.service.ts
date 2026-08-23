/**
 * ============================================================================
 * HELM CONNECT V2.5 — Conversation Document Center Service
 * ============================================================================
 *
 * Centre documentaire par conversation :
 *   - Médias (images) — tous les messages IMAGE d'une conversation
 *   - Documents (PDF, Word, Excel, etc.) — tous les messages DOCUMENT
 *   - Liens (URLs détectées dans les messages texte)
 *   - Messages épinglés (messages marqués comme importants)
 *
 * ⭐ Architecture :
 *   - Pour chaque conversation, l'utilisateur peut cliquer sur l'icône
 *     "Document Center" dans la barre d'outils de la conversation.
 *   - Le frontend affiche alors 4 onglets : Médias / Documents / Liens / Épinglés.
 *
 * ⭐ Tables utilisées :
 *   - chat_messages (avec type=IMAGE/DOCUMENT et content/attachmentUrl)
 *   - chat_messages (avec isPinned=TRUE — nouveau champ V2.5)
 *   - Pas de nouvelle table pour les liens — extraits à la volée du content
 *
 * ⭐ Nouveau champ V2.5 :
 *   - chat_messages.isPinned (BOOLEAN, default FALSE)
 *   - chat_messages.pinnedBy (TEXT, optional)
 *   - chat_messages.pinnedAt (TIMESTAMPTZ, optional)
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { randomUUID } from 'crypto';

// ⭐ FIX: regex had an unbalanced `)` causing SWC build failure
//    "Unterminated regexp literal" / "Syntax Error"
//    Original (broken): /https?:\/\/[^\s"'<>\]]+[^.\s"'<>\])/gi
//                                                       ^ extra unmatched paren
//    Fixed: matches URLs starting with http(s)://, stops at whitespace / quotes / angle brackets / ]
const URL_REGEX = /https?:\/\/[^\s"'<>\]]+/gi;

@Injectable()
export class ConversationDocumentCenterService {
  private readonly logger = new Logger(ConversationDocumentCenterService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ═════════════════════════════════════════════════════════════════
  //  MEDIAS — All images in a conversation
  // ═════════════════════════════════════════════════════════════════
  async listMedia(
    tenantId: string,
    userId: string,
    conversationId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{
    items: Array<{
      messageId: string;
      senderId: string;
      senderName: string;
      attachmentUrl: string;
      attachmentName?: string;
      attachmentSize?: number;
      content?: string;
      createdAt: Date;
    }>;
    total: number;
  }> {
    await this.assertParticipant(tenantId, userId, conversationId);
    const limit = Math.min(options.limit || 50, 200);
    const offset = options.offset || 0;

    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT m.id AS "messageId", m."senderId", m."attachmentUrl", m."attachmentName",
             m."attachmentSize", m.content, m."createdAt",
             u."firstName" AS "senderFirstName", u."lastName" AS "senderLastName"
      FROM chat_messages m
      LEFT JOIN "users" u ON u.id = m."senderId"
      WHERE m."conversationId" = $1
        AND m.type = 'IMAGE'
        AND m."attachmentUrl" IS NOT NULL
        AND m."deletedAt" IS NULL
      ORDER BY m."createdAt" DESC
      LIMIT $2 OFFSET $3
    `, conversationId, limit, offset);

    const totalRows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT count(*)::int AS total
      FROM chat_messages
      WHERE "conversationId" = $1
        AND type = 'IMAGE'
        AND "attachmentUrl" IS NOT NULL
        AND "deletedAt" IS NULL
    `, conversationId);

    return {
      items: rows.map(r => ({
        messageId: r.messageId,
        senderId: r.senderId,
        senderName: `${r.senderFirstName || ''} ${r.senderLastName || ''}`.trim(),
        attachmentUrl: r.attachmentUrl,
        attachmentName: r.attachmentName,
        attachmentSize: r.attachmentSize,
        content: r.content,
        createdAt: r.createdAt,
      })),
      total: totalRows[0]?.total || 0,
    };
  }

  // ═════════════════════════════════════════════════════════════════
  //  DOCUMENTS — All documents (PDF, Word, Excel, etc.)
  // ═════════════════════════════════════════════════════════════════
  async listDocuments(
    tenantId: string,
    userId: string,
    conversationId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{
    items: Array<{
      messageId: string;
      senderId: string;
      senderName: string;
      attachmentUrl: string;
      attachmentName: string;
      attachmentMime?: string;
      attachmentSize?: number;
      content?: string;
      createdAt: Date;
    }>;
    total: number;
  }> {
    await this.assertParticipant(tenantId, userId, conversationId);
    const limit = Math.min(options.limit || 50, 200);
    const offset = options.offset || 0;

    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT m.id AS "messageId", m."senderId", m."attachmentUrl", m."attachmentName",
             m."attachmentMime", m."attachmentSize", m.content, m."createdAt",
             u."firstName" AS "senderFirstName", u."lastName" AS "senderLastName"
      FROM chat_messages m
      LEFT JOIN "users" u ON u.id = m."senderId"
      WHERE m."conversationId" = $1
        AND m.type = 'DOCUMENT'
        AND m."attachmentUrl" IS NOT NULL
        AND m."deletedAt" IS NULL
      ORDER BY m."createdAt" DESC
      LIMIT $2 OFFSET $3
    `, conversationId, limit, offset);

    const totalRows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT count(*)::int AS total
      FROM chat_messages
      WHERE "conversationId" = $1
        AND type = 'DOCUMENT'
        AND "attachmentUrl" IS NOT NULL
        AND "deletedAt" IS NULL
    `, conversationId);

    return {
      items: rows.map(r => ({
        messageId: r.messageId,
        senderId: r.senderId,
        senderName: `${r.senderFirstName || ''} ${r.senderLastName || ''}`.trim(),
        attachmentUrl: r.attachmentUrl,
        attachmentName: r.attachmentName,
        attachmentMime: r.attachmentMime,
        attachmentSize: r.attachmentSize,
        content: r.content,
        createdAt: r.createdAt,
      })),
      total: totalRows[0]?.total || 0,
    };
  }

  // ═════════════════════════════════════════════════════════════════
  //  LINKS — Extract URLs from text messages
  // ═════════════════════════════════════════════════════════════════
  async listLinks(
    tenantId: string,
    userId: string,
    conversationId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{
    items: Array<{
      messageId: string;
      url: string;
      senderId: string;
      senderName: string;
      context: string;       // surrounding text
      createdAt: Date;
    }>;
    total: number;
  }> {
    await this.assertParticipant(tenantId, userId, conversationId);
    const limit = Math.min(options.limit || 50, 200);
    const offset = options.offset || 0;

    // Fetch all text messages, then extract URLs in JS (PostgreSQL regex is less flexible)
    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT m.id AS "messageId", m.content, m."senderId", m."createdAt",
             u."firstName" AS "senderFirstName", u."lastName" AS "senderLastName"
      FROM chat_messages m
      LEFT JOIN "users" u ON u.id = m."senderId"
      WHERE m."conversationId" = $1
        AND m.type = 'TEXT'
        AND m.content IS NOT NULL
        AND m.content ~* 'https?://'
        AND m."deletedAt" IS NULL
      ORDER BY m."createdAt" DESC
      LIMIT $2 OFFSET $3
    `, conversationId, limit, offset);

    const totalRows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT count(*)::int AS total
      FROM chat_messages
      WHERE "conversationId" = $1
        AND type = 'TEXT'
        AND content IS NOT NULL
        AND content ~* 'https?://'
        AND "deletedAt" IS NULL
    `, conversationId);

    const items: any[] = [];
    for (const r of rows) {
      const content = r.content || '';
      const matches = content.match(URL_REGEX) || [];
      for (const url of matches) {
        // Get a short context (around the URL)
        const idx = content.indexOf(url);
        const start = Math.max(0, idx - 60);
        const end = Math.min(content.length, idx + url.length + 60);
        const context = content.substring(start, end);
        items.push({
          messageId: r.messageId,
          url,
          senderId: r.senderId,
          senderName: `${r.senderFirstName || ''} ${r.senderLastName || ''}`.trim(),
          context,
          createdAt: r.createdAt,
        });
      }
    }

    return {
      items,
      total: totalRows[0]?.total || 0,
    };
  }

  // ═════════════════════════════════════════════════════════════════
  //  PINNED — List pinned messages
  // ═════════════════════════════════════════════════════════════════
  async listPinned(
    tenantId: string,
    userId: string,
    conversationId: string,
  ): Promise<{
    items: Array<{
      id: string;
      senderId: string;
      senderName: string;
      content?: string;
      type: string;
      attachmentUrl?: string;
      attachmentName?: string;
      createdAt: Date;
      pinnedBy?: string;
      pinnedAt: Date;
    }>;
  }> {
    await this.assertParticipant(tenantId, userId, conversationId);

    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT m.id, m."senderId", m.content, m.type,
             m."attachmentUrl", m."attachmentName", m."createdAt",
             m."pinnedBy", m."pinnedAt",
             u."firstName" AS "senderFirstName", u."lastName" AS "senderLastName"
      FROM chat_messages m
      LEFT JOIN "users" u ON u.id = m."senderId"
      WHERE m."conversationId" = $1
        AND m."isPinned" = TRUE
        AND m."deletedAt" IS NULL
      ORDER BY m."pinnedAt" DESC
    `, conversationId);

    return {
      items: rows.map(r => ({
        id: r.id,
        senderId: r.senderId,
        senderName: `${r.senderFirstName || ''} ${r.senderLastName || ''}`.trim(),
        content: r.content,
        type: r.type,
        attachmentUrl: r.attachmentUrl,
        attachmentName: r.attachmentName,
        createdAt: r.createdAt,
        pinnedBy: r.pinnedBy,
        pinnedAt: r.pinnedAt,
      })),
    };
  }

  // ═════════════════════════════════════════════════════════════════
  //  PIN — Pin a message (only conversation admins/participants)
  // ═════════════════════════════════════════════════════════════════
  async pinMessage(
    tenantId: string,
    userId: string,
    messageId: string,
  ): Promise<{ success: boolean }> {
    // Verify the message belongs to a conversation the user is in
    const msg: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT m."conversationId" FROM chat_messages m
      JOIN "chat_conversations" c ON c.id = m."conversationId" AND c."tenantId" = $1
      JOIN chat_participants p ON p."conversationId" = m."conversationId"
        AND p."userId" = $2 AND p."leftAt" IS NULL
      WHERE m.id = $3 AND m."deletedAt" IS NULL
    `, tenantId, userId, messageId);
    if (msg.length === 0) {
      throw new NotFoundException('Message not found or you are not a participant');
    }

    await this.prisma.$executeRawUnsafe(`
      UPDATE "chat_messages"
      SET "isPinned" = TRUE, "pinnedBy" = $2, "pinnedAt" = NOW()
      WHERE "id" = $1
    `, messageId, userId);
    return { success: true };
  }

  // ═════════════════════════════════════════════════════════════════
  //  UNPIN — Unpin a message
  // ═════════════════════════════════════════════════════════════════
  async unpinMessage(
    tenantId: string,
    userId: string,
    messageId: string,
  ): Promise<{ success: boolean }> {
    await this.assertMessageInUserConversation(tenantId, userId, messageId);
    await this.prisma.$executeRawUnsafe(`
      UPDATE "chat_messages"
      SET "isPinned" = FALSE, "pinnedBy" = NULL, "pinnedAt" = NULL
      WHERE "id" = $1
    `, messageId);
    return { success: true };
  }

  // ═════════════════════════════════════════════════════════════════
  //  HELPER — Assert user is participant in conversation
  // ═════════════════════════════════════════════════════════════════
  private async assertParticipant(tenantId: string, userId: string, conversationId: string) {
    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT p.id FROM chat_participants p
      JOIN "chat_conversations" c ON c.id = p."conversationId" AND c."tenantId" = $1
      WHERE p."conversationId" = $2 AND p."userId" = $3 AND p."leftAt" IS NULL
    `, tenantId, conversationId, userId);
    if (rows.length === 0) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }
  }

  private async assertMessageInUserConversation(tenantId: string, userId: string, messageId: string) {
    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT m.id FROM chat_messages m
      JOIN "chat_conversations" c ON c.id = m."conversationId" AND c."tenantId" = $1
      JOIN chat_participants p ON p."conversationId" = m."conversationId"
        AND p."userId" = $2 AND p."leftAt" IS NULL
      WHERE m.id = $3 AND m."deletedAt" IS NULL
    `, tenantId, userId, messageId);
    if (rows.length === 0) {
      throw new NotFoundException('Message not found or you are not a participant');
    }
  }
}

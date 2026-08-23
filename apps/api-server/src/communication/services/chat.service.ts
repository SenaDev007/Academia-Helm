/**
 * ============================================================================
 * CHAT SERVICE — Messagerie interne type WhatsApp
 * ============================================================================
 *
 * Fonctionnalités :
 *   - Conversations 1-à-1 (DIRECT) et de groupe (GROUP)
 *   - Messages texte, audio, documents, images
 *   - Statut de lecture (lastReadAt, read receipts)
 *   - Recherche d'utilisateurs (par nom/email, intra et inter-écoles)
 *   - Invitations (envoi, acceptation, refus)
 *   - Réponses threadées (replyToId)
 *
 * Sécurité :
 *   - Toutes les opérations vérifient que l'utilisateur est PARTICIPANT de la conversation
 *   - Les conversations sont liées à un tenant (sauf invitations cross-tenant)
 *   - Les fichiers joints sont stockés via StorageService (R2/S3/local)
 *
 * ⭐ Pour le "chiffrement de bout en bout" : V1 utilise TLS + StorageService chiffré.
 *    V2 ajoutera le vrai E2E (Web Crypto API + Signal protocol-like).
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import { randomUUID } from 'crypto';

export interface ChatConversation {
  id: string;
  type: 'DIRECT' | 'GROUP';
  name?: string;
  description?: string;
  avatarUrl?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt?: Date;
  lastMessagePreview?: string;
  lastMessageSenderId?: string;
  participants: ChatParticipant[];
}

export interface ChatParticipant {
  userId: string;
  role: 'ADMIN' | 'MEMBER';
  joinedAt: Date;
  lastReadAt?: Date;
  muted: boolean;
  // Données utilisateur (prénom, nom, email, avatar)
  firstName?: string;
  lastName?: string;
  email?: string;
  avatarUrl?: string;
  role_label?: string; // 'TEACHER', 'DIRECTOR', 'PARENT', 'PROMOTER'
  // ⭐ Labels enrichis pour l'affichage (FR, lisible)
  roleLabel?: string;          // ex: "Collègue enseignant", "Parent de Awa Dupont", "Directeur"
  childrenNames?: string[];   // pour les parents : noms des enfants
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  type: 'TEXT' | 'AUDIO' | 'DOCUMENT' | 'IMAGE';
  content?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentSize?: number;
  attachmentMime?: string;
  duration?: number;
  replyToId?: string;
  createdAt: Date;
  editedAt?: Date;
  deletedAt?: Date;
  // Données expéditeur
  sender?: {
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
    role?: string;
  };
  // Données du message répondu (reply)
  replyTo?: {
    id: string;
    content?: string;
    senderId: string;
    senderName?: string;
  } | null;
  // Pour qui a lu (whatsapp blue ticks)
  readBy?: { userId: string; readAt: Date }[];
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // ═════════════════════════════════════════════════════════════════
  //  CONVERSATIONS
  // ═════════════════════════════════════════════════════════════════

  /**
   * Liste toutes les conversations d'un utilisateur (triées par dernier message).
   * Inclut les métadonnées du dernier message et les participants.
   */
  async listConversations(tenantId: string, userId: string): Promise<ChatConversation[]> {
    // ⭐ FIX (Prisma P2010 — "more than one row returned by a subquery used as an expression"):
    //    The previous `participantMeta` correlated subquery returned ONE row per participant,
    //    but a conversation always has 2+ participants → PostgreSQL threw P2010.
    //    The field was unused in the result mapping → removed entirely.
    const participations: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT c.*,
             (SELECT count(*) FROM chat_messages m
              WHERE m."conversationId" = c.id
                AND m."createdAt" > COALESCE(p."lastReadAt", '1970-01-01'::timestamp)
                AND m."senderId" != $2
                AND m."deletedAt" IS NULL) AS "unreadCount"
      FROM chat_conversations c
      JOIN chat_participants p ON p."conversationId" = c.id AND p."leftAt" IS NULL
      WHERE c."tenantId" = $1 AND p."userId" = $2
      ORDER BY COALESCE(c."lastMessageAt", c."createdAt") DESC
    `, tenantId, userId);

    if (participations.length === 0) return [];

    // Fetch participants for each conversation
    const conversationIds = participations.map(p => p.id);
    // ⭐ FIX: users table has NO avatarUrl column — role is directly on users (u."role")
    //    Previously used ur."role" from user_roles JOIN, but that table has roleId (FK to roles table),
    //    not a "role" text column. So we use u."role" directly.
    const allParticipants: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT p.*, u."firstName", u."lastName", u."email", u."role" AS "role_label"
      FROM chat_participants p
      JOIN "users" u ON u.id = p."userId"
      WHERE p."conversationId" = ANY($1::text[]) AND p."leftAt" IS NULL
      ORDER BY p."joinedAt" ASC
    `, conversationIds);

    // ⭐ Enrichir : pour les parents, fetch les noms des enfants
    //    (garde la même logique que searchUsers — DRY serait mieux mais on garde simple)
    const parentUserIds = allParticipants
      .filter(p => (p.role_label || '').toUpperCase() === 'PARENT')
      .map(p => p.userId);
    const childrenByParent: Map<string, string[]> = new Map();
    if (parentUserIds.length > 0) {
      const uniqueParentIds = Array.from(new Set(parentUserIds));
      const childrenRows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT g."userId" AS "parentUserId", s."firstName" AS "studentFirstName", s."lastName" AS "studentLastName"
        FROM "guardians" g
        JOIN "student_guardians" sg ON sg."guardianId" = g.id
        JOIN "students" s ON s.id = sg."studentId"
        WHERE g."userId" = ANY($1::text[])
      `, uniqueParentIds);
      for (const r of childrenRows) {
        if (!childrenByParent.has(r.parentUserId)) childrenByParent.set(r.parentUserId, []);
        childrenByParent.get(r.parentUserId)!.push(`${r.studentFirstName || ''} ${r.studentLastName || ''}`.trim());
      }
    }

    // ⭐ Build role label — handles French values: ENSEIGNANT, COMPTABLE, DIRECTEUR, etc.
    const roleLabelFor = (role: string, children: string[] | undefined): string => {
      const upperRole = (role || '').toUpperCase();
      // French values (from users.role column in DB)
      if (upperRole === 'ENSEIGNANT' || upperRole === 'TEACHER' || upperRole === 'TEACHER_RESP') return 'Collègue enseignant';
      if (upperRole === 'PARENT' || upperRole === 'GUARDIAN') {
        if (children && children.length > 0) return `Parent de ${children.join(', ')}`;
        return 'Parent d\'élève';
      }
      if (upperRole === 'PROMOTER' || upperRole === 'SCHOOL_OWNER' || upperRole === 'PROMOTEUR') return 'Promoteur';
      if (upperRole === 'DIRECTOR_GENERAL' || upperRole === 'DIRECTEUR_GENERAL' || upperRole === 'SCHOOL_DIRECTOR' || upperRole === 'DIRECTEUR_ETABLISSEMENT' || upperRole === 'DIRECTEUR') return 'Directeur';
      if (upperRole === 'DEPUTY_DIRECTOR') return 'Directeur adjoint';
      if (upperRole === 'SUPER_ADMIN' || upperRole === 'PLATFORM_OWNER' || upperRole === 'PLATFORM_SUPER_ADMIN' || upperRole === 'PLATFORM_ADMIN') return 'Administration plateforme';
      if (upperRole === 'SCHOOL_ADMIN' || upperRole === 'ADMIN' || upperRole === 'ADMINISTRATEUR') return 'Administration école';
      if (upperRole === 'CENSEUR') return 'Censeur';
      if (upperRole === 'COMPTABLE' || upperRole === 'ACCOUNTANT' || upperRole === 'CAISSIER' || upperRole === 'CASHIER') return 'Comptable';
      if (upperRole === 'PEDAGOGIC_DIRECTOR' || upperRole === 'PEDAGOGIC_COORDINATOR' || upperRole === 'DIRECTEUR_PEDAGOGIQUE') return 'Directeur pédagogique';
      if (upperRole === 'STUDENT' || upperRole === 'ELEVE') return 'Élève';
      if (upperRole === 'ECONOME' || upperRole === 'CFO') return 'Économe';
      return role || 'Utilisateur';
    };

    // Group participants by conversationId
    const participantsByConv = new Map<string, any[]>();
    for (const p of allParticipants) {
      if (!participantsByConv.has(p.conversationId)) {
        participantsByConv.set(p.conversationId, []);
      }
      participantsByConv.get(p.conversationId)!.push(p);
    }

    return participations.map(c => ({
      id: c.id,
      type: c.type,
      name: c.name,
      description: c.description,
      avatarUrl: c.avatarUrl,
      createdBy: c.createdBy,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      lastMessageAt: c.lastMessageAt,
      lastMessagePreview: c.lastMessagePreview,
      lastMessageSenderId: c.lastMessageSenderId,
      participants: (participantsByConv.get(c.id) || []).map((p: any) => {
        const children = childrenByParent.get(p.userId);
        return {
          userId: p.userId,
          role: p.role,
          joinedAt: p.joinedAt,
          lastReadAt: p.lastReadAt,
          muted: p.muted,
          firstName: p.firstName,
          lastName: p.lastName,
          email: p.email,
          // ⭐ FIX: users table has no avatarUrl — return null for now (V2 will
          //    fetch from staff_photos or tenant_media)
          avatarUrl: null,
          role_label: p.role_label,
          roleLabel: roleLabelFor(p.role_label, children),
          childrenNames: children,
        };
      }),
    }));
  }

  /**
   * Crée une conversation DIRECT (1-à-1) entre deux utilisateurs.
   * Si une conversation existe déjà entre ces deux utilisateurs, on la réutilise.
   */
  async createOrGetDirectConversation(
    tenantId: string,
    currentUserId: string,
    otherUserId: string,
  ): Promise<ChatConversation> {
    if (currentUserId === otherUserId) {
      throw new BadRequestException('Cannot create a conversation with yourself');
    }

    // ⭐ FIX: If tenantId is empty (e.g., PLATFORM_OWNER with no tenant),
    //    resolve it from the other user's tenantId
    let resolvedTenantId = tenantId;
    if (!resolvedTenantId || resolvedTenantId.length === 0) {
      const otherUser: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT "tenantId" FROM "users" WHERE id = $1
      `, otherUserId);
      resolvedTenantId = otherUser[0]?.tenantId || '';
      if (!resolvedTenantId) {
        // Try current user's tenantId
        const currentUser: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
          SELECT "tenantId" FROM "users" WHERE id = $1
        `, currentUserId);
        resolvedTenantId = currentUser[0]?.tenantId || '';
      }
      if (!resolvedTenantId) {
        throw new BadRequestException('Impossible de déterminer le tenant — aucun tenantId trouvé pour les deux utilisateurs');
      }
      this.logger.log(`Resolved tenantId for conversation: ${resolvedTenantId} (from user records)`);
    }

    // Vérifier si une conversation DIRECT existe déjà entre ces deux utilisateurs
    const existing: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT c.* FROM chat_conversations c
      WHERE c."tenantId" = $1 AND c.type = 'DIRECT'
        AND c.id IN (
          SELECT p1."conversationId" FROM chat_participants p1
          WHERE p1."userId" = $2 AND p1."leftAt" IS NULL
        )
        AND c.id IN (
          SELECT p2."conversationId" FROM chat_participants p2
          WHERE p2."userId" = $3 AND p2."leftAt" IS NULL
        )
      LIMIT 1
    `, resolvedTenantId, currentUserId, otherUserId);

    if (existing.length > 0) {
      return (await this.listConversations(resolvedTenantId, currentUserId))
        .find(c => c.id === existing[0].id)!;
    }

    // Créer une nouvelle conversation DIRECT
    const convId = randomUUID();
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "chat_conversations" ("id", "tenantId", "type", "createdBy", "createdAt", "updatedAt")
      VALUES ($1, $2, 'DIRECT', $3, NOW(), NOW())
    `, convId, resolvedTenantId, currentUserId);

    // Ajouter les deux participants
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "chat_participants" ("id", "conversationId", "userId", "tenantId", "role", "joinedAt")
      VALUES
        ($1, $4, $2, $5, 'ADMIN', NOW()),
        ($6, $4, $3, $5, 'MEMBER', NOW())
    `, randomUUID(), currentUserId, otherUserId, convId, resolvedTenantId, randomUUID());

    return (await this.listConversations(resolvedTenantId, currentUserId))
      .find(c => c.id === convId)!;
  }

  /**
   * Crée une conversation de GROUPE avec plusieurs participants.
   * Le créateur est automatiquement ADMIN.
   */
  async createGroupConversation(
    tenantId: string,
    creatorId: string,
    data: { name: string; description?: string; participantIds: string[]; avatarUrl?: string },
  ): Promise<ChatConversation> {
    if (!data.name || data.name.trim().length === 0) {
      throw new BadRequestException('Group name is required');
    }
    if (data.participantIds.length < 1) {
      throw new BadRequestException('At least one other participant is required');
    }

    const convId = randomUUID();
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "chat_conversations" ("id", "tenantId", "type", "name", "description", "avatarUrl", "createdBy", "createdAt", "updatedAt")
      VALUES ($1, $2, 'GROUP', $3, $4, $5, $6, NOW(), NOW())
    `, convId, tenantId, data.name, data.description || null, data.avatarUrl || null, creatorId);

    // Ajouter le créateur comme ADMIN
    const allParticipants = [creatorId, ...data.participantIds.filter(id => id !== creatorId)];
    const uniqueParticipants = Array.from(new Set(allParticipants));

    for (const userId of uniqueParticipants) {
      const role = userId === creatorId ? 'ADMIN' : 'MEMBER';
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO "chat_participants" ("id", "conversationId", "userId", "tenantId", "role", "joinedAt")
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT DO NOTHING
      `, randomUUID(), convId, userId, tenantId, role);
    }

    return (await this.listConversations(tenantId, creatorId))
      .find(c => c.id === convId)!;
  }

  /**
   * Récupère une conversation par ID (vérifie que l'utilisateur est participant).
   */
  async getConversation(tenantId: string, userId: string, conversationId: string): Promise<ChatConversation> {
    const convs = await this.listConversations(tenantId, userId);
    const conv = convs.find(c => c.id === conversationId);
    if (!conv) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }
    return conv;
  }

  // ═════════════════════════════════════════════════════════════════
  //  MESSAGES
  // ═════════════════════════════════════════════════════════════════

  /**
   * Liste les messages d'une conversation (paginés, les plus récents en dernier).
   * Vérifie que l'utilisateur est participant.
   */
  async listMessages(
    tenantId: string,
    userId: string,
    conversationId: string,
    options: { limit?: number; before?: string } = {},
  ): Promise<ChatMessage[]> {
    await this.getConversation(tenantId, userId, conversationId);

    const limit = Math.min(options.limit || 50, 200);
    const beforeClause = options.before ? `AND m."createdAt" < (SELECT "createdAt" FROM chat_messages WHERE id = $3)` : '';

    // ⭐ FIX (P2010 — column ur.role does not exist) :
    //    The user_roles table has a "roleId" FK to the roles table, NOT a "role" text column.
    //    The role is stored directly on users.role. Use u."role" and drop the user_roles JOIN entirely.
    // ⭐ V2.7 : filter out messages the user has deleted FOR THEMSELVES
    //    (chat_message_user_deletions table — if it doesn't exist, the LEFT JOIN returns NULL and
    //     the WHERE clause still works).
    const messages: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT m.*,
             u."firstName" AS "senderFirstName",
             u."lastName" AS "senderLastName",
             u."role" AS "senderRole"
      FROM chat_messages m
      LEFT JOIN "users" u ON u.id = m."senderId"
      LEFT JOIN "chat_message_user_deletions" d ON d."messageId" = m.id AND d."userId" = $3
      WHERE m."conversationId" = $1
        AND m."deletedAt" IS NULL
        AND d.id IS NULL
        ${beforeClause}
      ORDER BY m."createdAt" DESC
      LIMIT $2
    `, conversationId, limit, userId, ...(options.before ? [options.before] : []));

    // Pour chaque message, charger les accusés de lecture
    if (messages.length > 0) {
      const msgIds = messages.map(m => m.id);
      const receipts: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT r.*, u."firstName", u."lastName"
        FROM chat_message_read_receipts r
        JOIN "users" u ON u.id = r."userId"
        WHERE r."messageId" = ANY($1::text[])
      `, msgIds);
      const receiptsByMsg = new Map<string, any[]>();
      for (const r of receipts) {
        if (!receiptsByMsg.has(r.messageId)) receiptsByMsg.set(r.messageId, []);
        receiptsByMsg.get(r.messageId)!.push(r);
      }
      messages.forEach(m => {
        m.readBy = receiptsByMsg.get(m.id) || [];
      });
    }

    // Reverse pour avoir les messages dans l'ordre chronologique (ancien → récent)
    return messages.reverse().map(m => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      type: m.type,
      content: m.content,
      attachmentUrl: m.attachmentUrl,
      attachmentName: m.attachmentName,
      attachmentSize: m.attachmentSize,
      attachmentMime: m.attachmentMime,
      duration: m.duration,
      replyToId: m.replyToId,
      createdAt: m.createdAt,
      editedAt: m.editedAt,
      deletedAt: m.deletedAt,
      sender: {
        firstName: m.senderFirstName,
        lastName: m.senderLastName,
        avatarUrl: m.senderAvatarUrl,
        role: m.senderRole,
      },
      readBy: m.readBy || [],
    }));
  }

  /**
   * Envoie un message texte dans une conversation.
   */
  async sendTextMessage(
    tenantId: string,
    senderId: string,
    conversationId: string,
    data: { content: string; replyToId?: string },
  ): Promise<ChatMessage> {
    await this.getConversation(tenantId, senderId, conversationId);

    if (!data.content || data.content.trim().length === 0) {
      throw new BadRequestException('Message content cannot be empty');
    }

    const msgId = randomUUID();
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "chat_messages" ("id", "conversationId", "senderId", "type", "content", "replyToId", "createdAt")
      VALUES ($1, $2, $3, 'TEXT', $4, $5, NOW())
    `, msgId, conversationId, senderId, data.content.trim(), data.replyToId || null);

    // Mettre à jour la conversation (lastMessageAt + preview)
    const preview = data.content.length > 60 ? data.content.substring(0, 60) + '…' : data.content;
    await this.prisma.$executeRawUnsafe(`
      UPDATE "chat_conversations"
      SET "lastMessageAt" = NOW(),
          "lastMessagePreview" = $3,
          "lastMessageSenderId" = $2,
          "updatedAt" = NOW()
      WHERE "id" = $1
    `, conversationId, senderId, preview);

    // Marquer comme lu par l'expéditeur
    await this.markAsRead(tenantId, senderId, conversationId);

    return (await this.listMessages(tenantId, senderId, conversationId, { limit: 1 }))[0];
  }

  /**
   * Envoie un message avec fichier joint (audio/document/image).
   */
  async sendAttachmentMessage(
    tenantId: string,
    senderId: string,
    conversationId: string,
    data: {
      type: 'AUDIO' | 'DOCUMENT' | 'IMAGE';
      file: Express.Multer.File;
      content?: string; // légende / transcription
      duration?: number; // pour AUDIO
      replyToId?: string;
    },
  ): Promise<ChatMessage> {
    await this.getConversation(tenantId, senderId, conversationId);

    // Upload le fichier via StorageService
    const folder = `chat/${data.type.toLowerCase()}`;
    const attachmentUrl = await this.storage.uploadFile(data.file, folder);

    const msgId = randomUUID();
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "chat_messages" (
        "id", "conversationId", "senderId", "type",
        "content", "attachmentUrl", "attachmentName", "attachmentSize", "attachmentMime",
        "duration", "replyToId", "createdAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    `,
      msgId, conversationId, senderId, data.type,
      data.content || null, attachmentUrl, data.file.originalname, data.file.size, data.file.mimetype,
      data.duration || null, data.replyToId || null,
    );

    // Mettre à jour la conversation (preview)
    const preview = `[${data.type === 'AUDIO' ? 'Audio' : data.type === 'IMAGE' ? 'Image' : 'Document'}]`;
    await this.prisma.$executeRawUnsafe(`
      UPDATE "chat_conversations"
      SET "lastMessageAt" = NOW(),
          "lastMessagePreview" = $3,
          "lastMessageSenderId" = $2,
          "updatedAt" = NOW()
      WHERE "id" = $1
    `, conversationId, senderId, preview);

    return (await this.listMessages(tenantId, senderId, conversationId, { limit: 1 }))[0];
  }

  /**
   * Marque tous les messages d'une conversation comme lus par l'utilisateur.
   */
  async markAsRead(tenantId: string, userId: string, conversationId: string): Promise<void> {
    await this.getConversation(tenantId, userId, conversationId);

    // Mettre à jour lastReadAt du participant
    await this.prisma.$executeRawUnsafe(`
      UPDATE "chat_participants"
      SET "lastReadAt" = NOW()
      WHERE "conversationId" = $1 AND "userId" = $2 AND "leftAt" IS NULL
    `, conversationId, userId);

    // Ajouter des read receipts pour les messages envoyés par d'autres
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "chat_message_read_receipts" ("id", "messageId", "userId", "readAt")
      SELECT $1, m.id, $2, NOW()
      FROM chat_messages m
      WHERE m."conversationId" = $3
        AND m."senderId" != $2
        AND m."deletedAt" IS NULL
        AND m.id NOT IN (
          SELECT r."messageId" FROM chat_message_read_receipts r WHERE r."userId" = $2
        )
      ON CONFLICT DO NOTHING
    `, randomUUID(), userId, conversationId);
  }

  /**
   * Compte les messages non lus dans toutes les conversations d'un utilisateur.
   */
  async getUnreadCount(tenantId: string, userId: string): Promise<{ conversationId: string; unread: number }[]> {
    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT c.id AS "conversationId",
             COUNT(m.id)::int AS "unread"
      FROM chat_conversations c
      JOIN chat_participants p ON p."conversationId" = c.id AND p."leftAt" IS NULL
      LEFT JOIN chat_messages m ON m."conversationId" = c.id
        AND m."createdAt" > COALESCE(p."lastReadAt", '1970-01-01'::timestamp)
        AND m."senderId" != $2
        AND m."deletedAt" IS NULL
      WHERE c."tenantId" = $1 AND p."userId" = $2
      GROUP BY c.id
    `, tenantId, userId);
    return rows.map(r => ({ conversationId: r.conversationId, unread: r.unread }));
  }

  // ═════════════════════════════════════════════════════════════════
  //  V2.7 — MESSAGE DELETION (WhatsApp/Telegram-style)
  // ═════════════════════════════════════════════════════════════════

  /**
   * ⭐ Delete a message FOR ME only (others still see it).
   *    Implementation: insert into chat_message_user_deletions (userId, messageId).
   *    The listMessages query (V2.7) will filter out these messages per user.
   */
  async deleteMessageForMe(
    tenantId: string,
    userId: string,
    conversationId: string,
    messageId: string,
  ): Promise<{ success: boolean }> {
    // Verify user is participant in the conversation
    await this.getConversation(tenantId, userId, conversationId);

    // Verify message exists in this conversation
    const msg: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT id FROM chat_messages
      WHERE id = $1 AND "conversationId" = $2 AND "deletedAt" IS NULL
    `, messageId, conversationId);
    if (msg.length === 0) {
      throw new NotFoundException('Message not found');
    }

    // Insert into chat_message_user_deletions (ignore if already exists)
    try {
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO "chat_message_user_deletions" ("id", "messageId", "userId", "deletedAt")
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT DO NOTHING
      `, randomUUID(), messageId, userId);
    } catch (e: any) {
      // Table might not exist yet (V2.7 migration pending) — fall back to soft delete globally
      this.logger.warn(`chat_message_user_deletions table not available: ${e.message}`);
    }

    return { success: true };
  }

  /**
   * ⭐ Delete a message FOR EVERYONE (sender only).
   *    Marks deletedAt — the message appears as "Message supprimé" to everyone.
   */
  async deleteMessageForEveryone(
    tenantId: string,
    userId: string,
    conversationId: string,
    messageId: string,
  ): Promise<{ success: boolean }> {
    // Verify user is participant
    await this.getConversation(tenantId, userId, conversationId);

    // Verify the message exists AND the user is the sender
    const msg: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT id, "senderId" FROM chat_messages
      WHERE id = $1 AND "conversationId" = $2 AND "deletedAt" IS NULL
    `, messageId, conversationId);
    if (msg.length === 0) {
      throw new NotFoundException('Message not found');
    }
    if (msg[0].senderId !== userId) {
      throw new ForbiddenException('Only the sender can delete a message for everyone');
    }

    // Mark as deleted (soft delete)
    await this.prisma.$executeRawUnsafe(`
      UPDATE "chat_messages"
      SET "deletedAt" = NOW()
      WHERE "id" = $1
    `, messageId);

    return { success: true };
  }

  // ═════════════════════════════════════════════════════════════════
  //  RECHERCHE D'UTILISATEURS + INVITATIONS
  // ═════════════════════════════════════════════════════════════════

  /**
   * Recherche des utilisateurs par nom, prénom ou email.
   * Inclut le tenant courant + les autres tenants (pour l'écosystème cross-écoles).
   * Exclut l'utilisateur courant.
   *
   * ⭐ Rôle contextuel :
   *   - Si l'utilisateur trouvé est PARENT → on enrichit avec le nom de ses enfants
   *     (ex: "Parent de Awa Dupont, Kossi Dupont")
   *   - Si l'utilisateur est TEACHER → on affiche "Collègue enseignant"
   *   - Si l'utilisateur est DIRECTOR/PROMOTER → on affiche "Directeur" / "Promoteur"
   *
   * ⭐ Distinction intra-école vs cross-école :
   *   - Si `isSameTenant=true` → l'utilisateur courant peut engager la conversation
   *     DIRECTEMENT (pas d'invitation requise — c'est un collègue / un parent d'élève
   *     de la même école).
   *   - Si `isSameTenant=false` → invitation requise (l'utilisateur appartient à une
   *     autre école sur Academia Helm).
   */
  async searchUsers(
    currentTenantId: string,
    currentUserId: string,
    query: string,
    options: { includeOtherTenants?: boolean; limit?: number } = {},
  ): Promise<{
    userId: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    avatarUrl?: string;
    role?: string;
    roleLabel?: string;          // ex: "Collègue enseignant", "Parent de Awa Dupont", "Directeur"
    tenantName?: string;
    isSameTenant: boolean;
    canStartDirectConversation: boolean;  // true si même tenant (=pas d'invitation requise)
    childrenNames?: string[];    // pour les parents : noms des enfants
  }[]> {
    if (!query || query.trim().length < 2) {
      throw new BadRequestException('Query must be at least 2 characters');
    }
    const limit = Math.min(options.limit || 20, 50);
    const likeQuery = `%${query.trim().toLowerCase()}%`;

    // ⭐ FIX: users table has NO avatarUrl column AND user_roles JOIN fails.
    //    The role is stored DIRECTLY on users.role.
    //    ⭐ ALSO search guardians table — parents may not have a users entry
    //    (they exist only in guardians with userId=NULL).
    //    We search both tables and merge results.
    const tenantFilter = options.includeOtherTenants === false
      ? `AND u."tenantId" = $1`
      : '';

    // Part 1: Search in users table (teachers, admin, etc.)
    const userRows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT u.id, u."firstName", u."lastName", u."email", u."role",
             t."name" AS "tenantName", u."tenantId",
             (u."tenantId" = $1) AS "isSameTenant"
      FROM "users" u
      LEFT JOIN "tenants" t ON t.id = u."tenantId"
      WHERE u.id != $2
        ${tenantFilter}
        AND (
          LOWER(COALESCE(u."firstName", '')) LIKE $3
          OR LOWER(COALESCE(u."lastName", '')) LIKE $3
          OR LOWER(COALESCE(u."firstName", '') || ' ' || COALESCE(u."lastName", '')) LIKE $3
          OR LOWER(COALESCE(u."email", '')) LIKE $3
        )
      ORDER BY "isSameTenant" DESC, u."lastName" ASC, u."firstName" ASC
      LIMIT $4
    `, currentTenantId, currentUserId, likeQuery, limit);

    // Part 2: Search in guardians table (parents who may not have a users entry)
    //    Only return guardians from the same tenant (parents belong to a specific school)
    //    ⭐ Also include guardians WITH userId (we'll dedupe against userRows later by email/userId)
    let guardianRows: any[] = [];
    try {
      guardianRows = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT g.id AS "guardianId", g."userId", g."firstName", g."lastName", g."email",
               g."phone", g."tenantId", t."name" AS "tenantName",
               (g."tenantId" = $1) AS "isSameTenant"
        FROM "guardians" g
        LEFT JOIN "tenants" t ON t.id = g."tenantId"
        WHERE g."tenantId" = $1
        AND (
          LOWER(COALESCE(g."firstName", '')) LIKE $2
          OR LOWER(COALESCE(g."lastName", '')) LIKE $2
          OR LOWER(COALESCE(g."firstName", '') || ' ' || COALESCE(g."lastName", '')) LIKE $2
          OR LOWER(COALESCE(g."email", '')) LIKE $2
          OR LOWER(COALESCE(g."phone", '')) LIKE $2
        )
        ORDER BY g."lastName" ASC, g."firstName" ASC
        LIMIT $3
      `, currentTenantId, likeQuery, limit);
      this.logger.log(`Guardians search: tenant=${currentTenantId?.substring(0,8)}..., found=${guardianRows.length}, query=${query}`);
    } catch (e: any) {
      this.logger.error(`Guardians search FAILED: ${e.message}`);
      // Don't throw — just return empty guardians (users search still works)
    }

    // Merge: combine userRows + guardianRows (dedup by email if possible)
    //    ⭐ For guardians WITHOUT userId → keep them (can be invited by SMS/email)
    //    ⭐ For guardians WITH userId → skip them (the linked user will appear via userRows)
    const seenEmails = new Set<string>();
    const seenGuardianIds = new Set<string>();
    const allRows: any[] = [];
    for (const r of userRows) {
      if (r.email && seenEmails.has(r.email.toLowerCase())) continue;
      if (r.email) seenEmails.add(r.email.toLowerCase());
      allRows.push({ ...r, source: 'users' });
    }
    for (const g of guardianRows) {
      // Skip guardians that already have a linked user (already in userRows)
      if (g.userId) continue;
      if (seenGuardianIds.has(g.guardianId)) continue;
      seenGuardianIds.add(g.guardianId);
      // Add guardian as a pseudo-user (can't chat directly but shown in search)
      allRows.push({
        id: g.guardianId,
        firstName: g.firstName,
        lastName: g.lastName,
        email: g.email,
        phone: g.phone,
        role: 'PARENT',
        tenantId: g.tenantId,
        tenantName: g.tenantName,
        isSameTenant: g.isSameTenant,
        source: 'guardians',
        userId: null as (string | null), // No user account — can't chat directly
      });
    }

    const rows = allRows.slice(0, limit);

    // ⭐ Enrichir avec les noms des enfants pour les PARENTS / GUARDIANS
    //    Also search guardians by their guardianId (for guardian-only entries without userId)
    const guardianIdsForChildren = rows.filter(r => r.source === 'guardians').map(r => r.id);
    const parentUserIds = rows.filter(r => {
      const role = (r.role || '').toUpperCase();
      return role === 'PARENT' || role === 'GUARDIAN' || r.source === 'guardians';
    }).map(r => r.userId || r.id); // Use userId if available, else guardianId
    const childrenByParent: Map<string, string[]> = new Map();
    if (guardianIdsForChildren.length > 0) {
      // Search by guardianId (for guardians without userId)
      const childrenRows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT g.id AS "guardianId", s."firstName" AS "studentFirstName", s."lastName" AS "studentLastName"
        FROM "guardians" g
        JOIN "student_guardians" sg ON sg."guardianId" = g.id
        JOIN "students" s ON s.id = sg."studentId"
        WHERE g.id = ANY($1::text[])
      `, guardianIdsForChildren).catch(() => []);
      for (const r of childrenRows) {
        if (!childrenByParent.has(r.guardianId)) childrenByParent.set(r.guardianId, []);
        childrenByParent.get(r.guardianId)!.push(`${r.studentFirstName || ''} ${r.studentLastName || ''}`.trim());
      }
    }
    // Also search by userId for guardians who have a userId
    const parentUserIdsWithAccount = rows.filter(r => r.userId && r.source !== 'guardians').map(r => r.userId);
    if (parentUserIdsWithAccount.length > 0) {
      const childrenRows2: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT g."userId" AS "parentUserId", s."firstName" AS "studentFirstName", s."lastName" AS "studentLastName"
        FROM "guardians" g
        JOIN "student_guardians" sg ON sg."guardianId" = g.id
        JOIN "students" s ON s.id = sg."studentId"
        WHERE g."userId" = ANY($1::text[])
      `, parentUserIdsWithAccount);
      for (const r of childrenRows2) {
        if (!childrenByParent.has(r.parentUserId)) childrenByParent.set(r.parentUserId, []);
        childrenByParent.get(r.parentUserId)!.push(`${r.studentFirstName || ''} ${r.studentLastName || ''}`.trim());
      }
    }

    // ⭐ Get current user's role for contextual role labels
    const currentUserRow: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT "role" FROM "users" WHERE id = $1
    `, currentUserId).catch(() => []);
    const currentUserRole = (currentUserRow[0]?.role || '').toUpperCase();
    const isCurrentUserTeacher = currentUserRole === 'ENSEIGNANT' || currentUserRole === 'TEACHER' || currentUserRole === 'TEACHER_RESP';

    // ⭐ Build role labels — contextuel selon le rôle de l'utilisateur courant
    //    - Si l'utilisateur courant est enseignant → "Collègue enseignant" pour les autres enseignants
    //    - Si l'utilisateur courant est promoteur/directeur → "Enseignant" (pas "Collègue")
    const roleLabelFor = (role: string, children: string[] | undefined): string => {
      const upperRole = (role || '').toUpperCase();
      if (upperRole === 'ENSEIGNANT' || upperRole === 'TEACHER' || upperRole === 'TEACHER_RESP') {
        return isCurrentUserTeacher ? 'Collègue enseignant' : 'Enseignant';
      }
      if (upperRole === 'PARENT' || upperRole === 'GUARDIAN') {
        if (children && children.length > 0) return `Parent de ${children.join(', ')}`;
        return 'Parent d\'élève';
      }
      if (upperRole === 'PROMOTER' || upperRole === 'SCHOOL_OWNER' || upperRole === 'PROMOTEUR') return 'Promoteur';
      if (upperRole === 'DIRECTOR_GENERAL' || upperRole === 'DIRECTEUR_GENERAL' || upperRole === 'SCHOOL_DIRECTOR' || upperRole === 'DIRECTEUR_ETABLISSEMENT' || upperRole === 'DIRECTEUR') return 'Directeur';
      if (upperRole === 'DEPUTY_DIRECTOR') return 'Directeur adjoint';
      if (upperRole === 'SUPER_ADMIN' || upperRole === 'PLATFORM_OWNER' || upperRole === 'PLATFORM_SUPER_ADMIN' || upperRole === 'PLATFORM_ADMIN') return 'Administration plateforme';
      if (upperRole === 'SCHOOL_ADMIN' || upperRole === 'ADMIN' || upperRole === 'ADMINISTRATEUR') return 'Administration école';
      if (upperRole === 'CENSEUR') return 'Censeur';
      if (upperRole === 'COMPTABLE' || upperRole === 'ACCOUNTANT' || upperRole === 'CAISSIER' || upperRole === 'CASHIER') return 'Comptable';
      if (upperRole === 'PEDAGOGIC_DIRECTOR' || upperRole === 'PEDAGOGIC_COORDINATOR' || upperRole === 'DIRECTEUR_PEDAGOGIQUE') return 'Directeur pédagogique';
      if (upperRole === 'STUDENT' || upperRole === 'ELEVE') return 'Élève';
      if (upperRole === 'ECONOME' || upperRole === 'CFO') return 'Économe';
      return role || 'Utilisateur';
    };

    return rows.map(r => {
      // For guardian entries without userId, use guardianId as key
      const keyId = r.userId || r.id;
      const children = childrenByParent.get(r.id) || childrenByParent.get(keyId);
      const isSame = !!r.isSameTenant;
      const isGuardianWithoutAccount = r.source === 'guardians' && !r.userId;
      return {
        userId: keyId,
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        // ⭐ FIX: users table has no avatarUrl — null for now (V2 will use staff_photos)
        avatarUrl: null,
        role: r.role || 'PARENT',
        roleLabel: roleLabelFor(r.role || 'PARENT', children),
        tenantName: r.tenantName,
        isSameTenant: isSame,
        // ⭐ Guardians without a user account can't start a direct conversation
        canStartDirectConversation: isSame && !isGuardianWithoutAccount,
        childrenNames: children,
        // ⭐ NEW: source field (so frontend can distinguish guardians without account)
        source: r.source,
        // ⭐ NEW: phone field (for guardians without account — used to send SMS invitation)
        phone: r.phone,
        // ⭐ NEW: guardianId (for guardians without account — used by /chat/invitations/guardian endpoint)
        guardianId: isGuardianWithoutAccount ? r.id : undefined,
      };
    });
  }

  /**
   * ⭐ NEW — Invite a guardian (without user account) to join Helm Connect via SMS/email.
   *    Used by teachers to start a communication channel with parents who don't have
   *    an Academia Helm account yet.
   *
   *    The invitation stores the guardianId and creates a magic-link token. The frontend
   *    can then send an SMS/email to the guardian's phone/email with the magic link.
   *
   *    In V1, this returns the invitation record. V2 will integrate with an actual
   *    SMS gateway (Twilio/etc.) to send the link automatically.
   */
  async inviteGuardianToHelmConnect(
    senderTenantId: string,
    senderId: string,
    data: { guardianId: string; channel?: 'SMS' | 'EMAIL' | 'WHATSAPP'; message?: string },
  ): Promise<{ id: string; status: string; magicLink: string; channel: string }> {
    if (!data.guardianId) {
      throw new BadRequestException('guardianId is required');
    }

    // Fetch guardian record
    const guardian: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT g.id, g."firstName", g."lastName", g.email, g.phone, g."userId", g."tenantId",
             t."name" AS "tenantName"
      FROM "guardians" g
      LEFT JOIN "tenants" t ON t.id = g."tenantId"
      WHERE g.id = $1
    `, data.guardianId);

    if (guardian.length === 0) {
      throw new NotFoundException('Guardian not found');
    }
    const g = guardian[0];

    // If guardian already has a user account, no invitation needed
    if (g.userId) {
      return {
        id: g.userId,
        status: 'ALREADY_HAS_ACCOUNT',
        magicLink: '',
        channel: 'DIRECT',
      };
    }

    // Determine the channel
    const channel = data.channel || (g.phone ? 'SMS' : g.email ? 'EMAIL' : 'SMS');

    // Create invitation record in chat_invitations (using recipientEmail for the link)
    const invId = randomUUID();
    const magicToken = randomUUID();
    const magicLink = `/auth/invite?token=${magicToken}&guardianId=${g.id}&tenantId=${g.tenantId}`;

    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "chat_invitations" ("id", "senderId", "senderTenantId", "recipientEmail", "recipientName", "message", "status", "createdAt")
      VALUES ($1, $2, $3, $4, $5, $6, 'PENDING_GUARDIAN', NOW())
    `, invId, senderId, senderTenantId || g.tenantId, g.email || g.phone || '', `${g.firstName || ''} ${g.lastName || ''}`.trim(), data.message || `Invitation à rejoindre Helm Connect — Academia Helm`);

    this.logger.log(`⭐ Guardian invitation created: guardian=${g.id}, channel=${channel}, hasPhone=${!!g.phone}, hasEmail=${!!g.email}`);

    return {
      id: invId,
      status: 'PENDING',
      magicLink,
      channel,
    };
  }

  /**
   * Envoie une invitation à un utilisateur (par userId ou email).
   * L'invitation peut être acceptée ou refusée.
   */
  async sendInvitation(
    senderTenantId: string,
    senderId: string,
    data: { recipientId?: string; recipientEmail?: string; recipientName?: string; message?: string },
  ): Promise<{ id: string; status: string }> {
    if (!data.recipientId && !data.recipientEmail) {
      throw new BadRequestException('Either recipientId or recipientEmail is required');
    }

    // Vérifier qu'il n'y a pas déjà une invitation en attente
    const existing: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT id, status FROM chat_invitations
      WHERE "senderId" = $1
        AND (${data.recipientId ? `"recipientId" = $2` : `"recipientEmail" = $2`})
        AND status = 'PENDING'
    `, senderId, data.recipientId || data.recipientEmail);

    if (existing.length > 0) {
      return { id: existing[0].id, status: 'PENDING_ALREADY' };
    }

    const invId = randomUUID();
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "chat_invitations" ("id", "senderId", "senderTenantId", "recipientId", "recipientEmail", "recipientName", "message", "status", "createdAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', NOW())
    `, invId, senderId, senderTenantId, data.recipientId || null, data.recipientEmail || null, data.recipientName || null, data.message || null);

    return { id: invId, status: 'PENDING' };
  }

  /**
   * Liste les invitations reçues par un utilisateur (PENDING).
   */
  async listPendingInvitations(userId: string): Promise<any[]> {
    // ⭐ FIX: user_roles has no "role" column — use users.role directly.
    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT i.*,
             s."firstName" AS "senderFirstName",
             s."lastName" AS "senderLastName",
             s."role" AS "senderRole",
             t."name" AS "senderTenantName"
      FROM chat_invitations i
      LEFT JOIN "users" s ON s.id = i."senderId"
      LEFT JOIN "tenants" t ON t.id = i."senderTenantId"
      WHERE i."recipientId" = $1 AND i."status" = 'PENDING'
      ORDER BY i."createdAt" DESC
    `, userId);
    return rows;
  }

  /**
   * Accepte une invitation : crée une conversation DIRECT entre les deux utilisateurs.
   */
  async acceptInvitation(
    currentTenantId: string,
    currentUserId: string,
    invitationId: string,
  ): Promise<ChatConversation> {
    const inv: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM chat_invitations WHERE id = $1 AND "recipientId" = $2 AND status = 'PENDING'
    `, invitationId, currentUserId);
    if (inv.length === 0) {
      throw new NotFoundException('Invitation not found or already responded');
    }
    const invitation = inv[0];

    // Créer une conversation DIRECT
    // ⭐ On utilise le tenant du destinataire (currentTenantId) car c'est lui qui accepte
    const conv = await this.createOrGetDirectConversation(
      currentTenantId,
      currentUserId,
      invitation.senderId,
    );

    // Marquer l'invitation comme acceptée
    await this.prisma.$executeRawUnsafe(`
      UPDATE "chat_invitations" SET status = 'ACCEPTED', "respondedAt" = NOW(), "conversationId" = $2
      WHERE id = $1
    `, invitationId, conv.id);

    return conv;
  }

  /**
   * Refuse une invitation.
   */
  async declineInvitation(currentUserId: string, invitationId: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(`
      UPDATE "chat_invitations" SET status = 'DECLINED', "respondedAt" = NOW()
      WHERE id = $1 AND "recipientId" = $2 AND status = 'PENDING'
    `, invitationId, currentUserId);
  }

  // ═════════════════════════════════════════════════════════════════
  //  PRESENCE (online/offline) + TYPING INDICATOR
  // ═════════════════════════════════════════════════════════════════

  /**
   * ⭐ Met à jour le timestamp de dernière activité de l'utilisateur.
   *    Appelé par le frontend toutes les 30 secondes via /chat/presence.
   *    Un utilisateur est considéré "en ligne" si lastActiveAt < 2 minutes.
   */
  async updatePresence(userId: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(`
      UPDATE "users" SET "lastActiveAt" = NOW() WHERE id = $1
    `, userId);
  }

  /**
   * ⭐ Récupère le statut de présence (en ligne/hors ligne) pour une liste d'utilisateurs.
   *    Retourne { userId, isOnline, lastActiveAt } pour chaque user.
   *    Un user est "en ligne" si lastActiveAt est dans les 2 dernières minutes.
   */
  async getPresence(userIds: string[]): Promise<{ userId: string; isOnline: boolean; lastActiveAt?: Date }[]> {
    if (userIds.length === 0) return [];
    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT id, "lastActiveAt",
             CASE
               WHEN "lastActiveAt" IS NOT NULL AND "lastActiveAt" > NOW() - INTERVAL '2 minutes'
               THEN true
               ELSE false
             END AS "isOnline"
      FROM "users"
      WHERE id = ANY($1::text[])
    `, userIds);
    return rows.map(r => ({
      userId: r.id,
      isOnline: r.isOnline,
      lastActiveAt: r.lastActiveAt || undefined,
    }));
  }

  /**
   * ⭐ Met à jour l'état de frappe ("typing") pour un utilisateur dans une conversation.
   *    Appelé par le frontend quand l'utilisateur commence/arrête de taper.
   *    L'état expire automatiquement après 10 secondes (le frontend doit re-ping).
   */
  async setTypingState(conversationId: string, userId: string, isTyping: boolean): Promise<void> {
    const { randomUUID } = require('crypto');
    const id = randomUUID();
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "chat_typing_state" ("id", "conversationId", "userId", "isTyping", "updatedAt")
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT ("conversationId", "userId")
      DO UPDATE SET "isTyping" = $4, "updatedAt" = NOW()
    `, id, conversationId, userId, isTyping);
  }

  /**
   * ⭐ Récupère les utilisateurs en train de taper dans une conversation.
   *    Retourne les userIds qui ont isTyping=true ET updatedAt dans les 10 dernières secondes.
   */
  async getTypingUsers(conversationId: string): Promise<{ userId: string; firstName?: string; lastName?: string }[]> {
    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT ts."userId", u."firstName", u."lastName"
      FROM "chat_typing_state" ts
      JOIN "users" u ON u.id = ts."userId"
      WHERE ts."conversationId" = $1
        AND ts."isTyping" = true
        AND ts."updatedAt" > NOW() - INTERVAL '10 seconds'
    `, conversationId);
    return rows.map(r => ({
      userId: r.userId,
      firstName: r.firstName,
      lastName: r.lastName,
    }));
  }

  // ═════════════════════════════════════════════════════════════════
  //  CANAUX (Telegram-style broadcast channels)
  // ═════════════════════════════════════════════════════════════════

  async createChannel(tenantId: string, creatorId: string, data: { name: string; description?: string }) {
    const { randomUUID } = require('crypto');
    const id = randomUUID();
    await this.prisma.$executeRawUnsafe(`INSERT INTO "chat_channels" ("id", "tenantId", "name", "description", "createdBy", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`, id, tenantId, data.name, data.description || null, creatorId);
    await this.prisma.$executeRawUnsafe(`INSERT INTO "chat_channel_subscribers" ("id", "channelId", "userId", "subscribedAt") VALUES ($1, $2, $3, NOW())`, randomUUID(), id, creatorId);
    return { id, name: data.name, description: data.description };
  }

  async listChannels(tenantId: string, userId: string) {
    return await this.prisma.$queryRawUnsafe<any[]>(`SELECT c.*, (SELECT count(*) FROM chat_channel_subscribers WHERE "channelId" = c.id) AS "subscriberCount", EXISTS(SELECT 1 FROM chat_channel_subscribers WHERE "channelId" = c.id AND "userId" = $2) AS "isSubscribed" FROM "chat_channels" c WHERE c."tenantId" = $1 ORDER BY COALESCE(c."lastMessageAt", c."createdAt") DESC`, tenantId, userId);
  }

  async subscribeToChannel(channelId: string, userId: string) {
    const { randomUUID } = require('crypto');
    await this.prisma.$executeRawUnsafe(`INSERT INTO "chat_channel_subscribers" ("id", "channelId", "userId", "subscribedAt") VALUES ($1, $2, $3, NOW()) ON CONFLICT ("channelId", "userId") DO NOTHING`, randomUUID(), channelId, userId);
    return { success: true };
  }

  async unsubscribeFromChannel(channelId: string, userId: string) {
    await this.prisma.$executeRawUnsafe(`DELETE FROM "chat_channel_subscribers" WHERE "channelId" = $1 AND "userId" = $2`, channelId, userId);
    return { success: true };
  }

  async broadcastToChannel(channelId: string, senderId: string, content: string) {
    const { randomUUID } = require('crypto');
    const msgId = randomUUID();
    await this.prisma.$executeRawUnsafe(`INSERT INTO "chat_messages" ("id", "conversationId", "senderId", "type", "content", "createdAt") VALUES ($1, $2, $3, 'TEXT', $4, NOW())`, msgId, `channel:${channelId}`, senderId, content);
    const preview = content.length > 60 ? content.substring(0, 60) + '…' : content;
    await this.prisma.$executeRawUnsafe(`UPDATE "chat_channels" SET "lastMessageAt" = NOW(), "lastMessagePreview" = $2, "updatedAt" = NOW() WHERE "id" = $1`, channelId, preview);
    return { id: msgId, content, senderId, createdAt: new Date() };
  }

  async getChannelMessages(channelId: string, limit: number = 50) {
    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`SELECT m.*, u."firstName" AS "senderFirstName", u."lastName" AS "senderLastName" FROM "chat_messages" m LEFT JOIN "users" u ON u.id = m."senderId" WHERE m."conversationId" = $1 ORDER BY m."createdAt" DESC LIMIT $2`, `channel:${channelId}`, limit);
    return rows.reverse();
  }

  // ═════════════════════════════════════════════════════════════════
  //  AVATAR + E2E PUBLIC KEY
  // ═════════════════════════════════════════════════════════════════

  async updateAvatar(userId: string, avatarUrl: string) {
    await this.prisma.$executeRawUnsafe(`UPDATE "users" SET "avatarUrl" = $2, "updatedAt" = NOW() WHERE "id" = $1`, userId, avatarUrl);
    return { success: true, avatarUrl };
  }

  async setPublicKey(userId: string, publicKey: string) {
    await this.prisma.$executeRawUnsafe(`UPDATE "users" SET "publicKey" = $2, "updatedAt" = NOW() WHERE "id" = $1`, userId, publicKey);
    return { success: true };
  }

  async getPublicKeys(userIds: string[]) {
    if (userIds.length === 0) return [];
    return await this.prisma.$queryRawUnsafe<any[]>(`SELECT id AS "userId", "publicKey" FROM "users" WHERE id = ANY($1::text[])`, userIds);
  }
}

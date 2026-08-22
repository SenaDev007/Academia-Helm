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
    const participations: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT c.*,
             (SELECT row_to_json(p) FROM chat_participants p
              WHERE p."conversationId" = c.id AND p."leftAt" IS NULL) AS "participantMeta",
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
    `, tenantId, currentUserId, otherUserId);

    if (existing.length > 0) {
      return (await this.listConversations(tenantId, currentUserId))
        .find(c => c.id === existing[0].id)!;
    }

    // Créer une nouvelle conversation DIRECT
    const convId = randomUUID();
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "chat_conversations" ("id", "tenantId", "type", "createdBy", "createdAt", "updatedAt")
      VALUES ($1, $2, 'DIRECT', $3, NOW(), NOW())
    `, convId, tenantId, currentUserId);

    // Ajouter les deux participants
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "chat_participants" ("id", "conversationId", "userId", "tenantId", "role", "joinedAt")
      VALUES
        ($1, $4, $2, $5, 'ADMIN', NOW()),
        ($6, $4, $3, $5, 'MEMBER', NOW())
    `, randomUUID(), currentUserId, otherUserId, convId, tenantId, randomUUID());

    return (await this.listConversations(tenantId, currentUserId))
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
    const beforeClause = options.before ? `AND m."createdAt" < (SELECT "createdAt" FROM chat_messages WHERE id = $4)` : '';

    const messages: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT m.*,
             u."firstName" AS "senderFirstName",
             u."lastName" AS "senderLastName",
             u."avatarUrl" AS "senderAvatarUrl",
             ur."role" AS "senderRole"
      FROM chat_messages m
      LEFT JOIN "users" u ON u.id = m."senderId"
      LEFT JOIN "user_roles" ur ON ur."userId" = m."senderId"
      WHERE m."conversationId" = $1
        AND m."deletedAt" IS NULL
        ${beforeClause}
      ORDER BY m."createdAt" DESC
      LIMIT $2
      ${options.before ? 'OFFSET 0' : ''}
    `, conversationId, limit, ...(options.before ? [options.before] : []));

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

    // ⭐ FIX: users table has NO avatarUrl column AND user_roles JOIN fails (user_roles
    //    has roleId FK to roles table, not a "role" text column). The role is stored
    //    DIRECTLY on users.role. So we skip the user_roles JOIN entirely and use u."role".
    const tenantFilter = options.includeOtherTenants === false
      ? `AND u."tenantId" = $1`
      : '';

    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT u.id, u."firstName", u."lastName", u."email", u."role",
             t."name" AS "tenantName", u."tenantId",
             (u."tenantId" = $1) AS "isSameTenant"
      FROM "users" u
      LEFT JOIN "tenants" t ON t.id = u."tenantId"
      WHERE u.id != $2
        ${tenantFilter}
        AND (
          LOWER(u."firstName") LIKE $3
          OR LOWER(u."lastName") LIKE $3
          OR LOWER(CONCAT(u."firstName", ' ', u."lastName")) LIKE $3
          OR LOWER(u."email") LIKE $3
        )
      ORDER BY "isSameTenant" DESC, u."lastName" ASC, u."firstName" ASC
      LIMIT $4
    `, currentTenantId, currentUserId, likeQuery, limit);

    // ⭐ Enrichir avec les noms des enfants pour les PARENTS / GUARDIANS
    //    guardians.userId → student_guardians.guardianId → students
    const parentUserIds = rows.filter(r => {
      const role = (r.role || '').toUpperCase();
      return role === 'PARENT' || role === 'GUARDIAN';
    }).map(r => r.id);
    const childrenByParent: Map<string, string[]> = new Map();
    if (parentUserIds.length > 0) {
      const childrenRows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT g."userId" AS "parentUserId", s."firstName" AS "studentFirstName", s."lastName" AS "studentLastName"
        FROM "guardians" g
        JOIN "student_guardians" sg ON sg."guardianId" = g.id
        JOIN "students" s ON s.id = sg."studentId"
        WHERE g."userId" = ANY($1::text[])
      `, parentUserIds);
      for (const r of childrenRows) {
        if (!childrenByParent.has(r.parentUserId)) childrenByParent.set(r.parentUserId, []);
        childrenByParent.get(r.parentUserId)!.push(`${r.studentFirstName || ''} ${r.studentLastName || ''}`.trim());
      }
    }

    // ⭐ Build role labels — handles French values (ENSEIGNANT, COMPTABLE, DIRECTEUR, etc.)
    const roleLabelFor = (role: string, children: string[] | undefined): string => {
      const upperRole = (role || '').toUpperCase();
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

    return rows.map(r => {
      const children = childrenByParent.get(r.id);
      const isSame = !!r.isSameTenant;
      return {
        userId: r.id,
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        // ⭐ FIX: users table has no avatarUrl — null for now (V2 will use staff_photos)
        avatarUrl: null,
        role: r.role,
        roleLabel: roleLabelFor(r.role, children),
        tenantName: r.tenantName,
        isSameTenant: isSame,
        canStartDirectConversation: isSame,  // ⭐ intra-école = direct, cross-école = invitation
        childrenNames: children,
      };
    });
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
    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT i.*,
             s."firstName" AS "senderFirstName",
             s."lastName" AS "senderLastName",
             s."avatarUrl" AS "senderAvatarUrl",
             t."name" AS "senderTenantName",
             ur."role" AS "senderRole"
      FROM chat_invitations i
      LEFT JOIN "users" s ON s.id = i."senderId"
      LEFT JOIN "tenants" t ON t.id = i."senderTenantId"
      LEFT JOIN "user_roles" ur ON ur."userId" = i."senderId"
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
}

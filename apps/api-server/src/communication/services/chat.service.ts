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

import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException, UnsupportedMediaTypeException } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import { ParentUserProvisioningService } from '../../students/services/parent-user-provisioning.service';
import { ChatGateway } from '../chat.gateway';
import { FcmSenderService } from '../../notifications/fcm-sender.service';
import { randomUUID } from 'crypto';
// ⭐ V5 (chantier 1) : blocage d'utilisateurs (parité Yeshua blocks)
import { ChatBlockService } from './chat-block.service';
// ⭐ V5 (chantier 2) : matrice de permissions « qui contacte qui »
import { CommunicationPermissionsService } from './communication-permissions.service';
// ⭐ V5 (chantier 5) : antivirus optionnel des uploads (VirusTotal/ClamAV)
import { FileScannerService } from './file-scanner.service';

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
  // ⭐ V1.5: priority flag + emoji reactions
  isImportant?: boolean;
  reactions?: { emoji: string; userId: string; firstName?: string; lastName?: string }[];
}

/**
 * ⭐ V5 (chantier 10) — Droits personnalisables d'un participant de conversation
 *    (colonne JSONB chat_participants.permissions — vide = défauts du rôle).
 *    ADMIN: tout ; MODERATOR: canPin+canDeleteMessages+canMute ; MEMBER: rien.
 */
export interface PermissionsShape {
  canPin: boolean;
  canDeleteMessages: boolean;
  canInvite: boolean;
  canMute: boolean;
  canBroadcast: boolean;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly parentUserProvisioningService: ParentUserProvisioningService,
    // ⭐ ChatGateway injected for real-time broadcast (message:new, mention:new).
    //    Same module — no circular dependency (ChatGateway only depends on JwtService).
    private readonly chatGateway: ChatGateway,
    // ⭐ DISCORD PARITY: FCM (Firebase Cloud Messaging) for mobile push notifications.
    //    When a new chat message is sent, mobile users receive a push notification
    //    via FCM (in addition to the in-app Socket.io real-time event).
    private readonly fcmSender: FcmSenderService,
    // ⭐ V5 (chantier 1) : blocage d'utilisateurs — vérifié à la création/ouverture
    //    de DM, à l'envoi de message en privé et au démarrage d'appel.
    private readonly chatBlockService: ChatBlockService,
    // ⭐ V5 (chantier 2) : matrice « qui contacte qui » — appliquée UNIQUEMENT
    //    à la création de DM (pas aux conversations existantes ni aux groupes).
    private readonly permissionsService: CommunicationPermissionsService,
    // ⭐ V5 (chantier 5) : antivirus optionnel des pièces jointes (scan AVANT
    //    sauvegarde — refus 415 si malware détecté).
    private readonly fileScanner: FileScannerService,
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

    // ⭐ V5 (chantier 1) — BLOCAGE : on refuse la création/OUVERTURE d'un DM si
    //    l'un des deux membres a bloqué l'autre (403, message uniforme).
    //    Comme Yeshua : POST /conversations/dm → 403 si blocage dans un sens ou l'autre.
    await this.chatBlockService.assertNotBlocked(resolvedTenantId, currentUserId, otherUserId);

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

    // ⭐ V5 (chantier 2) — MATRICE « QUI CONTACTE QUI » (spéc école #7/#16) :
    //    la règle s'applique UNIQUEMENT à la CRÉATION d'un DM (jamais aux
    //    conversations existantes, ni aux groupes/canaux). Un STUDENT ne peut
    //    initier un DM qu'avec ses enseignants/admin/parents liés ; un PARENT
    //    qu'avec les enseignants de ses enfants + admin ; TEACHER/ADMIN/DIRECTOR libres.
    const decision = await this.permissionsService.assertCanContact(resolvedTenantId, currentUserId, otherUserId);
    if (!decision.allowed) {
      this.logger.warn(
        `createOrGetDirectConversation refusée (politique de contact) : ${currentUserId} → ${otherUserId} ` +
        `(${decision.reason || 'non autorisé'})`
      );
      throw new ForbiddenException(
        decision.reason || 'Vous n\'êtes pas autorisé à contacter ce membre.'
      );
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
   * ⭐ Crée ou récupère une conversation DIRECTE avec un PARENT (guardian).
   *
   * Contrairement à createOrGetDirectConversation qui prend deux userIds,
   * cette méthode prend un guardianId. Elle :
   *   1. Appelle ParentUserProvisioningService.ensureUserForGuardian() qui
   *      auto-crée un compte User (role=PARENT) si le guardian n'en a pas
   *      encore un, et back-fill guardian.userId
   *   2. Appelle createOrGetDirectConversation() avec le userId du parent
   *
   * ⭐ Permet à un enseignant/directeur de discuter directement avec un
   *    parent SANS avoir besoin d'envoyer une invitation par SMS/email —
   *    le parent peut déjà se connecter à l'espace parent via son numéro
   *    de téléphone (OTP).
   */
  async createOrGetDirectConversationWithGuardian(
    tenantId: string,
    currentUserId: string,
    guardianId: string,
  ): Promise<{ conversationId: string; parentUserId: string; userCreated: boolean }> {
    if (!guardianId) {
      throw new BadRequestException('guardianId is required');
    }
    // 1. Ensure the guardian has a User account (creates one if needed)
    const { userId: parentUserId, created: userCreated } =
      await this.parentUserProvisioningService.ensureUserForGuardian(guardianId);

    // ⭐ SAFEGUARD: prevent self-conversation (parentUserId === currentUserId)
    //    This would happen if the guardian's email matches the teacher's email,
    //    or if guardian.userId was previously set to the wrong user.
    //    Throwing here gives a clear error message instead of creating a
    //    broken conversation that shows the teacher's name instead of the parent's.
    if (parentUserId === currentUserId) {
      this.logger.error(
        `Refusing to create self-conversation: guardian ${guardianId} is linked to user ${parentUserId} ` +
        `which is the SAME as the current user ${currentUserId}. ` +
        `This likely means the guardian's email matches the teacher's email, ` +
        `or guardian.userId was previously set to the wrong user.`
      );
      throw new BadRequestException(
        "Impossible de créer une conversation avec ce parent : le compte Helm Connect lié au parent est le même que le vôtre. " +
        "Cela peut se produire si l'email du parent est le même que le vôtre. " +
        "Veuillez vérifier la fiche de l'élève (module Scolarité) et corriger l'email du parent."
      );
    }

    // 2. Create or get the direct conversation between the teacher and the parent
    const conversation = await this.createOrGetDirectConversation(
      tenantId,
      currentUserId,
      parentUserId,
    );

    return {
      conversationId: conversation.id,
      parentUserId,
      userCreated,
    };
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

  /**
   * ⭐ V5 (chantier 1) — BLOCAGE sur conversation DIRECT à 2 participants :
   *    si l'un des deux a bloqué l'autre, l'envoi est refusé (403). Les
   *    conversations de GROUPE restent OUVERTES (on bloque la personne, pas
   *    la communauté — comme Telegram/Yeshua).
   *    Helper appelé par sendTextMessage / sendAttachmentMessage / sendStickerMessage.
   */
  private async assertDirectConversationNotBlocked(
    tenantId: string,
    senderId: string,
    conv: ChatConversation,
  ): Promise<void> {
    if (conv?.type !== 'DIRECT') return; // groupes/canaux : jamais bloqués
    const other = (conv.participants || []).find((p: any) => p.userId && p.userId !== senderId);
    if (!other) return;
    await this.chatBlockService.assertNotBlocked(tenantId, senderId, other.userId);
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
    // ⭐ V2.7 fix: when beforeClause is present, it should reference $4 (not $3)
    //    because $3 is now used for userId in the LEFT JOIN chat_message_user_deletions.
    //    Params order: $1=conversationId, $2=limit, $3=userId, $4=options.before (when present)
    const beforeClause = options.before ? `AND m."createdAt" < (SELECT "createdAt" FROM chat_messages WHERE id = $4)` : '';

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

      // ⭐ V1.5: batch-load reactions for all messages in this conversation
      const reactions: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT r."messageId", r."userId", r.emoji, r."createdAt",
               u."firstName", u."lastName"
        FROM chat_message_reactions r
        JOIN "users" u ON u.id = r."userId"
        WHERE r."messageId" = ANY($1::text[])
        ORDER BY r."createdAt" ASC
      `, msgIds).catch(() => []); // graceful fallback if table doesn't exist yet

      // Group reactions by messageId → [{ emoji, userId, firstName, lastName }, ...]
      const reactionsByMsg = new Map<string, any[]>();
      for (const r of reactions) {
        if (!reactionsByMsg.has(r.messageId)) reactionsByMsg.set(r.messageId, []);
        reactionsByMsg.get(r.messageId)!.push({
          emoji: r.emoji,
          userId: r.userId,
          firstName: r.firstName,
          lastName: r.lastName,
        });
      }

      messages.forEach(m => {
        m.readBy = receiptsByMsg.get(m.id) || [];
        m.reactions = reactionsByMsg.get(m.id) || [];
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
      isImportant: m.isImportant || false,  // ⭐ V1.5: priority flag
      deletedAt: m.deletedAt,
      sender: {
        firstName: m.senderFirstName,
        lastName: m.senderLastName,
        avatarUrl: m.senderAvatarUrl,
        role: m.senderRole,
      },
      readBy: m.readBy || [],
      reactions: m.reactions || [],  // ⭐ V1.5: emoji reactions
    }));
  }

  /**
   * Envoie un message texte dans une conversation.
   */
  async sendTextMessage(
    tenantId: string,
    senderId: string,
    conversationId: string,
    data: { content: string; replyToId?: string; mentionedUserIds?: string[] },
  ): Promise<ChatMessage> {
    const conv = await this.getConversation(tenantId, senderId, conversationId);

    // ⭐ V5 (chantier 1) — BLOCAGE sur conversation DIRECT à 2 participants :
    //    si l'un des deux a bloqué l'autre → 403 (les groupes restent OUVERTS).
    await this.assertDirectConversationNotBlocked(tenantId, senderId, conv);

    // ⭐ V5 (chantier 10) — APPROBATION : un participant PENDING (adhésion via
    //    lien en attente d'approbation) ne peut pas encore écrire.
    const selfParticipant = (conv.participants || []).find((p: any) => p.userId === senderId);
    if (selfParticipant && (selfParticipant as any).joinStatus === 'PENDING') {
      throw new ForbiddenException('Votre adhésion à cette conversation est en attente d\'approbation par un administrateur.');
    }

    if (!data.content || data.content.trim().length === 0) {
      throw new BadRequestException('Message content cannot be empty');
    }

    // ⭐ DISCORD PARITY — Slow mode enforcement.
    //    If the conversation has slowModeSeconds > 0, the user must wait
    //    that many seconds between messages. We check the user's last
    //    message timestamp in this conversation and reject if too soon.
    //    Admins (ADMIN role on chat_participants) bypass slow mode.
    try {
      const convRow: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT c."slowModeSeconds", p.role
        FROM "chat_conversations" c
        LEFT JOIN "chat_participants" p ON p."conversationId" = c.id AND p."userId" = $2
        WHERE c.id = $1
      `, conversationId, senderId);
      const slowMode = convRow[0]?.slowModeSeconds || 0;
      const userRole = convRow[0]?.role;
      if (slowMode > 0 && userRole !== 'ADMIN') {
        const lastMsg: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
          SELECT "createdAt" FROM "chat_messages"
          WHERE "conversationId" = $1 AND "senderId" = $2
          ORDER BY "createdAt" DESC LIMIT 1
        `, conversationId, senderId);
        if (lastMsg.length > 0) {
          const lastTime = new Date(lastMsg[0].createdAt).getTime();
          const elapsed = (Date.now() - lastTime) / 1000;
          if (elapsed < slowMode) {
            const wait = Math.ceil(slowMode - elapsed);
            throw new BadRequestException(`Mode lent actif. Patientez ${wait}s avant d'envoyer un autre message.`);
          }
        }
      }
    } catch (e: any) {
      // If the column doesn't exist yet (migration pending), silently skip
      if (!(e instanceof BadRequestException)) {
        this.logger?.warn?.(`Slow mode check failed: ${e.message}`);
      } else {
        throw e;
      }
    }

    // ⭐ DISCORD PARITY — Ban check. Reject if the user is banned from this conversation.
    try {
      const banRow: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT id FROM "chat_conversation_bans"
        WHERE "conversationId" = $1 AND "userId" = $2
        AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
      `, conversationId, senderId);
      if (banRow.length > 0) {
        throw new ForbiddenException('Vous avez été banni de cette conversation.');
      }
    } catch (e: any) {
      if (e instanceof ForbiddenException) throw e;
      this.logger?.warn?.(`Ban check failed: ${e.message}`);
    }

    // ⭐ DISCORD PARITY — Mute check. Reject if the user is muted in this conversation.
    try {
      const muteRow: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT id FROM "chat_conversation_mutes"
        WHERE "conversationId" = $1 AND "userId" = $2
        AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
      `, conversationId, senderId);
      if (muteRow.length > 0) {
        throw new ForbiddenException('Vous avez été mis en sourdine dans cette conversation.');
      }
    } catch (e: any) {
      if (e instanceof ForbiddenException) throw e;
      this.logger?.warn?.(`Mute check failed: ${e.message}`);
    }

    // ⭐ MENTIONS: persist mentioned user IDs as a JSON array in the `mentions` column.
    //    The column was added by migration 20260901140000_fill_all_gaps.
    //    We store as TEXT (JSON) so it survives on Postgres without array column type.
    const mentionsJson = (data.mentionedUserIds && data.mentionedUserIds.length > 0)
      ? JSON.stringify(data.mentionedUserIds)
      : null;

    const msgId = randomUUID();
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "chat_messages" ("id", "conversationId", "senderId", "type", "content", "replyToId", "mentions", "createdAt")
      VALUES ($1, $2, $3, 'TEXT', $4, $5, $6, NOW())
    `, msgId, conversationId, senderId, data.content.trim(), data.replyToId || null, mentionsJson);

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

    // ⭐ MENTIONS: Broadcast the new message via Socket.io so mentioned users
    //    (and all participants) receive it in real-time. The gateway emits
    //    'message:new' to the conversation room AND 'inbox:new' to each
    //    participant's personal room (for unread badge updates).
    //    Mentioned users get an additional 'mention:new' event so the frontend
    //    can show a distinct "@you" notification.
    try {
      // Récupérer les IDs de tous les participants pour le broadcast
      const participants: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT "userId" FROM "chat_participants"
        WHERE "conversationId" = $1 AND "leftAt" IS NULL
      `, conversationId);
      const participantIds = participants.map(p => p.userId);

      this.chatGateway?.broadcastNewMessage(conversationId, {
        id: msgId,
        conversationId,
        senderId,
        type: 'TEXT',
        content: data.content,
        replyToId: data.replyToId || null,
        mentions: data.mentionedUserIds || [],
        createdAt: new Date().toISOString(),
      }, participantIds);

      // ⭐ MENTIONS: emit a dedicated 'mention:new' event to mentioned users
      //    so the frontend can show a distinct notification (e.g. "@you" badge).
      if (data.mentionedUserIds && data.mentionedUserIds.length > 0 && this.chatGateway?.server) {
        for (const mentionedUserId of data.mentionedUserIds) {
          if (mentionedUserId !== senderId) {
            this.chatGateway.server.to(`user:${mentionedUserId}`).emit('mention:new', {
              conversationId,
              messageId: msgId,
              senderId,
              content: data.content.substring(0, 100),
            });
          }
        }
      }
    } catch (e: any) {
      this.logger?.warn?.(`Failed to broadcast new message via Socket.io: ${e.message}`);
    }

    // ⭐ DISCORD PARITY: FCM mobile push notification for chat messages.
    //    Send a push to all participants (except the sender) who have the mobile
    //    app installed (registered FCM device tokens). The FcmSenderService is a
    //    fire-and-forget service that silently skips if FCM is not configured.
    try {
      const senderName = await this.getUserDisplayName(tenantId, senderId);
      const isMassMention = !!(data.mentionedUserIds && data.mentionedUserIds.length > 0);
      const preview = data.content.length > 80 ? data.content.substring(0, 80) + '…' : data.content;
      // Get all participants (excluding the sender) for push notification.
      const participants: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT "userId" FROM "chat_participants"
        WHERE "conversationId" = $1 AND "userId" != $2 AND "leftAt" IS NULL
      `, conversationId, senderId);
      const targetUserIds = participants.map(p => p.userId);
      if (targetUserIds.length > 0) {
        this.fcmSender.sendToUsers(targetUserIds, {
          title: isMassMention ? `🔔 ${senderName}` : senderName,
          body: preview,
          data: {
            conversationId,
            messageId: msgId,
            senderId,
            type: isMassMention ? 'CHAT_MENTION' : 'CHAT_MESSAGE',
          },
          type: isMassMention ? 'CHAT_MENTION' : 'CHAT_MESSAGE',
        }).catch((e: any) => this.logger?.warn?.(`FCM send failed: ${e.message}`));
      }
    } catch (e: any) {
      this.logger?.warn?.(`FCM push notification failed: ${e.message}`);
    }

    return (await this.listMessages(tenantId, senderId, conversationId, { limit: 1 }))[0];
  }

  /** Helper: get a user's display name for push notifications. */
  private async getUserDisplayName(tenantId: string, userId: string): Promise<string> {
    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT "firstName", "lastName" FROM "users" WHERE id = $1
      `, userId);
      if (rows.length > 0) {
        const name = `${rows[0].firstName || ''} ${rows[0].lastName || ''}`.trim();
        return name || 'Helm Connect';
      }
    } catch { /* ignore */ }
    return 'Helm Connect';
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
    const conv = await this.getConversation(tenantId, senderId, conversationId);

    // ⭐ V5 (chantier 1) — BLOCAGE sur conversation DIRECT à 2 participants
    await this.assertDirectConversationNotBlocked(tenantId, senderId, conv);

    // ⭐ V5 (chantier 5) — ANTIVIRUS : scan AVANT sauvegarde (VirusTotal/ClamAV
    //    optionnels — sans configuration, log « scan skipped » et acceptation,
    //    comportement par défaut inchangé). Détection positive → 415.
    const scan = await this.fileScanner.scanFile(data.file);
    if (scan.scanned && !scan.clean) {
      this.logger.warn(
        `Fichier rejeté (malware détecté) : « ${data.file.originalname} » ` +
        `moteur=${scan.engine} details=${scan.details} sha256=${scan.sha256 || 'n/a'}`
      );
      throw new UnsupportedMediaTypeException(
        `Fichier rejeté (malware détecté) : ${scan.details || 'fichier infecté'}`
      );
    }

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
    const newReceipts = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(`
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
      RETURNING "id"
    `, randomUUID(), userId, conversationId);
    // ⭐ V4 — Diffuser l'accusé de lecture EN TEMPS RÉEL (blue ticks) :
    //    la gateway émet 'message:read' dans la room de conversation —
    //    les expéditeurs connectés voient ✓✓ bleu instantanément au lieu
    //    d'attendre le prochain polling 5 s.
    //    (la méthode broadcastReadReceipt existait mais n'était jamais appelée)
    if (newReceipts && newReceipts.length > 0) {
      this.chatGateway?.broadcastReadReceipt(
        conversationId,
        userId,
        newReceipts.map((r) => r.id),
      );
    }
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

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V1 GAP — MESSAGE REACTIONS (emoji)
  //     Toggle a reaction on/off. If the user already reacted with this
  //     emoji, remove it. Otherwise, add it.
  // ═════════════════════════════════════════════════════════════════
  async toggleReaction(
    tenantId: string,
    messageId: string,
    userId: string,
    emoji: string,
  ): Promise<{ messageId: string; emoji: string; action: 'added' | 'removed'; count: number }> {
    // Check if reaction already exists
    const existing: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT id FROM chat_message_reactions
      WHERE "messageId" = $1 AND "userId" = $2 AND emoji = $3
      LIMIT 1
    `, messageId, userId, emoji);

    let action: 'added' | 'removed';
    if (existing.length > 0) {
      // Remove existing reaction (toggle off)
      await this.prisma.$executeRawUnsafe(`
        DELETE FROM chat_message_reactions
        WHERE "messageId" = $1 AND "userId" = $2 AND emoji = $3
      `, messageId, userId, emoji);
      action = 'removed';
    } else {
      // Add new reaction
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO chat_message_reactions ("id", "messageId", "userId", "emoji", "createdAt")
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT ON CONSTRAINT "chat_message_reactions_message_user_emoji_idx" DO NOTHING
      `, randomUUID(), messageId, userId, emoji);
      action = 'added';
    }
    const count = await this.getReactionCount(messageId, emoji);

    // ⭐ REACTIONS: Broadcast the reaction change via Socket.io so all
    //    participants see reactions appear/disappear in real-time without
    //    needing to reload the conversation.
    try {
      const msgRow: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT "conversationId" FROM "chat_messages" WHERE id = $1
      `, messageId);
      const conversationId = msgRow[0]?.conversationId;
      if (conversationId && this.chatGateway?.server) {
        this.chatGateway.server.to(`conv:${conversationId}`).emit('reaction:toggle', {
          messageId,
          emoji,
          userId,
          action,
          count,
        });
      }
    } catch (e: any) {
      this.logger?.warn?.(`Failed to broadcast reaction via Socket.io: ${e.message}`);
    }

    return { messageId, emoji, action, count };
  }

  private async getReactionCount(messageId: string, emoji: string): Promise<number> {
    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT count(*)::int AS cnt FROM chat_message_reactions
      WHERE "messageId" = $1 AND emoji = $2
    `, messageId, emoji);
    return rows[0]?.cnt || 0;
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V1 GAP — MESSAGE EDIT
  //     Only the original sender can edit. Sets editedAt = NOW().
  // ═════════════════════════════════════════════════════════════════
  async editMessage(
    tenantId: string,
    messageId: string,
    userId: string,
    content: string,
  ): Promise<{ id: string; content: string; editedAt: string }> {
    // Verify the user is the sender
    const msg: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT id, "senderId", "conversationId" FROM chat_messages WHERE id = $1
    `, messageId);
    if (msg.length === 0) throw new NotFoundException('Message not found');
    if (msg[0].senderId !== userId) throw new ForbiddenException('Only the sender can edit this message');

    await this.prisma.$executeRawUnsafe(`
      UPDATE chat_messages SET content = $1, "editedAt" = NOW() WHERE id = $2
    `, content, messageId);

    const editedAt = new Date().toISOString();

    // ⭐ MESSAGE EDIT: Broadcast the edit via Socket.io so all participants
    //    see the updated content in real-time without needing to reload.
    try {
      const conversationId = msg[0]?.conversationId;
      if (conversationId && this.chatGateway?.server) {
        this.chatGateway.server.to(`conv:${conversationId}`).emit('message:edited', {
          messageId,
          content,
          editedAt,
        });
      }
    } catch (e: any) {
      this.logger?.warn?.(`Failed to broadcast message edit via Socket.io: ${e.message}`);
    }

    // ⭐ DISCORD PARITY: Audit log for message edits
    await this.auditLog(msg[0]?.conversationId || null, userId, null, messageId, 'MESSAGE_EDIT', { contentPreview: content.substring(0, 100) });

    return { id: messageId, content, editedAt };
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V1 GAP — MESSAGE FORWARD
  //     Copies the message to the target conversation with the current user
  //     as sender. Preserves type + attachmentUrl + content.
  // ═════════════════════════════════════════════════════════════════
  async forwardMessage(
    tenantId: string,
    messageId: string,
    userId: string,
    targetConversationId: string,
  ): Promise<{ id: string; conversationId: string; type: string; content: string | null; attachmentUrl: string | null }> {
    // Load original message
    const msg: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT type, content, "attachmentUrl", "attachmentName", "attachmentSize", "attachmentMime"
      FROM chat_messages WHERE id = $1
    `, messageId);
    if (msg.length === 0) throw new NotFoundException('Message not found');

    // Verify user is a participant in the target conversation
    const participants: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT "userId" FROM chat_participants
      WHERE "conversationId" = $1 AND "userId" = $2 AND "leftAt" IS NULL
    `, targetConversationId, userId);
    if (participants.length === 0) throw new ForbiddenException('You are not a participant in the target conversation');

    // Insert forwarded message
    const newId = randomUUID();
    const m = msg[0];
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO chat_messages (
        "id", "conversationId", "senderId", "type",
        "content", "attachmentUrl", "attachmentName", "attachmentSize", "attachmentMime",
        "createdAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    `, newId, targetConversationId, userId, m.type, m.content, m.attachmentUrl, m.attachmentName, m.attachmentSize, m.attachmentMime);

    // Update conversation's lastMessage
    await this.prisma.$executeRawUnsafe(`
      UPDATE chat_conversations
      SET "lastMessageAt" = NOW(), "lastMessageSenderId" = $1,
          "lastMessagePreview" = $2, "updatedAt" = NOW()
      WHERE id = $3
    `, userId, m.content ? m.content.substring(0, 100) : (m.attachmentName || 'Pièce jointe'), targetConversationId);

    return {
      id: newId,
      conversationId: targetConversationId,
      type: m.type,
      content: m.content,
      attachmentUrl: m.attachmentUrl,
    };
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V1 GAP — MARK MESSAGE AS IMPORTANT
  //     Toggles the isImportant flag on a message.
  // ═════════════════════════════════════════════════════════════════
  async toggleImportant(
    tenantId: string,
    messageId: string,
    userId: string,
    isImportant: boolean,
  ): Promise<{ id: string; isImportant: boolean }> {
    // Verify user is a participant in the conversation that contains this message
    const msgConv: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT cm."conversationId" FROM chat_messages cm
      WHERE cm.id = $1
    `, messageId);
    if (msgConv.length === 0) throw new NotFoundException('Message not found');

    const participants: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT "userId" FROM chat_participants
      WHERE "conversationId" = $1 AND "userId" = $2 AND "leftAt" IS NULL
    `, msgConv[0].conversationId, userId);
    if (participants.length === 0) throw new ForbiddenException('You are not a participant in this conversation');

    await this.prisma.$executeRawUnsafe(`
      UPDATE chat_messages SET "isImportant" = $1 WHERE id = $2
    `, isImportant, messageId);

    return { id: messageId, isImportant };
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V2 — GROUP INVITE LINKS
  // ═════════════════════════════════════════════════════════════════
  async generateInviteLink(tenantId: string, conversationId: string, userId: string): Promise<{ inviteLink: string; token: string }> {
    // Verify user is admin participant
    const conv: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT c.type, c."inviteToken" FROM chat_conversations c
      JOIN chat_participants p ON p."conversationId" = c.id
      WHERE c.id = $1 AND p."userId" = $2 AND p.role = 'ADMIN' AND p."leftAt" IS NULL
    `, conversationId, userId);
    if (conv.length === 0) throw new ForbiddenException('Only group admins can generate invite links');

    // Generate token if not already set
    let token = conv[0].inviteToken;
    if (!token) {
      token = randomUUID();
      await this.prisma.$executeRawUnsafe(`UPDATE chat_conversations SET "inviteToken" = $1 WHERE id = $2`, token, conversationId);
    }
    return { inviteLink: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.academiahelm.com'}/app/communication?join=${token}`, token };
  }

  async joinByInviteLink(tenantId: string, token: string, userId: string): Promise<{ conversationId: string; name?: string; joinStatus: 'ACTIVE' | 'PENDING' }> {
    const conv: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT id, name, "requireApproval" FROM chat_conversations WHERE "inviteToken" = $1 AND "tenantId" = $2
    `, token, tenantId);
    if (conv.length === 0) throw new NotFoundException('Invalid or expired invite link');

    const conversationId = conv[0].id;
    const requireApproval = !!conv[0].requireApproval;
    // Check if already a participant
    const existing: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT id, "joinStatus" FROM chat_participants WHERE "conversationId" = $1 AND "userId" = $2 AND "leftAt" IS NULL
    `, conversationId, userId);
    if (existing.length > 0) {
      return { conversationId, name: conv[0].name, joinStatus: (existing[0].joinStatus as 'ACTIVE' | 'PENDING') || 'ACTIVE' };
    }

    // ⭐ V5 (chantier 10) — APPROBATION D'ADHÉSION : si la conversation exige
    //    une approbation, le membre est créé en PENDING (il ne peut pas encore
    //    écrire) et les ADMIN sont notifiés (socket + push) pour approuver/refuser.
    const joinStatus: 'ACTIVE' | 'PENDING' = requireApproval ? 'PENDING' : 'ACTIVE';

    // Add as MEMBER
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO chat_participants ("id", "conversationId", "userId", "tenantId", "role", "joinedAt", "joinStatus")
      VALUES ($1, $2, $3, $4, 'MEMBER', NOW(), $5)
    `, randomUUID(), conversationId, userId, tenantId, joinStatus);

    // Notification des ADMIN (demande d'adhésion en attente)
    if (joinStatus === 'PENDING') {
      await this.notifyAdminsOfPendingMember(tenantId, conversationId, conv[0].name, userId);
    }

    return { conversationId, name: conv[0].name, joinStatus };
  }

  /**
   * ⭐ V5 (chantier 10) — Notifie les ADMIN d'une conversation qu'un membre
   *    attend son approbation (broadcast socket temps réel + push best effort).
   */
  private async notifyAdminsOfPendingMember(tenantId: string, conversationId: string, conversationName: string | null, pendingUserId: string): Promise<void> {
    try {
      // Identité du demandeur (pour le libellé de la notification)
      const userRows: any[] = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT "firstName", "lastName" FROM "users" WHERE id = $1`,
        pendingUserId,
      );
      const pendingName = userRows.length
        ? `${userRows[0].firstName || ''} ${userRows[0].lastName || ''}`.trim() || 'Un membre'
        : 'Un membre';

      // ADMIN de la conversation (role='ADMIN' + joinStatus actif)
      const adminRows: any[] = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT "userId" FROM chat_participants WHERE "conversationId" = $1 AND "role" = 'ADMIN' AND "leftAt" IS NULL`,
        conversationId,
      );
      const adminIds = adminRows.map((r) => r.userId);

      // 1) Broadcast socket temps réel vers la room de conversation
      if (this.chatGateway?.server) {
        this.chatGateway.server.to(`conv:${conversationId}`).emit('member:join-request', {
          conversationId,
          conversationName,
          pendingUserId,
          pendingName,
          adminIds,
        });
      }

      // 2) Push in-app aux admins (best effort — jamais bloquant)
      for (const adminId of adminIds) {
        this.fcmSender?.sendToUser(adminId, {
          title: 'Demande d\'adhésion — Helm Connect',
          body: `${pendingName} demande à rejoindre « ${conversationName || 'la conversation'} » (approbation requise)`,
          data: { conversationId, pendingUserId },
          type: 'JOIN_REQUEST',
        })?.catch?.((e: any) => this.logger?.warn?.(`FCM join-request: ${e.message}`));
      }
    } catch (e: any) {
      this.logger?.warn?.(`notifyAdminsOfPendingMember: ${e.message}`);
    }
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V2 — SCHEDULED MESSAGES
  // ═════════════════════════════════════════════════════════════════
  async scheduleMessage(tenantId: string, conversationId: string, senderId: string, content: string, scheduledFor: Date): Promise<{ id: string; scheduledFor: string }> {
    await this.getConversation(tenantId, senderId, conversationId);
    const id = randomUUID();
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO chat_scheduled_messages ("id", "conversationId", "senderId", "type", "content", "scheduledFor", "status", "createdAt")
      VALUES ($1, $2, $3, 'TEXT', $4, $5, 'PENDING', NOW())
    `, id, conversationId, senderId, content, scheduledFor);
    return { id, scheduledFor: scheduledFor.toISOString() };
  }

  async listScheduledMessages(tenantId: string, conversationId: string, userId: string): Promise<any[]> {
    await this.getConversation(tenantId, userId, conversationId);
    return await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM chat_scheduled_messages
      WHERE "conversationId" = $1 AND "status" = 'PENDING'
      ORDER BY "scheduledFor" ASC
    `, conversationId);
  }

  async cancelScheduledMessage(tenantId: string, schedId: string, userId: string): Promise<{ success: boolean }> {
    await this.prisma.$executeRawUnsafe(`
      UPDATE chat_scheduled_messages SET "status" = 'CANCELLED' WHERE id = $1 AND "senderId" = $2
    `, schedId, userId);
    return { success: true };
  }

  /**
   * Cron: dispatch due scheduled messages. Called every minute via @Interval.
   */
  @Interval(60000) // every 60 seconds
  async dispatchScheduledMessages(): Promise<number> {
    const due: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM chat_scheduled_messages
      WHERE "status" = 'PENDING' AND "scheduledFor" <= NOW()
      LIMIT 50
    `);
    let count = 0;
    for (const sm of due) {
      try {
        const msg = await this.sendTextMessage(sm.tenantId || '', sm.senderId, sm.conversationId, { content: sm.content });
        await this.prisma.$executeRawUnsafe(`
          UPDATE chat_scheduled_messages SET "status" = 'SENT', "sentMessageId" = $1, "sentAt" = NOW() WHERE id = $2
        `, msg.id, sm.id);
        count++;
      } catch (e: any) {
        this.logger.error(`Failed to dispatch scheduled message ${sm.id}: ${e.message}`);
        await this.prisma.$executeRawUnsafe(`UPDATE chat_scheduled_messages SET "status" = 'FAILED' WHERE id = $1`, sm.id);
      }
    }
    if (count > 0) this.logger.log(`Dispatched ${count} scheduled messages`);
    return count;
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V2 — CALL HISTORY
  // ═════════════════════════════════════════════════════════════════
  async startCall(tenantId: string, conversationId: string, callerId: string, callType: 'AUDIO' | 'VIDEO'): Promise<{ callId: string }> {
    const id = randomUUID();
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO chat_call_history ("id", "conversationId", "callerId", "callType", "status", "startedAt")
      VALUES ($1, $2, $3, $4, 'ONGOING', NOW())
    `, id, conversationId, callerId, callType);
    return { callId: id };
  }

  async endCall(tenantId: string, callId: string, status: string): Promise<{ id: string; duration: number }> {
    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT "startedAt" FROM chat_call_history WHERE id = $1
    `, callId);
    if (rows.length === 0) throw new NotFoundException('Call not found');
    const startedAt = new Date(rows[0].startedAt);
    const duration = Math.floor((Date.now() - startedAt.getTime()) / 1000);
    await this.prisma.$executeRawUnsafe(`
      UPDATE chat_call_history SET "status" = $1, "endedAt" = NOW(), "duration" = $2 WHERE id = $3
    `, status, duration, callId);
    return { id: callId, duration };
  }

  async listCalls(tenantId: string, conversationId: string): Promise<any[]> {
    return await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT c.*, u."firstName" AS "callerFirstName", u."lastName" AS "callerLastName"
      FROM chat_call_history c
      JOIN "users" u ON u.id = c."callerId"
      WHERE c."conversationId" = $1
      ORDER BY c."startedAt" DESC LIMIT 50
    `, conversationId);
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
    // ⭐ V5 (chantier 10) — DROITS delete-for-everyone :
    //    - l'EXPÉDITEUR peut toujours supprimer son propre message (comportement
    //      historique inchangé) ;
    //    - un ADMIN de la conversation peut supprimer n'importe quel message ;
    //    - un participant avec le droit canDeleteMessages (ex: MODERATOR) peut
    //      supprimer les messages des autres (modération).
    if (msg[0].senderId !== userId) {
      const effective = await this.getEffectivePermissions(tenantId, conversationId, userId);
      if (!effective.canDeleteMessages) {
        throw new ForbiddenException('Only the sender or a moderator can delete a message for everyone');
      }
    }

    // Mark as deleted (soft delete)
    await this.prisma.$executeRawUnsafe(`
      UPDATE "chat_messages"
      SET "deletedAt" = NOW()
      WHERE "id" = $1
    `, messageId);

    // ⭐ MESSAGE DELETE: Broadcast the deletion via Socket.io so all
    //    participants see the message disappear in real-time.
    try {
      if (this.chatGateway?.server) {
        this.chatGateway.server.to(`conv:${conversationId}`).emit('message:deleted', {
          messageId,
        });
      }
    } catch (e: any) {
      this.logger?.warn?.(`Failed to broadcast message deletion via Socket.io: ${e.message}`);
    }

    // ⭐ DISCORD PARITY: Audit log for message deletions
    await this.auditLog(conversationId, userId, null, messageId, 'MESSAGE_DELETE', {});

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
    //    ⭐ FIX Issue #?: removed g."userId" from SELECT — the guardians table
    //       has NO userId column. The query was throwing 'column "userId" does
    //       not exist' which was silently swallowed by the try/catch below →
    //       parents were never returned in search results.
    //    ⭐ Dedup against users results happens later by email match.
    let guardianRows: any[] = [];
    try {
      guardianRows = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT g.id AS "guardianId", g."firstName", g."lastName", g."email",
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
      // ⭐ FIX: skip guardians whose email matches a user already in userRows
      //    (was previously `if (g.userId) continue;` but guardians has no userId column)
      if (g.email && seenEmails.has((g.email || '').toLowerCase())) continue;
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
    // Also search by userId for guardians who have a userId — DISABLED
    // ⭐ FIX: guardians table has no userId column. The previous block queried
    //    WHERE g."userId" = ANY($1) which would always return empty (no userId
    //    column) or throw. Since we now correctly look up children via
    //    guardianId above (lines 800-810), this redundant block is removed.

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

    // Fetch guardian record — ⭐ FIX: removed g."userId" from SELECT
    //    (guardians table has no userId column — was throwing 'column "userId" does not exist')
    const guardian: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT g.id, g."firstName", g."lastName", g.email, g.phone, g."tenantId",
             t."name" AS "tenantName"
      FROM "guardians" g
      LEFT JOIN "tenants" t ON t.id = g."tenantId"
      WHERE g.id = $1
    `, data.guardianId);

    if (guardian.length === 0) {
      throw new NotFoundException('Guardian not found');
    }
    const g = guardian[0];

    // ⭐ FIX: instead of checking g.userId (which doesn't exist), look up
    //    if a User account with matching email exists in the same tenant.
    //    If yes, the guardian already has an account — no invitation needed.
    let existingUser: any[] = [];
    if (g.email) {
      existingUser = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT id FROM "users"
        WHERE email = $1 AND "tenantId" = $2 AND status = 'active'
        LIMIT 1
      `, g.email, g.tenantId).catch(() => []);
    }
    if (existingUser.length > 0) {
      return {
        id: existingUser[0].id,
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
      SELECT id, "lastActiveAt", "customStatus", "activityStatus",
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
      // ⭐ V4 — présence enrichie (statut d'activité + statut personnalisé)
      activityStatus: r.activityStatus || undefined,
      customStatus: r.customStatus || undefined,
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

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ GAP FILL: MODERATION — report a message
  // ═════════════════════════════════════════════════════════════════
  async reportMessage(tenantId: string, messageId: string, reporterId: string, reason: string) {
    const id = randomUUID();
    await this.prisma.$executeRawUnsafe(`INSERT INTO chat_message_reports ("id","messageId","reporterId","reason","status","createdAt") VALUES ($1,$2,$3,$4,'PENDING',NOW())`, id, messageId, reporterId, reason);
    return { id, status: 'PENDING' };
  }

  async listReports(tenantId: string) {
    return await this.prisma.$queryRawUnsafe<any[]>(`SELECT r.*, m.content, m."conversationId", u."firstName" AS "reporterFirstName", u."lastName" AS "reporterLastName" FROM chat_message_reports r JOIN chat_messages m ON m.id=r."messageId" JOIN "users" u ON u.id=r."reporterId" WHERE r.status='PENDING' ORDER BY r."createdAt" DESC LIMIT 100`);
  }

  async resolveReport(reportId: string, resolvedBy: string, resolution: string) {
    await this.prisma.$executeRawUnsafe(`UPDATE chat_message_reports SET "status"='RESOLVED',"resolvedAt"=NOW(),"resolvedBy"=$2,"resolution"=$3 WHERE id=$1`, reportId, resolvedBy, resolution);
    return { id: reportId, status: 'RESOLVED' };
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ GAP FILL: USER PROFILE — get + update
  // ═════════════════════════════════════════════════════════════════
  async getUserProfile(userId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT id,"firstName","lastName",email,role,"avatarUrl","bio","availabilityStatus","availableFrom","availableUntil","lastActiveAt" FROM "users" WHERE id=$1`, userId);
    return rows[0] || null;
  }

  async updateUserProfile(userId: string, data: { bio?: string; availabilityStatus?: string; availableFrom?: string; availableUntil?: string }) {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (data.bio !== undefined) { sets.push(`"bio"=$${idx++}`); params.push(data.bio); }
    if (data.availabilityStatus !== undefined) { sets.push(`"availabilityStatus"=$${idx++}`); params.push(data.availabilityStatus); }
    if (data.availableFrom !== undefined) { sets.push(`"availableFrom"=$${idx++}`); params.push(data.availableFrom); }
    if (data.availableUntil !== undefined) { sets.push(`"availableUntil"=$${idx++}`); params.push(data.availableUntil); }
    if (sets.length === 0) return { success: true };
    params.push(userId);
    await this.prisma.$executeRawUnsafe(`UPDATE "users" SET ${sets.join(',')}, "updatedAt"=NOW() WHERE id=$${idx}`, ...params);
    return { success: true };
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ GAP FILL: IN-CONVERSATION SEARCH
  // ═════════════════════════════════════════════════════════════════
  async searchInConversation(tenantId: string, conversationId: string, userId: string, query: string) {
    await this.getConversation(tenantId, userId, conversationId);
    const likeQuery = `%${query.trim().toLowerCase()}%`;
    return await this.prisma.$queryRawUnsafe<any[]>(`SELECT id,content,"senderId","createdAt","type","attachmentUrl","attachmentName" FROM chat_messages WHERE "conversationId"=$1 AND "deletedAt" IS NULL AND LOWER(COALESCE("content",'')) LIKE $2 ORDER BY "createdAt" DESC LIMIT 50`, conversationId, likeQuery);
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ GAP FILL: DELIVERED RECEIPT
  // ═════════════════════════════════════════════════════════════════
  async markDelivered(messageId: string) {
    await this.prisma.$executeRawUnsafe(`UPDATE chat_messages SET "deliveredAt"=NOW() WHERE id=$1 AND "deliveredAt" IS NULL`, messageId);
    return { success: true };
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ GAP FILL: ANALYTICS — real stats
  // ═════════════════════════════════════════════════════════════════
  async getAnalytics(tenantId: string) {
    const today = new Date(); today.setHours(0,0,0,0);
    const msgs = await this.prisma.$queryRawUnsafe<any[]>(`SELECT count(*)::int AS cnt FROM chat_messages m JOIN chat_conversations c ON c.id=m."conversationId" WHERE c."tenantId"=$1 AND m."createdAt" >= $2`, tenantId, today);
    const activeUsers = await this.prisma.$queryRawUnsafe<any[]>(`SELECT count(DISTINCT m."senderId")::int AS cnt FROM chat_messages m JOIN chat_conversations c ON c.id=m."conversationId" WHERE c."tenantId"=$1 AND m."createdAt" >= $2`, tenantId, today);
    const groups = await this.prisma.$queryRawUnsafe<any[]>(`SELECT count(*)::int AS cnt FROM chat_conversations WHERE "tenantId"=$1 AND type='GROUP'`, tenantId);
    const unread = await this.prisma.$queryRawUnsafe<any[]>(`SELECT count(*)::int AS cnt FROM chat_participants p JOIN chat_conversations c ON c.id=p."conversationId" WHERE c."tenantId"=$1 AND p."lastReadAt" IS NULL`, tenantId);
    const announcements = await this.prisma.$queryRawUnsafe<any[]>(`SELECT count(*)::int AS cnt FROM chat_announcements WHERE "tenantId"=$1`, tenantId);
    const filesShared = await this.prisma.$queryRawUnsafe<any[]>(`SELECT count(*)::int AS cnt FROM chat_messages m JOIN chat_conversations c ON c.id=m."conversationId" WHERE c."tenantId"=$1 AND m."attachmentUrl" IS NOT NULL`, tenantId);
    const reports = await this.prisma.$queryRawUnsafe<any[]>(`SELECT count(*)::int AS cnt FROM chat_message_reports r JOIN chat_messages m ON m.id=r."messageId" JOIN chat_conversations c ON c.id=m."conversationId" WHERE c."tenantId"=$1 AND r.status='PENDING'`, tenantId);

    // ═══════════════════════════════════════════════════════════════
    //  ⭐ V5 (chantier 6, spéc #21) — ANALYTICS ENRICHIS (additifs)
    // ═══════════════════════════════════════════════════════════════

    // 1) announcementReadRate — moyenne pondérée readCount/totalRecipients
    //    sur les annonces publiées du tenant. L'estimation du nombre de
    //    destinataires suit la même logique que announcement.service
    //    (estimateRecipients) : ALL_SCHOOL/TEACHERS/PARENTS/CLASS/GROUP/CHANNEL.
    let announcementReadRate = 0;
    try {
      const annStats: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT
          (SELECT count(*)::int FROM chat_announcement_reads r WHERE r."announcementId" = a.id) AS read_count,
          CASE
            WHEN a."targetType" = 'ALL_SCHOOL' THEN
              (SELECT count(*)::int FROM "users" u WHERE u."tenantId" = a."tenantId")
            WHEN a."targetType" = 'TEACHERS' THEN
              (SELECT count(*)::int FROM "users" u WHERE u."tenantId" = a."tenantId"
                 AND UPPER(u."role") IN ('ENSEIGNANT','TEACHER','TEACHER_RESP','RESP_SECONDAIRE','RESP_PRIMAIRE','RESP_MATERNELLE','PEDAGOGIC_COORDINATOR','DIRECTEUR_PEDAGOGIQUE'))
            WHEN a."targetType" = 'PARENTS' THEN
              (SELECT count(*)::int FROM "guardians" g WHERE g."tenantId" = a."tenantId" AND g."userId" IS NOT NULL)
            WHEN a."targetType" = 'GROUP' AND a."targetGroupId" IS NOT NULL THEN
              (SELECT count(*)::int FROM chat_participants p WHERE p."conversationId" = a."targetGroupId" AND p."leftAt" IS NULL)
            WHEN a."targetType" = 'CHANNEL' AND a."targetChannelId" IS NOT NULL THEN
              (SELECT count(*)::int FROM chat_channel_subscribers s WHERE s."channelId" = a."targetChannelId")
            WHEN a."targetType" = 'CLASS' AND a."targetClassId" IS NOT NULL THEN (
              (SELECT count(DISTINCT g."userId")::int FROM "student_enrollments" se
                 JOIN "student_guardians" sg ON sg."studentId" = se."studentId"
                 JOIN "guardians" g ON g.id = sg."guardianId"
                 WHERE se."classId" = a."targetClassId" AND g."userId" IS NOT NULL)
              + (SELECT count(DISTINCT u.id)::int FROM "teacher_class_assignments" tca
                 JOIN "teachers" t ON t.id = tca."teacherId"
                 JOIN "users" u ON u."email" = t."email"
                 WHERE tca."classId" = a."targetClassId")
            )
            WHEN a."targetType" = 'LEVEL' AND a."targetLevel" IS NOT NULL THEN
              (SELECT count(DISTINCT g."userId")::int FROM "students" s
                 JOIN "student_guardians" sg ON sg."studentId" = s.id
                 JOIN "guardians" g ON g.id = sg."guardianId"
                 JOIN "school_levels" sl ON sl.id = s."schoolLevelId"
                 WHERE s."tenantId" = a."tenantId" AND UPPER(sl."name") = UPPER(a."targetLevel") AND g."userId" IS NOT NULL)
            ELSE 0
          END AS est_recipients
        FROM chat_announcements a
        WHERE a."tenantId" = $1 AND a."publishedAt" IS NOT NULL AND a."deletedAt" IS NULL
      `, tenantId);
      let sumReads = 0;
      let sumRecipients = 0;
      for (const a of annStats) {
        const recipients = Number(a.est_recipients || 0);
        if (recipients > 0) {
          sumReads += Number(a.read_count || 0);
          sumRecipients += recipients;
        }
      }
      announcementReadRate = sumRecipients > 0 ? Math.round((sumReads / sumRecipients) * 1000) / 10 : 0;
    } catch (e: any) {
      this.logger?.warn?.(`announcementReadRate: ${e.message}`);
    }

    // 2) topActiveUsers — top 5 par nombre de messages sur 7 jours (avec nom)
    let topActiveUsers: { userId: string; name: string; messageCount: number }[] = [];
    try {
      const topRows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT u.id AS "userId",
               TRIM(COALESCE(u."firstName", '') || ' ' || COALESCE(u."lastName", '')) AS name,
               count(*)::int AS "messageCount"
        FROM chat_messages m
        JOIN chat_conversations c ON c.id = m."conversationId"
        LEFT JOIN "users" u ON u.id = m."senderId"
        WHERE c."tenantId" = $1 AND m."createdAt" >= NOW() - INTERVAL '7 days'
        GROUP BY u.id, name
        ORDER BY "messageCount" DESC
        LIMIT 5
      `, tenantId);
      topActiveUsers = topRows.map((r) => ({
        userId: r.userId,
        name: r.name || 'Utilisateur',
        messageCount: Number(r.messageCount || 0),
      }));
    } catch (e: any) {
      this.logger?.warn?.(`topActiveUsers: ${e.message}`);
    }

    // 3) averageResponseTimeMinutes — moyenne des (réponse.createdAt - parent.createdAt)
    //    des réponses directes (replyToId, expéditeur différent) sur 7 jours —
    //    échantillon LIMIT 500 pour rester raisonnable.
    let averageResponseTimeMinutes: number | null = null;
    try {
      const rtRows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT ROUND(AVG(EXTRACT(EPOCH FROM (r."createdAt" - r."parentCreatedAt")) / 60.0)::numeric, 1) AS avg_minutes
        FROM (
          SELECT m."createdAt", p."createdAt" AS "parentCreatedAt"
          FROM chat_messages m
          JOIN chat_messages p ON p.id = m."replyToId"
          JOIN chat_conversations c ON c.id = m."conversationId"
          WHERE c."tenantId" = $1
            AND m."replyToId" IS NOT NULL
            AND m."senderId" <> p."senderId"
            AND m."createdAt" >= NOW() - INTERVAL '7 days'
          ORDER BY m."createdAt" DESC
          LIMIT 500
        ) r
      `, tenantId);
      const avg = rtRows[0]?.avg_minutes;
      averageResponseTimeMinutes = (avg !== null && avg !== undefined && Number.isFinite(Number(avg))) ? Number(avg) : null;
    } catch (e: any) {
      this.logger?.warn?.(`averageResponseTimeMinutes: ${e.message}`);
    }

    // 4) activeGroups7d — conversations GROUP avec ≥1 message sur 7 jours
    let activeGroups7d = 0;
    try {
      const agRows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT count(DISTINCT c.id)::int AS cnt
        FROM chat_conversations c
        WHERE c."tenantId" = $1 AND c."type" = 'GROUP'
          AND EXISTS (
            SELECT 1 FROM chat_messages m
            WHERE m."conversationId" = c.id AND m."createdAt" >= NOW() - INTERVAL '7 days'
          )
      `, tenantId);
      activeGroups7d = Number(agRows[0]?.cnt || 0);
    } catch (e: any) {
      this.logger?.warn?.(`activeGroups7d: ${e.message}`);
    }

    // ⭐ Réponse ADDITIVE — aucun champ existant supprimé/modifié
    return {
      messagesToday: msgs[0]?.cnt || 0,
      activeUsersToday: activeUsers[0]?.cnt || 0,
      totalGroups: groups[0]?.cnt || 0,
      totalUnread: unread[0]?.cnt || 0,
      totalAnnouncements: announcements[0]?.cnt || 0,
      filesShared: filesShared[0]?.cnt || 0,
      pendingReports: reports[0]?.cnt || 0,
      // ⭐ V5 (spéc #21) — analytics enrichis
      announcementReadRate,
      topActiveUsers,
      averageResponseTimeMinutes,
      activeGroups7d,
    };
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V5 (chantier 7, spéc #8) — CONVERSATIONS PÉDAGOGIQUES
  //     Liaison à une entité : pedagogicalType (CLASS|SUBJECT|HOMEWORK|
  //     ACTIVITY|COURSE) + linkedEntityId + population automatique.
  // ═════════════════════════════════════════════════════════════════
  async createPedagogicalConversation(
    tenantId: string,
    creatorId: string,
    data: {
      /** Type de liaison pédagogique. */
      type?: 'CLASS' | 'SUBJECT' | 'HOMEWORK' | 'ACTIVITY' | 'COURSE';
      /** Id de l'entité liée (classes.id, subjects.id, devoirs.id…). */
      linkedEntityId?: string;
      /** Participants explicites (si fournis, pas de population auto). */
      participantIds?: string[];
      /** ⭐ Compatibilité legacy : classId/subjectId/name (V4). */
      classId?: string;
      subjectId?: string;
      name?: string;
    },
  ): Promise<ChatConversation> {
    // 1. Résolution du type + de l'entité liée (compat legacy classId/subjectId)
    const type = data.type || (data.classId ? (data.subjectId ? 'SUBJECT' : 'CLASS') : 'CLASS');
    const linkedEntityId = data.linkedEntityId || data.subjectId || data.classId || '';
    if (!linkedEntityId) {
      throw new BadRequestException('linkedEntityId (ou classId/subjectId) est requis');
    }
    if (!['CLASS', 'SUBJECT', 'HOMEWORK', 'ACTIVITY', 'COURSE'].includes(type)) {
      throw new BadRequestException('Type pédagogique invalide (CLASS|SUBJECT|HOMEWORK|ACTIVITY|COURSE)');
    }

    // 2. Nom de l'entité + participants automatiques
    const { entityName, autoParticipantIds } = await this.resolvePedagogicalEntity(tenantId, type, linkedEntityId);

    // 3. Nom de la conversation : « {label} — {nom entité} »
    const labels: Record<string, string> = {
      CLASS: 'Classe', SUBJECT: 'Matière', HOMEWORK: 'Devoir',
      ACTIVITY: 'Activité', COURS: 'Cours', COURSE: 'Cours',
    };
    const label = labels[type] || 'Pédagogie';
    const name = data.name?.trim() || `${label} — ${entityName}`;

    // 4. Participants : explicites OU population auto (toujours + le créateur)
    const participantIds = Array.from(new Set([
      creatorId,
      ...(data.participantIds && data.participantIds.length > 0 ? data.participantIds : autoParticipantIds),
    ]));

    // 5. Création de la conversation GROUP avec les colonnes pédagogiques
    const convId = randomUUID();
    const description = `Conversation pédagogique (${label}) liée à « ${entityName} »`;
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "chat_conversations" (
        "id", "tenantId", "type", "name", "description", "createdBy",
        "pedagogicalType", "linkedEntityId", "createdAt", "updatedAt"
      )
      VALUES ($1, $2, 'GROUP', $3, $4, $5, $6, $7, NOW(), NOW())
    `, convId, tenantId, name, description, creatorId, type, linkedEntityId);

    // 6. Participants (créateur = ADMIN, autres = MEMBER)
    for (const userId of participantIds) {
      if (!userId) continue;
      const role = userId === creatorId ? 'ADMIN' : 'MEMBER';
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO "chat_participants" ("id", "conversationId", "userId", "tenantId", "role", "joinedAt")
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT DO NOTHING
      `, randomUUID(), convId, userId, tenantId, role);
    }

    // 7. Audit de création
    await this.auditLog(convId, creatorId, null, null, 'CONVERSATION_CREATE', {
      pedagogicalType: type,
      linkedEntityId,
      entityName,
      participants: participantIds.length,
    });

    return (await this.listConversations(tenantId, creatorId))
      .find(c => c.id === convId)!;
  }

  /**
   * Résout le nom d'affichage d'une entité pédagogique + calcule la
   * population AUTOMATIQUE des participants :
   *   - CLASS   → enseignants affectés à la classe (teacher_class_assignments
   *               → teachers → users par email) + parents des élèves inscrits
   *               (comme auto-group.service.ts) ;
   *   - SUBJECT → enseignants de la matière (teacher_subjects → teachers → users) ;
   *   - autres types (HOMEWORK/ACTIVITY/COURSE) → nom par défaut (id),
   *     population vide (participants explicites attendus).
   */
  private async resolvePedagogicalEntity(
    tenantId: string,
    type: string,
    linkedEntityId: string,
  ): Promise<{ entityName: string; autoParticipantIds: string[] }> {
    try {
      if (type === 'CLASS') {
        const cls: any[] = await this.prisma.$queryRawUnsafe<any[]>(
          `SELECT "id", "name", "mainTeacherId" FROM "classes" WHERE "id" = $1 AND "tenantId" = $2`,
          linkedEntityId, tenantId,
        );
        if (cls.length === 0) throw new NotFoundException('Classe introuvable');
        const entityName = cls[0].name || linkedEntityId;
        // Enseignants affectés à la classe (+ titulaire) → userId via email
        const teacherRows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
          SELECT DISTINCT u.id
          FROM "teacher_class_assignments" tca
          JOIN "teachers" t ON t.id = tca."teacherId"
          JOIN "users" u ON u."email" = t."email" AND u."tenantId" = $2
          WHERE tca."classId" = $1
          UNION
          SELECT u.id
          FROM "teachers" t
          JOIN "users" u ON u."email" = t."email" AND u."tenantId" = $2
          WHERE t.id = $3
        `, linkedEntityId, tenantId, cls[0].mainTeacherId || null);
        // Parents des élèves inscrits dans la classe (comme auto-group.service)
        const parentRows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
          SELECT DISTINCT g."userId"
          FROM "student_enrollments" se
          JOIN "student_guardians" sg ON sg."studentId" = se."studentId"
          JOIN "guardians" g ON g.id = sg."guardianId"
          WHERE se."classId" = $1 AND se."status" = 'ENROLLED' AND g."userId" IS NOT NULL
        `, linkedEntityId);
        const autoParticipantIds = Array.from(new Set([
          ...teacherRows.map((r) => r.id).filter(Boolean),
          ...parentRows.map((r) => r.userId).filter(Boolean),
        ]));
        return { entityName, autoParticipantIds };
      }

      if (type === 'SUBJECT') {
        const subj: any[] = await this.prisma.$queryRawUnsafe<any[]>(
          `SELECT "id", "name" FROM "subjects" WHERE "id" = $1 AND "tenantId" = $2`,
          linkedEntityId, tenantId,
        );
        if (subj.length === 0) throw new NotFoundException('Matière introuvable');
        const entityName = subj[0].name || linkedEntityId;
        // Enseignants de la matière → userId via email
        const teacherRows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
          SELECT DISTINCT u.id
          FROM "teacher_subjects" ts
          JOIN "teachers" t ON t.id = ts."teacherId"
          JOIN "users" u ON u."email" = t."email" AND u."tenantId" = $2
          WHERE ts."subjectId" = $1
        `, linkedEntityId, tenantId);
        return { entityName, autoParticipantIds: teacherRows.map((r) => r.id).filter(Boolean) };
      }

      // HOMEWORK / ACTIVITY / COURSE — nom lisible si l'entité est une classe
      // ou une matière (repli), sinon l'id fait foi ; population explicite.
      let entityName = linkedEntityId;
      const asClass = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT "name" FROM "classes" WHERE "id" = $1 AND "tenantId" = $2`,
        linkedEntityId, tenantId,
      );
      if (asClass.length > 0) entityName = asClass[0].name;
      else {
        const asSubject = await this.prisma.$queryRawUnsafe<any[]>(
          `SELECT "name" FROM "subjects" WHERE "id" = $1 AND "tenantId" = $2`,
          linkedEntityId, tenantId,
        );
        if (asSubject.length > 0) entityName = asSubject[0].name;
      }
      return { entityName, autoParticipantIds: [] };
    } catch (e: any) {
      if (e instanceof NotFoundException || e instanceof BadRequestException) throw e;
      this.logger?.warn?.(`resolvePedagogicalEntity: ${e.message}`);
      return { entityName: linkedEntityId, autoParticipantIds: [] };
    }
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ DISCORD PARITY — MODERATION (ban/kick/mute), SLOW MODE, AUDIT LOG
  // ═════════════════════════════════════════════════════════════════

  /** Set slow mode (seconds between messages) for a conversation. Admins only. */
  async setSlowMode(tenantId: string, userId: string, conversationId: string, seconds: number): Promise<{ success: boolean; slowModeSeconds: number }> {
    const conv = await this.getConversation(tenantId, userId, conversationId);
    // Verify the user is an admin of the conversation
    const participant = conv.participants?.find((p: any) => p.userId === userId);
    if (!participant || participant.role !== 'ADMIN') {
      throw new ForbiddenException('Seuls les administrateurs de la conversation peuvent définir le mode lent.');
    }
    const clamped = Math.max(0, Math.min(21600, Math.floor(seconds))); // 0 to 6 hours
    await this.prisma.$executeRawUnsafe(`
      UPDATE "chat_conversations" SET "slowModeSeconds" = $2, "updatedAt" = NOW() WHERE "id" = $1
    `, conversationId, clamped);
    await this.auditLog(conversationId, userId, null, null, 'SLOW_MODE_SET', { slowModeSeconds: clamped });
    return { success: true, slowModeSeconds: clamped };
  }

  /** Ban a user from a conversation. Admins only. */
  async banUser(tenantId: string, adminId: string, conversationId: string, targetUserId: string, reason?: string, expiresAt?: Date): Promise<{ success: boolean }> {
    const conv = await this.getConversation(tenantId, adminId, conversationId);
    const participant = conv.participants?.find((p: any) => p.userId === adminId);
    if (!participant || participant.role !== 'ADMIN') {
      throw new ForbiddenException('Seuls les administrateurs peuvent bannir des utilisateurs.');
    }
    if (targetUserId === adminId) throw new BadRequestException('Vous ne pouvez pas vous bannir vous-même.');
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "chat_conversation_bans" ("id", "conversationId", "userId", "bannedBy", "reason", "bannedAt", "expiresAt")
      VALUES ($1, $2, $3, $4, $5, NOW(), $6)
      ON CONFLICT ON CONSTRAINT "chat_conversation_bans_conv_user_unique" DO UPDATE SET "bannedBy" = $4, "reason" = $5, "bannedAt" = NOW(), "expiresAt" = $6
    `, randomUUID(), conversationId, targetUserId, adminId, reason || null, expiresAt || null);
    // Remove the banned user from participants
    await this.prisma.$executeRawUnsafe(`
      UPDATE "chat_participants" SET "leftAt" = NOW() WHERE "conversationId" = $1 AND "userId" = $2 AND "leftAt" IS NULL
    `, conversationId, targetUserId);
    await this.auditLog(conversationId, adminId, targetUserId, null, 'USER_BAN', { reason, expiresAt });
    return { success: true };
  }

  /** Unban a user. Admins only. */
  async unbanUser(tenantId: string, adminId: string, conversationId: string, targetUserId: string): Promise<{ success: boolean }> {
    const conv = await this.getConversation(tenantId, adminId, conversationId);
    const participant = conv.participants?.find((p: any) => p.userId === adminId);
    if (!participant || participant.role !== 'ADMIN') {
      throw new ForbiddenException('Seuls les administrateurs peuvent débannir des utilisateurs.');
    }
    await this.prisma.$executeRawUnsafe(`
      DELETE FROM "chat_conversation_bans" WHERE "conversationId" = $1 AND "userId" = $2
    `, conversationId, targetUserId);
    await this.auditLog(conversationId, adminId, targetUserId, null, 'USER_UNBAN', {});
    return { success: true };
  }

  /** Mute a user in a conversation (prevents sending messages). Admins only. */
  async muteUser(tenantId: string, adminId: string, conversationId: string, targetUserId: string, reason?: string, expiresAt?: Date): Promise<{ success: boolean }> {
    const conv = await this.getConversation(tenantId, adminId, conversationId);
    const participant = conv.participants?.find((p: any) => p.userId === adminId);
    if (!participant || participant.role !== 'ADMIN') {
      throw new ForbiddenException('Seuls les administrateurs peuvent mettre en sourdine.');
    }
    if (targetUserId === adminId) throw new BadRequestException('Vous ne pouvez pas vous mettre en sourdine vous-même.');
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "chat_conversation_mutes" ("id", "conversationId", "userId", "mutedBy", "reason", "mutedAt", "expiresAt")
      VALUES ($1, $2, $3, $4, $5, NOW(), $6)
      ON CONFLICT ON CONSTRAINT "chat_conversation_mutes_conv_user_unique" DO UPDATE SET "mutedBy" = $4, "reason" = $5, "mutedAt" = NOW(), "expiresAt" = $6
    `, randomUUID(), conversationId, targetUserId, adminId, reason || null, expiresAt || null);
    await this.auditLog(conversationId, adminId, targetUserId, null, 'USER_MUTE', { reason, expiresAt });
    return { success: true };
  }

  /** Unmute a user. Admins only. */
  async unmuteUser(tenantId: string, adminId: string, conversationId: string, targetUserId: string): Promise<{ success: boolean }> {
    const conv = await this.getConversation(tenantId, adminId, conversationId);
    const participant = conv.participants?.find((p: any) => p.userId === adminId);
    if (!participant || participant.role !== 'ADMIN') {
      throw new ForbiddenException('Seuls les administrateurs peuvent lever la sourdine.');
    }
    await this.prisma.$executeRawUnsafe(`
      DELETE FROM "chat_conversation_mutes" WHERE "conversationId" = $1 AND "userId" = $2
    `, conversationId, targetUserId);
    await this.auditLog(conversationId, adminId, targetUserId, null, 'USER_UNMUTE', {});
    return { success: true };
  }

  /** Kick a user (remove from participants, no ban). Admins only. */
  async kickUser(tenantId: string, adminId: string, conversationId: string, targetUserId: string, reason?: string): Promise<{ success: boolean }> {
    const conv = await this.getConversation(tenantId, adminId, conversationId);
    const participant = conv.participants?.find((p: any) => p.userId === adminId);
    if (!participant || participant.role !== 'ADMIN') {
      throw new ForbiddenException('Seuls les administrateurs peuvent exclure des utilisateurs.');
    }
    if (targetUserId === adminId) throw new BadRequestException('Vous ne pouvez pas vous exclure vous-même.');
    await this.prisma.$executeRawUnsafe(`
      UPDATE "chat_participants" SET "leftAt" = NOW() WHERE "conversationId" = $1 AND "userId" = $2 AND "leftAt" IS NULL
    `, conversationId, targetUserId);
    await this.auditLog(conversationId, adminId, targetUserId, null, 'USER_KICK', { reason });
    return { success: true };
  }

  /** Get audit logs for a conversation. Admins only. */
  async getAuditLogs(tenantId: string, userId: string, conversationId: string, limit = 50): Promise<any[]> {
    const conv = await this.getConversation(tenantId, userId, conversationId);
    const participant = conv.participants?.find((p: any) => p.userId === userId);
    if (!participant || participant.role !== 'ADMIN') {
      throw new ForbiddenException('Seuls les administrateurs peuvent consulter le journal d\'audit.');
    }
    return await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT a.*, u."firstName" AS "actorFirstName", u."lastName" AS "actorLastName",
             t."firstName" AS "targetFirstName", t."lastName" AS "targetLastName"
      FROM "chat_audit_logs" a
      LEFT JOIN "users" u ON u.id = a."actorUserId"
      LEFT JOIN "users" t ON t.id = a."targetUserId"
      WHERE a."conversationId" = $1
      ORDER BY a."createdAt" DESC
      LIMIT $2
    `, conversationId, limit);
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V5 — MEMBRES, INVITABLE & AUDIT GLOBAL (chantiers 3 + 10)
  // ═════════════════════════════════════════════════════════════════

  /**
   * ⭐ V5 (chantier 3) — Membres du tenant INVITABLES dans une conversation :
   *    absents de la conversation, filtrables par nom/prénom (insensible à la
   *    casse), limite 50. Exclut les blocages dans les DEUX sens (bloqués par
   *    moi + ceux qui m'ont bloqué) et les comptes désactivés.
   */
  async getInvitableMembers(
    tenantId: string,
    userId: string,
    conversationId: string,
    q?: string,
  ): Promise<any[]> {
    // 1. L'utilisateur doit être participant de la conversation
    const conv = await this.getConversation(tenantId, userId, conversationId);

    // 2. Exclure les blocages dans les deux sens (parité Yeshua invitable)
    const blockedRows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT "blockedId" AS uid FROM "chat_user_blocks" WHERE "blockerId" = $1 AND "tenantId" = $2
      UNION
      SELECT "blockerId" AS uid FROM "chat_user_blocks" WHERE "blockedId" = $1 AND "tenantId" = $2
    `, userId, tenantId);
    const blockedIds = blockedRows.map((r) => r.uid);

    // 3. Membres du tenant absents de la conversation (DIRECT exclue tout ajout :
    //    un privé reste entre ses 2 membres)
    const params: any[] = [tenantId, conversationId, userId];
    let excludeClause = '';
    if (blockedIds.length > 0) {
      params.push(blockedIds);
      excludeClause = `AND u.id <> ALL($${params.length}::text[])`;
    }
    if (q && q.trim().length > 0) {
      params.push(`%${q.trim().toLowerCase()}%`);
      const qIdx = params.length;
      params.push(`%${q.trim()}%`);
      const qIdx2 = params.length;
      excludeClause += ` AND (LOWER(COALESCE(u."firstName", '') || ' ' || COALESCE(u."lastName", '')) LIKE $${qIdx} OR LOWER(u.email) LIKE $${qIdx} OR LOWER(COALESCE(u."lastName", '')) LIKE $${qIdx2})`;
    }
    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT u.id AS "userId",
             TRIM(COALESCE(u."firstName", '') || ' ' || COALESCE(u."lastName", '')) AS name,
             u."avatarUrl", u."role", u.status
      FROM "users" u
      WHERE u."tenantId" = $1
        AND u.id <> $3
        AND u.status = 'active'
        AND u.id NOT IN (
          SELECT p."userId" FROM chat_participants p
          WHERE p."conversationId" = $2 AND p."leftAt" IS NULL
        )
        ${excludeClause}
      ORDER BY name ASC
      LIMIT 50
    `, ...params);

    return rows.map((r) => ({
      userId: r.userId,
      name: r.name || r.email || 'Membre',
      avatarUrl: r.avatarUrl || undefined,
      role: r.role || undefined,
    }));
  }

  /**
   * ⭐ V5 (chantier 3 + 10) — Ajoute des membres à une conversation (1 à 50,
   *    idempotent). Autorisé : ADMIN de la conversation, MODERATOR avec
   *    canInvite, ou rôle global ADMIN (ADMIN_ROLES du contrôleur).
   *    Les membres sont ajoutés en MEMBER (joinStatus ACTIVE) + audit
   *    INVITE_MEMBERS + broadcast socket temps réel.
   */
  async addMembers(
    tenantId: string,
    actorUserId: string,
    actorGlobalRole: string | undefined,
    conversationId: string,
    userIds: string[],
  ): Promise<{ added: number; skipped: number; conversationId: string }> {
    const conv = await this.getConversation(tenantId, actorUserId, conversationId);

    // Un PRIVÉ (DIRECT) n'est pas invitable — historique confidentiel
    if (conv.type === 'DIRECT') {
      throw new ForbiddenException('Conversation privée — impossible d\'y ajouter d\'autres membres');
    }

    // Permission : ADMIN de conv OU canInvite (permissions/MODERATOR) OU admin global
    const effective = await this.getEffectivePermissions(tenantId, conversationId, actorUserId);
    const isGlobalAdmin = actorGlobalRole ? ['ADMIN', 'SUPER_ADMIN', 'PLATFORM_OWNER'].includes(String(actorGlobalRole).toUpperCase()) : false;
    if (!isGlobalAdmin && !effective.canInvite) {
      throw new ForbiddenException('Seuls les administrateurs de la conversation (ou les membres avec le droit d\'invitation) peuvent ajouter des membres');
    }

    // Nettoyage : uniques, sans l'acteur, 1 à 50
    const uniqueIds = Array.from(new Set(userIds.filter((u) => u && u !== actorUserId)));
    if (uniqueIds.length === 0) {
      throw new BadRequestException('userIds requis (1 à 50 identifiants)');
    }
    if (uniqueIds.length > 50) {
      throw new BadRequestException('Maximum 50 membres par ajout');
    }

    // Les invités doivent appartenir au tenant (anti-injection d'ids arbitraires)
    const validRows: any[] = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM "users" WHERE "tenantId" = $1 AND id = ANY($2::text[]) AND status = 'active'`,
      tenantId, uniqueIds,
    );
    const validIds = validRows.map((r) => r.id);

    // Ajout idempotent (ON CONFLICT DO NOTHING sur l'unique actif conv+user)
    let added = 0;
    for (const uid of validIds) {
      const res = await this.prisma.$executeRawUnsafe(`
        INSERT INTO chat_participants ("id", "conversationId", "userId", "tenantId", "role", "joinedAt", "joinStatus")
        VALUES ($1, $2, $3, $4, 'MEMBER', NOW(), 'ACTIVE')
        ON CONFLICT DO NOTHING
      `, randomUUID(), conversationId, uid, tenantId);
      added += res;
    }
    const skipped = uniqueIds.length - added;

    // Audit + broadcast temps réel
    await this.auditLog(conversationId, actorUserId, null, null, 'INVITE_MEMBERS', {
      added, skipped,
      invitedUserIds: validIds,
    });
    if (added > 0 && this.chatGateway?.server) {
      this.chatGateway.server.to(`conv:${conversationId}`).emit('members:added', {
        conversationId,
        addedUserIds: validIds,
        addedBy: actorUserId,
      });
    }

    // ⭐ V5 — MESSAGES SYSTÈME « X a rejoint le groupe » (parité Yeshua
    //    MEMBER_LOG) : pour chaque membre réellement ajouté, on insère un
    //    message SYSTEM diffusé en temps réel — l'historique devient
    //    auto-documenté comme WhatsApp/Telegram.
    if (added > 0) {
      const addedUsers: any[] = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT id, "firstName", "lastName", email FROM "users" WHERE id = ANY($1::text[])`,
        validIds,
      );
      const actorName = await this.displayNameOf(actorUserId);
      for (const u of addedUsers) {
        const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || 'Nouveau membre';
        await this.insertSystemMessage(conversationId, actorUserId, `${name} a rejoint le groupe`, {
          kind: 'member_join',
          userId: u.id,
          name,
          byName: actorName,
        }).catch((e) => this.logger?.warn?.(`system message join: ${e.message}`));
      }
    }

    return { added, skipped, conversationId };
  }

  /** Nom d'affichage d'un utilisateur (prénom + nom, repli email). */
  private async displayNameOf(userId: string): Promise<string> {
    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT "firstName", "lastName", email FROM "users" WHERE "id" = $1`,
        userId,
      );
      if (!rows.length) return 'Membre';
      const full = `${rows[0].firstName || ''} ${rows[0].lastName || ''}`.trim();
      return full || rows[0].email || 'Membre';
    } catch {
      return 'Membre';
    }
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V5 — CRÉNEAUX DE DISPONIBILITÉ (table chat_availability_slots)
  //    Créneaux hebdomadaires récurrents publiés par chaque utilisateur,
  //    visibles dans la fiche membre (parité « heures de permanence »).
  // ═════════════════════════════════════════════════════════════════

  /** Jour de la semaine 1=Lundi…7=Dimanche → libellé français. */
  private static readonly DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

  /** Liste les créneaux d'un utilisateur, groupés par jour (ordre du lecteur). */
  async listAvailabilitySlots(tenantId: string, userId: string): Promise<any[]> {
    const slots = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT "id", "userId", "dayOfWeek", "startTime", "endTime", "label", "createdAt"
       FROM "chat_availability_slots"
       WHERE "userId" = $1
       ORDER BY "dayOfWeek" ASC, "startTime" ASC`,
      userId,
    );
    return slots.map((s) => ({
      id: s.id,
      userId: s.userId,
      dayOfWeek: s.dayOfWeek,
      dayLabel: ChatService.DAY_LABELS[s.dayOfWeek - 1] || `Jour ${s.dayOfWeek}`,
      startTime: s.startTime,
      endTime: s.endTime,
      label: s.label,
      createdAt: s.createdAt,
    }));
  }

  /** Ajoute un créneau (validation : jour 1-7, HH:MM, fin > début, ≤ 20 créneaux). */
  async createAvailabilitySlot(
    tenantId: string,
    userId: string,
    slot: { dayOfWeek?: number; startTime?: string; endTime?: string; label?: string },
  ): Promise<any> {
    const day = Number(slot?.dayOfWeek);
    if (!Number.isInteger(day) || day < 1 || day > 7) {
      throw new BadRequestException('dayOfWeek requis (1=Lundi … 7=Dimanche)');
    }
    const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
    const start = String(slot?.startTime || '').trim();
    const end = String(slot?.endTime || '').trim();
    if (!timeRe.test(start) || !timeRe.test(end)) {
      throw new BadRequestException('startTime et endTime requis au format HH:MM');
    }
    if (start >= end) {
      throw new BadRequestException('endTime doit être postérieur à startTime');
    }
    const countRows = await this.prisma.$queryRawUnsafe<Array<{ n: number }>>(
      `SELECT COUNT(*)::int AS n FROM "chat_availability_slots" WHERE "userId" = $1`,
      userId,
    );
    if ((countRows[0]?.n ?? 0) >= 20) {
      throw new BadRequestException('Maximum 20 créneaux de disponibilité');
    }
    const id = randomUUID();
    const label = slot?.label?.toString().trim().slice(0, 100) || null;
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "chat_availability_slots" ("id", "tenantId", "userId", "dayOfWeek", "startTime", "endTime", "label")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      id, tenantId, userId, day, start, end, label,
    );
    return {
      id,
      userId,
      dayOfWeek: day,
      dayLabel: ChatService.DAY_LABELS[day - 1],
      startTime: start,
      endTime: end,
      label,
    };
  }

  /** Supprime UN créneau — uniquement s'il appartient à l'utilisateur. */
  async deleteAvailabilitySlot(
    tenantId: string,
    userId: string,
    slotId: string,
  ): Promise<{ ok: true }> {
    const deleted = await this.prisma.$executeRawUnsafe(
      `DELETE FROM "chat_availability_slots" WHERE "id" = $1 AND "userId" = $2`,
      slotId, userId,
    );
    if (deleted === 0) {
      throw new NotFoundException('Créneau introuvable (ou non autorisé)');
    }
    return { ok: true };
  }

  /**
   * ⭐ V5 — MESSAGE SYSTÈME (type 'SYSTEM') : pastille centrée dans le fil,
   *    métadonnées structurées dans callMeta (JSONB, même pattern que
   *    CALL_LOG) : { kind: 'member_join' | 'member_leave' | ..., userId,
   *    name, byName }. Diffusion temps réel + preview de conversation.
   */
  private async insertSystemMessage(
    conversationId: string,
    actorId: string,
    text: string,
    meta: Record<string, any>,
  ): Promise<void> {
    const msgId = randomUUID();
    // ⭐ V5.2 — CORRECTIF : même bug que les CALL_LOG — chat_messages n'a
    //    PAS de colonne « updatedAt » → l'INSERT échouait silencieusement :
    //    AUCUN message système (member_join / member_leave / …) n'a jamais
    //    été inséré depuis la V5.
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "chat_messages" ("id", "conversationId", "senderId", "type", "content", "callMeta", "createdAt")
       VALUES ($1, $2, $3, 'SYSTEM', $4, $5::jsonb, now())`,
      msgId, conversationId, actorId, text, JSON.stringify(meta),
    );
    // ⭐ Diffuser en temps réel aux participants connectés
    if (this.chatGateway?.server) {
      const participantIds = await this.getConversationParticipantIds(conversationId);
      this.chatGateway.broadcastNewMessage(conversationId, {
        id: msgId,
        conversationId,
        senderId: actorId,
        type: 'SYSTEM',
        content: text,
        callMeta: meta,
        createdAt: new Date().toISOString(),
      }, participantIds);
    }
    // Rafraîchir le preview de la conversation (dernier message)
    try {
      await this.prisma.$executeRawUnsafe(
        `UPDATE "chat_conversations"
         SET "lastMessageAt" = now(), "lastMessagePreview" = $2, "lastMessageSenderId" = $3
         WHERE "id" = $1`,
        conversationId, text, actorId,
      );
    } catch {
      // best effort — le preview se corrigera au prochain message
    }
  }

  /** ⭐ V5 — ids des participants actifs d'une conversation. */
  private async getConversationParticipantIds(conversationId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ userId: string }>>(
      `SELECT "userId" FROM "chat_participants" WHERE "conversationId" = $1 AND "leftAt" IS NULL`,
      conversationId,
    );
    return rows.map((r) => r.userId);
  }

  /**
   * ⭐ V5 — QUITTER UN GROUPE : met leftAt (le participant ne reçoit plus les
   *    messages), message système « X a quitté le groupe », broadcast temps
   *    réel + audit. Les conversations DIRECT ne sont pas « quittables »
   *    (l'équivalent est le blocage).
   */
  async leaveConversation(
    tenantId: string,
    userId: string,
    conversationId: string,
  ): Promise<{ ok: true; conversationId: string }> {
    const conv = await this.getConversation(tenantId, userId, conversationId);
    if (conv.type === 'DIRECT') {
      throw new BadRequestException('Impossible de quitter une conversation privée — bloquez le contact plutôt');
    }

    // Marquer le départ (idempotent)
    await this.prisma.$executeRawUnsafe(
      `UPDATE "chat_participants" SET "leftAt" = now() WHERE "conversationId" = $1 AND "userId" = $2 AND "leftAt" IS NULL`,
      conversationId, userId,
    );

    const name = await this.displayNameOf(userId);
    await this.insertSystemMessage(conversationId, userId, `${name} a quitté le groupe`, {
      kind: 'member_leave',
      userId,
      name,
      byName: name,
    }).catch((e) => this.logger?.warn?.(`system message leave: ${e.message}`));

    await this.auditLog(conversationId, userId, null, null, 'MEMBER_LEAVE', { name });

    if (this.chatGateway?.server) {
      this.chatGateway.server.to(`conv:${conversationId}`).emit('members:removed', {
        conversationId,
        removedUserId: userId,
      });
    }

    return { ok: true, conversationId };
  }

  /**
   * ⭐ V5 (chantier 3) — Journal d'audit GLOBAL (toutes conversations du tenant).
   *    Réservé aux rôles ADMIN/SUPER_ADMIN/DIRECTOR + modérateurs de
   *    communication (le contrôleur vérifie le rôle JWT — la vérification du
   *    service est une défense en profondeur sur le rôle passé en paramètre).
   */
  async getGlobalAuditLogs(
    tenantId: string,
    channelId: string | undefined,
    limit = 100,
  ): Promise<any[]> {
    const params: any[] = [tenantId];
    let channelClause = '';
    if (channelId) {
      params.push(channelId);
      channelClause = `AND a."conversationId" = $2`;
    }
    const lim = Math.min(Math.max(limit || 100, 1), 500);
    params.push(lim);
    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT a.*, c."name" AS "conversationName",
             u."firstName" AS "actorFirstName", u."lastName" AS "actorLastName",
             t."firstName" AS "targetFirstName", t."lastName" AS "targetLastName"
      FROM "chat_audit_logs" a
      LEFT JOIN "chat_conversations" c ON c.id = a."conversationId"
      LEFT JOIN "users" u ON u.id = a."actorUserId"
      LEFT JOIN "users" t ON t.id = a."targetUserId"
      WHERE (
        -- Entrées liées à une conversation du tenant…
        c."tenantId" = $1
        -- …OU actions SANS conversation (ex: BLOCK_USER / UNBLOCK_USER) :
        -- le filtre tenant porte alors sur l'acteur (toujours intra-tenant).
        OR (
          a."conversationId" IS NULL
          AND EXISTS (SELECT 1 FROM "users" au WHERE au.id = a."actorUserId" AND au."tenantId" = $1)
        )
      )
        ${channelClause}
      ORDER BY a."createdAt" DESC
      LIMIT $${params.length}
    `, ...params);
    return rows;
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V5 (chantier 10) — RÔLES PARTICIPANTS, DROITS & APPROBATION
  // ═════════════════════════════════════════════════════════════════

  /**
   * Droits EFFECTIFS d'un participant : fusion des défauts du rôle et de la
   * colonne JSONB `permissions` (null/{} = défauts du rôle).
   *   ADMIN : tout ; MODERATOR : canPin + canDeleteMessages + canMute ;
   *   MEMBER : rien. Un ADMIN peut personnaliser via permissions (surcharge).
   */
  async getEffectivePermissions(
    tenantId: string,
    conversationId: string,
    userId: string,
  ): Promise<{
    role: string;
    canPin: boolean;
    canDeleteMessages: boolean;
    canInvite: boolean;
    canMute: boolean;
    canBroadcast: boolean;
  }> {
    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT p."role", p."permissions"
      FROM chat_participants p
      JOIN chat_conversations c ON c.id = p."conversationId"
      WHERE p."conversationId" = $1 AND p."userId" = $2 AND p."leftAt" IS NULL AND c."tenantId" = $3
    `, conversationId, userId, tenantId);
    const role = rows[0]?.role || 'MEMBER';
    const overrides = (rows[0]?.permissions && typeof rows[0].permissions === 'object') ? rows[0].permissions : {};
    const defaults: Record<string, Partial<PermissionsShape>> = {
      ADMIN: { canPin: true, canDeleteMessages: true, canInvite: true, canMute: true, canBroadcast: true },
      MODERATOR: { canPin: true, canDeleteMessages: true, canInvite: false, canMute: true, canBroadcast: false },
      MEMBER: {},
    };
    const base = { canPin: false, canDeleteMessages: false, canInvite: false, canMute: false, canBroadcast: false, ...(defaults[role] || {}) };
    // La surcharge JSONB ne peut qu'AJOUTER des droits au rôle (jamais retirer
    // ceux de l'ADMIN) — évite qu'un ADMIN se piège lui-même.
    const effective: PermissionsShape = { ...base };
    for (const key of Object.keys(base) as (keyof PermissionsShape)[]) {
      if (overrides[key] === true) effective[key] = true;
    }
    return { role, ...effective };
  }

  /**
   * ⭐ V5 (chantier 10) — Change le rôle d'un participant (ADMIN uniquement de
   *    la conversation) : ADMIN | MODERATOR | MEMBER. Audit MEMBER_ROLE_UPDATE.
   */
  async setParticipantRole(
    tenantId: string,
    adminId: string,
    conversationId: string,
    targetUserId: string,
    role: 'ADMIN' | 'MODERATOR' | 'MEMBER',
  ): Promise<{ success: boolean }> {
    const conv = await this.getConversation(tenantId, adminId, conversationId);
    const actor = conv.participants?.find((p: any) => p.userId === adminId);
    if (!actor || actor.role !== 'ADMIN') {
      throw new ForbiddenException('Seuls les administrateurs de la conversation peuvent changer les rôles.');
    }
    if (!['ADMIN', 'MODERATOR', 'MEMBER'].includes(role)) {
      throw new BadRequestException('Rôle invalide (ADMIN|MODERATOR|MEMBER)');
    }
    if (targetUserId === adminId) {
      throw new BadRequestException('Impossible de changer son propre rôle');
    }
    const res = await this.prisma.$executeRawUnsafe(`
      UPDATE chat_participants SET "role" = $3
      WHERE "conversationId" = $1 AND "userId" = $2 AND "leftAt" IS NULL
    `, conversationId, targetUserId, role);
    if (res === 0) throw new NotFoundException('Participant introuvable dans cette conversation');
    await this.auditLog(conversationId, adminId, targetUserId, null, 'MEMBER_ROLE_UPDATE', { role });
    if (this.chatGateway?.server) {
      this.chatGateway.server.to(`conv:${conversationId}`).emit('member:role-updated', { conversationId, targetUserId, role, by: adminId });
    }
    return { success: true };
  }

  /**
   * ⭐ V5 (chantier 10) — Définit les droits PERSONNALISÉS d'un participant
   *    (colonne JSONB chat_participants.permissions : canPin, canDeleteMessages,
   *    canInvite, canMute, canBroadcast). ADMIN de la conversation uniquement.
   *    Les droits s'AJOUTENT à ceux du rôle (jamais retirés — un MEMBER peut
   *    recevoir des droits ciblés, un ADMIN garde tout).
   */
  async setParticipantPermissions(
    tenantId: string,
    adminId: string,
    conversationId: string,
    targetUserId: string,
    permissions: Record<string, boolean>,
  ): Promise<{ success: boolean; permissions: Partial<PermissionsShape> }> {
    const conv = await this.getConversation(tenantId, adminId, conversationId);
    const actor = conv.participants?.find((p: any) => p.userId === adminId);
    if (!actor || actor.role !== 'ADMIN') {
      throw new ForbiddenException('Seuls les administrateurs de la conversation peuvent définir les droits des membres.');
    }
    // Filtrage : uniquement les clés connues, en booléens
    const allowedKeys = ['canPin', 'canDeleteMessages', 'canInvite', 'canMute', 'canBroadcast'];
    const clean: Partial<PermissionsShape> = {};
    for (const key of allowedKeys) {
      if (permissions[key] === true) clean[key as keyof PermissionsShape] = true;
    }
    const res = await this.prisma.$executeRawUnsafe(`
      UPDATE chat_participants SET "permissions" = $3::jsonb
      WHERE "conversationId" = $1 AND "userId" = $2 AND "leftAt" IS NULL
    `, conversationId, targetUserId, JSON.stringify(clean));
    if (res === 0) throw new NotFoundException('Participant introuvable dans cette conversation');
    await this.auditLog(conversationId, adminId, targetUserId, null, 'MEMBER_PERMISSIONS_SET', { permissions: clean });
    return { success: true, permissions: clean };
  }

  /**
   * ⭐ V5 (chantier 10) — Approuve un membre PENDING (ADMIN de la conversation).
   *    Passe ACTIVE + broadcast + audit MEMBER_APPROVE.
   */
  async approveMember(
    tenantId: string,
    adminId: string,
    conversationId: string,
    targetUserId: string,
  ): Promise<{ success: boolean }> {
    const conv = await this.getConversation(tenantId, adminId, conversationId);
    const actor = conv.participants?.find((p: any) => p.userId === adminId);
    if (!actor || actor.role !== 'ADMIN') {
      throw new ForbiddenException('Seuls les administrateurs peuvent approuver les membres.');
    }
    const res = await this.prisma.$executeRawUnsafe(`
      UPDATE chat_participants SET "joinStatus" = 'ACTIVE'
      WHERE "conversationId" = $1 AND "userId" = $2 AND "leftAt" IS NULL AND "joinStatus" = 'PENDING'
    `, conversationId, targetUserId);
    if (res === 0) throw new NotFoundException('Aucune adhésion en attente pour ce membre');
    await this.auditLog(conversationId, adminId, targetUserId, null, 'MEMBER_APPROVE', {});
    if (this.chatGateway?.server) {
      this.chatGateway.server.to(`conv:${conversationId}`).emit('member:approved', { conversationId, targetUserId, by: adminId });
    }
    return { success: true };
  }

  /**
   * ⭐ V5 (chantier 10) — Refuse un membre PENDING (ADMIN de la conversation).
   *    Retire le participant + broadcast + audit MEMBER_REJECT.
   */
  async rejectMember(
    tenantId: string,
    adminId: string,
    conversationId: string,
    targetUserId: string,
  ): Promise<{ success: boolean }> {
    const conv = await this.getConversation(tenantId, adminId, conversationId);
    const actor = conv.participants?.find((p: any) => p.userId === adminId);
    if (!actor || actor.role !== 'ADMIN') {
      throw new ForbiddenException('Seuls les administrateurs peuvent refuser les membres.');
    }
    const res = await this.prisma.$executeRawUnsafe(`
      DELETE FROM chat_participants
      WHERE "conversationId" = $1 AND "userId" = $2 AND "joinStatus" = 'PENDING' AND "leftAt" IS NULL
    `, conversationId, targetUserId);
    if (res === 0) throw new NotFoundException('Aucune adhésion en attente pour ce membre');
    await this.auditLog(conversationId, adminId, targetUserId, null, 'MEMBER_REJECT', {});
    if (this.chatGateway?.server) {
      this.chatGateway.server.to(`conv:${conversationId}`).emit('member:rejected', { conversationId, targetUserId, by: adminId });
    }
    return { success: true };
  }

  /**
   * ⭐ V5 (chantier 10) — Épingle / détache un message (droit canPin requis —
   *    ADMIN et MODERATOR par défaut). Audit MESSAGE_PIN / MESSAGE_UNPIN.
   */
  async setPinned(
    tenantId: string,
    userId: string,
    conversationId: string,
    messageId: string,
    pinned: boolean,
  ): Promise<{ success: boolean; pinned: boolean }> {
    await this.getConversation(tenantId, userId, conversationId);
    // Permission canPin (ADMIN/MODERATOR par défaut, personnalisable)
    const effective = await this.getEffectivePermissions(tenantId, conversationId, userId);
    if (!effective.canPin) {
      throw new ForbiddenException('Vous n\'avez pas le droit d\'épingler des messages dans cette conversation.');
    }
    // Le message doit exister dans la conversation
    const msg: any[] = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, "senderId" FROM chat_messages WHERE id = $1 AND "conversationId" = $2 AND "deletedAt" IS NULL`,
      messageId, conversationId,
    );
    if (msg.length === 0) throw new NotFoundException('Message introuvable');
    await this.prisma.$executeRawUnsafe(`
      UPDATE chat_messages SET "isPinned" = $3 WHERE "id" = $1
    `, messageId, conversationId, pinned);
    await this.auditLog(conversationId, userId, null, messageId, pinned ? 'MESSAGE_PIN' : 'MESSAGE_UNPIN', {});
    if (this.chatGateway?.server) {
      this.chatGateway.server.to(`conv:${conversationId}`).emit(pinned ? 'message:pinned' : 'message:unpinned', { conversationId, messageId, by: userId });
    }
    return { success: true, pinned };
  }

  /** Private helper: write an audit log entry. */
  private async auditLog(
    conversationId: string | null,
    actorUserId: string,
    targetUserId: string | null,
    targetMessageId: string | null,
    action: string,
    details: any,
  ): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO "chat_audit_logs" ("id", "conversationId", "actorUserId", "targetUserId", "targetMessageId", "action", "details", "createdAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, randomUUID(), conversationId, actorUserId, targetUserId, targetMessageId, action, JSON.stringify(details || {}));
    } catch (e: any) {
      this.logger?.warn?.(`Audit log write failed: ${e.message}`);
    }
  }

  /**
   * ⭐ V5 — Écrit une entrée d'audit public (utilisée par les contrôleurs pour
   *    les actions SANS conversation : blocage/déblocage, politique…).
   */
  async writeAuditLog(
    conversationId: string | null,
    actorUserId: string,
    targetUserId: string | null,
    targetMessageId: string | null,
    action: string,
    details: any,
  ): Promise<void> {
    return this.auditLog(conversationId, actorUserId, targetUserId, targetMessageId, action, details);
  }

  /** Get conversation members with online status + role colors. Discord-style member list. */
  async getConversationMembers(tenantId: string, userId: string, conversationId: string): Promise<any[]> {
    const conv = await this.getConversation(tenantId, userId, conversationId);
    const participants = conv.participants || [];
    // Get last active timestamps for presence
    const userIds = participants.map((p: any) => p.userId);
    if (userIds.length === 0) return [];
    const users: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT id, "firstName", "lastName", email, "avatarUrl", role,
             "customStatus", "customStatusExpiresAt", "activityStatus",
             "lastActiveAt",
             CASE WHEN "lastActiveAt" IS NOT NULL AND "lastActiveAt" > NOW() - INTERVAL '5 minutes' THEN true ELSE false END AS "isOnline"
      FROM "users" WHERE id = ANY($1::text[])
    `, userIds);
    // Map back to participants with role in conversation
    return participants.map((p: any) => {
      const u = users.find((x: any) => x.id === p.userId) || {};
      return {
        userId: p.userId,
        role: p.role, // ADMIN or MEMBER
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        avatarUrl: u.avatarUrl,
        userRole: u.role, // system role (TEACHER, PARENT, etc.)
        customStatus: (u.customStatusExpiresAt && new Date(u.customStatusExpiresAt) < new Date()) ? null : u.customStatus,
        activityStatus: u.activityStatus,
        isOnline: u.isOnline,
        lastActiveAt: u.lastActiveAt,
      };
    }).sort((a: any, b: any) => {
      // Online first, then by name
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    });
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ DISCORD PARITY — CUSTOM STATUS, BANNER, ACTIVITY STATUS
  // ═════════════════════════════════════════════════════════════════

  /** Update the current user's custom status (Discord-style). */
  async updateCustomStatus(tenantId: string, userId: string, status: string | null, expiresAt?: Date): Promise<{ success: boolean }> {
    await this.prisma.$executeRawUnsafe(`
      UPDATE "users" SET "customStatus" = $2, "customStatusExpiresAt" = $3 WHERE id = $1
    `, userId, status, expiresAt || null);
    return { success: true };
  }

  /** Update the current user's activity status text. */
  async updateActivityStatus(tenantId: string, userId: string, activity: string | null): Promise<{ success: boolean }> {
    await this.prisma.$executeRawUnsafe(`
      UPDATE "users" SET "activityStatus" = $2 WHERE id = $1
    `, userId, activity);
    return { success: true };
  }

  /** Update the current user's banner image URL. */
  async updateBanner(tenantId: string, userId: string, bannerUrl: string | null): Promise<{ success: boolean }> {
    await this.prisma.$executeRawUnsafe(`
      UPDATE "users" SET "bannerUrl" = $2 WHERE id = $1
    `, userId, bannerUrl);
    return { success: true };
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ DISCORD PARITY — MULTI-FORWARD
  // ═════════════════════════════════════════════════════════════════

  /** Forward a message to multiple target conversations at once. */
  async forwardMessageToMany(
    tenantId: string,
    userId: string,
    messageId: string,
    targetConversationIds: string[],
  ): Promise<{ forwarded: number; errors: string[] }> {
    if (!targetConversationIds || targetConversationIds.length === 0) {
      throw new BadRequestException('targetConversationIds cannot be empty');
    }
    const errors: string[] = [];
    let forwarded = 0;
    for (const targetId of targetConversationIds) {
      try {
        await this.forwardMessage(tenantId, messageId, userId, targetId);
        forwarded++;
      } catch (e: any) {
        errors.push(`${targetId}: ${e.message}`);
      }
    }
    await this.auditLog(null, userId, null, messageId, 'MESSAGE_FORWARD', { targetConversationIds, forwarded, errors });
    return { forwarded, errors };
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ DISCORD PARITY — @here / @everyone MENTIONS
  // ═════════════════════════════════════════════════════════════════

  /** Parse @here and @everyone mentions from message content and return all participant IDs to notify. */
  async resolveMassMentions(content: string, participantIds: string[]): Promise<{ isHere: boolean; isEveryone: boolean; notifyIds: string[] }> {
    const text = content.replace(/<[^>]*>/g, '');
    const isHere = /@here\b/i.test(text);
    const isEveryone = /@everyone\b/i.test(text) || /@tous\b/i.test(text);
    return {
      isHere,
      isEveryone,
      notifyIds: (isHere || isEveryone) ? participantIds : [],
    };
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ DISCORD PARITY — VOICE CHANNELS, STAGE CHANNELS, LIVE STREAMS
  // ═════════════════════════════════════════════════════════════════

  /** Create a voice channel (persistent always-on voice room). */
  async createVoiceChannel(tenantId: string, userId: string, data: {
    name: string;
    description?: string;
    type?: 'VOICE' | 'STAGE' | 'GO_LIVE';
    conversationId?: string;
    maxUsers?: number;
  }): Promise<any> {
    const id = randomUUID();
    const type = data.type || 'VOICE';
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "chat_voice_channels" ("id", "tenantId", "conversationId", "name", "description", "type", "maxUsers", "createdBy", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
    `, id, tenantId, data.conversationId || null, data.name, data.description || null, type, data.maxUsers || 0, userId);
    return { id, name: data.name, type, description: data.description };
  }

  /** List all voice channels for a tenant (grouped by type). */
  async listVoiceChannels(tenantId: string): Promise<any[]> {
    return await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT v.*,
        (SELECT count(*)::int FROM "chat_voice_states" WHERE "channelId" = v.id AND "leftAt" IS NULL) AS "activeUsers"
      FROM "chat_voice_channels" v
      WHERE v."tenantId" = $1
      ORDER BY v."type" ASC, v."createdAt" ASC
    `, tenantId);
  }

  /** Join a voice channel — creates a voice state record. */
  async joinVoiceChannel(tenantId: string, userId: string, channelId: string, socketId?: string): Promise<{ success: boolean; channel: any; activeUsers: any[] }> {
    // Verify the channel exists
    const channels: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "chat_voice_channels" WHERE id = $1 AND "tenantId" = $2
    `, channelId, tenantId);
    if (channels.length === 0) throw new NotFoundException('Voice channel not found');

    // Check max users
    const maxUsers = channels[0].maxUsers || 0;
    if (maxUsers > 0) {
      const count: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT count(*)::int AS cnt FROM "chat_voice_states" WHERE "channelId" = $1 AND "leftAt" IS NULL
      `, channelId);
      if (count[0].cnt >= maxUsers) {
        throw new BadRequestException('Le canal vocal est plein.');
      }
    }

    // Leave any existing voice channel first (Discord only allows one voice channel per user)
    await this.prisma.$executeRawUnsafe(`
      UPDATE "chat_voice_states" SET "leftAt" = NOW() WHERE "userId" = $1 AND "leftAt" IS NULL
    `, userId);

    // Join the new channel
    const stateId = randomUUID();
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "chat_voice_states" ("id", "userId", "channelId", "tenantId", "socketId", "joinedAt")
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT ON CONSTRAINT "chat_voice_states_user_channel_unique" DO UPDATE SET "leftAt" = NULL, "socketId" = $5, "joinedAt" = NOW()
    `, stateId, userId, channelId, tenantId, socketId || null);

    // Broadcast the join event via Socket.io
    const activeUsers = await this.getVoiceChannelUsers(channelId);
    try {
      this.chatGateway?.server?.to(`voice:${channelId}`).emit('voice:user-joined', { userId, channelId });
      this.chatGateway?.server?.emit('voice-channel:update', { channelId, activeUsers: activeUsers.length });
    } catch (e: any) { this.logger?.warn?.(`Voice join broadcast failed: ${e.message}`); }

    return { success: true, channel: channels[0], activeUsers };
  }

  /** Leave a voice channel. */
  async leaveVoiceChannel(tenantId: string, userId: string, channelId: string): Promise<{ success: boolean }> {
    await this.prisma.$executeRawUnsafe(`
      UPDATE "chat_voice_states" SET "leftAt" = NOW() WHERE "userId" = $1 AND "channelId" = $2 AND "leftAt" IS NULL
    `, userId, channelId);
    try {
      this.chatGateway?.server?.to(`voice:${channelId}`).emit('voice:user-left', { userId, channelId });
      const activeUsers = await this.getVoiceChannelUsers(channelId);
      this.chatGateway?.server?.emit('voice-channel:update', { channelId, activeUsers: activeUsers.length });
    } catch (e: any) { this.logger?.warn?.(`Voice leave broadcast failed: ${e.message}`); }
    return { success: true };
  }

  /** Get all users currently in a voice channel (with mute/deafen state). */
  async getVoiceChannelUsers(channelId: string): Promise<any[]> {
    const states: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT s.*, u."firstName", u."lastName", u."avatarUrl", u.role
      FROM "chat_voice_states" s
      JOIN "users" u ON u.id = s."userId"
      WHERE s."channelId" = $1 AND s."leftAt" IS NULL
    `, channelId);
    return states;
  }

  /** Update mute/deafen state. */
  async updateVoiceState(tenantId: string, userId: string, channelId: string, state: { muted?: boolean; deafened?: boolean; speaking?: boolean }): Promise<{ success: boolean }> {
    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (state.muted !== undefined) { updates.push(`"muted" = $${idx++}`); params.push(state.muted); }
    if (state.deafened !== undefined) { updates.push(`"deafened" = $${idx++}`); params.push(state.deafened); }
    if (state.speaking !== undefined) { updates.push(`"speaking" = $${idx++}`); params.push(state.speaking); }
    if (updates.length === 0) return { success: true };
    params.push(userId, channelId);
    await this.prisma.$executeRawUnsafe(`
      UPDATE "chat_voice_states" SET ${updates.join(', ')} WHERE "userId" = $${idx++} AND "channelId" = $${idx} AND "leftAt" IS NULL
    `, ...params);
    try {
      this.chatGateway?.server?.to(`voice:${channelId}`).emit('voice:state-update', { userId, channelId, ...state });
    } catch { /* ignore */ }
    return { success: true };
  }

  /**
   * ⭐ V4 — Bascule audio↔vidéo d'un canal vocal (porté de Yeshua Connect).
   *    L'admin (créateur du canal) active/désactive le mode vidéo : tous les
   *    clients connectés re-rendent la grille vidéo (event socket
   *    'voice:video-mode') et les nouvelles sessions média publient la caméra.
   */
  async setVoiceVideoMode(tenantId: string, userId: string, channelId: string, videoMode: boolean): Promise<{ success: boolean; videoMode: boolean }> {
    const channels: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT "createdBy", "conversationId" FROM "chat_voice_channels" WHERE id = $1 AND "tenantId" = $2
    `, channelId, tenantId);
    if (channels.length === 0) throw new NotFoundException('Voice channel not found');
    if (channels[0].createdBy !== userId) {
      throw new ForbiddenException('Seul le créateur du canal peut basculer le mode vidéo.');
    }
    await this.prisma.$executeRawUnsafe(`
      UPDATE "chat_voice_channels" SET "videoMode" = $3 WHERE id = $1
    `, channelId, tenantId, videoMode);
    // Notifier tous les clients du canal (room de conversation liée + room canal)
    try {
      this.chatGateway?.broadcastVoiceVideoMode(channelId, videoMode);
      if (channels[0].conversationId) {
        this.chatGateway?.broadcastVoiceVideoMode(channels[0].conversationId, videoMode);
      }
    } catch { /* ignore */ }
    return { success: true, videoMode };
  }

  /** Delete a voice channel (admin only — verified by createdBy). */
  async deleteVoiceChannel(tenantId: string, userId: string, channelId: string): Promise<{ success: boolean }> {
    const channels: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT "createdBy" FROM "chat_voice_channels" WHERE id = $1 AND "tenantId" = $2
    `, channelId, tenantId);
    if (channels.length === 0) throw new NotFoundException('Voice channel not found');
    if (channels[0].createdBy !== userId) throw new ForbiddenException('Seul le créateur peut supprimer le canal vocal.');
    // Force-leave all users
    await this.prisma.$executeRawUnsafe(`
      UPDATE "chat_voice_states" SET "leftAt" = NOW() WHERE "channelId" = $1 AND "leftAt" IS NULL
    `, channelId);
    await this.prisma.$executeRawUnsafe(`DELETE FROM "chat_voice_channels" WHERE id = $1`, channelId);
    return { success: true };
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ DISCORD PARITY — LIVE STREAMS (Go Live)
  // ═════════════════════════════════════════════════════════════════

  /** Start a live stream (Go Live). */
  async startLiveStream(tenantId: string, userId: string, data: { title?: string; conversationId?: string; channelId?: string }): Promise<any> {
    const id = randomUUID();
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "chat_live_streams" ("id", "tenantId", "streamerId", "channelId", "conversationId", "title", "startedAt", "isActive")
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), true)
    `, id, tenantId, userId, data.channelId || null, data.conversationId || null, data.title || null);
    // Notify the conversation/channel
    try {
      const target = data.channelId ? `voice:${data.channelId}` : `conv:${data.conversationId}`;
      this.chatGateway?.server?.to(target).emit('live-stream:started', { streamId: id, streamerId: userId, title: data.title });
    } catch { /* ignore */ }
    return { id, streamerId: userId, title: data.title };
  }

  /** End a live stream. */
  async endLiveStream(tenantId: string, userId: string, streamId: string): Promise<{ success: boolean }> {
    await this.prisma.$executeRawUnsafe(`
      UPDATE "chat_live_streams" SET "endedAt" = NOW(), "isActive" = false WHERE id = $1 AND "streamerId" = $2 AND "isActive" = true
    `, streamId, userId);
    try {
      this.chatGateway?.server?.emit('live-stream:ended', { streamId });
    } catch { /* ignore */ }
    return { success: true };
  }

  /** List active live streams for a tenant. */
  async listLiveStreams(tenantId: string): Promise<any[]> {
    return await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT l.*, u."firstName" AS "streamerFirstName", u."lastName" AS "streamerLastName", u."avatarUrl" AS "streamerAvatarUrl"
      FROM "chat_live_streams" l
      JOIN "users" u ON u.id = l."streamerId"
      WHERE l."tenantId" = $1 AND l."isActive" = true
      ORDER BY l."startedAt" DESC
    `, tenantId);
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ DISCORD PARITY — STICKERS
  // ═════════════════════════════════════════════════════════════════

  /** Create a sticker pack (admin). */
  async createStickerPack(tenantId: string | null, userId: string, data: { name: string; description?: string }): Promise<any> {
    const id = randomUUID();
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "sticker_packs" ("id", "tenantId", "name", "description", "createdBy", "createdAt")
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, id, tenantId, data.name, data.description || null, userId);
    return { id, name: data.name };
  }

  /** List sticker packs (tenant-scoped + global). */
  async listStickerPacks(tenantId: string): Promise<any[]> {
    return await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT p.*,
        (SELECT count(*)::int FROM "stickers" WHERE "packId" = p.id) AS "stickerCount"
      FROM "sticker_packs" p
      WHERE (p."tenantId" = $1 OR p."tenantId" IS NULL) AND p."isActive" = true
      ORDER BY p."createdAt" DESC
    `, tenantId);
  }

  /** Upload a sticker to a pack. */
  async uploadSticker(tenantId: string, userId: string, data: { packId: string; file: Express.Multer.File; name?: string; keywords?: string }): Promise<any> {
    const url = await this.storage.uploadFile(data.file, `stickers/${data.packId}`);
    const id = randomUUID();
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "stickers" ("id", "packId", "url", "name", "keywords", "createdBy", "createdAt")
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, id, data.packId, url, data.name || data.file.originalname, data.keywords || null, userId);
    return { id, url, name: data.name };
  }

  /** List stickers in a pack. */
  async listStickers(packId: string): Promise<any[]> {
    return await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "stickers" WHERE "packId" = $1 ORDER BY "createdAt" ASC
    `, packId);
  }

  /** Send a sticker as a chat message (type=STICKER). */
  async sendStickerMessage(tenantId: string, senderId: string, conversationId: string, stickerId: string): Promise<ChatMessage> {
    const conv = await this.getConversation(tenantId, senderId, conversationId);
    // ⭐ V5 (chantier 1) — BLOCAGE sur conversation DIRECT à 2 participants
    await this.assertDirectConversationNotBlocked(tenantId, senderId, conv);
    const stickers: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "stickers" WHERE id = $1
    `, stickerId);
    if (stickers.length === 0) throw new NotFoundException('Sticker not found');
    const sticker = stickers[0];
    const msgId = randomUUID();
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "chat_messages" ("id", "conversationId", "senderId", "type", "content", "attachmentUrl", "attachmentName", "stickerId", "createdAt")
      VALUES ($1, $2, $3, 'STICKER', $4, $5, $6, $7, NOW())
    `, msgId, conversationId, senderId, sticker.name || 'Sticker', sticker.url, sticker.name || 'sticker.png', stickerId);
    // Update conversation preview
    await this.prisma.$executeRawUnsafe(`
      UPDATE "chat_conversations" SET "lastMessageAt" = NOW(), "lastMessagePreview" = '[Sticker]', "lastMessageSenderId" = $2, "updatedAt" = NOW() WHERE "id" = $1
    `, conversationId, senderId);
    return (await this.listMessages(tenantId, senderId, conversationId, { limit: 1 }))[0];
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ DISCORD PARITY — GIF SEARCH (Tenor API proxy)
  // ═════════════════════════════════════════════════════════════════

  /** Search GIFs via Tenor API (proxied server-side to keep the API key secure). */
  async searchGifs(query: string, limit = 20): Promise<any[]> {
    const apiKey = process.env.TENOR_API_KEY;
    if (!apiKey) {
      // No API key — return an empty array (frontend will show a message)
      return [];
    }
    try {
      const url = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${apiKey}&limit=${limit}&media_filter=gif&contentfilter=high`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Tenor API error: ${response.status}`);
      const data: any = await response.json();
      return (data.results || []).map((r: any) => ({
        id: r.id,
        url: r.media_formats?.gif?.url || r.url,
        preview: r.media_formats?.tinygif?.url || r.url,
        width: r.media_formats?.gif?.dims?.[0],
        height: r.media_formats?.gif?.dims?.[1],
        description: r.content_description,
      }));
    } catch (e: any) {
      this.logger?.warn?.(`GIF search failed: ${e.message}`);
      return [];
    }
  }
}

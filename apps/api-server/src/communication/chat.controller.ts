/**
 * ============================================================================
 * CHAT CONTROLLER — API REST pour la messagerie interne type WhatsApp
 * ============================================================================
 *
 * Endpoints :
 *   GET    /chat/conversations                                    — liste mes conversations
 *   POST   /chat/conversations/direct                             — crée/récupère une conv 1-à-1
 *   POST   /chat/conversations/group                              — crée un groupe
 *   GET    /chat/conversations/:id                                — détails d'une conversation
 *   GET    /chat/conversations/:id/messages                       — liste les messages (paginé)
 *   POST   /chat/conversations/:id/messages/text                  — envoie un message texte
 *   POST   /chat/conversations/:id/messages/attachment            — envoie un fichier (audio/doc/image)
 *   POST   /chat/conversations/:id/mark-read                      — marque comme lu
 *   GET    /chat/unread-count                                     — nombre de messages non lus par conv
 *   GET    /chat/search-users?q=...&includeOtherTenants=true      — recherche d'utilisateurs
 *   POST   /chat/invitations                                      — envoie une invitation
 *   GET    /chat/invitations/pending                              — invitations reçues en attente
 *   POST   /chat/invitations/:id/accept                           — accepte une invitation
 *   POST   /chat/invitations/:id/decline                          — refuse une invitation
 * ============================================================================
 */

import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Res, UseGuards,
  UseInterceptors, UploadedFile, BadRequestException, ForbiddenException, NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ChatService } from './services/chat.service';
import { StorageService } from '../common/services/storage.service';
import { PushNotificationService } from './services/push-notification.service';
// ⭐ V5 (chantier 1) : blocage d'utilisateurs (parité Yeshua blocks)
import { ChatBlockService } from './services/chat-block.service';
// ⭐ V5 (chantier 8) : ATLAS dans le chat (question + contexte utilisateur)
import { ChatAtlasService } from './services/chat-atlas.service';
// ⭐ V3-3: ORION-powered conversation summaries
import { ChatSummaryService } from './services/chat-summary.service';
// ⭐ V3-2: Whisper-powered audio transcriptions
import { ChatTranscriptionService } from './services/chat-transcription.service';
// ⭐ V3-11: Auto-groups (Communautés) — auto-create per academic year
import { AutoGroupService } from './services/auto-group.service';
// ⭐ V6 (spec §4/§6) — Canaux officiels auto + bootstrap (sync complète canaux+groupes)
import { HelmConnectBootstrapService } from './services/helm-connect-bootstrap.service';
import { AutoChannelService } from './services/auto-channel.service';
// ⭐ V3-11: PrismaService — for direct academicYear lookup in auto-groups endpoints
import { PrismaService } from '../database/prisma.service';
// ⭐ LiveKit SFU — mints access tokens for voice/stage/live channels
import { LiveKitTokenService } from './services/livekit-token.service';
// ⭐ NOTE: We DO NOT use `import * as multer from 'multer'` here — it causes
//    a CommonJS interop crash at runtime ("_multer is not a function")
//    because multer's `module.exports` is a FUNCTION (not an object with named exports).
//    Instead, we import only the named exports we need (`memoryStorage`) and pass
//    the options INLINE to FileInterceptor below.
import { memoryStorage } from 'multer';

/**
 * ⭐ V5 — Rôles globaux habilités aux actions d'administration transverses
 *    (audit global, ajout de membres dans toute conversation du tenant).
 *    Même logique que PUBLISHER_ROLES des annonces, élargie à la modération.
 */
const ADMIN_ROLES = new Set([
  'ADMIN', 'SUPER_ADMIN', 'PLATFORM_OWNER', 'PROMOTER', 'PROMOTEUR',
  'DIRECTOR', 'DIRECTEUR', 'DIRECTOR_GENERAL', 'DIRECTEUR_GENERAL',
  'SCHOOL_DIRECTOR', 'DIRECTEUR_ETABLISSEMENT', 'DEPUTY_DIRECTOR',
  'PEDAGOGIC_DIRECTOR', 'DIRECTEUR_PEDAGOGIQUE', 'PEDAGOGIC_COORDINATOR',
  'CENSEUR', 'SURVEILLANT_GENERAL',
]);

/**
 * ⭐ V5 — Rôles autorisés à consulter l'audit global / modération de
 *    communication (ADMIN/SUPER_ADMIN/DIRECTOR + rôles de modération).
 */
const MODERATION_ROLES = new Set([
  'ADMIN', 'SUPER_ADMIN', 'PLATFORM_OWNER', 'PROMOTER', 'PROMOTEUR',
  'DIRECTOR', 'DIRECTEUR', 'DIRECTOR_GENERAL', 'DIRECTEUR_GENERAL',
  'SCHOOL_DIRECTOR', 'DIRECTEUR_ETABLISSEMENT', 'DEPUTY_DIRECTOR',
  'PEDAGOGIC_DIRECTOR', 'DIRECTEUR_PEDAGOGIQUE', 'PEDAGOGIC_COORDINATOR',
  'CENSEUR', 'SURVEILLANT_GENERAL', 'MODERATOR',
]);

// ⭐ Multer options — passed inline to FileInterceptor('file', options)
//    - Storage: memory (the StorageService uploads to R2/S3 afterwards)
//    - Limit: 50 MB (audio files can be large)
const CHAT_FILE_UPLOAD_OPTIONS = {
  storage: memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
};

@Controller('chat')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly storage: StorageService,
    private readonly pushService: PushNotificationService,
    // ⭐ V5 (chantier 1) : blocage d'utilisateurs (parité Yeshua blocks)
    private readonly chatBlockService: ChatBlockService,
    // ⭐ V5 (chantier 8) : ATLAS dans le chat (alias /chat/atlas/ask)
    private readonly chatAtlasService: ChatAtlasService,
    // ⭐ V3-3: ORION-powered conversation summaries
    private readonly summaryService: ChatSummaryService,
    // ⭐ V3-2: Whisper-powered audio transcriptions
    private readonly transcriptionService: ChatTranscriptionService,
    // ⭐ V3-11: Auto-groups (Communautés) auto-creation per academic year
    private readonly autoGroupService: AutoGroupService,
    // ⭐ V3-11: PrismaService — for academicYear lookup in auto-groups endpoints
    private readonly prisma: PrismaService,
    // ⭐ LiveKit SFU — mints access tokens for voice/stage/live channels
    private readonly livekitTokenService: LiveKitTokenService,
    // ⭐ V6 (spec §4/§6) — canaux officiels auto + bootstrap
    private readonly helmBootstrap: HelmConnectBootstrapService,
    private readonly autoChannelService: AutoChannelService,
  ) {}

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V5 (chantier 1) — BLOCAGE D'UTILISATEURS (parité Yeshua blocks)
  //    POST   /chat/blocks/:userId        → bloque un membre
  //    DELETE /chat/blocks/:userId        → débloque un membre
  //    GET    /chat/blocks                → liste ( + ?includeBlockedMe=true )
  // ═════════════════════════════════════════════════════════════════

  @Post('blocks/:userId')
  async blockUser(
    @TenantId() tenantId: string,
    @Param('userId') targetUserId: string,
    @Body() body: { userId: string },
    @CurrentUser() jwtUser: { id?: string; role?: string },
  ) {
    // L'acteur = userId du body (pattern existant), à défaut l'identité JWT
    const blockerId = body?.userId || jwtUser?.id;
    if (!blockerId) throw new BadRequestException('userId is required');
    const result = await this.chatBlockService.blockUser(tenantId, blockerId, targetUserId);
    // Audit BLOCK_USER (modération transparente — même table que le reste du chat)
    await this.chatService.writeAuditLog(null, blockerId, targetUserId, null, 'BLOCK_USER', { tenantId });
    return result;
  }

  @Delete('blocks/:userId')
  async unblockUser(
    @TenantId() tenantId: string,
    @Param('userId') targetUserId: string,
    @Query('userId') userIdQuery?: string,
    @Body() body?: { userId?: string },
    @CurrentUser() jwtUser?: { id?: string; role?: string },
  ) {
    // DELETE avec ou sans body selon les clients — on accepte body ET query
    const blockerId = body?.userId || userIdQuery || jwtUser?.id;
    if (!blockerId) throw new BadRequestException('userId is required');
    const result = await this.chatBlockService.unblockUser(tenantId, blockerId, targetUserId);
    await this.chatService.writeAuditLog(null, blockerId, targetUserId, null, 'UNBLOCK_USER', { tenantId });
    return result;
  }

  @Get('blocks')
  async listBlocks(
    @TenantId() tenantId: string,
    @Query('userId') userId?: string,
    @Query('includeBlockedMe') includeBlockedMe?: string,
    @CurrentUser() jwtUser?: { id?: string },
  ) {
    const blockerId = userId || jwtUser?.id;
    if (!blockerId) throw new BadRequestException('userId is required');
    return this.chatBlockService.listBlocks(tenantId, blockerId, includeBlockedMe === 'true' || includeBlockedMe === '1' || includeBlockedMe === 'yes');
  }

  // ══════════════════════════════════════════════════════════════
  //  ⭐ V5 (chantier 8, spéc #18) — ATLAS DANS LE CHAT
  //     POST /chat/atlas/ask { question, conversationId? }
  //     Alias du endpoint POST /chat/v2/atlas/ask (helm-connect-v2.controller) :
  //     même service, même garde-fou de contexte (conversations dont
  //     l'utilisateur est participant, 50 derniers messages tronqués) et
  //     même rate-limit 10 req/min. Réponse : { answer, model, … }.
  // ═════════════════════════════════════════════════════════════════

  @Post('atlas/ask')
  @Throttle({ medium: { limit: 10, ttl: 60000 } })
  async askAtlas(
    @TenantId() tenantId: string,
    @Body() body: { userId?: string; question: string; conversationId?: string },
    @CurrentUser() jwtUser: { id?: string },
  ) {
    if (!body?.question || !body.question.trim()) {
      throw new BadRequestException('question is required');
    }
    const userId = body.userId || jwtUser?.id;
    if (!userId) throw new BadRequestException('userId is required');
    return this.chatAtlasService.ask(tenantId, userId, body.question, body.conversationId);
  }

  // ═════════════════════════════════════════════════════════════════
  //  CONVERSATIONS
  // ═════════════════════════════════════════════════════════════════

  @Get('conversations')
  async listConversations(
    @TenantId() tenantId: string,
    @Query('userId') userId: string,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.chatService.listConversations(tenantId, userId);
  }

  @Post('conversations/direct')
  async createDirectConversation(
    @TenantId() tenantId: string,
    @Body() body: { currentUserId: string; otherUserId: string },
  ) {
    if (!body.currentUserId || !body.otherUserId) {
      throw new BadRequestException('currentUserId and otherUserId are required');
    }
    return this.chatService.createOrGetDirectConversation(tenantId, body.currentUserId, body.otherUserId);
  }

  /**
   * ⭐ Start a DIRECT conversation with a PARENT (guardian).
   *    Unlike /conversations/direct which requires a userId, this endpoint
   *    accepts a guardianId and auto-provisions a User account for the
   *    parent if they don't have one yet (role=PARENT, login via phone OTP).
   *    No SMS/email invitation needed — the parent can already login to
   *    the parent portal with their phone number.
   */
  @Post('conversations/guardian-direct')
  async createGuardianDirectConversation(
    @TenantId() tenantId: string,
    @Body() body: { currentUserId: string; guardianId: string },
  ) {
    if (!body.currentUserId || !body.guardianId) {
      throw new BadRequestException('currentUserId and guardianId are required');
    }
    return this.chatService.createOrGetDirectConversationWithGuardian(
      tenantId,
      body.currentUserId,
      body.guardianId,
    );
  }

  @Post('conversations/group')
  async createGroupConversation(
    @TenantId() tenantId: string,
    @Body() body: { creatorId: string; name: string; description?: string; participantIds: string[]; avatarUrl?: string },
  ) {
    if (!body.creatorId) throw new BadRequestException('creatorId is required');
    return this.chatService.createGroupConversation(tenantId, body.creatorId, body);
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V2 — GROUP INVITE LINKS
  // ═════════════════════════════════════════════════════════════════
  @Post('conversations/:id/invite-link')
  async generateInviteLink(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Body() body: { userId: string },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    return this.chatService.generateInviteLink(tenantId, conversationId, body.userId);
  }

  @Post('join/:token')
  async joinByInviteLink(
    @TenantId() tenantId: string,
    @Param('token') token: string,
    @Body() body: { userId: string },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    return this.chatService.joinByInviteLink(tenantId, token, body.userId);
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V2 — SCHEDULED MESSAGES
  // ═════════════════════════════════════════════════════════════════
  @Post('conversations/:id/schedule')
  async scheduleMessage(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Body() body: { senderId: string; content: string; scheduledFor: string },
  ) {
    if (!body.senderId) throw new BadRequestException('senderId is required');
    if (!body.content?.trim()) throw new BadRequestException('content is required');
    if (!body.scheduledFor) throw new BadRequestException('scheduledFor is required');
    return this.chatService.scheduleMessage(tenantId, conversationId, body.senderId, body.content, new Date(body.scheduledFor));
  }

  @Get('conversations/:id/scheduled')
  async listScheduledMessages(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Query('userId') userId: string,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.chatService.listScheduledMessages(tenantId, conversationId, userId);
  }

  @Delete('scheduled/:schedId')
  async cancelScheduledMessage(
    @TenantId() tenantId: string,
    @Param('schedId') schedId: string,
    @Body() body: { userId: string },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    return this.chatService.cancelScheduledMessage(tenantId, schedId, body.userId);
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V2 — CALL HISTORY (audio/video calls)
  // ═════════════════════════════════════════════════════════════════
  @Post('conversations/:id/call')
  async startCall(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Body() body: { callerId: string; callType: 'AUDIO' | 'VIDEO' },
  ) {
    if (!body.callerId) throw new BadRequestException('callerId is required');
    return this.chatService.startCall(tenantId, conversationId, body.callerId, body.callType || 'AUDIO');
  }

  @Put('calls/:callId')
  async endCall(
    @TenantId() tenantId: string,
    @Param('callId') callId: string,
    @Body() body: { status: string },
  ) {
    return this.chatService.endCall(tenantId, callId, body.status || 'COMPLETED');
  }

  @Get('conversations/:id/calls')
  async listCalls(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
  ) {
    return this.chatService.listCalls(tenantId, conversationId);
  }

  @Get('conversations/:id')
  async getConversation(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Query('userId') userId: string,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.chatService.getConversation(tenantId, userId, conversationId);
  }

  // ═════════════════════════════════════════════════════════════════
  //  MESSAGES
  // ═════════════════════════════════════════════════════════════════

  @Get('conversations/:id/messages')
  async listMessages(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Query('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.chatService.listMessages(tenantId, userId, conversationId, {
      limit: limit ? parseInt(limit, 10) : 50,
      before: before || undefined,
    });
  }

  @Post('conversations/:id/messages/text')
  // ⭐ V5 (chantier 4) — ANTI-SPAM : 30 messages/minute par IP pour l'envoi
  //    de texte (les GET de polling restent au régime global — jamais throttlés
  //    spécifiquement). Le guard global ThrottlerGuard (APP_GUARD) applique
  //    ce décorateur au throttler nommé 'medium' pour CETTE route uniquement.
  @Throttle({ medium: { limit: 30, ttl: 60000 } })
  async sendTextMessage(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Body() body: { senderId: string; content: string; replyToId?: string; mentionedUserIds?: string[] },
  ) {
    if (!body.senderId || !body.content) {
      throw new BadRequestException('senderId and content are required');
    }
    return this.chatService.sendTextMessage(tenantId, body.senderId, conversationId, body);
  }

  @Post('conversations/:id/messages/attachment')
  @UseInterceptors(FileInterceptor('file', CHAT_FILE_UPLOAD_OPTIONS))
  // ⭐ V5 (chantier 4) — ANTI-SPAM : 30 envois/minute (pièces jointes comprises)
  @Throttle({ medium: { limit: 30, ttl: 60000 } })
  async sendAttachmentMessage(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: {
      senderId: string;
      type: 'AUDIO' | 'DOCUMENT' | 'IMAGE';
      content?: string;
      duration?: string;
      replyToId?: string;
    },
  ) {
    if (!file) throw new BadRequestException('File is required');
    if (!body.senderId) throw new BadRequestException('senderId is required');
    if (!body.type || !['AUDIO', 'DOCUMENT', 'IMAGE'].includes(body.type)) {
      throw new BadRequestException('Valid type (AUDIO/DOCUMENT/IMAGE) is required');
    }
    return this.chatService.sendAttachmentMessage(tenantId, body.senderId, conversationId, {
      type: body.type,
      file,
      content: body.content,
      duration: body.duration ? parseInt(body.duration, 10) : undefined,
      replyToId: body.replyToId,
    });
  }

  @Post('conversations/:id/mark-read')
  async markAsRead(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Body() body: { userId: string },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    await this.chatService.markAsRead(tenantId, body.userId, conversationId);
    return { success: true };
  }

  // ═════════════════════════════════════════════════════════════════
  //  V2.7 — MESSAGE DELETION (WhatsApp/Telegram-style)
  //    - Delete for me : removes the message from the user's view (soft delete per user)
  //    - Delete for everyone : sender only, marks deletedAt (visible to everyone as
  //      "Message supprimé" placeholder)
  // ═════════════════════════════════════════════════════════════════

  /**
   * ⭐ POST /chat/conversations/:id/messages/:msgId/delete-for-me
   *    Soft-deletes the message for THIS user only (others still see it).
   *    Implementation: insert into chat_message_user_deletions (userId, messageId).
   */
  @Post('conversations/:id/messages/:msgId/delete-for-me')
  async deleteMessageForMe(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Param('msgId') messageId: string,
    @Body() body: { userId: string },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    return this.chatService.deleteMessageForMe(tenantId, body.userId, conversationId, messageId);
  }

  /**
   * ⭐ POST /chat/conversations/:id/messages/:msgId/delete-for-everyone
   *    Hard-deletes the message for everyone (sender only). Marks deletedAt.
   */
  @Post('conversations/:id/messages/:msgId/delete-for-everyone')
  async deleteMessageForEveryone(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Param('msgId') messageId: string,
    @Body() body: { userId: string },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    return this.chatService.deleteMessageForEveryone(tenantId, body.userId, conversationId, messageId);
  }

  @Get('unread-count')
  async getUnreadCount(
    @TenantId() tenantId: string,
    @Query('userId') userId: string,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.chatService.getUnreadCount(tenantId, userId);
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V1 GAP — MESSAGE REACTIONS (emoji)
  //     POST /api/chat/messages/:msgId/react  → toggle a reaction
  //     Body: { userId, emoji }
  //     Returns: { messageId, emoji, action: 'added' | 'removed', count }
  // ═════════════════════════════════════════════════════════════════
  @Post('messages/:msgId/react')
  async toggleReaction(
    @TenantId() tenantId: string,
    @Param('msgId') messageId: string,
    @Body() body: { userId: string; emoji: string },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    if (!body.emoji) throw new BadRequestException('emoji is required');
    return this.chatService.toggleReaction(tenantId, messageId, body.userId, body.emoji);
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V1 GAP — MESSAGE EDIT (content update + editedAt timestamp)
  //     PUT /api/chat/messages/:msgId
  //     Body: { userId, content }
  //     Returns: { id, content, editedAt }
  // ═════════════════════════════════════════════════════════════════
  @Put('messages/:msgId')
  async editMessage(
    @TenantId() tenantId: string,
    @Param('msgId') messageId: string,
    @Body() body: { userId: string; content: string },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    if (!body.content || !body.content.trim()) throw new BadRequestException('content is required');
    return this.chatService.editMessage(tenantId, messageId, body.userId, body.content);
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V1 GAP — MESSAGE FORWARD (to another conversation)
  //     POST /api/chat/messages/:msgId/forward
  //     Body: { userId, targetConversationId }
  //     Returns: { id, conversationId, type, content, attachmentUrl }
  // ═════════════════════════════════════════════════════════════════
  @Post('messages/:msgId/forward')
  async forwardMessage(
    @TenantId() tenantId: string,
    @Param('msgId') messageId: string,
    @Body() body: { userId: string; targetConversationId: string },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    if (!body.targetConversationId) throw new BadRequestException('targetConversationId is required');
    return this.chatService.forwardMessage(tenantId, messageId, body.userId, body.targetConversationId);
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V1 GAP — MARK MESSAGE AS IMPORTANT (priority flag)
  //     POST /api/chat/messages/:msgId/important
  //     Body: { userId, isImportant }
  //     Returns: { id, isImportant }
  // ═════════════════════════════════════════════════════════════════
  @Post('messages/:msgId/important')
  async toggleImportant(
    @TenantId() tenantId: string,
    @Param('msgId') messageId: string,
    @Body() body: { userId: string; isImportant: boolean },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    return this.chatService.toggleImportant(tenantId, messageId, body.userId, body.isImportant ?? true);
  }

  // ═════════════════════════════════════════════════════════════════
  //  RECHERCHE D'UTILISATEURS + INVITATIONS
  // ═════════════════════════════════════════════════════════════════

  @Get('search-users')
  async searchUsers(
    @TenantId() tenantId: string,
    @Query('userId') userId: string,
    @Query('q') query: string,
    @Query('includeOtherTenants') includeOtherTenants?: string,
    @Query('limit') limit?: string,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    if (!query) throw new BadRequestException('q (query) is required');
    return this.chatService.searchUsers(tenantId, userId, query, {
      includeOtherTenants: includeOtherTenants !== 'false',
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Post('invitations')
  async sendInvitation(
    @TenantId() tenantId: string,
    @Body() body: {
      senderId: string;
      recipientId?: string;
      recipientEmail?: string;
      recipientName?: string;
      message?: string;
    },
  ) {
    if (!body.senderId) throw new BadRequestException('senderId is required');
    return this.chatService.sendInvitation(tenantId, body.senderId, body);
  }

  /**
   * ⭐ NEW — POST /chat/invitations/guardian
   *    Invite a guardian (without user account) to join Helm Connect via SMS/email.
   *    body: { senderId, guardianId, channel?, message? }
   */
  @Post('invitations/guardian')
  async inviteGuardian(
    @TenantId() tenantId: string,
    @Body() body: { senderId: string; guardianId: string; channel?: 'SMS' | 'EMAIL' | 'WHATSAPP'; message?: string },
  ) {
    if (!body.senderId) throw new BadRequestException('senderId is required');
    if (!body.guardianId) throw new BadRequestException('guardianId is required');
    return this.chatService.inviteGuardianToHelmConnect(tenantId, body.senderId, {
      guardianId: body.guardianId,
      channel: body.channel,
      message: body.message,
    });
  }

  @Get('invitations/pending')
  async listPendingInvitations(
    @Query('userId') userId: string,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.chatService.listPendingInvitations(userId);
  }

  @Post('invitations/:id/accept')
  async acceptInvitation(
    @TenantId() tenantId: string,
    @Param('id') invitationId: string,
    @Body() body: { currentUserId: string },
  ) {
    if (!body.currentUserId) throw new BadRequestException('currentUserId is required');
    return this.chatService.acceptInvitation(tenantId, body.currentUserId, invitationId);
  }

  @Post('invitations/:id/decline')
  async declineInvitation(
    @Param('id') invitationId: string,
    @Body() body: { currentUserId: string },
  ) {
    if (!body.currentUserId) throw new BadRequestException('currentUserId is required');
    await this.chatService.declineInvitation(body.currentUserId, invitationId);
    return { success: true };
  }

  // ═════════════════════════════════════════════════════════════════
  //  PRESENCE (online/offline) + TYPING INDICATOR
  // ═════════════════════════════════════════════════════════════════

  /**
   * ⭐ POST /chat/presence — heartbeat (updated every 30s by frontend)
   *    body: { userId }
   */
  @Post('presence')
  async updatePresence(@Body() body: { userId: string }) {
    if (!body.userId) throw new BadRequestException('userId requis');
    await this.chatService.updatePresence(body.userId);
    return { success: true };
  }

  /**
   * ⭐ GET /chat/presence?userIds=u1,u2,u3 — get online status
   */
  @Get('presence')
  async getPresence(@Query('userIds') userIdsStr: string) {
    if (!userIdsStr) return [];
    return this.chatService.getPresence(userIdsStr.split(',').filter(Boolean));
  }

  /**
   * ⭐ POST /chat/typing — set typing state
   *    body: { conversationId, userId, isTyping }
   */
  @Post('typing')
  async setTyping(@Body() body: { conversationId: string; userId: string; isTyping: boolean }) {
    if (!body.conversationId || !body.userId) throw new BadRequestException('conversationId et userId requis');
    await this.chatService.setTypingState(body.conversationId, body.userId, body.isTyping);
    return { success: true };
  }

  /**
   * ⭐ GET /chat/typing?conversationId=X — get who is typing
   */
  @Get('typing')
  async getTyping(@Query('conversationId') conversationId: string) {
    if (!conversationId) return [];
    return this.chatService.getTypingUsers(conversationId);
  }

  // ═════════════════════════════════════════════════════════════════
  //  CANAUX (Telegram-style broadcast channels)
  // ═════════════════════════════════════════════════════════════════

  @Post('channels')
  async createChannel(
    @TenantId() tenantId: string,
    @Body() body: { creatorId: string; name: string; description?: string },
  ) {
    if (!body.creatorId || !body.name) throw new BadRequestException('creatorId et name requis');
    return this.chatService.createChannel(tenantId, body.creatorId, { name: body.name, description: body.description });
  }

  @Get('channels')
  async listChannels(
    @TenantId() tenantId: string,
    @Query('userId') userId: string,
  ) {
    if (!userId) throw new BadRequestException('userId requis');
    return this.chatService.listChannels(tenantId, userId);
  }

  @Post('channels/:id/subscribe')
  async subscribeToChannel(
    @Param('id') channelId: string,
    @Body() body: { userId: string; notify?: boolean },
  ) {
    if (!body.userId) throw new BadRequestException('userId requis');
    // ⭐ V6.1 (parité Yeshua) — notify=true → message système « X a rejoint
    //    le canal » (abonnement explicite). L'auto-abonnement silencieux à
    //    l'ouverture du canal ne passe PAS notify.
    return this.chatService.subscribeToChannel(channelId, body.userId, { notify: !!body.notify });
  }

  @Post('channels/:id/unsubscribe')
  async unsubscribeFromChannel(@Param('id') channelId: string, @Body() body: { userId: string }) {
    if (!body.userId) throw new BadRequestException('userId requis');
    return this.chatService.unsubscribeFromChannel(channelId, body.userId);
  }

  @Post('channels/:id/broadcast')
  async broadcastToChannel(@Param('id') channelId: string, @Body() body: { senderId: string; content: string }) {
    if (!body.senderId || !body.content) throw new BadRequestException('senderId et content requis');
    return this.chatService.broadcastToChannel(channelId, body.senderId, body.content);
  }

  @Get('channels/:id/messages')
  async getChannelMessages(@Param('id') channelId: string, @Query('limit') limit?: string) {
    return this.chatService.getChannelMessages(channelId, limit ? parseInt(limit, 10) : 50);
  }

  // ═════════════════════════════════════════════════════════════════
  //  AVATAR UPLOAD + E2E PUBLIC KEY
  // ═════════════════════════════════════════════════════════════════

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file', CHAT_FILE_UPLOAD_OPTIONS))
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { userId: string },
  ) {
    if (!file) throw new BadRequestException('File is required');
    if (!body.userId) throw new BadRequestException('userId is required');
    const avatarUrl = await this.storage.uploadFile(file, `avatars/${body.userId}`);
    return this.chatService.updateAvatar(body.userId, avatarUrl);
  }

  @Post('keys')
  async setPublicKey(@Body() body: { userId: string; publicKey: string }) {
    if (!body.userId || !body.publicKey) throw new BadRequestException('userId et publicKey requis');
    return this.chatService.setPublicKey(body.userId, body.publicKey);
  }

  @Get('keys')
  async getPublicKeys(@Query('userIds') userIdsStr: string) {
    if (!userIdsStr) return [];
    return this.chatService.getPublicKeys(userIdsStr.split(',').filter(Boolean));
  }

  // ═════════════════════════════════════════════════════════════════
  //  PUSH NOTIFICATIONS (Web Push API + VAPID)
  // ═════════════════════════════════════════════════════════════════

  /**
   * ⭐ GET /chat/push/vapid-public-key — returns the VAPID public key
   *    The frontend uses this to create a push subscription via the browser
   *    PushManager API.
   */
  @Get('push/vapid-public-key')
  async getVapidPublicKey() {
    return { publicKey: this.pushService.getPublicKey() };
  }

  /**
   * ⭐ POST /chat/push/subscribe — store a browser push subscription
   *    body: { userId, subscription }
   *    subscription is the PushSubscription object from the browser.
   */
  @Post('push/subscribe')
  async subscribeToPush(@Body() body: { userId: string; subscription: any }) {
    if (!body.userId || !body.subscription) throw new BadRequestException('userId et subscription requis');
    return this.pushService.subscribe(body.userId, body.subscription);
  }

  /**
   * ⭐ POST /chat/push/unsubscribe — remove a push subscription
   *    body: { userId, endpoint }
   */
  @Post('push/unsubscribe')
  async unsubscribeFromPush(@Body() body: { userId: string; endpoint: string }) {
    if (!body.userId || !body.endpoint) throw new BadRequestException('userId et endpoint requis');
    return this.pushService.unsubscribe(body.userId, body.endpoint);
  }

  /**
   * ⭐ POST /chat/push/send — manually send a push to a user (admin/testing)
   *    body: { userId, title, body, conversationId? }
   */
  @Post('push/send')
  async sendPush(@Body() body: { userId: string; title: string; body: string; conversationId?: string }) {
    if (!body.userId) throw new BadRequestException('userId requis');
    return this.pushService.sendPushToUser(body.userId, { title: body.title, body: body.body, conversationId: body.conversationId });
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ GAP FILL: MODERATION
  // ═════════════════════════════════════════════════════════════════
  @Post('messages/:msgId/report')
  async reportMessage(@TenantId() tenantId: string, @Param('msgId') messageId: string, @Body() body: { reporterId: string; reason: string }) {
    if (!body.reporterId) throw new BadRequestException('reporterId is required');
    return this.chatService.reportMessage(tenantId, messageId, body.reporterId, body.reason || 'Signalement');
  }

  @Get('reports')
  async listReports(@TenantId() tenantId: string) {
    return this.chatService.listReports(tenantId);
  }

  @Post('reports/:reportId/resolve')
  async resolveReport(@TenantId() tenantId: string, @Param('reportId') reportId: string, @Body() body: { resolvedBy: string; resolution: string }) {
    return this.chatService.resolveReport(reportId, body.resolvedBy, body.resolution || 'Résolu');
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ GAP FILL: USER PROFILE
  // ═════════════════════════════════════════════════════════════════
  @Get('profile/:userId')
  async getProfile(@Param('userId') userId: string) {
    return this.chatService.getUserProfile(userId);
  }

  @Put('profile')
  async updateProfile(@Body() body: { userId: string; bio?: string; availabilityStatus?: string; availableFrom?: string; availableUntil?: string }) {
    if (!body.userId) throw new BadRequestException('userId is required');
    const { userId, ...data } = body;
    return this.chatService.updateUserProfile(userId, data);
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ GAP FILL: IN-CONVERSATION SEARCH
  // ═════════════════════════════════════════════════════════════════
  @Get('conversations/:id/search')
  async searchInConversation(@TenantId() tenantId: string, @Param('id') conversationId: string, @Query('userId') userId: string, @Query('q') q: string) {
    if (!userId) throw new BadRequestException('userId is required');
    if (!q || q.length < 2) throw new BadRequestException('Query must be at least 2 characters');
    return this.chatService.searchInConversation(tenantId, conversationId, userId, q);
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ GAP FILL: DELIVERED RECEIPT
  // ═════════════════════════════════════════════════════════════════
  @Post('messages/:msgId/deliver')
  async markDelivered(@Param('msgId') messageId: string) {
    return this.chatService.markDelivered(messageId);
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ GAP FILL: ANALYTICS
  // ═════════════════════════════════════════════════════════════════
  @Get('v2/analytics')
  async getAnalytics(@TenantId() tenantId: string) {
    return this.chatService.getAnalytics(tenantId);
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V5 (chantier 7, spéc #8) — CONVERSATIONS PÉDAGOGIQUES
  //     Body : { creatorId, type?: CLASS|SUBJECT|HOMEWORK|ACTIVITY|COURSE,
  //              linkedEntityId?, participantIds?, classId?, subjectId?, name? }
  //     (classId/subjectId restent acceptés — compatibilité V4)
  // ═════════════════════════════════════════════════════════════════
  @Post('conversations/pedagogical')
  async createPedagogicalConversation(
    @TenantId() tenantId: string,
    @Body() body: {
      creatorId: string;
      type?: 'CLASS' | 'SUBJECT' | 'HOMEWORK' | 'ACTIVITY' | 'COURSE';
      linkedEntityId?: string;
      participantIds?: string[];
      classId?: string;
      subjectId?: string;
      name?: string;
    },
  ) {
    if (!body.creatorId) throw new BadRequestException('creatorId is required');
    return this.chatService.createPedagogicalConversation(tenantId, body.creatorId, {
      type: body.type,
      linkedEntityId: body.linkedEntityId,
      participantIds: body.participantIds,
      classId: body.classId,
      subjectId: body.subjectId,
      name: body.name,
    });
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V3-3: ORION-POWERED CONVERSATION SUMMARY
  // ═════════════════════════════════════════════════════════════════
  @Post('conversations/:id/summarize')
  async summarizeConversation(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Body() body: { userId: string; maxMessages?: number },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    return this.summaryService.summarizeConversation(
      tenantId,
      body.userId,
      conversationId,
      { maxMessages: body.maxMessages },
    );
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V3-2: WHISPER-POWERED AUDIO TRANSCRIPTION
  // ═════════════════════════════════════════════════════════════════
  @Post('messages/:id/transcribe')
  async transcribeMessage(
    @TenantId() tenantId: string,
    @Param('id') messageId: string,
  ) {
    return this.transcriptionService.transcribeMessage(tenantId, messageId);
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V3-11: AUTO-GROUPS SYNC (Communautés auto-creation per academic year)
  //     Called by the frontend when the user opens the Communautés section.
  //     Creates CLASS / SUBJECT / ROLE / STAFF groups for the current academic
  //     year (dedupes — safe to call multiple times). Archives previous year
  //     groups instead of deleting them.
  // ═════════════════════════════════════════════════════════════════
  @Post('auto-groups/sync')
  async syncAutoGroups(@TenantId() tenantId: string) {
    // Find the current academic year for this tenant
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { startDate: 'desc' },
    });
    if (!academicYear) {
      return {
        message: 'Aucune année scolaire active trouvée. Activez une année scolaire pour générer les communautés automatiques.',
        created: 0, updated: 0, skipped: 0, total: 0,
      };
    }
    const result = await this.autoGroupService.syncAutoGroups(tenantId, academicYear.id);
    return {
      message: `${result.created} communauté(s) créée(s), ${result.updated} mise(s) à jour, ${result.skipped} déjà à jour pour l'année ${academicYear.name}.`,
      ...result,
      academicYear: academicYear.name,
    };
  }

  @Get('auto-groups')
  async listAutoGroups(@TenantId() tenantId: string) {
    // Returns all auto-group conversations for the current academic year
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { startDate: 'desc' },
    });
    if (!academicYear) return [];
    return this.autoGroupService.listAutoGroups(tenantId, academicYear.id);
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ CANAUX OFFICIELS AUTOMATIQUES (Task 77 — alignés aux modules actifs)
  //    POST /chat/auto-channels/sync  → garantit les canaux officiels liés
  //                                    aux modules ACTIVÉS (Direction, Vie
  //                                    scolaire, Finance si FINANCE actif,
  //                                    Transport si module livré + actif) ;
  //                                    RETIRE les canaux système obsolètes
  //                                    vides (Calendrier scolaire, Infos
  //                                    pédagogiques, Transport différé…) ;
  //                                    abonne les utilisateurs actifs ;
  //                                    purge les groupes Matière×Classe
  //                                    vides ; re-sync les communautés de
  //                                    l'année active. Idempotent — sûr à
  //                                    appeler souvent.
  //    GET  /chat/auto-channels       → liste les canaux officiels
  // ═════════════════════════════════════════════════════════════════
  @Post('auto-channels/sync')
  @Throttle({ medium: { limit: 6, ttl: 60000 } }) // ⭐ FIX PERF — 'default' n'existe pas (throttlers nommés short/medium/long) → le throttle était silencieusement inactif
  async syncAutoChannels(@TenantId() tenantId: string) {
    const result = await this.helmBootstrap.syncTenant(tenantId);
    const { channels, groups } = result;
    const groupsMsg = (groups as any)?.total !== undefined
      ? `${(groups as any).created} communauté(s) créée(s), ${(groups as any).updated} mise(s) à jour${(groups as any).purged ? `, ${(groups as any).purged} groupe(s) Matière×Classe vide(s) purgé(s)` : ''}`
      : (groups as any).message;
    return {
      message: `Canaux: ${channels.created} créé(s), ${channels.existing} déjà en place, ${channels.retired} retiré(s), ${channels.subscribed} nouvel(s) abonnement(s). ${groupsMsg}`,
      ...result,
    };
  }

  @Get('auto-channels')
  async listAutoChannels(@TenantId() tenantId: string) {
    return this.autoChannelService.listOfficialChannels(tenantId);
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ DISCORD PARITY — MODERATION, SLOW MODE, AUDIT LOG, MEMBERS
  // ═════════════════════════════════════════════════════════════════

  @Put('conversations/:id/slow-mode')
  async setSlowMode(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Body() body: { userId: string; seconds: number },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    return this.chatService.setSlowMode(tenantId, body.userId, conversationId, body.seconds || 0);
  }

  @Post('conversations/:id/ban/:userId')
  async banUser(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Param('userId') targetUserId: string,
    @Body() body: { adminId: string; reason?: string; expiresAt?: string },
  ) {
    if (!body.adminId) throw new BadRequestException('adminId is required');
    return this.chatService.banUser(tenantId, body.adminId, conversationId, targetUserId, body.reason, body.expiresAt ? new Date(body.expiresAt) : undefined);
  }

  @Delete('conversations/:id/ban/:userId')
  async unbanUser(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Param('userId') targetUserId: string,
    @Body() body: { adminId: string },
  ) {
    if (!body.adminId) throw new BadRequestException('adminId is required');
    return this.chatService.unbanUser(tenantId, body.adminId, conversationId, targetUserId);
  }

  @Post('conversations/:id/mute/:userId')
  async muteUser(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Param('userId') targetUserId: string,
    @Body() body: { adminId: string; reason?: string; expiresAt?: string },
  ) {
    if (!body.adminId) throw new BadRequestException('adminId is required');
    return this.chatService.muteUser(tenantId, body.adminId, conversationId, targetUserId, body.reason, body.expiresAt ? new Date(body.expiresAt) : undefined);
  }

  @Delete('conversations/:id/mute/:userId')
  async unmuteUser(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Param('userId') targetUserId: string,
    @Body() body: { adminId: string },
  ) {
    if (!body.adminId) throw new BadRequestException('adminId is required');
    return this.chatService.unmuteUser(tenantId, body.adminId, conversationId, targetUserId);
  }

  @Post('conversations/:id/kick/:userId')
  async kickUser(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Param('userId') targetUserId: string,
    @Body() body: { adminId: string; reason?: string },
  ) {
    if (!body.adminId) throw new BadRequestException('adminId is required');
    return this.chatService.kickUser(tenantId, body.adminId, conversationId, targetUserId, body.reason);
  }

  @Get('conversations/:id/audit-logs')
  async getAuditLogs(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Query('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.chatService.getAuditLogs(tenantId, userId, conversationId, limit ? parseInt(limit, 10) : 50);
  }

  @Get('conversations/:id/members')
  async getMembers(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Query('userId') userId: string,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.chatService.getConversationMembers(tenantId, userId, conversationId);
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V5 (chantier 3) — INVITABLE + ADD-MEMBERS + AUDIT GLOBAL
  // ═════════════════════════════════════════════════════════════════

  /**
   * GET /chat/conversations/:id/invitable?q=…
   * Membres du tenant absents de la conversation (limite 50, filtre
   * nom/prénom insensible à la casse, exclut les blocages dans les 2 sens).
   */
  @Get('conversations/:id/invitable')
  async getInvitableMembers(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Query('userId') userId: string,
    @Query('q') q?: string,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.chatService.getInvitableMembers(tenantId, userId, conversationId, q);
  }

  /**
   * POST /chat/conversations/:id/add-members { userIds: string[] } (1 à 50)
   * Autorisé : ADMIN de la conversation, MODERATOR avec canInvite, ou rôle
   * global ADMIN (ADMIN_ROLES). Idempotent — audit INVITE_MEMBERS.
   */
  @Post('conversations/:id/add-members')
  async addMembers(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Body() body: { userId: string; userIds: string[] },
    @CurrentUser() jwtUser: { id?: string; role?: string },
  ) {
    const actorId = body?.userId || jwtUser?.id;
    if (!actorId) throw new BadRequestException('userId is required');
    if (!Array.isArray(body?.userIds)) throw new BadRequestException('userIds requis (liste de 1 à 50 identifiants)');
    return this.chatService.addMembers(tenantId, actorId, jwtUser?.role, conversationId, body.userIds);
  }

  /**
   * GET /chat/moderation/audit-log?channelId=&limit=
   * Journal d'audit GLOBAL (toutes conversations du tenant) — réservé aux
   * rôles ADMIN/SUPER_ADMIN/DIRECTOR + modérateurs de communication
   * (MODERATION_ROLES — vérifié sur le rôle porté par le JWT).
   */
  @Get('moderation/audit-log')
  async getGlobalAuditLog(
    @TenantId() tenantId: string,
    @Query('channelId') channelId?: string,
    @Query('limit') limit?: string,
    @CurrentUser() jwtUser?: { id?: string; role?: string },
  ) {
    const role = String(jwtUser?.role || '').toUpperCase();
    if (!MODERATION_ROLES.has(role)) {
      throw new ForbiddenException('Réservé aux administrateurs, directeurs et modérateurs de communication.');
    }
    return this.chatService.getGlobalAuditLogs(tenantId, channelId, limit ? parseInt(limit, 10) : 100);
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V5 (chantier 10) — RÔLES, DROITS & APPROBATION DES MEMBRES
  // ═════════════════════════════════════════════════════════════════

  /**
   * PUT /chat/conversations/:id/members/:userId/role { role: ADMIN|MODERATOR|MEMBER }
   * Seul un ADMIN de la conversation peut changer les rôles.
   */
  @Put('conversations/:id/members/:userId/role')
  async setMemberRole(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Param('userId') targetUserId: string,
    @Body() body: { adminId?: string; role: 'ADMIN' | 'MODERATOR' | 'MEMBER' },
    @CurrentUser() jwtUser: { id?: string },
  ) {
    const adminId = body?.adminId || jwtUser?.id;
    if (!adminId) throw new BadRequestException('adminId is required');
    if (!body?.role) throw new BadRequestException('role is required (ADMIN|MODERATOR|MEMBER)');
    return this.chatService.setParticipantRole(tenantId, adminId, conversationId, targetUserId, body.role);
  }

  /**
   * PUT /chat/conversations/:id/members/:userId/permissions { permissions }
   * Droits personnalisés (canPin, canDeleteMessages, canInvite, canMute,
   * canBroadcast) — ADMIN de la conversation uniquement.
   */
  @Put('conversations/:id/members/:userId/permissions')
  async setMemberPermissions(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Param('userId') targetUserId: string,
    @Body() body: { adminId?: string; permissions: Record<string, boolean> },
    @CurrentUser() jwtUser: { id?: string },
  ) {
    const adminId = body?.adminId || jwtUser?.id;
    if (!adminId) throw new BadRequestException('adminId is required');
    if (!body?.permissions || typeof body.permissions !== 'object') {
      throw new BadRequestException('permissions is required');
    }
    return this.chatService.setParticipantPermissions(tenantId, adminId, conversationId, targetUserId, body.permissions);
  }

  /**
   * POST /chat/conversations/:id/members/:userId/approve — approuve une
   * adhésion PENDING (ADMIN). Passe ACTIVE + broadcast.
   */
  @Post('conversations/:id/members/:userId/approve')
  async approveMember(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Param('userId') targetUserId: string,
    @Body() body: { adminId?: string },
    @CurrentUser() jwtUser: { id?: string },
  ) {
    const adminId = body?.adminId || jwtUser?.id;
    if (!adminId) throw new BadRequestException('adminId is required');
    return this.chatService.approveMember(tenantId, adminId, conversationId, targetUserId);
  }

  /**
   * POST /chat/conversations/:id/members/:userId/reject — refuse une
   * adhésion PENDING (ADMIN). Retire le participant.
   */
  @Post('conversations/:id/members/:userId/reject')
  async rejectMember(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Param('userId') targetUserId: string,
    @Body() body: { adminId?: string },
    @CurrentUser() jwtUser: { id?: string },
  ) {
    const adminId = body?.adminId || jwtUser?.id;
    if (!adminId) throw new BadRequestException('adminId is required');
    return this.chatService.rejectMember(tenantId, adminId, conversationId, targetUserId);
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V5 — QUITTER UN GROUPE (+ message système « X a quitté »)
  // ═════════════════════════════════════════════════════════════════

  /**
   * POST /chat/conversations/:id/leave { userId }
   * Marque leftAt + insère le message système + broadcast members:removed.
   */
  @Post('conversations/:id/leave')
  async leaveConversation(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Body() body: { userId?: string },
    @CurrentUser() jwtUser: { id?: string },
  ) {
    const userId = body?.userId || jwtUser?.id;
    if (!userId) throw new BadRequestException('userId is required');
    return this.chatService.leaveConversation(tenantId, userId, conversationId);
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V5 — CRÉNEAUX DE DISPONIBILITÉ (Helm Connect web)
  // ═════════════════════════════════════════════════════════════════

  /** GET /chat/availability — mes créneaux hebdomadaires. */
  @Get('availability')
  async getMyAvailability(
    @TenantId() tenantId: string,
    @Query('userId') userId: string,
    @CurrentUser() jwtUser: { id?: string },
  ) {
    const uid = userId || jwtUser?.id;
    if (!uid) throw new BadRequestException('userId is required');
    return this.chatService.listAvailabilitySlots(tenantId, uid);
  }

  /** GET /chat/availability/user/:userId — créneaux publics d'un membre
   *  (affichés dans sa fiche membre — membership non requis : ce sont des
   *  informations de disponibilité volontairement publiées). */
  @Get('availability/user/:userId')
  async getUserAvailability(
    @TenantId() tenantId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.chatService.listAvailabilitySlots(tenantId, targetUserId);
  }

  /** POST /chat/availability { dayOfWeek, startTime, endTime, label? }
   *  Ajoute un créneau hebdomadaire récurrent à mon profil. */
  @Post('availability')
  async createAvailabilitySlot(
    @TenantId() tenantId: string,
    @Body() body: {
      userId?: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      label?: string;
    },
    @CurrentUser() jwtUser: { id?: string },
  ) {
    const uid = body?.userId || jwtUser?.id;
    if (!uid) throw new BadRequestException('userId is required');
    return this.chatService.createAvailabilitySlot(tenantId, uid, {
      dayOfWeek: body?.dayOfWeek,
      startTime: body?.startTime,
      endTime: body?.endTime,
      label: body?.label,
    });
  }

  /** DELETE /chat/availability/:slotId — supprime UN de mes créneaux. */
  @Delete('availability/:slotId')
  async deleteAvailabilitySlot(
    @TenantId() tenantId: string,
    @Param('slotId') slotId: string,
    @Query('userId') userId: string,
    @CurrentUser() jwtUser: { id?: string },
  ) {
    const uid = userId || jwtUser?.id;
    if (!uid) throw new BadRequestException('userId is required');
    return this.chatService.deleteAvailabilitySlot(tenantId, uid, slotId);
  }

  /**
   * POST /chat/conversations/:id/messages/:msgId/pin — épingle un message
   * (droit canPin : ADMIN et MODERATOR par défaut).
   */
  @Post('conversations/:id/messages/:msgId/pin')
  async pinMessage(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Param('msgId') messageId: string,
    @Body() body: { userId?: string },
    @CurrentUser() jwtUser: { id?: string },
  ) {
    const userId = body?.userId || jwtUser?.id;
    if (!userId) throw new BadRequestException('userId is required');
    return this.chatService.setPinned(tenantId, userId, conversationId, messageId, true);
  }

  /**
   * POST /chat/conversations/:id/messages/:msgId/unpin — détache un message
   * (droit canPin : ADMIN et MODERATOR par défaut).
   */
  @Post('conversations/:id/messages/:msgId/unpin')
  async unpinMessage(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Param('msgId') messageId: string,
    @Body() body: { userId?: string },
    @CurrentUser() jwtUser: { id?: string },
  ) {
    const userId = body?.userId || jwtUser?.id;
    if (!userId) throw new BadRequestException('userId is required');
    return this.chatService.setPinned(tenantId, userId, conversationId, messageId, false);
  }

  /**
   * GET /chat/conversations/:id/my-permissions — droits effectifs de
   * l'utilisateur courant dans la conversation (rôle + permissions fusionnées).
   */
  @Get('conversations/:id/my-permissions')
  async getMyPermissions(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Query('userId') userId: string,
    @CurrentUser() jwtUser: { id?: string },
  ) {
    const uid = userId || jwtUser?.id;
    if (!uid) throw new BadRequestException('userId is required');
    return this.chatService.getEffectivePermissions(tenantId, conversationId, uid);
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ DISCORD PARITY — CUSTOM STATUS, BANNER, ACTIVITY STATUS
  // ═════════════════════════════════════════════════════════════════

  @Put('profile/custom-status')
  async updateCustomStatus(
    @TenantId() tenantId: string,
    @Body() body: { userId: string; status: string | null; expiresAt?: string },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    return this.chatService.updateCustomStatus(tenantId, body.userId, body.status, body.expiresAt ? new Date(body.expiresAt) : undefined);
  }

  @Put('profile/activity-status')
  async updateActivityStatus(
    @TenantId() tenantId: string,
    @Body() body: { userId: string; activity: string | null },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    return this.chatService.updateActivityStatus(tenantId, body.userId, body.activity);
  }

  @Put('profile/banner')
  async updateBanner(
    @TenantId() tenantId: string,
    @Body() body: { userId: string; bannerUrl: string | null },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    return this.chatService.updateBanner(tenantId, body.userId, body.bannerUrl);
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ DISCORD PARITY — MULTI-FORWARD
  // ═════════════════════════════════════════════════════════════════

  @Post('messages/:msgId/forward-many')
  async forwardToMany(
    @TenantId() tenantId: string,
    @Param('msgId') messageId: string,
    @Body() body: { userId: string; targetConversationIds: string[] },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    if (!body.targetConversationIds || body.targetConversationIds.length === 0) {
      throw new BadRequestException('targetConversationIds cannot be empty');
    }
    return this.chatService.forwardMessageToMany(tenantId, body.userId, messageId, body.targetConversationIds);
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ DISCORD PARITY — VOICE CHANNELS, STAGE CHANNELS, LIVE STREAMS
  // ═════════════════════════════════════════════════════════════════

  @Post('voice-channels')
  async createVoiceChannel(
    @TenantId() tenantId: string,
    @Body() body: { userId: string; name: string; description?: string; type?: 'VOICE' | 'STAGE' | 'GO_LIVE'; conversationId?: string; maxUsers?: number },
  ) {
    if (!body.userId || !body.name) throw new BadRequestException('userId and name are required');
    return this.chatService.createVoiceChannel(tenantId, body.userId, {
      name: body.name,
      description: body.description,
      type: body.type,
      conversationId: body.conversationId,
      maxUsers: body.maxUsers,
    });
  }

  @Get('voice-channels')
  async listVoiceChannels(@TenantId() tenantId: string) {
    return this.chatService.listVoiceChannels(tenantId);
  }

  @Post('voice-channels/:id/join')
  async joinVoiceChannel(
    @TenantId() tenantId: string,
    @Param('id') channelId: string,
    @Body() body: { userId: string; socketId?: string },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    return this.chatService.joinVoiceChannel(tenantId, body.userId, channelId, body.socketId);
  }

  @Post('voice-channels/:id/leave')
  async leaveVoiceChannel(
    @TenantId() tenantId: string,
    @Param('id') channelId: string,
    @Body() body: { userId: string },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    return this.chatService.leaveVoiceChannel(tenantId, body.userId, channelId);
  }

  @Get('voice-channels/:id/users')
  async getVoiceChannelUsers(@Param('id') channelId: string) {
    return this.chatService.getVoiceChannelUsers(channelId);
  }

  @Put('voice-channels/:id/state')
  async updateVoiceState(
    @TenantId() tenantId: string,
    @Param('id') channelId: string,
    @Body() body: { userId: string; muted?: boolean; deafened?: boolean; speaking?: boolean },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    return this.chatService.updateVoiceState(tenantId, body.userId, channelId, {
      muted: body.muted,
      deafened: body.deafened,
      speaking: body.speaking,
    });
  }

  /**
   * ⭐ V4 — Bascule audio↔vidéo d'un canal vocal (contrôle admin, porté de
   *    Yeshua Connect) : tous les clients re-rendent la grille vidéo.
   */
  @Put('voice-channels/:id/video-mode')
  async setVoiceVideoMode(
    @TenantId() tenantId: string,
    @Param('id') channelId: string,
    @Body() body: { userId: string; videoMode: boolean },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    return this.chatService.setVoiceVideoMode(tenantId, body.userId, channelId, !!body.videoMode);
  }

  @Delete('voice-channels/:id')
  async deleteVoiceChannel(
    @TenantId() tenantId: string,
    @Param('id') channelId: string,
    @Body() body: { userId: string },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    return this.chatService.deleteVoiceChannel(tenantId, body.userId, channelId);
  }

  /**
   * ⭐ DISCORD PARITY — LiveKit token endpoint for voice/stage/live channels.
   *
   * Returns a LiveKit access token + server URL that the frontend uses with
   * `livekit-client` to connect to the SFU. If LiveKit is not configured
   * (no LIVEKIT_URL / API_KEY / API_SECRET env vars), returns
   * `{ configured: false, fallbackToMesh: true }` and the frontend falls
   * back to the existing mesh WebRTC implementation (≤5 participants).
   *
   * For STAGE channels, non-broadcasters get a subscribe-only token.
   */
  @Post('voice-channels/:id/token')
  async getVoiceChannelToken(
    @TenantId() tenantId: string,
    @Param('id') channelId: string,
    @Body() body: { userId: string; isBroadcaster?: boolean },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    // Verify the channel exists and get its type (VOICE/STAGE/GO_LIVE)
    const channels: any[] = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT type FROM "chat_voice_channels" WHERE id = $1 AND "tenantId" = $2
    `, channelId, tenantId);
    if (channels.length === 0) throw new BadRequestException('Voice channel not found');
    const channelType: string = channels[0].type;

    // For STAGE channels, only the broadcaster can publish; listeners subscribe only
    const isBroadcaster = channelType === 'STAGE' ? (body.isBroadcaster ?? false) : true;

    return this.livekitTokenService.mintToken(body.userId, channelId, {
      canPublish: isBroadcaster,
      canSubscribe: true,
      canPublishData: isBroadcaster,
      isBroadcaster,
    });
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ DISCORD PARITY — LIVE STREAMS (Go Live)
  // ═════════════════════════════════════════════════════════════════

  @Post('live-streams')
  async startLiveStream(
    @TenantId() tenantId: string,
    @Body() body: { userId: string; title?: string; conversationId?: string; channelId?: string },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    return this.chatService.startLiveStream(tenantId, body.userId, {
      title: body.title,
      conversationId: body.conversationId,
      channelId: body.channelId,
    });
  }

  @Delete('live-streams/:id')
  async endLiveStream(
    @TenantId() tenantId: string,
    @Param('id') streamId: string,
    @Body() body: { userId: string },
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    return this.chatService.endLiveStream(tenantId, body.userId, streamId);
  }

  @Get('live-streams')
  async listLiveStreams(@TenantId() tenantId: string) {
    return this.chatService.listLiveStreams(tenantId);
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ DISCORD PARITY — STICKERS
  // ═════════════════════════════════════════════════════════════════

  @Post('stickers/packs')
  async createStickerPack(
    @TenantId() tenantId: string,
    @Body() body: { userId: string; name: string; description?: string },
  ) {
    if (!body.userId || !body.name) throw new BadRequestException('userId and name are required');
    return this.chatService.createStickerPack(tenantId, body.userId, { name: body.name, description: body.description });
  }

  @Get('stickers/packs')
  async listStickerPacks(@TenantId() tenantId: string) {
    return this.chatService.listStickerPacks(tenantId);
  }

  @Post('stickers')
  @UseInterceptors(FileInterceptor('file', CHAT_FILE_UPLOAD_OPTIONS))
  async uploadSticker(
    @TenantId() tenantId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { userId: string; packId: string; name?: string; keywords?: string },
  ) {
    if (!file) throw new BadRequestException('file is required');
    if (!body.userId || !body.packId) throw new BadRequestException('userId and packId are required');
    return this.chatService.uploadSticker(tenantId, body.userId, {
      packId: body.packId,
      file,
      name: body.name,
      keywords: body.keywords,
    });
  }

  @Get('stickers/:packId')
  async listStickers(@Param('packId') packId: string) {
    return this.chatService.listStickers(packId);
  }

  @Post('conversations/:id/sticker')
  // ⭐ V5 (chantier 4) — ANTI-SPAM : les stickers sont des messages aussi
  @Throttle({ medium: { limit: 30, ttl: 60000 } })
  async sendStickerMessage(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Body() body: { senderId: string; stickerId: string },
  ) {
    if (!body.senderId || !body.stickerId) throw new BadRequestException('senderId and stickerId are required');
    return this.chatService.sendStickerMessage(tenantId, body.senderId, conversationId, body.stickerId);
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ DISCORD PARITY — GIF SEARCH (Tenor API proxy)
  // ═════════════════════════════════════════════════════════════════

  @Get('gifs/search')
  async searchGifs(@Query('q') query: string, @Query('limit') limit?: string) {
    if (!query) throw new BadRequestException('Query parameter "q" is required');
    return this.chatService.searchGifs(query, limit ? parseInt(limit, 10) : 20);
  }
}

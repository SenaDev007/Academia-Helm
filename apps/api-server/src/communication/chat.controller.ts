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
  Controller, Get, Post, Body, Param, Query, Res, UseGuards,
  UseInterceptors, UploadedFile, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { ChatService } from './services/chat.service';
import { StorageService } from '../../common/services/storage.service';
import { PushNotificationService } from './services/push-notification.service';
// ⭐ NOTE: We DO NOT use `import * as multer from 'multer'` here — it causes
//    a CommonJS interop crash at runtime ("_multer is not a function")
//    because multer's `module.exports` is a FUNCTION (not an object with named exports).
//    Instead, we import only the named exports we need (`memoryStorage`) and pass
//    the options INLINE to FileInterceptor below.
import { memoryStorage } from 'multer';

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
  ) {}

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

  @Post('conversations/group')
  async createGroupConversation(
    @TenantId() tenantId: string,
    @Body() body: { creatorId: string; name: string; description?: string; participantIds: string[]; avatarUrl?: string },
  ) {
    if (!body.creatorId) throw new BadRequestException('creatorId is required');
    return this.chatService.createGroupConversation(tenantId, body.creatorId, body);
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
  async sendTextMessage(
    @TenantId() tenantId: string,
    @Param('id') conversationId: string,
    @Body() body: { senderId: string; content: string; replyToId?: string },
  ) {
    if (!body.senderId || !body.content) {
      throw new BadRequestException('senderId and content are required');
    }
    return this.chatService.sendTextMessage(tenantId, body.senderId, conversationId, body);
  }

  @Post('conversations/:id/messages/attachment')
  @UseInterceptors(FileInterceptor('file', CHAT_FILE_UPLOAD_OPTIONS))
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

  @Get('unread-count')
  async getUnreadCount(
    @TenantId() tenantId: string,
    @Query('userId') userId: string,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    return this.chatService.getUnreadCount(tenantId, userId);
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
  async subscribeToChannel(@Param('id') channelId: string, @Body() body: { userId: string }) {
    if (!body.userId) throw new BadRequestException('userId requis');
    return this.chatService.subscribeToChannel(channelId, body.userId);
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
}

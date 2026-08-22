/**
 * ============================================================================
 * CHAT GATEWAY — WebSocket (Socket.io) pour messagerie temps réel
 * ============================================================================
 *
 * Fonctionnalités temps réel :
 *   - New message broadcasted to all conversation participants
 *   - Typing indicator (user is typing…)
 *   - Presence (user online/offline)
 *   - Read receipts (message marked as read)
 *
 * Sécurité :
 *   - Authentification par JWT lors du handshake Socket.io
 *   - Chaque user rejoint une room "user:{userId}" pour recevoir ses notifs
 *   - Chaque conversation a une room "conv:{conversationId}"
 *
 * Le gateway ne fait PAS persistance — il reçoit les events et les
 * re-broadcast aux rooms appropriées. La persistance est faite via
 * l'API REST (ChatController → ChatService).
 * ============================================================================
 */

import {
  WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection,
  OnGatewayDisconnect, MessageBody, ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

// ⭐ Configuration CORS pour autoriser le web-app
//    Le gateway écoute sur le même port que l'API REST (3001 ou selon config)
@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      'https://academiahelm.com',
      'https://app.academiahelm.com',
      'https://preview-*.space-z.ai',
    ],
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  // ⭐ Map userId → Set<Socket> (un user peut avoir plusieurs connexions)
  private userSockets: Map<string, Set<string>> = new Map();
  // ⭐ Map socketId → userId (pour déconnexion)
  private socketToUser: Map<string, string> = new Map();

  constructor(private readonly jwtService: JwtService) {}

  /**
   * Authentifie le socket via le JWT passé dans le handshake auth.
   */
  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token
        || (client.handshake.headers?.authorization?.replace('Bearer ', ''))
        || (client.handshake.query?.token as string);

      if (!token) {
        this.logger.warn(`Socket ${client.id} disconnected: no token`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const userId = payload.sub || payload.userId || payload.id;
      if (!userId) {
        this.logger.warn(`Socket ${client.id} disconnected: invalid token (no userId)`);
        client.disconnect();
        return;
      }

      // ⭐ Associer le socket à l'utilisateur
      client.data.userId = userId;
      this.socketToUser.set(client.id, userId);
      if (!this.userSockets.has(userId)) this.userSockets.set(userId, new Set());
      this.userSockets.get(userId)!.add(client.id);

      // Rejoindre la room personnelle
      client.join(`user:${userId}`);

      // Notifier les autres que l'utilisateur est en ligne
      client.broadcast.emit('user:online', { userId });

      this.logger.log(`Socket ${client.id} connected → user ${userId}`);
    } catch (e: any) {
      this.logger.error(`Socket ${client.id} connection failed: ${e.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.socketToUser.get(client.id);
    if (userId) {
      this.socketToUser.delete(client.id);
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
          // L'utilisateur est maintenant hors-ligne
          this.server.emit('user:offline', { userId });
        }
      }
    }
    this.logger.log(`Socket ${client.id} disconnected`);
  }

  /**
   * Rejoint une room de conversation (pour recevoir les nouveaux messages).
   */
  @SubscribeMessage('conversation:join')
  handleJoinConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `conv:${data.conversationId}`;
    client.join(room);
    this.logger.log(`User ${client.data.userId} joined conversation room ${room}`);
    return { status: 'joined', room };
  }

  /**
   * Quitte une room de conversation.
   */
  @SubscribeMessage('conversation:leave')
  handleLeaveConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `conv:${data.conversationId}`;
    client.leave(room);
    return { status: 'left', room };
  }

  /**
   * Indicateur de frappe (typing).
   */
  @SubscribeMessage('typing:start')
  handleTypingStart(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;
    if (!userId) return;
    client.to(`conv:${data.conversationId}`).emit('typing:start', {
      conversationId: data.conversationId,
      userId,
    });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;
    if (!userId) return;
    client.to(`conv:${data.conversationId}`).emit('typing:stop', {
      conversationId: data.conversationId,
      userId,
    });
  }

  /**
   * Vérifie si un utilisateur est en ligne (utile pour afficher le statut).
   */
  @SubscribeMessage('user:check-online')
  handleCheckOnline(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const isOnline = this.userSockets.has(data.userId);
    return { userId: data.userId, isOnline };
  }

  // ═════════════════════════════════════════════════════════════════
  //  Méthodes utilitaires publiques — appelées par ChatController pour
  //  broadcaster les events sans avoir à connaître les détails Socket.io.
  // ═════════════════════════════════════════════════════════════════

  /**
   * Broadcast un nouveau message à tous les participants d'une conversation.
   * Appelé par ChatService après insertion en DB.
   */
  broadcastNewMessage(conversationId: string, message: any, participantIds: string[]) {
    // Émettre dans la room de conversation (participants connectés)
    this.server.to(`conv:${conversationId}`).emit('message:new', { conversationId, message });

    // Émettre aussi une notif "inbox" à chaque user (badge non lus, etc.)
    // Sauf à l'expéditeur (il sait déjà qu'il a envoyé)
    for (const userId of participantIds) {
      if (userId !== message.senderId) {
        this.server.to(`user:${userId}`).emit('inbox:new', {
          conversationId,
          preview: message.content || `[${message.type}]`,
          senderName: message.sender?.firstName ? `${message.sender.firstName} ${message.sender.lastName || ''}`.trim() : 'Inconnu',
        });
      }
    }
  }

  /**
   * Broadcast un accusé de lecture (whatsapp blue ticks).
   */
  broadcastReadReceipt(conversationId: string, userId: string, messageIds: string[]) {
    this.server.to(`conv:${conversationId}`).emit('message:read', {
      conversationId,
      userId,
      messageIds,
    });
  }
}

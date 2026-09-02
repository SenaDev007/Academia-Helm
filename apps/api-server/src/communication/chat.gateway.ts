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
  //  ⭐ V2 — WEBRTC CALL SIGNALING
  //    Events: call:offer, call:answer, call:ice-candidate,
  //            call:reject, call:hangup
  // ═════════════════════════════════════════════════════════════════

  @SubscribeMessage('call:offer')
  handleCallOffer(
    @MessageBody() data: { toUserId: string; callId: string; callType: string; offer: any; callerName?: string; callerAvatarUrl?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const callerId = client.data.userId;
    if (!callerId) return;
    // Forward the offer to the callee's socket room — include callerName + avatar
    // so the recipient can display the real caller name without a DB lookup.
    this.server.to(`user:${data.toUserId}`).emit('call:offer', {
      fromUserId: callerId,
      callId: data.callId,
      callType: data.callType,
      offer: data.offer,
      callerName: data.callerName || null,
      callerAvatarUrl: data.callerAvatarUrl || null,
    });
  }

  @SubscribeMessage('call:answer')
  handleCallAnswer(
    @MessageBody() data: { toUserId: string; callId: string; answer: any },
    @ConnectedSocket() client: Socket,
  ) {
    const calleeId = client.data.userId;
    if (!calleeId) return;
    this.server.to(`user:${data.toUserId}`).emit('call:answer', {
      fromUserId: calleeId,
      callId: data.callId,
      answer: data.answer,
    });
  }

  @SubscribeMessage('call:ice-candidate')
  handleIceCandidate(
    @MessageBody() data: { toUserId: string; callId: string; candidate: any },
    @ConnectedSocket() client: Socket,
  ) {
    const fromUserId = client.data.userId;
    if (!fromUserId) return;
    this.server.to(`user:${data.toUserId}`).emit('call:ice-candidate', {
      fromUserId,
      callId: data.callId,
      candidate: data.candidate,
    });
  }

  @SubscribeMessage('call:reject')
  handleCallReject(
    @MessageBody() data: { toUserId: string; callId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const fromUserId = client.data.userId;
    if (!fromUserId) return;
    this.server.to(`user:${data.toUserId}`).emit('call:reject', {
      fromUserId,
      callId: data.callId,
    });
  }

  @SubscribeMessage('call:hangup')
  handleCallHangup(
    @MessageBody() data: { toUserId: string; callId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const fromUserId = client.data.userId;
    if (!fromUserId) return;
    this.server.to(`user:${data.toUserId}`).emit('call:hangup', {
      fromUserId,
      callId: data.callId,
    });
  }

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V3-6 — GROUP CALLS (mesh topology)
  //    Events: group-call:invite, group-call:leave
  //
  //    Mesh approach (no SFU): the initiator sends a `group-call:invite`
  //    to each participant. Each participant then establishes a 1-à-1
  //    WebRTC peer connection with the initiator (and optionally with
  //    each other for a true mesh). Uses the existing `call:offer`/
  //    `call:answer`/`call:ice-candidate` events with a shared `callId`.
  //
  //    Works well for up to 4-5 participants. Beyond that, a SFU
  //    (Selective Forwarding Unit) like mediasoup or Janus would be
  //    needed to scale.
  // ═════════════════════════════════════════════════════════════════

  @SubscribeMessage('group-call:invite')
  handleGroupCallInvite(
    @MessageBody() data: {
      toUserIds: string[];
      callId: string;
      callType: string;
      conversationId: string;
      callerName?: string;
      callerAvatarUrl?: string;
      participantNames?: Record<string, string>; // userId → name (for the recipient to display others)
    },
    @ConnectedSocket() client: Socket,
  ) {
    const callerId = client.data.userId;
    if (!callerId || !data.toUserIds || data.toUserIds.length === 0) return;

    // ⭐ Forward the invite to each participant's socket room
    for (const toUserId of data.toUserIds) {
      this.server.to(`user:${toUserId}`).emit('group-call:invite', {
        fromUserId: callerId,
        callId: data.callId,
        callType: data.callType,
        conversationId: data.conversationId,
        callerName: data.callerName || null,
        callerAvatarUrl: data.callerAvatarUrl || null,
        participantNames: data.participantNames || {},
      });
    }
  }

  @SubscribeMessage('group-call:leave')
  handleGroupCallLeave(
    @MessageBody() data: { toUserIds: string[]; callId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const fromUserId = client.data.userId;
    if (!fromUserId) return;
    for (const toUserId of data.toUserIds) {
      this.server.to(`user:${toUserId}`).emit('group-call:leave', {
        fromUserId,
        callId: data.callId,
      });
    }
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

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V4 — SIGNALISATION DES APPELS (porté de Yeshua Connect)
  //    Diffuse instantanément un appel entrant aux rooms personnelles
  //    des destinataires (plus rapide que le polling 3 s — le polling
  //    reste le filet de sécurité, comme dans Yeshua Connect).
  // ═════════════════════════════════════════════════════════════════

  broadcastCallIncoming(recipientUserIds: string[], payload: {
    callId: string;
    conversationId: string;
    convName: string;
    convAvatarUrl?: string;
    convType: string;
    isGroupCall: boolean;
    callType: 'audio' | 'video';
    initiatorId: string;
    initiatorName: string;
    initiatorAvatarUrl?: string;
  }) {
    for (const userId of recipientUserIds) {
      this.server.to(`user:${userId}`).emit('call:incoming', payload);
    }
  }

  /** ⭐ V4 — Filet de sécurité : la gateway ne connaît pas les ids
   *  récipiendaires → variante broadcast large sur la room de conversation. */
  broadcastCallIncomingToConversation(conversationId: string, payload: any) {
    this.server.to(`conv:${conversationId}`).emit('call:incoming', payload);
  }

  /**
   * ⭐ V4 — Bascule audio↔vidéo d'un canal vocal (contrôle admin) :
   * notifie tous les clients du canal pour re-rendre la grille vidéo.
   */
  broadcastVoiceVideoMode(conversationId: string, videoMode: boolean) {
    this.server.to(`conv:${conversationId}`).emit('voice:video-mode', {
      conversationId,
      videoMode,
    });
  }

  /**
   * ⭐ V4 — Changement d'état d'un canal vocal (join/leave/mute) :
   * notifie les membres connectés pour rafraîchir la liste des présents.
   */
  broadcastVoiceUsersChanged(conversationId: string, users: any[]) {
    this.server.to(`conv:${conversationId}`).emit('voice:users-changed', {
      conversationId,
      users,
    });
  }
}

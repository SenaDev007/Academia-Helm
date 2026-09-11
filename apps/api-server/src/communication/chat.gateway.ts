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
import { PrismaService } from '../database/prisma.service';

// ⭐ Configuration CORS pour autoriser le web-app
//    Le gateway écoute sur le même port que l'API REST (3000 ou selon config)
//    ⭐ V5 — CORRECTIF DEV : le web-app Next.js tourne sur 3001 en dev —
//    il manquait à la whitelist (seul 3000, le port API, y figurait) →
//    handshake Socket.io rejeté par CORS en développement.
//
//    ⭐ V5.2 — CORRECTIF PORTAILS ÉCOLES (bug de production) :
//    La whitelist statique précédente ne contenait QUE 4 origines littérales
//    + 'https://preview-*.space-z.ai' — or le package `cors` ne fait PAS
//    d'expansion de wildcard dans un tableau de chaînes (comparaison exacte)
//    → cette entrée ne matchait JAMAIS, et surtout TOUS les sous-domaines
//    des portails écoles (*.academiahelm.com — ex: lepalmaresplus.academiahelm.com)
//    étaient REJETÉS au handshake : plus de temps réel sur les portails
//    (message:new, typing, présence) et surtout plus de signalisation
//    d'appels (call:incoming / call:offer / answer / ice-candidate) —
//    les appels mesh ne sonnaient plus, le polling 3 s faisait tout le
//    travail, et le mesh WebRTC ne passait pas du tout.
//    On aligne maintenant le gateway sur la MÊME politique regex que le
//    CORS REST de main.ts (fonction dynamique, jamais d'erreur → false).
const SOCKET_ALLOWED_ORIGINS: RegExp[] = [
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,        // Dev local (3000/3001/…)
  /^https:\/\/(.+\.)?academiahelm\.com$/,                // Prod + portails écoles (*.academiahelm.com)
  /^https:\/\/(.+\.)?academia-hub\.pro$/,                // Domaine alternatif
  /^https?:\/\/(\d{1,3}\.){3}\d{1,3}(:\d+)?$/,           // IPs directes (VPS, tests)
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/,                 // Vercel preview deployments
  /^https:\/\/preview-[a-z0-9-]+\.space-z\.ai$/,         // Sandbox de dév (regex — le littéral 'preview-*.space-z.ai' ne matchait rien)
];

/** Même sémantique que main.ts : autorisé OU dev → true ; sinon false (jamais d'erreur). */
function socketOriginAllowed(origin: string): boolean {
  if (SOCKET_ALLOWED_ORIGINS.some((re) => re.test(origin))) return true;
  if (process.env.NODE_ENV !== 'production') return true;
  return false;
}

@WebSocketGateway({
  cors: {
    // ⚠️ Signature du package `cors` (utilisé par engine.io) : la fonction
    // origin est appelée avec (origin: string, callback) — PAS (req, cb).
    // Vérifié dans node_modules/cors/lib/index.js (l.219) : originCallback
    // est appelé sur req.headers.origin DIRECTEMENT. (V5.2 : une première
    // version du correctif lisait req.headers.origin → toujours undefined
    // → branche « pas un navigateur » → tout était autorisé.)
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Sans origin (apps natives Flutter, appels serveur-serveur) → autorisé
      if (!origin) return callback(null, true);
      const allowed = socketOriginAllowed(origin);
      if (!allowed) {
        // ⚠️ Ne JAMAIS passer d'erreur (403) — false = handshake bloqué proprement
        new Logger(ChatGateway.name).warn(
          `CORS socket: origin ${origin} not allowed (returning false, not error)`,
        );
      }
      return callback(null, allowed);
    },
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

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

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

      // ⭐ Associer le socket à l'utilisateur (et à son tenant pour la présence)
      client.data.userId = userId;
      client.data.tenantId = payload.tenantId || null;
      this.socketToUser.set(client.id, userId);
      if (!this.userSockets.has(userId)) this.userSockets.set(userId, new Set());
      this.userSockets.get(userId)!.add(client.id);

      // Rejoindre la room personnelle
      client.join(`user:${userId}`);

      // ⭐ FIX PERFORMANCE CONCURRENCE — présence SCOPÉE au tenant :
      //    AVANT : client.broadcast.emit('user:online') envoyait à TOUS les
      //    sockets de TOUS les tenants (O(N²) global : 200 sockets = 40 000
      //    messages par burst de connexions + fuite de présence cross-tenant).
      //    Désormais chaque socket rejoint la room `tenant:<tenantId>` et la
      //    présence n'est émise qu'aux membres du MÊME tenant (école).
      const tenantId = client.data.tenantId;
      if (tenantId) {
        client.join(`tenant:${tenantId}`);
        client.to(`tenant:${tenantId}`).emit('user:online', { userId });
      } else {
        client.broadcast.emit('user:online', { userId });
      }

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
          // L'utilisateur est maintenant hors-ligne — présence SCOPÉE au tenant
          // (⭐ FIX PERF : avant, émise globalement à TOUS les sockets de
          //  TOUS les tenants — O(N²) cross-tenant).
          const tenantId = client.data?.tenantId;
          if (tenantId) {
            this.server.to(`tenant:${tenantId}`).emit('user:offline', { userId });
          } else {
            this.server.emit('user:offline', { userId });
          }
        }
      }
    }
    this.logger.log(`Socket ${client.id} disconnected`);
  }

  /**
   * Rejoint une room de conversation (pour recevoir les nouveaux messages).
   *
   * ⭐ FIX SÉCURITÉ + PERFORMANCE CONCURRENCE — vérification d'appartenance :
   *    AVANT : n'importe quel utilisateur authentifié (de N'IMPORTE QUEL
   *    tenant) pouvait rejoindre N'IMPORTELLE room `conv:<id>` sans contrôle,
   *    recevoir les messages en temps réel, et gonfler le fan-out de chaque
   *    broadcast (un client malveillant ou buggé pouvait joindre des
   *    milliers de rooms et amplifier chaque message envoyé).
   *    Désormais : 1 requête de vérification par join (les joins sont rares —
   *    à l'ouverture d'une conversation).
   */
  @SubscribeMessage('conversation:join')
  async handleJoinConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { status: 'error', error: 'unauthenticated' };
    }
    try {
      const membership: Array<{ userId: string }> = await this.prisma.$queryRawUnsafe<
        Array<{ userId: string }>
      >(
        `SELECT "userId" FROM "chat_participants"
         WHERE "conversationId" = $1 AND "userId" = $2 AND "leftAt" IS NULL
         LIMIT 1`,
        data.conversationId, userId,
      );
      if (membership.length === 0) {
        this.logger.warn(
          `User ${userId} tried to join conversation ${data.conversationId} without membership — DENIED`,
        );
        return { status: 'denied', error: 'not a participant' };
      }
    } catch (e: any) {
      // DB indisponible — on refuse (fail-closed : ne pas laisser un client
      // non vérifié écouter une conversation)
      this.logger.warn(`conversation:join membership check failed: ${e?.message || e}`);
      return { status: 'error', error: 'membership check unavailable' };
    }
    const room = `conv:${data.conversationId}`;
    client.join(room);
    this.logger.log(`User ${userId} joined conversation room ${room}`);
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
    // ⭐ V6.1 (fix « Inconnu ») : priorité aux noms résolus par le service
    //    (champs plats senderFirstName/senderLastName — comptes enseignants
    //    matricule dont le nom vit dans la table teachers).
    const senderFirst = message.senderFirstName ?? message.sender?.firstName ?? null;
    const senderLast = message.senderLastName ?? message.sender?.lastName ?? null;
    const senderName = (senderFirst || senderLast)
      ? `${senderFirst || ''} ${senderLast || ''}`.trim()
      : 'Utilisateur';
    for (const userId of participantIds) {
      if (userId !== message.senderId) {
        this.server.to(`user:${userId}`).emit('inbox:new', {
          conversationId,
          preview: message.content || `[${message.type}]`,
          senderName,
        });
      }
    }
  }

  /**
   * ⭐ V6.1 — Diffusion temps réel d'un message de CANAL aux abonnés :
   *   - 'message:new' sur la room conv:<channelId> (clients ayant rejoint
   *     la room du canal — même mécanisme que les conversations)
   *   - 'channel:message' sur les rooms personnelles des abonnés (mise à
   *     jour de la sidebar Canaux : preview + tri + badge, même si le
   *     canal n'est pas ouvert)
   */
  broadcastChannelMessage(channelId: string, message: any, subscriberUserIds: string[]) {
    this.server.to(`conv:${channelId}`).emit('message:new', {
      conversationId: channelId,
      message,
      isChannel: true,
    });
    for (const userId of subscriberUserIds) {
      if (userId !== message.senderId) {
        this.server.to(`user:${userId}`).emit('channel:message', {
          channelId,
          message,
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

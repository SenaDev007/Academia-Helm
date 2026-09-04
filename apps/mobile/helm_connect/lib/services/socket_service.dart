/**
 * ============================================================================
 * SOCKET SERVICE — Real-time messaging via Socket.io (Flutter client)
 * ============================================================================
 *
 * Connects to the NestJS ChatGateway at /chat namespace.
 * Replaces HTTP polling (10s/15s) with instant push events.
 *
 * ⭐ V5 — SINGLETON : une seule connexion partagée par toute l'app.
 *    (avant, chaque ConversationDetailScreen créait SA propre connexion ;
 *    les callbacks étaient écrasés en sortie d'écran → les appels entrants
 *    n'étaient reçus que depuis l'écran de la conversation concernée).
 *    Toutes les API publiques restent identiques (factory → instance).
 *
 * Events handled:
 *   - message:new        → new message received
 *   - message:read       → ⭐ V7 someone read my messages (✓✓ blue)
 *   - message:edited     → ⭐ V7 a message was edited
 *   - message:deleted    → ⭐ V7 a message was deleted for everyone
 *   - reaction:toggle    → ⭐ V7 a reaction was added/removed
 *   - message:pinned     → ⭐ V7 a message was pinned
 *   - message:unpinned   → ⭐ V7 a message was unpinned
 *   - channel:message    → ⭐ V7 new message on a subscribed channel
 *   - inbox:new          → ⭐ V7 new message in ANY conv (badge + refresh)
 *   - typing:start       → someone started typing
 *   - typing:stop        → someone stopped typing
 *   - user:online        → user came online
 *   - user:offline       → user went offline
 *   - call:offer         → incoming call (WebRTC)
 *   - call:answer        → call answered
 *   - call:ice-candidate → ICE candidate exchange
 *   - call:reject        → call rejected
 *   - call:hangup        → call ended
 *   - call:incoming      → ⭐ V4 REST signaling: a call is ringing for me
 *   - group-call:invite  → ⭐ group call mesh invite
 *   - group-call:leave   → ⭐ a participant left the group call
 *
 * Usage:
 *   final socket = SocketService();   // → shared singleton
 *   await socket.connect(token: 'jwt...', userId: '...');
 *   socket.onNewMessage = (msg) { ... };
 *   socket.emit('typing:start', {'conversationId': convId});
 * ============================================================================
 */

import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as IO;

class SocketService {
  // ⭐ V5 — singleton partagé (une seule connexion /chat pour toute l'app)
  static final SocketService _instance = SocketService._internal();
  factory SocketService() => _instance;
  SocketService._internal();

  IO.Socket? _socket;
  bool _isConnected = false;
  bool _wasConnectedBefore = false;

  // Callbacks
  void Function(Map<String, dynamic> message)? onNewMessage;
  // ⭐ V7 (parité web) — events temps réel étendus
  void Function(String conversationId, String userId, List<String> messageIds)? onMessageRead;
  void Function(String messageId, String content, String? editedAt)? onMessageEdited;
  void Function(String messageId)? onMessageDeleted;
  void Function(String messageId, String emoji, String userId, String action, int count)? onReactionToggle;
  void Function(String conversationId, String messageId, String by)? onMessagePinned;
  void Function(String conversationId, String messageId, String by)? onMessageUnpinned;
  void Function(String channelId, Map<String, dynamic> message)? onChannelMessage;
  void Function(String conversationId, String preview, String senderName)? onInboxNew;
  void Function(String conversationId, String userId)? onTypingStart;
  void Function(String conversationId, String userId)? onTypingStop;
  void Function(String userId)? onUserOnline;
  void Function(String userId)? onUserOffline;
  void Function(Map<String, dynamic> data)? onCallOffer;
  void Function(Map<String, dynamic> data)? onCallAnswer;
  void Function(Map<String, dynamic> data)? onCallIceCandidate;
  void Function(Map<String, dynamic> data)? onCallReject;
  void Function(Map<String, dynamic> data)? onCallHangup;
  // ⭐ V5 — signalisation REST des appels (porté du web V4)
  void Function(Map<String, dynamic> data)? onCallIncoming;
  // ⭐ V5 — appels de groupe (mesh)
  void Function(Map<String, dynamic> data)? onGroupCallInvite;
  void Function(Map<String, dynamic> data)? onGroupCallLeave;
  // ⭐ V3-1: fired on every (re)connect — used to flush pending offline messages
  void Function()? onConnectCallback;

  bool get isConnected => _isConnected;

  Future<void> connect({required String token, required String userId}) async {
    if (_socket != null) return;

    // ⭐ V5.2 — CORRECTIF CRITIQUE (bug de production) :
    //    V3-9 connectait le socket à https://academiahelm.com/chat en
    //    supposant que « le BFF proxifie Socket.io » — mais le BFF Next.js
    //    (route handlers HTTP) ne proxifie PAS les WebSockets, et aucun
    //    rewrite /chat n'existe en production (next.config rewrites = []
    //    hors dev). Résultat : handshake 404 → le temps réel mobile était
    //    MORT (messages en polling, appels entrants jamais poussés).
    //    On connecte donc DIRECTEMENT le NestJS qui héberge la gateway :
    //    https://api.academiahelm.com (namespace /chat, JWT au handshake,
    //    les apps natives n'envoient pas d'Origin → pas de contrainte CORS).
    //    La gateway est partagée entre tenants (l'identité vient du JWT).
    const backendUrl = 'https://api.academiahelm.com';

    _socket = IO.io('$backendUrl/chat', IO.OptionBuilder()
      .setAuth({'token': token})
      .setTransports(['websocket'])
      .enableReconnection()
      .setReconnectionDelay(3000)
      .setReconnectionAttempts(10)
      .build(),
    );

    _socket!.onConnect((_) {
      _isConnected = true;
      print('[SocketService] Connected to /chat namespace');
      // ⭐ V3-1: fire onConnectCallback — on first connect OR on reconnect.
      //    Used by ConversationDetailScreen to flush the offline pending queue.
      if (_wasConnectedBefore) {
        print('[SocketService] Reconnected — triggering pending flush');
      }
      _wasConnectedBefore = true;
      onConnectCallback?.call();
    });

    _socket!.onDisconnect((_) {
      _isConnected = false;
      print('[SocketService] Disconnected');
    });

    // Message events
    _socket!.on('message:new', (data) {
      if (data is Map<String, dynamic>) {
        onNewMessage?.call(data);
      }
    });

    // ⭐ V7 (parité web) — accusés de lecture temps réel (✓✓ bleu)
    _socket!.on('message:read', (data) {
      if (data is Map) {
        final ids = (data['messageIds'] as List<dynamic>? ?? [])
            .map((e) => e.toString())
            .toList();
        onMessageRead?.call(
          data['conversationId']?.toString() ?? '',
          data['userId']?.toString() ?? '',
          ids,
        );
      }
    });

    // ⭐ V7 — message modifié
    _socket!.on('message:edited', (data) {
      if (data is Map) {
        onMessageEdited?.call(
          data['messageId']?.toString() ?? '',
          data['content']?.toString() ?? '',
          data['editedAt']?.toString(),
        );
      }
    });

    // ⭐ V7 — message supprimé pour tous
    _socket!.on('message:deleted', (data) {
      if (data is Map) {
        onMessageDeleted?.call(data['messageId']?.toString() ?? '');
      }
    });

    // ⭐ V7 — réaction ajoutée/retirée
    _socket!.on('reaction:toggle', (data) {
      if (data is Map) {
        onReactionToggle?.call(
          data['messageId']?.toString() ?? '',
          data['emoji']?.toString() ?? '',
          data['userId']?.toString() ?? '',
          data['action']?.toString() ?? 'added',
          (data['count'] as num?)?.toInt() ?? 0,
        );
      }
    });

    // ⭐ V7 — épinglage / désépinglage temps réel
    _socket!.on('message:pinned', (data) {
      if (data is Map) {
        onMessagePinned?.call(
          data['conversationId']?.toString() ?? '',
          data['messageId']?.toString() ?? '',
          data['by']?.toString() ?? '',
        );
      }
    });

    _socket!.on('message:unpinned', (data) {
      if (data is Map) {
        onMessageUnpinned?.call(
          data['conversationId']?.toString() ?? '',
          data['messageId']?.toString() ?? '',
          data['by']?.toString() ?? '',
        );
      }
    });

    // ⭐ V7 — message d'un canal auquel je suis abonné (room personnelle)
    _socket!.on('channel:message', (data) {
      if (data is Map<String, dynamic>) {
        final channelId = data['channelId']?.toString() ?? '';
        final message = data['message'];
        if (message is Map<String, dynamic>) {
          onChannelMessage?.call(channelId, message);
        }
      }
    });

    // ⭐ V7 — nouveau message dans N'IMPORTE QUELLE conversation (badge liste)
    _socket!.on('inbox:new', (data) {
      if (data is Map) {
        onInboxNew?.call(
          data['conversationId']?.toString() ?? '',
          data['preview']?.toString() ?? '',
          data['senderName']?.toString() ?? '',
        );
      }
    });

    // Typing events
    _socket!.on('typing:start', (data) {
      if (data is Map) {
        onTypingStart?.call(data['conversationId'] as String, data['userId'] as String);
      }
    });

    _socket!.on('typing:stop', (data) {
      if (data is Map) {
        onTypingStop?.call(data['conversationId'] as String, data['userId'] as String);
      }
    });

    // Presence events
    _socket!.on('user:online', (data) {
      if (data is Map) {
        onUserOnline?.call(data['userId'] as String);
      }
    });

    _socket!.on('user:offline', (data) {
      if (data is Map) {
        onUserOffline?.call(data['userId'] as String);
      }
    });

    // WebRTC call events
    _socket!.on('call:offer', (data) {
      if (data is Map<String, dynamic>) {
        onCallOffer?.call(data);
      }
    });

    _socket!.on('call:answer', (data) {
      if (data is Map<String, dynamic>) {
        onCallAnswer?.call(data);
      }
    });

    _socket!.on('call:ice-candidate', (data) {
      if (data is Map<String, dynamic>) {
        onCallIceCandidate?.call(data);
      }
    });

    _socket!.on('call:reject', (data) {
      if (data is Map<String, dynamic>) {
        onCallReject?.call(data);
      }
    });

    _socket!.on('call:hangup', (data) {
      if (data is Map<String, dynamic>) {
        onCallHangup?.call(data);
      }
    });

    // ⭐ V5 — signalisation REST : un appel SONNE pour moi (diffusé par la
    //    gateway CallSignalService.start via broadcastCallIncoming — plus
    //    rapide que le polling 3 s, qui reste le filet de sécurité).
    _socket!.on('call:incoming', (data) {
      if (data is Map<String, dynamic>) {
        onCallIncoming?.call(data);
      }
    });

    // ⭐ V5 — appels de groupe (mesh) : invitation + départ
    _socket!.on('group-call:invite', (data) {
      if (data is Map<String, dynamic>) {
        onGroupCallInvite?.call(data);
      }
    });

    _socket!.on('group-call:leave', (data) {
      if (data is Map<String, dynamic>) {
        onGroupCallLeave?.call(data);
      }
    });
  }

  void emit(String event, dynamic data) {
    _socket?.emit(event, data);
  }

  void joinConversation(String conversationId) {
    _socket?.emit('conversation:join', {'conversationId': conversationId});
  }

  void leaveConversation(String conversationId) {
    _socket?.emit('conversation:leave', {'conversationId': conversationId});
  }

  void startTyping(String conversationId) {
    _socket?.emit('typing:start', {'conversationId': conversationId});
  }

  void stopTyping(String conversationId) {
    _socket?.emit('typing:stop', {'conversationId': conversationId});
  }

  // ⭐ V7 (parité web) — demander l'état en ligne d'un utilisateur
  //    (la gateway répond user:online / user:offline)
  void checkUserOnline(String userId) {
    _socket?.emit('user:check-online', {'userId': userId});
  }

  /// ⭐ V7 — recharge les callbacks sans reconnexion (le socket est un
  ///    singleton partagé : les écrans réaffectent leurs callbacks à chaque
  ///    initState — ex. chat_screen après retour d'une conversation).
  void reset() {
    onNewMessage = null;
    onMessageRead = null;
    onMessageEdited = null;
    onMessageDeleted = null;
    onReactionToggle = null;
    onMessagePinned = null;
    onMessageUnpinned = null;
    onChannelMessage = null;
    onInboxNew = null;
    onTypingStart = null;
    onTypingStop = null;
    onUserOnline = null;
    onUserOffline = null;
    onCallOffer = null;
    onCallAnswer = null;
    onCallIceCandidate = null;
    onCallReject = null;
    onCallHangup = null;
    onCallIncoming = null;
    onGroupCallInvite = null;
    onGroupCallLeave = null;
    onConnectCallback = null;
  }

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _isConnected = false;
  }
}

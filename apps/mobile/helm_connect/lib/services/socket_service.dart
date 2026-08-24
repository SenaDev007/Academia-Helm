/**
 * ============================================================================
 * SOCKET SERVICE — Real-time messaging via Socket.io (Flutter client)
 * ============================================================================
 *
 * Connects to the NestJS ChatGateway at /chat namespace.
 * Replaces HTTP polling (10s/15s) with instant push events.
 *
 * Events handled:
 *   - message:new        → new message received
 *   - typing:start       → someone started typing
 *   - typing:stop        → someone stopped typing
 *   - user:online        → user came online
 *   - user:offline       → user went offline
 *   - call:offer         → incoming call (WebRTC)
 *   - call:answer        → call answered
 *   - call:ice-candidate → ICE candidate exchange
 *   - call:reject        → call rejected
 *   - call:hangup        → call ended
 *
 * Usage:
 *   final socket = SocketService();
 *   await socket.connect(token: 'jwt...', userId: '...');
 *   socket.onNewMessage = (msg) { ... };
 *   socket.emit('typing:start', {'conversationId': convId});
 * ============================================================================
 */

import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as IO;

class SocketService {
  IO.Socket? _socket;
  bool _isConnected = false;
  bool _wasConnectedBefore = false;

  // Callbacks
  void Function(Map<String, dynamic> message)? onNewMessage;
  void Function(String conversationId, String userId)? onTypingStart;
  void Function(String conversationId, String userId)? onTypingStop;
  void Function(String userId)? onUserOnline;
  void Function(String userId)? onUserOffline;
  void Function(Map<String, dynamic> data)? onCallOffer;
  void Function(Map<String, dynamic> data)? onCallAnswer;
  void Function(Map<String, dynamic> data)? onCallIceCandidate;
  void Function(Map<String, dynamic> data)? onCallReject;
  void Function(Map<String, dynamic> data)? onCallHangup;
  // ⭐ V3-1: fired on every (re)connect — used to flush pending offline messages
  void Function()? onConnectCallback;

  bool get isConnected => _isConnected;

  Future<void> connect({required String token, required String userId}) async {
    if (_socket != null) return;

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

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _isConnected = false;
  }
}

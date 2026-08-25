// ============================================================================
// CHAT LOCAL STORAGE — Offline cache + send queue (V3-1)
// ============================================================================
//
// Offline-first pour Helm Connect mobile. Permet :
//   1. Affichage instantané des messages au chargement (cache local)
//   2. Envoi de messages hors-ligne (queue pending) + retry au reconnect
//
// Utilise SharedPreferences (déjà présent dans pubspec.yaml). Deux clés :
//   - 'chat_messages_<conversationId>' : JSON array des messages
//   - 'chat_pending_queue' : JSON array des messages en attente d'envoi
//
// Pattern :
//   - Toutes les méthodes sont async et never-throw (log + fallback).
//   - Le cache est limité à 200 messages par conversation (FIFO).
// ============================================================================

import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

// ─── Types ─────────────────────────────────────────────────────────────

class OfflineMessage {
  final String id;
  final String conversationId;
  final String senderId;
  final String type; // TEXT | ATTACHMENT | AUDIO | VIDEO | SYSTEM
  final String content;
  final String? replyToId;
  final String createdAt; // ISO string
  // Local-only:
  final String? status; // pending | sent | failed
  final String? localId;

  OfflineMessage({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.type,
    required this.content,
    this.replyToId,
    required this.createdAt,
    this.status,
    this.localId,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'conversationId': conversationId,
    'senderId': senderId,
    'type': type,
    'content': content,
    'replyToId': replyToId,
    'createdAt': createdAt,
    if (status != null) 'status': status,
    if (localId != null) 'localId': localId,
  };

  factory OfflineMessage.fromJson(Map<String, dynamic> json) {
    return OfflineMessage(
      id: json['id'] as String,
      conversationId: json['conversationId'] as String,
      senderId: json['senderId'] as String,
      type: json['type'] as String? ?? 'TEXT',
      content: json['content'] as String? ?? '',
      replyToId: json['replyToId'] as String?,
      createdAt: json['createdAt'] as String,
      status: json['status'] as String?,
      localId: json['localId'] as String?,
    );
  }
}

class PendingMessage {
  final String localId;
  final String conversationId;
  final String senderId;
  final String content;
  final String? replyToId;
  final String queuedAt; // ISO string
  final int attempts;
  final String? lastError;

  PendingMessage({
    required this.localId,
    required this.conversationId,
    required this.senderId,
    required this.content,
    this.replyToId,
    required this.queuedAt,
    this.attempts = 0,
    this.lastError,
  });

  Map<String, dynamic> toJson() => {
    'localId': localId,
    'conversationId': conversationId,
    'senderId': senderId,
    'content': content,
    'replyToId': replyToId,
    'queuedAt': queuedAt,
    'attempts': attempts,
    if (lastError != null) 'lastError': lastError,
  };

  factory PendingMessage.fromJson(Map<String, dynamic> json) {
    return PendingMessage(
      localId: json['localId'] as String,
      conversationId: json['conversationId'] as String,
      senderId: json['senderId'] as String,
      content: json['content'] as String,
      replyToId: json['replyToId'] as String?,
      queuedAt: json['queuedAt'] as String,
      attempts: (json['attempts'] as num?)?.toInt() ?? 0,
      lastError: json['lastError'] as String?,
    );
  }
}

// ─── Storage ───────────────────────────────────────────────────────────

class ChatLocalStorage {
  static const _maxMessagesPerConversation = 200;
  static const _pendingQueueKey = 'chat_pending_queue';

  static String _messagesKey(String conversationId) =>
      'chat_messages_$conversationId';

  /// Get cached messages for a conversation, sorted by createdAt asc.
  /// Returns [] if not found / error.
  static Future<List<OfflineMessage>> getMessages(String conversationId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_messagesKey(conversationId));
      if (raw == null || raw.isEmpty) return [];
      final list = jsonDecode(raw) as List<dynamic>;
      final items = list
          .map((e) => OfflineMessage.fromJson(e as Map<String, dynamic>))
          .toList();
      items.sort((a, b) => a.createdAt.compareTo(b.createdAt));
      return items;
    } catch (_) {
      return [];
    }
  }

  /// Save messages (bulk). Keeps the latest 200 per conversation (FIFO).
  static Future<void> saveMessages(
    String conversationId,
    List<OfflineMessage> messages,
  ) async {
    if (messages.isEmpty) return;
    try {
      // Limite à 200 derniers (FIFO)
      final trimmed = messages.length > _maxMessagesPerConversation
          ? messages.sublist(messages.length - _maxMessagesPerConversation)
          : messages;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        _messagesKey(conversationId),
        jsonEncode(trimmed.map((m) => m.toJson()).toList()),
      );
    } catch (_) {
      // silent
    }
  }

  /// Append a single message to the cache. Used when sending a new message
  /// locally or receiving via socket.
  static Future<void> appendMessage(OfflineMessage message) async {
    try {
      final existing = await getMessages(message.conversationId);
      // Dédoubler par id
      final seen = <String>{};
      final dedup = <OfflineMessage>[];
      for (final m in [...existing, message]) {
        if (seen.contains(m.id)) continue;
        seen.add(m.id);
        dedup.add(m);
      }
      await saveMessages(message.conversationId, dedup);
    } catch (_) {
      // silent
    }
  }

  /// Mark a pending message as sent (replaces localId with server id).
  static Future<void> markMessageSent(
    String conversationId,
    String localId,
    String serverId,
    String serverCreatedAt,
  ) async {
    try {
      final existing = await getMessages(conversationId);
      // Trouver le message avec localId et le remplacer
      final updated = <OfflineMessage>[];
      for (final m in existing) {
        if (m.localId == localId) {
          updated.add(OfflineMessage(
            id: serverId,
            conversationId: m.conversationId,
            senderId: m.senderId,
            type: m.type,
            content: m.content,
            replyToId: m.replyToId,
            createdAt: serverCreatedAt,
            status: 'sent',
          ));
        } else {
          updated.add(m);
        }
      }
      await saveMessages(conversationId, updated);
    } catch (_) {
      // silent
    }
  }

  /// Mark a pending message as failed.
  static Future<void> markMessageFailed(
    String conversationId,
    String localId,
  ) async {
    try {
      final existing = await getMessages(conversationId);
      final updated = existing.map((m) {
        if (m.localId == localId) {
          return OfflineMessage(
            id: m.id,
            conversationId: m.conversationId,
            senderId: m.senderId,
            type: m.type,
            content: m.content,
            replyToId: m.replyToId,
            createdAt: m.createdAt,
            status: 'failed',
            localId: m.localId,
          );
        }
        return m;
      }).toList();
      await saveMessages(conversationId, updated);
    } catch (_) {
      // silent
    }
  }

  /// Clear all messages for a conversation.
  static Future<void> clearConversation(String conversationId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_messagesKey(conversationId));
    } catch (_) {
      // silent
    }
  }

  // ─── Pending queue (send retry) ───────────────────────────────────────

  /// Get all pending messages, sorted by queuedAt asc.
  static Future<List<PendingMessage>> getPendingMessages() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_pendingQueueKey);
      if (raw == null || raw.isEmpty) return [];
      final list = jsonDecode(raw) as List<dynamic>;
      final items = list
          .map((e) => PendingMessage.fromJson(e as Map<String, dynamic>))
          .toList();
      items.sort((a, b) => a.queuedAt.compareTo(b.queuedAt));
      return items;
    } catch (_) {
      return [];
    }
  }

  /// Add a message to the pending queue.
  static Future<void> addPendingMessage(PendingMessage pending) async {
    try {
      final existing = await getPendingMessages();
      // Dédoubler par localId
      final seen = <String>{};
      final dedup = <PendingMessage>[];
      for (final p in [...existing, pending]) {
        if (seen.contains(p.localId)) continue;
        seen.add(p.localId);
        dedup.add(p);
      }
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        _pendingQueueKey,
        jsonEncode(dedup.map((p) => p.toJson()).toList()),
      );
    } catch (_) {
      // silent
    }
  }

  /// Remove a message from the pending queue (after successful send).
  static Future<void> removePendingMessage(String localId) async {
    try {
      final existing = await getPendingMessages();
      final filtered = existing.where((p) => p.localId != localId).toList();
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        _pendingQueueKey,
        jsonEncode(filtered.map((p) => p.toJson()).toList()),
      );
    } catch (_) {
      // silent
    }
  }

  /// Increment attempts + record last error.
  static Future<void> incrementPendingAttempts(
    String localId,
    String? error,
  ) async {
    try {
      final existing = await getPendingMessages();
      final updated = existing.map((p) {
        if (p.localId == localId) {
          return PendingMessage(
            localId: p.localId,
            conversationId: p.conversationId,
            senderId: p.senderId,
            content: p.content,
            replyToId: p.replyToId,
            queuedAt: p.queuedAt,
            attempts: p.attempts + 1,
            lastError: error,
          );
        }
        return p;
      }).toList();
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        _pendingQueueKey,
        jsonEncode(updated.map((p) => p.toJson()).toList()),
      );
    } catch (_) {
      // silent
    }
  }

  // ─── Utilities ────────────────────────────────────────────────────────

  /// Generate a UUID for local pending messages.
  static String generateLocalId() {
    return const Uuid().v4();
  }
}

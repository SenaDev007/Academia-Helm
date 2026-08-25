// ============================================================================
// CHAT LOCAL STORAGE — Offline cache + send queue (Hive-backed, V3)
// ============================================================================
//
// ⭐ MIGRATED FROM SharedPreferences TO HIVE (V3).
//
// Hive gives us:
//   - Per-key storage (no full-string rewrite on every append)
//   - Binary efficiency (Hive uses a custom binary format)
//   - Lazy box loading (only loaded conversations are in memory)
//   - Type-safe adapters via @HiveType (V3.1 — currently using JSON for simplicity)
//
// Public API is unchanged from V2 — call sites in conversation_detail_screen.dart
// work without modification.
//
// On first launch after the V3 upgrade, the migration helper reads any old
// SharedPreferences data and writes it to Hive, then clears the old keys.
// ============================================================================

import 'dart:convert';

import 'package:hive/hive.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

// ─── Types (unchanged from V2) ─────────────────────────────────────────

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

// ─── Hive-backed storage ───────────────────────────────────────────────

class ChatLocalStorage {
  static const _maxMessagesPerConversation = 200;

  // Hive box names
  static const _messagesBoxName = 'helm_chat_messages'; // key: conversationId, value: JSON list
  static const _pendingBoxName = 'helm_chat_pending';   // key: localId, value: JSON object

  // Old SharedPreferences keys (for one-time migration)
  static const _legacyPendingKey = 'chat_pending_queue';
  static String _legacyMessagesKey(String conversationId) =>
      'chat_messages_$conversationId';
  static const _migrationDoneKey = 'chat_hive_migration_done';

  static bool _migrationChecked = false;

  static Future<Box<String>> _openMessagesBox() async {
    if (Hive.isBoxOpen(_messagesBoxName)) {
      return Hive.box<String>(_messagesBoxName);
    }
    return Hive.openBox<String>(_messagesBoxName);
  }

  static Future<Box<String>> _openPendingBox() async {
    if (Hive.isBoxOpen(_pendingBoxName)) {
      return Hive.box<String>(_pendingBoxName);
    }
    return Hive.openBox<String>(_pendingBoxName);
  }

  /// One-time migration: read old SharedPreferences data, write to Hive,
  /// then clear the old keys. Idempotent — guarded by a flag in SharedPreferences.
  static Future<void> _migrateFromSharedPreferencesIfNeeded() async {
    if (_migrationChecked) return;
    _migrationChecked = true;

    try {
      final prefs = await SharedPreferences.getInstance();
      if (prefs.getBool(_migrationDoneKey) ?? false) return;

      final messagesBox = await _openMessagesBox();
      final pendingBox = await _openPendingBox();

      // 1. Migrate pending queue (single key → multiple keys)
      final legacyPending = prefs.getString(_legacyPendingKey);
      if (legacyPending != null && legacyPending.isNotEmpty) {
        try {
          final list = jsonDecode(legacyPending) as List<dynamic>;
          for (final item in list) {
            final pending = PendingMessage.fromJson(item as Map<String, dynamic>);
            await pendingBox.put(pending.localId, jsonEncode(pending.toJson()));
          }
          await prefs.remove(_legacyPendingKey);
        } catch (_) {
          // silent — keep legacy data for retry on next launch
        }
      }

      // 2. Migrate per-conversation messages
      final allKeys = prefs.getKeys();
      final legacyConvKeys = allKeys
          .where((k) => k.startsWith('chat_messages_'))
          .toList();
      for (final key in legacyConvKeys) {
        final raw = prefs.getString(key);
        if (raw == null || raw.isEmpty) continue;
        final convId = key.substring('chat_messages_'.length);
        await messagesBox.put(convId, raw);
        await prefs.remove(key);
      }

      await prefs.setBool(_migrationDoneKey, true);
    } catch (_) {
      // silent — migration will retry on next launch
      _migrationChecked = false;
    }
  }

  // ─── Messages cache (per conversation) ───────────────────────────────

  /// Get cached messages for a conversation, sorted by createdAt asc.
  static Future<List<OfflineMessage>> getMessages(String conversationId) async {
    try {
      await _migrateFromSharedPreferencesIfNeeded();
      final box = await _openMessagesBox();
      final raw = box.get(conversationId);
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
      await _migrateFromSharedPreferencesIfNeeded();
      final trimmed = messages.length > _maxMessagesPerConversation
          ? messages.sublist(messages.length - _maxMessagesPerConversation)
          : messages;
      final box = await _openMessagesBox();
      await box.put(
        conversationId,
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
      await _migrateFromSharedPreferencesIfNeeded();
      final box = await _openMessagesBox();
      await box.delete(conversationId);
    } catch (_) {
      // silent
    }
  }

  // ─── Pending queue (send retry) ──────────────────────────────────────

  /// Get all pending messages, sorted by queuedAt asc.
  static Future<List<PendingMessage>> getPendingMessages() async {
    try {
      await _migrateFromSharedPreferencesIfNeeded();
      final box = await _openPendingBox();
      final items = <PendingMessage>[];
      for (final key in box.keys) {
        final raw = box.get(key);
        if (raw == null) continue;
        try {
          final json = jsonDecode(raw) as Map<String, dynamic>;
          items.add(PendingMessage.fromJson(json));
        } catch (_) {
          // skip corrupt entries
        }
      }
      items.sort((a, b) => a.queuedAt.compareTo(b.queuedAt));
      return items;
    } catch (_) {
      return [];
    }
  }

  /// Add a message to the pending queue.
  static Future<void> addPendingMessage(PendingMessage pending) async {
    try {
      await _migrateFromSharedPreferencesIfNeeded();
      final box = await _openPendingBox();
      await box.put(pending.localId, jsonEncode(pending.toJson()));
    } catch (_) {
      // silent
    }
  }

  /// Remove a message from the pending queue (after successful send).
  static Future<void> removePendingMessage(String localId) async {
    try {
      await _migrateFromSharedPreferencesIfNeeded();
      final box = await _openPendingBox();
      await box.delete(localId);
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
      await _migrateFromSharedPreferencesIfNeeded();
      final box = await _openPendingBox();
      final raw = box.get(localId);
      if (raw == null) return;
      final json = jsonDecode(raw) as Map<String, dynamic>;
      final pending = PendingMessage.fromJson(json);
      final updated = PendingMessage(
        localId: pending.localId,
        conversationId: pending.conversationId,
        senderId: pending.senderId,
        content: pending.content,
        replyToId: pending.replyToId,
        queuedAt: pending.queuedAt,
        attempts: pending.attempts + 1,
        lastError: error,
      );
      await box.put(localId, jsonEncode(updated.toJson()));
    } catch (_) {
      // silent
    }
  }

  // ─── Utilities ───────────────────────────────────────────────────────

  /// Generate a UUID for local pending messages.
  static String generateLocalId() {
    return const Uuid().v4();
  }

  /// Close all open Hive boxes (for app shutdown / testing).
  static Future<void> closeBoxes() async {
    if (Hive.isBoxOpen(_messagesBoxName)) {
      await Hive.box(_messagesBoxName).close();
    }
    if (Hive.isBoxOpen(_pendingBoxName)) {
      await Hive.box(_pendingBoxName).close();
    }
  }
}

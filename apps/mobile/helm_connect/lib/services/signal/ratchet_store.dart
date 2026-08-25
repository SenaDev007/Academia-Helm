// ============================================================================
// SIGNAL PROTOCOL V3 — RATCHET STATE STORE (per-conversation Hive box) — Flutter
// ============================================================================
//
// ⭐ Mirrors apps/web-app/src/lib/chat/signal/ratchet-store.ts.
//
// Uses Hive for persistence (same storage as the chat local cache after the
// Hive migration). Each conversation has one ratchet state record + the
// peer's identity key (for trust-on-first-use).
// ============================================================================

import 'package:hive/hive.dart';

import 'double_ratchet.dart';

class PeerIdentityRecord {
  final String identityKeyBase64;
  final bool verified;

  PeerIdentityRecord({required this.identityKeyBase64, required this.verified});

  Map<String, dynamic> toJson() => {
    'identityKeyBase64': identityKeyBase64,
    'verified': verified,
  };

  factory PeerIdentityRecord.fromJson(Map<String, dynamic> json) {
    return PeerIdentityRecord(
      identityKeyBase64: json['identityKeyBase64'] as String,
      verified: json['verified'] as bool? ?? false,
    );
  }
}

class RatchetStore {
  static const _boxName = 'helm_connect_signal_ratchets';

  static Future<Box> _openBox() async {
    if (Hive.isBoxOpen(_boxName)) {
      return Hive.box(_boxName);
    }
    return Hive.openBox(_boxName);
  }

  static Future<void> saveRatchetState(String conversationId, DoubleRatchetState state) async {
    final box = await _openBox();
    await box.put('ratchet:$conversationId', state.toJson());
  }

  static Future<DoubleRatchetState?> loadRatchetState(String conversationId) async {
    final box = await _openBox();
    final raw = box.get('ratchet:$conversationId');
    if (raw == null) return null;
    return DoubleRatchetState.fromJson(Map<String, dynamic>.from(raw as Map));
  }

  static Future<void> deleteRatchetState(String conversationId) async {
    final box = await _openBox();
    await box.delete('ratchet:$conversationId');
  }

  static Future<void> savePeerIdentity(String conversationId, PeerIdentityRecord record) async {
    final box = await _openBox();
    await box.put('peer-ik:$conversationId', record.toJson());
  }

  static Future<PeerIdentityRecord?> loadPeerIdentity(String conversationId) async {
    final box = await _openBox();
    final raw = box.get('peer-ik:$conversationId');
    if (raw == null) return null;
    return PeerIdentityRecord.fromJson(Map<String, dynamic>.from(raw as Map));
  }
}

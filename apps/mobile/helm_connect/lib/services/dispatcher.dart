// ============================================================================
// CHAT CRYPTO DISPATCHER (Flutter) — picks V2 (RSA-OAEP) or V3 (Signal)
// ============================================================================
//
// ⭐ Mirrors apps/web-app/src/lib/chat/dispatcher.ts.
//
// Single entrypoint for the UI. Per-conversation V3 opt-in via a flag
// stored in SharedPreferences.
// ============================================================================

import 'package:shared_preferences/shared_preferences.dart';

import 'crypto_service.dart';
import 'signal/signal_service.dart';

const _v3FlagKey = 'helm_connect_v3_conversations';

Future<Set<String>> _loadV3Flags() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_v3FlagKey);
    if (raw == null || raw.isEmpty) return {};
    final list = raw.split(',');
    return list.where((s) => s.isNotEmpty).toSet();
  } catch (_) {
    return {};
  }
}

Future<void> _saveV3Flags(Set<String> flags) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_v3FlagKey, flags.join(','));
  } catch (_) {
    // silent
  }
}

Future<bool> isConversationV3Enabled(String conversationId) async {
  return (await _loadV3Flags()).contains(conversationId);
}

Future<void> setConversationV3Enabled(String conversationId, bool enabled) async {
  final flags = await _loadV3Flags();
  if (enabled) {
    flags.add(conversationId);
  } else {
    flags.remove(conversationId);
  }
  await _saveV3Flags(flags);
}

/// Encrypt an outgoing message. Picks V3 / V2 / plaintext.
Future<String> encryptOutgoing({
  required String conversationId,
  required String recipientUserId,
  required String plaintext,
  String? recipientV2PublicKeyBase64,
}) async {
  // 1. Try V3 if enabled.
  if (await isConversationV3Enabled(conversationId) && await SignalService.isEnabled()) {
    try {
      return SignalService.encrypt(
        conversationId: conversationId,
        recipientUserId: recipientUserId,
        plaintext: plaintext,
      );
    } catch (e) {
      print('[Crypto Dispatcher] V3 encryption failed, falling back to V2: $e');
      // Fall through to V2.
    }
  }

  // 2. Try V2 if recipient has a public key.
  if (recipientV2PublicKeyBase64 != null && recipientV2PublicKeyBase64.isNotEmpty) {
    return CryptoService.encryptMessage(plaintext, recipientV2PublicKeyBase64);
  }

  // 3. Plaintext fallback.
  return plaintext;
}

/// Decrypt an incoming message. Detects payload format (SIG3: / E2E: / plaintext).
Future<String> decryptIncoming({
  required String conversationId,
  required String senderUserId,
  required String ciphertext,
}) async {
  if (ciphertext.isEmpty) return '';

  // 1. V3 Signal payload.
  if (SignalService.isSignalPayload(ciphertext)) {
    try {
      return SignalService.decrypt(
        conversationId: conversationId,
        senderUserId: senderUserId,
        ciphertext: ciphertext,
      );
    } catch (e) {
      print('[Crypto Dispatcher] V3 decryption failed: $e');
      return '🔒 Message chiffré (Signal V3 — échec de déchiffrement)';
    }
  }

  // 2. V2 E2E payload.
  if (CryptoService.isEncrypted(ciphertext)) {
    return CryptoService.decryptMessage(ciphertext);
  }

  // 3. Plaintext.
  return ciphertext;
}

/// One-time setup: ensure V3 identity key exists + publish pre-key bundle.
/// Safe to call on app boot — idempotent.
Future<void> ensureSignalIdentity() async {
  try {
    await SignalService.ensureIdentityKey();
    await SignalService.publishPreKeyBundle();
  } catch (e) {
    print('[Crypto Dispatcher] Signal V3 setup failed: $e');
  }
}

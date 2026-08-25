// ============================================================================
// SIGNAL PROTOCOL V3 — HIGH-LEVEL API — Flutter
// ============================================================================
//
// ⭐ Mirrors apps/web-app/src/lib/chat/signal/signal-protocol.ts.
//
// Single entrypoint for the UI to encrypt/decrypt messages using the Signal
// Protocol (X3DH + Double Ratchet).
//
// Ciphertext format: `SIG3:<base64(JSON({v, x3dh?, header, iv_ct}))>`
// ============================================================================

import 'dart:convert';
import 'dart:typed_data';

import '../api_service.dart';
import 'identity.dart';
import 'prekeys.dart';
import 'x3dh.dart';
import 'double_ratchet.dart';
import 'ratchet_store.dart';

class SignalService {
  /// Ensure the local device has an identity keypair. Generates one if missing.
  /// Returns the public key (base64 SPKI).
  static Future<String> ensureIdentityKey() async {
    if (await IdentityService.hasIdentityKey()) {
      final ik = await IdentityService.loadIdentityKey();
      return ik!.publicKeyBase64;
    }
    return IdentityService.generateIdentityKey();
  }

  /// Generate + publish a fresh pre-key bundle.
  static Future<bool> publishPreKeyBundle({int forceOneTimeCount = 0}) async {
    final identity = await IdentityService.loadIdentityKey();
    if (identity == null) {
      throw Exception('SignalService.publishPreKeyBundle: no identity key — call ensureIdentityKey() first');
    }

    // 1. Generate (or rotate) the signed pre-key.
    final spkId = (DateTime.now().millisecondsSinceEpoch ~/ 1000) % 1000000;
    final spk = await PreKeysService.generateSignedPreKey(identity, spkId);

    // 2. Generate one-time pre-keys if pool is low (< 10) or forced.
    final remaining = await PreKeysService.countUnconsumedOneTimePreKeys();
    final needed = forceOneTimeCount > 0
        ? forceOneTimeCount
        : (remaining < 10 ? 10 : 0);
    final opks = needed > 0
        ? await PreKeysService.generateOneTimePreKeys(
            (DateTime.now().millisecondsSinceEpoch ~/ 1000) % 1000000,
            needed,
          )
        : <OneTimePreKey>[];

    // 3. Publish to backend.
    return ApiService.publishSignalBundle(
      identityKeyBase64: identity.publicKeyBase64,
      signedPreKey: {
        'id': spk.id,
        'publicKeyBase64': spk.publicKeyBase64,
        'signatureBase64': spk.signatureBase64,
      },
      oneTimePreKeys: opks.map((o) => {
        'id': o.id,
        'publicKeyBase64': o.publicKeyBase64,
      }).toList(),
    );
  }

  /// Encrypt a plaintext message for a recipient.
  /// Returns `SIG3:<base64>` ciphertext.
  static Future<String> encrypt({
    required String conversationId,
    required String recipientUserId,
    required String plaintext,
  }) async {
    final identity = await IdentityService.loadIdentityKey();
    if (identity == null) {
      throw Exception('SignalService.encrypt: no identity key — call ensureIdentityKey() first');
    }

    // 1. Load existing ratchet state.
    var state = await RatchetStore.loadRatchetState(conversationId);
    String? x3dhHeaderEncoded;

    if (state == null) {
      final bundle = await ApiService.fetchSignalPreKeyBundle(recipientUserId);
      if (bundle == null) {
        throw Exception('SignalService.encrypt: no pre-key bundle for user $recipientUserId');
      }
      final x3dh = await initiateX3DH(identity, bundle);

      // Save peer identity (trust-on-first-use).
      final existingPeer = await RatchetStore.loadPeerIdentity(conversationId);
      if (existingPeer == null) {
        await RatchetStore.savePeerIdentity(conversationId, PeerIdentityRecord(
          identityKeyBase64: bundle.identityKeyBase64,
          verified: false,
        ));
      }

      state = initDoubleRatchet(x3dh.sharedSecret);

      final x3dhHeader = X3DHHeader(
        identityPublicKeyBase64: x3dh.identityPublicKeyBase64,
        ephemeralPublicKeyBase64: x3dh.ephemeralPublicKeyBase64,
        oneTimePreKeyId: x3dh.oneTimePreKeyId,
      );
      x3dhHeaderEncoded = encodeX3DHHeader(x3dhHeader);
    }

    // 2. Encrypt with Double Ratchet.
    final plaintextBytes = Uint8List.fromList(utf8.encode(plaintext));
    final ct = await ratchetEncrypt(state, plaintextBytes, x3dhHeaderBase64: x3dhHeaderEncoded);

    // 3. Persist updated state.
    await RatchetStore.saveRatchetState(conversationId, state);

    // 4. Encode final payload.
    final payload = {
      'v': 1,
      'x3dh': ct.x3dhHeaderBase64,
      'header': ct.headerBase64,
      'iv_ct': ct.ivCiphertextBase64,
    };
    final payloadStr = jsonEncode(payload);
    final payloadB64 = base64.encode(utf8.encode(payloadStr));
    return 'SIG3:$payloadB64';
  }

  /// Decrypt a `SIG3:`-prefixed message.
  static Future<String> decrypt({
    required String conversationId,
    required String senderUserId,
    required String ciphertext,
  }) async {
    if (!ciphertext.startsWith('SIG3:')) {
      throw Exception('SignalService.decrypt: not a SIG3 message');
    }
    final payloadB64 = ciphertext.substring(5);
    final payloadJson = utf8.decode(base64.decode(payloadB64));
    final payload = jsonDecode(payloadJson) as Map<String, dynamic>;

    var state = await RatchetStore.loadRatchetState(conversationId);

    // 1. If there's an X3DH header, this is the first message of a new session.
    if (payload['x3dh'] != null) {
      final x3dhHeader = decodeX3DHHeader(payload['x3dh'] as String);

      final myIdentity = await IdentityService.loadIdentityKey();
      if (myIdentity == null) {
        throw Exception('SignalService.decrypt: no local identity key');
      }
      final mySpk = await PreKeysService.loadSignedPreKey();
      if (mySpk == null) {
        throw Exception('SignalService.decrypt: no signed pre-key — call publishPreKeyBundle() first');
      }

      OneTimePreKey? myOpk;
      if (x3dhHeader.oneTimePreKeyId != null) {
        myOpk = await PreKeysService.consumeOneTimePreKey(x3dhHeader.oneTimePreKeyId!);
      }

      final x3dh = await receiveX3DH(myIdentity, mySpk, myOpk, x3dhHeader);

      final existingPeer = await RatchetStore.loadPeerIdentity(conversationId);
      if (existingPeer == null) {
        await RatchetStore.savePeerIdentity(conversationId, PeerIdentityRecord(
          identityKeyBase64: x3dh.aliceIdentityPublicKeyBase64,
          verified: false,
        ));
      }

      state = initDoubleRatchet(x3dh.sharedSecret);
    }

    if (state == null) {
      throw Exception('SignalService.decrypt: no ratchet state and no X3DH header — cannot decrypt');
    }

    // 2. Decrypt with Double Ratchet.
    final ct = RatchetCiphertext.fromJson(payload);
    final plaintextBytes = await ratchetDecrypt(state, ct);

    // 3. Persist updated state.
    await RatchetStore.saveRatchetState(conversationId, state);

    return utf8.decode(plaintextBytes);
  }

  /// Reset the session for a conversation.
  static Future<void> resetSession(String conversationId) async {
    await RatchetStore.deleteRatchetState(conversationId);
  }

  /// Check if V3 Signal is enabled for this device.
  static Future<bool> isEnabled() async {
    return IdentityService.hasIdentityKey();
  }

  /// Check if a payload is a V3 Signal message.
  static bool isSignalPayload(String content) {
    return content.startsWith('SIG3:');
  }
}

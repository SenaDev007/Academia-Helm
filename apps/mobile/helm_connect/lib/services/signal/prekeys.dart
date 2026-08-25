// ============================================================================
// SIGNAL PROTOCOL V3 — PRE-KEYS (Signed Pre-Key + One-Time Pre-Keys) — Flutter
// ============================================================================
//
// ⭐ Mirrors apps/web-app/src/lib/chat/signal/prekeys.ts.
//
// Pre-keys are ECDH P-256 keypairs published to the backend so other clients
// can initiate X3DH sessions with us without us being online.
// ============================================================================

import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:pointycastle/export.dart' as pc;
import 'package:pointycastle/pointycastle.dart';

import 'identity.dart';

// ─── Types ─────────────────────────────────────────────────────────────

class SignedPreKey {
  final int id;
  final String publicKeyBase64;
  final Map<String, dynamic> privateJwk; // { d, q }
  final String signatureBase64;
  final String createdAt;

  SignedPreKey({
    required this.id,
    required this.publicKeyBase64,
    required this.privateJwk,
    required this.signatureBase64,
    required this.createdAt,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'publicKeyBase64': publicKeyBase64,
    'privateJwk': privateJwk,
    'signatureBase64': signatureBase64,
    'createdAt': createdAt,
  };

  factory SignedPreKey.fromJson(Map<String, dynamic> json) {
    return SignedPreKey(
      id: json['id'] as int,
      publicKeyBase64: json['publicKeyBase64'] as String,
      privateJwk: Map<String, dynamic>.from(json['privateJwk'] as Map),
      signatureBase64: json['signatureBase64'] as String,
      createdAt: json['createdAt'] as String,
    );
  }
}

class OneTimePreKey {
  final int id;
  final String publicKeyBase64;
  final Map<String, dynamic> privateJwk;
  final String createdAt;
  final bool consumed;

  OneTimePreKey({
    required this.id,
    required this.publicKeyBase64,
    required this.privateJwk,
    required this.createdAt,
    required this.consumed,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'publicKeyBase64': publicKeyBase64,
    'privateJwk': privateJwk,
    'createdAt': createdAt,
    'consumed': consumed,
  };

  factory OneTimePreKey.fromJson(Map<String, dynamic> json) {
    return OneTimePreKey(
      id: json['id'] as int,
      publicKeyBase64: json['publicKeyBase64'] as String,
      privateJwk: Map<String, dynamic>.from(json['privateJwk'] as Map),
      createdAt: json['createdAt'] as String,
      consumed: json['consumed'] as bool? ?? false,
    );
  }
}

class PreKeyBundle {
  final String identityKeyBase64;
  final SignedPreKey signedPreKey;
  final OneTimePreKey? oneTimePreKey;

  PreKeyBundle({
    required this.identityKeyBase64,
    required this.signedPreKey,
    this.oneTimePreKey,
  });
}

// ─── PreKeysService ────────────────────────────────────────────────────

class PreKeysService {
  static const _secureStorage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );
  static const _spkKey = 'signal_spk';
  static const _opkPrefix = 'signal_opk_'; // + id

  static pc.ECCurve get _curve => pc.ECCurve_secp256r1();

  /// Generate a new signed pre-key + sign it with the identity key.
  static Future<SignedPreKey> generateSignedPreKey(
    IdentityKeyPair identity,
    int id,
  ) async {
    final keyParams = pc.ECKeyGeneratorParameters(_curve);
    final generator = pc.ECKeyGenerator()
      ..init(pc.ParametersWithRandom(keyParams, _secureRandom()));
    final pair = generator.generateKeyPair();
    final publicKey = pair.publicKey as pc.ECPublicKey;
    final privateKey = pair.privateKey as pc.ECPrivateKey;

    final publicKeyBase64 = _encodePublicKeyToSpkiBase64(publicKey);
    final privateJwk = {
      'd': privateKey.d!.toString(),
      'q': base64.encode(publicKey.Q!.getEncoded(false)),
    };

    // Sign the SPKI bytes of the public key with the identity key.
    final spkiBytes = base64.decode(publicKeyBase64);
    final signature = await IdentityService.signWithIdentityKey(
      identity,
      Uint8List.fromList(spkiBytes),
    );

    final spk = SignedPreKey(
      id: id,
      publicKeyBase64: publicKeyBase64,
      privateJwk: privateJwk,
      signatureBase64: base64.encode(signature),
      createdAt: DateTime.now().toIso8601String(),
    );
    await _secureStorage.write(key: _spkKey, value: jsonEncode(spk.toJson()));
    return spk;
  }

  static Future<SignedPreKey?> loadSignedPreKey() async {
    final stored = await _secureStorage.read(key: _spkKey);
    if (stored == null || stored.isEmpty) return null;
    try {
      return SignedPreKey.fromJson(jsonDecode(stored) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  /// Generate a batch of one-time pre-keys.
  static Future<List<OneTimePreKey>> generateOneTimePreKeys(
    int startId,
    int count,
  ) async {
    final keys = <OneTimePreKey>[];
    for (var i = 0; i < count; i++) {
      final id = startId + i;
      final keyParams = pc.ECKeyGeneratorParameters(_curve);
      final generator = pc.ECKeyGenerator()
        ..init(pc.ParametersWithRandom(keyParams, _secureRandom()));
      final pair = generator.generateKeyPair();
      final publicKey = pair.publicKey as pc.ECPublicKey;
      final privateKey = pair.privateKey as pc.ECPrivateKey;

      final publicKeyBase64 = _encodePublicKeyToSpkiBase64(publicKey);
      final privateJwk = {
        'd': privateKey.d!.toString(),
        'q': base64.encode(publicKey.Q!.getEncoded(false)),
      };
      final opk = OneTimePreKey(
        id: id,
        publicKeyBase64: publicKeyBase64,
        privateJwk: privateJwk,
        createdAt: DateTime.now().toIso8601String(),
        consumed: false,
      );
      await _secureStorage.write(
        key: '$_opkPrefix$id',
        value: jsonEncode(opk.toJson()),
      );
      keys.add(opk);
    }
    return keys;
  }

  /// Consume a one-time pre-key (mark as consumed + delete the private key).
  static Future<OneTimePreKey?> consumeOneTimePreKey(int id) async {
    final stored = await _secureStorage.read(key: '$_opkPrefix$id');
    if (stored == null || stored.isEmpty) return null;
    try {
      final opk = OneTimePreKey.fromJson(jsonDecode(stored) as Map<String, dynamic>);
      if (opk.consumed) return null;
      await _secureStorage.delete(key: '$_opkPrefix$id');
      return opk;
    } catch (_) {
      return null;
    }
  }

  /// Count remaining (unconsumed) OPKs.
  static Future<int> countUnconsumedOneTimePreKeys() async {
    final all = await _secureStorage.readAll();
    return all.keys.where((k) => k.startsWith(_opkPrefix)).length;
  }

  // ─── Public key import helpers (for X3DH) ───────────────────────────

  static pc.ECPublicKey importPublicKey(String publicKeyBase64) {
    return _decodePublicKeyFromSpkiBase64(publicKeyBase64);
  }

  static pc.ECPrivateKey importPrivateKey(Map<String, dynamic> jwk) {
    final d = BigInt.parse(jwk['d'] as String);
    return pc.ECPrivateKey(d, _curve);
  }

  // ─── Internal helpers ───────────────────────────────────────────────

  static String _encodePublicKeyToSpkiBase64(pc.ECPublicKey publicKey) {
    final pointBytes = publicKey.Q!.getEncoded(false);
    final algorithmIdentifier = pc.ASN1Sequence([
      pc.ASN1ObjectIdentifier.fromName('ecPublicKey'),
      pc.ASN1ObjectIdentifier.fromName('secp256r1'),
    ]);
    final bitStringBytes = Uint8List.fromList([0, ...pointBytes]);
    final spki = pc.ASN1Sequence([
      algorithmIdentifier,
      pc.ASN1BitString(bitStringBytes),
    ]);
    return base64.encode(spki.encode());
  }

  static pc.ECPublicKey _decodePublicKeyFromSpkiBase64(String spkiBase64) {
    final derBytes = base64.decode(spkiBase64);
    final parser = pc.ASN1Parser(derBytes);
    final spkiSeq = parser.nextObject() as pc.ASN1Sequence;
    final bitString = spkiSeq.elements![1] as pc.ASN1BitString;
    final pointBytes = bitString.valueBytes!.sublist(1);
    final q = _curve.curve.decodePoint(pointBytes);
    return pc.ECPublicKey(q, _curve);
  }

  static pc.SecureRandom _secureRandom() {
    final random = pc.FortunaRandom();
    final seed = List<int>.generate(32, (_) => DateTime.now().microsecondsSinceEpoch & 0xff);
    random.seed(pc.KeyParameter(Uint8List.fromList(seed)));
    return random;
  }
}

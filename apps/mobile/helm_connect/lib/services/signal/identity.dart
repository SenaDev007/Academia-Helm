// ============================================================================
// SIGNAL PROTOCOL V3 — IDENTITY KEY (long-term ECDH P-256) — Flutter
// ============================================================================
//
// ⭐ Mirrors apps/web-app/src/lib/chat/signal/identity.ts.
//
// ECDH P-256 keypair, generated once per device, stored in
// flutter_secure_storage (Keystore Android / Keychain iOS). The public half
// is published to the backend (signal_prekeys table). The private half
// NEVER leaves the device.
//
// pointycastle's ECDH + ECDSA implementations are used.
// ============================================================================

import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:pointycastle/export.dart' as pc;
import 'package:pointycastle/pointycastle.dart';

class IdentityKeyPair {
  /// ECDH P-256 private key (also usable for ECDSA signing — same curve).
  final pc.ECPrivateKey privateKey;
  final pc.ECPublicKey publicKey;

  /// Base64 SPKI of the ECDH public key — published to backend.
  final String publicKeyBase64;

  IdentityKeyPair({
    required this.privateKey,
    required this.publicKey,
    required this.publicKeyBase64,
  });
}

class IdentityService {
  static const _secureStorage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );
  static const _storageKey = 'signal_identity_key';

  // P-256 curve parameters (secp256r1 / prime256v1).
  static pc.ECCurve get _curve => pc.ECCurve_secp256r1();

  /// Generate a new identity keypair and store the private half in secure storage.
  /// Returns the public key as base64 SPKI.
  static Future<String> generateIdentityKey() async {
    final keyParams = pc.ECKeyGeneratorParameters(_curve);
    final generator = pc.ECKeyGenerator()
      ..init(pc.ParametersWithRandom(keyParams, _secureRandom()));
    final pair = generator.generateKeyPair();
    final publicKey = pair.publicKey as pc.ECPublicKey;
    final privateKey = pair.privateKey as pc.ECPrivateKey;

    // Store private key as JSON: { d: base10-string, q: base64(x||y) }
    final privJwk = {
      'd': privateKey.d!.toString(),
      'q': _ecPointToBase64(publicKey.Q!),
    };
    await _secureStorage.write(
      key: _storageKey,
      value: jsonEncode(privJwk),
    );

    return _encodePublicKeyToSpkiBase64(publicKey);
  }

  static Future<bool> hasIdentityKey() async {
    final stored = await _secureStorage.read(key: _storageKey);
    return stored != null && stored.isNotEmpty;
  }

  static Future<IdentityKeyPair?> loadIdentityKey() async {
    final stored = await _secureStorage.read(key: _storageKey);
    if (stored == null || stored.isEmpty) return null;
    try {
      final jwk = jsonDecode(stored) as Map<String, dynamic>;
      final d = BigInt.parse(jwk['d'] as String);
      final qBytes = base64.decode(jwk['q'] as String);
      final q = _curve.curve.decodePoint(qBytes);
      final publicKey = pc.ECPublicKey(q, _curve);
      final privateKey = pc.ECPrivateKey(d, _curve);
      return IdentityKeyPair(
        privateKey: privateKey,
        publicKey: publicKey,
        publicKeyBase64: _encodePublicKeyToSpkiBase64(publicKey),
      );
    } catch (_) {
      return null;
    }
  }

  /// Sign arbitrary data with the identity key (ECDSA P-256 SHA-256).
  /// Used for signing signed pre-keys (SPK).
  static Future<Uint8List> signWithIdentityKey(
    IdentityKeyPair identity,
    Uint8List data,
  ) async {
    final signer = pc.ECDSASigner(pc.SHA256Digest())
      ..init(true, pc.PrivateKeyParameter<pc.ECPrivateKey>(identity.privateKey));
    final sig = signer.generateSignature(data) as pc.ECSignature;
    // Encode as DER (interop with Web Crypto's ECDSA signature format).
    final der = pc.ASN1Sequence([
      pc.ASN1Integer(sig.r),
      pc.ASN1Integer(sig.s),
    ]);
    return Uint8List.fromList(der.encode());
  }

  /// Verify a signature using a peer's identity public key (base64 SPKI).
  static Future<bool> verifyWithIdentityKey(
    String peerPublicKeyBase64,
    Uint8List signature,
    Uint8List data,
  ) async {
    try {
      final pubKey = _decodePublicKeyFromSpkiBase64(peerPublicKeyBase64);
      final verifier = pc.ECDSASigner(pc.SHA256Digest())
        ..init(false, pc.PublicKeyParameter<pc.ECPublicKey>(pubKey));
      // Parse DER-encoded signature.
      final parser = pc.ASN1Parser(signature);
      final seq = parser.nextObject() as pc.ASN1Sequence;
      final r = (seq.elements![0] as pc.ASN1Integer).integer!;
      final s = (seq.elements![1] as pc.ASN1Integer).integer!;
      return verifier.verifySignature(data, pc.ECSignature(r, s));
    } catch (_) {
      return false;
    }
  }

  // ─── Internal helpers ────────────────────────────────────────────────

  /// Encode an ECPublicKey (P-256) as base64 SPKI (SubjectPublicKeyInfo).
  /// Must match Web Crypto's `exportKey('spki', ...)` output.
  static String _encodePublicKeyToSpkiBase64(pc.ECPublicKey publicKey) {
    // EC point as uncompressed: 0x04 || x(32 bytes) || y(32 bytes) = 65 bytes.
    final pointBytes = publicKey.Q!.getEncoded(false);

    // algorithmIdentifier = SEQUENCE { OID 1.2.840.10045.2.1 (ecPublicKey), OID 1.2.840.10045.3.1.7 (secp256r1) }
    final algorithmIdentifier = pc.ASN1Sequence([
      pc.ASN1ObjectIdentifier.fromName('ecPublicKey'),
      pc.ASN1ObjectIdentifier.fromName('secp256r1'),
    ]);

    // subjectPublicKey = BIT STRING (pointBytes with 0 unused bits prefix)
    final bitStringBytes = Uint8List.fromList([0, ...pointBytes]);

    final spki = pc.ASN1Sequence([
      algorithmIdentifier,
      pc.ASN1BitString(bitStringBytes),
    ]);

    final derBytes = spki.encode();
    return base64.encode(derBytes);
  }

  /// Decode a base64 SPKI blob into an ECPublicKey (P-256).
  static pc.ECPublicKey _decodePublicKeyFromSpkiBase64(String spkiBase64) {
    final derBytes = base64.decode(spkiBase64);
    final parser = pc.ASN1Parser(derBytes);
    final spkiSeq = parser.nextObject() as pc.ASN1Sequence;

    // Second element is the BIT STRING containing the EC point.
    final bitString = spkiSeq.elements![1] as pc.ASN1BitString;
    // Skip the unused-bits byte.
    final pointBytes = bitString.valueBytes!.sublist(1);

    final q = _curve.curve.decodePoint(pointBytes);
    return pc.ECPublicKey(q, _curve);
  }

  /// Encode an EC point as base64 (uncompressed: 0x04 || x || y).
  static String _ecPointToBase64(pc.ECPoint q) {
    return base64.encode(q.getEncoded(false));
  }

  /// A secure random source (Fortuna).
  static pc.SecureRandom _secureRandom() {
    final random = pc.FortunaRandom();
    final seed = List<int>.generate(32, (_) => DateTime.now().microsecondsSinceEpoch & 0xff);
    random.seed(pc.KeyParameter(Uint8List.fromList(seed)));
    return random;
  }
}

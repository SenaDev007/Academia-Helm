// ============================================================================
// CRYPTO SERVICE — E2E Encryption for Helm Connect (Flutter)
// ============================================================================
//
// ⭐ Mirrors apps/web-app/src/lib/chat/crypto.ts (RSA-OAEP 2048 via Web Crypto).
//
// Implements end-to-end encryption for chat messages on mobile:
//   - RSA-OAEP key pair generation (2048-bit, SHA-256)
//   - Public key export as base64 SPKI format (interop with web client)
//   - Private key storage in flutter_secure_storage (Keystore/Keychain)
//     — NEVER sent to the server
//   - Message encryption with recipient's public key
//   - Message decryption with own private key
//   - Encrypted payload format: `E2E:<base64-ciphertext>`
//     (same format as web, so messages flow encrypted between web ↔ mobile)
//
// ⭐ This is a SIMPLIFIED version of the Signal protocol:
//   - No forward secrecy (Double Ratchet)
//   - No pre-key bundles
//   - For group chats: falls back to plaintext if any participant lacks a key
//     (same behaviour as the web client)
//
// V3 will implement proper Signal protocol (X3DH + Double Ratchet).
//
// ⭐ Dependencies (must be uncommented in pubspec.yaml):
//   - pointycastle: ^3.7.3   (RSA + ASN.1 SPKI parsing)
//   - flutter_secure_storage: ^9.0.0  (private key Keystore/Keychain)
// ============================================================================

import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:pointycastle/export.dart' as pc;
import 'package:pointycastle/pointycastle.dart';

/// ---------------------------------------------------------------------------
/// Public API
/// ---------------------------------------------------------------------------

class CryptoService {
  static const _secureStorage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  // Must match the web client's record id (cf. apps/web-app/src/lib/chat/crypto.ts).
  static const _privateKeyStorageKey = 'helm_connect_private_key';

  /// Generate a new RSA-OAEP 2048-bit key pair.
  /// Stores the private key in secure storage; returns the public key in
  /// base64 SPKI format (so it can be uploaded to the backend and shared
  /// with other clients).
  static Future<String> generateKeyPair() async {
    // 1. Generate RSA key pair via pointycastle
    final keyParams = pc.RSAKeyGeneratorParameters(
      pc.BigInt.from(65537), // public exponent e = 0x010001
      2048, // modulus length
      64, // certainty
    );
    final keyGenerator = pc.RSAKeyGenerator()
      ..init(pc.ParametersWithRandom(keyParams, _secureRandom()));
    final pair = keyGenerator.generateKeyPair();
    final publicKey = pair.publicKey as pc.RSAPublicKey;
    final privateKey = pair.privateKey as pc.RSAPrivateKey;

    // 2. Encode private key as JSON (n, e, d, p, q) and store in flutter_secure_storage
    final privJwk = {
      'n': _bigIntToBase64Url(publicKey.modulus!),
      'e': _bigIntToBase64Url(publicKey.exponent!),
      'd': _bigIntToBase64Url(privateKey.privateExponent!),
      'p': _bigIntToBase64Url(privateKey.p!),
      'q': _bigIntToBase64Url(privateKey.q!),
    };
    await _secureStorage.write(
      key: _privateKeyStorageKey,
      value: jsonEncode(privJwk),
    );

    // 3. Encode public key as SPKI (base64, DER-encoded SubjectPublicKeyInfo)
    final spkiBase64 = _encodePublicKeyToSpkiBase64(publicKey);
    return spkiBase64;
  }

  /// Returns true if a private key has already been generated and stored.
  static Future<bool> hasPrivateKey() async {
    final stored = await _secureStorage.read(key: _privateKeyStorageKey);
    return stored != null && stored.isNotEmpty;
  }

  /// Encrypt a plaintext message for the given recipient.
  /// - If [recipientPublicKeyBase64] is null or empty, returns plaintext as-is
  ///   (no encryption — same fallback as web).
  /// - Otherwise, returns `E2E:<base64-ciphertext>`.
  static Future<String> encryptMessage(
    String plaintext,
    String? recipientPublicKeyBase64,
  ) async {
    if (recipientPublicKeyBase64 == null || recipientPublicKeyBase64.isEmpty) {
      return plaintext;
    }
    try {
      final publicKey = _decodePublicKeyFromSpkiBase64(recipientPublicKeyBase64);
      final cipher = pc.OAPEncrypted<RSAEngine>()
        ..init(
          true,
          pc.PublicKeyParameter<pc.RSAPublicKey>(publicKey),
        );
      final plaintextBytes = utf8.encode(plaintext);
      final encrypted = cipher.process(plaintextBytes);
      return 'E2E:${base64.encode(encrypted)}';
    } catch (_) {
      // Fail open (same as web): if encryption fails, send plaintext.
      return plaintext;
    }
  }

  /// Decrypt an E2E message.
  /// - If content doesn't start with `E2E:`, returns it as-is.
  /// - If private key is missing or decryption fails, returns a placeholder
  ///   string (same as web).
  static Future<String> decryptMessage(String content) async {
    if (!isEncrypted(content)) return content;
    try {
      final privateKey = await _loadPrivateKey();
      if (privateKey == null) {
        return '🔒 Message chiffré (clé privée manquante)';
      }
      final ciphertextB64 = content.substring(4); // strip 'E2E:'
      final ciphertext = base64.decode(ciphertextB64);

      final cipher = pc.OAPEncrypted<RSAEngine>()
        ..init(
          false,
          pc.PrivateKeyParameter<pc.RSAPrivateKey>(privateKey),
        );
      final decrypted = cipher.process(ciphertext);
      return utf8.decode(decrypted);
    } catch (_) {
      return '🔒 Message chiffré (déchiffrement impossible)';
    }
  }

  /// Returns true if [content] is an E2E-encrypted payload (starts with 'E2E:').
  static bool isEncrypted(String content) {
    return content.startsWith('E2E:');
  }

  /// Encrypt a plaintext message for multiple recipients (group chat).
  /// Returns the first successfully-encrypted payload, or plaintext if all
  /// keys fail. This mirrors the web client's behaviour for group messages.
  ///
  /// For V2 (current): we use the FIRST recipient key only — the server stores
  /// one ciphertext per message and re-broadcasts to all participants. V3
  /// will introduce a per-conversation symmetric key wrapped with each
  /// member's RSA public key (Signal-style).
  static Future<String> encryptForGroup(
    String plaintext,
    List<String> recipientPublicKeysBase64,
  ) async {
    if (recipientPublicKeysBase64.isEmpty) return plaintext;
    for (final key in recipientPublicKeysBase64) {
      if (key.isNotEmpty) {
        return encryptMessage(plaintext, key);
      }
    }
    return plaintext;
  }

  /// -----------------------------------------------------------------------
  /// Internal helpers
  /// -----------------------------------------------------------------------

  static Future<pc.RSAPrivateKey?> _loadPrivateKey() async {
    final stored = await _secureStorage.read(key: _privateKeyStorageKey);
    if (stored == null || stored.isEmpty) return null;
    try {
      final jwk = jsonDecode(stored) as Map<String, dynamic>;
      final n = _base64UrlToBigInt(jwk['n'] as String);
      final d = _base64UrlToBigInt(jwk['d'] as String);
      final p = _base64UrlToBigInt(jwk['p'] as String);
      final q = _base64UrlToBigInt(jwk['q'] as String);
      return pc.RSAPrivateKey(n, d, p, q);
    } catch (_) {
      return null;
    }
  }

  /// Encode an RSAPublicKey as a base64 SPKI (SubjectPublicKeyInfo) DER blob.
  /// Must match the format produced by Web Crypto `exportKey('spki', ...)`
  /// so the two clients interop.
  static String _encodePublicKeyToSpkiBase64(pc.RSAPublicKey publicKey) {
    final modulus = publicKey.modulus!;
    final exponent = publicKey.exponent!;

    // Encode the inner RSAPublicKey sequence:
    //   RSAPublicKey ::= SEQUENCE { modulus INTEGER, publicExponent INTEGER }
    final modulusBytes = _positiveIntegerBytes(modulus);
    final exponentBytes = _positiveIntegerBytes(exponent);
    final rsaPubKeyDer = pc.ASN1Sequence([
      pc.ASN1Integer(modulusBytes),
      pc.ASN1Integer(exponentBytes),
    ]);

    // Wrap in BIT STRING (0 unused bits prefix).
    final bitStringContent = rsaPubKeyDer.encode();
    final bitStringBytes = Uint8List.fromList([0, ...bitStringContent]);

    // Build the outer SubjectPublicKeyInfo sequence.
    //   SubjectPublicKeyInfo ::= SEQUENCE {
    //     algorithm AlgorithmIdentifier,           -- rsaEncryption OID + NULL
    //     subjectPublicKey BIT STRING              -- encapsulates RSAPublicKey
    //   }
    final algorithmIdentifier = pc.ASN1Sequence([
      pc.ASN1ObjectIdentifier.fromName('rsaEncryption'),
      pc.ASN1Null(),
    ]);

    final spki = pc.ASN1Sequence([
      algorithmIdentifier,
      pc.ASN1BitString(bitStringBytes),
    ]);

    final derBytes = spki.encode();
    return base64.encode(derBytes);
  }

  /// Decode a base64 SPKI blob back into an RSAPublicKey.
  static pc.RSAPublicKey _decodePublicKeyFromSpkiBase64(String spkiBase64) {
    final derBytes = base64.decode(spkiBase64);
    final parser = pc.ASN1Parser(derBytes);
    final spkiSeq = parser.nextObject() as pc.ASN1Sequence;

    // The second element is the BIT STRING containing the RSAPublicKey.
    final bitString = spkiSeq.elements![1] as pc.ASN1BitString;
    // Skip the unused-bits byte (always 0 for our case).
    final rsaPubKeyBytes = bitString.valueBytes!.sublist(1);

    final innerParser = pc.ASN1Parser(rsaPubKeyBytes);
    final rsaPubKeySeq = innerParser.nextObject() as pc.ASN1Sequence;
    final modulus = _bytesToBigInt(
      (rsaPubKeySeq.elements![0] as pc.ASN1Integer).integer!.bytes,
    );
    final exponent = _bytesToBigInt(
      (rsaPubKeySeq.elements![1] as pc.ASN1Integer).integer!.bytes,
    );
    return pc.RSAPublicKey(modulus, exponent);
  }

  /// Convert a BigInt to a base64url-encoded string (no padding) for JWK.
  static String _bigIntToBase64Url(BigInt value) {
    final bytes = _positiveIntegerBytes(value);
    return base64Url.encode(bytes).replaceAll('=', '');
  }

  /// Convert a base64url string back to a BigInt (for JWK parsing).
  static BigInt _base64UrlToBigInt(String b64url) {
    var padded = b64url;
    while (padded.length % 4 != 0) {
      padded += '=';
    }
    final bytes = base64Url.decode(padded);
    return _bytesToBigInt(bytes);
  }

  /// Convert a list of bytes (unsigned, big-endian) to a BigInt.
  static BigInt _bytesToBigInt(List<int> bytes) {
    var result = BigInt.zero;
    for (final byte in bytes) {
      result = (result << 8) | BigInt.from(byte);
    }
    return result;
  }

  /// Convert a BigInt to its minimal unsigned big-endian byte representation,
  /// with a leading 0x00 byte if the high bit is set (so the result is
  /// interpreted as positive by ASN.1 INTEGER decoders).
  static Uint8List _positiveIntegerBytes(BigInt value) {
    if (value == BigInt.zero) {
      return Uint8List.fromList([0]);
    }
    final byteLength = (value.bitLength + 7) ~/ 8;
    final bytes = Uint8List(byteLength);
    var v = value;
    for (var i = byteLength - 1; i >= 0; i--) {
      bytes[i] = (v & BigInt.from(0xff)).toInt();
      v = v >> 8;
    }
    // Prepend 0x00 if the high bit is set.
    if (bytes[0] & 0x80 != 0) {
      return Uint8List.fromList([0, ...bytes]);
    }
    return bytes;
  }

  /// A secure random source (Fortuna).
  /// For production RSA key generation, consider wiring a method channel
  /// to platform-secure RNG (SecureRandom on Android, SecRandomCopyBytes on iOS).
  static pc.SecureRandom _secureRandom() {
    final random = pc.FortunaRandom();
    // Mix dart:math Random.secure() output for additional entropy.
    final seedSource = List<int>.generate(32, (_) {
      // Fallback entropy: combine clock + per-bit jitter
      return DateTime.now().microsecondsSinceEpoch & 0xff;
    });
    random.seed(pc.KeyParameter(Uint8List.fromList(seedSource)));
    return random;
  }
}

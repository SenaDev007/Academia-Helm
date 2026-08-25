// ============================================================================
// SIGNAL PROTOCOL V3 — X3DH (Extended Triple Diffie-Hellman) — Flutter
// ============================================================================
//
// ⭐ Mirrors apps/web-app/src/lib/chat/signal/x3dh.ts.
//
// X3DH establishes a shared secret between initiator (Alice) and recipient
// (Bob) using pre-key bundles fetched from the backend.
// ============================================================================

import 'dart:convert';
import 'dart:typed_data';

import 'package:pointycastle/export.dart' as pc;
import 'package:pointycastle/pointycastle.dart';

import 'identity.dart';
import 'prekeys.dart';

// ─── DH + HKDF helpers ─────────────────────────────────────────────────

Uint8List _dh(pc.ECPrivateKey privateKey, pc.ECPublicKey publicKey) {
  final agreement = pc.ECDHBasicAgreement()
    ..init(privateKey);
  final sharedSecret = agreement.calculateAgreement(publicKey);
  // P-256 → 32 bytes shared secret (left-padded with zeros if needed).
  return _bigIntToFixedBytes(sharedSecret, 32);
}

Uint8List _hkdf(Uint8List ikm, Uint8List salt, String info, {int outputBytes = 32}) {
  // HKDF-SHA256: extract (HMAC-SHA256(salt, ikm)) → PRK; expand (HMAC-SHA256(PRK, info || 0x01))
  // For simplicity (and because Web Crypto's HKDF returns the first L bytes):
  final infoBytes = Uint8List.fromList(utf8.encode(info));

  // Extract
  final hmacExtract = pc.HMac(pc.SHA256Digest(), 64)
    ..init(pc.KeyParameter(salt.isEmpty ? Uint8List(64) : salt));
  hmacExtract.update(ikm, 0, ikm.length);
  final prk = hmacExtract.compute() as Uint8List;

  // Expand (single-block — outputBytes ≤ 32 implies 1 HMAC block)
  final hmacExpand = pc.HMac(pc.SHA256Digest(), 64)..init(pc.KeyParameter(prk));
  hmacExpand.update(infoBytes, 0, infoBytes.length);
  // Counter byte (0x01 for the first block).
  final counter = Uint8List.fromList([0x01]);
  hmacExpand.update(counter, 0, 1);
  final t = hmacExpand.compute() as Uint8List;
  return Uint8List.fromList(t.sublist(0, outputBytes));
}

Uint8List _concat(Uint8List a, Uint8List b) {
  return Uint8List.fromList([...a, ...b]);
}

Uint8List _bigIntToFixedBytes(BigInt value, int length) {
  final bytes = Uint8List(length);
  var v = value;
  for (var i = length - 1; i >= 0; i--) {
    bytes[i] = (v & BigInt.from(0xff)).toInt();
    v = v >> 8;
  }
  return bytes;
}

// ─── X3DH Initiator (Alice) ────────────────────────────────────────────

class X3DHInitiatorResult {
  final Uint8List sharedSecret;
  final String ephemeralPublicKeyBase64;
  final String identityPublicKeyBase64;
  final int? oneTimePreKeyId;

  X3DHInitiatorResult({
    required this.sharedSecret,
    required this.ephemeralPublicKeyBase64,
    required this.identityPublicKeyBase64,
    this.oneTimePreKeyId,
  });
}

Future<X3DHInitiatorResult> initiateX3DH(
  IdentityKeyPair aliceIdentity,
  PreKeyBundle bobBundle,
) async {
  // 1. Verify Bob's SPK signature.
  final spkSignature = base64.decode(bobBundle.signedPreKey.signatureBase64);
  final spkPubKeyBytes = base64.decode(bobBundle.signedPreKey.publicKeyBase64);
  final valid = await IdentityService.verifyWithIdentityKey(
    bobBundle.identityKeyBase64,
    spkSignature,
    Uint8List.fromList(spkPubKeyBytes),
  );
  if (!valid) {
    throw Exception('X3DH: signed pre-key signature verification failed');
  }

  // 2. Generate ephemeral key (EK_A).
  final curve = pc.ECCurve_secp256r1();
  final keyParams = pc.ECKeyGeneratorParameters(curve);
  final generator = pc.ECKeyGenerator()
    ..init(pc.ParametersWithRandom(keyParams, _secureRandom()));
  final ekPair = generator.generateKeyPair();
  final ekPrivate = ekPair.privateKey as pc.ECPrivateKey;
  final ekPublic = ekPair.publicKey as pc.ECPublicKey;
  final ephemeralPublicKeyBase64 = _encodePublicKeyToSpkiBase64(ekPublic);

  // 3. Import Bob's public keys.
  final bobIkPub = PreKeysService.importPublicKey(bobBundle.identityKeyBase64);
  final bobSpkPub = PreKeysService.importPublicKey(bobBundle.signedPreKey.publicKeyBase64);
  final bobOpkPub = bobBundle.oneTimePreKey != null
      ? PreKeysService.importPublicKey(bobBundle.oneTimePreKey!.publicKeyBase64)
      : null;

  // 4. Compute DH1, DH2, DH3, (DH4).
  final dh1 = _dh(aliceIdentity.privateKey, bobSpkPub);
  final dh2 = _dh(ekPrivate, bobIkPub);
  final dh3 = _dh(ekPrivate, bobSpkPub);
  final dh4 = bobOpkPub != null ? _dh(ekPrivate, bobOpkPub) : null;

  // 5. Concatenate + HKDF.
  var ikm = _concat(dh1, dh2);
  ikm = _concat(ikm, dh3);
  if (dh4 != null) ikm = _concat(ikm, dh4);
  final sharedSecret = _hkdf(ikm, Uint8List(0), 'helm_connect_x3dh_v1');

  return X3DHInitiatorResult(
    sharedSecret: sharedSecret,
    ephemeralPublicKeyBase64: ephemeralPublicKeyBase64,
    identityPublicKeyBase64: aliceIdentity.publicKeyBase64,
    oneTimePreKeyId: bobBundle.oneTimePreKey?.id,
  );
}

// ─── X3DH Recipient (Bob) ──────────────────────────────────────────────

class X3DHRecipientResult {
  final Uint8List sharedSecret;
  final String aliceIdentityPublicKeyBase64;

  X3DHRecipientResult({
    required this.sharedSecret,
    required this.aliceIdentityPublicKeyBase64,
  });
}

Future<X3DHRecipientResult> receiveX3DH(
  IdentityKeyPair bobIdentity,
  SignedPreKey bobSignedPreKey,
  OneTimePreKey? bobOneTimePreKey,
  X3DHHeader aliceHeader,
) async {
  // 1. Import Bob's private keys.
  final bobSpkPriv = PreKeysService.importPrivateKey(bobSignedPreKey.privateJwk);
  final bobOpkPriv = bobOneTimePreKey != null
      ? PreKeysService.importPrivateKey(bobOneTimePreKey.privateJwk)
      : null;

  // 2. Import Alice's public keys.
  final aliceIkPub = PreKeysService.importPublicKey(aliceHeader.identityPublicKeyBase64);
  final aliceEkPub = PreKeysService.importPublicKey(aliceHeader.ephemeralPublicKeyBase64);

  // 3. Compute DH1 = DH(SPK_B_priv, IK_A_pub), etc. (same shared secret as initiator).
  final dh1 = _dh(bobSpkPriv, aliceIkPub);
  final dh2 = _dh(bobIdentity.privateKey, aliceEkPub);
  final dh3 = _dh(bobSpkPriv, aliceEkPub);
  final dh4 = bobOpkPriv != null ? _dh(bobOpkPriv, aliceEkPub) : null;

  // 4. Concatenate + HKDF.
  var ikm = _concat(dh1, dh2);
  ikm = _concat(ikm, dh3);
  if (dh4 != null) ikm = _concat(ikm, dh4);
  final sharedSecret = _hkdf(ikm, Uint8List(0), 'helm_connect_x3dh_v1');

  return X3DHRecipientResult(
    sharedSecret: sharedSecret,
    aliceIdentityPublicKeyBase64: aliceHeader.identityPublicKeyBase64,
  );
}

// ─── Header ────────────────────────────────────────────────────────────

class X3DHHeader {
  final String identityPublicKeyBase64;
  final String ephemeralPublicKeyBase64;
  final int? oneTimePreKeyId;

  X3DHHeader({
    required this.identityPublicKeyBase64,
    required this.ephemeralPublicKeyBase64,
    this.oneTimePreKeyId,
  });

  Map<String, dynamic> toJson() => {
    'identityPublicKeyBase64': identityPublicKeyBase64,
    'ephemeralPublicKeyBase64': ephemeralPublicKeyBase64,
    'oneTimePreKeyId': oneTimePreKeyId,
  };

  factory X3DHHeader.fromJson(Map<String, dynamic> json) {
    return X3DHHeader(
      identityPublicKeyBase64: json['identityPublicKeyBase64'] as String,
      ephemeralPublicKeyBase64: json['ephemeralPublicKeyBase64'] as String,
      oneTimePreKeyId: json['oneTimePreKeyId'] as int?,
    );
  }
}

String encodeX3DHHeader(X3DHHeader header) {
  final json = jsonEncode(header.toJson());
  return base64.encode(utf8.encode(json));
}

X3DHHeader decodeX3DHHeader(String encoded) {
  final json = utf8.decode(base64.decode(encoded));
  return X3DHHeader.fromJson(jsonDecode(json) as Map<String, dynamic>);
}

// ─── Internal helpers (re-used from identity.dart) ───────────────────

String _encodePublicKeyToSpkiBase64(pc.ECPublicKey publicKey) {
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

pc.SecureRandom _secureRandom() {
  final random = pc.FortunaRandom();
  final seed = List<int>.generate(32, (_) => DateTime.now().microsecondsSinceEpoch & 0xff);
  random.seed(pc.KeyParameter(Uint8List.fromList(seed)));
  return random;
}

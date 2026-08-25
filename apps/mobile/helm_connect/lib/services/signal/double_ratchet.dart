// ============================================================================
// SIGNAL PROTOCOL V3 — DOUBLE RATCHET (forward secrecy) — Flutter
// ============================================================================
//
// ⭐ Mirrors apps/web-app/src/lib/chat/signal/double-ratchet.ts.
//
// After X3DH establishes a shared secret, both parties run the Double
// Ratchet algorithm. Each message uses a unique key derived from a chain
// key, and the DH ratchet rotates the root key whenever a new DH public
// key is received.
// ============================================================================

import 'dart:convert';
import 'dart:typed_data';

import 'package:pointycastle/export.dart' as pc;
import 'package:pointycastle/pointycastle.dart';

import 'prekeys.dart';

// ─── Crypto helpers ────────────────────────────────────────────────────

Uint8List _dh(pc.ECPrivateKey privateKey, pc.ECPublicKey publicKey) {
  final agreement = pc.ECDHBasicAgreement()..init(privateKey);
  final sharedSecret = agreement.calculateAgreement(publicKey);
  return _bigIntToFixedBytes(sharedSecret, 32);
}

Uint8List _hkdf(Uint8List ikm, Uint8List salt, String info, {int outputBytes = 64}) {
  final infoBytes = Uint8List.fromList(utf8.encode(info));

  // Extract
  final hmacExtract = pc.HMac(pc.SHA256Digest(), 64)
    ..init(pc.KeyParameter(salt.isEmpty ? Uint8List(64) : salt));
  hmacExtract.update(ikm, 0, ikm.length);
  final prk = hmacExtract.compute() as Uint8List;

  // Expand (2 blocks for 64 bytes)
  final hmacExpand1 = pc.HMac(pc.SHA256Digest(), 64)..init(pc.KeyParameter(prk));
  hmacExpand1.update(infoBytes, 0, infoBytes.length);
  hmacExpand1.update(Uint8List.fromList([0x01]), 0, 1);
  final t1 = hmacExpand1.compute() as Uint8List;

  final hmacExpand2 = pc.HMac(pc.SHA256Digest(), 64)..init(pc.KeyParameter(prk));
  hmacExpand2.update(t1, 0, t1.length);
  hmacExpand2.update(infoBytes, 0, infoBytes.length);
  hmacExpand2.update(Uint8List.fromList([0x02]), 0, 1);
  final t2 = hmacExpand2.compute() as Uint8List;

  final combined = Uint8List.fromList([...t1, ...t2]);
  return Uint8List.fromList(combined.sublist(0, outputBytes));
}

pc.AsymmetricKeyPair<pc.ECPublicKey, pc.ECPrivateKey> _generateDhKeyPair() {
  final curve = pc.ECCurve_secp256r1();
  final keyParams = pc.ECKeyGeneratorParameters(curve);
  final generator = pc.ECKeyGenerator()
    ..init(pc.ParametersWithRandom(keyParams, _secureRandom()));
  final pair = generator.generateKeyPair();
  return pc.AsymmetricKeyPair<pc.ECPublicKey, pc.ECPrivateKey>(
    pair.publicKey as pc.ECPublicKey,
    pair.privateKey as pc.ECPrivateKey,
  );
}

String _exportPublicKeyBase64(pc.ECPublicKey key) {
  final pointBytes = key.Q!.getEncoded(false);
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

pc.ECPublicKey _importPublicKey(String base64Str) {
  final derBytes = base64.decode(base64Str);
  final parser = pc.ASN1Parser(derBytes);
  final spkiSeq = parser.nextObject() as pc.ASN1Sequence;
  final bitString = spkiSeq.elements![1] as pc.ASN1BitString;
  final pointBytes = bitString.valueBytes!.sublist(1);
  final curve = pc.ECCurve_secp256r1();
  final q = curve.curve.decodePoint(pointBytes);
  return pc.ECPublicKey(q, curve);
}

pc.ECPrivateKey _importPrivateJwk(Map<String, dynamic> jwk) {
  final d = BigInt.parse(jwk['d'] as String);
  return pc.ECPrivateKey(d, pc.ECCurve_secp256r1());
}

Uint8List _aesGcmEncrypt(Uint8List key, Uint8List iv, Uint8List plaintext) {
  // AES-GCM-256 via pointycastle.
  final cipher = pc.GCMBlockCipher(pc.AESEngine())
    ..init(
      true,
      pc.AEADParameters(pc.KeyParameter(key), 128, iv, Uint8List(0)),
    );
  final output = cipher.process(plaintext);
  return output;
}

Uint8List _aesGcmDecrypt(Uint8List key, Uint8List iv, Uint8List ciphertext) {
  final cipher = pc.GCMBlockCipher(pc.AESEngine())
    ..init(
      false,
      pc.AEADParameters(pc.KeyParameter(key), 128, iv, Uint8List(0)),
    );
  return cipher.process(ciphertext);
}

Uint8List _randomBytes(int n) {
  final random = pc.FortunaRandom();
  final seed = List<int>.generate(32, (_) => DateTime.now().microsecondsSinceEpoch & 0xff);
  random.seed(pc.KeyParameter(Uint8List.fromList(seed)));
  final out = Uint8List(n);
  random.nextBytes(out);
  return out;
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

// ─── Types ─────────────────────────────────────────────────────────────

class DoubleRatchetState {
  Uint8List rootKey;
  Uint8List? sendingChainKey;
  Uint8List? receivingChainKey;
  Map<String, dynamic>? sendingDhPrivateJwk;
  String? sendingDhPublicKeyBase64;
  String? receivingDhPublicKeyBase64;
  int sendingMessageNumber;
  int receivingMessageNumber;
  int previousChainLength;

  DoubleRatchetState({
    required this.rootKey,
    this.sendingChainKey,
    this.receivingChainKey,
    this.sendingDhPrivateJwk,
    this.sendingDhPublicKeyBase64,
    this.receivingDhPublicKeyBase64,
    this.sendingMessageNumber = 0,
    this.receivingMessageNumber = 0,
    this.previousChainLength = 0,
  });

  Map<String, dynamic> toJson() => {
    'rootKeyBase64': base64.encode(rootKey),
    'sendingChainKeyBase64': sendingChainKey != null ? base64.encode(sendingChainKey!) : null,
    'receivingChainKeyBase64': receivingChainKey != null ? base64.encode(receivingChainKey!) : null,
    'sendingDhPrivateJwk': sendingDhPrivateJwk,
    'sendingDhPublicKeyBase64': sendingDhPublicKeyBase64,
    'receivingDhPublicKeyBase64': receivingDhPublicKeyBase64,
    'sendingMessageNumber': sendingMessageNumber,
    'receivingMessageNumber': receivingMessageNumber,
    'previousChainLength': previousChainLength,
  };

  factory DoubleRatchetState.fromJson(Map<String, dynamic> json) {
    return DoubleRatchetState(
      rootKey: Uint8List.fromList(base64.decode(json['rootKeyBase64'] as String)),
      sendingChainKey: json['sendingChainKeyBase64'] != null
          ? Uint8List.fromList(base64.decode(json['sendingChainKeyBase64'] as String))
          : null,
      receivingChainKey: json['receivingChainKeyBase64'] != null
          ? Uint8List.fromList(base64.decode(json['receivingChainKeyBase64'] as String))
          : null,
      sendingDhPrivateJwk: json['sendingDhPrivateJwk'] != null
          ? Map<String, dynamic>.from(json['sendingDhPrivateJwk'] as Map)
          : null,
      sendingDhPublicKeyBase64: json['sendingDhPublicKeyBase64'] as String?,
      receivingDhPublicKeyBase64: json['receivingDhPublicKeyBase64'] as String?,
      sendingMessageNumber: json['sendingMessageNumber'] as int? ?? 0,
      receivingMessageNumber: json['receivingMessageNumber'] as int? ?? 0,
      previousChainLength: json['previousChainLength'] as int? ?? 0,
    );
  }
}

class RatchetHeader {
  final String dh;
  final int n;
  final int pn;

  RatchetHeader({required this.dh, required this.n, required this.pn});

  Map<String, dynamic> toJson() => {'dh': dh, 'n': n, 'pn': pn};

  factory RatchetHeader.fromJson(Map<String, dynamic> json) {
    return RatchetHeader(
      dh: json['dh'] as String,
      n: json['n'] as int,
      pn: json['pn'] as int,
    );
  }
}

class RatchetCiphertext {
  final String? x3dhHeaderBase64;
  final String headerBase64;
  final String ivCiphertextBase64;

  RatchetCiphertext({
    this.x3dhHeaderBase64,
    required this.headerBase64,
    required this.ivCiphertextBase64,
  });

  Map<String, dynamic> toJson() => {
    if (x3dhHeaderBase64 != null) 'x3dh': x3dhHeaderBase64,
    'header': headerBase64,
    'iv_ct': ivCiphertextBase64,
  };

  factory RatchetCiphertext.fromJson(Map<String, dynamic> json) {
    return RatchetCiphertext(
      x3dhHeaderBase64: json['x3dh'] as String?,
      headerBase64: json['header'] as String,
      ivCiphertextBase64: json['iv_ct'] as String,
    );
  }
}

// ─── State management ──────────────────────────────────────────────────

DoubleRatchetState initDoubleRatchet(Uint8List sharedSecret, {String? peerDhPublicKeyBase64}) {
  return DoubleRatchetState(
    rootKey: sharedSecret,
    receivingDhPublicKeyBase64: peerDhPublicKeyBase64,
  );
}

// ─── Encrypt (send) ────────────────────────────────────────────────────

Future<RatchetCiphertext> ratchetEncrypt(
  DoubleRatchetState state,
  Uint8List plaintext, {
  String? x3dhHeaderBase64,
}) async {
  // 1. If no sending DH keypair yet, generate one + ratchet (if peer key known).
  if (state.sendingDhPrivateJwk == null) {
    final newPair = _generateDhKeyPair();
    state.sendingDhPrivateJwk = {
      'd': newPair.privateKey.d!.toString(),
      'q': base64.encode(newPair.publicKey.Q!.getEncoded(false)),
    };
    state.sendingDhPublicKeyBase64 = _exportPublicKeyBase64(newPair.publicKey);

    if (state.receivingDhPublicKeyBase64 != null) {
      final peerPub = _importPublicKey(state.receivingDhPublicKeyBase64!);
      final privKey = _importPrivateJwk(state.sendingDhPrivateJwk!);
      final dhOut = _dh(privKey, peerPub);
      final derived = _hkdf(state.rootKey, dhOut, 'helm_dr_root_v1', outputBytes: 64);
      state.rootKey = Uint8List.fromList(derived.sublist(0, 32));
      state.sendingChainKey = Uint8List.fromList(derived.sublist(32, 64));
      state.sendingMessageNumber = 0;
      state.previousChainLength = state.receivingMessageNumber;
    }
  }

  // 2. If still no sending chain key, derive from root key.
  if (state.sendingChainKey == null) {
    final derived = _hkdf(state.rootKey, Uint8List(0), 'helm_dr_init_v1', outputBytes: 64);
    state.rootKey = Uint8List.fromList(derived.sublist(0, 32));
    state.sendingChainKey = Uint8List.fromList(derived.sublist(32, 64));
  }

  // 3. Derive message key from sending chain key + advance.
  final derived = _hkdf(state.sendingChainKey!, Uint8List(0), 'helm_dr_msg_v1', outputBytes: 64);
  final messageKey = Uint8List.fromList(derived.sublist(0, 32));
  state.sendingChainKey = Uint8List.fromList(derived.sublist(32, 64));
  final n = state.sendingMessageNumber;
  state.sendingMessageNumber++;

  // 4. AES-GCM-256 encrypt.
  final iv = _randomBytes(12);
  final ciphertext = _aesGcmEncrypt(messageKey, iv, plaintext);

  // 5. Header.
  final header = RatchetHeader(
    dh: state.sendingDhPublicKeyBase64!,
    n: n,
    pn: state.previousChainLength,
  );
  final headerBase64 = base64.encode(utf8.encode(jsonEncode(header.toJson())));

  // 6. Concatenate IV + ciphertext.
  final ivCiphertext = Uint8List.fromList([...iv, ...ciphertext]);
  final ivCiphertextBase64 = base64.encode(ivCiphertext);

  return RatchetCiphertext(
    x3dhHeaderBase64: x3dhHeaderBase64,
    headerBase64: headerBase64,
    ivCiphertextBase64: ivCiphertextBase64,
  );
}

// ─── Decrypt (receive) ─────────────────────────────────────────────────

Future<Uint8List> ratchetDecrypt(
  DoubleRatchetState state,
  RatchetCiphertext ciphertext,
) async {
  final headerJson = utf8.decode(base64.decode(ciphertext.headerBase64));
  final header = RatchetHeader.fromJson(jsonDecode(headerJson) as Map<String, dynamic>);

  // 1. If peer DH key changed, ratchet.
  if (state.receivingDhPublicKeyBase64 != header.dh) {
    state.receivingDhPublicKeyBase64 = header.dh;
    state.receivingMessageNumber = 0;

    if (state.sendingDhPrivateJwk != null) {
      final peerPub = _importPublicKey(header.dh);
      final privKey = _importPrivateJwk(state.sendingDhPrivateJwk!);
      final dhOut = _dh(privKey, peerPub);
      final derived = _hkdf(state.rootKey, dhOut, 'helm_dr_root_v1', outputBytes: 64);
      state.rootKey = Uint8List.fromList(derived.sublist(0, 32));
      state.receivingChainKey = Uint8List.fromList(derived.sublist(32, 64));

      // Generate new sending DH keypair.
      final newPair = _generateDhKeyPair();
      state.sendingDhPrivateJwk = {
        'd': newPair.privateKey.d!.toString(),
        'q': base64.encode(newPair.publicKey.Q!.getEncoded(false)),
      };
      state.sendingDhPublicKeyBase64 = _exportPublicKeyBase64(newPair.publicKey);

      final newPrivKey = _importPrivateJwk(state.sendingDhPrivateJwk!);
      final dhOut2 = _dh(newPrivKey, peerPub);
      final derived2 = _hkdf(state.rootKey, dhOut2, 'helm_dr_root_v1', outputBytes: 64);
      state.rootKey = Uint8List.fromList(derived2.sublist(0, 32));
      state.sendingChainKey = Uint8List.fromList(derived2.sublist(32, 64));
      state.sendingMessageNumber = 0;
      state.previousChainLength = header.pn;
    }
  }

  // 2. Skip-ahead: advance receiving chain to match header.n.
  if (header.n < state.receivingMessageNumber) {
    throw Exception('DR: out-of-order message not supported in V3 (skipped-keys cache coming in V3.1)');
  }
  while (state.receivingMessageNumber < header.n) {
    if (state.receivingChainKey == null) {
      final derived = _hkdf(state.rootKey, Uint8List(0), 'helm_dr_init_v1', outputBytes: 64);
      state.rootKey = Uint8List.fromList(derived.sublist(0, 32));
      state.receivingChainKey = Uint8List.fromList(derived.sublist(32, 64));
    }
    final adv = _hkdf(state.receivingChainKey!, Uint8List(0), 'helm_dr_msg_v1', outputBytes: 64);
    state.receivingChainKey = Uint8List.fromList(adv.sublist(32, 64));
    state.receivingMessageNumber++;
  }

  // 3. Derive message key.
  if (state.receivingChainKey == null) {
    final derived = _hkdf(state.rootKey, Uint8List(0), 'helm_dr_init_v1', outputBytes: 64);
    state.rootKey = Uint8List.fromList(derived.sublist(0, 32));
    state.receivingChainKey = Uint8List.fromList(derived.sublist(32, 64));
  }
  final msgDerived = _hkdf(state.receivingChainKey!, Uint8List(0), 'helm_dr_msg_v1', outputBytes: 64);
  final messageKey = Uint8List.fromList(msgDerived.sublist(0, 32));
  state.receivingChainKey = Uint8List.fromList(msgDerived.sublist(32, 64));
  state.receivingMessageNumber++;

  // 4. Split IV + ciphertext.
  final ivCiphertext = base64.decode(ciphertext.ivCiphertextBase64);
  final iv = Uint8List.fromList(ivCiphertext.sublist(0, 12));
  final ct = Uint8List.fromList(ivCiphertext.sublist(12));

  // 5. AES-GCM-256 decrypt.
  return _aesGcmDecrypt(messageKey, iv, ct);
}

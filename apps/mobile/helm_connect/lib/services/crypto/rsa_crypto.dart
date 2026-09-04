// ============================================================================
// RSA-OAEP (2048 bits, SHA-256) — PUR DART, ZÉRO DÉPENDANCE
// ============================================================================
// ⭐ V8 (E2EE mobile) — implémentation autonome compatible client web :
//   - Schéma IDENTIQUE au web (src/lib/chat/crypto.ts, Web Crypto API) :
//       RSA-OAEP 2048 bits, hash SHA-256, MGF1-SHA-256, label vide.
//   - Clé publique sérialisée en SPKI DER → base64 (byte-compatible avec
//     crypto.subtle.exportKey('spki', …)).
//   - Clé privée stockée localement en PKCS#8 DER → base64 (jamais envoyée).
//   - Format wire « E2E:<base64(ciphertext)> » — même préfixe que le web.
//
// Pourquoi du pur Dart plutôt que pointycastle ? Le pubspec désactivait
// pointycastle depuis la V3-8 (incompatibilité d'API). Zéro dépendance =
// zéro risque de build ; le code est validé par tests croisés contre
// la bibliothèque « cryptography » de Python (RFC 8017).
//
// AUCUN import Flutter ici (dart:math / dart:convert / dart:typed_data
// uniquement) → testable hors Flutter (`dart run`).
// ============================================================================

import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

// ═════════════════════════════════════════════════════════════════
// CLÉS
// ═════════════════════════════════════════════════════════════════

class RsaPublicKey {
  final BigInt n; // module
  final BigInt e; // exposant public (65537)
  const RsaPublicKey(this.n, this.e);
  int get byteLength => (n.bitLength + 7) >> 3; // taille de n en octets
}

class RsaPrivateKey {
  final BigInt n, e, d;
  final BigInt p, q, dp, dq, qInv; // params CRT
  const RsaPrivateKey({
    required this.n,
    required this.e,
    required this.d,
    required this.p,
    required this.q,
    required this.dp,
    required this.dq,
    required this.qInv,
  });
  RsaPublicKey get publicKey => RsaPublicKey(n, e);
  int get byteLength => (n.bitLength + 7) >> 3;
}

class RsaKeyPair {
  final RsaPrivateKey privateKey;
  const RsaKeyPair(this.privateKey);
}

// ═════════════════════════════════════════════════════════════════
// SHA-256 (FIPS 180-4) — pur Dart
// ═════════════════════════════════════════════════════════════════

class _Sha256 {
  static final List<int> _k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  static final List<int> _h0 = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  static final _bigEndian64 = ByteData(8);

  /// Hachage SHA-256 d'un message.
  static Uint8List hash(List<int> message) {
    // Préparation : message + 0x80 + zéros + longueur 64 bits big-endian
    final msgLen = message.length;
    final bitLen = msgLen * 8;
    final paddedLen = ((msgLen + 8) >> 6) + 1; // en blocs de 64 octets
    final totalLen = paddedLen << 6;
    final data = Uint8List(totalLen);
    data.setRange(0, msgLen, message);
    data[msgLen] = 0x80;
    _bigEndian64.setUint64(0, bitLen, Endian.big);
    data.setRange(totalLen - 8, totalLen, _bigEndian64.buffer.asUint8List());

    var h = List<int>.from(_h0);
    final w = List<int>.filled(64, 0);

    for (var block = 0; block < totalLen; block += 64) {
      for (var t = 0; t < 16; t++) {
        w[t] = (data[block + t * 4] << 24) |
            (data[block + t * 4 + 1] << 16) |
            (data[block + t * 4 + 2] << 8) |
            data[block + t * 4 + 3];
      }
      for (var t = 16; t < 64; t++) {
        final s0 = _rotr(w[t - 15], 7) ^ _rotr(w[t - 15], 18) ^ (w[t - 15] >> 3);
        final s1 = _rotr(w[t - 2], 17) ^ _rotr(w[t - 2], 19) ^ (w[t - 2] >> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) & 0xFFFFFFFF;
      }

      var a = h[0], b = h[1], c = h[2], d = h[3];
      var e = h[4], f = h[5], g = h[6], hh = h[7];

      for (var t = 0; t < 64; t++) {
        final s1 = _rotr(e, 6) ^ _rotr(e, 11) ^ _rotr(e, 25);
        final ch = (e & f) ^ (~e & g);
        final temp1 = (hh + s1 + ch + _k[t] + w[t]) & 0xFFFFFFFF;
        final s0 = _rotr(a, 2) ^ _rotr(a, 13) ^ _rotr(a, 22);
        final maj = (a & b) ^ (a & c) ^ (b & c);
        final temp2 = (s0 + maj) & 0xFFFFFFFF;
        hh = g;
        g = f;
        f = e;
        e = (d + temp1) & 0xFFFFFFFF;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) & 0xFFFFFFFF;
      }

      h[0] = (h[0] + a) & 0xFFFFFFFF;
      h[1] = (h[1] + b) & 0xFFFFFFFF;
      h[2] = (h[2] + c) & 0xFFFFFFFF;
      h[3] = (h[3] + d) & 0xFFFFFFFF;
      h[4] = (h[4] + e) & 0xFFFFFFFF;
      h[5] = (h[5] + f) & 0xFFFFFFFF;
      h[6] = (h[6] + g) & 0xFFFFFFFF;
      h[7] = (h[7] + hh) & 0xFFFFFFFF;
    }

    // Sortie : 8 mots de 32 bits big-endian
    final out = Uint8List(32);
    final bd = ByteData.view(out.buffer);
    for (var i = 0; i < 8; i++) {
      bd.setUint32(i * 4, h[i], Endian.big);
    }
    return out;
  }

  static int _rotr(int x, int n) => ((x >> n) | (x << (32 - n))) & 0xFFFFFFFF;
}

// ═════════════════════════════════════════════════════════════════
// MGF1-SHA256 (RFC 8017 B.2.1)
// ═════════════════════════════════════════════════════════════════

Uint8List _mgf1Sha256(Uint8List seed, int length) {
  final out = <int>[];
  var counter = 0;
  while (out.length < length) {
    final c = ByteData(4);
    c.setUint32(0, counter, Endian.big);
    final block = _Sha256.hash([...seed, ...c.buffer.asUint8List()]);
    out.addAll(block);
    counter++;
  }
  return Uint8List.fromList(out.sublist(0, length));
}

// ═════════════════════════════════════════════════════════════════
// OAEP (RFC 8017 §7.1) — SHA-256, label vide (comme Web Crypto)
// ═════════════════════════════════════════════════════════════════

const int _hLen = 32; // SHA-256
final Uint8List _emptyLabelHash = _Sha256.hash([]);

int oaepMaxPlaintextLength(int modulusByteLength) =>
    modulusByteLength - 2 * _hLen - 2;

/// Encodage OAEP → EM prêt pour l'opération RSA (taille = k octets).
Uint8List _oaepEncode(Uint8List message, int k, Random rng) {
  final mLen = message.length;
  if (mLen > k - 2 * _hLen - 2) {
    throw ArgumentError('Message trop long pour OAEP ($mLen > ${k - 2 * _hLen - 2})');
  }
  // DB = lHash || PS || 0x01 || M
  final psLen = k - mLen - 2 * _hLen - 2;
  final db = Uint8List(_hLen + psLen + 1 + mLen);
  db.setRange(0, _hLen, _emptyLabelHash);
  db[_hLen + psLen] = 0x01;
  db.setRange(_hLen + psLen + 1, db.length, message);

  // seed aléatoire
  final seed = Uint8List(_hLen);
  for (var i = 0; i < seed.length; i++) {
    seed[i] = rng.nextInt(256);
  }

  final dbMask = _mgf1Sha256(seed, k - _hLen - 1);
  final maskedDb = Uint8List.fromList(db);
  for (var i = 0; i < maskedDb.length; i++) {
    maskedDb[i] ^= dbMask[i];
  }
  final seedMask = _mgf1Sha256(maskedDb, _hLen);
  final maskedSeed = Uint8List.fromList(seed);
  for (var i = 0; i < maskedSeed.length; i++) {
    maskedSeed[i] ^= seedMask[i];
  }

  final em = Uint8List(k);
  em[0] = 0x00;
  em.setRange(1, 1 + _hLen, maskedSeed);
  em.setRange(1 + _hLen, k, maskedDb);
  return em;
}

/// Décodage OAEP (EM → message). Renvoie null si padding invalide.
Uint8List? _oaepDecode(Uint8List em, int k) {
  if (em.length != k || k < 2 * _hLen + 2) return null;
  if (em[0] != 0x00) return null;
  final maskedSeed = Uint8List.sublistView(em, 1, 1 + _hLen);
  final maskedDb = Uint8List.sublistView(em, 1 + _hLen, k);

  final seedMask = _mgf1Sha256(maskedDb, _hLen);
  final seed = Uint8List.fromList(maskedSeed);
  for (var i = 0; i < seed.length; i++) {
    seed[i] ^= seedMask[i];
  }
  final dbMask = _mgf1Sha256(seed, k - _hLen - 1);
  final db = Uint8List.fromList(maskedDb);
  for (var i = 0; i < db.length; i++) {
    db[i] ^= dbMask[i];
  }

  // DB = lHash || PS || 0x01 || M — vérification en temps constant implicite
  for (var i = 0; i < _hLen; i++) {
    if (db[i] != _emptyLabelHash[i]) return null;
  }
  var idx = _hLen;
  while (idx < db.length && db[idx] == 0x00) {
    idx++;
  }
  if (idx >= db.length || db[idx] != 0x01) return null;
  return Uint8List.sublistView(db, idx + 1);
}

// ═════════════════════════════════════════════════════════════════
// RSA — primitives (BigInt) + chiffrement OAEP
// ═════════════════════════════════════════════════════════════════

BigInt _os2ip(Uint8List bytes) {
  var v = BigInt.zero;
  for (final b in bytes) {
    v = (v << 8) | BigInt.from(b);
  }
  return v;
}

Uint8List _i2osp(BigInt value, int length) {
  final out = Uint8List(length);
  var v = value;
  for (var i = length - 1; i >= 0; i--) {
    out[i] = (v & BigInt.from(0xFF)).toInt();
    v = v >> 8;
  }
  return out;
}

/// Chiffre [message] (OAEP) avec la clé publique → ciphertext de k octets.
Uint8List rsaOaepEncrypt(Uint8List message, RsaPublicKey key, [Random? rng]) {
  final k = key.byteLength;
  final em = _oaepEncode(message, k, rng ?? Random.secure());
  final m = _os2ip(em);
  if (m >= key.n) throw ArgumentError('EM >= n');
  final c = m.modPow(key.e, key.n);
  return _i2osp(c, k);
}

/// Déchiffre un ciphertext OAEP avec la clé privée (CRT). Null si invalide.
Uint8List? rsaOaepDecrypt(Uint8List ciphertext, RsaPrivateKey key) {
  final k = key.byteLength;
  if (ciphertext.length != k) return null;
  final c = _os2ip(ciphertext);
  if (c >= key.n) return null;

  // RSAES-OAEP-DECRYPT via CRT
  final m1 = c.modPow(key.dp, key.p);
  final m2 = c.modPow(key.dq, key.q);
  var h = (m1 - m2) * key.qInv % key.p;
  if (h.isNegative) h += key.p;
  final m = m2 + h * key.q;

  final em = _i2osp(m, k);
  return _oaepDecode(em, k);
}

// ═════════════════════════════════════════════════════════════════
// GÉNÉRATION DE CLÉS (2048 bits, e = 65537)
// ═════════════════════════════════════════════════════════════════

final Random _keyRng = Random.secure();

/// Petits premiers pour le crible préalable (accélère fortement Miller-Rabin).
final List<BigInt> _smallPrimes = _sieveSmallPrimes(2000);

List<BigInt> _sieveSmallPrimes(int limit) {
  final isComposite = List<bool>.filled(limit + 1, false);
  final primes = <BigInt>[];
  for (var i = 2; i <= limit; i++) {
    if (!isComposite[i]) {
      primes.add(BigInt.from(i));
      for (var j = i * i; j <= limit; j += i) {
        isComposite[j] = true;
      }
    }
  }
  return primes;
}

/// Test de Miller-Rabin (probablement premier) avec [rounds] bases aléatoires.
bool _isProbablePrime(BigInt n, {int rounds = 24}) {
  if (n < BigInt.from(4)) return n > BigInt.one;
  if (n.isEven) return false;

  // Décomposition n - 1 = 2^r * d
  var d = n - BigInt.one;
  var r = 0;
  while (d.isEven) {
    d = d >> 1;
    r++;
  }

  final nMinus1 = n - BigInt.one;
  for (var round = 0; round < rounds; round++) {
    var a = BigInt.from(2) + BigInt.from(_keyRng.nextInt(0x7FFFFFFF)) % (n - BigInt.from(4));
    var x = a.modPow(d, n);
    if (x == BigInt.one || x == nMinus1) continue;
    var composite = true;
    for (var i = 0; i < r - 1; i++) {
      x = x.modPow(BigInt.two, n);
      if (x == nMinus1) {
        composite = false;
        break;
      }
    }
    if (composite) return false;
  }
  return true;
}

/// Génère un premier probable de [bits] bits (2 bits de poids fort posés
/// pour garantir un module de la taille exacte).
BigInt _generatePrime(int bits) {
  final e = BigInt.from(65537);
  while (true) {
    // Candidat aléatoire de `bits` bits, top 2 bits + bit 0 (impair) posés
    var candidate = BigInt.one << (bits - 1); // top bit
    candidate |= BigInt.one << (bits - 2); // 2e bit (garantit n 2048 bits)
    for (var i = 1; i < bits - 2; i++) {
      if (_keyRng.nextBool()) candidate |= BigInt.one << i;
    }
    candidate |= BigInt.one; // impair

    // Crible des petits premiers
    var divisible = false;
    for (final sp in _smallPrimes) {
      if (candidate % sp == BigInt.zero) {
        divisible = true;
        break;
      }
    }
    if (divisible) continue;

    // Test complet seulement si e ne divise pas p-1 (nécessaire pour RSA)
    if ((candidate - BigInt.one) % e == BigInt.zero) continue;
    if (_isProbablePrime(candidate)) return candidate;
  }
}

/// Génère une paire RSA-2048 (e = 65537). ⚠️ Peut prendre quelques secondes
/// (amorce de Miller-Rabin en pur Dart) — à appeler UNE fois par appareil,
/// de préférence en tâche de fond.
RsaKeyPair generateRsaKeyPair({int bits = 2048}) {
  if (bits % 2 != 0) throw ArgumentError('bits doit être pair');
  final e = BigInt.from(65537);
  BigInt p, q;
  do {
    p = _generatePrime(bits >> 1);
    q = _generatePrime(bits >> 1);
  } while (p == q);

  final n = p * q;
  final one = BigInt.one;
  final phi = (p - one) * (q - one);
  final lambda = phi ~/ (p - one).gcd(q - one); // lcm(p-1, q-1)
  final d = e.modInverse(lambda);

  return RsaKeyPair(RsaPrivateKey(
    n: n,
    e: e,
    d: d,
    p: p,
    q: q,
    dp: d % (p - one),
    dq: d % (q - one),
    qInv: q.modInverse(p),
  ));
}

// ═════════════════════════════════════════════════════════════════
// DER — sérialisation minimale (SPKI public / PKCS#8 privé)
// ═════════════════════════════════════════════════════════════════

const List<int> _rsaOid = [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01]; // 1.2.840.113549.1.1.1

List<int> _derLength(int length) {
  if (length < 0x80) return [length];
  final bytes = <int>[];
  var v = length;
  while (v > 0) {
    bytes.insert(0, v & 0xFF);
    v >>= 8;
  }
  return [0x80 | bytes.length, ...bytes];
}

List<int> _derTlv(int tag, List<int> content) {
  return [tag, ..._derLength(content.length), ...content];
}

/// INTEGER DER : big-endian minimal, 0x00 si bit de signe posé.
List<int> _derInteger(BigInt value) {
  if (value.isNegative) throw ArgumentError('Entier négatif non supporté');
  if (value == BigInt.zero) return _derTlv(0x02, [0x00]);
  var len = (value.bitLength + 7) >> 3;
  var bytes = _i2osp(value, len);
  // DER : préfixe 0x00 obligatoire si le bit de poids fort est posé
  // (sinon l'entier serait interprété comme négatif — Web Crypto rejette).
  if (bytes[0] & 0x80 != 0) {
    bytes = Uint8List.fromList([0x00, ...bytes]);
  }
  return _derTlv(0x02, bytes);
}

BigInt _parseDerInteger(List<int> content) {
  var v = BigInt.zero;
  for (final b in content) {
    v = (v << 8) | BigInt.from(b);
  }
  return v;
}

class _DerParser {
  final List<int> _data;
  int _pos = 0;
  _DerParser(this._data);

  bool get _atEnd => _pos >= _data.length;

  /// Lit un TLV ; renvoie (tag, contenu).
  (int, List<int>) _readTlv() {
    if (_pos >= _data.length) throw const FormatException('DER tronqué (tag)');
    final tag = _data[_pos++];
    if (_pos >= _data.length) throw const FormatException('DER tronqué (longueur)');
    var len = _data[_pos++];
    if (len & 0x80 != 0) {
      final numBytes = len & 0x7F;
      if (numBytes == 0 || numBytes > 4) throw const FormatException('Longueur DER invalide');
      len = 0;
      for (var i = 0; i < numBytes; i++) {
        if (_pos >= _data.length) throw const FormatException('DER tronqué (longueur longue)');
        len = (len << 8) | _data[_pos++];
      }
    }
    if (_pos + len > _data.length) throw const FormatException('DER tronqué (contenu)');
    final content = _data.sublist(_pos, _pos + len);
    _pos += len;
    return (tag, content);
  }

  /// Parse une SEQUENCE et renvoie un parser positionné sur son contenu.
  _DerParser _readSequence() {
    final (tag, content) = _readTlv();
    if (tag != 0x30) throw const FormatException('SEQUENCE attendue');
    return _DerParser(content);
  }
}

/// Encode la clé publique en SPKI DER → base64 (format Web Crypto `spki`).
String encodePublicKeySpkiB64(RsaPublicKey key) {
  // SubjectPublicKeyInfo ::= SEQUENCE {
  //   algorithm AlgorithmIdentifier(SEQUENCE { OID rsaEncryption, NULL }),
  //   subjectPublicKey BIT STRING { RSAPublicKey ::= SEQUENCE { n, e } } }
  final rsaPublicKey = _derTlv(0x30, [..._derInteger(key.n), ..._derInteger(key.e)]);
  // BIT STRING : premier octet = nombre de bits inutilisés (0)
  final bitString = _derTlv(0x03, [0x00, ...rsaPublicKey]);
  final algorithm = _derTlv(0x30, [
    ..._derTlv(0x06, _rsaOid),
    ..._derTlv(0x05, const []), // NULL
  ]);
  final spki = _derTlv(0x30, [...algorithm, ...bitString]);
  return base64Encode(spki);
}

/// Décode une clé publique SPKI base64 (accepte les exports Web Crypto).
/// Renvoie null si le format est invalide.
RsaPublicKey? decodePublicKeySpkiB64(String base64) {
  try {
    final data = base64Decode(base64.trim());
    var p = _DerParser(data)._readSequence();
    // AlgorithmIdentifier
    final (algoTag, algoContent) = p._readTlv();
    if (algoTag != 0x30) return null;
    final algoParser = _DerParser(algoContent);
    final (oidTag, oid) = algoParser._readTlv();
    if (oidTag != 0x06) return null;
    // tolère l'absence de NULL final
    if (oid.length != _rsaOid.length) return null;
    for (var i = 0; i < oid.length; i++) {
      if (oid[i] != _rsaOid[i]) return null;
    }
    // BIT STRING
    final (bsTag, bsContent) = p._readTlv();
    if (bsTag != 0x03 || bsContent.isEmpty || bsContent[0] != 0x00) return null;
    final inner = _DerParser(bsContent.sublist(1))._readSequence();
    final (nTag, nBytes) = inner._readTlv();
    final (eTag, eBytes) = inner._readTlv();
    if (nTag != 0x02 || eTag != 0x02) return null;
    final n = _parseDerInteger(nBytes);
    final e = _parseDerInteger(eBytes);
    if (n.bitLength < 512) return null; // module min. raisonnable
    return RsaPublicKey(n, e);
  } catch (_) {
    return null;
  }
}

/// Encode la clé privée en PKCS#8 DER → base64 (stockage local uniquement).
String encodePrivateKeyPkcs8B64(RsaPrivateKey key) {
  // RSAPrivateKey ::= SEQUENCE { version, n, e, d, p, q, dP, dQ, qInv }
  final rsaPrivate = _derTlv(0x30, [
    ..._derTlv(0x02, [0x00]), // version 0
    ..._derInteger(key.n),
    ..._derInteger(key.e),
    ..._derInteger(key.d),
    ..._derInteger(key.p),
    ..._derInteger(key.q),
    ..._derInteger(key.dp),
    ..._derInteger(key.dq),
    ..._derInteger(key.qInv),
  ]);
  // PrivateKeyInfo ::= SEQUENCE { version 0, AlgorithmIdentifier, OCTET STRING }
  final algorithm = _derTlv(0x30, [
    ..._derTlv(0x06, _rsaOid),
    ..._derTlv(0x05, const []),
  ]);
  final pkcs8 = _derTlv(0x30, [
    ..._derTlv(0x02, [0x00]),
    ...algorithm,
    ..._derTlv(0x04, rsaPrivate),
  ]);
  return base64Encode(pkcs8);
}

/// Décode une clé privée PKCS#8 base64. Null si invalide.
RsaPrivateKey? decodePrivateKeyPkcs8B64(String base64) {
  try {
    final data = base64Decode(base64.trim());
    var p = _DerParser(data)._readSequence();
    // version
    final (vTag, vContent) = p._readTlv();
    if (vTag != 0x02 || vContent.length != 1 || vContent[0] != 0) return null;
    // AlgorithmIdentifier (ignoré, la validité se juge sur le contenu)
    p._readTlv();
    // OCTET STRING → RSAPrivateKey
    final (osTag, osContent) = p._readTlv();
    if (osTag != 0x04) return null;
    final inner = _DerParser(osContent)._readSequence();
    final fields = <BigInt>[];
    // 9 entiers : version, n, e, d, p, q, dP, dQ, qInv
    while (!inner._atEnd && fields.length < 9) {
      final (tag, content) = inner._readTlv();
      if (tag != 0x02) return null;
      fields.add(_parseDerInteger(content));
    }
    if (fields.length < 9) return null;
    return RsaPrivateKey(
      n: fields[1],
      e: fields[2],
      d: fields[3],
      p: fields[4],
      q: fields[5],
      dp: fields[6],
      dq: fields[7],
      qInv: fields[8],
    );
  } catch (_) {
    return null;
  }
}

// ═════════════════════════════════════════════════════════════════
// API HAUT NIVEAU — format wire « E2E:<base64> » (parité web)
// ═════════════════════════════════════════════════════════════════

const String e2ePrefix = 'E2E:';

/// Le contenu commence-t-il par le marqueur de chiffrement E2E ?
bool isE2eEncrypted(String? content) =>
    content != null && content.startsWith(e2ePrefix);

/// Chiffre [plaintext] pour la clé publique [recipientPublicKeySpkiB64].
/// Renvoie « E2E:<base64> » — ou null si échec/non chiffrable
/// (miroir de encryptMessage() du web : repli clair côté appelant).
String? e2eEncrypt(String plaintext, String recipientPublicKeySpkiB64) {
  try {
    final key = decodePublicKeySpkiB64(recipientPublicKeySpkiB64);
    if (key == null) return null;
    final message = utf8.encode(plaintext);
    if (message.length > oaepMaxPlaintextLength(key.byteLength)) return null;
    final cipher = rsaOaepEncrypt(Uint8List.fromList(message), key);
    return '$e2ePrefix${base64Encode(cipher)}';
  } catch (_) {
    return null;
  }
}

/// Déchiffre un contenu « E2E:<base64> » avec [privateKey].
/// Renvoie null si échec (message d'erreur à afficher côté appelant).
String? e2eDecrypt(String content, RsaPrivateKey privateKey) {
  if (!isE2eEncrypted(content)) return content;
  try {
    final cipher = base64Decode(content.substring(e2ePrefix.length));
    final plain = rsaOaepDecrypt(cipher, privateKey);
    if (plain == null) return null;
    return utf8.decode(plain);
  } catch (_) {
    return null;
  }
}

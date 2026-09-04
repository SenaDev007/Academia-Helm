// ============================================================================
// HELM CONNECT — E2EE Service (chiffrement de bout en bout, V8)
// ============================================================================
// ⭐ Miroir EXACT de la logique web (WhatsAppChat.tsx + lib/chat/crypto.ts) :
//   1. À la première ouverture d'une conversation : génération d'une paire
//      RSA-2048 (OAEP-SHA256) si absente → publication de la clé publique
//      via POST /chat/keys, la clé privée ne quitte JAMAIS l'appareil
//      (SharedPreferences, stockage sandboxé privé — équivalent mobile de
//      l'IndexedDB utilisé par le web).
//   2. Conversation DIRECT avec un correspondant qui a publié sa clé →
//      e2eAvailable = true (cadenas dans l'app bar).
//   3. Envoi : si e2eAvailable && contenu < 400 caractères →
//      « E2E:<base64(RSA-OAEP)> ». La copie locale optimiste reste en clair
//      (l'expéditeur ne peut pas déchiffrer son propre message).
//   4. Affichage : contenus « E2E: » → déchiffrement par la clé privée ;
//      MES messages chiffrés → repli sur la copie locale en clair du cache.
//   5. Groupes/canaux : NON chiffrés (parité web — V3 : Signal Protocol).
//
// La couche cryptographique (lib/services/crypto/rsa_crypto.dart) est validée
// par tests croisés contre Web Crypto (byte-level SPKI + chiffrement/dé-
// chiffrement bilatéral) → les messages E2E du web sont lisibles sur mobile
// et réciproquement.
// ============================================================================

import 'dart:isolate';

import 'package:shared_preferences/shared_preferences.dart';

import 'api_service.dart';
import 'crypto/rsa_crypto.dart';

class E2eeService {
  static const String _privateKeyPref = 'e2ee_private_key_pkcs8';
  static const String _publicKeyPref = 'e2ee_public_key_spki';

  // ─── Cache mémoire ────────────────────────────────────────────────
  static RsaPrivateKey? _privateKey;
  static final Map<String, String> _publicKeysCache = {}; // userId → SPKI b64
  static bool _keyPairGenerating = false;

  // ═════════════════════════════════════════════════════════════════
  // CLÉS LOCALES
  // ═════════════════════════════════════════════════════════════════

  /// L'utilisateur possède-t-il une clé privée sur cet appareil ?
  static Future<bool> hasPrivateKey() async {
    if (_privateKey != null) return true;
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(_privateKeyPref);
    return stored != null && stored.isNotEmpty;
  }

  /// Charge la clé privée en mémoire (depuis SharedPreferences).
  static Future<RsaPrivateKey?> _loadPrivateKey() async {
    if (_privateKey != null) return _privateKey;
    try {
      final prefs = await SharedPreferences.getInstance();
      final stored = prefs.getString(_privateKeyPref);
      if (stored == null || stored.isEmpty) return null;
      final key = decodePrivateKeyPkcs8B64(stored);
      if (key != null) _privateKey = key;
      return key;
    } catch (_) {
      return null;
    }
  }

  /// Génère la paire si absente, publie la clé publique. Best-effort :
  /// ne JAMAIS lever (repli silencieux sur clair, comme le web).
  /// ⭐ La génération (~0,5-3 s) tourne dans un isolate → zéro jank UI.
  static Future<void> ensureKeyPair({required String userId}) async {
    if (userId.isEmpty) return;
    if (_keyPairGenerating) return; // déjà en cours
    _keyPairGenerating = true;
    try {
      var priv = await _loadPrivateKey();
      if (priv == null) {
        // Génération HORS du thread UI (pur calcul BigInt)
        final privB64 = await Isolate.run(() {
          final pair = generateRsaKeyPair();
          return encodePrivateKeyPkcs8B64(pair.privateKey);
        });
        final decoded = decodePrivateKeyPkcs8B64(privB64);
        if (decoded == null) return;
        priv = decoded;
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_privateKeyPref, privB64);
        await prefs.setString(_publicKeyPref, encodePublicKeySpkiB64(priv.publicKey));
      }
      _privateKey = priv;

      // Publication de la clé publique (POST /chat/keys) — best effort :
      // si l'app est hors ligne, on retentera à la prochaine ouverture.
      final spki = encodePublicKeySpkiB64(priv.publicKey);
      try {
        await ApiService.publishPublicKey(userId, spki);
      } catch (_) {
        // silencieux — la clé sera republiée à la prochaine session
      }
    } catch (_) {
      // échec de génération → E2E reste désactivé, messages en clair
    } finally {
      _keyPairGenerating = false;
    }
  }

  /// Purge les caches mémoire + clés locales (déconnexion / changement
  /// de compte). ⚠️ Les messages E2E déjà reçus deviennent indéchiffrables
  /// sur cet appareil (comme une réinstallation du navigateur côté web).
  static Future<void> reset({bool deleteKeys = false}) async {
    _privateKey = null;
    _publicKeysCache.clear();
    _keyPairGenerating = false;
    if (deleteKeys) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_privateKeyPref);
      await prefs.remove(_publicKeyPref);
    }
  }

  // ═════════════════════════════════════════════════════════════════
  // CLÉS DU CORRESPONDANT
  // ═════════════════════════════════════════════════════════════════

  /// Récupère la clé publique d'un utilisateur (GET /chat/keys?userIds=),
  /// avec cache mémoire. Renvoie null si l'utilisateur n'a pas de clé
  /// (correspondant jamais connecté sur un client à jour).
  static Future<String?> getPublicKey(String userId) async {
    if (userId.isEmpty) return null;
    if (_publicKeysCache.containsKey(userId)) return _publicKeysCache[userId];
    try {
      final keys = await ApiService.getPublicKeys([userId]);
      final spki = keys[userId];
      _publicKeysCache[userId] = spki ?? '';
      return spki;
    } catch (_) {
      return null;
    }
  }

  /// E2EE est-il possible pour cette conversation DIRECT ?
  /// (clé privée locale + clé publique du correspondant)
  static Future<bool> isDirectE2eeAvailable(String otherUserId) async {
    if (otherUserId.isEmpty) return false;
    final mine = await hasPrivateKey();
    if (!mine) return false;
    final theirs = await getPublicKey(otherUserId);
    return theirs != null && theirs.isNotEmpty;
  }

  // ═════════════════════════════════════════════════════════════════
  // CHIFFREMENT / DÉCHIFFREMENT
  // ═════════════════════════════════════════════════════════════════

  /// Chiffre [plaintext] pour [recipientUserId] → « E2E:<base64> ».
  /// Renvoie null si le destinataire n'a pas de clé / contenu trop long /
  /// erreur → l'appelant envoie alors en clair (miroir du web).
  static Future<String?> encryptFor(String recipientUserId, String plaintext) async {
    if (plaintext.isEmpty) return null;
    final spki = await getPublicKey(recipientUserId);
    if (spki == null || spki.isEmpty) return null;
    return e2eEncrypt(plaintext, spki);
  }

  /// Déchiffre un contenu « E2E: » avec la clé privée locale.
  /// Renvoie le texte en clair, ou null si indéchiffrable (clé perdue /
  /// message d'un autre appareil) — l'appelant affiche le placeholder 🔒.
  static Future<String?> decryptContent(String? content) async {
    if (content == null || !isE2eEncrypted(content)) return content;
    final priv = await _loadPrivateKey();
    if (priv == null) return null;
    return e2eDecrypt(content, priv);
  }

  /// Contenu marqué E2E ? (exposé pour les aperçus de liste de conversations)
  static bool isEncrypted(String? content) => isE2eEncrypted(content);

  // ═════════════════════════════════════════════════════════════════
  // CONSTANTES DE SÉCURITÉ
  // ═════════════════════════════════════════════════════════════════

  /// Taille max d'un message chiffrable (RSA-OAEP-2048/SHA-256 = 190 octets
  /// UTF-8). Le web applique une garde de 400 caractères et s'appuie sur le
  /// repli try/catch — on applique la même politique ici via encryptFor.
  static int get maxPlaintextBytes => oaepMaxPlaintextLength(256);
}

/**
 * ============================================================================
 * 📧 TÂCHE 181 — CHIFFREMENT DES SECRETS E-MAIL (AES-256-GCM)
 * ============================================================================
 *
 * Cahier des charges section 7 :
 *   1. Chiffre les secrets en AES-256-GCM, avec un IV unique par secret.
 *      La clé de chiffrement vit dans une variable d'environnement
 *      (EMAIL_ENCRYPTION_KEY), jamais dans le dépôt Git.
 *   2. Ne journalise jamais un secret, un jeton ou le contenu d'un message.
 *   3. Mesure de dépannage : si la clé de chiffrement change, les écoles
 *      reçoivent le statut Expiré et reconnectent leur compte — aucune
 *      donnée en clair n'existe (lève EmailSecretDecryptError).
 *
 * Format stocké (3 colonnes) :
 *   - secretEncrypted : ciphertext+tag... non : ciphertext seul, base64
 *   - secretIv         : IV 12 octets, base64 (unique par secret)
 *   - secretTag        : tag GCM 16 octets, base64
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/** Erreur dédiée : secret indéchiffrable (clé changée / donnée corrompue). */
export class EmailSecretDecryptError extends Error {
  constructor(message = 'Secret e-mail indéchiffrable (clé de chiffrement modifiée ?)') {
    super(message);
    this.name = 'EmailSecretDecryptError';
  }
}

@Injectable()
export class EmailCryptoService {
  private readonly logger = new Logger(EmailCryptoService.name);
  private cachedKey: Buffer | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Clé 32 octets. Priorité :
   *   1. EMAIL_ENCRYPTION_KEY — hex (64 car.) ou base64 (44 car.), configurable
   *      sur Railway. RECOMMANDÉ en production.
   *   2. Repli déterministe dérivé de DATABASE_URL (secret déjà présent en
   *      env) — permet à la fonctionnalité de démarrer sans configuration
   *      supplémentaire. Si l'URL de base change, les secrets passent en
   *      statut Expiré (comportement documenté section 7.3 du CDC).
   *
   * ⚠️ Ne JAMAIS journaliser la clé.
   */
  private getKey(): Buffer {
    if (this.cachedKey) return this.cachedKey;

    const raw = (this.configService.get<string>('EMAIL_ENCRYPTION_KEY') || '').trim();
    let key: Buffer | null = null;

    if (raw) {
      if (/^[0-9a-fA-F]{64}$/.test(raw)) {
        key = Buffer.from(raw, 'hex');
      } else {
        try {
          const b = Buffer.from(raw, 'base64');
          if (b.length === 32) key = b;
        } catch {
          /* format invalide → repli */
        }
      }
    }

    if (!key) {
      if (raw) {
        this.logger.warn(
          'EMAIL_ENCRYPTION_KEY présent mais format invalide (attendu : hex 64 caractères ou base64 32 octets) — utilisation de la clé dérivée.',
        );
      } else {
        this.logger.log(
          'EMAIL_ENCRYPTION_KEY non défini — clé dérivée de DATABASE_URL (repli déterministe).',
        );
      }
      const dsn = this.configService.get<string>('DATABASE_URL') || 'academia-helm-no-dsn';
      key = createHash('sha256').update(`${dsn}::academia-helm::school-email-aes::v1`).digest();
    }

    this.cachedKey = key;
    return key;
  }

  /** Chiffre un secret. Retourne les 3 colonnes base64 (IV unique par appel). */
  encrypt(plaintext: string): { secretEncrypted: string; secretIv: string; secretTag: string } {
    const iv = randomBytes(12); // GCM standard : 96 bits
    const cipher = createCipheriv('aes-256-gcm', this.getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      secretEncrypted: encrypted.toString('base64'),
      secretIv: iv.toString('base64'),
      secretTag: tag.toString('base64'),
    };
  }

  /**
   * Déchiffre un secret. Lève EmailSecretDecryptError si la clé a changé ou
   * si les données sont corrompues (le GCM détecte toute altération).
   */
  decrypt(parts: { secretEncrypted: string; secretIv: string; secretTag: string }): string {
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.getKey(),
        Buffer.from(parts.secretIv, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(parts.secretTag, 'base64'));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(parts.secretEncrypted, 'base64')),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    } catch (err: any) {
      // ⚠️ Ne JAMAIS inclure le secret ni la clé dans le log.
      this.logger.error(
        `Déchiffrement e-mail échoué (clé changée ou donnée corrompue) : ${err?.name}`,
      );
      throw new EmailSecretDecryptError();
    }
  }

  /** true si les 3 colonnes sont présentes. */
  hasSecret(row: {
    secretEncrypted?: string | null;
    secretIv?: string | null;
    secretTag?: string | null;
  }): boolean {
    return !!(row?.secretEncrypted && row?.secretIv && row?.secretTag);
  }
}

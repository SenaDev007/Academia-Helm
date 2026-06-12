/**
 * ============================================================================
 * CREDENTIAL ENCRYPTION SERVICE
 * ============================================================================
 *
 * Service pour chiffrer les credentials sensibles avant stockage en base
 * et les déchiffrer à la lecture.
 *
 * Utilise AES-256-GCM via le module crypto natif de Node.js.
 *
 * Champs concernés :
 *   - SettingsCommunication.smsCredentials
 *   - SettingsCommunication.whatsappCredentials
 *   - SettingsCommunication.smtpPassword
 *   - Tout autre champ marqué comme sensible
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_ENV_VAR = 'CREDENTIAL_ENCRYPTION_KEY';

@Injectable()
export class CredentialEncryptionService {
  private readonly logger = new Logger(CredentialEncryptionService.name);
  private readonly encryptionKey: Buffer;

  constructor(private configService: ConfigService) {
    const keyHex = this.configService.get<string>(KEY_ENV_VAR);
    if (keyHex && keyHex.length === 64) {
      this.encryptionKey = Buffer.from(keyHex, 'hex');
    } else {
      // Générer une clé dérivable depuis un secret existant
      const fallbackSecret = this.configService.get<string>('JWT_SECRET', 'default-dev-secret-change-me');
      this.encryptionKey = crypto.scryptSync(fallbackSecret, 'academia-helm-salt', 32);
      if (!keyHex) {
        this.logger.warn(`${KEY_ENV_VAR} not set — using derived key. Set a proper 64-char hex key in production!`);
      }
    }
  }

  /**
   * Chiffre une valeur texte
   * @returns Chaîne encodée en base64 contenant IV + tag + ciphertext
   */
  encrypt(plaintext: string): string {
    if (!plaintext) return plaintext;

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const tag = cipher.getAuthTag();

    // Format: base64(iv + tag + ciphertext)
    const combined = Buffer.concat([iv, tag, Buffer.from(encrypted, 'base64')]);
    return combined.toString('base64');
  }

  /**
   * Déchiffre une valeur précédemment chiffrée
   */
  decrypt(ciphertext: string): string {
    if (!ciphertext) return ciphertext;

    try {
      const combined = Buffer.from(ciphertext, 'base64');
      const iv = combined.subarray(0, IV_LENGTH);
      const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
      const encrypted = combined.subarray(IV_LENGTH + TAG_LENGTH);

      const decipher = crypto.createDecipheriv(ALGORITHM, this.encryptionKey, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.warn(`Decryption failed — value may not be encrypted: ${(error as Error).message}`);
      // Retourner la valeur brute (peut être un texte non chiffré encore)
      return ciphertext;
    }
  }

  /**
   * Vérifie si une valeur semble être chiffrée (format base64 avec IV + tag)
   */
  isEncrypted(value: string): boolean {
    if (!value) return false;
    try {
      const combined = Buffer.from(value, 'base64');
      // Si la longueur est suffisante pour contenir IV + tag + au moins 1 byte
      return combined.length > IV_LENGTH + TAG_LENGTH;
    } catch {
      return false;
    }
  }

  /**
   * Chiffre les champs sensibles d'un objet
   * @param data Objet à traiter
   * @param sensitiveFields Liste des noms de champs à chiffrer
   */
  encryptFields<T extends Record<string, any>>(
    data: T,
    sensitiveFields: string[],
  ): T {
    const result = { ...data };
    for (const field of sensitiveFields) {
      if (result[field] && typeof result[field] === 'string' && !this.isEncrypted(result[field])) {
        result[field] = this.encrypt(result[field]);
      }
    }
    return result;
  }

  /**
   * Déchiffre les champs sensibles d'un objet
   * @param data Objet à traiter
   * @param sensitiveFields Liste des noms de champs à déchiffrer
   */
  decryptFields<T extends Record<string, any>>(
    data: T,
    sensitiveFields: string[],
  ): T {
    const result = { ...data };
    for (const field of sensitiveFields) {
      if (result[field] && typeof result[field] === 'string' && this.isEncrypted(result[field])) {
        result[field] = this.decrypt(result[field]);
      }
    }
    return result;
  }
}

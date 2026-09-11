/**
 * ============================================================================
 * TOTP SERVICE — RFC 6238 (Time-based One-Time Password)
 * ============================================================================
 *
 * ⭐ 2FA TOTP pour Helm Connect (exigence sécurité : « TOTP, pas de SMS
 *    (interceptable) ») :
 *      - generateSecret()   : secret base32 de 160 bits (20 octets)
 *      - verifyCode()       : vérification avec fenêtre ±1 période (±30 s)
 *      - generateBackupCodes() : 10 codes de secours à usage unique
 *      - otpauthUrl()       : URI otpauth:// pour Google Authenticator etc.
 *
 * Implémentation 100 % Node crypto (HMAC-SHA1) — AUCUNE dépendance externe
 * (pas de speakeasy/otplib à installer). Base32 maison (RFC 4648).
 *
 * Le QR code est généré par le package `qrcode` (déjà présent).
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as QRCode from 'qrcode';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const BASE32_LOOKUP: Record<string, number> = {};
for (let i = 0; i < BASE32_ALPHABET.length; i++) {
  BASE32_LOOKUP[BASE32_ALPHABET[i]] = i;
}

/** Période TOTP en secondes (standard 30 s). */
const PERIOD_SECONDS = 30;
/** Nombre de chiffres du code (standard 6). */
const CODE_DIGITS = 6;
/** Fenêtre de tolérance : ±1 période (code accepté de l'actuel à ±30 s). */
const VERIFICATION_WINDOW = 1;

@Injectable()
export class TotpService {
  private readonly logger = new Logger(TotpService.name);

  // ─── Base32 (RFC 4648) ────────────────────────────────────────────────────

  base32Encode(buffer: Buffer): string {
    let bits = 0;
    let value = 0;
    let output = '';
    for (const byte of buffer) {
      value = (value << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) {
      output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }
    return output;
  }

  base32Decode(encoded: string): Buffer {
    const clean = encoded.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];
    for (const char of clean) {
      const idx = BASE32_LOOKUP[char];
      if (idx === undefined) continue;
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }
    return Buffer.from(bytes);
  }

  // ─── Secret ───────────────────────────────────────────────────────────────

  /** Génère un secret TOTP de 160 bits, encodé base32 (32 caractères). */
  generateSecret(): string {
    const bytes = crypto.randomBytes(20);
    return this.base32Encode(bytes);
  }

  // ─── HOTP/TOTP (RFC 4226 / 6238) ─────────────────────────────────────────

  /** Code HOTP pour un compteur donné (RFC 4226). */
  private hotp(secret: Buffer, counter: number): string {
    const counterBuf = Buffer.alloc(8);
    counterBuf.writeBigUInt64BE(BigInt(counter));
    const hmac = crypto.createHmac('sha1', secret).update(counterBuf).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);
    const code = binary % 10 ** CODE_DIGITS;
    return code.toString().padStart(CODE_DIGITS, '0');
  }

  /** Compteur TOTP courant (nombre de périodes écoulées depuis l'epoch). */
  private currentCounter(at: number = Date.now()): number {
    return Math.floor(at / 1000 / PERIOD_SECONDS);
  }

  /**
   * Vérifie un code TOTP avec fenêtre de tolérance (±1 période).
   * @param secretBase32 secret base32 de l'utilisateur
   * @param code         code à 6 chiffres saisi
   */
  verifyCode(secretBase32: string, code: string): boolean {
    if (!secretBase32 || !code) return false;
    const normalized = code.replace(/\D/g, '');
    if (normalized.length !== CODE_DIGITS) return false;
    const secret = this.base32Decode(secretBase32);
    if (secret.length === 0) return false;
    const counter = this.currentCounter();
    // Fenêtre : code accepté pour la période précédente, courante ou suivante
    for (let offset = -VERIFICATION_WINDOW; offset <= VERIFICATION_WINDOW; offset++) {
      const expected = this.hotp(secret, counter + offset);
      // comparaison à temps constant
      if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(normalized))) {
        return true;
      }
    }
    return false;
  }

  // ─── Codes de secours ─────────────────────────────────────────────────────

  /** Génère 10 codes de secours (8 caractères hexadécimaux, format XXXX-XXXX).
   *
   * ⭐ FIX PERFORMANCE CONCURRENCE — bcrypt ASYNCHRONE :
   *    hashSync (coût 10 × ~100 ms SYNCHRONE) bloquait l'event loop Node
   *    pendant ~1 s — pendant ce temps, TOUTES les requêtes HTTP et TOUS
   *    les sockets du gateway étaient gelés ( symptôme « le site buguait »
   *    quand quelqu'un activait la 2FA). bcrypt.hash s'exécute dans le
   *    threadpool libuv → event loop libre.
   */
  async generateBackupCodes(count = 10): Promise<{ plain: string[]; hashed: string[] }> {
    const plain: string[] = [];
    for (let i = 0; i < count; i++) {
      const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
      const formatted = `${raw.slice(0, 4)}-${raw.slice(4)}`;
      plain.push(formatted);
    }
    const hashed: string[] = await Promise.all(
      plain.map((formatted) => bcrypt.hash(formatted, 10)),
    );
    return { plain, hashed };
  }

  /**
   * Vérifie un code de secours contre la liste des hachés — consomme le code
   * (retrouve l'index gagnant, l'appelant retire l'entrée du tableau JSON).
   * @returns l'index du code consommé, ou -1 si aucun ne correspond.
   *
   * ⭐ FIX PERFORMANCE CONCURRENCE — bcrypt.compare ASYNCHRONE (avant :
   *    compareSync × jusqu'à 10 codes ≈ 0,5-1 s D'EVENT LOOP BLOQUÉE).
   */
  async findBackupCodeIndex(hashedCodesJson: string | null, code: string): Promise<number> {
    if (!hashedCodesJson || !code) return -1;
    try {
      const hashed: string[] = JSON.parse(hashedCodesJson);
      const normalized = code.trim().toUpperCase();
      for (let i = 0; i < hashed.length; i++) {
        if (await bcrypt.compare(normalized, hashed[i])) return i;
      }
    } catch (e: any) {
      this.logger.warn(`backupCodes parse: ${e.message}`);
    }
    return -1;
  }

  // ─── URI otpauth + QR ─────────────────────────────────────────────────────

  /** URI otpauth://standard (compatible Google Authenticator, Authy, Aegis…). */
  otpauthUrl(secretBase32: string, account: string, issuer = 'Academia Helm'): string {
    const label = encodeURIComponent(`${issuer}:${account}`);
    const params = new URLSearchParams({
      secret: secretBase32,
      issuer,
      algorithm: 'SHA1',
      digits: String(CODE_DIGITS),
      period: String(PERIOD_SECONDS),
    });
    return `otpauth://totp/${label}?${params.toString()}`;
  }

  /** QR code en data-URL PNG (à afficher dans l'UI d'activation). */
  async qrDataUrl(otpauth: string): Promise<string> {
    return QRCode.toDataURL(otpauth, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 260,
      color: { dark: '#0A2A5Eff', light: '#FFFFFFFF' },
    });
  }
}

import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import type { DistinctionCode } from './types.js';

export interface VerificationPayload {
  schoolId: string;
  studentId: string;
  periodId: string;
  code: DistinctionCode;
  schoolYear: string;
  /** Nonce aléatoire (16 hex chars) — rend chaque émission unique même pour
   *  un même (studentId, periodId, code). Sans nonce, deux émissions du même
   *  type à la même période auraient le même code de vérification.
   *  Si non fourni, un nonce aléatoire est généré.
   */
  nonce?: string;
}

/**
 * Génère un nonce cryptographique aléatoire (16 hex chars = 8 octets).
 * Utilisé pour rendre chaque émission de distinction unique, même si l'élève
 * reçoit la même distinction (réémission) — chaque QR code sera différent.
 */
export function generateNonce(): string {
  return randomBytes(8).toString('hex');
}

/**
 * Code de vérification infalsifiable : HMAC-SHA256 tronqué, dérivé des données
 * de l'émission ET d'un nonce cryptographique unique.
 * Format : AH-YYYY-XXXX-XXXX-XXXX (24 caractères significatifs).
 *
 * Le nonce garantit que chaque émission (même pour le même élève, même période,
 * même type de distinction) produit un code QR DIFFÉRENT — et donc authentifiable
 * individuellement.
 */
export function makeVerificationCode(secret: string, p: VerificationPayload): string {
  const nonce = p.nonce || generateNonce();
  const mac = createHmac('sha256', secret)
    .update([p.schoolId, p.studentId, p.periodId, p.code, p.schoolYear, nonce].join('|'))
    .digest('hex')
    .slice(0, 12)
    .toUpperCase();
  const year = p.schoolYear.slice(0, 4);
  return `AH-${year}-${mac.slice(0, 4)}-${mac.slice(4, 8)}-${mac.slice(8, 12)}`;
}

/**
 * Variante qui retourne AUSSI le nonce utilisé (pour persistance en base).
 * À utiliser lors de l'émission d'un certificat pour récupérer le nonce et
 * le stocker dans DistinctionRecord.nonce.
 */
export function makeVerificationCodeWithNonce(secret: string, p: VerificationPayload): { code: string; nonce: string } {
  const nonce = p.nonce || generateNonce();
  const code = makeVerificationCode(secret, { ...p, nonce });
  return { code, nonce };
}

export function checkVerificationCode(secret: string, p: VerificationPayload, code: string): boolean {
  const expected = Buffer.from(makeVerificationCode(secret, p));
  const given = Buffer.from(code);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function verificationUrl(baseUrl: string, code: string): string {
  return `${baseUrl.replace(/\/$/, '')}/verifier/${encodeURIComponent(code)}`;
}

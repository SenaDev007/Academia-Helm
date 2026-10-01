import { createHmac, timingSafeEqual } from 'node:crypto';
import type { DistinctionCode } from './types.js';

export interface VerificationPayload {
  schoolId: string;
  studentId: string;
  periodId: string;
  code: DistinctionCode;
  schoolYear: string;
}

/**
 * Code de vérification infalsifiable : HMAC-SHA256 tronqué, dérivé des données de l'émission.
 * Stocke le code dans la table distinctions et expose une page publique /verifier/[code].
 */
export function makeVerificationCode(secret: string, p: VerificationPayload): string {
  const mac = createHmac('sha256', secret)
    .update([p.schoolId, p.studentId, p.periodId, p.code, p.schoolYear].join('|'))
    .digest('hex')
    .slice(0, 12)
    .toUpperCase();
  const year = p.schoolYear.slice(0, 4);
  return `AH-${year}-${mac.slice(0, 4)}-${mac.slice(4, 8)}-${mac.slice(8, 12)}`;
}

export function checkVerificationCode(secret: string, p: VerificationPayload, code: string): boolean {
  const expected = Buffer.from(makeVerificationCode(secret, p));
  const given = Buffer.from(code);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function verificationUrl(baseUrl: string, code: string): string {
  return `${baseUrl.replace(/\/$/, '')}/verifier/${encodeURIComponent(code)}`;
}

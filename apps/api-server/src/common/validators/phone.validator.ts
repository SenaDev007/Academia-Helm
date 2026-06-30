/**
 * ============================================================================
 * PHONE VALIDATION — Règle standard pour les numéros de téléphone (Bénin)
 * ============================================================================
 *
 * Format standard Bénin : +229 suivi de 10 chiffres.
 * Le numéro local fait 10 chiffres (depuis la transition 8→10 chiffres).
 *
 * Formats acceptés :
 *   +2290152030405  (préfixe + 10 chiffres)
 *   0152030405      (10 chiffres seuls)
 *   +229 01 52 03 04 05 (avec espaces — nettoyé avant validation)
 *
 * Formats REJETÉS :
 *   +22901520304    (8 chiffres — ancien format)
 *   01520304056     (11 chiffres — trop long)
 *   abc123           (non numérique)
 *
 * Usage dans un DTO :
 *   @IsOptional()
 *   @ValidBeninPhone()
 *   phone?: string;
 * ============================================================================
 */

import { Matches } from 'class-validator';

/**
 * Regex pour valider un numéro de téléphone béninois.
 * Accepte : +229XXXXXXXXXX ou XXXXXXXXXX (10 chiffres).
 * Les espaces/tirets sont nettoyés avant validation.
 */
export const BENIN_PHONE_REGEX = /^(\+229)?[0-9]{10}$/;

/**
 * Message d'erreur standard pour la validation de téléphone.
 */
export const BENIN_PHONE_MESSAGE =
  'Le numéro de téléphone doit contenir 10 chiffres (format Bénin). Ex: +229 01 52 03 04 05';

/**
 * Décorateur réutilisable pour valider un champ téléphone au format béninois.
 *
 * Usage :
 *   @IsOptional()
 *   @ValidBeninPhone()
 *   phone?: string;
 */
export function ValidBeninPhone() {
  return Matches(BENIN_PHONE_REGEX, { message: BENIN_PHONE_MESSAGE });
}

/**
 * Nettoie une valeur téléphone (retire espaces, tirets, points).
 * Utile côté backend avant validation ou stockage.
 */
export function sanitizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/[\s\-.()]/g, '');
}

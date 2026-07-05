/**
 * ============================================================================
 * PHONE NUMBER UTILITIES
 * ============================================================================
 *
 * Normalisation et formatage des numéros de téléphone pour :
 * - Stockage E.164 (+229XXXXXXXX)
 * - Envoi via providers (Gupshup, Twilio, Infobip...)
 *
 * Spécificité Bénin : les numéros MTN/Moov ont historiquement 8 chiffres
 * après +229, mais le format local inclut souvent un "01" en préfixe
 * (ex: 01 97 12 34 56). WhatsApp Bénin requiert le format court
 * (+229XXXXXXXX, sans "01").
 *
 * ============================================================================
 */

/**
 * Normalise un numéro de téléphone au format E.164 international.
 *
 * Gère plusieurs formats d'entrée courants :
 *   - Format local Bénin : "01 97 12 34 56" → "+22997123456"
 *   - Format international avec "01" : "+2290197123456" → "+22997123456"
 *   - Format international standard : "22997123456" → "+22997123456"
 *   - Numéro étranger : "+33612345678" → "+33612345678"
 *
 * @param phone - Le numéro à normaliser
 * @param opts.stripBenin01 - Si true (défaut), supprime le "01" après +229 pour le Bénin
 * @returns Numéro au format E.164 ou chaîne vide si invalide
 */
export function normalizePhoneE164(
  phone: string,
  opts: { stripBenin01?: boolean } = {},
): string {
  if (!phone) return '';
  // Default: do NOT strip 01 — Twilio expects +2290195722234 (with 01 prefix)
  // Gupshup WhatsApp also works with this format
  const stripBenin01 = opts.stripBenin01 === true; // default: false (keep 01)

  // Nettoyage : supprimer espaces, tirets, points, parenthèses
  let normalized = phone.replace(/[\s\-().]/g, '').trim();

  // Cas 1 : numéro local Bénin commençant par "01" (sans indicatif +229)
  // Ex: "0195722234" → "+2290195722234" (garde le 01 pour Twilio)
  if (/^01\d{8}$/.test(normalized)) {
    return '+229' + normalized; // +2290195722234
  }

  // Cas 2 : numéro local Bénin à 8 chiffres (sans "01" ni +229)
  // Ex: "95722234" → "+22995722234"
  if (/^\d{8}$/.test(normalized) && !normalized.startsWith('00')) {
    return '+229' + normalized;
  }

  // Ajouter le + si manquant
  if (!normalized.startsWith('+')) {
    if (normalized.startsWith('00')) {
      normalized = '+' + normalized.substring(2);
    } else {
      normalized = '+' + normalized;
    }
  }

  // Conserver uniquement les chiffres après le +
  normalized =
    '+' +
    normalized
      .replace(/^\+/, '')
      .replace(/[^\d]/g, '');

  // Cas 3 : si stripBenin01 est explicitement demandé, stripper le 01
  // (+22901XXXXXXXX → +229XXXXXXXX) — utile pour Gupshup qui peut préférer 8 digits
  if (stripBenin01 && normalized.startsWith('+22901')) {
    normalized = '+229' + normalized.substring(6);
  }

  return normalized;
}

/**
 * Convertit un numéro E.164 au format attendu par l'API Gupshup.
 * Gupshup n'accepte PAS le préfixe "+" — juste le country code + numéro.
 *
 * @param phoneE164 - Numéro au format E.164 (ex: "+22997123456")
 * @returns Numéro sans "+" (ex: "22997123456")
 *
 * @example
 * toGupshupDestination('+22997123456')  // → '22997123456'
 * toGupshupDestination('+33612345678')  // → '33612345678'
 */
export function toGupshupDestination(phoneE164: string): string {
  if (!phoneE164) return '';
  return phoneE164.replace(/^\+/, '');
}

/**
 * Valide qu'un numéro E.164 a une longueur plausible.
 * Tous les numéros internationaux ont entre 7 et 15 chiffres (recommandation ITU).
 *
 * @param phoneE164 - Numéro au format E.164
 * @returns true si valide
 */
export function isValidPhoneE164(phoneE164: string): boolean {
  if (!phoneE164) return false;
  if (!phoneE164.startsWith('+')) return false;
  const digits = phoneE164.substring(1);
  if (!/^\d+$/.test(digits)) return false;
  return digits.length >= 7 && digits.length <= 15;
}

/**
 * Détecte si un numéro est un numéro béninois.
 *
 * @param phoneE164 - Numéro au format E.164
 * @returns true si numéro béninois (+229)
 */
export function isBeninPhone(phoneE164: string): boolean {
  return !!phoneE164 && phoneE164.startsWith('+229');
}

/**
 * Génère les variantes d'un numéro béninois pour recherche en DB.
 * Utile pour la rétrocompatibilité (anciens numéros stockés avec "01").
 *
 * @param phoneE164 - Numéro normalisé au format E.164
 * @returns Tableau de variantes à rechercher
 *
 * @example
 * getBeninPhoneVariants('+22997123456')
 * // → ['+22997123456', '+2290197123456']
 */
export function getBeninPhoneVariants(phoneE164: string): string[] {
  if (!phoneE164) return [];
  if (!isBeninPhone(phoneE164)) return [phoneE164];

  const variants = [phoneE164];
  // Si le numéro est sans "01" (8 digits après +229), ajouter la variante avec "01"
  const digits = phoneE164.substring(4); // 4 = '+229'.length
  if (digits.length === 8 && !digits.startsWith('01')) {
    variants.push('+22901' + digits);
  }
  return variants;
}

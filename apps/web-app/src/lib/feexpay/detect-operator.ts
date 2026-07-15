/**
 * ============================================================================
 * FEEXPAY — Utilitaires frontend (détection opérateur Mobile Money)
 * ============================================================================
 *
 * Duplique la logique de détection d'opérateur FeexPay côté frontend.
 * Ne peut pas importer directement le FeexPayService du backend NestJS
 * (séparation client/serveur).
 *
 * Bénin :
 *   - MTN : 0154, 0155, 0156, 0157, 0158, 0159, 0161, 0162, 0163, 0164, 0166, 0167, 0196, 0197
 *   - Moov : 0151, 0152, 0153, 0160, 0165, 0168, 0169, 0190, 0191, 0192, 0193, 0194, 0195, 0198, 0199
 *   - Celtiis : 0140, 0141, 0142, 0143, 0144
 * ============================================================================
 */

export type FeexPayOperator = 'mtn' | 'moov' | 'celtiis_bj';

const MTN_PREFIXES = ['54', '55', '56', '57', '58', '59', '61', '62', '63', '64', '66', '67', '96', '97'];
const MOOV_PREFIXES = ['51', '52', '53', '60', '65', '68', '69', '90', '91', '92', '93', '94', '95', '98', '99'];
const CELTIIS_PREFIXES = ['40', '41', '42', '43', '44'];

/**
 * Détecte l'opérateur Mobile Money béninois à partir d'un numéro de téléphone.
 *
 * Formats acceptés :
 *   - 0195722234        (10 chiffres)
 *   - 2290195722234     (13 chiffres)
 *   - +2290195722234    (14 caractères)
 *
 * @returns L'opérateur détecté, ou null si non reconnu
 */
export function detectFeexPayOperator(phone: string): FeexPayOperator | null {
  let cleaned = phone.replace(/[\s\-().]/g, '').trim();
  let prefix = '';

  if (cleaned.startsWith('+22901') && cleaned.length >= 8) {
    prefix = cleaned.substring(6, 9);
  } else if (cleaned.startsWith('22901') && cleaned.length >= 7) {
    prefix = cleaned.substring(4, 7);
  } else if (cleaned.startsWith('01') && cleaned.length >= 5) {
    prefix = cleaned.substring(2, 5);
  } else {
    return null;
  }

  const twoDigitPrefix = prefix.substring(0, 2);

  if (MTN_PREFIXES.includes(twoDigitPrefix)) return 'mtn';
  if (MOOV_PREFIXES.includes(twoDigitPrefix)) return 'moov';
  if (CELTIIS_PREFIXES.includes(twoDigitPrefix)) return 'celtiis_bj';
  return null;
}

/**
 * Valide un numéro de téléphone Mobile Money béninois.
 *
 * Formats acceptés :
 *   - 01XXXXXXXX (10 chiffres, commence par 01)
 *   - 22901XXXXXXXX (13 chiffres)
 *   - +22901XXXXXXXX
 */
export function isValidBeninPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-()+]/g, '');
  return /^(01\d{8}|22901\d{8})$/.test(cleaned);
}

/**
 * Formate un numéro pour l'affichage : 01 95 72 22 34
 */
export function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  if (digits.length <= 6) return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6)}`;
  return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;
}

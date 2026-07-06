/**
 * ============================================================================
 * NOMMAGE PROFESSIONNEL DES FICHIERS — PDF et Excel
 * ============================================================================
 *
 * Convention de nommage :
 *   {Type document}_{Nom élève/caisse}_{Date}.pdf
 *
 * Exemples :
 *   Reçu de paiement_AKPOVI Tohou Béroukhyah_2026-07-06.pdf
 *   Encaissements_AKPOVI Tohou Béroukhyah_2026-07-06.pdf
 *   Comptes élèves_2026-07-06.xlsx
 *   Caisse ACCUEIL_2026-07-06.pdf
 *   Multi-caisses global_2026-07-06.xlsx
 *   Historique paiements_AKPOVI Tohou Béroukhyah_2026-07-06.pdf
 * ============================================================================
 */

/**
 * Formate une date au format ISO court : 2026-07-06
 */
function formatDateForFilename(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Nettoie un nom pour l'utiliser dans un nom de fichier :
 * - Remplace les accents
 * - Remplace les caractères interdits (/ \ : * ? " < > |)
 * - Limite la longueur
 */
function sanitizeName(name: string, maxLength: number = 50): string {
  if (!name) return 'Sans nom';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
    .replace(/[/\\:*?"<>|]/g, '-')    // Caractères interdits → tiret
    .replace(/\s+/g, ' ')              // Espaces multiples → un seul
    .trim()
    .substring(0, maxLength);
}

/**
 * Génère un nom de fichier professionnel pour un reçu de paiement.
 * Format : Reçu de paiement_{Nom élève}_{Date}.pdf
 */
export function receiptFilename(studentName: string, receiptNumber?: string, ext: 'pdf' | 'xlsx' = 'pdf'): string {
  const name = sanitizeName(studentName);
  const date = formatDateForFilename();
  const ref = receiptNumber ? `_${sanitizeName(receiptNumber, 20)}` : '';
  return `Recu de paiement_${name}${ref}_${date}.${ext}`;
}

/**
 * Génère un nom de fichier pour les encaissements.
 * Format : Encaissements_{Période}_{Date}.xlsx
 */
export function transactionsFilename(dateFrom?: string, dateTo?: string, ext: 'pdf' | 'xlsx' = 'xlsx'): string {
  const date = formatDateForFilename();
  const period = dateFrom && dateTo
    ? `${sanitizeName(dateFrom, 10)}_a_${sanitizeName(dateTo, 10)}`
    : 'toute periode';
  return `Encaissements_${period}_${date}.${ext}`;
}

/**
 * Génère un nom de fichier pour les comptes élèves.
 * Format : Comptes eleves_{Classe}_{Date}.xlsx
 */
export function studentAccountsFilename(classFilter?: string, ext: 'pdf' | 'xlsx' = 'xlsx'): string {
  const date = formatDateForFilename();
  const cls = classFilter ? `_${sanitizeName(classFilter, 30)}` : '';
  return `Comptes eleves${cls}_${date}.${ext}`;
}

/**
 * Génère un nom de fichier pour l'historique d'un élève.
 * Format : Historique paiements_{Nom élève}_{Date}.pdf
 */
export function studentHistoryFilename(studentName: string, ext: 'pdf' | 'xlsx' = 'pdf'): string {
  const name = sanitizeName(studentName);
  const date = formatDateForFilename();
  return `Historique paiements_${name}_${date}.${ext}`;
}

/**
 * Génère un nom de fichier pour une caisse spécifique.
 * Format : Caisse {Code} - {Nom}_{Date}.pdf
 */
export function cashRegisterFilename(registerCode: string, registerName: string, ext: 'pdf' | 'xlsx' = 'pdf'): string {
  const code = sanitizeName(registerCode, 20);
  const name = sanitizeName(registerName, 30);
  const date = formatDateForFilename();
  return `Caisse ${code} - ${name}_${date}.${ext}`;
}

/**
 * Génère un nom de fichier pour la vue globale multi-caisses.
 * Format : Multi-caisses global_{Date}.xlsx
 */
export function allCashRegistersFilename(ext: 'pdf' | 'xlsx' = 'xlsx'): string {
  const date = formatDateForFilename();
  return `Multi-caisses global_${date}.${ext}`;
}

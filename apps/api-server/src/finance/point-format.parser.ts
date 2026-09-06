/**
 * ============================================================================
 * POINT FORMAT PARSER — Parser pur pour les fichiers "POINT" des écoles
 * ============================================================================
 *
 * Les écoles béninoises tiennent leur suivi des encaissements dans des
 * fichiers Excel "POINT" (ex: "POINT PRIMAIRE 2025-2026.xlsx") dont la
 * structure est un standard de fait :
 *
 *   - Une feuille par classe (nom de la feuille = nom de la classe,
 *     ex: "Maternelle 1", "CP A", "CM2 B") + éventuellement une feuille RECAP.
 *   - Ligne 3 : "ANNEE SCOLAIRE 2025 - 2026" + "Scolarité" (frais annuels
 *     attendus pour la classe, ex: 50000).
 *   - Lignes 4-5 : en-têtes fusionnés :
 *       A: N°            B: Noms et Prénoms   C: Arriéré (ou texte ABD/FONDE/
 *                          école d'origine)    D: Tél
 *       E: Inscript      F: Unif              G: Tenue de Sport
 *       H: Total frais Généraux               I-N: Scolarité → P1..P6
 *       O: Total Scolarité (payée)            P: Reste
 *       Q: Total des payements
 *   - Données à partir de la ligne 6, une ligne par élève.
 *   - Fin de tableau : ligne "TOTAL" (sommes par colonne).
 *   - Colonne R : notes libres ("ABD", "FE", "Enft Fondé"...).
 *
 * Ce module contient UNIQUEMENT des fonctions pures (aucune dépendance
 * NestJS/Prisma) afin d'être :
 *   1. réutilisable par CollectionSummaryImportService ;
 *   2. testable isolément sur des fichiers réels (scripts de validation).
 *
 * Deux formats sont reconnus par auto-détection :
 *   - POINT  : structure école décrite ci-dessus ;
 *   - SIMPLE : template plat généré par Academia Helm
 *              (Noms | Arriéré | Inscription | Tranches 1-6 | Total, en-tête
 *              ligne 1) — rétrocompatible avec l'existant.
 * ============================================================================
 */
import * as ExcelJS from 'exceljs';

// ─── Types publics ───────────────────────────────────────────────────────────

export type SheetFormat = 'POINT' | 'SIMPLE' | 'UNKNOWN';

/** Colonnes résolues du format POINT (1-based, comme ExcelJS) */
export interface PointColumnMap {
  numero: number;
  name: number;
  arrear: number;
  phone: number;
  inscription: number;
  unif: number;
  tenue: number;
  fraisGeneraux: number;
  /** Colonnes des tranches P1..P6 (résolues depuis la ligne P1) */
  tranches: number[];
  scolariteTotal: number;
  reste: number;
  totalPayments: number;
  notes: number;
}

export interface SheetDetection {
  format: SheetFormat;
  /** Ligne contenant "Noms et Prénoms" (en-tête principal) */
  headerRow?: number;
  /** Ligne contenant P1..P6 (sous-en-tête des tranches) */
  trancheRow?: number;
  /** Première ligne de données */
  dataStartRow?: number;
  columns?: PointColumnMap;
}

export interface PointParsedRow {
  rowIndex: number;
  sheetName: string;
  studentName: string;
  /** Valeur NUMÉRIQUE de la colonne Arriéré (texte → 0 + arrearNote) */
  arrear: number;
  /** Texte trouvé dans la colonne Arriéré (ex: "ABD", "FONDE", "DAROU SALAM") */
  arrearNote?: string;
  phone?: string;
  inscription: number;
  unif: number;
  tenue: number;
  /** P1..P6 */
  tranches: number[];
  /** Inscription + Unif + Tenue de Sport (équivalent colonne H) */
  fraisGeneraux: number;
  /** Somme des tranches payées (équivalent colonne O) */
  scolaritePayee: number;
  /** Reste à payer (colonne P, informatif) */
  reste: number;
  /** Total encaissé = fraisGeneraux + scolaritePayee (équivalent colonne Q) */
  total: number;
  notes: string[];
}

export interface PointSheetResult {
  sheetName: string;
  rows: PointParsedRow[];
  /** "2025 - 2026" lu dans la zone d'en-tête (si présent) */
  yearLabel?: string;
  /** Frais annuels de scolarité de la classe (cellule à droite de "Scolarité") */
  classFee?: number;
}

export interface SimpleParsedRow {
  rowIndex: number;
  sheetName: string;
  studentName: string;
  arrear: number;
  inscription: number;
  tranches: number[];
  total: number;
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const MAX_SCAN_ROWS = 12;
const MAX_SCAN_COLS = 30;
const DEFAULT_POINT_COLUMNS: PointColumnMap = {
  numero: 1,
  name: 2,
  arrear: 3,
  phone: 4,
  inscription: 5,
  unif: 6,
  tenue: 7,
  fraisGeneraux: 8,
  tranches: [9, 10, 11, 12, 13, 14],
  scolariteTotal: 15,
  reste: 16,
  totalPayments: 17,
  notes: 18,
};

// ─── Utilitaires bas niveau ─────────────────────────────────────────────────

/**
 * Normalisation de texte pour comparaison d'étiquettes :
 * minuscules, sans accents, sans ponctuation, espaces compressés.
 */
export function normLabel(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extraction stricte du texte d'une cellule (gère formules/richText).
 */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj.result !== undefined && obj.result !== null) return cellText(obj.result);
    if (obj.text !== undefined) return String(obj.text).trim();
    if (Array.isArray(obj.richText)) {
      return (obj.richText as Array<{ text?: string }>)
        .map((t) => t.text || '')
        .join('')
        .trim();
    }
  }
  return String(value).trim();
}

/**
 * Parse MONTANT STRICT (format POINT) :
 *   - nombre → montant ;
 *   - chaîne purement numérique ("5000", "5 000", "5.000", "5,000") → montant ;
 *   - tout autre texte ("ABD", "FONDE", "DAROU SALAM", "2025 - 2026") → 0
 *     avec le texte retourné pour information.
 * Retourne également un flag isText pour distinguer "vide" de "texte".
 */
export function parseAmountStrict(value: unknown): { amount: number; text?: string } {
  if (value === null || value === undefined) return { amount: 0 };
  if (typeof value === 'number') {
    return Number.isFinite(value) ? { amount: value } : { amount: 0 };
  }
  let s: string;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj.result !== undefined && obj.result !== null) {
      return parseAmountStrict(obj.result);
    }
    s = cellText(value);
  } else {
    s = String(value).trim();
  }
  if (!s) return { amount: 0 };
  const compact = s.replace(/\s/g, '').replace(/\u00A0/g, '');
  if (/^[+-]?\d+([.,]\d+)?$/.test(compact)) {
    return { amount: Number(compact.replace(',', '.')) };
  }
  return { amount: 0, text: s };
}

/**
 * Parse montant TOLÉRANT (format SIMPLE — comportement historique) :
 * extrait les chiffres d'une chaîne quelconque ("5000 FCFA" → 5000).
 */
export function parseAmountLenient(value: unknown): number {
  const s = cellText(value);
  if (!s) return 0;
  const cleaned = s.replace(/[^\d.-]/g, '');
  return cleaned ? Number(cleaned) || 0 : 0;
}

// ─── Détection du format d'une feuille ──────────────────────────────────────

/**
 * Détecte le format d'une feuille :
 *   POINT   — en-tête "Noms et Prénoms" (ligne ≥ 2) + sous-ligne P1..P6 ;
 *   SIMPLE  — en-tête "Noms et Prénoms" en ligne 1 (template Academia) ;
 *   UNKNOWN — pas d'en-tête reconnaissable (feuille RECAP, notes, etc.).
 */
export function detectSheetFormat(ws: ExcelJS.Worksheet): SheetDetection {
  const maxRow = Math.min(MAX_SCAN_ROWS, ws.rowCount || MAX_SCAN_ROWS);
  let found: { row: number; col: number } | null = null;

  // 1. Chercher la cellule "Noms et Prénoms" (ou "Noms") dans la zone d'en-tête
  for (let r = 1; r <= maxRow && !found; r++) {
    for (let c = 1; c <= MAX_SCAN_COLS; c++) {
      const t = normLabel(cellText(ws.getRow(r).getCell(c).value));
      if (t.startsWith('noms et prenoms') || t === 'noms' || t.startsWith('noms et prenoms ')) {
        found = { row: r, col: c };
        break;
      }
    }
  }

  if (!found) {
    return { format: 'UNKNOWN' };
  }

  // 2. Chercher la ligne P1..P6 juste sous l'en-tête (POINTS : en-têtes fusionnés sur 2 lignes)
  const tranche = findTrancheRow(ws, found.row, found.row + 3);
  if (tranche) {
    return {
      format: 'POINT',
      headerRow: found.row,
      trancheRow: tranche.row,
      dataStartRow: tranche.row + 1,
      columns: resolvePointColumns(ws, found.row, tranche.row, tranche.cols),
    };
  }

  // 3. En-tête en ligne 1 sans sous-ligne P1 → template SIMPLE
  if (found.row === 1) {
    return { format: 'SIMPLE', headerRow: 1, dataStartRow: 2 };
  }

  // 4. En-tête "Noms" plus bas sans P1 → probablement un POINT sans tranches
  //    lisibles : on applique les colonnes par défaut du format POINT.
  return {
    format: 'POINT',
    headerRow: found.row,
    dataStartRow: found.row + 1,
    columns: { ...DEFAULT_POINT_COLUMNS },
  };
}

/** Trouve la ligne P1..P6 contiguës dans une plage de lignes donnée. */
function findTrancheRow(
  ws: ExcelJS.Worksheet,
  fromRow: number,
  toRow: number,
): { row: number; cols: number[] } | null {
  const maxRow = Math.min(toRow, ws.rowCount || toRow);
  for (let r = fromRow; r <= maxRow; r++) {
    for (let c = 1; c <= MAX_SCAN_COLS; c++) {
      const t = normLabel(cellText(ws.getRow(r).getCell(c).value));
      if (t === 'p1') {
        // Vérifier la contiguïté P1..P6 (tolérer P1..P3 seulement)
        const cols: number[] = [c];
        let ok = true;
        for (let i = 1; i < 6; i++) {
          const next = normLabel(cellText(ws.getRow(r).getCell(c + i).value));
          if (next === `p${i + 1}`) {
            cols.push(c + i);
          } else {
            break;
          }
        }
        if (ok && cols.length >= 1) {
          return { row: r, cols };
        }
      }
    }
  }
  return null;
}

/**
 * Résout les colonnes du format POINT depuis la ligne d'en-tête.
 * Les tranches viennent TOUJOURS de la ligne P1 (la colonne "Scolarité"
 * fusionnée peut porter un libellé variable : "Scolarite", "ZOU", nom du
 * maître, etc. — on ne peut pas s'y fier).
 */
function resolvePointColumns(
  ws: ExcelJS.Worksheet,
  headerRow: number,
  _trancheRow: number,
  trancheCols: number[],
): PointColumnMap {
  const map: PointColumnMap = {
    ...DEFAULT_POINT_COLUMNS,
    tranches: trancheCols.length > 0 ? trancheCols : DEFAULT_POINT_COLUMNS.tranches,
  };
  // Valeurs par défaut si une étiquette manque
  let foundName = false;

  for (let c = 1; c <= MAX_SCAN_COLS; c++) {
    const t = normLabel(cellText(ws.getRow(headerRow).getCell(c).value));
    if (!t) continue;

    if (t.startsWith('noms')) {
      map.name = c;
      foundName = true;
    } else if (t.startsWith('arrier')) {
      map.arrear = c;
    } else if (t === 'tel' || t.startsWith('telephon') || t.startsWith('telephone')) {
      map.phone = c;
    } else if (t.startsWith('inscript')) {
      map.inscription = c;
    } else if (t === 'unif' || t.startsWith('uniform')) {
      map.unif = c;
    } else if (t.startsWith('tenue')) {
      map.tenue = c;
    } else if (t.startsWith('total frais')) {
      map.fraisGeneraux = c;
    } else if (t.startsWith('total scolarit')) {
      map.scolariteTotal = c;
    } else if (t === 'reste' || t.startsWith('reste')) {
      map.reste = c;
    } else if (t.startsWith('total des pay') || t.startsWith('total des paiement') || t.startsWith('total paiement') || t.startsWith('total payement')) {
      map.totalPayments = c;
    } else if (t === 'n' || t === 'no' || t.startsWith('num')) {
      map.numero = c;
    }
  }

  // Si "Noms" n'est pas à la position attendue mais que la détection l'a
  // trouvée ailleurs, la valeur par défaut reste pertinente.
  if (!foundName) {
    // name = colonne où "Noms et Prénoms" a été détecté — géré par l'appelant
    // via detectSheetFormat (found.col) ; en pratique les fichiers réels
    // respectent B. On conserve la valeur détectée passée en défaut.
  }
  return map;
}

// ─── Détection année scolaire + frais de classe (zone d'en-tête) ───────────

/**
 * Extrait de la zone d'en-tête (lignes 1..dataStartRow-1) :
 *   - l'étiquette d'année scolaire ("2025 - 2026") ;
 *   - les frais annuels de scolarité de la classe (nombre à droite d'une
 *     étiquette "Scolarité" isolée, ex: ligne 3).
 */
export function detectYearAndFee(
  ws: ExcelJS.Worksheet,
  upToRow: number,
): { yearLabel?: string; classFee?: number } {
  let yearLabel: string | undefined;
  let classFee: number | undefined;
  const maxRow = Math.min(upToRow, ws.rowCount || upToRow);

  for (let r = 1; r < maxRow; r++) {
    for (let c = 1; c <= MAX_SCAN_COLS; c++) {
      const t = normLabel(cellText(ws.getRow(r).getCell(c).value));
      if (!t) continue;

      // "ANNEE SCOLAIRE ..." → chercher l'étiquette d'année à droite
      if (!yearLabel && t.startsWith('annee scolaire')) {
        for (let c2 = c + 1; c2 <= Math.min(c + 5, MAX_SCAN_COLS); c2++) {
          const v = cellText(ws.getRow(r).getCell(c2).value);
          if (/\d{4}/.test(v)) {
            yearLabel = v;
            break;
          }
        }
      }

      // "Scolarité" isolée (pas "Total Scolarité") → frais de classe à droite
      if (classFee === undefined && (t === 'scolarite' || t === 'scolarites')) {
        for (let c2 = c + 1; c2 <= Math.min(c + 3, MAX_SCAN_COLS); c2++) {
          const { amount } = parseAmountStrict(ws.getRow(r).getCell(c2).value);
          if (amount > 0) {
            classFee = amount;
            break;
          }
        }
      }
    }
  }
  return { yearLabel, classFee };
}

// ─── Parsing format POINT ───────────────────────────────────────────────────

/**
 * Parse une feuille au format POINT (une feuille = une classe).
 * Retourne les lignes élèves (jusqu'à la ligne TOTAL incluse exclue),
 * l'année scolaire détectée et les frais de classe.
 */
export function parsePointSheet(
  ws: ExcelJS.Worksheet,
  sheetName: string,
  detection: SheetDetection,
): PointSheetResult {
  const cols = detection.columns || DEFAULT_POINT_COLUMNS;
  const dataStart = detection.dataStartRow || 6;
  const rows: PointParsedRow[] = [];
  const maxRow = ws.rowCount || dataStart;

  for (let r = dataStart; r <= maxRow; r++) {
    const row = ws.getRow(r);
    const name = cellText(row.getCell(cols.name).value);

    // Ligne sans nom (ex: ligne 15 de Maternelle 1 — juste un N°) → ignorée
    if (!name) continue;
    // Ligne TOTAL → fin du tableau
    if (/^total/.test(normLabel(name))) break;
    // Lignes d'instructions éventuelles
    if (/^[⚠️📅💰✅📊🧑📋💡🏫🔄📝]/.test(name)) continue;

    // ── Montants (parse STRICT : le texte est conservé comme note) ──
    const inscription = parseAmountStrict(row.getCell(cols.inscription).value).amount;
    const unif = parseAmountStrict(row.getCell(cols.unif).value).amount;
    const tenue = parseAmountStrict(row.getCell(cols.tenue).value).amount;

    const tranches: number[] = [];
    const trancheTexts: string[] = [];
    for (const c of cols.tranches) {
      const { amount, text } = parseAmountStrict(row.getCell(c).value);
      tranches.push(amount);
      if (text) trancheTexts.push(`P${tranches.length}: ${text}`);
    }

    const arrearCell = parseAmountStrict(row.getCell(cols.arrear).value);
    const arrear = arrearCell.amount;
    const arrearNote = arrearCell.text; // "ABD", "FONDE", "DAROU SALAM"...

    const phone = cellText(row.getCell(cols.phone).value) || undefined;
    const reste = parseAmountStrict(row.getCell(cols.reste).value).amount;
    const totalCell = parseAmountStrict(row.getCell(cols.totalPayments).value);

    // Notes libres (colonne R + textes trouvés dans les tranches)
    const notes: string[] = [];
    const freeNote = cellText(row.getCell(cols.notes).value);
    if (freeNote) notes.push(freeNote);
    notes.push(...trancheTexts);

    const fraisGeneraux = inscription + unif + tenue;
    const scolaritePayee = tranches.reduce((s, v) => s + v, 0);
    const computedTotal = fraisGeneraux + scolaritePayee;
    // Le total fait foi s'il est numérique, sinon on le recalcule.
    // ⚠️ La colonne Arriéré (année antérieure) n'est JAMAIS incluse dans le
    // total encaissé — elle relève de l'import des arriérés.
    const total = totalCell.amount > 0 ? totalCell.amount : computedTotal;

    rows.push({
      rowIndex: r,
      sheetName,
      studentName: name,
      arrear,
      arrearNote,
      phone: phone && !/^\d+[\s.-]*$/.test(phone) && phone.length <= 40 ? phone : undefined,
      inscription,
      unif,
      tenue,
      tranches,
      fraisGeneraux,
      scolaritePayee,
      reste,
      total,
      notes,
    });
  }

  const { yearLabel, classFee } = detectYearAndFee(ws, dataStart);
  return { sheetName, rows, yearLabel, classFee };
}

// ─── Parsing format SIMPLE (template Academia — rétrocompatible) ────────────

/**
 * Parse une feuille au format SIMPLE :
 *   col 1 = Noms et Prénoms | col 2 = Arriéré | col 3 = Inscription |
 *   cols 4-9 = Tranches 1-6 | col 10 = Total
 * Comportement identique à l'implémentation historique (tolérant).
 */
export function parseSimpleSheet(
  ws: ExcelJS.Worksheet,
  sheetName: string,
  detection: SheetDetection,
): SimpleParsedRow[] {
  const dataStart = detection.dataStartRow || 2;
  const rows: SimpleParsedRow[] = [];
  const maxRow = ws.rowCount || dataStart;

  for (let r = dataStart; r <= maxRow; r++) {
    const row = ws.getRow(r);
    const firstCell = row.getCell(1).value;
    const firstStr = cellText(firstCell);
    if (!firstStr) continue;
    // Skip en-têtes et instructions (règles historiques)
    if (firstStr === 'Noms et Prénoms' || firstStr === 'Noms et Prenoms') continue;
    if (/^[⚠️📅💰✅📊🧑📋💡🏫🔄📝]/.test(firstStr)) continue;
    if (normLabel(firstStr).includes('total')) continue;

    const tranches: number[] = [];
    for (let i = 0; i < 6; i++) {
      tranches.push(parseAmountLenient(row.getCell(4 + i).value));
    }
    const arrear = parseAmountLenient(row.getCell(2).value);
    const inscription = parseAmountLenient(row.getCell(3).value);
    const totalFromCell = parseAmountLenient(row.getCell(10).value);
    const computedTotal = arrear + inscription + tranches.reduce((s, v) => s + v, 0);

    rows.push({
      rowIndex: r,
      sheetName,
      studentName: firstStr,
      arrear,
      inscription,
      tranches,
      total: totalFromCell > 0 ? totalFromCell : computedTotal,
    });
  }
  return rows;
}

// ─── Comparaison d'étiquettes d'année scolaire ──────────────────────────────

/**
 * Extrait le motif "2025 - 2026" (ou "2025-2026", "2025/2026") d'une étiquette.
 * Retourne une forme canonique "2025-2026" insensible aux séparateurs/espaces.
 */
export function canonicalYearLabel(label: string): string | null {
  if (!label) return null;
  const m = label.match(/(\d{4})\s*[-–—/]\s*(\d{4})/);
  if (m) return `${m[1]}-${m[2]}`;
  const single = label.match(/(\d{4})/);
  return single ? single[1] : null;
}

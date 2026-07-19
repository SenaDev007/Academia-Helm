/**
 * SaisieMaster — Parser Excel EducMaster
 *
 * Lit un template .xlsx téléchargé depuis EducMaster et en extrait:
 * - Le nom de la feuille (= classe)
 * - La liste des élèves (Matricule, Nom, Prénoms)
 * - La liste des matières + sous-colonnes (Note obtenue / Note perfectionnement)
 *
 * Format EducMaster détecté:
 * - Ligne 1: en-têtes de matières (cellules fusionnées horizontalement sur 2 colonnes
 *   quand la matière a Note obtenue + Note perfectionnement, sur 1 colonne fusionnée
 *   verticalement sur 2 lignes quand la matière a seulement Note obtenue /20).
 * - Colonnes A, B, C: Matricule, Nom, Prénoms (fusionnées verticalement sur 2 lignes).
 * - Ligne 2: sous-en-têtes "Note obtenue" et/ou "Note perfectionnement".
 * - Lignes 3+: données des élèves.
 */

import * as XLSX from "xlsx";
import type { ClassData, Note, Student, Subject } from "./types";
import {
  CLASS_NAME_REGEX,
  FILENAME_PATTERNS,
} from "./constants";

/** Slug court et sûr pour usage comme ID. */
function slugify(input: string, fallback: string): string {
  const slug = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

/** Génère un ID court et unique. */
function shortId(prefix: string, index: number): string {
  return `${prefix}-${index}`;
}

/** Convertit un numéro de colonne (0-indexé) en lettre Excel (A, B, ..., Z, AA...). */
export function colToLetter(col: number): string {
  let letter = "";
  let c = col;
  while (c >= 0) {
    letter = String.fromCharCode(65 + (c % 26)) + letter;
    c = Math.floor(c / 26) - 1;
  }
  return letter;
}

/** Normalise une valeur de cellule en string.
 *
 * ⭐ Gère le cas fréquent où Excel (ou un outil tiers comme openpyxl) encode
 * un matricule en préfixant la chaîne par une apostrophe littérale
 * (ex: `'24001`). Cette apostrophe n'a pas de sens métier — c'est un marqueur
 * de format texte Excel — et doit être supprimée.
 * On retire donc tout préfixe d'apostrophes (un ou plusieurs).
 */
function cellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(/^'+/, "").trim();
}

/**
 * Extrait la classe depuis le nom de feuille.
 * "Notes - CI" → "CI", "Notes-CP" → "CP", sinon retourne le nom brut.
 */
export function extractClassName(sheetName: string): string {
  const match = sheetName.match(CLASS_NAME_REGEX);
  if (match) return match[1].trim();
  // Si pas de préfixe "Notes -", on prend tout le nom
  return sheetName.trim();
}

/**
 * Extrait l'école et l'année scolaire depuis le nom de fichier.
 * ex: "20260718173831_model-importation-note_2025-2026-la-perseverance-ci.xlsx"
 * → { schoolName: "La Persévérance", academicYear: "2025-2026" }
 */
function extractFileInfo(fileName: string): {
  schoolName: string;
  academicYear: string;
} {
  const baseName = fileName.replace(/\.xlsx?$/i, "").toLowerCase();
  let academicYear = "";
  let schoolName = "";

  const yearMatch = baseName.match(FILENAME_PATTERNS.schoolYear);
  if (yearMatch) academicYear = yearMatch[1];

  const schoolMatch = baseName.match(FILENAME_PATTERNS.schoolName);
  if (schoolMatch && schoolMatch[3]) {
    schoolName = schoolMatch[3]
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  return { schoolName, academicYear };
}

/**
 * Détecte les matières à partir des merges de la ligne 1.
 * Un merge sur la ligne 1 (r=0) qui couvre 2 colonnes = matière avec perfectionnement.
 * Un merge vertical (couvre 2 lignes) sur 1 colonne = matière sans perfectionnement.
 */
function detectSubjects(
  merges: XLSX.Range[] | undefined,
  row1Cells: Map<number, string>,
  row2Cells: Map<number, string>,
): Subject[] {
  const subjects: Subject[] = [];

  if (!merges || merges.length === 0) {
    // Pas de merges: on scanne les cellules de la ligne 1 à partir de la colonne 3 (D)
    // et on suppose qu'une matière = 2 colonnes (Note obtenue + Note perfectionnement)
    const sortedCols = Array.from(row1Cells.keys())
      .filter((c) => c >= 3)
      .sort((a, b) => a - b);

    let idx = 0;
    let i = 0;
    while (i < sortedCols.length) {
      const col = sortedCols[i];
      const name = row1Cells.get(col) || `Matière ${idx + 1}`;
      const nextCol = sortedCols[i + 1];
      const subHeaderNext = nextCol !== undefined ? row2Cells.get(nextCol) : undefined;
      const subHeaderCurrent = row2Cells.get(col);

      if (
        nextCol === col + 1 &&
        /obtenu/i.test(subHeaderCurrent || "") &&
        /perfection/i.test(subHeaderNext || "")
      ) {
        // Matière avec perfectionnement
        subjects.push({
          id: slugify(name, `matiere-${idx}`),
          name,
          startCol: col,
          endCol: col + 2,
          hasPerfectionnement: true,
        });
        i += 2;
      } else {
        // Matière sans perfectionnement
        subjects.push({
          id: slugify(name, `matiere-${idx}`),
          name,
          startCol: col,
          endCol: col + 1,
          hasPerfectionnement: false,
        });
        i += 1;
      }
      idx++;
    }
    return subjects;
  }

  // Cas normal: on parse les merges de la ligne 1
  const row1Merges = merges
    .filter((m) => m.s.r === 0)
    .sort((a, b) => a.s.c - b.s.c);

  let idx = 0;
  for (const m of row1Merges) {
    // On ignore les 3 premières colonnes (Matricule, Nom, Prénoms)
    if (m.s.c < 3) continue;

    const name = row1Cells.get(m.s.c) || `Matière ${idx + 1}`;
    const span = m.e.c - m.s.c + 1;
    const verticalSpan = m.e.r - m.s.r + 1;

    // Si fusion verticale (1 colonne sur 2 lignes) → matière sans perfectionnement
    if (verticalSpan >= 2 && span === 1) {
      subjects.push({
        id: slugify(name, `matiere-${idx}`),
        name,
        startCol: m.s.c,
        endCol: m.s.c + 1,
        hasPerfectionnement: false,
      });
    } else if (span >= 2) {
      // Fusion horizontale sur 2+ colonnes → matière avec perfectionnement
      // On vérifie quand même que la sous-colonne suivante mentionne "perfection"
      const subHeader2 = row2Cells.get(m.s.c + 1);
      const hasPerf = subHeader2 ? /perfection/i.test(subHeader2) : true;
      subjects.push({
        id: slugify(name, `matiere-${idx}`),
        name,
        startCol: m.s.c,
        endCol: hasPerf ? m.s.c + 2 : m.s.c + 1,
        hasPerfectionnement: hasPerf,
      });
    } else {
      // Cas atypique: 1 colonne, fusion sur 1 ligne seulement
      subjects.push({
        id: slugify(name, `matiere-${idx}`),
        name,
        startCol: m.s.c,
        endCol: m.s.c + 1,
        hasPerfectionnement: false,
      });
    }
    idx++;
  }

  // Sécurité: si aucun sujet détecté via merges, fallback sur scan brut
  if (subjects.length === 0) {
    const sortedCols = Array.from(row1Cells.keys())
      .filter((c) => c >= 3)
      .sort((a, b) => a - b);
    sortedCols.forEach((col, i) => {
      const name = row1Cells.get(col) || `Matière ${i + 1}`;
      subjects.push({
        id: slugify(name, `matiere-${i}`),
        name,
        startCol: col,
        endCol: col + 1,
        hasPerfectionnement: false,
      });
    });
  }

  return subjects;
}

/** Extrait les élèves depuis les lignes 3+ (index 2+). */
function extractStudents(
  sheet: XLSX.WorkSheet,
  range: XLSX.Range,
): Student[] {
  const students: Student[] = [];
  for (let r = 2; r <= range.e.r; r++) {
    const matriculeCell = sheet[XLSX.utils.encode_cell({ r, c: 0 })];
    const nomCell = sheet[XLSX.utils.encode_cell({ r, c: 1 })];
    const prenomsCell = sheet[XLSX.utils.encode_cell({ r, c: 2 })];

    const matricule = cellToString(matriculeCell?.v);
    const nom = cellToString(nomCell?.v);
    const prenoms = cellToString(prenomsCell?.v);

    // On ignore les lignes complètement vides
    if (!matricule && !nom && !prenoms) continue;

    students.push({
      id: shortId("stu", r),
      matricule,
      nom,
      prenoms,
      rowIndex: r + 1, // 1-indexed pour Excel
    });
  }
  return students;
}

/** Lit une feuille Excel et construit l'objet ClassData. */
function parseSheet(
  sheet: XLSX.WorkSheet,
  sheetName: string,
  fileName: string,
): ClassData | null {
  if (!sheet || !sheet["!ref"]) return null;
  const range = XLSX.utils.decode_range(sheet["!ref"]);

  // Lecture de la ligne 1 (en-têtes matières) et ligne 2 (sous-en-têtes)
  const row1Cells = new Map<number, string>();
  const row2Cells = new Map<number, string>();

  if (range.e.r >= 0) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: 0, c })];
      if (cell && cell.v !== undefined) {
        row1Cells.set(c, cellToString(cell.v));
      }
    }
  }
  if (range.e.r >= 1) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: 1, c })];
      if (cell && cell.v !== undefined) {
        row2Cells.set(c, cellToString(cell.v));
      }
    }
  }

  const subjects = detectSubjects(sheet["!merges"], row1Cells, row2Cells);
  const students = extractStudents(sheet, range);

  if (students.length === 0) return null;

  const { schoolName, academicYear } = extractFileInfo(fileName);
  const className = extractClassName(sheetName);

  // Construire le dictionnaire de notes (vide par défaut)
  const notes: Record<string, Record<string, Note>> = {};
  for (const student of students) {
    notes[student.id] = {};
    for (const subject of subjects) {
      // Lecture des valeurs existantes dans le fichier (au cas où)
      const obtenueCell = sheet[XLSX.utils.encode_cell({
        r: student.rowIndex - 1,
        c: subject.startCol,
      })];
      const perfCell = subject.hasPerfectionnement
        ? sheet[XLSX.utils.encode_cell({
            r: student.rowIndex - 1,
            c: subject.startCol + 1,
          })]
        : undefined;

      const obtenue =
        obtenueCell && typeof obtenueCell.v === "number"
          ? obtenueCell.v
          : obtenueCell && obtenueCell.v !== undefined && obtenueCell.v !== ""
            ? Number(obtenueCell.v)
            : null;
      const perfectionnement =
        subject.hasPerfectionnement && perfCell
          ? typeof perfCell.v === "number"
            ? perfCell.v
            : perfCell.v !== undefined && perfCell.v !== ""
              ? Number(perfCell.v)
              : null
          : null;

      notes[student.id][subject.id] = {
        obtenue: Number.isFinite(obtenue as number) ? (obtenue as number) : null,
        perfectionnement: Number.isFinite(perfectionnement as number)
          ? (perfectionnement as number)
          : null,
      };
    }
  }

  return {
    sheetName,
    className,
    schoolName,
    academicYear,
    students,
    subjects,
    notes,
    sourceFileName: fileName,
    importedAt: new Date().toISOString(),
  };
}

/**
 * Point d'entrée du parser: prend un ArrayBuffer du fichier .xlsx
 * et retourne la liste des classes trouvées (1 par feuille).
 */
export function parseEducMasterFile(
  buffer: ArrayBuffer,
  fileName: string,
): ClassData[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const classes: ClassData[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const parsed = parseSheet(sheet, sheetName, fileName);
    if (parsed) classes.push(parsed);
  }

  return classes;
}

/** Vérifie qu'un fichier est bien un Excel .xlsx/.xls. */
export function isExcelFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type.includes("spreadsheet") ||
    file.type.includes("excel") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls")
  );
}

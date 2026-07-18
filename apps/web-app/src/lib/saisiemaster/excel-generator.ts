/**
 * SaisieMaster — Générateur Excel EducMaster
 *
 * Reconstruit un fichier .xlsx au format exact attendu par la plateforme
 * EducMaster, en préservant:
 * - La structure à 2 lignes d'en-têtes (matières sur ligne 1, sous-en-têtes
 *   "Note obtenue" / "Note perfectionnement" sur ligne 2)
 * - Les cellules fusionnées (Matricule/Nom/Prénoms fusionnés verticalement,
 *   matières fusionnées horizontalement)
 * - Les matières sans perfectionnement (fusion verticale, /20)
 * - Les matricules en texte (pour préserver les zéros initiaux)
 *
 * On utilise SheetJS en mode "object" avec merge ranges pour contrôler
 * précisément la structure.
 */

import * as XLSX from "xlsx";
import type { ClassData, Note } from "./types";

/** Construit l'objet worksheet au format EducMaster pour une classe donnée. */
function buildSheet(data: ClassData): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const merges: XLSX.Range[] = [];

  // 1. En-têtes ligne 1 + ligne 2
  // Colonnes A, B, C = Matricule, Nom, Prénoms (fusion verticale sur 2 lignes)
  const fixedHeaders = ["Matricule", "Nom", "Prénoms"];
  fixedHeaders.forEach((label, col) => {
    ws[XLSX.utils.encode_cell({ r: 0, c: col })] = {
      t: "s",
      v: label,
    };
    merges.push({
      s: { r: 0, c: col },
      e: { r: 1, c: col },
    });
  });

  // Matières à partir de la colonne D (index 3)
  let currentCol = 3;
  data.subjects.forEach((subject) => {
    const startCol = currentCol;

    if (subject.hasPerfectionnement) {
      // Fusion horizontale sur 2 colonnes (ligne 1)
      ws[XLSX.utils.encode_cell({ r: 0, c: startCol })] = {
        t: "s",
        v: subject.name,
      };
      merges.push({
        s: { r: 0, c: startCol },
        e: { r: 0, c: startCol + 1 },
      });

      // Ligne 2: sous-en-têtes
      ws[XLSX.utils.encode_cell({ r: 1, c: startCol })] = {
        t: "s",
        v: "Note obtenue",
      };
      ws[XLSX.utils.encode_cell({ r: 1, c: startCol + 1 })] = {
        t: "s",
        v: "Note perfectionnement",
      };

      currentCol += 2;
    } else {
      // Fusion verticale sur 2 lignes (1 colonne)
      ws[XLSX.utils.encode_cell({ r: 0, c: startCol })] = {
        t: "s",
        v: subject.name,
      };
      merges.push({
        s: { r: 0, c: startCol },
        e: { r: 1, c: startCol },
      });

      // Ligne 2: sous-en-tête "Note obtenue" sur /20
      ws[XLSX.utils.encode_cell({ r: 1, c: startCol })] = {
        t: "s",
        v: "Note obtenue",
      };

      currentCol += 1;
    }
  });

  // 2. Données élèves à partir de la ligne 3 (index 2)
  data.students.forEach((student, studentIdx) => {
    const row = 2 + studentIdx;

    // Matricule en texte (préserve les zéros initiaux)
    ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = {
      t: "s",
      v: student.matricule,
    };
    ws[XLSX.utils.encode_cell({ r: row, c: 1 })] = {
      t: "s",
      v: student.nom,
    };
    ws[XLSX.utils.encode_cell({ r: row, c: 2 })] = {
      t: "s",
      v: student.prenoms,
    };

    // Notes par matière
    let col = 3;
    data.subjects.forEach((subject) => {
      const note: Note | undefined = data.notes[student.id]?.[subject.id];
      const obtenue = note?.obtenue;
      const perf = note?.perfectionnement;

      // Note obtenue
      ws[XLSX.utils.encode_cell({ r: row, c: col })] = {
        t: "n",
        v: obtenue !== null && obtenue !== undefined ? obtenue : "",
      };

      if (subject.hasPerfectionnement) {
        ws[XLSX.utils.encode_cell({ r: row, c: col + 1 })] = {
          t: "n",
          v: perf !== null && perf !== undefined ? perf : "",
        };
        col += 2;
      } else {
        col += 1;
      }
    });
  });

  // 3. Plage de données (!ref)
  const lastRow = 1 + data.students.length; // 0-indexé
  const lastCol = currentCol - 1;
  ws["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: lastRow, c: lastCol },
  });

  // 4. Merges
  ws["!merges"] = merges;

  // 5. Largeurs de colonnes
  const colWidths: { wch: number }[] = [
    { wch: 22 }, // Matricule
    { wch: 22 }, // Nom
    { wch: 28 }, // Prénoms
  ];
  data.subjects.forEach((subject) => {
    // Largeur selon le nom
    const nameLen = Math.max(subject.name.length, 14);
    if (subject.hasPerfectionnement) {
      colWidths.push({ wch: Math.max(12, Math.floor(nameLen / 2) + 4) });
      colWidths.push({ wch: Math.max(14, Math.floor(nameLen / 2) + 6) });
    } else {
      colWidths.push({ wch: Math.max(14, nameLen + 2) });
    }
  });
  ws["!cols"] = colWidths;

  // 6. Hauteur des lignes d'en-tête
  ws["!rows"] = [{ hpt: 22 }, { hpt: 22 }];

  return ws;
}

/** Génère le nom du fichier exporté. */
function buildExportFileName(data: ClassData): string {
  const date = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}`;

  const school = data.schoolName
    ? data.schoolName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    : "ecole";

  const year = data.academicYear || "annee";
  const cls = data.className
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `saisiemaster_${stamp}_${year}-${school}-${cls}.xlsx`;
}

/**
 * Génère un fichier .xlsx à partir des données de classe et déclenche
 * le téléchargement côté navigateur.
 */
export function exportEducMasterFile(data: ClassData): {
  blob: Blob;
  fileName: string;
} {
  const wb: XLSX.WorkBook = {
    SheetNames: [data.sheetName],
    Sheets: { [data.sheetName]: buildSheet(data) },
    Props: {
      Title: `Notes ${data.className} — ${data.schoolName || "École"}`,
      Author: "SaisieMaster",
      CreatedDate: new Date(),
    },
  };

  const arrayBuffer: ArrayBuffer = XLSX.write(wb, {
    bookType: "xlsx",
    type: "array",
    cellStyles: false,
  }) as ArrayBuffer;

  const blob = new Blob([arrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  return { blob, fileName: buildExportFileName(data) };
}

/** Télécharge un blob côté navigateur. */
export function downloadBlob(blob: Blob, fileName: string): void {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

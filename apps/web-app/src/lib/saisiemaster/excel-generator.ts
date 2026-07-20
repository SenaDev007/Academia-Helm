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
import JSZip from "jszip";
import type { ClassData, EvaluationType, Note } from "./types";
import { EVALUATION_TYPES } from "./constants";
import {
  getEvaluationNotes,
  getAllEvaluationTypes,
} from "./evaluation-utils";

/** Construit l'objet worksheet au format EducMaster pour une classe et un type d'évaluation donnés. */
function buildSheet(data: ClassData, evalType: EvaluationType): XLSX.WorkSheet {
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

  // Récupère les notes du type d'évaluation demandé
  const notesForEval = getEvaluationNotes(data, evalType);

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
      const note: Note | undefined = notesForEval[student.id]?.[subject.id];
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

/** Génère le nom du fichier exporté pour un type d'évaluation donné. */
function buildExportFileName(data: ClassData, evalType: EvaluationType): string {
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

  return `${evalType}_${year}-${school}-${cls}.xlsx`;
}

/**
 * Génère un fichier .xlsx pour un type d'évaluation spécifique.
 * Utilisé pour l'export individuel (1 fichier par type d'évaluation).
 */
export function exportEducMasterFile(
  data: ClassData,
  evalType: EvaluationType = "EF1",
): {
  blob: Blob;
  fileName: string;
} {
  // Nom de feuille incluant le type d'évaluation
  const sheetName = `${data.sheetName} - ${evalType}`;
  const wb: XLSX.WorkBook = {
    SheetNames: [sheetName],
    Sheets: { [sheetName]: buildSheet(data, evalType) },
    Props: {
      Title: `${evalType} — Notes ${data.className} — ${data.schoolName || "École"}`,
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

  return { blob, fileName: buildExportFileName(data, evalType) };
}

/**
 * Génère un fichier .zip contenant les 4 fichiers .xlsx (un par type d'évaluation).
 * Utilisé pour l'export groupé (4 fichiers d'un seul coup pour une classe).
 */
export async function exportAllEvaluationsZip(data: ClassData): Promise<{
  blob: Blob;
  fileName: string;
}> {
  const zip = new JSZip();

  // Récupère TOUS les types d'évaluations (4 prédéfinis + personnalisés)
  const allTypes = getAllEvaluationTypes(data);

  // Génère un fichier Excel par type d'évaluation
  for (const evalType of allTypes) {
    const { blob, fileName } = exportEducMasterFile(data, evalType.code);
    const arrayBuffer = await blob.arrayBuffer();
    zip.file(fileName, arrayBuffer);
  }

  // Ajoute aussi un fichier README expliquant la structure du ZIP
  const readme = `SaisieMaster — Export groupé des évaluations
=================================================

Classe : ${data.className}
École : ${data.schoolName || "—"}
Année scolaire : ${data.academicYear || "—"}
Date d'export : ${new Date().toLocaleString("fr-FR")}

Ce ZIP contient ${allTypes.length} fichier(s) Excel, un par type d'évaluation :

${allTypes.map((t) => `- ${t.code} : ${t.label}${t.description ? ` — ${t.description}` : ""}`).join("\n")}

Pour chaque type d'évaluation, le fichier .xlsx contient :
- La liste des élèves (Matricule, Nom, Prénoms)
- Les matières avec leurs sous-colonnes (Note obtenue / Note perfectionnement)
- Les notes saisies pour ce type d'évaluation spécifique

Généré par SaisieMaster (saissiemaster.academiahelm.com)
`;
  zip.file("README.txt", readme);

  const zipBlob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  // Nom du ZIP
  const school = data.schoolName
    ? data.schoolName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    : "ecole";
  const cls = data.className
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const fileName = `saisiemaster_${allTypes.length}evaluations_${school}-${cls}.zip`;

  return { blob: zipBlob, fileName };
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

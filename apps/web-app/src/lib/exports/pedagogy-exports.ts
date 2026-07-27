/**
 * ============================================================================
 * EXPORTS ESPACE PÉDAGOGIQUE — PDF avec en-tête officiel République du Bénin
 * ============================================================================
 *
 * Génère des PDF professionnels pour :
 *   - Registre d'appel mensuel (tableau présences + récapitulatif + signatures)
 *   - Évaluation mensuelle (tableau notes CM/CP/Total ou TS/S/PS + récapitulatif)
 *
 * Utilise le MÊME template/header/footer que le module Finance :
 *   - drawOfficialHeader (drapeau Bénin + République + Ministère + école + logo)
 *   - drawFooter (numéro de page + timestamp)
 *   - Pagination automatique (autotable didDrawPage)
 *   - Orientation paysage pour les tableaux larges
 *
 * Bibliothèques (CDN, pas de dépendance npm) :
 *   - jsPDF 2.5.1
 *   - jspdf-autotable 3.8.2
 * ============================================================================
 */

import {
  drawOfficialHeader,
  drawFooter,
  preloadSchoolLogo,
  getMinistryName,
  type SchoolHeader,
} from '@/lib/exports/finance-exports';
import { loadPdfLibs } from '@/lib/exports/pdf-loader';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StudentAbsenceRow {
  numero: number;
  nom: string;
  prenom: string;
  sexe: string;
  absences: Array<{ week: number; day: number; marked: string }>;
  motif: string;
  totalPresencesPossibles: number;
  totalAbsences: number;
  totalPresenceEffectif: number;
  observation: string;
}

export interface RegisterRecap {
  demiJourneeMois: number;
  totalEleves: number;
  totalPresencesPossibles: number;
  totalAbsences: number;
  totalPresencesEffectives: number;
  pourcentagePresences: number;
  pourcentageAbsences: number;
}

export interface SignatureInfo {
  teacherName: string;
  directorName: string;
  teacherSignature?: string | null;
  directorSignature?: string | null;
}

export interface EvaluationRow {
  numero: number;
  studentName: string;
  sexe: string;
  scores: Array<{
    cm: number | null;
    cp: number | null;
    total: number;
    qualitativeCode: string | null;
    isAbsent: boolean;
  }>;
  totalGeneral: number;
  moyenne: number;
  rang: number;
  seuilAtteint: boolean;
  appreciation?: string;
}

export interface EvaluationRecap {
  effectifG: number;
  effectifF: number;
  effectifTotal: number;
  ayantComposeG: number;
  ayantComposeF: number;
  ayantComposeTotal: number;
  ayantAtteintSeuilG: number;
  ayantAtteintSeuilF: number;
  ayantAtteintSeuilTotal: number;
  nAyantPasAtteintG: number;
  nAyantPasAtteintF: number;
  nAyantPasAtteintTotal: number;
  pourcentageReussiteG: number;
  pourcentageReussiteF: number;
  pourcentageReussiteTotal: number;
}

// ─── Helper : ajouter image signature (base64) ──────────────────────────────

function addSignatureImage(doc: any, dataUrl: string | null | undefined, x: number, y: number, w: number, h: number) {
  if (dataUrl && (dataUrl.startsWith('data:image/png') || dataUrl.startsWith('data:image/jpeg'))) {
    try {
      const format = dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(dataUrl, format, x, y, w, h);
    } catch {
      doc.setDrawColor(200, 200, 200);
      doc.rect(x, y, w, h);
    }
  } else {
    doc.setDrawColor(180, 180, 180);
    doc.setDash([1, 1], 1);
    doc.rect(x, y, w, h);
    doc.setDash([]);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('Signature en attente', x + w / 2, y + h / 2 + 1, { align: 'center' });
  }
}

// ─── Helper : section signatures ────────────────────────────────────────────

function drawSignatures(doc: any, signatures: SignatureInfo, pageWidth: number, yStart: number) {
  const sigW = 70;
  const sigH = 25;
  const gap = 40;
  const leftX = (pageWidth - (sigW * 2 + gap)) / 2;
  const rightX = leftX + sigW + gap;
  const y = yStart + 10;

  // Labels
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text('Le Titulaire de la classe', leftX + sigW / 2, y - 5, { align: 'center' });
  doc.text('Le Directeur / La Directrice', rightX + sigW / 2, y - 5, { align: 'center' });

  // Noms
  doc.setFont('times', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(signatures.teacherName || 'Nom du titulaire', leftX + sigW / 2, y - 1, { align: 'center' });
  doc.text(signatures.directorName || 'Nom du directeur', rightX + sigW / 2, y - 1, { align: 'center' });

  // Cadres signatures
  doc.setDrawColor(13, 31, 110);
  doc.setLineWidth(0.3);
  doc.rect(leftX, y, sigW, sigH);
  doc.rect(rightX, y, sigW, sigH);

  // Images signatures
  addSignatureImage(doc, signatures.teacherSignature, leftX + 2, y + 2, sigW - 4, sigH - 4);
  addSignatureImage(doc, signatures.directorSignature, rightX + 2, y + 2, sigW - 4, sigH - 4);
}

// ─── Helper : section récapitulatif ──────────────────────────────────────────

function drawRecapTable(doc: any, rows: Array<[string, number, number, number]>, yStart: number, pageWidth: number) {
  const autoTable = (doc: any, options: any) => doc.autoTable(options);
  const margin = 14;
  const tableWidth = pageWidth - 2 * margin;

  autoTable(doc, {
    startY: yStart,
    head: [['Indicateur', 'Garçons', 'Filles', 'Total']],
    body: rows.map(([label, g, f, t]) => [label, String(g), String(f), String(t)]),
    theme: 'grid',
    headStyles: {
      fillColor: [13, 31, 110],
      textColor: 255,
      fontSize: 8,
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: tableWidth * 0.55, halign: 'left' },
      1: { cellWidth: tableWidth * 0.15, halign: 'center' },
      2: { cellWidth: tableWidth * 0.15, halign: 'center' },
      3: { cellWidth: tableWidth * 0.15, halign: 'center', fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
  });

  return (doc as any).lastAutoTable?.finalY || yStart;
}

// ─── Export PDF : Registre d'appel mensuel ───────────────────────────────────

export async function exportAttendanceRegisterToPdf(opts: {
  header: SchoolHeader;
  className: string;
  monthLabel: string;
  year: number;
  students: StudentAbsenceRow[];
  recap: RegisterRecap;
  signatures: SignatureInfo;
  holidays?: string[];
  boysCount: number;
  girlsCount: number;
}): Promise<void> {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const { header, className, monthLabel, year, students, recap, signatures, boysCount, girlsCount } = opts;

  // ⭐ Orientation paysage pour le tableau large (5 semaines × 5 jours + colonnes)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // ⭐ Précharger le logo
  const logoBase64 = await preloadSchoolLogo(header.schoolLogoUrl);

  // ─── En-tête officiel ───
  drawOfficialHeader(doc, header, pageWidth, logoBase64);

  // ─── Titre du document ───
  let y = 50;
  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(13, 31, 110);
  doc.text('REGISTRE D\'APPEL MENSUEL', pageWidth / 2, y, { align: 'center' });
  y += 6;
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text(`Classe : ${className}  —  Mois : ${monthLabel} ${year}`, pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setFontSize(8);
  doc.text(`Effectif : ${students.length} élèves (${boysCount} G, ${girlsCount} F)  —  Demi-journées : ${recap.demiJourneeMois}`, pageWidth / 2, y, { align: 'center' });

  // ─── Tableau principal : élèves × semaines ───
  y += 8;
  const margin = 14;
  const tableWidth = pageWidth - 2 * margin;

  // Construire les en-têtes : N° | Nom | Sexe | S1 (5 jours) | ... | S5 | Motif | T.Poss | T.Abs | T.Eff | Obs
  const head = [[
    'N°', 'Nom et prénom', 'Sexe',
    'S1', 'S2', 'S3', 'S4', 'S5',
    'Motif', 'T.Poss', 'T.Abs', 'T.Eff', 'Obs'
  ]];

  // Construire les lignes
  const body = students.map((s) => {
    const weeks = [1, 2, 3, 4, 5].map((w) => {
      const days = [1, 2, 3, 4, 5].map((d) => {
        const a = s.absences.find((x) => x.week === w && x.day === d);
        return a?.marked || '';
      }).join(' ');
      return days;
    });
    return [
      String(s.numero),
      `${s.nom} ${s.prenom}`.trim(),
      s.sexe,
      ...weeks,
      s.motif || '',
      String(s.totalPresencesPossibles),
      String(s.totalAbsences),
      String(s.totalPresenceEffectif),
      s.observation || '',
    ];
  });

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: 'grid',
    headStyles: {
      fillColor: [13, 31, 110],
      textColor: 255,
      fontSize: 7,
      halign: 'center',
      cellPadding: 1.5,
    },
    bodyStyles: {
      fontSize: 6.5,
      cellPadding: 1,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 50, halign: 'left' },
      2: { cellWidth: 10, halign: 'center' },
      3: { cellWidth: 30, halign: 'center' },
      4: { cellWidth: 30, halign: 'center' },
      5: { cellWidth: 30, halign: 'center' },
      6: { cellWidth: 30, halign: 'center' },
      7: { cellWidth: 30, halign: 'center' },
      8: { cellWidth: 30, halign: 'left' },
      9: { cellWidth: 15, halign: 'center' },
      10: { cellWidth: 15, halign: 'center' },
      11: { cellWidth: 15, halign: 'center' },
      12: { cellWidth: 30, halign: 'left' },
    },
    margin: { left: margin, right: margin },
    didDrawPage: () => {
      drawFooter(doc, pageWidth, pageHeight, (doc as any).internal.getNumberOfPages());
    },
  });

  // ─── Récapitulatif ───
  let finalY = (doc as any).lastAutoTable?.finalY || y;
  finalY += 10;
  if (finalY > pageHeight - 80) {
    doc.addPage();
    drawOfficialHeader(doc, header, pageWidth, logoBase64);
    finalY = 50;
  }

  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(13, 31, 110);
  doc.text('RÉCAPITULATIF DU MOIS', pageWidth / 2, finalY, { align: 'center' });
  finalY += 5;

  const recapRows: Array<[string, number, number, number]> = [
    ['Effectif total de la classe', boysCount, girlsCount, students.length],
    ['Demi-journées de classe', recap.demiJourneeMois, recap.demiJourneeMois, recap.demiJourneeMois],
    ['Total présences possibles', recap.totalPresencesPossibles, recap.totalPresencesPossibles, recap.totalPresencesPossibles],
    ['Total absences', recap.totalAbsences, recap.totalAbsences, recap.totalAbsences],
    ['Total présences effectives', recap.totalPresencesEffectives, recap.totalPresencesEffectives, recap.totalPresencesEffectives],
    ['% présences effectives', recap.pourcentagePresences, recap.pourcentagePresences, recap.pourcentagePresences],
    ['% absences', recap.pourcentageAbsences, recap.pourcentageAbsences, recap.pourcentageAbsences],
  ];

  finalY = drawRecapTable(doc, recapRows, finalY, pageWidth);

  // ─── Phrase d'arrêt ───
  finalY += 8;
  doc.setFont('times', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  const arretText = `Arrêté ce registre d'appel ce jour ${new Date().toLocaleDateString('fr-FR')} — Effectif du jour : ${boysCount} G, ${girlsCount} F.`;
  const arretLines = doc.splitTextToSize(arretText, pageWidth - 2 * margin);
  arretLines.forEach((line: string, i: number) => {
    doc.text(line, margin, finalY + i * 4);
  });
  finalY += arretLines.length * 4 + 5;

  // ─── Signatures ───
  if (finalY > pageHeight - 50) {
    doc.addPage();
    drawOfficialHeader(doc, header, pageWidth, logoBase64);
    finalY = 60;
  }
  drawSignatures(doc, signatures, pageWidth, finalY);

  // ─── Footer sur toutes les pages ───
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(doc, pageWidth, pageHeight, i);
  }

  // ⭐ Sauvegarder
  const filename = `Registre_Appel_${className.replace(/\s+/g, '_')}_${monthLabel}_${year}.pdf`;
  doc.save(filename);
}

// ─── Export PDF : Évaluation mensuelle ───────────────────────────────────────

export async function exportMonthlyEvaluationToPdf(opts: {
  header: SchoolHeader;
  className: string;
  periodName: string;
  dateRange: string;
  evaluationTypeName: string;
  isMaternelle: boolean;
  subjects: Array<{ id: string; name: string }>;
  rows: EvaluationRow[];
  recap: EvaluationRecap;
  signatures: SignatureInfo;
}): Promise<void> {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const { header, className, periodName, dateRange, evaluationTypeName, isMaternelle, subjects, rows, recap, signatures } = opts;

  // ⭐ Orientation paysage pour le tableau large (matières × CM/CP/Total)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // ⭐ Précharger le logo
  const logoBase64 = await preloadSchoolLogo(header.schoolLogoUrl);

  // ─── En-tête officiel ───
  drawOfficialHeader(doc, header, pageWidth, logoBase64);

  // ─── Titre du document ───
  let y = 50;
  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(13, 31, 110);
  doc.text('ÉVALUATION MENSUELLE', pageWidth / 2, y, { align: 'center' });
  y += 6;
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text(`Classe : ${className}  —  ${evaluationTypeName}`, pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setFontSize(8);
  doc.text(`${periodName}  —  ${dateRange}`, pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setFont('times', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  const noteLines = doc.splitTextToSize('NB : Pour chaque épreuve, l\'élève évalué(e) n\'aura de bonus de perfectionnement que lorsqu\'il(elle) aura atteint la maîtrise minimale fixée.', pageWidth - 2 * 14);
  noteLines.forEach((line: string, i: number) => {
    doc.text(line, pageWidth / 2, y + i * 3, { align: 'center' });
  });
  y += noteLines.length * 3 + 3;

  // ─── Tableau principal ───
  const margin = 14;
  const tableWidth = pageWidth - 2 * margin;

  // Construire les en-têtes selon le niveau
  let head: string[][];
  let columnStyles: any;
  let body: string[][];

  if (isMaternelle) {
    // Maternelle : N° | Nom | Sexe | [Matière TS/S/PS] | Total | Rang | Seuil fixé | Seuil Oui | Seuil Non | Appréciation
    const subjectCols = subjects.map((s) => s.name);
    head = [['N°', 'Nom et prénom', 'Sexe', ...subjectCols, 'Rang', 'Seuil', 'Oui', 'Non', 'Appréciation']];
    body = rows.map((r) => [
      String(r.numero),
      r.studentName,
      r.sexe,
      ...r.scores.map((s) => s.isAbsent ? '—' : (s.qualitativeCode || '—')),
      `${r.rang}${r.rang === 1 ? (r.sexe === 'F' ? 'ère' : 'er') : 'ème'}`,
      'S',
      r.appreciation === 'Très Satisfaisant' || r.appreciation === 'Satisfaisant' ? '✓' : '',
      r.appreciation === 'Peu Satisfaisant' ? '✓' : '',
      r.appreciation || '—',
    ]);
    const numSubjectCols = subjects.length;
    const subjectColWidth = Math.min(30, (tableWidth - 80) / Math.max(numSubjectCols, 1));
    columnStyles = {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 50, halign: 'left' },
      2: { cellWidth: 10, halign: 'center' },
      ...Object.fromEntries(subjects.map((_, i) => [3 + i, { cellWidth: subjectColWidth, halign: 'center' }])),
      [3 + numSubjectCols]: { cellWidth: 15, halign: 'center' },
      [4 + numSubjectCols]: { cellWidth: 12, halign: 'center' },
      [5 + numSubjectCols]: { cellWidth: 10, halign: 'center' },
      [6 + numSubjectCols]: { cellWidth: 10, halign: 'center' },
      [7 + numSubjectCols]: { cellWidth: 35, halign: 'center' },
    };
  } else {
    // Primaire : N° | Nom | Sexe | [CM/CP/Total par matière] | Total gén. | Rang | Seuil fixé | Seuil Oui | Seuil Non
    const subjectHeaderRow1: string[] = [];
    const subjectHeaderRow2: string[] = [];
    subjects.forEach((s) => {
      subjectHeaderRow1.push(s.name, '', '');
      subjectHeaderRow2.push('CM/18', 'CP/2', 'Total');
    });
    head = [
      ['N°', 'Nom et prénom', 'Sexe', ...subjectHeaderRow1, 'Total gén.', 'Rang', 'Seuil', 'Oui', 'Non'],
      ['', '', '', ...subjectHeaderRow2, '', '', '', '', ''],
    ];
    body = rows.map((r) => {
      const cells: string[] = [String(r.numero), r.studentName, r.sexe];
      r.scores.forEach((s) => {
        if (s.isAbsent) {
          cells.push('—', '—', '—');
        } else {
          cells.push(
            s.cm !== null ? String(s.cm) : '—',
            s.cp !== null ? String(s.cp) : '—',
            String(s.total),
          );
        }
      });
      cells.push(
        r.totalGeneral.toFixed(2),
        `${r.rang}${r.rang === 1 ? (r.sexe === 'F' ? 'ère' : 'er') : 'ème'}`,
        '10',
        r.seuilAtteint ? '✓' : '',
        !r.seuilAtteint && r.totalGeneral > 0 ? '✓' : '',
      );
      return cells;
    });
    const numSubjectGroups = subjects.length;
    const subjectGroupWidth = Math.min(45, (tableWidth - 90) / Math.max(numSubjectGroups, 1));
    columnStyles = {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 50, halign: 'left' },
      2: { cellWidth: 10, halign: 'center' },
      ...Object.fromEntries(subjects.map((_, i) => [
        [3 + i * 3, { cellWidth: subjectGroupWidth / 3, halign: 'center' }],
        [4 + i * 3, { cellWidth: subjectGroupWidth / 3, halign: 'center' }],
        [5 + i * 3, { cellWidth: subjectGroupWidth / 3, halign: 'center' }],
      ]).flat()),
      [3 + numSubjectGroups * 3]: { cellWidth: 18, halign: 'center' },
      [4 + numSubjectGroups * 3]: { cellWidth: 15, halign: 'center' },
      [5 + numSubjectGroups * 3]: { cellWidth: 12, halign: 'center' },
      [6 + numSubjectGroups * 3]: { cellWidth: 10, halign: 'center' },
      [7 + numSubjectGroups * 3]: { cellWidth: 10, halign: 'center' },
    };
  }

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: 'grid',
    headStyles: {
      fillColor: [13, 31, 110],
      textColor: 255,
      fontSize: 6.5,
      halign: 'center',
      cellPadding: 1.5,
      valign: 'middle',
    },
    bodyStyles: {
      fontSize: 6.5,
      cellPadding: 1,
    },
    columnStyles,
    margin: { left: margin, right: margin },
    didDrawPage: () => {
      drawFooter(doc, pageWidth, pageHeight, (doc as any).internal.getNumberOfPages());
    },
  });

  // ─── Récapitulatif ───
  let finalY = (doc as any).lastAutoTable?.finalY || y;
  finalY += 10;
  if (finalY > pageHeight - 80) {
    doc.addPage();
    drawOfficialHeader(doc, header, pageWidth, logoBase64);
    finalY = 50;
  }

  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(13, 31, 110);
  doc.text('RÉCAPITULATIF DE L\'ÉVALUATION', pageWidth / 2, finalY, { align: 'center' });
  finalY += 5;

  const recapRows: Array<[string, number, number, number]> = [
    ['Effectif total de la classe', recap.effectifG, recap.effectifF, recap.effectifTotal],
    ['Nombre d\'élèves ayant composé', recap.ayantComposeG, recap.ayantComposeF, recap.ayantComposeTotal],
    ['Ont atteint le seuil de réussite', recap.ayantAtteintSeuilG, recap.ayantAtteintSeuilF, recap.ayantAtteintSeuilTotal],
    ['N\'ont pas atteint le seuil', recap.nAyantPasAtteintG, recap.nAyantPasAtteintF, recap.nAyantPasAtteintTotal],
    ['% de réussite', Number(recap.pourcentageReussiteG.toFixed(2)), Number(recap.pourcentageReussiteF.toFixed(2)), Number(recap.pourcentageReussiteTotal.toFixed(2))],
  ];

  finalY = drawRecapTable(doc, recapRows, finalY, pageWidth);

  // ─── Signatures ───
  finalY += 10;
  if (finalY > pageHeight - 50) {
    doc.addPage();
    drawOfficialHeader(doc, header, pageWidth, logoBase64);
    finalY = 60;
  }
  drawSignatures(doc, signatures, pageWidth, finalY);

  // ─── Footer sur toutes les pages ───
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(doc, pageWidth, pageHeight, i);
  }

  // ⭐ Sauvegarder
  const filename = `Evaluation_Mensuelle_${className.replace(/\s+/g, '_')}_${periodName.replace(/\s+/g, '_')}.pdf`;
  doc.save(filename);
}

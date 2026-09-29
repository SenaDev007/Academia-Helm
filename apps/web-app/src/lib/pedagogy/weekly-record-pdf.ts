/**
 * ============================================================================
 * WEEKLY RECORD OF WORK — Utilitaires partagés (PDF + dates de semaines)
 * ============================================================================
 *
 * Utilisé par :
 *   - WeeklyRecordOfWorkTab (onglet enseignant, export PDF)
 *   - WeeklyRecordCatalogueTab (catalogue année par année, bouton PDF)
 *
 * ⭐ PDF OFFICIEL — découpage 3 colonnes par page (per request utilisateur) :
 *    Les 12 colonnes de semaines sont trop nombreuses pour tenir sur une
 *    seule page A4 paysage. On scinde en pages de 3 semaines :
 *      Page 1 : 1st/2nd/3rd Week Ending
 *      Page 2 : 4th/5th/6th Week Ending
 *      Page 3 : 7th/8th/9th Week Ending
 *      Page 4 : 10th/11th/12th Week Ending
 *    Toutes les matières apparaissent sur chaque page. La dernière page
 *    porte la note officielle + le bloc Head Teacher + les signatures.
 *
 * ⭐ SYSTÈME DE DATES (même schéma que le cahier journal) :
 *    L'enseignant fixe la date de fin de la 1ère semaine (vendredi),
 *    les 11 suivantes sont calculées automatiquement (+7 jours chacune).
 *    Les 12 dates sont persistées en base (weekDates JSON).
 * ============================================================================
 */

import { loadPdfLibs } from "@/lib/exports/pdf-loader";
import { drawOfficialHeader, drawFooter, type SchoolHeader } from "@/lib/exports/finance-exports";

// ─────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────

export const WEEKS_PER_TERM = 12;

export const WEEK_LABELS = Array.from({ length: WEEKS_PER_TERM }, (_, i) => {
  const n = i + 1;
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
  return `${n}${suffix.toUpperCase()} WEEK ENDING`;
});

export const WEEK_SHORT_LABELS = Array.from({ length: WEEKS_PER_TERM }, (_, i) => {
  const n = i + 1;
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
  return `${n}${suffix} WEEK ENDING`;
});

// ─────────────────────────────────────────────────────────────────────────
// Système de dates (pattern cahier journal)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Vendredi le plus récent (fin de semaine scolaire Lun-Ven).
 *
 * ⭐ FIX (correction 2 — dates sous en-têtes) : l'ancienne formule
 *   `day === 0 ? 5 : day === 6 ? 6 : 5 - day` était fausse 5 jours sur 7 :
 *   mardi → samedi, mercredi → lundi, jeudi → mercredi, samedi → dimanche,
 *   dimanche → mardi ! Seuls lundi et vendredi tombaient juste.
 *   Formule correcte pour « le vendredi le plus récent » : (day + 2) % 7.
 */
export function currentFriday(): Date {
  const d = new Date();
  const day = d.getDay(); // 0=dim, 1=lun, …, 5=ven, 6=sam
  const diff = (day + 7 - 5) % 7; // reculer jusqu'au dernier vendredi
  d.setDate(d.getDate() - diff);
  d.setHours(12, 0, 0, 0);
  return d;
}

/**
 * Calque une date sur le vendredi de sa semaine scolaire (Lun-Ven).
 * ⭐ FIX (correction 2) : si l'enseignant saisit un mardi ou un mercredi,
 *   les 12 dates restent alignées sur des vendredis (fins de semaine).
 *   Lun-Ven → avance au vendredi de la semaine ; Sam/Dim → recule au
 *   vendredi de la semaine écoulée (lundi = +4, samedi = −1, dimanche = −2).
 */
export function snapToFriday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=dim, 1=lun, …, 5=ven, 6=sam
  let diff = (5 - day + 7) % 7; // lundi..vendredi → vendredi de la semaine
  if (diff > 4) diff -= 7; // samedi (−1) / dimanche (−2) → vendredi PRÉCÉDENT
  d.setDate(d.getDate() + diff);
  d.setHours(12, 0, 0, 0);
  return d;
}

/** Calcule les 12 dates de fin de semaine à partir de la 1ère (chacune +7 j). */
export function computeWeekDates(firstWeekEnding: string): string[] {
  const dates: string[] = [];
  const parsed = parseLocalDate(firstWeekEnding);
  if (!parsed) return dates;
  // ⭐ FIX : la 1ère date est calée sur le vendredi de la semaine choisie
  const base = snapToFriday(parsed);
  for (let i = 0; i < WEEKS_PER_TERM; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i * 7);
    dates.push(formatLocalISO(d));
  }
  return dates;
}

/** Parse YYYY-MM-DD comme date LOCALE (évite le bug UTC du cahier journal). */
export function parseLocalDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

/** Format local YYYY-MM-DD sans conversion UTC (pattern cahier journal). */
export function formatLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Affichage dd/mm/yyyy (format EN-track Benin). */
export function formatDateEN(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  if (!d) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** Parse le JSON weekDates stocké en base (tolérant). */
export function parseWeekDatesJson(weekDates: string | null | undefined): string[] {
  if (!weekDates) return [];
  try {
    const arr = JSON.parse(weekDates);
    if (Array.isArray(arr)) return arr.filter((x: any) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x));
  } catch { /* ignore */ }
  return [];
}

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export interface WeeklyRecordCellData {
  domain: string;      // nom de la matière
  subDomain?: string;  // numéro de semaine "1".."12"
  content: string;     // HTML riche
}

export interface WeeklyRecordPdfMeta {
  subjectNames: string[];
  cells: WeeklyRecordCellData[];
  weekDates: string[];          // 12 dates YYYY-MM-DD (peut être vide)
  termLabel: string;            // "First Term" | "Second Term" | "Third Term"
  classLabel: string;
  academicYearLabel?: string;
  teacherName?: string;
  teacherSignature?: string | null;
  directorSignature?: string | null;
  directorName?: string;
  headTeacherInitials?: string | null;
  headTeacherDate?: string | null;
  headTeacherSignature?: string | null;
  header: SchoolHeader;
  filename?: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Export PDF — 3 colonnes de semaines par page
// ─────────────────────────────────────────────────────────────────────────

export async function exportWeeklyRecordPdf(meta: WeeklyRecordPdfMeta): Promise<void> {
  const { jsPDF, autoTable } = await loadPdfLibs();

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();   // 297 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210 mm

  const stripHtml = (html: string) =>
    (html || '')
      .replace(/<div[^>]*>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|li|ul|ol|h[1-6])>/gi, '\n')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      .trim();

  const getCellContent = (subject: string, week: number) => {
    const c = meta.cells.find(x => x.domain === subject && (x.subDomain || '') === String(week));
    return stripHtml(c?.content || '');
  };

  // ⭐ Découpage en pages de 3 semaines : [1-3], [4-6], [7-9], [10-12]
  const CHUNK_SIZE = 3;
  const chunks: number[][] = [];
  for (let start = 1; start <= WEEKS_PER_TERM; start += CHUNK_SIZE) {
    chunks.push(Array.from({ length: CHUNK_SIZE }, (_, i) => start + i));
  }

  let isFirstPage = true;

  for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
    const weeks = chunks[chunkIdx];
    const isLastChunk = chunkIdx === chunks.length - 1;

    if (!isFirstPage) doc.addPage();
    isFirstPage = false;

    // En-tête officiel (école + logo) — redessiné sur chaque page
    drawOfficialHeader(doc, meta.header, pageWidth);

    // Titre du document + infos
    doc.setFont('times', 'bold');
    doc.setFontSize(13);
    doc.text('WEEKLY RECORD OF WORK', pageWidth / 2, 44, { align: 'center' });
    doc.setFontSize(11);
    doc.text(`${String(meta.termLabel || '').toUpperCase()} — WEEKS ${weeks[0]} TO ${weeks[weeks.length - 1]}`, pageWidth / 2, 50, { align: 'center' });
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    doc.text(
      `Class: ${meta.classLabel || ''}   |   Academic Year: ${meta.academicYearLabel || new Date().getFullYear()}`,
      pageWidth / 2, 56, { align: 'center' }
    );

    // Tableau : SUBJECTS + 3 colonnes de semaines (avec dates sous l'en-tête)
    const head = [[
      'SUBJECTS',
      ...weeks.map(week => {
        const label = WEEK_SHORT_LABELS[week - 1] || `${week}th WEEK ENDING`;
        const dateStr = meta.weekDates[week - 1] ? formatDateEN(meta.weekDates[week - 1]) : '';
        return dateStr ? `${label}\n${dateStr}` : label;
      }),
    ]];
    const body = meta.subjectNames.map(subj => [
      subj,
      ...weeks.map(week => getCellContent(subj, week) || '—'),
    ]);

    const usableWidth = pageWidth - 20; // marges 10mm
    const subjectWidth = 45;
    const weekWidth = (usableWidth - subjectWidth) / 3;

    autoTable(doc, {
      head,
      body,
      startY: 61,
      margin: { left: 10, right: 10, top: 61 },
      styles: {
        fontSize: 8,
        cellPadding: 1.5,
        overflow: 'linebreak',
        valign: 'top',
        lineColor: [15, 23, 42],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: 255,
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
      },
      columnStyles: {
        0: { cellWidth: subjectWidth, fontStyle: 'bold', fillColor: [241, 245, 249] },
        1: { cellWidth: weekWidth },
        2: { cellWidth: weekWidth },
        3: { cellWidth: weekWidth },
      },
      didParseCell: (data: any) => {
        // Première colonne = matière, centrée verticalement
        if (data.section === 'body' && data.column.index === 0) {
          data.cell.styles.valign = 'middle';
        }
      },
      didDrawPage: () => {
        drawFooter(doc, pageWidth, pageHeight, doc.internal.getNumberOfPages());
      },
    });

    // ⭐ Dernière page : note officielle + Head Teacher + signatures
    if (isLastChunk) {
      // ⭐ FIX (correction 8 — PDF paginé) : si le tableau de cette page
      //    se termine trop bas, la note + le bloc Head Teacher + les
      //    signatures passaient PAR-DESSUS le tableau (chevauchement).
      //    → page dédiée lorsqu'il reste moins de ~62 mm.
      const finalY = (doc as any).lastAutoTable?.finalY || 180;
      let y = finalY + 8;
      if (y > pageHeight - 62) {
        doc.addPage();
        drawOfficialHeader(doc, meta.header, pageWidth);
        drawFooter(doc, pageWidth, pageHeight, doc.internal.getNumberOfPages());
        y = 50;
      }

      // Note officielle
      doc.setFont('times', 'italic');
      doc.setFontSize(8);
      doc.text(
        'NOTE: WHEN THE SCHOOL IS SHUT DURING A COMPLETE WEEK NO ENTRY SHOULD BE MADE',
        pageWidth / 2, y, { align: 'center' }
      );
      y += 10;

      // Bloc Head Teacher's Initial and Date (persisté en base)
      doc.setFont('times', 'bold');
      doc.setFontSize(9);
      const initials = meta.headTeacherInitials || '__________';
      const htDate = meta.headTeacherDate ? formatDateEN(meta.headTeacherDate) : '__________';
      doc.text(`HEAD TEACHER'S INITIAL AND DATE: ${initials} — ${htDate}`, pageWidth / 2, y, { align: 'center' });
      y += 4;

      // Signature Head Teacher (image data URL)
      if (meta.headTeacherSignature) {
        try {
          doc.addImage(meta.headTeacherSignature, 'PNG', pageWidth / 2 - 20, y, 40, 12);
          y += 14;
        } catch { /* ignore image errors */ }
      } else {
        y += 12;
      }

      // Signatures enseignant / directeur (côte à côte)
      const colWidth = (pageWidth - 40) / 2;
      const leftX = 20;
      const rightX = pageWidth / 2 + 10;

      doc.setFontSize(9);
      doc.setFont('times', 'bold');
      doc.text(`CLASS TEACHER: ${meta.teacherName || ''}`, leftX, y + 6);
      doc.text(`HEAD TEACHER / DIRECTOR: ${meta.directorName || ''}`, rightX, y + 6);

      if (meta.teacherSignature) {
        try { doc.addImage(meta.teacherSignature, 'PNG', leftX, y + 8, 45, 14); } catch { /* ignore */ }
      } else {
        doc.setFont('times', 'normal');
        doc.setFontSize(8);
        doc.text('________________________', leftX, y + 18);
      }
      if (meta.directorSignature) {
        try { doc.addImage(meta.directorSignature, 'PNG', rightX, y + 8, 45, 14); } catch { /* ignore */ }
      } else {
        doc.setFont('times', 'normal');
        doc.setFontSize(8);
        doc.text('________________________', rightX, y + 18);
      }
    }
  }

  const safeName = (s: string) => String(s || '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '');
  doc.save(meta.filename || `Weekly_Record_of_Work_${safeName(meta.classLabel)}_${safeName(meta.termLabel)}.pdf`);
}

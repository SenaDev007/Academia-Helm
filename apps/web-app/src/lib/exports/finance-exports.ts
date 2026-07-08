/**
 * ============================================================================
 * EXPORTS FINANCE — Excel + PDF avec en-tête officiel République du Bénin
 * ============================================================================
 *
 * Génère des fichiers Excel (.xlsx) et PDF avec en-tête officiel :
 *   - Drapeau du Bénin à gauche
 *   - "République du Bénin" + Ministère + Nom école au centre
 *   - Logo école à droite
 *   - Séparateurs design (ligne + losange + ligne)
 *
 * Codes couleur dans Excel et PDF :
 *   - Payé (solde = 0) → vert
 *   - Partiel (payé > 0 mais solde > 0) → ambre
 *   - Impayé (payé = 0) → rouge
 *
 * Bibliothèques (CDN, pas de dépendance npm) :
 *   - xlsx (SheetJS) pour Excel
 *   - jsPDF + autotable pour PDF
 * ============================================================================
 */

/* ------------------------------------------------------------------ */
/*  Chargement dynamique des bibliothèques via CDN                     */
/* ------------------------------------------------------------------ */

import { formatCurrency } from '@/lib/utils';

/**
 * Formate un montant avec des espaces simples (pas insécables).
 * Ex: 10000 → "10 000" (pas "10 000" avec U+00A0)
 * jsPDF/Helvetica ne gère pas les espaces insécables → troncature.
 */
export function formatAmount(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  // Formater manuellement avec espaces simples
  const parts = num.toFixed(0).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return parts.join(',');
}

/**
 * Formate un montant avec devise : "10 000 FCFA"
 */
function formatAmountFCFA(value: number | string): string {
  return formatAmount(value) + ' FCFA';
}

/**
 * Charge une image depuis une URL et la convertit en base64 data URL.
 * Utilisé pour ajouter le logo de l'école dans les PDF jsPDF.
 */
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Précharge le logo de l'école depuis l'URL pour l'utiliser dans les PDF.
 * Retourne une data URL base64 ou null si le logo n'est pas disponible.
 */
export async function preloadSchoolLogo(logoUrl?: string | null): Promise<string | null> {
  if (!logoUrl) return null;
  return loadImageAsBase64(logoUrl);
}

let xlsxPromise: Promise<any> | null = null;
let jsPdfPromise: Promise<any> | null = null;
let autoTablePromise: Promise<any> | null = null;

function loadXlsx(): Promise<any> {
  if (xlsxPromise) return xlsxPromise;
  xlsxPromise = new Promise((resolve, reject) => {
    if ((window as any).XLSX) {
      resolve((window as any).XLSX);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    script.async = true;
    script.onload = () => {
      const XLSX = (window as any).XLSX;
      if (!XLSX) {
        reject(new Error('XLSX indisponible après chargement'));
        return;
      }
      resolve(XLSX);
    };
    script.onerror = () => reject(new Error('Impossible de charger XLSX depuis le CDN'));
    document.head.appendChild(script);
  });
  return xlsxPromise;
}

async function loadJsPdf(): Promise<any> {
  if (jsPdfPromise) return jsPdfPromise;
  jsPdfPromise = new Promise((resolve, reject) => {
    if ((window as any).jspdf && (window as any).jspdf.jsPDF) {
      resolve((window as any).jspdf.jsPDF);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.async = true;
    script.onload = () => {
      const jsPDF = (window as any).jspdf?.jsPDF;
      if (!jsPDF) {
        reject(new Error('jsPDF indisponible après chargement'));
        return;
      }
      resolve(jsPDF);
    };
    script.onerror = () => reject(new Error('Impossible de charger jsPDF depuis le CDN'));
    document.head.appendChild(script);
  });
  return jsPdfPromise;
}

async function loadAutoTable(jsPDF: any): Promise<void> {
  if (autoTablePromise) return autoTablePromise;
  autoTablePromise = new Promise((resolve, reject) => {
    if (jsPDF.API?.autoTable) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
    script.async = true;
    script.onload = () => {
      if (jsPDF.API?.autoTable) {
        resolve();
      } else {
        reject(new Error('autoTable non chargé correctement'));
      }
    };
    script.onerror = () => reject(new Error('Impossible de charger autoTable'));
    document.head.appendChild(script);
  });
  return autoTablePromise;
}

/* ------------------------------------------------------------------ */
/*  Types partagés                                                     */
/* ------------------------------------------------------------------ */

export interface SchoolHeader {
  schoolName: string;
  schoolLogoUrl?: string | null;
  academicYear?: string;
  dateFrom?: string;
  dateTo?: string;
  /** Niveau scolaire pour déterminer le ministère */
  schoolLevel?: 'MATERNELLE' | 'PRIMAIRE' | 'SECONDAIRE' | string;
  /** Adresse, téléphone, email pour l'entête */
  schoolAddress?: string | null;
  schoolPhone?: string | null;
  schoolEmail?: string | null;
  schoolSlogan?: string | null;
}

export interface TransactionRow {
  id: string;
  receiptNumber?: string;
  createdAt?: string;
  date?: string;
  amount?: number;
  paymentMethod?: string;
  reference?: string;
  studentAccount?: {
    student?: { firstName?: string; lastName?: string; matricule?: string };
  };
}

export interface StudentAccountRow {
  id: string;
  studentId?: string;
  balance?: number;
  totalPaid?: number;
  totalDue?: number;
  status?: string;
  /** Total des arriérés (FeeArrear ouverts, toutes années) — ajout multi-année */
  actualArrears?: number;
  /** Détail des arriérés par année scolaire (pour info) */
  feeArrears?: Array<{
    academicYearName: string;
    totalDue: number;
    totalPaid: number;
    balanceDue: number;
    notes?: string;
  }>;
  student?: {
    firstName?: string;
    lastName?: string;
    matricule?: string;
    studentCode?: string;
    schoolLevel?: { name?: string };
  };
  studentEnrollments?: Array<{
    class?: { name?: string };
  }>;
}

/* ------------------------------------------------------------------ */
/*  Utilitaires                                                        */
/* ------------------------------------------------------------------ */

function formatDateFr(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTimeFr(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatPeriod(header: SchoolHeader): string {
  if (header.dateFrom && header.dateTo) {
    return `Période : ${formatDateFr(header.dateFrom)} → ${formatDateFr(header.dateTo)}`;
  }
  if (header.dateFrom) return `Depuis le ${formatDateFr(header.dateFrom)}`;
  if (header.dateTo) return `Jusqu'au ${formatDateFr(header.dateTo)}`;
  return 'Toutes les transactions';
}

function getStudentName(t: TransactionRow): string {
  const s = t.studentAccount?.student;
  if (!s) return '—';
  return `${s.lastName || ''} ${s.firstName || ''}`.trim() || '—';
}

function getStudentMatricule(t: TransactionRow): string {
  return t.studentAccount?.student?.matricule || '—';
}

function getMinistryName(schoolLevel?: string): string {
  if (schoolLevel === 'SECONDAIRE' || schoolLevel === 'Secondaire') {
    return "Ministère de l'Enseignement Secondaire, de la Formation Technique et Professionnelle, de la Reconversion et de l'Insertion des Jeunes";
  }
  return "Ministère des Enseignements Maternel et Primaire";
}

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  WIRE: 'Virement',
  FEDAPAY: 'Fedapay',
  FEEXPAY: 'FeexPay',
  BANK: 'Banque',
  CHECK: 'Chèque',
};

/**
 * Détermine le statut de paiement d'un compte élève.
 * Retourne : 'PAID' (soldé), 'PARTIAL' (partiel), 'UNPAID' (impayé)
 */
function getPaymentStatus(account: StudentAccountRow): 'PAID' | 'PARTIAL' | 'UNPAID' {
  const balance = Number(account.balance) || 0;
  const paid = Number(account.totalPaid) || 0;
  if (balance <= 0) return 'PAID';
  if (paid > 0) return 'PARTIAL';
  return 'UNPAID';
}

const STATUS_COLORS = {
  PAID: { bg: 'D1FAE5', text: '065F46', label: 'Soldé' },        // vert
  PARTIAL: { bg: 'FEF3C7', text: '92400E', label: 'Partiel' },   // ambre
  UNPAID: { bg: 'FEE2E2', text: '991B1B', label: 'Impayé' },     // rouge
};

/* ------------------------------------------------------------------ */
/*  Export EXCEL — Encaissements (avec mise en forme + couleurs)       */
/* ------------------------------------------------------------------ */

export async function exportTransactionsToExcel(
  transactions: TransactionRow[],
  header: SchoolHeader
): Promise<void> {
  const XLSX = await loadXlsx();

  const totalAmount = transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  // Préparer les données avec en-tête officielle
  const data: any[][] = [
    ['', 'République du Bénin', ''],
    ['', getMinistryName(header.schoolLevel), ''],
    ['', header.schoolName || 'Établissement', ''],
    [header.schoolAddress || '', header.schoolPhone ? `Tél : ${header.schoolPhone}` : '', header.schoolEmail ? `Email : ${header.schoolEmail}` : ''],
    ['', '', ''],
    ['Historique des encaissements', '', ''],
    [header.academicYear ? `Année scolaire : ${header.academicYear}` : '', '', ''],
    [formatPeriod(header), '', ''],
    ['', '', ''],
    ['Date', 'Reçu', 'Matricule', 'Élève', 'Montant (FCFA)', 'Méthode', 'Référence'],
  ];

  transactions.forEach((t) => {
    data.push([
      formatDateTimeFr(t.createdAt || t.date),
      t.receiptNumber || '—',
      getStudentMatricule(t),
      getStudentName(t),
      Number(t.amount) || 0,
      METHOD_LABELS[t.paymentMethod || ''] || t.paymentMethod || '—',
      t.reference || '—',
    ]);
  });

  // Ligne total
  data.push(['']);
  data.push(['', '', '', 'TOTAL', totalAmount, '', '']);

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Largeurs de colonnes
  ws['!cols'] = [
    { wch: 20 }, // Date
    { wch: 22 }, // Reçu
    { wch: 16 }, // Matricule
    { wch: 30 }, // Élève
    { wch: 16 }, // Montant
    { wch: 14 }, // Méthode
    { wch: 22 }, // Référence
  ];

  // Fusionner les cellules d'en-tête
  ws['!merges'] = [
    { s: { r: 0, c: 1 }, e: { r: 0, c: 2 } }, // République
    { s: { r: 1, c: 1 }, e: { r: 1, c: 2 } }, // Ministère
    { s: { r: 2, c: 1 }, e: { r: 2, c: 2 } }, // École
    { s: { r: 5, c: 0 }, e: { r: 5, c: 2 } }, // Titre document
    { s: { r: 6, c: 0 }, e: { r: 6, c: 2 } }, // Année scolaire
    { s: { r: 7, c: 0 }, e: { r: 7, c: 2 } }, // Période
  ];

  // ─── Mise en forme cellules (styles) ───
  // République du Bénin (ligne 0) : gras, taille 14, centré
  setCellStyle(ws, 'B1', { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center' } });
  // Ministère (ligne 1) : gras, taille 11, centré
  setCellStyle(ws, 'B2', { font: { bold: true, sz: 11 }, alignment: { horizontal: 'center', wrapText: true } });
  // École (ligne 2) : gras, taille 13, centré
  setCellStyle(ws, 'B3', { font: { bold: true, sz: 13 }, alignment: { horizontal: 'center' } });
  // Contact (ligne 3) : italique, taille 9
  setCellStyle(ws, 'A4', { font: { italic: true, sz: 9 }, alignment: { horizontal: 'left' } });
  setCellStyle(ws, 'B4', { font: { italic: true, sz: 9 }, alignment: { horizontal: 'center' } });
  setCellStyle(ws, 'C4', { font: { italic: true, sz: 9 }, alignment: { horizontal: 'right' } });
  // Titre document (ligne 5) : gras, taille 12, couleur bleu marine
  setCellStyle(ws, 'A6', { font: { bold: true, sz: 12, color: { rgb: '0D1F6E' } }, alignment: { horizontal: 'center' } });
  // Année + période (lignes 6, 7) : italique, taille 10
  setCellStyle(ws, 'A7', { font: { italic: true, sz: 10 }, alignment: { horizontal: 'center' } });
  setCellStyle(ws, 'A8', { font: { italic: true, sz: 10 }, alignment: { horizontal: 'center' } });

  // En-tête tableau (ligne 9) : fond bleu marine, texte blanc, gras
  const headerRow = 9;
  for (let c = 0; c < 7; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: headerRow, c });
    setCellStyle(ws, cellRef, {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      fill: { fgColor: { rgb: '0D1F6E' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: '0D1F6E' } },
        bottom: { style: 'thin', color: { rgb: '0D1F6E' } },
        left: { style: 'thin', color: { rgb: '0D1F6E' } },
        right: { style: 'thin', color: { rgb: '0D1F6E' } },
      },
    });
  }

  // Lignes de données : alternance de couleurs (zebra striping)
  const dataStartRow = headerRow + 1;
  const dataEndRow = dataStartRow + transactions.length - 1;
  for (let r = dataStartRow; r <= dataEndRow; r++) {
    const isEven = (r - dataStartRow) % 2 === 0;
    const bgColor = isEven ? 'F8FAFC' : 'FFFFFF';
    for (let c = 0; c < 7; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const isAmount = c === 4; // Colonne Montant
      setCellStyle(ws, cellRef, {
        font: { sz: 10, bold: isAmount, color: { rgb: isAmount ? '065F46' : '000000' } },
        fill: { fgColor: { rgb: bgColor } },
        alignment: {
          horizontal: c === 3 ? 'left' : (c === 4 ? 'right' : 'center'),
          vertical: 'center',
        },
        border: {
          top: { style: 'thin', color: { rgb: 'E2E8F0' } },
          bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
          left: { style: 'thin', color: { rgb: 'E2E8F0' } },
          right: { style: 'thin', color: { rgb: 'E2E8F0' } },
        },
      });
    }
  }

  // Ligne total (dernière ligne) : fond jaune, gras
  const totalRow = dataEndRow + 2;
  for (let c = 0; c < 7; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: totalRow, c });
    setCellStyle(ws, cellRef, {
      font: { bold: true, sz: 11, color: { rgb: '92400E' } },
      fill: { fgColor: { rgb: 'FEF3C7' } },
      alignment: { horizontal: c === 4 ? 'right' : 'center', vertical: 'center' },
      border: {
        top: { style: 'medium', color: { rgb: '92400E' } },
        bottom: { style: 'medium', color: { rgb: '92400E' } },
        left: { style: 'thin', color: { rgb: '92400E' } },
        right: { style: 'thin', color: { rgb: '92400E' } },
      },
    });
  }

  // Hauteur des lignes d'en-tête
  ws['!rows'] = [
    { hpt: 22 }, // République
    { hpt: 30 }, // Ministère
    { hpt: 20 }, // École
    { hpt: 16 }, // Contact
    { hpt: 10 }, // Vide
    { hpt: 22 }, // Titre
    { hpt: 16 }, // Année
    { hpt: 16 }, // Période
    { hpt: 10 }, // Vide
    { hpt: 24 }, // En-tête tableau
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Encaissements');

  const filename = `encaissements-${header.dateFrom || 'debut'}-au-${header.dateTo || 'fin'}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/* ------------------------------------------------------------------ */
/*  Helper : applique un style à une cellule XLSX                      */
/* ------------------------------------------------------------------ */

function setCellStyle(ws: any, cellRef: string, style: any) {
  if (!ws[cellRef]) {
    ws[cellRef] = { t: 's', v: '' };
  }
  if (!ws[cellRef].s) {
    ws[cellRef].s = {};
  }
  Object.assign(ws[cellRef].s, style);
}

/* ------------------------------------------------------------------ */
/*  Export PDF — Encaissements (en-tête République du Bénin + tableau) */
/* ------------------------------------------------------------------ */

export async function exportTransactionsToPdf(
  transactions: TransactionRow[],
  header: SchoolHeader
): Promise<{ blob: Blob; url: string }> {
  const jsPDF = await loadJsPdf();
  await loadAutoTable(jsPDF);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Précharger le logo de l'école
  const logoBase64 = await preloadSchoolLogo(header.schoolLogoUrl);

  // ─── En-tête officiel République du Bénin ───
  drawOfficialHeader(doc, header, pageWidth, logoBase64);

  // ─── Titre du document ───
  let yPos = 50;
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(13, 31, 110); // bleu marine
  doc.text('Historique des encaissements', pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;

  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  if (header.academicYear) {
    doc.text(`Année scolaire : ${header.academicYear}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 4;
  }
  doc.text(formatPeriod(header), pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;

  // Ligne séparatrice
  doc.setDrawColor(13, 31, 110);
  doc.setLineWidth(0.5);
  doc.line(14, yPos, pageWidth - 14, yPos);
  yPos += 5;

  // ─── Tableau des transactions ───
  const tableData = transactions.map((t) => [
    formatDateTimeFr(t.createdAt || t.date),
    t.receiptNumber || '—',
    getStudentMatricule(t),
    getStudentName(t),
    formatAmount(t.amount),
    METHOD_LABELS[t.paymentMethod || ''] || t.paymentMethod || '—',
    t.reference || '—',
  ]);

  const totalAmount = transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  tableData.push([
    '', '', '', 'TOTAL',
    formatAmountFCFA(totalAmount),
    '', '',
  ]);

  (doc as any).autoTable({
    head: [['Date', 'Reçu', 'Matricule', 'Élève', 'Montant (FCFA)', 'Méthode', 'Référence']],
    body: tableData,
    startY: yPos,
    theme: 'grid',
    headStyles: {
      fillColor: [13, 31, 110],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [40, 40, 40],
      cellPadding: 1.5,
      valign: 'middle',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 32, halign: 'center' },   // Date
      1: { cellWidth: 35, halign: 'center' },    // Reçu
      2: { cellWidth: 25, halign: 'center' },    // Matricule
      3: { cellWidth: 'auto', halign: 'left' },  // Élève
      4: { cellWidth: 32, halign: 'right' },     // Montant
      5: { cellWidth: 22, halign: 'center' },    // Méthode
      6: { cellWidth: 'auto', halign: 'center' },// Référence
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (data: any) => {
      // Ligne total (dernière) : fond jaune, gras
      if (data.row.index === tableData.length - 1 && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [254, 243, 199];
        data.cell.styles.textColor = [146, 64, 14];
        data.cell.styles.fontSize = 9;
      }
      // Colonne Montant (index 4) : vert si > 0
      if (data.section === 'body' && data.column.index === 4 && data.row.index < tableData.length - 1) {
        data.cell.styles.textColor = [6, 95, 70];
        data.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawPage: (data: any) => {
      drawFooter(doc, pageWidth, pageHeight, data.pageNumber);
    },
  });

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  return { blob, url };
}

/* ------------------------------------------------------------------ */
/*  En-tête officiel République du Bénin (commun à tous les PDF)       */
/* ------------------------------------------------------------------ */

export function drawOfficialHeader(doc: any, header: SchoolHeader, pageWidth: number, logoBase64?: string | null) {
  const margin = 14;
  const headerWidth = pageWidth - 2 * margin;
  const colWidth = headerWidth / 3;

  // ─── Colonne gauche : Drapeau du Bénin (dessiné en rectangles) ───
  // Le drapeau du Bénin : bande verticale verte à gauche, deux bandes horizontales (jaune en haut, rouge en bas) à droite
  const flagX = margin + 12;
  const flagY = 14;
  const flagW = 18;
  const flagH = 12;
  // Bande verte verticale (1/3 gauche)
  doc.setFillColor(0, 122, 61); // vert
  doc.rect(flagX, flagY, flagW / 3, flagH, 'F');
  // Bande jaune horizontale (2/3 droite, haut)
  doc.setFillColor(252, 209, 22); // jaune
  doc.rect(flagX + flagW / 3, flagY, (flagW * 2) / 3, flagH / 2, 'F');
  // Bande rouge horizontale (2/3 droite, bas)
  doc.setFillColor(206, 17, 38); // rouge
  doc.rect(flagX + flagW / 3, flagY + flagH / 2, (flagW * 2) / 3, flagH / 2, 'F');

  // ─── Colonne centre : République + Ministère + École ───
  const centerX = pageWidth / 2;
  let yPos = 14;

  // République du Bénin
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text('République du Bénin', centerX, yPos + 4, { align: 'center' });

  // Séparateur design : ligne + losange + ligne
  drawDesignDivider(doc, centerX, yPos + 7, 60);
  yPos += 11;

  // Ministère
  doc.setFont('times', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(20, 20, 20);
  const ministry = getMinistryName(header.schoolLevel);
  const ministryLines = doc.splitTextToSize(ministry, 120);
  ministryLines.forEach((line: string, i: number) => {
    doc.text(line, centerX, yPos + i * 3.5, { align: 'center' });
  });
  yPos += ministryLines.length * 3.5 + 1;

  // Séparateur design
  drawDesignDivider(doc, centerX, yPos, 60);
  yPos += 4;

  // Nom école
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(13, 31, 110);
  doc.text(header.schoolName || 'Établissement', centerX, yPos + 3, { align: 'center' });
  yPos += 6;

  // Contact (adresse, téléphone, email)
  doc.setFont('times', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  const contactParts = [
    header.schoolSlogan ? `« ${header.schoolSlogan} »` : null,
    header.schoolAddress,
    header.schoolPhone ? `Tél : ${header.schoolPhone}` : null,
    header.schoolEmail ? `Email : ${header.schoolEmail}` : null,
  ].filter(Boolean);
  if (contactParts.length > 0) {
    const contactStr = contactParts.join(' · ');
    const contactLines = doc.splitTextToSize(contactStr, 140);
    contactLines.forEach((line: string, i: number) => {
      doc.text(line, centerX, yPos + i * 3, { align: 'center' });
    });
  }

  // ─── Colonne droite : Logo école (si base64 disponible) ───
  const logoX = pageWidth - margin - 22;
  const logoY = 14;
  const logoW = 20;
  const logoH = 20;
  if (logoBase64) {
    try {
      // Déterminer le format depuis le data URL
      const format = logoBase64.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(logoBase64, format, logoX, logoY, logoW, logoH);
    } catch {
      // Si l'image ne peut pas être ajoutée, dessiner un placeholder
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.2);
      doc.rect(logoX, logoY, logoW, logoH);
    }
  } else {
    // Pas de logo — dessiner un placeholder discret
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.rect(logoX, logoY, logoW, logoH);
    doc.setFontSize(6);
    doc.setTextColor(180, 180, 180);
    doc.text('LOGO', logoX + logoW / 2, logoY + logoH / 2 + 1, { align: 'center' });
  }

  // ─── Ligne bordure basse de l'en-tête (double ligne) ───
  const headerBottomY = 44;
  doc.setDrawColor(13, 31, 110);
  doc.setLineWidth(0.6);
  doc.line(margin, headerBottomY, pageWidth - margin, headerBottomY);
  doc.setLineWidth(0.2);
  doc.line(margin, headerBottomY + 1.5, pageWidth - margin, headerBottomY + 1.5);
}

function drawDesignDivider(doc: any, centerX: number, y: number, totalWidth: number) {
  const halfLine = (totalWidth - 6) / 2;
  doc.setDrawColor(13, 31, 110);
  doc.setLineWidth(0.4);
  // Ligne gauche
  doc.line(centerX - totalWidth / 2, y, centerX - 1.5, y);
  // Losange (carré pivoté à 45°) — comme le module élève (6x6px ≈ 2mm)
  doc.setFillColor(13, 31, 110);
  const size = 1.5; // demi-côté du losange
  // Dessiner un losange avec 4 points
  doc.triangle(
    centerX, y - size,        // haut
    centerX + size, y,        // droite
    centerX, y + size,        // bas
    'F',
  );
  doc.triangle(
    centerX, y - size,        // haut
    centerX - size, y,        // gauche
    centerX, y + size,        // bas
    'F',
  );
  // Ligne droite
  doc.line(centerX + 1.5, y, centerX + totalWidth / 2, y);
}

export function drawFooter(doc: any, pageWidth: number, pageHeight: number, pageNumber: number) {
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Page ${pageNumber}`, pageWidth - 20, pageHeight - 6);
  doc.text(
    `Document généré par Academia Helm — ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
    14,
    pageHeight - 6,
  );
}

/* ------------------------------------------------------------------ */
/*  Export EXCEL — Comptes élèves (avec codes couleur statut)          */
/* ------------------------------------------------------------------ */

export async function exportStudentAccountsToExcel(
  accounts: StudentAccountRow[],
  header: SchoolHeader & { classFilter?: string }
): Promise<void> {
  const XLSX = await loadXlsx();

  const totalDue = accounts.reduce((sum, a) => sum + (Number(a.totalDue) || 0), 0);
  const totalPaid = accounts.reduce((sum, a) => sum + (Number(a.totalPaid) || 0), 0);
  const totalBalance = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  const totalArrears = accounts.reduce((sum, a) => sum + (Number(a.actualArrears) || 0), 0);

  const data: any[][] = [
    ['', 'République du Bénin', ''],
    ['', getMinistryName(header.schoolLevel), ''],
    ['', header.schoolName || 'Établissement', ''],
    [header.schoolAddress || '', header.schoolPhone ? `Tél : ${header.schoolPhone}` : '', header.schoolEmail ? `Email : ${header.schoolEmail}` : ''],
    ['', '', ''],
    ['Comptes élèves', '', ''],
    [header.academicYear ? `Année scolaire : ${header.academicYear}` : '', '', ''],
    [header.classFilter ? `Classe : ${header.classFilter}` : 'Toutes les classes', '', ''],
    ['', '', ''],
    ['Matricule', 'Nom', 'Prénom', 'Classe', 'Niveau', 'Arriérés (FCFA)', 'Solde dû (FCFA)', 'Total payé (FCFA)', 'Total à payer (FCFA)', 'Statut'],
  ];

  accounts.forEach((a) => {
    const className = a.studentEnrollments?.[0]?.class?.name || '—';
    const level = a.student?.schoolLevel?.name || '—';
    const status = getPaymentStatus(a);
    data.push([
      a.student?.studentCode || a.student?.matricule || '—',
      a.student?.lastName || '—',
      a.student?.firstName || '—',
      className,
      level,
      Number(a.actualArrears) || 0,
      Number(a.balance) || 0,
      Number(a.totalPaid) || 0,
      Number(a.totalDue) || 0,
      STATUS_COLORS[status].label,
    ]);
  });

  data.push(['']);
  data.push(['', '', '', '', 'TOTAL', totalArrears, totalBalance, totalPaid, totalDue, '']);

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 16 }, // Matricule
    { wch: 20 }, // Nom
    { wch: 20 }, // Prénom
    { wch: 18 }, // Classe
    { wch: 14 }, // Niveau
    { wch: 14 }, // Arriérés
    { wch: 16 }, // Solde
    { wch: 16 }, // Payé
    { wch: 18 }, // À payer
    { wch: 12 }, // Statut
  ];
  ws['!merges'] = [
    { s: { r: 0, c: 1 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 1 }, e: { r: 1, c: 2 } },
    { s: { r: 2, c: 1 }, e: { r: 2, c: 2 } },
    { s: { r: 5, c: 0 }, e: { r: 5, c: 2 } },
    { s: { r: 6, c: 0 }, e: { r: 6, c: 2 } },
    { s: { r: 7, c: 0 }, e: { r: 7, c: 2 } },
  ];

  // ─── Mise en forme ───
  setCellStyle(ws, 'B1', { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center' } });
  setCellStyle(ws, 'B2', { font: { bold: true, sz: 11 }, alignment: { horizontal: 'center', wrapText: true } });
  setCellStyle(ws, 'B3', { font: { bold: true, sz: 13 }, alignment: { horizontal: 'center' } });
  setCellStyle(ws, 'A4', { font: { italic: true, sz: 9 }, alignment: { horizontal: 'left' } });
  setCellStyle(ws, 'B4', { font: { italic: true, sz: 9 }, alignment: { horizontal: 'center' } });
  setCellStyle(ws, 'C4', { font: { italic: true, sz: 9 }, alignment: { horizontal: 'right' } });
  setCellStyle(ws, 'A6', { font: { bold: true, sz: 12, color: { rgb: '0D1F6E' } }, alignment: { horizontal: 'center' } });
  setCellStyle(ws, 'A7', { font: { italic: true, sz: 10 }, alignment: { horizontal: 'center' } });
  setCellStyle(ws, 'A8', { font: { italic: true, sz: 10 }, alignment: { horizontal: 'center' } });

  // En-tête tableau (ligne 9)
  const headerRow = 9;
  for (let c = 0; c < 10; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: headerRow, c });
    setCellStyle(ws, cellRef, {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      fill: { fgColor: { rgb: '0D1F6E' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: '0D1F6E' } },
        bottom: { style: 'thin', color: { rgb: '0D1F6E' } },
        left: { style: 'thin', color: { rgb: '0D1F6E' } },
        right: { style: 'thin', color: { rgb: '0D1F6E' } },
      },
    });
  }

  // Lignes de données avec codes couleur selon le statut
  const dataStartRow = headerRow + 1;
  accounts.forEach((a, idx) => {
    const r = dataStartRow + idx;
    const status = getPaymentStatus(a);
    const colors = STATUS_COLORS[status];
    for (let c = 0; c < 10; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const isAmount = c >= 5 && c <= 8;
      const isArrears = c === 5;
      setCellStyle(ws, cellRef, {
        font: {
          sz: 10,
          bold: isAmount,
          color: { rgb: c === 9 ? colors.text : (isArrears && Number(a.actualArrears) > 0 ? '92400E' : (isAmount ? '000000' : '1a1a1a')) },
        },
        fill: { fgColor: { rgb: c === 9 ? colors.bg : (isArrears && Number(a.actualArrears) > 0 ? 'FEF3C7' : 'FFFFFF') } },
        alignment: {
          horizontal: c === 1 || c === 2 ? 'left' : (isAmount ? 'right' : 'center'),
          vertical: 'center',
        },
        border: {
          top: { style: 'thin', color: { rgb: 'E2E8F0' } },
          bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
          left: { style: 'thin', color: { rgb: 'E2E8F0' } },
          right: { style: 'thin', color: { rgb: 'E2E8F0' } },
        },
      });
    }
  });

  // Ligne total
  const totalRow = dataStartRow + accounts.length + 1;
  for (let c = 0; c < 10; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: totalRow, c });
    setCellStyle(ws, cellRef, {
      font: { bold: true, sz: 11, color: { rgb: '92400E' } },
      fill: { fgColor: { rgb: 'FEF3C7' } },
      alignment: { horizontal: c >= 5 && c <= 8 ? 'right' : 'center', vertical: 'center' },
      border: {
        top: { style: 'medium', color: { rgb: '92400E' } },
        bottom: { style: 'medium', color: { rgb: '92400E' } },
        left: { style: 'thin', color: { rgb: '92400E' } },
        right: { style: 'thin', color: { rgb: '92400E' } },
      },
    });
  }

  ws['!rows'] = [
    { hpt: 22 }, { hpt: 30 }, { hpt: 20 }, { hpt: 16 }, { hpt: 10 },
    { hpt: 22 }, { hpt: 16 }, { hpt: 16 }, { hpt: 10 }, { hpt: 24 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Comptes élèves');
  XLSX.writeFile(wb, `comptes-eleves-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/* ------------------------------------------------------------------ */
/*  Export PDF — Comptes élèves (avec en-tête officiel + couleurs)     */
/* ------------------------------------------------------------------ */

export async function exportStudentAccountsToPdf(
  accounts: StudentAccountRow[],
  header: SchoolHeader & { classFilter?: string }
): Promise<{ blob: Blob; url: string }> {
  const jsPDF = await loadJsPdf();
  await loadAutoTable(jsPDF);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Précharger le logo de l'école
  const logoBase64 = await preloadSchoolLogo(header.schoolLogoUrl);

  // En-tête officiel
  drawOfficialHeader(doc, header, pageWidth, logoBase64);

  // Titre
  let yPos = 50;
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(13, 31, 110);
  doc.text('Comptes élèves', pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;

  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  if (header.academicYear) {
    doc.text(`Année scolaire : ${header.academicYear}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 4;
  }
  doc.text(
    header.classFilter ? `Classe : ${header.classFilter}` : 'Toutes les classes',
    pageWidth / 2,
    yPos,
    { align: 'center' },
  );
  yPos += 5;

  doc.setDrawColor(13, 31, 110);
  doc.setLineWidth(0.5);
  doc.line(14, yPos, pageWidth - 14, yPos);
  yPos += 5;

  const totalDue = accounts.reduce((sum, a) => sum + (Number(a.totalDue) || 0), 0);
  const totalPaid = accounts.reduce((sum, a) => sum + (Number(a.totalPaid) || 0), 0);
  const totalBalance = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  const totalArrears = accounts.reduce((sum, a) => sum + (Number(a.actualArrears) || 0), 0);

  const tableData = accounts.map((a) => {
    const status = getPaymentStatus(a);
    return [
      a.student?.studentCode || a.student?.matricule || '—',
      a.student?.lastName || '—',
      a.student?.firstName || '—',
      a.studentEnrollments?.[0]?.class?.name || '—',
      a.student?.schoolLevel?.name || '—',
      formatAmount(a.actualArrears),
      formatAmount(a.balance),
      formatAmount(a.totalPaid),
      formatAmount(a.totalDue),
      STATUS_COLORS[status].label,
    ];
  });

  tableData.push([
    '', '', '', '', 'TOTAL',
    formatAmount(totalArrears),
    formatAmount(totalBalance),
    formatAmount(totalPaid),
    formatAmount(totalDue),
    '',
  ]);

  (doc as any).autoTable({
    head: [['Matricule', 'Nom', 'Prénom', 'Classe', 'Niveau', 'Arriérés', 'Solde dû', 'Payé', 'À payer', 'Statut']],
    body: tableData,
    startY: yPos,
    theme: 'grid',
    headStyles: {
      fillColor: [13, 31, 110],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [40, 40, 40],
      cellPadding: 1.5,
      valign: 'middle',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 'auto', halign: 'left' },
      2: { cellWidth: 'auto', halign: 'left' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 24, halign: 'right' },  // Arriérés
      6: { cellWidth: 26, halign: 'right' },  // Solde dû
      7: { cellWidth: 26, halign: 'right' },  // Payé
      8: { cellWidth: 28, halign: 'right' },  // À payer
      9: { cellWidth: 18, halign: 'center' }, // Statut
    },
    didParseCell: (data: any) => {
      // Ligne total
      if (data.row.index === tableData.length - 1 && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [254, 243, 199];
        data.cell.styles.textColor = [146, 64, 14];
        data.cell.styles.fontSize = 9;
      }
      // Colonne Statut (index 9) : couleur selon le statut
      if (data.section === 'body' && data.column.index === 9 && data.row.index < tableData.length - 1) {
        const statusLabel = data.cell.raw;
        let status: 'PAID' | 'PARTIAL' | 'UNPAID' = 'UNPAID';
        if (statusLabel === 'Soldé') status = 'PAID';
        else if (statusLabel === 'Partiel') status = 'PARTIAL';
        const colors = STATUS_COLORS[status];
        // Convertir hex en RGB
        const r = parseInt(colors.bg.substring(0, 2), 16);
        const g = parseInt(colors.bg.substring(2, 4), 16);
        const b = parseInt(colors.bg.substring(4, 6), 16);
        const tr = parseInt(colors.text.substring(0, 2), 16);
        const tg = parseInt(colors.text.substring(2, 4), 16);
        const tb = parseInt(colors.text.substring(4, 6), 16);
        data.cell.styles.fillColor = [r, g, b];
        data.cell.styles.textColor = [tr, tg, tb];
        data.cell.styles.fontStyle = 'bold';
      }
      // Colonne Arriérés (index 5) : surlignage ambre si > 0
      if (data.section === 'body' && data.column.index === 5 && data.row.index < tableData.length - 1) {
        const arrearValue = Number(String(data.cell.raw).replace(/[^\d-]/g, '')) || 0;
        if (arrearValue > 0) {
          data.cell.styles.fillColor = [254, 243, 199]; // bg-amber-100
          data.cell.styles.textColor = [146, 64, 14];   // text-amber-700
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    didDrawPage: (data: any) => {
      drawFooter(doc, pageWidth, pageHeight, data.pageNumber);
    },
  });

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  return { blob, url };
}

/* ------------------------------------------------------------------ */
/*  Export PDF — Historique d'un élève (avec en-tête officiel)         */
/* ------------------------------------------------------------------ */

export async function exportStudentHistoryToPdf(
  transactions: TransactionRow[],
  header: SchoolHeader & {
    studentName: string;
    studentMatricule: string;
    className?: string;
    /** Total des arriérés (FeeArrear ouverts) — multi-année */
    actualArrears?: number;
    /** Détail des arriérés par année scolaire */
    feeArrears?: Array<{
      academicYearName: string;
      totalDue: number;
      totalPaid: number;
      balanceDue: number;
      notes?: string;
    }>;
    totalDue?: number;
    totalPaid?: number;
    balance?: number;
  }
): Promise<{ blob: Blob; url: string }> {
  const jsPDF = await loadJsPdf();
  await loadAutoTable(jsPDF);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Précharger le logo de l'école
  const logoBase64 = await preloadSchoolLogo(header.schoolLogoUrl);

  // En-tête officiel
  drawOfficialHeader(doc, header, pageWidth, logoBase64);

  // Titre
  let yPos = 50;
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(13, 31, 110);
  doc.text('Historique des paiements', pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;

  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  if (header.academicYear) {
    doc.text(`Année scolaire : ${header.academicYear}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 4;
  }

  // Infos élève
  yPos += 4;
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text(header.studentName, 14, yPos);
  yPos += 5;

  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`Matricule : ${header.studentMatricule}`, 14, yPos);
  yPos += 4;
  if (header.className) {
    doc.text(`Classe : ${header.className}`, 14, yPos);
    yPos += 4;
  }
  yPos += 2;

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(14, yPos, pageWidth - 14, yPos);
  yPos += 5;

  // ─── Section Situation du compte (multi-année + FIFO) ───
  if (header.totalDue != null || header.actualArrears) {
    doc.setFont('times', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(13, 31, 110);
    doc.text('Situation du compte', 14, yPos);
    yPos += 5;

    doc.setFont('times', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);

    const totalDueVal = Number(header.totalDue ?? 0);
    const totalPaidVal = Number(header.totalPaid ?? 0);
    const balanceVal = Number(header.balance ?? 0);
    const arrearsVal = Number(header.actualArrears ?? 0);

    // Tableau récapitulatif
    const situationData: any[][] = [
      ['Total à payer (incluant arriérés)', formatAmount(totalDueVal) + ' FCFA'],
      ['Total payé', formatAmount(totalPaidVal) + ' FCFA'],
      ['Solde restant', formatAmount(balanceVal) + ' FCFA'],
    ];
    if (arrearsVal > 0) {
      situationData.push(['  dont arriérés (multi-année)', formatAmount(arrearsVal) + ' FCFA']);
    }

    (doc as any).autoTable({
      body: situationData,
      startY: yPos,
      theme: 'plain',
      styles: {
        fontSize: 9,
        cellPadding: 1.5,
        textColor: [40, 40, 40],
      },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 'auto', halign: 'right', fontStyle: 'bold' },
      },
      didParseCell: (data: any) => {
        // Ligne "dont arriérés" en ambre
        if (data.row.index === 3 && arrearsVal > 0) {
          data.cell.styles.textColor = [146, 64, 14];
          data.cell.styles.fillColor = [254, 243, 199];
        }
        // Ligne "Solde restant" en rouge si > 0, vert si = 0
        if (data.row.index === 2) {
          if (balanceVal > 0) {
            data.cell.styles.textColor = [220, 38, 38];
          } else {
            data.cell.styles.textColor = [22, 163, 74];
          }
        }
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 6;

    // ─── Détail des arriérés par année scolaire (si applicable) ───
    if (header.feeArrears && header.feeArrears.length > 0) {
      doc.setFont('times', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(146, 64, 14);
      doc.text('Arriérés par année scolaire (multi-année)', 14, yPos);
      yPos += 4;

      const arrearsTableData = header.feeArrears.map((a) => [
        a.academicYearName,
        formatAmount(a.totalDue) + ' FCFA',
        formatAmount(a.totalPaid) + ' FCFA',
        formatAmount(a.balanceDue) + ' FCFA',
      ]);
      const totalArrearsDue = header.feeArrears.reduce((s, a) => s + a.balanceDue, 0);
      arrearsTableData.push([
        'TOTAL', '', '', formatAmount(totalArrearsDue) + ' FCFA',
      ]);

      (doc as any).autoTable({
        head: [['Année scolaire', 'Dû', 'Payé', 'Reste']],
        body: arrearsTableData,
        startY: yPos,
        theme: 'grid',
        headStyles: {
          fillColor: [146, 64, 14],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'center',
        },
        bodyStyles: {
          fontSize: 9,
          cellPadding: 1.5,
        },
        columnStyles: {
          0: { cellWidth: 'auto', halign: 'left' },
          1: { cellWidth: 35, halign: 'right' },
          2: { cellWidth: 35, halign: 'right' },
          3: { cellWidth: 35, halign: 'right' },
        },
        didParseCell: (data: any) => {
          if (data.row.index === arrearsTableData.length - 1 && data.section === 'body') {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [254, 243, 199];
            data.cell.styles.textColor = [146, 64, 14];
          }
        },
      });

      yPos = (doc as any).lastAutoTable.finalY + 5;

      // Note FIFO
      doc.setFont('times', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      const noteText = 'Politique FIFO : les paiements sont affectés en priorité aux arriérés des années antérieures, puis aux frais de l\'année en cours.';
      const noteLines = doc.splitTextToSize(noteText, pageWidth - 28);
      doc.text(noteLines, 14, yPos);
      yPos += noteLines.length * 4 + 4;

      doc.setFont('times', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(13, 31, 110);
      doc.text('Historique des paiements', 14, yPos);
      yPos += 5;
      doc.setFont('times', 'normal');
    }
  }

  const totalPaid = transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const tableData = transactions.map((t) => [
    formatDateTimeFr(t.createdAt || t.date),
    t.receiptNumber || '—',
    formatAmount(t.amount),
    METHOD_LABELS[t.paymentMethod || ''] || t.paymentMethod || '—',
    t.reference || '—',
  ]);

  tableData.push(['', 'TOTAL', formatAmountFCFA(totalPaid), '', '']);

  (doc as any).autoTable({
    head: [['Date', 'Reçu', 'Montant (FCFA)', 'Méthode', 'Référence']],
    body: tableData,
    startY: yPos,
    theme: 'grid',
    headStyles: {
      fillColor: [13, 31, 110],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [40, 40, 40],
      cellPadding: 1.5,
      valign: 'middle',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 'auto', halign: 'center' },
      1: { cellWidth: 'auto', halign: 'center' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 25, halign: 'center' },
      4: { cellWidth: 'auto', halign: 'center' },
    },
    didParseCell: (data: any) => {
      if (data.row.index === tableData.length - 1 && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [254, 243, 199];
        data.cell.styles.textColor = [146, 64, 14];
        data.cell.styles.fontSize = 9;
      }
      // Colonne Montant (index 2) : vert
      if (data.section === 'body' && data.column.index === 2 && data.row.index < tableData.length - 1) {
        data.cell.styles.textColor = [6, 95, 70];
        data.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawPage: (data: any) => {
      drawFooter(doc, pageWidth, pageHeight, data.pageNumber);
    },
  });

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  return { blob, url };
}

/* ------------------------------------------------------------------ */
/*  Export EXCEL — Transactions d'une caisse                           */
/* ------------------------------------------------------------------ */

export async function exportCashRegisterTransactionsToExcel(
  register: any,
  transactions: any[],
  transfers: any[],
  header: SchoolHeader
): Promise<void> {
  const XLSX = await loadXlsx();

  const totalIn = transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const transfersIn = transfers.filter((t) => t.toCashRegisterId === register.id).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const transfersOut = transfers.filter((t) => t.fromCashRegisterId === register.id).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const data: any[][] = [
    ['', 'République du Bénin', ''],
    ['', getMinistryName(header.schoolLevel), ''],
    ['', header.schoolName || 'Établissement', ''],
    [header.schoolAddress || '', header.schoolPhone ? `Tél : ${header.schoolPhone}` : '', header.schoolEmail ? `Email : ${header.schoolEmail}` : ''],
    ['', '', ''],
    [`Caisse : ${register.code} — ${register.name}`, '', ''],
    [`Solde courant : ${formatAmountFCFA(register.currentBalance || 0)} FCFA`, '', ''],
    [header.academicYear ? `Année scolaire : ${header.academicYear}` : '', '', ''],
    ['', '', ''],
    ['Section 1 — Encaissements (paiements élèves)', '', ''],
    ['Date', 'Reçu', 'Élève', 'Montant (FCFA)', 'Méthode', 'Référence'],
  ];

  transactions.forEach((t) => {
    data.push([
      formatDateTimeFr(t.createdAt),
      t.receiptNumber || '—',
      t.studentAccount?.student ? `${t.studentAccount.student.lastName} ${t.studentAccount.student.firstName}` : '—',
      Number(t.amount) || 0,
      METHOD_LABELS[t.paymentMethod] || t.paymentMethod || '—',
      t.reference || '—',
    ]);
  });

  data.push(['']);
  data.push(['', '', 'TOTAL ENCAISSEMENTS', totalIn, '', '']);
  data.push(['']);
  data.push(['Section 2 — Transferts inter-caisses', '', '']);
  data.push(['Date', 'Type', 'Caisse source', 'Caisse cible', 'Montant (FCFA)', 'Note']);

  transfers.forEach((t) => {
    const isTransferIn = t.toCashRegisterId === register.id;
    data.push([
      formatDateTimeFr(t.createdAt),
      isTransferIn ? 'ENTRANT' : 'SORTANT',
      t.fromCode || t.fromCashRegisterId || '—',
      t.toCode || t.toCashRegisterId || '—',
      Number(t.amount) || 0,
      t.note || '—',
    ]);
  });

  data.push(['']);
  data.push(['', '', 'TOTAL TRANSFERTS ENTRANTS', transfersIn, '', '']);
  data.push(['', '', 'TOTAL TRANSFERTS SORTANTS', transfersOut, '', '']);
  data.push(['', '', 'SOLDE NET', totalIn + transfersIn - transfersOut, '', '']);

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 20 }, { wch: 22 }, { wch: 30 }, { wch: 16 }, { wch: 14 }, { wch: 22 },
  ];
  ws['!merges'] = [
    { s: { r: 0, c: 1 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 1 }, e: { r: 1, c: 2 } },
    { s: { r: 2, c: 1 }, e: { r: 2, c: 2 } },
    { s: { r: 5, c: 0 }, e: { r: 5, c: 2 } },
    { s: { r: 6, c: 0 }, e: { r: 6, c: 2 } },
    { s: { r: 7, c: 0 }, e: { r: 7, c: 2 } },
    { s: { r: 9, c: 0 }, e: { r: 9, c: 2 } },
    { s: { r: 9 + transactions.length + 4, c: 0 }, e: { r: 9 + transactions.length + 4, c: 2 } },
  ];

  // Styles
  setCellStyle(ws, 'B1', { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center' } });
  setCellStyle(ws, 'B2', { font: { bold: true, sz: 11 }, alignment: { horizontal: 'center', wrapText: true } });
  setCellStyle(ws, 'B3', { font: { bold: true, sz: 13 }, alignment: { horizontal: 'center' } });
  setCellStyle(ws, 'A6', { font: { bold: true, sz: 12, color: { rgb: '0D1F6E' } }, alignment: { horizontal: 'center' } });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Caisse');
  XLSX.writeFile(wb, `caisse-${register.code}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/* ------------------------------------------------------------------ */
/*  Export PDF — Transactions d'une caisse                             */
/* ------------------------------------------------------------------ */

export async function exportCashRegisterTransactionsToPdf(
  register: any,
  transactions: any[],
  transfers: any[],
  header: SchoolHeader
): Promise<{ blob: Blob; url: string }> {
  const jsPDF = await loadJsPdf();
  await loadAutoTable(jsPDF);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Précharger le logo de l'école
  const logoBase64 = await preloadSchoolLogo(header.schoolLogoUrl);

  drawOfficialHeader(doc, header, pageWidth, logoBase64);

  let yPos = 50;
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(13, 31, 110);
  doc.text(`Caisse : ${register.code} — ${register.name}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;

  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Solde courant : ${formatAmountFCFA(register.currentBalance || 0)} FCFA`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;

  doc.setDrawColor(13, 31, 110);
  doc.setLineWidth(0.5);
  doc.line(14, yPos, pageWidth - 14, yPos);
  yPos += 5;

  // Section 1 : Encaissements
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(13, 31, 110);
  doc.text('Section 1 — Encaissements (paiements élèves)', 14, yPos);
  yPos += 4;

  const totalIn = transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const txData = transactions.map((t) => [
    formatDateTimeFr(t.createdAt),
    t.receiptNumber || '—',
    t.studentAccount?.student ? `${t.studentAccount.student.lastName} ${t.studentAccount.student.firstName}` : '—',
    formatAmount(t.amount),
    METHOD_LABELS[t.paymentMethod] || t.paymentMethod || '—',
    t.reference || '—',
  ]);
  txData.push(['', '', 'TOTAL', formatAmountFCFA(totalIn), '', '']);

  (doc as any).autoTable({
    head: [['Date', 'Reçu', 'Élève', 'Montant (FCFA)', 'Méthode', 'Référence']],
    body: txData,
    startY: yPos,
    theme: 'grid',
    headStyles: { fillColor: [13, 31, 110], textColor: 255, fontStyle: 'bold', fontSize: 8, halign: 'center', cellPadding: 2 },
    bodyStyles: { fontSize: 8, cellPadding: 1.5, valign: 'middle', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 32, halign: 'center' },
      1: { cellWidth: 35, halign: 'center' },
      2: { cellWidth: 'auto', halign: 'left' },
      3: { cellWidth: 32, halign: 'right' },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 'auto', halign: 'center' },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data: any) => {
      if (data.row.index === txData.length - 1 && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [254, 243, 199];
        data.cell.styles.textColor = [146, 64, 14];
      }
      if (data.section === 'body' && data.column.index === 3 && data.row.index < txData.length - 1) {
        data.cell.styles.textColor = [6, 95, 70];
        data.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawPage: (data: any) => drawFooter(doc, pageWidth, pageHeight, data.pageNumber),
  });

  // Section 2 : Transferts
  let yPos2 = (doc as any).lastAutoTable.finalY + 8;
  if (yPos2 > pageHeight - 60) {
    doc.addPage();
    yPos2 = 20;
  }

  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(13, 31, 110);
  doc.text('Section 2 — Transferts inter-caisses', 14, yPos2);
  yPos2 += 4;

  const transfersIn = transfers.filter((t) => t.toCashRegisterId === register.id);
  const transfersOut = transfers.filter((t) => t.fromCashRegisterId === register.id);
  const totalTransfersIn = transfersIn.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const totalTransfersOut = transfersOut.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const trData = transfers.map((t) => {
    const isTransferIn = t.toCashRegisterId === register.id;
    return [
      formatDateTimeFr(t.createdAt),
      isTransferIn ? 'ENTRANT' : 'SORTANT',
      t.fromCode || '—',
      t.toCode || '—',
      formatAmount(t.amount),
      t.note || '—',
    ];
  });
  trData.push(['', '', '', 'TOTAL ENTRANT', formatAmountFCFA(totalTransfersIn), '']);
  trData.push(['', '', '', 'TOTAL SORTANT', formatAmountFCFA(totalTransfersOut), '']);
  trData.push(['', '', '', 'SOLDE NET', formatAmountFCFA(totalIn + totalTransfersIn - totalTransfersOut), '']);

  (doc as any).autoTable({
    head: [['Date', 'Type', 'Source', 'Cible', 'Montant (FCFA)', 'Note']],
    body: trData,
    startY: yPos2,
    theme: 'grid',
    headStyles: { fillColor: [13, 31, 110], textColor: 255, fontStyle: 'bold', fontSize: 8, halign: 'center', cellPadding: 2 },
    bodyStyles: { fontSize: 8, cellPadding: 1.5, valign: 'middle', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 32, halign: 'center' },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 30, halign: 'center' },
      3: { cellWidth: 30, halign: 'center' },
      4: { cellWidth: 32, halign: 'right' },
      5: { cellWidth: 'auto', halign: 'left' },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data: any) => {
      const lastRows = trData.length - 3;
      if (data.row.index >= lastRows && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold';
        if (data.row.index === lastRows) {
          data.cell.styles.fillColor = [209, 250, 229];
          data.cell.styles.textColor = [6, 95, 70];
        } else if (data.row.index === lastRows + 1) {
          data.cell.styles.fillColor = [254, 226, 226];
          data.cell.styles.textColor = [153, 27, 27];
        } else {
          data.cell.styles.fillColor = [254, 243, 199];
          data.cell.styles.textColor = [146, 64, 14];
        }
      }
      if (data.section === 'body' && data.column.index === 1 && data.row.index < lastRows) {
        const type = data.cell.raw;
        if (type === 'ENTRANT') {
          data.cell.styles.textColor = [6, 95, 70];
          data.cell.styles.fontStyle = 'bold';
        } else if (type === 'SORTANT') {
          data.cell.styles.textColor = [153, 27, 27];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    didDrawPage: (data: any) => drawFooter(doc, pageWidth, pageHeight, data.pageNumber),
  });

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  return { blob, url };
}

/* ------------------------------------------------------------------ */
/*  Export EXCEL — Vue globale (toutes les caisses)                    */
/* ------------------------------------------------------------------ */

export async function exportAllCashRegistersToExcel(
  registers: any[],
  transfers: any[],
  header: SchoolHeader
): Promise<void> {
  const XLSX = await loadXlsx();

  const data: any[][] = [
    ['', 'République du Bénin', ''],
    ['', getMinistryName(header.schoolLevel), ''],
    ['', header.schoolName || 'Établissement', ''],
    [header.schoolAddress || '', header.schoolPhone ? `Tél : ${header.schoolPhone}` : '', header.schoolEmail ? `Email : ${header.schoolEmail}` : ''],
    ['', '', ''],
    ['Vue globale — Toutes les caisses', '', ''],
    [header.academicYear ? `Année scolaire : ${header.academicYear}` : '', '', ''],
    ['', '', ''],
    ['Code', 'Nom', 'Emplacement', 'Solde ouverture', 'Solde courant', 'Nb transactions', 'Statut'],
  ];

  registers.forEach((r) => {
    data.push([
      r.code,
      r.name,
      r.location || '—',
      Number(r.openingBalance || 0),
      Number(r.currentBalance || 0),
      r._count?.transactions || 0,
      r.isOpen ? 'Ouverte' : (r.isActive ? 'Fermée' : 'Archivée'),
    ]);
  });

  const totalBalance = registers.reduce((sum, r) => sum + (Number(r.currentBalance) || 0), 0);
  data.push(['']);
  data.push(['', '', '', 'TOTAL', totalBalance, '', '']);

  // Section transferts
  data.push(['']);
  data.push(['Transferts inter-caisses', '', '', '', '', '', '']);
  data.push(['Date', 'Caisse source', 'Caisse cible', 'Montant (FCFA)', 'Note', 'Référence', '']);

  transfers.forEach((t) => {
    data.push([
      formatDateTimeFr(t.createdAt),
      t.fromCode || '—',
      t.toCode || '—',
      Number(t.amount) || 0,
      t.note || '—',
      t.reference || '—',
      '',
    ]);
  });

  const totalTransfers = transfers.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  data.push(['']);
  data.push(['', '', 'TOTAL', totalTransfers, '', '', '']);

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 14 }, { wch: 28 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 12 },
  ];
  ws['!merges'] = [
    { s: { r: 0, c: 1 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 1 }, e: { r: 1, c: 2 } },
    { s: { r: 2, c: 1 }, e: { r: 2, c: 2 } },
    { s: { r: 5, c: 0 }, e: { r: 5, c: 2 } },
    { s: { r: 6, c: 0 }, e: { r: 6, c: 2 } },
  ];

  setCellStyle(ws, 'B1', { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center' } });
  setCellStyle(ws, 'B2', { font: { bold: true, sz: 11 }, alignment: { horizontal: 'center', wrapText: true } });
  setCellStyle(ws, 'B3', { font: { bold: true, sz: 13 }, alignment: { horizontal: 'center' } });
  setCellStyle(ws, 'A6', { font: { bold: true, sz: 12, color: { rgb: '0D1F6E' } }, alignment: { horizontal: 'center' } });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Multi-caisses');
  XLSX.writeFile(wb, `multi-caisses-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/* ------------------------------------------------------------------ */
/*  Export PDF — Vue globale (toutes les caisses)                      */
/* ------------------------------------------------------------------ */

export async function exportAllCashRegistersToPdf(
  registers: any[],
  transfers: any[],
  header: SchoolHeader
): Promise<{ blob: Blob; url: string }> {
  const jsPDF = await loadJsPdf();
  await loadAutoTable(jsPDF);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Précharger le logo de l'école
  const logoBase64 = await preloadSchoolLogo(header.schoolLogoUrl);

  drawOfficialHeader(doc, header, pageWidth, logoBase64);

  let yPos = 50;
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(13, 31, 110);
  doc.text('Vue globale — Toutes les caisses', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  // Tableau des caisses
  const totalBalance = registers.reduce((sum, r) => sum + (Number(r.currentBalance) || 0), 0);
  const regData = registers.map((r) => [
    r.code,
    r.name,
    r.location || '—',
    formatAmount(r.openingBalance),
    formatAmount(r.currentBalance),
    String(r._count?.transactions || 0),
    r.isOpen ? 'Ouverte' : (r.isActive ? 'Fermée' : 'Archivée'),
  ]);
  regData.push(['', '', '', 'TOTAL', formatAmountFCFA(totalBalance), '', '']);

  (doc as any).autoTable({
    head: [['Code', 'Nom', 'Emplacement', 'Solde ouverture', 'Solde courant', 'Nb tx', 'Statut']],
    body: regData,
    startY: yPos,
    theme: 'grid',
    headStyles: { fillColor: [13, 31, 110], textColor: 255, fontStyle: 'bold', fontSize: 9, halign: 'center', cellPadding: 2 },
    bodyStyles: { fontSize: 8, cellPadding: 1.5, valign: 'middle', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      1: { cellWidth: 'auto', halign: 'left' },
      2: { cellWidth: 'auto', halign: 'left' },
      3: { cellWidth: 32, halign: 'right' },
      4: { cellWidth: 32, halign: 'right' },
      5: { cellWidth: 16, halign: 'center' },
      6: { cellWidth: 20, halign: 'center' },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data: any) => {
      if (data.row.index === regData.length - 1 && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [254, 243, 199];
        data.cell.styles.textColor = [146, 64, 14];
      }
    },
    didDrawPage: (data: any) => drawFooter(doc, pageWidth, pageHeight, data.pageNumber),
  });

  // Section transferts
  let yPos2 = (doc as any).lastAutoTable.finalY + 8;
  if (yPos2 > pageHeight - 60) {
    doc.addPage();
    yPos2 = 20;
  }

  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(13, 31, 110);
  doc.text('Transferts inter-caisses', 14, yPos2);
  yPos2 += 4;

  const totalTransfers = transfers.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const trData = transfers.map((t) => [
    formatDateTimeFr(t.createdAt),
    t.fromCode || '—',
    t.toCode || '—',
    formatAmount(t.amount),
    t.note || '—',
  ]);
  trData.push(['', '', 'TOTAL', formatAmountFCFA(totalTransfers), '']);

  (doc as any).autoTable({
    head: [['Date', 'Caisse source', 'Caisse cible', 'Montant (FCFA)', 'Note']],
    body: trData,
    startY: yPos2,
    theme: 'grid',
    headStyles: { fillColor: [13, 31, 110], textColor: 255, fontStyle: 'bold', fontSize: 9, halign: 'center', cellPadding: 2 },
    bodyStyles: { fontSize: 8, cellPadding: 1.5, valign: 'middle', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 32, halign: 'center' },
      1: { cellWidth: 'auto', halign: 'center' },
      2: { cellWidth: 'auto', halign: 'center' },
      3: { cellWidth: 32, halign: 'right' },
      4: { cellWidth: 'auto', halign: 'left' },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data: any) => {
      if (data.row.index === trData.length - 1 && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [254, 243, 199];
        data.cell.styles.textColor = [146, 64, 14];
      }
    },
    didDrawPage: (data: any) => drawFooter(doc, pageWidth, pageHeight, data.pageNumber),
  });

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  return { blob, url };
}

// ═══════════════════════════════════════════════════════════════════════
//  ARRÉRÉS — Export PDF (même pattern que encaissements)
// ═══════════════════════════════════════════════════════════════════════

export async function exportArrearsToPdf(
  arrears: any[],
  header: SchoolHeader
): Promise<{ blob: Blob; url: string }> {
  const jsPDF = await loadJsPdf();
  await loadAutoTable(jsPDF);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  const logoBase64 = await preloadSchoolLogo(header.schoolLogoUrl);
  drawOfficialHeader(doc, header, pageWidth, logoBase64);

  let yPos = 50;
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(13, 31, 110);
  doc.text('Liste des arriérés', pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;

  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  doc.text(`Exporté le ${dateStr}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;

  doc.setDrawColor(13, 31, 110);
  doc.setLineWidth(0.5);
  doc.line(14, yPos, pageWidth - 14, yPos);
  yPos += 5;

  const levelLabels: Record<string, string> = {
    LOW: 'Faible', MEDIUM: 'Moyen', HIGH: 'Élevé', CRITICAL: 'Critique',
  };
  const statusLabels: Record<string, string> = {
    OPEN: 'Ouvert', PARTIALLY_PAID: 'Partiellement payé', PAID: 'Soldé',
    WRITTEN_OFF: 'Abandonné', TRANSFERRED: 'Transféré',
  };

  const tableData = arrears.map((a) => [
    a.student ? `${a.student.lastName} ${a.student.firstName}` : '—',
    a.student?.studentEnrollments?.[0]?.class?.name || '—',
    a.studentFee?.feeDefinition?.label || a.notes || '—',
    formatAmount(a.totalDue),
    formatAmount(a.totalPaid),
    formatAmount(a.balanceDue),
    levelLabels[a.arrearsLevel] || a.arrearsLevel || '—',
    statusLabels[a.status] || a.status || '—',
  ]);

  const totalDue = arrears.reduce((s, a) => s + (Number(a.totalDue) || 0), 0);
  const totalPaid = arrears.reduce((s, a) => s + (Number(a.totalPaid) || 0), 0);
  const totalBalance = arrears.reduce((s, a) => s + (Number(a.balanceDue) || 0), 0);
  tableData.push(['', '', '', `TOTAUX (${arrears.length})`, formatAmountFCFA(totalDue), formatAmountFCFA(totalPaid), formatAmountFCFA(totalBalance), '']);

  (doc as any).autoTable({
    startY: yPos,
    head: [['Élève', 'Classe', 'Frais', 'Total dû', 'Payé', 'Solde', 'Niveau', 'Statut']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [13, 31, 110], fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data: any) => {
      if (data.row.index === tableData.length - 1 && data.column.index >= 4) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [220, 230, 250];
      }
    },
  });

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  return { blob, url };
}

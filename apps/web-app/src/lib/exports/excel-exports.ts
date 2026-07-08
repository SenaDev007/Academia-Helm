/**
 * ============================================================================
 * EXPORTS EXCEL — ExcelJS avec styles complets (couleurs, bordures, polices)
 * ============================================================================
 *
 * Utilise ExcelJS (chargé via CDN) au lieu de SheetJS qui ne supporte pas
 * les styles de cellules dans sa version community.
 *
 * ExcelJS supporte nativement :
 *   - Couleurs de fond (fill)
 *   - Polices (bold, color, size, italic)
 *   - Bordures (top, bottom, left, right)
 *   - Largeurs de colonnes
 *   - Hauteurs de lignes
 *   - Fusion de cellules
 *   - Alignement (horizontal, vertical, wrapText)
 *
 * Design : en-tête officielle République du Bénin + tableau stylé avec
 * codes couleur (payé=vert, partiel=ambre, impayé=rouge).
 * ============================================================================
 */

import { formatCurrency } from '@/lib/utils';
import {
  transactionsFilename,
  studentAccountsFilename,
  cashRegisterFilename,
  allCashRegistersFilename,
} from './filename-helpers';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SchoolHeader {
  schoolName: string;
  schoolLogoUrl?: string | null;
  academicYear?: string;
  dateFrom?: string;
  dateTo?: string;
  schoolLevel?: 'MATERNELLE' | 'PRIMAIRE' | 'SECONDAIRE' | string;
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
/*  Chargement dynamique ExcelJS via CDN                               */
/* ------------------------------------------------------------------ */

let exceljsPromise: Promise<any> | null = null;

function loadExcelJS(): Promise<any> {
  if (exceljsPromise) return exceljsPromise;
  exceljsPromise = new Promise((resolve, reject) => {
    if ((window as any).ExcelJS) {
      resolve((window as any).ExcelJS);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
    script.async = true;
    script.onload = () => {
      const ExcelJS = (window as any).ExcelJS;
      if (!ExcelJS) {
        reject(new Error('ExcelJS indisponible après chargement'));
        return;
      }
      resolve(ExcelJS);
    };
    script.onerror = () => reject(new Error('Impossible de charger ExcelJS depuis le CDN'));
    document.head.appendChild(script);
  });
  return exceljsPromise;
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

function getPaymentStatus(account: StudentAccountRow): 'PAID' | 'PARTIAL' | 'UNPAID' {
  const balance = Number(account.balance) || 0;
  const paid = Number(account.totalPaid) || 0;
  if (balance <= 0) return 'PAID';
  if (paid > 0) return 'PARTIAL';
  return 'UNPAID';
}

/* ------------------------------------------------------------------ */
/*  Couleurs et styles partagés                                        */
/* ------------------------------------------------------------------ */

const COLORS = {
  headerBlue: { argb: 'FF0D1F6E' },
  white: { argb: 'FFFFFFFF' },
  lightGray: { argb: 'FFF8FAFC' },
  whitePure: { argb: 'FFFFFFFF' },
  amberBg: { argb: 'FFFEF3C7' },
  amberText: { argb: 'FF92400E' },
  emeraldBg: { argb: 'FFD1FAE5' },
  emeraldText: { argb: 'FF065F46' },
  roseBg: { argb: 'FFFEE2E2' },
  roseText: { argb: 'FF991B1B' },
  blueBg: { argb: 'FFEFF6FF' },
  blueText: { argb: 'FF1E40AF' },
  darkText: { argb: 'FF1A1A1A' },
  grayText: { argb: 'FF6B7280' },
  borderGray: { argb: 'FFE2E8F0' },
  borderBlue: { argb: 'FF0D1F6E' },
};

const thinBorder = {
  top: { style: 'thin', color: COLORS.borderGray },
  bottom: { style: 'thin', color: COLORS.borderGray },
  left: { style: 'thin', color: COLORS.borderGray },
  right: { style: 'thin', color: COLORS.borderGray },
};

const thickBorder = {
  top: { style: 'medium', color: COLORS.amberText },
  bottom: { style: 'medium', color: COLORS.amberText },
  left: { style: 'thin', color: COLORS.amberText },
  right: { style: 'thin', color: COLORS.amberText },
};

/* ------------------------------------------------------------------ */
/*  Helper : ajouter l'en-tête officielle à une feuille                */
/* ------------------------------------------------------------------ */

function addOfficialHeader(ws: any, header: SchoolHeader, numCols: number): number {
  let row = 1;

  // Ligne 1 : République du Bénin
  ws.mergeCells(row, 1, row, numCols);
  const cell1 = ws.getCell(row, 1);
  cell1.value = 'République du Bénin';
  cell1.font = { bold: true, size: 14, color: COLORS.darkText };
  cell1.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(row).height = 22;
  row++;

  // Ligne 2 : Ministère
  ws.mergeCells(row, 1, row, numCols);
  const cell2 = ws.getCell(row, 1);
  cell2.value = getMinistryName(header.schoolLevel);
  cell2.font = { bold: true, size: 11, color: COLORS.darkText };
  cell2.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  ws.getRow(row).height = 30;
  row++;

  // Ligne 3 : Nom école
  ws.mergeCells(row, 1, row, numCols);
  const cell3 = ws.getCell(row, 1);
  cell3.value = header.schoolName || 'Établissement';
  cell3.font = { bold: true, size: 13, color: COLORS.headerBlue };
  cell3.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(row).height = 20;
  row++;

  // Ligne 4 : Contact
  const contactParts = [
    header.schoolSlogan ? `« ${header.schoolSlogan} »` : null,
    header.schoolAddress,
    header.schoolPhone ? `Tél : ${header.schoolPhone}` : null,
    header.schoolEmail ? `Email : ${header.schoolEmail}` : null,
  ].filter(Boolean);
  ws.mergeCells(row, 1, row, numCols);
  const cell4 = ws.getCell(row, 1);
  cell4.value = contactParts.join(' · ');
  cell4.font = { italic: true, size: 9, color: COLORS.grayText };
  cell4.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(row).height = 16;
  row++;

  // Ligne 5 : vide
  row++;

  // Ligne 6 : Titre du document
  return row;
}

/* ------------------------------------------------------------------ */
/*  Helper : styliser une cellule d'en-tête de tableau                 */
/* ------------------------------------------------------------------ */

function styleHeaderCell(cell: any) {
  cell.font = { bold: true, color: COLORS.white, size: 11 };
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: COLORS.headerBlue,
  };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  cell.border = {
    top: { style: 'thin', color: COLORS.headerBlue },
    bottom: { style: 'thin', color: COLORS.headerBlue },
    left: { style: 'thin', color: COLORS.headerBlue },
    right: { style: 'thin', color: COLORS.headerBlue },
  };
}

/* ------------------------------------------------------------------ */
/*  Helper : styliser une cellule de données                           */
/* ------------------------------------------------------------------ */

function styleDataCell(
  cell: any,
  options: {
    bold?: boolean;
    color?: any;
    fill?: any;
    align?: 'left' | 'right' | 'center';
    isEven?: boolean;
    border?: any;
  } = {}
) {
  cell.font = {
    size: 10,
    bold: options.bold || false,
    color: options.color || COLORS.darkText,
  };
  if (options.fill) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: options.fill };
  } else if (options.isEven) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: COLORS.lightGray };
  }
  cell.alignment = {
    horizontal: options.align || 'center',
    vertical: 'middle',
  };
  cell.border = options.border || thinBorder;
}

/* ------------------------------------------------------------------ */
/*  Helper : styliser une cellule de total                             */
/* ------------------------------------------------------------------ */

function styleTotalCell(cell: any, align: 'left' | 'right' | 'center' = 'center') {
  cell.font = { bold: true, size: 11, color: COLORS.amberText };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: COLORS.amberBg };
  cell.alignment = { horizontal: align, vertical: 'middle' };
  cell.border = thickBorder;
}

/* ------------------------------------------------------------------ */
/*  Helper : télécharger le fichier Excel                              */
/* ------------------------------------------------------------------ */

async function downloadExcel(workbook: any, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------------------------------------------ */
/*  Export EXCEL — Encaissements                                       */
/* ------------------------------------------------------------------ */

export async function exportTransactionsToExcel(
  transactions: TransactionRow[],
  header: SchoolHeader
): Promise<void> {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Encaissements', {
    properties: { defaultRowHeight: 18 },
  });

  const numCols = 7;
  let row = addOfficialHeader(ws, header, numCols);

  // Titre document
  ws.mergeCells(row, 1, row, numCols);
  const titleCell = ws.getCell(row, 1);
  titleCell.value = 'Historique des encaissements';
  titleCell.font = { bold: true, size: 12, color: COLORS.headerBlue };
  titleCell.alignment = { horizontal: 'center' };
  ws.getRow(row).height = 22;
  row++;

  // Année + période
  if (header.academicYear) {
    ws.mergeCells(row, 1, row, numCols);
    ws.getCell(row, 1).value = `Année scolaire : ${header.academicYear}`;
    ws.getCell(row, 1).font = { italic: true, size: 10, color: COLORS.grayText };
    ws.getCell(row, 1).alignment = { horizontal: 'center' };
    row++;
  }
  ws.mergeCells(row, 1, row, numCols);
  ws.getCell(row, 1).value = formatPeriod(header);
  ws.getCell(row, 1).font = { italic: true, size: 10, color: COLORS.grayText };
  ws.getCell(row, 1).alignment = { horizontal: 'center' };
  row++;

  // Ligne vide
  row++;

  // En-tête tableau
  const headers = ['Date', 'Reçu', 'Matricule', 'Élève', 'Montant (FCFA)', 'Méthode', 'Référence'];
  headers.forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    styleHeaderCell(cell);
  });
  ws.getRow(row).height = 24;
  row++;

  // Données
  const totalAmount = transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  transactions.forEach((t, idx) => {
    const isEven = idx % 2 === 0;
    const values = [
      formatDateTimeFr(t.createdAt || t.date),
      t.receiptNumber || '—',
      getStudentMatricule(t),
      getStudentName(t),
      Number(t.amount) || 0,
      METHOD_LABELS[t.paymentMethod || ''] || t.paymentMethod || '—',
      t.reference || '—',
    ];
    values.forEach((v, i) => {
      const cell = ws.getCell(row, i + 1);
      cell.value = v;
      styleDataCell(cell, {
        isEven,
        bold: i === 4,
        color: i === 4 ? COLORS.emeraldText : COLORS.darkText,
        align: i === 3 ? 'left' : i === 4 ? 'right' : 'center',
      });
    });
    row++;
  });

  // Ligne total
  ws.mergeCells(row, 1, row, 4);
  ws.getCell(row, 1).value = 'TOTAL';
  styleTotalCell(ws.getCell(row, 1), 'right');
  const totalCell = ws.getCell(row, 5);
  totalCell.value = totalAmount;
  styleTotalCell(totalCell, 'right');
  ws.mergeCells(row, 6, row, 7);
  styleTotalCell(ws.getCell(row, 6), 'center');
  ws.getRow(row).height = 24;

  // Largeurs colonnes
  ws.columns = [
    { width: 20 }, { width: 22 }, { width: 16 }, { width: 30 }, { width: 16 }, { width: 14 }, { width: 22 },
  ];

  await downloadExcel(workbook, transactionsFilename(header.dateFrom, header.dateTo, 'xlsx'));
}

/* ------------------------------------------------------------------ */
/*  Export EXCEL — Comptes élèves                                      */
/* ------------------------------------------------------------------ */

export async function exportStudentAccountsToExcel(
  accounts: StudentAccountRow[],
  header: SchoolHeader & { classFilter?: string }
): Promise<void> {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Comptes élèves', {
    properties: { defaultRowHeight: 18 },
  });

  const numCols = 10;
  let row = addOfficialHeader(ws, header, numCols);

  // Titre
  ws.mergeCells(row, 1, row, numCols);
  ws.getCell(row, 1).value = 'Comptes élèves';
  ws.getCell(row, 1).font = { bold: true, size: 12, color: COLORS.headerBlue };
  ws.getCell(row, 1).alignment = { horizontal: 'center' };
  ws.getRow(row).height = 22;
  row++;

  // Année + classe
  if (header.academicYear) {
    ws.mergeCells(row, 1, row, numCols);
    ws.getCell(row, 1).value = `Année scolaire : ${header.academicYear}`;
    ws.getCell(row, 1).font = { italic: true, size: 10, color: COLORS.grayText };
    ws.getCell(row, 1).alignment = { horizontal: 'center' };
    row++;
  }
  ws.mergeCells(row, 1, row, numCols);
  ws.getCell(row, 1).value = header.classFilter ? `Classe : ${header.classFilter}` : 'Toutes les classes';
  ws.getCell(row, 1).font = { italic: true, size: 10, color: COLORS.grayText };
  ws.getCell(row, 1).alignment = { horizontal: 'center' };
  row++;

  // Ligne vide
  row++;

  // En-tête tableau
  const headers = ['Matricule', 'Nom', 'Prénom', 'Classe', 'Niveau', 'Arriérés', 'Solde dû', 'Payé', 'À payer', 'Statut'];
  headers.forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    styleHeaderCell(cell);
  });
  ws.getRow(row).height = 24;
  row++;

  // Données avec codes couleur statut
  const STATUS_CONFIG = {
    PAID: { bg: COLORS.emeraldBg, text: COLORS.emeraldText, label: 'Soldé' },
    PARTIAL: { bg: COLORS.amberBg, text: COLORS.amberText, label: 'Partiel' },
    UNPAID: { bg: COLORS.roseBg, text: COLORS.roseText, label: 'Impayé' },
  };

  const totalDue = accounts.reduce((s, a) => s + (Number(a.totalDue) || 0), 0);
  const totalPaid = accounts.reduce((s, a) => s + (Number(a.totalPaid) || 0), 0);
  const totalBalance = accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const totalArrears = accounts.reduce((s, a) => s + (Number(a.actualArrears) || 0), 0);

  accounts.forEach((a, idx) => {
    const isEven = idx % 2 === 0;
    const status = getPaymentStatus(a);
    const sc = STATUS_CONFIG[status];
    const className = a.studentEnrollments?.[0]?.class?.name || '—';
    const level = a.student?.schoolLevel?.name || '—';
    const arrearAmount = Number(a.actualArrears) || 0;

    const values = [
      a.student?.studentCode || a.student?.matricule || '—',
      a.student?.lastName || '—',
      a.student?.firstName || '—',
      className,
      level,
      arrearAmount,
      Number(a.balance) || 0,
      Number(a.totalPaid) || 0,
      Number(a.totalDue) || 0,
      sc.label,
    ];
    values.forEach((v, i) => {
      const cell = ws.getCell(row, i + 1);
      cell.value = v;
      // Colonne statut (index 9) : couleur spéciale
      if (i === 9) {
        styleDataCell(cell, { fill: sc.bg, color: sc.text, bold: true, align: 'center' });
      } else if (i === 5 && arrearAmount > 0) {
        // Colonne Arriérés : surlignage ambre si > 0
        styleDataCell(cell, { fill: COLORS.amberBg, color: COLORS.amberText, bold: true, align: 'right' });
      } else if (i >= 5 && i <= 8) {
        styleDataCell(cell, { isEven, bold: true, align: 'right' });
      } else if (i === 1 || i === 2) {
        styleDataCell(cell, { isEven, align: 'left' });
      } else {
        styleDataCell(cell, { isEven, align: 'center' });
      }
    });
    row++;
  });

  // Ligne total
  ws.mergeCells(row, 1, row, 5);
  ws.getCell(row, 1).value = 'TOTAL';
  styleTotalCell(ws.getCell(row, 1), 'right');
  [totalArrears, totalBalance, totalPaid, totalDue].forEach((v, i) => {
    const cell = ws.getCell(row, 6 + i);
    cell.value = v;
    styleTotalCell(cell, 'right');
  });
  styleTotalCell(ws.getCell(row, 10), 'center');
  ws.getRow(row).height = 24;

  // Largeurs colonnes
  ws.columns = [
    { width: 16 }, { width: 20 }, { width: 20 }, { width: 18 }, { width: 14 },
    { width: 14 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 12 },
  ];

  await downloadExcel(workbook, studentAccountsFilename(header.classFilter, 'xlsx'));
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
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Caisse', {
    properties: { defaultRowHeight: 18 },
  });

  const numCols = 6;
  let row = addOfficialHeader(ws, header, numCols);

  // Titre
  ws.mergeCells(row, 1, row, numCols);
  ws.getCell(row, 1).value = `Caisse : ${register.code} — ${register.name}`;
  ws.getCell(row, 1).font = { bold: true, size: 12, color: COLORS.headerBlue };
  ws.getCell(row, 1).alignment = { horizontal: 'center' };
  ws.getRow(row).height = 22;
  row++;

  ws.mergeCells(row, 1, row, numCols);
  ws.getCell(row, 1).value = `Solde courant : ${formatCurrency(Number(register.currentBalance || 0))} FCFA`;
  ws.getCell(row, 1).font = { italic: true, size: 10, color: COLORS.grayText };
  ws.getCell(row, 1).alignment = { horizontal: 'center' };
  row++;

  // Ligne vide
  row++;

  // Section 1 : Encaissements
  ws.mergeCells(row, 1, row, numCols);
  ws.getCell(row, 1).value = 'Section 1 — Encaissements (paiements élèves)';
  ws.getCell(row, 1).font = { bold: true, size: 11, color: COLORS.headerBlue };
  ws.getCell(row, 1).alignment = { horizontal: 'left' };
  row++;

  const txHeaders = ['Date', 'Reçu', 'Élève', 'Montant (FCFA)', 'Méthode', 'Référence'];
  txHeaders.forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    styleHeaderCell(cell);
  });
  ws.getRow(row).height = 24;
  row++;

  const totalIn = transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  transactions.forEach((t, idx) => {
    const isEven = idx % 2 === 0;
    const values = [
      formatDateTimeFr(t.createdAt),
      t.receiptNumber || '—',
      t.studentAccount?.student ? `${t.studentAccount.student.lastName} ${t.studentAccount.student.firstName}` : '—',
      Number(t.amount) || 0,
      METHOD_LABELS[t.paymentMethod] || t.paymentMethod || '—',
      t.reference || '—',
    ];
    values.forEach((v, i) => {
      const cell = ws.getCell(row, i + 1);
      cell.value = v;
      styleDataCell(cell, {
        isEven,
        bold: i === 3,
        color: i === 3 ? COLORS.emeraldText : COLORS.darkText,
        align: i === 2 ? 'left' : i === 3 ? 'right' : 'center',
      });
    });
    row++;
  });

  // Total encaissements
  ws.mergeCells(row, 1, row, 3);
  ws.getCell(row, 1).value = 'TOTAL ENCAISSEMENTS';
  styleTotalCell(ws.getCell(row, 1), 'right');
  ws.getCell(row, 4).value = totalIn;
  styleTotalCell(ws.getCell(row, 4), 'right');
  ws.mergeCells(row, 5, row, 6);
  styleTotalCell(ws.getCell(row, 5), 'center');
  row++;

  // Ligne vide
  row++;

  // Section 2 : Transferts
  ws.mergeCells(row, 1, row, numCols);
  ws.getCell(row, 1).value = 'Section 2 — Transferts inter-caisses';
  ws.getCell(row, 1).font = { bold: true, size: 11, color: COLORS.headerBlue };
  ws.getCell(row, 1).alignment = { horizontal: 'left' };
  row++;

  const trHeaders = ['Date', 'Type', 'Caisse source', 'Caisse cible', 'Montant (FCFA)', 'Note'];
  trHeaders.forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    styleHeaderCell(cell);
  });
  ws.getRow(row).height = 24;
  row++;

  const transfersIn = transfers.filter((t) => t.toCashRegisterId === register.id);
  const transfersOut = transfers.filter((t) => t.fromCashRegisterId === register.id);
  const totalTransfersIn = transfersIn.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const totalTransfersOut = transfersOut.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  transfers.forEach((t, idx) => {
    const isTransferIn = t.toCashRegisterId === register.id;
    const isEven = idx % 2 === 0;
    const values = [
      formatDateTimeFr(t.createdAt),
      isTransferIn ? 'ENTRANT' : 'SORTANT',
      t.fromCode || '—',
      t.toCode || '—',
      Number(t.amount) || 0,
      t.note || '—',
    ];
    values.forEach((v, i) => {
      const cell = ws.getCell(row, i + 1);
      cell.value = v;
      if (i === 1) {
        // Type : vert si ENTRANT, rouge si SORTANT
        styleDataCell(cell, {
          isEven,
          bold: true,
          color: isTransferIn ? COLORS.emeraldText : COLORS.roseText,
          fill: isTransferIn ? COLORS.emeraldBg : COLORS.roseBg,
          align: 'center',
        });
      } else if (i === 4) {
        styleDataCell(cell, {
          isEven,
          bold: true,
          color: isTransferIn ? COLORS.emeraldText : COLORS.roseText,
          align: 'right',
        });
      } else if (i === 5) {
        styleDataCell(cell, { isEven, align: 'left' });
      } else {
        styleDataCell(cell, { isEven, align: 'center' });
      }
    });
    row++;
  });

  // Totaux transferts
  ws.mergeCells(row, 1, row, 4);
  ws.getCell(row, 1).value = 'TOTAL TRANSFERTS ENTRANTS';
  styleTotalCell(ws.getCell(row, 1), 'right');
  ws.getCell(row, 5).value = totalTransfersIn;
  styleTotalCell(ws.getCell(row, 5), 'right');
  ws.getCell(row, 6).value = '';
  styleTotalCell(ws.getCell(row, 6), 'center');
  row++;

  ws.mergeCells(row, 1, row, 4);
  ws.getCell(row, 1).value = 'TOTAL TRANSFERTS SORTANTS';
  styleTotalCell(ws.getCell(row, 1), 'right');
  ws.getCell(row, 5).value = totalTransfersOut;
  styleTotalCell(ws.getCell(row, 5), 'right');
  ws.getCell(row, 6).value = '';
  styleTotalCell(ws.getCell(row, 6), 'center');
  row++;

  ws.mergeCells(row, 1, row, 4);
  ws.getCell(row, 1).value = 'SOLDE NET';
  styleTotalCell(ws.getCell(row, 1), 'right');
  ws.getCell(row, 5).value = totalIn + totalTransfersIn - totalTransfersOut;
  styleTotalCell(ws.getCell(row, 5), 'right');
  ws.getCell(row, 6).value = '';
  styleTotalCell(ws.getCell(row, 6), 'center');
  ws.getRow(row).height = 24;

  // Largeurs colonnes
  ws.columns = [
    { width: 20 }, { width: 12 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 30 },
  ];

  await downloadExcel(workbook, cashRegisterFilename(register.code, register.name, 'xlsx'));
}

/* ------------------------------------------------------------------ */
/*  Export EXCEL — Vue globale (toutes les caisses)                    */
/* ------------------------------------------------------------------ */

export async function exportAllCashRegistersToExcel(
  registers: any[],
  transfers: any[],
  header: SchoolHeader
): Promise<void> {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Multi-caisses', {
    properties: { defaultRowHeight: 18 },
  });

  const numCols = 7;
  let row = addOfficialHeader(ws, header, numCols);

  // Titre
  ws.mergeCells(row, 1, row, numCols);
  ws.getCell(row, 1).value = 'Vue globale — Toutes les caisses';
  ws.getCell(row, 1).font = { bold: true, size: 12, color: COLORS.headerBlue };
  ws.getCell(row, 1).alignment = { horizontal: 'center' };
  ws.getRow(row).height = 22;
  row++;

  if (header.academicYear) {
    ws.mergeCells(row, 1, row, numCols);
    ws.getCell(row, 1).value = `Année scolaire : ${header.academicYear}`;
    ws.getCell(row, 1).font = { italic: true, size: 10, color: COLORS.grayText };
    ws.getCell(row, 1).alignment = { horizontal: 'center' };
    row++;
  }

  row++;

  // Tableau des caisses
  const regHeaders = ['Code', 'Nom', 'Emplacement', 'Solde ouverture', 'Solde courant', 'Nb transactions', 'Statut'];
  regHeaders.forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    styleHeaderCell(cell);
  });
  ws.getRow(row).height = 24;
  row++;

  const totalBalance = registers.reduce((sum, r) => sum + (Number(r.currentBalance) || 0), 0);
  registers.forEach((r, idx) => {
    const isEven = idx % 2 === 0;
    const values = [
      r.code,
      r.name,
      r.location || '—',
      Number(r.openingBalance || 0),
      Number(r.currentBalance || 0),
      r._count?.transactions || 0,
      r.isOpen ? 'Ouverte' : (r.isActive ? 'Fermée' : 'Archivée'),
    ];
    values.forEach((v, i) => {
      const cell = ws.getCell(row, i + 1);
      cell.value = v;
      if (i === 4) {
        styleDataCell(cell, { isEven, bold: true, color: COLORS.emeraldText, align: 'right' });
      } else if (i === 1) {
        styleDataCell(cell, { isEven, align: 'left' });
      } else if (i === 6) {
        const isOpen = r.isOpen;
        styleDataCell(cell, {
          isEven,
          bold: true,
          color: isOpen ? COLORS.emeraldText : COLORS.grayText,
          fill: isOpen ? COLORS.emeraldBg : undefined,
          align: 'center',
        });
      } else {
        styleDataCell(cell, { isEven, align: i === 3 ? 'right' : 'center' });
      }
    });
    row++;
  });

  // Total
  ws.mergeCells(row, 1, row, 4);
  ws.getCell(row, 1).value = 'TOTAL';
  styleTotalCell(ws.getCell(row, 1), 'right');
  ws.getCell(row, 5).value = totalBalance;
  styleTotalCell(ws.getCell(row, 5), 'right');
  ws.mergeCells(row, 6, row, 7);
  styleTotalCell(ws.getCell(row, 6), 'center');
  ws.getRow(row).height = 24;
  row++;

  // Ligne vide
  row++;

  // Section transferts
  ws.mergeCells(row, 1, row, numCols);
  ws.getCell(row, 1).value = 'Transferts inter-caisses';
  ws.getCell(row, 1).font = { bold: true, size: 11, color: COLORS.headerBlue };
  ws.getCell(row, 1).alignment = { horizontal: 'left' };
  row++;

  const trHeaders = ['Date', 'Caisse source', 'Caisse cible', 'Montant (FCFA)', 'Note', '', ''];
  trHeaders.forEach((h, i) => {
    if (!h) return;
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    styleHeaderCell(cell);
  });
  ws.getRow(row).height = 24;
  row++;

  const totalTransfers = transfers.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  transfers.forEach((t, idx) => {
    const isEven = idx % 2 === 0;
    const values = [
      formatDateTimeFr(t.createdAt),
      t.fromCode || '—',
      t.toCode || '—',
      Number(t.amount) || 0,
      t.note || '—',
    ];
    values.forEach((v, i) => {
      const cell = ws.getCell(row, i + 1);
      cell.value = v;
      styleDataCell(cell, {
        isEven,
        bold: i === 3,
        color: i === 3 ? COLORS.emeraldText : COLORS.darkText,
        align: i === 4 ? 'left' : i === 3 ? 'right' : 'center',
      });
    });
    row++;
  });

  // Total transferts
  ws.mergeCells(row, 1, row, 3);
  ws.getCell(row, 1).value = 'TOTAL';
  styleTotalCell(ws.getCell(row, 1), 'right');
  ws.getCell(row, 4).value = totalTransfers;
  styleTotalCell(ws.getCell(row, 4), 'right');
  ws.mergeCells(row, 5, row, 7);
  styleTotalCell(ws.getCell(row, 5), 'center');
  ws.getRow(row).height = 24;

  // Largeurs colonnes
  ws.columns = [
    { width: 14 }, { width: 28 }, { width: 22 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 12 },
  ];

  await downloadExcel(workbook, allCashRegistersFilename('xlsx'));
}

// ═══════════════════════════════════════════════════════════════════════
//  DÉPENSES — Export Excel
// ═══════════════════════════════════════════════════════════════════════

export async function exportExpensesToExcel(
  expenses: any[],
  filename: string,
): Promise<void> {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Dépenses', {
    properties: { defaultRowHeight: 18 },
  });

  const numCols = 7;

  // Titre
  ws.mergeCells(1, 1, 1, numCols);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = 'Liste des dépenses';
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF1E3A8A' } };
  titleCell.alignment = { horizontal: 'center' };
  ws.getRow(1).height = 28;

  // Date d'export
  ws.mergeCells(2, 1, 2, numCols);
  ws.getCell(2, 1).value = `Exporté le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  ws.getCell(2, 1).font = { italic: true, size: 10, color: { argb: 'FF64748B' } };
  ws.getCell(2, 1).alignment = { horizontal: 'center' };

  let row = 4;

  // En-têtes
  const headers = ['Date', 'Catégorie', 'Description', 'Montant (FCFA)', 'Demandé par', 'Statut', 'Approuvé par'];
  headers.forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.alignment = { horizontal: i === 3 ? 'right' : 'left', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' },
    };
  });
  ws.getRow(row).height = 22;
  row++;

  // Données
  let totalAmount = 0;
  for (const e of expenses) {
    const statusLabels: Record<string, string> = {
      APPROVED: 'Approuvé',
      PENDING: 'En attente',
      REJECTED: 'Rejeté',
    };
    const status = statusLabels[e.status] || e.status;
    const amount = Number(e.amount) || 0;
    if (e.status === 'APPROVED') totalAmount += amount;

    const dateStr = e.createdAt
      ? new Date(e.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : e.expenseDate
        ? new Date(e.expenseDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '—';

    const category = e.category?.name || e.category || '—';
    const requester = e.requester
      ? [e.requester.firstName, e.requester.lastName].filter(Boolean).join(' ')
      : e.createdBy || '—';
    const approver = e.approver
      ? [e.approver.firstName, e.approver.lastName].filter(Boolean).join(' ')
      : e.approvedBy || '—';

    const values = [dateStr, category, e.description || '—', amount, requester, status, approver];
    values.forEach((v, i) => {
      const cell = ws.getCell(row, i + 1);
      cell.value = v;
      cell.font = { size: 10 };
      cell.alignment = { horizontal: i === 3 ? 'right' : 'left', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      if (i === 3) {
        cell.numFmt = '#,##0';
        cell.font = { size: 10, bold: true };
      }
    });

    // Couleur statut
    const statusCell = ws.getCell(row, 6);
    if (e.status === 'APPROVED') {
      statusCell.font = { size: 10, color: { argb: 'FF059669' }, bold: true };
    } else if (e.status === 'PENDING') {
      statusCell.font = { size: 10, color: { argb: 'FFD97706' }, bold: true };
    } else if (e.status === 'REJECTED') {
      statusCell.font = { size: 10, color: { argb: 'FFDC2626' }, bold: true };
    }

    row++;
  }

  // Ligne total
  if (expenses.length > 0) {
    ws.mergeCells(row, 1, row, 3);
    const totalLabel = ws.getCell(row, 1);
    totalLabel.value = 'TOTAL DÉPENSES APPROUVÉES';
    totalLabel.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    totalLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    totalLabel.alignment = { horizontal: 'right', vertical: 'middle' };

    const totalCell = ws.getCell(row, 4);
    totalCell.value = totalAmount;
    totalCell.numFmt = '#,##0';
    totalCell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    totalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    totalCell.alignment = { horizontal: 'right', vertical: 'middle' };

    ws.mergeCells(row, 5, row, 7);
    const emptyCell = ws.getCell(row, 5);
    emptyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    ws.getRow(row).height = 26;
  }

  // Largeurs colonnes
  ws.columns = [
    { width: 14 }, { width: 22 }, { width: 35 }, { width: 16 }, { width: 22 }, { width: 14 }, { width: 22 },
  ];

  await downloadExcel(workbook, filename);
}

// ═══════════════════════════════════════════════════════════════════════
//  ARRÉRÉS — Export Excel (même pattern que encaissements)
// ═══════════════════════════════════════════════════════════════════════

export async function exportArrearsToExcel(
  arrears: any[],
  header: SchoolHeader
): Promise<void> {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Arriérés', {
    properties: { defaultRowHeight: 18 },
  });

  const numCols = 8;
  let row = addOfficialHeader(ws, header, numCols);

  // Titre document
  ws.mergeCells(row, 1, row, numCols);
  const titleCell = ws.getCell(row, 1);
  titleCell.value = 'Liste des arriérés';
  titleCell.font = { bold: true, size: 12, color: COLORS.headerBlue };
  titleCell.alignment = { horizontal: 'center' };
  ws.getRow(row).height = 22;
  row++;

  // Date d'export
  ws.mergeCells(row, 1, row, numCols);
  ws.getCell(row, 1).value = `Exporté le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  ws.getCell(row, 1).font = { italic: true, size: 10, color: COLORS.grayText };
  ws.getCell(row, 1).alignment = { horizontal: 'center' };
  row += 2;

  // En-têtes
  const headers = ['Élève', 'Classe', 'Frais', 'Total dû (FCFA)', 'Payé (FCFA)', 'Solde (FCFA)', 'Niveau', 'Statut'];
  headers.forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.alignment = { horizontal: i >= 3 && i <= 5 ? 'right' : 'left', vertical: 'middle' };
    cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
  });
  ws.getRow(row).height = 22;
  row++;

  // Données
  const levelLabels: Record<string, string> = { LOW: 'Faible', MEDIUM: 'Moyen', HIGH: 'Élevé', CRITICAL: 'Critique' };
  const statusLabels: Record<string, string> = { OPEN: 'Ouvert', PARTIALLY_PAID: 'Partiellement payé', PAID: 'Soldé', WRITTEN_OFF: 'Abandonné', TRANSFERRED: 'Transféré' };
  let totalBalance = 0;
  let totalDue = 0;
  let totalPaid = 0;

  for (const a of arrears) {
    const amount = Number(a.balanceDue) || 0;
    totalBalance += amount;
    totalDue += Number(a.totalDue) || 0;
    totalPaid += Number(a.totalPaid) || 0;
    const values = [
      a.student ? `${a.student.lastName} ${a.student.firstName}` : '—',
      a.student?.studentEnrollments?.[0]?.class?.name || '—',
      a.studentFee?.feeDefinition?.label || a.notes || '—',
      Number(a.totalDue) || 0,
      Number(a.totalPaid) || 0,
      amount,
      levelLabels[a.arrearsLevel] || a.arrearsLevel || '—',
      statusLabels[a.status] || a.status || '—',
    ];
    values.forEach((v, i) => {
      const cell = ws.getCell(row, i + 1);
      cell.value = v;
      cell.font = { size: 10 };
      cell.alignment = { horizontal: i >= 3 && i <= 5 ? 'right' : 'left', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      if (i >= 3 && i <= 5) cell.numFmt = '#,##0';
    });
    // Couleur niveau
    const levelCell = ws.getCell(row, 7);
    if (a.arrearsLevel === 'CRITICAL') levelCell.font = { size: 10, color: { argb: 'FFDC2626' }, bold: true };
    else if (a.arrearsLevel === 'HIGH') levelCell.font = { size: 10, color: { argb: 'FFEA580C' }, bold: true };
    else if (a.arrearsLevel === 'MEDIUM') levelCell.font = { size: 10, color: { argb: 'FFD97706' }, bold: true };
    row++;
  }

  // Ligne total
  if (arrears.length > 0) {
    ws.mergeCells(row, 1, row, 3);
    const totalLabel = ws.getCell(row, 1);
    totalLabel.value = `TOTAUX (${arrears.length} arriéré${arrears.length > 1 ? 's' : ''})`;
    totalLabel.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    totalLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    totalLabel.alignment = { horizontal: 'right', vertical: 'middle' };

    const totalDueCell = ws.getCell(row, 4);
    totalDueCell.value = totalDue;
    totalDueCell.numFmt = '#,##0';
    totalDueCell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    totalDueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    totalDueCell.alignment = { horizontal: 'right', vertical: 'middle' };

    const totalPaidCell = ws.getCell(row, 5);
    totalPaidCell.value = totalPaid;
    totalPaidCell.numFmt = '#,##0';
    totalPaidCell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    totalPaidCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    totalPaidCell.alignment = { horizontal: 'right', vertical: 'middle' };

    const totalBalanceCell = ws.getCell(row, 6);
    totalBalanceCell.value = totalBalance;
    totalBalanceCell.numFmt = '#,##0';
    totalBalanceCell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    totalBalanceCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    totalBalanceCell.alignment = { horizontal: 'right', vertical: 'middle' };

    ws.mergeCells(row, 7, row, 8);
    ws.getCell(row, 7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    ws.getRow(row).height = 26;
  }

  // Largeurs colonnes
  ws.columns = [
    { width: 24 }, { width: 16 }, { width: 28 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 16 },
  ];

  const date = new Date().toISOString().slice(0, 10);
  await downloadExcel(workbook, `Arrieres_recouvrement_${date}.xlsx`);
}

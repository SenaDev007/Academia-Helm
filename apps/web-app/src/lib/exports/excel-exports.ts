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

  const numCols = 9;
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
  const headers = ['Matricule', 'Nom', 'Prénom', 'Classe', 'Niveau', 'Solde dû', 'Payé', 'À payer', 'Statut'];
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

  accounts.forEach((a, idx) => {
    const isEven = idx % 2 === 0;
    const status = getPaymentStatus(a);
    const sc = STATUS_CONFIG[status];
    const className = a.studentEnrollments?.[0]?.class?.name || '—';
    const level = a.student?.schoolLevel?.name || '—';

    const values = [
      a.student?.studentCode || a.student?.matricule || '—',
      a.student?.lastName || '—',
      a.student?.firstName || '—',
      className,
      level,
      Number(a.balance) || 0,
      Number(a.totalPaid) || 0,
      Number(a.totalDue) || 0,
      sc.label,
    ];
    values.forEach((v, i) => {
      const cell = ws.getCell(row, i + 1);
      cell.value = v;
      // Colonne statut (index 8) : couleur spéciale
      if (i === 8) {
        styleDataCell(cell, { fill: sc.bg, color: sc.text, bold: true, align: 'center' });
      } else if (i >= 5 && i <= 7) {
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
  [totalBalance, totalPaid, totalDue].forEach((v, i) => {
    const cell = ws.getCell(row, 6 + i);
    cell.value = v;
    styleTotalCell(cell, 'right');
  });
  styleTotalCell(ws.getCell(row, 9), 'center');
  ws.getRow(row).height = 24;

  // Largeurs colonnes
  ws.columns = [
    { width: 16 }, { width: 20 }, { width: 20 }, { width: 18 }, { width: 14 },
    { width: 14 }, { width: 14 }, { width: 16 }, { width: 12 },
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

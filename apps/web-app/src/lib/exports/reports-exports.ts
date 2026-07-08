/**
 * ============================================================================
 * EXPORTS RAPPORTS FINANCIERS — Bilan périodique, Journal de caisse, Audit
 * ============================================================================
 *
 * Pattern identique à finance-exports.ts (Encaissements = référence absolue) :
 *   - drawOfficialHeader avec logo école + drapeau Bénin
 *   - formatAmount pour les montants (espace comme séparateur, pas "/")
 *   - "Francs CFA" complet non tronqué
 *   - loadJsPdf / loadAutoTable / loadXlsx via CDN
 *
 * Exports disponibles :
 *   - exportBilanPeriodiqueToPdf(bilan, header)
 *   - exportBilanPeriodiqueToExcel(bilan, header)
 *   - exportCashJournalToPdf(journal, header)
 *   - exportCashJournalToExcel(journal, header)
 *   - exportArrearsStateToPdf(arrears, header) — alias sémantique pour État des arriérés
 *   - exportArrearsStateToExcel(arrears, header)
 *   - exportAuditReportToPdf(auditData, header)
 *   - exportAuditReportToExcel(auditData, header)
 * ============================================================================
 */
import {
  SchoolHeader,
  formatAmount,
  preloadSchoolLogo,
  drawOfficialHeader,
  drawFooter,
  exportArrearsToPdf,
} from './finance-exports';
import { loadXlsx } from './xlsx-loader';
import { loadJsPdf, loadAutoTable } from './pdf-loader';

/* ------------------------------------------------------------------ */
/*  Helpers locaux (non exportés par finance-exports)                  */
/* ------------------------------------------------------------------ */

function getMinistryName(schoolLevel?: string): string {
  if (schoolLevel === 'SECONDAIRE' || schoolLevel === 'Secondaire') {
    return "Ministère de l'Enseignement Secondaire, de la Formation Technique et Professionnelle, de la Reconversion et de l'Insertion des Jeunes";
  }
  return "Ministère des Enseignements Maternel et Primaire";
}

/** Re-export pour cohérence sémantique — État des arriérés PDF. */
export { exportArrearsToPdf as exportArrearsStateToPdf };

/* ------------------------------------------------------------------ */
/*  Helpers format                                                     */
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

function formatPeriodLabel(header: SchoolHeader): string {
  if (header.dateFrom && header.dateTo) {
    return `Période : ${formatDateFr(header.dateFrom)} → ${formatDateFr(header.dateTo)}`;
  }
  if (header.dateFrom) return `Depuis le ${formatDateFr(header.dateFrom)}`;
  if (header.dateTo) return `Jusqu'au ${formatDateFr(header.dateTo)}`;
  return 'Année scolaire complète';
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

const ARREARS_LEVEL_LABELS: Record<string, string> = {
  LOW: 'Faible', MEDIUM: 'Moyen', HIGH: 'Élevé', CRITICAL: 'Critique',
};

const ARREARS_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Ouvert', PARTIALLY_PAID: 'Partiellement payé', PAID: 'Soldé',
  WRITTEN_OFF: 'Abandonné', TRANSFERRED: 'Transféré',
};

const ANOMALY_TYPE_LABELS: Record<string, string> = {
  MULTIPLE_CANCELLATION: 'Annulations multiples',
  ABNORMAL_TIME_TRANSACTION: 'Transaction à heure anormale',
  CASH_MISMATCH: 'Écart de caisse',
  FREQUENT_ADJUSTMENT: 'Ajustements fréquents',
  SUSPICIOUS_PARTIAL_PAYMENT: 'Paiement partiel suspect',
  MANUAL_OVERRIDE_EXCESS: 'Excès de modifications manuelles',
};

const ANOMALY_SEVERITY_LABELS: Record<string, string> = {
  HIGH: 'Élevée', MEDIUM: 'Moyenne', LOW: 'Faible', CRITICAL: 'Critique',
};

/* ------------------------------------------------------------------ */
/*  BILAN PÉRIODIQUE — PDF                                             */
/* ------------------------------------------------------------------ */

export interface BilanPeriodiqueData {
  periode: { dateFrom: string | null; dateTo: string | null };
  kpi: {
    totalEncaissement: number;
    totalDepenses: number;
    soldeNet: number;
    transactionCount?: number;
  };
  parClasse: Array<{ className: string; total: number; count?: number }>;
  parCategorie: Array<{ category: string; total: number; count?: number }>;
}

export async function exportBilanPeriodiqueToPdf(
  bilan: BilanPeriodiqueData,
  header: SchoolHeader
): Promise<{ blob: Blob; url: string }> {
  const jsPDF = await loadJsPdf();
  await loadAutoTable(jsPDF);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const logoBase64 = await preloadSchoolLogo(header.schoolLogoUrl);
  drawOfficialHeader(doc, header, pageWidth, logoBase64);

  // Titre du document
  let yPos = 50;
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(13, 31, 110);
  doc.text('Bilan périodique', pageWidth / 2, yPos, { align: 'center' });
  yPos += 6;

  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  if (header.academicYear) {
    doc.text(`Année scolaire : ${header.academicYear}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 4;
  }
  doc.text(formatPeriodLabel(header), pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;

  doc.setDrawColor(13, 31, 110);
  doc.setLineWidth(0.5);
  doc.line(14, yPos, pageWidth - 14, yPos);
  yPos += 6;

  // Bloc KPI synthétique
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text('Synthèse financière', 14, yPos);
  yPos += 5;

  doc.setFontSize(9);
  doc.setFont('times', 'normal');
  doc.setTextColor(40, 40, 40);
  const kpiRows: [string, string][] = [
    ['Total encaissements', `${formatAmount(bilan.kpi.totalEncaissement)} Francs CFA`],
    ['Total dépenses', `${formatAmount(bilan.kpi.totalDepenses)} Francs CFA`],
    ['Solde net', `${formatAmount(bilan.kpi.soldeNet)} Francs CFA`],
  ];
  kpiRows.forEach(([label, value]) => {
    doc.setTextColor(80, 80, 80);
    doc.text(label, 18, yPos);
    doc.setFont('times', 'bold');
    doc.setTextColor(bilan.kpi.soldeNet >= 0 && label === 'Solde net' ? 6 : 0, bilan.kpi.soldeNet >= 0 && label === 'Solde net' ? 95 : 0, bilan.kpi.soldeNet >= 0 && label === 'Solde net' ? 70 : 0);
    doc.text(value, 100, yPos);
    doc.setFont('times', 'normal');
    yPos += 5;
  });
  yPos += 4;

  // Tableau répartition par classe
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text('Répartition des encaissements par classe', 14, yPos);
  yPos += 3;

  const classeTableData = (bilan.parClasse || []).map((c) => [
    c.className || '—',
    formatAmount(c.total),
    `${c.count || 0} transaction(s)`,
  ]);
  const classeTotal = (bilan.parClasse || []).reduce((s, c) => s + (Number(c.total) || 0), 0);
  classeTableData.push(['TOTAL', formatAmount(classeTotal), '']);

  (doc as any).autoTable({
    startY: yPos,
    head: [['Classe', 'Montant (Francs CFA)', 'Volume']],
    body: classeTableData,
    theme: 'grid',
    headStyles: { fillColor: [13, 31, 110], textColor: 255, fontStyle: 'bold', fontSize: 9, halign: 'center' },
    bodyStyles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { halign: 'left', cellWidth: 60 },
      1: { halign: 'right', fontStyle: 'bold' },
      2: { halign: 'center' },
    },
    didParseCell: (data: any) => {
      if (data.row.index === classeTableData.length - 1 && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [220, 230, 250];
        data.cell.styles.textColor = [13, 31, 110];
      }
      if (data.section === 'body' && data.column.index === 1 && data.row.index < classeTableData.length - 1) {
        data.cell.styles.textColor = [6, 95, 70];
      }
    },
    didDrawPage: (data: any) => {
      drawFooter(doc, pageWidth, pageHeight, data.pageNumber);
    },
  });
  yPos = (doc as any).lastAutoTable.finalY + 8;

  // Tableau répartition par catégorie de dépense
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text('Répartition des dépenses par catégorie', 14, yPos);
  yPos += 3;

  const catTableData = (bilan.parCategorie || []).map((c) => [
    c.category || '—',
    formatAmount(c.total),
    `${c.count || 0} dépense(s)`,
  ]);
  const catTotal = (bilan.parCategorie || []).reduce((s, c) => s + (Number(c.total) || 0), 0);
  catTableData.push(['TOTAL', formatAmount(catTotal), '']);

  (doc as any).autoTable({
    startY: yPos,
    head: [['Catégorie', 'Montant (Francs CFA)', 'Volume']],
    body: catTableData,
    theme: 'grid',
    headStyles: { fillColor: [146, 64, 14], textColor: 255, fontStyle: 'bold', fontSize: 9, halign: 'center' },
    bodyStyles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { halign: 'left', cellWidth: 60 },
      1: { halign: 'right', fontStyle: 'bold' },
      2: { halign: 'center' },
    },
    didParseCell: (data: any) => {
      if (data.row.index === catTableData.length - 1 && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [254, 243, 199];
        data.cell.styles.textColor = [146, 64, 14];
      }
      if (data.section === 'body' && data.column.index === 1 && data.row.index < catTableData.length - 1) {
        data.cell.styles.textColor = [185, 28, 28];
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
/*  BILAN PÉRIODIQUE — Excel                                           */
/* ------------------------------------------------------------------ */

function setCellStyle(ws: any, cellRef: string, style: any) {
  if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
  ws[cellRef].s = style;
}

export async function exportBilanPeriodiqueToExcel(
  bilan: BilanPeriodiqueData,
  header: SchoolHeader
): Promise<void> {
  const XLSX = await loadXlsx();

  const data: any[][] = [
    ['', 'République du Bénin', ''],
    ['', getMinistryName(header.schoolLevel), ''],
    ['', header.schoolName || 'Établissement', ''],
    [header.schoolAddress || '', header.schoolPhone ? `Tél : ${header.schoolPhone}` : '', header.schoolEmail ? `Email : ${header.schoolEmail}` : ''],
    ['', '', ''],
    ['Bilan périodique', '', ''],
    [header.academicYear ? `Année scolaire : ${header.academicYear}` : '', '', ''],
    [formatPeriodLabel(header), '', ''],
    ['', '', ''],
    ['Synthèse financière', '', ''],
    ['Total encaissements', bilan.kpi.totalEncaissement, 'FCFA'],
    ['Total dépenses', bilan.kpi.totalDepenses, 'FCFA'],
    ['Solde net', bilan.kpi.soldeNet, 'FCFA'],
    ['', '', ''],
    ['Répartition par classe', '', ''],
    ['Classe', 'Montant (FCFA)', 'Volume'],
  ];

  (bilan.parClasse || []).forEach((c) => {
    data.push([c.className || '—', c.total, `${c.count || 0} transaction(s)`]);
  });
  const classeTotal = (bilan.parClasse || []).reduce((s, c) => s + (Number(c.total) || 0), 0);
  data.push(['TOTAL', classeTotal, '']);
  data.push(['', '', '']);
  data.push(['Répartition par catégorie de dépenses', '', '']);
  data.push(['Catégorie', 'Montant (FCFA)', 'Volume']);
  (bilan.parCategorie || []).forEach((c) => {
    data.push([c.category || '—', c.total, `${c.count || 0} dépense(s)`]);
  });
  const catTotal = (bilan.parCategorie || []).reduce((s, c) => s + (Number(c.total) || 0), 0);
  data.push(['TOTAL', catTotal, '']);

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 36 }, { wch: 22 }, { wch: 22 }];
  ws['!merges'] = [
    { s: { r: 0, c: 1 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 1 }, e: { r: 1, c: 2 } },
    { s: { r: 2, c: 1 }, e: { r: 2, c: 2 } },
    { s: { r: 5, c: 0 }, e: { r: 5, c: 2 } },
    { s: { r: 6, c: 0 }, e: { r: 6, c: 2 } },
    { s: { r: 7, c: 0 }, e: { r: 7, c: 2 } },
    { s: { r: 9, c: 0 }, e: { r: 9, c: 2 } },
    { s: { r: 14, c: 0 }, e: { r: 14, c: 2 } },
    { s: { r: 16 + (bilan.parClasse?.length || 0) + 1 + 2, c: 0 }, e: { r: 16 + (bilan.parClasse?.length || 0) + 1 + 2, c: 2 } },
  ];

  setCellStyle(ws, 'B1', { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center' } });
  setCellStyle(ws, 'B2', { font: { bold: true, sz: 11 }, alignment: { horizontal: 'center', wrapText: true } });
  setCellStyle(ws, 'B3', { font: { bold: true, sz: 13 }, alignment: { horizontal: 'center' } });
  setCellStyle(ws, 'A4', { font: { italic: true, sz: 9 }, alignment: { horizontal: 'left' } });
  setCellStyle(ws, 'B4', { font: { italic: true, sz: 9 }, alignment: { horizontal: 'center' } });
  setCellStyle(ws, 'C4', { font: { italic: true, sz: 9 }, alignment: { horizontal: 'right' } });
  setCellStyle(ws, 'A6', { font: { bold: true, sz: 12, color: { rgb: '0D1F6E' } }, alignment: { horizontal: 'center' } });
  setCellStyle(ws, 'A7', { font: { italic: true, sz: 10 }, alignment: { horizontal: 'center' } });
  setCellStyle(ws, 'A8', { font: { italic: true, sz: 10 }, alignment: { horizontal: 'center' } });
  setCellStyle(ws, 'A10', { font: { bold: true, sz: 11, color: { rgb: '0D1F6E' } }, alignment: { horizontal: 'left' } });

  // Style ligne total + cellules monétaires
  ['B11', 'B12', 'B13'].forEach((cellRef, idx) => {
    setCellStyle(ws, cellRef, {
      font: { bold: true, sz: 11, color: { rgb: idx === 2 ? '065F46' : '000000' } },
      alignment: { horizontal: 'right' },
      numFmt: '#,##0',
    });
  });

  // En-têtes tableaux
  const classHeaderRow = 15;
  for (let c = 0; c < 3; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: classHeaderRow, c });
    setCellStyle(ws, cellRef, {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      fill: { fgColor: { rgb: '0D1F6E' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
    });
  }
  // Ligne TOTAL des classes
  const classTotalRow = classHeaderRow + 1 + (bilan.parClasse?.length || 0);
  for (let c = 0; c < 3; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: classTotalRow, c });
    setCellStyle(ws, cellRef, {
      font: { bold: true, color: { rgb: '0D1F6E' }, sz: 10 },
      fill: { fgColor: { rgb: 'DCE6FA' } },
      alignment: { horizontal: c === 1 ? 'right' : 'center' },
      numFmt: c === 1 ? '#,##0' : undefined,
    });
  }

  const catHeaderRow = classTotalRow + 3;
  for (let c = 0; c < 3; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: catHeaderRow, c });
    setCellStyle(ws, cellRef, {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      fill: { fgColor: { rgb: '92400E' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
    });
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Bilan périodique');
  XLSX.writeFile(wb, `bilan-periodique-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/* ------------------------------------------------------------------ */
/*  JOURNAL DE CAISSE — PDF                                            */
/* ------------------------------------------------------------------ */

export interface CashJournalData {
  rows: Array<{
    id: string;
    receiptNumber?: string;
    amount: number;
    type: string;
    paymentMethod?: string;
    reference?: string;
    createdAt?: string;
    cashRegisterCode?: string;
    cashRegisterName?: string;
    studentFirstName?: string;
    studentLastName?: string;
    studentCode?: string;
    className?: string;
    cashierFirstName?: string;
    cashierLastName?: string;
  }>;
  totals: {
    totalIn: number;
    totalOut: number;
    netBalance: number;
    count: number;
  };
}

export async function exportCashJournalToPdf(
  journal: CashJournalData,
  header: SchoolHeader
): Promise<{ blob: Blob; url: string }> {
  const jsPDF = await loadJsPdf();
  await loadAutoTable(jsPDF);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const logoBase64 = await preloadSchoolLogo(header.schoolLogoUrl);
  drawOfficialHeader(doc, header, pageWidth, logoBase64);

  let yPos = 50;
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(13, 31, 110);
  doc.text('Journal de caisse', pageWidth / 2, yPos, { align: 'center' });
  yPos += 6;

  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  if (header.academicYear) {
    doc.text(`Année scolaire : ${header.academicYear}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 4;
  }
  doc.text(formatPeriodLabel(header), pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;

  doc.setDrawColor(13, 31, 110);
  doc.setLineWidth(0.5);
  doc.line(14, yPos, pageWidth - 14, yPos);
  yPos += 5;

  // Bloc totaux
  const totals = journal.totals || { totalIn: 0, totalOut: 0, netBalance: 0, count: 0 };
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 20);
  doc.text(`Transactions : ${totals.count}`, 14, yPos);
  doc.text(`Entrées : ${formatAmount(totals.totalIn)} FCFA`, 80, yPos);
  doc.setTextColor(185, 28, 28);
  doc.text(`Sorties : ${formatAmount(totals.totalOut)} FCFA`, 160, yPos);
  doc.setTextColor(6, 95, 70);
  doc.setFont('times', 'bold');
  doc.text(`Solde net : ${formatAmount(totals.netBalance)} Francs CFA`, 230, yPos);
  yPos += 5;

  // Tableau transactions
  const tableData = (journal.rows || []).map((r) => {
    const student = `${r.studentLastName || ''} ${r.studentFirstName || ''}`.trim() || '—';
    const cashier = `${r.cashierLastName || ''} ${r.cashierFirstName || ''}`.trim() || '—';
    return [
      formatDateTimeFr(r.createdAt),
      r.receiptNumber || '—',
      student,
      r.className || '—',
      r.cashRegisterName || r.cashRegisterCode || '—',
      r.type === 'REVERSAL' ? `-${formatAmount(r.amount)}` : formatAmount(r.amount),
      METHOD_LABELS[r.paymentMethod || ''] || r.paymentMethod || '—',
      cashier,
    ];
  });

  tableData.push([
    '', '', '', '', 'TOTAL',
    `${formatAmount(totals.netBalance)} FCFA`,
    '', '',
  ]);

  (doc as any).autoTable({
    head: [['Date', 'Reçu', 'Élève', 'Classe', 'Caisse', 'Montant (FCFA)', 'Méthode', 'Caissier']],
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
      0: { cellWidth: 32, halign: 'center' },
      1: { cellWidth: 28, halign: 'center' },
      2: { cellWidth: 'auto', halign: 'left' },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 28, halign: 'center' },
      5: { cellWidth: 30, halign: 'right' },
      6: { cellWidth: 22, halign: 'center' },
      7: { cellWidth: 'auto', halign: 'left' },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data: any) => {
      // Ligne total
      if (data.row.index === tableData.length - 1 && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [254, 243, 199];
        data.cell.styles.textColor = [146, 64, 14];
        data.cell.styles.fontSize = 9;
      }
      // Colonne Montant (5)
      if (data.section === 'body' && data.column.index === 5 && data.row.index < tableData.length - 1) {
        const row = tableData[data.row.index];
        const isReversal = (row[5] || '').startsWith('-');
        data.cell.styles.textColor = isReversal ? [185, 28, 28] : [6, 95, 70];
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
/*  JOURNAL DE CAISSE — Excel                                          */
/* ------------------------------------------------------------------ */

export async function exportCashJournalToExcel(
  journal: CashJournalData,
  header: SchoolHeader
): Promise<void> {
  const XLSX = await loadXlsx();

  const totals = journal.totals || { totalIn: 0, totalOut: 0, netBalance: 0, count: 0 };
  const data: any[][] = [
    ['', 'République du Bénin', ''],
    ['', getMinistryName(header.schoolLevel), ''],
    ['', header.schoolName || 'Établissement', ''],
    [header.schoolAddress || '', header.schoolPhone ? `Tél : ${header.schoolPhone}` : '', header.schoolEmail ? `Email : ${header.schoolEmail}` : ''],
    ['', '', ''],
    ['Journal de caisse', '', ''],
    [header.academicYear ? `Année scolaire : ${header.academicYear}` : '', '', ''],
    [formatPeriodLabel(header), '', ''],
    ['', '', ''],
    ['Synthèse', '', ''],
    ['Nombre de transactions', totals.count, ''],
    ['Total entrées', totals.totalIn, 'FCFA'],
    ['Total sorties', totals.totalOut, 'FCFA'],
    ['Solde net', totals.netBalance, 'FCFA'],
    ['', '', ''],
    ['Date', 'Reçu', 'Élève', 'Classe', 'Caisse', 'Montant (FCFA)', 'Méthode', 'Caissier'],
  ];

  (journal.rows || []).forEach((r) => {
    const student = `${r.studentLastName || ''} ${r.studentFirstName || ''}`.trim() || '—';
    const cashier = `${r.cashierLastName || ''} ${r.cashierFirstName || ''}`.trim() || '—';
    data.push([
      formatDateTimeFr(r.createdAt),
      r.receiptNumber || '—',
      student,
      r.className || '—',
      r.cashRegisterName || r.cashRegisterCode || '—',
      r.type === 'REVERSAL' ? -Math.abs(Number(r.amount) || 0) : Number(r.amount) || 0,
      METHOD_LABELS[r.paymentMethod || ''] || r.paymentMethod || '—',
      cashier,
    ]);
  });

  data.push(['', '', '', '', 'TOTAL', totals.netBalance, '', '']);

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 20 }, { wch: 22 }, { wch: 30 }, { wch: 14 },
    { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 22 },
  ];
  ws['!merges'] = [
    { s: { r: 0, c: 1 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 1 }, e: { r: 1, c: 2 } },
    { s: { r: 2, c: 1 }, e: { r: 2, c: 2 } },
    { s: { r: 5, c: 0 }, e: { r: 5, c: 2 } },
    { s: { r: 6, c: 0 }, e: { r: 6, c: 2 } },
    { s: { r: 7, c: 0 }, e: { r: 7, c: 2 } },
    { s: { r: 9, c: 0 }, e: { r: 9, c: 2 } },
  ];

  setCellStyle(ws, 'B1', { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center' } });
  setCellStyle(ws, 'B2', { font: { bold: true, sz: 11 }, alignment: { horizontal: 'center', wrapText: true } });
  setCellStyle(ws, 'B3', { font: { bold: true, sz: 13 }, alignment: { horizontal: 'center' } });
  setCellStyle(ws, 'A6', { font: { bold: true, sz: 12, color: { rgb: '0D1F6E' } }, alignment: { horizontal: 'center' } });
  setCellStyle(ws, 'A10', { font: { bold: true, sz: 11, color: { rgb: '0D1F6E' } }, alignment: { horizontal: 'left' } });

  ['B12', 'B13', 'B14'].forEach((cellRef, idx) => {
    setCellStyle(ws, cellRef, {
      font: { bold: true, sz: 11, color: { rgb: idx === 2 ? '065F46' : '000000' } },
      alignment: { horizontal: 'right' },
      numFmt: '#,##0',
    });
  });

  const headerRow = 15;
  for (let c = 0; c < 8; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: headerRow, c });
    setCellStyle(ws, cellRef, {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      fill: { fgColor: { rgb: '0D1F6E' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
    });
  }

  // Lignes de données : zebra striping
  const dataStartRow = headerRow + 1;
  const dataEndRow = dataStartRow + (journal.rows?.length || 0) - 1;
  for (let r = dataStartRow; r <= dataEndRow; r++) {
    const isEven = (r - dataStartRow) % 2 === 0;
    const bgColor = isEven ? 'F8FAFC' : 'FFFFFF';
    for (let c = 0; c < 8; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const isAmount = c === 5;
      const cellValue = ws[cellRef]?.v;
      const isReversal = isAmount && typeof cellValue === 'number' && cellValue < 0;
      setCellStyle(ws, cellRef, {
        font: { sz: 10, bold: isAmount, color: { rgb: isAmount ? (isReversal ? 'B91C1C' : '065F46') : '000000' } },
        fill: { fgColor: { rgb: bgColor } },
        alignment: { horizontal: c === 2 || c === 7 ? 'left' : (c === 5 ? 'right' : 'center') },
        numFmt: isAmount ? '#,##0;[Red]-#,##0' : undefined,
        border: { top: { style: 'thin', color: { rgb: 'E5E7EB' } }, bottom: { style: 'thin', color: { rgb: 'E5E7EB' } }, left: { style: 'thin', color: { rgb: 'E5E7EB' } }, right: { style: 'thin', color: { rgb: 'E5E7EB' } } },
      });
    }
  }

  // Ligne TOTAL
  const totalRow = dataEndRow + 1;
  for (let c = 0; c < 8; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: totalRow, c });
    setCellStyle(ws, cellRef, {
      font: { bold: true, color: { rgb: '92400E' }, sz: 10 },
      fill: { fgColor: { rgb: 'FEF3C7' } },
      alignment: { horizontal: c === 5 ? 'right' : (c === 4 ? 'right' : 'center') },
      numFmt: c === 5 ? '#,##0' : undefined,
    });
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Journal de caisse');
  XLSX.writeFile(wb, `journal-caisse-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/* ------------------------------------------------------------------ */
/*  ÉTAT DES ARRIÉRÉS — Excel (le PDF existe déjà dans finance-exports) */
/* ------------------------------------------------------------------ */

export async function exportArrearsStateToExcel(
  arrears: any[],
  header: SchoolHeader
): Promise<void> {
  const XLSX = await loadXlsx();

  const totalDue = arrears.reduce((s, a) => s + (Number(a.totalDue) || 0), 0);
  const totalPaid = arrears.reduce((s, a) => s + (Number(a.totalPaid) || 0), 0);
  const totalBalance = arrears.reduce((s, a) => s + (Number(a.balanceDue) || 0), 0);

  const data: any[][] = [
    ['', 'République du Bénin', ''],
    ['', getMinistryName(header.schoolLevel), ''],
    ['', header.schoolName || 'Établissement', ''],
    [header.schoolAddress || '', header.schoolPhone ? `Tél : ${header.schoolPhone}` : '', header.schoolEmail ? `Email : ${header.schoolEmail}` : ''],
    ['', '', ''],
    ['État des arriérés', '', ''],
    [header.academicYear ? `Année scolaire : ${header.academicYear}` : '', '', ''],
    ['', '', ''],
    ['Élève', 'Classe', 'Année', 'Frais', 'Total dû (FCFA)', 'Payé (FCFA)', 'Solde (FCFA)', 'Niveau', 'Statut'],
  ];

  arrears.forEach((a) => {
    data.push([
      a.student ? `${a.student.lastName} ${a.student.firstName}` : '—',
      a.student?.studentEnrollments?.[0]?.class?.name || '—',
      a.academicYear?.label || a.academicYearName || '—',
      a.studentFee?.feeDefinition?.label || a.notes || '—',
      Number(a.totalDue) || 0,
      Number(a.totalPaid) || 0,
      Number(a.balanceDue) || 0,
      ARREARS_LEVEL_LABELS[a.arrearsLevel] || a.arrearsLevel || '—',
      ARREARS_STATUS_LABELS[a.status] || a.status || '—',
    ]);
  });

  data.push(['', '', '', `TOTAUX (${arrears.length})`, totalDue, totalPaid, totalBalance, '', '']);

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 22 },
    { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 22 },
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

  const headerRow = 8;
  for (let c = 0; c < 9; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: headerRow, c });
    setCellStyle(ws, cellRef, {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      fill: { fgColor: { rgb: '0D1F6E' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
    });
  }

  const totalRowNum = headerRow + 1 + arrears.length;
  for (let c = 0; c < 9; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: totalRowNum, c });
    setCellStyle(ws, cellRef, {
      font: { bold: true, color: { rgb: '0D1F6E' }, sz: 10 },
      fill: { fgColor: { rgb: 'DCE6FA' } },
      alignment: { horizontal: c >= 4 && c <= 6 ? 'right' : 'center' },
      numFmt: c >= 4 && c <= 6 ? '#,##0' : undefined,
    });
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'État des arriérés');
  XLSX.writeFile(wb, `etat-arrieres-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/* ------------------------------------------------------------------ */
/*  AUDIT REPORT — PDF                                                 */
/* ------------------------------------------------------------------ */

export interface AuditReportData {
  anomalies: any[];
  suspicious: {
    reversals: any[];
    nocturnal: any[];
    highValue: any[];
    stats: {
      reversalCount: number;
      reversalTotal: number;
      nocturnalCount: number;
      highValueCount: number;
      highValueTotal: number;
    };
  };
  cashMismatches: any[];
  missedClosures: { missed: any[]; stats: { totalExpected: number; totalMissed: number; totalDone: number; missRate: number } };
  topAccountants: any[];
  auditLogs: any[];
}

export async function exportAuditReportToPdf(
  audit: AuditReportData,
  header: SchoolHeader
): Promise<{ blob: Blob; url: string }> {
  const jsPDF = await loadJsPdf();
  await loadAutoTable(jsPDF);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const logoBase64 = await preloadSchoolLogo(header.schoolLogoUrl);
  drawOfficialHeader(doc, header, pageWidth, logoBase64);

  let yPos = 50;
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(13, 31, 110);
  doc.text('Rapport de contrôle & audit financier', pageWidth / 2, yPos, { align: 'center' });
  yPos += 6;

  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  if (header.academicYear) {
    doc.text(`Année scolaire : ${header.academicYear}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 4;
  }
  doc.text(`Période analysée : 30 derniers jours`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;

  doc.setDrawColor(13, 31, 110);
  doc.setLineWidth(0.5);
  doc.line(14, yPos, pageWidth - 14, yPos);
  yPos += 6;

  // Bloc synthèse anti-fraude
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text('Synthèse anti-fraude ORION', 14, yPos);
  yPos += 5;

  const sus = audit.suspicious?.stats || { reversalCount: 0, reversalTotal: 0, nocturnalCount: 0, highValueCount: 0, highValueTotal: 0 };
  const anomalyCount = audit.anomalies?.length || 0;
  const unresolvedAnomalies = (audit.anomalies || []).filter((a) => !a.resolved).length;
  const mismatchCount = (audit.cashMismatches || []).filter((m: any) => Math.abs(Number(m.ecart) || 0) > 100).length;
  const closureMissRate = audit.missedClosures?.stats?.missRate || 0;

  doc.setFontSize(9);
  doc.setFont('times', 'normal');
  const synthRows: [string, string, string][] = [
    ['Anomalies détectées', `${anomalyCount}`, unresolvedAnomalies > 0 ? `dont ${unresolvedAnomalies} non résolues` : 'toutes résolues'],
    ['Annulations (30 jours)', `${sus.reversalCount}`, `${formatAmount(sus.reversalTotal)} FCFA`],
    ['Transactions nocturnes', `${sus.nocturnalCount}`, 'entre 21h et 6h'],
    ['Transactions à montant élevé', `${sus.highValueCount}`, `${formatAmount(sus.highValueTotal)} FCFA`],
    ['Écarts de caisse détectés', `${mismatchCount}`, mismatchCount > 0 ? 'vérification requise' : 'aucun écart significatif'],
    ['Taux de clôtures manquées', `${closureMissRate}%`, `${audit.missedClosures?.stats?.totalMissed || 0} clôture(s) manquée(s)`],
  ];

  synthRows.forEach(([label, value, detail]) => {
    doc.setTextColor(80, 80, 80);
    doc.text(label, 18, yPos);
    doc.setFont('times', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text(value, 110, yPos);
    doc.setFont('times', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(detail, 130, yPos);
    yPos += 5;
  });
  yPos += 4;

  // ─── Tableau anomalies ───
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text('Anomalies détectées', 14, yPos);
  yPos += 3;

  const anomalyData = (audit.anomalies || []).slice(0, 30).map((a) => [
    ANOMALY_TYPE_LABELS[a.type] || a.type || '—',
    ANOMALY_SEVERITY_LABELS[a.severity] || a.severity || '—',
    a.referenceId ? String(a.referenceId).slice(0, 12) : '—',
    a.detectedAt ? formatDateFr(a.detectedAt) : '—',
    a.resolved ? 'Résolu' : 'Non résolu',
  ]);

  if (anomalyData.length === 0) {
    doc.setFont('times', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('Aucune anomalie détectée sur la période.', 14, yPos + 4);
    yPos += 8;
  } else {
    (doc as any).autoTable({
      startY: yPos,
      head: [['Type', 'Gravité', 'Référence', 'Détectée le', 'Statut']],
      body: anomalyData,
      theme: 'grid',
      headStyles: { fillColor: [146, 64, 14], textColor: 255, fontStyle: 'bold', fontSize: 9, halign: 'center' },
      bodyStyles: { fontSize: 8, cellPadding: 1.5 },
      columnStyles: {
        0: { halign: 'left', cellWidth: 55 },
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center' },
      },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 4) {
          const cell = data.cell;
          if (cell.raw === 'Résolu') {
            data.cell.styles.textColor = [6, 95, 70];
          } else {
            data.cell.styles.textColor = [185, 28, 28];
            data.cell.styles.fontStyle = 'bold';
          }
        }
        if (data.section === 'body' && data.column.index === 1) {
          const sev = data.cell.raw;
          if (sev === 'Élevée' || sev === 'Critique') {
            data.cell.styles.textColor = [185, 28, 28];
            data.cell.styles.fontStyle = 'bold';
          } else if (sev === 'Moyenne') {
            data.cell.styles.textColor = [146, 64, 14];
          }
        }
      },
      didDrawPage: (data: any) => {
        drawFooter(doc, pageWidth, pageHeight, data.pageNumber);
      },
    });
    yPos = (doc as any).lastAutoTable.finalY + 6;
  }

  // ─── Écarts caisse ───
  doc.addPage();
  drawOfficialHeader(doc, header, pageWidth, logoBase64);
  yPos = 50;
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(13, 31, 110);
  doc.text('Écarts de caisse', pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;

  const mismatchData = (audit.cashMismatches || []).map((m: any) => [
    m.code || '—',
    m.name || '—',
    formatAmount(m.theoreticalBalance),
    formatAmount(m.currentBalance),
    formatAmount(m.ecart),
    Math.abs(Number(m.ecart) || 0) > 1000 ? 'ÉCART CRITIQUE' : (Math.abs(Number(m.ecart) || 0) > 100 ? 'À vérifier' : 'OK'),
  ]);

  if (mismatchData.length === 0) {
    doc.setFont('times', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('Aucune caisse active.', 14, yPos + 4);
  } else {
    (doc as any).autoTable({
      startY: yPos,
      head: [['Code', 'Caisse', 'Solde théorique (FCFA)', 'Solde déclaré (FCFA)', 'Écart (FCFA)', 'Statut']],
      body: mismatchData,
      theme: 'grid',
      headStyles: { fillColor: [13, 31, 110], textColor: 255, fontStyle: 'bold', fontSize: 9, halign: 'center' },
      bodyStyles: { fontSize: 9, cellPadding: 1.5 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 22 },
        1: { halign: 'left', cellWidth: 40 },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold' },
        5: { halign: 'center' },
      },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 4) {
          const ecart = Math.abs(Number(data.cell.raw?.toString().replace(/\s/g, '').replace('FCFA', '').replace(/,/g, '.')) || 0);
          if (ecart > 1000) {
            data.cell.styles.textColor = [185, 28, 28];
            data.cell.styles.fontStyle = 'bold';
          } else if (ecart > 100) {
            data.cell.styles.textColor = [146, 64, 14];
          } else {
            data.cell.styles.textColor = [6, 95, 70];
          }
        }
      },
      didDrawPage: (data: any) => {
        drawFooter(doc, pageWidth, pageHeight, data.pageNumber);
      },
    });
    yPos = (doc as any).lastAutoTable.finalY + 6;
  }

  // ─── Top comptables ───
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text('Top 10 comptables les plus actifs (30 jours)', 14, yPos);
  yPos += 3;

  const accountantData = (audit.topAccountants || []).map((a: any) => [
    `${a.lastName || ''} ${a.firstName || ''}`.trim() || '—',
    a.email || '—',
    a.role || '—',
    String(a.transactionCount || 0),
    formatAmount(a.paymentTotal),
    formatAmount(a.reversalTotal),
  ]);

  if (accountantData.length === 0) {
    doc.setFont('times', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('Aucune activité comptable enregistrée.', 14, yPos + 4);
  } else {
    (doc as any).autoTable({
      startY: yPos,
      head: [['Comptable', 'Email', 'Rôle', 'Transactions', 'Volume encaissé (FCFA)', 'Annulations (FCFA)']],
      body: accountantData,
      theme: 'striped',
      headStyles: { fillColor: [13, 31, 110], textColor: 255, fontStyle: 'bold', fontSize: 9, halign: 'center' },
      bodyStyles: { fontSize: 8, cellPadding: 1.5 },
      columnStyles: {
        0: { halign: 'left', cellWidth: 40 },
        1: { halign: 'left', cellWidth: 50 },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'right' },
        5: { halign: 'right' },
      },
      didDrawPage: (data: any) => {
        drawFooter(doc, pageWidth, pageHeight, data.pageNumber);
      },
    });
  }

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  return { blob, url };
}

/* ------------------------------------------------------------------ */
/*  AUDIT REPORT — Excel                                               */
/* ------------------------------------------------------------------ */

export async function exportAuditReportToExcel(
  audit: AuditReportData,
  header: SchoolHeader
): Promise<void> {
  const XLSX = await loadXlsx();

  const wb = XLSX.utils.book_new();

  // ─── Feuille 1 : Synthèse ───
  const sus = audit.suspicious?.stats || { reversalCount: 0, reversalTotal: 0, nocturnalCount: 0, highValueCount: 0, highValueTotal: 0 };
  const anomalyCount = audit.anomalies?.length || 0;
  const unresolvedAnomalies = (audit.anomalies || []).filter((a) => !a.resolved).length;
  const mismatchCount = (audit.cashMismatches || []).filter((m: any) => Math.abs(Number(m.ecart) || 0) > 100).length;

  const synthData: any[][] = [
    ['', 'République du Bénin', ''],
    ['', getMinistryName(header.schoolLevel), ''],
    ['', header.schoolName || 'Établissement', ''],
    [header.schoolAddress || '', header.schoolPhone ? `Tél : ${header.schoolPhone}` : '', header.schoolEmail ? `Email : ${header.schoolEmail}` : ''],
    ['', '', ''],
    ['Rapport de contrôle & audit financier', '', ''],
    [header.academicYear ? `Année scolaire : ${header.academicYear}` : '', '', ''],
    ['Période analysée : 30 derniers jours', '', ''],
    ['', '', ''],
    ['Synthèse anti-fraude ORION', '', ''],
    ['Indicateur', 'Valeur', 'Détail'],
    ['Anomalies détectées', anomalyCount, `${unresolvedAnomalies} non résolue(s)`],
    ['Annulations (30 jours)', sus.reversalCount, `${sus.reversalTotal} FCFA`],
    ['Transactions nocturnes', sus.nocturnalCount, 'entre 21h et 6h'],
    ['Transactions à montant élevé', sus.highValueCount, `${sus.highValueTotal} FCFA`],
    ['Écarts de caisse', mismatchCount, mismatchCount > 0 ? 'vérification requise' : 'OK'],
    ['Taux clôtures manquées', `${audit.missedClosures?.stats?.missRate || 0}%`, `${audit.missedClosures?.stats?.totalMissed || 0} manquantes`],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(synthData);
  ws1['!cols'] = [{ wch: 36 }, { wch: 22 }, { wch: 36 }];
  ws1['!merges'] = [
    { s: { r: 0, c: 1 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 1 }, e: { r: 1, c: 2 } },
    { s: { r: 2, c: 1 }, e: { r: 2, c: 2 } },
    { s: { r: 5, c: 0 }, e: { r: 5, c: 2 } },
    { s: { r: 6, c: 0 }, e: { r: 6, c: 2 } },
    { s: { r: 7, c: 0 }, e: { r: 7, c: 2 } },
    { s: { r: 9, c: 0 }, e: { r: 9, c: 2 } },
  ];
  setCellStyle(ws1, 'B1', { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center' } });
  setCellStyle(ws1, 'B2', { font: { bold: true, sz: 11 }, alignment: { horizontal: 'center', wrapText: true } });
  setCellStyle(ws1, 'B3', { font: { bold: true, sz: 13 }, alignment: { horizontal: 'center' } });
  setCellStyle(ws1, 'A6', { font: { bold: true, sz: 12, color: { rgb: '0D1F6E' } }, alignment: { horizontal: 'center' } });
  setCellStyle(ws1, 'A10', { font: { bold: true, sz: 11, color: { rgb: '0D1F6E' } }, alignment: { horizontal: 'left' } });
  for (let c = 0; c < 3; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 10, c });
    setCellStyle(ws1, cellRef, {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      fill: { fgColor: { rgb: '0D1F6E' } },
      alignment: { horizontal: 'center' },
      border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
    });
  }
  XLSX.utils.book_append_sheet(wb, ws1, 'Synthèse');

  // ─── Feuille 2 : Anomalies ───
  const anomalyData: any[][] = [
    ['Type', 'Gravité', 'Référence', 'Détectée le', 'Résolu'],
  ];
  (audit.anomalies || []).forEach((a) => {
    anomalyData.push([
      ANOMALY_TYPE_LABELS[a.type] || a.type || '—',
      ANOMALY_SEVERITY_LABELS[a.severity] || a.severity || '—',
      a.referenceId || '—',
      a.detectedAt ? formatDateFr(a.detectedAt) : '—',
      a.resolved ? 'Oui' : 'Non',
    ]);
  });
  const ws2 = XLSX.utils.aoa_to_sheet(anomalyData);
  ws2['!cols'] = [{ wch: 32 }, { wch: 14 }, { wch: 22 }, { wch: 16 }, { wch: 12 }];
  for (let c = 0; c < 5; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    setCellStyle(ws2, cellRef, {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      fill: { fgColor: { rgb: '92400E' } },
      alignment: { horizontal: 'center' },
      border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
    });
  }
  XLSX.utils.book_append_sheet(wb, ws2, 'Anomalies');

  // ─── Feuille 3 : Écarts caisse ───
  const mismatchData: any[][] = [
    ['Code', 'Caisse', 'Solde théorique', 'Solde déclaré', 'Écart', 'Statut'],
  ];
  (audit.cashMismatches || []).forEach((m: any) => {
    mismatchData.push([
      m.code || '—',
      m.name || '—',
      Number(m.theoreticalBalance) || 0,
      Number(m.currentBalance) || 0,
      Number(m.ecart) || 0,
      Math.abs(Number(m.ecart) || 0) > 1000 ? 'ÉCART CRITIQUE' : (Math.abs(Number(m.ecart) || 0) > 100 ? 'À vérifier' : 'OK'),
    ]);
  });
  const ws3 = XLSX.utils.aoa_to_sheet(mismatchData);
  ws3['!cols'] = [{ wch: 14 }, { wch: 30 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }];
  for (let c = 0; c < 6; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    setCellStyle(ws3, cellRef, {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      fill: { fgColor: { rgb: '0D1F6E' } },
      alignment: { horizontal: 'center' },
      border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
    });
  }
  XLSX.utils.book_append_sheet(wb, ws3, 'Écarts caisse');

  // ─── Feuille 4 : Transactions suspectes ───
  const suspData: any[][] = [
    ['Catégorie', 'Reçu', 'Élève', 'Caissier', 'Montant', 'Date', 'Méthode'],
  ];
  (audit.suspicious?.reversals || []).forEach((r: any) => {
    const student = r.studentAccount?.student
      ? `${r.studentAccount.student.lastName} ${r.studentAccount.student.firstName}`
      : '—';
    const cashier = r.cashier ? `${r.cashier.lastName} ${r.cashier.firstName}` : '—';
    suspData.push([
      'Annulation',
      r.receiptNumber || '—',
      student,
      cashier,
      -Math.abs(Number(r.amount) || 0),
      r.createdAt ? formatDateTimeFr(r.createdAt) : '—',
      METHOD_LABELS[r.paymentMethod] || r.paymentMethod || '—',
    ]);
  });
  (audit.suspicious?.nocturnal || []).forEach((r: any) => {
    const student = `${r.studentLastName || ''} ${r.studentFirstName || ''}`.trim() || '—';
    const cashier = `${r.cashierLastName || ''} ${r.cashierFirstName || ''}`.trim() || '—';
    suspData.push([
      'Nocturne',
      r.receiptNumber || '—',
      student,
      cashier,
      Number(r.amount) || 0,
      r.createdAt ? formatDateTimeFr(r.createdAt) : '—',
      METHOD_LABELS[r.paymentMethod] || r.paymentMethod || '—',
    ]);
  });
  (audit.suspicious?.highValue || []).forEach((r: any) => {
    const student = r.studentAccount?.student
      ? `${r.studentAccount.student.lastName} ${r.studentAccount.student.firstName}`
      : '—';
    const cashier = r.cashier ? `${r.cashier.lastName} ${r.cashier.firstName}` : '—';
    suspData.push([
      'Montant élevé',
      r.receiptNumber || '—',
      student,
      cashier,
      Number(r.amount) || 0,
      r.createdAt ? formatDateTimeFr(r.createdAt) : '—',
      METHOD_LABELS[r.paymentMethod] || r.paymentMethod || '—',
    ]);
  });
  const ws4 = XLSX.utils.aoa_to_sheet(suspData);
  ws4['!cols'] = [{ wch: 16 }, { wch: 18 }, { wch: 28 }, { wch: 22 }, { wch: 16 }, { wch: 20 }, { wch: 14 }];
  for (let c = 0; c < 7; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    setCellStyle(ws4, cellRef, {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      fill: { fgColor: { rgb: 'B91C1C' } },
      alignment: { horizontal: 'center' },
      border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
    });
  }
  XLSX.utils.book_append_sheet(wb, ws4, 'Transactions suspectes');

  // ─── Feuille 5 : Top comptables ───
  const accData: any[][] = [
    ['Comptable', 'Email', 'Rôle', 'Transactions', 'Volume encaissé', 'Annulations'],
  ];
  (audit.topAccountants || []).forEach((a: any) => {
    accData.push([
      `${a.lastName || ''} ${a.firstName || ''}`.trim() || '—',
      a.email || '—',
      a.role || '—',
      Number(a.transactionCount) || 0,
      Number(a.paymentTotal) || 0,
      Number(a.reversalTotal) || 0,
    ]);
  });
  const ws5 = XLSX.utils.aoa_to_sheet(accData);
  ws5['!cols'] = [{ wch: 30 }, { wch: 30 }, { wch: 18 }, { wch: 14 }, { wch: 22 }, { wch: 22 }];
  for (let c = 0; c < 6; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    setCellStyle(ws5, cellRef, {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      fill: { fgColor: { rgb: '0D1F6E' } },
      alignment: { horizontal: 'center' },
      border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
    });
  }
  XLSX.utils.book_append_sheet(wb, ws5, 'Top comptables');

  // ─── Feuille 6 : Historique audit ───
  const logData: any[][] = [
    ['Entité', 'Action', 'Par', 'Date'],
  ];
  (audit.auditLogs || []).forEach((l: any) => {
    logData.push([
      l.entityType || '—',
      l.action || '—',
      l.performer ? `${l.performer.lastName || ''} ${l.performer.firstName || ''}`.trim() : '—',
      l.performedAt ? formatDateTimeFr(l.performedAt) : '—',
    ]);
  });
  const ws6 = XLSX.utils.aoa_to_sheet(logData);
  ws6['!cols'] = [{ wch: 22 }, { wch: 22 }, { wch: 30 }, { wch: 20 }];
  for (let c = 0; c < 4; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    setCellStyle(ws6, cellRef, {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      fill: { fgColor: { rgb: '6B7280' } },
      alignment: { horizontal: 'center' },
      border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
    });
  }
  XLSX.utils.book_append_sheet(wb, ws6, 'Historique audit');

  XLSX.writeFile(wb, `audit-financier-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

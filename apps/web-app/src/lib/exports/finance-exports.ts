/**
 * ============================================================================
 * EXPORTS FINANCE — Excel + PDF avec entête école
 * ============================================================================
 *
 * Génère des fichiers Excel (.xlsx) et PDF avec l'entête de l'école
 * (logo, nom, année scolaire) pour les encaissements et comptes élèves.
 *
 * Bibliothèques utilisées (chargées via CDN, pas de dépendance npm) :
 *   - xlsx (SheetJS) pour Excel : https://cdn.sheetjs.com/xlsx-latest/package/xlsx.full.min.js
 *   - jsPDF + autotable pour PDF : https://cdnjs.cloudflare.com/ajax/libs/jspdf/
 *
 * Aucune installation npm requise — chargement dynamique via CDN.
 * ============================================================================
 */

/* ------------------------------------------------------------------ */
/*  Chargement dynamique des bibliothèques via CDN                     */
/* ------------------------------------------------------------------ */

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
    // Vérifier si autoTable est déjà appliqué
    if (jsPDF.API?.autoTable) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
    script.async = true;
    script.onload = () => {
      // autoTable s'auto-installe sur jsPDF
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
  student?: {
    firstName?: string;
    lastName?: string;
    matricule?: string;
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

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  WIRE: 'Virement',
  FEDAPAY: 'Fedapay',
  FEEXPAY: 'FeexPay',
  BANK: 'Banque',
  CHECK: 'Chèque',
};

/* ------------------------------------------------------------------ */
/*  Export EXCEL — Encaissements                                       */
/* ------------------------------------------------------------------ */

export async function exportTransactionsToExcel(
  transactions: TransactionRow[],
  header: SchoolHeader
): Promise<void> {
  const XLSX = await loadXlsx();

  // Calculer le total
  const totalAmount = transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  // Préparer les données avec entête école
  const data: any[][] = [
    [header.schoolName],
    ['Historique des encaissements'],
    [header.academicYear ? `Année scolaire : ${header.academicYear}` : ''],
    [formatPeriod(header)],
    [''],
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

  // Créer la feuille de calcul
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Largeurs de colonnes
  ws['!cols'] = [
    { wch: 18 }, // Date
    { wch: 22 }, // Reçu
    { wch: 16 }, // Matricule
    { wch: 30 }, // Élève
    { wch: 15 }, // Montant
    { wch: 14 }, // Méthode
    { wch: 20 }, // Référence
  ];

  // Fusionner les cellules d'entête (titre école)
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, // Ligne 0 : nom école
    { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } }, // Ligne 1 : sous-titre
    { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } }, // Ligne 2 : année scolaire
    { s: { r: 3, c: 0 }, e: { r: 3, c: 6 } }, // Ligne 3 : période
  ];

  // Créer le classeur
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Encaissements');

  // Générer le fichier
  const filename = `encaissements-${header.dateFrom || 'debut'}-au-${header.dateTo || 'fin'}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/* ------------------------------------------------------------------ */
/*  Export PDF — Encaissements (avec entête école)                     */
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

  // ─── Entête école ───
  let logoHeight = 0;
  // Note : on ne charge pas le logo dynamiquement (problème CORS potentiel)
  // On affiche juste le nom de l'école en gros
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text(header.schoolName, pageWidth / 2, 15, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text('Historique des encaissements', pageWidth / 2, 21, { align: 'center' });

  doc.setFontSize(9);
  if (header.academicYear) {
    doc.text(`Année scolaire : ${header.academicYear}`, pageWidth / 2, 26, { align: 'center' });
  }
  doc.text(formatPeriod(header), pageWidth / 2, 30, { align: 'center' });

  // Ligne séparatrice
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(14, 33, pageWidth - 14, 33);

  // ─── Tableau des transactions ───
  const tableData = transactions.map((t) => [
    formatDateTimeFr(t.createdAt || t.date),
    t.receiptNumber || '—',
    getStudentMatricule(t),
    getStudentName(t),
    (Number(t.amount) || 0).toLocaleString('fr-FR'),
    METHOD_LABELS[t.paymentMethod || ''] || t.paymentMethod || '—',
    t.reference || '—',
  ]);

  const totalAmount = transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  // Ajouter ligne total à la fin
  tableData.push([
    '', '', '', 'TOTAL',
    totalAmount.toLocaleString('fr-FR') + ' FCFA',
    '', '',
  ]);

  (doc as any).autoTable({
    head: [['Date', 'Reçu', 'Matricule', 'Élève', 'Montant (FCFA)', 'Méthode', 'Référence']],
    body: tableData,
    startY: 36,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 60, 120],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [40, 40, 40],
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    columnStyles: {
      0: { cellWidth: 32 }, // Date
      1: { cellWidth: 35 }, // Reçu
      2: { cellWidth: 25 }, // Matricule
      3: { cellWidth: 'auto' }, // Élève
      4: { cellWidth: 28, halign: 'right' }, // Montant
      5: { cellWidth: 22 }, // Méthode
      6: { cellWidth: 'auto' }, // Référence
    },
    // Style de la dernière ligne (total)
    didParseCell: (data: any) => {
      if (data.row.index === tableData.length - 1 && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [255, 251, 235];
        data.cell.styles.textColor = [120, 60, 0];
      }
    },
    // Pied de page avec pagination
    didDrawPage: (data: any) => {
      const str = `Page ${data.pageNumber}`;
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(str, pageWidth - 20, pageHeight - 8);
      doc.text(
        `Généré le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
        14,
        pageHeight - 8,
      );
    },
  });

  // Générer le blob
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  return { blob, url };
}

/* ------------------------------------------------------------------ */
/*  Export EXCEL — Comptes élèves                                      */
/* ------------------------------------------------------------------ */

export async function exportStudentAccountsToExcel(
  accounts: StudentAccountRow[],
  header: SchoolHeader & { classFilter?: string }
): Promise<void> {
  const XLSX = await loadXlsx();

  const totalDue = accounts.reduce((sum, a) => sum + (Number(a.totalDue) || 0), 0);
  const totalPaid = accounts.reduce((sum, a) => sum + (Number(a.totalPaid) || 0), 0);
  const totalBalance = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

  const data: any[][] = [
    [header.schoolName],
    ['Comptes élèves'],
    [header.academicYear ? `Année scolaire : ${header.academicYear}` : ''],
    [header.classFilter ? `Classe : ${header.classFilter}` : 'Toutes les classes'],
    [''],
    ['Matricule', 'Nom', 'Prénom', 'Classe', 'Niveau', 'Solde dû (FCFA)', 'Total payé (FCFA)', 'Total à payer (FCFA)'],
  ];

  accounts.forEach((a) => {
    const className = a.studentEnrollments?.[0]?.class?.name || '—';
    const level = a.student?.schoolLevel?.name || '—';
    data.push([
      a.student?.matricule || '—',
      a.student?.lastName || '—',
      a.student?.firstName || '—',
      className,
      level,
      Number(a.balance) || 0,
      Number(a.totalPaid) || 0,
      Number(a.totalDue) || 0,
    ]);
  });

  data.push(['']);
  data.push(['', '', '', '', 'TOTAL', totalBalance, totalPaid, totalDue]);

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 16 }, // Matricule
    { wch: 20 }, // Nom
    { wch: 20 }, // Prénom
    { wch: 18 }, // Classe
    { wch: 14 }, // Niveau
    { wch: 15 }, // Solde
    { wch: 16 }, // Payé
    { wch: 18 }, // À payer
  ];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 7 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 7 } },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Comptes élèves');
  XLSX.writeFile(wb, `comptes-eleves-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/* ------------------------------------------------------------------ */
/*  Export PDF — Comptes élèves                                        */
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

  // Entête
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text(header.schoolName, pageWidth / 2, 15, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text('Comptes élèves', pageWidth / 2, 21, { align: 'center' });

  doc.setFontSize(9);
  if (header.academicYear) {
    doc.text(`Année scolaire : ${header.academicYear}`, pageWidth / 2, 26, { align: 'center' });
  }
  doc.text(
    header.classFilter ? `Classe : ${header.classFilter}` : 'Toutes les classes',
    pageWidth / 2,
    30,
    { align: 'center' },
  );

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(14, 33, pageWidth - 14, 33);

  const totalDue = accounts.reduce((sum, a) => sum + (Number(a.totalDue) || 0), 0);
  const totalPaid = accounts.reduce((sum, a) => sum + (Number(a.totalPaid) || 0), 0);
  const totalBalance = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

  const tableData = accounts.map((a) => [
    a.student?.matricule || '—',
    a.student?.lastName || '—',
    a.student?.firstName || '—',
    a.studentEnrollments?.[0]?.class?.name || '—',
    a.student?.schoolLevel?.name || '—',
    (Number(a.balance) || 0).toLocaleString('fr-FR'),
    (Number(a.totalPaid) || 0).toLocaleString('fr-FR'),
    (Number(a.totalDue) || 0).toLocaleString('fr-FR'),
  ]);

  tableData.push([
    '', '', '', '', 'TOTAL',
    totalBalance.toLocaleString('fr-FR'),
    totalPaid.toLocaleString('fr-FR'),
    totalDue.toLocaleString('fr-FR'),
  ]);

  (doc as any).autoTable({
    head: [['Matricule', 'Nom', 'Prénom', 'Classe', 'Niveau', 'Solde dû', 'Payé', 'À payer']],
    body: tableData,
    startY: 36,
    theme: 'grid',
    headStyles: { fillColor: [30, 60, 120], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 22 },
      4: { cellWidth: 20 },
      5: { cellWidth: 25, halign: 'right' },
      6: { cellWidth: 25, halign: 'right' },
      7: { cellWidth: 25, halign: 'right' },
    },
    didParseCell: (data: any) => {
      if (data.row.index === tableData.length - 1 && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [255, 251, 235];
        data.cell.styles.textColor = [120, 60, 0];
      }
    },
    didDrawPage: (data: any) => {
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${data.pageNumber}`, pageWidth - 20, pageHeight - 8);
      doc.text(
        `Généré le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
        14,
        pageHeight - 8,
      );
    },
  });

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  return { blob, url };
}

/* ------------------------------------------------------------------ */
/*  Export PDF — Historique d'un élève (transactions d'un seul élève)  */
/* ------------------------------------------------------------------ */

export async function exportStudentHistoryToPdf(
  transactions: TransactionRow[],
  header: SchoolHeader & { studentName: string; studentMatricule: string; className?: string }
): Promise<{ blob: Blob; url: string }> {
  const jsPDF = await loadJsPdf();
  await loadAutoTable(jsPDF);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Entête école
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text(header.schoolName, pageWidth / 2, 18, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text('Historique des paiements', pageWidth / 2, 24, { align: 'center' });

  doc.setFontSize(9);
  if (header.academicYear) {
    doc.text(`Année scolaire : ${header.academicYear}`, pageWidth / 2, 29, { align: 'center' });
  }

  // Infos élève
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text(header.studentName, 14, 40);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  let infoY = 46;
  doc.text(`Matricule : ${header.studentMatricule}`, 14, infoY);
  if (header.className) {
    doc.text(`Classe : ${header.className}`, 14, infoY + 4);
    infoY += 4;
  }
  doc.text(formatPeriod(header), 14, infoY + 4);

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(14, infoY + 8, pageWidth - 14, infoY + 8);

  const totalPaid = transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const tableData = transactions.map((t) => [
    formatDateTimeFr(t.createdAt || t.date),
    t.receiptNumber || '—',
    (Number(t.amount) || 0).toLocaleString('fr-FR'),
    METHOD_LABELS[t.paymentMethod || ''] || t.paymentMethod || '—',
    t.reference || '—',
  ]);

  tableData.push(['', 'TOTAL', totalPaid.toLocaleString('fr-FR') + ' FCFA', '', '']);

  (doc as any).autoTable({
    head: [['Date', 'Reçu', 'Montant (FCFA)', 'Méthode', 'Référence']],
    body: tableData,
    startY: infoY + 11,
    theme: 'grid',
    headStyles: { fillColor: [30, 60, 120], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 25 },
      4: { cellWidth: 'auto' },
    },
    didParseCell: (data: any) => {
      if (data.row.index === tableData.length - 1 && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [255, 251, 235];
        data.cell.styles.textColor = [120, 60, 0];
      }
    },
    didDrawPage: (data: any) => {
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${data.pageNumber}`, pageWidth - 20, pageHeight - 8);
      doc.text(
        `Généré le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
        14,
        pageHeight - 8,
      );
    },
  });

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  return { blob, url };
}

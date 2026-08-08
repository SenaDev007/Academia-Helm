/**
 * ============================================================================
 * PARENT PORTAL — EXPORTS PDF
 * ============================================================================
 *
 * Helpers de génération PDF pour le portail parent :
 *   - exportReceiptToPdf()       : reçu de paiement (format officiel République du Bénin)
 *   - exportBulletinToPdf()      : bulletin de notes simplifié (1 page par période)
 *
 * Réutilise drawOfficialHeader, drawFooter, preloadSchoolLogo du module finance
 * pour rester visuellement cohérent avec les autres exports de la plateforme.
 * ============================================================================
 */

import {
  drawOfficialHeader,
  drawFooter,
  preloadSchoolLogo,
  formatAmount,
  type SchoolHeader,
} from './finance-exports';

let jsPdfPromise: Promise<any> | null = null;

function loadJsPDF(): Promise<any> {
  if (jsPdfPromise) return jsPdfPromise;
  jsPdfPromise = new Promise((resolve, reject) => {
    if ((window as any).jspdf?.jsPDF) {
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

// ──────────────────────────────────────────────────────────────────────
// Reçu de paiement
// ──────────────────────────────────────────────────────────────────────

export interface ReceiptData {
  paymentId: string;
  amount: number;
  date: string;
  method?: string;
  receiptNumber?: string;
  reference?: string;
  status?: string;
  notes?: string;
  feeName?: string;
  student: string;
  matricule?: string;
  className?: string;
  levelName?: string;
  school?: {
    name?: string;
    logoUrl?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  };
}

function formatDateFr(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function translatePaymentMethod(method?: string): string {
  if (!method) return '—';
  const map: Record<string, string> = {
    CASH: 'Espèces',
    BANK_TRANSFER: 'Virement bancaire',
    BANK_CHECK: 'Chèque bancaire',
    MOBILE_MONEY: 'Mobile Money',
    CARD: 'Carte bancaire',
    ONLINE: 'Paiement en ligne',
    FEDAPAY: 'FedaPay',
    FEEXPAY: 'FeexPay',
  };
  return map[method.toUpperCase()] || method;
}

function translatePaymentStatus(status?: string): string {
  if (!status) return '—';
  const map: Record<string, string> = {
    COMPLETED: 'Validé',
    PENDING: 'En cours',
    FAILED: 'Échoué',
    CANCELLED: 'Annulé',
    REFUNDED: 'Remboursé',
  };
  return map[status.toUpperCase()] || status;
}

export async function exportReceiptToPdf(
  data: ReceiptData,
  schoolHeader: SchoolHeader,
): Promise<void> {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Logo école
  const logoBase64 = await preloadSchoolLogo(schoolHeader.schoolLogoUrl);

  // En-tête officiel
  drawOfficialHeader(doc, schoolHeader, pageWidth, logoBase64);

  // Titre du document
  let y = 60;
  doc.setFont('times', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(13, 31, 110);
  doc.text('REÇU DE PAIEMENT', pageWidth / 2, y, { align: 'center' });
  y += 4;

  doc.setDrawColor(13, 31, 110);
  doc.setLineWidth(0.4);
  doc.line(pageWidth / 2 - 30, y, pageWidth / 2 + 30, y);
  y += 10;

  // Numéro de reçu
  if (data.receiptNumber) {
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text(`Reçu N° : ${data.receiptNumber}`, pageWidth / 2, y, { align: 'center' });
    y += 8;
  }

  // Tableau d'infos (2 colonnes : élève / paiement)
  const tableX = 20;
  const tableW = pageWidth - 40;
  const colW = tableW / 2;
  const rowH = 9;

  // Ligne d'en-tête
  doc.setFillColor(13, 31, 110);
  doc.rect(tableX, y, tableW, rowH, 'F');
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('ÉLÈVE', tableX + 4, y + 6);
  doc.text('PAIEMENT', tableX + colW + 4, y + 6);
  y += rowH;

  // Ligne 1 : Nom / Date
  doc.setFillColor(248, 250, 252);
  doc.rect(tableX, y, tableW, rowH, 'F');
  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 20);
  doc.text(`Nom : ${data.student}`, tableX + 4, y + 6);
  doc.text(`Date : ${formatDateFr(data.date)}`, tableX + colW + 4, y + 6);
  y += rowH;

  // Ligne 2 : Matricule / Méthode
  doc.rect(tableX, y, tableW, rowH, 'F');
  doc.text(`Matricule : ${data.matricule || '—'}`, tableX + 4, y + 6);
  doc.text(`Méthode : ${translatePaymentMethod(data.method)}`, tableX + colW + 4, y + 6);
  y += rowH;

  // Ligne 3 : Classe / Statut
  doc.setFillColor(248, 250, 252);
  doc.rect(tableX, y, tableW, rowH, 'F');
  doc.text(`Classe : ${data.className || '—'}`, tableX + 4, y + 6);
  doc.text(`Statut : ${translatePaymentStatus(data.status)}`, tableX + colW + 4, y + 6);
  y += rowH;

  // Ligne 4 : Niveau / Référence
  doc.rect(tableX, y, tableW, rowH, 'F');
  doc.text(`Niveau : ${data.levelName || '—'}`, tableX + 4, y + 6);
  doc.text(`Référence : ${data.reference || '—'}`, tableX + colW + 4, y + 6);
  y += rowH + 6;

  // Bloc montant
  const amountBoxH = 22;
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(13, 124, 102);
  doc.setLineWidth(0.5);
  doc.rect(tableX, y, tableW, amountBoxH, 'FD');
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(13, 124, 102);
  doc.text('MONTANT PAYÉ', pageWidth / 2, y + 6, { align: 'center' });
  doc.setFont('times', 'bold');
  doc.setFontSize(22);
  doc.text(`${formatAmount(data.amount)} FCFA`, pageWidth / 2, y + 17, { align: 'center' });
  y += amountBoxH + 6;

  // Frai concerné
  if (data.feeName) {
    doc.setFont('times', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    doc.text(`Frai concerné : `, tableX, y);
    doc.setFont('times', 'normal');
    doc.text(data.feeName, tableX + 38, y);
    y += 6;
  }

  // Notes
  if (data.notes) {
    y += 2;
    doc.setFont('times', 'bold');
    doc.setFontSize(9);
    doc.text('Observations :', tableX, y);
    doc.setFont('times', 'italic');
    doc.setTextColor(80, 80, 80);
    const lines = doc.splitTextToSize(data.notes, tableW);
    doc.text(lines, tableX, y + 5);
    y += 5 + lines.length * 4;
  }

  // Zone signatures (à droite, en bas)
  y = Math.max(y, pageHeight - 50);
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.line(pageWidth - 70, y, pageWidth - 20, y);
  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text('Cachet & Signature', pageWidth - 45, y + 5, { align: 'center' });

  // Pied de page
  drawFooter(doc, pageWidth, pageHeight, 1);

  // Sauvegarder
  const fileName = `recu_${data.receiptNumber || data.paymentId}_${Date.now()}.pdf`;
  doc.save(fileName);
}

// ──────────────────────────────────────────────────────────────────────
// Bulletin de notes (version parent — simplifiée, 1 page par période)
// ──────────────────────────────────────────────────────────────────────

export interface BulletinItem {
  subjectName: string;
  average?: number | null;
  coefficient?: number | null;
  rank?: number | null;
  comments?: string | null;
}

export interface BulletinData {
  reportCardId: string;
  type?: string;
  overallAverage?: number | null;
  rank?: number | null;
  status?: string;
  quarterName?: string;
  filePath?: string | null;
  publishedAt?: string;
  items: BulletinItem[];
  student: {
    firstName: string;
    lastName: string;
    matricule?: string;
    className?: string;
    levelName?: string;
  };
}

export async function exportBulletinToPdf(
  data: BulletinData,
  schoolHeader: SchoolHeader,
): Promise<void> {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const logoBase64 = await preloadSchoolLogo(schoolHeader.schoolLogoUrl);
  drawOfficialHeader(doc, schoolHeader, pageWidth, logoBase64);

  // Titre
  let y = 60;
  doc.setFont('times', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(13, 31, 110);
  doc.text('BULLETIN DE NOTES', pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.setDrawColor(13, 31, 110);
  doc.setLineWidth(0.4);
  doc.line(pageWidth / 2 - 35, y, pageWidth / 2 + 35, y);
  y += 8;

  // Période
  if (data.quarterName) {
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text(data.quarterName, pageWidth / 2, y, { align: 'center' });
    y += 7;
  }

  // Infos élève
  const tableX = 20;
  const tableW = pageWidth - 40;
  const rowH = 8;
  doc.setFillColor(13, 31, 110);
  doc.rect(tableX, y, tableW, rowH, 'F');
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('ÉLÈVE', tableX + 4, y + 5.5);
  y += rowH;

  doc.setFillColor(248, 250, 252);
  doc.rect(tableX, y, tableW, rowH, 'F');
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  const studentLine = `${data.student.firstName} ${data.student.lastName}` +
    (data.student.matricule ? `  —  Matricule : ${data.student.matricule}` : '') +
    (data.student.className ? `  —  Classe : ${data.student.className}` : '');
  doc.text(studentLine, tableX + 4, y + 5.5);
  y += rowH + 5;

  // Tableau des matières
  if (data.items && data.items.length > 0) {
    // En-tête tableau
    const cols = [
      { label: 'Matière', x: tableX + 4, w: 70 },
      { label: 'Moyenne', x: tableX + 90, w: 25, align: 'center' as const },
      { label: 'Coef.', x: tableX + 120, w: 18, align: 'center' as const },
      { label: 'Rang', x: tableX + 142, w: 18, align: 'center' as const },
      { label: 'Appréciation', x: tableX + 165, w: 25, align: 'left' as const },
    ];
    doc.setFillColor(13, 31, 110);
    doc.rect(tableX, y, tableW, rowH, 'F');
    doc.setFont('times', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    cols.forEach((c) => {
      doc.text(c.label, c.x, y + 5.5, { align: (c.align as any) || 'left' });
    });
    y += rowH;

    // Lignes matières
    doc.setFont('times', 'normal');
    doc.setFontSize(9);
    data.items.forEach((item, idx) => {
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(tableX, y, tableW, rowH, 'F');
      }
      doc.setTextColor(20, 20, 20);
      doc.text(item.subjectName || '—', cols[0].x, y + 5.5);
      doc.text(
        item.average != null ? Number(item.average).toFixed(2) : '—',
        cols[1].x,
        y + 5.5,
        { align: 'center' },
      );
      doc.text(
        item.coefficient != null ? String(item.coefficient) : '—',
        cols[2].x,
        y + 5.5,
        { align: 'center' },
      );
      doc.text(
        item.rank != null ? String(item.rank) : '—',
        cols[3].x,
        y + 5.5,
        { align: 'center' },
      );
      const comments = item.comments || '—';
      const truncatedComments =
        comments.length > 35 ? comments.substring(0, 32) + '…' : comments;
      doc.text(truncatedComments, cols[4].x, y + 5.5);
      y += rowH;

      // Nouvelle page si nécessaire
      if (y > pageHeight - 50) {
        drawFooter(doc, pageWidth, pageHeight, 1);
        doc.addPage();
        drawOfficialHeader(doc, schoolHeader, pageWidth, logoBase64);
        y = 60;
      }
    });

    // Ligne moyenne générale
    y += 4;
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(13, 124, 102);
    doc.setLineWidth(0.5);
    doc.rect(tableX, y, tableW, 12, 'FD');
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(13, 124, 102);
    doc.text('MOYENNE GÉNÉRALE', tableX + 4, y + 7.5);
    const avgText = data.overallAverage != null
      ? `${Number(data.overallAverage).toFixed(2)} / 20`
      : '—';
    doc.setFontSize(14);
    doc.text(avgText, tableX + tableW - 4, y + 7.5, { align: 'right' });

    if (data.rank != null) {
      doc.setFont('times', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.text(`Rang : ${data.rank}`, tableX + 4, y + 11);
    }
  } else {
    doc.setFont('times', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text('Aucune note disponible pour cette période.', tableX, y + 5);
  }

  // Pied de page
  drawFooter(doc, pageWidth, pageHeight, 1);

  const fileName = `bulletin_${data.student.lastName}_${data.reportCardId}.pdf`;
  doc.save(fileName);
}

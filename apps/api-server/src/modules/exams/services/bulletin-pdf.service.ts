/**
 * ============================================================================
 * BULLETIN PDF SERVICE - MODULE 3
 * ============================================================================
 *
 * Génération de bulletins officiels avec:
 *   - En-tête officiel (République du Bénin + drapeau + ministère + école)
 *   - Tableau conforme au carnet de correspondance:
 *     * Maternelle: TS/S/PS par matière
 *     * Primaire: CM/18, CP/2, Total/20, Seuil de réussite
 *   - Synthèse (moyenne, rang, mention, moy. classe)
 *   - QR code de vérification
 *   - Signatures (Titulaire, Directeur, Parents)
 *
 * Utilise PuppeteerPoolService (HTML → PDF) comme le module Élèves.
 * Format A4 paysage.
 * ============================================================================
 */

import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { PuppeteerPoolService } from '../../../common/services/puppeteer-pool.service';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';

export interface BulletinPdfData {
  // École
  schoolName: string;
  schoolLogo?: string | null;
  schoolAddress?: string;
  schoolPhone?: string;
  schoolEmail?: string;
  schoolSlogan?: string;
  isSecondary?: boolean;
  // Année + période
  academicYearName: string;
  periodName: string;
  evaluationTypeName: string;
  evaluationTypeCode?: string;
  // Classe
  className: string;
  // Élève
  studentName: string;
  studentMatricule?: string;
  studentGender?: string;
  // Niveau scolaire
  isMaternelle: boolean;
  // Matières + notes
  subjects: Array<{
    name: string;
    score: number | null;
    qualitativeCode?: string | null;
    isAbsent: boolean;
    appreciation: string;
  }>;
  // Stats
  generalAverage: number | null;
  classRank: number;
  classAverage: number | null;
  highestAverage: number | null;
  lowestAverage: number | null;
  totalStudents: number;
  appreciationGlobale?: string | null;
  // Signatures (base64)
  teacherSignature?: string | null;
  directorSignature?: string | null;
  parentSignature?: string | null;
}

@Injectable()
export class BulletinPdfService {
  private readonly logger = new Logger(BulletinPdfService.name);

  constructor(
    private readonly puppeteerPool: PuppeteerPoolService,
    private readonly configService: ConfigService,
  ) {}

  async generateBulletin(data: BulletinPdfData): Promise<Buffer> {
    try {
      // 1. Generate QR code
      const bulletinId = `BULL-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const qrDataUrl = await QRCode.toDataURL(
        `https://academiahelm.com/verify/bulletin/${bulletinId}`,
        { width: 100, margin: 1 }
      );

      // 2. Build HTML
      const html = this.buildHtml(data, qrDataUrl, bulletinId);

      // 3. Generate PDF via Puppeteer
      const { page } = await this.puppeteerPool.acquirePage();
      try {
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
          format: 'A4',
          landscape: true,
          printBackground: true,
          margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
        });
        return Buffer.from(pdfBuffer);
      } finally {
        await this.puppeteerPool.releasePage(page);
      }
    } catch (error) {
      this.logger.error('Error generating bulletin PDF:', error);
      throw new InternalServerErrorException('Erreur lors de la génération du bulletin PDF');
    }
  }

  private buildHtml(data: BulletinPdfData, qrCode: string, bulletinId: string): string {
    const ministry = data.isSecondary
      ? "Ministère de l'Enseignement Secondaire, de la Formation Technique et Professionnelle, de la Reconversion et de l'Insertion des Jeunes"
      : 'Ministère des Enseignements Maternel et Primaire';

    // Benin flag as SVG data URL
    const beninFlagSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="40" viewBox="0 0 75 50"><rect width="30" height="50" fill="#008751"/><rect x="30" width="45" height="25" fill="#FCD116"/><rect x="30" y="25" width="45" height="25" fill="#E8112D"/></svg>`;
    const beninFlag = `data:image/svg+xml;base64,${Buffer.from(beninFlagSvg).toString('base64')}`;

    // Build subject rows
    const subjectRows = data.subjects.map((s, i) => {
      if (data.isMaternelle) {
        const code = s.qualitativeCode;
        const tsCheck = code === 'TS' ? '✓' : '';
        const sCheck = code === 'S' ? '✓' : '';
        const psCheck = code === 'PS' ? '✓' : '';
        const absent = s.isAbsent ? '<span style="color:red;font-size:8px">ABS</span>' : '';
        return `<tr>
          <td style="border:1px solid #cbd5e1;padding:3px 4px;font-size:10px;">${s.name}</td>
          <td style="border:1px solid #cbd5e1;padding:3px 4px;text-align:center;font-size:10px;">${tsCheck || absent}</td>
          <td style="border:1px solid #cbd5e1;padding:3px 4px;text-align:center;font-size:10px;">${sCheck}</td>
          <td style="border:1px solid #cbd5e1;padding:3px 4px;text-align:center;font-size:10px;">${psCheck}</td>
          <td style="border:1px solid #cbd5e1;padding:3px 4px;text-align:center;font-size:9px;color:#64748b;">${s.appreciation}</td>
          <td style="border:1px solid #cbd5e1;padding:3px 4px;text-align:center;font-size:9px;color:#94a3b8;">—</td>
          <td style="border:1px solid #cbd5e1;padding:3px 4px;text-align:center;font-size:9px;color:#94a3b8;">—</td>
        </tr>`;
      } else {
        const scoreVal = s.isAbsent
          ? '<span style="color:red;font-size:8px;font-weight:bold">ABS</span>'
          : s.score !== null
            ? `<span style="color:${s.score >= 10 ? '#059669' : '#dc2626'};font-weight:bold">${s.score.toFixed(2)}</span>`
            : '—';
        const reached = !s.isAbsent && s.score !== null && s.score >= 10;
        return `<tr>
          <td style="border:1px solid #cbd5e1;padding:3px 4px;font-size:10px;">${s.name}</td>
          <td style="border:1px solid #cbd5e1;padding:3px 4px;text-align:center;font-size:8px;color:#94a3b8;">10</td>
          <td style="border:1px solid #cbd5e1;padding:3px 4px;text-align:center;font-size:9px;color:#94a3b8;">—</td>
          <td style="border:1px solid #cbd5e1;padding:3px 4px;text-align:center;font-size:9px;color:#94a3b8;">—</td>
          <td style="border:1px solid #cbd5e1;padding:3px 4px;text-align:center;font-size:10px;font-weight:bold;">${scoreVal}</td>
          <td style="border:1px solid #cbd5e1;padding:3px 4px;text-align:center;font-size:9px;">${reached ? '✓' : ''}</td>
          <td style="border:1px solid #cbd5e1;padding:3px 4px;text-align:center;font-size:9px;">${!reached && s.score !== null ? '✓' : ''}</td>
          <td style="border:1px solid #cbd5e1;padding:3px 4px;text-align:center;font-size:9px;">${reached ? '✓' : ''}</td>
          <td style="border:1px solid #cbd5e1;padding:3px 4px;text-align:center;font-size:9px;">${!reached && s.score !== null ? '✓' : ''}</td>
          <td style="border:1px solid #cbd5e1;padding:3px 4px;text-align:center;font-size:9px;color:#64748b;">${s.appreciation}</td>
        </tr>`;
      }
    }).join('');

    // Table header
    const tableHeader = data.isMaternelle ? `
      <tr style="background:#0A2A5E;color:white;">
        <th rowspan="2" style="border:1px solid #0D3B85;padding:4px;font-size:9px;text-transform:uppercase;">Matière</th>
        <th colspan="3" style="border:1px solid #0D3B85;padding:4px;font-size:9px;text-transform:uppercase;">Résultats</th>
        <th rowspan="2" style="border:1px solid #0D3B85;padding:4px;font-size:8px;text-transform:uppercase;">Appréciation ens.</th>
        <th rowspan="2" style="border:1px solid #0D3B85;padding:4px;font-size:8px;text-transform:uppercase;">Visa Directeur</th>
        <th rowspan="2" style="border:1px solid #0D3B85;padding:4px;font-size:8px;text-transform:uppercase;">Visa Parents</th>
      </tr>
      <tr style="background:#0D3B85;color:white;">
        <th style="border:1px solid #114FC4;padding:3px;font-size:9px;">TS</th>
        <th style="border:1px solid #114FC4;padding:3px;font-size:9px;">S</th>
        <th style="border:1px solid #114FC4;padding:3px;font-size:9px;">PS</th>
      </tr>` : `
      <tr style="background:#0A2A5E;color:white;">
        <th rowspan="2" style="border:1px solid #0D3B85;padding:4px;font-size:9px;text-transform:uppercase;text-align:left;">Champs de formation</th>
        <th rowspan="2" style="border:1px solid #0D3B85;padding:4px;font-size:8px;text-transform:uppercase;">Note min.</th>
        <th style="border:1px solid #0D3B85;padding:4px;font-size:8px;">CM/18</th>
        <th style="border:1px solid #0D3B85;padding:4px;font-size:8px;">CP/02</th>
        <th rowspan="2" style="border:1px solid #0D3B85;padding:4px;font-size:8px;text-transform:uppercase;">Total /20</th>
        <th colspan="2" style="border:1px solid #0D3B85;padding:4px;font-size:8px;text-transform:uppercase;">Maîtrise min.</th>
        <th colspan="2" style="border:1px solid #0D3B85;padding:4px;font-size:8px;text-transform:uppercase;">Seuil réussite</th>
        <th rowspan="2" style="border:1px solid #0D3B85;padding:4px;font-size:8px;text-transform:uppercase;">Appréciation</th>
      </tr>
      <tr style="background:#0D3B85;color:white;">
        <th style="border:1px solid #114FC4;padding:3px;font-size:8px;">Oui</th>
        <th style="border:1px solid #114FC4;padding:3px;font-size:8px;">Non</th>
        <th style="border:1px solid #114FC4;padding:3px;font-size:8px;">Oui</th>
        <th style="border:1px solid #114FC4;padding:3px;font-size:8px;">Non</th>
      </tr>`;

    // Total General row (Primaire only)
    const totalRow = !data.isMaternelle ? `
      <tr style="background:#e2e8f0;font-weight:bold;">
        <td colspan="4" style="border:1px solid #cbd5e1;padding:4px;font-size:10px;text-transform:uppercase;">TOTAL GENERAL</td>
        <td style="border:1px solid #cbd5e1;padding:4px;text-align:center;font-size:10px;color:#0A2A5E;">${data.generalAverage !== null ? (data.generalAverage * data.subjects.length).toFixed(2) : '—'}</td>
        <td colspan="5" style="border:1px solid #cbd5e1;"></td>
      </tr>` : '';

    // Synthèse
    const syntheseRows = data.isMaternelle ? `
      <div style="margin-top:10px;text-align:center;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:6px;">
        <span style="font-size:10px;font-weight:bold;color:#0A2A5E;text-transform:uppercase;">Symbole mérité: </span>
        <span style="font-size:12px;font-weight:bold;color:${data.appreciationGlobale === 'Très Satisfaisant' ? '#059669' : data.appreciationGlobale === 'Satisfaisant' ? '#2563eb' : '#d97706'};">${data.appreciationGlobale || '—'}</span>
      </div>` : `
      <div style="margin-top:8px;font-size:10px;">
        <div style="display:flex;justify-content:space-between;background:#f8fafc;padding:3px 8px;border-radius:2px;margin-bottom:2px;"><span>Moyenne obtenue par l'élève:</span><strong style="color:#0A2A5E;">${data.generalAverage !== null ? data.generalAverage.toFixed(2) : '—'}/20</strong></div>
        <div style="display:flex;justify-content:space-between;background:#f8fafc;padding:3px 8px;border-radius:2px;margin-bottom:2px;"><span>Plus forte moyenne de la classe:</span><strong>${data.highestAverage !== null ? data.highestAverage.toFixed(2) : '—'}/20</strong></div>
        <div style="display:flex;justify-content:space-between;background:#f8fafc;padding:3px 8px;border-radius:2px;margin-bottom:2px;"><span>Plus faible moyenne de la classe:</span><strong>${data.lowestAverage !== null ? data.lowestAverage.toFixed(2) : '—'}/20</strong></div>
        <div style="display:flex;justify-content:space-between;background:#f8fafc;padding:3px 8px;border-radius:2px;margin-bottom:2px;"><span>Seuil de réussite globale fixé à:</span><strong>10/20</strong></div>
        <div style="display:flex;justify-content:space-between;background:#ecfdf5;padding:3px 8px;border-radius:2px;font-weight:bold;"><span>Seuil de réussite globale atteint:</span><span style="color:${(data.generalAverage || 0) >= 10 ? '#059669' : '#dc2626'};">${(data.generalAverage || 0) >= 10 ? 'OUI' : 'NON'}</span></div>
      </div>`;

    // Signatures
    const teacherSig = data.teacherSignature
      ? `<img src="${data.teacherSignature}" style="max-height:40px;max-width:150px;object-fit:contain;" />`
      : '<div style="height:40px;"></div>';
    const directorSig = data.directorSignature
      ? `<img src="${data.directorSignature}" style="max-height:40px;max-width:150px;object-fit:contain;" />`
      : '<div style="height:40px;"></div>';
    const parentSig = data.parentSignature
      ? `<img src="${data.parentSignature}" style="max-height:40px;max-width:150px;object-fit:contain;" />`
      : '<div style="height:40px;"></div>';

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Bulletin - ${data.studentName}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Times New Roman',Georgia,serif; color:#1a1a1a; font-size:11px; }
.header { margin-bottom:12px; padding-bottom:8px; border-bottom:3px double #0A2A5E; }
.header-table { width:100%; border-collapse:collapse; }
.header-table td { vertical-align:middle; padding:3px 6px; }
.header-left { text-align:center; width:15%; }
.header-center { text-align:center; width:65%; }
.header-right { text-align:center; width:20%; }
.republique { font-size:12px; font-weight:bold; text-transform:uppercase; letter-spacing:0.5px; }
.divider { margin:3px auto; width:50%; display:flex; align-items:center; justify-content:center; gap:4px; }
.divider-line { flex:1; height:1px; background:#0A2A5E; }
.divider-diamond { width:5px; height:5px; background:#0A2A5E; transform:rotate(45deg); flex-shrink:0; }
.ministere { font-size:9px; font-weight:bold; text-transform:uppercase; letter-spacing:0.3px; line-height:1.3; }
.school-name { font-size:13px; font-weight:bold; text-transform:uppercase; margin-top:4px; color:#0A2A5E; }
.school-info { font-size:8px; color:#555; margin-top:2px; font-style:italic; }
.bulletin-title { text-align:center; background:#0A2A5E; color:white; padding:5px 10px; border-radius:3px; margin-bottom:8px; font-size:11px; font-weight:bold; text-transform:uppercase; }
.student-info { display:flex; justify-content:space-between; background:#f8fafc; border:1px solid #e2e8f0; border-radius:3px; padding:5px 10px; margin-bottom:8px; font-size:10px; }
.student-info strong { color:#0A2A5E; }
table.notes { width:100%; border-collapse:collapse; }
table.notes th { color:white; border:1px solid; padding:3px 4px; font-size:8px; text-transform:uppercase; }
table.notes td { border:1px solid #cbd5e1; padding:3px 4px; }
table.notes tbody tr:nth-child(even) { background:#f8fafc; }
.signatures { display:flex; justify-content:space-between; margin-top:20px; gap:12px; }
.sig-box { flex:1; text-align:center; }
.sig-label { font-size:9px; font-weight:bold; color:#0A2A5E; margin-bottom:2px; }
.sig-line { border-top:1px solid #94a3b8; margin-top:5px; padding-top:3px; font-size:7px; color:#94a3b8; }
.qr-section { display:flex; justify-content:flex-end; margin-top:10px; align-items:center; gap:6px; }
.qr-section img { width:50px; height:50px; }
.qr-text { font-size:6px; color:#94a3b8; text-align:right; }
.footer { margin-top:5px; text-align:center; font-size:7px; color:#999; border-top:1px solid #eee; padding-top:5px; }
</style>
</head>
<body>

<!-- EN-TÊTE OFFICIEL -->
<div class="header">
  <table class="header-table">
    <tr>
      <td class="header-left"><img src="${beninFlag}" alt="Drapeau du Bénin" style="width:40px;height:27px;" /></td>
      <td class="header-center">
        <div class="republique">République du Bénin</div>
        <div class="divider"><div class="divider-line"></div><div class="divider-diamond"></div><div class="divider-line"></div></div>
        <div class="ministere">${ministry}</div>
        <div class="divider"><div class="divider-line"></div><div class="divider-diamond"></div><div class="divider-line"></div></div>
        <div class="school-name">${data.schoolName}</div>
        <div class="school-info">${data.schoolSlogan ? `« ${data.schoolSlogan} » · ` : ''}${data.schoolAddress || ''} · Tél: ${data.schoolPhone || ''} · ${data.schoolEmail || ''}</div>
      </td>
      <td class="header-right">${data.schoolLogo ? `<img src="${data.schoolLogo}" style="max-width:50px;max-height:50px;object-fit:contain;" />` : ''}</td>
    </tr>
  </table>
</div>

<!-- TITRE BULLETIN -->
<div class="bulletin-title">Bulletin de ${data.evaluationTypeName} ${data.evaluationTypeCode ? '(' + data.evaluationTypeCode + ')' : ''} — ${data.periodName} ${data.academicYearName}</div>

<!-- INFOS ÉLÈVE -->
<div class="student-info">
  <div>Élève: <strong>${data.studentName}</strong></div>
  <div>Matricule: <strong>${data.studentMatricule || '—'}</strong></div>
  <div>Classe: <strong>${data.className}</strong></div>
  <div>Rang: <strong>${data.classRank}</strong> / ${data.totalStudents}</div>
</div>

<!-- TABLEAU DES NOTES -->
<table class="notes">
  <thead>${tableHeader}</thead>
  <tbody>${subjectRows}${totalRow}</tbody>
</table>

<!-- SYNTHÈSE -->
${syntheseRows}

<!-- SIGNATURES -->
<div class="signatures">
  <div class="sig-box"><div class="sig-label">Titulaire de la classe</div>${teacherSig}<div class="sig-line">Signature</div></div>
  <div class="sig-box"><div class="sig-label">Le Directeur(trice)</div>${directorSig}<div class="sig-line">Visa</div></div>
  <div class="sig-box"><div class="sig-label">Les Parents</div>${parentSig}<div class="sig-line">Nom, Prénoms et Signature</div></div>
</div>

<!-- QR CODE -->
<div class="qr-section">
  <div class="qr-text">Code de vérification<br/>${bulletinId.substring(0, 25)}…</div>
  <img src="${qrCode}" alt="QR Code" />
</div>

<!-- PIED DE PAGE -->
<div class="footer">Document généré par Academia Helm — ${new Date().toLocaleDateString('fr-FR')}</div>

</body>
</html>`;
  }
}

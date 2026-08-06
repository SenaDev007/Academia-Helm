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
    // ⭐ Visa du directeur par matière (auto-rempli depuis appreciation, éditable)
    directorVisa?: string | null;
  }>;
  // Stats
  generalAverage: number | null;
  classRank: number;
  classAverage: number | null;
  highestAverage: number | null;
  lowestAverage: number | null;
  totalStudents: number;
  // ⭐ Appréciation globale (texte : "Très Satisfaisant", "Satisfaisant", "Peu Satisfaisant")
  appreciationGlobale?: string | null;
  // ⭐ Symbole mérité par l'élève (emoji + texte court)
  symboleMerite?: string | null;
  // ⭐ Visa global du directeur (auto-rempli depuis appreciation, éditable)
  directorVisa?: string | null;
  // Signatures (base64)
  teacherSignature?: string | null;
  directorSignature?: string | null;
  parentSignature?: string | null;
}

/**
 * ⭐ Formate un rang en ordinal français :
 *   1 → "1er", 2 → "2ème", 3 → "3ème", 4 → "4ème", etc.
 *   Pour le féminin : 1 → "1ère", 2 → "2ème", etc.
 */
function formatRank(rank: number | null | undefined, feminine: boolean = false): string {
  if (rank === null || rank === undefined) return '—';
  if (rank === 1) return feminine ? '1ère' : '1er';
  return `${rank}ème`;
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

    // ⭐ Symbole mérité (emoji) — distinct de l'appréciation globale (texte)
    // Mapping : Très Satisfaisant → 🌟, Satisfaisant → 👍, Peu Satisfaisant → ⚠️
    // Pour Primaire/Secondaire : moyenne >= 16 → 🏆, >= 14 → 🌟, >= 12 → 👍, >= 10 → ✅, < 10 → ⚠️
    const symboleMerite = data.symboleMerite || this.computeSymboleMerite(data);

    // Build subject rows
    const subjectRows = data.subjects.map((s) => {
      const directorVisaCell = s.directorVisa || s.appreciation || '—';
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
          <td style="border:1px solid #cbd5e1;padding:3px 4px;text-align:center;font-size:9px;color:#0A2A5E;font-weight:600;">${directorVisaCell}</td>
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
          <td style="border:1px solid #cbd5e1;padding:3px 4px;text-align:center;font-size:9px;color:#0A2A5E;font-weight:600;">${directorVisaCell}</td>
        </tr>`;
      }
    }).join('');

    // Table header — ajout de la colonne "Visa Directeur" pour Primaire aussi
    const tableHeader = data.isMaternelle ? `
      <tr style="background:#0A2A5E;color:white;">
        <th rowspan="2" style="border:1px solid #0D3B85;padding:4px;font-size:9px;text-transform:uppercase;">Matière</th>
        <th colspan="3" style="border:1px solid #0D3B85;padding:4px;font-size:9px;text-transform:uppercase;">Résultats</th>
        <th rowspan="2" style="border:1px solid #0D3B85;padding:4px;font-size:8px;text-transform:uppercase;">Appréciation ens.</th>
        <th rowspan="2" style="border:1px solid #0D3B85;padding:4px;font-size:8px;text-transform:uppercase;background:#0D3B85;">Visa Directeur</th>
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
        <th rowspan="2" style="border:1px solid #0D3B85;padding:4px;font-size:8px;text-transform:uppercase;background:#0D3B85;">Visa Directeur</th>
      </tr>
      <tr style="background:#0D3B85;color:white;">
        <th style="border:1px solid #114FC4;padding:3px;font-size:8px;">Oui</th>
        <th style="border:1px solid #114FC4;padding:3px;font-size:8px;">Non</th>
        <th style="border:1px solid #114FC4;padding:3px;font-size:8px;">Oui</th>
        <th style="border:1px solid #114FC4;padding:3px;font-size:8px;">Non</th>
      </tr>`;

    // Total General row (Primaire only) — ajout d'une cellule pour Visa Directeur
    const totalRow = !data.isMaternelle ? `
      <tr style="background:#e2e8f0;font-weight:bold;">
        <td colspan="4" style="border:1px solid #cbd5e1;padding:4px;font-size:10px;text-transform:uppercase;">TOTAL GENERAL</td>
        <td style="border:1px solid #cbd5e1;padding:4px;text-align:center;font-size:10px;color:#0A2A5E;">${data.generalAverage !== null ? (data.generalAverage * data.subjects.length).toFixed(2) : '—'}</td>
        <td colspan="5" style="border:1px solid #cbd5e1;"></td>
        <td style="border:1px solid #cbd5e1;padding:4px;text-align:center;font-size:9px;color:#0A2A5E;font-weight:600;">${data.directorVisa || '—'}</td>
      </tr>` : '';

    // ⭐ Colonne gauche : Tableau + synthèse (mathématiques)
    // ⭐ Colonne droite : Symbole mérité, visa directeur, signatures, QR
    const leftColumn = `
      <div class="col-left">
        <table class="notes">
          <thead>${tableHeader}</thead>
          <tbody>${subjectRows}${totalRow}</tbody>
        </table>
        ${data.isMaternelle ? `
        <div style="margin-top:6px;text-align:center;background:#f8fafc;border:1px solid #e2e8f0;border-radius:3px;padding:4px;">
          <span style="font-size:9px;font-weight:bold;color:#0A2A5E;text-transform:uppercase;">Symbole mérité par l'élève : </span>
          <span style="font-size:14px;">${symboleMerite}</span>
          <span style="font-size:9px;color:#64748b;margin-left:4px;">(${data.appreciationGlobale || '—'})</span>
        </div>` : `
        <div style="margin-top:6px;font-size:9px;">
          <div style="display:flex;justify-content:space-between;background:#f8fafc;padding:2px 6px;border-radius:2px;margin-bottom:1px;"><span>Moyenne obtenue :</span><strong style="color:#0A2A5E;">${data.generalAverage !== null ? data.generalAverage.toFixed(2) : '—'}/20</strong></div>
          <div style="display:flex;justify-content:space-between;background:#f8fafc;padding:2px 6px;border-radius:2px;margin-bottom:1px;"><span>Plus forte moyenne :</span><strong>${data.highestAverage !== null ? data.highestAverage.toFixed(2) : '—'}/20</strong></div>
          <div style="display:flex;justify-content:space-between;background:#f8fafc;padding:2px 6px;border-radius:2px;margin-bottom:1px;"><span>Plus faible moyenne :</span><strong>${data.lowestAverage !== null ? data.lowestAverage.toFixed(2) : '—'}/20</strong></div>
          <div style="display:flex;justify-content:space-between;background:#ecfdf5;padding:2px 6px;border-radius:2px;font-weight:bold;"><span>Seuil réussite (10/20) atteint :</span><span style="color:${(data.generalAverage || 0) >= 10 ? '#059669' : '#dc2626'};">${(data.generalAverage || 0) >= 10 ? 'OUI' : 'NON'}</span></div>
        </div>`}
      </div>`;

    // ⭐ Colonne droite : Symbole + appréciation + visa directeur + signatures + QR
    const rightColumn = `
      <div class="col-right">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:3px;padding:6px;margin-bottom:6px;">
          <div style="font-size:8px;font-weight:bold;color:#0A2A5E;text-transform:uppercase;margin-bottom:3px;">Symbole mérité par l'élève</div>
          <div style="text-align:center;font-size:24px;line-height:1.2;">${symboleMerite}</div>
        </div>
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:3px;padding:6px;margin-bottom:6px;">
          <div style="font-size:8px;font-weight:bold;color:#0A2A5E;text-transform:uppercase;margin-bottom:3px;">Appréciation globale</div>
          <div style="font-size:10px;color:${data.appreciationGlobale === 'Très Satisfaisant' ? '#059669' : data.appreciationGlobale === 'Satisfaisant' ? '#2563eb' : '#d97706'};font-weight:600;text-align:center;">${data.appreciationGlobale || (data.isMaternelle ? '—' : (data.generalAverage !== null ? (data.generalAverage >= 16 ? 'Très Bien' : data.generalAverage >= 14 ? 'Bien' : data.generalAverage >= 12 ? 'Assez Bien' : data.generalAverage >= 10 ? 'Passable' : 'Insuffisant') : '—'))}</div>
        </div>
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:3px;padding:6px;margin-bottom:6px;">
          <div style="font-size:8px;font-weight:bold;color:#92400e;text-transform:uppercase;margin-bottom:3px;">Visa du Directeur</div>
          <div style="font-size:9px;color:#1a1a1a;min-height:30px;line-height:1.3;">${data.directorVisa || data.appreciationGlobale || '—'}</div>
        </div>
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:3px;padding:6px;margin-bottom:6px;">
          <div style="font-size:8px;font-weight:bold;color:#0A2A5E;text-transform:uppercase;margin-bottom:3px;">Analyse et recommandations</div>
          <div style="font-size:8px;color:#475569;min-height:40px;line-height:1.3;">${data.directorVisa || '—'}</div>
        </div>
        <div class="signatures" style="display:flex;flex-direction:column;gap:4px;margin-top:6px;">
          <div class="sig-box" style="text-align:center;border:1px solid #e2e8f0;border-radius:3px;padding:3px;">
            <div style="font-size:7px;font-weight:bold;color:#0A2A5E;">Titulaire</div>
            ${data.teacherSignature ? `<img src="${data.teacherSignature}" style="max-height:25px;max-width:80px;object-fit:contain;" />` : '<div style="height:25px;"></div>'}
          </div>
          <div class="sig-box" style="text-align:center;border:1px solid #e2e8f0;border-radius:3px;padding:3px;">
            <div style="font-size:7px;font-weight:bold;color:#0A2A5E;">Le Directeur</div>
            ${data.directorSignature ? `<img src="${data.directorSignature}" style="max-height:25px;max-width:80px;object-fit:contain;" />` : '<div style="height:25px;"></div>'}
          </div>
          <div class="sig-box" style="text-align:center;border:1px solid #e2e8f0;border-radius:3px;padding:3px;">
            <div style="font-size:7px;font-weight:bold;color:#0A2A5E;">Parents</div>
            ${data.parentSignature ? `<img src="${data.parentSignature}" style="max-height:25px;max-width:80px;object-fit:contain;" />` : '<div style="height:25px;"></div>'}
          </div>
        </div>
        <div style="display:flex;justify-content:center;align-items:center;gap:4px;margin-top:6px;">
          <img src="${qrCode}" style="width:40px;height:40px;" alt="QR" />
          <div style="font-size:6px;color:#94a3b8;text-align:right;">Code de vérification<br/>${bulletinId.substring(0, 20)}…</div>
        </div>
      </div>`;

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Bulletin - ${data.studentName}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Times New Roman',Georgia,serif; color:#1a1a1a; font-size:10px; }
.header { margin-bottom:8px; padding-bottom:6px; border-bottom:3px double #0A2A5E; }
.header-table { width:100%; border-collapse:collapse; }
.header-table td { vertical-align:middle; padding:2px 4px; }
.header-left { text-align:center; width:15%; }
.header-center { text-align:center; width:65%; }
.header-right { text-align:center; width:20%; }
.republique { font-size:11px; font-weight:bold; text-transform:uppercase; letter-spacing:0.5px; }
.divider { margin:2px auto; width:50%; display:flex; align-items:center; justify-content:center; gap:3px; }
.divider-line { flex:1; height:1px; background:#0A2A5E; }
.divider-diamond { width:4px; height:4px; background:#0A2A5E; transform:rotate(45deg); flex-shrink:0; }
.ministere { font-size:8px; font-weight:bold; text-transform:uppercase; letter-spacing:0.3px; line-height:1.3; }
.school-name { font-size:12px; font-weight:bold; text-transform:uppercase; margin-top:3px; color:#0A2A5E; }
.school-info { font-size:7px; color:#555; margin-top:2px; font-style:italic; }
.bulletin-title { text-align:center; background:#0A2A5E; color:white; padding:4px 8px; border-radius:3px; margin-bottom:6px; font-size:10px; font-weight:bold; text-transform:uppercase; }
.student-info { display:flex; justify-content:space-between; background:#f8fafc; border:1px solid #e2e8f0; border-radius:3px; padding:4px 8px; margin-bottom:8px; font-size:9px; }
.student-info strong { color:#0A2A5E; }
/* ⭐ Layout 2 colonnes — gauche : tableau + synthèse ; droite : symbole + visa + signatures */
.two-col { display:flex; gap:8px; align-items:flex-start; }
.col-left { flex: 2.3; min-width:0; }
.col-right { flex: 1; min-width:0; }
table.notes { width:100%; border-collapse:collapse; }
table.notes th { color:white; border:1px solid; padding:2px 3px; font-size:7px; text-transform:uppercase; }
table.notes td { border:1px solid #cbd5e1; padding:2px 3px; }
table.notes tbody tr:nth-child(even) { background:#f8fafc; }
.footer { margin-top:4px; text-align:center; font-size:6px; color:#999; border-top:1px solid #eee; padding-top:3px; }
</style>
</head>
<body>

<!-- EN-TÊTE OFFICIEL -->
<div class="header">
  <table class="header-table">
    <tr>
      <td class="header-left"><img src="${beninFlag}" alt="Drapeau du Bénin" style="width:35px;height:23px;" /></td>
      <td class="header-center">
        <div class="republique">République du Bénin</div>
        <div class="divider"><div class="divider-line"></div><div class="divider-diamond"></div><div class="divider-line"></div></div>
        <div class="ministere">${ministry}</div>
        <div class="divider"><div class="divider-line"></div><div class="divider-diamond"></div><div class="divider-line"></div></div>
        <div class="school-name">${data.schoolName}</div>
        <div class="school-info">${data.schoolSlogan ? `« ${data.schoolSlogan} » · ` : ''}${data.schoolAddress || ''} · Tél: ${data.schoolPhone || ''} · ${data.schoolEmail || ''}</div>
      </td>
      <td class="header-right">${data.schoolLogo ? `<img src="${data.schoolLogo}" style="max-width:45px;max-height:45px;object-fit:contain;" />` : ''}</td>
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
  <div>Rang: <strong>${formatRank(data.classRank)}</strong> / ${data.totalStudents}</div>
</div>

<!-- ⭐ LAYOUT 2 COLONNES -->
<div class="two-col">
  ${leftColumn}
  ${rightColumn}
</div>

<!-- PIED DE PAGE -->
<div class="footer">Document généré par Academia Helm — ${new Date().toLocaleDateString('fr-FR')} · ID: ${bulletinId}</div>

</body>
</html>`;
  }

  /**
   * ⭐ Calcule le symbole mérité (emoji) en fonction de l'appréciation ou de la moyenne.
   * Maternelle : TS → 🌟, S → 👍, PS → ⚠️
   * Primaire/Secondaire : >=16 → 🏆, >=14 → 🌟, >=12 → 👍, >=10 → ✅, <10 → ⚠️
   */
  private computeSymboleMerite(data: BulletinPdfData): string {
    if (data.isMaternelle) {
      const app = (data.appreciationGlobale || '').toLowerCase();
      if (app.includes('très')) return '🌟 Très Satisfaisant';
      if (app.includes('peu')) return '⚠️ Peu Satisfaisant';
      if (app.includes('satisfaisant')) return '👍 Satisfaisant';
      return '—';
    }
    if (data.generalAverage === null) return '—';
    const avg = data.generalAverage;
    if (avg >= 16) return '🏆 Excellent';
    if (avg >= 14) return '🌟 Très Bien';
    if (avg >= 12) return '👍 Bien';
    if (avg >= 10) return '✅ Passable';
    return '⚠️ Insuffisant';
  }
}

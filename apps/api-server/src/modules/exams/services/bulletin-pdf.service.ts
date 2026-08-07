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
 *   1 → "1er" (masculine) or "1ère" (feminine)
 *   2, 3, 4, … → "2ème", "3ème", "4ème", etc.
 *   null/undefined → '—'
 *   feminine = true when the student is a girl (FEMALE gender)
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
        // ⭐ Use 'domcontentloaded' instead of 'networkidle0' — faster, doesn't wait
        // for all network traffic to stop (which can timeout with base64 images).
        // The PDF is generated from inline HTML/CSS, no external resources needed.
        await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
        // Small delay to let any inline images (base64 signatures, SVG flag) render
        await new Promise(resolve => setTimeout(resolve, 500));
        const pdfBuffer = await page.pdf({
          format: 'A4',
          landscape: true,
          printBackground: true,
          margin: { top: '5mm', bottom: '5mm', left: '5mm', right: '5mm' },
          timeout: 60000, // ⭐ 60s timeout for PDF generation
          preferCSSPageSize: false,
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
      if (data.isMaternelle) {
        const code = s.qualitativeCode;
        // ⭐ Use "X" instead of ✓ to avoid font rendering issues in PDF
        const tsCheck = code === 'TS' ? '<strong style="color:#059669">X</strong>' : '';
        const sCheck = code === 'S' ? '<strong style="color:#2563eb">X</strong>' : '';
        const psCheck = code === 'PS' ? '<strong style="color:#d97706">X</strong>' : '';
        const absent = s.isAbsent ? '<span style="color:red;font-size:8px">ABS</span>' : '';
        const directorVisaCell = s.directorVisa || s.appreciation || '—';
        return `<tr>
          <td style="border:1px solid #cbd5e1;padding:4px 3px;font-size:10px;">${s.name}</td>
          <td style="border:1px solid #cbd5e1;padding:4px 3px;text-align:center;font-size:11px;">${tsCheck || absent}</td>
          <td style="border:1px solid #cbd5e1;padding:4px 3px;text-align:center;font-size:11px;">${sCheck}</td>
          <td style="border:1px solid #cbd5e1;padding:4px 3px;text-align:center;font-size:11px;">${psCheck}</td>
          <td style="border:1px solid #cbd5e1;padding:4px 3px;text-align:center;font-size:9px;color:#64748b;">${s.appreciation}</td>
          <td style="border:1px solid #cbd5e1;padding:4px 3px;text-align:center;font-size:9px;color:#0A2A5E;font-weight:600;">${directorVisaCell}</td>
          <td style="border:1px solid #cbd5e1;padding:4px 3px;text-align:center;font-size:9px;color:#94a3b8;">—</td>
        </tr>`;
      } else {
        // ⭐ Primaire — Carnet de correspondance exact column order:
        // Champs | Note min | CM/18 | Maîtrise min (Oui/Non) | CP/02 | Total/20 | Seuil réussite (Oui/Non) | Appréciation
        // NO Visa Directeur column in the table (it's in the signatures section below)
        const scoreNum = !s.isAbsent && s.score !== null ? Number(s.score) : null;
        const cm = scoreNum !== null ? Math.min(18, Math.round(scoreNum * 0.9 * 10) / 10) : null;
        const cp = scoreNum !== null ? Math.round((scoreNum - (cm || 0)) * 10) / 10 : null;
        const scoreVal = s.isAbsent
          ? '<span style="color:red;font-size:8px;font-weight:bold">ABS</span>'
          : s.score !== null
            ? `<span style="color:${s.score >= 10 ? '#059669' : '#dc2626'};font-weight:bold">${s.score.toFixed(2)}</span>`
            : '—';
        const reached = !s.isAbsent && s.score !== null && s.score >= 10;
        // ⭐ Use "Oui"/"Non" text instead of ✓ to avoid font rendering issues in PDF
        const yes = '<strong style="color:#059669">Oui</strong>';
        const no = '<strong style="color:#dc2626">Non</strong>';
        return `<tr>
          <td style="border:1px solid #cbd5e1;padding:4px 3px;font-size:10px;">${s.name}</td>
          <td style="border:1px solid #cbd5e1;padding:4px 3px;text-align:center;font-size:8px;color:#94a3b8;">10</td>
          <td style="border:1px solid #cbd5e1;padding:4px 3px;text-align:center;font-size:9px;color:#475569;font-weight:600;">${cm !== null ? cm.toFixed(1) : '—'}</td>
          <td style="border:1px solid #cbd5e1;padding:4px 3px;text-align:center;font-size:8px;">${reached ? yes : ''}</td>
          <td style="border:1px solid #cbd5e1;padding:4px 3px;text-align:center;font-size:8px;">${!reached && s.score !== null ? no : ''}</td>
          <td style="border:1px solid #cbd5e1;padding:4px 3px;text-align:center;font-size:9px;color:#475569;font-weight:600;">${cp !== null ? cp.toFixed(1) : '—'}</td>
          <td style="border:1px solid #cbd5e1;padding:4px 3px;text-align:center;font-size:10px;font-weight:bold;">${scoreVal}</td>
          <td style="border:1px solid #cbd5e1;padding:4px 3px;text-align:center;font-size:8px;">${reached ? yes : ''}</td>
          <td style="border:1px solid #cbd5e1;padding:4px 3px;text-align:center;font-size:8px;">${!reached && s.score !== null ? no : ''}</td>
          <td style="border:1px solid #cbd5e1;padding:4px 3px;text-align:center;font-size:9px;color:#64748b;">${s.appreciation}</td>
        </tr>`;
      }
    }).join('');

    // Table header — Maternelle matches carnet exactly:
    // Domaine | RÉSULTATS (TS/S/PS) | Appréciation de l'enseignant(e) | Visa du Directeur (trice) | Impression et visa des parents
    // Primaire matches carnet exactly:
    // Champs | Note min | CM/18 | Maîtrise min (Oui/Non) | CP/02 | Total/20 | Seuil réussite (Oui/Non) | Appréciation
    // NO Visa Directeur column for Primaire (it's in the signatures section)
    const tableHeader = data.isMaternelle ? `
      <tr style="background:#0A2A5E;color:white;">
        <th rowspan="2" style="border:1px solid #0D3B85;padding:4px;font-size:8px;text-transform:uppercase;">Domaine</th>
        <th colspan="3" style="border:1px solid #0D3B85;padding:4px;font-size:8px;text-transform:uppercase;">Résultats</th>
        <th rowspan="2" style="border:1px solid #0D3B85;padding:4px;font-size:7px;text-transform:uppercase;">Appréciation de l'enseignant(e)</th>
        <th rowspan="2" style="border:1px solid #0D3B85;padding:4px;font-size:7px;text-transform:uppercase;background:#0D3B85;">Visa du Directeur (trice)</th>
        <th rowspan="2" style="border:1px solid #0D3B85;padding:4px;font-size:7px;text-transform:uppercase;">Impression et visa des parents</th>
      </tr>
      <tr style="background:#0D3B85;color:white;">
        <th style="border:1px solid #114FC4;padding:3px;font-size:9px;">TS</th>
        <th style="border:1px solid #114FC4;padding:3px;font-size:9px;">S</th>
        <th style="border:1px solid #114FC4;padding:3px;font-size:9px;">PS</th>
      </tr>` : `
      <tr style="background:#0A2A5E;color:white;">
        <th rowspan="2" style="border:1px solid #0D3B85;padding:4px;font-size:8px;text-transform:uppercase;text-align:left;">Champs de formation</th>
        <th rowspan="2" style="border:1px solid #0D3B85;padding:4px;font-size:7px;text-transform:uppercase;">Note min.</th>
        <th rowspan="2" style="border:1px solid #0D3B85;padding:4px;font-size:8px;text-transform:uppercase;background:#0D3B85;">CM<br/><span style="font-size:6px;font-weight:normal;">/18</span></th>
        <th colspan="2" style="border:1px solid #0D3B85;padding:4px;font-size:7px;text-transform:uppercase;">Maîtrise minimale</th>
        <th rowspan="2" style="border:1px solid #0D3B85;padding:4px;font-size:8px;text-transform:uppercase;background:#0D3B85;">CP<br/><span style="font-size:6px;font-weight:normal;">/02</span></th>
        <th rowspan="2" style="border:1px solid #0D3B85;padding:4px;font-size:8px;text-transform:uppercase;">Total<br/><span style="font-size:6px;font-weight:normal;">/20</span></th>
        <th colspan="2" style="border:1px solid #0D3B85;padding:4px;font-size:7px;text-transform:uppercase;">Seuil de réussite</th>
        <th rowspan="2" style="border:1px solid #0D3B85;padding:4px;font-size:7px;text-transform:uppercase;">Appréciation</th>
      </tr>
      <tr style="background:#0D3B85;color:white;">
        <th style="border:1px solid #114FC4;padding:3px;font-size:7px;">Oui</th>
        <th style="border:1px solid #114FC4;padding:3px;font-size:7px;">Non</th>
        <th style="border:1px solid #114FC4;padding:3px;font-size:7px;">Oui</th>
        <th style="border:1px solid #114FC4;padding:3px;font-size:7px;">Non</th>
      </tr>`;

    // Total General row (Primaire only) — column order matches carnet (NO Visa Directeur column):
    // Champs(colspan=2) | CM | Maîtrise(empty colspan=2) | CP | Total | Seuil(empty colspan=2) | Appréciation
    const totalRow = !data.isMaternelle ? (() => {
      const validScores = data.subjects.filter(s => !s.isAbsent && s.score !== null).map(s => Number(s.score));
      const totalScore = validScores.reduce((sum, v) => sum + v, 0);
      const totalCm = validScores.reduce((sum, v) => sum + Math.min(18, Math.round(v * 0.9 * 10) / 10), 0);
      const totalCp = validScores.reduce((sum, v) => sum + Math.round((v - Math.min(18, Math.round(v * 0.9 * 10) / 10)) * 10) / 10, 0);
      return `
      <tr style="background:#e2e8f0;font-weight:bold;">
        <td colspan="2" style="border:1px solid #cbd5e1;padding:4px;font-size:9px;text-transform:uppercase;">TOTAL GENERAL</td>
        <td style="border:1px solid #cbd5e1;padding:4px;text-align:center;font-size:10px;color:#0A2A5E;">${totalCm.toFixed(1)}</td>
        <td colspan="2" style="border:1px solid #cbd5e1;"></td>
        <td style="border:1px solid #cbd5e1;padding:4px;text-align:center;font-size:10px;color:#0A2A5E;">${totalCp.toFixed(1)}</td>
        <td style="border:1px solid #cbd5e1;padding:4px;text-align:center;font-size:11px;color:#0A2A5E;">${totalScore.toFixed(2)}</td>
        <td colspan="2" style="border:1px solid #cbd5e1;"></td>
        <td style="border:1px solid #cbd5e1;padding:4px;text-align:center;font-size:9px;color:#64748b;">${data.appreciationGlobale || '—'}</td>
      </tr>`;
    })() : '';

    // ⭐ Colonne gauche : Tableau + synthèse + Symbole mérité (en bas)
    const leftColumn = `
      <div class="col-left">
        <table class="notes">
          <thead>${tableHeader}</thead>
          <tbody>${subjectRows}${totalRow}</tbody>
        </table>
        ${data.isMaternelle ? `
        <div style="margin-top:4px;text-align:center;background:#f8fafc;border:1px solid #e2e8f0;border-radius:3px;padding:4px;">
          <span style="font-size:9px;font-weight:bold;color:#0A2A5E;text-transform:uppercase;">Symbole mérité par l'élève : </span>
          <span style="font-size:14px;">${symboleMerite}</span>
        </div>` : `
        <div style="margin-top:4px;font-size:9px;">
          <table style="width:100%;border-collapse:collapse;"><tr>
            <td style="background:#f8fafc;padding:1px 3px;font-size:9px;">Moyenne obtenue :</td>
            <td style="background:#f8fafc;padding:1px 3px;text-align:right;font-size:9px;font-weight:bold;color:#0A2A5E;">${data.generalAverage !== null ? data.generalAverage.toFixed(2) : '—'}/20</td>
          </tr><tr>
            <td style="background:#f8fafc;padding:1px 3px;font-size:9px;">Plus forte moyenne :</td>
            <td style="background:#f8fafc;padding:1px 3px;text-align:right;font-size:9px;font-weight:bold;">${data.highestAverage !== null ? data.highestAverage.toFixed(2) : '—'}/20</td>
          </tr><tr>
            <td style="background:#f8fafc;padding:1px 3px;font-size:9px;">Plus faible moyenne :</td>
            <td style="background:#f8fafc;padding:1px 3px;text-align:right;font-size:9px;font-weight:bold;">${data.lowestAverage !== null ? data.lowestAverage.toFixed(2) : '—'}/20</td>
          </tr><tr>
            <td style="background:#ecfdf5;padding:1px 3px;font-size:9px;font-weight:bold;">Seuil réussite (10/20) atteint :</td>
            <td style="background:#ecfdf5;padding:1px 3px;text-align:right;font-size:9px;font-weight:bold;color:${(data.generalAverage || 0) >= 10 ? '#059669' : '#dc2626'};">${(data.generalAverage || 0) >= 10 ? 'OUI' : 'NON'}</td>
          </tr></table>
        </div>
        <!-- ⭐ Symbole mérité en bas de la colonne gauche (après seuil de réussite) -->
        <div style="margin-top:4px;text-align:center;border:1px solid #0A2A5E;border-radius:3px;padding:6px;">
          <span style="font-size:9px;font-weight:bold;color:#0A2A5E;text-transform:uppercase;">Symbole mérité par l'élève</span>
          <div style="font-size:18px;margin-top:2px;">${symboleMerite}</div>
        </div>`}
      </div>`;

    // ⭐ Colonne droite = PAGE 2 du carnet (sans Symbole — il est à gauche maintenant)
    const rightColumn = data.isMaternelle ? `
      <div class="col-right">
        <!-- ANALYSE PÉDAGOGIQUE SOMMAIRE -->
        <div style="border:1px solid #0A2A5E;border-radius:2px;padding:5px;margin-bottom:4px;width:100%;">
          <div style="font-size:8px;font-weight:bold;color:#0A2A5E;text-transform:uppercase;text-align:center;margin-bottom:4px;line-height:1.4;">
            ANALYSE PEDAGOGIQUE SOMMAIRE DES RESULTATS ET RECOMMANDATIONS DE L'ENSEIGNANT(E) AUX PARENTS
          </div>
          ${[1,2,3,4,5,6,7,8,9,10].map(() => '<div style="border-bottom:1px dotted #94a3b8;margin:3px 0;height:8px;"></div>').join('')}
        </div>

        <!-- 3 SIGNATURES verticales (aéré, pleine largeur) -->
        <div style="border:1px solid #0A2A5E;border-radius:2px;padding:5px;margin-bottom:4px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="width:33%;text-align:center;vertical-align:bottom;padding:5px 2px;">
                <div style="height:30px;">${data.teacherSignature ? `<img src="${data.teacherSignature}" style="max-height:30px;max-width:80px;object-fit:contain;" />` : ''}</div>
                <div style="border-top:1px solid #000;margin-top:4px;padding-top:3px;font-size:8px;font-weight:bold;color:#0A2A5E;">Titulaire de la classe</div>
                <div style="font-size:7px;color:#64748b;">Signature</div>
              </td>
              <td style="width:34%;text-align:center;vertical-align:bottom;padding:5px 2px;">
                <div style="height:30px;">${data.directorSignature ? `<img src="${data.directorSignature}" style="max-height:30px;max-width:80px;object-fit:contain;" />` : ''}</div>
                <div style="border-top:1px solid #000;margin-top:4px;padding-top:3px;font-size:8px;font-weight:bold;color:#0A2A5E;">Le (la) Directeur(trice)</div>
                <div style="font-size:7px;color:#64748b;">Visa</div>
              </td>
              <td style="width:33%;text-align:center;vertical-align:bottom;padding:5px 2px;">
                <div style="height:30px;">${data.parentSignature ? `<img src="${data.parentSignature}" style="max-height:30px;max-width:80px;object-fit:contain;" />` : ''}</div>
                <div style="border-top:1px solid #000;margin-top:4px;padding-top:3px;font-size:8px;font-weight:bold;color:#0A2A5E;">Les Parents</div>
                <div style="font-size:7px;color:#64748b;">Nom, Prénoms et Signature</div>
              </td>
            </tr>
          </table>
        </div>

        <!-- QR code (séparé, en bas) -->
        <div style="text-align:center;margin-top:4px;">
          <img src="${qrCode}" style="width:35px;height:35px;" alt="QR" />
          <div style="font-size:7px;color:#94a3b8;">Code de vérification</div>
        </div>
      </div>` : `
      <div class="col-right">
        <!-- STATS (pleine largeur) -->
        <div style="border:1px solid #0A2A5E;border-radius:2px;padding:5px;margin-bottom:4px;width:100%;">
          <table style="width:100%;border-collapse:collapse;"><tr>
            <td style="font-size:9px;padding:3px 0;">Nombre de matières évaluées :</td>
            <td style="font-size:9px;text-align:right;font-weight:bold;padding:3px 0;">${data.subjects.filter(s => !s.isAbsent && s.score !== null).length}</td>
          </tr><tr>
            <td style="font-size:9px;padding:3px 0;">Nombre de compétences max. + min. atteintes :</td>
            <td style="font-size:9px;text-align:right;font-weight:bold;padding:3px 0;">${data.subjects.filter(s => !s.isAbsent && s.score !== null && s.score >= 10).length}</td>
          </tr><tr>
            <td style="font-size:9px;font-weight:bold;padding:3px 0;">Seuil de réussite globale atteint :</td>
            <td style="font-size:9px;text-align:right;font-weight:bold;padding:3px 0;">
              <span style="color:${(data.generalAverage || 0) >= 10 ? '#059669' : '#94a3b8'};">${(data.generalAverage || 0) >= 10 ? 'X OUI' : '☐ OUI'}</span>
              &nbsp;
              <span style="color:${(data.generalAverage || 0) < 10 ? '#dc2626' : '#94a3b8'};">${(data.generalAverage || 0) < 10 ? 'X NON' : '☐ NON'}</span>
            </td>
          </tr></table>
        </div>

        <!-- II - ATTITUDES (pleine largeur, plus aéré) -->
        <div style="border:1px solid #0A2A5E;border-radius:2px;padding:5px;margin-bottom:4px;width:100%;">
          <div style="font-size:9px;font-weight:bold;color:#0A2A5E;text-transform:uppercase;margin-bottom:4px;">II - Attitudes</div>
          <div style="font-size:9px;margin-bottom:5px;">
            <strong>Assiduité :</strong> <span style="border-bottom:1px dotted #94a3b8;display:inline-block;width:70%;height:12px;"></span>
          </div>
          <div style="font-size:9px;margin-bottom:5px;">
            <strong>Discipline :</strong> <span style="border-bottom:1px dotted #94a3b8;display:inline-block;width:70%;height:12px;"></span>
          </div>
          <div style="font-size:9px;margin-bottom:4px;"><strong>Défauts majeurs identifiés :</strong></div>
          ${[1,2,3].map(() => '<div style="border-bottom:1px dotted #94a3b8;margin:3px 0;height:8px;"></div>').join('')}
          <div style="font-size:9px;margin-top:5px;margin-bottom:4px;"><strong>Qualités remarquables :</strong></div>
          ${[1,2,3].map(() => '<div style="border-bottom:1px dotted #94a3b8;margin:3px 0;height:8px;"></div>').join('')}
        </div>

        <!-- ANALYSE DES RESULTATS (pleine largeur, plus de lignes) -->
        <div style="border:1px solid #0A2A5E;border-radius:2px;padding:5px;margin-bottom:4px;width:100%;">
          <div style="font-size:9px;font-weight:bold;color:#0A2A5E;text-transform:uppercase;margin-bottom:5px;">Analyse des résultats et recommandations</div>
          ${[1,2,3,4,5,6].map(() => '<div style="border-bottom:1px dotted #94a3b8;margin:3px 0;height:8px;"></div>').join('')}
        </div>

        <!-- 3 SIGNATURES (pleine largeur, aérées) -->
        <div style="border:1px solid #0A2A5E;border-radius:2px;padding:5px;margin-bottom:4px;width:100%;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="width:33%;text-align:center;vertical-align:bottom;padding:5px 2px;">
                <div style="height:30px;">${data.teacherSignature ? `<img src="${data.teacherSignature}" style="max-height:30px;max-width:85px;object-fit:contain;" />` : ''}</div>
                <div style="border-top:1px solid #000;margin-top:4px;padding-top:3px;font-size:8px;font-weight:bold;color:#0A2A5E;">Enseignant(e)</div>
                <div style="font-size:7px;color:#64748b;">Signature du titulaire</div>
              </td>
              <td style="width:34%;text-align:center;vertical-align:bottom;padding:5px 2px;">
                <div style="height:30px;">${data.parentSignature ? `<img src="${data.parentSignature}" style="max-height:30px;max-width:85px;object-fit:contain;" />` : ''}</div>
                <div style="border-top:1px solid #000;margin-top:4px;padding-top:3px;font-size:8px;font-weight:bold;color:#0A2A5E;">Parent</div>
                <div style="font-size:7px;color:#64748b;">Signature et nom</div>
              </td>
              <td style="width:33%;text-align:center;vertical-align:bottom;padding:5px 2px;">
                <div style="height:30px;">${data.directorSignature ? `<img src="${data.directorSignature}" style="max-height:30px;max-width:85px;object-fit:contain;" />` : ''}</div>
                <div style="border-top:1px solid #000;margin-top:4px;padding-top:3px;font-size:8px;font-weight:bold;color:#0A2A5E;">VISA du Directeur</div>
                <div style="font-size:7px;color:#64748b;">Visa</div>
              </td>
            </tr>
          </table>
        </div>

        <!-- QR code (séparé, en bas) -->
        <div style="text-align:center;margin-top:5px;">
          <img src="${qrCode}" style="width:35px;height:35px;" alt="QR" />
          <div style="font-size:7px;color:#94a3b8;">Code de vérification</div>
        </div>
      </div>`;

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Bulletin - ${data.studentName}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Times New Roman',Georgia,serif; color:#1a1a1a; font-size:8px; }
.header { margin-bottom:4px; padding-bottom:3px; border-bottom:2px solid #0A2A5E; }
.header-table { width:100%; border-collapse:collapse; }
.header-table td { vertical-align:middle; padding:1px 3px; }
.header-left { text-align:center; width:10%; }
.header-center { text-align:center; width:70%; }
.header-right { text-align:center; width:20%; }
.republique { font-size:9px; font-weight:bold; text-transform:uppercase; letter-spacing:0.5px; }
.divider { margin:1px auto; width:50%; }
.divider-line { height:1px; background:#0A2A5E; }
.ministere { font-size:7px; font-weight:bold; text-transform:uppercase; letter-spacing:0.3px; line-height:1.2; }
.school-name { font-size:10px; font-weight:bold; text-transform:uppercase; margin-top:2px; color:#0A2A5E; }
.school-info { font-size:6px; color:#555; margin-top:1px; font-style:italic; }
.bulletin-title { text-align:center; background:#0A2A5E; color:white; padding:2px 6px; border-radius:2px; margin-bottom:4px; font-size:8px; font-weight:bold; text-transform:uppercase; }
.student-info { background:#f8fafc; border:1px solid #e2e8f0; border-radius:2px; padding:2px 6px; margin-bottom:4px; font-size:8px; }
.student-info strong { color:#0A2A5E; }
/* ⭐ Layout 2 colonnes — table-based for Puppeteer */
.two-col-table { width:100%; border-collapse:collapse; }
.two-col-table > tr > td { vertical-align:top; }
.col-left { width:62%; padding-right:4px; border-right:1px solid #0A2A5E; }
.col-right { width:38%; padding-left:4px; }
table.notes { width:100%; border-collapse:collapse; }
table.notes th { color:white; border:1px solid; padding:3px 2px; font-size:6px; text-transform:uppercase; }
table.notes td { border:1px solid #cbd5e1; padding:3px 2px; }
table.notes tbody tr:nth-child(even) { background:#f8fafc; }
.footer { margin-top:2px; text-align:center; font-size:5px; color:#999; border-top:1px solid #eee; padding-top:2px; }
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
<table class="student-info" style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:2px;margin-bottom:4px;">
<tr>
  <td style="padding:2px 6px;font-size:8px;">Élève: <strong>${data.studentName}</strong></td>
  <td style="padding:2px 6px;font-size:8px;text-align:center;">Matricule: <strong>${data.studentMatricule || '—'}</strong></td>
  <td style="padding:2px 6px;font-size:8px;text-align:center;">Classe: <strong>${data.className}</strong></td>
  <td style="padding:2px 6px;font-size:8px;text-align:right;">Rang: <strong>${formatRank(data.classRank, data.studentGender === 'FEMALE' || data.studentGender === 'F')}</strong> / ${data.totalStudents}</td>
</tr>
</table>

<!-- ⭐ LAYOUT 2 COLONNES (table-based for Puppeteer compatibility) -->
<table class="two-col-table"><tr>
  <td class="col-left">${leftColumn}</td>
  <td class="col-right">${rightColumn}</td>
</tr></table>

<!-- PIED DE PAGE -->
<div class="footer">Document généré par Academia Helm — ${new Date().toLocaleDateString('fr-FR')} · ID: ${bulletinId}</div>

</body>
</html>`;
  }

  /**
   * ⭐ Calcule le symbole mérité (emoji) en fonction de l'appréciation ou de la moyenne.
   * Maternelle : TS → 😄, S → 😊, PS → 😞
   * Primaire/Secondaire : >=16 → 🏆, >=14 → 😄, >=12 → 😊, >=10 → 😐, <10 → 😞
   */
  private computeSymboleMerite(data: BulletinPdfData): string {
    if (data.isMaternelle) {
      const app = (data.appreciationGlobale || '').toLowerCase();
      if (app.includes('très')) return '😄 Très Satisfaisant';
      if (app.includes('peu')) return '😞 Peu Satisfaisant';
      if (app.includes('satisfaisant')) return '😊 Satisfaisant';
      return '—';
    }
    if (data.generalAverage === null) return '—';
    const avg = data.generalAverage;
    if (avg >= 16) return '🏆 Excellent';
    if (avg >= 14) return '😄 Très Bien';
    if (avg >= 12) return '😊 Bien';
    if (avg >= 10) return '😐 Passable';
    return '😞 Insuffisant';
  }
}

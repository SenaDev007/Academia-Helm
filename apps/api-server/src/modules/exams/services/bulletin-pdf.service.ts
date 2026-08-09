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
  // ⭐ Piste linguistique (FR | EN) — déclenche le layout anglophone si 'EN'
  scopeLang?: 'FR' | 'EN' | null;
  // ⭐ Champs anglophones spécifiques (page 1 + page 2 du bulletin anglophone)
  studentAge?: number | null;
  studentBirthDate?: string | null;
  admissionNumber?: string | null;
  sessionYear?: string | null;       // ex: "2024-2025"
  termEndingDate?: string | null;    // ex: "Friday, April 11, 2025"
  nextTermStartDate?: string | null; // ex: "Monday, May 5, 2025"
  numberOfSubjects?: number | null;  // pour mark obtainable
  // ⭐ Annotations anglophones éditables (auto-générées si null, mais modifiables par l'utilisateur)
  enTeacherComment?: string | null;
  enDirectorComment?: string | null;
  enAffectiveAssessment?: string | null;    // JSON: {"Punctuality":"A","Politeness":"B",...}
  enPsychomotorAssessment?: string | null;  // JSON: {"Handwriting":"A","Music":"B",...}
  // Matières + notes
  subjects: Array<{
    name: string;
    score: number | null;
    qualitativeCode?: string | null;
    isAbsent: boolean;
    appreciation: string;
    // ⭐ Visa du directeur par matière (auto-rempli depuis appreciation, éditable)
    directorVisa?: string | null;
    // ⭐ Notes anglophones par matière (3 composantes CA + Exam)
    firstCA?: number | null;   // /40
    secondCA?: number | null;  // /40
    exam?: number | null;      // /60
    total?: number | null;     // /100 (conversion de (FCA+SCA+Exam)/140*100)
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
  // ⭐ Annotations par élève (page 2 du carnet)
  assiduite?: string | null;
  discipline?: string | null;
  defautsMajeurs?: string | null;
  qualitesRemarquables?: string | null;
  analyseRecommandations?: string | null;
  // ⭐ Noms auto-résolus (depuis TeacherClassAssignment / Staff)
  teacherName?: string | null;   // ex: "Mme YAROU Elodie" (titulaire de la classe)
  teacherGender?: string | null; // 'M' | 'F' | null — pour "M." vs "Mme"
  directorName?: string | null;  // réservé pour plus tard
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

      // 2. Build HTML — ⭐ branch anglophone si scopeLang === 'EN'
      const html = data.scopeLang === 'EN'
        ? this.buildHtmlAnglophone(data, qrDataUrl, bulletinId)
        : this.buildHtml(data, qrDataUrl, bulletinId);

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
          format: 'A5',
          landscape: false,
          printBackground: true,
          margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' },
          timeout: 60000,
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
          <td style="border:1px solid #cbd5e1;padding:5px 3px;font-size:10px;">${s.name}</td>
          <td style="border:1px solid #cbd5e1;padding:5px 3px;text-align:center;font-size:11px;">${tsCheck || absent}</td>
          <td style="border:1px solid #cbd5e1;padding:5px 3px;text-align:center;font-size:11px;">${sCheck}</td>
          <td style="border:1px solid #cbd5e1;padding:5px 3px;text-align:center;font-size:11px;">${psCheck}</td>
          <td style="border:1px solid #cbd5e1;padding:5px 3px;text-align:center;font-size:9px;color:#64748b;">${s.appreciation}</td>
          <td style="border:1px solid #cbd5e1;padding:5px 3px;text-align:center;font-size:9px;color:#0A2A5E;font-weight:600;">${directorVisaCell}</td>
          <td style="border:1px solid #cbd5e1;padding:5px 3px;text-align:center;font-size:9px;color:#94a3b8;">—</td>
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
          <td style="border:1px solid #cbd5e1;padding:5px 3px;font-size:10px;">${s.name}</td>
          <td style="border:1px solid #cbd5e1;padding:5px 3px;text-align:center;font-size:8px;color:#94a3b8;">10</td>
          <td style="border:1px solid #cbd5e1;padding:5px 3px;text-align:center;font-size:9px;color:#475569;font-weight:600;">${cm !== null ? cm.toFixed(1) : '—'}</td>
          <td style="border:1px solid #cbd5e1;padding:5px 3px;text-align:center;font-size:8px;">${reached ? yes : ''}</td>
          <td style="border:1px solid #cbd5e1;padding:5px 3px;text-align:center;font-size:8px;">${!reached && s.score !== null ? no : ''}</td>
          <td style="border:1px solid #cbd5e1;padding:5px 3px;text-align:center;font-size:9px;color:#475569;font-weight:600;">${cp !== null ? cp.toFixed(1) : '—'}</td>
          <td style="border:1px solid #cbd5e1;padding:5px 3px;text-align:center;font-size:10px;font-weight:bold;">${scoreVal}</td>
          <td style="border:1px solid #cbd5e1;padding:5px 3px;text-align:center;font-size:8px;">${reached ? yes : ''}</td>
          <td style="border:1px solid #cbd5e1;padding:5px 3px;text-align:center;font-size:8px;">${!reached && s.score !== null ? no : ''}</td>
          <td style="border:1px solid #cbd5e1;padding:5px 3px;text-align:center;font-size:9px;color:#64748b;">${s.appreciation}</td>
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
        <div style="border:1px solid #0A2A5E;border-radius:2px;padding:6px;margin-bottom:6px;width:100%;">
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

        <!-- II - ATTITUDES (pleine largeur, occupe plus de hauteur) -->
        <div style="border:1px solid #0A2A5E;border-radius:2px;padding:6px;margin-bottom:6px;width:100%;">
          <div style="font-size:9px;font-weight:bold;color:#0A2A5E;text-transform:uppercase;margin-bottom:5px;">II - Attitudes</div>
          <div style="font-size:9px;margin-bottom:5px;">
            <strong>Assiduité :</strong> <span style="border-bottom:1px dotted #94a3b8;display:inline-block;width:70%;height:12px;"></span>
          </div>
          <div style="font-size:9px;margin-bottom:5px;">
            <strong>Discipline :</strong> <span style="border-bottom:1px dotted #94a3b8;display:inline-block;width:70%;height:12px;"></span>
          </div>
          <div style="font-size:9px;margin-bottom:4px;"><strong>Défauts majeurs identifiés :</strong></div>
          ${[1,2,3,4].map(() => '<div style="border-bottom:1px dotted #94a3b8;margin:4px 0;height:10px;"></div>').join('')}
          <div style="font-size:9px;margin-top:5px;margin-bottom:4px;"><strong>Qualités remarquables :</strong></div>
          ${[1,2,3,4].map(() => '<div style="border-bottom:1px dotted #94a3b8;margin:4px 0;height:10px;"></div>').join('')}
        </div>

        <!-- ANALYSE DES RESULTATS (pleine largeur, occupe plus de hauteur) -->
        <div style="border:1px solid #0A2A5E;border-radius:2px;padding:6px;margin-bottom:6px;width:100%;">
          <div style="font-size:9px;font-weight:bold;color:#0A2A5E;text-transform:uppercase;margin-bottom:5px;">Analyse des résultats et recommandations</div>
          ${[1,2,3,4,5,6,7,8].map(() => '<div style="border-bottom:1px dotted #94a3b8;margin:5px 0;height:10px;"></div>').join('')}
        </div>

        <!-- 3 SIGNATURES (pleine largeur, aérées) -->
        <div style="border:1px solid #0A2A5E;border-radius:2px;padding:6px;margin-bottom:6px;width:100%;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="width:33%;text-align:center;vertical-align:bottom;padding:6px 2px;">
                <div style="height:35px;">${data.teacherSignature ? `<img src="${data.teacherSignature}" style="max-height:35px;max-width:85px;object-fit:contain;" />` : ''}</div>
                <div style="border-top:1px solid #000;margin-top:4px;padding-top:3px;font-size:8px;font-weight:bold;color:#0A2A5E;">Enseignant(e)</div>
                <div style="font-size:7px;color:#64748b;">Signature du titulaire</div>
              </td>
              <td style="width:34%;text-align:center;vertical-align:bottom;padding:6px 2px;">
                <div style="height:35px;">${data.parentSignature ? `<img src="${data.parentSignature}" style="max-height:35px;max-width:85px;object-fit:contain;" />` : ''}</div>
                <div style="border-top:1px solid #000;margin-top:4px;padding-top:3px;font-size:8px;font-weight:bold;color:#0A2A5E;">Parent</div>
                <div style="font-size:7px;color:#64748b;">Signature et nom</div>
              </td>
              <td style="width:33%;text-align:center;vertical-align:bottom;padding:6px 2px;">
                <div style="height:35px;">${data.directorSignature ? `<img src="${data.directorSignature}" style="max-height:35px;max-width:85px;object-fit:contain;" />` : ''}</div>
                <div style="border-top:1px solid #000;margin-top:4px;padding-top:3px;font-size:8px;font-weight:bold;color:#0A2A5E;">VISA du Directeur</div>
                <div style="font-size:7px;color:#64748b;">Visa</div>
              </td>
            </tr>
          </table>
        </div>

        <!-- QR code (séparé, en bas) -->
        <div style="text-align:center;margin-top:4px;">
          <img src="${qrCode}" style="width:40px;height:40px;" alt="QR" />
          <div style="font-size:6px;color:#94a3b8;">Code de vérification</div>
        </div>
      </div>`;

    // ⭐ PAGE 1 : Header + Tableau des notes + Synthèse + Symbole mérité
    const page1Content = `
      <!-- EN-TÊTE OFFICIEL -->
      <div class="header">
        <table class="header-table">
          <tr>
            <td class="header-left"><img src="${beninFlag}" alt="Drapeau du Bénin" style="width:30px;height:20px;" /></td>
            <td class="header-center">
              <div class="republique">République du Bénin</div>
              <div class="divider"><div class="divider-line"></div></div>
              <div class="ministere">${ministry}</div>
              <div class="divider"><div class="divider-line"></div></div>
              <div class="school-name">${data.schoolName}</div>
              <div class="school-info">${data.schoolSlogan ? `« ${data.schoolSlogan} » · ` : ''}${data.schoolAddress || ''} · Tél: ${data.schoolPhone || ''} · ${data.schoolEmail || ''}</div>
            </td>
            <td class="header-right">${data.schoolLogo ? `<img src="${data.schoolLogo}" style="max-width:35px;max-height:35px;object-fit:contain;" />` : ''}</td>
          </tr>
        </table>
      </div>

      <!-- TITRE BULLETIN -->
      <div class="bulletin-title">Bulletin de ${data.evaluationTypeName} ${data.evaluationTypeCode ? '(' + data.evaluationTypeCode + ')' : ''} — ${data.periodName} ${data.academicYearName}</div>

      <!-- INFOS ÉLÈVE -->
      <table style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:2px;margin-bottom:6px;">
      <tr>
        <td style="padding:3px 5px;font-size:9px;">Élève: <strong style="color:#0A2A5E;">${data.studentName}</strong></td>
        <td style="padding:3px 5px;font-size:9px;text-align:center;">Matricule: <strong style="color:#0A2A5E;">${data.studentMatricule || '—'}</strong></td>
        <td style="padding:3px 5px;font-size:9px;text-align:right;">Rang: <strong style="color:#0A2A5E;">${formatRank(data.classRank, data.studentGender === 'FEMALE' || data.studentGender === 'F')}</strong></td>
      </tr>
      </table>

      <!-- TABLEAU DES NOTES -->
      <table class="notes">
        <thead>${tableHeader}</thead>
        <tbody>${subjectRows}${totalRow}</tbody>
      </table>

      <!-- SYNTHÈSE -->
      ${data.isMaternelle ? `
      <div style="margin-top:6px;text-align:center;border:1px solid #0A2A5E;border-radius:3px;padding:6px;">
        <span style="font-size:10px;font-weight:bold;color:#0A2A5E;text-transform:uppercase;">Symbole mérité par l'élève</span>
        <div style="font-size:20px;margin-top:3px;">${symboleMerite}</div>
      </div>` : `
      <div style="margin-top:6px;font-size:10px;">
        <table style="width:100%;border-collapse:collapse;"><tr>
          <td style="background:#f8fafc;padding:3px 5px;font-size:10px;">Moyenne obtenue :</td>
          <td style="background:#f8fafc;padding:3px 5px;text-align:right;font-size:10px;font-weight:bold;color:#0A2A5E;">${data.generalAverage !== null ? data.generalAverage.toFixed(2) : '—'}/20</td>
        </tr><tr>
          <td style="background:#f8fafc;padding:3px 5px;font-size:10px;">Plus forte moyenne :</td>
          <td style="background:#f8fafc;padding:3px 5px;text-align:right;font-size:10px;font-weight:bold;">${data.highestAverage !== null ? data.highestAverage.toFixed(2) : '—'}/20</td>
        </tr><tr>
          <td style="background:#f8fafc;padding:3px 5px;font-size:10px;">Plus faible moyenne :</td>
          <td style="background:#f8fafc;padding:3px 5px;text-align:right;font-size:10px;font-weight:bold;">${data.lowestAverage !== null ? data.lowestAverage.toFixed(2) : '—'}/20</td>
        </tr><tr>
          <td style="background:#ecfdf5;padding:3px 5px;font-size:10px;font-weight:bold;">Seuil réussite (10/20) atteint :</td>
          <td style="background:#ecfdf5;padding:3px 5px;text-align:right;font-size:10px;font-weight:bold;color:${(data.generalAverage || 0) >= 10 ? '#059669' : '#dc2626'};">${(data.generalAverage || 0) >= 10 ? 'OUI' : 'NON'}</td>
        </tr></table>
      </div>
      <div style="margin-top:6px;text-align:center;border:1px solid #0A2A5E;border-radius:3px;padding:6px;">
        <span style="font-size:10px;font-weight:bold;color:#0A2A5E;text-transform:uppercase;">Symbole mérité par l'élève</span>
        <div style="font-size:20px;margin-top:3px;">${symboleMerite}</div>
      </div>`}

      <!-- PIED DE PAGE PAGE 1 -->
      <div style="margin-top:30px;"></div>
      <div class="footer">Document généré par Academia Helm — ${new Date().toLocaleString('fr-FR')}</div>
      <!-- SAUT DE PAGE -->
      <div style="page-break-after:always;"></div>`;

    // ⭐ PAGE 2 : Header (raccourci) + Appréciations + Signatures
    const page2Content = data.isMaternelle ? `
      <!-- HEADER RACCOURCI PAGE 2 -->
      <div style="text-align:center;margin-bottom:6px;padding-bottom:3px;border-bottom:1px solid #0A2A5E;">
        <div style="font-size:9px;font-weight:bold;color:#0A2A5E;">${data.schoolName} — ${data.studentName} — ${data.periodName}</div>
      </div>

      <!-- ANALYSE PÉDAGOGIQUE SOMMAIRE -->
      <div style="border:1px solid #0A2A5E;border-radius:2px;padding:8px;margin-bottom:10px;width:100%;">
        <div style="font-size:10px;font-weight:bold;color:#0A2A5E;text-transform:uppercase;text-align:center;margin-bottom:6px;line-height:1.4;">
          Analyse pédagogique sommaire des résultats et recommandations de l'enseignant(e) aux parents
        </div>
        ${data.analyseRecommandations
          ? `<div style="font-size:9px;color:#1a1a1a;line-height:1.5;text-align:justify;">${data.analyseRecommandations}</div>`
          : [1,2,3,4,5,6,7,8,9,10,11,12].map(() => '<div style="border-bottom:1px dotted #94a3b8;margin:6px 0;height:14px;"></div>').join('')
        }
      </div>

      <!-- SYMBOLE MÉRITÉ -->
      <div style="border:1px solid #0A2A5E;border-radius:2px;padding:8px;margin-bottom:10px;text-align:center;width:100%;">
        <div style="font-size:10px;font-weight:bold;color:#0A2A5E;text-transform:uppercase;margin-bottom:4px;">Symbole mérité par l'élève</div>
        <div style="font-size:28px;">${symboleMerite}</div>
      </div>

      <!-- 3 SIGNATURES -->
      <div style="border:1px solid #0A2A5E;border-radius:2px;padding:8px;margin-bottom:10px;width:100%;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="width:33%;text-align:center;vertical-align:bottom;padding:10px 3px;">
              <div style="height:50px;">${data.teacherSignature ? `<img src="${data.teacherSignature}" style="max-height:50px;max-width:100px;object-fit:contain;" />` : ''}</div>
              <div style="border-top:1px solid #000;margin-top:5px;padding-top:3px;font-size:10px;font-weight:bold;color:#0A2A5E;">Titulaire de la classe</div>
              ${data.teacherName ? `<div style="font-size:9px;color:#1a1a1a;margin-top:1px;font-weight:600;">${data.teacherName}</div>` : '<div style="font-size:8px;color:#64748b;margin-top:1px;">Signature</div>'}
            </td>
            <td style="width:34%;text-align:center;vertical-align:bottom;padding:10px 3px;">
              <div style="height:50px;">${data.directorSignature ? `<img src="${data.directorSignature}" style="max-height:50px;max-width:100px;object-fit:contain;" />` : ''}</div>
              ${data.directorVisa ? `<div style="font-size:9px;color:#dc2626;font-style:italic;margin-top:2px;">${data.directorVisa}</div>` : ''}
              <div style="border-top:1px solid #000;margin-top:5px;padding-top:3px;font-size:10px;font-weight:bold;color:#0A2A5E;">Le (la) Directeur(trice)</div>
              <div style="font-size:8px;color:#64748b;">Visa</div>
            </td>
            <td style="width:33%;text-align:center;vertical-align:bottom;padding:10px 3px;">
              <div style="height:50px;">${data.parentSignature ? `<img src="${data.parentSignature}" style="max-height:50px;max-width:100px;object-fit:contain;" />` : ''}</div>
              <div style="border-top:1px solid #000;margin-top:5px;padding-top:3px;font-size:10px;font-weight:bold;color:#0A2A5E;">Les Parents</div>
              <div style="font-size:8px;color:#64748b;">Nom, Prénoms et Signature</div>
            </td>
          </tr>
        </table>
      </div>

      <!-- QR code -->
      <div style="text-align:center;margin-top:8px;">
        <img src="${qrCode}" style="width:50px;height:50px;" alt="QR" />
        <div style="font-size:8px;color:#94a3b8;">Code de vérification</div>
      </div>` : `
      <!-- HEADER RACCOURCI PAGE 2 -->
      <div style="text-align:center;margin-bottom:6px;padding-bottom:3px;border-bottom:1px solid #0A2A5E;">
        <div style="font-size:9px;font-weight:bold;color:#0A2A5E;">${data.schoolName} — ${data.studentName} — ${data.periodName}</div>
      </div>

      <!-- STATS -->
      <div style="border:1px solid #0A2A5E;border-radius:2px;padding:8px;margin-bottom:10px;width:100%;">
        <table style="width:100%;border-collapse:collapse;"><tr>
          <td style="font-size:10px;padding:4px 0;">Nombre de matières évaluées :</td>
          <td style="font-size:10px;text-align:right;font-weight:bold;padding:4px 0;">${data.subjects.filter(s => !s.isAbsent && s.score !== null).length}</td>
        </tr><tr>
          <td style="font-size:10px;padding:4px 0;">Nombre de compétences max. + min. atteintes :</td>
          <td style="font-size:10px;text-align:right;font-weight:bold;padding:4px 0;">${data.subjects.filter(s => !s.isAbsent && s.score !== null && s.score >= 10).length}</td>
        </tr><tr>
          <td style="font-size:10px;font-weight:bold;padding:4px 0;">Seuil de réussite globale atteint :</td>
          <td style="font-size:10px;text-align:right;font-weight:bold;padding:4px 0;color:${(data.generalAverage || 0) >= 10 ? '#059669' : '#dc2626'};">
            ${(data.generalAverage || 0) >= 10 ? 'OUI' : 'NON'}
          </td>
        </tr></table>
      </div>

      <!-- II - ATTITUDES -->
      <div style="border:1px solid #0A2A5E;border-radius:2px;padding:6px;margin-bottom:6px;width:100%;">
        <div style="font-size:10px;font-weight:bold;color:#0A2A5E;text-transform:uppercase;margin-bottom:4px;">II - Attitudes</div>
        <div style="font-size:10px;margin-bottom:4px;">
          <strong>Assiduité :</strong> ${data.assiduite ? `<span style="color:#1a1a1a;">${data.assiduite}</span>` : '<span style="border-bottom:1px dotted #94a3b8;display:inline-block;width:60%;height:12px;"></span>'}
        </div>
        <div style="font-size:10px;margin-bottom:4px;">
          <strong>Discipline :</strong> ${data.discipline ? `<span style="color:#1a1a1a;">${data.discipline}</span>` : '<span style="border-bottom:1px dotted #94a3b8;display:inline-block;width:60%;height:12px;"></span>'}
        </div>
        <div style="font-size:10px;margin-bottom:3px;"><strong>Défauts majeurs identifiés :</strong></div>
        ${data.defautsMajeurs ? `<div style="font-size:9px;color:#475569;margin-bottom:4px;">${data.defautsMajeurs}</div>` : [1,2].map(() => '<div style="border-bottom:1px dotted #94a3b8;margin:3px 0;height:10px;"></div>').join('')}
        <div style="font-size:10px;margin-top:4px;margin-bottom:3px;"><strong>Qualités remarquables :</strong></div>
        ${data.qualitesRemarquables ? `<div style="font-size:9px;color:#475569;margin-bottom:4px;">${data.qualitesRemarquables}</div>` : [1,2].map(() => '<div style="border-bottom:1px dotted #94a3b8;margin:3px 0;height:10px;"></div>').join('')}
      </div>

      <!-- ANALYSE DES RESULTATS -->
      <div style="border:1px solid #0A2A5E;border-radius:2px;padding:6px;margin-bottom:6px;width:100%;">
        <div style="font-size:10px;font-weight:bold;color:#0A2A5E;text-transform:uppercase;margin-bottom:4px;">Analyse des résultats et recommandations</div>
        ${data.analyseRecommandations ? `<div style="font-size:9px;color:#475569;line-height:1.5;">${data.analyseRecommandations}</div>` : [1,2,3,4].map(() => '<div style="border-bottom:1px dotted #94a3b8;margin:4px 0;height:10px;"></div>').join('')}
      </div>

      <!-- 3 SIGNATURES -->
      <div style="border:1px solid #0A2A5E;border-radius:2px;padding:6px;margin-bottom:6px;width:100%;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="width:33%;text-align:center;vertical-align:bottom;padding:6px 3px;">
              <div style="height:35px;">${data.teacherSignature ? `<img src="${data.teacherSignature}" style="max-height:35px;max-width:90px;object-fit:contain;" />` : ''}</div>
              <div style="border-top:1px solid #000;margin-top:4px;padding-top:2px;font-size:10px;font-weight:bold;color:#0A2A5E;">Enseignant(e)</div>
              ${data.teacherName ? `<div style="font-size:9px;color:#1a1a1a;margin-top:1px;font-weight:600;">${data.teacherName}</div>` : '<div style="font-size:8px;color:#64748b;margin-top:1px;">Signature du titulaire</div>'}
            </td>
            <td style="width:34%;text-align:center;vertical-align:bottom;padding:6px 3px;">
              <div style="height:35px;">${data.parentSignature ? `<img src="${data.parentSignature}" style="max-height:35px;max-width:90px;object-fit:contain;" />` : ''}</div>
              <div style="border-top:1px solid #000;margin-top:4px;padding-top:2px;font-size:10px;font-weight:bold;color:#0A2A5E;">Parent</div>
              <div style="font-size:8px;color:#64748b;">Signature et nom</div>
            </td>
            <td style="width:33%;text-align:center;vertical-align:bottom;padding:6px 3px;">
              <div style="height:35px;">${data.directorSignature ? `<img src="${data.directorSignature}" style="max-height:35px;max-width:90px;object-fit:contain;" />` : ''}</div>
              ${data.directorVisa ? `<div style="font-size:8px;color:#dc2626;font-style:italic;margin-top:2px;">${data.directorVisa}</div>` : ''}
              <div style="border-top:1px solid #000;margin-top:4px;padding-top:2px;font-size:10px;font-weight:bold;color:#0A2A5E;">VISA du Directeur</div>
              <div style="font-size:8px;color:#64748b;">Visa</div>
            </td>
          </tr>
        </table>
      </div>

      <!-- QR code -->
      <div style="text-align:center;margin-top:4px;">
        <img src="${qrCode}" style="width:40px;height:40px;" alt="QR" />
        <div style="font-size:8px;color:#94a3b8;">Code de vérification</div>
      </div>`;

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Bulletin - ${data.studentName}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Times New Roman',Georgia,serif; color:#1a1a1a; font-size:10px; position:relative; }
.watermark { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-15deg); opacity:0.08; z-index:0; pointer-events:none; }
.content { position:relative; z-index:1; }
.header { margin-bottom:6px; padding-bottom:4px; border-bottom:2px solid #0A2A5E; }
.header-table { width:100%; border-collapse:collapse; }
.header-table td { vertical-align:middle; padding:2px 4px; }
.header-left { text-align:center; width:12%; }
.header-center { text-align:center; width:68%; }
.header-right { text-align:center; width:20%; }
.republique { font-size:11px; font-weight:bold; text-transform:uppercase; letter-spacing:0.5px; }
.divider { margin:2px auto; width:50%; }
.divider-line { height:1px; background:#0A2A5E; }
.ministere { font-size:8px; font-weight:bold; text-transform:uppercase; letter-spacing:0.3px; line-height:1.3; }
.school-name { font-size:11px; font-weight:bold; text-transform:uppercase; margin-top:3px; color:#0A2A5E; }
.school-info { font-size:7px; color:#555; margin-top:2px; font-style:italic; }
.bulletin-title { text-align:center; background:#0A2A5E; color:white; padding:4px 8px; border-radius:2px; margin-bottom:6px; font-size:10px; font-weight:bold; text-transform:uppercase; }
table.notes { width:100%; border-collapse:collapse; }
table.notes th { color:white; border:1px solid; padding:5px 3px; font-size:7px; text-transform:uppercase; }
table.notes td { border:1px solid #cbd5e1; padding:5px 3px; }
table.notes tbody tr:nth-child(even) { background:#f8fafc; }
.footer { margin-top:4px; text-align:center; font-size:7px; color:#999; border-top:1px solid #eee; padding-top:3px; position:fixed; bottom:5mm; left:0; right:0; }
</style>
</head>
<body>

${data.schoolLogo ? `<img src="${data.schoolLogo}" class="watermark" style="width:400px;height:400px;object-fit:contain;" alt="" />` : ''}

<div class="content">

${page1Content}

${page2Content}

</div>

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
    if (avg >= 12) return '😊 Assez Bien';
    if (avg >= 10) return '😐 Passable';
    return '😞 Insuffisant';
  }

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  BULLETIN ANGLOPHONE — Layout A5 portrait (2 pages)                       ║
  // ║                                                                          ║
  // ║  Page 1:                                                                 ║
  // ║    - Header officiel (Republic of Benin + flag + ministry + school)      ║
  // ║    - Term ending + pupil info (name, age, class, position, adm. num,     ║
  // ║      session, pupil's average)                                           ║
  // ║    - Grades table: Subject | First CA (/40) | Second CA (/40) |          ║
  // ║      Exam (/60) | Total (/100)                                           ║
  // ║                                                                          ║
  // ║  Page 2:                                                                 ║
  // ║    - Mark obtainable (100 × nb subjects) / Mark obtained                ║
  // ║    - No in class (rank)                                                  ║
  // ║    - Class teacher's comments (based on average + next term date)       ║
  // ║    - Affective assessment (A/B/C checkboxes per skill)                  ║
  // ║    - Psychomotor skills (A/B/C checkboxes per skill)                    ║
  // ║    - Director's comments + signature                                    ║
  // ╚══════════════════════════════════════════════════════════════════════════╝
  private buildHtmlAnglophone(data: BulletinPdfData, qrCode: string, _bulletinId: string): string {
    const ministry = data.isSecondary
      ? 'Ministry of Secondary, Technical and Vocational Education and Youth Insertion'
      : 'Ministry of Pre-Primary and Primary Education';

    // Benin flag (SVG data URL)
    const beninFlagSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="40" viewBox="0 0 75 50"><rect width="30" height="50" fill="#008751"/><rect x="30" width="45" height="25" fill="#FCD116"/><rect x="30" y="25" width="45" height="25" fill="#E8112D"/></svg>`;
    const beninFlag = `data:image/svg+xml;base64,${Buffer.from(beninFlagSvg).toString('base64')}`;

    // ─── Compute derived values ───────────────────────────────────────────────
    // For each subject, ensure firstCA/secondCA/exam/total are present.
    // If absent (null), display "—".
    const subjects = data.subjects;
    const nbSubjects = subjects.length;
    const subjectTotals100 = subjects.map(s => {
      const fca = Number(s.firstCA ?? 0);
      const sca = Number(s.secondCA ?? 0);
      const ex = Number(s.exam ?? 0);
      // /100 conversion: (FCA+SCA+Exam) / 140 * 100
      return (fca + sca + ex) / 140 * 100;
    });
    const markObtained = subjectTotals100.reduce((a, b) => a + b, 0);
    const markObtainable = 100 * nbSubjects;
    const pupilAverage = nbSubjects > 0 ? markObtained / nbSubjects : 0;

    // Pupil info
    const admissionNo = data.admissionNumber || data.studentMatricule || '—';
    const session = data.sessionYear || data.academicYearName || '—';
    const termEnding = data.termEndingDate || '—';
    const nextTermStart = data.nextTermStartDate || '—';
    const ageStr = data.studentAge !== null && data.studentAge !== undefined
      ? String(data.studentAge) : '—';
    const positionStr = data.classRank
      ? (data.classRank === 1 ? '1st' : data.classRank === 2 ? '2nd' : data.classRank === 3 ? '3rd' : `${data.classRank}th`)
      : '—';

    // ─── Class teacher's comments based on average ───────────────────────────
    // ⭐ Si l'utilisateur a édité le commentaire, on l'utilise. Sinon, auto-gén.
    const teacherComment = data.enTeacherComment && data.enTeacherComment.trim().length > 0
      ? data.enTeacherComment
      : this.getEnTeacherComment(pupilAverage, nextTermStart);

    // ─── Director's comments based on average ────────────────────────────────
    // ⭐ Si l'utilisateur a édité le commentaire, on l'utilise. Sinon, auto-gén.
    const directorComment = data.enDirectorComment && data.enDirectorComment.trim().length > 0
      ? data.enDirectorComment
      : this.getEnDirectorComment(pupilAverage);

    // ─── Parse user-provided Affective + Psychomotor assessments (JSON) ──────
    //     Format attendu: {"Punctuality":"A","Politeness":"B",...}
    //     Si null/invalid, on déclenche l'auto-génération basée sur la moyenne.
    let affectiveMap: Record<string, string> = {};
    try {
      if (data.enAffectiveAssessment) {
        affectiveMap = JSON.parse(data.enAffectiveAssessment);
      }
    } catch { affectiveMap = {}; }
    if (Object.keys(affectiveMap).length === 0) {
      affectiveMap = this.autoFillAffective(pupilAverage);
    }
    let psychomotorMap: Record<string, string> = {};
    try {
      if (data.enPsychomotorAssessment) {
        psychomotorMap = JSON.parse(data.enPsychomotorAssessment);
      }
    } catch { psychomotorMap = {}; }
    if (Object.keys(psychomotorMap).length === 0) {
      psychomotorMap = this.autoFillPsychomotor(pupilAverage);
    }

    // ─── Build subject rows ──────────────────────────────────────────────────
    const subjectRows = subjects.map((s, i) => {
      const fcaStr = s.firstCA === null || s.firstCA === undefined
        ? '<span style="color:#94a3b8;">—</span>'
        : (s.isAbsent ? '<span style="color:red;font-size:7px;font-weight:bold;">ABS</span>' : String(s.firstCA));
      const scaStr = s.secondCA === null || s.secondCA === undefined
        ? '<span style="color:#94a3b8;">—</span>'
        : (s.isAbsent ? '<span style="color:red;font-size:7px;font-weight:bold;">ABS</span>' : String(s.secondCA));
      const examStr = s.exam === null || s.exam === undefined
        ? '<span style="color:#94a3b8;">—</span>'
        : (s.isAbsent ? '<span style="color:red;font-size:7px;font-weight:bold;">ABS</span>' : String(s.exam));
      const total100 = subjectTotals100[i];
      const totalStr = s.isAbsent
        ? '<span style="color:red;font-size:7px;font-weight:bold;">ABS</span>'
        : `<strong style="color:#0A2A5E;">${total100.toFixed(1)}</strong>`;
      return `<tr>
        <td style="border:1px solid #cbd5e1;padding:4px 5px;font-size:9px;text-align:left;">${s.name}</td>
        <td style="border:1px solid #cbd5e1;padding:4px;text-align:center;font-size:9px;">${fcaStr}</td>
        <td style="border:1px solid #cbd5e1;padding:4px;text-align:center;font-size:9px;">${scaStr}</td>
        <td style="border:1px solid #cbd5e1;padding:4px;text-align:center;font-size:9px;">${examStr}</td>
        <td style="border:1px solid #cbd5e1;padding:4px;text-align:center;font-size:10px;font-weight:600;background:#f8fafc;">${totalStr}</td>
      </tr>`;
    }).join('');

    // ─── Affective Assessment (A/B/C checkboxes) ──────────────────────────────
    // ⭐ Auto-rempli depuis l'annotation utilisateur ou auto-généré depuis la moyenne
    const affectiveSkills = [
      'Punctuality', 'Politeness', 'Honesty', 'Self-control',
      'Cooperation', 'Respect for others', 'Initiative', 'Perseverance',
      'Care for property', 'Leadership',
    ];
    const affectiveRows = affectiveSkills.map(skill => {
      const val = affectiveMap[skill] || '';
      const aCheck = val === 'A' ? '<strong style="color:#059669;">&#9745;</strong>' : '&#9744;';
      const bCheck = val === 'B' ? '<strong style="color:#2563eb;">&#9745;</strong>' : '&#9744;';
      const cCheck = val === 'C' ? '<strong style="color:#d97706;">&#9745;</strong>' : '&#9744;';
      return `<tr>
        <td style="border:1px solid #cbd5e1;padding:3px 5px;font-size:8px;">${skill}</td>
        <td style="border:1px solid #cbd5e1;padding:3px;text-align:center;font-size:9px;">${aCheck}</td>
        <td style="border:1px solid #cbd5e1;padding:3px;text-align:center;font-size:9px;">${bCheck}</td>
        <td style="border:1px solid #cbd5e1;padding:3px;text-align:center;font-size:9px;">${cCheck}</td>
      </tr>`;
    }).join('');

    // ─── Psychomotor Skills (A/B/C checkboxes) ───────────────────────────────
    // ⭐ Auto-rempli depuis l'annotation utilisateur ou auto-généré depuis la moyenne
    const psychomotorSkills = [
      'Handwriting', 'Drawing and Painting', 'Handwork/Crafts',
      'Physical Education', 'Music', 'Games and Sports',
    ];
    const psychomotorRows = psychomotorSkills.map(skill => {
      const val = psychomotorMap[skill] || '';
      const aCheck = val === 'A' ? '<strong style="color:#059669;">&#9745;</strong>' : '&#9744;';
      const bCheck = val === 'B' ? '<strong style="color:#2563eb;">&#9745;</strong>' : '&#9744;';
      const cCheck = val === 'C' ? '<strong style="color:#d97706;">&#9745;</strong>' : '&#9744;';
      return `<tr>
        <td style="border:1px solid #cbd5e1;padding:3px 5px;font-size:8px;">${skill}</td>
        <td style="border:1px solid #cbd5e1;padding:3px;text-align:center;font-size:9px;">${aCheck}</td>
        <td style="border:1px solid #cbd5e1;padding:3px;text-align:center;font-size:9px;">${bCheck}</td>
        <td style="border:1px solid #cbd5e1;padding:3px;text-align:center;font-size:9px;">${cCheck}</td>
      </tr>`;
    }).join('');

    // ─── PAGE 1 ──────────────────────────────────────────────────────────────
    const page1Content = `
      <!-- OFFICIAL HEADER -->
      <div class="header">
        <table class="header-table">
          <tr>
            <td class="header-left"><img src="${beninFlag}" alt="Flag of Benin" style="width:30px;height:20px;" /></td>
            <td class="header-center">
              <div class="republique">Republic of Benin</div>
              <div class="divider"><div class="divider-line"></div></div>
              <div class="ministere">${ministry}</div>
              <div class="divider"><div class="divider-line"></div></div>
              <div class="school-name">${data.schoolName}</div>
              <div class="school-info">${data.schoolSlogan ? `&laquo; ${data.schoolSlogan} &raquo; · ` : ''}${data.schoolAddress || ''} · Tel: ${data.schoolPhone || ''} · ${data.schoolEmail || ''}</div>
            </td>
            <td class="header-right">${data.schoolLogo ? `<img src="${data.schoolLogo}" style="max-width:35px;max-height:35px;object-fit:contain;" />` : ''}</td>
          </tr>
        </table>
      </div>

      <!-- REPORT CARD TITLE -->
      <div class="bulletin-title">Report Card &mdash; ${data.periodName} &mdash; ${data.academicYearName}</div>

      <!-- TERM ENDING -->
      <div style="text-align:center;font-size:9px;margin-bottom:5px;padding:3px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:2px;">
        <strong style="color:#0A2A5E;">Term ends on:</strong> ${termEnding}
      </div>

      <!-- PUPIL INFO TABLE -->
      <table class="pupil-info">
        <tr>
          <td style="width:50%;"><span class="label">Name of Pupil:</span> <strong>${data.studentName}</strong></td>
          <td style="width:50%;"><span class="label">Age:</span> <strong>${ageStr}</strong></td>
        </tr>
        <tr>
          <td><span class="label">Class:</span> <strong>${data.className || '—'}</strong></td>
          <td><span class="label">Position:</span> <strong>${positionStr}</strong></td>
        </tr>
        <tr>
          <td><span class="label">Admission Number:</span> <strong>${admissionNo}</strong></td>
          <td><span class="label">Session:</span> <strong>${session}</strong></td>
        </tr>
        <tr>
          <td colspan="2"><span class="label">Pupil's Average:</span> <strong style="color:#0A2A5E;font-size:11px;">${pupilAverage.toFixed(2)} / 100</strong></td>
        </tr>
      </table>

      <!-- GRADES TABLE -->
      <table class="grades-table">
        <thead>
          <tr style="background:#0A2A5E;color:white;">
            <th style="border:1px solid #0D3B85;padding:5px;font-size:9px;text-align:left;text-transform:uppercase;">Subject</th>
            <th style="border:1px solid #0D3B85;padding:5px;font-size:9px;text-transform:uppercase;">First CA<br/><span style="font-size:7px;font-weight:normal;">/40</span></th>
            <th style="border:1px solid #0D3B85;padding:5px;font-size:9px;text-transform:uppercase;">Second CA<br/><span style="font-size:7px;font-weight:normal;">/40</span></th>
            <th style="border:1px solid #0D3B85;padding:5px;font-size:9px;text-transform:uppercase;">Exam<br/><span style="font-size:7px;font-weight:normal;">/60</span></th>
            <th style="border:1px solid #0D3B85;padding:5px;font-size:9px;text-transform:uppercase;background:#0D3B85;">Total<br/><span style="font-size:7px;font-weight:normal;">/100</span></th>
          </tr>
        </thead>
        <tbody>
          ${subjectRows}
          <tr style="background:#e2e8f0;font-weight:bold;">
            <td colspan="4" style="border:1px solid #cbd5e1;padding:5px;font-size:9px;text-align:right;text-transform:uppercase;">Pupil's Average</td>
            <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;font-size:11px;color:#0A2A5E;">${pupilAverage.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <!-- FOOTER PAGE 1 -->
      <div class="footer">Generated by Academia Helm &mdash; ${new Date().toLocaleString('en-US')}</div>
      <div style="page-break-after:always;"></div>`;

    // ─── PAGE 2 ──────────────────────────────────────────────────────────────
    const page2Content = `
      <!-- SHORT HEADER PAGE 2 -->
      <div style="text-align:center;margin-bottom:6px;padding-bottom:3px;border-bottom:1px solid #0A2A5E;">
        <div style="font-size:9px;font-weight:bold;color:#0A2A5E;">${data.schoolName} &mdash; ${data.studentName} &mdash; ${data.periodName}</div>
      </div>

      <!-- MARK OBTAINABLE / OBTAINED / NO IN CLASS -->
      <table style="width:100%;border-collapse:collapse;border:1px solid #0A2A5E;border-radius:2px;margin-bottom:6px;">
        <tr style="background:#0A2A5E;color:white;">
          <th style="padding:5px;font-size:9px;text-transform:uppercase;border:1px solid #0D3B85;">Mark Obtainable</th>
          <th style="padding:5px;font-size:9px;text-transform:uppercase;border:1px solid #0D3B85;">Mark Obtained</th>
          <th style="padding:5px;font-size:9px;text-transform:uppercase;border:1px solid #0D3B85;">No in Class</th>
        </tr>
        <tr>
          <td style="padding:5px;text-align:center;font-size:11px;font-weight:bold;color:#0A2A5E;border:1px solid #cbd5e1;">${markObtainable.toFixed(0)}</td>
          <td style="padding:5px;text-align:center;font-size:11px;font-weight:bold;color:#0A2A5E;border:1px solid #cbd5e1;">${markObtained.toFixed(2)}</td>
          <td style="padding:5px;text-align:center;font-size:11px;font-weight:bold;color:#0A2A5E;border:1px solid #cbd5e1;">${data.totalStudents || '—'}</td>
        </tr>
      </table>

      <!-- CLASS TEACHER'S COMMENTS -->
      <div style="border:1px solid #0A2A5E;border-radius:2px;padding:6px;margin-bottom:6px;">
        <div style="font-size:9px;font-weight:bold;color:#0A2A5E;text-transform:uppercase;margin-bottom:4px;">Class Teacher's Comments</div>
        <div style="font-size:9px;color:#1a1a1a;line-height:1.5;text-align:justify;min-height:50px;">${teacherComment}</div>
      </div>

      <!-- AFFECTIVE ASSESSMENT -->
      <div style="border:1px solid #0A2A5E;border-radius:2px;padding:6px;margin-bottom:6px;">
        <div style="font-size:9px;font-weight:bold;color:#0A2A5E;text-transform:uppercase;margin-bottom:4px;">Affective Assessment</div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="border:1px solid #cbd5e1;padding:3px 5px;font-size:8px;text-align:left;text-transform:uppercase;">Skill</th>
              <th style="border:1px solid #cbd5e1;padding:3px;font-size:8px;text-transform:uppercase;width:11%;">A</th>
              <th style="border:1px solid #cbd5e1;padding:3px;font-size:8px;text-transform:uppercase;width:11%;">B</th>
              <th style="border:1px solid #cbd5e1;padding:3px;font-size:8px;text-transform:uppercase;width:11%;">C</th>
            </tr>
          </thead>
          <tbody>${affectiveRows}</tbody>
        </table>
      </div>

      <!-- PSYCHOMOTOR SKILLS -->
      <div style="border:1px solid #0A2A5E;border-radius:2px;padding:6px;margin-bottom:6px;">
        <div style="font-size:9px;font-weight:bold;color:#0A2A5E;text-transform:uppercase;margin-bottom:4px;">Psychomotor Skills</div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="border:1px solid #cbd5e1;padding:3px 5px;font-size:8px;text-align:left;text-transform:uppercase;">Skill</th>
              <th style="border:1px solid #cbd5e1;padding:3px;font-size:8px;text-transform:uppercase;width:11%;">A</th>
              <th style="border:1px solid #cbd5e1;padding:3px;font-size:8px;text-transform:uppercase;width:11%;">B</th>
              <th style="border:1px solid #cbd5e1;padding:3px;font-size:8px;text-transform:uppercase;width:11%;">C</th>
            </tr>
          </thead>
          <tbody>${psychomotorRows}</tbody>
        </table>
      </div>

      <!-- DIRECTOR'S COMMENTS -->
      <div style="border:1px solid #0A2A5E;border-radius:2px;padding:6px;margin-bottom:6px;">
        <div style="font-size:9px;font-weight:bold;color:#0A2A5E;text-transform:uppercase;margin-bottom:4px;">Director's / Principal's Comments</div>
        <div style="font-size:9px;color:#1a1a1a;line-height:1.5;text-align:justify;min-height:40px;">${directorComment}</div>
      </div>

      <!-- SIGNATURES: Teacher + Parent + Director (3 signatures, same pattern as FR) -->
      <div style="border:1px solid #0A2A5E;border-radius:2px;padding:6px;margin-bottom:6px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="width:33%;text-align:center;vertical-align:bottom;padding:6px 3px;">
              <div style="height:35px;">${data.teacherSignature ? `<img src="${data.teacherSignature}" style="max-height:35px;max-width:80px;object-fit:contain;" />` : ''}</div>
              <div style="border-top:1px solid #000;margin-top:4px;padding-top:3px;font-size:9px;font-weight:bold;color:#0A2A5E;">Class Teacher</div>
              ${data.teacherName ? `<div style="font-size:8px;color:#1a1a1a;margin-top:1px;font-weight:600;">${data.teacherName}</div>` : '<div style="font-size:7px;color:#64748b;margin-top:1px;">Signature</div>'}
            </td>
            <td style="width:34%;text-align:center;vertical-align:bottom;padding:6px 3px;">
              <div style="height:35px;">${data.parentSignature ? `<img src="${data.parentSignature}" style="max-height:35px;max-width:80px;object-fit:contain;" />` : ''}</div>
              <div style="border-top:1px solid #000;margin-top:4px;padding-top:3px;font-size:9px;font-weight:bold;color:#0A2A5E;">Parent / Guardian</div>
              <div style="font-size:7px;color:#64748b;">Name &amp; Signature</div>
            </td>
            <td style="width:33%;text-align:center;vertical-align:bottom;padding:6px 3px;">
              <div style="height:35px;">${data.directorSignature ? `<img src="${data.directorSignature}" style="max-height:35px;max-width:80px;object-fit:contain;" />` : ''}</div>
              <div style="border-top:1px solid #000;margin-top:4px;padding-top:3px;font-size:9px;font-weight:bold;color:#0A2A5E;">Headmistress / Headmaster</div>
              <div style="font-size:7px;color:#64748b;">Signature</div>
            </td>
          </tr>
        </table>
      </div>

      <!-- QR CODE -->
      <div style="text-align:center;margin-top:6px;">
        <img src="${qrCode}" style="width:40px;height:40px;" alt="QR" />
        <div style="font-size:7px;color:#94a3b8;">Verification code</div>
      </div>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Report Card - ${data.studentName}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Times New Roman',Georgia,serif; color:#1a1a1a; font-size:10px; position:relative; }
.watermark { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-15deg); opacity:0.08; z-index:0; pointer-events:none; }
.content { position:relative; z-index:1; }
.header { margin-bottom:6px; padding-bottom:4px; border-bottom:2px solid #0A2A5E; }
.header-table { width:100%; border-collapse:collapse; }
.header-table td { vertical-align:middle; padding:2px 4px; }
.header-left { text-align:center; width:12%; }
.header-center { text-align:center; width:68%; }
.header-right { text-align:center; width:20%; }
.republique { font-size:11px; font-weight:bold; text-transform:uppercase; letter-spacing:0.5px; }
.divider { margin:2px auto; width:50%; }
.divider-line { height:1px; background:#0A2A5E; }
.ministere { font-size:8px; font-weight:bold; text-transform:uppercase; letter-spacing:0.3px; line-height:1.3; }
.school-name { font-size:11px; font-weight:bold; text-transform:uppercase; margin-top:3px; color:#0A2A5E; }
.school-info { font-size:7px; color:#555; margin-top:2px; font-style:italic; }
.bulletin-title { text-align:center; background:#0A2A5E; color:white; padding:5px 8px; border-radius:2px; margin-bottom:6px; font-size:11px; font-weight:bold; text-transform:uppercase; }
.pupil-info { width:100%; border-collapse:collapse; background:#f8fafc; border:1px solid #e2e8f0; border-radius:2px; margin-bottom:6px; }
.pupil-info td { padding:4px 6px; font-size:9px; border-bottom:1px solid #e2e8f0; }
.pupil-info tr:last-child td { border-bottom:none; }
.pupil-info .label { font-size:8px; color:#64748b; text-transform:uppercase; letter-spacing:0.3px; }
.grades-table { width:100%; border-collapse:collapse; }
.grades-table th { color:white; }
.grades-table tbody tr:nth-child(even) { background:#f8fafc; }
.footer { margin-top:4px; text-align:center; font-size:7px; color:#999; border-top:1px solid #eee; padding-top:3px; }
</style>
</head>
<body>

${data.schoolLogo ? `<img src="${data.schoolLogo}" class="watermark" style="width:400px;height:400px;object-fit:contain;" alt="" />` : ''}

<div class="content">

${page1Content}

${page2Content}

</div>

</body>
</html>`;
  }

  /**
   * ⭐ Auto-remplissage de l'Affective Assessment basé sur la moyenne /100.
   * - >= 80 (Very Good+) : A pour la plupart des compétences (quelques B)
   * - 70-79 (Good)       : A/B mix
   * - 60-69 (Fair)       : B majoritaire, quelques A
   * - 50-59 (Pass)       : B/C mix
   * - 40-49 (Weak)       : C majoritaire
   * - < 40 (Very Weak)   : C pour toutes
   *
   * Compétences "Critiques" (Honesty, Self-control, Respect, Cooperation)
   * reçoivent toujours une note légèrement supérieure pour refléter le
   * caractère non-académique.
   */
  private autoFillAffective(pupilAverage: number): Record<string, string> {
    const skills = [
      'Punctuality', 'Politeness', 'Honesty', 'Self-control',
      'Cooperation', 'Respect for others', 'Initiative', 'Perseverance',
      'Care for property', 'Leadership',
    ];
    // Soft skills that should be rated slightly higher than academic performance
    const softSkills = new Set(['Honesty', 'Self-control', 'Respect for others', 'Cooperation']);
    const map: Record<string, string> = {};
    for (let i = 0; i < skills.length; i++) {
      const skill = skills[i];
      const isSoft = softSkills.has(skill);
      // Bump level for soft skills (one level higher than academic baseline)
      let level: 'A' | 'B' | 'C';
      if (pupilAverage >= 80) level = isSoft ? 'A' : (i % 4 === 0 ? 'B' : 'A');
      else if (pupilAverage >= 70) level = isSoft ? 'A' : (i % 3 === 0 ? 'B' : 'A');
      else if (pupilAverage >= 60) level = isSoft ? 'A' : (i % 2 === 0 ? 'B' : 'A');
      else if (pupilAverage >= 50) level = isSoft ? 'B' : (i % 3 === 0 ? 'C' : 'B');
      else if (pupilAverage >= 40) level = isSoft ? 'B' : (i % 2 === 0 ? 'C' : 'B');
      else level = isSoft ? 'B' : 'C';
      map[skill] = level;
    }
    return map;
  }

  /**
   * ⭐ Auto-remplissage des Psychomotor Skills basé sur la moyenne /100.
   * Suit la même logique que l'Affective Assessment.
   */
  private autoFillPsychomotor(pupilAverage: number): Record<string, string> {
    const skills = [
      'Handwriting', 'Drawing and Painting', 'Handwork/Crafts',
      'Physical Education', 'Music', 'Games and Sports',
    ];
    const map: Record<string, string> = {};
    for (let i = 0; i < skills.length; i++) {
      let level: 'A' | 'B' | 'C';
      if (pupilAverage >= 80) level = i % 4 === 0 ? 'B' : 'A';
      else if (pupilAverage >= 70) level = i % 3 === 0 ? 'B' : 'A';
      else if (pupilAverage >= 60) level = i % 2 === 0 ? 'B' : 'A';
      else if (pupilAverage >= 50) level = i % 3 === 0 ? 'C' : 'B';
      else if (pupilAverage >= 40) level = i % 2 === 0 ? 'C' : 'B';
      else level = 'C';
      map[skills[i]] = level;
    }
    return map;
  }

  /**
   * ⭐ Commentaire de l'enseignant anglophone basé sur la moyenne /100.
   * Inclut la date de début du prochain trimestre.
   */
  private getEnTeacherComment(pupilAverage: number, nextTermStart: string): string {
    if (pupilAverage >= 90) {
      return `Outstanding performance! This pupil has demonstrated exceptional mastery across all subjects. Keep up the excellent work. Next term begins on <strong>${nextTermStart}</strong>.`;
    }
    if (pupilAverage >= 80) {
      return `Very good results. The pupil shows strong academic achievement and consistent effort. Aim for the highest standards next term, which starts on <strong>${nextTermStart}</strong>.`;
    }
    if (pupilAverage >= 70) {
      return `Good performance. The pupil understands most concepts taught. With greater concentration, results will improve further. Next term starts on <strong>${nextTermStart}</strong>.`;
    }
    if (pupilAverage >= 60) {
      return `Fair results. The pupil is advised to work harder and remain focused. Greater commitment is required to improve. Next term begins on <strong>${nextTermStart}</strong>.`;
    }
    if (pupilAverage >= 50) {
      return `Results are just satisfactory. Stronger effort and parental follow-up are necessary. Next term starts on <strong>${nextTermStart}</strong>.`;
    }
    if (pupilAverage >= 40) {
      return `Performance below expectation. Immediate improvement is required with parental involvement. Next term begins on <strong>${nextTermStart}</strong>.`;
    }
    return `Very poor academic performance. Urgent remedial measures and close supervision are required. Next term starts on <strong>${nextTermStart}</strong>.`;
  }

  /**
   * ⭐ Commentaire du directeur/principal anglophone basé sur la moyenne /100.
   */
  private getEnDirectorComment(pupilAverage: number): string {
    if (pupilAverage >= 90) {
      return 'Excellent academic performance. Commendable effort and discipline. Keep striving for excellence.';
    }
    if (pupilAverage >= 80) {
      return 'Very good results. Consistent effort is encouraged to reach the highest standards.';
    }
    if (pupilAverage >= 70) {
      return 'Good performance. Greater concentration and consistency will lead to better outcomes.';
    }
    if (pupilAverage >= 60) {
      return 'Fair results. The pupil is advised to work harder and remain focused.';
    }
    if (pupilAverage >= 50) {
      return 'Results are just satisfactory. Stronger effort and parental follow-up are necessary.';
    }
    if (pupilAverage >= 40) {
      return 'Performance below expectation. Immediate improvement is required with parental involvement.';
    }
    return 'Very poor academic performance. Urgent remedial measures and close supervision are required.';
  }
}

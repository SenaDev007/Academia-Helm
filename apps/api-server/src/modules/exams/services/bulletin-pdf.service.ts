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
    // V10g — First CA /20 + Second CA /20 + Exam /60 → total = /100 exact
    firstCA?: number | null;   // /20
    secondCA?: number | null;  // /20
    exam?: number | null;      // /60
    total?: number | null;     // /100 (FCA + SCA + Exam, somme brute)
    // ⭐ V10h — modèle Report Book : colonnes Highest/Lowest in class, Position,
    //    Grade (A+, A, B, C, D, F) et Remark — fournies par le frontend
    //    (stats calculées sur toute la classe), avec fallback serveur.
    highestInClass?: number | null;
    lowestInClass?: number | null;
    subjectPosition?: number | null;
    grade?: string | null;
    remark?: string | null;
    // ⭐ SECONDAIRE — modèle CEG : Moy Int / Dev1 / Dev2 / Moy / Coef / Moy Coef
    //    (undefined = aucune donnée, null = absent, number = note)
    secInt1?: number | null;
    secInt2?: number | null;
    secDs1?: number | null;
    secDs2?: number | null;
    secMoyInter?: number | null;
    secMoyenne?: number | null;
    secCoef?: number | null;
    secNoteCoef?: number | null;
    secRank?: number | null;
    secHasSlot?: boolean;
  }>;
  // ⭐ SECONDAIRE — 6e/5e sans coefficient (true) vs 4e → Terminale (false)
  secJunior?: boolean;
  // ⭐ SECONDAIRE — totaux du tableau (Σ coefficients / Σ notes coefficient)
  secTotalCoef?: number | null;
  secTotalNotesCoef?: number | null;
  // ⭐ SECONDAIRE — récap du 3e trimestre (moyennes T1/T2 + moyenne annuelle + passage)
  secRecap?: {
    period1Average: number | null;
    period2Average: number | null;
    annualAverage: number | null;
    annualRank: number | null;
    decision: string | null;
  } | null;
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
  directorName?: string | null;  // ⭐ Nom du directeur (résolu depuis school_directors)
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
      //    ⭐ SECONDAIRE FR : modèle CEG (Moy Int / Dev1 / Dev2 / Moy / Coef / Moy Coef)
      const html = data.scopeLang === 'EN'
        ? this.buildHtmlAnglophone(data, qrDataUrl, bulletinId)
        : (data.isSecondary
          ? this.buildHtmlSecondaire(data, qrDataUrl, bulletinId)
          : this.buildHtml(data, qrDataUrl, bulletinId));

      // 3. Generate PDF via Puppeteer
      //    ⭐ V10h — le bulletin anglophone (Report Book, tableau 10 colonnes)
      //    passe en A4 portrait ; le bulletin FR reste en A5 portrait.
      //    ⭐ SECONDAIRE FR : A4 portrait (tableau 10 colonnes + récap T3).
      const { page } = await this.puppeteerPool.acquirePage();
      try {
        // ⭐ Use 'domcontentloaded' instead of 'networkidle0' — faster, doesn't wait
        // for all network traffic to stop (which can timeout with base64 images).
        // The PDF is generated from inline HTML/CSS, no external resources needed.
        await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
        // Small delay to let any inline images (base64 signatures, SVG flag) render
        await new Promise(resolve => setTimeout(resolve, 500));
        const pdfBuffer = await page.pdf({
          format: data.scopeLang === 'EN' || data.isSecondary ? 'A4' : 'A5',
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
                ${data.directorName ? `<div style="font-size:7px;color:#1a1a1a;margin-top:1px;font-weight:600;">${data.directorName}</div>` : '<div style="font-size:7px;color:#64748b;margin-top:1px;">Visa</div>'}
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
                ${data.directorName ? `<div style="font-size:7px;color:#1a1a1a;margin-top:1px;font-weight:600;">${data.directorName}</div>` : '<div style="font-size:7px;color:#64748b;margin-top:1px;">Visa</div>'}
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
              ${data.directorName ? `<div style="font-size:9px;color:#1a1a1a;margin-top:1px;font-weight:600;">${data.directorName}</div>` : '<div style="font-size:8px;color:#64748b;margin-top:1px;">Visa</div>'}
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
              ${data.directorName ? `<div style="font-size:9px;color:#1a1a1a;margin-top:1px;font-weight:600;">${data.directorName}</div>` : '<div style="font-size:8px;color:#64748b;margin-top:1px;">Visa</div>'}
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
   * ⭐ SECONDAIRE — Bulletin modèle CEG (piste FR) :
   *
   *   Discipline | Interrogation écrite [Interrogation écrite 1,
   *   Interrogation écrite 2] | Moyenne d'interrogation |
   *   Devoir surveillé [Devoir 1, Devoir 2] | Moyenne |
   *   [Coefficient | Note coefficient] | Rang | Appréciation | Signature
   *
   *   6e / 5e  : SANS colonnes Coefficient / Note coefficient
   *   4e → Term : AVEC — TOTAL DES COEFFICIENTS / TOTAL DES MOYENNES
   *   + Moyenne trimestrielle, stats de classe, récap T3 (T1 + T2 + moyenne
   *     annuelle pour le passage) et décision. A4 portrait.
   */
  private buildHtmlSecondaire(data: BulletinPdfData, qrCode: string, bulletinId: string): string {
    const ministry = "Ministère des Enseignements Secondaire, de la Formation Technique et Professionnelle, de la Reconversion et de l'Insertion des Jeunes";

    // Benin flag as SVG data URL (même drapeau que buildHtml)
    const beninFlagSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="40" viewBox="0 0 75 50"><rect width="30" height="50" fill="#008751"/><rect x="30" width="45" height="25" fill="#FCD116"/><rect x="30" y="25" width="45" height="25" fill="#E8112D"/></svg>`;
    const beninFlag = `data:image/svg+xml;base64,${Buffer.from(beninFlagSvg).toString('base64')}`;

    const isJunior = data.secJunior === true;
    const feminine = data.studentGender === 'FEMALE' || data.studentGender === 'F';

    const fmtSec = (n: number | null | undefined): string =>
      (typeof n === 'number' && !isNaN(n)) ? n.toFixed(2) : '—';

    // ── Lignes du tableau (une par discipline) ──────────────────────────────
    const subjectRows = data.subjects.map((s) => {
      // Note brute : undefined = pas d'évaluation → « — » ; null = absent → ABS
      const cell = (v: number | null | undefined) =>
        typeof v === 'number'
          ? `<span style="color:${v >= 10 ? '#0f172a' : '#dc2626'};font-weight:bold;">${v.toFixed(2)}</span>`
          : (v === null && s.secHasSlot
            ? '<span style="color:#dc2626;font-size:8px;font-weight:bold;">ABS</span>'
            : '<span style="color:#94a3b8;">—</span>');
      // Moyenne : verte si ≥ 10, rouge sinon
      const moyCell = (v: number | null | undefined) =>
        typeof v === 'number'
          ? `<span style="color:${v >= 10 ? '#059669' : '#dc2626'};font-weight:bold;">${v.toFixed(2)}</span>`
          : '<span style="color:#94a3b8;">—</span>';
      const rang = s.secRank ? formatRank(s.secRank, feminine) : '—';
      return `<tr>
          <td style="border:1px solid #cbd5e1;padding:3px 2px;font-size:10px;font-weight:600;">${s.name}</td>
          <td style="border:1px solid #cbd5e1;padding:3px 2px;text-align:center;font-size:10px;">${cell(s.secInt1)}</td>
          <td style="border:1px solid #cbd5e1;padding:3px 2px;text-align:center;font-size:10px;">${cell(s.secInt2)}</td>
          <td style="border:1px solid #cbd5e1;padding:3px 2px;text-align:center;font-size:10px;color:#1d4ed8;background:#eff6ff;">${cell(s.secMoyInter)}</td>
          <td style="border:1px solid #cbd5e1;padding:3px 2px;text-align:center;font-size:10px;">${cell(s.secDs1)}</td>
          <td style="border:1px solid #cbd5e1;padding:3px 2px;text-align:center;font-size:10px;">${cell(s.secDs2)}</td>
          <td style="border:1px solid #cbd5e1;padding:3px 2px;text-align:center;font-size:11px;background:#ecfdf5;">${moyCell(s.secMoyenne)}</td>
          ${!isJunior ? `
          <td style="border:1px solid #cbd5e1;padding:3px 2px;text-align:center;font-size:10px;color:#b45309;background:#fffbeb;font-weight:bold;">${typeof s.secCoef === 'number' ? s.secCoef : 1}</td>
          <td style="border:1px solid #cbd5e1;padding:3px 2px;text-align:center;font-size:11px;background:#ecfdf5;">${moyCell(s.secNoteCoef)}</td>` : ''}
          <td style="border:1px solid #cbd5e1;padding:3px 2px;text-align:center;font-size:10px;font-weight:bold;">${rang}</td>
          <td style="border:1px solid #cbd5e1;padding:3px 2px;text-align:center;font-size:9px;color:#475569;">${s.appreciation || '—'}</td>
          <td style="border:1px solid #cbd5e1;padding:3px 2px;height:20px;"></td>
        </tr>`;
    }).join('');

    // ── Totaux (4e → Terminale uniquement) — avec fallback serveur ──────────
    let totalCoef = typeof data.secTotalCoef === 'number' ? data.secTotalCoef : null;
    let totalNotesCoef = typeof data.secTotalNotesCoef === 'number' ? data.secTotalNotesCoef : null;
    if (!isJunior && (totalCoef === null || totalNotesCoef === null)) {
      let cSum = 0, nSum = 0;
      for (const s of data.subjects) {
        if (typeof s.secMoyenne !== 'number') continue;
        const coef = typeof s.secCoef === 'number' ? s.secCoef : 1;
        cSum += coef;
        nSum += typeof s.secNoteCoef === 'number' ? s.secNoteCoef : s.secMoyenne * coef;
      }
      if (totalCoef === null) totalCoef = cSum;
      if (totalNotesCoef === null) totalNotesCoef = nSum;
    }

    // ── En-tête du tableau — colonnes parentes EN HAUT, sous-colonnes en bas :
    //    Discipline | Interrogation écrite [Int. écrite 1, Int. écrite 2] |
    //    Moyenne d'interrogation | Devoir surveillé [Devoir 1, Devoir 2] |
    //    Moyenne | [Coefficient | Note coefficient] | Rang | Appréciation | Signature
    const tableHeader = `
      <tr style="background:#0A2A5E;color:white;">
        <th rowspan="2" style="border:1px solid #0D3B85;padding:4px 3px;font-size:9px;text-transform:uppercase;text-align:left;">Discipline</th>
        <th colspan="2" style="border:1px solid #0D3B85;padding:4px 3px;font-size:9px;text-transform:uppercase;">Interrogation écrite</th>
        <th rowspan="2" style="border:1px solid #0D3B85;padding:4px 3px;font-size:8px;text-transform:uppercase;background:#0D3B85;">Moyenne d'interrogation</th>
        <th colspan="2" style="border:1px solid #0D3B85;padding:4px 3px;font-size:9px;text-transform:uppercase;">Devoir surveillé</th>
        <th rowspan="2" style="border:1px solid #0D3B85;padding:4px 3px;font-size:9px;text-transform:uppercase;background:#0D3B85;">Moyenne</th>
        ${!isJunior ? `
        <th rowspan="2" style="border:1px solid #0D3B85;padding:4px 3px;font-size:8px;text-transform:uppercase;">Coefficient</th>
        <th rowspan="2" style="border:1px solid #0D3B85;padding:4px 3px;font-size:8px;text-transform:uppercase;background:#0D3B85;">Note coefficient</th>` : ''}
        <th rowspan="2" style="border:1px solid #0D3B85;padding:4px 3px;font-size:9px;text-transform:uppercase;">Rang</th>
        <th rowspan="2" style="border:1px solid #0D3B85;padding:4px 3px;font-size:8px;text-transform:uppercase;">Appréciation</th>
        <th rowspan="2" style="border:1px solid #0D3B85;padding:4px 3px;font-size:8px;text-transform:uppercase;">Signature</th>
      </tr>
      <tr style="background:#114FC4;color:white;">
        <th style="border:1px solid #114FC4;padding:3px;font-size:8px;">Interrogation écrite 1</th>
        <th style="border:1px solid #114FC4;padding:3px;font-size:8px;">Interrogation écrite 2</th>
        <th style="border:1px solid #114FC4;padding:3px;font-size:8px;">Devoir 1</th>
        <th style="border:1px solid #114FC4;padding:3px;font-size:8px;">Devoir 2</th>
      </tr>`;

    // ── Lignes de totaux + moyenne trimestrielle (colspans : 6e/5e = 10
    //    colonnes, 4e → Terminale = 12) ───────────────────────────────
    const totalRows = `
      ${!isJunior ? `
      <tr style="background:#e2e8f0;font-weight:bold;">
        <td colspan="7" style="border:1px solid #cbd5e1;padding:3px;font-size:8px;text-transform:uppercase;text-align:right;">Total des coefficients</td>
        <td style="border:1px solid #cbd5e1;padding:3px;text-align:center;font-size:10px;color:#b45309;">${totalCoef ?? '—'}</td>
        <td colspan="4" style="border:1px solid #cbd5e1;"></td>
      </tr>
      <tr style="background:#e2e8f0;font-weight:bold;">
        <td colspan="7" style="border:1px solid #cbd5e1;padding:3px;font-size:8px;text-transform:uppercase;text-align:right;">Total des moyennes (Σ moy × coef)</td>
        <td style="border:1px solid #cbd5e1;padding:3px;text-align:center;font-size:10px;color:#059669;">${totalNotesCoef !== null ? totalNotesCoef.toFixed(2) : '—'}</td>
        <td colspan="4" style="border:1px solid #cbd5e1;"></td>
      </tr>` : ''}
      <tr style="background:#dbeafe;font-weight:bold;">
        <td colspan="6" style="border:1px solid #cbd5e1;padding:3px;font-size:8px;text-transform:uppercase;text-align:right;">Moyenne trimestrielle</td>
        <td colspan="${isJunior ? 1 : 2}" style="border:1px solid #cbd5e1;padding:3px;text-align:center;font-size:11px;color:#0A2A5E;">${fmtSec(data.generalAverage)}</td>
        <td colspan="${isJunior ? 3 : 4}" style="border:1px solid #cbd5e1;padding:3px;text-align:center;font-size:9px;color:#0A2A5E;">Rang : ${formatRank(data.classRank, feminine)} / ${data.totalStudents}</td>
      </tr>`;

    // ── Récap du 3e trimestre (moyennes T1 + T2 + moyenne annuelle + passage) ──
    const recapBlock = data.secRecap ? `
      <div style="margin-top:6px;border:2px solid #0A2A5E;border-radius:3px;overflow:hidden;">
        <div style="background:#0A2A5E;color:white;font-size:9px;font-weight:bold;text-transform:uppercase;text-align:center;padding:3px;">Récapitulatif de l'année (3e trimestre)</div>
        <table style="width:100%;border-collapse:collapse;font-size:10px;">
          <tr>
            <td style="border:1px solid #cbd5e1;padding:3px 5px;background:#f8fafc;font-weight:bold;">Moyenne 1er trimestre :</td>
            <td style="border:1px solid #cbd5e1;padding:3px 5px;text-align:center;font-weight:bold;">${fmtSec(data.secRecap.period1Average)}</td>
            <td style="border:1px solid #cbd5e1;padding:3px 5px;background:#f8fafc;font-weight:bold;">Moyenne 2e trimestre :</td>
            <td style="border:1px solid #cbd5e1;padding:3px 5px;text-align:center;font-weight:bold;">${fmtSec(data.secRecap.period2Average)}</td>
          </tr>
          <tr>
            <td style="border:1px solid #cbd5e1;padding:3px 5px;background:#f8fafc;font-weight:bold;">Moyenne annuelle :</td>
            <td style="border:1px solid #cbd5e1;padding:3px 5px;text-align:center;font-weight:bold;color:#0A2A5E;font-size:11px;">${fmtSec(data.secRecap.annualAverage)}</td>
            <td style="border:1px solid #cbd5e1;padding:3px 5px;background:#f8fafc;font-weight:bold;">Rang annuel :</td>
            <td style="border:1px solid #cbd5e1;padding:3px 5px;text-align:center;font-weight:bold;">${data.secRecap.annualRank ? formatRank(data.secRecap.annualRank, feminine) : '—'}</td>
          </tr>
          <tr>
            <td style="border:1px solid #cbd5e1;padding:3px 5px;background:#f8fafc;font-weight:bold;">Décision du conseil :</td>
            <td colspan="3" style="border:1px solid #cbd5e1;padding:3px 5px;text-align:center;font-weight:bold;color:${(data.secRecap.annualAverage ?? 0) >= 10 ? '#059669' : '#dc2626'};">${data.secRecap.decision || '—'}</td>
          </tr>
        </table>
      </div>` : '';

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
.header { margin-bottom:5px; padding-bottom:3px; border-bottom:2px solid #0A2A5E; }
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
.bulletin-title { text-align:center; border:2px solid #0A2A5E; padding:4px 8px; margin-bottom:5px; font-size:11px; font-weight:bold; text-transform:uppercase; color:#0A2A5E; background:#f8fafc; }
table.notes { width:100%; border-collapse:collapse; }
table.notes th { color:white; border:1px solid; padding:4px 3px; font-size:8px; text-transform:uppercase; }
table.notes td { border:1px solid #cbd5e1; padding:3px 2px; }
table.notes tbody tr:nth-child(even) { background:#f8fafc; }
.info-table { width:100%; border-collapse:collapse; margin-bottom:5px; border:1px solid #0A2A5E; }
.info-table td { border:1px solid #cbd5e1; padding:3px 5px; font-size:9px; background:#f8fafc; }
.footer { margin-top:4px; text-align:center; font-size:7px; color:#999; border-top:1px solid #eee; padding-top:3px; }
</style>
</head>
<body>

${data.schoolLogo ? `<img src="${data.schoolLogo}" class="watermark" style="width:400px;height:400px;object-fit:contain;" alt="" />` : ''}

<div class="content">

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
  <div class="bulletin-title">Bulletin de notes du ${data.periodName} — ${data.academicYearName}</div>

  <!-- INFOS ÉLÈVE (modèle : Année | Nom | Classe / Effectif | Matricule | Rang) -->
  <table class="info-table">
    <tr>
      <td>Année scolaire : <strong>${data.academicYearName}</strong></td>
      <td>Nom et prénoms : <strong style="text-transform:uppercase;">${data.studentName}</strong></td>
      <td>Classe : <strong>${data.className}</strong></td>
    </tr>
    <tr>
      <td>Effectif : <strong>${data.totalStudents}</strong></td>
      <td>Matricule : <strong>${data.studentMatricule || '—'}</strong></td>
      <td>Rang : <strong>${formatRank(data.classRank, feminine)}</strong></td>
    </tr>
  </table>

  <!-- TABLEAU DES NOTES (coins arrondis, bordure navy) -->
  <div style="border:2px solid #0A2A5E;border-radius:4px;overflow:hidden;">
    <table class="notes">
      <thead>${tableHeader}</thead>
      <tbody>${subjectRows}${totalRows}</tbody>
    </table>
  </div>

  <!-- SYNTHÈSE STATISTIQUE -->
  <div style="margin-top:5px;font-size:9px;">
    <table style="width:100%;border-collapse:collapse;"><tr>
      <td style="background:#f8fafc;border:1px solid #e2e8f0;padding:2px 5px;text-align:center;">Moyenne de la classe : <strong>${fmtSec(data.classAverage)}</strong></td>
      <td style="background:#f8fafc;border:1px solid #e2e8f0;padding:2px 5px;text-align:center;">Moyenne la plus faible : <strong>${fmtSec(data.lowestAverage)}</strong></td>
      <td style="background:#f8fafc;border:1px solid #e2e8f0;padding:2px 5px;text-align:center;">Moyenne la plus forte : <strong>${fmtSec(data.highestAverage)}</strong></td>
    </tr></table>
  </div>

  ${recapBlock}

  <!-- DÉCISIONS + SIGNATURES -->
  <table style="width:100%;border-collapse:collapse;margin-top:6px;">
    <tr>
      <td style="width:60%;vertical-align:top;padding-right:8px;">
        <div style="border:1px solid #0A2A5E;border-radius:2px;padding:4px;font-size:9px;">
          <div style="font-weight:bold;text-transform:uppercase;color:#0A2A5E;margin-bottom:2px;">Décision du conseil de classe</div>
          <div style="font-weight:bold;color:${data.secRecap ? ((data.secRecap.annualAverage ?? 0) >= 10 ? '#059669' : '#dc2626') : '#475569'};">${data.secRecap?.decision || '—'}</div>
        </div>
        <div style="border:1px solid #0A2A5E;border-radius:2px;padding:4px;font-size:9px;margin-top:4px;">
          <div style="font-weight:bold;text-transform:uppercase;color:#0A2A5E;margin-bottom:2px;">Appréciation du Directeur</div>
          <div style="font-weight:bold;">${data.appreciationGlobale || '—'}</div>
        </div>
      </td>
      <td style="width:40%;vertical-align:bottom;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="width:50%;text-align:center;vertical-align:bottom;padding:4px 2px;">
              <div style="height:30px;">${data.teacherSignature ? `<img src="${data.teacherSignature}" style="max-height:30px;max-width:80px;object-fit:contain;" />` : ''}</div>
              <div style="border-top:1px solid #000;margin-top:3px;padding-top:2px;font-size:8px;font-weight:bold;color:#0A2A5E;">Le Titulaire</div>
              ${data.teacherName ? `<div style="font-size:7px;color:#1a1a1a;font-weight:600;">${data.teacherName}</div>` : ''}
            </td>
            <td style="width:50%;text-align:center;vertical-align:bottom;padding:4px 2px;">
              <div style="height:30px;">${data.directorSignature ? `<img src="${data.directorSignature}" style="max-height:30px;max-width:80px;object-fit:contain;" />` : ''}</div>
              <div style="border-top:1px solid #000;margin-top:3px;padding-top:2px;font-size:8px;font-weight:bold;color:#0A2A5E;">Le Directeur</div>
              ${data.directorName ? `<div style="font-size:7px;color:#1a1a1a;font-weight:600;">${data.directorName}</div>` : '<div style="font-size:7px;color:#64748b;">Visa</div>'}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- QR + MENTION -->
  <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:8px;">
    <div style="font-size:8px;font-style:italic;color:#475569;">Le parent est prié de vérifier les notes et de contester dans les 48 heures.</div>
    <div style="text-align:center;">
      <img src="${qrCode}" style="width:40px;height:40px;" alt="QR" />
      <div style="font-size:6px;color:#94a3b8;">Code de vérification</div>
    </div>
  </div>

  <div class="footer">Document généré par Academia Helm — ${new Date().toLocaleString('fr-FR')} · ID : ${bulletinId}</div>
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
  // ║    - Grades table: Subject | First CA (/20) | Second CA (/20) |          ║
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
  /**
   * ============================================================================
   * ⭐ V10h — BULLETIN ANGLOPHONE — MODÈLE « REPORT BOOK » (2 pages A4)
   * ============================================================================
   *
   * Page 1 (exactement comme le Report Book fourni) :
   *   TERM ENDING / NAME OF PUPIL / AGE + CLASS / POSITION + ADMISSION N° /
   *   SESSION / PUPIL'S AVERAGE, puis le tableau :
   *   SUBJECTS | 1st CA /20 | 2nd CA /20 | Exam /60 | Total /100 |
   *   Highest in class | Lowest in class | Position | Grade | Remark
   *
   * Page 2 :
   *   Mark obtainable / Mark obtained / No in class · Teacher's Appreciation +
   *   Class Teacher's Comments (grille /100) · Next term begins ·
   *   Affective Assessment: Psychomotor Skills (2 colonnes A–E) ·
   *   Headmaster(mistress)'s Comment (grille) · 3 signatures.
   */
  private buildHtmlAnglophone(data: BulletinPdfData, qrCode: string, _bulletinId: string): string {
    const ministry = data.isSecondary
      ? 'Ministry of Secondary, Technical and Vocational Education and Youth Insertion'
      : 'Ministry of Pre-Primary and Primary Education';

    // Benin flag (SVG data URL)
    const beninFlagSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="40" viewBox="0 0 75 50"><rect width="30" height="50" fill="#008751"/><rect x="30" width="45" height="25" fill="#FCD116"/><rect x="30" y="25" width="45" height="25" fill="#E8112D"/></svg>`;
    const beninFlag = `data:image/svg+xml;base64,${Buffer.from(beninFlagSvg).toString('base64')}`;

    // ─── Derived values ──────────────────────────────────────────────────────
    const subjects = data.subjects;
    const nbSubjects = subjects.length;
    const subjectTotals100 = subjects.map(s => {
      const fca = Number(s.firstCA ?? 0);
      const sca = Number(s.secondCA ?? 0);
      const ex = Number(s.exam ?? 0);
      // ⭐ V10g — 20 + 20 + 60 = 100 : le total brut EST sur /100
      return fca + sca + ex;
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
    const positionStr = data.classRank ? this.enOrdinal(data.classRank) : '—';
    const noInClass = data.totalStudents || '—';

    // ─── Grille /100 (tier courant de l'élève) ───────────────────────────────
    const tier = this.enTierFor(pupilAverage);

    // ─── Class teacher's comment (2 parties : appreciation + comments) ───────
    //     enTeacherComment = "appreciation\ncomments" (sauvegardé par le front)
    let teacherAppreciation = tier.teacherAppreciation;
    let teacherComments = tier.teacherComments.join('\n');
    if (data.enTeacherComment && data.enTeacherComment.trim().length > 0) {
      const lines = String(data.enTeacherComment).split('\n');
      teacherAppreciation = lines[0] || tier.teacherAppreciation;
      teacherComments = lines.slice(1).join('\n').trim() || tier.teacherComments.join('\n');
    }

    // ─── Headmaster's comment (grille /100) ──────────────────────────────────
    const directorComment = data.enDirectorComment && data.enDirectorComment.trim().length > 0
      ? data.enDirectorComment
      : tier.principalComment;

    // ─── Affective + Psychomotor maps (JSON utilisateur ou auto) ─────────────
    let affectiveMap: Record<string, string> = {};
    try {
      if (data.enAffectiveAssessment) affectiveMap = JSON.parse(data.enAffectiveAssessment);
    } catch { affectiveMap = {}; }
    if (Object.keys(affectiveMap).length === 0) affectiveMap = this.autoFillAffective(pupilAverage);
    let psychomotorMap: Record<string, string> = {};
    try {
      if (data.enPsychomotorAssessment) psychomotorMap = JSON.parse(data.enPsychomotorAssessment);
    } catch { psychomotorMap = {}; }
    if (Object.keys(psychomotorMap).length === 0) psychomotorMap = this.autoFillPsychomotor(pupilAverage);

    // ─── Subject rows — 10 colonnes (Report Book) ────────────────────────────
    const subjectRows = subjects.map((s, i) => {
      const total100 = subjectTotals100[i];
      const hasScore = s.firstCA !== null && s.firstCA !== undefined
        || s.secondCA !== null && s.secondCA !== undefined
        || s.exam !== null && s.exam !== undefined;
      const fcaStr = s.firstCA === null || s.firstCA === undefined || s.isAbsent
        ? '<span style="color:#94a3b8;">—</span>' : String(s.firstCA);
      const scaStr = s.secondCA === null || s.secondCA === undefined || s.isAbsent
        ? '<span style="color:#94a3b8;">—</span>' : String(s.secondCA);
      const examStr = s.exam === null || s.exam === undefined || s.isAbsent
        ? '<span style="color:#94a3b8;">—</span>' : String(s.exam);
      const totalStr = s.isAbsent
        ? '<span style="color:red;font-size:7px;font-weight:bold;">ABS</span>'
        : hasScore ? `<strong style="color:#0A2A5E;">${total100.toFixed(1)}</strong>`
          : '<span style="color:#94a3b8;">—</span>';
      const highestStr = s.highestInClass !== null && s.highestInClass !== undefined
        ? s.highestInClass.toFixed(1) : '—';
      const lowestStr = s.lowestInClass !== null && s.lowestInClass !== undefined
        ? s.lowestInClass.toFixed(1) : '—';
      const posStr = s.subjectPosition ? this.enOrdinal(s.subjectPosition) : '—';
      const gradeStr = s.grade || this.enGradeFor(total100);
      const remarkStr = s.remark || (this.enTierFor(total100)?.label ?? '—');
      return `<tr>
        <td style="border:1px solid #cbd5e1;padding:4px 5px;font-size:9px;text-align:left;">${s.name}</td>
        <td style="border:1px solid #cbd5e1;padding:4px;text-align:center;font-size:9px;">${fcaStr}</td>
        <td style="border:1px solid #cbd5e1;padding:4px;text-align:center;font-size:9px;">${scaStr}</td>
        <td style="border:1px solid #cbd5e1;padding:4px;text-align:center;font-size:9px;">${examStr}</td>
        <td style="border:1px solid #cbd5e1;padding:4px;text-align:center;font-size:10px;font-weight:600;background:#f8fafc;">${totalStr}</td>
        <td style="border:1px solid #cbd5e1;padding:4px;text-align:center;font-size:9px;color:#475569;">${highestStr}</td>
        <td style="border:1px solid #cbd5e1;padding:4px;text-align:center;font-size:9px;color:#475569;">${lowestStr}</td>
        <td style="border:1px solid #cbd5e1;padding:4px;text-align:center;font-size:9px;font-weight:600;">${posStr}</td>
        <td style="border:1px solid #cbd5e1;padding:4px;text-align:center;font-size:9px;font-weight:bold;color:#0A2A5E;">${gradeStr}</td>
        <td style="border:1px solid #cbd5e1;padding:4px;text-align:center;font-size:8px;color:#475569;">${remarkStr}</td>
      </tr>`;
    }).join('');

    // ─── Affective / Psychomotor — 2 colonnes A–E (Report Book) ──────────────
    const affectiveCategories = [
      'Co-operativeness', 'Punctuality', 'Curiosity', 'Politeness', 'Honesty',
      'Att. School', 'Writ. Express.', 'Oral Express.', 'Health Info',
    ];
    const psychomotorCategories = [
      'Handwriting', 'Games', 'Musical Skills', 'Handling of tool', 'Drawing &amp; Painting',
    ];
    const levelCell = (val: string, lvl: string): string =>
      val === lvl ? '<strong style="color:#0A2A5E;">&#9745;</strong>' : '&#9744;';
    const skillRow = (categories: string[], map: Record<string, string>): string =>
      categories.map(cat => {
        const val = map[cat] || '';
        return `<tr>
          <td style="border:1px solid #cbd5e1;padding:2px 5px;font-size:8px;text-align:left;">${cat}</td>
          <td style="border:1px solid #cbd5e1;padding:2px;text-align:center;font-size:8px;">${levelCell(val, 'A')}</td>
          <td style="border:1px solid #cbd5e1;padding:2px;text-align:center;font-size:8px;">${levelCell(val, 'B')}</td>
          <td style="border:1px solid #cbd5e1;padding:2px;text-align:center;font-size:8px;">${levelCell(val, 'C')}</td>
          <td style="border:1px solid #cbd5e1;padding:2px;text-align:center;font-size:8px;">${levelCell(val, 'D')}</td>
          <td style="border:1px solid #cbd5e1;padding:2px;text-align:center;font-size:8px;">${levelCell(val, 'E')}</td>
        </tr>`;
      }).join('');
    const affectiveRows = skillRow(affectiveCategories, affectiveMap);
    const psychomotorRows = skillRow(psychomotorCategories, psychomotorMap);
    const gridHeader = `<tr style="background:#f1f5f9;">
      <th style="border:1px solid #cbd5e1;padding:3px 5px;font-size:8px;text-align:left;text-transform:uppercase;">Category</th>
      <th style="border:1px solid #cbd5e1;padding:3px;font-size:8px;width:7%;">A</th>
      <th style="border:1px solid #cbd5e1;padding:3px;font-size:8px;width:7%;">B</th>
      <th style="border:1px solid #cbd5e1;padding:3px;font-size:8px;width:7%;">C</th>
      <th style="border:1px solid #cbd5e1;padding:3px;font-size:8px;width:7%;">D</th>
      <th style="border:1px solid #cbd5e1;padding:3px;font-size:8px;width:7%;">E</th>
    </tr>`;

    // ─── Teacher's comments — lignes multiples (une par ligne de la grille) ──
    const teacherCommentLines = teacherComments
      .split('\n').filter(l => l.trim().length > 0)
      .map(l => `<div style="font-size:9px;color:#1a1a1a;line-height:1.6;">&#8226; ${l.trim()}</div>`).join('');

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

      <!-- PUPIL INFO FORM (Report Book) -->
      <table class="pupil-form">
        <tr>
          <td colspan="2"><span class="form-label">Term ending:</span> <strong>${termEnding}</strong></td>
        </tr>
        <tr>
          <td colspan="2"><span class="form-label">Name of pupil:</span> <strong>${data.studentName}</strong></td>
        </tr>
        <tr>
          <td style="width:50%;"><span class="form-label">Age:</span> <strong>${ageStr}</strong></td>
          <td style="width:50%;"><span class="form-label">Class:</span> <strong>${data.className || '—'}</strong></td>
        </tr>
        <tr>
          <td><span class="form-label">Position:</span> <strong>${positionStr}</strong></td>
          <td><span class="form-label">Admission N&deg;:</span> <strong>${admissionNo}</strong></td>
        </tr>
        <tr>
          <td colspan="2"><span class="form-label">Session:</span> <strong>${session}</strong></td>
        </tr>
        <tr>
          <td colspan="2"><span class="form-label">Pupil&rsquo;s average:</span> <strong style="color:#0A2A5E;font-size:11px;">${pupilAverage.toFixed(2)} / 100</strong></td>
        </tr>
      </table>

      <!-- GRADES TABLE — 10 COLUMNS (Report Book) -->
      <table class="grades-table">
        <thead>
          <tr style="background:#0A2A5E;color:white;">
            <th style="border:1px solid #0D3B85;padding:4px 2px;font-size:8px;text-align:left;text-transform:uppercase;">Subjects</th>
            <th style="border:1px solid #0D3B85;padding:4px 1px;font-size:8px;text-transform:uppercase;">1st<br/>CA<br/><span style="font-size:6px;font-weight:normal;">/20</span></th>
            <th style="border:1px solid #0D3B85;padding:4px 1px;font-size:8px;text-transform:uppercase;">2nd<br/>CA<br/><span style="font-size:6px;font-weight:normal;">/20</span></th>
            <th style="border:1px solid #0D3B85;padding:4px 1px;font-size:8px;text-transform:uppercase;">Exam<br/><span style="font-size:6px;font-weight:normal;">/60</span></th>
            <th style="border:1px solid #0D3B85;padding:4px 1px;font-size:8px;text-transform:uppercase;background:#0D3B85;">Total<br/><span style="font-size:6px;font-weight:normal;">/100</span></th>
            <th style="border:1px solid #0D3B85;padding:4px 1px;font-size:7px;text-transform:uppercase;line-height:1.2;">Highest in class</th>
            <th style="border:1px solid #0D3B85;padding:4px 1px;font-size:7px;text-transform:uppercase;line-height:1.2;">Lowest in class</th>
            <th style="border:1px solid #0D3B85;padding:4px 1px;font-size:8px;text-transform:uppercase;">Position</th>
            <th style="border:1px solid #0D3B85;padding:4px 1px;font-size:8px;text-transform:uppercase;">Grade</th>
            <th style="border:1px solid #0D3B85;padding:4px 1px;font-size:8px;text-transform:uppercase;">Remark</th>
          </tr>
        </thead>
        <tbody>
          ${subjectRows}
          <tr style="background:#e2e8f0;font-weight:bold;">
            <td colspan="9" style="border:1px solid #cbd5e1;padding:4px;font-size:8px;text-align:right;text-transform:uppercase;">Pupil&rsquo;s Average</td>
            <td style="border:1px solid #cbd5e1;padding:4px;text-align:center;font-size:10px;color:#0A2A5E;">${pupilAverage.toFixed(2)}</td>
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
          <td style="padding:5px;text-align:center;font-size:11px;font-weight:bold;color:#0A2A5E;border:1px solid #cbd5e1;">${noInClass}</td>
        </tr>
      </table>

      <!-- CLASS TEACHER'S COMMENT (Teacher's Appreciation + Comments — grille /100) -->
      <div style="border:1px solid #0A2A5E;border-radius:2px;padding:6px;margin-bottom:6px;">
        <div style="font-size:9px;font-weight:bold;color:#0A2A5E;text-transform:uppercase;margin-bottom:4px;">Class Teacher&rsquo;s Comment</div>
        <div style="font-size:9px;color:#1a1a1a;line-height:1.5;margin-bottom:4px;"><em>${teacherAppreciation}</em></div>
        ${teacherCommentLines || '<div style="font-size:9px;color:#64748b;">&mdash;</div>'}
      </div>

      <!-- NEXT TERM BEGINS -->
      <div style="border:1px solid #0A2A5E;border-radius:2px;padding:5px 6px;margin-bottom:6px;font-size:9px;">
        <span style="font-weight:bold;color:#0A2A5E;text-transform:uppercase;">Next term begins:</span>
        <strong>${nextTermStart}</strong>
      </div>

      <!-- AFFECTIVE ASSESSMENT: PSYCHOMOTOR SKILLS (2 colonnes A–E — Report Book) -->
      <div style="border:1px solid #0A2A5E;border-radius:2px;padding:6px;margin-bottom:6px;">
        <div style="font-size:9px;font-weight:bold;color:#0A2A5E;text-transform:uppercase;margin-bottom:4px;text-align:center;">Affective Assessment: Psychomotor Skills</div>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="width:50%;vertical-align:top;padding:0 2px 0 0;">
              <table style="width:100%;border-collapse:collapse;">
                <thead>${gridHeader}</thead>
                <tbody>${affectiveRows}</tbody>
              </table>
            </td>
            <td style="width:50%;vertical-align:top;padding:0 0 0 2px;">
              <table style="width:100%;border-collapse:collapse;">
                <thead>${gridHeader}</thead>
                <tbody>${psychomotorRows}</tbody>
              </table>
            </td>
          </tr>
        </table>
      </div>

      <!-- HEADMASTER(MISTRESS)'S COMMENT (grille /100) -->
      <div style="border:1px solid #0A2A5E;border-radius:2px;padding:6px;margin-bottom:6px;">
        <div style="font-size:9px;font-weight:bold;color:#0A2A5E;text-transform:uppercase;margin-bottom:4px;">Headmaster(mistress)&rsquo;s Comment</div>
        <div style="font-size:9px;color:#1a1a1a;line-height:1.5;text-align:justify;min-height:40px;">${directorComment}</div>
      </div>

      <!-- SIGNATURES: Class Teacher + Headmaster + Parent (3 signatures) -->
      <div style="border:1px solid #0A2A5E;border-radius:2px;padding:6px;margin-bottom:6px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="width:33%;text-align:center;vertical-align:bottom;padding:6px 3px;">
              <div style="height:35px;">${data.teacherSignature ? `<img src="${data.teacherSignature}" style="max-height:35px;max-width:80px;object-fit:contain;" />` : ''}</div>
              <div style="border-top:1px solid #000;margin-top:4px;padding-top:3px;font-size:9px;font-weight:bold;color:#0A2A5E;">Class Teacher</div>
              ${data.teacherName ? `<div style="font-size:8px;color:#1a1a1a;margin-top:1px;font-weight:600;">${data.teacherName}</div>` : '<div style="font-size:7px;color:#64748b;margin-top:1px;">Signature</div>'}
            </td>
            <td style="width:34%;text-align:center;vertical-align:bottom;padding:6px 3px;">
              <div style="height:35px;">${data.directorSignature ? `<img src="${data.directorSignature}" style="max-height:35px;max-width:80px;object-fit:contain;" />` : ''}</div>
              <div style="border-top:1px solid #000;margin-top:4px;padding-top:3px;font-size:9px;font-weight:bold;color:#0A2A5E;">Headmaster(mistress)</div>
              ${data.directorName ? `<div style="font-size:8px;color:#1a1a1a;margin-top:1px;font-weight:600;">${data.directorName}</div>` : '<div style="font-size:7px;color:#64748b;">Signature</div>'}
            </td>
            <td style="width:33%;text-align:center;vertical-align:bottom;padding:6px 3px;">
              <div style="height:35px;">${data.parentSignature ? `<img src="${data.parentSignature}" style="max-height:35px;max-width:80px;object-fit:contain;" />` : ''}</div>
              <div style="border-top:1px solid #000;margin-top:4px;padding-top:3px;font-size:9px;font-weight:bold;color:#0A2A5E;">Parent / Guardian</div>
              <div style="font-size:7px;color:#64748b;">Name &amp; Signature</div>
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
.pupil-form { width:100%; border-collapse:collapse; border:2px solid #0A2A5E; margin-bottom:6px; }
.pupil-form td { padding:4px 8px; font-size:9px; border:1px solid #cbd5e1; }
.pupil-form .form-label { font-size:8px; color:#475569; text-transform:uppercase; letter-spacing:0.3px; font-weight:bold; }
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
   * ⭐ V10h — Grille des appréciations /100 (modèle Report Book).
   * 7 paliers → grades A+, A, B, C, D, F (F couvre WEAK + VERY WEAK).
   */
  private readonly EN_APPRECIATION_TIERS = [
    {
      min: 90, label: 'Outstanding', grade: 'A+',
      teacherAppreciation: 'Outstanding performance. Excellent mastery of concepts.',
      teacherComments: [
        'Demonstrates exceptional understanding and skills',
        'Highly consistent and disciplined work',
        'Shows leadership and strong participation',
        'Keep up the excellent work',
      ],
      principalComment: 'Excellent academic performance. Commendable effort and discipline. Keep striving for excellence.',
    },
    {
      min: 80, label: 'Very Good', grade: 'A',
      teacherAppreciation: 'Very good performance. Strong academic achievement.',
      teacherComments: [
        'Very good comprehension of lessons',
        'Regular and serious work habits',
        'Participates actively in class',
        'Aiming for excellence is encouraged',
      ],
      principalComment: 'Very good results. Consistent effort is encouraged to reach the highest standards.',
    },
    {
      min: 70, label: 'Good', grade: 'B',
      teacherAppreciation: 'Good performance. Satisfactory results.',
      teacherComments: [
        'Understands most concepts taught',
        'Shows good effort and engagement',
        'Minor weaknesses need attention',
        'Can perform better with more focus',
      ],
      principalComment: 'Good performance. Greater concentration and consistency will lead to better outcomes.',
    },
    {
      min: 60, label: 'Fair', grade: 'C',
      teacherAppreciation: 'Fair performance. Needs improvement.',
      teacherComments: [
        'Basic understanding achieved',
        'Effort is inconsistent',
        'Needs to revise key concepts',
        'Greater commitment is required',
      ],
      principalComment: 'Fair results. Student is advised to work harder and remain focused.',
    },
    {
      min: 50, label: 'Pass', grade: 'D',
      teacherAppreciation: 'Passable performance. Results are just acceptable.',
      teacherComments: [
        'Learning objectives partially met',
        'Weak academic foundations',
        'Must improve study habits',
        'Parental support is recommended',
      ],
      principalComment: 'Results are just satisfactory. Stronger effort and parental follow-up are necessary.',
    },
    {
      min: 40, label: 'Weak', grade: 'F',
      teacherAppreciation: 'Weak performance. Below expected standard.',
      teacherComments: [
        'Significant learning difficulties',
        'Insufficient effort and practice',
        'Requires close academic monitoring',
        'Immediate corrective actions needed',
      ],
      principalComment: 'Performance below expectation. Immediate improvement is required with parental involvement.',
    },
    {
      min: 0, label: 'Very Weak', grade: 'F',
      teacherAppreciation: 'Very weak performance. Unsatisfactory.',
      teacherComments: [
        'Very poor understanding of lessons',
        'Lack of effort and motivation',
        'Serious academic gaps',
        'Intensive support is urgently required',
      ],
      principalComment: 'Very poor academic performance. Urgent remedial measures and close supervision are required.',
    },
  ];

  /** Palier de la grille pour un score /100. */
  private enTierFor(score: number) {
    return this.EN_APPRECIATION_TIERS.find(t => score >= t.min)
      ?? this.EN_APPRECIATION_TIERS[this.EN_APPRECIATION_TIERS.length - 1];
  }

  /** Grade (A+, A, B, C, D, F) pour un score /100 — colonne Grade. */
  private enGradeFor(score: number): string {
    return this.enTierFor(score).grade;
  }

  /** Ordinal anglais : 1 → 1st, 2 → 2nd, 3 → 3rd, 4 → 4th… */
  private enOrdinal(rank: number): string {
    const rem10 = rank % 10, rem100 = rank % 100;
    if (rem10 === 1 && rem100 !== 11) return `${rank}st`;
    if (rem10 === 2 && rem100 !== 12) return `${rank}nd`;
    if (rem10 === 3 && rem100 !== 13) return `${rank}rd`;
    return `${rank}th`;
  }

  /**
   * ⭐ V10h — Auto-remplissage Affective Assessment (colonne gauche du Report
   * Book), niveaux A–E depuis la moyenne /100. Compétences comportementales
   * (Co-operativeness, Politeness, Honesty, Punctuality, Health Info) relevées
   * d'un niveau pour refléter le caractère non-académique.
   */
  private autoFillAffective(pupilAverage: number): Record<string, string> {
    const skills = [
      'Co-operativeness', 'Punctuality', 'Curiosity', 'Politeness', 'Honesty',
      'Att. School', 'Writ. Express.', 'Oral Express.', 'Health Info',
    ];
    const soft = new Set(['Co-operativeness', 'Politeness', 'Honesty', 'Punctuality', 'Health Info']);
    const levels = ['A', 'B', 'C', 'D', 'E'];
    const baseIdx = pupilAverage >= 90 ? 0
      : pupilAverage >= 80 ? 1
        : pupilAverage >= 70 ? 2
          : pupilAverage >= 50 ? 3 : 4;
    const map: Record<string, string> = {};
    for (let i = 0; i < skills.length; i++) {
      let idx = baseIdx;
      if (soft.has(skills[i])) idx = Math.max(0, idx - 1);          // un niveau au-dessus
      else if (i % 3 === 0) idx = Math.min(levels.length - 1, idx + 1); // un niveau en dessous
      map[skills[i]] = levels[idx];
    }
    return map;
  }

  /**
   * ⭐ V10h — Auto-remplissage Psychomotor Skills (colonne droite du Report
   * Book), niveaux A–E depuis la moyenne /100.
   */
  private autoFillPsychomotor(pupilAverage: number): Record<string, string> {
    const skills = [
      'Handwriting', 'Games', 'Musical Skills', 'Handling of tool', 'Drawing & Painting',
    ];
    const levels = ['A', 'B', 'C', 'D', 'E'];
    const baseIdx = pupilAverage >= 90 ? 0
      : pupilAverage >= 80 ? 1
        : pupilAverage >= 70 ? 2
          : pupilAverage >= 50 ? 3 : 4;
    const map: Record<string, string> = {};
    for (let i = 0; i < skills.length; i++) {
      const idx = i % 3 === 0 ? Math.min(levels.length - 1, baseIdx + 1) : baseIdx;
      map[skills[i]] = levels[idx];
    }
    return map;
  }
}


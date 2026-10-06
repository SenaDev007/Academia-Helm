/**
 * ============================================================================
 * PROCÈS-VERBAL & STATISTIQUES & PROMOTION PDF SERVICE
 * ============================================================================
 *
 * Génération des PDF officiels pour le module Examen :
 *   - Procès-verbal d'évaluation (1 évaluation précise)
 *   - Procès-verbal trimestriel (consolidé par trimestre)
 *   - Procès-verbal annuel (consolidé sur l'année — 3 trimestres)
 *   - Statistiques des notes / moyennes (taux de réussite + intervalle + meilleurs)
 *   - Promotion & Redoublement (liste passants + redoublants par classe)
 *
 * Format A4 PAYSAGE pour tous (exigence promoteur).
 *
 * En-tête officiel République du Bénin + drapeau + ministère + école
 * Pied de page « Document généré par Academia Helm »
 * (Même charte que bulletin-pdf.service.ts.)
 *
 * Matières abrégées : l'utilisateur peut définir `subject.abbreviation`
 * dans le module Organisation Pédagogique ; sinon mapping auto (PCT, SVT,
 * FR, HG, EPS, MATH, Com.écr., etc.). Utilitaire getSubjectAbbreviation.
 *
 * Utilise PuppeteerPoolService (HTML → PDF) comme le module Bulletins.
 * ============================================================================
 */

import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { PuppeteerPoolService } from '../../../common/services/puppeteer-pool.service';

// ─── Types partagés ──────────────────────────────────────────────────────────
export interface SchoolBranding {
  schoolName: string;
  schoolLogo?: string | null;
  schoolAddress?: string;
  schoolPhone?: string;
  schoolEmail?: string;
  schoolSlogan?: string;
  isSecondary?: boolean;
}

export interface PVSubject {
  id: string;
  name: string;
  abbreviation?: string | null;
  code?: string | null;
  coefficient?: number;
}

export interface PVStudentRow {
  id: string;
  matricule: string;
  name: string;
  gender?: string;
  subjectScores: Record<string, number | null>; // subjectId → score
  total: number;
  totalCoef: number;
  moyenne: number | null;
  rang: number;
}

export interface ProcVerbalPdfData {
  branding: SchoolBranding;
  academicYearName: string;
  periodName: string;       // « Trimestre 1 » ou « Année scolaire 2024-2025 » en mode annuel
  evalTypeName?: string;    // seulement en mode « évaluation »
  className: string;
  pvMode: 'evaluation' | 'trimestriel' | 'annuel';
  sortMode?: 'alphabetique' | 'merite';
  subjects: PVSubject[];
  students: PVStudentRow[];
  top3?: PVStudentRow[];
  bottom3?: PVStudentRow[];
  scopeLang?: 'FR' | 'EN' | null;
}

export interface StatsPdfData {
  branding: SchoolBranding;
  academicYearName: string;
  periodName: string;
  className: string;
  statMode: 'evaluation' | 'trimestriel' | 'annuel';
  mainTab: 'notes' | 'moyennes';
  subTab: 'taux-reussite' | 'intervalle' | 'meilleurs';
  subjects: PVSubject[];
  // Tableau taux de réussite (1 ligne par matière en mode notes, 1 ligne globale en moyennes)
  successRateRows: Array<{
    subjectName: string;
    present: { boys: number; girls: number; total: number };
    admitted: { boys: number; girls: number; total: number };
    passRate: { boys: number; girls: number; total: number };
    failRate: { boys: number; girls: number; total: number };
  }>;
  // Tableau intervalle des notes / moyennes
  intervalRows: Array<{
    subjectName: string;
    effectif: number;
    intervals: Array<{ label: string; count: number }>;
  }>;
  // Tableau meilleures notes / moyennes
  bestRows: Array<{
    matricule: string;
    name: string;
    className: string;
    score: number;
    appreciation: string;
  }>;
  topN: number;
  scopeLang?: 'FR' | 'EN' | null;
}

export interface PromotionStudent {
  id: string;
  matricule: string;
  name: string;
  gender?: string;
  generalAverage: number | null;
  decision: 'PASSE' | 'REDOUBLE' | 'RACHAT';
  rachatApplied?: boolean;
}

export interface PromotionPdfData {
  branding: SchoolBranding;
  academicYearName: string;
  className: string;
  passants: PromotionStudent[];
  redoublants: PromotionStudent[];
  rachatCandidates: PromotionStudent[];
  scopeLang?: 'FR' | 'EN' | null;
}

// ─── Abbréviation des matières (mirroir du frontend) ───────────────────────
interface AbbrRule { pattern: string; abbr: string; exactOnly?: boolean; }
const ABBR_RULES: AbbrRule[] = [
  { pattern: 'communication ecrite', abbr: 'Com.écr.' },
  { pattern: 'communication ecrit', abbr: 'Com.écr.' },
  { pattern: 'physique chimie et technologie', abbr: 'PCT' },
  { pattern: 'physique-chimie', abbr: 'PCT' },
  { pattern: 'physique chimie', abbr: 'PCT' },
  { pattern: 'science de la vie et de la terre', abbr: 'SVT' },
  { pattern: 'sciences de la vie et de la terre', abbr: 'SVT' },
  { pattern: 'histoire-geographie', abbr: 'HG' },
  { pattern: 'histoire geographie', abbr: 'HG' },
  { pattern: 'histoire et geographie', abbr: 'HG' },
  { pattern: 'education physique et sportive', abbr: 'EPS' },
  { pattern: 'education physique', abbr: 'EPS' },
  { pattern: 'mathematiques', abbr: 'MATH' },
  { pattern: 'mathematique', abbr: 'MATH' },
  { pattern: 'francais', abbr: 'FR' },
  { pattern: 'philosophie', abbr: 'PHILO' },
  { pattern: 'informatique', abbr: 'INFO' },
  { pattern: 'anglais', abbr: 'ANG' },
  { pattern: 'espagnol', abbr: 'ESP' },
  { pattern: 'allemand', abbr: 'ALL' },
  { pattern: 'lecture', abbr: 'LECT' },
  { pattern: 'dictee', abbr: 'DICT' },
  { pattern: 'expression ecrite', abbr: 'E.écr.' },
  { pattern: 'expression orale', abbr: 'E.or.' },
  { pattern: 'education scientifique et technologique', abbr: 'EST' },
  { pattern: 'education scientifique', abbr: 'EST' },
  { pattern: 'eveil scientifique et technologique', abbr: 'EST' },
  { pattern: 'eveil scientifique', abbr: 'EST' },
  { pattern: 'education sociale', abbr: 'ES' },
  { pattern: 'education artistique vivant', abbr: 'EAV' },
  { pattern: 'education artistique plastique', abbr: 'EAP' },
  { pattern: 'education artistique', abbr: 'EA' },
  { pattern: 'conduite', abbr: 'COND' },
  { pattern: 'education pour la sante', abbr: 'ES' },
  { pattern: 'education a des reflexions de sante', abbr: 'ERS' },
  { pattern: 'education du mouvement', abbr: 'EM' },
  { pattern: 'gestuelle', abbr: 'GEST' },
  { pattern: 'rythmique', abbr: 'RYTH' },
  { pattern: 'observation', abbr: 'OBS' },
  { pattern: 'education sensorielle', abbr: 'ESENS' },
  { pattern: 'pre-lecture', abbr: 'PLEC' },
  { pattern: 'pre-ecriture', abbr: 'PECR' },
  { pattern: 'pre-mathematique', abbr: 'PMAT' },
  { pattern: 'expression plastique', abbr: 'EP' },
  { pattern: 'expression emotionnelle', abbr: 'EE' },
  { pattern: 'expression corporelle', abbr: 'ECORP' },
  { pattern: 'langage', abbr: 'LANG' },
  { pattern: 'conte', abbr: 'CONT', exactOnly: true },
  { pattern: 'comptine', abbr: 'COMP', exactOnly: true },
  { pattern: 'poesie', abbr: 'POES' },
  { pattern: 'chant', abbr: 'CHAN', exactOnly: true },
  { pattern: 'english language', abbr: 'ENG' },
  { pattern: 'basic science', abbr: 'BS' },
  { pattern: 'social studies', abbr: 'SST' },
  { pattern: 'agricultural science', abbr: 'AGR' },
  { pattern: 'computer science', abbr: 'CS' },
  { pattern: 'civic education', abbr: 'CIV' },
  { pattern: 'verbal reasoning', abbr: 'VR' },
  { pattern: 'quantitative reasoning', abbr: 'QR' },
  { pattern: 'cultural and creative arts', abbr: 'CCA' },
  { pattern: 'christian religious knowledge', abbr: 'CRK' },
  { pattern: 'handwriting', abbr: 'HW' },
  { pattern: 'drawing', abbr: 'DRW', exactOnly: true },
  { pattern: 'physical and health education', abbr: 'PHE' },
  { pattern: 'mathematics', abbr: 'MATH' },
  { pattern: 'physical education', abbr: 'PE' },
];

function normalizeName(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function fallbackAbbr(name: string): string {
  const n = (name || '').trim();
  if (!n) return '?';
  const parenMatch = n.match(/\(([A-Z]{2,4})\)/);
  if (parenMatch) return parenMatch[1];
  const initials = n.split(/[\s\-_,]+/).filter(w => w.length > 0).map(w => w[0]).join('').toUpperCase().slice(0, 6);
  if (initials.length >= 2) return initials;
  return n.slice(0, 6);
}

function extractCodePrefix(code: string): string | null {
  if (!code) return null;
  const trimmed = String(code).trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^([A-Z]{2,6})[\-_]?/);
  if (match && match[1].length >= 2 && match[1].length <= 6) return match[1];
  if (/^[A-Z]{2,6}$/.test(trimmed)) return trimmed;
  return null;
}

function getSubjectAbbreviation(subject: PVSubject): string {
  if (subject?.abbreviation && String(subject.abbreviation).trim()) {
    return String(subject.abbreviation).trim();
  }
  const codePrefix = extractCodePrefix(subject?.code || '');
  if (codePrefix) return codePrefix;
  const n = normalizeName(subject?.name || '');
  if (n) {
    for (const rule of ABBR_RULES) {
      const p = normalizeName(rule.pattern);
      if (!p) continue;
      if (rule.exactOnly) {
        if (n === p) return rule.abbr;
      } else {
        if (n.includes(p)) return rule.abbr;
      }
    }
  }
  return fallbackAbbr(subject?.name || '');
}

function getSubjectAbbreviations(subjects: PVSubject[]): string[] {
  const used = new Map<string, number>();
  return subjects.map(s => {
    let abbr = getSubjectAbbreviation(s);
    if (used.has(abbr)) {
      const count = (used.get(abbr) || 1) + 1;
      used.set(abbr, count);
      abbr = `${abbr}-${count}`;
    } else {
      used.set(abbr, 1);
    }
    return abbr;
  });
}

// ─── Drapeau du Bénin (SVG → base64 data URL) ───────────────────────────────
const BENIN_FLAG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="40" viewBox="0 0 75 50"><rect width="30" height="50" fill="#008751"/><rect x="30" width="45" height="25" fill="#FCD116"/><rect x="30" y="25" width="45" height="25" fill="#E8112D"/></svg>`;
const BENIN_FLAG = `data:image/svg+xml;base64,${Buffer.from(BENIN_FLAG_SVG).toString('base64')}`;

// ─── Service ─────────────────────────────────────────────────────────────────
@Injectable()
export class PvStatsPromotionPdfService {
  private readonly logger = new Logger(PvStatsPromotionPdfService.name);

  constructor(private readonly puppeteerPool: PuppeteerPoolService) {}

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  async generateProcVerbalPdf(data: ProcVerbalPdfData): Promise<Buffer> {
    try {
      const html = this.buildProcVerbalHtml(data);
      return await this.renderPdf(html, true);
    } catch (error) {
      this.logger.error('Error generating PV PDF:', error);
      throw new InternalServerErrorException('Erreur lors de la génération du PV PDF');
    }
  }

  async generateStatsPdf(data: StatsPdfData): Promise<Buffer> {
    try {
      const html = this.buildStatsHtml(data);
      return await this.renderPdf(html, true);
    } catch (error) {
      this.logger.error('Error generating Stats PDF:', error);
      throw new InternalServerErrorException('Erreur lors de la génération du PDF statistiques');
    }
  }

  async generatePromotionPdf(data: PromotionPdfData): Promise<Buffer> {
    try {
      const html = this.buildPromotionHtml(data);
      return await this.renderPdf(html, true);
    } catch (error) {
      this.logger.error('Error generating Promotion PDF:', error);
      throw new InternalServerErrorException('Erreur lors de la génération du PDF promotion');
    }
  }

  // ==========================================================================
  // PDF RENDU (Puppeteer — A4 paysage)
  // ==========================================================================

  private async renderPdf(html: string, landscape: boolean): Promise<Buffer> {
    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await new Promise(resolve => setTimeout(resolve, 150));
      const pdfBuffer = await page.pdf({
        format: 'A4',
        landscape,
        printBackground: true,
        margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' },
        timeout: 60000,
        preferCSSPageSize: false,
      });
      return Buffer.from(pdfBuffer);
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }

  // ==========================================================================
  // EN-TÊTE + PIED DE PAGE (communs à tous les PDF)
  // ==========================================================================

  private buildHeader(data: { branding: SchoolBranding; isSecondary?: boolean; scopeLang?: 'FR' | 'EN' | null }): string {
    const isEn = data.scopeLang === 'EN';
    const ministry = data.isSecondary
      ? (isEn
        ? 'Ministry of Secondary, Technical and Vocational Education and Youth Insertion'
        : "Ministère des Enseignements Secondaire, de la Formation Technique et Professionnelle, de la Reconversion et de l'Insertion des Jeunes")
      : (isEn
        ? 'Ministry of Pre-Primary and Primary Education'
        : 'Ministère des Enseignements Maternel et Primaire');
    const republique = isEn ? 'Republic of Benin' : 'République du Bénin';
    const b = data.branding;
    const sloganPart = b.schoolSlogan ? (isEn ? `&laquo; ${b.schoolSlogan} &raquo; · ` : `« ${b.schoolSlogan} » · `) : '';
    const telLabel = isEn ? 'Tel' : 'Tél';
    return `
<div class="header">
  <table class="header-table">
    <tr>
      <td class="header-left"><img src="${BENIN_FLAG}" alt="${isEn ? 'Flag of Benin' : 'Drapeau du Bénin'}" style="width:30px;height:20px;" /></td>
      <td class="header-center">
        <div class="republique">${republique}</div>
        <div class="divider"><div class="divider-line"></div></div>
        <div class="ministere">${ministry}</div>
        <div class="divider"><div class="divider-line"></div></div>
        <div class="school-name">${b.schoolName}</div>
        <div class="school-info">${sloganPart}${b.schoolAddress || ''} · ${telLabel}: ${b.schoolPhone || ''} · ${b.schoolEmail || ''}</div>
      </td>
      <td class="header-right">${b.schoolLogo ? `<img src="${b.schoolLogo}" style="max-width:35px;max-height:35px;object-fit:contain;" />` : ''}</td>
    </tr>
  </table>
</div>`;
  }

  private buildFooter(data: { branding: SchoolBranding; scopeLang?: 'FR' | 'EN' | null }): string {
    const isEn = data.scopeLang === 'EN';
    // ⭐ T30 — numéro officiel Academia Helm en dur : le schoolPhone de
    //    l'établissement surchargeait un numéro obsolète dans ce footer.
    return `<div class="footer">${isEn ? 'Generated by Academia Helm' : 'Document généré par Academia Helm'} · ${isEn ? 'Tel' : 'Tél'}: +229 0141360803</div>`;
  }

  private buildWatermark(data: { branding: SchoolBranding }): string {
    return data.branding.schoolLogo
      ? `<img src="${data.branding.schoolLogo}" class="watermark" style="width:400px;height:400px;object-fit:contain;" alt="" />`
      : '';
  }

  private getCommonCss(): string {
    return `
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Times New Roman',Georgia,serif; color:#1a1a1a; font-size:9px; position:relative; min-height:100vh; display:flex; flex-direction:column; }
.watermark { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); opacity:0.08; z-index:0; pointer-events:none; }
.content { position:relative; z-index:1; flex:1; }
.header { margin-bottom:10px; padding-bottom:6px; border-bottom:2px solid #0A2A5E; }
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
.doc-title { text-align:center; background:#0A2A5E; color:white; padding:6px 12px; border-radius:3px; margin-bottom:10px; font-size:12px; font-weight:bold; text-transform:uppercase; }
.doc-meta { display:flex; justify-content:space-between; margin-bottom:8px; font-size:9px; color:#333; }
.doc-meta strong { color:#0A2A5E; }
table.data { width:100%; border-collapse:collapse; margin-bottom:8px; }
table.data th { background:#0A2A5E; color:white; border:1px solid #0D3B85; padding:5px 4px; font-size:8px; text-transform:uppercase; }
table.data td { border:1px solid #cbd5e1; padding:4px 4px; font-size:8px; }
table.data tbody tr:nth-child(even) { background:#f8fafc; }
table.data tbody tr.red-row td { background:#fef2f2; }
table.data tbody tr.green-row td { background:#ecfdf5; }
table.data tbody tr.amber-row td { background:#fffbeb; }
.score-pass { color:#065f46; font-weight:bold; }
.score-fail { color:#dc2626; font-weight:bold; }
.score-none { color:#94a3b8; font-style:italic; }
.section-title { background:#0A2A5E; color:white; padding:4px 8px; font-size:10px; font-weight:bold; margin-top:8px; margin-bottom:4px; border-radius:2px; }
.two-cols { display:flex; gap:8px; margin-bottom:8px; }
.two-cols > div { flex:1; }
.footer { margin-top:auto; padding-top:6px; text-align:center; font-size:7px; color:#999; border-top:1px solid #eee; }
.badge-pass { background:#dcfce7; color:#166534; padding:1px 6px; border-radius:8px; font-size:7px; font-weight:bold; }
.badge-fail { background:#fee2e2; color:#991b1b; padding:1px 6px; border-radius:8px; font-size:7px; font-weight:bold; }
.badge-rachat { background:#fef3c7; color:#92400e; padding:1px 6px; border-radius:8px; font-size:7px; font-weight:bold; }
.subject-abbr { font-weight:bold; }
.subject-coef { font-size:7px; color:#cbd5e1; font-weight:normal; }
.bar-chart { display:flex; align-items:flex-end; gap:3px; height:140px; border-bottom:1px solid #cbd5e1; padding-bottom:2px; margin-top:8px; }
.bar-chart .bar { flex:1; display:flex; flex-direction:column; align-items:center; gap:2px; }
.bar-chart .bar-count { font-size:7px; font-weight:bold; color:#334155; }
.bar-chart .bar-rect { width:100%; background:#3b82f6; border-radius:2px 2px 0 0; min-height:2px; }
.bar-chart .bar-label { font-size:6px; color:#64748b; text-align:center; max-width:60px; overflow:hidden; text-overflow:ellipsis; }
.empty-state { text-align:center; padding:20px; color:#94a3b8; font-style:italic; }
`;
  }

  // ==========================================================================
  // PROCÈS-VERBAL HTML
  // ==========================================================================

  private buildProcVerbalHtml(data: ProcVerbalPdfData): string {
    const abbrs = getSubjectAbbreviations(data.subjects);
    const isEn = data.scopeLang === 'EN';

    // Tableau principal
    const sortedStudents = data.sortMode === 'alphabetique'
      ? [...data.students].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      : [...data.students].sort((a, b) => a.rang - b.rang);

    const subjectHeaders = data.subjects.map((subj, i) => {
      const abbr = abbrs[i];
      const coef = subj.coefficient ?? 1;
      // ⭐ 2026-10-06 — EN track has no coefficient column
      return isEn
        ? `<th class="subject-abbr">${abbr}</th>`
        : `<th class="subject-abbr">${abbr}<div class="subject-coef">Coef ${coef}</div></th>`;
    }).join('');

    const subjectCells = (st: PVStudentRow) => data.subjects.map((subj, i) => {
      const score = st.subjectScores[subj.id];
      if (typeof score === 'number' && !isNaN(score)) {
        const cls = score >= (isEn ? 50 : 10) ? 'score-pass' : 'score-fail';
        return `<td class="${cls}">${score.toFixed(2)}</td>`;
      }
      return `<td class="score-none">—</td>`;
    }).join('');

    const rowsHtml = sortedStudents.map((st, idx) => {
      const zebra = idx % 2 === 1 ? ' style="background:#f8fafc;"' : '';
      const moyennePass = isEn ? 50 : 10;
      const moyenneCls = st.moyenne !== null && st.moyenne >= moyennePass ? 'score-pass' : 'score-fail';
      const moyenneVal = st.moyenne !== null ? st.moyenne.toFixed(2) : '—';
      return `<tr${zebra}>
        <td>${st.matricule || '—'}</td>
        <td style="font-weight:500;">${st.name}</td>
        ${subjectCells(st)}
        <td style="font-weight:bold;">${st.total.toFixed(2)}</td>
        ${isEn ? '' : `<td style="font-weight:bold;color:#92400e;">${st.totalCoef}</td>`}
        <td class="${moyenneCls}" style="font-weight:bold;">${moyenneVal}</td>
        <td style="font-weight:bold;">${st.rang}</td>
      </tr>`;
    }).join('');

    // Tableaux 3 premiers + 3 derniers
    const top3 = data.top3 || [...data.students].sort((a, b) => a.rang - b.rang).slice(0, 3);
    const bottom3 = data.bottom3 || [...data.students].sort((a, b) => b.rang - a.rang).slice(0, 3);

    const buildMiniTable = (title: string, students: PVStudentRow[], color: string) => {
      const rows = students.map(st => `<tr>
        <td>${st.matricule || '—'}</td>
        <td style="font-weight:500;">${st.name}</td>
        <td style="text-align:center;font-weight:bold;">${st.moyenne !== null ? st.moyenne.toFixed(2) : '—'}</td>
        <td style="text-align:center;font-weight:bold;">${st.rang}</td>
      </tr>`).join('');
      return `<div>
        <div style="background:${color};color:white;padding:4px 8px;font-size:9px;font-weight:bold;border-radius:2px 2px 0 0;">${title}</div>
        <table class="data">
          <thead><tr>
            <th>${isEn ? 'Matricule' : 'Matricule'}</th>
            <th>${isEn ? 'Name' : 'Nom'}</th>
            <th style="text-align:center;">${isEn ? 'Average' : 'Moyenne'}</th>
            <th style="text-align:center;">${isEn ? 'Rank' : 'Rang'}</th>
          </tr></thead>
          <tbody>${rows || `<tr><td colspan="4" class="empty-state">${isEn ? 'No data' : 'Aucune donnée'}</td></tr>`}</tbody>
        </table>
      </div>`;
    };

    const pvTitleLabel = data.pvMode === 'annuel'
      ? (isEn ? 'ANNUAL PROCEEDINGS' : 'PROCÈS-VERBAL ANNUEL')
      : data.pvMode === 'trimestriel'
        ? (isEn ? 'QUARTERLY PROCEEDINGS' : 'PROCÈS-VERBAL TRIMESTRIEL')
        : (isEn ? 'EVALUATION PROCEEDINGS' : 'PROCÈS-VERBAL D\'ÉVALUATION');

    const evalLabel = data.evalTypeName ? ` — ${data.evalTypeName}` : '';
    const studentsCount = data.students.length;

    return `<!DOCTYPE html>
<html lang="${isEn ? 'en' : 'fr'}">
<head><meta charset="UTF-8"><title>${pvTitleLabel} — ${data.className}</title>
<style>${this.getCommonCss()}</style>
</head>
<body>
${this.buildWatermark(data)}
<div class="content">
  ${this.buildHeader(data)}
  <div class="doc-title">${pvTitleLabel}${evalLabel}</div>
  <div class="doc-meta">
    <div><strong>${isEn ? 'Class' : 'Classe'} :</strong> ${data.className}</div>
    <div><strong>${isEn ? 'Period' : 'Période'} :</strong> ${data.periodName}</div>
    <div><strong>${isEn ? 'Year' : 'Année'} :</strong> ${data.academicYearName}</div>
    <div><strong>${isEn ? 'Students' : 'Élèves'} :</strong> ${studentsCount}</div>
  </div>

  <div class="section-title">${isEn ? 'Main proceedings table' : 'Tableau principal du procès-verbal'}</div>
  <table class="data">
    <thead>
      <tr>
        <th rowspan="2">${isEn ? 'Matricule' : 'Matricule'}</th>
        <th rowspan="2">${isEn ? 'Name' : 'Nom et prénoms'}</th>
        ${subjectHeaders}
        <th rowspan="2" style="text-align:center;">${isEn ? 'Total' : 'Total'}</th>
        ${isEn ? '' : '<th rowspan="2" style="text-align:center;">Coef</th>'}
        <th rowspan="2" style="text-align:center;">${isEn ? 'Average' : 'Moyenne'}</th>
        <th rowspan="2" style="text-align:center;">${isEn ? 'Rank' : 'Rang'}</th>
      </tr>
      <tr>
        ${data.subjects.map((_, i) => `<th style="font-size:7px;">${abbrs[i]}</th>`).join('')}
      </tr>
    </thead>
    <tbody>${rowsHtml || `<tr><td colspan="${data.subjects.length + (isEn ? 5 : 6)}" class="empty-state">${isEn ? 'No data' : 'Aucune donnée'}</td></tr>`}</tbody>
  </table>

  <div class="two-cols">
    ${buildMiniTable(isEn ? 'Top 3' : 'Trois premiers', top3, '#16a34a')}
    ${buildMiniTable(isEn ? 'Bottom 3' : 'Trois derniers', bottom3, '#dc2626')}
  </div>

  ${this.buildFooter(data)}
</div>
</body>
</html>`;
  }

  // ==========================================================================
  // STATISTIQUES HTML
  // ==========================================================================

  private buildStatsHtml(data: StatsPdfData): string {
    const isEn = data.scopeLang === 'EN';
    const mainLabel = data.mainTab === 'notes'
      ? (isEn ? 'GRADES STATISTICS' : 'STATISTIQUES DES NOTES')
      : (isEn ? 'AVERAGES STATISTICS' : 'STATISTIQUES DES MOYENNES');
    const subLabel = data.subTab === 'taux-reussite'
      ? (isEn ? 'Success rate' : 'Taux de réussite')
      : data.subTab === 'intervalle'
        ? (isEn ? 'Grades interval' : 'Intervalle des notes')
        : (isEn ? 'Top results' : 'Meilleures notes');

    let tableContent = '';

    if (data.subTab === 'taux-reussite') {
      const rows = data.successRateRows.map((row, idx) => {
        const zebra = idx % 2 === 1 ? ' style="background:#f8fafc;"' : '';
        return `<tr${zebra}>
          <td style="font-weight:500;">${row.subjectName}</td>
          <td style="text-align:center;">${row.present.boys}</td>
          <td style="text-align:center;">${row.present.girls}</td>
          <td style="text-align:center;font-weight:bold;">${row.present.total}</td>
          <td style="text-align:center;">${row.admitted.boys}</td>
          <td style="text-align:center;">${row.admitted.girls}</td>
          <td style="text-align:center;font-weight:bold;color:#065f46;">${row.admitted.total}</td>
          <td style="text-align:center;">${row.passRate.boys.toFixed(1)}%</td>
          <td style="text-align:center;">${row.passRate.girls.toFixed(1)}%</td>
          <td style="text-align:center;font-weight:bold;color:#065f46;">${row.passRate.total.toFixed(1)}%</td>
          <td style="text-align:center;">${row.failRate.boys.toFixed(1)}%</td>
          <td style="text-align:center;">${row.failRate.girls.toFixed(1)}%</td>
          <td style="text-align:center;font-weight:bold;color:#dc2626;">${row.failRate.total.toFixed(1)}%</td>
        </tr>`;
      }).join('');
      tableContent = `
        <table class="data">
          <thead>
            <tr>
              <th rowspan="2">${isEn ? 'Subject' : 'Matière'}</th>
              <th colspan="3" style="text-align:center;">${isEn ? 'Present' : 'Effectif présents'}</th>
              <th colspan="3" style="text-align:center;">${isEn ? 'Admitted' : 'Total admis'}</th>
              <th colspan="3" style="text-align:center;">% ${isEn ? 'Pass' : 'Réussite'}</th>
              <th colspan="3" style="text-align:center;">% ${isEn ? 'Fail' : 'Échec'}</th>
            </tr>
            <tr>
              <th style="text-align:center;">G</th><th style="text-align:center;">F</th><th style="text-align:center;">T</th>
              <th style="text-align:center;">G</th><th style="text-align:center;">F</th><th style="text-align:center;">T</th>
              <th style="text-align:center;">G</th><th style="text-align:center;">F</th><th style="text-align:center;">T</th>
              <th style="text-align:center;">G</th><th style="text-align:center;">F</th><th style="text-align:center;">T</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="13" class="empty-state">${isEn ? 'No data' : 'Aucune donnée'}</td></tr>`}</tbody>
        </table>

        <div class="section-title">${isEn ? 'Chart — Number of admitted per subject' : 'Graphique — Nombre d\'admis par matière'}</div>
        <div class="bar-chart">
          ${data.successRateRows.map(row => {
            const maxAdmitted = Math.max(...data.successRateRows.map(r => r.admitted.total), 1);
            const heightPct = (row.admitted.total / maxAdmitted) * 100;
            const shortLabel = row.subjectName.length > 8 ? row.subjectName.substring(0, 7) + '…' : row.subjectName;
            return `<div class="bar">
              <div class="bar-count">${row.admitted.total}</div>
              <div class="bar-rect" style="height:${heightPct}%;" title="${row.subjectName}: ${row.admitted.total} admis"></div>
              <div class="bar-label">${shortLabel}</div>
            </div>`;
          }).join('') || `<div class="empty-state">${isEn ? 'No data' : 'Aucune donnée'}</div>`}
        </div>`;
    } else if (data.subTab === 'intervalle') {
      const intervals = data.intervalRows[0]?.intervals.map(i => i.label) || [];
      const rows = data.intervalRows.map((row, idx) => {
        const zebra = idx % 2 === 1 ? ' style="background:#f8fafc;"' : '';
        return `<tr${zebra}>
          <td style="font-weight:500;">${row.subjectName}</td>
          <td style="text-align:center;font-weight:bold;">${row.effectif}</td>
          ${row.intervals.map(i => `<td style="text-align:center;">${i.count}</td>`).join('')}
        </tr>`;
      }).join('');
      tableContent = `
        <table class="data">
          <thead>
            <tr>
              <th>${isEn ? 'Subject' : 'Matière'}</th>
              <th style="text-align:center;">${isEn ? 'Count' : 'Effectif'}</th>
              ${intervals.map(label => `<th style="text-align:center;">${label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="${intervals.length + 2}" class="empty-state">${isEn ? 'No data' : 'Aucune donnée'}</td></tr>`}</tbody>
        </table>`;
    } else {
      // meilleurs
      const rows = data.bestRows.map((row, idx) => {
        const zebra = idx % 2 === 1 ? ' style="background:#f8fafc;"' : '';
        return `<tr${zebra}>
          <td>${row.matricule || '—'}</td>
          <td style="font-weight:500;">${row.name}</td>
          <td>${row.className}</td>
          <td style="text-align:center;font-weight:bold;color:#065f46;">${row.score.toFixed(2)}</td>
          <td style="text-align:center;">${row.appreciation}</td>
        </tr>`;
      }).join('');
      tableContent = `
        <div class="section-title">${isEn ? `Top ${data.topN} best ${data.mainTab === 'notes' ? 'grades' : 'averages'}` : `Top ${data.topN} meilleures ${data.mainTab === 'notes' ? 'notes' : 'moyennes'}`}</div>
        <table class="data">
          <thead><tr>
            <th>${isEn ? 'Matricule' : 'Matricule'}</th>
            <th>${isEn ? 'Name' : 'Nom'}</th>
            <th>${isEn ? 'Class' : 'Classe'}</th>
            <th style="text-align:center;">${data.mainTab === 'notes' ? (isEn ? 'Grade' : 'Note') : (isEn ? 'Average' : 'Moyenne')}</th>
            <th style="text-align:center;">${isEn ? 'Appreciation' : 'Appréciation'}</th>
          </tr></thead>
          <tbody>${rows || `<tr><td colspan="5" class="empty-state">${isEn ? 'No data' : 'Aucune donnée'}</td></tr>`}</tbody>
        </table>`;
    }

    const statModeLabel = data.statMode === 'annuel'
      ? (isEn ? 'Annual' : 'Annuel')
      : data.statMode === 'trimestriel'
        ? (isEn ? 'Quarterly' : 'Trimestriel')
        : (isEn ? 'Evaluation' : 'Évaluation');

    return `<!DOCTYPE html>
<html lang="${isEn ? 'en' : 'fr'}">
<head><meta charset="UTF-8"><title>${mainLabel} — ${data.className}</title>
<style>${this.getCommonCss()}</style>
</head>
<body>
${this.buildWatermark(data)}
<div class="content">
  ${this.buildHeader(data)}
  <div class="doc-title">${mainLabel}</div>
  <div class="doc-meta">
    <div><strong>${isEn ? 'Class' : 'Classe'} :</strong> ${data.className}</div>
    <div><strong>${isEn ? 'Period' : 'Période'} :</strong> ${data.periodName}</div>
    <div><strong>${isEn ? 'Data' : 'Données'} :</strong> ${statModeLabel}</div>
    <div><strong>${isEn ? 'Year' : 'Année'} :</strong> ${data.academicYearName}</div>
  </div>

  <div class="section-title">${subLabel}</div>
  ${tableContent}

  ${this.buildFooter(data)}
</div>
</body>
</html>`;
  }

  // ==========================================================================
  // PROMOTION & REDOUBLEMENT HTML
  // ==========================================================================

  private buildPromotionHtml(data: PromotionPdfData): string {
    const isEn = data.scopeLang === 'EN';

    const buildPassantRow = (st: PromotionStudent, idx: number) => {
      const zebra = idx % 2 === 1 ? ' style="background:#f8fafc;"' : '';
      const badge = st.rachatApplied
        ? `<span class="badge-rachat">${isEn ? 'Rescued' : 'Rachat'}</span>`
        : `<span class="badge-pass">${isEn ? 'Passing' : 'Passant'}</span>`;
      const moy = st.generalAverage !== null ? st.generalAverage.toFixed(2) : '—';
      return `<tr${zebra}>
        <td>${st.matricule || '—'}</td>
        <td style="font-weight:500;">${st.name}</td>
        <td style="text-align:center;font-weight:bold;color:#065f46;">${moy}</td>
        <td style="text-align:center;">${badge}</td>
      </tr>`;
    };

    const buildRedoublantRow = (st: PromotionStudent, idx: number) => {
      const zebra = idx % 2 === 1 ? ' style="background:#f8fafc;"' : '';
      const isNoNotes = st.generalAverage === null && st.decision === 'REDOUBLE';
      const badge = isNoNotes
        ? `<span class="badge-fail">${isEn ? 'No grades' : 'Pas de notes'}</span>`
        : st.decision === 'RACHAT'
          ? `<span class="badge-rachat">${isEn ? 'Rescue possible' : 'Rachat possible'}</span>`
          : `<span class="badge-fail">${isEn ? 'Repeating' : 'Redouble'}</span>`;
      const moy = st.generalAverage !== null ? st.generalAverage.toFixed(2) : '—';
      return `<tr${zebra}>
        <td>${st.matricule || '—'}</td>
        <td style="font-weight:500;">${st.name}</td>
        <td style="text-align:center;font-weight:bold;color:#dc2626;">${moy}</td>
        <td style="text-align:center;">${badge}</td>
      </tr>`;
    };

    const passantsRows = data.passants.map(buildPassantRow).join('');
    const redoublantsRows = data.redoublants.map(buildRedoublantRow).join('');
    const rachatRows = data.rachatCandidates.map(buildRedoublantRow).join('');

    const summaryRow = `
      <div class="two-cols">
        <div style="background:#dcfce7;border:1px solid #16a34a;border-radius:6px;padding:6px;text-align:center;">
          <div style="font-size:18px;font-weight:bold;color:#166534;">${data.passants.length}</div>
          <div style="font-size:8px;color:#16a34a;font-weight:bold;">${isEn ? 'PASSING' : 'PASSANTS'}</div>
        </div>
        <div style="background:#fee2e2;border:1px solid #dc2626;border-radius:6px;padding:6px;text-align:center;">
          <div style="font-size:18px;font-weight:bold;color:#991b1b;">${data.redoublants.length}</div>
          <div style="font-size:8px;color:#dc2626;font-weight:bold;">${isEn ? 'REPEATING' : 'REDOUBLANTS'}</div>
        </div>
      </div>
    `;

    return `<!DOCTYPE html>
<html lang="${isEn ? 'en' : 'fr'}">
<head><meta charset="UTF-8"><title>${isEn ? 'Promotion & Repeating' : 'Promotion & Redoublement'} — ${data.className}</title>
<style>${this.getCommonCss()}</style>
</head>
<body>
${this.buildWatermark(data)}
<div class="content">
  ${this.buildHeader(data)}
  <div class="doc-title">${isEn ? 'PROMOTION & REPEATING' : 'PROMOTION & REDOUBLEMENT'}</div>
  <div class="doc-meta">
    <div><strong>${isEn ? 'Class' : 'Classe'} :</strong> ${data.className}</div>
    <div><strong>${isEn ? 'Year' : 'Année'} :</strong> ${data.academicYearName}</div>
  </div>

  ${summaryRow}

  <div class="two-cols">
    <div>
      <div class="section-title">${isEn ? 'Passing students' : 'Passants'} — ${data.className}</div>
      <table class="data">
        <thead><tr>
          <th>${isEn ? 'Matricule' : 'Matricule'}</th>
          <th>${isEn ? 'Name' : 'Nom'}</th>
          <th style="text-align:center;">${isEn ? 'Annual avg.' : 'Moy. annuelle'}</th>
          <th style="text-align:center;">${isEn ? 'Decision' : 'Décision'}</th>
        </tr></thead>
        <tbody>${passantsRows || `<tr><td colspan="4" class="empty-state">${isEn ? 'No passing student' : 'Aucun passant'}</td></tr>`}</tbody>
      </table>
    </div>

    <div>
      <div class="section-title">${isEn ? 'Repeating students' : 'Redoublants'} — ${data.className}</div>
      <table class="data">
        <thead><tr>
          <th>${isEn ? 'Matricule' : 'Matricule'}</th>
          <th>${isEn ? 'Name' : 'Nom'}</th>
          <th style="text-align:center;">${isEn ? 'Annual avg.' : 'Moy. annuelle'}</th>
          <th style="text-align:center;">${isEn ? 'Decision' : 'Décision'}</th>
        </tr></thead>
        <tbody>${redoublantsRows || rachatRows || `<tr><td colspan="4" class="empty-state">${isEn ? 'No repeating student' : 'Aucun redoublant'}</td></tr>`}</tbody>
      </table>
    </div>
  </div>

  ${this.buildFooter(data)}
</div>
</body>
</html>`;
  }
}

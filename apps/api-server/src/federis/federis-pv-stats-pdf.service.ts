/**
 * FederisPvStatsPdfService — Procès-verbal & Statistiques PDF (Academia Frederis)
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ T46 (2026-10-01) — Reproduction DE A À Z du module Examen d'Academia Helm
 * (ProcVerbalWorkspace + StatsWorkspace + PvStatsPromotionPdfService) pour les
 * examens nationaux Federis (CEP / BEPC / Baccalauréat / CAP) :
 *
 *   • Procès-verbal d'examen — A4 PAYSAGE, en-tête officiel, grand tableau
 *     Matricule | Nom et prénoms | [Matières dynamiques : abréviation +
 *     coefficient] | Total | Coef | Moyenne | Rang + les 2 mini-tableaux
 *     « Trois premiers » / « Trois derniers » ;
 *   • Statistiques — A4 PAYSAGE, 3 tableaux selon le sous-onglet :
 *     taux de réussite (Effectif présents / Total admis / % Réussite /
 *     % Échec — G/F/T) + graphique en barres des admis par matière,
 *     intervalle des notes / moyennes (0-3 … 16-20), meilleures notes /
 *     moyennes (Top N avec appréciation).
 *
 * ADAPTATION FEDERIS (seule différence avec Helm — « les vraies données ») :
 *   - le périmètre est l'EXAMEN NATIONAL (et non une classe d'école) : la
 *     session est unique (pas de modes évaluation / trimestriel / annuel) ;
 *   - le branding de l'en-tête est le PATRONAT ORGANISATEUR (legalName,
 *     territoire, logo) — République du Bénin + drapeau, comme la charte
 *     Helm (l'école → le patronat) ;
 *   - les données (notes, moyennes, rangs) viennent du dataset officiel du
 *     registre (module Notes et Moyennes — règles de calcul effectives) ;
 *   - la colonne « Classe » du tableau des meilleures notes devient
 *     « École » (école de provenance du candidat).
 *
 * Pattern Helm : le FRONT calcule les tableaux (il a déjà chargé le registre)
 * et POSTe le payload ; le BACKEND vérifie l'appartenance de l'examen au
 * patronat, résout le branding et rend le PDF (PuppeteerPoolService).
 *
 * Endpoints (FederisPvStatsController) :
 *   POST /federis/exams/:examId/reports/proces-verbal
 *   POST /federis/exams/:examId/reports/statistiques
 */

import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PuppeteerPoolService } from '../common/services/puppeteer-pool.service';
import { FederisPatronatService } from './federis-patronat.service';
import { examSessionLabel, officialExamTitle } from './federis-grades.service';

// ─── Types (payloads envoyés par le front — miroir du Helm) ─────────────────

export interface PvSubjectPayload {
  id: string;
  name: string;
  code?: string | null;
  abbreviation?: string | null;
  coefficient?: number;
}

export interface PvStudentPayload {
  id: string;
  matricule: string;
  name: string;
  gender?: string | null;
  subjectScores: Record<string, number | null>;
  /** ⭐ T46 — Matières où le candidat était ABSENT (affichées « ABS » dans le
   *  PV — donnée réelle du registre Federis, absente du Helm). */
  absents?: string[];
  total: number;
  totalCoef: number;
  moyenne: number | null;
  rang: number;
}

/** ⭐ T46 — PV d'examen (payload front → backend). */
export interface ProcVerbalPayload {
  sortMode?: 'alphabetique' | 'merite';
  subjects: PvSubjectPayload[];
  students: PvStudentPayload[];
  top3?: PvStudentPayload[];
  bottom3?: PvStudentPayload[];
}

export interface StatsSuccessRow {
  subjectName: string;
  present: { boys: number; girls: number; total: number };
  admitted: { boys: number; girls: number; total: number };
  passRate: { boys: number; girls: number; total: number };
  failRate: { boys: number; girls: number; total: number };
}

export interface StatsIntervalRow {
  subjectName: string;
  effectif: number;
  intervals: Array<{ label: string; count: number }>;
}

export interface StatsBestRow {
  matricule: string;
  name: string;
  /** École de provenance du candidat (équivalent Federis de « Classe » Helm). */
  school: string;
  score: number;
  appreciation: string;
}

/** ⭐ T46 — Statistiques d'examen (payload front → backend). */
export interface StatsPayload {
  mainTab: 'notes' | 'moyennes';
  subTab: 'taux-reussite' | 'intervalle' | 'meilleurs';
  subjects: PvSubjectPayload[];
  successRateRows: StatsSuccessRow[];
  intervalRows: StatsIntervalRow[];
  bestRows: StatsBestRow[];
  topN: number;
}

// ─── Abréviations des matières (copie exacte du Helm) ───────────────────────
interface AbbrRule {
  pattern: string;
  abbr: string;
  exactOnly?: boolean;
}
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
  const initials = n
    .split(/[\s\-_,]+/)
    .filter((w) => w.length > 0)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 6);
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

function getSubjectAbbreviation(subject: PvSubjectPayload): string {
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

function getSubjectAbbreviations(subjects: PvSubjectPayload[]): string[] {
  const used = new Map<string, number>();
  return subjects.map((s) => {
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

// ─── Drapeau du Bénin (SVG → base64 — même charte que le Helm) ──────────────
const BENIN_FLAG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="40" viewBox="0 0 75 50"><rect width="30" height="50" fill="#008751"/><rect x="30" width="45" height="25" fill="#FCD116"/><rect x="30" y="25" width="45" height="25" fill="#E8112D"/></svg>`;
const BENIN_FLAG = `data:image/svg+xml;base64,${Buffer.from(BENIN_FLAG_SVG).toString('base64')}`;

/** Échappement HTML de toute valeur dynamique injectée dans les templates. */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Contexte officiel d'un examen (patronat + examen possédé) ──────────────
interface PvExamContext {
  patronatTenantId: string;
  patronat: {
    name: string;
    legalName: string | null;
    abbreviation: string | null;
    territoryName: string | null;
    countryName: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    logo: string | null;
  };
  exam: {
    id: string;
    code: string;
    name: string;
    examType: string;
    session: string;
    academicYearLabel: string;
  };
}

// ─── Service ─────────────────────────────────────────────────────────────────
@Injectable()
export class FederisPvStatsPdfService {
  private readonly logger = new Logger(FederisPvStatsPdfService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly puppeteerPool: PuppeteerPoolService,
    private readonly patronatService: FederisPatronatService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════

  /** Procès-verbal d'examen — A4 paysage (tableau principal + 3 premiers /
   *  3 derniers). Reproduction exacte du PV Helm, adaptée à l'examen. */
  async generateProcVerbalPdf(
    tenantId: string,
    userId: string,
    examId: string,
    payload: ProcVerbalPayload,
  ): Promise<{ buffer: Buffer; filename: string }> {
    try {
      const ctx = await this.resolveExamContext(tenantId, userId, examId);
      const html = this.buildProcVerbalHtml(ctx, payload);
      const buffer = await this.renderPdf(html);
      const filename = `PV_${ctx.exam.code}_${new Date().toISOString().split('T')[0]}.pdf`;
      await this.audit(userId, ctx, 'FEDERIS_PV_PDF', {
        candidates: payload.students?.length ?? 0,
        subjects: payload.subjects?.length ?? 0,
      });
      return { buffer, filename };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error('Error generating Federis PV PDF:', error);
      throw new InternalServerErrorException('Erreur lors de la génération du procès-verbal PDF');
    }
  }

  /** Statistiques d'examen — A4 paysage (taux de réussite + graphique,
   *  intervalle ou meilleures notes / moyennes selon le sous-onglet). */
  async generateStatsPdf(
    tenantId: string,
    userId: string,
    examId: string,
    payload: StatsPayload,
  ): Promise<{ buffer: Buffer; filename: string }> {
    try {
      const ctx = await this.resolveExamContext(tenantId, userId, examId);
      const html = this.buildStatsHtml(ctx, payload);
      const buffer = await this.renderPdf(html);
      const filename = `Stats_${payload.subTab}_${ctx.exam.code}_${new Date().toISOString().split('T')[0]}.pdf`;
      await this.audit(userId, ctx, 'FEDERIS_STATS_PDF', {
        subTab: payload.subTab,
        mainTab: payload.mainTab,
        topN: payload.topN,
      });
      return { buffer, filename };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error('Error generating Federis Stats PDF:', error);
      throw new InternalServerErrorException('Erreur lors de la génération du PDF statistiques');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CONTEXTE (patronat organisateur + examen scopé au tenant — pattern Federis)
  // ═══════════════════════════════════════════════════════════════════════

  private async resolveExamContext(
    tenantId: string,
    userId: string,
    examId: string,
  ): Promise<PvExamContext> {
    const patronat = await this.patronatService.resolvePatronat(tenantId, userId);

    // Logo (data URL ou https — pattern T31 du portail public)
    let logo: string | null = null;
    try {
      const withLogo = await this.prisma.patronat.findUnique({
        where: { id: patronat.id },
        select: { logo: true },
      });
      logo = withLogo?.logo ?? null;
    } catch {
      logo = null;
    }

    const exam = await this.prisma.nationalExam.findFirst({
      where: { id: examId, tenantId: patronat.tenantId },
      include: { academicYear: true },
    });
    if (!exam) {
      throw new NotFoundException('Examen introuvable pour ce patronat.');
    }

    const academicYearLabel =
      (exam as any).academicYear?.label ?? (exam as any).academicYear?.name ?? null;

    return {
      patronatTenantId: patronat.tenantId,
      patronat: {
        name: patronat.name,
        legalName: patronat.legalName ?? null,
        abbreviation: patronat.abbreviation ?? null,
        territoryName: patronat.territoryName ?? null,
        countryName: (patronat as any).country?.name ?? null,
        address: patronat.address ?? null,
        phone: patronat.primaryPhone ?? null,
        email: patronat.primaryEmail ?? null,
        logo,
      },
      exam: {
        id: exam.id,
        code: exam.code,
        name: exam.name,
        examType: exam.examType,
        session: examSessionLabel(exam, academicYearLabel),
        academicYearLabel: academicYearLabel ?? '',
      },
    };
  }

  private async audit(
    userId: string,
    ctx: PvExamContext,
    action: string,
    newData: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.auditLog
      .create({
        data: {
          tenantId: ctx.patronatTenantId,
          userId,
          action,
          resource: 'NationalExam',
          resourceId: ctx.exam.id,
          tableName: 'national_exams',
          recordId: ctx.exam.id,
          newData: { examCode: ctx.exam.code, ...newData },
        },
      })
      .catch(() => undefined);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PDF RENDU (Puppeteer — A4 paysage, mêmes marges que le Helm)
  // ═══════════════════════════════════════════════════════════════════════

  private async renderPdf(html: string): Promise<Buffer> {
    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await new Promise((resolve) => setTimeout(resolve, 150));
      const pdfBuffer = await page.pdf({
        format: 'A4',
        landscape: true,
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

  // ═══════════════════════════════════════════════════════════════════════
  // EN-TÊTE + PIED DE PAGE (charte Helm — adaptée au patronat organisateur)
  // ═══════════════════════════════════════════════════════════════════════

  private buildHeader(ctx: PvExamContext): string {
    const b = ctx.patronat;
    const organisateur = b.legalName || b.name;
    const infoParts = [
      [b.territoryName, b.countryName].filter(Boolean).join(' — '),
      b.address || null,
      b.phone ? `Tél : ${b.phone}` : null,
      b.email || null,
    ].filter(Boolean);
    return `
<div class="header">
  <table class="header-table">
    <tr>
      <td class="header-left"><img src="${BENIN_FLAG}" alt="Drapeau du Bénin" style="width:30px;height:20px;" /></td>
      <td class="header-center">
        <div class="republique">République du Bénin</div>
        <div class="divider"><div class="divider-line"></div></div>
        <div class="ministere">${esc(organisateur)}</div>
        <div class="divider"><div class="divider-line"></div></div>
        <div class="school-name">${esc(officialExamTitle(ctx.exam.examType).main)}</div>
        <div class="school-info">${esc(infoParts.join(' · '))}</div>
      </td>
      <td class="header-right">${b.logo ? `<img src="${b.logo}" style="max-width:35px;max-height:35px;object-fit:contain;" />` : ''}</td>
    </tr>
  </table>
</div>`;
  }

  private buildFooter(ctx: PvExamContext): string {
    return `<div class="footer">Document officiel généré par Academia Frederis — ${esc(ctx.patronat.name)}.</div>`;
  }

  private getCommonCss(): string {
    return `
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Times New Roman',Georgia,serif; color:#1a1a1a; font-size:9px; position:relative; min-height:100vh; display:flex; flex-direction:column; }
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
.score-pass { color:#065f46; font-weight:bold; }
.score-fail { color:#dc2626; font-weight:bold; }
.score-none { color:#94a3b8; font-style:italic; }
.score-absent { color:#b45309; font-weight:bold; font-size:7px; }
.section-title { background:#0A2A5E; color:white; padding:4px 8px; font-size:10px; font-weight:bold; margin-top:8px; margin-bottom:4px; border-radius:2px; }
.two-cols { display:flex; gap:8px; margin-bottom:8px; }
.two-cols > div { flex:1; }
.footer { margin-top:auto; padding-top:6px; text-align:center; font-size:7px; color:#999; border-top:1px solid #eee; }
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

  // ═══════════════════════════════════════════════════════════════════════
  // PROCÈS-VERBAL HTML (reproduction exacte du Helm — périmètre examen)
  // ═══════════════════════════════════════════════════════════════════════

  private buildProcVerbalHtml(ctx: PvExamContext, data: ProcVerbalPayload): string {
    const subjects = Array.isArray(data.subjects) ? data.subjects : [];
    const students = Array.isArray(data.students) ? data.students : [];
    const abbrs = getSubjectAbbreviations(subjects);

    // Tableau principal (ordre de mérite par défaut — comme le Helm)
    const sortedStudents =
      data.sortMode === 'alphabetique'
        ? [...students].sort((a, b) => String(a.name).localeCompare(String(b.name), 'fr'))
        : [...students].sort((a, b) => (a.rang ?? 0) - (b.rang ?? 0));

    const subjectHeaders = subjects
      .map((subj, i) => {
        const abbr = abbrs[i];
        const coef = subj.coefficient ?? 1;
        return `<th class="subject-abbr">${esc(abbr)}<div class="subject-coef">Coef ${coef}</div></th>`;
      })
      .join('');

    const subjectCells = (st: PvStudentPayload) =>
      subjects
        .map((subj) => {
          const score = st.subjectScores?.[subj.id];
          if (typeof score === 'number' && !isNaN(score)) {
            const cls = score >= 10 ? 'score-pass' : 'score-fail';
            return `<td class="${cls}">${score.toFixed(2)}</td>`;
          }
          if (st.absents?.includes(subj.id)) {
            return `<td class="score-absent">ABS</td>`;
          }
          return `<td class="score-none">—</td>`;
        })
        .join('');

    const rowsHtml = sortedStudents
      .map((st, idx) => {
        const zebra = idx % 2 === 1 ? ' style="background:#f8fafc;"' : '';
        const moyenneCls = st.moyenne !== null && st.moyenne >= 10 ? 'score-pass' : 'score-fail';
        const moyenneVal = st.moyenne !== null ? st.moyenne.toFixed(2) : '—';
        return `<tr${zebra}>
        <td>${esc(st.matricule || '—')}</td>
        <td style="font-weight:500;">${esc(st.name)}</td>
        ${subjectCells(st)}
        <td style="font-weight:bold;">${(st.total ?? 0).toFixed(2)}</td>
        <td style="font-weight:bold;color:#92400e;">${st.totalCoef ?? 0}</td>
        <td class="${moyenneCls}" style="font-weight:bold;">${moyenneVal}</td>
        <td style="font-weight:bold;">${st.rang ?? '—'}</td>
      </tr>`;
      })
      .join('');

    // Tableaux 3 premiers + 3 derniers (repli : calcul local comme le Helm)
    const top3 =
      Array.isArray(data.top3) && data.top3.length > 0
        ? data.top3
        : [...students].sort((a, b) => (a.rang ?? 0) - (b.rang ?? 0)).slice(0, 3);
    const bottom3 =
      Array.isArray(data.bottom3) && data.bottom3.length > 0
        ? data.bottom3
        : [...students].sort((a, b) => (b.rang ?? 0) - (a.rang ?? 0)).slice(0, 3);

    const buildMiniTable = (title: string, list: PvStudentPayload[], color: string) => {
      const rows = list
        .map(
          (st) => `<tr>
        <td>${esc(st.matricule || '—')}</td>
        <td style="font-weight:500;">${esc(st.name)}</td>
        <td style="text-align:center;font-weight:bold;">${st.moyenne !== null ? st.moyenne.toFixed(2) : '—'}</td>
        <td style="text-align:center;font-weight:bold;">${st.rang ?? '—'}</td>
      </tr>`,
        )
        .join('');
      return `<div>
        <div style="background:${color};color:white;padding:4px 8px;font-size:9px;font-weight:bold;border-radius:2px 2px 0 0;">${esc(title)}</div>
        <table class="data">
          <thead><tr>
            <th>Matricule</th>
            <th>Nom</th>
            <th style="text-align:center;">Moyenne</th>
            <th style="text-align:center;">Rang</th>
          </tr></thead>
          <tbody>${rows || `<tr><td colspan="4" class="empty-state">Aucune donnée</td></tr>`}</tbody>
        </table>
      </div>`;
    };

    return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>PROCÈS-VERBAL D'EXAMEN — ${esc(ctx.exam.code)}</title>
<style>${this.getCommonCss()}</style>
</head>
<body>
<div class="content">
  ${this.buildHeader(ctx)}
  <div class="doc-title">PROCÈS-VERBAL D'EXAMEN</div>
  <div class="doc-meta">
    <div><strong>Examen :</strong> ${esc(ctx.exam.name)} (${esc(ctx.exam.code)})</div>
    <div><strong>Session :</strong> ${esc(ctx.exam.session || '—')}</div>
    <div><strong>Année :</strong> ${esc(ctx.exam.academicYearLabel || '—')}</div>
    <div><strong>Candidats :</strong> ${students.length}</div>
  </div>

  <div class="section-title">Tableau principal du procès-verbal</div>
  <table class="data">
    <thead>
      <tr>
        <th rowspan="2">Matricule</th>
        <th rowspan="2">Nom et prénoms</th>
        ${subjectHeaders}
        <th rowspan="2" style="text-align:center;">Total</th>
        <th rowspan="2" style="text-align:center;">Coef</th>
        <th rowspan="2" style="text-align:center;">Moyenne</th>
        <th rowspan="2" style="text-align:center;">Rang</th>
      </tr>
      <tr>
        ${subjects.map((_, i) => `<th style="font-size:7px;">${esc(abbrs[i])}</th>`).join('')}
      </tr>
    </thead>
    <tbody>${rowsHtml || `<tr><td colspan="${subjects.length + 6}" class="empty-state">Aucune donnée</td></tr>`}</tbody>
  </table>

  <div class="two-cols">
    ${buildMiniTable('Trois premiers', top3, '#16a34a')}
    ${buildMiniTable('Trois derniers', bottom3, '#dc2626')}
  </div>

  ${this.buildFooter(ctx)}
</div>
</body>
</html>`;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STATISTIQUES HTML (reproduction exacte du Helm — périmètre examen)
  // ═══════════════════════════════════════════════════════════════════════

  private buildStatsHtml(ctx: PvExamContext, data: StatsPayload): string {
    const mainLabel =
      data.mainTab === 'notes' ? 'STATISTIQUES DES NOTES' : 'STATISTIQUES DES MOYENNES';
    const subLabel =
      data.subTab === 'taux-reussite'
        ? 'Taux de réussite'
        : data.subTab === 'intervalle'
          ? data.mainTab === 'notes'
            ? 'Intervalle des notes'
            : 'Intervalle des moyennes'
          : data.mainTab === 'notes'
            ? 'Meilleures notes'
            : 'Meilleures moyennes';

    let tableContent = '';

    if (data.subTab === 'taux-reussite') {
      const rows = (data.successRateRows || [])
        .map((row, idx) => {
          const zebra = idx % 2 === 1 ? ' style="background:#f8fafc;"' : '';
          return `<tr${zebra}>
          <td style="font-weight:500;">${esc(row.subjectName)}</td>
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
        })
        .join('');
      tableContent = `
        <table class="data">
          <thead>
            <tr>
              <th rowspan="2">Matière</th>
              <th colspan="3" style="text-align:center;">Effectif présents</th>
              <th colspan="3" style="text-align:center;">Total admis</th>
              <th colspan="3" style="text-align:center;">% Réussite</th>
              <th colspan="3" style="text-align:center;">% Échec</th>
            </tr>
            <tr>
              <th style="text-align:center;">G</th><th style="text-align:center;">F</th><th style="text-align:center;">T</th>
              <th style="text-align:center;">G</th><th style="text-align:center;">F</th><th style="text-align:center;">T</th>
              <th style="text-align:center;">G</th><th style="text-align:center;">F</th><th style="text-align:center;">T</th>
              <th style="text-align:center;">G</th><th style="text-align:center;">F</th><th style="text-align:center;">T</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="13" class="empty-state">Aucune donnée</td></tr>`}</tbody>
        </table>

        <div class="section-title">Graphique — Nombre d'admis par matière</div>
        <div class="bar-chart">
          ${(data.successRateRows || [])
            .map((row) => {
              const maxAdmitted = Math.max(
                ...(data.successRateRows || []).map((r) => r.admitted.total),
                1,
              );
              const heightPct = (row.admitted.total / maxAdmitted) * 100;
              const shortLabel =
                row.subjectName.length > 8 ? row.subjectName.substring(0, 7) + '…' : row.subjectName;
              return `<div class="bar">
              <div class="bar-count">${row.admitted.total}</div>
              <div class="bar-rect" style="height:${heightPct}%;" title="${esc(row.subjectName)}: ${row.admitted.total} admis"></div>
              <div class="bar-label">${esc(shortLabel)}</div>
            </div>`;
            })
            .join('') || `<div class="empty-state">Aucune donnée</div>`}
        </div>`;
    } else if (data.subTab === 'intervalle') {
      const intervals = data.intervalRows?.[0]?.intervals.map((i) => i.label) || [];
      const rows = (data.intervalRows || [])
        .map((row, idx) => {
          const zebra = idx % 2 === 1 ? ' style="background:#f8fafc;"' : '';
          return `<tr${zebra}>
          <td style="font-weight:500;">${esc(row.subjectName)}</td>
          <td style="text-align:center;font-weight:bold;">${row.effectif}</td>
          ${row.intervals.map((i) => `<td style="text-align:center;">${i.count}</td>`).join('')}
        </tr>`;
        })
        .join('');
      tableContent = `
        <table class="data">
          <thead>
            <tr>
              <th>Matière</th>
              <th style="text-align:center;">Effectif</th>
              ${intervals.map((label) => `<th style="text-align:center;">${esc(label)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="${intervals.length + 2}" class="empty-state">Aucune donnée</td></tr>`}</tbody>
        </table>`;
    } else {
      // meilleurs
      const rows = (data.bestRows || [])
        .map((row, idx) => {
          const zebra = idx % 2 === 1 ? ' style="background:#f8fafc;"' : '';
          return `<tr${zebra}>
          <td>${esc(row.matricule || '—')}</td>
          <td style="font-weight:500;">${esc(row.name)}</td>
          <td>${esc(row.school)}</td>
          <td style="text-align:center;font-weight:bold;color:#065f46;">${(row.score ?? 0).toFixed(2)}</td>
          <td style="text-align:center;">${esc(row.appreciation)}</td>
        </tr>`;
        })
        .join('');
      tableContent = `
        <div class="section-title">Top ${data.topN || 3} meilleures ${data.mainTab === 'notes' ? 'notes' : 'moyennes'}</div>
        <table class="data">
          <thead><tr>
            <th>Matricule</th>
            <th>Nom</th>
            <th>École</th>
            <th style="text-align:center;">${data.mainTab === 'notes' ? 'Note' : 'Moyenne'}</th>
            <th style="text-align:center;">Appréciation</th>
          </tr></thead>
          <tbody>${rows || `<tr><td colspan="5" class="empty-state">Aucune donnée</td></tr>`}</tbody>
        </table>`;
    }

    return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>${mainLabel} — ${esc(ctx.exam.code)}</title>
<style>${this.getCommonCss()}</style>
</head>
<body>
<div class="content">
  ${this.buildHeader(ctx)}
  <div class="doc-title">${mainLabel}</div>
  <div class="doc-meta">
    <div><strong>Examen :</strong> ${esc(ctx.exam.name)} (${esc(ctx.exam.code)})</div>
    <div><strong>Session :</strong> ${esc(ctx.exam.session || '—')}</div>
    <div><strong>Données :</strong> Examen national</div>
    <div><strong>Année :</strong> ${esc(ctx.exam.academicYearLabel || '—')}</div>
  </div>

  <div class="section-title">${esc(subLabel)}</div>
  ${tableContent}

  ${this.buildFooter(ctx)}
</div>
</body>
</html>`;
  }
}

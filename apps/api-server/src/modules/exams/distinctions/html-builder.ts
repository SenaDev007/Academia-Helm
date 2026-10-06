/**
 * ============================================================================
 * DISTINCTIONS HTML BUILDER — Tableau d'honneur (génération HTML directe)
 * ============================================================================
 *
 * ⭐ 2026-09-30 — Génération HTML directe (sans React SSR) pour éviter le
 *    timeout côté backend. Les templates React d'origine sont convertis en
 *    fonctions qui retournent du HTML string, comme bulletin-pdf.service.ts.
 *
 * Format A4 paysage (297mm × 210mm) — même charte que les PDF PV/Stats/Promotion.
 * ============================================================================
 */

import * as QRCode from 'qrcode';
import { THEMES, BOARD_BASE, BOARD_TITLE, DEFAULT_SIGNERS, EN_BOARD_BASE, EN_BOARD_TITLE, EN_DEFAULT_SIGNERS, themeFor } from './themes';
import { DEFAULT_RULES, resolveDistinction, GRADUATION_CODE } from './rules';
import { makeVerificationCode, verificationUrl } from './security';
import { fmtAverage, fmtPct, fmtRank, fmtRankEn, fmtDate, fmtDateEn, fill, slug } from './format';
import type { BoardInput, BoardRow, DistinctionCode, DistinctionInput, Level, Palette, PreparedDistinction, SchoolInfo, StudentInfo, PeriodInfo, ResultsInfo, Lang } from './types';

/** Renvoie le shortLabel d'une distinction dans la langue donnée. */
function shortLabelFor(code: DistinctionCode, lang: Lang): string {
  return themeFor(code, lang).shortLabel;
}

/** Renvoie le titre du tableau collectif dans la langue donnée. */
function boardTitleFor(level: Level, lang: Lang): string {
  if (lang === 'EN') return EN_BOARD_TITLE[level];
  return BOARD_TITLE[level];
}

/** Renvoie les signers par défaut dans la langue donnée. */
function defaultSignersFor(level: Level, lang: Lang): { director: string; teacher: string } {
  if (lang === 'EN') return EN_DEFAULT_SIGNERS[level];
  return DEFAULT_SIGNERS[level];
}

/** Renvoie le BOARD_BASE dans la langue donnée. */
function boardBaseFor(level: Level, lang: Lang): DistinctionCode {
  if (lang === 'EN') return EN_BOARD_BASE[level];
  return BOARD_BASE[level];
}

// ─── CSS (repris de css.ts) ───────────────────────────────────────────────
const BASE_CSS = `
@page{size:297mm 210mm;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:297mm;background:#fff}
body{-webkit-print-color-adjust:exact;print-color-adjust:exact;text-rendering:geometricPrecision;font-family:'Times New Roman',Georgia,serif}
.page{width:297mm;height:209.6mm;position:relative;overflow:hidden;break-after:page;page-break-after:always}
.page:last-child{break-after:auto;page-break-after:auto}
.content{position:absolute;z-index:5;display:flex;flex-direction:column;align-items:center;text-align:center}
.school{display:flex;align-items:center;justify-content:center;gap:12px;text-transform:uppercase}
.school img{height:38px;width:auto;object-fit:contain}
.footer{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:space-between;align-items:flex-end}
.sig{width:250px;text-align:center}
.sig .simg{height:50px;display:flex;align-items:flex-end;justify-content:center}
.sig .simg img{max-height:50px;max-width:200px;object-fit:contain}
.sig .line{border-top:1.5px solid var(--primary);margin-top:4px}
.sig .lbl{font-size:14px;font-weight:600;margin-top:6px}
.sig .nm{font-size:13px;opacity:.75;margin-top:1px}
.verify{display:flex;flex-direction:column;align-items:center;gap:4px}
.qr svg{width:80px;height:80px;display:block}
.vcode{font-size:11px;letter-spacing:.08em;font-variant-numeric:tabular-nums;opacity:.85}
.place{font-size:12px;opacity:.75;white-space:nowrap}
.fr{position:absolute;inset:0}
.msg{text-wrap:balance}
`;

const BOARD_CSS = `
.board .content{align-items:stretch;text-align:left}
.board .head{display:flex;flex-direction:column;align-items:center;text-align:center}
.board h1{line-height:1.1}
.board .sub2{margin-top:4px;font-size:18px;opacity:.85}
.board table{width:100%;border-collapse:separate;border-spacing:0 5px;margin-top:12px}
.board th{background:var(--primary);color:#fff;padding:9px 16px;font-size:15px;letter-spacing:.06em;text-transform:uppercase;text-align:left}
.board th:first-child,.board td:first-child{border-radius:12px 0 0 12px;width:84px;text-align:center}
.board th:last-child,.board td:last-child{border-radius:0 12px 12px 0;text-align:center;width:250px}
.board th.num,.board td.num{text-align:center;width:170px}
.board td{padding:7px 16px;background:color-mix(in srgb,var(--soft) 38%,#fff);font-size:19px;font-weight:600}
.board td.rk{font-weight:800;font-size:20px}
.board .pill{display:inline-flex;align-items:center;gap:7px;padding:4px 14px;border-radius:999px;color:#fff;font-weight:700;font-size:14px;background:var(--pc)}
.board .foot{position:absolute;left:0;right:0;bottom:0;text-align:center;font-size:13px;opacity:.75}
.board.mat .content{inset:60px 100px 50px}
.board.pri .content{inset:56px 120px 50px}
.board.sec .content{inset:58px 110px 50px}
.board.mat h1{font-size:46px;font-weight:700;color:var(--primary)}
.board.pri h1{font-size:44px;font-weight:800;color:var(--primary);text-transform:uppercase;letter-spacing:.05em}
.board.sec h1{font-size:44px;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:.06em}
.board.sec .sub2{font-style:italic}
.board.sec td{font-weight:500}
`;

const ALL_CSS = BASE_CSS + '\n' + BOARD_CSS;

// ─── Helpers ──────────────────────────────────────────────────────────────
function vars(p: Palette): string {
  return `--primary:${p.primary};--accent:${p.accent};--tint:${p.tint};--ink:${p.ink};--soft:${p.soft}`;
}

const TOP_ICONS: Record<number, { icon: string; color: string }> = {
  1: { icon: '🏆', color: '#C9A227' },
  2: { icon: '🥈', color: '#94A3B8' },
  3: { icon: '🥉', color: '#B7791F' },
};

const CLS: Record<Level, string> = { maternel: 'mat', primaire: 'pri', secondaire: 'sec' };

// ─── Board HTML ──────────────────────────────────────────────────────────
export async function buildBoardHtml(b: BoardInput): Promise<string> {
  const lang: Lang = b.lang ?? 'FR';
  const base = themeFor(boardBaseFor(b.level, lang), lang);
  const pages: BoardRow[][] = [];
  const ROWS_PER_PAGE = 9;
  for (let i = 0; i < b.rows.length; i += ROWS_PER_PAGE) {
    pages.push(b.rows.slice(i, i + ROWS_PER_PAGE));
  }
  if (pages.length === 0) pages.push([]);
  // ⭐ 2026-10-05 — Libellés bilingues pour l'en-tête de colonne « Moyenne » /
  //    « Average » et « Acquis » (maternelle FR).
  const numHead = b.level === 'maternel'
    ? (lang === 'EN' ? 'Achievement' : 'Acquis')
    : (lang === 'EN' ? 'Average' : 'Moyenne');
  const rankHead = lang === 'EN' ? 'Rank' : 'Rang';
  const pupilHead = lang === 'EN' ? 'Pupil' : 'Élève';
  const distinctionHead = lang === 'EN' ? 'Distinction' : 'Mention';
  const schoolYearLabel = lang === 'EN' ? 'school year' : 'année scolaire';
  const generatedByLabel = lang === 'EN' ? 'generated by Academia Helm' : 'généré par Academia Helm';

  const pagesHtml = pages.map((rows, pi) => {
    const rowsHtml = rows.map((r) => {
      const t = THEMES[r.code];
      const topIcon = r.rank <= 3 ? TOP_ICONS[r.rank] : undefined;
      const rankCell = topIcon
        ? `<span style="font-size:24px;">${topIcon.icon}</span>`
        : `${r.rank}`;
      const avgCell = b.level === 'maternel' ? fmtPct(r.average, b.base) : fmtAverage(r.average, b.base);
      return `<tr>
        <td class="rk">${rankCell}</td>
        <td>${r.fullName}</td>
        <td class="num">${avgCell}</td>
        <td>
          <span class="pill" style="--pc:${t.palette.primary}">
            ${shortLabelFor(r.code, lang)}
          </span>
        </td>
      </tr>`;
    }).join('');

    return `<section class="page board ${CLS[b.level]}" style="${vars(base.palette)}">
      <div class="content">
        <div class="head">
          <h1>${boardTitleFor(b.level, lang)}</h1>
          <div class="sub2">
            ${b.className}, ${b.period.label}, ${schoolYearLabel} ${b.period.schoolYear}
            ${pages.length > 1 ? ` (page ${pi + 1}/${pages.length})` : ''}
          </div>
        </div>
        <table>
          <thead>
            <tr><th>${rankHead}</th><th>${pupilHead}</th><th class="num">${numHead}</th><th>${distinctionHead}</th></tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="foot">${b.school.name}, ${generatedByLabel}</div>
      </div>
    </section>`;
  }).join('');

  const htmlLang = lang === 'EN' ? 'en' : 'fr';
  const docTitle = lang === 'EN' ? 'Honor Roll' : 'Tableau d\'honneur';
  return `<!doctype html><html lang="${htmlLang}"><head><meta charset="utf-8"><title>${docTitle}</title><style>${ALL_CSS}</style></head><body>${pagesHtml}</body></html>`;
}

// ─── Certificate HTML ────────────────────────────────────────────────────
export async function buildCertificateHtml(input: DistinctionInput): Promise<string> {
  const lang: Lang = input.lang ?? 'FR';
  const theme = themeFor(input.code, lang);
  const vals = { periode: input.period.label.toLowerCase(), annee: input.period.schoolYear };
  const r = input.results;
  const isGrad = input.code === GRADUATION_CODE[theme.level];

  // QR code
  const qrSvgStr = await QRCode.toString(input.verification.url, {
    type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: theme.palette.ink, light: '#0000' },
  }).catch(() => '');

  const defaults = defaultSignersFor(theme.level, lang);

  // ⭐ 2026-10-05 — Libellés bilingues : « Fait à », « le », etc.
  const madeInLabel = lang === 'EN' ? 'Issued at' : 'Fait à';
  const onLabel = lang === 'EN' ? 'on' : 'le';
  const onlyDateLabel = lang === 'EN' ? 'On' : 'Le';
  const schoolYearLabel = lang === 'EN' ? 'School year' : 'Année scolaire';
  const pupilOfClassLabel = lang === 'EN' ? 'Pupil of' : 'Élève de';

  // Signatures
  const sigDirector = `<div class="sig">
    ${input.school.directorSignatureUrl ? `<div class="simg"><img src="${input.school.directorSignatureUrl}" alt="" /></div>` : '<div class="simg"></div>'}
    <div class="line"></div>
    <div class="lbl">${input.school.directorTitle || defaults.director}</div>
    ${input.school.directorName ? `<div class="nm">${input.school.directorName}</div>` : ''}
  </div>`;

  const sigTeacher = `<div class="sig">
    ${input.school.teacherSignatureUrl ? `<div class="simg"><img src="${input.school.teacherSignatureUrl}" alt="" /></div>` : '<div class="simg"></div>'}
    <div class="line"></div>
    <div class="lbl">${input.school.teacherTitle || defaults.teacher}</div>
    ${input.school.teacherName ? `<div class="nm">${input.school.teacherName}</div>` : ''}
  </div>`;

  const verifyBlock = `<div class="verify">
    <div class="qr">${qrSvgStr}</div>
    <div class="vcode">${input.verification.code}</div>
    <div class="place">${input.school.city ? `${madeInLabel} ${input.school.city}, ${onLabel} ${lang === 'EN' ? fmtDateEn(input.period.issuedOn) : fmtDate(input.period.issuedOn)}` : `${onlyDateLabel} ${lang === 'EN' ? fmtDateEn(input.period.issuedOn) : fmtDate(input.period.issuedOn)}`}</div>
  </div>`;

  const footer = `<div class="footer">${sigDirector}${verifyBlock}${sigTeacher}</div>`;

  // School header
  const schoolHeader = `<div class="school">
    ${input.school.logoUrl ? `<img src="${input.school.logoUrl}" alt="" />` : ''}
    <span>${input.school.name}</span>
  </div>`;

  // ⭐ 2026-10-05 — Libellés bilingues pour les chips de résultats :
  //    « Moyenne » / « Average », « Moyenne annuelle » / « Annual average »,
  //    « Rang » / « Rank », « Moyenne générale » / « General average »,
  //    « Période précédente » / « Previous period ».
  const avgLabel = lang === 'EN' ? 'Average' : 'Moyenne';
  const annualAvgLabel = lang === 'EN' ? 'Annual average' : 'Moyenne annuelle';
  const rankLabel = lang === 'EN' ? 'Rank' : 'Rang';
  const generalAvgLabel = lang === 'EN' ? 'General average' : 'Moyenne générale';
  const previousPeriodLabel = lang === 'EN' ? 'Previous period' : 'Période précédente';
  const gainLabel = lang === 'EN' ? 'pts out of 20' : 'pts sur 20';
  const achievementLabel = lang === 'EN' ? 'Achievement of the period' : 'Acquis de la période';

  // Level-specific content
  let bodyContent = '';

  if (theme.level === 'maternel') {
    const stat = input.statOverride ?? (r?.average != null ? `${achievementLabel}: ${fmtPct(r.average, r.base)}` : undefined);
    bodyContent = `
      ${schoolHeader}
      <div style="margin-top:14px;width:128px;height:128px;border-radius:50%;background:${theme.palette.primary};display:grid;place-items:center;color:#fff;font-size:48px;">
        🌟
      </div>
      ${theme.kicker ? `<div style="margin-top:24px;font-size:15px;font-weight:500;letter-spacing:.24em;text-transform:uppercase;">${theme.kicker}</div>` : ''}
      <h1 style="font-size:48px;font-weight:700;color:${theme.palette.primary};margin-top:2px;">${theme.title}</h1>
      <div style="margin-top:4px;font-size:18px;opacity:.8;">${fill(theme.given, vals)}</div>
      <div style="margin-top:6px;font-weight:600;color:${theme.palette.ink};font-size:32px;border-bottom:4px dotted ${theme.palette.accent};display:inline-block;padding:0 30px 2px;">${input.student.fullName}</div>
      <div style="margin-top:10px;font-size:20px;">${isGrad ? `${input.student.className}, ${schoolYearLabel} ${input.period.schoolYear}` : `${input.student.className}, ${input.period.label}, ${schoolYearLabel} ${input.period.schoolYear}`}</div>
      <p style="margin-top:12px;font-size:21px;max-width:720px;line-height:1.35;">${input.customMessage || fill(theme.message, vals)}</p>
      ${stat ? `<div style="margin-top:14px;display:inline-flex;align-items:center;gap:8px;background:${theme.palette.primary};color:#fff;padding:6px 22px;border-radius:30px;font-size:17px;font-weight:600;">${stat}</div>` : ''}
      ${footer}
    `;
  } else if (theme.level === 'primaire') {
    const chips = [];
    if (input.statOverride) {
      chips.push(`<span style="display:inline-flex;align-items:center;gap:8px;background:#fff;border:2px solid ${theme.palette.soft};border-radius:999px;padding:5px 16px;font-weight:700;font-size:16px;">${input.statOverride}</span>`);
    } else {
      if (r?.average != null) chips.push(`<span style="display:inline-flex;align-items:center;gap:8px;background:#fff;border:2px solid ${theme.palette.soft};border-radius:999px;padding:5px 16px;font-weight:700;font-size:16px;">${isGrad ? annualAvgLabel : avgLabel} : ${fmtAverage(r.average, r.base)}</span>`);
      if (r?.rank != null) chips.push(`<span style="display:inline-flex;align-items:center;gap:8px;background:#fff;border:2px solid ${theme.palette.soft};border-radius:999px;padding:5px 16px;font-weight:700;font-size:16px;">${rankLabel} : ${lang === 'EN' ? fmtRankEn(r.rank, r.classSize) : fmtRank(r.rank, r.classSize)}</span>`);
    }
    bodyContent = `
      ${schoolHeader}
      <div style="margin-top:10px;width:104px;height:104px;border-radius:50%;background:${theme.palette.accent};border:5px solid ${theme.palette.primary};display:grid;place-items:center;color:${theme.palette.primary};font-size:40px;">🏅</div>
      <div style="margin-top:8px;background:${theme.palette.primary};color:#fff;padding:8px 52px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;font-size:28px;">${theme.title}</div>
      ${theme.subtitle ? `<div style="margin-top:8px;font-size:24px;font-weight:800;font-style:italic;color:${theme.palette.accent};">${theme.subtitle}</div>` : ''}
      <div style="margin-top:10px;font-size:16px;font-weight:600;">${fill(theme.given, vals)}</div>
      <div style="margin-top:2px;font-weight:800;color:${theme.palette.primary};font-size:32px;display:inline-block;border-bottom:2px solid ${theme.palette.accent};padding:0 20px 4px;">${input.student.fullName}</div>
      <div style="margin-top:8px;font-size:18px;font-weight:600;">${isGrad ? `${input.student.className}, ${schoolYearLabel} ${input.period.schoolYear}` : `${input.student.className}, ${input.period.label}, ${schoolYearLabel} ${input.period.schoolYear}`}</div>
      <div style="display:flex;gap:14px;margin-top:10px;">${chips.join('')}</div>
      <p style="margin-top:10px;font-size:19px;font-weight:600;font-style:italic;max-width:760px;line-height:1.35;">${input.customMessage || fill(theme.message, vals)}</p>
      ${footer}
    `;
  } else {
    // Secondaire
    let stat = input.statOverride;
    if (!stat && r?.average != null) {
      if (input.code === 'SEC_PROGRES' && r.previousAverage != null) {
        const gain = (r.average - r.previousAverage) / r.base * 20;
        stat = `${r.previousLabel || previousPeriodLabel} : ${fmtAverage(r.previousAverage, r.base)}   |   ${input.period.label} : ${fmtAverage(r.average, r.base)}   |   +${gain.toFixed(1)} ${gainLabel}`;
      } else if (isGrad) {
        stat = `${annualAvgLabel} : ${fmtAverage(r.average, r.base)}`;
      } else {
        stat = `${generalAvgLabel} : ${fmtAverage(r.average, r.base)}` + (r.rank != null ? `   |   ${rankLabel} : ${lang === 'EN' ? fmtRankEn(r.rank, r.classSize) : fmtRank(r.rank, r.classSize)}` : '');
      }
    }
    bodyContent = `
      ${schoolHeader}
      <div style="font-size:13px;font-style:italic;margin-top:4px;opacity:.8;">${schoolYearLabel} ${input.period.schoolYear}</div>
      <h1 style="font-size:40px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${theme.palette.primary};margin-top:26px;">${theme.title}</h1>
      ${theme.subtitle ? `<div style="font-style:italic;font-weight:500;font-size:24px;color:${theme.palette.accent};margin-top:6px;">${theme.subtitle}</div>` : ''}
      <div style="font-style:italic;font-size:18px;margin-top:24px;">${fill(theme.given, vals)}</div>
      <div style="font-style:italic;font-weight:700;color:${theme.palette.primary};margin-top:16px;font-size:32px;display:inline-block;border-bottom:1.5px solid ${theme.palette.accent};padding:0 26px 4px;">${input.student.fullName}</div>
      <div style="font-size:19px;margin-top:12px;">${pupilOfClassLabel} ${input.student.className}</div>
      <p style="font-style:italic;font-size:19px;margin-top:18px;max-width:860px;line-height:1.45;">${input.customMessage || fill(theme.message, vals)}</p>
      ${stat ? `<div style="white-space:pre;margin-top:22px;font-weight:600;font-size:16px;color:${theme.palette.accent};">${stat}</div>` : ''}
      <div style="position:absolute;left:0;bottom:0;display:flex;flex-direction:column;align-items:center;gap:3px;">
        <div style="width:62px;height:62px;">${qrSvgStr ? `<div style="width:62px;height:62px;">${qrSvgStr}</div>` : ''}</div>
        <div style="font-size:8.5px;">${input.verification.code}</div>
      </div>
      ${footer}
    `;
  }

  const htmlLang = lang === 'EN' ? 'en' : 'fr';
  return `<!doctype html><html lang="${htmlLang}"><head><meta charset="utf-8"><title>${theme.title}</title><style>${ALL_CSS}</style></head><body>
    <section class="page ${CLS[theme.level]}" style="${vars(theme.palette)}">
      <div class="content">
        ${bodyContent}
      </div>
    </section>
  </body></html>`;
}

// ─── Utility exports ──────────────────────────────────────────────────────
export { resolveDistinction, DEFAULT_RULES, GRADUATION_CODE, makeVerificationCode, verificationUrl, THEMES, BOARD_BASE, BOARD_TITLE, themeFor };
export type { Level, DistinctionCode, DistinctionInput, BoardInput, BoardRow, Lang };

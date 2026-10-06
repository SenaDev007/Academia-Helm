/**
 * ============================================================================
 * DISTINCTIONS HTML BUILDER — Tableau d'honneur (génération HTML directe)
 * ============================================================================
 *
 * ⭐ 2026-10-06 — REFONTE COMPLÈTE : le html-builder précédent utilisait un CSS
 *    simplifié (BASE_CSS + BOARD_CSS seulement) qui ne reproduisait PAS le design
 *    des certificats FR (bordures décoratives, icônes de fond, bannières,
 *    médailles, cadre pointillé, watermark, etc.). Les PDF EN ressemblaient à
 *    des documents HTML basiques, pas aux beaux certificats FR.
 *
 *    Désormais, html-builder.ts utilise EXACTEMENT le même CSS que css.ts
 *    (BASE_CSS + MATERNEL_CSS + PRIMAIRE_CSS + SECONDAIRE_CSS + BOARD_CSS)
 *    et reproduit EXACTEMENT le même layout HTML que les templates React
 *    (Maternel.tsx, Primaire.tsx, Secondaire.tsx, shared.tsx) — mais en HTML
 *    string au lieu de JSX, et avec le support bilingue FR/EN via themeFor().
 *
 *    Le résultat : les certificats EN sont VISUELLEMENT IDENTIQUES aux FR,
 *    juste avec le texte en anglais.
 * ============================================================================
 */

import * as QRCode from 'qrcode';
import { THEMES, BOARD_BASE, BOARD_TITLE, DEFAULT_SIGNERS, EN_BOARD_BASE, EN_BOARD_TITLE, EN_DEFAULT_SIGNERS, themeFor } from './themes';
import { DEFAULT_RULES, resolveDistinction, GRADUATION_CODE } from './rules';
import { makeVerificationCode, verificationUrl } from './security';
import { fmtAverage, fmtPct, fmtRank, fmtRankEn, fmtDate, fmtDateEn, fill, slug, fitFont } from './format';
import type { BoardInput, BoardRow, DistinctionCode, DistinctionInput, Level, Palette, PreparedDistinction, SchoolInfo, StudentInfo, PeriodInfo, ResultsInfo, Lang } from './types';

// ─── CSS (EXACTEMENT le même que css.ts) ───────────────────────────────────
const BASE_CSS = `
@page{size:297mm 210mm;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:297mm;background:#fff}
body{-webkit-print-color-adjust:exact;print-color-adjust:exact;text-rendering:geometricPrecision;font-family:'Times New Roman',Georgia,serif}
.page{width:297mm;height:209.6mm;position:relative;overflow:hidden;break-after:page;page-break-after:always}
.page:last-child{break-after:auto;page-break-after:auto}
.content{position:absolute;z-index:5;display:flex;flex-direction:column;align-items:center;text-align:center}
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

const MATERNEL_CSS = `
.mat{background:var(--tint);font-family:'Fredoka',sans-serif;color:var(--ink)}
.mat .bubble{position:absolute;border-radius:50%;background:var(--soft);opacity:.5}
.mat .deco{position:absolute;color:var(--primary);opacity:.24}
.mat .frame{position:absolute;inset:22px;border:10px solid var(--primary);border-radius:46px}
.mat .frame::after{content:'';position:absolute;inset:10px;border:3px dashed var(--accent);border-radius:34px}
.mat .content{inset:60px 72px 64px}
.mat .badge-wrap{position:relative;margin-top:14px}
.mat .badge{width:128px;height:128px;border-radius:50%;background:var(--primary);display:grid;place-items:center;color:#fff;
  box-shadow:0 0 0 7px var(--tint),0 0 0 13px var(--accent),0 12px 0 13px rgba(0,0,0,.07)}
.mat .spark{position:absolute;color:var(--accent)}
.mat .kicker{margin-top:24px;font-size:15px;font-weight:500;letter-spacing:.24em;text-transform:uppercase}
.mat h1{font-size:60px;font-weight:700;line-height:1.05;color:var(--primary);margin-top:2px;
  text-shadow:0 3px 0 color-mix(in srgb,var(--ink) 14%,transparent)}
.mat .given{margin-top:4px;font-size:18px;opacity:.8}
.mat .name{margin-top:6px;font-weight:600;color:var(--ink);padding:0 30px 2px;border-bottom:4px dotted var(--accent);line-height:1.15}
.mat .class{margin-top:10px;font-size:20px}
.mat .msg{margin-top:12px;font-size:21px;max-width:720px;line-height:1.35}
.mat .score{margin-top:14px;display:inline-flex;align-items:center;gap:8px;background:var(--primary);color:#fff;
  padding:6px 22px;border-radius:30px;font-size:17px;font-weight:600}
.mat .photo{position:absolute;z-index:6;left:118px;top:150px;width:150px;height:150px;border-radius:50%;object-fit:cover;
  border:8px solid var(--primary);box-shadow:0 0 0 6px var(--tint),0 0 0 10px var(--accent)}
.mat .mascot{position:absolute;z-index:6;right:118px;top:150px;width:150px;height:150px;border-radius:50%;background:var(--soft);
  display:grid;place-items:center;color:var(--primary);border:8px solid var(--primary);box-shadow:0 0 0 6px var(--tint),0 0 0 10px var(--accent)}
.mat .sig .line{border-top:2.5px dotted var(--primary)}
.mat .qr{background:#fff;padding:5px;border-radius:12px;border:3px solid var(--soft)}
.mat .school{display:flex;align-items:center;justify-content:center;gap:12px;text-transform:uppercase}
.mat .school img{height:38px;width:auto;object-fit:contain}
`;

const PRIMAIRE_CSS = `
.pri{background:var(--primary);font-family:'Nunito',sans-serif;color:var(--ink)}
.pri .panel{position:absolute;inset:20px;background:var(--tint)}
.pri .panel::before{content:'';position:absolute;inset:10px;border:3px solid var(--accent)}
.pri .panel::after{content:'';position:absolute;inset:19px;border:1px solid var(--primary)}
.pri .side{position:absolute;top:84px;bottom:84px;width:54px;display:flex;flex-direction:column;justify-content:space-around;align-items:center;color:var(--primary);opacity:.15}
.pri .side.l{left:50px}.pri .side.r{right:50px}
.pri .corner{position:absolute;width:62px;height:62px;border:0 solid var(--accent)}
.pri .corner.tl{top:36px;left:36px;border-width:4px 0 0 4px;border-radius:62px 0 0 0}
.pri .corner.tr{top:36px;right:36px;border-width:4px 4px 0 0;border-radius:0 62px 0 0}
.pri .corner.bl{bottom:36px;left:36px;border-width:0 0 4px 4px;border-radius:0 0 0 62px}
.pri .corner.br{bottom:36px;right:36px;border-width:0 4px 4px 0;border-radius:0 0 62px 0}
.pri .wm{position:absolute;left:50%;top:54%;transform:translate(-50%,-50%);color:var(--primary);opacity:.04}
.pri .content{inset:56px 128px 52px}
.pri .medal{position:relative;z-index:2;margin-top:10px;width:104px;height:104px;border-radius:50%;
  background:radial-gradient(circle at 30% 28%,color-mix(in srgb,var(--accent) 55%,#fff),var(--accent) 65%);
  border:5px solid var(--primary);display:grid;place-items:center;color:var(--primary);
  box-shadow:0 0 0 5px var(--tint),0 0 0 8px var(--accent)}
.pri .tails{position:relative;z-index:1;display:flex;gap:8px;margin-top:-14px}
.pri .tail{width:28px;height:50px;background:var(--primary);clip-path:polygon(0 0,100% 0,100% 100%,50% 80%,0 100%)}
.pri .banner{position:relative;isolation:isolate;margin-top:8px;background:var(--primary);color:#fff;padding:8px 52px;
  font-weight:800;letter-spacing:.06em;text-transform:uppercase;line-height:1.15}
.pri .banner::before,.pri .banner::after{content:'';position:absolute;top:14px;width:48px;height:100%;z-index:-1;
  background:color-mix(in srgb,var(--primary) 72%,#000)}
.pri .banner::before{left:-36px;clip-path:polygon(0 0,100% 0,100% 100%,0 100%,22px 50%)}
.pri .banner::after{right:-36px;clip-path:polygon(0 0,100% 0,calc(100% - 22px) 50%,100% 100%,0 100%)}
.pri .sub{margin-top:8px;font-size:24px;font-weight:800;font-style:italic;color:color-mix(in srgb,var(--accent) 62%,#000)}
.pri .given{margin-top:10px;font-size:16px;font-weight:600}
.pri .name{margin-top:2px;font-weight:800;color:var(--primary);line-height:1.15;padding:0 20px 4px;border-bottom:2px solid var(--accent)}
.pri .class{margin-top:8px;font-size:18px;font-weight:600}
.pri .chips{display:flex;gap:14px;margin-top:10px}
.pri .chip{display:flex;align-items:center;gap:8px;background:#fff;border:2px solid var(--soft);border-radius:999px;padding:5px 16px;font-weight:700;font-size:16px}
.pri .msg{margin-top:10px;font-size:19px;font-weight:600;font-style:italic;max-width:760px;line-height:1.35}
.pri .qr{background:#fff;padding:5px;border-radius:8px;border:2px solid var(--soft)}
.pri .school{display:flex;align-items:center;justify-content:center;gap:12px;text-transform:uppercase}
.pri .school img{height:38px;width:auto;object-fit:contain}
`;

const SECONDAIRE_CSS = `
.sec{background:var(--tint);font-family:'Lora',serif;color:var(--ink)}
.sec .guil{position:absolute;left:0;top:0;width:100%;height:100%}
.sec .wm{position:absolute;left:50%;top:52%;transform:translate(-50%,-50%);color:var(--primary);opacity:.05}
.sec .f1{position:absolute;inset:20px;border:5px solid var(--primary)}
.sec .f2{position:absolute;inset:30px;border:1px solid var(--primary)}
.sec .f3{position:absolute;inset:36px;border:1.5px solid var(--accent)}
.sec .orn{position:absolute;width:13px;height:13px;background:var(--accent);transform:rotate(45deg);outline:3px solid var(--tint)}
.sec .content{inset:52px 96px 48px}
.sec .year{font-size:13px;font-style:italic;margin-top:4px;opacity:.8}
.sec .div{display:flex;align-items:center;gap:10px;width:360px;margin-top:10px}
.sec .div i{flex:1;height:1px;background:var(--accent)}
.sec .div b{width:9px;height:9px;background:var(--accent);transform:rotate(45deg)}
.sec h1{font-family:'Playfair Display',serif;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--primary);margin-top:26px;line-height:1.1}
.sec .sub{font-family:'Playfair Display',serif;font-style:italic;font-weight:500;font-size:27px;color:color-mix(in srgb,var(--accent) 60%,#000);margin-top:6px}
.sec .given{font-style:italic;font-size:18px;margin-top:24px}
.sec .name{font-family:'Playfair Display',serif;font-style:italic;font-weight:700;color:var(--primary);margin-top:16px;line-height:1.15;padding:0 26px 4px;border-bottom:1.5px solid var(--accent)}
.sec .class{font-size:19px;margin-top:12px}
.sec .msg{font-style:italic;font-size:19px;margin-top:18px;max-width:860px;line-height:1.45}
.sec .stat{white-space:pre;margin-top:22px;font-weight:600;font-size:16px;letter-spacing:.04em;color:color-mix(in srgb,var(--accent) 60%,#000)}
.sec .seal{position:relative;width:104px;height:104px;border-radius:50%;display:grid;place-items:center;color:var(--tint);margin-bottom:2px;
  background:radial-gradient(circle at 35% 30%,color-mix(in srgb,var(--accent) 55%,#fff),var(--accent) 60%,color-mix(in srgb,var(--accent) 70%,#000));
  border:2px solid var(--primary);box-shadow:0 2px 0 rgba(0,0,0,.12)}
.sec .seal::before{content:'';position:absolute;inset:7px;border:2px dashed var(--tint);border-radius:50%}
.sec .seal::after{content:'';position:absolute;inset:14px;border:1.5px solid color-mix(in srgb,var(--tint) 80%,transparent);border-radius:50%}
.sec .qrcorner{position:absolute;left:0;bottom:0;display:flex;flex-direction:column;align-items:center;gap:3px}
.sec .qrcorner .qr svg{width:62px;height:62px}
.sec .qrcorner .vcode{font-size:8.5px}
.sec .sig .lbl{font-style:italic;font-weight:500}
.sec .sig{width:230px}
.sec .footer{padding:0 150px 0 150px}
.sec .school{display:flex;align-items:center;justify-content:center;gap:12px;text-transform:uppercase}
.sec .school img{height:38px;width:auto;object-fit:contain}
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
.board.sec h1{font-family:'Playfair Display',serif;font-size:44px;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:.06em}
.board.sec .sub2{font-style:italic}
.board.sec td{font-weight:500}
`;

const ALL_CSS = [BASE_CSS, MATERNEL_CSS, PRIMAIRE_CSS, SECONDAIRE_CSS, BOARD_CSS].join('\n');

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

// ─── Decorative frame HTML (clones of shared.tsx LevelFrame) ──────────────
function levelFrameHtml(level: Level, pattern: string[], watermark: string): string {
  // ⭐ We use emoji/text for icons since we can't render React <Icon> in HTML string.
  // The icons in the FR version are decorative SVG icons — we reproduce the
  // layout with simple unicode symbols and CSS positioning to match the visual.
  if (level === 'maternel') {
    const BUBBLES: [number, number, number][] = [
      [-60, -60, 240], [930, -90, 260], [-80, 600, 260], [940, 590, 250], [560, -40, 90], [480, 720, 110],
    ];
    const MAT_SPOTS: [number, number, number, number][] = [
      [70, 70, 54, -14], [190, 46, 38, 10], [62, 210, 40, 12], [900, 62, 50, 14], [1010, 176, 38, -10], [836, 44, 36, 8],
      [70, 520, 48, 10], [182, 604, 38, -12], [952, 530, 52, -10], [1022, 614, 38, 12],
    ];
    return `<div class="fr">
      ${BUBBLES.map(([l, t, s]) => `<div class="bubble" style="left:${l}px;top:${t}px;width:${s}px;height:${s}px;"></div>`).join('')}
      ${MAT_SPOTS.map(([l, t, s, r]) => `<div class="deco" style="left:${l}px;top:${t}px;transform:rotate(${r}deg);font-size:${s}px;">★</div>`).join('')}
      <div class="frame"></div>
    </div>`;
  }
  if (level === 'primaire') {
    return `<div class="fr">
      <div class="panel"></div>
      <div class="wm" style="font-size:460px;opacity:.04;">${watermark === 'Trophy' ? '🏆' : '★'}</div>
      <div class="side l">${pattern.slice(0, 5).map(() => '<span style="font-size:38px;">★</span>').join('')}</div>
      <div class="side r">${[...pattern].reverse().slice(0, 5).map(() => '<span style="font-size:38px;">★</span>').join('')}</div>
      <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
    </div>`;
  }
  return `<div class="fr">
    <svg class="guil" viewBox="0 0 1123 794" width="1123" height="794" aria-hidden="true">
      ${Array.from({ length: 34 }, (_, i) => {
        const r = 44 + i * 9;
        return `<circle cx="561.5" cy="413" r="${r}" fill="none" stroke="var(--accent)" stroke-width="0.9" stroke-opacity="${Math.max(0.03, 0.26 * (1 - r / 360))}" />`;
      }).join('')}
    </svg>
    <div class="wm" style="font-size:440px;opacity:.05;">${watermark === 'Crown' ? '👑' : '★'}</div>
    <div class="f1"></div><div class="f2"></div><div class="f3"></div>
    <div class="orn" style="left:29.5px;top:29.5px;"></div>
    <div class="orn" style="right:29.5px;top:29.5px;"></div>
    <div class="orn" style="left:29.5px;bottom:29.5px;"></div>
    <div class="orn" style="right:29.5px;bottom:29.5px;"></div>
  </div>`;
}

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
      const t = themeFor(r.code, lang);
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

  // Bilingual labels
  const madeInLabel = lang === 'EN' ? 'Issued at' : 'Fait à';
  const onLabel = lang === 'EN' ? 'on' : 'le';
  const onlyDateLabel = lang === 'EN' ? 'On' : 'Le';
  const schoolYearLabel = lang === 'EN' ? 'School year' : 'Année scolaire';
  const pupilOfClassLabel = lang === 'EN' ? 'Pupil of' : 'Élève de';
  const avgLabel = lang === 'EN' ? 'Average' : 'Moyenne';
  const annualAvgLabel = lang === 'EN' ? 'Annual average' : 'Moyenne annuelle';
  const rankLabel = lang === 'EN' ? 'Rank' : 'Rang';
  const generalAvgLabel = lang === 'EN' ? 'General average' : 'Moyenne générale';
  const previousPeriodLabel = lang === 'EN' ? 'Previous period' : 'Période précédente';
  const gainLabel = lang === 'EN' ? 'pts out of 20' : 'pts sur 20';
  const achievementLabel = lang === 'EN' ? 'Achievement of the period' : 'Acquis de la période';

  // Icon mapping (emoji fallback since we can't use React <Icon> in HTML string)
  const iconEmoji: Record<string, string> = {
    'Star': '⭐', 'Rocket': '🚀', 'Palette': '🎨', 'Compass': '🧭', 'GraduationCap': '🎓',
    'Trophy': '🏆', 'Medal': '🏅', 'Award': '🎖️', 'Flame': '🔥', 'Crown': '👑',
    'TrendingUp': '📈', 'CalendarCheck': '📅', 'HeartHandshake': '🤝',
  };
  const iconChar = iconEmoji[theme.icon] || '★';

  // School header
  const schoolHeader = `<div class="school">
    ${input.school.logoUrl ? `<img src="${input.school.logoUrl}" alt="" />` : ''}
    <span>${input.school.name}</span>
  </div>`;

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

  const dateStr = lang === 'EN' ? fmtDateEn(input.period.issuedOn) : fmtDate(input.period.issuedOn);
  const verifyBlock = `<div class="verify">
    <div class="qr">${qrSvgStr}</div>
    <div class="vcode">${input.verification.code}</div>
    <div class="place">${input.school.city ? `${madeInLabel} ${input.school.city}, ${onLabel} ${dateStr}` : `${onlyDateLabel} ${dateStr}`}</div>
  </div>`;

  const footer = `<div class="footer">${sigDirector}${verifyBlock}${sigTeacher}</div>`;

  // Level-specific content — EXACT same layout as React templates (Maternel.tsx, Primaire.tsx, Secondaire.tsx)
  let bodyContent = '';

  if (theme.level === 'maternel') {
    const stat = input.statOverride ?? (r?.average != null ? `${achievementLabel}: ${fmtPct(r.average, r.base)}` : undefined);
    const frame = levelFrameHtml('maternel', theme.pattern, theme.icon);
    bodyContent = `
      ${frame}
      <div class="content">
        ${schoolHeader}
        <div class="badge-wrap">
          <div class="badge" style="font-size:74px;">${iconChar}</div>
          <span class="spark" style="left:-54px;top:4px;font-size:34px;">✨</span>
          <span class="spark" style="right:-52px;top:0;font-size:30px;">⭐</span>
          <span class="spark" style="left:-84px;top:62px;font-size:20px;">⭐</span>
          <span class="spark" style="right:-80px;top:66px;font-size:24px;">✨</span>
        </div>
        ${theme.kicker ? `<div class="kicker">${theme.kicker}</div>` : ''}
        <h1>${theme.title}</h1>
        <div class="given">${fill(theme.given, vals)}</div>
        <div class="name">${input.student.fullName}</div>
        <div class="class">${isGrad ? `${input.student.className}, ${schoolYearLabel} ${input.period.schoolYear}` : `${input.student.className}, ${input.period.label}, ${schoolYearLabel} ${input.period.schoolYear}`}</div>
        <p class="msg">${input.customMessage || fill(theme.message, vals)}</p>
        ${stat ? `<div class="score"><span style="font-size:18px;">⭐</span> ${stat}</div>` : ''}
        ${footer}
      </div>`;
  } else if (theme.level === 'primaire') {
    const chips = [];
    if (input.statOverride) {
      chips.push(`<div class="chip"><span style="font-size:18px;">⭐</span>${input.statOverride}</div>`);
    } else {
      if (r?.average != null) chips.push(`<div class="chip"><span style="font-size:18px;">🔢</span>${isGrad ? annualAvgLabel : avgLabel} : ${fmtAverage(r.average, r.base)}</div>`);
      if (r?.rank != null) chips.push(`<div class="chip"><span style="font-size:18px;">#</span>${rankLabel} : ${lang === 'EN' ? fmtRankEn(r.rank, r.classSize) : fmtRank(r.rank, r.classSize)}</div>`);
    }
    const frame = levelFrameHtml('primaire', theme.pattern, theme.icon);
    bodyContent = `
      ${frame}
      <div class="content">
        ${schoolHeader}
        <div class="medal" style="font-size:56px;">${iconChar}</div>
        <div class="tails"><div class="tail"></div><div class="tail"></div></div>
        <div class="banner">${theme.title}</div>
        ${theme.subtitle ? `<div class="sub">${theme.subtitle}</div>` : ''}
        <div class="given">${fill(theme.given, vals)}</div>
        <div class="name">${input.student.fullName}</div>
        <div class="class">${isGrad ? `${input.student.className}, ${schoolYearLabel} ${input.period.schoolYear}` : `${input.student.className}, ${input.period.label}, ${schoolYearLabel} ${input.period.schoolYear}`}</div>
        <div class="chips">${chips.join('')}</div>
        <p class="msg">${input.customMessage || fill(theme.message, vals)}</p>
        ${footer}
      </div>`;
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
    const frame = levelFrameHtml('secondaire', theme.pattern, theme.icon);
    const sealIcon = iconEmoji[theme.icon] || '★';
    bodyContent = `
      ${frame}
      <div class="content">
        ${schoolHeader}
        <div class="year">${schoolYearLabel} ${input.period.schoolYear}</div>
        <div class="div"><i></i><b></b><i></i></div>
        <h1>${theme.title}</h1>
        ${theme.subtitle ? `<div class="sub">${theme.subtitle}</div>` : ''}
        <div class="div" style="width:460px;"><i></i><b></b><i></i></div>
        <div class="given">${fill(theme.given, vals)}</div>
        <div class="name">${input.student.fullName}</div>
        <div class="class">${pupilOfClassLabel} ${input.student.className}</div>
        <p class="msg">${input.customMessage || fill(theme.message, vals)}</p>
        ${stat ? `<div class="stat">${stat}</div>` : ''}
        <div class="footer">
          ${sigDirector}
          <div class="verify">
            <div class="seal" style="font-size:50px;">${sealIcon}</div>
            <div class="place">${input.school.city ? `${madeInLabel} ${input.school.city}, ${onLabel} ${dateStr}` : `${onlyDateLabel} ${dateStr}`}</div>
          </div>
          ${sigTeacher}
        </div>
        <div class="qrcorner">
          <div class="qr">${qrSvgStr}</div>
          <div class="vcode">${input.verification.code}</div>
        </div>
      </div>`;
  }

  const htmlLang = lang === 'EN' ? 'en' : 'fr';
  return `<!doctype html><html lang="${htmlLang}"><head><meta charset="utf-8"><title>${theme.title}</title><style>${ALL_CSS}</style></head><body>
    <section class="page ${CLS[theme.level]}" style="${vars(theme.palette)}">
      ${bodyContent}
    </section>
  </body></html>`;
}

// ─── Utility exports ──────────────────────────────────────────────────────
export { resolveDistinction, DEFAULT_RULES, GRADUATION_CODE, makeVerificationCode, verificationUrl, THEMES, BOARD_BASE, BOARD_TITLE, themeFor };
export type { Level, DistinctionCode, DistinctionInput, BoardInput, BoardRow, Lang };

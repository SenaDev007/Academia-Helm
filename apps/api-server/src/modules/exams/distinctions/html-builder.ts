/**
 * ============================================================================
 * DISTINCTIONS HTML BUILDER — Tableau d'honneur (génération HTML directe)
 * ============================================================================
 *
 * Génération HTML string (sans React SSR) qui reproduit EXACTEMENT les
 * templates React d'origine :
 *   - Maternel.tsx   → maternelHtml()
 *   - Primaire.tsx   → primaireHtml()
 *   - Secondaire.tsx → secondaireHtml()
 *   - Board.tsx      → buildBoardHtml()
 *   - shared.tsx     → levelFrame(), schoolHeader(), signature(),
 *                      verifyBlock(), footer(), vars()
 *   - icons.tsx      → icon() — SVG inline remplaçant lucide-react
 *
 * Chaque composant React est transposé en fonction qui retourne la chaîne
 * HTML équivalente, avec les MÊMES classes CSS, la MÊME structure DOM et
 * les MÊMES règles de styling que la version React (cf. css.ts → ALL_CSS).
 *
 * Format A4 paysage (297mm × 210mm). Polices Google Fonts chargées via
 * <link> dans le <head>. QR code via le paquet `qrcode`. Images (logo,
 * photos, signatures) converties en data URIs via `assets.toDataUri` pour
 * un rendu stable hors ligne.
 * ============================================================================
 */

import * as QRCode from 'qrcode';

import { ALL_CSS } from './css';
import { THEMES, BOARD_BASE, BOARD_TITLE, DEFAULT_SIGNERS } from './themes';
import { DEFAULT_RULES, GRADUATION_CODE, resolveDistinction, resolveSpecialAwards } from './rules';
import { makeVerificationCode, makeVerificationCodeWithNonce, generateNonce, verificationUrl } from './security';
import { toDataUri } from './assets';
import { fill, fitFont, fmtAverage, fmtDate, fmtNumber, fmtPct, fmtRank } from './format';
import type {
  BoardInput,
  BoardRow,
  DistinctionCode,
  DistinctionInput,
  IconName,
  Level,
  Palette,
  PreparedDistinction,
  SchoolInfo,
  Theme,
} from './types';

// ─── Échappement HTML ────────────────────────────────────────────────────
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;'
    : c === '<' ? '&lt;'
    : c === '>' ? '&gt;'
    : c === '"' ? '&quot;'
    : '&#39;');
}

// ─── Icônes (SVG inline remplaçant lucide-react) ─────────────────────────
// Les icônes sont rendues en SVG avec stroke="currentColor" pour hériter
// de la couleur du parent (comme le ferait lucide-react). Les chemains SVG
// sont inspirés de lucide-react ; les icônes non listées retombent sur Star.
const ICON_SVG: Partial<Record<IconName, string>> = {
  Star: `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`,
  Sparkles: `<path d="m12 3-1.9 5.8a2 2 0 0 1-1.287 1.288L3 12l5.8 1.9a2 2 0 0 1 1.288 1.287L12 21l1.9-5.8a2 2 0 0 1 1.287-1.288L21 12l-5.8-1.9a2 2 0 0 1-1.288-1.287Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>`,
  Rocket: `<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-3.16.04z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6.91 12-1.13.84-2.81 1.91-3.09 1z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>`,
  Palette: `<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.504 5.555-5.555C21.965 6.012 17.461 2 12 2z"/>`,
  Compass: `<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>`,
  GraduationCap: `<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>`,
  Trophy: `<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>`,
  Medal: `<path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"/><path d="M11 12 5.1 5.9"/><path d="M21 4V8.5"/><path d="M9.5 5H20"/><circle cx="12" cy="15" r="6"/><path d="m13.6 13.5-.8 2.5h2.4l-.8 2.5"/>`,
  Award: `<path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.527"/><circle cx="12" cy="8" r="6"/>`,
  BookOpen: `<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>`,
  Pencil: `<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.499z"/><path d="m15 5 4 4"/>`,
  Heart: `<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>`,
  Crown: `<path d="M2 4l4 8 6-8 6 8 4-8-2 14H4z"/>`,
  Flame: `<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>`,
  TrendingUp: `<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>`,
  CalendarCheck: `<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 16 2 2 4-4"/>`,
  HeartHandshake: `<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="m12 8 4-4M8.5 9.5l4 4-3 3"/>`,
  Puzzle: `<path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568a.95.95 0 0 1 0 1.34l-1.411 1.411a.95.95 0 0 1-1.34 0l-1.606-1.606a.95.95 0 0 0-1.32-.022c-.42.367-1.06.367-1.48 0a.95.95 0 0 0-1.32.022l-1.607 1.606a.95.95 0 0 1-1.34 0L2.43 12.06a.95.95 0 0 1 0-1.34l1.568-1.568a.95.95 0 0 0 .289-.878 3.06 3.06 0 0 1 .778-2.4c.42-.367 1.06-.367 1.48 0a.95.95 0 0 0 1.32-.022l1.606-1.606a.95.95 0 0 1 1.34 0l1.607 1.606a.95.95 0 0 0 1.32.022 3.06 3.06 0 0 1 2.4.778z"/>`,
  Shapes: `<path d="M8.3 10a.7.7 0 0 1-.626-1.43l.7-1.4a.7.7 0 0 1 1.25 0l.7 1.4A.7.7 0 0 1 9.7 10z"/><path d="M6 12h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z"/>`,
  Rainbow: `<path d="M22 17a10 10 0 0 0-20 0"/><path d="M6 17a6 6 0 0 1 12 0"/><path d="M10 17a2 2 0 0 1 4 0"/>`,
  Apple: `<path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"/><path d="M10 2c1 .5 2 2 2 5"/>`,
  Cloud: `<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>`,
  Sun: `<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>`,
  Music: `<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>`,
  Blocks: `<rect width="7" height="7" x="14" y="3" rx="1"/><path d="M10 21V8a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H3"/>`,
  Ruler: `<path d="M21.3 8.7 8.7 21.3a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4L15.3 2.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4Z"/><path d="m7.5 10.5 2 2M10.5 7.5l2 2M13.5 4.5l2 2M4.5 13.5l2 2"/>`,
  Calculator: `<rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01"/>`,
  Globe: `<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/>`,
  Backpack: `<path d="M4 10v4a16 16 0 0 0 16 0v-4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/><path d="M15 14h-6"/>`,
  Library: `<path d="m16 6 4 14M20 6 4 20M14 6 6 14M12 6 4 8"/>`,
  Microscope: `<path d="M6 18h8M3 22h18M14 22a7 7 0 1 0 0-14h-1M14 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/><path d="M11 13h-1a3 3 0 0 1-3-3V7a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a3 3 0 0 1-3 3z"/>`,
  Atom: `<circle cx="12" cy="12" r="1"/><path d="M20.2 20.2c2.04-2.03.02-7.07-4.52-11.61-4.54-4.54-9.58-6.56-11.61-4.52-2.04 2.03-.02 7.07 4.52 11.61 4.54 4.54 9.58 6.56 11.61 4.52Z"/><path d="M3.8 20.2c-2.04-2.03-.02-7.07 4.52-11.61 4.54-4.54 9.58-6.56 11.61-4.52 2.04 2.03.02 7.07-4.52 11.61-4.54 4.54-9.58 6.56-11.61 4.52Z"/>`,
  FlaskConical: `<path d="M10 2v7.31M14 2v7.56M8.5 2h7M5.5 19h13L14 9.5V2M10 9.5 5.5 19z"/>`,
  Landmark: `<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 5 4 5"/>`,
  Scale: `<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>`,
  Sigma: `<path d="M18 7V4H6l6 8-6 8h12v-3"/>`,
  Telescope: `<path d="m3.5 17 1.5-5 5 1.5L13.5 4.5l5 1.5L11 21z"/><path d="M9 11l4 1.5"/>`,
  Leaf: `<path d="M11 20A7 7 0 0 1 4 13c0-6 5-9 13-9-1 6-3 12-9 14a7 7 0 0 1-2 1z"/>`,
  Bird: `<path d="M16 7h.01M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20M20 7l2 .5-2 .5M10 18v3M14 20v3M7 18l3 3"/>`,
  Flower: `<circle cx="12" cy="12" r="3"/><path d="M12 9V5M12 19v-4M9 12H5M19 12h-4M7.05 7.05 9.5 9.5M14.5 14.5l2.45 2.45M16.95 7.05 14.5 9.5M9.5 14.5l-2.45 2.45"/>`,
  Fish: `<path d="M6.5 12c.94-3.5 4.5-7 8.5-7 3.5 0 6.5 3 6.5 7s-3 7-6.5 7c-4 0-7.56-3.5-8.5-7z"/><path d="M6.5 12c-1.5 0-3 .5-3.5 1 .5 1.5 2 2 3.5 2M6.5 12c-1.5 0-3-.5-3.5-1 .5-1.5 2-2 3.5-2"/><path d="M18 12h.01"/>`,
  Cat: `<path d="M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3.1-9-7.56c0-1.25.43-2.43 1-3.44 0 0-1.82-6.42-.42-7 1.39-.58 4.64.74 6.42 2.26.65-.17 1.33-.26 2-.26z"/>`,
  PartyPopper: `<path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01M22 8h.01M15 8h.01M22 3h.01M11 3h.01"/><path d="m2 22 10-10M7.5 7.5 11 11"/>`,
  Hash: `<line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/>`,
};

/** Équivalent string du composant React <Icon /> (lucide-react) */
function icon(
  name: IconName,
  size = 24,
  stroke = 2,
  color = 'currentColor',
  style?: string,
): string {
  const path = ICON_SVG[name] ?? ICON_SVG.Star!;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"${style ? ` style="${style}"` : ''}>${path}</svg>`;
}

// ─── Variables CSS (équivalent string de vars() dans shared.tsx) ─────────
function vars(p: Palette): string {
  return `--primary:${p.primary};--accent:${p.accent};--tint:${p.tint};--ink:${p.ink};--soft:${p.soft}`;
}

// ─── Constantes de layout (identiques à shared.tsx et Board.tsx) ─────────
const CLS: Record<Level, string> = { maternel: 'mat', primaire: 'pri', secondaire: 'sec' };

const TOP: { icon: IconName; color: string }[] = [
  { icon: 'Trophy', color: '#C9A227' },
  { icon: 'Medal', color: '#94A3B8' },
  { icon: 'Award', color: '#B7791F' },
];

export const ROWS_PER_PAGE = 9;

const MAT_SPOTS: [number, number, number, number][] = [
  [70, 70, 54, -14], [190, 46, 38, 10], [62, 210, 40, 12], [900, 62, 50, 14], [1010, 176, 38, -10], [836, 44, 36, 8],
  [70, 520, 48, 10], [182, 604, 38, -12], [952, 530, 52, -10], [1022, 614, 38, 12],
];

const BUBBLES: [number, number, number][] = [
  [-60, -60, 240], [930, -90, 260], [-80, 600, 260], [940, 590, 250], [560, -40, 90], [480, 720, 110],
];

// ─── Composants partagés (transposés depuis shared.tsx) ──────────────────

/** Équivalent string de <SchoolHeader school={...} /> */
function schoolHeader(school: SchoolInfo): string {
  return `<div class="school">${school.logoUrl ? `<img src="${school.logoUrl}" alt="" />` : ''}<span>${esc(school.name)}</span></div>`;
}

/** Équivalent string de <Signature label={...} name={...} img={...} /> */
function signature(label: string, name?: string, img?: string): string {
  return `<div class="sig"><div class="simg">${img ? `<img src="${img}" alt="" />` : ''}</div><div class="line"></div><div class="lbl">${esc(label)}</div>${name ? `<div class="nm">${esc(name)}</div>` : ''}</div>`;
}

/** Équivalent string de <VerifyBlock d={...} withPlace={...} /> */
function verifyBlock(d: PreparedDistinction, withPlace = true): string {
  const place = d.school.city
    ? `Fait à ${esc(d.school.city)}, le ${fmtDate(d.period.issuedOn)}`
    : `Le ${fmtDate(d.period.issuedOn)}`;
  return `<div class="verify"><div class="qr">${d.qrSvg}</div><div class="vcode">${esc(d.verification.code)}</div>${withPlace ? `<div class="place">${place}</div>` : ''}</div>`;
}

/** Équivalent string de <Footer d={...} level={...} center={...} /> */
function footer(d: PreparedDistinction, level: Level, center?: string): string {
  const defaults = DEFAULT_SIGNERS[level];
  return `<div class="footer">${signature(d.school.directorTitle ?? defaults.director, d.school.directorName, d.school.directorSignatureUrl)}${center ?? verifyBlock(d)}${signature(d.school.teacherTitle ?? defaults.teacher, d.school.teacherName, d.school.teacherSignatureUrl)}</div>`;
}

/** Équivalent string de <LevelFrame level={...} pattern={...} watermark={...} /> */
function levelFrame(level: Level, pattern: IconName[], watermark: IconName): string {
  if (level === 'maternel') {
    const bubbles = BUBBLES
      .map(([l, t, s]) => `<div class="bubble" style="left:${l}px;top:${t}px;width:${s}px;height:${s}px"></div>`)
      .join('');
    const spots = MAT_SPOTS
      .map(([l, t, s, r], i) =>
        `<div class="deco" style="left:${l}px;top:${t}px;transform:rotate(${r}deg)">${icon(pattern[i % pattern.length], s, 2.2)}</div>`)
      .join('');
    return `<div class="fr">${bubbles}${spots}<div class="frame"></div></div>`;
  }
  if (level === 'primaire') {
    const left = pattern.slice(0, 5);
    const right = [...pattern].reverse().slice(0, 5);
    return `<div class="fr"><div class="panel"></div><div class="wm">${icon(watermark, 460, 1)}</div><div class="side l">${left.map((n) => icon(n, 38, 1.8)).join('')}</div><div class="side r">${right.map((n) => icon(n, 38, 1.8)).join('')}</div><div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div></div>`;
  }
  // secondaire : guilloché SVG (34 cercles concentriques) + watermark + 3 cadres + 4 ornements
  const circles = Array.from({ length: 34 }, (_, i) => {
    const r = 44 + i * 9;
    return `<circle cx="561.5" cy="413" r="${r}" fill="none" stroke="var(--accent)" stroke-width="0.9" stroke-opacity="${Math.max(0.03, 0.26 * (1 - r / 360))}"/>`;
  }).join('');
  return `<div class="fr"><svg class="guil" viewBox="0 0 1123 794" width="1123" height="794" aria-hidden="true">${circles}</svg><div class="wm">${icon(watermark, 440, 0.8)}</div><div class="f1"></div><div class="f2"></div><div class="f3"></div><div class="orn" style="left:29.5px;top:29.5px"></div><div class="orn" style="right:29.5px;top:29.5px"></div><div class="orn" style="left:29.5px;bottom:29.5px"></div><div class="orn" style="right:29.5px;bottom:29.5px"></div></div>`;
}

// ─── Préparation (QR + images en data URIs) — équivalent assets.prepare() ─
async function prepare(input: DistinctionInput): Promise<PreparedDistinction> {
  const theme = THEMES[input.code];
  const [logoUrl, directorSignatureUrl, teacherSignatureUrl, photoUrl, qrSvg] = await Promise.all([
    toDataUri(input.school.logoUrl),
    toDataUri(input.school.directorSignatureUrl),
    toDataUri(input.school.teacherSignatureUrl),
    toDataUri(input.student.photoUrl),
    QRCode.toString(input.verification.url, {
      type: 'svg',
      margin: 0,
      errorCorrectionLevel: 'M',
      color: { dark: theme.palette.ink, light: '#0000' },
    }).catch(() => ''),
  ]);
  return {
    ...input,
    school: { ...input.school, logoUrl, directorSignatureUrl, teacherSignatureUrl },
    student: { ...input.student, photoUrl },
    qrSvg,
  };
}

// ─── Enveloppe HTML + Google Fonts ────────────────────────────────────────

const FONT_LINK =
  `<link rel="preconnect" href="https://fonts.googleapis.com">` +
  `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` +
  `<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:ital,wght@0,400;0,600;0,700;0,800;1,700;1,800&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Playfair+Display:ital,wght@0,500;0,600;0,700;0,800;1,500;1,700&display=swap" rel="stylesheet">`;

function wrap(body: string, title: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title>${FONT_LINK}<style>${ALL_CSS}</style></head><body>${body}</body></html>`;
}

// ─── Maternel — équivalent Maternel.tsx ──────────────────────────────────
function maternelHtml(d: PreparedDistinction, theme: Theme): string {
  const vals = { periode: d.period.label.toLowerCase(), annee: d.period.schoolYear };
  const r = d.results;
  const stat = d.statOverride ?? (r?.average != null ? `Acquis de la période : ${fmtPct(r.average, r.base)}` : undefined);
  const isGrad = d.code === 'MAT_GRAD';
  const name = d.student.fullName;

  return `<section class="page mat" style="${vars(theme.palette)}">` +
    levelFrame('maternel', theme.pattern, theme.icon) +
    (d.student.photoUrl
      ? `<img class="photo" src="${d.student.photoUrl}" alt="" /><div class="mascot">${icon(theme.pattern[0], 72, 2)}</div>`
      : '') +
    `<div class="content">` +
      schoolHeader(d.school) +
      `<div class="badge-wrap">` +
        `<div class="badge">${icon(theme.icon, 74, 2.2)}</div>` +
        `<span class="spark" style="left:-54px;top:4px">${icon('Sparkles', 34)}</span>` +
        `<span class="spark" style="right:-52px;top:0">${icon('Star', 30, 2.4)}</span>` +
        `<span class="spark" style="left:-84px;top:62px">${icon('Star', 20, 2.4)}</span>` +
        `<span class="spark" style="right:-80px;top:66px">${icon('Sparkles', 24)}</span>` +
      `</div>` +
      (theme.kicker ? `<div class="kicker">${esc(theme.kicker)}</div>` : '') +
      `<h1 style="font-size:${fitFont(theme.title, 820, 60, 0.6, 40)}px">${esc(theme.title)}</h1>` +
      `<div class="given">${esc(fill(theme.given, vals))}</div>` +
      `<div class="name" style="font-size:${fitFont(name, 780, 50, 0.56, 30)}px">${esc(name)}</div>` +
      `<div class="class">${esc(isGrad ? `${d.student.className}, année scolaire ${d.period.schoolYear}` : `${d.student.className}, ${d.period.label}, année scolaire ${d.period.schoolYear}`)}</div>` +
      `<p class="msg">${esc(d.customMessage ?? fill(theme.message, vals))}</p>` +
      (stat
        ? `<div class="score">${icon('Star', 18, 2.4)}${esc(stat)}</div>`
        : isGrad
          ? `<div class="score">${icon('GraduationCap', 18, 2.4)}Passage en classe de CI</div>`
          : '') +
      footer(d, 'maternel') +
    `</div>` +
  `</section>`;
}

// ─── Primaire — équivalent Primaire.tsx ──────────────────────────────────
function primaireHtml(d: PreparedDistinction, theme: Theme): string {
  const vals = { periode: d.period.label.toLowerCase(), annee: d.period.schoolYear };
  const r = d.results;
  const name = d.student.fullName;
  const isGrad = d.code === 'PRI_GRAD';

  let chips: string;
  if (d.statOverride) {
    chips = `<div class="chip">${icon('Star', 18)}${esc(d.statOverride)}</div>`;
  } else {
    chips = '';
    if (r?.average != null) {
      chips += `<div class="chip">${icon('Calculator', 18)}${isGrad ? 'Moyenne annuelle' : 'Moyenne'} : ${fmtAverage(r.average, r.base)}</div>`;
    }
    if (r?.rank != null) {
      chips += `<div class="chip">${icon('Hash', 18)}Rang : ${fmtRank(r.rank, r.classSize)}</div>`;
    }
  }

  return `<section class="page pri" style="${vars(theme.palette)}">` +
    levelFrame('primaire', theme.pattern, theme.icon) +
    `<div class="content">` +
      schoolHeader(d.school) +
      `<div class="medal">${icon(theme.icon, 56, 2.2)}</div>` +
      `<div class="tails"><div class="tail"></div><div class="tail"></div></div>` +
      `<div class="banner" style="font-size:${fitFont(theme.title, 620, 38, 0.66, 24)}px">${esc(theme.title)}</div>` +
      (theme.subtitle ? `<div class="sub">${esc(theme.subtitle)}</div>` : '') +
      `<div class="given">${esc(fill(theme.given, vals))}</div>` +
      `<div class="name" style="font-size:${fitFont(name, 780, 50, 0.6, 30)}px">${esc(name)}</div>` +
      `<div class="class">${esc(isGrad ? `${d.student.className}, année scolaire ${d.period.schoolYear}` : `${d.student.className}, ${d.period.label}, année scolaire ${d.period.schoolYear}`)}</div>` +
      `<div class="chips">${chips}</div>` +
      `<p class="msg">${esc(d.customMessage ?? fill(theme.message, vals))}</p>` +
      footer(d, 'primaire') +
    `</div>` +
  `</section>`;
}

// ─── Secondaire — équivalent Secondaire.tsx ───────────────────────────────
function secondaireHtml(d: PreparedDistinction, theme: Theme): string {
  const vals = { periode: d.period.label.toLowerCase(), annee: d.period.schoolYear };
  const r = d.results;
  const name = d.student.fullName;
  const isGrad = d.code === 'SEC_GRAD';

  let stat = d.statOverride;
  if (!stat && r?.average != null) {
    if (d.code === 'SEC_PROGRES' && r.previousAverage != null) {
      const gain = (r.average - r.previousAverage) / r.base * 20;
      stat = `${r.previousLabel ?? 'Période précédente'} : ${fmtAverage(r.previousAverage, r.base)}   |   ${d.period.label} : ${fmtAverage(r.average, r.base)}   |   +${fmtNumber(gain, 1)} pts sur 20`;
    } else if (isGrad) {
      stat = `Moyenne annuelle : ${fmtAverage(r.average, r.base)}`;
    } else {
      stat = `Moyenne générale : ${fmtAverage(r.average, r.base)}` + (r.rank != null ? `   |   Rang : ${fmtRank(r.rank, r.classSize)}` : '');
    }
  }

  // Center du footer du secondaire : sceau + lieu/date (remplace le VerifyBlock standard)
  const center =
    `<div class="verify">` +
      `<div class="seal">${icon(theme.icon, 50, 1.8)}</div>` +
      `<div class="place">${d.school.city ? `Fait à ${esc(d.school.city)}, le ${fmtDate(d.period.issuedOn)}` : `Le ${fmtDate(d.period.issuedOn)}`}</div>` +
    `</div>`;

  return `<section class="page sec" style="${vars(theme.palette)}">` +
    levelFrame('secondaire', theme.pattern, theme.icon) +
    `<div class="content">` +
      schoolHeader(d.school) +
      `<div class="year">Année scolaire ${esc(d.period.schoolYear)}</div>` +
      `<div class="div"><i></i><b></b><i></i></div>` +
      `<h1 style="font-size:${fitFont(theme.title, 900, 52, 0.76, 28)}px">${esc(theme.title)}</h1>` +
      (theme.subtitle ? `<div class="sub">${esc(theme.subtitle)}</div>` : '') +
      `<div class="div" style="width:460px"><i></i><b></b><i></i></div>` +
      `<div class="given">${esc(fill(theme.given, vals))}</div>` +
      `<div class="name" style="font-size:${fitFont(name, 820, 50, 0.6, 30)}px">${esc(name)}</div>` +
      `<div class="class">Élève de ${esc(d.student.className)}</div>` +
      `<p class="msg">${esc(d.customMessage ?? fill(theme.message, vals))}</p>` +
      (stat ? `<div class="stat">${esc(stat)}</div>` : '') +
      footer(d, 'secondaire', center) +
      `<div class="qrcorner">${verifyBlock(d, false)}</div>` +
    `</div>` +
  `</section>`;
}

// ─── Chunk (équivalent chunk() dans Board.tsx) ────────────────────────────
export function chunk<T>(a: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out.length ? out : [[]];
}

// ─── buildBoardHtml — équivalent Board.tsx ──────────────────────────────
export async function buildBoardHtml(b: BoardInput): Promise<string> {
  // Convertit le logo en data URI pour un rendu stable hors ligne (comme render.tsx)
  const logoUrl = await toDataUri(b.school.logoUrl);
  const board: BoardInput = { ...b, school: { ...b.school, logoUrl } };

  const base = THEMES[BOARD_BASE[board.level]];
  const pages = chunk<BoardRow>(board.rows, ROWS_PER_PAGE);
  const numHead = board.level === 'maternel' ? 'Acquis' : 'Moyenne';

  const pagesHtml = pages.map((rows, pi) => {
    const rowsHtml = rows.map((r) => {
      const t = THEMES[r.code];
      const top = r.rank <= 3 ? TOP[r.rank - 1] : undefined;
      return (
        `<tr>` +
          `<td class="rk">${top ? icon(top.icon, 26, 2.2, top.color) : r.rank}</td>` +
          `<td>${esc(r.fullName)}</td>` +
          `<td class="num">${board.level === 'maternel' ? fmtPct(r.average, board.base) : fmtAverage(r.average, board.base)}</td>` +
          `<td><span class="pill" style="--pc:${t.palette.primary}">${icon(t.icon, 16, 2.4)}${esc(t.shortLabel)}</span></td>` +
        `</tr>`
      );
    }).join('');

    return (
      `<section class="page board ${CLS[board.level]}" style="${vars(base.palette)}">` +
        levelFrame(board.level, base.pattern, base.icon) +
        `<div class="content">` +
          `<div class="head">` +
            `<h1>${esc(BOARD_TITLE[board.level])}</h1>` +
            `<div class="sub2">${esc(board.className)}, ${esc(board.period.label)}, année scolaire ${esc(board.period.schoolYear)}${pages.length > 1 ? `  (page ${pi + 1}/${pages.length})` : ''}</div>` +
          `</div>` +
          `<table>` +
            `<thead><tr><th>Rang</th><th>Élève</th><th class="num">${numHead}</th><th>Mention</th></tr></thead>` +
            `<tbody>${rowsHtml}</tbody>` +
          `</table>` +
          `<div class="foot">${esc(board.school.name)}, généré par Academia Helm</div>` +
        `</div>` +
      `</section>`
    );
  }).join('');

  return wrap(pagesHtml, "Tableau d'honneur");
}

// ─── buildCertificateHtml — aiguillage Maternel/Primaire/Secondaire ──────
export async function buildCertificateHtml(input: DistinctionInput): Promise<string> {
  const d = await prepare(input);
  const theme = THEMES[d.code];
  let body: string;
  switch (theme.level) {
    case 'maternel': body = maternelHtml(d, theme); break;
    case 'primaire': body = primaireHtml(d, theme); break;
    case 'secondaire': body = secondaireHtml(d, theme); break;
    default: body = maternelHtml(d, theme); break;
  }
  return wrap(body, theme.title);
}

// ─── Réexports utilitaires (compatibilité API existante) ────────────────
export {
  // Règles et résolution de distinction
  resolveDistinction,
  resolveSpecialAwards,
  DEFAULT_RULES,
  GRADUATION_CODE,
  // Sécurité : code de vérification HMAC + URL publique
  makeVerificationCode,
  makeVerificationCodeWithNonce,
  generateNonce,
  verificationUrl,
  // Thèmes et libellés
  THEMES,
  BOARD_BASE,
  BOARD_TITLE,
};

export type {
  BoardInput,
  BoardRow,
  DistinctionCode,
  DistinctionInput,
  IconName,
  Level,
  Palette,
  PreparedDistinction,
  SchoolInfo,
  Theme,
};

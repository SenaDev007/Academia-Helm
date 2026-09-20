/**
 * ============================================================================
 * CHART-BUILDERS — Constructeurs SVG de graphiques et diagrammes
 * ============================================================================
 *
 * ⭐ Demande utilisateur : « des tracés vraiment professionnels : graphiques,
 *    repères, proportionnalité, diagrammes circulaires, histogrammes, tous
 *    les types de diagrammes possibles. »
 *
 * Fonctions pures (aucune dépendance React) → testables hors navigateur et
 * partagées entre l'aperçu du GraphChartDialog et l'insertion dans l'éditeur
 * (WYSIWYG garanti : même code, même rendu, écran + export PDF).
 * ============================================================================
 */

export const CHART_PALETTE = ["#3b82f6", "#f59e0b", "#22c55e", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316"];

const AX = "#0f172a";
const GRIDC = "#e2e8f0";

const esc = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rr = (n: number) => Math.round(n * 10) / 10;

function fmtNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100).replace(".", ",");
}

function svgWrap(vbW: number, vbH: number, inner: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" ` +
    `style="max-width:100%;height:auto;background:#ffffff;" role="img">` +
    `<rect x="0" y="0" width="${vbW}" height="${vbH}" fill="#ffffff"/>${inner}</svg>`
  );
}

const txt = (x: number, y: number, s: string, o: { size?: number; color?: string; anchor?: "start" | "middle" | "end"; bold?: boolean; italic?: boolean } = {}) => {
  const { size = 11, color = AX, anchor = "middle", bold = false, italic = false } = o;
  return `<text x="${rr(x)}" y="${rr(y)}" font-size="${size}" fill="${color}" text-anchor="${anchor}" font-family="Arial, Helvetica, sans-serif"${bold ? ' font-weight="bold"' : ""}${italic ? ' font-style="italic"' : ""}>${esc(s)}</text>`;
};

const ln = (x1: number, y1: number, x2: number, y2: number, color: string, w: number, dash?: string) =>
  `<line x1="${rr(x1)}" y1="${rr(y1)}" x2="${rr(x2)}" y2="${rr(y2)}" stroke="${color}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;

function arrow(x1: number, y1: number, x2: number, y2: number, color: string, w: number) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const px = -uy, py = ux;
  const hs = 9;
  const tip = `<polygon points="${x2},${y2} ${x2 - hs * ux + hs * 0.55 * px},${y2 - hs * uy + hs * 0.55 * py} ${x2 - hs * ux - hs * 0.55 * px},${y2 - hs * uy - hs * 0.55 * py}" fill="${color}"/>`;
  return ln(x1, y1, x2 - hs * 0.6, y2 - hs * 0.6, color, w) + tip;
}

/** Échelle « propre » (1-2-2.5-5 × 10^k) au-dessus de maxValue. */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * exp >= v) return m * exp;
  }
  return 10 * exp;
}

/* ── 1. Repère orthogonal interactif ── */
export interface RepPoint { x: number; y: number; label: string }

export interface RepereConfig {
  points: RepPoint[];
  xmax: number;
  ymax: number;
  connect: boolean;   // ligne brisée entre les points
  line: boolean;      // droite passant par les 2 premiers points
  title: string;
}

/** Géométrie du repère (partagée entre le rendu SVG et les clics). */
export function repereGeometry(cfg: { xmax: number; ymax: number; title: string }) {
  const unit = Math.max(14, Math.min(40, Math.floor(Math.min(560 / cfg.xmax, 330 / cfg.ymax))));
  const x0 = 52;
  const top = cfg.title ? 46 : 30;
  const W = Math.round(x0 + cfg.xmax * unit + 42);
  const H = Math.round(top + cfg.ymax * unit + 58);
  const y0 = H - 58;
  return { unit, x0, y0, W, H, top };
}

export function buildRepereSvg(cfg: RepereConfig): string {
  const { unit, x0, y0, W, H, top } = repereGeometry(cfg);
  const gw = cfg.xmax * unit, gh = cfg.ymax * unit;
  const gy = top;

  let s = "";
  // grille
  for (let i = 0; i <= cfg.xmax; i++) s += ln(x0 + i * unit, gy, x0 + i * unit, gy + gh, GRIDC, 1);
  for (let j = 0; j <= cfg.ymax; j++) s += ln(x0, y0 - j * unit, x0 + gw, y0 - j * unit, GRIDC, 1);
  // axes + flèches
  s += arrow(x0 - 10, y0, x0 + gw + 26, y0, AX, 2);
  s += arrow(x0, y0 + 10, x0, gy - 16, AX, 2);
  // graduations + nombres (pas adaptatif)
  const stepX = cfg.xmax > 16 ? 2 : 1;
  const stepY = cfg.ymax > 16 ? 2 : 1;
  for (let i = stepX; i <= cfg.xmax; i += stepX) s += txt(x0 + i * unit, y0 + 16, String(i), { size: 9.5, color: "#64748b" });
  for (let j = stepY; j <= cfg.ymax; j += stepY) s += txt(x0 - 8, y0 - j * unit + 3, String(j), { size: 9.5, color: "#64748b", anchor: "end" });
  s += txt(x0 - 8, y0 + 15, "O", { size: 11, bold: true });
  s += txt(x0 + gw + 20, y0 - 8, "x", { size: 12, italic: true });
  // « y » à droite de la flèche, au-dessus de la grille (sans chevauchement)
  s += txt(x0 + 10, gy - 6, "y", { size: 12, italic: true });

  const px = (x: number) => x0 + x * unit;
  const py = (y: number) => y0 - y * unit;

  // droite passant par les 2 premiers points (proportionnalité…)
  if (cfg.line && cfg.points.length >= 2) {
    const [a, b] = cfg.points;
    const dx = b.x - a.x, dy = b.y - a.y;
    if (dx !== 0 || dy !== 0) {
      let t1 = -Infinity, t2 = Infinity;
      if (dx !== 0) {
        t1 = Math.max(t1, (0 - a.x) / dx);
        t2 = Math.min(t2, (cfg.xmax - a.x) / dx);
      }
      if (dy !== 0) {
        t1 = Math.max(t1, (0 - a.y) / dy);
        t2 = Math.min(t2, (cfg.ymax - a.y) / dy);
      }
      if (t1 < t2) {
        s += ln(px(a.x + dx * t1), py(a.y + dy * t1), px(a.x + dx * t2), py(a.y + dy * t2), "#3b82f6", 2.4);
      }
    }
  }
  // ligne brisée
  if (cfg.connect && cfg.points.length >= 2) {
    s += `<polyline points="${cfg.points.map((p) => `${rr(px(p.x))},${rr(py(p.y))}`).join(" ")}" fill="none" stroke="#3b82f6" stroke-width="2.2"/>`;
  }
  // points
  for (const p of cfg.points) {
    s += `<circle cx="${rr(px(p.x))}" cy="${rr(py(p.y))}" r="4.5" fill="#dc2626"/>`;
    s += txt(px(p.x) + 9, py(p.y) - 8, p.label, { size: 12, color: "#dc2626", bold: true });
  }
  if (cfg.title) s += txt(W / 2, 24, cfg.title, { size: 13, bold: true });
  return svgWrap(W, H, s);
}

/* ── 2. Diagramme en bâtons ── */
export interface DataRow { label: string; value: number }

export function buildBarSvg(rows: DataRow[], title: string, colors: boolean): string {
  const W = 640, H = 420;
  const x0 = 62, y0 = 340, plotW = W - x0 - 24;
  const vmax = niceMax(Math.max(...rows.map((r) => r.value), 1));
  let s = "";
  // grille horizontale + axe y
  const ticks = 5;
  for (let i = 0; i <= ticks; i++) {
    const y = y0 - (i / ticks) * 250;
    s += ln(x0, y, x0 + plotW, y, i === 0 ? AX : GRIDC, i === 0 ? 2 : 1);
    s += txt(x0 - 8, y + 3.5, fmtNum((vmax * i) / ticks), { size: 10, color: "#64748b", anchor: "end" });
  }
  s += arrow(x0 - 8, y0, x0 + plotW + 18, y0, AX, 2);
  s += arrow(x0, y0 + 8, x0, 60, AX, 2);
  const n = rows.length || 1;
  const slot = plotW / n;
  const bw = Math.min(70, slot * 0.55);
  rows.forEach((r, i) => {
    const cx = x0 + slot * (i + 0.5);
    const hgt = (r.value / vmax) * 250;
    const color = colors ? CHART_PALETTE[i % CHART_PALETTE.length] : "#3b82f6";
    s += `<rect x="${rr(cx - bw / 2)}" y="${rr(y0 - hgt)}" width="${rr(bw)}" height="${rr(hgt)}" fill="${color}" fill-opacity="0.88" stroke="${color}" stroke-width="1.5" rx="3"/>`;
    s += txt(cx, y0 - hgt - 8, fmtNum(r.value), { size: 11.5, bold: true });
    s += txt(cx, y0 + 18, r.label, { size: 10.5 });
  });
  if (title) s += txt(W / 2, 24, title, { size: 13.5, bold: true });
  return svgWrap(W, H, s);
}

/* ── 3. Diagramme circulaire ── */
export function buildPieSvg(rows: DataRow[], title: string): string {
  const W = 640, H = 400;
  const cx = 165, cy = 215, rp = 118;
  const total = rows.reduce((n, r) => n + (r.value || 0), 0) || 1;
  let s = "";
  let cum = 90; // départ en haut, sens horaire
  rows.forEach((r, i) => {
    const frac = r.value / total;
    const a1 = cum;
    const a2 = cum - frac * 360;
    cum = a2;
    const p1 = [cx + rp * Math.cos((a1 * Math.PI) / 180), cy - rp * Math.sin((a1 * Math.PI) / 180)];
    const p2 = [cx + rp * Math.cos((a2 * Math.PI) / 180), cy - rp * Math.sin((a2 * Math.PI) / 180)];
    const large = frac > 0.5 ? 1 : 0;
    const color = CHART_PALETTE[i % CHART_PALETTE.length];
    s += `<path d="M ${rr(cx)} ${rr(cy)} L ${rr(p1[0])} ${rr(p1[1])} A ${rp} ${rp} 0 ${large} 1 ${rr(p2[0])} ${rr(p2[1])} Z" fill="${color}" fill-opacity="0.88" stroke="#ffffff" stroke-width="2"/>`;
    // pourcentage sur le secteur
    const mid = (a1 + a2) / 2;
    const lp = [cx + rp * 0.62 * Math.cos((mid * Math.PI) / 180), cy - rp * 0.62 * Math.sin((mid * Math.PI) / 180)];
    if (frac >= 0.045) {
      s += txt(lp[0], lp[1] + 4, `${Math.round(frac * 100)} %`, { size: 12, color: "#ffffff", bold: true });
    }
  });
  s += `<circle cx="${cx}" cy="${cy}" r="${rp}" fill="none" stroke="#cbd5e1" stroke-width="1.5"/>`;
  // légende
  const lx = 330, ly0 = 92;
  rows.forEach((r, i) => {
    const y = ly0 + i * 34;
    const color = CHART_PALETTE[i % CHART_PALETTE.length];
    s += `<rect x="${lx}" y="${y - 11}" width="18" height="18" rx="4" fill="${color}"/>`;
    s += txt(lx + 28, y + 3, r.label, { size: 12, anchor: "start" });
    s += txt(lx + 250, y + 3, `${fmtNum(r.value)}  (${Math.round((r.value / total) * 100)} %)`, { size: 12, anchor: "end", color: "#475569" });
  });
  if (title) s += txt(W / 2, 24, title, { size: 13.5, bold: true });
  return svgWrap(W, H, s);
}

/* ── 4. Histogramme ── */
export function buildHistoSvg(rows: DataRow[], title: string): string {
  const W = 640, H = 420;
  const x0 = 62, y0 = 340, plotW = W - x0 - 24;
  const vmax = niceMax(Math.max(...rows.map((r) => r.value), 1));
  let s = "";
  const ticks = 5;
  for (let i = 0; i <= ticks; i++) {
    const y = y0 - (i / ticks) * 250;
    s += ln(x0, y, x0 + plotW, y, i === 0 ? AX : GRIDC, i === 0 ? 2 : 1);
    s += txt(x0 - 8, y + 3.5, fmtNum((vmax * i) / ticks), { size: 10, color: "#64748b", anchor: "end" });
  }
  s += arrow(x0 - 8, y0, x0 + plotW + 18, y0, AX, 2);
  s += arrow(x0, y0 + 8, x0, 60, AX, 2);
  const n = rows.length || 1;
  const bw = plotW / n;
  rows.forEach((r, i) => {
    const x = x0 + i * bw;
    const hgt = (r.value / vmax) * 250;
    s += `<rect x="${rr(x)}" y="${rr(y0 - hgt)}" width="${rr(bw)}" height="${rr(hgt)}" fill="#3b82f6" fill-opacity="0.75" stroke="#1d4ed8" stroke-width="1.5"/>`;
    s += txt(x + bw / 2, y0 - hgt - 8, fmtNum(r.value), { size: 11.5, bold: true });
    s += txt(x + bw / 2, y0 + 18, r.label, { size: 10.5 });
    if (i > 0) s += ln(x, y0 - 6, x, y0 + 6, AX, 1.6);
  });
  if (title) s += txt(W / 2, 24, title, { size: 13.5, bold: true });
  return svgWrap(W, H, s);
}

/* ── 5. Courbe ── */
export function buildLineSvg(rows: DataRow[], title: string): string {
  const W = 640, H = 420;
  const x0 = 62, y0 = 340, plotW = W - x0 - 40;
  const vmax = niceMax(Math.max(...rows.map((r) => r.value), 1));
  let s = "";
  const ticks = 5;
  for (let i = 0; i <= ticks; i++) {
    const y = y0 - (i / ticks) * 250;
    s += ln(x0, y, x0 + plotW, y, i === 0 ? AX : GRIDC, i === 0 ? 2 : 1);
    s += txt(x0 - 8, y + 3.5, fmtNum((vmax * i) / ticks), { size: 10, color: "#64748b", anchor: "end" });
  }
  s += arrow(x0 - 8, y0, x0 + plotW + 22, y0, AX, 2);
  s += arrow(x0, y0 + 8, x0, 60, AX, 2);
  const n = rows.length;
  if (n >= 2) {
    const pts = rows.map((r, i) => {
      const x = x0 + (plotW * (i + 0.5)) / n;
      const y = y0 - (r.value / vmax) * 250;
      return [x, y] as [number, number];
    });
    s += `<polyline points="${pts.map((p) => `${rr(p[0])},${rr(p[1])}`).join(" ")}" fill="none" stroke="#3b82f6" stroke-width="2.6"/>`;
    rows.forEach((r, i) => {
      s += `<circle cx="${rr(pts[i][0])}" cy="${rr(pts[i][1])}" r="4.5" fill="#dc2626"/>`;
      s += txt(pts[i][0], pts[i][1] - 10, fmtNum(r.value), { size: 10.5, bold: true, color: "#dc2626" });
      s += txt(pts[i][0], y0 + 18, r.label, { size: 10 });
    });
  }
  if (title) s += txt(W / 2, 24, title, { size: 13.5, bold: true });
  return svgWrap(W, H, s);
}

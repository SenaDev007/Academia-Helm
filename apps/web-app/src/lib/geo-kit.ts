/**
 * ============================================================================
 * GEO-KIT — Kit de construction de figures géométriques SVG
 * ============================================================================
 * ⭐ Demande utilisateur : couvrir TOUTES les figures de la géométrie de la
 *    maternelle au CM2 (triangles, polygones, droites, segments, angles,
 *    solides, symétrie…) avec les CODAGES pédagogiques officiels :
 *    - traits (ticks) sur les côtés de même longueur
 *    - petit carré pour l'angle droit
 *    - chevrons pour les côtés parallèles
 *    - arcs pour les angles
 *
 * Toutes les figures produites sont du SVG pur (viewBox), insérées en inline
 * dans les éditeurs : rendu identique écran + export PDF (Puppeteer).
 * ============================================================================
 */

export const BLUE = "#1d4ed8";
export const RED = "#dc2626";
export const DARK = "#0f172a";
export const GREEN = "#16a34a";
export const PURPLE = "#7c3aed";
export const GRAY = "#94a3b8";
export const LIGHTBLUE = "#dbeafe";
export const LIGHTRED = "#fee2e2";
export const LIGHTGREEN = "#dcfce7";
export const LIGHTYELLOW = "#fef9c3";
export const LIGHTPURPLE = "#ede9fe";

/** viewBox par défaut d'une figure (paysage). */
export const VB = "0 0 240 170";

export const r = (n: number) => Math.round(n * 10) / 10;
export type Pt = [number, number];

/* ── Attributs de trait ── */
export const st = (stroke = BLUE, w = 2.5) => `fill="none" stroke="${stroke}" stroke-width="${w}"`;
export const fill = (c: string, stroke = BLUE, w = 2.5) => `fill="${c}" stroke="${stroke}" stroke-width="${w}"`;

/* ── Primitives ── */
export const line = (x1: number, y1: number, x2: number, y2: number, attrs = st()) =>
  `<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}" ${attrs}/>`;

export const poly = (pts: Pt[], attrs = st()) =>
  `<polygon points="${pts.map((p) => `${r(p[0])},${r(p[1])}`).join(" ")}" ${attrs}/>`;

export const polyline = (pts: Pt[], attrs = st()) =>
  `<polyline points="${pts.map((p) => `${r(p[0])},${r(p[1])}`).join(" ")}" ${attrs}/>`;

export const circle = (cx: number, cy: number, rr: number, attrs = st()) =>
  `<circle cx="${r(cx)}" cy="${r(cy)}" r="${r(rr)}" ${attrs}/>`;

export const ellipse = (cx: number, cy: number, rx: number, ry: number, attrs = st()) =>
  `<ellipse cx="${r(cx)}" cy="${r(cy)}" rx="${r(rx)}" ry="${r(ry)}" ${attrs}/>`;

export const path = (d: string, attrs = st()) => `<path d="${d}" ${attrs}/>`;

export interface TextOpts {
  size?: number;
  color?: string;
  anchor?: "start" | "middle" | "end";
  bold?: boolean;
  italic?: boolean;
}
export const text = (x: number, y: number, s: string, o: TextOpts = {}) => {
  const { size = 15, color = DARK, anchor = "middle", bold = false, italic = false } = o;
  return (
    `<text x="${r(x)}" y="${r(y)}" font-size="${size}" fill="${color}" text-anchor="${anchor}" ` +
    `font-family="Arial, Helvetica, sans-serif"${bold ? ' font-weight="bold"' : ""}${italic ? ' font-style="italic"' : ""}>` +
    `${escXml(s)}</text>`
  );
};

export const escXml = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Point (sommet) avec petit disque plein. */
export const dot = (x: number, y: number, rr = 3.5, color = DARK) =>
  `<circle cx="${r(x)}" cy="${r(y)}" r="${rr}" fill="${color}"/>`;

/* ── Géométrie ── */
const norm = (x1: number, y1: number, x2: number, y2: number) => {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  return { dx: dx / len, dy: dy / len, len };
};

/** Point sur un cercle (angle en degrés, convention math : 0° = Est, sens anti-horaire). */
export const pol = (cx: number, cy: number, rr: number, deg: number): Pt => [
  cx + rr * Math.cos((deg * Math.PI) / 180),
  cy - rr * Math.sin((deg * Math.PI) / 180),
];

/** Sommets d'un polygone régulier à n côtés. */
export const regPts = (cx: number, cy: number, rr: number, n: number, startDeg = -90): Pt[] =>
  Array.from({ length: n }, (_, i) => pol(cx, cy, rr, startDeg + (360 / n) * i));

/** Arc de cercle (a1 → a2 en degrés math, anti-horaire). */
export const arcPath = (cx: number, cy: number, rr: number, a1: number, a2: number) => {
  const p1 = pol(cx, cy, rr, a1);
  const p2 = pol(cx, cy, rr, a2);
  const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
  return `M ${r(p1[0])} ${r(p1[1])} A ${r(rr)} ${r(rr)} 0 ${large} 0 ${r(p2[0])} ${r(p2[1])}`;
};

/** Arc d'ellipse (a1 → a2 en degrés math, anti-horaire écran). */
export const eArc = (cx: number, cy: number, rx: number, ry: number, a1: number, a2: number, attrs = st()) => {
  const pt = (deg: number): Pt => [cx + rx * Math.cos((deg * Math.PI) / 180), cy - ry * Math.sin((deg * Math.PI) / 180)];
  const p1 = pt(a1);
  const p2 = pt(a2);
  const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
  return `<path d="M ${r(p1[0])} ${r(p1[1])} A ${r(rx)} ${r(ry)} 0 ${large} 0 ${r(p2[0])} ${r(p2[1])}" ${attrs}/>`;
};

/** Secteur circulaire (camembert) rempli. */
export const sectorPath = (cx: number, cy: number, rr: number, a1: number, a2: number) => {
  const p1 = pol(cx, cy, rr, a1);
  const p2 = pol(cx, cy, rr, a2);
  const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
  return `M ${r(cx)} ${r(cy)} L ${r(p1[0])} ${r(p1[1])} A ${r(rr)} ${r(rr)} 0 ${large} 0 ${r(p2[0])} ${r(p2[1])} Z`;
};

/* ── CODAGES PÉDAGOGIQUES ── */

/**
 * Traits de codage d'égalité de longueurs : n petits traits perpendiculaires
 * au milieu du segment [x1y1 ; x2y2] (1 trait = 1 « groupe » de côtés égaux).
 */
export const ticks = (x1: number, y1: number, x2: number, y2: number, n = 1, size = 7, color = DARK, w = 2) => {
  const { dx, dy } = norm(x1, y1, x2, y2);
  const px = -dy, py = dx; // perpendiculaire
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const gap = 8;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * gap;
    const cx = mx + dx * off, cy = my + dy * off;
    out.push(line(cx - px * size, cy - py * size, cx + px * size, cy + py * size, st(color, w)));
  }
  return out.join("");
};

/** Petit carré de codage de l'angle droit au sommet (vx,vy) entre les directions vers p1 et p2. */
export const rightAngleMark = (
  vx: number, vy: number, p1: Pt, p2: Pt, s = 13, color = DARK,
) => {
  const u1 = norm(vx, vy, p1[0], p1[1]);
  const u2 = norm(vx, vy, p2[0], p2[1]);
  const a: Pt = [vx + u1.dx * s, vy + u1.dy * s];
  const b: Pt = [vx + (u1.dx + u2.dx) * s, vy + (u1.dy + u2.dy) * s];
  const c: Pt = [vx + u2.dx * s, vy + u2.dy * s];
  return polyline([a, b, c], st(color, 1.8));
};

/** Chevrons de codage de parallélisme sur une droite (angle de la droite en degrés). */
export const chevrons = (x: number, y: number, angleDeg: number, n = 1, color = DARK) => {
  const a = (angleDeg * Math.PI) / 180;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const cx = x + i * 11 * Math.cos(a), cy = y + i * 11 * Math.sin(a);
    const p1: Pt = [cx - 10 * Math.cos(a) + 5 * Math.sin(a), cy - 10 * Math.sin(a) - 5 * Math.cos(a)];
    const p2: Pt = [cx, cy];
    const p3: Pt = [cx - 10 * Math.cos(a) - 5 * Math.sin(a), cy - 10 * Math.sin(a) + 5 * Math.cos(a)];
    out.push(polyline([p1, p2, p3], st(color, 2)));
  }
  return out.join("");
};

/** Ligne avec une (ou deux) flèche(s) — droites, demi-droites, axes. */
export const arrowLine = (x1: number, y1: number, x2: number, y2: number, attrs = st(), both = false, hs = 10) => {
  const color = attrs.match(/stroke="(.*?)"/)?.[1] || BLUE;
  const { dx, dy } = norm(x1, y1, x2, y2);
  const px = -dy, py = dx;
  const head = (ex: number, ey: number, s: number) =>
    poly([
      [ex, ey],
      [ex - s * dx + s * 0.55 * px, ey - s * dy + s * 0.55 * py],
      [ex - s * dx - s * 0.55 * px, ey - s * dy - s * 0.55 * py],
    ], `fill="${color}"`);
  const tip = head(x2, y2, hs);
  const tail = head(x1, y1, -hs);
  if (!both) return line(x1 + dx * (hs * 0.7), y1 + dy * (hs * 0.7), x2, y2, attrs) + tip;
  return line(x1, y1, x2, y2, attrs) + tip + tail;
};

/* ── Quadrillage / repère ── */
/** Grille légère de x0..x1 × y0..y1 avec pas `step`. */
export const grid = (x0: number, y0: number, w: number, h: number, step = 20, color = "#e2e8f0") => {
  const out: string[] = [];
  for (let x = x0; x <= x0 + w + 0.01; x += step) out.push(line(x, y0, x, y0 + h, st(color, 1)));
  for (let y = y0; y <= y0 + h + 0.01; y += step) out.push(line(x0, y, x0 + w, y, st(color, 1)));
  return out.join("");
};

export const dash = (w = 2) => `fill="none" stroke="${GRAY}" stroke-width="${w}" stroke-dasharray="6 5"`;
export const dashColor = (color: string, w = 2, arr = "6 5") =>
  `fill="none" stroke="${color}" stroke-width="${w}" stroke-dasharray="${arr}"`;

/* ── Étiquettes de sommets (A, B, C…) placées à l'extérieur ── */
export const vertexLabel = (p: Pt, label: string, dx: number, dy: number, color = DARK, size = 15) =>
  text(p[0] + dx, p[1] + dy, label, { size, color, bold: true });

/* ── Angles ── */
/** Angle (degrés math, 0° = Est, anti-horaire) de la demi-droite v → p. */
export const angleOf = (v: Pt, p: Pt): number =>
  (Math.atan2(-(p[1] - v[1]), p[0] - v[0]) * 180) / Math.PI;

export const norm360 = (d: number) => {
  let x = d;
  while (x < 0) x += 360;
  while (x >= 360) x -= 360;
  return x;
};

/** Arc intérieur (petit) entre deux demi-droites issues du sommet v. */
export const innerArc = (v: Pt, p1: Pt, p2: Pt, rr: number, color = RED, w = 2) => {
  const a1 = norm360(angleOf(v, p1));
  const a2 = norm360(angleOf(v, p2));
  const diff = Math.abs(a1 - a2) > 180 ? 360 - Math.abs(a1 - a2) : Math.abs(a1 - a2);
  const start = Math.min(a1, a2);
  return path(arcPath(v[0], v[1], rr, start, start + diff), st(color, w));
};

/* ── Types publics ── */
export interface GeoFigureItem {
  slug: string;
  label: string;
  keywords: string;
  /** SVG interne (sans enveloppe <svg>) */
  svg: string;
  /** viewBox (défaut « 0 0 240 170 ») */
  vb?: string;
}
export interface GeoFigureCategory {
  id: string;
  label: string;
  description: string;
  chip: string;
  items: GeoFigureItem[];
}

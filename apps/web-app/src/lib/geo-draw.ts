/**
 * ============================================================================
 * GEO-DRAW — Géométrie pure pour l'éditeur de figures (angles + symétries)
 * ============================================================================
 *
 * ⭐ Retour utilisateur (2026-09-20) : « au niveau des angles, il n'y a pas
 *    possibilité de faire d'autres catégories d'angles, c'est seulement le
 *    90° (…) et il faut également les symétries, les différents schémas de
 *    symétrie. »
 *
 * Fonctions PURES (aucune dépendance React) utilisées par
 * DiagramEditorDialog :
 *   • Angles de TOUTES les catégories : nul (< 90°… non : 0°), aigu
 *     (< 90°), droit (90°), obtus (90°-180°), plat (180°), rentrant
 *     (> 180°) — l'outil angle suit le curseur et la mesure est affichée ;
 *     un aimant (pas de 1°/5°/15°) donne des valeurs « propres ».
 *   • Réflexions pour les schémas de symétrie : axiale (axe vertical,
 *     horizontal, oblique) et centrale.
 *
 * Convention : axe y vers le BAS (coordonnées écran SVG). Les angles sont
 * mesurés dans le sens TRIGONOMÉTRIQUE (sens inverse des aiguilles d'une
 * montre à l'écran) de [0 ; 360[.
 * ============================================================================
 */

export interface Pt {
  x: number;
  y: number;
}

/* ════════════════════════ ANGLES ════════════════════════ */

/** Angle (en degrés, sens trigonométrique, [0 ; 360[) du vecteur v→p par rapport à l'horizontale (droite). */
export function dirAngle(v: Pt, p: Pt): number {
  const a = (Math.atan2(-(p.y - v.y), p.x - v.x) * 180) / Math.PI;
  return (a + 360) % 360;
}

/** Angle de b1 vers b2 autour du sommet v, mesuré dans le sens trigonométrique, [0 ; 360[. */
export function angleCCW(v: Pt, b1: Pt, b2: Pt): number {
  const a1 = (Math.atan2(-(b1.y - v.y), b1.x - v.x) * 180) / Math.PI;
  const a2 = (Math.atan2(-(b2.y - v.y), b2.x - v.x) * 180) / Math.PI;
  return (a2 - a1 + 720) % 360;
}

/** Aimante un angle (degrés) au multiple de `step` le plus proche. step <= 0 → libre. */
export function snapAngle(deg: number, step: number): number {
  if (!step || step <= 0) return ((deg % 360) + 360) % 360;
  const snapped = Math.round(deg / step) * step;
  return ((snapped % 360) + 360) % 360;
}

/**
 * Construit les deux bras d'un angle de `deg` degrés (sens trigonométrique,
 * 1er bras horizontal vers la droite), chacun de longueur L, sommet v.
 */
export function angleArms(v: Pt, deg: number, L: number): { b1: Pt; b2: Pt } {
  const rad = (deg * Math.PI) / 180;
  return {
    b1: { x: v.x + L, y: v.y },
    b2: { x: v.x + L * Math.cos(rad), y: v.y - L * Math.sin(rad) },
  };
}

/** Point sur le cercle de centre v, rayon r, à l'angle trigonométrique deg. */
export function polar(v: Pt, deg: number, r: number): Pt {
  const rad = (deg * Math.PI) / 180;
  return { x: v.x + r * Math.cos(rad), y: v.y - r * Math.sin(rad) };
}

/** Catégorie scolaire d'un angle (pour l'étiquette des préréglages). */
export function angleCategory(deg: number): string {
  if (deg === 0) return "angle nul";
  if (deg < 90) return "angle aigu";
  if (deg === 90) return "angle droit";
  if (deg < 180) return "angle obtus";
  if (deg === 180) return "angle plat";
  return "angle rentrant";
}

/* ════════════════════════ SYMÉTRIES ════════════════════════ */

/** Symétrie axiale — axe VERTICAL x = ax. */
export function reflectX(p: Pt, ax: number): Pt {
  return { x: 2 * ax - p.x, y: p.y };
}

/** Symétrie axiale — axe HORIZONTAL y = ay. */
export function reflectY(p: Pt, ay: number): Pt {
  return { x: p.x, y: 2 * ay - p.y };
}

/** Symétrie axiale — axe passant par o, de direction (dx, dy) (non nulle). */
export function reflectLine(p: Pt, o: Pt, dx: number, dy: number): Pt {
  const len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  const vx = p.x - o.x, vy = p.y - o.y;
  const dot = vx * ux + vy * uy;
  return { x: o.x + 2 * dot * ux - vx, y: o.y + 2 * dot * uy - vy };
}

/** Symétrie CENTRALE de centre o. */
export function centralSym(p: Pt, o: Pt): Pt {
  return { x: 2 * o.x - p.x, y: 2 * o.y - p.y };
}

/* ════════════════════════ FIGURES POUR SCHÉMAS ════════════════════════ */

/**
 * Figure asymétrique « en L » (points alignés sur la grille 20 px) pour les
 * schémas de symétrie — volontairement ASYMÉTRIQUE pour que l'image
 * symétrique soit visuellement distincte.
 */
export const L_SHAPE: Pt[] = [
  { x: 260, y: 140 }, { x: 260, y: 280 }, { x: 380, y: 280 },
  { x: 380, y: 220 }, { x: 320, y: 220 }, { x: 320, y: 140 },
];

/** Maison (pentagone) — autre figure usuelle des exercices de symétrie. */
export const HOUSE_SHAPE: Pt[] = [
  { x: 200, y: 60 }, { x: 200, y: 160 }, { x: 320, y: 160 }, { x: 320, y: 60 },
  { x: 260, y: 20 },
];

/** Rectangle pour la symétrie centrale. */
export const RECT_SHAPE: Pt[] = [
  { x: 240, y: 100 }, { x: 320, y: 100 }, { x: 320, y: 180 }, { x: 240, y: 180 },
];

/** Applique une réflexion à tous les points d'une figure. */
export function mapPts(pts: Pt[], f: (p: Pt) => Pt): Pt[] {
  return pts.map(f);
}

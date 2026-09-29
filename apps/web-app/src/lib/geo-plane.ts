/**
 * ============================================================================
 * GEO-PLANE — Figures planes (1/2) : maternelle, triangles, quadrilatères
 * ============================================================================
 */

import {
  BLUE, RED, DARK, GREEN, GRAY,
  LIGHTBLUE, LIGHTRED, LIGHTGREEN, LIGHTYELLOW, LIGHTPURPLE,
  st, fill, line, poly, polyline, circle, ellipse, path, text, dot,
  ticks, rightAngleMark, chevrons, regPts, pol, arcPath, sectorPath,
  angleOf, norm360, innerArc,
} from "./geo-kit";
import type { GeoFigureCategory, Pt } from "./geo-kit";

const c = (x: number, y: number): Pt => [x, y];

/* ═══════════════ 1. FORMES DE BASE — MATERNELLE ═══════════════ */

export const maternelleShapes: GeoFigureCategory = {
  id: "formes-base",
  label: "Formes de base — Maternelle",
  description: "Rond, carré, triangle, ovale, étoile… les premières formes (PS→GS)",
  chip: "bg-amber-100 text-amber-700",
  items: [
    { slug: "rond", label: "Le rond (cercle)", keywords: "rond cercle maternelle forme ps ms gs",
      svg: circle(120, 85, 62, fill("#fde68a", "#f59e0b", 4)) },
    { slug: "carre-basic", label: "Le carré", keywords: "carre quatre cotes maternelle forme",
      svg: poly([c(55, 25), c(185, 25), c(185, 155), c(55, 155)], fill("#bfdbfe", "#3b82f6", 4)) },
    { slug: "triangle-basic", label: "Le triangle", keywords: "triangle trois cotes maternelle forme",
      svg: poly([c(30, 150), c(120, 20), c(210, 150)], fill("#fecaca", "#ef4444", 4)) },
    { slug: "rectangle-basic", label: "Le rectangle", keywords: "rectangle maternelle forme",
      svg: poly([c(35, 45), c(205, 45), c(205, 125), c(35, 125)], fill("#bbf7d0", "#22c55e", 4)) },
    { slug: "ovale", label: "L'ovale (ellipse)", keywords: "ovale ellipse maternelle forme",
      svg: ellipse(120, 85, 80, 50, fill("#ddd6fe", "#8b5cf6", 4)) },
    { slug: "losange-basic", label: "Le losange", keywords: "losange maternelle forme",
      svg: poly([c(120, 15), c(195, 85), c(120, 155), c(45, 85)], fill("#fed7aa", "#f97316", 4)) },
    { slug: "etoile", label: "L'étoile", keywords: "etoile maternelle forme",
      svg: (() => {
        const outer = regPts(120, 88, 72, 5, -90);
        const inner = Array.from({ length: 5 }, (_, i) => pol(120, 88, 30, -54 + 72 * i));
        const pts: Pt[] = [];
        for (let i = 0; i < 5; i++) pts.push(outer[i], inner[i]);
        return poly(pts, fill("#fef08a", "#eab308", 3));
      })() },
    { slug: "coeur", label: "Le cœur", keywords: "coeur maternelle forme",
      svg: path("M 120 150 C 55 105 50 55 90 47 C 108 43 118 62 120 72 C 122 62 132 43 150 47 C 190 55 185 105 120 150 Z", fill("#fecdd3", "#f43f5e", 3)) },
    { slug: "croix", label: "La croix", keywords: "croix plus maternelle forme",
      svg: path("M 95 20 h 50 v 45 h 45 v 50 h -45 v 45 h -50 v -45 h -45 v -50 h 45 Z", fill("#cffafe", "#06b6d4", 3)) },
    { slug: "demi-disque", label: "Le demi-disque", keywords: "demi disque moitie maternelle",
      svg: path("M 40 120 A 80 80 0 0 1 200 120 Z", fill("#fbcfe8", "#ec4899", 3)) },
    { slug: "secteur", label: "Le secteur (part de camembert)", keywords: "secteur camembert part fraction maternelle",
      svg: path(`M 120 100 L ${pol(120, 100, 75, -30).join(" ")} A 75 75 0 0 0 ${pol(120, 100, 75, 60).join(" ")} Z`, fill("#fde68a", "#f59e0b", 3)) },
    { slug: "formes-usuelles", label: "Panneau des formes usuelles", keywords: "formes usuelles tableau synthese maternelle affiche rond carre triangle rectangle losange etoile",
      vb: "0 0 480 150",
      svg: (() => {
        const cell = (x: number, shape: string, name: string) => {
          const cy = 55;
          let s = "";
          if (shape === "rond") s = circle(x + 40, cy, 32, fill("#fde68a", "#f59e0b", 3));
          if (shape === "carre") s = poly([c(x + 12, cy - 32), c(x + 68, cy - 32), c(x + 68, cy + 32), c(x + 12, cy + 32)], fill("#bfdbfe", "#3b82f6", 3));
          if (shape === "triangle") s = poly([c(x + 5, cy + 32), c(x + 40, cy - 32), c(x + 75, cy + 32)], fill("#fecaca", "#ef4444", 3));
          if (shape === "rectangle") s = poly([c(x + 4, cy - 22), c(x + 76, cy - 22), c(x + 76, cy + 22), c(x + 4, cy + 22)], fill("#bbf7d0", "#22c55e", 3));
          if (shape === "losange") s = poly([c(x + 40, cy - 34), c(x + 72, cy), c(x + 40, cy + 34), c(x + 8, cy)], fill("#fed7aa", "#f97316", 3));
          if (shape === "etoile") {
            const o = regPts(x + 40, cy, 34, 5, -90);
            const i2 = Array.from({ length: 5 }, (_, k) => pol(x + 40, cy, 14, -54 + 72 * k));
            const pts: Pt[] = [];
            for (let k = 0; k < 5; k++) pts.push(o[k], i2[k]);
            s = poly(pts, fill("#fef08a", "#eab308", 2.5));
          }
          return s + text(x + 40, 130, name, { size: 13, color: DARK, bold: true });
        };
        return (
          cell(10, "rond", "le rond") + cell(90, "carre", "le carré") + cell(170, "triangle", "le triangle") +
          cell(250, "rectangle", "le rectangle") + cell(330, "losange", "le losange") + cell(410, "etoile", "l'étoile")
        );
      })() },
  ],
};

/* ═══════════════ 2. TRIANGLES ═══════════════ */

/** Dessine un triangle nommé avec sommets étiquetés. */
function tri(p1: Pt, p2: Pt, p3: Pt, names: [string, string, string], extra = "") {
  return poly([p1, p2, p3], st()) + dot(p1[0], p1[1]) + dot(p2[0], p2[1]) + dot(p3[0], p3[1]) + extra +
    labelOut(p1, names[0]) + labelOut(p2, names[1]) + labelOut(p3, names[2]);
}
/** Étiquette de sommet placée vers l'extérieur du triangle. */
function labelOut(p: Pt, name: string) {
  return text(p[0], p[1], name, { size: 15, color: DARK, bold: true });
}

export const triangles: GeoFigureCategory = {
  id: "triangles",
  label: "Triangles",
  description: "Toutes les familles : quelconque, isocèle, équilatéral, rectangle, acutangle, obtusangle…",
  chip: "bg-blue-100 text-blue-700",
  items: [
    { slug: "triangle-quelconque", label: "Triangle quelconque (scalène)", keywords: "triangle quelconque scalene trois cotes differents",
      svg: tri(c(40, 145), c(200, 145), c(85, 25), ["A", "B", "C"]) },
    { slug: "triangle-isocele", label: "Triangle isocèle", keywords: "triangle isocele deux cotes egaux codage",
      vb: "0 0 240 185",
      svg: (() => {
        const p1 = c(40, 145), p2 = c(200, 145), p3 = c(120, 30);
        return tri(p1, p2, p3, ["B", "C", "A"],
          ticks(p3[0], p3[1], p1[0], p1[1], 1) + ticks(p3[0], p3[1], p2[0], p2[1], 1) +
          text(120, 178, "AB = AC", { size: 13, color: RED }));
      })() },
    { slug: "triangle-equilateral", label: "Triangle équilatéral", keywords: "triangle equilateral trois cotes egaux codage",
      svg: (() => {
        const p1 = c(45, 145), p2 = c(195, 145), p3 = c(120, 15);
        return tri(p1, p2, p3, ["A", "B", "C"],
          ticks(p1[0], p1[1], p3[0], p3[1], 1) + ticks(p3[0], p3[1], p2[0], p2[1], 1) + ticks(p2[0], p2[1], p1[0], p1[1], 1));
      })() },
    { slug: "triangle-rectangle", label: "Triangle rectangle", keywords: "triangle rectangle angle droit 90 codage",
      svg: (() => {
        const p1 = c(40, 145), p2 = c(200, 145), p3 = c(40, 30);
        return tri(p1, p2, p3, ["B", "C", "A"], rightAngleMark(p1[0], p1[1], p2, p3));
      })() },
    { slug: "triangle-rectangle-isocele", label: "Triangle rectangle isocèle", keywords: "triangle rectangle isocele demi carre codage",
      svg: (() => {
        const p1 = c(50, 145), p2 = c(185, 145), p3 = c(50, 10);
        return tri(p1, p2, p3, ["B", "C", "A"],
          rightAngleMark(p1[0], p1[1], p2, p3) +
          ticks(p1[0], p1[1], p3[0], p3[1], 1) + ticks(p1[0], p1[1], p2[0], p2[1], 1));
      })() },
    { slug: "triangle-acutangle", label: "Triangle acutangle (3 angles aigus)", keywords: "triangle acutangle angles aigus",
      svg: (() => {
        const p1 = c(35, 140), p2 = c(205, 140), p3 = c(55, 30);
        return poly([p1, p2, p3], st()) +
          innerArc(p1, p2, p3, 24) + innerArc(p2, p3, p1, 24) + innerArc(p3, p1, p2, 24);
      })() },
    { slug: "triangle-obtusangle", label: "Triangle obtusangle (1 angle obtus)", keywords: "triangle obtusangle angle obtus",
      svg: (() => {
        const p1 = c(30, 140), p2 = c(70, 140), p3 = c(215, 130);
        return poly([p1, p2, p3], st()) + innerArc(p2, p3, p1, 34) +
          text(112, 118, "obtus", { size: 12, color: RED });
      })() },
    { slug: "triangle-hauteur", label: "Triangle et hauteur", keywords: "triangle hauteur perpendiculaire base aire sommet",
      svg: (() => {
        const p1 = c(40, 145), p2 = c(200, 145), p3 = c(95, 25);
        const foot = c(95, 145);
        return poly([p1, p2, p3], st()) +
          line(foot[0], foot[1], p3[0], p3[1], st(RED, 2)) +
          rightAngleMark(foot[0], foot[1], p2, p3) +
          text(foot[0] - 16, foot[1] - 16, "H", { size: 14, color: RED, bold: true }) +
          labelOut(p1, "B") + labelOut(p2, "C") + labelOut(p3, "A") +
          line(148, 55, 118, 62, st(RED, 1.5)) + text(160, 52, "hauteur", { size: 12, color: RED }) +
          text(120, 165, "base (BC)", { size: 12, color: DARK });
      })() },
    { slug: "triangle-famille", label: "Les familles de triangles (synthèse)", keywords: "triangles familles synthese tableau quelconque isocele equilateral rectangle acutangle obtusangle lecon",
      vb: "0 0 480 490",
      svg: (() => {
        const one = (x: number, y: number, kind: string, name: string) => {
          const cy = y + 70;
          let pts: Pt[] = [];
          let extra = "";
          if (kind === "quelconque") pts = [c(x + 10, cy + 30), c(x + 100, cy + 30), c(x + 35, cy - 35)];
          if (kind === "isocele") {
            pts = [c(x + 10, cy + 30), c(x + 100, cy + 30), c(x + 55, cy - 38)];
            extra = ticks(pts[2][0], pts[2][1], pts[0][0], pts[0][1], 1) + ticks(pts[2][0], pts[2][1], pts[1][0], pts[1][1], 1);
          }
          if (kind === "equilateral") {
            pts = [c(x + 12, cy + 30), c(x + 98, cy + 30), c(x + 55, cy - 34)];
            extra = ticks(pts[0][0], pts[0][1], pts[2][0], pts[2][1], 1) + ticks(pts[2][0], pts[2][1], pts[1][0], pts[1][1], 1) + ticks(pts[1][0], pts[1][1], pts[0][0], pts[0][1], 1);
          }
          if (kind === "rectangle") {
            pts = [c(x + 15, cy + 30), c(x + 100, cy + 30), c(x + 15, cy - 38)];
            extra = rightAngleMark(pts[0][0], pts[0][1], pts[1], pts[2], 10);
          }
          if (kind === "rect-isocele") {
            pts = [c(x + 20, cy + 30), c(x + 100, cy + 30), c(x + 20, cy - 38)];
            extra = rightAngleMark(pts[0][0], pts[0][1], pts[1], pts[2], 10) + ticks(pts[0][0], pts[0][1], pts[2][0], pts[2][1], 1) + ticks(pts[0][0], pts[0][1], pts[1][0], pts[1][1], 1);
          }
          if (kind === "acutangle") {
            pts = [c(x + 12, cy + 30), c(x + 102, cy + 30), c(x + 38, cy - 36)];
            extra = innerArc(pts[0], pts[1], pts[2], 16, RED, 1.6) + innerArc(pts[1], pts[2], pts[0], 16, RED, 1.6) + innerArc(pts[2], pts[0], pts[1], 16, RED, 1.6);
          }
          if (kind === "obtusangle") {
            pts = [c(x + 8, cy + 30), c(x + 42, cy + 30), c(x + 105, cy + 18)];
            extra = innerArc(pts[1], pts[2], pts[0], 20, RED, 1.6);
          }
          return poly(pts, st(BLUE, 2.2)) + extra + text(x + 56, y + 128, name, { size: 12.5, color: DARK, bold: true });
        };
        return (
          one(10, 10, "quelconque", "Quelconque") + one(170, 10, "isocele", "Isocèle") + one(330, 10, "equilateral", "Équilatéral") +
          one(10, 175, "rectangle", "Rectangle") + one(170, 175, "rect-isocele", "Rectangle isocèle") +
          one(330, 175, "acutangle", "Acutangle") + one(10, 340, "obtusangle", "Obtusangle")
        );
      })() },
  ],
};

/* ═══════════════ 3. QUADRILATÈRES ═══════════════ */

export const quadrilateres: GeoFigureCategory = {
  id: "quadrilateres",
  label: "Quadrilatères",
  description: "Carré, rectangle, losange, parallélogramme, trapèzes, cerf-volant… avec codages",
  chip: "bg-emerald-100 text-emerald-700",
  items: [
    { slug: "carre", label: "Le carré (codé)", keywords: "carre quatre cotes egaux angles droits codage",
      svg: (() => {
        const p = [c(60, 35), c(180, 35), c(180, 155), c(60, 155)];
        let cod = "";
        for (let i = 0; i < 4; i++) {
          const a = p[i], b = p[(i + 1) % 4];
          cod += ticks(a[0], a[1], b[0], b[1], 1);
        }
        return poly(p, st()) + cod +
          rightAngleMark(p[0][0], p[0][1], p[1], p[3], 12) + rightAngleMark(p[1][0], p[1][1], p[2], p[0], 12) +
          rightAngleMark(p[2][0], p[2][1], p[3], p[1], 12) + rightAngleMark(p[3][0], p[3][1], p[0], p[2], 12);
      })() },
    { slug: "rectangle", label: "Le rectangle (codé)", keywords: "rectangle longueurs egales codage angles droits",
      svg: (() => {
        const p = [c(35, 45), c(205, 45), c(205, 125), c(35, 125)];
        return poly(p, st()) +
          ticks(p[0][0], p[0][1], p[1][0], p[1][1], 2) + ticks(p[2][0], p[2][1], p[3][0], p[3][1], 2) +
          ticks(p[1][0], p[1][1], p[2][0], p[2][1], 1) + ticks(p[3][0], p[3][1], p[0][0], p[0][1], 1) +
          rightAngleMark(p[0][0], p[0][1], p[1], p[3], 12) + rightAngleMark(p[1][0], p[1][1], p[2], p[0], 12) +
          rightAngleMark(p[2][0], p[2][1], p[3], p[1], 12) + rightAngleMark(p[3][0], p[3][1], p[0], p[2], 12) +
          text(120, 28, "L", { size: 14, color: RED, bold: true }) + text(20, 90, "l", { size: 14, color: RED, bold: true });
      })() },
    { slug: "losange", label: "Le losange (codé)", keywords: "losange diagonales perpendiculaires codage quatre cotes egaux",
      svg: (() => {
        const p = [c(120, 15), c(200, 85), c(120, 155), c(40, 85)];
        let cod = "";
        for (let i = 0; i < 4; i++) {
          const a = p[i], b = p[(i + 1) % 4];
          cod += ticks(a[0], a[1], b[0], b[1], 1);
        }
        return poly(p, st()) + cod +
          line(120, 15, 120, 155, st(GRAY, 1.6)) + line(40, 85, 200, 85, st(GRAY, 1.6)) +
          rightAngleMark(120, 85, p[3], p[0], 10) +
          text(127, 30, "d₁", { size: 12, color: GRAY }) + text(150, 80, "d₂", { size: 12, color: GRAY });
      })() },
    { slug: "parallelogramme", label: "Le parallélogramme (codé)", keywords: "parallelogramme cotes opposes egaux paralleles codage",
      svg: (() => {
        const q = [c(30, 130), c(210, 130), c(170, 40), c(20, 40)];
        return poly(q, st()) +
          ticks(q[0][0], q[0][1], q[1][0], q[1][1], 2) + ticks(q[2][0], q[2][1], q[3][0], q[3][1], 2) +
          ticks(q[1][0], q[1][1], q[2][0], q[2][1], 1) + ticks(q[3][0], q[3][1], q[0][0], q[0][1], 1) +
          chevrons(80, 122, 0, 1) + chevrons(70, 48, 0, 1);
      })() },
    { slug: "trapeze", label: "Le trapèze", keywords: "trapeze quadrilatere deux cotes paralleles bases",
      svg: (() => {
        const p = [c(25, 140), c(215, 140), c(160, 40), c(80, 40)];
        return poly(p, st()) + chevrons(120, 132, 0, 1) + chevrons(120, 48, 0, 1) +
          text(120, 165, "grande base", { size: 11.5, color: DARK }) + text(120, 30, "petite base", { size: 11.5, color: DARK });
      })() },
    { slug: "trapeze-rectangle", label: "Le trapèze rectangle", keywords: "trapeze rectangle angle droit hauteur",
      svg: (() => {
        const p = [c(30, 140), c(210, 140), c(160, 40), c(60, 40)];
        return poly(p, st()) + rightAngleMark(60, 40, c(160, 40), c(30, 140), 12) +
          chevrons(120, 132, 0, 1) + chevrons(110, 48, 0, 1);
      })() },
    { slug: "trapeze-isocele", label: "Le trapèze isocèle", keywords: "trapeze isocele jambes egales codage",
      svg: (() => {
        const p = [c(25, 140), c(215, 140), c(165, 40), c(75, 40)];
        return poly(p, st()) + ticks(p[0][0], p[0][1], p[3][0], p[3][1], 1) + ticks(p[1][0], p[1][1], p[2][0], p[2][1], 1) +
          chevrons(120, 132, 0, 1) + chevrons(120, 48, 0, 1);
      })() },
    { slug: "cerf-volant", label: "Le cerf-volant", keywords: "cerf volant kite cotes adjacents egaux codage",
      svg: (() => {
        const p = [c(120, 10), c(210, 95), c(120, 160), c(30, 95)];
        return poly(p, st()) + line(120, 10, 120, 160, st(GRAY, 1.6)) +
          ticks(p[0][0], p[0][1], p[1][0], p[1][1], 1) + ticks(p[0][0], p[0][1], p[3][0], p[3][1], 1) +
          ticks(p[2][0], p[2][1], p[1][0], p[1][1], 2) + ticks(p[2][0], p[2][1], p[3][0], p[3][1], 2);
      })() },
    { slug: "quadrilatere-quelconque", label: "Quadrilatère quelconque", keywords: "quadrilatere quelconque convexe quatre cotes",
      svg: (() => {
        const p = [c(40, 130), c(120, 150), c(200, 110), c(90, 30)];
        return poly(p, st()) + dot(40, 130) + dot(120, 150) + dot(200, 110) + dot(90, 30) +
          text(28, 148, "A", { size: 15, bold: true }) + text(118, 168, "B", { size: 15, bold: true }) +
          text(214, 118, "C", { size: 15, bold: true }) + text(90, 22, "D", { size: 15, bold: true });
      })() },
    { slug: "quadrilatere-concave", label: "Quadrilatère concave (non convexe)", keywords: "quadrilatere concave non convexe rentre",
      svg: (() => {
        const p = [c(30, 40), c(210, 40), c(210, 150), c(30, 150)];
        return poly([c(30, 40), c(210, 40), c(120, 95), c(210, 150), c(30, 150)], st()) +
          dot(120, 95) + text(120, 88, "creux", { size: 11, color: RED });
      })() },
    { slug: "diagonales", label: "Diagonales d'un rectangle", keywords: "diagonales rectangle croisement centre codage",
      svg: (() => {
        const p = [c(35, 45), c(205, 45), c(205, 125), c(35, 125)];
        return poly(p, st()) +
          line(p[0][0], p[0][1], p[2][0], p[2][1], st(GRAY, 1.6)) + line(p[1][0], p[1][1], p[3][0], p[3][1], st(GRAY, 1.6)) +
          dot(120, 85, 3.5, GRAY) + text(132, 95, "O", { size: 14, color: GRAY, bold: true }) +
          text(120, 28, "les diagonales se coupent en leur milieu", { size: 11.5, color: GRAY });
      })() },
    { slug: "quadrilateres-famille", label: "Les familles de quadrilatères (synthèse)", keywords: "quadrilateres familles synthese carre rectangle losange parallelogramme trapeze cerf volant lecon",
      vb: "0 0 480 330",
      svg: (() => {
        const one = (x: number, y: number, kind: string, name: string) => {
          const cy = y + 60;
          let pts: Pt[] = [];
          let extra = "";
          if (kind === "carre") {
            pts = [c(x + 22, cy - 36), c(x + 86, cy - 36), c(x + 86, cy + 28), c(x + 22, cy + 28)];
            extra = ticks(pts[0][0], pts[0][1], pts[1][0], pts[1][1], 1) + rightAngleMark(pts[0][0], pts[0][1], pts[1], pts[3], 9);
          }
          if (kind === "rectangle") {
            pts = [c(x + 8, cy - 26), c(x + 100, cy - 26), c(x + 100, cy + 28), c(x + 8, cy + 28)];
            extra = ticks(pts[0][0], pts[0][1], pts[1][0], pts[1][1], 2) + ticks(pts[1][0], pts[1][1], pts[2][0], pts[2][1], 1);
          }
          if (kind === "losange") {
            pts = [c(x + 54, cy - 38), c(x + 100, cy), c(x + 54, cy + 38), c(x + 8, cy)];
            extra = ticks(pts[0][0], pts[0][1], pts[1][0], pts[1][1], 1);
          }
          if (kind === "parallelogramme") {
            pts = [c(x + 16, cy + 24), c(x + 100, cy + 24), c(x + 84, cy - 30), c(x + 0, cy - 30)];
            extra = ticks(pts[0][0], pts[0][1], pts[1][0], pts[1][1], 2) + ticks(pts[1][0], pts[1][1], pts[2][0], pts[2][1], 1);
          }
          if (kind === "trapeze") {
            pts = [c(x + 6, cy + 28), c(x + 102, cy + 28), c(x + 78, cy - 30), c(x + 30, cy - 30)];
            extra = chevrons(x + 54, cy + 20, 0, 1) + chevrons(x + 54, cy - 22, 0, 1);
          }
          if (kind === "trapeze-rectangle") {
            pts = [c(x + 6, cy + 28), c(x + 102, cy + 28), c(x + 76, cy - 30), c(x + 30, cy - 30)];
            extra = rightAngleMark(x + 30, cy - 30, c(x + 76, cy - 30), c(x + 6, cy + 28), 9);
          }
          if (kind === "trapeze-isocele") {
            pts = [c(x + 6, cy + 28), c(x + 102, cy + 28), c(x + 80, cy - 30), c(x + 28, cy - 30)];
            extra = ticks(pts[0][0], pts[0][1], pts[3][0], pts[3][1], 1) + ticks(pts[1][0], pts[1][1], pts[2][0], pts[2][1], 1);
          }
          if (kind === "cerf-volant") {
            pts = [c(x + 54, cy - 38), c(x + 100, cy + 4), c(x + 54, cy + 32), c(x + 8, cy + 4)];
            extra = ticks(pts[0][0], pts[0][1], pts[1][0], pts[1][1], 1) + ticks(pts[0][0], pts[0][1], pts[3][0], pts[3][1], 1);
          }
          return poly(pts, st(BLUE, 2.2)) + extra + text(x + 56, y + 128, name, { size: 12.5, color: DARK, bold: true });
        };
        return (
          one(10, 10, "carre", "Carré") + one(130, 10, "rectangle", "Rectangle") + one(250, 10, "losange", "Losange") + one(370, 10, "parallelogramme", "Parallélogramme") +
          one(10, 175, "trapeze", "Trapèze") + one(130, 175, "trapeze-rectangle", "Trapèze rectangle") +
          one(250, 175, "trapeze-isocele", "Trapèze isocèle") + one(370, 175, "cerf-volant", "Cerf-volant")
        );
      })() },
  ],
};

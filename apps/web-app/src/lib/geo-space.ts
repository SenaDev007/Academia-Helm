/**
 * ============================================================================
 * GEO-SPACE — Droites, angles, solides, symétrie, repères, grandeurs
 * ============================================================================
 */

import {
  BLUE, RED, DARK, GREEN, GRAY, PURPLE,
  st, fill, line, poly, polyline, circle, ellipse, path, text, dot,
  ticks, rightAngleMark, chevrons, regPts, pol, arcPath, eArc,
  angleOf, norm360, innerArc, arrowLine, grid, dashColor,
} from "./geo-kit";
import type { GeoFigureCategory, Pt } from "./geo-kit";

const c = (x: number, y: number): Pt => [x, y];

/* ═══════════════ 6. DROITES, POINTS ET SEGMENTS ═══════════════ */

export const droites: GeoFigureCategory = {
  id: "droites-segments",
  label: "Droites, demi-droites, segments",
  description: "Notations (d), [AB), [AB], parallèles, perpendiculaires, médiatrice, bissectrice…",
  chip: "bg-sky-100 text-sky-700",
  items: [
    { slug: "droite", label: "La droite (d)", keywords: "droite infinie fleches notation d ab",
      svg: arrowLine(15, 85, 225, 85, st(BLUE, 2.5), true) +
        dot(80, 85) + dot(170, 85) +
        text(80, 71, "A", { size: 14, bold: true }) + text(170, 71, "B", { size: 14, bold: true }) +
        text(205, 105, "(d)", { size: 14, color: DARK, bold: true }) },
    { slug: "demi-droite", label: "La demi-droite [Ox)", keywords: "demi droite origine notation ox ab",
      svg: dot(40, 85) + arrowLine(40, 85, 225, 85, st(BLUE, 2.5)) +
        text(30, 106, "O", { size: 14, bold: true }) + text(150, 71, "x", { size: 14, italic: true }) +
        text(62, 125, "origine", { size: 11, color: GRAY }) },
    { slug: "segment", label: "Le segment [AB]", keywords: "segment longueur mesure notation ab cm",
      svg: line(30, 85, 210, 85, st(BLUE, 2.8)) + dot(30, 85) + dot(210, 85) +
        text(24, 69, "A", { size: 14, bold: true }) + text(212, 69, "B", { size: 14, bold: true }) +
        text(120, 115, "5 cm", { size: 13, color: RED, bold: true }) },
    { slug: "points-alignes", label: "Points alignés", keywords: "points alignes meme droite",
      svg: line(20, 85, 220, 85, dashColor(GRAY, 1.5)) +
        dot(60, 85) + dot(120, 85) + dot(180, 85) +
        text(60, 71, "A", { size: 14, bold: true }) + text(120, 71, "B", { size: 14, bold: true }) + text(180, 71, "C", { size: 14, bold: true }) +
        text(120, 120, "A, B et C sont alignés", { size: 12, color: DARK }) },
    { slug: "points-non-alignes", label: "Points non alignés", keywords: "points non alignes triangle",
      svg: line(50, 40, 190, 60, dashColor(GRAY, 1.5)) + line(190, 60, 110, 140, dashColor(GRAY, 1.5)) + line(110, 140, 50, 40, dashColor(GRAY, 1.5)) +
        dot(50, 40) + dot(190, 60) + dot(110, 140) +
        text(38, 34, "A", { size: 14, bold: true }) + text(200, 56, "B", { size: 14, bold: true }) + text(110, 158, "C", { size: 14, bold: true }) },
    { slug: "droites-paralleles", label: "Droites parallèles", keywords: "paralleles codage chevrons notation d1 d2",
      svg: arrowLine(25, 55, 215, 55, st(BLUE, 2.5), true) + arrowLine(25, 115, 215, 115, st(BLUE, 2.5), true) +
        chevrons(100, 55, 0, 1) + chevrons(100, 115, 0, 1) +
        text(120, 40, "(d₁)", { size: 13, bold: true }) + text(120, 135, "(d₂)", { size: 13, bold: true }) +
        text(120, 158, "(d₁) ∥ (d₂)", { size: 13, color: DARK }) },
    { slug: "droites-perpendiculaires", label: "Droites perpendiculaires", keywords: "perpendiculaires angle droit codage notation",
      svg: arrowLine(20, 110, 220, 110, st(BLUE, 2.5), true) + arrowLine(120, 20, 120, 160, st(BLUE, 2.5), true) +
        rightAngleMark(120, 110, c(185, 110), c(120, 45), 13) +
        text(210, 96, "(d₁)", { size: 13, bold: true }) + text(134, 30, "(d₂)", { size: 13, bold: true, anchor: "start" }) +
        text(120, 185 - 18, "(d₁) ⊥ (d₂)", { size: 13, color: DARK }) },
    { slug: "droites-secantes", label: "Droites sécantes", keywords: "secantes intersection point croisees",
      svg: arrowLine(25, 35, 215, 135, st(BLUE, 2.5), true) + arrowLine(25, 135, 215, 35, st(BLUE, 2.5), true) +
        dot(120, 85) + text(132, 82, "I", { size: 14, bold: true }) +
        text(120, 160, "les droites se coupent en I", { size: 12, color: DARK }) },
    { slug: "mediatrice", label: "Médiatrice d'un segment", keywords: "mediatrice perpendiculaire milieu egale distance codage",
      svg: (() => {
        const A = c(35, 110), B = c(205, 110);
        return line(120, 25, 120, 155, dashColor(RED, 2)) +
          line(A[0], A[1], B[0], B[1], st(BLUE, 2.5)) + dot(A[0], A[1]) + dot(B[0], B[1]) +
          text(27, 95, "A", { size: 14, bold: true }) + text(207, 95, "B", { size: 14, bold: true }) +
          ticks(A[0], A[1], 120, 110, 1) + ticks(120, 110, B[0], B[1], 1) +
          rightAngleMark(120, 110, B, c(120, 60), 11) +
          text(66, 18, "médiatrice de [AB]", { size: 12.5, color: RED }) +
          text(120, 145, "elle passe par le milieu de [AB]", { size: 11, color: GRAY });
      })() },
    { slug: "bissectrice", label: "Bissectrice d'un angle", keywords: "bissectrice angle egale partage moitie codage",
      svg: (() => {
        const V = c(50, 130);
        const r1 = c(215, 130);
        const r2 = pol(50, 130, 115, 60);
        const bis = pol(50, 130, 165, 30);
        return line(V[0], V[1], r1[0], r1[1], st(BLUE, 2.5)) + line(V[0], V[1], r2[0], r2[1], st(BLUE, 2.5)) +
          line(V[0], V[1], bis[0], bis[1], dashColor(RED, 2)) +
          innerArc(V, r1, r2, 42, GRAY, 1.5) +
          dot(V[0], V[1]) +
          text(150, 52, "bissectrice", { size: 12.5, color: RED }) +
          text(120, 158, "elle partage l'angle en 2 angles égaux", { size: 11.5, color: GRAY });
      })() },
    { slug: "droite-graduee-entiers", label: "Droite graduée (entiers)", keywords: "droite graduee entiers nombres 0 10 placement",
      vb: "0 0 360 90",
      svg: (() => {
        let s = arrowLine(18, 45, 342, 45, st(BLUE, 2.2));
        for (let i = 0; i <= 10; i++) {
          const x = 30 + i * 30;
          s += line(x, 39, x, 51, st(BLUE, 2)) + text(x, 72, String(i), { size: 12, color: DARK });
        }
        return s + text(160, 24, "chaque graduation = 1 unité", { size: 10.5, color: GRAY });
      })() },
    { slug: "droite-graduee-dixiemes", label: "Droite graduée (dixièmes)", keywords: "droite graduee dixiemes decimaux 0 1 virgule nombres",
      vb: "0 0 360 110",
      svg: (() => {
        let s = arrowLine(18, 55, 342, 55, st(BLUE, 2.2));
        for (let i = 0; i <= 10; i++) {
          const x = 30 + i * 30;
          s += line(x, 48, x, 62, st(BLUE, 2)) +
            text(x, 82, i === 0 ? "0" : i === 10 ? "1" : `0,${i}`, { size: 9.5, color: DARK });
        }
        return s + text(180, 30, "les graduations sont des dixièmes", { size: 10.5, color: GRAY });
      })() },
  ],
};

/* ═══════════════ 7. ANGLES ═══════════════ */

/** Un angle : sommet + 2 demi-droites + arc + étiquette de mesure. */
function angleFig(v: Pt, a1: number, a2: number, len = 150, rr = 34, label?: string) {
  const p1 = pol(v[0], v[1], len, a1);
  const p2 = pol(v[0], v[1], len, a2);
  return line(v[0], v[1], p1[0], p1[1], st(BLUE, 2.5)) + line(v[0], v[1], p2[0], p2[1], st(BLUE, 2.5)) +
    innerArc(v, p1, p2, rr) + dot(v[0], v[1]) +
    (label ? text(v[0] + rr + 26, v[1] - rr - 8, label, { size: 14, color: RED, bold: true }) : "");
}

export const angles: GeoFigureCategory = {
  id: "angles",
  label: "Angles",
  description: "Nul, aigu, droit, obtus, plat, rentrant, opposés par le sommet…",
  chip: "bg-orange-100 text-orange-700",
  items: [
    { slug: "angle-nul", label: "L'angle nul (0°)", keywords: "angle nul 0 degre",
      svg: (() => {
        const v = c(50, 120);
        const p1 = pol(50, 120, 165, 0);
        return line(v[0], v[1], p1[0], p1[1], st(BLUE, 2.5)) +
          dot(v[0], v[1]) + text(60, 100, "0°", { size: 14, color: RED, bold: true }) +
          text(120, 150, "les deux demi-droites sont confondues", { size: 11.5, color: GRAY });
      })() },
    { slug: "angle-aigu", label: "L'angle aigu (moins de 90°)", keywords: "angle aigu inferieur 90 degre",
      svg: angleFig(c(50, 130), 0, 40, 165, 38, "40°") },
    { slug: "angle-droit", label: "L'angle droit (90°)", keywords: "angle droit 90 degre carre codage perpendiculaire",
      svg: (() => {
        const v = c(50, 130);
        const p1 = pol(50, 130, 165, 0);
        const p2 = pol(50, 130, 130, 90);
        return line(v[0], v[1], p1[0], p1[1], st(BLUE, 2.5)) + line(v[0], v[1], p2[0], p2[1], st(BLUE, 2.5)) +
          rightAngleMark(v[0], v[1], p1, p2, 18) + dot(v[0], v[1]) +
          text(105, 78, "90°", { size: 14, color: RED, bold: true });
      })() },
    { slug: "angle-obtus", label: "L'angle obtus (entre 90° et 180°)", keywords: "angle obtus superieur 90 degre",
      svg: angleFig(c(50, 130), 0, 120, 165, 42, "120°") },
    { slug: "angle-plat", label: "L'angle plat (180°)", keywords: "angle plat 180 degre droite",
      svg: (() => {
        const v = c(60, 90);
        return line(15, 90, 225, 90, st(BLUE, 2.5)) + dot(60, 90) +
          path(arcPath(60, 90, 38, 180, 360), st(RED, 2)) +
          text(60, 148, "180°", { size: 14, color: RED, bold: true });
      })() },
    { slug: "angle-rentrant", label: "L'angle rentrant (plus de 180°)", keywords: "angle rentrant reflexe superieur 180 degre",
      svg: (() => {
        const v = c(70, 100);
        const p1 = pol(70, 100, 140, 0);
        const p2 = pol(70, 100, 140, 120);
        return line(v[0], v[1], p1[0], p1[1], st(BLUE, 2.5)) + line(v[0], v[1], p2[0], p2[1], st(BLUE, 2.5)) +
          path(arcPath(70, 100, 30, 120, 360), st(RED, 2)) + dot(v[0], v[1]) +
          text(190, 50, "240°", { size: 14, color: RED, bold: true }) +
          text(150, 155, "il s'ouvre vers l'intérieur", { size: 11.5, color: GRAY });
      })() },
    { slug: "angles-opposes-sommet", label: "Angles opposés par le sommet", keywords: "angles opposes sommet egaux droites secantes",
      svg: (() => {
        const v = c(120, 85);
        const p = [c(25, 30), c(215, 140), c(215, 30), c(25, 140)];
        return arrowLine(p[0][0], p[0][1], p[1][0], p[1][1], st(BLUE, 2.2)) +
          arrowLine(p[2][0], p[2][1], p[3][0], p[3][1], st(BLUE, 2.2)) +
          innerArc(v, c(215, 30), c(215, 140), 24) +
          innerArc(v, c(25, 30), c(25, 140), 24) +
          dot(120, 85) +
          text(120, 160, "les angles opposés par le sommet sont égaux", { size: 11.5, color: DARK });
      })() },
    { slug: "angles-complementaires", label: "Angles complémentaires (somme 90°)", keywords: "angles complementaires somme 90 degre",
      svg: (() => {
        const v = c(50, 135);
        const r1 = pol(50, 135, 165, 0);
        const rm = pol(50, 135, 165, 30);
        const r2 = pol(50, 135, 120, 90);
        return line(v[0], v[1], r1[0], r1[1], st(BLUE, 2.5)) + line(v[0], v[1], rm[0], rm[1], st(BLUE, 2.5)) + line(v[0], v[1], r2[0], r2[1], st(BLUE, 2.5)) +
          innerArc(v, r1, rm, 32, RED, 2) + innerArc(v, rm, r2, 40, GREEN, 2) +
          dot(v[0], v[1]) +
          text(135, 108, "30°", { size: 12, color: RED, bold: true }) +
          text(70, 66, "60°", { size: 12, color: GREEN, bold: true }) +
          text(150, 158, "30° + 60° = 90°", { size: 12.5, color: DARK });
      })() },
    { slug: "famille-angles", label: "Les familles d'angles (synthèse)", keywords: "angles familles synthese nul aigu droit obtus plat rentrant lecon",
      vb: "0 0 480 340",
      svg: (() => {
        const one = (x: number, y: number, a2: number, name: string, reflex = false) => {
          const v = c(x + 30, y + 95);
          const p1 = pol(v[0], v[1], 88, 0);
          const p2 = pol(v[0], v[1], 88, a2);
          const arc = reflex
            ? path(arcPath(v[0], v[1], 24, a2, 360), st(RED, 1.8))
            : innerArc(v, p1, p2, 26, RED, 1.8);
          const sq = a2 === 90 ? rightAngleMark(v[0], v[1], p1, p2, 13) : "";
          return line(v[0], v[1], p1[0], p1[1], st(BLUE, 2)) +
            (a2 === 180 ? line(pol(v[0], v[1], 88, 180)[0], v[1], v[0], v[1], st(BLUE, 2)) : line(v[0], v[1], p2[0], p2[1], st(BLUE, 2))) +
            arc + sq + dot(v[0], v[1]) +
            text(x + 62, y + 132, name, { size: 12, color: DARK, bold: true });
        };
        return (
          one(15, 10, 0, "Nul (0°)") + one(175, 10, 40, "Aigu (< 90°)") + one(335, 10, 90, "Droit (= 90°)") +
          one(15, 175, 120, "Obtus (> 90°)") + one(175, 175, 180, "Plat (= 180°)") + one(335, 175, 120, "Rentrant (> 180°)", true)
        );
      })() },
  ],
};

/* ═══════════════ 8. SOLIDES ═══════════════ */

export const solides: GeoFigureCategory = {
  id: "solides",
  label: "Solides et patrons",
  description: "Cube, pavé droit, cylindre, cône, boule, pyramide, prisme + patrons à découpler",
  chip: "bg-fuchsia-100 text-fuchsia-700",
  items: [
    { slug: "cube", label: "Le cube (perspective)", keywords: "cube solide aretes cachees pointillees perspective six carres",
      vb: "0 0 240 210",
      svg: (() => {
        const A = c(60, 80), B = c(160, 80), C = c(160, 180), D = c(60, 180);
        const E = c(105, 45), F = c(205, 45), G = c(205, 145), H = c(105, 145);
        return poly([A, B, C, D], st()) +
          line(A[0], A[1], E[0], E[1], st()) + line(B[0], B[1], F[0], F[1], st()) + line(C[0], C[1], G[0], G[1], st()) +
          line(E[0], E[1], F[0], F[1], st()) + line(F[0], F[1], G[0], G[1], st()) +
          line(D[0], D[1], H[0], H[1], dashColor(GRAY, 1.8)) + line(H[0], H[1], E[0], E[1], dashColor(GRAY, 1.8)) + line(H[0], H[1], G[0], G[1], dashColor(GRAY, 1.8)) +
          ticks(A[0], A[1], B[0], B[1], 1) + ticks(B[0], B[1], F[0], F[1], 1) +
          text(120, 200, "cube — 6 faces carrées, 12 arêtes, 8 sommets", { size: 11.5, color: DARK });
      })() },
    { slug: "pave-droit", label: "Le pavé droit (parallélépipède)", keywords: "pave droit parallelepipede rectangle solide longueur largeur hauteur",
      vb: "0 0 240 210",
      svg: (() => {
        const A = c(45, 85), B = c(165, 85), C = c(165, 180), D = c(45, 180);
        const E = c(87, 52), F = c(207, 52), G = c(207, 147), H = c(87, 147);
        return poly([A, B, C, D], st()) +
          line(A[0], A[1], E[0], E[1], st()) + line(B[0], B[1], F[0], F[1], st()) + line(C[0], C[1], G[0], G[1], st()) +
          line(E[0], E[1], F[0], F[1], st()) + line(F[0], F[1], G[0], G[1], st()) +
          line(D[0], D[1], H[0], H[1], dashColor(GRAY, 1.8)) + line(H[0], H[1], E[0], E[1], dashColor(GRAY, 1.8)) + line(H[0], H[1], G[0], G[1], dashColor(GRAY, 1.8)) +
          text(105, 76, "L", { size: 13, color: RED, bold: true }) + text(180, 138, "l", { size: 13, color: RED, bold: true }) + text(196, 40, "h", { size: 13, color: RED, bold: true }) +
          text(120, 200, "pavé droit — 6 faces rectangulaires", { size: 11.5, color: DARK });
      })() },
    { slug: "cylindre", label: "Le cylindre de révolution", keywords: "cylindre revolution solide disques faces laterales",
      vb: "0 0 240 210",
      svg: (() => {
        const rx = 62, ry = 16;
        return ellipse(120, 55, rx, ry, st()) +
          line(58, 55, 58, 150, st()) + line(182, 55, 182, 150, st()) +
          eArc(120, 150, rx, ry, 180, 360, st()) +
          eArc(120, 150, rx, ry, 0, 180, dashColor(GRAY, 1.8)) +
          text(120, 200, "cylindre — 2 disques + 1 face latérale", { size: 11.5, color: DARK });
      })() },
    { slug: "cone", label: "Le cône de révolution", keywords: "cone revolution sommet base circulaire hauteur solide",
      vb: "0 0 240 210",
      svg: (() => {
        const rx = 68, ry = 17;
        const S = c(120, 25);
        return line(S[0], S[1], 52, 150, st()) + line(S[0], S[1], 188, 150, st()) +
          eArc(120, 150, rx, ry, 180, 360, st()) +
          eArc(120, 150, rx, ry, 0, 180, dashColor(GRAY, 1.8)) +
          line(S[0], S[1], 120, 150, dashColor(GRAY, 1.8)) +
          rightAngleMark(120, 150, c(180, 150), c(120, 100), 11) +
          text(128, 90, "h", { size: 12, color: RED, bold: true }) +
          text(120, 200, "cône — 1 base disco + 1 face courbe", { size: 11.5, color: DARK });
      })() },
    { slug: "boule", label: "La boule et la sphère", keywords: "boule sphere solide rayon centre equateur",
      vb: "0 0 240 210",
      svg: (() => {
        const O = c(120, 95);
        const P = pol(120, 95, 68, -20);
        return circle(120, 95, 68, st()) +
          eArc(120, 95, 68, 14, 180, 360, st(GRAY, 1.6)) +
          eArc(120, 95, 68, 14, 0, 180, dashColor(GRAY, 1.6)) +
          line(O[0], O[1], P[0], P[1], st(RED, 2)) + dot(120, 95) +
          text(112, 110, "O", { size: 14, bold: true }) + text(158, 82, "r", { size: 14, color: RED, bold: true, italic: true }) +
          text(120, 200, "sphère = surface ; boule = volume", { size: 11.5, color: DARK });
      })() },
    { slug: "pyramide", label: "La pyramide à base carrée", keywords: "pyramide base carree sommet aretes cachees solide",
      vb: "0 0 240 200",
      svg: (() => {
        const A = c(60, 150), B = c(180, 150), Cc = c(215, 118), D = c(95, 118), S = c(138, 28);
        return line(A[0], A[1], B[0], B[1], st()) + line(B[0], B[1], Cc[0], Cc[1], st()) +
          line(D[0], D[1], A[0], A[1], st()) +
          line(Cc[0], Cc[1], D[0], D[1], dashColor(GRAY, 1.8)) +
          line(S[0], S[1], A[0], A[1], st()) + line(S[0], S[1], B[0], B[1], st()) + line(S[0], S[1], Cc[0], Cc[1], st()) +
          line(S[0], S[1], D[0], D[1], dashColor(GRAY, 1.8)) +
          text(120, 185, "pyramide à base carrée", { size: 11.5, color: DARK });
      })() },
    { slug: "tetraedre", label: "Le tétraèdre", keywords: "tetraedre pyramide base triangulaire quatre faces",
      svg: (() => {
        const A = c(55, 160), B = c(190, 160), Cc = c(95, 95), S = c(140, 20);
        return line(A[0], A[1], B[0], B[1], st()) + line(B[0], B[1], Cc[0], Cc[1], st()) + line(Cc[0], Cc[1], A[0], A[1], st()) +
          line(S[0], S[1], A[0], A[1], st()) + line(S[0], S[1], B[0], B[1], st()) +
          line(S[0], S[1], Cc[0], Cc[1], dashColor(GRAY, 1.8)) +
          text(120, 185, "tétraèdre — 4 faces triangulaires", { size: 11.5, color: DARK });
      })() },
    { slug: "prisme", label: "Le prisme droit", keywords: "prisme droit triangulaire faces laterales solide",
      vb: "0 0 240 200",
      svg: (() => {
        const A = c(55, 150), B = c(165, 150), Cc = c(85, 60);
        const A2 = c(103, 120), B2 = c(213, 120), C2 = c(133, 30);
        return poly([A, B, Cc], st()) + poly([A2, B2, C2], st()) +
          line(A[0], A[1], A2[0], A2[1], st()) + line(B[0], B[1], B2[0], B2[1], st()) + line(Cc[0], Cc[1], C2[0], C2[1], st()) +
          text(120, 185, "prisme droit à base triangulaire", { size: 11.5, color: DARK });
      })() },
    { slug: "patron-cube", label: "Patron du cube (à découpler)", keywords: "patron cube decouper plier six carres net",
      vb: "0 0 240 190",
      svg: (() => {
        const sq = (x: number, y: number) => poly([c(x, y), c(x + 36, y), c(x + 36, y + 36), c(x, y + 36)], st(BLUE, 2));
        return sq(48, 76) + sq(84, 76) + sq(120, 76) + sq(156, 76) + sq(84, 40) + sq(84, 112) +
          text(120, 170, "patron du cube — 6 carrés identiques", { size: 11.5, color: DARK });
      })() },
    { slug: "patron-pave", label: "Patron du pavé droit", keywords: "patron pave droit decouper plier rectangles net",
      vb: "0 0 340 200",
      svg: (() => {
        const rc = (x: number, y: number) => poly([c(x, y), c(x + 88, y), c(x + 88, y + 40), c(x, y + 40)], st(BLUE, 2));
        return rc(40, 80) + rc(128, 80) + rc(216, 80) + rc(128, 40) + rc(128, 120) +
          text(170, 185, "patron du pavé droit — 6 rectangles", { size: 11.5, color: DARK });
      })() },
    { slug: "patron-pyramide", label: "Patron de la pyramide", keywords: "patron pyramide decouper base carree triangles net",
      vb: "0 0 240 220",
      svg: (() => {
        return poly([c(92, 80), c(152, 80), c(152, 140), c(92, 140)], st()) +
          poly([c(92, 80), c(152, 80), c(122, 20)], st()) +
          poly([c(92, 140), c(152, 140), c(122, 200)], st()) +
          poly([c(92, 80), c(92, 140), c(32, 110)], st()) +
          poly([c(152, 80), c(152, 140), c(212, 110)], st()) +
          text(120, 215, "patron de la pyramide — 1 carré + 4 triangles", { size: 11, color: DARK });
      })() },
    { slug: "solides-famille", label: "Les solides usuels (synthèse)", keywords: "solides familles synthese cube pave cylindre cone boule pyramide prisme lecon",
      vb: "0 0 480 340",
      svg: (() => {
        const mini = (x: number, y: number, kind: string, name: string) => {
          let s = "";
          if (kind === "cube") {
            const A = c(x + 18, y + 38), B = c(x + 56, y + 38), Cc = c(x + 56, y + 76), D = c(x + 18, y + 76);
            const E = c(x + 36, y + 22), F = c(x + 74, y + 22), G = c(x + 74, y + 60), H = c(x + 36, y + 60);
            s = poly([A, B, Cc, D], st(BLUE, 1.8)) + line(A[0], A[1], E[0], E[1], st(BLUE, 1.8)) + line(B[0], B[1], F[0], F[1], st(BLUE, 1.8)) +
              line(Cc[0], Cc[1], G[0], G[1], st(BLUE, 1.8)) + line(E[0], E[1], F[0], F[1], st(BLUE, 1.8)) + line(F[0], F[1], G[0], G[1], st(BLUE, 1.8)) +
              line(D[0], D[1], H[0], H[1], dashColor(GRAY, 1.4)) + line(H[0], H[1], E[0], E[1], dashColor(GRAY, 1.4)) + line(H[0], H[1], G[0], G[1], dashColor(GRAY, 1.4));
          }
          if (kind === "pave") {
            const A = c(x + 10, y + 42), B = c(x + 62, y + 42), Cc = c(x + 62, y + 74), D = c(x + 10, y + 74);
            const E = c(x + 28, y + 26), F = c(x + 80, y + 26), G = c(x + 80, y + 58), H = c(x + 28, y + 58);
            s = poly([A, B, Cc, D], st(BLUE, 1.8)) + line(A[0], A[1], E[0], E[1], st(BLUE, 1.8)) + line(B[0], B[1], F[0], F[1], st(BLUE, 1.8)) +
              line(Cc[0], Cc[1], G[0], G[1], st(BLUE, 1.8)) + line(E[0], E[1], F[0], F[1], st(BLUE, 1.8)) + line(F[0], F[1], G[0], G[1], st(BLUE, 1.8)) +
              line(D[0], D[1], H[0], H[1], dashColor(GRAY, 1.4)) + line(H[0], H[1], E[0], E[1], dashColor(GRAY, 1.4)) + line(H[0], H[1], G[0], G[1], dashColor(GRAY, 1.4));
          }
          if (kind === "cylindre") {
            s = ellipse(x + 45, y + 25, 26, 7, st(BLUE, 1.8)) +
              line(x + 19, y + 25, x + 19, y + 72, st(BLUE, 1.8)) + line(x + 71, y + 25, x + 71, y + 72, st(BLUE, 1.8)) +
              eArc(x + 45, y + 72, 26, 7, 180, 360, st(BLUE, 1.8)) + eArc(x + 45, y + 72, 26, 7, 0, 180, dashColor(GRAY, 1.4));
          }
          if (kind === "cone") {
            s = line(x + 45, y + 14, x + 17, y + 70, st(BLUE, 1.8)) + line(x + 45, y + 14, x + 73, y + 70, st(BLUE, 1.8)) +
              eArc(x + 45, y + 70, 28, 8, 180, 360, st(BLUE, 1.8)) + eArc(x + 45, y + 70, 28, 8, 0, 180, dashColor(GRAY, 1.4));
          }
          if (kind === "boule") {
            s = circle(x + 45, y + 45, 33, st(BLUE, 1.8)) +
              eArc(x + 45, y + 45, 33, 8, 180, 360, st(GRAY, 1.4)) + eArc(x + 45, y + 45, 33, 8, 0, 180, dashColor(GRAY, 1.4));
          }
          if (kind === "pyramide") {
            const A = c(x + 12, y + 68), B = c(x + 72, y + 68), Cc = c(x + 84, y + 50), D = c(x + 24, y + 50), S = c(x + 48, y + 10);
            s = line(A[0], A[1], B[0], B[1], st(BLUE, 1.8)) + line(B[0], B[1], Cc[0], Cc[1], st(BLUE, 1.8)) + line(D[0], D[1], A[0], A[1], st(BLUE, 1.8)) +
              line(Cc[0], Cc[1], D[0], D[1], dashColor(GRAY, 1.4)) +
              line(S[0], S[1], A[0], A[1], st(BLUE, 1.8)) + line(S[0], S[1], B[0], B[1], st(BLUE, 1.8)) + line(S[0], S[1], Cc[0], Cc[1], st(BLUE, 1.8)) +
              line(S[0], S[1], D[0], D[1], dashColor(GRAY, 1.4));
          }
          if (kind === "prisme") {
            const A = c(x + 15, y + 70), B = c(x + 65, y + 70), Cc = c(x + 30, y + 32);
            const A2 = c(x + 33, y + 56), B2 = c(x + 83, y + 56), C2 = c(x + 48, y + 18);
            s = poly([A, B, Cc], st(BLUE, 1.8)) + poly([A2, B2, C2], st(BLUE, 1.8)) +
              line(A[0], A[1], A2[0], A2[1], st(BLUE, 1.8)) + line(B[0], B[1], B2[0], B2[1], st(BLUE, 1.8)) + line(Cc[0], Cc[1], C2[0], C2[1], st(BLUE, 1.8));
          }
          return s + text(x + 48, y + 108, name, { size: 12, color: DARK, bold: true });
        };
        return (
          mini(10, 15, "cube", "Cube") + mini(130, 15, "pave", "Pavé droit") + mini(250, 15, "cylindre", "Cylindre") + mini(370, 15, "cone", "Cône") +
          mini(70, 180, "boule", "Boule") + mini(190, 180, "pyramide", "Pyramide") + mini(310, 180, "prisme", "Prisme")
        );
      })() },
  ],
};

/* ═══════════════ 9. SYMÉTRIE ET QUADRILLAGE ═══════════════ */

export const symetrie: GeoFigureCategory = {
  id: "symetrie",
  label: "Symétrie et quadrillage",
  description: "Axes de symétrie, figures à compléter, symétrie centrale, reproduction sur quadrillage",
  chip: "bg-pink-100 text-pink-700",
  items: [
    { slug: "axe-symetrie-vertical", label: "Axe de symétrie vertical", keywords: "axe symetrie vertical papillon axial",
      svg: (() => {
        const left = [c(30, 30), c(108, 30), c(108, 58), c(128, 85), c(108, 112), c(108, 140), c(30, 140)];
        const right = left.map((p) => c(240 - p[0], p[1]));
        return poly(left, fill("#dbeafe", BLUE, 2.2)) + poly(right, fill("#dbeafe", BLUE, 2.2)) +
          line(120, 12, 120, 158, dashColor(RED, 2)) +
          text(120, 166, "axe de symétrie", { size: 12.5, color: RED });
      })() },
    { slug: "axe-symetrie-horizontal", label: "Axe de symétrie horizontal", keywords: "axe symetrie horizontal axial miroir",
      svg: (() => {
        const top = [c(30, 25), c(210, 25), c(160, 70), c(80, 70)];
        const bot = top.map((p) => c(p[0], 170 - p[1]));
        return poly(top, fill("#dcfce7", GREEN, 2.2)) + poly(bot, fill("#dcfce7", GREEN, 2.2)) +
          line(15, 85, 225, 85, dashColor(RED, 2)) +
          text(120, 165, "axe de symétrie", { size: 12.5, color: RED });
      })() },
    { slug: "axe-symetrie-oblique", label: "Axe de symétrie oblique", keywords: "axe symetrie oblique diagonal carre",
      svg: (() => {
        const sq = [c(55, 30), c(185, 30), c(185, 160), c(55, 160)];
        return poly(sq, st()) +
          line(55, 30, 185, 160, dashColor(RED, 2)) +
          text(150, 60, "axe de symétrie", { size: 12, color: RED }) +
          text(120, 178, "le carré possède aussi 3 autres axes", { size: 11, color: GRAY });
      })() },
    { slug: "figure-sans-symetrie", label: "Figure sans axe de symétrie", keywords: "sans symetrie aucun axe triangle quelconque",
      svg: (() => {
        const pts = [c(40, 145), c(200, 145), c(85, 25)];
        return poly(pts, st()) +
          text(120, 165, "aucun axe de symétrie", { size: 12.5, color: RED });
      })() },
    { slug: "symetrie-axiale-quadrillage", label: "Symétrie axiale sur quadrillage (à compléter)", keywords: "symetrie axiale quadrillage completer exercice axe miroir cp ce1 ce2",
      vb: "0 0 360 200",
      svg: (() => {
        const fig = [c(60, 60), c(140, 60), c(140, 100), c(100, 100), c(100, 140), c(60, 140)];
        const mirror = fig.map((p) => c(360 - p[0], p[1]));
        return grid(20, 20, 140, 140, 20) + grid(220, 20, 140, 140, 20) +
          poly(fig, fill("#dbeafe", BLUE, 2)) +
          poly(mirror, dashColor(GRAY, 2, "2 5")) +
          line(180, 10, 180, 190, dashColor(RED, 2)) +
          text(180, 8 - 16, "axe", { size: 11, color: RED }) +
          text(90, 175, "figure", { size: 10.5, color: DARK }) +
          text(280, 175, "à compléter", { size: 10.5, color: RED });
      })() },
    { slug: "symetrie-centrale", label: "Symétrie centrale", keywords: "symetrie centrale centre point moitie tour retour",
      svg: (() => {
        const fig = [c(30, 25), c(85, 25), c(85, 70), c(30, 70)];
        const img = fig.map((p) => c(240 - p[0], 170 - p[1]));
        return poly(fig, fill("#dbeafe", BLUE, 2.2)) + poly(img, fill("#fee2e2", RED, 2.2)) +
          line(30, 25, 210, 145, dashColor(GRAY, 1.4)) + line(85, 70, 155, 100, dashColor(GRAY, 1.4)) +
          dot(120, 85, 4, DARK) +
          line(110, 85, 130, 85, st(DARK, 1.6)) + line(120, 75, 120, 95, st(DARK, 1.6)) +
          text(132, 82, "O", { size: 14, bold: true }) +
          text(58, 90, "figure", { size: 11, color: DARK }) + text(180, 100, "image", { size: 11, color: RED }) +
          text(120, 160, "symétrie centrale (retournement autour de O)", { size: 11, color: GRAY });
      })() },
    { slug: "quadrillage-vierge", label: "Quadrillage vierge", keywords: "quadrillage vierge reproduction cp ce1 ce2",
      vb: "0 0 340 220",
      svg: grid(20, 20, 300, 180, 20) },
    { slug: "reproduction-quadrillage", label: "Reproduction sur quadrillage", keywords: "reproduction quadrillage exercice figure cp ce1 ce2",
      vb: "0 0 360 200",
      svg: (() => {
        const fig = [c(40, 120), c(40, 70), c(90, 40), c(140, 70), c(140, 120)];
        return grid(20, 20, 140, 140, 20) + grid(200, 20, 140, 140, 20) +
          poly(fig, fill("#fef9c3", "#eab308", 2)) +
          text(90, 178, "modèle", { size: 10.5, color: DARK }) +
          text(270, 178, "reproduis ici", { size: 10.5, color: RED });
      })() },
    { slug: "axes-figures-usuelles", label: "Axes de symétrie des figures usuelles", keywords: "axes symetrie figures usuelles carre rectangle cercle triangle losange synthese",
      vb: "0 0 480 175",
      svg: (() => {
        const cell = (x: number, kind: string, name: string) => {
          const cx = x + 40, cy = 60;
          let s = "";
          if (kind === "carre") {
            const sq = [c(cx - 26, cy - 26), c(cx + 26, cy - 26), c(cx + 26, cy + 26), c(cx - 26, cy + 26)];
            s = poly(sq, st(BLUE, 1.8)) +
              line(cx - 26, cy - 26, cx + 26, cy + 26, dashColor(RED, 1.4)) + line(cx - 26, cy + 26, cx + 26, cy - 26, dashColor(RED, 1.4)) +
              line(cx, cy - 26, cx, cy + 26, dashColor(RED, 1.4)) + line(cx - 26, cy, cx + 26, cy, dashColor(RED, 1.4));
          }
          if (kind === "rectangle") {
            const rc = [c(cx - 34, cy - 20), c(cx + 34, cy - 20), c(cx + 34, cy + 20), c(cx - 34, cy + 20)];
            s = poly(rc, st(BLUE, 1.8)) + line(cx, cy - 20, cx, cy + 20, dashColor(RED, 1.4)) + line(cx - 34, cy, cx + 34, cy, dashColor(RED, 1.4));
          }
          if (kind === "cercle") {
            s = circle(cx, cy, 30, st(BLUE, 1.8)) +
              line(cx - 30, cy, cx + 30, cy, dashColor(RED, 1.4)) + line(cx, cy - 30, cx, cy + 30, dashColor(RED, 1.4)) +
              line(cx - 21, cy - 21, cx + 21, cy + 21, dashColor(RED, 1.4));
          }
          if (kind === "equilateral") {
            const tr = regPts(cx, cy + 6, 32, 3, -90);
            s = poly(tr, st(BLUE, 1.8)) +
              line(tr[0][0], tr[0][1], cx, cy + 32, dashColor(RED, 1.4)) + line(tr[1][0], tr[1][1], (tr[0][0] + tr[2][0]) / 2, (tr[0][1] + tr[2][1]) / 2, dashColor(RED, 1.4)) +
              line(tr[2][0], tr[2][1], (tr[0][0] + tr[1][0]) / 2, (tr[0][1] + tr[1][1]) / 2, dashColor(RED, 1.4));
          }
          if (kind === "losange") {
            const lo = [c(cx, cy - 32), c(cx + 24, cy), c(cx, cy + 32), c(cx - 24, cy)];
            s = poly(lo, st(BLUE, 1.8)) + line(cx, cy - 32, cx, cy + 32, dashColor(RED, 1.4)) + line(cx - 24, cy, cx + 24, cy, dashColor(RED, 1.4));
          }
          if (kind === "isocele") {
            const tr = [c(cx - 30, cy + 26), c(cx + 30, cy + 26), c(cx, cy - 30)];
            s = poly(tr, st(BLUE, 1.8)) + line(cx, cy - 30, cx, cy + 26, dashColor(RED, 1.4));
          }
          return s + text(cx, 118, name, { size: 11.5, color: DARK, bold: true });
        };
        return (
          cell(10, "carre", "4 axes") + cell(90, "rectangle", "2 axes") + cell(170, "cercle", "une infinité") +
          cell(250, "equilateral", "3 axes") + cell(330, "losange", "2 axes") + cell(410, "isocele", "1 axe")
        );
      })() },
  ],
};

/* ═══════════════ 10. REPÈRES ET PROPORTIONNALITÉ ═══════════════ */

/** Repère cartésien du premier quadrant (usage primaire). */
function repere(opts: {
  x0?: number; y0?: number; unit?: number; xmax?: number; ymax?: number;
  w?: number; h?: number; numSize?: number;
}) {
  const { x0 = 60, y0 = 220, unit = 20, xmax = 12, ymax = 9, w = 330, h = 265, numSize = 9 } = opts;
  const gx = x0, gy = y0 - ymax * unit;
  let s = grid(gx, gy, xmax * unit, ymax * unit, unit);
  s += arrowLine(x0 - 8, y0, x0 + xmax * unit + 12, y0, st(DARK, 2));
  s += arrowLine(x0, y0 + 8, x0, y0 - ymax * unit - 12, st(DARK, 2));
  for (let i = 1; i <= xmax; i++) s += text(x0 + i * unit, y0 + 13, String(i), { size: numSize, color: GRAY });
  for (let j = 1; j <= ymax; j++) s += text(x0 - 8, y0 - j * unit + 3, String(j), { size: numSize, color: GRAY, anchor: "end" });
  s += text(x0 - 6, y0 + 15, "O", { size: 11, color: DARK, bold: true });
  s += text(x0 + xmax * unit + 16, y0 - 6, "x", { size: 12, italic: true, color: DARK });
  s += text(x0 - 4, y0 - ymax * unit - 18, "y", { size: 12, italic: true, color: DARK });
  return { svg: s, px: (x: number) => x0 + x * unit, py: (yv: number) => y0 - yv * unit };
}

export const reperes: GeoFigureCategory = {
  id: "reperes-graphiques",
  label: "Repères et proportionnalité",
  description: "Repère orthogonal, placement de points, droite de proportionnalité, courbes",
  chip: "bg-teal-100 text-teal-700",
  items: [
    { slug: "repere-vierge", label: "Repère orthogonal vierge", keywords: "repere orthogonal vierge axes coordonnees xy origine",
      vb: "0 0 330 265",
      svg: repere({}).svg },
    { slug: "repere-points", label: "Repère avec points placés", keywords: "repere points coordonnees placement abscisse ordonnee",
      vb: "0 0 330 265",
      svg: (() => {
        const R = repere({});
        const A = [R.px(3), R.py(4)], B = [R.px(6), R.py(2)], Cc = [R.px(2), R.py(7)];
        return R.svg +
          dot(A[0], A[1], 4, RED) + dot(B[0], B[1], 4, GREEN) + dot(Cc[0], Cc[1], 4, PURPLE) +
          text(A[0] + 8, A[1] - 6, "A", { size: 12, color: RED, bold: true }) +
          text(B[0] + 8, B[1] - 6, "B", { size: 12, color: GREEN, bold: true }) +
          text(Cc[0] + 8, Cc[1] - 6, "C", { size: 12, color: PURPLE, bold: true }) +
          text(180, 30, "A(3 ; 4)   B(6 ; 2)   C(2 ; 7)", { size: 11.5, color: DARK });
      })() },
    { slug: "proportionnalite-graphe", label: "Graphe de proportionnalité (y = 2x)", keywords: "proportionnalite graphe droite passe origine coefficient lineairete y 2x",
      vb: "0 0 330 265",
      svg: (() => {
        const R = repere({ unit: 25, xmax: 10, ymax: 8, x0: 55, y0: 225 });
        const pts = [[0, 0], [1, 2], [2, 4], [3, 6], [4, 8]];
        let dots = "";
        for (const [xx, yy] of pts) {
          const p = [R.px(xx), R.py(yy)];
          dots += dot(p[0], p[1], 4.5, RED);
        }
        const end = [R.px(4.6), R.py(9.2)];
        return R.svg +
          line(R.px(0), R.py(0), end[0], end[1], st(BLUE, 2.5)) +
          dots +
          text(200, 45, "y = 2x", { size: 14, color: BLUE, bold: true }) +
          text(165, 255, "la droite passe par l'origine : proportionnalité", { size: 11, color: DARK });
      })() },
    { slug: "proportionnalite-comparaison", label: "Proportionnel ou non ?", keywords: "proportionnalite comparaison droite origine affine non proportionnel reconnaissance",
      vb: "0 0 330 265",
      svg: (() => {
        const R = repere({ unit: 25, xmax: 8, ymax: 8, x0: 55, y0: 225 });
        return R.svg +
          line(R.px(0), R.py(0), R.px(8), R.py(8), st(GREEN, 2.5)) +
          line(R.px(0), R.py(2), R.px(6), R.py(8), st(RED, 2.5)) +
          dot(R.px(0), R.py(0), 4, DARK) +
          text(250, 60, "passe par O", { size: 11, color: GREEN, bold: true }) +
          text(90, 100, "ne passe pas par O", { size: 11, color: RED, bold: true }) +
          text(165, 255, "verte : proportionnelle — rouge : non proportionnelle", { size: 10.5, color: DARK });
      })() },
    { slug: "courbe-temperatures", label: "Courbe (températures de la semaine)", keywords: "courbe temperatures graphique ligne semaine evolution",
      vb: "0 0 340 250",
      svg: (() => {
        const x0 = 55, y0 = 210, ux = 38;
        const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
        const temps = [22, 24, 21, 25, 28, 26, 23];
        let s = "";
        for (let t = 0; t <= 30; t += 10) {
          const y = y0 - t * 6;
          s += line(x0, y, x0 + 7 * ux + 10, y, st("#e2e8f0", 1)) + text(x0 - 8, y + 3, String(t), { size: 9, color: GRAY, anchor: "end" });
        }
        s += arrowLine(x0 - 6, y0, x0 + 7 * ux + 20, y0, st(DARK, 2)) + arrowLine(x0, y0 + 8, x0, 22, st(DARK, 2));
        days.forEach((d, i) => {
          s += text(x0 + (i + 0.5) * ux, y0 + 16, d, { size: 10, color: DARK });
        });
        const pts = temps.map((t, i) => [x0 + (i + 0.5) * ux, y0 - t * 6] as Pt);
        s += polyline(pts, st(BLUE, 2.5));
        for (const p of pts) s += dot(p[0], p[1], 4, RED);
        s += text(170, 14, "Températures de la semaine (°C)", { size: 12.5, color: DARK, bold: true });
        return s;
      })() },
    { slug: "diagramme-battons-exemple", label: "Diagramme en bâtons (exemple)", keywords: "diagramme batons barres exemple statistique animaux",
      vb: "0 0 340 250",
      svg: (() => {
        const x0 = 55, y0 = 205, ub = 15;
        const data: [string, number, string][] = [
          ["Chien", 12, "#3b82f6"], ["Chat", 9, "#22c55e"], ["Oiseau", 5, "#f59e0b"], ["Poisson", 3, "#8b5cf6"],
        ];
        let s = "";
        for (let v = 0; v <= 12; v += 3) {
          const y = y0 - v * ub;
          s += line(x0, y, 305, y, st("#e2e8f0", 1)) + text(x0 - 8, y + 3, String(v), { size: 9, color: GRAY, anchor: "end" });
        }
        s += arrowLine(x0 - 6, y0, 315, y0, st(DARK, 2)) + arrowLine(x0, y0 + 8, x0, 20, st(DARK, 2));
        data.forEach(([label, v, color], i) => {
          const bx = x0 + 18 + i * 60;
          const hgt = v * ub;
          s += poly([c(bx, y0), c(bx + 34, y0), c(bx + 34, y0 - hgt), c(bx, y0 - hgt)], fill(color, color, 1.5));
          s += text(bx + 17, y0 - hgt - 8, String(v), { size: 11.5, color: DARK, bold: true });
          s += text(bx + 17, y0 + 16, label, { size: 10, color: DARK });
        });
        s += text(170, 14, "Animaux préférés de la classe (effectifs)", { size: 12.5, color: DARK, bold: true });
        return s;
      })() },
  ],
};

/* ═══════════════ 11. GRANDEURS ET MESURES ═══════════════ */

export const mesures: GeoFigureCategory = {
  id: "grandeurs-mesures",
  label: "Grandeurs et mesures",
  description: "Longueurs, périmètres, aires, mesure à la règle, comparaison de masses",
  chip: "bg-lime-100 text-lime-700",
  items: [
    { slug: "comparaison-longueurs", label: "Comparer des longueurs", keywords: "comparer longueurs grand petit segment plus long court maternelle cp",
      svg: (() => {
        const seg = (y: number, len: number) => line(30, y, 30 + len, y, st(BLUE, 3)) + dot(30, y) + dot(30 + len, y);
        return seg(40, 170) + seg(80, 110) + seg(120, 60) +
          text(215, 44, "le plus long", { size: 11.5, color: GREEN, anchor: "start", bold: true }) +
          text(215, 124, "le plus court", { size: 11.5, color: RED, anchor: "start", bold: true });
      })() },
    { slug: "perimetre", label: "Le périmètre (contour)", keywords: "perimetre contour carre 4 cotes formule mesure",
      vb: "0 0 240 195",
      svg: (() => {
        const sq = [c(55, 40), c(185, 40), c(185, 170), c(55, 170)];
        return poly(sq, st(RED, 4)) +
          text(120, 26, "6 cm", { size: 12, color: RED }) +
          text(38, 110, "6 cm", { size: 12, color: RED }) +
          text(120, 188, "P = 4 × 6 = 24 cm", { size: 13, color: DARK, bold: true });
      })() },
    { slug: "aire-carreaux", label: "L'aire en carreaux", keywords: "aire carreaux quadrillage rectangle compter formule",
      vb: "0 0 240 160",
      svg: (() => {
        const w = 22, h = 22, cols = 6, rows = 4;
        const x0 = 27, y0 = 20;
        return poly([c(x0, y0), c(x0 + cols * w, y0), c(x0 + cols * w, y0 + rows * h), c(x0, y0 + rows * h)], fill("#dbeafe", BLUE, 2.2)) +
          grid(x0, y0, cols * w, rows * h, w, "#93c5fd") +
          text(120, 140, "A = 6 × 4 = 24 carreaux", { size: 12.5, color: DARK, bold: true });
      })() },
    { slug: "aire-triangle", label: "Aire du triangle", keywords: "aire triangle base hauteur formule cm2",
      svg: (() => {
        const A = c(30, 140), B = c(200, 140), Cc = c(95, 25);
        const foot = c(95, 140);
        return poly([A, B, Cc], st()) +
          line(foot[0], foot[1], Cc[0], Cc[1], st(RED, 2)) +
          rightAngleMark(foot[0], foot[1], B, Cc, 12) +
          text(foot[0] - 14, foot[1] - 16, "h", { size: 13, color: RED, bold: true, italic: true }) +
          text(115, 158, "b (base)", { size: 12, color: DARK, bold: true }) +
          text(120, 183 - 10, "A = (b × h) ÷ 2", { size: 13, color: DARK, bold: true });
      })() },
    { slug: "mesure-segment", label: "Mesurer à la règle", keywords: "mesurer regle segment cm graduations outil",
      vb: "0 0 240 150",
      svg: (() => {
        let s = line(20, 45, 195, 45, st(RED, 3)) + dot(20, 45) + dot(195, 45) +
          text(107, 30, "7 cm", { size: 13, color: RED, bold: true }) +
          poly([c(20, 65), c(220, 65), c(220, 115), c(20, 115)], fill("#fffbeb", "#f59e0b", 2));
        for (let i = 0; i <= 8; i++) {
          const x = 20 + i * 25;
          s += line(x, 65, x, 80, st("#b45309", 1.6)) + text(x, 94, String(i), { size: 10, color: "#b45309" });
          if (i < 8) s += line(x + 12.5, 65, x + 12.5, 72, st("#d97706", 1.2));
        }
        s += text(120, 112, "règle graduée en cm", { size: 10.5, color: "#b45309" });
        return s;
      })() },
    { slug: "comparaison-masses", label: "Comparer des masses (balance)", keywords: "masses balance lourd leger comparer maternelle cp grandeurs",
      svg: (() => {
        const beamA = c(35, 62), beamB = c(205, 38);
        const panL = c(35, 100), panR = c(205, 76);
        return poly([c(105, 60), c(135, 60), c(120, 150)], fill("#e2e8f0", DARK, 2)) +
          line(beamA[0], beamA[1], beamB[0], beamB[1], st(DARK, 3)) +
          line(35, 62, 35, 100, st(DARK, 2)) + line(205, 38, 205, 76, st(DARK, 2)) +
          path(arcPath(35, 100, 30, 180, 360), st(BLUE, 2.2)) +
          path(arcPath(205, 76, 30, 180, 360), st(BLUE, 2.2)) +
          text(35, 135, "lourd", { size: 11.5, color: RED, bold: true }) +
          text(205, 112, "léger", { size: 11.5, color: GREEN, bold: true }) +
          text(120, 165, "la balance penche du côté le plus lourd", { size: 11, color: GRAY });
      })() },
  ],
};

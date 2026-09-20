/**
 * ============================================================================
 * GEO-PLANE 2 — Figures planes (2/2) : polygones, cercle et disque
 * ============================================================================
 */

import {
  BLUE, RED, DARK, GREEN, GRAY, PURPLE,
  st, fill, line, poly, polyline, circle, ellipse, path, text, dot,
  ticks, rightAngleMark, chevrons, regPts, pol, arcPath, sectorPath,
  angleOf, norm360, innerArc,
} from "./geo-kit";
import type { GeoFigureCategory, Pt } from "./geo-kit";

const c = (x: number, y: number): Pt => [x, y];

/* ═══════════════ 4. POLYGONES ═══════════════ */

export const polygones: GeoFigureCategory = {
  id: "polygones",
  label: "Polygones",
  description: "Réguliers (pentagone → dodécagone), irréguliers, concaves, diagonales…",
  chip: "bg-violet-100 text-violet-700",
  items: [
    { slug: "pentagone", label: "Le pentagone (régulier)", keywords: "pentagone 5 cotes polygone regulier",
      svg: poly(regPts(120, 85, 68, 5, -90), st()) + text(120, 160, "5 côtés", { size: 12, color: DARK }) },
    { slug: "hexagone", label: "L'hexagone (régulier)", keywords: "hexagone 6 cotes polygone regulier abeille",
      svg: poly(regPts(120, 85, 68, 6, 0), st()) + text(120, 165, "6 côtés", { size: 12, color: DARK }) },
    { slug: "heptagone", label: "L'heptagone (7 côtés)", keywords: "heptagone 7 cotes polygone regulier",
      svg: poly(regPts(120, 85, 68, 7, -90), st()) + text(120, 165, "7 côtés", { size: 12, color: DARK }) },
    { slug: "octogone", label: "L'octogone (régulier)", keywords: "octogone 8 cotes polygone regulier panneau stop",
      svg: poly(regPts(120, 85, 68, 8, 22.5), st()) + text(120, 165, "8 côtés", { size: 12, color: DARK }) },
    { slug: "nonagone", label: "L'ennéagone / nonagone (9 côtés)", keywords: "enneagone nonagone 9 cotes polygone regulier",
      svg: poly(regPts(120, 88, 68, 9, -90), st()) + text(120, 168, "9 côtés", { size: 12, color: DARK }) },
    { slug: "decagone", label: "Le décagone (10 côtés)", keywords: "decagone 10 cotes polygone regulier",
      svg: poly(regPts(120, 88, 68, 10, -90), st()) + text(120, 168, "10 côtés", { size: 12, color: DARK }) },
    { slug: "dodecagone", label: "Le dodécagone (12 côtés)", keywords: "dodecagone 12 cotes polygone regulier horloge",
      svg: poly(regPts(120, 88, 68, 12, -90), st()) + text(120, 168, "12 côtés", { size: 12, color: DARK }) },
    { slug: "polygone-etoile", label: "Le pentagramme (étoile à 5 branches)", keywords: "pentagramme etoile 5 branches polygone croise",
      svg: poly(regPts(120, 88, 72, 5, -90), st(PURPLE, 2.5)) },
    { slug: "polygone-irregulier", label: "Polygone irrégulier (convexe)", keywords: "polygone irregulier convexe quelconque cotes differents",
      svg: (() => {
        const pts = [c(30, 110), c(60, 40), c(120, 25), c(190, 55), c(210, 130), c(100, 150)];
        return poly(pts, st()) + text(120, 15, "6 côtés, tous différents", { size: 11.5, color: DARK });
      })() },
    { slug: "polygone-concave", label: "Polygone concave", keywords: "polygone concave non convexe rentre",
      svg: (() => {
        const pts = [c(30, 40), c(100, 30), c(85, 85), c(200, 60), c(210, 140), c(40, 145)];
        return poly(pts, st()) + dot(85, 85) + text(52, 115, "rentré", { size: 10.5, color: RED });
      })() },
    { slug: "polygone-diagonales", label: "Diagonales d'un pentagone", keywords: "diagonales pentagone polygone sommets non consecutifs",
      svg: (() => {
        const pts = regPts(120, 85, 66, 5, -90);
        let diags = "";
        for (let i = 0; i < 5; i++) {
          for (let j = i + 2; j < 5; j++) {
            if (i === 0 && j === 4) continue; // côté, pas diagonale
            diags += line(pts[i][0], pts[i][1], pts[j][0], pts[j][1], st(GRAY, 1.4));
          }
        }
        const labels = ["A", "B", "C", "D", "E"];
        const outs = [c(0, -12), c(13, -8), c(13, 10), c(-13, -8), c(-13, 10)];
        return diags + poly(pts, st()) +
          pts.map((p, i) => dot(p[0], p[1])).join("") +
          pts.map((p, i) => text(p[0] + outs[i][0], p[1] + outs[i][1], labels[i], { size: 13, bold: true })).join("");
      })() },
    { slug: "polygone-nomenclature", label: "Sommets, côtés et diagonales (nomenclature)", keywords: "polygone sommet cote diagonale nomenclature vocabulaire hexagone abc",
      vb: "0 0 320 170",
      svg: (() => {
        const pts = regPts(85, 90, 58, 6, 0);
        const labels = ["A", "B", "C", "D", "E", "F"];
        const outs = [c(13, 4), c(11, -12), c(-8, -14), c(-15, -2), c(-8, 15), c(11, 13)];
        return poly(pts, st()) +
          line(pts[0][0], pts[0][1], pts[3][0], pts[3][1], st(GRAY, 1.4)) +
          pts.map((p, i) => dot(p[0], p[1])).join("") +
          pts.map((p, i) => text(p[0] + outs[i][0], p[1] + outs[i][1], labels[i], { size: 13, bold: true })).join("") +
          text(168, 65, "sommets : A, B, C…", { size: 11, color: DARK, anchor: "start" }) +
          text(168, 90, "côtés : [AB], [BC]…", { size: 11, color: DARK, anchor: "start" }) +
          text(168, 115, "diagonale : [AD]", { size: 11, color: GRAY, anchor: "start" });
      })() },
  ],
};

/* ═══════════════ 5. CERCLE ET DISQUE ═══════════════ */

export const cercles: GeoFigureCategory = {
  id: "cercle-disque",
  label: "Cercle et disque",
  description: "Rayon, diamètre, corde, arc, secteur, tangente, cercles particuliers…",
  chip: "bg-cyan-100 text-cyan-700",
  items: [
    { slug: "cercle-centre-rayon", label: "Cercle : centre et rayon", keywords: "cercle centre rayon o compas",
      svg: (() => {
        const O = c(120, 85), P = pol(120, 85, 62, 35);
        return circle(120, 85, 62, st()) + dot(120, 85) +
          line(O[0], O[1], P[0], P[1], st(RED, 2)) +
          text(112, 100, "O", { size: 15, bold: true }) +
          text(148, 60, "r", { size: 15, color: RED, bold: true, italic: true });
      })() },
    { slug: "cercle-diametre", label: "Cercle et diamètre", keywords: "cercle diametre axe symetrie d 2r",
      svg: (() => {
        const A = pol(120, 85, 62, 160), B = pol(120, 85, 62, -20);
        return circle(120, 85, 62, st()) + dot(120, 85) +
          line(A[0], A[1], B[0], B[1], st(RED, 2)) +
          text(112, 100, "O", { size: 15, bold: true }) +
          text(38, 45, "d = 2 × r", { size: 14, color: RED }) +
          text(A[0] - 8, A[1] + 14, "A", { size: 13, bold: true }) + text(B[0] + 8, B[1] - 8, "B", { size: 13, bold: true });
      })() },
    { slug: "cercle-corde", label: "Cercle et corde", keywords: "cercle corde ab segment",
      svg: (() => {
        const A = pol(120, 85, 62, 150), B = pol(120, 85, 62, 40);
        return circle(120, 85, 62, st()) + dot(A[0], A[1]) + dot(B[0], B[1]) +
          line(A[0], A[1], B[0], B[1], st(RED, 2)) +
          text(A[0] - 10, A[1] + 5, "A", { size: 13, bold: true }) + text(B[0] + 10, B[1] - 5, "B", { size: 13, bold: true }) +
          text(120, 163, "la corde [AB]", { size: 12, color: DARK });
      })() },
    { slug: "disque", label: "Le disque (surface intérieure)", keywords: "disque surface interieure cercle aire",
      svg: circle(120, 85, 62, fill("#dbeafe", BLUE, 2.5)) +
        text(120, 85, "disque", { size: 14, color: DARK, bold: true }) +
        text(120, 163, "surface colorée = disque ; ligne = cercle", { size: 11.5, color: GRAY }) },
    { slug: "arc-cercle", label: "Arc de cercle", keywords: "arc cercle portion rayons angle secteur",
      svg: (() => {
        const A = pol(120, 100, 62, 30), B = pol(120, 100, 62, 150);
        return path(arcPath(120, 100, 62, 30, 150), st(BLUE, 4)) +
          dot(A[0], A[1]) + dot(B[0], B[1]) +
          line(120, 100, A[0], A[1], st(GRAY, 1.5)) + line(120, 100, B[0], B[1], st(GRAY, 1.5)) +
          dot(120, 100, 2.5, GRAY) + text(113, 112, "O", { size: 13, color: GRAY, bold: true }) +
          text(A[0] + 10, A[1] - 4, "A", { size: 13, bold: true }) + text(B[0] - 10, B[1] - 4, "B", { size: 13, bold: true });
      })() },
    { slug: "secteur-circulaire", label: "Le secteur circulaire", keywords: "secteur circulaire camembert angle au centre part fraction",
      svg: (() => {
        const A = pol(120, 90, 62, 20), B = pol(120, 90, 62, 110);
        return path(`M 120 90 L ${A.join(" ")} A 62 62 0 0 0 ${B.join(" ")} Z`, fill("#fde68a", "#f59e0b", 2.5)) +
          circle(120, 90, 62, st()) +
          innerArc(c(120, 90), c(200, 90), B, 20) +
          text(140, 78, "secteur", { size: 12, color: "#b45309" });
      })() },
    { slug: "tangente-cercle", label: "Tangente à un cercle", keywords: "tangente cercle perpendiculaire rayon point contact",
      svg: (() => {
        const O = c(120, 95), T = c(120, 150);
        return circle(120, 95, 55, st()) + dot(120, 95) +
          line(15, 150, 225, 150, st(RED, 2.2)) +
          line(O[0], O[1], T[0], T[1], st(GREEN, 2)) +
          rightAngleMark(T[0], T[1], c(180, 150), c(120, 105), 12) +
          text(112, 90, "O", { size: 14, bold: true }) + text(128, 145, "T", { size: 13, bold: true }) +
          text(190, 137, "tangente (d)", { size: 11.5, color: RED });
      })() },
    { slug: "cercles-tangents", label: "Deux cercles tangents", keywords: "cercles tangents externes point contact",
      svg: (() => {
        const O1 = c(85, 80), O2 = c(158, 80);
        return circle(85, 80, 55, st()) + circle(158, 80, 18, st(RED, 2.2)) +
          dot(85, 80) + dot(158, 80) +
          text(75, 85, "O₁", { size: 13, bold: true }) + text(166, 72, "O₂", { size: 13, bold: true, color: RED }) +
          dot(140, 80, 3, DARK) + text(120, 132, "point de contact", { size: 10.5, color: DARK });
      })() },
    { slug: "cercles-secants", label: "Deux cercles sécants", keywords: "cercles secants intersection deux points",
      svg: (() => {
        const A = c(88, 61), B = c(88, 109);
        return circle(90, 85, 55, st()) + circle(150, 85, 45, st(RED, 2.2)) +
          dot(A[0], A[1]) + dot(B[0], B[1]) +
          text(74, 56, "A", { size: 13, bold: true }) + text(74, 124, "B", { size: 13, bold: true });
      })() },
    { slug: "cercles-concentriques", label: "Cercles concentriques", keywords: "cercles concentriques meme centre cible",
      svg: circle(120, 85, 62, st()) + circle(120, 85, 42, st(GREEN, 2.2)) + circle(120, 85, 22, st(RED, 2.2)) +
        dot(120, 85) + text(113, 100, "O", { size: 15, bold: true }) },
    { slug: "cercle-circonscrit", label: "Cercle circonscrit à un triangle", keywords: "cercle circonscrit triangle sommets mediatrices cm2",
      vb: "0 0 240 200",
      svg: (() => {
        const A = c(60, 135), B = c(180, 135), C = c(120, 55);
        return circle(120, 117.5, 62.5, st(GREEN, 2.2)) +
          poly([A, B, C], st()) + dot(A[0], A[1]) + dot(B[0], B[1]) + dot(C[0], C[1]) +
          text(45, 148, "A", { size: 13, bold: true }) + text(190, 148, "B", { size: 13, bold: true }) + text(120, 46, "C", { size: 13, bold: true }) +
          text(120, 190, "les 3 sommets sont sur le cercle", { size: 11.5, color: DARK });
      })() },
  ],
};

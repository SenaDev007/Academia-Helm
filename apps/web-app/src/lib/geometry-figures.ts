/**
 * ============================================================================
 * GEOMETRY-FIGURES — Catalogue complet de géométrie (maternelle → CM2)
 * ============================================================================
 *
 * ⭐ Demande utilisateur : « toutes les figures géométriques qu'on utilise
 *    depuis la maternelle jusqu'en classe de CM2… triangles (plusieurs
 *    catégories), polygones, lignes, segments… tout ce qui a rapport avec
 *    la géométrie, vraiment au complet. »
 *
 * 11 catégories, ~110 figures : formes de base (maternelle), triangles,
 * quadrilatères, polygones, cercle/disque, droites/segments, angles,
 * solides + patrons, symétrie/quadrillage, repères/proportionnalité,
 * grandeurs et mesures.
 *
 * Les figures sont générées programmatiquement (src/lib/geo-*.ts) avec les
 * codages officiels (ticks d'égalité, carré d'angle droit, chevrons de
 * parallélisme, arcs d'angle). Insertion en SVG INLINE → rendu écran et
 * export PDF identiques.
 * ============================================================================
 */

import type { GeoFigureCategory, GeoFigureItem } from "./geo-kit";
import { maternelleShapes, triangles, quadrilateres } from "./geo-plane";
import { polygones, cercles } from "./geo-plane2";
import { droites, angles, solides, symetrie, reperes, mesures } from "./geo-space";

export type { GeoFigureCategory, GeoFigureItem };

export const GEOMETRY_FIGURE_CATEGORIES: GeoFigureCategory[] = [
  maternelleShapes,
  triangles,
  quadrilateres,
  polygones,
  cercles,
  droites,
  angles,
  solides,
  symetrie,
  reperes,
  mesures,
];

export const GEOMETRY_FIGURE_COUNT = GEOMETRY_FIGURE_CATEGORIES.reduce((n, cat) => n + cat.items.length, 0);

/* ── Recherche (accents-insensible, multi-termes) ── */
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function searchGeometryFigures(query: string): (GeoFigureItem & { catLabel: string })[] {
  const q = norm(query || "").trim();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return GEOMETRY_FIGURE_CATEGORIES.flatMap((cat) =>
    cat.items
      .filter((it) => {
        const hay = norm(`${it.label} ${it.keywords} ${cat.label}`);
        return terms.every((t) => hay.includes(t));
      })
      .map((it) => ({ ...it, catLabel: cat.label })),
  );
}

/** Enveloppe SVG complète d'une figure (insertion inline dans l'éditeur). */
export function wrapGeometrySvg(item: GeoFigureItem): string {
  const vb = item.vb || "0 0 240 170";
  const parts = vb.split(" ").map(Number);
  const w = parts[2] || 240;
  const h = parts[3] || 170;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" style="max-width:100%;height:auto;background:#ffffff;" role="img">` +
    `<rect x="0" y="0" width="${w}" height="${h}" fill="#ffffff"/>${item.svg}</svg>`
  );
}

/** HTML d'insertion prêt pour l'éditeur riche. */
export function geometryFigureToInsertHtml(item: GeoFigureItem): string {
  return (
    `<span class="ah-fig" contenteditable="false" data-geo="${item.slug}" title="${item.label}" ` +
    `style="display:block;max-width:100%;">${wrapGeometrySvg(item)}</span>&nbsp;`
  );
}

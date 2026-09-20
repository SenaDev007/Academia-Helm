/**
 * ============================================================================
 * PACKS D'IMAGES PÉDAGOGIQUES — Manifeste
 * ============================================================================
 *
 * ⭐ Bibliothèque d'illustrations SVG intégrée à l'application, organisée par
 *    matière/discipline, pour enrichir les fiches pédagogiques et le cahier
 *    journal (demande utilisateur : « packs d'images » pour l'EST — muscles,
 *    arbres, anatomie —, les mathématiques — figures, diagrammes —, la
 *    biologie, la géologie…).
 *
 * Les fichiers vivent dans /public/pedagogy-assets/<catégorie>/<slug>.svg
 * Ils sont INSÉRÉS EN SVG INLINE dans les éditeurs (et non en <img>) :
 *   - rendu identique à l'écran ET dans les exports PDF (Puppeteer)
 *   - aucune dépendance à une URL absolue (fonctionne hors-ligne)
 *   - redimensionnement fluide (viewBox)
 * ============================================================================
 */

export interface PedagogyAssetItem {
  /** Slug = nom de fichier (sans .svg) */
  slug: string;
  /** Chemin public complet */
  file: string;
  /** Libellé affiché dans la bibliothèque */
  label: string;
  /** Mots-clés de recherche (minuscules, sans accents) */
  keywords: string[];
}

export interface PedagogyAssetCategory {
  /** Slug du dossier */
  id: string;
  /** Libellé de la catégorie */
  label: string;
  /** Description courte */
  description: string;
  /** Petite pastille de couleur (Tailwind) */
  chip: string;
  /** Icône (nom lucide résolu dans le composant) */
  icon: "anatomie" | "leaf" | "mountain" | "sigma" | "ruler" | "zap" | "compass";
  /** Matières scolaires suggérées */
  subjects: string[];
  items: PedagogyAssetItem[];
}

const cat = (
  id: string,
  label: string,
  description: string,
  chip: string,
  icon: PedagogyAssetCategory["icon"],
  subjects: string[],
  items: [string, string, string][],
): PedagogyAssetCategory => ({
  id,
  label,
  description,
  chip,
  icon,
  subjects,
  items: items.map(([slug, itemLabel, keywords]) => ({
    slug,
    file: `/pedagogy-assets/${id}/${slug}.svg`,
    label: itemLabel,
    keywords: keywords.split(" "),
  })),
});

export const PEDAGOGY_ASSET_CATEGORIES: PedagogyAssetCategory[] = [
  cat(
    "anatomie",
    "Anatomie & corps humain",
    "Appareil digestif, respiration, cœur, muscles, squelette… (EST, biologie)",
    "bg-rose-100 text-rose-700",
    "anatomie",
    ["EST", "Sciences", "Biologie"],
    [
      ["appareil-digestif", "L'appareil digestif", "digestif digestion estomac intestin bouche oe sophage foie corps"],
      ["systeme-respiratoire", "Le système respiratoire", "respiration poumons trachee bronches air inspire expiration"],
      ["coeur-circulation", "Le cœur et la circulation", "coeur sang arteres veines circulation ventricule oreillette"],
      ["squelette", "Le squelette humain", "squelette os crane cotes colonne vertebrale bassin femur"],
      ["muscles", "Le système musculaire", "muscles biceps pectoraux abdominaux quadriceps mollets corps"],
      ["cerveau", "Le cerveau", "cerveau cervelet tronc cerebral pensee memoire nerfs"],
      ["dent", "Anatomie d'une dent", "dent email dentine pulpe gencive racine carie"],
    ],
  ),
  cat(
    "biologie-vegetal",
    "Biologie & végétal",
    "Arbres, plantes, cellule, chaîne alimentaire… (EST, sciences)",
    "bg-green-100 text-green-700",
    "leaf",
    ["EST", "Sciences", "Biologie"],
    [
      ["arbre-parties", "L'arbre et ses parties", "arbre racines tronc feuilles houppier vegetal plante"],
      ["fleur-parties", "La fleur et ses parties", "fleur petals etamines pistil tige feuille graine"],
      ["photosynthese", "La photosynthèse", "photosynthese feuille lumiere soleil eau co2 oxygene chlorophylle"],
      ["cellule-vegetale", "La cellule végétale", "cellule vegetale noyau membrane vacuole chloroplaste paroi"],
      ["chaine-alimentaire", "Une chaîne alimentaire", "chaine alimentaire herbe gazelle lion producteur consommateur predateur"],
      ["cycle-papillon", "Le cycle du papillon", "papillon metamorphose oeuf chenille chrysalide cycle vie"],
    ],
  ),
  cat(
    "geologie-terre",
    "Géologie & sciences de la Terre",
    "Cycle de l'eau, volcan, roches, strates… (EST, géologie)",
    "bg-amber-100 text-amber-700",
    "mountain",
    ["EST", "Géologie", "Sciences"],
    [
      ["cycle-eau", "Le cycle de l'eau", "eau cycle evaporation condensation pluie ruissellement nuage mer riviere"],
      ["couches-terre", "Les couches de la Terre", "terre croute manteau noyau coupe geologie structure interne"],
      ["strates-sol", "Les couches du sol", "sol strates humus litiere terre vegetale roche mere coupe pedologie"],
      ["volcan-coupe", "Le volcan en coupe", "volcan magma lave eruption cratere cheminee coulee"],
      ["cycle-roches", "Le cycle des roches", "roches ignees sedimentaires metamorphiques erosion cycle geologie"],
      ["etats-eau", "Les trois états de l'eau", "eau solide glace liquide gaz vapeur fusion solidification etats matiere"],
    ],
  ),
  cat(
    "maths-figures",
    "Mathématiques — figures",
    "Cercle, triangles, solides, angles, fractions… (maths)",
    "bg-blue-100 text-blue-700",
    "sigma",
    ["Mathématiques", "Géométrie"],
    [
      ["cercle", "Le cercle", "cercle rayon diametre corde arc centre ge ometrie"],
      ["triangles", "Les types de triangles", "triangle equilateral isocele rectangle cotes angles"],
      ["quadrilateres", "Les quadrilatères", "quadrilatere carre rectangle parallelogramme losange trapeze disque"],
      ["angles", "Les types d'angles", "angle aigu droit obtus plat degre rapporteur"],
      ["solides", "Les solides (3D)", "solide cube pave droit cylindre cone pyramide sphere volume"],
      ["droite-graduee", "La droite graduée", "droite graduee segment distance points abscisse"],
      ["perimetre-aire", "Périmètre et aire", "perimetre aire surface tour figure longueur largeur formule"],
      ["fractions", "Les fractions", "fraction demi quart tiers numerateur denominateur parts disque"],
    ],
  ),
  cat(
    "maths-outils",
    "Mathématiques — instruments",
    "Règle, rapporteur, équerre, compas",
    "bg-indigo-100 text-indigo-700",
    "ruler",
    ["Mathématiques", "Mesures"],
    [
      ["regle-graduee", "La règle graduée", "regle graduée cm mm mesure segment longueur"],
      ["rapporteur", "Le rapporteur", "rapporteur angle degre mesure tracer"],
      ["equerre-compas", "Équerre et compas", "equerre compas angle droit cercle tracer instruments geometrie"],
    ],
  ),
  cat(
    "physique-est",
    "Physique & technologie (EST)",
    "Circuits, aimants, leviers, engrenages…",
    "bg-purple-100 text-purple-700",
    "zap",
    ["EST", "Sciences", "Technologie"],
    [
      ["circuit-simple", "Le circuit électrique simple", "circuit electrique pile ampoule interrupteur fils courant ferme ouvert"],
      ["aimant-poles", "L'aimant et ses pôles", "aimant poles nord sud attraction repulsion champ magnetique"],
      ["levier", "Le levier", "levier point appui effort charge bras moteur balance"],
      ["engrenages", "Les engrenages", "engrenages roue dentee vitesse force transmission rotation"],
      ["balance", "La balance à plateaux", "balance plateaux masses equilibre peser comparaison"],
    ],
  ),
  cat(
    "geo-es",
    "Géographie & repères (ES)",
    "Rose des vents, globe terrestre… (Éducation sociale)",
    "bg-teal-100 text-teal-700",
    "compass",
    ["Éducation sociale", "Géographie", "Histoire"],
    [
      ["rose-vents", "La rose des vents", "rose vents nord sud est ouest directions carte orientation"],
      ["globe-terre", "Le globe terrestre", "globe terre equateur hemisphere axe poles continents carte"],
    ],
  ),
];

export const ALL_PEDAGOGY_ASSETS: PedagogyAssetItem[] =
  PEDAGOGY_ASSET_CATEGORIES.flatMap((c) => c.items);

/**
 * Recherche dans le manifeste (libellé + mots-clés, insensible aux accents).
 */
export function searchPedagogyAssets(query: string): PedagogyAssetItem[] {
  const q = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (!q) return ALL_PEDAGOGY_ASSETS;
  return ALL_PEDAGOGY_ASSETS.filter((a) => {
    const hay = `${a.label} ${a.keywords.join(" ")}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return q.split(/\s+/).some((w) => hay.includes(w));
  });
}

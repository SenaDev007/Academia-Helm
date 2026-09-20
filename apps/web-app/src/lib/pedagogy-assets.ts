/**
 * ============================================================================
 * PACKS D'IMAGES PÉDAGOGIQUES — Manifeste
 * ============================================================================
 *
 * ⭐ V2 (retour utilisateur) : les illustrations d'anatomie, de biologie, de
 *    botanique et de géologie sont désormais de VRAIES IMAGES RÉALISTES
 *    (schémas anatomiques professionnels, photographies) collectées sur le
 *    web et validées visuellement — plus de « SVG simplistes » pour les
 *    sciences. S'ajoutent les ANIMAUX domestiques et sauvages (maternelle /
 *    primaire) en photographies réalistes.
 *
 *    kind = "photo" → fichiers /pedagogy-images/<cat>/<slug>.<ext>
 *                       insertion en <img> (URL absolue → rendu PDF Puppeteer)
 *    kind = "svg"   → fichiers /pedagogy-assets/<cat>/<slug>.svg
 *                       insertion en SVG INLINE (vectoriel : maths, physique…)
 * ============================================================================
 */

export interface PedagogyAssetItem {
  /** Slug = identifiant */
  slug: string;
  /** Chemin public complet */
  file: string;
  /** Libellé affiché dans la bibliothèque */
  label: string;
  /** Mots-clés de recherche (minuscules, sans accents) */
  keywords: string[];
  /** Type : photo réaliste (img) ou illustration SVG (inline) */
  kind?: "svg" | "photo";
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
  icon: "anatomie" | "leaf" | "mountain" | "sigma" | "ruler" | "zap" | "compass" | "paw" | "microscope";
  /** Matières scolaires suggérées */
  subjects: string[];
  items: PedagogyAssetItem[];
}

/** Catégorie d'illustrations SVG (vectorielles). */
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
    kind: "svg" as const,
  })),
});

/** Catégorie d'images réalistes (photos / schémas professionnels). */
const catPhoto = (
  id: string,
  label: string,
  description: string,
  chip: string,
  icon: PedagogyAssetCategory["icon"],
  subjects: string[],
  items: [string, string, string, string][],
): PedagogyAssetCategory => ({
  id,
  label,
  description,
  chip,
  icon,
  subjects,
  items: items.map(([slug, ext, itemLabel, keywords]) => ({
    slug,
    file: `/pedagogy-images/${id}/${slug}.${ext}`,
    label: itemLabel,
    keywords: keywords.split(" "),
    kind: "photo" as const,
  })),
});

export const PEDAGOGY_ASSET_CATEGORIES: PedagogyAssetCategory[] = [
  catPhoto(
    "anatomie",
    "Anatomie & corps humain",
    "Schémas anatomiques réalistes et légendés (EST, biologie)",
    "bg-rose-100 text-rose-700",
    "anatomie",
    ["EST", "Sciences", "Biologie"],
    [
      ["appareil-digestif", "jpg", "L'appareil digestif", "digestif digestion estomac intestin bouche oesophage foie corps anatomie realiste"],
      ["systeme-respiratoire", "jpg", "Le système respiratoire", "respiration poumons trachee bronches air inspire expiration anatomie"],
      ["coeur-circulation", "jpg", "Le cœur et la circulation", "coeur sang arteres veines circulation ventricule oreillette anatomie"],
      ["systeme-musculaire", "jpg", "Le système musculaire", "muscles biceps pectoraux abdominaux quadriceps mollets corps anatomie"],
      ["squelette", "jpg", "Le squelette humain", "squelette os crane cotes colonne vertebrale bassin femur anatomie"],
      ["cerveau", "jpg", "Le cerveau", "cerveau cervelet tronc cerebral pensee memoire nerfs anatomie"],
      ["dent", "jpg", "Anatomie d'une dent", "dent email dentine pulpe gencive racine carie anatomie"],
      ["oeil", "jpg", "Anatomie de l'œil", "oeil vue cornee cristallin retine iris pupille optic anatomie"],
      ["oreille", "jpg", "Anatomie de l'oreille", "oreille audition tympan cochlee pavillon osselets anatomie"],
      ["peau", "jpg", "Anatomie de la peau", "peau epiderme derme hypoderme toucher coupe anatomie"],
      ["systeme-urinaire", "jpg", "Le système urinaire", "urinaire reins vessie ureteres uretre reins anatomie"],
      ["systeme-nerveux", "jpg", "Le système nerveux", "nerveux neurones moelle epiniere cerveau anatomie"],
      ["neurone", "jpg", "Le neurone", "neurone axone dendrites synapse cellule nerveuse anatomie"],
      ["cellules-sang", "jpg", "Les cellules du sang", "sang globules rouges blancs plaquettes hematies anatomie"],
    ],
  ),
  catPhoto(
    "botanique",
    "Botanique & végétal",
    "Arbres, plantes, fleurs, cellule végétale… (EST, sciences)",
    "bg-green-100 text-green-700",
    "leaf",
    ["EST", "Sciences", "Biologie"],
    [
      ["arbre-parties", "jpg", "L'arbre et ses parties", "arbre racines tronc feuilles houppier vegetal plante"],
      ["fleur-parties", "jpg", "La fleur et ses parties", "fleur petals etamines pistil tige feuille graine botanique"],
      ["feuille-nervures", "jpg", "La feuille et ses nervures", "feuille nervures limbe petiole botanique plante"],
      ["graine-germination", "jpg", "La germination de la graine", "germination graine plantule racine semis etapes"],
      ["cellule-vegetale", "jpg", "La cellule végétale", "cellule vegetale noyau membrane vacuole chloroplaste paroi"],
      ["photosynthese", "png", "La photosynthèse", "photosynthese feuille lumiere soleil eau co2 oxygene chlorophylle"],
      ["plante-parties", "jpg", "Les parties d'une plante", "plante racine tige feuille fleur botanique"],
    ],
  ),
  catPhoto(
    "biologie",
    "Biologie & sciences du vivant",
    "Cellules, chaîne alimentaire, cycles de vie, ADN…",
    "bg-emerald-100 text-emerald-700",
    "microscope",
    ["EST", "Sciences", "Biologie"],
    [
      ["cellule-animale", "png", "La cellule animale", "cellule animale noyau membrane mitochondrie cytoplasme"],
      ["chaine-alimentaire", "jpg", "Une chaîne alimentaire", "chaine alimentaire herbe gazelle lion producteur consommateur predateur"],
      ["cycle-papillon", "jpg", "Le cycle du papillon", "papillon metamorphose oeuf chenille chrysalide cycle vie"],
      ["cycle-grenouille", "jpg", "Le cycle de la grenouille", "grenouille têtard oeuf metamorphose cycle vie batracien"],
      ["adn", "png", "L'ADN (double hélice)", "adn double helice gene heredite genetique"],
      ["bacteries-virus", "png", "Bactéries et virus", "bacterie virus microbe microorganisme infection"],
    ],
  ),
  catPhoto(
    "geologie",
    "Géologie & sciences de la Terre",
    "Volcan, cycle de l'eau, strates, structure de la Terre…",
    "bg-amber-100 text-amber-700",
    "mountain",
    ["EST", "Géologie", "Sciences"],
    [
      ["cycle-eau", "jpg", "Le cycle de l'eau", "eau cycle evaporation condensation pluie ruissellement nuage mer riviere"],
      ["couches-terre", "jpg", "Les couches de la Terre", "terre croute manteau noyau coupe geologie structure interne"],
      ["strates", "jpg", "Les strates géologiques", "sol strates couches roches sedimentaire geologie coupe"],
      ["volcan-coupe", "jpg", "Le volcan en coupe", "volcan magma lave eruption cratere cheminee coulee"],
      ["roches-types", "jpg", "Les types de roches", "roches ignees sedimentaires metamorphiques erosion geologie"],
      ["tectonique", "jpg", "La tectonique des plaques", "tectonique plaques continents derive seismes montagnes"],
    ],
  ),
  catPhoto(
    "animaux-domestiques",
    "Animaux domestiques",
    "Photographies réalistes — ferme et maison (maternelle, primaire)",
    "bg-orange-100 text-orange-700",
    "paw",
    ["Maternelle", "Éveil", "Sciences", "Lecture"],
    [
      ["chien", "jpg", "Le chien", "chien animal domestique compagnon chiot mammifere"],
      ["chat", "jpg", "Le chat", "chat animal domestique chaton mammifere felin"],
      ["vache", "jpg", "La vache", "vache bovin ferme lait mammifere elevage"],
      ["chevre", "jpg", "La chèvre", "chevre caprin ferme fromage mammifere elevage"],
      ["mouton", "jpg", "Le mouton", "mouton ovin laine agneau ferme mammifere"],
      ["poule", "jpg", "La poule", "poule volaille oeuf coq poussin ferme oiseau"],
      ["cheval", "jpg", "Le cheval", "cheval equide ferme cavalier mammifere"],
      ["ane", "jpg", "L'âne", "ane equide bourricot ferme mammifere"],
      ["lapin", "jpg", "Le lapin", "lapin rongeur oreilles animal domestique mammifere"],
      ["canard", "jpg", "Le canard", "canard colvert palmipede ferme etang oiseau"],
      ["cochon", "jpg", "Le cochon", "cochon porc ferme mammifere elevage"],
      ["pigeon", "jpg", "Le pigeon", "pigeon oiseau ville voliere colombophile"],
    ],
  ),
  catPhoto(
    "animaux-sauvages",
    "Animaux sauvages",
    "Photographies réalistes — faune d'Afrique et du monde (maternelle, primaire)",
    "bg-yellow-100 text-yellow-700",
    "paw",
    ["Maternelle", "Éveil", "Sciences", "Lecture"],
    [
      ["lion", "jpg", "Le lion", "lion fauve savane afrique felin predateur criniere"],
      ["elephant", "jpg", "L'éléphant", "elephant afrique defenses proboscidien pachyderme savane"],
      ["girafe", "jpg", "La girafe", "girafe cou long savane afrique ruminant mammifere"],
      ["zebre", "jpg", "Le zèbre", "zebre rayures savane afrique equide mammifere"],
      ["singe", "jpg", "Le singe", "singe primate arbre jungle mammifere"],
      ["crocodile", "jpg", "Le crocodile", "crocodile reptile ecailles fleuve predateur"],
      ["hippopotame", "jpg", "L'hippopotame", "hippopotame hippo fleuve afrique mammifere"],
      ["gazelle", "jpg", "La gazelle", "gazelle antilope cornes savane afrique mammifere"],
      ["leopard", "jpg", "Le léopard", "leopard taches fauve afrique felin predateur"],
      ["perroquet", "jpg", "Le perroquet", "perroquet ara plumes oiseau tropiques"],
      ["autruche", "jpg", "L'autruche", "autruche oiseau cours afrique plus grand"],
      ["tortue", "jpg", "La tortue", "tortue mer reptile carapace nage"],
      ["rhinoceros", "jpg", "Le rhinocéros", "rhinoceros rhino corne afrique pachyderme"],
    ],
  ),
  cat(
    "maths-figures",
    "Mathématiques — figures",
    "Cercle, triangles, solides, angles, fractions… (vectoriel)",
    "bg-blue-100 text-blue-700",
    "sigma",
    ["Mathématiques", "Géométrie"],
    [
      ["cercle", "Le cercle", "cercle rayon diametre corde arc centre geometrie"],
      ["triangles", "Les types de triangles", "triangle equilateral isocele rectangle cotes angles"],
      ["quadrilateres", "Les quadrilatères", "quadrilatere carre rectangle parallelogramme losange trapeze"],
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
      ["regle-graduee", "La règle graduée", "regle graduee cm mm mesure segment longueur"],
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

export const PEDAGOGY_PHOTO_COUNT = ALL_PEDAGOGY_ASSETS.filter((a) => a.kind === "photo").length;
export const PEDAGOGY_SVG_COUNT = ALL_PEDAGOGY_ASSETS.filter((a) => a.kind !== "photo").length;

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

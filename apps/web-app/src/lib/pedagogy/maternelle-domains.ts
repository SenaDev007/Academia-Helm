/**
 * ============================================================================
 * MATERNELLE — MATIÈRES DYNAMIQUES (module partagé frontend)
 * ============================================================================
 *
 * ⭐ 2026-09-15 : la grille du cahier journal maternelle ET la préparation
 * des fiches pédagogiques (DOMAINE / DOMAINE_2) sont construites à partir
 * des matières réellement configurées pour la classe dans le module
 * Pédagogie → onglet « Matières & programmes » (tables class_subjects /
 * subjects), récupérées dynamiquement via /api/pedagogy-space/subjects/available
 * ou via `matGroups` / `matSubjects` renvoyés par le cahier journal.
 *
 * Chaque matière est classée dans son DOMAINE officiel (I → V + groupe
 * « DOMAINE [n° à renseigner] ») par correspondance de nom, insensible à
 * la casse et aux accents. Les matières non rattachables vont dans
 * « AUTRES MATIÈRES ».
 *
 * Miroir exact de la logique backend (pedagogical-space.service.ts) —
 * toute modification doit être répercutée des deux côtés.
 * ============================================================================
 */

export interface MatSubColumn {
  /** Clé d'entrée du cahier journal (nom de la matière ou obs_dom) */
  key: string;
  /** Libellé affiché dans l'en-tête de colonne */
  label: string;
  /** subjectId de la matière configurée (null pour la colonne Observations) */
  subjectId: string | null;
  weight?: number;
}

export interface MatGroup {
  key: string;
  title: string;
  hint: string | null;
  subs: MatSubColumn[];
}

/** Définitions des domaines officiels (mots-clés normalisés + clés legacy). */
export const MAT_DOMAIN_DEFS = [
  {
    key: "dom1", title: "DOMAINE I", hint: null as string | null,
    keywords: ["sante", "hygiene"],
    legacyKeys: ["dom1_sante"],
    domainLabel: "Éducation pour la santé",
    roman: "I",
    order: null as Record<string, number> | null,
  },
  {
    key: "dom2", title: "DOMAINE II", hint: null as string | null,
    keywords: ["corporelle", "psychomotrice", "motricite"],
    legacyKeys: ["dom2_corporelle"],
    domainLabel: "Expression corporelle",
    roman: "II",
    order: null as Record<string, number> | null,
  },
  {
    key: "domPre", title: "DOMAINE", hint: "N° à renseigner par l'enseignante",
    keywords: ["pre-lecture", "pre lecture", "pre-ecriture", "pre ecriture", "pre-math", "pre math"],
    legacyKeys: ["pre_lecture", "pre_ecriture", "pre_mathematiques"],
    domainLabel: null,
    roman: "",
    order: { "pre-lecture": 1, "pre-ecriture": 2, "pre-math": 3 } as Record<string, number>,
  },
  {
    key: "dom3", title: "DOMAINE III", hint: null as string | null,
    keywords: ["sensorielle", "eveil", "travaux manuels", "scientifique", "manuelle"],
    legacyKeys: ["dom3_sensorielle", "dom3_travaux_manuels"],
    domainLabel: "Éducation sensorielle",
    roman: "III",
    order: null as Record<string, number> | null,
  },
  {
    key: "dom4", title: "DOMAINE IV", hint: null as string | null,
    keywords: ["emotionnelle", "plastique", "dessin", "peinture", "coloriage"],
    legacyKeys: ["dom4_emotionnelle", "dom4_plastique"],
    domainLabel: "Expression émotionnelle et plastique",
    roman: "IV",
    order: null as Record<string, number> | null,
  },
  {
    key: "dom5", title: "DOMAINE V", hint: null as string | null,
    keywords: ["orale", "conte", "poesie", "chant", "comptine", "activites libres", "langage"],
    legacyKeys: ["dom5_comm_orale", "dom5_conte", "dom5_poesie_chant", "dom5_act_libres"],
    domainLabel: "Communication orale",
    roman: "V",
    order: null as Record<string, number> | null,
  },
] as const;

/** Libellés des anciennes colonnes codées en dur (avant matières dynamiques). */
export const MAT_LEGACY_LABELS: Record<string, string> = {
  dom1_sante: "Éducation pour la santé",
  dom2_corporelle: "Expression corporelle",
  pre_lecture: "Pré-lecture",
  pre_ecriture: "Pré-écriture",
  pre_mathematiques: "Pré-mathématiques",
  dom3_sensorielle: "Éducation sensorielle",
  dom3_travaux_manuels: "Travaux manuels",
  dom4_emotionnelle: "Expression émotionnelle",
  dom4_plastique: "Expression plastique",
  dom5_comm_orale: "Communication orale",
  dom5_conte: "Conte",
  dom5_poesie_chant: "Poésie chant comptine",
  dom5_act_libres: "Activités libres",
};

/** Normalise un libellé : minuscules + suppression des accents. */
export function normalizeFrText(s: string): string {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Classe un nom de matière dans son domaine officiel maternelle. */
export function matchMaternelleDomain(subjectName: string) {
  const n = normalizeFrText(subjectName);
  if (!n) return null;
  for (const def of MAT_DOMAIN_DEFS) {
    if (def.keywords.some((k) => n.includes(k))) return def;
  }
  return null;
}

/**
 * Construit la grille maternelle dynamique depuis les matières configurées.
 * Miroir de buildMaternelleGroups (backend).
 */
export function buildMaternelleGroupsFromSubjects(
  subjects: Array<{ subjectId: string; subjectName: string }>,
): MatGroup[] {
  const byDomain: Record<string, Array<MatSubColumn & { w: number }>> = {};
  const others: Array<MatSubColumn & { w: number }> = [];

  for (const s of subjects || []) {
    const def = matchMaternelleDomain(s.subjectName);
    if (!def) {
      others.push({ key: s.subjectName, label: s.subjectName, subjectId: s.subjectId, w: 90 });
      continue;
    }
    const n = normalizeFrText(s.subjectName);
    let w = 50;
    if (def.order) {
      const orderKey = Object.keys(def.order).find((k) => n.includes(k));
      w = orderKey ? def.order[orderKey] : 50;
    }
    (byDomain[def.key] = byDomain[def.key] || []).push({
      key: s.subjectName, label: s.subjectName, subjectId: s.subjectId, w,
    });
  }

  const groups: MatGroup[] = [];
  let hasDomPre = false;

  for (const def of MAT_DOMAIN_DEFS) {
    const subs = byDomain[def.key] || [];
    if (subs.length === 0) continue;
    subs.sort((a, b) => a.w - b.w || a.label.localeCompare(b.label, "fr"));
    const groupSubs: MatSubColumn[] = subs.map(({ w: _w, ...rest }) => rest);
    if (def.key === "domPre") {
      // Colonne Observations — position exacte du modèle officiel
      groupSubs.push({ key: "obs_dom", label: "Observations", subjectId: null, weight: 99 });
      hasDomPre = true;
    }
    groups.push({ key: def.key, title: def.title, hint: def.hint, subs: groupSubs });
  }

  if (others.length > 0) {
    others.sort((a, b) => a.label.localeCompare(b.label, "fr"));
    groups.push({
      key: "autres", title: "AUTRES MATIÈRES", hint: null,
      subs: others.map(({ w: _w, ...rest }) => rest),
    });
  }
  if (!hasDomPre && groups.length > 0) {
    groups.push({
      key: "obs", title: "OBSERVATIONS", hint: null,
      subs: [{ key: "obs_dom", label: "Observations", subjectId: null, weight: 99 }],
    });
  }
  return groups;
}

/**
 * Grille par défaut (modèle officiel) — utilisée en repli quand aucune
 * matière n'est configurée pour la classe, afin que la page reste utilisable
 * pendant que l'école complète « Matières & programmes ».
 */
export const MAT_DEFAULT_GROUPS: MatGroup[] = [
  {
    key: "dom1", title: "DOMAINE I", hint: null,
    subs: [
      { key: "dom1_sante", label: "Éducation pour la santé", subjectId: null },
    ],
  },
  {
    key: "dom2", title: "DOMAINE II", hint: null,
    subs: [
      { key: "dom2_corporelle", label: "Expression corporelle", subjectId: null },
    ],
  },
  {
    key: "domPre", title: "DOMAINE", hint: "N° à renseigner par l'enseignante",
    subs: [
      { key: "pre_lecture", label: "Pré-lecture", subjectId: null },
      { key: "pre_ecriture", label: "Pré-écriture", subjectId: null },
      { key: "pre_mathematiques", label: "Pré-mathématiques", subjectId: null },
      { key: "obs_dom", label: "Observations", subjectId: null },
    ],
  },
  {
    key: "dom3", title: "DOMAINE III", hint: null,
    subs: [
      { key: "dom3_sensorielle", label: "Éducation sensorielle", subjectId: null },
      { key: "dom3_travaux_manuels", label: "Travaux manuels", subjectId: null },
    ],
  },
  {
    key: "dom4", title: "DOMAINE IV", hint: null,
    subs: [
      { key: "dom4_emotionnelle", label: "Expression émotionnelle", subjectId: null },
      { key: "dom4_plastique", label: "Expression plastique", subjectId: null },
    ],
  },
  {
    key: "dom5", title: "DOMAINE V", hint: null,
    subs: [
      { key: "dom5_comm_orale", label: "Communication orale", subjectId: null },
      { key: "dom5_conte", label: "Conte", subjectId: null },
      { key: "dom5_poesie_chant", label: "Poésie chant comptine", subjectId: null },
      { key: "dom5_act_libres", label: "Activités libres", subjectId: null },
    ],
  },
];

/** Aplatit les sous-colonnes d'une liste de groupes. */
export function flattenMatGroups(groups: MatGroup[]): MatSubColumn[] {
  return (groups || []).flatMap((g) => g.subs || []);
}

/**
 * Mappe une matière (clé du cahier journal = nom de matière configurée ou
 * clé legacy) vers le type de fiche pédagogique maternelle.
 * Miroir de mapMatiereKeyToSheetType(key, isMaternelle=true) côté backend.
 */
export function mapMatiereNameToSheetType(matiere: string): string {
  const k = (matiere || "").toLowerCase().trim();
  const n = normalizeFrText(matiere);
  // Expression corporelle → fiche dédiée DOMAINE II
  if (n.includes("corporelle") || k === "dom2_corporelle") return "DOMAINE_2";
  if (k.startsWith("dom") || k === "pre_lecture" || k === "pre_ecriture" || k === "pre_mathematiques") {
    return "DOMAINE";
  }
  // Noms de matières dynamiques → fiche « Domaine »
  if (
    n.includes("pre-lecture") || n.includes("pre lecture")
    || n.includes("pre-ecriture") || n.includes("pre ecriture")
    || n.includes("pre-math") || n.includes("pre math")
    || n.includes("sante") || n.includes("hygiene")
    || n.includes("sensorielle") || n.includes("eveil") || n.includes("travaux manuels")
    || n.includes("scientifique") || n.includes("manuelle")
    || n.includes("emotionnelle") || n.includes("plastique")
    || n.includes("dessin") || n.includes("peinture") || n.includes("coloriage")
    || n.includes("orale") || n.includes("conte") || n.includes("poesie")
    || n.includes("chant") || n.includes("comptine") || n.includes("activites libres")
    || n.includes("langage")
  ) {
    return "DOMAINE";
  }
  // Matière maternelle non reconnue → fiche « Domaine » par défaut
  return "DOMAINE";
}

/**
 * Résout le domaine d'une matière et retourne les infos de pré-remplissage
 * de la fiche pédagogique (n° romain + intitulé du domaine).
 */
export function getMaternelleDomainInfo(subjectName: string): {
  domainKey: string | null;
  roman: string;
  domainLabel: string;
} {
  const def = matchMaternelleDomain(subjectName);
  if (!def) return { domainKey: null, roman: "", domainLabel: "" };
  return {
    domainKey: def.key,
    roman: def.roman,
    domainLabel: def.domainLabel || "",
  };
}

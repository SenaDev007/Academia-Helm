/**
 * ============================================================================
 * SOUS-MATIÈRES DU CAHIER JOURNAL (primaire) — catalogue canonique partagé
 * ============================================================================
 *
 * ⭐ 2026-09-18 (demande promoteur) : dans le cahier journal, chaque grande
 *    matière possède ses SOUS-MATIÈRES officielles. L'enseignant renseigne,
 *    pour chaque jour × matière, la(les) sous-matière(s) qu'il va enseigner —
 *    chaque sous-matière renseignée = UNE fiche pédagogique à préparer.
 *    On peut donc préparer PLUSIEURS fiches pour la même matière le même jour
 *    (ex : lundi français → fiche de Vocabulaire thématique + fiche de
 *    Lecture oralisée ; mardi → Expression écrite (imprégnation) puis
 *    Expression écrite (la lettre) ; mercredi → Vocabulaire fonctionnel +
 *    Grammaire).
 *
 * Listes officielles (spécification utilisateur) :
 *   FRANÇAIS              : dictée, grammaire, exercices structuraux,
 *                           conjugaison, communication orale, orthographe,
 *                           lecture, vocabulaire, expression écrite,
 *                           graphisme/écriture, combinatoire
 *   MATHÉMATIQUES         : arithmétique, calcul mental, mesure, géométrie
 *   ÉDUCATION SOCIALE     : morale, civisme, histoire, géographie
 *   EPS                   : endurance, vitesse, course, lancer, gymnastique,
 *                           saut, grimper
 *   ÉDUCATION ARTISTIQUE  : chant, poésie, dessin, conte, couture, atelier,
 *                           art dramatique
 *
 * Le champ de saisie accepte AUSSI du texte libre (variantes fines utilisées
 * dans les cahiers réels : « Vocabulaire thématique », « Lecture oralisée »,
 * « Expression écrite — imprégnation », etc.).
 * ============================================================================
 */

// ─── Normalisation (identique au backend : casse + accents + parenthèses) ───

export function normalizeSousMatiere(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Catalogue canonique par matière ────────────────────────────────────────

export const SOUS_MATIERES_CATALOGUE: {
  /** Clé interne */
  key: string;
  /** SheetType de la fiche pédagogique correspondante */
  sheetType: string;
  /** Noms de colonnes du cahier journal qui matchent cette matière */
  colonnes: string[];
  /** Sous-matières officielles */
  sousMatieres: string[];
  /** Variantes utiles proposées en complément (suggestions d'autocomplétion) */
  variantes?: string[];
}[] = [
  {
    key: "francais",
    sheetType: "FRANCAIS",
    colonnes: ["Français", "Francais"],
    sousMatieres: [
      "Dictée", "Grammaire", "Exercices structuraux", "Conjugaison",
      "Communication orale", "Orthographe", "Lecture", "Vocabulaire",
      "Expression écrite", "Graphisme/Écriture", "Combinatoire",
    ],
    variantes: [
      "Vocabulaire thématique", "Vocabulaire fonctionnel", "Vocabulaire systématique",
      "Lecture oralisée", "Lecture silencieuse", "Expression orale",
      "Dictée préparée", "Dictée-recherche", "Production écrite",
      "Expression écrite — imprégnation", "Expression écrite — production",
      "Conte", "Récitation", "Poésie",
    ],
  },
  {
    key: "mathematiques",
    sheetType: "MATH",
    colonnes: ["Mathématiques", "Mathematiques", "Maths", "Math"],
    sousMatieres: [
      "Arithmétique", "Calcul mental", "Mesure", "Géométrie",
    ],
    variantes: [
      "Numération", "Problèmes", "Arithmétique — problèmes",
      "Géométrie — construction", "Mesure — conversions",
    ],
  },
  {
    key: "education_sociale",
    sheetType: "ES",
    colonnes: ["Éducation sociale", "Education sociale"],
    sousMatieres: [
      "Morale", "Civisme", "Histoire", "Géographie",
    ],
  },
  {
    key: "eps",
    sheetType: "EPS",
    colonnes: [
      "Éducation physique et sportive", "Education physique et sportive",
      "EPS", "Éducation physique", "Sport",
    ],
    sousMatieres: [
      "Endurance", "Vitesse", "Course", "Lancer",
      "Gymnastique", "Saut", "Grimper",
    ],
    variantes: [
      "Course de vitesse", "Course d'endurance", "Saut en hauteur",
      "Saut en longueur", "Jeu collectif",
    ],
  },
  {
    key: "education_artistique",
    sheetType: "EA",
    colonnes: [
      "Éducation artistique", "Education artistique",
      "Éducation artistique plastique", "Éducation artistique vivante",
    ],
    sousMatieres: [
      "Chant", "Poésie", "Dessin", "Conte",
      "Couture", "Atelier", "Art dramatique",
    ],
    variantes: [
      "Chant — apprentissage", "Dessin — coloriage", "Dessin — modelage",
      "Compte", "Récitation",
    ],
  },
];

// ─── Résolution : colonne du cahier journal → suggestions de sous-matières ──

/**
 * Résout les suggestions de sous-matières pour une colonne du cahier journal
 * (nom du groupe ou nom de la matière). Matching insensible à la casse, aux
 * accents, aux parenthèses (« (EA) », « (EPS) ») et aux espaces.
 * Retourne [] pour les matières sans sous-matières définies (Anglais,
 * Informatique, EST…) → champ libre sans suggestions.
 */
export function resoudreSousMatieres(colonneMatiere: string): {
  sheetType: string | null;
  suggestions: string[];
} {
  const n = normalizeSousMatiere(colonneMatiere);
  if (!n) return { sheetType: null, suggestions: [] };
  for (const entry of SOUS_MATIERES_CATALOGUE) {
    const match = entry.colonnes.some(c => {
      const cn = normalizeSousMatiere(c);
      return cn === n || n.includes(cn) || cn.includes(n);
    });
    if (match) {
      return {
        sheetType: entry.sheetType,
        suggestions: [...entry.sousMatieres, ...(entry.variantes || [])],
      };
    }
  }
  return { sheetType: null, suggestions: [] };
}

/**
 * Suggestions de sous-matières pour un SHEET TYPE de fiche pédagogique
 * (FRANCAIS, MATH, ES, EA, EPS…). Utilisé par le formulaire de fiche pour
 * proposer les sous-matières officielles de la matière sélectionnée.
 */
export function suggestionsPourSheetType(sheetType: string): string[] {
  const entry = SOUS_MATIERES_CATALOGUE.find(e => e.sheetType === sheetType);
  if (!entry) return [];
  return [...entry.sousMatieres, ...(entry.variantes || [])];
}

// ─── Format persisté dans entries.__fichesAPreparer__ ───────────────────────
//
//    Historique (2026-09-18 matin) : { lundi: { "Civisme": true } }
//    Nouveau format multi-fiches  : { lundi: { "Français": [
//        { "nom": "Vocabulaire thématique" },
//        { "nom": "Lecture oralisée" }
//    ] } }
//    → chaque élément du tableau = UNE fiche pédagogique à préparer pour
//      cette (jour × matière). nom vide = fiche de la matière en général
//      (compatibilité avec l'ancien toggle booléen, maternelle…).

export type SousMatiereFiche = { nom: string };

export type FichesAPreparerState = Record<string /* jour */, Record<string /* matière */, SousMatiereFiche[]>>;

/**
 * Normalise la valeur brute lue depuis entries.__fichesAPreparer__ :
 *  - true                        → [{ nom: "" }]   (une fiche de la matière)
 *  - ["a", "b"]                  → [{ nom: "a" }, { nom: "b" }]
 *  - [{ nom: "a" }, { nom: "b" }]→ tel quel
 *  - false / null / []           → [] (pas de fiche)
 */
export function normaliserValeurFichesAPreparer(raw: unknown): SousMatiereFiche[] {
  if (!raw) return [];
  if (raw === true) return [{ nom: "" }];
  if (Array.isArray(raw)) {
    return raw
      .map((item: any) => {
        if (typeof item === "string") return item.trim() ? { nom: item } : null;
        if (item && typeof item === "object" && typeof item.nom === "string") return { nom: item.nom };
        return null;
      })
      .filter((x: any): x is SousMatiereFiche => !!x);
  }
  return [];
}

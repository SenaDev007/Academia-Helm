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
 *    (ex : lundi français → fiche de Dictée + fiche de Lecture oralisée).
 *
 * ⭐ 2026-09-18 (corrections promoteur — 2e passe) :
 *    - FRANÇAIS : suppression de vocabulaire, production écrite, expression
 *      écrite (et ses variantes), récitation, poésie et exercices structuraux
 *      (exercices structuraux figure déjà sur la fiche de préparation).
 *    - MATHÉMATIQUES : PLUS DE sous-matières — tout est déjà sur la fiche de
 *      préparation (comportement identique à l'EST : champ libre, aucune
 *      suggestion).
 *    - EPS : PLUS DE sous-matières — comme l'EST et les mathématiques.
 *    - ÉDUCATION ARTISTIQUE : suppression des variantes (chant —
 *      apprentissage, dessin — coloriage, dessin — modelage, compte,
 *      récitation) ; seules les sous-matières officielles restent.
 *
 * Listes officielles (spécification utilisateur corrigée) :
 *   FRANÇAIS              : dictée, grammaire, conjugaison, communication
 *                           orale, orthographe, lecture, graphisme/écriture,
 *                           combinatoire
 *   MATHÉMATIQUES         : (aucune — tout est sur la fiche, comme l'EST)
 *   ÉDUCATION SOCIALE     : morale, civisme, histoire, géographie
 *   EPS                   : (aucune — comme l'EST)
 *   ÉDUCATION ARTISTIQUE  : chant, poésie, dessin, conte, couture, atelier,
 *                           art dramatique
 *
 * Le champ de saisie accepte AUSSI du texte libre (variantes fines utilisées
 * dans les cahiers réels : « Lecture oralisée », « Dictée préparée », etc.).
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
    // ⭐ 2026-09-18 (corrections promoteur) : suppressions de Vocabulaire,
    //    Expression écrite et Exercices structuraux (déjà sur la fiche de
    //    préparation) + variantes associées (vocabulaire thématique/
    //    fonctionnel/systématique, production écrite, expression écrite —
    //    imprégnation/production, récitation, poésie).
    sousMatieres: [
      "Dictée", "Grammaire", "Conjugaison", "Communication orale",
      "Orthographe", "Lecture", "Graphisme/Écriture", "Combinatoire",
    ],
    variantes: [
      "Lecture oralisée", "Lecture silencieuse", "Expression orale",
      "Dictée préparée", "Dictée-recherche", "Conte",
    ],
  },
  // ⭐ 2026-09-18 (corrections promoteur) : MATHÉMATIQUES et EPS sans
  //    sous-matières — tout est déjà sur la fiche de préparation.
  //    Comportement identique à l'EST (champ libre, aucune suggestion).
  {
    key: "education_sociale",
    sheetType: "ES",
    colonnes: ["Éducation sociale", "Education sociale"],
    sousMatieres: [
      "Morale", "Civisme", "Histoire", "Géographie",
    ],
  },
  {
    key: "education_artistique",
    sheetType: "EA",
    colonnes: [
      "Éducation artistique", "Education artistique",
      "Éducation artistique plastique", "Éducation artistique vivante",
    ],
    // ⭐ 2026-09-18 (corrections promoteur) : variantes supprimées (chant —
    //    apprentissage, dessin — coloriage, dessin — modelage, compte,
    //    récitation) — seules les sous-matières officielles restent.
    sousMatieres: [
      "Chant", "Poésie", "Dessin", "Conte",
      "Couture", "Atelier", "Art dramatique",
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

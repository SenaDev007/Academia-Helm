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
 * ⭐ 2026-09-18 (corrections promoteur — 3e passe) :
 *    - FRANÇAIS : RESTAURATION des vocabulaires (Vocabulaire thématique,
 *      Vocabulaire systématique, Vocabulaire fonctionnel — supprimés à tort
 *      lors de la 2e passe) et d'EXPRESSION ÉCRITE ; SUPPRESSION de
 *      « Expression orale » (n'existe pas — c'est plutôt Expression écrite)
 *      et de « Conte » (« compte » — demandé supprimé dès la 1re passe).
 *    - MATHÉMATIQUES / EPS / ÉDUCATION SCIENTIFIQUE ET TECHNOLOGIQUE :
 *      chaque séance = UNE fiche à préparer, MÊME SI l'enseignant ne
 *      renseigne PAS le nom de la sous-matière (tout est déjà sur la fiche
 *      de préparation) → helper estMatiereFicheSansSousMatiere() : la barre
 *      de cellule propose un marquage « Fiche à préparer » EN UN CLIC,
 *      sans nom (cf. CahierJournalTab).
 *
 * Listes officielles (spécification utilisateur corrigée) :
 *   FRANÇAIS              : dictée, grammaire, conjugaison, communication
 *                           orale, orthographe, lecture, expression écrite,
 *                           graphisme/écriture, combinatoire (+ variantes
 *                           vocabulaire thématique/systématique/fonctionnel,
 *                           lecture oralisée/silencieuse, dictée
 *                           préparée/recherche)
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
    // ⭐ 2026-09-18 (3e passe promoteur) : RESTAURÉ — Vocabulaire thématique,
    //    Vocabulaire systématique, Vocabulaire fonctionnel (variantes) et
    //    Expression écrite (officielle — « c'est plutôt expression écrite »).
    //    SUPPRIMÉ — Expression orale (n'existe pas) et Conte (« compte »).
    //    Restent supprimés (2e passe) : Vocabulaire (générique),
    //    Production écrite, Récitation, Poésie, Exercices structuraux.
    // ⭐ 2026-09-19 (nouvelle passe promoteur) : AJOUTÉ — les trois stades
    //    d'Expression écrite : « Expression écrite (imprégnation) »,
    //    « Expression écrite (premier jet) » et « Expression écrite simple ».
    sousMatieres: [
      "Dictée", "Grammaire", "Conjugaison", "Communication orale",
      "Orthographe", "Lecture", "Expression écrite", "Graphisme/Écriture",
      "Combinatoire",
      "Expression écrite (imprégnation)", "Expression écrite (premier jet)",
      "Expression écrite simple",
    ],
    variantes: [
      "Lecture oralisée", "Lecture silencieuse", "Dictée préparée",
      "Dictée-recherche", "Vocabulaire thématique", "Vocabulaire systématique",
      "Vocabulaire fonctionnel",
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

// ─── ⭐ 2026-09-18 (3e passe) — Matières « fiche sans sous-matière » ────────
//     MATHÉMATIQUES, EPS et ÉDUCATION SCIENTIFIQUE ET TECHNOLOGIQUE : tout le
//     contenu de la leçon figure déjà sur la fiche de préparation → chaque
//     séance planifiée dans le cahier journal = UNE fiche à préparer, MÊME SI
//     l'enseignant ne renseigne PAS le nom de la sous-matière.
//     La barre de cellule (CahierJournalTab → SousMatieresFichesBar) propose
//     alors un marquage « Fiche à préparer » EN UN CLIC (sous-matière vide —
//     cf. compatibilité [{ nom: "" }] : fiche de la matière en général), et
//     le backend compte cette exigence comme une fiche à préparer/jour.
//     Matching insensible à la casse, aux accents et aux parenthèses — couvre
//     les noms réels en base (« Mathématiques », « Éducation Physique et
//     Sportive », « Éducation Scientifique et Technologique ») et les
//     intitulés de la piste anglophone (« Mathematics », « Physical and
//     Health Education (PHE) », « Basic Science »).
export function estMatiereFicheSansSousMatiere(colonneMatiere: string): boolean {
  const n = normalizeSousMatiere(colonneMatiere);
  if (!n) return false;
  // Mathématiques (+ variantes anciennes : calcul, numération, mesure, géométrie)
  const isMath =
    /\bmath/.test(n) || n.includes("calcul") || n.includes("numeratio") ||
    n.includes("geometrie") || n === "maths";
  // EPS (+ piste anglophone : Physical and Health Education)
  const isEps =
    /\beps\b/.test(n) || n.includes("education physique") ||
    n.includes("physical") || n.includes("sport") || n.includes("athletis") ||
    n.includes("gymnastiq");
  // Éducation scientifique et technologique (+ « Basic Science », « EST »)
  const isEst =
    n.includes("education scientifique") || n.includes("scientifique") ||
    n.includes("technologi") || n.includes("science") || /\best\b/.test(n);
  return isMath || isEps || isEst;
}

// ─── ⭐ 2026-09-18 (4e passe promoteur) — Affichage abrégé des matières ──────
//     « tu peux remplacer éducation scientifique et technologique, tu peux
//     directement mettre EST, il y a pas de problème. Et pour éducation
//     physique et sportive également, tu peut mettre EPS simplement. »
//     → TOUTES les interfaces affichent EST / EPS (en-têtes du cahier journal,
//       puces « fiche à préparer », liste des fiches, fiches pédagogiques,
//       catalogue, contrôle directeur…). Les autres matières sont affichées
//     telles quelles. AFFICHAGE UNIQUEMENT : les clés de données (entries du
//     cahier journal, __fichesAPreparer__, matieresPlanifiees) restent les noms
//     complets — aucune migration, aucune rupture de compatibilité.
export function affichageMatiere(nomMatiere: string): string {
  const n = normalizeSousMatiere(nomMatiere || "");
  if (!n) return nomMatiere || "";
  // Éducation Scientifique et Technologique → EST
  if (n === "education scientifique et technologique" || n === "est") return "EST";
  // Éducation Physique et Sportive → EPS
  if (n === "education physique et sportive" || n === "eps") return "EPS";
  return nomMatiere;
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

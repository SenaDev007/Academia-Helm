/**
 * ⭐ Catalogue de sous-matières par groupe (Maternelle & Primaire — Bénin)
 * ============================================================================
 * Dans l'emploi du temps, les matières sont des GROUPES qui contiennent des
 * sous-matières. L'école sélectionne la sous-matière précise à programmer.
 *
 * Ex: "Français" → Vocabulaire thématique, Lecture, Conjugaison, etc.
 *     "Éducation Sociale" → Morale, Civisme, Histoire, Géographie
 *
 * Ce catalogue est utilisé dans le sélecteur de matière du ManualEditor.
 * L'école peut aussi saisir une matière personnalisée si elle n'est pas
 * dans cette liste.
 *
 * ⭐ STRUCTURE BILINGUE — Matières francophones et anglophones clairement séparées :
 *    - Groupes FR : FRANCAIS, MATHEMATIQUES, EDUCATION_SOCIALE, EDUCATION_ARTISTIQUE,
 *      EDUCATION_SCIENTIFIQUE, AUTRES
 *    - Groupe EN : ANGLOPHONE (English Language, Reading, Writing, Mathematics, etc.)
 *    - Groupe LANGUES (Anglais) entre FR et EN pour la transition
 *
 *    Sans cette séparation, les matières anglophones créées à la volée
 *    tombaient toutes dans "Autres (DB)" mélangées avec les francophones
 *    non cataloguées — d'où la confusion rapportée par l'utilisateur.
 */

export interface SubSubject {
  name: string;
  group: string;
}

export const SUB_SUBJECT_CATALOG: { group: string; label: string; items: string[] }[] = [
  // ═══════════════════════════════════════════════════════════════════
  //  MATIÈRES FRANCOPHONES (FR)
  // ═══════════════════════════════════════════════════════════════════
  {
    group: 'FRANCAIS',
    label: '🇫🇷 Français (FR)',
    items: [
      'Français',
      'Vocabulaire thématique',
      'Communication orale',
      'Lecture',
      'Vocabulaire systématique',
      'Conjugaison',
      'Écriture',
      'Grammaire',
      'Diphtongue',
      'Expression écrite',
      'Dictée',
      'Orthographe',
      // ⭐ Combinaisons francophones courantes (Lecture-Écriture au CI/CP)
      'Lecture-Écriture',
      'Vocabulaire-Communication orale',
      'Conjugaison-Grammaire',
      'Dictée-Orthographe',
    ],
  },
  {
    group: 'MATHEMATIQUES',
    label: '🇫🇷 Mathématiques (FR)',
    items: [
      'Mathématiques',
      'Arithmétique',
      'Géométrie',
      'Mesure',
      'Problèmes',
      'Calcul mental',
      'Arithmétique-Géométrie',
      'Calcul mental-Problèmes',
      'Mesure-Calcul mental',
    ],
  },
  {
    group: 'EDUCATION_SOCIALE',
    label: '🇫🇷 Éducation Sociale (FR)',
    items: [
      'Éducation Sociale',
      'Morale',
      'Civisme',
      'Histoire',
      'Géographie',
      'Histoire-Géographie',
      'Morale-Civisme',
    ],
  },
  {
    group: 'EDUCATION_ARTISTIQUE',
    label: '🇫🇷 Éducation Artistique (FR)',
    items: [
      'Éducation Artistique',
      'Poésie',
      'Conte',
      'Chant',
      'Dessin',
      'Poésie-Chant',
      'Conte-Dessin',
      'Chant-Dessin',
    ],
  },
  {
    group: 'EDUCATION_SCIENTIFIQUE',
    label: '🇫🇷 Éducation Scientifique et Technologique (FR)',
    items: [
      'Éducation Scientifique et Technologique',
    ],
  },
  {
    group: 'LANGUES',
    label: 'Langues',
    items: [
      'Anglais',
    ],
  },
  {
    group: 'AUTRES',
    label: '🇫🇷 Autres matières (FR)',
    items: [
      'Informatique',
      'EPS',
      'Cérémonial des couleurs',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  //  MATIÈRES ANGLOPHONES (EN) — clairement séparées des francophones
  // ═══════════════════════════════════════════════════════════════════
  {
    group: 'ANGLOPHONE',
    label: '🇬🇧 Anglophone (EN)',
    items: [
      'English Language',
      'English',
      'Reading',
      'Writing',
      'Reading-Writing',
      'Spelling',
      'Grammar (English)',
      'Composition',
      'Literature',
      'Phonics',
      'Handwriting',
      'Mathematics (English)',
      'Number Work',
      'Numeracy',
      'Environmental Studies',
      'Social Studies',
      'Science',
      'Verbal Reasoning',
      'Quantitative Reasoning',
      'Creative Arts',
      'Physical Education (English)',
      'ICT',
      'French (English stream)',
    ],
  },
];

/// Aplatir le catalogue en une liste simple (pour recherche rapide)
export const ALL_SUB_SUBJECTS: string[] = SUB_SUBJECT_CATALOG.flatMap(g => g.items);

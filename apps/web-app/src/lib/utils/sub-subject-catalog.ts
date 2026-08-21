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
 */

export interface SubSubject {
  name: string;
  group: string;
}

export const SUB_SUBJECT_CATALOG: { group: string; label: string; items: string[] }[] = [
  {
    group: 'FRANCAIS',
    label: 'Français',
    items: [
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
    ],
  },
  {
    group: 'MATHEMATIQUES',
    label: 'Mathématiques',
    items: [
      'Numération',
      'Calcul',
      'Géométrie',
      'Mesure',
      'Problèmes',
      'Calcul mental',
    ],
  },
  {
    group: 'EDUCATION_SOCIALE',
    label: 'Éducation Sociale',
    items: [
      'Morale',
      'Civisme',
      'Histoire',
      'Géographie',
      'Histoire-Géographie',
    ],
  },
  {
    group: 'EDUCATION_ARTISTIQUE',
    label: 'Éducation Artistique',
    items: [
      'Poésie',
      'Conte',
      'Chant',
      'Dessin',
    ],
  },
  {
    group: 'EDUCATION_SCIENTIFIQUE',
    label: 'Éducation Scientifique et Technologique',
    items: [
      'EST',
      'Sciences',
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
    label: 'Autres matières',
    items: [
      'Informatique',
      'EPS',
      'Cérémonial des couleurs',
    ],
  },
];

/// Aplatir le catalogue en une liste simple (pour recherche rapide)
export const ALL_SUB_SUBJECTS: string[] = SUB_SUBJECT_CATALOG.flatMap(g => g.items);

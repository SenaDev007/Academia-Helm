/**
 * ============================================================================
 * CATALOGUE DE MATIÈRES PAR DÉFAUT (PARTAGÉ) — source unique
 * ============================================================================
 *
 * Historiquement défini localement dans SubjectsWorkspace (onglet « Matières
 * & programmes ») : liste des matières SUGGÉRÉES par niveau (Maternelle /
 * Primaire / Secondaire) dans le processus de création des matières.
 *
 * ⭐ 2026-11-23 — extraction vers une lib partagée : le module RH
 *    (UnifiedAdministrationWorkspace — onglet Administration, sous-onglet
 *    Secondaire, modals « Affecter un enseignant » / « Modifier
 *    l'affectation ») réutilise EXACTEMENT la même liste pour proposer les
 *    postes enseignants « Professeur de <matière> » — une seule source de
 *    vérité, zéro divergence entre les deux modules.
 *
 *    Usage RH : sélecteur « Poste / Matière enseignée » ← les matières
 *    suggérées du SECONDAIRE deviennent des postes (Professeur de Français,
 *    Professeur d'Anglais, Professeur de Mathématiques…).
 */

// --- Catalogue de matières par défaut (suggestions dans le modal) ---
// Structure : { name, code (abrév + numéro), abbreviation }
export const DEFAULT_SUBJECTS_CATALOGUE: Record<
  string,
  Array<{ name: string; code: string; abbreviation: string }>
> = {
  MATERNELLE: [
    // ⭐ Refonte 2026-08-21 (catalogue officiel Maternelle Bénin)
    { name: 'Éducation pour la santé et l\'environnement',       abbreviation: 'ESE',   code: 'ES-01'    },
    { name: 'Éducation à des réflexions de santé',               abbreviation: 'ERS',   code: 'ERS-02'  },
    { name: 'Éducation du mouvement',                            abbreviation: 'EM',    code: 'EM-03'   },
    { name: 'Gestuelle',                                        abbreviation: 'GEST', code: 'GEST-04' },
    { name: 'Rythmique',                                        abbreviation: 'RYTH', code: 'RYTH-05' },
    { name: 'Observation',                                      abbreviation: 'OBS',  code: 'OBS-06'  },
    { name: 'Éducation sensorielle',                            abbreviation: 'ESENS',code: 'ESENS-07'},
    { name: 'Pré-lecture',                                      abbreviation: 'PLEC', code: 'PLEC-08' },
    { name: 'Pré-écriture',                                     abbreviation: 'PECR', code: 'PECR-09' },
    { name: 'Pré-mathématique',                                 abbreviation: 'PMAT', code: 'PMAT-10' },
    { name: 'Expression plastique (dessin, peinture, coloriage, etc.)', abbreviation: 'EP',    code: 'EP-11'   },
    { name: 'Expression émotionnelle',                          abbreviation: 'EE',   code: 'EE-12'   },
    { name: 'Expression orale (langage, comptine, poésie, chant, etc.)', abbreviation: 'EO', code: 'EO-18' },
    { name: 'Expression corporelle',                            abbreviation: 'ECORP', code: 'ECORP-18' },
    { name: 'Éveil scientifique et technologique',              abbreviation: 'ESTM', code: 'ESTM-19' },
    // ⭐ Ajout 2026-09-13 (demande utilisateur) : certaines écoles enseignent
    //    l'Anglais et l'Informatique dès la Maternelle
    { name: 'Anglais',                                           abbreviation: 'ANG',  code: 'ANG-20'  },
    { name: 'Informatique',                                      abbreviation: 'INFO', code: 'INFO-21' },
  ],
  PRIMAIRE: [
    { name: 'Expression Écrite',                         abbreviation: 'EE',   code: 'EE-01'   },
    { name: 'Lecture',                                   abbreviation: 'LECT', code: 'LECT-02' },
    { name: 'Dictée',                                    abbreviation: 'DICT', code: 'DICT-03' },
    { name: 'Mathématiques',                             abbreviation: 'MATH', code: 'MATH-04' },
    { name: 'Éducation Scientifique et Technologique',   abbreviation: 'EST',  code: 'EST-05'  },
    { name: 'Éducation Sociale',                         abbreviation: 'ES',   code: 'ES-06'   },
    { name: 'Éducation Artistique (EA) Vivant',          abbreviation: 'EAV',  code: 'EAV-07'  },
    { name: 'Éducation Artistique (EA) Plastique',       abbreviation: 'EAP',  code: 'EAP-08'  },
    { name: 'Éducation Physique et Sportive',            abbreviation: 'EPS',  code: 'EPS-09'  },
    // ⭐ Ajout 2026-09-13 (demande utilisateur) : certaines écoles enseignent
    //    l'Anglais et l'Informatique au Primaire
    { name: 'Anglais',                                   abbreviation: 'ANG',  code: 'ANG-10'  },
    { name: 'Informatique',                              abbreviation: 'INFO', code: 'INFO-11' },
  ],
  SECONDAIRE: [
    { name: 'Communication Écrite',                      abbreviation: 'CE',   code: 'CE-01'   },
    { name: 'Lecture',                                   abbreviation: 'LECT', code: 'LECT-02' },
    { name: 'Anglais',                                   abbreviation: 'ANG',  code: 'ANG-03'  },
    { name: 'Français',                                  abbreviation: 'FR',   code: 'FR-04'   },
    { name: 'Espagnol',                                  abbreviation: 'ESP',  code: 'ESP-05'  },
    { name: 'Allemand',                                  abbreviation: 'ALL',  code: 'ALL-06'  },
    { name: 'Mathématiques',                             abbreviation: 'MATH', code: 'MATH-07' },
    { name: 'Physique Chimie et Technologie',            abbreviation: 'PCT',  code: 'PCT-08'  },
    { name: 'Science de la Vie et de la Terre',          abbreviation: 'SVT',  code: 'SVT-09'  },
    { name: 'Histoire-Géographie',                      abbreviation: 'HG',   code: 'HG-11'   },
    { name: 'Philosophie',                               abbreviation: 'PHILO',code: 'PHILO-12'},
    { name: 'Éducation Physique et Sportive',            abbreviation: 'EPS',  code: 'EPS-13'  },
    // ⭐ Ajout 2026-09-13 (demande utilisateur) : Informatique au Secondaire
    //    (l'Anglais existe déjà : ANG-03)
    { name: 'Informatique',                              abbreviation: 'INFO', code: 'INFO-14' },
  ],
};

// --- Catalogue de matières par défaut pour l'ANGLAIS (EN) ---
// Liste exacte fournie par l'utilisateur (pas une traduction du FR).
// Appliquée à tous les niveaux (Maternelle/Primaire/Secondaire) en mode EN.
export const DEFAULT_SUBJECTS_CATALOGUE_EN: Array<{ name: string; code: string; abbreviation: string }> = [
  { name: 'Mathematics',                              abbreviation: 'MATH', code: 'MATH-EN-01' },
  { name: 'English Language',                         abbreviation: 'ENG',  code: 'ENG-EN-02'  },
  { name: 'Basic Science',                            abbreviation: 'BS',   code: 'BS-EN-03'   },
  { name: 'Social Studies',                           abbreviation: 'SST',  code: 'SST-EN-04'  },
  { name: 'Agricultural Science',                     abbreviation: 'AGR',  code: 'AGR-EN-05'  },
  { name: 'Computer Science',                         abbreviation: 'CS',   code: 'CS-EN-06'   },
  { name: 'Civic Education',                          abbreviation: 'CIV',  code: 'CIV-EN-07'  },
  { name: 'Verbal Reasoning',                         abbreviation: 'VR',   code: 'VR-EN-08'   },
  { name: 'Quantitative Reasoning',                   abbreviation: 'QR',   code: 'QR-EN-09'   },
  { name: 'Cultural and Creative Arts (CCA)',         abbreviation: 'CCA',  code: 'CCA-EN-10'  },
  { name: 'Christian Religious Knowledge (CRK)',      abbreviation: 'CRK',  code: 'CRK-EN-11'  },
  { name: 'Handwriting',                              abbreviation: 'HW',   code: 'HW-EN-12'   },
  { name: 'Drawing',                                  abbreviation: 'DRW',  code: 'DRW-EN-13'  },
  { name: 'Physical and Health Education (PHE)',      abbreviation: 'PHE',  code: 'PHE-EN-14'  },
];

/** Résout un SchoolLevel vers la clé de catalogue (MATERNELLE | PRIMAIRE | SECONDAIRE | null) */
export function resolveLevelKey(level?: { code?: string; name?: string; label?: string }): string | null {
  if (!level) return null;
  const haystack = `${level.code ?? ''} ${level.name ?? ''} ${level.label ?? ''}`.toUpperCase();
  if (haystack.includes('MATERN')) return 'MATERNELLE';
  if (haystack.includes('PRIMA') || haystack.includes('PRIM')) return 'PRIMAIRE';
  if (haystack.includes('SECOND') || haystack.includes('SEC') || haystack.includes('LYCEE') || haystack.includes('LYCEA')) return 'SECONDAIRE';
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ⭐ 2026-11-23 — POSTES ENSEIGNANTS dérivés du catalogue (module RH)
//
// Les matières suggérées du SECONDAIRE deviennent les TITRES des enseignants :
// « Professeur de Français », « Professeur d'Anglais »… — les mêmes postes que
// ceux affectés dans le module Personnel → Onglet Administration → sous-onglet
// Secondaire, et affichés devant le nom de chaque enseignant dans Pédagogie →
// Enseignants & Affectations.
// ─────────────────────────────────────────────────────────────────────────────

/** « Professeur de <matière> » avec élision française correcte
 *  (Professeur d'Anglais, d'Espagnol, d'Histoire-Géographie, d'Éducation…). */
export function professeurDe(matiere: string): string {
  const m = (matiere || '').trim();
  if (!m) return 'Professeur';
  const first = m[0].toUpperCase();
  if (['A', 'E', 'É', 'È', 'Ê', 'I', 'O', 'U', 'H', 'Œ'].includes(first)) {
    return `Professeur d'${m}`;
  }
  return `Professeur de ${m}`;
}

/** Matières suggérées du SECONDAIRE (catalogue « Matières & programmes »). */
export const SECONDARY_SUGGESTED_SUBJECTS: Array<{ name: string; code: string; abbreviation: string }> =
  DEFAULT_SUBJECTS_CATALOGUE['SECONDAIRE'] || [];

/** Postes enseignants du SECONDAIRE : « Professeur de <matière suggérée> ». */
export const SECONDARY_TEACHING_POSTES: string[] =
  SECONDARY_SUGGESTED_SUBJECTS.map(s => professeurDe(s.name));

/** Postes enseignants Maternelle / Primaire (titulaires + spécialistes itinérants). */
export const MAT_PRIM_TEACHING_POSTES: string[] = [
  'Instituteur(trice) du Primaire',
  'Éducateur(trice) de la Maternelle',
  "Professeur d'Anglais",
  "Professeur d'Informatique",
];

/** Valeur sentinelle du sélecteur « Autre (saisie libre) ». */
export const OTHER_POSTE_VALUE = '__AUTRE__';

/** Postes enseignants proposés selon le niveau/unité scolaire :
 *  SECONDAIRE → un poste « Professeur de X » par matière suggérée du
 *  catalogue secondaire ; MATERNELLE/PRIMAIRE → titulaires + spécialistes
 *  itinérants ; unité combinée (Maternelle & Primaire) → les deux titulaires ;
 *  niveau inconnu → tout le catalogue. */
export function teachingPostesForLevel(levelName?: string | null): string[] {
  const n = (levelName || '').toUpperCase();
  const isMat = n.includes('MATERN');
  const isPrim = n.includes('PRIMA') || n.includes('PRIM');
  const isSec = n.includes('SECOND') || n.includes('SEC') || n.includes('LYC') || n.includes('LYCEE') || n.includes('LYCEA');
  if (isSec && !isMat && !isPrim) return SECONDARY_TEACHING_POSTES;
  if (isMat && isPrim) {
    return ['Éducateur(trice) de la Maternelle', 'Instituteur(trice) du Primaire', "Professeur d'Anglais", "Professeur d'Informatique"];
  }
  if (isMat) return ['Éducateur(trice) de la Maternelle', "Professeur d'Anglais", "Professeur d'Informatique"];
  if (isPrim) return ['Instituteur(trice) du Primaire', "Professeur d'Anglais", "Professeur d'Informatique"];
  return [...SECONDARY_TEACHING_POSTES, ...MAT_PRIM_TEACHING_POSTES];
}

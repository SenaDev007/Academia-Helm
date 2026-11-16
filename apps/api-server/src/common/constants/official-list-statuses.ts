/**
 * ============================================================================
 * STATUTS « LISTE OFFICIELLE DES ÉLÈVES » — source de vérité partagée
 * ============================================================================
 *
 * ⭐ FIX 2026-11-16 (1.0.15, retour promoteur CSPEB) :
 *    « lorsqu'on retire des élèves pour les cas d'abandon, on ne doit plus
 *     les avoir dans la liste officielle des élèves — pour retrouver les
 *     abandons, on a déjà l'onglet abandon »
 *    « l'onglet Educ Master pour la génération des templates : uniquement les
 *     élèves actifs et admis ; les élèves qui ont abandonné ne doivent pas
 *     figurer ».
 *
 * AVANT le fix, chaque liste/export appliquait SON propre filtre :
 *   - exports Excel (Educ Master, classes, sections) : notIn
 *     ['WITHDRAWN','TRANSFERRED'] → laissait passer EXCLUDED, COMPLETED,
 *     PENDING, PRE_REGISTERED…
 *   - PDF listes de classes : même notIn partiel ;
 *   - template Educ Master par niveau : in ['ACTIVE','ADMITTED','RE_ENROLLED',
 *     'PENDING'] → un élève PENDING (dossier en attente de validation)
 *     apparaissait dans le fichier officiel ;
 *   - onglet « Liste des Élèves » (front) : AUCUN filtre → les élèves retirés
 *     pour abandon restaient dans l'arborescence niveaux/classes.
 *
 * MAINTENANT : une SEULE liste positive partagée — les statuts « officiellement
 * scolarisés » (actifs + admis + réinscrits/promus, plus les variantes
 * historiques ENROLLED/VALIDATED). Tout le reste est EXCLU des listes
 * officielles et des exports : WITHDRAWN (abandon), TRANSFERRED, EXCLUDED,
 * COMPLETED (sortie fin d'année), PENDING, PRE_REGISTERED, ARCHIVED…
 * Les abandons restent consultables dans l'onglet dédié « Sorties & Abandons ».
 */

/** Statuts d'inscription qui font partie de la liste officielle des élèves. */
export const OFFICIAL_LIST_ENROLLMENT_STATUSES: string[] = [
  'ACTIVE',      // élève officiellement inscrit pour cette année
  'ADMITTED',    // admis (classe officielle attribuée, pas toujours de section physique)
  'RE_ENROLLED', // réinscrit
  'PROMOTED',    // promu depuis l'année précédente (équivalent actif)
  'ENROLLED',    // variante historique
  'VALIDATED',   // créé par POST /students/:id/enroll (affectation physique directe)
];

/**
 * Garde de défense au niveau ÉLÈVE (Student.status) : certains flux
 * (bulk-status, PUT /students/:id) mettent à jour UNIQUEMENT Student.status
 * sans synchroniser l'inscription — un élève « retiré » peut donc garder une
 * inscription ACTIVE. Les listes officielles et exports croisent les deux
 * niveaux pour garantir l'exclusion.
 *
 * ⚠️ INACTIVE (sortie fin d'année) et GRADUATED (terminale diplômée) ne sont
 *    volontairement PAS exclus ici : un élève sorti en fin d'année d'une
 *    année PASSÉE doit rester visible dans les listes de cette année-là, et
 *    une réinscription (RE_ENROLLED) ne remet pas Student.status à ACTIVE
 *    (cf. reEnroll) — l'exclure ferait disparaître des réinscrits légitimes.
 */
export const OFFICIAL_LIST_EXCLUDED_STUDENT_STATUSES: string[] = [
  'WITHDRAWN',
  'TRANSFERRED',
  'EXCLUDED',
  'ARCHIVED',
];

/** Filtre Prisma (where StudentEnrollment) pour les listes officielles. */
export const officialEnrollmentStatusFilter = (): {
  status: { in: string[] };
  student: { status: { notIn: string[] } };
} => ({
  status: { in: [...OFFICIAL_LIST_ENROLLMENT_STATUSES] },
  // Garde anti-dé-synchronisation Student.status ↔ StudentEnrollment.status
  student: { status: { notIn: [...OFFICIAL_LIST_EXCLUDED_STUDENT_STATUSES] } },
});

/**
 * Filtre Prisma (where StudentEnrollment) SANS la garde élève — pour les
 * contextes où le statut Student est déjà géré ou l'objet student absent.
 */
export const officialEnrollmentStatusOnly = (): {
  status: { in: string[] };
} => ({
  status: { in: [...OFFICIAL_LIST_ENROLLMENT_STATUSES] },
});

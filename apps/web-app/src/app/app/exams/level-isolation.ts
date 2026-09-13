/**
 * ============================================================================
 * ISOLATION DES DONNÉES PAR NIVEAU — Module Examen (V10b)
 * ============================================================================
 *
 * ⭐ EXIGENCE UTILISATEUR : « Quand on rentre dans le niveau maternel, toutes
 *   les tables, tous les tableaux et tous les onglets doivent être propres au
 *   niveau maternel. Pareil pour primaire francophone, nursery anglophone et
 *   primary anglophone — sinon on risque de mélanger les données. »
 *
 * CONTEXTE TECHNIQUE :
 *   Les sections anglophones (Nursery/Primary) partagent le schoolLevelId de
 *   leur miroir francophone (Maternelle/Primaire) — voir
 *   bilingual-structure.service.ts → autoCreateEnSectionForFrSection.
 *
 *   L'isolation entre « Maternelle FR » et « Nursery EN » repose donc sur le
 *   marqueur linguistique de chaque classe :
 *     - Class.language = 'EN'  → section EN (visible en vue Nursery/Primary)
 *     - Class.language = 'FR'  → section FR (visible en vue Maternelle/Primaire)
 *     - AUCUN marqueur        → classe héritée de la structure FR historique
 *                               (visible UNIQUEMENT en vue FR)
 *
 *   Les sections EN créées par le service bilingue portent TOUJOURS
 *   language='EN' + academicTrackId(EN) : la règle « non marqué = FR » est
 *   donc sûre et ne peut jamais masquer une classe EN.
 *
 * ⚠️ INTERDIT (ancien comportement, sources de mélange de données) :
 *   - « si aucune classe ne matche le filtre → afficher TOUTES les classes
 *     du niveau » → mélangeait FR et EN ;
 *   - « classe sans marqueur → visible partout » → mélangeait les classes
 *     héritées FR dans les vues EN.
 *
 * Cette règle est le miroir EXACT du filtre backend
 * (evaluations.service.ts / councils.service.ts / …) : le même paramètre
 * `language` est envoyé au serveur ET appliqué côté client.
 * ============================================================================
 */

/**
 * Règle d'isolation linguistique stricte pour une entité (classe, matière…).
 *
 * @param item    entité avec `.language` et/ou `.academicTrack.code`
 *                (ou `.academicTrackCode`)
 * @param language piste du niveau sélectionné ('FR' | 'EN'), déduite du niveau
 *                 via languageForLevel() — jamais choisie par l'utilisateur
 * @returns true si l'entité appartient à la piste du niveau sélectionné
 */
export function matchesLevelLanguage(
  item: any,
  language: string | null | undefined,
): boolean {
  if (!language) return true;
  const itemLang = item?.language;
  const trackCode = item?.academicTrack?.code || item?.academicTrackCode;
  if (itemLang) return itemLang === language;
  if (trackCode) return trackCode === language;
  // Non marqué = structure FR historique → uniquement en vue FR.
  return language === 'FR';
}

/**
 * Filtre une liste de classes (sections) pour le niveau ET la piste
 * linguistique sélectionnés dans le module examen.
 *
 * Utilisé par TOUTES les pages du module (dashboard, évaluations, saisie,
 * validation, registre, bulletins…) pour garantir que
 * les tableaux de sélection de classes ne contiennent QUE les classes du
 * niveau/piste courant.
 *
 * @param allClasses       réponse brute de /api/all-classes (tout le tenant)
 * @param schoolLevelUuid  UUID school_levels du niveau sélectionné
 * @param language         'FR' | 'EN' (piste déduite du niveau)
 */
export function filterClassesForLevel(
  allClasses: any[],
  schoolLevelUuid: string | null | undefined,
  language: string | null | undefined,
): any[] {
  if (!schoolLevelUuid) return [];
  const levelClasses = (allClasses || []).filter(
    (c: any) =>
      c.schoolLevelId === schoolLevelUuid ||
      c.schoolLevel?.id === schoolLevelUuid,
  );
  if (!language) return levelClasses;
  return levelClasses.filter((c: any) => matchesLevelLanguage(c, language));
}

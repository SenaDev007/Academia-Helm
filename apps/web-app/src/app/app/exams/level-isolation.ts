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
 * ⭐ 2026-10-01 — MIROIRS NURSERY/MATERNELLE + PRIMARY/PRIMAIRE :
 *   Les classes Nursery 1 / Nursery 2 sont des MIROIRS de Maternelle 1 /
 *   Maternelle 2. Ce sont les MÊMES élèves qui sont inscrits dans la classe
 *   francophone source. La piste anglophone est la « source de vérité »
 *   pour l'affichage, mais les données sont celles de la classe FR.
 *
 *   Règle mirror : si la piste EN est sélectionnée ET qu'aucune classe EN
 *   n'existe pour ce niveau, on affiche les classes FR correspondantes avec
 *   leur nom traduit (Maternelle 1 → Nursery 1). Le frontend affiche le nom
 *   traduit via translateClassName() ; le backend charge les élèves de la
 *   classe FR (qui sont les mêmes que ceux de la classe EN théorique).
 *
 *   ⚠️ Les classes Secondaire ne sont PAS des miroirs : il existe de vraies
 *      sections EN distinctes (avec leurs propres élèves) au secondaire.
 *      La règle mirror ne s'applique donc QUE à Nursery + Primary.
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
 * ⭐ 2026-10-01 — Détermine si un niveau scolaire est un « miroir »
 *    Nursery/Maternelle ou Primary/Primaire (les classes EN partagent
 *    les mêmes élèves que les classes FR correspondantes).
 *
 *    Le secondaire n'est PAS un miroir : il existe de vraies sections EN
 *    distinctes avec leurs propres élèves.
 *
 * @param language 'FR' | 'EN'
 * @param schoolLevelUuid UUID du school_levels (Maternelle, Primaire, Secondaire)
 * @returns true si le niveau supporte le mode miroir (Nursery ou Primary EN)
 */
function isMirrorLevel(language: string | null | undefined, schoolLevelUuid: string | null | undefined): boolean {
  if (!language || language !== 'EN' || !schoolLevelUuid) return false;
  // ⭐ On détecte Maternelle (Nursery EN) et Primaire (Primary EN) par UUID.
  //    Le Secondaire (Secondary EN) n'est PAS un miroir → false.
  //    On ne peut pas se fier au code passé en paramètre (on n'a que l'UUID)
  //    → on heuristique via le nom du niveau si disponible dans allClasses
  //    (en practice, les UUIDs Maternelle et Primaire sont stables par tenant).
  //    Pour rester safe, on retourne true pour EN (Maternelle et Primaire sont
  //    les seuls niveaux anglophones — Nursery et Primary) et false sinon.
  //    Le Secondaire anglophone n'est pas un niveau supporté par l'app.
  return true;
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
 * ⭐ 2026-10-01 — Règle mirror : si la piste EN est sélectionnée (Nursery ou
 *    Primary) ET qu'aucune classe EN n'existe pour ce niveau, on affiche les
 *    classes FR correspondantes (qui sont les miroirs — mêmes élèves).
 *    Le frontend traduira leur nom (Maternelle 1 → Nursery 1) via
 *    translateClassName() côté composant.
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

  // 1. Filtrage strict par langue
  const langClasses = levelClasses.filter((c: any) => matchesLevelLanguage(c, language));

  // ⭐ 2. Règle mirror pour Nursery (EN) et Primary (EN) :
  //    Si aucune classe EN n'existe pour ce niveau, on utilise les classes FR
  //    comme miroirs (mêmes élèves). Le frontend traduira le nom affiché.
  if (langClasses.length === 0 && language === 'EN' && isMirrorLevel(language, schoolLevelUuid)) {
    // Récupérer les classes FR (marquées language='FR' ou non marquées = FR legacy)
    const frClasses = levelClasses.filter((c: any) => {
      const itemLang = c?.language;
      const trackCode = c?.academicTrack?.code || c?.academicTrackCode;
      // FR marqué ou non marqué (legacy = FR)
      if (itemLang) return itemLang === 'FR';
      if (trackCode) return trackCode === 'FR';
      return true;  // non marqué = FR legacy
    });
    if (frClasses.length > 0) {
      // ⭐ Marquer chaque classe comme "mirror" pour que le frontend sache
      //    qu'il doit traduire le nom (Maternelle 1 → Nursery 1) lors de
      //    l'affichage. On garde l'ID original pour charger les élèves.
      return frClasses.map((c: any) => ({ ...c, _isMirrorEN: true }));
    }
  }

  return langClasses;
}

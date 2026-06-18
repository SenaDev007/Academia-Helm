/**
 * ============================================================================
 * TESTS E2E — Non-régression du mode "année scolaire stricte"
 * ============================================================================
 *
 * Ce fichier documente les scénarios de test E2E à exécuter pour valider
 * que le mode "année scolaire stricte" fonctionne correctement.
 *
 * Framework recommandé : Playwright ou Cypress
 *
 * Prérequis :
 * - L'application tourne en local (web-app + api-server)
 * - Au moins 2 années scolaires créées pour le tenant de test
 * - Un utilisateur avec rôle PROMOTER ou SCHOOL_OWNER
 *
 * ============================================================================
 */

/**
 * Scénario 1 : Bascule d'année scolaire dans le sélecteur
 *
 * Étapes :
 * 1. Se connecter en tant que promoteur
 * 2. Vérifier que le sélecteur d'année est visible dans le header
 * 3. Noter l'année courante (ex : "2024-2025")
 * 4. Naviguer vers le dashboard → noter les KPIs affichés
 * 5. Naviguer vers Students → noter le nombre d'élèves
 * 6. Naviguer vers Finance → noter le total des paiements
 * 7. Ouvrir le sélecteur d'année et choisir "2025-2026"
 * 8. Vérifier que :
 *    - L'URL ne change pas (pas de rechargement de page)
 *    - Les KPIs du dashboard sont rechargés
 *    - Le nombre d'élèves a changé (ou est 0 si l'année est vide)
 *    - Le total des paiements a changé
 *    - Le header `x-academic-year-id` contient le nouvel ID (vérifier via Network tab)
 *
 * Critères d'acceptation :
 * - ✅ Toutes les données changent après la bascule
 * - ✅ Aucune donnée de l'année précédente n'est affichée
 * - ✅ Le localStorage est mis à jour (clé 'academicYear' et 'currentAcademicYearId')
 */

/**
 * Scénario 2 : Requête API sans header X-Academic-Year-ID
 *
 * Étapes :
 * 1. Se connecter
 * 2. Ouvrir la console développeur → Network tab
 * 3. Naviguer dans l'app et observer les requêtes API
 * 4. Vérifier que TOUTES les requêtes vers /students, /finance, /hr, etc.
 *    contiennent le header `x-academic-year-id`
 * 5. Simuler une requête sans header (via curl ou Postman) :
 *    curl -X GET http://localhost:3001/api/students \
 *      -H "Authorization: Bearer <token>" \
 *      -H "x-tenant-id: <tenant-id>"
 *      # SANS x-academic-year-id
 *
 * Critères d'acceptation :
 * - ✅ La requête sans header retourne 400 BadRequest
 * - ✅ Le message d'erreur contient "ACADEMIC YEAR ENFORCEMENT RULE VIOLATION"
 * - ✅ La console backend logge "ACADEMIC_YEAR_VIOLATION_ATTEMPT"
 */

/**
 * Scénario 3 : Création d'une donnée sans academicYearId
 *
 * Étapes :
 * 1. Se connecter
 * 2. Naviguer vers Students → "Nouvel élève"
 * 3. Remplir le formulaire et soumettre
 * 4. Vérifier que l'élève créé a bien `academicYearId` = année courante
 *
 * Via API directe :
 * curl -X POST http://localhost:3001/api/students \
 *   -H "Authorization: Bearer <token>" \
 *   -H "x-tenant-id: <tenant-id>" \
 *   -H "x-academic-year-id: <year-id>" \
 *   -H "Content-Type: application/json" \
 *   -d '{"firstName":"Test","lastName":"User"}'
 *
 * Critères d'acceptation :
 * - ✅ L'élève est créé avec academicYearId = <year-id>
 * - ✅ Si on tente de créer sans header, la requête est rejetée (400)
 */

/**
 * Scénario 4 : Routes exemptées
 *
 * Étapes :
 * 1. Se connecter
 * 2. Vérifier que les routes suivantes fonctionnent SANS header academic-year-id :
 *    - GET /settings/general
 *    - GET /settings/features
 *    - GET /users/me
 *    - GET /roles
 *    - GET /academic-years
 *    - GET /countries
 *    - GET /health
 *
 * Critères d'acceptation :
 * - ✅ Toutes ces routes retournent 200 (pas de 400)
 * - ✅ Aucun warning ACADEMIC_YEAR_VIOLATION dans la console backend
 */

/**
 * Scénario 5 : Mélange d'années interdit
 *
 * Étapes :
 * 1. Se connecter avec l'année A sélectionnée
 * 2. Tenter une requête avec body.academicYearId = année B (différente) :
 *    curl -X POST http://localhost:3001/api/students \
 *      -H "Authorization: Bearer <token>" \
 *      -H "x-tenant-id: <tenant-id>" \
 *      -H "x-academic-year-id: <year-A>" \
 *      -H "Content-Type: application/json" \
 *      -d '{"firstName":"Test","lastName":"User","academicYearId":"<year-B>"}'
 *
 * Critères d'acceptation :
 * - ✅ La requête est rejetée (403 Forbidden)
 * - ✅ Le message d'erreur contient "Cannot mix academic years"
 * - ✅ La console backend logge "ACADEMIC_YEAR_MIXING_ATTEMPT"
 */

/**
 * Scénario 6 : Invalidation TanStack Query
 *
 * Étapes :
 * 1. Se connecter
 * 2. Naviguer vers le dashboard
 * 3. Ouvrir React DevTools → QueryClient
 * 4. Noter les queries actives (ex : ['dashboard', 'kpis', tenantId])
 * 5. Changer d'année scolaire dans le sélecteur
 * 6. Vérifier que :
 *    - Les queries sont marquées comme 'stale'
 *    - De nouvelles requêtes réseau sont déclenchées
 *    - Les données affichées correspondent à la nouvelle année
 *
 * Critères d'acceptation :
 * - ✅ Les queries sont invalidées après le changement d'année
 * - ✅ Les queries 'academic-years' ne sont PAS invalidées (sinon boucle)
 */

/**
 * Scénario 7 : CustomEvent 'academic-year-changed'
 *
 * Étapes :
 * 1. Se connecter
 * 2. Ouvrir la console développeur
 * 3. Exécuter :
 *    window.addEventListener('academic-year-changed', (e) => console.log('Year changed:', e.detail))
 * 4. Changer d'année dans le sélecteur
 * 5. Vérifier que l'event est dispatché avec le bon detail
 *
 * Critères d'acceptation :
 * - ✅ L'event est dispatché avec { previousYearId, newYearId }
 * - ✅ L'event est dispatché une seule fois par changement
 */

/**
 * Scénario 8 : Warning UI si pas d'année
 *
 * Étapes :
 * 1. Se connecter sur un tenant sans année scolaire (nouveau tenant de test)
 * 2. Vérifier que le sélecteur affiche "Aucune année scolaire" en rouge
 * 3. Vérifier que les modules affichent un message d'erreur ou des données vides
 *
 * Critères d'acceptation :
 * - ✅ Le sélecteur affiche le warning rouge
 * - ✅ L'utilisateur ne peut pas naviguer dans les modules sans année
 */

export const E2E_SCENARIOS = [
  'Scenario 1: Bascule d\'année scolaire',
  'Scenario 2: Requête API sans header',
  'Scenario 3: Création sans academicYearId',
  'Scenario 4: Routes exemptées',
  'Scenario 5: Mélange d\'années interdit',
  'Scenario 6: Invalidation TanStack Query',
  'Scenario 7: CustomEvent academic-year-changed',
  'Scenario 8: Warning UI si pas d\'année',
];

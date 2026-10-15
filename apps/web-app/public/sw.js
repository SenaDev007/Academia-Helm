/**
 * ============================================================================
 * SERVICE WORKER UNIFIÉ — Academia Helm (v4.1 « offline exhaustif + visible »)
 * ============================================================================
 *
 * ⭐ CARTE DU CACHE RÉSEAU (source unique de vérité, coordination chantiers
 *    performance ↔ offline) : docs/PERF-GTMETRIX-CHARGEMENT.md — toute
 *    modification des stratégies ci-dessous DOIT y être reportée et testée
 *    en ligne ET hors ligne.
 *
 * ⭐ SW UNIQUE à la racine du domaine (scope: '/'). NE PAS enregistrer
 *    d'autres service workers au même scope — les anciens sw-offline.js,
 *    sw-site.js et sw-chat.js sont OBSOLÈTES et sont désinstallés par
 *    UniversalSWRegister à la première visite.
 *
 * v4.1.0 : (exigence « sous-onglets + modales + sélecteurs couverts ; savoir
 *    quand on peut couper sa connexion pour économiser son forfait ») :
 *    (1) PROGRESSION DU PRÉ-CACHE API par batch (message
 *        PRECACHE_API_PROGRESS toutes les 6 URLs) → module-precache.service
 *        le relaie au store offline-readiness → OfflineReadinessIndicator :
 *        pill « Préparation hors ligne · NN % » + toast vert UNE FOIS
 *        « Données hors ligne prêtes — vous pouvez couper votre connexion ».
 *    (2) L'inventaire des vagues (côté client, module-precache.service) est
 *        étendu : §0 RÉFÉRENTIELS CRITIQUES DES MODALES en tête (sélecteurs
 *        classes/niveaux/périodes/caisses/personnel/comptes élèves —
 *        l'utilisateur qui coupe après ~1 min peut déjà créer), +
 *        absences, cahiers de textes, séries d'éducation, taux CNSS/fiscal,
 *        modèles de contrats, sceaux/signatures, cartes élèves, et les 4
 *        modules complémentaires manquants (bibliothèque, transport,
 *        infirmerie, QHSE) + vague 2 : comptes élèves par élève (modale
 *        paiement), chaînes CDD (RH), validateurs/EDT/séries par niveau.
 *    (3) Bump v4.0.0 → v4.1.0 : SW_ACTIVATED invalide les flags de pré-cache
 *        → tous les utilisateurs existants re-téléchargent l'inventaire
 *        ÉTENDU dès le déploiement (pas d'attente du TTL 24 h).
 * v4.0.0 : (spec « Correction d'architecture — interception réseau ») :
 *    interception CENTRALISÉE des lectures (réseau-first + write-through
 *    IndexedDB + cascade offline exacte → par chemin → stores entités) et
 *    des écritures (réseau d'abord, échec → outbox + écriture optimiste +
 *    Background Sync + réponse fabriquée 200 X-Sync-Status: pending ; les
 *    passerelles de paiement ne sont JAMAIS interceptées ni fabriquées).
 *
 * v3.7.0 : (correctif « Lecture hors ligne non fonctionnelle par module » —
 *    spec dataService/couche unifiée, sept. 2026) :
 *    (1) FALLBACK OFFLINE PAR CHEMIN (handleApiGet) : hors ligne (ou réseau
 *        KO), si la clé EXACTE (URL + params + identité) manque, on sert la
 *        meilleure entrée du MÊME chemin + MÊME identité (params les plus
 *        proches de la demande). Cause racine : le pré-cache stocke des
 *        variantes de params précises (schoolLevelId, academicYearId…) alors
 *        que les pages demandent d'autres combinaisons → clé ≠ → 503 →
 *        « le module s'affiche mais sans ses données ».
 *    (2) L'app complète cette couche côté page : response_cache IndexedDB
 *        (clé par URL, tous formats) + timeout 5 s — cf. data-service.ts.
 * v3.8.0 : (incident utilisateur « Connexion indisponible pour /app » après
 *    le déploiement v3.7.0 — CRITIQUE avant démo terrain) :
 *    (1) CACHE PAGES PERSISTANT : ah-pages n'est PLUS versionné ni purgé —
 *        comme ah-static-immutable / ah-rsc / ah-api. AVANT : chaque bump de
 *        version vidait ah-pages-<version> → l'utilisateur qui passait hors
 *        ligne AVANT la fin du re-pré-cache (~2-3 min en ligne) perdait TOUT,
 *        y compris le shell /app (page « Connexion indisponible »).
 *        La fraîcheur est assurée par NetworkFirst EN LIGNE (chaque visite
 *        rafraîchit l'HTML) ; le HTML ancien reste VALIDE hors ligne car ses
 *        chunks /_next/static/ immuables ne sont jamais purgés.
 *    (2) MIGRATION à l'activation : les entrées ah-pages-v3.7.0 (et tout
 *        ah-pages-*) sont transférées vers ah-pages avant purge — le
 *        pré-cache existant des utilisateurs n'est PAS perdu.
 *    (3) LRU 500 entrées (trim après pré-cache) — croissance bornée.
 *
 * v3.6.0 : (exigence « TOUS les modules offline » — couverture exhaustive) :
 *    (1) PRÉ-CACHE ÉTENDU : le client envoie désormais ~230 endpoints (tous
 *        les onglets/sous-onglets des 15 modules : pilotage, pédagogie,
 *        censeur, élèves, vie scolaire, directeur, finances, examens/notes,
 *        RH, Helm Connect, cantine, EduCast, Shop, CMS, paramètres) + une
 *        2e VAGUE DYNAMIQUE par entité (notes par évaluation, EDT par
 *        horaire, enfants du parent, niveaux scolaires).
 *    (2) ACK PRÉ-CACHE « skip-aware » : les réponses 401/403/404/405/400
 *        (endpoint non applicable à ce rôle/paramètres) sont comptées
 *        `skipCount` — elles ne pénalisent NI le taux de réussite NI le flag
 *        24 h (avant, un rôle sans accès finance faisait échouer tout le
 *        pré-cache → retries permanents).
 *    (3) BATCH 6 (au lieu de 4) + API_CACHE_MAX 1200 : volume x6 du cache
 *    offline (toutes les données des modules, plus seulement les KPI).
 *
 * v3.5.0 : (retour terrain « KPI faux hors ligne » + « page connexion
 *    indisponible pour /app/pedagogy/academic-structure ») :
 *    (1) INTERCEPTION CROSS-ORIGIN des GET axios vers l'API (api.<domaine>)
 *        — NetworkFirst + cache ah-api + fallback offline. Avant, les appels
 *        axios (apiClient, baseURL https://api.academiahelm.com/api) étaient
 *        cross-origin → JAMAIS interceptés → hors ligne la moitié des KPI
 *        des dashboards tombaient à zéro/null (« fausses données »).
 *    (2) IDENTITÉ NORMALISÉE (tenant|user) pour les clés du cache API : la
 *        même URL est désormais cachée sous la MÊME clé quel que soit le
 *        style d'appel (fetch cookie-only, fetch+JWT, axios JWT+xtid) —
 *        fini la fragmentation de clés qui faisait rater le cache.
 *    (3) PRÉ-CACHE DES DONNÉES API (message PRECACHE_API) : le client envoie
 *        la liste des endpoints KPI de TOUS les dashboards + ses headers
 *        d'authentification ; le SW fetch chaque endpoint et l'écrit dans
 *        ah-api → hors ligne, les KPI sont EXACTS sans avoir visité le
 *        module en ligne auparavant (exigence offline-first).
 *    (4) PLUS AUCUNE page « connexion indisponible » pour /app/* : le
 *        fallback de TOUTE navigation /app/* non cachée est désormais le
 *        SHELL /app pré-caché (+ script inline de rechargement au retour du
 *        réseau / après réveil serveur, avec garde anti-boucle). L'offline
 *        minimal (dernier recours absolu si même le shell manque) ne
 *        concerne PLUS que les pages publiques.
 *    (5) SET_API_ORIGIN : la page communique au SW l'origine réelle de
 *        l'API (getApiBaseUrl()) — remplace la dérivation par défaut.
 *    (6) Clé de cache API : le paramètre cache-buster `_t` (hrFetch) est
 *        retiré → les requêtes successives partagent la même entrée.
 *
 * v3.4.0 : (1) CORRECTIF « connexion indisponible pour /app/pedagogy » —
 *    cascade exact → ignoreSearch pour les navigations ?tenant=… ;
 *    (2) pré-cache fiabilisé (ACK par route, flag 24 h si ≥ 90 %) ;
 *    (3) pré-cache RSC par route ; (4) Vary retiré des copies cachées ;
 *    (5) réponse sobre auto-rechargeable.
 * v3.3.1 : SW_ACTIVATED notifie les pages (invalidation du flag 24 h) ;
 *    réponse au message GET_SW_VERSION.
 *    (⚠️ v3.5.0 : l'ancienne note « shell /app uniquement pour la racine »
 *    est OBSOLÈTE — le shell est désormais servi pour TOUTE route /app/*
 *    non cachée, JAMAIS de page d'erreur pour l'app.)
 *
 * Responsabilités (fusion v3, sept. 2026) :
 *   1. WEB PUSH + notificationclick + pushsubscriptionchange
 *   2. APP-SHELL OFFLINE pour /app/* (pattern PWA) :
 *        - offline → cache exact de la route, sinon shell /app pré-caché
 *        - online  → réseau (8 s timeout) → cache write → fallback shell
 *      ⭐ AUCUNE page « Mode hors ligne » plein écran N'EST JAMAIS servie :
 *        l'utilisateur garde ses données (IndexedDB) et peut continuer à
 *        travailler — un simple toast ≤ 10 s l'informe du passage hors ligne.
 *   3. BACKGROUND SYNC (tag 'sync-outbox') : quand l'onglet est fermé et que
 *      le réseau revient, le SW pousse lui-même l'outbox IndexedDB vers
 *      /api/sync/push (JWT miroité dans Cache API par client-access-token.ts).
 *   4. PRÉ-CACHE DE MODULES (message PRECACHE_MODULE) : HTML + chunks JS/CSS
 *      des routes /app/* visitées, pour naviguer hors ligne.
 *   5. FETCH handler avec cache prudent :
 *        - Assets statiques immuables (_next/static, images, fonts)
 *          → CacheFirst (1 an)
 *        - Navigations HTML PUBLIQUES (site institutionnel, login, landing)
 *          → NetworkFirst (4 s timeout) + fallback cache + shell /app
 *        - ⭐ v3.3.0 — API GET /api/* (hors auth/sync) → NetworkFirst (8 s)
 *          + cache CACHÉ IDENTITAIRE (clé scopée par tenant/session via
 *          cookies d'identité + Authorization → aucune fuite cross-tenant)
 *          + fallback offline → 503 rapide si absent du cache.
 *          Concerne TOUTES les UI (dashboards, sidebar feature codes,
 *          enseignant, parent, secrétaire, site public…) — le SW étant SOUS
 *          tous les fetch de la page, aucune race d'installation possible.
 *        - Tout le reste (mutations, /platform/*, cross-origin)
 *          → PAS D'INTERCEPTION (réseau direct)
 *
 * ⛔ JAMAIS de cache pour :
 *   - /api/auth/*, /api/sync/*, /api/*-auth/* (sessions/tokens — toujours réseau)
 *   - les mutations POST/PUT/PATCH/DELETE (jamais interceptées — GET uniquement)
 *   - /app/*, /platform/*, /patronat, /federis, /saisiemaster
 *     (pages authentifiées — servies via l'app-shell, pas mises en cache HTML)
 *   - les scripts SW eux-mêmes (/sw*.js)
 * ⛔ JAMAIS de page « hors ligne » de substitution (supprimée volontairement :
 *    expérience WhatsApp — l'app reste utilisable, un toast suffit).
 * ============================================================================
 */

// ⭐ v3.5.0 — Origine de l'API (interception cross-origin des GET axios,
//    baseURL https://api.<domaine>/api). Déterminée :
//    (a) par message SET_API_ORIGIN de la page (OfflineSWRegister envoie
//        l'origine réelle issue de getApiBaseUrl()) ;
//    (b) à défaut, par dérivation depuis self.location (api.<domaine racine>).
let apiOriginOverride = null;

function deriveApiOrigin() {
  try {
    const host = self.location.hostname;
    if (!host || host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost')) {
      return null;
    }
    const labels = host.split('.');
    if (labels.length <= 2) return self.location.protocol + '//api.' + host;
    return self.location.protocol + '//api.' + labels.slice(1).join('.');
  } catch {
    return null;
  }
}

/** Origine API connue (override explicite prioritaire sur la dérivation). */
function getApiOrigin() {
  return apiOriginOverride || deriveApiOrigin();
}

// v4.17.0 : (audit modules restants 15/10/2026) ROUTE_TABLES — 5 routes
//    manquantes ajoutées (communication, federis, public/admission,
//    public/pre-enrollment) pour couvrir les 5 modules restants (Vie
//    Scolaire, Helm Connect, Patronat, Site institutionnel, Admissions).
//    QHSE module SUPPRIMÉ définitivement (routes + composants frontend) —
//    4 routes QHSE retirées de ROUTE_TABLES et store-names.ts.

// v4.16.0 : (audit shells/rôles 14/10/2026) ROUTE_TABLES — 12 routes
//    manquantes ajoutées pour couvrir les UI spécifiques par rôle
//    (Discipline/Surveillant, Censeur, Parent, Admissions). Avant :
//    tombaient dans le fallback 'api_cache' générique → pas d'écriture
//    optimiste offline (création d'une règle de conduite, sanction,
//    paramètre de conduite, entrée du registre, visite de classe,
//    examen de fraude, conseil de classe, etc. n'apparaissaient pas dans
//    la liste jusqu'à la reconnexion). Désormais : chaque route résout
//    vers le store IDB métier correct.
//    v21RoleStores : 4 nouveaux stores IDB créés dans local-db.service.ts
//    (conductrule, sanction, conductsetting, conductledger).
//    Shells couverts : teacher, parent, secretaire, secretaire-comptable,
//    comptable, surveillant, censeur, directeur, exam-reception,
//    discipline, infirmary, qhse, admissions — tous bénéficient du SW
//    universel via UniversalSWRegister + PWARegister dans le root layout.

// v4.15.0 : (audit Paramètres + vérification des shells 14/10/2026) ROUTE_TABLES —
//    11 routes Paramètres manquantes ajoutées pour couvrir TOUS les
//    controllers du module Paramètres (settings.controller.ts avec ~150
//    endpoints). Avant : tombaient dans le fallback 'api_cache' générique
//    → pas d'écriture optimiste offline (création d'un cachet adminis-
//    tratif, tampon, signature, signature électronique, paramètre Orion/
//    Atlas, paramètre offline-sync, structure pédagogique, calendrier
//    école, etc. n'apparaissaient pas dans la liste jusqu'à la
//    reconnexion). Désormais : chaque route résout vers le store IDB
//    métier correct (tous les stores Paramètres existaient déjà dans
//    local-db.service.ts). BATCH_KEYWORDS étendu avec 7 nouveaux mots-clés
//    Paramètres (features/enable-all, features/disable-all, bilingual/
//    migrate, bilingual/seed-en-structure, academic-years/generate-next,
//    school-calendar-config/reset, check-expiring, check-migration).
//    Shells : vérification complète de l'application — le SW universel
//    /sw.js est enregistré dans le root layout (app/layout.tsx) via
//    UniversalSWRegister + PWARegister, couvrant TOUS les shells :
//    (auth), (public), (patronat), app/*, school-portal, mobile,
//    saisiemaster, promoteur, desktop. AUCUN SW alternatif n'existe
//    (un seul fichier /sw.js). Le GlobalFetchInterceptor n'est installé
//    que dans app/layout-client.tsx mais c'est un NO-OP en web (le SW
//    prend le relais) — uniquement actif en Tauri (desktop).

// v4.14.0 : (audit RH/Personnel + Academia Shop 14/10/2026) ROUTE_TABLES —
//    11 routes RH + 22 routes Shop manquantes ajoutées pour couvrir TOUS
//    les controllers des 2 modules. Avant : tombaient dans le fallback
//    'api_cache' générique → pas d'écriture optimiste offline (création
//    d'un job, candidature, entretien, test, stagiaire, déclaration
//    CNSS, déclaration fiscale, nœud d'organigramme, planning, produit
//    shop, supplier, retour, livraison, kit, etc. n'apparaissaient pas
//    dans la liste jusqu'à la reconnexion). Désormais : chaque route
//    résout vers le store IDB métier correct. BATCH_KEYWORDS étendu
//    avec 5 nouveaux mots-clés (upload-apply, cards/generate-all,
//    cards/distribute, wallet/recharge, cleanup/orphaned-files) pour
//    empêcher les enregistrements fantômes sur les endpoints batch.
//    v20HrStores : 1 nouveau store IDB créé dans local-db.service.ts
//    (hrinternship) — les autres stores RH et Shop existaient déjà.

// v4.13.0 : (audit Examens 14/10/2026) ROUTE_TABLES — 18 routes Examens
//    manquantes ajoutées pour couvrir TOUS les controllers du module
//    Examens. Avant : tombaient dans le fallback 'api_cache' générique
//    → pas d'écriture optimiste offline (création d'une évaluation, d'un
//    verrou de notes, d'une décision de promotion, d'un incident de
//    fraude, d'un bloc de préparation, d'un PV, d'une distinction, d'un
//    bulletin, etc. n'apparaissaient pas dans la liste jusqu'à la
//    reconnexion). Désormais : chaque route résout vers le store IDB
//    métier correct. BATCH_KEYWORDS étendu avec 5 nouveaux mots-clés
//    Examens (apply, auto-annotations, batch/approve, batch/reject,
//    set-default, send-to-secretariat) pour empêcher les enregistrements
//    fantômes sur les endpoints batch.
//    v19ExamStores : 4 nouveaux stores IDB créés dans local-db.service.ts
//    (examfraud, exampreparation, examlock, exampromotion) — les autres
//    stores existaient déjà.

// v4.12.0 : (audit Finance + Pédagogie 14/10/2026) ROUTE_TABLES — 25 routes
//    Finance + 13 routes Pédagogie manquantes ajoutées pour couvrir TOUS
//    les controllers des 2 modules. Avant : tombaient dans le fallback
//    'api_cache' générique → pas d'écriture optimiste offline (création
//    d'un encaissement, dépense, frais, caisse, promesse, plan annuel,
//    plan mensuel, retour de matériel, notification enseignant, tâche
//    pédagogique, etc. n'apparaissaient pas dans la liste jusqu'à la
//    reconnexion). Désormais : chaque route résout vers le store IDB
//    métier correct. BATCH_KEYWORDS étendu avec 18 nouveaux mots-clés
//    (12 Finance + 6 Pédagogie) pour empêcher les enregistrements
//    fantômes sur les endpoints batch.
//    v18PedagogyStores : 5 nouveaux stores IDB créés dans local-db.service.ts
//    (annualplan, monthlyplan, materialreturn, pedagogicaltask,
//    pedagogicalnotification) — les autres stores existaient déjà.

// v4.8.1 : (fix photo élève 23/09/2026) ROUTE_TABLES — /api/students/:id/photo
//    et /api/students/:id/upload-photo exclus du store 'student' (fallback
//    api_cache générique). Avant : un DELETE /students/:id/photo hors ligne
//    était traité comme une suppression D'ÉLÈVE (écriture optimiste
//    _deleted:true sur l'entité student → l'élève disparaissait des listes
//    offline) et un POST upload-photo écrivait la base64 entière (jusqu'à
//    5 Mo) dans le store student. Désormais : aucune écriture optimiste
//    pour ces deux routes (la file outbox reste la source de vérité, le
//    replay synchronise le serveur).
// v4.8.0 : (retour terrain 23/09/2026 — « dès qu'on quitte le module courant
//    en mode hors ligne → page "Connexion instable" ; impossible de naviguer
//    entre modules ou de se déconnecter offline ») — TROU DE DÉPLOIEMENT :
//    un déploiement Vercel change les hashes des chunks /_next/static/, mais
//    si sw.js N'EST PAS modifié (correctifs applicatifs seuls), le SW ne se
//    met pas à jour → SW_ACTIVATED ne part PAS → le flag 24 h du pré-cache
//    reste « frais » → les chunks du NOUVEAU build ne sont JAMAIS re-pré-cachés.
//    L'utilisateur recharge (nouveau build), perd le réseau, navigue vers un
//    module non visité en ligne depuis le déploiement → ChunkLoadError →
//    error boundary « Connexion instable ». Le module COURANT continue de
//    fonctionner (chunks déjà en mémoire) — exactement le symptôme terrain.
//    (1) ÉPOCH DE BUILD : à chaque HTML frais du shell /app servi en ligne,
//        le SW hache l'ensemble des URLs de chunks référencées (déterministe
//        par build). Si l'epoch CHANGE sans que sw.js ait changé →
//        BUILD_EPOCH_CHANGED diffusé aux clients → le client invalide son
//        flag 24 h et relance immédiatement le pré-cache complet des 121
//        routes (HTML + chunks + crawl + RSC) — le trou se referme en
//        quelques minutes au lieu d'attendre le TTL 24 h.
//    (2) Le client compare AUSSI l'epoch au montage (GET_BUILD_EPOCH) : un
//        message manqué (onglet fermé au moment du déploiement) est rattrapé.
//    (3) Routes PUBLIQUES (/login, /portal, /) pré-cachées en mode ANONYME
//        (credentials omit) : connecté, le middleware les redirige → jamais
//        cachées en mode authentifié → la DÉCONNEXION hors ligne retombait
//        sur un HTML sans chunks récents.
//    (4) Bump v4.8.0 → SW_ACTIVATED → tous les device existants re-pré-cachent
//        immédiatement les chunks du build courant (bouche le trou actuel).
// v4.7.0 : (retour terrain mobile 22/09/2026 — « la fiche sauvegardée sur
//    smartphone n'apparaît pas, puis revient après plusieurs rechargements »)
//    La FILE DE MUTATIONS du SW n'était rejouée que par Background Sync
//    (absent d'iOS Safari / Firefox, retardé sur Android) ou par l'événement
//    window 'online' — JAMAIS au chargement de page. Or sur mobile le réseau
//    glitch souvent SANS transition offline→online (« fantôme online » :
//    navigator.onLine true mais fetch TypeError) → la sauvegarde partait en
//    file avec un 200 fabriqué, n'était jamais rejouée → l'enseignant voyait
//    « rien n'est enregistré » (le serveur n'a pas encore la fiche) puis la
//    retrouvait « plus tard » quand la file finissait par se vider.
//    (1) La page (OfflineSWRegister) envoie TRIGGER_SYNC au CHARGEMENT et
//        8 s après chaque OUTBOX_CHANGED tant que le navigateur croit être
//        en ligne → la file se vide d'elle-même en quelques secondes.
//    (2) ROUTE_TABLES : /api/pedagogy-space/* → 'pedagogicalworkspace'
//        (miroir exact de store-names.ts applicatif) → écriture optimiste
//        + fusion dans les listes servies → la fiche en attente devient
//        VISIBLE localement au lieu de « disparaître ».
//    (3) DÉDUP « dernière version gagne » : un PUT/PATCH/DELETE PENDING du
//        SW pour la MÊME URL est MIS À JOUR (corps remplacé par la version
//        la plus récente) au lieu d'empiler — l'autosave 10 s ne remplit
//        plus la file de dizaines d'événements pendant une coupure mobile.
//    (4) REMAP d'identité POST→PUT : après le replay d'un POST créé en
//        ligne avec un id local, les PUT suivants visant /fiches/<id-local>
//        sont réécrits vers l'id serveur réel — avant : 404 → FAILED
//        définitif → les modifications postérieures à la création étaient
//        perdues.
//    (5) TRIGGER_SYNC hors ligne réel : skip (pas de tempête de fetch
//        voués à l'échec à chaque chargement de page hors ligne).
// v4.4.2 : une variante SANS année dans sa clé est implicitement scopée à
//    l année ACTIVE (header serveur) → exclue quand une AUTRE année est
//    demandée, dans swFilteredApiFallback, matchApiByPath ET la cascade IDB.
// v4.4.1 : garde année étendue à la cascade IndexedDB (swIdbFallbackForGet
//    n'entend plus servir les entités de l'année ACTIVE quand une AUTRE
//    année est demandée — 503 honnête au lieu d'une fausse donnée).
// v4.4.0 : FILTRES HORS LIGNE — les sélecteurs (niveau, classe, statut,
//    onglets filtrés, recherche, pagination) fonctionnent sans réseau :
//    (1) la clé de cache intègre le scope header (x-school-level-id →
//    __ah_lvl, x-academic-year-id → __ah_year) : changer de niveau ne
//    ressert PLUS la donnée du niveau précédent ;
//    (2) sur miss hors ligne, swFilteredApiFallback sert la VARIANTE ÉLARGIE
//    du même endpoint (pré-cache sans filtre / 'ALL') puis FILTRE côté SW
//    selon les params demandés (classId, schoolLevelId — double saveur
//    d'UUID réconciliée par index d'alias —, status, taskType, category,
//    codes level/classLevel/subject, search, plages de dates, pagination).
//    Bump → SW_ACTIVATED → re-pré-cache (variantes élargies rafraîchies).
const SW_VERSION = 'v4.18.0';
const STATIC_CACHE = `ah-static-${SW_VERSION}`;
// ⭐ v3.8.0 — PERSISTANT (jamais purgé) : cf. en-tête. La fraîcheur vient du
//    NetworkFirst en ligne ; hors ligne, l'HTML (même ancien) reste valide
//    car ses chunks immuables survivent aussi. Versionné = rupture offline
//    à CHAQUE déploiement (retour terrain « Connexion indisponible pour /app »).
const PAGE_CACHE = 'ah-pages';
const AUTH_CACHE = 'ah-auth-token'; // ⭐ miroir JWT pour le background sync — JAMAIS purgé

// ⭐ v3.1.0 — CACHE IMMUABLE PERSISTANT (JAMAIS purgé, même à l'activation
//    d'une nouvelle version du SW) : les chunks /_next/static/ sont immuables
//    par définition (hash dans le nom). Avant, ils vivaient dans
//    ah-static-<version> → CHAQUE mise à jour du SW purgeait TOUS les chunks
//    → re-téléchargement complet sur réseau instable → « Failed to load chunk »
//    massif. Désormais les chunks survivent aux mises à jour du SW (les vieux
//    builds restent en cache : un onglet resté ouvert sur l'ancien build
//    continue de fonctionner). Contrepartie : taille croissante — purgée
//    uniquement via CLEAR_CACHE (dépannage explicite).
const IMMUTABLE_CACHE = 'ah-static-immutable';

// ⭐ v3.2.0 — CACHE DES PAYLOADS RSC (flight du routeur Next 16).
//    PROBLÈME (sept. 2026) : la navigation client (changement de module/
//    onglet) fetch le payload RSC de la route cible (headers `rsc: 1`,
//    `next-router-prefetch`, param `?_rsc=`). Ces requêtes n'étaient PAS
//    interceptées → réseau direct → hors ligne : échec → SPINNER INFINI
//    (« la page tourne ») jusqu'au retour du réseau.
//    Désormais : en ligne → réponse mise en cache ; hors ligne/réseau KO →
//    cache servi ; pas de cache → 503 IMMÉDIAT (le routeur déclenche
//    l'error boundary → UI hors ligne, JAMAIS de spinner infini).
//    Clés normalisées SANS le param _rsc (le hash varie par build → les
//    prefetch d'un build restent réutilisables). LRU : max 250 entrées.
const RSC_CACHE = 'ah-rsc';
// ⭐ v3.4.0 — 250 (121 routes de modules pré-cachées + navigations normales :
//    avec 150, le LRU évictait les entrées de modules au profit des visites).
const RSC_CACHE_MAX = 250;
// ⭐ v4.6.0 (retour promoteur « rechargements brutaux hors ligne ») :
//    4 s → 8 s. Sur connexion école lente (2G/3G), un payload RSC léger
//    peut légitimement dépasser 4 s (cold start Neon, file de téléchargements
//    hors-ligne) → 503 fallacieux → error boundary alors que la réponse
//    allait arriver. 8 s = moitié du budget API (12 s), le routeur affiche
//    son état de chargement natif pendant l'attente (pas de spinner infini
//    — le cache sert toujours en fallback si présent).
const RSC_TIMEOUT = 8000;

// ⭐ v3.3.0 — CACHE DES RÉPONSES API GET (lecture hors ligne).
//    PROBLÈME (sept. 2026, retour terrain) : hors ligne, après un changement
//    de module (navigation complète servie par le SW), la sidebar tombait à
//    4 modules (feature codes /api/settings/features non servis) et AUCUNE
//    donnée ne s'affichait (agrégats /api/general/* vides). Causes :
//    - le SW n'interceptait AUCUNE requête /api/* (NEVER_INTERCEPT) ;
//    - le fallback IndexedDB de la page échoue silencieusement pour les
//      réponses sans champ `id` (stores keyPath:'id') — listes de features,
//      objets d'agrégats… jamais cachées.
//    Désormais : NetworkFirst (8 s) → cache 200 JSON ; hors ligne / réseau KO
//    → dernière réponse en cache ; absent → 503 IMMÉDIAT (jamais de spinner).
//    CLÉ IDENTITAIRE : la clé de cache intègre un hash des identifiants de la
//    requête (Authorization, cookies d'identité, x-tenant-id) → un utilisateur
//    d'une AUTRE école/session ne peut jamais être servi avec le cache du
//    précédent (isolation tenant stricte, même offline).
//    Requêtes avec cookies mais SANS identité reconnue → réseau direct (pas
//    de cache — anti-fuite). Requêtes anonymes (site public) → clé URL simple.
const API_CACHE = 'ah-api';
// ⭐ v3.6.0 — 1200 : pré-cache ~230 endpoints statiques + vague dynamique
//    (évaluations/notes, EDT, enfants…) + navigations réelles. Avant (400),
//    le LRU évictait les entrées pré-cachées au profit des visites → pertes
//    de données hors ligne sur les modules rarement visités.
// ⭐ v4.4.0 : 1200 → 1600 — les clés enrichies __ah_lvl/__ah_year créent des
//    variantes par niveau en plus des variantes élargies du pré-cache.
const API_CACHE_MAX = 1600;
// ⭐ v4.0.1 — 12 s (avant : 8 s). Le timeout same-origin coupait les appels
//    BFF AVANT leur fin réelle : /api/school-levels (structure + bootstrap +
//    3 sources + source D) et /api/academic-years peuvent légitimement
//    dépasser 8 s sur cold start Neon / redémarrage Railway. Le SW jetait
//    alors une réponse réseau EN COURS (le BFF continuait de courir côté
//    serveur) et servait le cache/503 → les sélecteurs du header passaient
//    en « Chargement... »/rouge par intermittence. 12 s = aligné sur le
//    timeout client (authFetch 12 s) et sous le budget BFF (15 s), même
//    logique que CROSS_API_TIMEOUT ci-dessous.
const API_TIMEOUT = 12000;
// ⭐ v3.5.0 — Timeout des GET CROSS-ORIGIN (axios) : 25 s, ALIGNÉ sur le
//    budget d'axios (30 s) et les cold starts Neon (10-13 s documentés).
//    Le 8 s du same-origin est trop court ici : couper un appel axios à 8 s
//    alors que le serveur répond à 12 s provoquerait des « erreurs réseau »
//    de régression en ligne (l'ancien comportement sans interception laissait
//    axios attendre jusqu'à 30 s).
const CROSS_API_TIMEOUT = 25000;

// ⭐ V4.0 — INTERCEPTION DES ÉCRITURES (spec « Correction d'architecture —
//    Interception réseau (Service Worker) », §4) : timeout RÉSEAU des
//    mutations. Volontairement GÉNÉREUX (15 s > cold start Neon 10-13 s) :
//    une mutation ne doit être mise en file QUE sur échec réseau AVÉRÉ —
//    couper trop tôt une mutation que le serveur EST EN TRAIN DE TRAITER
//    provoquerait un DOUBLON au replay (v3.9 coupait à 5 s : source de
//    comportements online cassés). Hors ligne déclaré (navigator.onLine
//    false) → file IMMÉDIATE sans attendre.
const SW_MUTATION_TIMEOUT = 15000;

// ⭐ Shell pré-caché au premier install : l'app PWA démarre hors ligne sans
//    page de substitution. '/login' couvre la start_url, '/app' l'application.
// ⭐ v3.2.0 : + pages publiques principales → le site public fonctionne hors
//    ligne dès le premier visite (sinon seules les pages DÉJÀ visitées en
//    ligne l'étaient — « rien ne fonctionne en mode hors ligne »).
const PRECACHE_URLS = [
  '/app',
  '/login',
  '/manifest.json',
  '/', // site institutionnel (racine du sous-domaine école)
  '/portal',
  '/school-portal', // ⭐ 2026-10-14 — pré-cache du parent /school-portal pour fallback hors ligne
  '/tarification',
  '/modules',
  '/contact',
  '/actualites',
  // ⭐ v4.18.0 — HELM ENSEIGNANT : shell + pages marketing du portail
  //    enseignant (le dashboard n'est caché à l'install QUE si la réponse
  //    est 200 non-redirigée — session enseignant active, cf. anti-empoisonnement).
  '/prof',
  '/prof/login',
  '/prof/register',
  '/prof/dashboard',
];

// Assets statiques mutables (images, uploads — versionnés, purge à chaque version)
const STATIC_ASSET_PATTERNS = [
  /\/_next\/image\//,
  /\/images\//,
  /\/fonts\//,
  /\/icons\//,
  /\/logos\//,
  /\/sounds\//,
  /\/uploads\//,
  /\/pwa-icon\?/,
  /\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|eot|mp3|mp4|wav)$/i,
];

// ⭐ Chunks immuables Next.js (Turbopack : /_next/static/immutable/chunks/...)
//    → cache PERSISTANT (IMMUTABLE_CACHE) — cf. commentaire ci-dessus.
const IMMUTABLE_ASSET_PATTERNS = [
  /\/_next\/static\//,
];

// Pages HTML dont le cache hors-ligne est AUTORISÉ (publiques + /promoteur
// ⭐ v4.2.0 — vue stratégique session-required : les réponses redirigées ne
// sont jamais cachées → pas d'empoisonnement par la page /login)
// ⭐ v4.18.0 — HELM ENSEIGNANT : landing / login / register / callback de
// paiement du portail enseignant (les routes CONNECTÉES /prof/* passent par
// l'app-shell dédié — cf. isProfConnectedNavigation, AVANT cette liste).
const CACHEABLE_HTML_PATTERNS = [
  /^\/$/, // site institutionnel (racine du sous-domaine)
  /^\/promoteur(\/|$)/, // ⭐ v4.2.0 — vue stratégique promoteur (session requise : la page redirige les non-stratégiques → la copie n'est PAS cachée)
  /^\/school-portal(\/|$)/, // site institutionnel école
  /^\/login(\/|$)/, // connexion (start_url de l'app PWA)
  /^\/portal(\/|$)/, // sélection de portails
  /^\/jobs(\/|$)/, // recrutement
  /^\/actualites(\/|$)/,
  /^\/public\/pre-enrollment(\/|$)/, // pré-inscription
  /^\/federis(\/|$)/,
  /^\/prof(\/|$)/, // ⭐ v4.18.0 — portail enseignant (marketing + callback paiement)
  /^\/en(\/|$)/,
  /^\/contact(\/|$)/,
  /^\/tarification(\/|$)/,
  /^\/modules(\/|$)/,
  /^\/blog(\/|$)/,
  /^\/downloads(\/|$)/,
  /^\/tenant-not-found(\/|$)/,
];

// ⛔ Requêtes à ne JAMAIS intercepter
const NEVER_INTERCEPT = [
  // ⭐ v3.3.0 — API : uniquement auth/sync/webhooks restent hors cache (tokens,
  //    sessions, files d'attente). Les AUTRES /api/* GET passent désormais par
  //    handleApiGet (NetworkFirst + cache identitaire + fallback offline).
  /^\/api\/(auth|admin-auth|school-auth|portal\/auth|sync|webhooks?|billing\/webhook|health|monitoring)(\/|$)/,
  // ⭐ v4.18.0 — HELM ENSEIGNANT : passerelles de paiement du portail
  //    enseignant (initiation checkout, vérification post-paiement, webhook
  //    FedaPay) — JAMAIS interceptées ni mises en file (honnêteté sur
  //    l'argent, spec §6, mêmes règles que fedapay/feexpay ci-dessous).
  /^\/api\/teacher-portal\/(checkout|public)(\/|$)/,
  // ⭐ V4.0 — PASSERELLES DE PAIEMENT EXTERNES (Fedapay/FeexPay) : JAMAIS
  //    interceptées, ni en lecture ni en écriture. L'argent passe par des
  //    transactions externes qui ne peuvent être « rejouées » localement —
  //    spec §6 : aucune confirmation automatique sur l'argent. Hors ligne,
  //    ces appels échouent honnêtement (l'UI affiche l'erreur réseau).
  /^\/api\/(finance\/payments\/(fedapay|feexpay)|billing\/(feexpay|fedapay))(\/|$)/,
  // ⭐ V4.0 — Génération de documents / exports / téléchargements binaires :
  //    réponses non-JSON (PDF, XLSX, ZIP…) — ni cachables ni « fabricables ».
  //    ⭐ 2026-10-14 — FIX : `download-bundle`, `export-educmaster`, etc. ne
  //    sont pas matchés par l'ancien regex qui exige `/`, `$`, ou `?` après le
  //    token. Désormais on accepte aussi `-` (hyphen) comme séparateur.
  /\/(export[-/]|receipt\.pdf|download[-/]|\/pdf[\/?]?)/,
  // ⭐ 2026-10-14 — Export EducMaster (POST déguisé en lecture — retourne JSON
  //    d'export, pas une vraie mutation. Ne doit JAMAIS être mis en file
  //    d'attente car la réponse n'est pas une entité student).
  /\/students\/[^/]+\/export-educmaster$/,
  /^\/platform\//, // back-office admin
  /^\/patronat(\/|$)/,
  /^\/saisiemaster(\/|$)/,
  /^\/admin(\/|$)/, // routes admin
  /^\/sign\//, // signature de contrats (tokens)
  /^\/receipt\//, // reçus (tokens)
  /^\/sw[\w.-]*\.js$/, // scripts service worker
  /^\/manifest.*\.webmanifest$/, // manifests dynamiques (toujours frais)
];

// ⭐ v4.5.0 (Task 73 — boucle de rechargement signalée en production) :
//    8 s → 30 s pour les navigations /app/*. Sur connexion école lente ou
//    saturée (téléchargements hors-ligne en arrière-plan), le HTML mettait
//    > 8 s → le SW servait le SHELL /app en cache (page d'accueil = tableau
//    de bord) POUR UNE AUTRE ROUTE (« je clique sur un module, ça affiche
//    toujours le tableau de bord ») + script de rechargement auto 20 s →
//    chaque reload tuait les téléchargements en cours → ils redémarraient →
//    saturation → timeout → shell → reload : BOUCLE SANS FIN.
//    30 s = au-dessus du pire cas Neon cold start (10-13 s) + marge lente ;
//    en ligne on attend le VRAI HTML de la BONNE route plutôt que de
//    servir une page périmée. Le shell ne reste qu'en vrai hors-ligne
//    (navigator.onLine === false) ou échec réseau franc.
const HTML_TIMEOUT = 30000;

// ─── INSTALL : pré-cache du shell hors ligne ──────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) =>
        // ⭐ v4.6.0 — ANTI-EMPOISONNEMENT du shell /app :
        //    `cache.add()` suit les redirections (302) : installé depuis la
        //    page /login AVANT toute session, la requête /app était
        //    redirigée par le middleware vers /login → le HTML de CONNEXION
        //    était caché sous la clé /app → toute navigation hors ligne vers
        //    un module non pré-caché servait la page de LOGIN (éjection de
        //    l'utilisateur hors de l'app !). Désormais : fetch manuel,
        //    on ne cache UNE réponse que si elle est 200 ET non-redirigée
        //    (res.redirected === false) — la requête de la page courante
        //    doit vraiment rendre CE qu'on demande.
        Promise.allSettled(
          PRECACHE_URLS.map(async (url) => {
            try {
              const res = await fetch(new Request(url, { cache: 'reload' }));
              if (res.ok && !res.redirected) {
                await cache.put(new Request(url), res);
              }
            } catch {
              /* hors ligne à l'install — l'entrée sera créée à la 1re visite */
            }
          }),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

// ─── ACTIVATE : nettoyage des anciens caches + claim ──────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // ⭐ v4.6.0 — SELF-HEAL ANTI-EMPOISONNEMENT : les entrées /app écrites
      //    par l'ANCIEN install (cache.add qui suivait la 302 → /login)
      //    portent l'URL FINALE du login dans response.url. On les supprime :
      //    elles n'ont jamais dû exister (le vrai shell /app sera re-caché à
      //    la prochaine navigation authentifiée — clé propre sans query, cf.
      //    handleAppShellNavigation). Les copies écrites par toCacheableCopy
      //    ont response.url === '' (Response reconstruit) → non touchées.
      try {
        const pages = await caches.open(PAGE_CACHE);
        const shellRes = await pages.match('/app');
        if (shellRes && shellRes.url && !shellRes.url.endsWith('/app')) {
          await pages.delete('/app');
          console.warn('[SW] Entrée /app empoisonnée supprimée (final url:', shellRes.url + ')');
        }
        // ⭐ v4.18.0 — même self-heal pour le shell enseignant /prof/dashboard.
        const profShellRes = await pages.match('/prof/dashboard');
        if (profShellRes && profShellRes.url && !profShellRes.url.endsWith('/prof/dashboard')) {
          await pages.delete('/prof/dashboard');
          console.warn(
            '[SW] Entrée /prof/dashboard empoisonnée supprimée (final url:',
            profShellRes.url + ')',
          );
        }
      } catch { /* non-bloquant */ }

      // ⭐ v3.8.0 — MIGRATION ah-pages-* : les entrées des caches versionnés
      //    (ah-pages-v3.7.0 et antérieurs) sont TRANSFÉRÉS vers le cache
      //    persistant ah-pages — le pré-cache offline des utilisateurs
      //    EXISTANTS n'est pas perdu au déploiement (incident « Connexion
      //    indisponible pour /app » : purge + re-pré-cache non terminé).
      try {
        const allNames = await caches.keys();
        const legacyPageCaches = allNames.filter(
          (n) => /^ah-pages-/.test(n) && n !== PAGE_CACHE,
        );
        if (legacyPageCaches.length > 0) {
          const persistent = await caches.open(PAGE_CACHE);
          for (const legacyName of legacyPageCaches) {
            const legacy = await caches.open(legacyName);
            const keys = await legacy.keys();
            await Promise.all(
              keys.map(async (req) => {
                const res = await legacy.match(req);
                if (res && !(await persistent.match(req))) await persistent.put(req, res);
              }),
            );
          }
        }
      } catch {
        // Migration non-bloquante
      }

      // ⭐ v3.1.0 — MIGRATION : avant de purger les anciens ah-static-*, on
      //    transfère les chunks /_next/static/ (immuables) vers IMMUTABLE_CACHE
      //    pour ne PAS perdre le cache offline des utilisateurs existants.
      try {
        const allNames = await caches.keys();
        const legacyNames = allNames.filter(
          (n) => n.startsWith('ah-static-') && n !== IMMUTABLE_CACHE,
        );
        const immutable = await caches.open(IMMUTABLE_CACHE);
        for (const legacyName of legacyNames) {
          const legacy = await caches.open(legacyName);
          const keys = await legacy.keys();
          await Promise.all(
            keys.map(async (req) => {
              if (req.url.includes('/_next/static/')) {
                const res = await legacy.match(req);
                if (res) await immutable.put(req, res);
              }
            }),
          );
        }
      } catch {
        // Migration non-bloquante
      }

      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('ah-') && !name.startsWith(AUTH_CACHE) &&
            name !== IMMUTABLE_CACHE && // ⭐ chunks immuables JAMAIS purgés
            name !== PAGE_CACHE && // ⭐ v3.8.0 — pages HTML JAMAIS purgées (persistant + LRU + NetworkFirst en ligne)
            name !== RSC_CACHE && // ⭐ payloads RSC — survivent aux mises à jour (LRU)
            name !== API_CACHE && // ⭐ v3.3.0 — réponses API GET — survivent (LRU, NetworkFirst en ligne)
            !name.endsWith(SW_VERSION))
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();

      // ⭐ v3.3.1 — Notifier les pages ouvertes : la version du SW vient de
      //    changer → le flag 24 h du pré-cache des modules (localStorage, côté
      //    client) est invalidé → la prochaine session en ligne RAFRAÎCHIT les
      //    entrées du cache persistant ah-pages (v3.8.0 : le cache n'est plus
      //    purgé, mais le rafraîchissement post-déploiement reste utile pour
      //    servir le NOUVEAU HTML en ligne et re-remplir RSC/API).
      try {
        const clientList = await self.clients.matchAll({ type: 'window' });
        for (const client of clientList) {
          client.postMessage({ type: 'SW_ACTIVATED', version: SW_VERSION });
        }
      } catch {
        /* non-bloquant */
      }
    })(),
  );
});

// ─── FETCH : stratégies de cache prudentes ────────────────────────────────
// ⭐ v4.9.0 (2026-09-30 — « chargements > 30 s » signalés en production) :
//    COMPTEUR DE REQUÊTES PAGE EN COURS. Le pré-cache (PRECACHE_MODULE /
//    PRECACHE_API) est la seule charge réseau de fond de l'app — il tirait
//    ses ~230 endpoints + 112 routes HTML pendant que les requêtes VISIBLES
//    de la page (rattachements patronat, demandes de surveillants, KPIs…)
//    attendaient : même thread SW + même pool de connexions + sémaphore
//    utilisateur backend (20 slots) → famine de 30-60 s des données de la
//    page, aggravée sur connexion école lente. Désormais chaque boucle de
//    pré-cache ATTEND que ce compteur retombe à 0 avant chaque lot — le
//    pré-cache ne progresse que pendant les creux d'activité réels.
let pageRequestsInFlight = 0;

/** Attend que plus aucune requête de page interceptée ne soit en cours.
 * Retourne dès que le compteur est à 0 (ou après maxWaitMs pour ne jamais
 * bloquer indéfiniment un pré-cache si une requête page pendait). */
function waitForIdlePageTraffic(maxWaitMs = 20000) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const tick = () => {
      if (pageRequestsInFlight <= 0 || Date.now() - startedAt >= maxWaitMs) {
        resolve();
        return;
      }
      setTimeout(tick, 250);
    };
    tick();
  });
}

/** Enveloppe respondWith qui comptabilise la requête page en cours —
 *    le pré-cache consulte ce compteur pour lui céder la priorité. */
function trackedRespondWith(event, responsePromise) {
  pageRequestsInFlight++;
  event.respondWith(
    Promise.resolve(responsePromise).finally(() => {
      pageRequestsInFlight = Math.max(0, pageRequestsInFlight - 1);
    }),
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // ⭐ V4.0 — ÉCRITURES (POST/PUT/PATCH/DELETE) : interception réseau-puis-file
  //    (spec §4) — AVANT le retour anticipé « GET uniquement » d'avant v4.
  //    Les mutations vers /api/* (app same-origin OU API cross-origin) passent
  //    par handleApiMutation : réseau d'abord, réponse réelle passée telle
  //    quelle ; échec réseau → file de mutations IndexedDB + Background Sync
  //    + réponse FABRIQUÉE (200 + X-Sync-Status: pending) pour que le flux du
  //    composant continue (redirection, confirmation) SANS modification de son
  //    code. Les passerelles de paiement et documents binaires sont déjà
  //    exclus par NEVER_INTERCEPT (honnêteté sur l'argent — spec §6).
  if (request.method !== 'GET') {
    if (request.method !== 'POST' && request.method !== 'PUT' && request.method !== 'PATCH' && request.method !== 'DELETE') {
      return; // HEAD/OPTIONS… → réseau direct
    }
    let mutationUrl;
    try {
      mutationUrl = new URL(request.url);
    } catch {
      return;
    }
    const mutationIsSameOrigin = mutationUrl.origin === self.location.origin;
    const mutationIsApiOrigin = mutationUrl.origin === getApiOrigin();
    if (!mutationIsSameOrigin && !mutationIsApiOrigin) return;
    if (!mutationUrl.pathname.startsWith('/api/')) return;
    if (NEVER_INTERCEPT.some((pattern) => pattern.test(mutationUrl.pathname))) return;
    trackedRespondWith(event, handleApiMutation(request));
    return;
  }

  // Uniquement GET, même origine
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // ⭐ v3.5.0 — Deux origines sont interceptées : l'app (same-origin) ET
  //    l'API (cross-origin axios apiClient, baseURL https://api.<domaine>/api).
  //    Tout AUTRE cross-origin (analytics, images tierces…) → réseau direct.
  const isSameOrigin = url.origin === self.location.origin;
  const isApiOrigin = url.origin === getApiOrigin();
  if (!isSameOrigin && !isApiOrigin) return;

  const pathname = url.pathname;

  // Routes interdites → réseau direct (les chemins axios cross-origin sont
  // tous préfixés /api/ → les mêmes patterns s'appliquent : auth/sync jamais cachés)
  if (NEVER_INTERCEPT.some((pattern) => pattern.test(pathname))) return;

  // ⭐ v3.5.0 — API GET CROSS-ORIGIN (axios) : NetworkFirst + cache + fallback
  //    offline. AVANT : les GET axios vers api.<domaine> n'étaient JAMAIS
  //    interceptés → hors ligne, la moitié des KPI des dashboards (ceux
  //    servis par apiClient) tombaient à zéro/null (« fausses données »).
  //    Timeout élargi (25 s) : cf. CROSS_API_TIMEOUT — pas de régression
  //    sur les cold starts Neon.
  if (isApiOrigin && !isSameOrigin) {
    trackedRespondWith(event, handleApiGet(request, CROSS_API_TIMEOUT));
    return;
  }

  // ⭐ v3.2.0 — Requêtes RSC/flight du routeur Next 16 (navigation client) :
  //    `rsc: 1` (navigation), `next-router-prefetch: 1` (préchargement liens),
  //    `next-router-segment-prefetch` (segments), `?_rsc=` (clé de cache).
  //    AVANT : aucune interception → hors ligne, échec réseau direct →
  //    SPINNER INFINI au changement de module. MAINTENANT : cache + 503 rapide.
  if (isRscRequest(request, url)) {
    trackedRespondWith(event, handleRsc(request));
    return;
  }

  // ⭐ v3.3.0 — API GET /api/* : NetworkFirst + cache identitaire + fallback
  //    offline (les chemins auth/sync/webhooks ont déjà été exclus par
  //    NEVER_INTERCEPT ci-dessus ; les non-GET sont sortis en tête de handler).
  if (pathname.startsWith('/api/')) {
    trackedRespondWith(event, handleApiGet(request));
    return;
  }

  // ⭐ Chunks immuables /_next/static/ → cache PERSISTANT + retry réseau
  if (IMMUTABLE_ASSET_PATTERNS.some((pattern) => pattern.test(request.url))) {
    trackedRespondWith(event, serveImmutable(request));
    return;
  }

  // ─── Assets statiques (mutables) : CacheFirst ────────────────────────
  if (STATIC_ASSET_PATTERNS.some((pattern) => pattern.test(request.url))) {
    trackedRespondWith(
      event,
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      }),
    );
    return;
  }

  // ─── Navigations HTML ──────────────────────────────────────────────────
  const isHtmlNavigation =
    request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');

  if (isHtmlNavigation) {
    // ⭐ PATTERN APP-SHELL : les navigations /app/* ET /prof/* connectées
    //    passent par le shell pré-caché → l'app React démarre depuis le
    //    cache, les données viennent d'IndexedDB. AUCUNE page « hors ligne »
    //    n'est jamais substituée. (v4.18.0 : idem pour le portail enseignant.)
    if (pathname.startsWith('/app') || isProfConnectedNavigation(pathname)) {
      trackedRespondWith(event, handleAppShellNavigation(request));
      return;
    }

    // Pages publiques autorisées au cache HTML
    if (CACHEABLE_HTML_PATTERNS.some((pattern) => pattern.test(pathname))) {
      trackedRespondWith(event, handlePublicPageNavigation(request));
      return;
    }

    // Autres navigations (non listées) → réseau direct, PAS d'interception
    return;
  }

  // Chunks JS/CSS dynamiques Next.js (hors /static/) → cache persistant + retry
  if (url.pathname.includes('/_next/') && (pathname.endsWith('.js') || pathname.endsWith('.css'))) {
    trackedRespondWith(event, serveImmutable(request));
    return;
  }

  // Tout le reste : pas d'interception (réseau direct)
});

// ─── Requêtes RSC/flight : cache + fallback offline + échec rapide ───────
function isRscRequest(request, url) {
  if (request.method !== 'GET') return false;
  const h = request.headers;
  if (h.has('rsc')) return true; // navigation du routeur
  if (h.has('next-router-prefetch')) return true; // prefetch des <Link>
  if (h.has('next-router-segment-prefetch')) return true;
  if (h.has('next-router-state-tree')) return true;
  if ((h.get('accept') || '').includes('text/x-component')) return true;
  try {
    if (url.searchParams.has('_rsc')) return true;
  } catch {
    /* URL déjà validée en amont */
  }
  return false;
}

/** Clé de cache normalisée : URL SANS le param _rsc (hash par build).
 *  Accepte un Request OU une URL en string (le pré-cache v3.4.0 passe une URL). */
function rscCacheKey(requestOrUrl) {
  const u = new URL(typeof requestOrUrl === 'string' ? requestOrUrl : requestOrUrl.url);
  u.searchParams.delete('_rsc');
  return u.toString();
}

// ─── v3.4.0 — Helpers de cache fiables ──────────────────────────────────

/** En-têtes « cachables » : SANS Vary (une entrée cachée depuis un prefetch
 *  ne matcherait JAMAIS une navigation : Vary: RSC, Next-Router-Prefetch…),
 *  SANS Content-Encoding/Length (le corps est décodé par .text()). */
function cacheableHeaders(response) {
  const headers = new Headers();
  response.headers.forEach((value, key) => {
    const lk = key.toLowerCase();
    if (lk === 'vary' || lk === 'content-encoding' || lk === 'content-length') return;
    headers.set(key, value);
  });
  return headers;
}

/** Copie « cachable » d'une réponse (Vary retiré, corps décodé).
 *  ⚠️ clone() AVANT tout await → utilisable en fire-and-forget pendant que
 *  la réponse d'origine est renvoyée à la page. */
async function toCacheableCopy(response) {
  const clone = response.clone();
  const headers = cacheableHeaders(response);
  const body = await clone.text();
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** ⭐ v3.4.0 — Matching en cascade : exact PUIS sans query params.
 *    CORRECTIF CRITIQUE : les liens de l'app portent tous ?tenant=… (mode
 *    multi-tenant SANS sous-domaine) alors que le pré-cache stockait des
 *    routes SANS query → cache.match(request) échouait TOUJOURS hors ligne
 *    → « connexion indisponible pour /app/<module> » même pré-caché. */
async function matchRouteCache(cache, requestOrUrl) {
  try {
    const exact = await cache.match(requestOrUrl);
    if (exact) return exact;
    const loose = await cache.match(requestOrUrl, { ignoreSearch: true });
    return loose || null;
  } catch {
    return null;
  }
}

async function handleRsc(request) {
  const cache = await caches.open(RSC_CACHE);
  const key = rscCacheKey(request);
  const offline = !self.navigator || self.navigator.onLine === false;

  if (!offline) {
    try {
      const response = await fetchWithTimeout(request, RSC_TIMEOUT);
      if (response && response.status === 200 && !response.redirected) {
        // ⭐ v3.4.0 — copie SANS Vary : une entrée cachée depuis un prefetch
        //    (Next-Router-Prefetch: 1) ne matchait JAMAIS une navigation réelle
        //    (Vary mismatch) → le cache RSC semblait vide hors ligne.
        toCacheableCopy(response)
          .then((copy) => cache.put(new Request(key), copy))
          .then(() => trimRscCache())
          .catch(() => {});
      }
      return response;
    } catch {
      // Réseau KO (connexion instable) → tentative de cache ci-dessous
    }
  }

  // Hors ligne (ou réseau KO) → payload en cache ?
  // ⭐ v3.4.0 — cascade exact → ignoreSearch : le pré-cache stocke la clé
  //    SANS le ?tenant= courant, les navigations réelles l'ont AVEC.
  let cached = null;
  try {
    cached = await matchRouteCache(cache, key);
  } catch {
    /* cache illisible */
  }
  if (cached) return cached;

  // Pas de cache + réseau indisponible → échec RAPIDE (fini le spinner
  // infini) : le routeur Next déclenche l'error boundary → UI hors ligne.
  return new Response(
    JSON.stringify({ error: 'offline', message: 'Page non disponible hors ligne (payload RSC absent du cache)' }),
    {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'X-AH-Offline': '1' },
    },
  );
}

/** LRU simple : garde au plus RSC_CACHE_MAX entrées (ordre d'insertion). */
async function trimRscCache() {
  try {
    const cache = await caches.open(RSC_CACHE);
    const keys = await cache.keys();
    if (keys.length > RSC_CACHE_MAX) {
      const excess = keys.slice(0, keys.length - RSC_CACHE_MAX);
      await Promise.all(excess.map((k) => cache.delete(k)));
    }
  } catch {
    /* non-bloquant */
  }
}

// ─── API GET : NetworkFirst + cache identitaire + fallback offline ────────

/** Hash FNV-1a 32 bits — condense l'identité (Authorization/cookies) en clé. */
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16);
}

/**
 * ⭐ v3.5.0 — Identité NORMALISÉE (tenant + user) du cache API.
 *
 *    PROBLÈME (v3.4) : la clé intégrait un hash des headers BRUTS → la MÊME
 *    URL était cachée sous des clés DIFFÉRENTES selon le style d'appel
 *    (fetchJson cookie-only ≠ offlineFetch JWT+cookies ≠ axios JWT+xtid)
 *    → fragmentation : une entrée pré-cachée ou visitée via un style
 *    n'était JAMAIS retrouvée par un autre style → « fausses données ».
 *
 *    Désormais on extrait les MÊMES VALEURS (tenantId, userId) de toutes
 *    les sources disponibles — la clé est donc IDENTIQUE quel que soit le
 *    style d'appel :
 *      1. header `x-tenant-id` (+ cookies x-tenant-id)
 *      2. JWT Authorization (claims tenantId + sub)
 *      3. cookie `academia_session` (JSON { user: { id }, tenant: { id } })
 *
 * Retour :
 *   - 'T:<tenantId>|U:<userId>'      → clé = URL + '?__ah_t=' + hash
 *     (fallback identité brute si tenant/user non extractibles mais
 *      matériau d'identité présent — ex. session cookie opaque)
 *   - null   → cookies présents mais AUCUNE identité reconnaissable →
 *              réseau direct, JAMAIS servi depuis le cache (anti-fuite)
 *   - 'ANONYMOUS' → ni identité ni cookies → données publiques → clé = URL
 */
function decodeJwtPayload(jwt) {
  try {
    const parts = jwt.split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    let json = '';
    for (let i = 0; i < bin.length; i++) {
      json += '%' + bin.charCodeAt(i).toString(16).padStart(2, '0');
    }
    return JSON.parse(decodeURIComponent(json));
  } catch {
    return null;
  }
}

function apiIdentity(request) {
  const details = apiIdentityCore(request);
  return details ? details.key : null;
}

/**
 * ⭐ V4.0 — Identité DÉTAILLÉE (mêmes règles que apiIdentity — clé identitaire
 *    anti-fuite cross-tenant), mais expose aussi tenantId/userId extraits des
 *    claims JWT / cookies pour :
 *    - taguer les entités écrites dans IndexedDB (filtre tenant strict) ;
 *    - construire les clés response_cache (T:tenant|GET|chemin) ;
 *    - créer les événements outbox SW (replay groupé par tenant).
 */
function apiIdentityCore(request) {
  let tenantId = null;
  let userId = null;
  let rawMaterial = false;

  const xtidHeader = request.headers.get('x-tenant-id');
  if (xtidHeader && xtidHeader.trim()) {
    tenantId = xtidHeader.trim();
    rawMaterial = true;
  }

  const authz = request.headers.get('authorization');
  if (authz && authz.trim()) {
    rawMaterial = true;
    if (authz.toLowerCase().startsWith('bearer ')) {
      const claims = decodeJwtPayload(authz.slice(7).trim());
      if (claims) {
        const jwtTenant = claims.tenantId || claims.tenant_id ||
          (claims.tenant && claims.tenant.id) || null;
        if (jwtTenant && !tenantId) tenantId = String(jwtTenant);
        if (!userId) {
          const sub = claims.sub || claims.userId || claims.user_id || null;
          if (sub) userId = String(sub);
        }
      }
    }
  }

  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const pairs = cookieHeader.split(';').map((s) => s.trim()).filter(Boolean);
    for (const pair of pairs) {
      const eq = pair.indexOf('=');
      if (eq === -1) continue;
      const name = pair.slice(0, eq).toLowerCase();
      let value = pair.slice(eq + 1);
      try {
        value = decodeURIComponent(value);
      } catch {
        /* garder la valeur brute */
      }
      if (name === 'x-tenant-id' && value && !tenantId) {
        tenantId = value;
        rawMaterial = true;
      }
      if ((name === 'academia_token' || name === 'academia_token_jwt') && value && !userId) {
        // Cookie JWT (httpOnly academia_token) → claims tenantId/sub
        const claims = decodeJwtPayload(value);
        if (claims) {
          const jwtTenant = claims.tenantId || claims.tenant_id || null;
          if (jwtTenant && !tenantId) tenantId = String(jwtTenant);
          const sub = claims.sub || claims.userId || null;
          if (sub) userId = String(sub);
          rawMaterial = true;
        }
      }
      if (name === 'academia_session' && value) {
        try {
          const session = JSON.parse(value);
          const t = session?.tenant?.id ?? session?.user?.tenantId ??
            session?.tenantId ?? null;
          if (t && !tenantId) tenantId = String(t);
          const u = session?.user?.id ?? session?.userId ?? null;
          if (u && !userId) userId = String(u);
          rawMaterial = true;
        } catch {
          /* session opaque — matériau d'identité quand même */
          rawMaterial = true;
        }
      } else if (/token|session|tenant|auth/.test(name)) {
        rawMaterial = true;
      }
    }
  }

  // ⭐ Identité normalisée (tenant|user) — stable d'un style d'appel à l'autre
  if (tenantId || userId) {
    return {
      key: 'T:' + (tenantId || '?') + '|U:' + (userId || '?'),
      tenantId,
      userId,
    };
  }

  // Fallback matériau brut (session opaque sans JSON parsable) : la clé
  // restera propre à ce style d'appel (comportement v3.4) — cache-on-visit
  // cohérent, mais sans garantie de matching inter-styles.
  if (rawMaterial) {
    const parts = [];
    if (xtidHeader) parts.push('xtid:' + xtidHeader);
    if (authz) parts.push('authz:' + authz.length + ':' + authz.slice(-48));
    if (cookieHeader) {
      const identityPairs = cookieHeader.split(';').map((s) => s.trim())
        .filter(Boolean)
        .filter((p) => /token|session|tenant|auth/.test((p.split('=')[0] || '').toLowerCase()));
      if (identityPairs.length) parts.push('cookie:' + identityPairs.join('&'));
    }
    if (parts.length) return { key: parts.join('|'), tenantId, userId };
  }

  if (cookieHeader) return null;
  return { key: 'ANONYMOUS', tenantId: null, userId: null };
}

/**
 * ⭐ v4.2.1 — Identité API ASYNCHRONE (CookieStore).
 * PROBLÈME : les fetchs de la page SANS headers d'auth (WhatsAppChat, pages
 * parent, hooks React Query nus…) n'exposent PAS le header Cookie au
 * Service Worker — les cookies sont attachés au niveau RÉSEAU, APRÈS
 * l'interception (comportement standard des navigateurs : le Cookie est
 * un forbidden header ajouté après le SW). Résultat : ces requêtes
 * résolvent l'identité 'ANONYMOUS' → clé de cache SANS suffixe __ah_t →
 * elles ratent les entrées pré-cachées (clés T:tenant|U:user des requêtes
 * axios/pré-cache) → 503 « aucune copie locale » hors ligne alors que les
 * données SONT en cache (constaté : chat « Impossible de charger les
 * conversations », spinner « Chargement de vos enfants... » parent).
 * CORRECTIF : CookieStore API (Chrome 87+, Safari 15.4+) — le SW lit les
 * cookies de SON origine et résout la MÊME identité T:tenant|U:user que
 * les styles d'appel à headers explicites (axios, bffFetch). Si l'API
 * est absente (navigateur plus ancien), on retombe sur la résolution
 * sync (statu quo, aucune régression).
 */
async function apiIdentityAsync(request) {
  const sync = apiIdentityCore(request);
  // Identité déjà résolue par headers explicites → direct.
  if (sync && sync.key && sync.key !== 'ANONYMOUS' && sync.tenantId) return sync;
  try {
    const cs = self.cookieStore;
    if (!cs || typeof cs.getAll !== 'function') return sync;
    const cookies = await cs.getAll();
    if (!Array.isArray(cookies) || !cookies.length) return sync;
    let tenantId = (sync && typeof sync === 'object' && sync.tenantId) || null;
    let userId = (sync && typeof sync === 'object' && sync.userId) || null;
    for (const ck of cookies) {
      const name = String((ck && ck.name) || '').toLowerCase();
      let value = String((ck && ck.value) || '');
      if (!value) continue;
      try { value = decodeURIComponent(value); } catch { /* garder brut */ }
      if (name === 'x-tenant-id' && !tenantId) {
        tenantId = value;
      }
      if ((name === 'academia_token' || name === 'academia_token_jwt') && (!userId || !tenantId)) {
        const claims = decodeJwtPayload(value);
        if (claims) {
          const jt = claims.tenantId || claims.tenant_id ||
            (claims.tenant && claims.tenant.id) || null;
          if (jt && !tenantId) tenantId = String(jt);
          const sub = claims.sub || claims.userId || claims.user_id || null;
          if (sub && !userId) userId = String(sub);
        }
      }
      if (name === 'academia_session' && (!userId || !tenantId)) {
        try {
          const sess = JSON.parse(value);
          const t = (sess && ((sess.tenant && sess.tenant.id) ||
            (sess.user && sess.user.tenantId) || sess.tenantId)) || null;
          if (t && !tenantId) tenantId = String(t);
          const u = (sess && ((sess.user && sess.user.id) || sess.userId)) || null;
          if (u && !userId) userId = String(u);
        } catch { /* session opaque */ }
      }
    }
    if (tenantId || userId) {
      return { key: 'T:' + (tenantId || '?') + '|U:' + (userId || '?'), tenantId, userId };
    }
  } catch { /* CookieStore indisponible → résolution sync */ }
  return sync;
}

/** ⭐ v3.5.0 — Clé de cache API : URL SANS le cache-buster `_t` (hrFetch
 *    ajoute ?_t=<timestamp> à chaque GET → sans normalisation, chaque
 *    requête produisait une NOUVELLE clé et ne retrouvait jamais le cache).
 *    ⚠️ PAS de fragment (#) — le constructeur Request SUPPRIME les fragments
 *    d'URL → on utilise un query param (préservé dans request.url).
 * ⭐ v4.4.0 — Le scope NIVEAU (header x-school-level-id) fait partie de
 *    l'identité LOGIQUE de la réponse : le sélecteur de niveau du header
 *    change le SANS changer l'URL → sans cette clé enrichie, la donnée du
 *    niveau précédent était servie pour le nouveau niveau (sélecteur
 *    « qui ne fonctionne pas »). Idem année (x-academic-year-id).
 *    Pseudo-params __ah_lvl / __ah_year : présents UNIQUEMENT dans la clé de
 *    cache, jamais dans l'URL réelle. Omis quand la valeur est 'ALL'/vide ou
 *    déjà portée par l'URL (pas de double entrée) — le pré-cache (sans ces
 *    headers) continue de produire les variantes ÉLARGIES sans pseudo-params,
 *    qui servent de sources au filtrage hors ligne. */
function apiCacheKey(request, identity) {
  let base;
  try {
    const u = new URL(request.url);
    u.searchParams.delete('_t');
    u.searchParams.sort(); // ordre stable des params → même clé quel que soit l'ordre
    try {
      const lvl = (request.headers.get('x-school-level-id') || '').trim();
      if (
        lvl &&
        lvl.toUpperCase() !== 'ALL' &&
        u.searchParams.get('schoolLevelId') !== lvl &&
        u.searchParams.get('levelId') !== lvl
      ) {
        u.searchParams.set('__ah_lvl', lvl);
      }
      const yr = (request.headers.get('x-academic-year-id') || '').trim();
      if (yr && u.searchParams.get('academicYearId') !== yr) {
        u.searchParams.set('__ah_year', yr);
      }
      u.searchParams.sort();
    } catch {
      /* headers illisibles → clé sans scope header */
    }
    base = u.toString();
  } catch {
    base = request.url;
  }
  if (identity === 'ANONYMOUS') return base;
  return base + (base.includes('?') ? '&' : '?') + '__ah_t=' + fnv1a(identity);
}

async function handleApiGet(request, timeoutMs = API_TIMEOUT) {
  const identityDetails = await apiIdentityAsync(request);
  const identity = identityDetails ? identityDetails.key : null;
  // Contexte de session inconnu (cookies sans identité reconnue) → réseau
  // direct : on ne met PAS en cache et on ne sert JAMAIS depuis le cache.
  if (identity === null) return fetch(request);

  const key = apiCacheKey(request, identity);
  const cache = await caches.open(API_CACHE);
  const offline = !self.navigator || self.navigator.onLine === false;

  if (!offline) {
    try {
      const response = await fetchWithTimeout(request, timeoutMs);
      if (response && response.status === 200 && !response.redirected) {
        const ct = response.headers.get('content-type') || '';
        if (ct.includes('json')) {
          // ⭐ v3.4.0 — copie SANS Vary (la clé identitaire __ah_t protège
          //    déjà l'isolation tenant : le Vary sur la copie cachée ne
          //    servait qu'à faire échouer le matching).
          toCacheableCopy(response)
            .then((copy) => cache.put(new Request(key), copy))
            .then(() => trimApiCache())
            .catch(() => {});
          // ⭐ V4.0 — WRITE-THROUGH INDEXEDDB (spec §2.3 : « en parallèle
          //    mettre à jour la table IndexedDB correspondante ») : la
          //    réponse alimente response_cache (par URL, tout format) ET
          //    les stores d'entités (tableaux avec id — pool + navigation).
          //    Hors ligne, la cascade IDB sert ces données aux variantes
          //    de params jamais visitées + fusionne les écritures en attente.
          swWriteThroughIdb(request, response, identityDetails.tenantId).catch(() => {});
        }
      }
      return response;
    } catch {
      // Réseau KO (2G/3G instable) → fallback cache ci-dessous
    }
  }

  // Hors ligne (ou réseau KO) → dernière réponse en cache ?
  let cached = null;
  try {
    cached = await cache.match(key);
  } catch {
    /* cache illisible */
  }
  if (cached) return swServeOfflineCachedResponse(cached, request, identityDetails.tenantId);

  // ⭐ v4.4.0 — FILTRAGE HORS LIGNE (spec « sélecteurs/filtres offline ») :
  //    la clé exacte manque (ex. ?classId=X jamais visité en ligne, ou
  //    sélecteur de niveau changé via header) → chercher une VARIANTE ÉLARGIE
  //    du même endpoint (le pré-cache stocke les variantes sans filtre ou
  //    'ALL'), puis FILTRER côté SW selon les params demandés (classId,
  //    schoolLevelId, status, taskType, category, codes level/classLevel/
  //    subject, search, pagination…). Les réponses agrégats (KPI, stats)
  //    n'ont pas de tableau → null → cascade classique ci-dessous.
  cached = await swFilteredApiFallback(cache, request, identity, identityDetails.tenantId);
  if (cached) return cached;

  // ⭐ v3.7.0 — FALLBACK PAR CHEMIN (spec « lecture hors ligne par module ») :
  //    la clé exacte (params complets) manque MAIS le pré-cache/la navigation
  //    en ligne a très probablement stocké une VARIANTE de params du MÊME
  //    endpoint pour le MÊME utilisateur (le pré-cache v3.6 envoie ~230
  //    endpoints avec des combinaisons précises ; les pages en demandent
  //    d'autres). On sert l'entrée du même chemin dont les params sont les
  //    plus proches de la demande — STRICTEMENT la même identité (aucune
  //    fuite cross-tenant : __ah_t identique).
  //    Un module affiche ainsi SES données (périmètre de filtre le plus
  //    proche) au lieu d'une page vide.
  cached = await matchApiByPath(cache, request, identity);
  if (cached) return swServeOfflineCachedResponse(cached, request, identityDetails.tenantId);

  // ⭐ V4.0 — CASCADE INDEXEDDB (spec §2.4 : « lire la table IndexedDB
  //    correspondante et fabriquer une réponse HTTP valide ») :
  //    1. response_cache — URL exacte (params triés) pour ce tenant
  //    2. response_cache — même chemin, params les plus proches
  //    3. stores d'entités (mapping ROUTE_TABLES) : filtres tenant + année
  //       active, _deleted retirés, fusion des entités _isDirty en attente
  //       → réponse fabriquée au format JSON attendu par l'API.
  const idbResponse = await swIdbFallbackForGet(request, identityDetails.tenantId);
  if (idbResponse) return idbResponse;

  // Pas de cache + réseau indisponible → échec RAPIDE avec corps explicite :
  // le composant gère ce 503 proprement — JAMAIS de spinner infini.
  return new Response(
    JSON.stringify({ error: 'offline', message: 'Données non disponibles hors ligne (aucune copie locale)' }),
    {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'X-AH-Offline': '1' },
    },
  );
}

/** ⭐ v3.7.0 — Meilleure entrée du cache API pour le MÊME chemin + MÊME
 *    identité, params triés par proximité avec la demande (2 points par
 *    param identique, pénalité légère par param supplémentaire ; à égalité,
 *    la réponse la plus récente selon l'en-tête `date` préservé). */
async function matchApiByPath(cache, request, identity) {
  try {
    const reqUrl = new URL(request.url);
    const wantedPath = reqUrl.pathname;
    const wanted = new URLSearchParams();
    reqUrl.searchParams.forEach((value, name) => {
      if (name !== '_t') wanted.append(name, value);
    });
    const wantedIdentityHash = identity === 'ANONYMOUS' ? null : fnv1a(identity);

    const keys = await cache.keys();
    let bestKey = null;
    let bestScore = -Infinity;
    let bestDate = 0;
    for (const k of keys) {
      let ku;
      try {
        ku = new URL(k.url);
      } catch {
        continue;
      }
      if (ku.pathname !== wantedPath) continue;
      const gotIdentityHash = ku.searchParams.get('__ah_t');
      if ((gotIdentityHash || null) !== (wantedIdentityHash || null)) continue;

      // ⭐ v4.4.0 — Année différente → JAMAIS servie telle quelle (une
      //    autre année = un autre dataset : servir 2026 pour une demande
      //    2025 serait une fausse donnée). L'année demandée = param URL ou
      //    header x-academic-year-id ; l'année de la variante = param ou
      //    pseudo-param __ah_year.
      const gotYear =
        ku.searchParams.get('academicYearId') || ku.searchParams.get('__ah_year');
      let wantedYear = wanted.get('academicYearId');
      if (!wantedYear) {
        try {
          wantedYear = (request.headers.get('x-academic-year-id') || '').trim() || null;
        } catch {
          wantedYear = null;
        }
      }
      if (wantedYear && gotYear && gotYear !== wantedYear) continue;
      // ⭐ v4.4.2 — variante sans année = implicitement année ACTIVE : une
      //    autre année demandée ne doit pas être servie par cette variante.
      if (wantedYear && !gotYear) {
        const activeYr = await swGetActiveAcademicYearId();
        if (activeYr && wantedYear !== activeYr) continue;
      }

      const got = new URLSearchParams();
      ku.searchParams.forEach((value, name) => {
        if (name !== '_t' && name !== '__ah_t') got.append(name, value);
      });
      let score = 0;
      let wantedCount = 0;
      wanted.forEach((value, name) => {
        wantedCount++;
        if (got.get(name) === value) score += 2;
      });
      let gotCount = 0;
      got.forEach(() => {
        gotCount++;
      });
      score -= Math.max(0, gotCount - wantedCount);

      if (score > bestScore) {
        bestScore = score;
        bestKey = k;
        try {
          bestDate = Date.parse((await peekHeader(cache, k, 'date')) || '') || 0;
        } catch {
          bestDate = 0;
        }
      } else if (score === bestScore && bestKey) {
        let date = 0;
        try {
          date = Date.parse((await peekHeader(cache, k, 'date')) || '') || 0;
        } catch {
          date = 0;
        }
        if (date > bestDate) {
          bestDate = date;
          bestKey = k;
        }
      }
    }
    if (bestKey) return cache.match(bestKey);
  } catch {
    /* non-bloquant */
  }
  return null;
}

// ─── v4.4.0 — FILTRES HORS LIGNE : variante élargie + filtrage ──────────────
//
// Problème résolu : changer un sélecteur (niveau, classe, statut, onglet
// filtré…) hors ligne déclenche un GET dont les params diffèrent des clés
// pré-cachées → miss → données vides ou non filtrées. Solution : servir la
// VARIANTE ÉLARGIE du même endpoint (pré-cache : sans filtre / 'ALL' / plus
// grande couverture) puis appliquer les filtres demandés AU SW, comme le
// ferait le serveur, sur le tableau de la réponse.

/** Params de couverture/pagination : jamais un critère d'éligibilité —
 *  ils servent au découpage final et à la préférence de source (la plus
 *  large couverture gagne). */
const OFFLINE_COVERAGE_PARAMS = new Set([
  'page', 'limit', 'offset', 'size', 'exportAll', 'sortBy', 'sort',
  'sortOrder', 'order', 'orderBy', '_t', '__ah_t', '__ah_lvl', '__ah_year',
]);

/** Params qui doivent être IDENTIQUES entre la demande et la source
 *  (contexte de données, pas des filtres affichables). */
const OFFLINE_MUST_MATCH_PARAMS = new Set([
  'academicYearId', 'tenantId', 'parentId', 'schoolYearId', 'year',
]);

/** Params de filtre reconnus → chaînes de résolution du champ sur l'item
 *  ('*' = n'importe quel élément du tableau). */
const OFFLINE_FILTER_RESOLVERS = {
  classId: ['classId', 'class.id', 'section.id', 'academicClassId',
    'studentEnrollments.*.class.id', 'student.studentEnrollments.*.class.id',
    'enrollments.*.classId', 'enrollments.*.class.id', 'student.enrollments.*.class.id'],
  status: ['status'],
  taskType: ['taskType'],
  category: ['category'],
  feeType: ['feeType', 'allocations.*.accountBreakdown.feeStructure.feeType'],
  teacherId: ['teacherId', 'teacher.id'],
  subjectId: ['subjectId', 'subject.id'],
  studentId: ['studentId', 'student.id'],
  periodId: ['periodId', 'period.id'],
  quarterId: ['quarterId', 'quarter.id'],
  language: ['language', 'class.language'],
  regimeType: ['regimeType'],
  type: ['type'],
  month: ['month'],
  // Bibliothèque globale (codes / noms — valeurs string ou objets peuplés)
  level: ['level.code', 'level'],
  classLevel: ['classLevel.code', 'classLevel'],
  subject: ['subject.name', 'subject'],
  resourceType: ['resourceType'],
  series: ['series'],
};

/** Champs explorés par le filtre de recherche textuelle. */
const OFFLINE_SEARCH_FIELDS = [
  'name', 'title', 'label', 'firstName', 'lastName', 'fullName', 'code',
  'matricule', 'email', 'description', 'className', 'studentName',
];

/** Résout un chemin ('studentEnrollments.*.class.id') sur un item → valeurs. */
function swResolvePath(item, path) {
  const parts = path.split('.');
  let values = [item];
  for (const p of parts) {
    const next = [];
    if (p === '*') {
      for (const v of values) {
        if (Array.isArray(v)) {
          for (const e of v) if (e != null) next.push(e);
        }
      }
    } else {
      for (const v of values) {
        if (v && typeof v === 'object' && v[p] != null) next.push(v[p]);
      }
    }
    values = next;
    if (!values.length) return [];
  }
  return values;
}

/** Égalité tolérante : string directe, ou objet peuplé (id/code/name). */
function swFilterValueEquals(v, value) {
  if (v == null) return false;
  if (typeof v === 'object') {
    for (const k of ['id', 'code', 'name', 'uuid']) {
      if (v[k] != null && String(v[k]).toLowerCase() === String(value).toLowerCase()) return true;
    }
    return false;
  }
  return String(v).toLowerCase() === String(value).toLowerCase();
}

function swItemMatchesSearch(item, q) {
  const needle = String(q || '').trim().toLowerCase();
  if (!needle) return true;
  for (const f of OFFLINE_SEARCH_FIELDS) {
    for (const v of swResolvePath(item, f)) {
      if (typeof v === 'string' && v.toLowerCase().includes(needle)) return true;
    }
  }
  return false;
}

/** Index d'alias de niveaux : UUID éducation ↔ UUID school_levels ↔ code,
 *  construit depuis le /api/school-levels en cache (mémo 2 min). */
let swLevelAliasMemo = null;
async function swGetLevelIndex(cache, identity) {
  const identityHash = identity === 'ANONYMOUS' ? null : fnv1a(identity);
  if (
    swLevelAliasMemo &&
    Date.now() - swLevelAliasMemo.readAt < 120000 &&
    swLevelAliasMemo.identityHash === (identityHash || null)
  ) {
    return swLevelAliasMemo.index;
  }
  let index = null;
  try {
    const keys = await cache.keys();
    for (const k of keys) {
      let ku;
      try {
        ku = new URL(k.url);
      } catch {
        continue;
      }
      if (ku.pathname !== '/api/school-levels') continue;
      const gotHash = ku.searchParams.get('__ah_t');
      if ((gotHash || null) !== (identityHash || null)) continue;
      const res = await cache.match(k);
      if (!res) continue;
      const text = await res.text();
      if (!text.trim()) continue;
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        continue;
      }
      const rows = Array.isArray(data) ? data : Array.isArray(data && data.data) ? data.data : [];
      if (!rows.length) continue;
      const byAlias = new Map();
      for (const r of rows) {
        const codes = new Set();
        for (const c of [r && r.code, r && r.levelCode, r && r.level && r.level.code]) {
          if (c) codes.add(String(c).toUpperCase());
        }
        if (!codes.size) continue;
        for (const a of [r.id, r.schoolLevelId, r.educationLevelId]) {
          if (a) byAlias.set(String(a).toLowerCase(), codes);
        }
        for (const c of codes) {
          if (!byAlias.has(c.toLowerCase())) byAlias.set(c.toLowerCase(), codes);
        }
      }
      index = { byAlias };
      break;
    }
  } catch {
    index = null;
  }
  swLevelAliasMemo = { index, identityHash: identityHash || null, readAt: Date.now() };
  return index;
}

/** Valeur de niveau (UUID éducation OU school_levels, code, composite
 *  'MAT_PRI') → ensemble de codes canoniques ; null = inconnu. */
function swCanonicalLevelCodes(value, levelIndex) {
  const v = String(value == null ? '' : value).trim();
  if (!v) return null;
  const direct = levelIndex && levelIndex.byAlias.get(v.toLowerCase());
  if (direct) return new Set(direct);
  const upper = v.toUpperCase();
  if (upper.includes('_')) {
    const parts = upper.split('_').filter(Boolean);
    const codes = new Set();
    if (levelIndex) {
      for (const cs of levelIndex.byAlias.values()) {
        for (const c of cs) {
          for (const p of parts) {
            if (c.startsWith(p)) codes.add(c);
          }
        }
      }
    }
    if (codes.size) return codes;
    return new Set(parts);
  }
  // Code direct (ex. 'PRIMAIRE') non résolu par l'index → lui-même
  if (/^[A-Z][A-Z_-]*$/.test(upper) && !/^[0-9a-f]{8}-/i.test(v)) return new Set([upper]);
  return null;
}

/** L'item porte-t-il une quelconque information de niveau ? */
function swItemHasLevelInfo(item) {
  const chains = [
    'schoolLevelId', 'schoolLevel.id', 'schoolLevel.code', 'levelId', 'level.id',
    'level', 'classLevel', 'class.schoolLevelId', 'class.schoolLevel.id',
    'class.schoolLevel.code', 'class.level.id',
    'studentEnrollments.*.class.schoolLevelId',
    'student.studentEnrollments.*.class.schoolLevelId',
  ];
  for (const c of chains) {
    if (swResolvePath(item, c).length) return true;
  }
  return false;
}

/** L'item appartient-il au niveau demandé (double saveur d'UUID gérée par
 *  l'index d'alias ; composite 'MAT_PRI' = union de niveaux). */
function swItemMatchesLevel(item, wantedValue, levelIndex) {
  const wanted = swCanonicalLevelCodes(wantedValue, levelIndex);
  const rawValues = [];
  const itemCodes = new Set();
  const chains = [
    'schoolLevelId', 'schoolLevel.id', 'schoolLevel.code', 'levelId', 'level.id',
    'level', 'classLevel', 'class.schoolLevelId', 'class.schoolLevel.id',
    'class.schoolLevel.code', 'class.level.id',
    'studentEnrollments.*.class.schoolLevelId',
    'student.studentEnrollments.*.class.schoolLevelId',
  ];
  for (const c of chains) {
    for (const v of swResolvePath(item, c)) {
      if (typeof v === 'object') {
        if (v.code || v.levelCode) itemCodes.add(String(v.code || v.levelCode).toUpperCase());
        if (v.id) rawValues.push(String(v.id));
      } else {
        rawValues.push(String(v));
        itemCodes.add(String(v).toUpperCase());
      }
    }
  }
  if (!rawValues.length && !itemCodes.size) return true; // pas d'info → ne pas exclure
  if (wanted) {
    for (const raw of rawValues) {
      const cs = levelIndex && levelIndex.byAlias.get(raw.toLowerCase());
      if (cs && [...cs].some((c) => wanted.has(c))) return true;
    }
    for (const c of itemCodes) {
      if (wanted.has(c)) return true;
      for (const w of wanted) {
        if (c.startsWith(w) || w.startsWith(c)) return true; // MAT ↔ MATERNELLE
      }
    }
    return false;
  }
  // Valeur inconnue (hors index) → comparaison brute uniquement
  const wv = String(wantedValue).toLowerCase();
  return rawValues.some((r) => r.toLowerCase() === wv);
}

function swItemMatchesFilter(item, param, value, levelIndex) {
  if (param === 'search' || param === 'q') return swItemMatchesSearch(item, value);
  if (param === 'schoolLevelId' || param === 'levelId') return swItemMatchesLevel(item, value, levelIndex);
  const chain = OFFLINE_FILTER_RESOLVERS[param];
  if (!chain) return true; // param inconnu → superset servi (pas de faux vide)
  for (const path of chain) {
    for (const v of swResolvePath(item, path)) {
      if (swFilterValueEquals(v, value)) return true;
    }
  }
  return false;
}

/** Au moins un item résout-il le champ de ce param ? (sinon on ne filtre
 *  pas : superset plutôt qu'un faux vide quand le champ est invisible.) */
function swFilterIsResolvable(items, param) {
  if (param === 'search' || param === 'q') {
    return items.some((it) => OFFLINE_SEARCH_FIELDS.some((f) => swResolvePath(it, f).length > 0));
  }
  if (param === 'schoolLevelId' || param === 'levelId') {
    return items.some((it) => swItemHasLevelInfo(it));
  }
  const chain = OFFLINE_FILTER_RESOLVERS[param];
  if (!chain) return false;
  return items.some((it) =>
    chain.some((path) => swResolvePath(it, path).length > 0),
  );
}

/** Filtre par plage de dates (startDate/endDate/dateFrom/dateTo sur les
 *  champs date ISO de l'item). */
function swItemMatchesDateRange(item, from, to) {
  const fields = ['date', 'createdAt', 'paymentDate', 'paidAt', 'dueDate', 'startDate', 'evaluationDate'];
  let checked = false;
  for (const f of fields) {
    for (const v of swResolvePath(item, f)) {
      if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v)) continue;
      checked = true;
      if (from && v.slice(0, from.length) < from) return false;
      if (to && v.slice(0, to.length) > to) return false;
    }
  }
  if (!checked) return true; // aucune date visible → ne pas exclure
  return true;
}

/** Localise le tableau d'items dans l'enveloppe (array, {data}, {items},
 *  {results}, {content}… y compris imbriqué un niveau). */
function swLocateArray(data) {
  if (Array.isArray(data)) return { kind: 'root', pathToContainer: [], arrayKey: null };
  if (data && typeof data === 'object') {
    for (const key of ['data', 'items', 'results', 'content', 'classes', 'resources', 'students', 'evaluations', 'list']) {
      if (Array.isArray(data[key])) return { kind: 'prop', pathToContainer: [], arrayKey: key };
    }
    for (const key of Object.keys(data)) {
      const v = data[key];
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        for (const k2 of ['data', 'items', 'results', 'content']) {
          if (Array.isArray(v[k2])) return { kind: 'prop', pathToContainer: [key], arrayKey: k2 };
        }
      }
    }
  }
  return null;
}

/** ⭐ v4.4.0 — Cœur du filtrage hors ligne. Retourne une Response filtrée,
 *  ou null (cascade classique : matchApiByPath → IDB → 503). */
async function swFilteredApiFallback(cache, request, identity, tenantId) {
  try {
    const reqUrl = new URL(request.url);
    const wanted = {};
    reqUrl.searchParams.forEach((v, n) => {
      // Valeur vide ignorée (la bibliothèque sérialise TOUS les filtres, même
      // vides : ?level=&classLevel=&subject=… — un filtre vide n'en est pas un)
      if (n !== '_t' && n !== '__ah_t' && v !== '') wanted[n] = v;
    });
    const lvlHeader = (request.headers.get('x-school-level-id') || '').trim();
    let wantedLevel =
      lvlHeader && lvlHeader.toUpperCase() !== 'ALL'
        ? lvlHeader
        : wanted.schoolLevelId || wanted.levelId || null;
    // 'ALL' (URL ou header) = demande NON scopée → aucun filtrage de niveau
    if (wantedLevel && wantedLevel.toUpperCase() === 'ALL') wantedLevel = null;
    const yrHeader = (request.headers.get('x-academic-year-id') || '').trim();
    const wantedYear = yrHeader || wanted.academicYearId || null;

    const identityHash = identity === 'ANONYMOUS' ? null : fnv1a(identity);
    const keys = await cache.keys();

    // 1) Candidats : même chemin + même identité
    const candidates = [];
    for (const k of keys) {
      let ku;
      try {
        ku = new URL(k.url);
      } catch {
        continue;
      }
      if (ku.pathname !== reqUrl.pathname) continue;
      const gotHash = ku.searchParams.get('__ah_t');
      if ((gotHash || null) !== (identityHash || null)) continue;
      const params = {};
      ku.searchParams.forEach((v, n) => {
        if (n === '_t' || n === '__ah_t' || n === '__ah_lvl' || n === '__ah_year') return;
        if (v === '') return; // filtre vide = pas un pin
        params[n] = v;
      });
      // 'ALL' (URL ou pseudo-param) = source NON scopée → cLevel null
      const rawCLevel =
        ku.searchParams.get('__ah_lvl') || params.schoolLevelId || params.levelId || null;
      const cLevel = rawCLevel && rawCLevel.toUpperCase() !== 'ALL' ? rawCLevel : null;
      const cYear = ku.searchParams.get('__ah_year') || params.academicYearId || null;
      candidates.push({ key: k, params, cLevel, cYear });
    }
    if (!candidates.length) return null;

    const levelIndex = await swGetLevelIndex(cache, identity);
    // ⭐ v4.4.2 — Année active locale : une variante SANS année dans sa clé est
    //    implicitement scopée à l'année ACTIVE (le serveur scope par header
    //    x-academic-year-id / année active) → si une AUTRE année est demandée,
    //    c'est un conflit, pas une source valide.
    const activeYearId = await swGetActiveAcademicYearId();

    // 2) Éligibilité : aucun param en conflit avec la demande
    const eligible = [];
    for (const c of candidates) {
      let ok = true;
      let exactPins = 0;
      if (wantedYear && c.cYear && c.cYear !== wantedYear) ok = false; // autre année → autre dataset
      // ⭐ v4.4.2 — variante sans année = implicitement année ACTIVE
      if (ok && wantedYear && !c.cYear && activeYearId && wantedYear !== activeYearId) ok = false;
      if (ok && wantedLevel && c.cLevel) {
        const wc = swCanonicalLevelCodes(wantedLevel, levelIndex);
        const cc = swCanonicalLevelCodes(c.cLevel, levelIndex);
        const same =
          wc && cc
            ? [...wc].some((x) => cc.has(x))
            : String(c.cLevel).toLowerCase() === String(wantedLevel).toLowerCase();
        if (!same) ok = false; // source déjà scoped à un autre niveau
      }
      if (ok) {
        for (const name of Object.keys(wanted)) {
          const value = wanted[name];
          if (OFFLINE_COVERAGE_PARAMS.has(name)) continue;
          if (name === 'schoolLevelId' || name === 'levelId') continue; // géré via wantedLevel
          const gotVal = c.params[name];
          if (gotVal === undefined) continue; // absent → filtrable par le SW
          if (gotVal === value) {
            exactPins++;
            continue;
          }
          ok = false; // épinglé différemment (filtre OU contexte) → conflit
          break;
        }
      }
      if (ok) eligible.push({ ...c, exactPins });
    }
    if (!eligible.length) return null;

    // 3) Source : la variante éligible au tableau le plus LARGE (couverture
    //    réelle), à égalité la plus récente / la plus précise
    let best = null;
    for (const c of eligible) {
      const res = await cache.match(c.key);
      if (!res) continue;
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('json')) continue;
      const text = await res.text();
      if (!text.trim()) continue;
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        continue;
      }
      const loc = swLocateArray(data);
      if (!loc) continue; // agrégat/objet → pas filtrable ici
      const date = Date.parse(res.headers.get('date') || '') || 0;
      const breadth = loc.kind === 'root' ? data.length : data[loc.arrayKey].length;
      if (
        !best ||
        breadth > best.breadth ||
        (breadth === best.breadth && c.exactPins > best.exactPins) ||
        (breadth === best.breadth && c.exactPins === best.exactPins && date > best.date)
      ) {
        best = { ...c, data, loc, breadth, date };
      }
    }
    if (!best) return null;

    // 4) Fusion des entités créées hors ligne (sur la liste COMPLÈTE)
    let out = best.data;
    try {
      const { path } = swNormalizeUrl(request.url);
      const store = routeTable(path);
      if (store && store !== 'orion_cache') {
        out = await swMergePendingEntities(store, best.data, tenantId);
      }
    } catch {
      out = best.data;
    }
    const loc = swLocateArray(out);
    if (!loc) return null;
    let arr = loc.kind === 'root' ? out : out[loc.arrayKey];

    // 5) Filtres à appliquer : params demandés NON déjà épinglés dans la source
    const filters = [];
    if (wantedLevel && !best.cLevel && !(wanted.schoolLevelId || wanted.levelId)) {
      filters.push({ name: 'schoolLevelId', value: wantedLevel }); // niveau du HEADER
    }
    const dateRange = { from: null, to: null };
    for (const name of Object.keys(wanted)) {
      const value = wanted[name];
      if (OFFLINE_COVERAGE_PARAMS.has(name)) continue;
      if (OFFLINE_MUST_MATCH_PARAMS.has(name)) continue;
      if (name === 'schoolLevelId' || name === 'levelId') {
        if (!best.cLevel) filters.push({ name, value });
        continue;
      }
      if (name === 'startDate' || name === 'dateFrom') {
        dateRange.from = value;
        continue;
      }
      if (name === 'endDate' || name === 'dateTo') {
        dateRange.to = value;
        continue;
      }
      if (best.params[name] !== undefined) continue; // déjà épinglé identique
      filters.push({ name, value });
    }

    const applied = [];
    for (const f of filters) {
      if (!swFilterIsResolvable(arr, f.name)) continue; // champ invisible → superset
      arr = arr.filter((it) => swItemMatchesFilter(it, f.name, f.value, levelIndex));
      applied.push(f.name);
    }
    if (dateRange.from || dateRange.to) {
      arr = arr.filter((it) => swItemMatchesDateRange(it, dateRange.from, dateRange.to));
      applied.push('dateRange');
    }

    // 6) Pagination (découpage dans la source la plus large disponible)
    const page = parseInt(wanted.page || '1', 10) || 1;
    const limit = parseInt(wanted.limit || '0', 10) || 0;
    const offset = parseInt(wanted.offset || '0', 10) || 0;
    let finalArr = arr;
    if (limit > 0 && (wanted.page !== undefined || wanted.offset !== undefined)) {
      const start = offset > 0 ? offset : (page - 1) * limit;
      finalArr = arr.slice(start, start + limit);
    }

    // 7) Reconstruction de l'enveloppe + totaux
    if (loc.kind === 'root') {
      out = finalArr;
    } else {
      let container = out;
      for (const p of loc.pathToContainer) container = container[p];
      container[loc.arrayKey] = finalArr;
      if (container && typeof container === 'object') {
        if (typeof container.total === 'number') container.total = arr.length;
        if (typeof container.totalPages === 'number' && limit > 0) {
          container.totalPages = Math.max(1, Math.ceil(arr.length / limit));
        }
        if (container.pagination && typeof container.pagination === 'object') {
          if (typeof container.pagination.total === 'number') container.pagination.total = arr.length;
          if (typeof container.pagination.totalItems === 'number') container.pagination.totalItems = arr.length;
        }
      }
    }

    return new Response(JSON.stringify(out), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-AH-Offline': '1',
        'X-AH-Offline-Filtered': applied.length ? applied.join(',') : 'broad-source',
      },
    });
  } catch {
    return null; // non-bloquant → cascade classique
  }
}

/** Lit un en-tête d'une entrée du cache sans consommer le corps. */
async function peekHeader(cache, key, headerName) {
  try {
    const res = await cache.match(key);
    return res ? res.headers.get(headerName) : null;
  } catch {
    return null;
  }
}

/** LRU simple : garde au plus API_CACHE_MAX entrées (ordre d'insertion). */
async function trimApiCache() {
  try {
    const cache = await caches.open(API_CACHE);
    const keys = await cache.keys();
    if (keys.length > API_CACHE_MAX) {
      const excess = keys.slice(0, keys.length - API_CACHE_MAX);
      await Promise.all(excess.map((k) => cache.delete(k)));
    }
  } catch {
    /* non-bloquant */
  }
}

/** ⭐ v3.8.0 — LRU du cache pages PERSISTANT : garde au plus
 *    PAGE_CACHE_MAX entrées (ordre d'insertion ; les routes récemment
 *    écrites sont en fin de liste → les plus anciennes sortent d'abord). */
const PAGE_CACHE_MAX = 500;
async function trimPageCache() {
  try {
    const cache = await caches.open(PAGE_CACHE);
    const keys = await cache.keys();
    if (keys.length > PAGE_CACHE_MAX) {
      const excess = keys.slice(0, keys.length - PAGE_CACHE_MAX);
      await Promise.all(excess.map((k) => cache.delete(k)));
    }
  } catch {
    /* non-bloquant */
  }
}

// ─── Chunks immuables : CacheFirst persistant + retry réseau ────────────
// ⭐ Réseau instable (2G/3G) : le 1er fetch d'un chunk échoue souvent →
//    1 RETRY automatique côté SW AVANT de laisser l'erreur remonter au
//    runtime Next (sinon : « Failed to load chunk ... from module N » →
//    error boundary). Si le réseau rejette 2 fois, l'erreur remonte : le
//    client la gère (rechargement anti-boucle, cf. chunk-recovery.ts).
async function serveImmutable(request) {
  const cached = await caches.match(request, { cacheName: IMMUTABLE_CACHE });
  if (cached) return cached;

  try {
    return await fetchAndCacheImmutable(request);
  } catch (firstError) {
    // Réseau instable → courte pause puis 1 nouvelle tentative
    await new Promise((resolve) => setTimeout(resolve, 400));
    try {
      return await fetchAndCacheImmutable(request);
    } catch (secondError) {
      // Pas de cache + réseau KO : erreur réseau (le client gère la récupération)
      throw secondError;
    }
  }
}

async function fetchAndCacheImmutable(request) {
  const response = await fetch(request);
  if (response && response.status === 200) {
    const clone = response.clone();
    // Pas d'await : ne pas bloquer la réponse sur l'écriture du cache
    caches.open(IMMUTABLE_CACHE).then((cache) => cache.put(request, clone));
  }
  return response;
}

// ─── Handler : navigations /app/* (app shell, jamais de page offline) ─────

/** ⭐ v3.5.0 — Toute route /app/* (y compris modules profonds et sous-onglets).
 *    Retour terrain : « vous avez encore créé une page pour dire qu'il n'y a
 *    pas de connexion » — l'exigence offline-first est explicite : AUCUNE
 *    page « sans connexion » pour l'app, JAMAIS. Quand la route exacte n'est
 *    pas en cache, on sert le SHELL /app pré-caché : l'app React démarre,
 *    l'utilisateur continue à travailler (sidebar → navigation client RSC
 *    cachée), et un script inline recharge la VRAIE route dès que le réseau
 *    revient (ou après réveil du serveur — garde anti-boucle incluse). */
function isAppNavigation(pathname) {
  return pathname === '/app' || pathname === '/app/' || pathname.startsWith('/app/');
}

/** ⭐ v4.18.0 — HELM ENSEIGNANT : routes CONNECTÉES du portail /prof/*.
 *    Même traitement app-shell que /app/* : hors ligne, la route exacte
 *    cachée est servie, sinon le SHELL /prof/dashboard (l'app React démarre,
 *    les données viennent d'IndexedDB — AUCUNE page « sans connexion »).
 *    Les pages marketing (/prof, /prof/login, /prof/register) et le callback
 *    de paiement (/prof/checkout/success) restent des pages publiques
 *    (CACHEABLE_HTML_PATTERNS) ; /prof/checkout (paiement) nécessite le
 *    réseau — il n'est ni shellé ni caché (honnêteté sur l'argent). */
const PROF_CONNECTED_PREFIXES = [
  '/prof/dashboard',
  '/prof/pedagogie',
  '/prof/travaux',
  '/prof/examens',
  '/prof/planification',
  '/prof/parametres',
  '/prof/eleves',
  '/prof/emploi-du-temps',
];
const PROF_SHELL_PATH = '/prof/dashboard';

function isProfConnectedNavigation(pathname) {
  return PROF_CONNECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/'),
  );
}

/** Shell de repli selon le portail : /app (écoles) ou /prof/dashboard (enseignant). */
function shellPathFor(pathname) {
  return isProfConnectedNavigation(pathname) ? PROF_SHELL_PATH : '/app';
}

/** Injecte dans le HTML du shell un script de rechargement de la vraie route
 *  au retour du réseau. Garde anti-boucle : max 2 rechargements auto par URL
 *  et par session onglet (sessionStorage).
 *  ⭐ v4.5.0 (Task 73 — boucle de rechargement production) : le TIMER 20 s
 *  est SUPPRIMÉ. En ligne-lente, il rechargeait la page en boucle (chaque
 *  reload tuait les téléchargements hors-ligne en cours → redémarrage →
 *  saturation réseau → timeout HTML → shell → reload → …) : « l'application
 *  se recharge à nouveau, c'est la boucle et ça ne cesse pas ». On ne
 *  recharge désormais QUE sur l'événement 'online' réel (transition
 *  hors-ligne → en-ligne), jamais sur timer. */
async function shellWithRecoveryScript(shellResponse) {
  try {
    const html = await shellResponse.clone().text();
    const script =
      '<script>(function(){try{' +
      'var k="ah_shell_reload_"+location.pathname;var n=0;' +
      'try{n=Number(sessionStorage.getItem(k)||0)}catch(e){}' +
      'if(n<2){try{sessionStorage.setItem(k,String(n+1))}catch(e){}' +
      'window.addEventListener("online",function(){location.reload()});' +
      '}' +
      '}catch(e){}})();</' + 'script>';
    const patched = html.includes('</body>')
      ? html.replace('</body>', script + '</body>')
      : html + script;
    return new Response(patched, {
      status: shellResponse.status,
      statusText: shellResponse.statusText,
      headers: shellResponse.headers,
    });
  } catch {
    return shellResponse;
  }
}

// ─── ⭐ v4.8.0 — ÉPOCH DE BUILD (détection des déploiements sans bump SW) ──
// Un déploiement Vercel change les hashes des chunks. Si sw.js est inchangé,
// le SW ne se met pas à jour → SW_ACTIVATED ne part pas → le flag 24 h du
// pré-cache client reste « frais » → les chunks du nouveau build ne sont
// jamais pré-cachés → navigation hors ligne vers un module non visité en
// ligne = ChunkLoadError = « Connexion instable ». L'epoch hache l'ensemble
// des URLs de chunks du shell (déterministe par build) : tout changement →
// BUILD_EPOCH_CHANGED → le client relance le pré-cache immédiatement.
const META_CACHE = 'ah-meta';
const BUILD_EPOCH_KEY = '/__ah_build_epoch';

/** Hache l'ensemble des URLs /_next/static/ (js|css) d'un HTML — déterministe par build. */
function computeBuildEpoch(html) {
  try {
    const urls = new Set();
    const re = /(?:src|href)=["']([^"']*\/_next\/static\/[^"']+\.(?:js|css))["']/g;
    let m;
    while ((m = re.exec(html)) !== null) urls.add(m[1]);
    const list = Array.from(urls).sort();
    if (!list.length) return null;
    let h1 = 0x811c9dc5;
    let h2 = 0xdeadbeef;
    const joined = list.join('|');
    for (let i = 0; i < joined.length; i++) {
      h1 = (h1 ^ joined.charCodeAt(i)) >>> 0;
      h1 = (h1 * 0x01000193) >>> 0;
      h2 = (h2 ^ (joined.charCodeAt(i) + i)) >>> 0;
      h2 = (h2 * 0x85ebca6b) >>> 0;
    }
    return `${list.length}-${h1.toString(36)}-${h2.toString(36)}`;
  } catch {
    return null;
  }
}

/** Epoch enregistrée depuis le dernier HTML frais (null si inconnue). */
async function getStoredBuildEpoch() {
  try {
    const cache = await caches.open(META_CACHE);
    const res = await cache.match(BUILD_EPOCH_KEY);
    return res ? (await res.text()) : null;
  } catch {
    return null;
  }
}

/** Enregistre l'epoch du build courant ; si elle a CHANGÉ (déploiement Vercel
 *  sans bump de sw.js), diffuse BUILD_EPOCH_CHANGED aux fenêtres ouvertes. */
async function trackBuildEpochFromHtml(html) {
  try {
    const epoch = computeBuildEpoch(html);
    if (!epoch) return;
    const prev = await getStoredBuildEpoch();
    if (prev === epoch) return;
    const cache = await caches.open(META_CACHE);
    await cache.put(BUILD_EPOCH_KEY, new Response(epoch));
    if (prev !== null) {
      console.log(`[SW] Build changé (epoch ${prev} → ${epoch}) — re-pré-cache demandé aux clients`);
      swBroadcast({ type: 'BUILD_EPOCH_CHANGED', epoch, previous: prev });
    }
  } catch {
    /* non-bloquant */
  }
}

async function handleAppShellNavigation(request) {
  const cache = await caches.open(PAGE_CACHE);
  const url = new URL(request.url);
  // ⭐ v4.18.0 — shell selon le portail : /app (écoles) ou /prof/dashboard
  //    (portail enseignant autonome — même garantie « jamais de page
  //    connexion indisponible » que /app/*).
  const shellPath = shellPathFor(url.pathname);
  const isShellRoute = url.pathname === shellPath || url.pathname === shellPath + '/';

  // ⭐ ÉTAPE 1 : hors ligne (navigator.onLine === false) → cache immédiat
  //    (zéro latence — pas de timeout inutile, pas de page blanche)
  if (!self.navigator || self.navigator.onLine === false) {
    // ⭐ v3.4.0 — cascade exact → ignoreSearch (liens ?tenant=…)
    const cachedExact = await matchRouteCache(cache, request);
    if (cachedExact) return cachedExact;
    // ⭐ v3.5.0 — shell pour TOUTE route /app/* (ou /prof/* connectée) non
    //    cachée : l'app démarre depuis le cache, l'utilisateur continue à
    //    travailler (JAMAIS de page « connexion indisponible » pour l'app).
    const cachedShell = await matchRouteCache(cache, shellPath);
    if (cachedShell) {
      return isShellRoute ? cachedShell : shellWithRecoveryScript(cachedShell);
    }
  }

  // ⭐ ÉTAPE 2 : en ligne (ou détection navigateur incertaine) → réseau avec
  //    timeout, cache write, puis fallback shell SANS page « hors ligne ».
  try {
    const networkResponse = await fetchWithTimeout(request, HTML_TIMEOUT);
    if (networkResponse && networkResponse.ok && !networkResponse.redirected) {
      // ⭐ v3.4.0 — copie SANS Vary (fire-and-forget : la réponse est rendue
      //    à la page immédiatement, la copie se fait en arrière-plan).
      //    ⚠️ PAS de cache des réponses REDIRIGÉES (session expirée → le
      //    middleware renvoie la page login : l'embarquer sous la clé du
      //    module empoisonnerait le cache offline).
      //    ⭐ v4.6.0 — SHELL PROPRE : pour la route shell EXACTE (/app ou
      //    /prof/dashboard), on écrit AUSSI la clé SANS query — c'est celle
      //    que le fallback shell (matchRouteCache(shellPath)) consulte hors
      //    ligne. Avant, seule la clé avec ?tenant=… était écrite → le
      //    fallback tombait sur l'entrée du pré-cache d'install
      //    (potentiellement empoisonnée par le HTML de login de l'ancien
      //    cache.add).
      toCacheableCopy(networkResponse)
        .then((copy) => {
          const writes = [cache.put(request, copy)];
          if (isShellRoute) {
            writes.push(cache.put(new Request(url.origin + shellPath), copy.clone()));
            // ⭐ v4.8.0 — ÉPOCH DE BUILD : le shell frais vient d'être
            //    servi en ligne → on hache son ensemble de chunks ; si le build
            //    a changé depuis le dernier pré-cache (déploiement Vercel sans
            //    bump de sw.js), on diffuse BUILD_EPOCH_CHANGED → le client
            //    relance le pré-cache complet (referme le trou « Connexion
            //    instable » à la navigation hors ligne inter-modules).
            copy
              .clone()
              .text()
              .then((html) => trackBuildEpochFromHtml(html))
              .catch(() => {});
          }
          return Promise.all(writes);
        })
        .catch(() => {});
      return networkResponse;
    }
    throw new Error('Network response not ok');
  } catch {
    // Réseau échoué/timeout (Wifi sans Internet, Neon qui se réveille…)
    // → cache exact de la route si déjà visitée
    // ⭐ v3.4.0 — cascade exact → ignoreSearch (liens ?tenant=…)
    const cachedExact = await matchRouteCache(cache, request);
    if (cachedExact) return cachedExact;
    // ⭐ v3.5.0 — shell pour TOUTE route /app/* (ou /prof/* connectée — cf.
    //    ÉTAPE 1) : l'app reste utilisable + rechargement auto de la vraie
    //    route quand le serveur répond à nouveau.
    const cachedShell = await matchRouteCache(cache, shellPath);
    if (cachedShell) {
      return isShellRoute ? cachedShell : shellWithRecoveryScript(cachedShell);
    }
    // Dernier recours ABSOLU (shell pas encore pré-caché, ex. SW fraîchement
    // installé offline) : redirection immédiate vers le shell du portail —
    // il y sera servi depuis le pré-cache d'installation (PRECACHE_URLS
    // inclut /app et /prof/dashboard).
    // Si même le shell échoue, offlineMinimalResponse prendra le relai.
    if (
      (isAppNavigation(url.pathname) || isProfConnectedNavigation(url.pathname)) &&
      !isShellRoute
    ) {
      return Response.redirect(new URL(shellPath, url.origin).toString(), 302);
    }
    return offlineMinimalResponse(url.pathname);
  }
}

// ─── Handler : navigations publiques (cache + shell, jamais de page offline) ─
//    ⭐ 2026-10-14 — RÉSILIENCE CONNEXION INSTABLE :
//    Avant : timeout réseau 4s → si échec → cache exact → offlineMinimalResponse.
//    Problème : sur connexion instable (Wifi faible, 3G, roaming), 4s n'est
//    pas suffisant → l'utilisateur voit la page "Connexion indisponible" alors
//    qu'il est ENCORE en ligne (juste lent).
//    Désormais : timeout porté à 10s, + 1 retry à 15s, + fallback au parent
//    (ex: /school-portal/portal → /school-portal) avant offlineMinimalResponse.
//    Si /school-portal est dans PRECACHE_URLS, l'utilisateur ne verra JAMAIS
//    la page offline pour les pages publiques — il verra la page parent
//    pré-cachée avec un script de rechargement automatique.
async function handlePublicPageNavigation(request) {
  const cache = await caches.open(PAGE_CACHE);
  const url = new URL(request.url);

  if (!self.navigator || self.navigator.onLine === false) {
    // ⭐ v3.4.0 — cascade exact → ignoreSearch : /login?portal=school&tenant=x
    //    matche désormais l'entrée pré-cachée /login (start_url PWA).
    const cachedExact = await matchRouteCache(cache, request);
    if (cachedExact) return cachedExact;
    // ⭐ 2026-10-14 — Fallback au parent (ex: /school-portal/portal → /school-portal)
    //    avant de servir offlineMinimalResponse. Le parent est dans PRECACHE_URLS.
    const parentPath = url.pathname.split('/').slice(0, -1).join('/') || '/';
    const cachedParent = await matchRouteCache(cache, parentPath);
    if (cachedParent) return shellWithRecoveryScript(cachedParent);
    // ⭐ v3.2.0 : plus de shell /login|/app pour une page publique non visitée
    //    (rendre la page de connexion sous /tarification est trompeur) →
    //    réponse sobre non-bloquante.
    return offlineMinimalResponse(url.pathname);
  }

  // ⭐ 2026-10-14 — Timeout 10s (au lieu de 4s) + 1 retry à 15s.
  //    Sur connexion instable, 4s est trop court — le serveur répond
  //    mais lentement (Neon cold start, 3G, Wifi faible).
  try {
    let networkResponse = await fetchWithTimeout(request, 10000);
    if (networkResponse && networkResponse.ok && !networkResponse.redirected) {
      // ⭐ v3.4.0 — copie SANS Vary (fire-and-forget)
      toCacheableCopy(networkResponse)
        .then((copy) => cache.put(request, copy))
        .catch(() => {});
      return networkResponse;
    }
    // Réponse non-OK (ex: 500, 502) → on retry une fois
    if (networkResponse && !networkResponse.ok) {
      throw new Error('Network response not ok: ' + networkResponse.status);
    }
    throw new Error('Network response not ok');
  } catch (firstErr) {
    // ⭐ 2026-10-14 — 1 retry à 15s (connexion instable : le premier fetch
    //    peut timeout, le second réussit).
    try {
      const retryResponse = await fetchWithTimeout(request, 15000);
      if (retryResponse && retryResponse.ok && !retryResponse.redirected) {
        toCacheableCopy(retryResponse)
          .then((copy) => cache.put(request, copy))
          .catch(() => {});
        return retryResponse;
      }
      throw new Error('Retry failed');
    } catch {
      // ⭐ v3.4.0 — cascade exact → ignoreSearch (login/portal avec ?tenant=)
      const cachedExact = await matchRouteCache(cache, request);
      if (cachedExact) return cachedExact;
      // ⭐ 2026-10-14 — Fallback au parent avant offlineMinimalResponse.
      const parentPath = url.pathname.split('/').slice(0, -1).join('/') || '/';
      const cachedParent = await matchRouteCache(cache, parentPath);
      if (cachedParent) return shellWithRecoveryScript(cachedParent);
      return offlineMinimalResponse(url.pathname);
    }
  }
}

// ⭐ Réponse minimale de dernier recours — volontairement sobre (pas de
//    layout complet) MAIS auto-récupérable (v3.4.0) : elle n'est servie que
//    lorsqu'aucune copie locale n'existe (cas ultra-marginal : module jamais
//    pré-caché + navigateur hors ligne). Un script inline recharge la page
//    dès le retour du réseau (« online ») — l'utilisateur n'a plus besoin
//    de recharger manuellement après sa reconnexion.
function offlineMinimalResponse(pathname) {
  const safePath = String(pathname).replace(/[<>&"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
  const body = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Academia Helm — hors ligne</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    background:#0A2A5E; color:#e8eefc; }
  .card { max-width: 520px; padding: 32px 28px; text-align:center; }
  .logo { font-size: 20px; font-weight: 700; letter-spacing: .5px; color:#F2C94C; margin-bottom: 18px; }
  p { line-height: 1.6; font-size: 15px; color:#c7d5f2; margin:0; }
  .path { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color:#fff; }
  button { margin-top: 22px; padding: 12px 26px; border:0; border-radius: 10px;
    background:#F2C94C; color:#0A2A5E; font-weight:600; font-size:15px; cursor:pointer; }
  .hint { margin-top:14px; font-size:12px; color:#8fa8d8; }
</style>
</head>
<body>
  <div class="card">
    <div class="logo">ACADEMIA HELM</div>
    <p>Connexion indisponible pour <span class="path">${safePath}</span>.<br>
    Reconnectez-vous puis rechargez la page&nbsp;: vos données locales restent intactes.</p>
    <button onclick="window.location.reload()">Réessayer</button>
    <div class="hint">Cette page se rechargera automatiquement au retour du réseau.</div>
  </div>
  <script>
    window.addEventListener('online', function () { window.location.reload(); });
  </script>
</body>
</html>`;
  return new Response(body, {
    status: 503,
    statusText: 'Offline',
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// ─── Helpers réseau ───────────────────────────────────────────────────────
function fetchWithTimeout(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error('Timeout'));
    }, timeoutMs);

    fetch(request, { signal: controller.signal })
      .then((response) => {
        clearTimeout(timeoutId);
        resolve(response);
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        reject(err);
      });
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   V4.0 — INTERCEPTION RÉSEAU PAR LE SERVICE WORKER
   Spec « Correction d'architecture — Interception réseau (Service Worker) »
   ══════════════════════════════════════════════════════════════════════════

   PRINCIPE : les composants appellent fetch('/api/…') exactement comme
   avant — AUCUN code applicatif n'est modifié pour la donnée. Le SW se place
   entre chaque fetch et le réseau et décide, de façon CENTRALISÉE :

   LECTURES (GET — cf. handleApiGet ci-dessus) :
     réseau (timeout) → succès : réponse réelle + mise à jour IndexedDB ;
     échec/timeout : cascade cache Cache API → response_cache IDB → stores
     d'entités, avec réponse JSON FABRIQUÉE au format de l'API réelle.

   ÉCRITURES (POST/PUT/PATCH/DELETE — handleApiMutation) :
     réseau d'abord → réponse réelle passée telle quelle ;
     échec réseau → file de mutations IndexedDB (outbox_events) +
     Background Sync + réponse fabriquée (200 + X-Sync-Status: pending).

   ══════════════════════════════════════════════════════════════════════
   §3 — MAPPING CENTRALISÉ ROUTE → TABLE LOCALE
   ══════════════════════════════════════════════════════════════════════
   Un seul point de configuration : chaque route API → sa table (object
   store) IndexedDB. Toute évolution future de la portée hors ligne (ajout
   d'un module) se fait en AJOUTANT UNE LIGNE ICI — jamais dans les
   composants. Miroir de src/lib/offline/store-names.ts (URL_TO_STORE),
   les stores sont créés par local-db.service.ts (DB 'academia-helm-local').
   Le premier match gagne ; '/api/.*' non mappé → 'api_cache' générique. */
const ROUTE_TABLES = [
  // ─── Élèves & Scolarité ───
  // ⭐ 2026-10-14 — FIX routing mismatches :
  //    1. `/api/students/enrollments` → `studentenrollment` (was `student`)
  //    2. `/api/students/class-transfers-history` → `classtransfer` (was `student`)
  //    3. `/api/students/movement-history` → `studentmovement` (was `student`)
  //    4. `/api/students/orion/student/:id/alerts` → `orion_alerts` (was `student`)
  //    5. `/api/students/:id/audit` → `studentauditlog` (was `student`)
  //    6. `/api/students/:id/academic-dossier` → `studentacademicrecord` (was `student`)
  //    7. `/api/students/admissions/:id/documents` → `admissiondocument` (was `admission`)
  //    8. `/api/students/admissions/:id/interviews` → `admissioninterview` (was `admission`)
  //    9. `/api/students/id-cards/templates` → `carddesigntemplate` (was `studentidcard`)
  //    10. `/api/students/transfers/search-schools` → `api_cache` (was `studenttransfer`)
  //    11. `/api/students/transfers/:id/dossier` → `api_cache` (was `studenttransfer`)
  // These specific routes MUST come BEFORE the generic `/api/students` route
  // because ROUTE_TABLES is evaluated first-match-wins.
  [/^\/api\/students\/enrollments/, 'studentenrollment'],
  [/^\/api\/students\/class-transfers-history/, 'classtransfer'],
  [/^\/api\/students\/movement-history/, 'studentmovement'],
  [/^\/api\/students\/orion\//, 'orion_alerts'],
  [/^\/api\/students\/[^/]+\/audit/, 'studentauditlog'],
  [/^\/api\/students\/[^/]+\/academic-dossier/, 'studentacademicrecord'],
  [/^\/api\/students\/admissions\/[^/]+\/documents/, 'admissiondocument'],
  [/^\/api\/students\/admissions\/documents\//, 'admissiondocument'],
  [/^\/api\/students\/admissions\/[^/]+\/interviews/, 'admissioninterview'],
  [/^\/api\/students\/admissions\/interviews\//, 'admissioninterview'],
  [/^\/api\/students\/id-cards\/templates/, 'carddesigntemplate'],
  [/^\/api\/students\/transfers\/search-schools/, 'api_cache'],
  [/^\/api\/students\/transfers\/[^/]+\/dossier/, 'api_cache'],
  // Original student routes (after specific sub-routes)
  [/^\/api\/students(\/|$)/, 'student', /\/(statistics|stats|transfers|documents|id-cards|admissions|movements|abandons|guardians|photo|enrollments|class-transfers-history|movement-history|orion|audit|academic-dossier)(\/|$)/],
  [/^\/api\/students\/.*\/guardians/, 'guardian'],
  [/^\/api\/all-classes/, 'class'],
  [/^\/api\/classes/, 'class'],
  [/^\/api\/academic-classes/, 'academicclass'],
  [/^\/api\/class-students/, 'classstudent'],
  [/^\/api\/class-subjects/, 'classsubject'],
  [/^\/api\/subjects/, 'subject'],
  [/^\/api\/school-levels/, 'schoollevel'],
  [/^\/api\/education-series/, 'academicseries'],
  [/^\/api\/attendance/, 'attendance'],
  [/^\/api\/absences/, 'absence'],
  [/^\/api\/disciplinary/, 'disciplinaryincident'],
  [/^\/api\/incidents/, 'incident'],
  // ⭐ 2026-10-14 — AUDIT SHELLS/RÔLES : routes Discipline/Surveillant/Censeur/Parent manquantes
  //    ajoutées pour couvrir les UI spécifiques par rôle. Avant : tombaient
  //    dans le fallback 'api_cache' générique → pas d'écriture optimiste
  //    offline (création d'une règle de conduite, sanction, visite de
  //    classe, examen de fraude, conseil de classe, etc. n'apparaissaient
  //    pas dans la liste jusqu'à la reconnexion).
  //    /api/discipline/* (discipline-prisma.controller — CRUD incidents)
  [/^\/api\/discipline\/conduct\/rules/, 'conductrule'],
  [/^\/api\/discipline\/conduct\/sanctions/, 'sanction'],
  [/^\/api\/discipline\/conduct\/settings/, 'conductsetting'],
  [/^\/api\/discipline\/conduct\/ledger/, 'conductledger'],
  [/^\/api\/discipline\/conduct\/students-batch/, 'api_cache'],
  [/^\/api\/discipline\/conduct\/student/, 'conductledger'],
  [/^\/api\/discipline\/conduct/, 'conductledger'],
  [/^\/api\/discipline/, 'disciplinaryincident'],
  //    /api/censeur/* (BFF Next.js → aggregate backend endpoints)
  [/^\/api\/censeur\/councils/, 'classcouncil'],
  [/^\/api\/censeur\/visits/, 'api_cache'],
  [/^\/api\/censeur\/exams/, 'examfraud'],
  [/^\/api\/censeur/, 'api_cache'],
  //    /api/parent/* (parent-portal.controller — agrégats read-only pour
  //    dashboard parent : children, payments, attendance, grades, results,
  //    today, weeks, cahier-journal, homeworks, national-exams, finance)
  [/^\/api\/parent\//, 'api_cache'],
  //    /api/chat/* (communication/chat.controller — Helm Connect messenger :
  //    conversations, messages, channels, availability, calls, files,
  //    announcements, invitations, blocks, profile, presence, reactions)
  //    Store 'chat' créé dans local-db.service.ts (V17 list).
  [/^\/api\/chat\//, 'chat'],
  // ⭐ 2026-10-15 — AUDIT MODULES RESTANTS : routes manquantes ajoutées
  //    pour Helm Connect (communication email/WhatsApp), Patronat (federis),
  //    Site institutionnel (public), Admissions (public pre-enrollment).
  //    /api/communication/* (templates, email-logs, whatsapp-logs, inbound-emails)
  [/^\/api\/communication\//, 'api_cache'],
  //    /api/federis/* (patronat portal — controllers federis/*)
  //    Read-only pour le frontend (grades, exams, schools, candidats) → api_cache.
  [/^\/api\/federis\//, 'api_cache'],
  //    /api/public/admission/submit (public admission form submission)
  [/^\/api\/public\/admission\//, 'api_cache'],
  //    /api/public/pre-enrollment/* (public pre-enrollment)
  [/^\/api\/public\/pre-enrollment\//, 'api_cache'],
  //    /api/admission-settings (tenant-website/admission-settings.controller)
  //    Configurations admission (steps + documents) — settings read/write
  [/^\/api\/admission-settings/, 'api_cache'],
  //    /api/tenant-website/* (public + admin tenant website settings)
  [/^\/api\/tenant-website\/public/, 'api_cache'],
  [/^\/api\/tenant-website/, 'api_cache'],
  [/^\/api\/homeworks/, 'homework'],
  [/^\/api\/homework-entries/, 'homeworkentry'],
  [/^\/api\/students\/transfers/, 'studenttransfer'],
  [/^\/api\/students\/documents/, 'studentdocument'],
  [/^\/api\/students\/id-cards/, 'studentidcard'],
  [/^\/api\/students\/admissions/, 'admission'],
  [/^\/api\/students\/movements/, 'studentmovement'],

  // ─── Personnel, RH & Paie ───
  // ⭐ 2026-10-14 — AUDIT RH/PERSONNEL : 11 routes manquantes ajoutées pour
  //    couvrir TOUS les controllers du module RH. Avant : tombaient dans
  //    le fallback 'api_cache' générique → pas d'écriture optimiste
  //    offline (création d'un job, candidature, entretien, test, stagiaire,
  //    déclaration CNSS, déclaration fiscale, nœud d'organigramme, planning,
  //    etc. n'apparaissaient pas dans la liste jusqu'à la reconnexion).
  //    Maintenant : chaque route résout vers le store IDB métier correct
  //    (déjà créé dans local-db.service.ts ou v20HrStores).
  //    Ordre IMPORTANT : /hr/staff/recruit doit rester exclue du catch-all
  //    staff pour ne pas capturer les candidats comme staff.
  [/^\/api\/hr\/staff/, 'staff', /recruit/],
  [/^\/api\/hr\/teachers/, 'teacher'],
  [/^\/api\/teachers/, 'teacher'],
  [/^\/api\/hr\/contracts/, 'contract'],
  [/^\/api\/hr\/contracts-public/, 'contract'],
  [/^\/api\/hr\/leaves/, 'leaverequest'],
  [/^\/api\/hr\/allowances/, 'staffallowance'],
  [/^\/api\/hr\/overtime/, 'overtimerecord'],
  [/^\/api\/hr\/attendance/, 'staffattendance'],
  [/^\/api\/hr\/evaluations/, 'staffevaluation'],
  [/^\/api\/hr\/documents/, 'staffdocument'],
  [/^\/api\/hr\/school-directors/, 'schooldirectors'],
  [/^\/api\/hr\/payroll\/documents/, 'api_cache'],
  [/^\/api\/hr\/payroll/, 'salaryslip'],
  [/^\/api\/hr\/salary-payments/, 'salarypayment'],
  [/^\/api\/hr\/positions/, 'position'],
  [/^\/api\/hr\/collaborators/, 'staff'],
  [/^\/api\/hr\/planning/, 'staffplanning'],
  // ⭐ /api/hr/internships — internships.controller.ts (HrInternship + convention)
  [/^\/api\/hr\/internships/, 'hrinternship'],
  // ⭐ /api/hr/recruitment — recruitment.controller.ts (jobs, candidates, applications,
  //    interviews, tests, talent-pool, recruiter-profile) — plusieurs stores métiers.
  //    Mapping par sous-chemins pour optimiser l'écriture optimiste :
  [/^\/api\/hr\/recruitment\/jobs/, 'hrjob'],
  [/^\/api\/hr\/recruitment\/candidates/, 'hrcandidate'],
  [/^\/api\/hr\/recruitment\/applications/, 'hrapplication'],
  [/^\/api\/hr\/recruitment\/interviews/, 'hrinterview'],
  [/^\/api\/hr\/recruitment\/tests/, 'hrtest'],
  [/^\/api\/hr\/recruitment\/test-results/, 'hrtestresult'],
  [/^\/api\/hr\/recruitment\/talent-pool/, 'hrtalentpool'],
  [/^\/api\/hr\/recruitment\/recruiter-profile/, 'recruiterprofile'],
  [/^\/api\/hr\/recruitment\/document-upload/, 'api_cache'],
  // /api/hr/recruitment (catch-all — e.g. upload-apply, debug endpoints)
  [/^\/api\/hr\/recruitment/, 'api_cache'],
  // ⭐ /api/hr/organigram — organigram-prisma.controller.ts (nodes, stats)
  [/^\/api\/hr\/organigram/, 'organigramnode'],
  // ⭐ /api/hr/cnss — cnss-prisma.controller.ts (declarations, employees, rates, export)
  [/^\/api\/hr\/cnss/, 'cnssdeclaration'],
  // ⭐ /api/hr/taxes — taxes.controller.ts (déclarations fiscales AIB/IST/IRPP/VPS,
  //    staff-fiscal, financial-statements, financial-notes, payroll generate)
  [/^\/api\/hr\/taxes/, 'taxdeclaration'],
  // ⭐ /api/hr/schedules — schedules-prisma.controller.ts (planning hebdomadaire staff)
  [/^\/api\/hr\/schedules/, 'staffschedule'],
  // ⭐ /api/hr/ia — ia-prisma.controller.ts (LLM RH features — pas d'entité à cacher)
  [/^\/api\/hr\/ia/, 'api_cache'],
  // ⭐ /api/hr/overview — hr-overview.controller.ts (dashboard KPIs — read-only)
  [/^\/api\/hr\/overview/, 'api_cache'],
  // ⭐ /api/hr/cleanup — cleanup.controller.ts (maintenance scripts — read-only)
  [/^\/api\/hr\/cleanup/, 'api_cache'],
  // ⭐ /api/staff-card — staff-card.controller.ts (génération de cartes PDF — read-only)
  [/^\/api\/staff-card/, 'api_cache'],
  // ⭐ /api/documents-public — document-upload.controller.ts (public documents — read-only)
  [/^\/api\/documents-public/, 'api_cache'],
  // ⭐ /api/tests-public — test-questionnaire.controller.ts (public tests — read-only)
  [/^\/api\/tests-public/, 'api_cache'],

  // ─── Finances & Économat ───
  // ⭐ 2026-10-14 — AUDIT FINANCE : 25 routes manquantes ajoutées pour couvrir
  //    TOUS les controllers du module Finance. Avant : tombaient dans le
  //    fallback 'api_cache' générique → pas d'écriture optimiste offline
  //    (création d'un encaissement, d'une dépense, d'un frais, d'une caisse,
  //    d'une promesse de paiement, etc. n'apparaissaient pas dans la liste
  //    jusqu'à la reconnexion). Maintenant : chaque route résout vers le
  //    store IDB métier correct (déjà créé dans local-db.service.ts).
  //    Ordre IMPORTANT : les routes SPÉCIFIQUES (sous-chemins) doivent venir
  //    AVANT les routes GÉNÉRIQUES (préfixe seul), car ROUTE_TABLES est
  //    first-match-wins.
  [/^\/api\/finance\/fee-structures\/overrides/, 'feeoverride'],
  [/^\/api\/finance\/fee-structures/, 'feestructure'],
  [/^\/api\/finance\/fee-configurations/, 'feeconfiguration'],
  [/^\/api\/finance\/fee-definitions/, 'feedefinition'],
  [/^\/api\/finance\/fee-regimes/, 'feeregime'],
  // ⭐ /api/finance/fees/* — fees-prisma.controller.ts (categories, definitions, student-fees)
  [/^\/api\/finance\/fees\/categories/, 'feecategory'],
  [/^\/api\/finance\/fees\/definitions/, 'feedefinition'],
  [/^\/api\/finance\/fees\/student-fees/, 'feedefinition'],
  [/^\/api\/finance\/fees/, 'feedefinition'],
  // ⭐ /api/fees/installments — fee-installment.controller.ts (different prefix!)
  [/^\/api\/fees\/installments/, 'feeinstallment'],
  [/^\/api\/finance\/payments/, 'payment'],
  [/^\/api\/finance\/invoices/, 'invoice'],
  [/^\/api\/finance\/expenses/, 'financeexpense'],
  [/^\/api\/finance\/transactions/, 'financetransaction'],
  // ⭐ /api/finance/accounts (student-account.controller.ts) ET legacy /api/finance/student-accounts (BFF proxy)
  [/^\/api\/finance\/accounts/, 'studentaccount'],
  [/^\/api\/finance\/student-accounts/, 'studentaccount'],
  [/^\/api\/finance\/treasury/, 'treasurymovement'],
  // ⭐ /api/finance/daily-closures (finance-daily-closure.controller.ts — legacy direct path)
  [/^\/api\/finance\/daily-closures/, 'dailyclosure'],
  [/^\/api\/finance\/tuition-installments/, 'tuitioninstallment'],
  [/^\/api\/finance\/tuition-payments/, 'tuitionpayment'],
  [/^\/api\/finance\/payment-plans/, 'paymentplan'],
  [/^\/api\/finance\/cash-registers/, 'cashregister'],
  // ⭐ /api/finance/collection/* — collection-prisma.controller.ts (arrears, reminders, promises, actions, cases)
  [/^\/api\/finance\/collection\/promises/, 'paymentpromise'],
  [/^\/api\/finance\/collection\/actions/, 'collectionaction'],
  [/^\/api\/finance\/collection\/arrears/, 'feearrear'],
  [/^\/api\/finance\/collection\/reminders/, 'collectionreminder'],
  [/^\/api\/finance\/collection\/cases/, 'collectioncase'],
  [/^\/api\/finance\/collection/, 'collectioncase'],
  // ⭐ /api/finance/collection-summary — aggregate (Bilan des encaissements)
  [/^\/api\/finance\/collection-summary/, 'api_cache'],
  [/^\/api\/finance\/collection-cases/, 'collectioncase'],
  [/^\/api\/finance\/collection-reminders/, 'collectionreminder'],
  // ⭐ /api/finance/recovery-reminders — recovery-reminder.controller.ts (manual, run-nightly, notify)
  [/^\/api\/finance\/recovery-reminders/, 'collectionreminder'],
  // ⭐ /api/finance/student-fee-profiles — student-fee-profile.controller.ts
  [/^\/api\/finance\/student-fee-profiles/, 'studentfeeprofile'],
  // ⭐ /api/finance/student-arrears — student-arrear.controller.ts
  [/^\/api\/finance\/student-arrears/, 'studentarrear'],
  // ⭐ /api/finance/arrears-import — import endpoints (preview/run/template — pas d'entité à cacher)
  [/^\/api\/finance\/arrears-import/, 'api_cache'],
  // ⭐ /api/finance/payment-config — tenant-payment-config.controller.ts
  [/^\/api\/finance\/payment-config/, 'tenantpaymentconfig'],
  // ⭐ /api/payments/allocation — payment-allocation.controller.ts (different prefix!)
  [/^\/api\/payments\/allocation/, 'paymentallocation'],
  // ⭐ /api/payments/enhanced — payments-enhanced.controller.ts (different prefix!)
  [/^\/api\/payments\/enhanced/, 'payment'],
  // ⭐ /api/payments — legacy payments.controller.ts (different prefix!)
  [/^\/api\/payments(\/|$)/, 'payment'],
  // ⭐ /api/expenses — legacy expenses.controller.ts (different prefix!)
  [/^\/api\/expenses(\/|$)/, 'financeexpense'],
  // ⭐ /api/finance/arrears — already mapped above via collection/arrears, keep general arrears path
  [/^\/api\/finance\/arrears/, 'feearrear'],
  // ⭐ /api/receipts — receipt-generation.controller.ts (server-side receipt PDF generation)
  //    Pas d'entité à cacher (le reçu est généré côté serveur après un paiement).
  [/^\/api\/receipts\/notifications/, 'api_cache'],
  [/^\/api\/receipts(\/|$)/, 'api_cache'],
  // ⭐ Routes READ-ONLY ou agrégats → api_cache ou orion_cache (pas d'écriture optimiste)
  [/^\/api\/finance\/reports/, 'api_cache'],
  [/^\/api\/finance\/settings/, 'api_cache'],
  [/^\/api\/finance\/audit/, 'api_cache'],
  [/^\/api\/finance\/orion/, 'orion_cache'],
  [/^\/api\/finance\/exports/, 'api_cache'],
  [/^\/api\/finance\/promoter-eligibility/, 'api_cache'],
  [/^\/api\/finance\/expenses-v2/, 'api_cache'],
  [/^\/api\/payment-flows(\/|$)/, 'api_cache'],
  [/^\/api\/finances(\/|$)/, 'api_cache'],

  // ─── Organisation pédagogique ───
  // ⭐ 2026-10-14 — AUDIT PEDAGOGIE : 13 routes manquantes ajoutées pour
  //    couvrir TOUS les controllers du module Pédagogie. Avant : tombaient
  //    dans le fallback 'api_cache' générique → pas d'écriture optimiste
  //    offline (création d'un plan annuel, plan mensuel, retour de matériel,
  //    notification enseignant, tâche pédagogique, mouvement de stock,
  //    etc. n'apparaissaient pas dans la liste jusqu'à la reconnexion).
  //    Maintenant : chaque route résout vers le store IDB métier correct
  //    (déjà créé dans local-db.service.ts ou V18PedagogyStores).
  [/^\/api\/pedagogy\/teacher-profiles/, 'teacheracademicprofile'],
  [/^\/api\/pedagogy\/teacher-availabilities/, 'teacheravailability'],
  [/^\/api\/pedagogy\/teacher-class-assignments/, 'teacherclassassignment'],
  [/^\/api\/pedagogy\/academic-structure/, 'academicclass'],
  [/^\/api\/pedagogy-space\/my-classes/, 'teacherclassassignment'],
  // ⭐ v4.7.0 — Miroir EXACT de store-names.ts applicatif (pattern
  //    /\/api\/pedagogy-space\// → 'pedagogicalworkspace'). AVANT : seule
  //    my-classes était mappée → fiches / cahier-journal / lecture-vitesse
  //    tombaient dans le fallback 'api_cache' GÉNÉRIQUE → quand une
  //    sauvegarde de fiche était mise en file (réseau mobile instable),
  //    AUCUNE entité optimiste n'était écrite (swQueueMutation ignore
  //    api_cache) → les listes servies hors ligne ne fusionnaient JAMAIS
  //    la fiche en attente → l'enseignant croyait sa sauvegarde disparue.
  //    Avec ce mapping : écriture optimiste + fusion (swMergePendingEntities)
  //    + fallback par stores pour les variantes de params jamais visitées.
  [/^\/api\/pedagogy-space\//, 'pedagogicalworkspace'],
  [/^\/api\/class-diaries/, 'classdiary'],
  [/^\/api\/lesson-plans/, 'lessonplan'],
  [/^\/api\/lesson-journals/, 'lessonjournal'],
  [/^\/api\/pedagogical-files/, 'pedagogicalfile'],
  [/^\/api\/timetables/, 'timetable'],
  // ⭐ /api/pedagogy/materials — keep existing mapping (matériel pédagogique)
  [/^\/api\/pedagogy\/materials/, 'pedagogicalmaterial'],
  // ⭐ /api/pedagogy/pedagogical-materials — pedagogical-materials-prisma.controller.ts (different path)
  [/^\/api\/pedagogy\/pedagogical-materials/, 'pedagogicalmaterial'],
  // ⭐ /api/pedagogy/material-stocks — material-stocks-prisma.controller.ts
  [/^\/api\/pedagogy\/material-stocks/, 'materialstock'],
  // ⭐ /api/pedagogy/material-movements — material-movements-prisma.controller.ts
  [/^\/api\/pedagogy\/material-movements/, 'materialmovement'],
  // ⭐ /api/pedagogy/material-returns — material-returns.controller.ts
  [/^\/api\/pedagogy\/material-returns/, 'materialreturn'],
  // ⭐ /api/pedagogy/teacher-material-assignments — teacher-material-assignments-prisma.controller.ts
  [/^\/api\/pedagogy\/teacher-material-assignments/, 'teachermaterialassignment'],
  // ⭐ /api/pedagogy/annual-plans — annual-plan.controller.ts
  [/^\/api\/pedagogy\/annual-plans/, 'annualplan'],
  // ⭐ /api/pedagogy/annual-teacher-supplies — annual-teacher-supplies-prisma.controller.ts
  [/^\/api\/pedagogy\/annual-teacher-supplies/, 'annualteachersupply'],
  // ⭐ /api/pedagogy/monthly-plans — monthly-plan.controller.ts
  [/^\/api\/pedagogy\/monthly-plans/, 'monthlyplan'],
  // ⭐ /api/pedagogy/assignments — pedagogical tasks (assignments.controller)
  [/^\/api\/pedagogy\/assignments/, 'pedagogicaltask'],
  // ⭐ /api/pedagogy/teacher-notifications — pedagogy-notification.controller.ts
  [/^\/api\/pedagogy\/teacher-notifications/, 'pedagogicalnotification'],
  // ⭐ /api/pedagogy/global-library — global-library-prisma.controller.ts
  [/^\/api\/pedagogy\/global-library/, 'globalpedagogicalresource'],
  // ⭐ /api/pedagogy/director — pedagogical-director.controller.ts (validation direction)
  [/^\/api\/pedagogy\/director/, 'pedagogicalcontrol'],
  // ⭐ /api/timetable-engine — timetable-engine.controller.ts (different prefix!)
  [/^\/api\/timetable-engine/, 'timetable'],
  // ⭐ /api/rooms — rooms-prisma.controller.ts (different prefix!)
  [/^\/api\/rooms(\/|$)/, 'room'],
  // ⭐ /api/saisiemaster — saisiemaster.controller.ts (saisie rapide de notes, LLM-assisted)
  //    Pas d'entité à cacher (génération de contenu IA, agrégat read-only).
  [/^\/api\/saisiemaster(\/|$)/, 'api_cache'],
  // ⭐ /api/pedagogy/ia — ia-prisma.controller.ts (LLM features — pas d'entité à cacher)
  [/^\/api\/pedagogy\/ia(\/|$)/, 'api_cache'],
  // ⭐ /api/pedagogy/orion-advanced — orion-pedagogy-advanced.controller.ts (agrégats Orion)
  [/^\/api\/pedagogy\/orion-advanced/, 'orion_cache'],
  [/^\/api\/pedagogy\/daily-logs/, 'dailylog'],
  [/^\/api\/pedagogy\/class-logs/, 'classlog'],
  [/^\/api\/pedagogy\/subjects/, 'subject'],
  [/^\/api\/pedagogy\/teachers/, 'teacher'],
  // ⭐ /api/pedagogy/teacher — pedagogical-teacher.controller.ts (singular!)
  [/^\/api\/pedagogy\/teacher(\/|$)/, 'teacher'],
  [/^\/api\/pedagogy\/timetables/, 'timetable'],
  [/^\/api\/pedagogy\/academic-levels/, 'academiclevel'],
  [/^\/api\/pedagogy\/academic-series/, 'academicseries'],
  [/^\/api\/pedagogy\/academic-cycles/, 'academiccycle'],
  [/^\/api\/pedagogy\/rooms/, 'room'],
  [/^\/api\/pedagogy\/control/, 'pedagogicalcontrol'],
  [/^\/api\/pedagogy\/weekly-reports/, 'weeklyreport'],

  // ─── Examens, Notes & Bulletins ───
  // ⭐ 2026-10-14 — AUDIT EXAMENS : 18 routes manquantes ajoutées pour
  //    couvrir TOUS les controllers du module Examens. Avant : tombaient
  //    dans le fallback 'api_cache' générique → pas d'écriture optimiste
  //    offline (création d'une évaluation, d'un verrou de notes, d'une
  //    décision de promotion, d'un incident de fraude, d'un bloc de
  //    préparation, d'un PV, d'une distinction, d'un bulletin, etc.
  //    n'apparaissaient pas dans la liste jusqu'à la reconnexion).
  //    Maintenant : chaque route résout vers le store IDB métier correct
  //    (déjà créé dans local-db.service.ts ou v19ExamStores).
  //    Ordre IMPORTANT : les routes SPÉCIFIQUES (sous-chemins
  //    /institutional-exams/*) doivent venir AVANT la route GÉNÉRIQUE
  //    /api/exams/* pour éviter que /institutional-exams/bulletins ne
  //    soit capté par /exams avec l'exclusion /bulletin/.
  // /api/institutional-exams/* — sous-modules principaux (V10 mirror)
  [/^\/api\/institutional-exams\/audit/, 'api_cache'],
  [/^\/api\/institutional-exams\/bulletins/, 'reportcard'],
  [/^\/api\/institutional-exams\/config/, 'api_cache'],
  [/^\/api\/institutional-exams\/councils/, 'classcouncil'],
  [/^\/api\/institutional-exams\/dashboard/, 'api_cache'],
  [/^\/api\/institutional-exams\/distinctions/, 'honorroll'],
  [/^\/api\/institutional-exams\/evaluations/, 'evaluation'],
  [/^\/api\/institutional-exams\/grades/, 'grade'],
  [/^\/api\/institutional-exams\/pv-stats-promotion/, 'api_cache'],
  [/^\/api\/institutional-exams\/unlock-requests/, 'examlock'],
  [/^\/api\/institutional-exams\/validation/, 'gradevalidationbatch'],
  // /api/institutional-exams/* (catch-all après les sous-routes)
  [/^\/api\/institutional-exams(\/|$)/, 'exam'],
  // /api/honor-rolls — distinctions.controller.ts (different prefix)
  [/^\/api\/honor-rolls(\/|$)/, 'honorroll'],
  // /api/public/distinctions — public certificates (read-only)
  [/^\/api\/public\/distinctions/, 'api_cache'],
  // /api/council-decisions — councils.controller.ts
  [/^\/api\/council-decisions/, 'councildecision'],
  // /api/exam-frauds — exam-fraud.controller.ts
  [/^\/api\/exam-frauds/, 'examfraud'],
  // /api/exam-preparation — exam-preparation.controller.ts (blocks + sheets)
  [/^\/api\/exam-preparation/, 'exampreparation'],
  // /api/exams/locks — exams-lock.controller.ts (verrous de notes)
  [/^\/api\/exams\/locks/, 'examlock'],
  // /api/exams/promotion — promotion.controller.ts (décisions de promotion)
  [/^\/api\/exams\/promotion/, 'exampromotion'],
  // /api/exams/settings — exams-config.controller.ts (evaluation-types, grade-scales)
  [/^\/api\/exams\/settings/, 'api_cache'],
  // /api/exams/spec-config — exams-spec-config.controller.ts (qualitative-scales,
  //    level-policies, bulletin-templates, mentions, decision-rules,
  //    publication-policy, advanced-settings, analytics-snapshots — tous settings)
  [/^\/api\/exams\/spec-config/, 'api_cache'],
  // ⭐ /api/exams/* — générique (exclut /bulletin — géré par /institutional-exams/bulletins)
  [/^\/api\/exams(\/|$)/, 'exam', /bulletin/],
  [/^\/api\/grades/, 'grade'],
  [/^\/api\/exam-candidates/, 'examcandidate'],
  [/^\/api\/exam-results/, 'examresult'],
  [/^\/api\/exam-scores/, 'examscore'],
  [/^\/api\/exam-sessions/, 'examsession'],
  [/^\/api\/exam-compositions/, 'examcomposition'],
  [/^\/api\/exam-deliberations/, 'examdeliberation'],
  [/^\/api\/report-cards/, 'reportcard'],
  [/^\/api\/evaluations/, 'evaluation'],
  [/^\/api\/student-period-averages/, 'studentperiodaverage'],
  [/^\/api\/student-subject-averages/, 'studentsubjectaverage'],

  // ─── Communication ───
  [/^\/api\/messages/, 'message'],
  [/^\/api\/announcements/, 'announcement'],
  [/^\/api\/notifications/, 'notification'],
  [/^\/api\/alerts/, 'alert'],
  [/^\/api\/meetings/, 'meeting'],
  [/^\/api\/meeting-participants/, 'meetingparticipant'],
  [/^\/api\/meeting-agenda-items/, 'meetingagendaitem'],
  [/^\/api\/meetings\/minutes/, 'meetingminutes'],
  [/^\/api\/meetings\/decisions/, 'meetingdecision'],
  [/^\/api\/communication\/templates/, 'communicationtemplate'],
  [/^\/api\/communication\/automations/, 'automationrule'],
  [/^\/api\/communication\/campaigns/, 'communicationcampaign'],
  [/^\/api\/communication\/scheduled/, 'scheduledemail'],
  [/^\/api\/communication\/channels/, 'communicationchannel'],
  [/^\/api\/communication\/inbox/, 'inboundemail'],

  // ─── Paramètres / Settings ───
  // ⭐ 2026-10-14 — AUDIT PARAMÈTRES : 11 routes manquantes ajoutées pour
  //    couvrir TOUS les controllers du module Paramètres. Avant : tombaient
  //    dans le fallback 'api_cache' générique → pas d'écriture optimiste
  //    offline (création d'un cachet administratif, tampon, signature,
  //    signature électronique, paramètre Orion/Atlas, paramètre offline-
  //    sync, structure pédagogique, calendrier école, etc. n'apparaissaient
  //    pas dans la liste jusqu'à la reconnexion). Maintenant : chaque route
  //    résout vers le store IDB métier correct (tous les stores Paramètres
  //    existaient déjà dans local-db.service.ts).
  //    Ordre IMPORTANT : les routes SPÉCIFIQUES (sous-chemins) doivent venir
  //    AVANT la route GÉNÉRIQUE /api/settings (catch-all) car ROUTE_TABLES
  //    est first-match-wins.
  [/^\/api\/settings\/identity/, 'tenantidentityprofile'],
  [/^\/api\/settings\/bilingual/, 'settingsbilingual'],
  [/^\/api\/settings\/academic/, 'schoolacademicsettings'],
  [/^\/api\/settings\/communication/, 'settingscommunication'],
  [/^\/api\/settings\/security/, 'securitysettings'],
  [/^\/api\/settings\/features/, 'tenantfeature'],
  [/^\/api\/settings\/history/, 'settingshistory'],
  // ⭐ Nouvelles routes Paramètres (audit 2026-10-14) :
  // /api/settings/general — settings généraux du tenant
  [/^\/api\/settings\/general/, 'tenantsetting'],
  // /api/settings/orion — paramètres ORION (dashboard IA)
  [/^\/api\/settings\/orion/, 'orionsettings'],
  // /api/settings/atlas — paramètres Atlas (assistant IA)
  [/^\/api\/settings\/atlas/, 'atlassettings'],
  // /api/settings/offline-sync — paramètres offline-sync
  [/^\/api\/settings\/offline-sync/, 'offlinesyncsettings'],
  // /api/settings/administrative-seals — cachets administratifs (CRUD + versions + usage)
  [/^\/api\/settings\/administrative-seals/, 'administrativeseal'],
  // /api/settings/stamps — tampons (génération, asset, nominative, staff)
  [/^\/api\/settings\/stamps/, 'tenantstamp'],
  // /api/settings/signature — signatures (reset, generate, canva-link, upload, token-info)
  [/^\/api\/settings\/signature/, 'tenantsignature'],
  // /api/settings/electronic-signatures — signatures électroniques certifiées
  [/^\/api\/settings\/electronic-signatures/, 'electronicsignature'],
  // /api/settings/pedagogical-structure — structure pédagogique (niveaux, tracks)
  [/^\/api\/settings\/pedagogical-structure/, 'schoolacademicsettings'],
  // /api/settings/school-calendar-config — configuration calendrier école
  [/^\/api\/settings\/school-calendar-config/, 'schoolcalendarconfig'],
  // /api/settings (catch-all — autres routes non mappées)
  [/^\/api\/settings/, 'tenantsetting'],
  [/^\/api\/academic-years/, 'academicyear'],

  // ─── ORION / Dashboards (agrégats) ───
  [/^\/api\/(orion|dashboard)\//, 'orion_cache'],

  // ─── Cantine ───
  [/^\/api\/canteen\/menus/, 'canteenmenu'],
  [/^\/api\/canteen\/settings/, 'canteensetting'],
  [/^\/api\/canteen\/subscriptions/, 'canteensubscription'],
  [/^\/api\/canteen\/payments/, 'canteenpayment'],
  [/^\/api\/canteen\/attendance/, 'canteenattendance'],

  // ─── Transport ───
  [/^\/api\/transport\/vehicles/, 'vehicle'],
  [/^\/api\/transport\/routes/, 'route'],
  [/^\/api\/transport\/drivers/, 'transportdriver'],
  [/^\/api\/transport\/assignments/, 'transportassignment'],
  [/^\/api\/transport\/trips/, 'transporttrip'],
  [/^\/api\/transport\/settings/, 'transportsetting'],

  // ─── Infirmerie / QHSE ───
  [/^\/api\/infirmary\/visits/, 'infirmaryvisit'],
  [/^\/api\/infirmary\/medical-records/, 'infirmarymedicalrecord'],
  [/^\/api\/infirmary\/medication-stocks/, 'infirmarymedicationstock'],
  [/^\/api\/infirmary\/settings/, 'infirmarysetting'],
  // 🗑️ 2026-10-15 — QHSE module SUPPRIMÉ définitivement — routes retirées.

  // ─── EduCast / Boutique / Bibliothèque ───
  // ⭐ 2026-10-14 — AUDIT ACADEMIA SHOP : 11 routes Shop manquantes
  //    ajoutées pour couvrir TOUS les endpoints du controller Shop.
  //    Avant : /api/shop/stocks, /suppliers, /purchase-orders, /kits,
  //    /returns, /discounts, /deliveries, /loyalty-card, /wallet,
  //    /stock-movements, /settings tombaient dans le fallback 'api_cache'
  //    générique → pas d'écriture optimiste offline (création d'un
  //    produit, supplier, retour, livraison, kit, etc. n'apparaissaient
  //    pas dans la liste jusqu'à la reconnexion). Maintenant : chaque
  //    route résout vers le store IDB métier (tous les stores Shop
  //    existaient déjà dans local-db.service.ts).
  [/^\/api\/shop\/products/, 'shopproduct'],
  [/^\/api\/shop\/categories/, 'shopcategory'],
  [/^\/api\/shop\/orders/, 'shoporder'],
  [/^\/api\/shop\/sales/, 'shopsale'],
  // ⭐ Nouvelles routes Shop (audit 2026-10-14) :
  [/^\/api\/shop\/stocks/, 'shopstock'],
  [/^\/api\/shop\/stock-movements/, 'shopstockmovement'],
  [/^\/api\/shop\/suppliers/, 'shopsupplier'],
  [/^\/api\/shop\/purchase-orders/, 'shoppurchaseorder'],
  [/^\/api\/shop\/kits/, 'shopschoolkit'],
  [/^\/api\/shop\/returns/, 'shopreturn'],
  [/^\/api\/shop\/discounts/, 'shopdiscount'],
  [/^\/api\/shop\/deliveries/, 'shopdelivery'],
  [/^\/api\/shop\/loyalty-card/, 'shoployaltycard'],
  [/^\/api\/shop\/wallet/, 'shopwallettransaction'],
  // ⭐ Routes Shop read-only → api_cache (PDFs, stats, settings)
  [/^\/api\/shop\/stats/, 'api_cache'],
  [/^\/api\/shop\/catalogue/, 'api_cache'],
  [/^\/api\/shop\/payments\/history/, 'api_cache'],
  [/^\/api\/shop\/settings/, 'api_cache'],
  [/^\/api\/library\/books/, 'librarybook'],
  [/^\/api\/library\/loans/, 'libraryloan'],
  [/^\/api\/library\/reservations/, 'libraryreservation'],

  // ─── Modules complémentaires (BFF /api/modules-complementaires/<module>/…) ───
  // ⭐ 2026-10-14 — AUDIT SHOP (BFF mirror) : miroir des routes Shop pour
  //    /api/modules-complementaires/shop/* (le frontend utilise ce préfixe
  //    BFF pour les appels shop). Toutes les nouvelles routes Shop sont
  //    également mappées sous /modules-complementaires/shop/*.
  [/^\/api\/modules-complementaires\/shop\/products/, 'shopproduct'],
  [/^\/api\/modules-complementaires\/shop\/categories/, 'shopcategory'],
  [/^\/api\/modules-complementaires\/shop\/orders/, 'shoporder'],
  [/^\/api\/modules-complementaires\/shop\/sales/, 'shopsale'],
  // ⭐ Nouvelles routes Shop BFF mirror (audit 2026-10-14) :
  [/^\/api\/modules-complementaires\/shop\/stocks/, 'shopstock'],
  [/^\/api\/modules-complementaires\/shop\/stock-movements/, 'shopstockmovement'],
  [/^\/api\/modules-complementaires\/shop\/suppliers/, 'shopsupplier'],
  [/^\/api\/modules-complementaires\/shop\/purchase-orders/, 'shoppurchaseorder'],
  [/^\/api\/modules-complementaires\/shop\/kits/, 'shopschoolkit'],
  [/^\/api\/modules-complementaires\/shop\/returns/, 'shopreturn'],
  [/^\/api\/modules-complementaires\/shop\/discounts/, 'shopdiscount'],
  [/^\/api\/modules-complementaires\/shop\/deliveries/, 'shopdelivery'],
  [/^\/api\/modules-complementaires\/shop\/loyalty-card/, 'shoployaltycard'],
  [/^\/api\/modules-complementaires\/shop\/wallet/, 'shopwallettransaction'],
  // ⭐ Routes Shop read-only BFF mirror → api_cache (PDFs, stats, settings)
  [/^\/api\/modules-complementaires\/shop\/stats/, 'api_cache'],
  [/^\/api\/modules-complementaires\/shop\/catalogue/, 'api_cache'],
  [/^\/api\/modules-complementaires\/shop\/payments\/history/, 'api_cache'],
  [/^\/api\/modules-complementaires\/shop\/settings/, 'api_cache'],
  [/^\/api\/modules-complementaires\/canteen\/menus/, 'canteenmenu'],
  [/^\/api\/modules-complementaires\/canteen\/subscriptions/, 'canteensubscription'],
  [/^\/api\/modules-complementaires\/canteen\/payments/, 'canteenpayment'],
  [/^\/api\/modules-complementaires\/canteen\/attendance/, 'canteenattendance'],
  [/^\/api\/modules-complementaires\/canteen\/settings/, 'canteensetting'],
  // ⭐ 2026-10-15 — AUDIT CANTINE : routes manquantes ajoutées (BFF mirror)
  [/^\/api\/modules-complementaires\/canteen\/dashboard/, 'api_cache'],
  [/^\/api\/modules-complementaires\/canteen\/enrollments/, 'canteensubscription'],
  [/^\/api\/modules-complementaires\/canteen\/diets/, 'api_cache'],
  [/^\/api\/modules-complementaires\/canteen\/allergies/, 'api_cache'],
  [/^\/api\/modules-complementaires\/canteen\/stocks/, 'api_cache'],
  [/^\/api\/modules-complementaires\/canteen\/suppliers/, 'api_cache'],
  [/^\/api\/modules-complementaires\/canteen\/incidents/, 'canteenattendance'],
  [/^\/api\/modules-complementaires\/canteen\/meal-services/, 'api_cache'],
  // ⭐ 2026-10-15 — Modèle métier Cantine (capital, ventes, dispatching, achats, bilan)
  [/^\/api\/modules-complementaires\/canteen\/business\//, 'api_cache'],
  [/^\/api\/modules-complementaires\/transport\/vehicles/, 'vehicle'],
  [/^\/api\/modules-complementaires\/transport\/routes/, 'route'],
  [/^\/api\/modules-complementaires\/library\/books/, 'librarybook'],
  [/^\/api\/modules-complementaires\/library\/loans/, 'libraryloan'],
  [/^\/api\/modules-complementaires\/medical\/visits/, 'infirmaryvisit'],
  [/^\/api\/modules-complementaires\/educast\/contents/, 'educastcontent'],
  [/^\/api\/modules-complementaires\/educast\/channels/, 'educastchannel'],

  // ─── Billing ───
  [/^\/api\/billing\/subscriptions/, 'subscription'],
  [/^\/api\/billing\/invoices/, 'billinginvoice'],

  // ─── Fallback générique (routes /api/* non mappées) ───
  [/^\/api\//, 'api_cache'],
];

/** Résout la table locale d'une route (§3). null si pas une route API. */
function routeTable(pathname) {
  for (const [pattern, store, exclude] of ROUTE_TABLES) {
    if (pattern.test(pathname)) {
      if (exclude && exclude.test(pathname)) continue;
      return store;
    }
  }
  return null;
}

/** Type d'entité (SyncEntityType) inféré de l'URL — pour les événements
 *  outbox (miroir de inferEntityTypeFromUrl applicatif). */
function inferEntityType(pathname) {
  const KEY_MAP = {
    'students/guardians': 'GUARDIAN',
    'students': 'STUDENT',
    'hr/staff': 'STAFF', 'hr/teachers': 'TEACHER', 'hr/contracts': 'CONTRACT',
    'hr/leaves': 'LEAVE_REQUEST', 'hr/allowances': 'STAFF_ALLOWANCE',
    'hr/overtime': 'OVERTIME_RECORD', 'hr/attendance': 'STAFF_ATTENDANCE',
    'hr/evaluations': 'STAFF_EVALUATION', 'hr/documents': 'STAFF_DOCUMENT',
    'hr/collaborators': 'STAFF',
    'teachers': 'TEACHER',
    'classes': 'CLASS', 'class-students': 'CLASS_STUDENT', 'class-subjects': 'CLASS_SUBJECT',
    'subjects': 'SUBJECT', 'school-levels': 'SCHOOL_LEVEL', 'academic-years': 'ACADEMIC_YEAR',
    'exams': 'EXAM', 'grades': 'GRADE', 'exam-candidates': 'EXAM_CANDIDATE',
    'exam-results': 'EXAM_RESULT', 'exam-scores': 'EXAM_SCORE', 'exam-sessions': 'EXAM_SESSION',
    'exam-compositions': 'EXAM_COMPOSITION', 'exam-deliberations': 'EXAM_DELIBERATION',
    'report-cards': 'REPORT_CARD', 'evaluations': 'EVALUATION',
    'payments': 'PAYMENT', 'invoices': 'INVOICE',
    'finance/fee-structures': 'FEE_STRUCTURE', 'finance/transactions': 'FINANCE_TRANSACTION',
    'finance/expenses': 'EXPENSE',
    'attendance': 'ATTENDANCE', 'absences': 'ABSENCE', 'homeworks': 'HOMEWORK',
    'incidents': 'INCIDENT', 'class-diaries': 'CLASS_DIARY', 'lesson-plans': 'LESSON_PLAN',
    'shop/products': 'SHOP_PRODUCT', 'shop/categories': 'SHOP_CATEGORY',
    'shop/orders': 'SHOP_ORDER', 'shop/sales': 'SHOP_SALE',
    'educast/contents': 'EDUCAST_CONTENT', 'educast/channels': 'EDUCAST_CHANNEL',
    'canteen/menus': 'CANTEEN_MENU', 'canteen/payments': 'CANTEEN_PAYMENT',
    'canteen/subscriptions': 'CANTEEN_SUBSCRIPTION', 'canteen/attendance': 'CANTEEN_ATTENDANCE',
    'transport/vehicles': 'VEHICLE', 'transport/routes': 'ROUTE',
    'infirmary/visits': 'INFIRMARY_VISIT', 'library/books': 'LIBRARY_BOOK',
    'messages': 'MESSAGE', 'notifications': 'NOTIFICATION', 'announcements': 'ANNOUNCEMENT',
  };
  const sortedKeys = Object.keys(KEY_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (pathname.toLowerCase().includes(key)) return KEY_MAP[key];
  }
  const segments = pathname.replace(/^\/api\//, '').split('/');
  const first = segments[0]?.replace(/-/g, '_').toUpperCase() || 'STUDENT';
  return first;
}

// ─── §3 helpers : accès IndexedDB depuis le SW ────────────────────────────

/** ⭐ V4.0 — Ouverture SANS version : la base 'academia-helm-local' est gérée
 *    par l'applicatif (local-db.service — version courante 19, évolutive).
 *    L'ANCIEN code du SW ouvrait avec version 15 → VersionError systématique
 *    dès que l'app avait migré la base (>15) → TOUTE la couche IDB du SW
 *    était morte en prod. Sans version : ouverture au niveau EXISTANT,
 *    aucun onupgradeneeded, compatible avec TOUTE future migration. */
function swOpenIdb() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(SW_DB_NAME);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function swIdbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function swIdbGetAll(storeName) {
  const db = await swOpenIdb();
  if (!db || !db.objectStoreNames.contains(storeName)) return [];
  try {
    return (await swIdbRequest(db.transaction([storeName], 'readonly').objectStore(storeName).getAll())) || [];
  } catch {
    return [];
  }
}

async function swIdbPut(storeName, value) {
  const db = await swOpenIdb();
  if (!db || !db.objectStoreNames.contains(storeName)) return false;
  try {
    await swIdbRequest(db.transaction([storeName], 'readwrite').objectStore(storeName).put(value));
    return true;
  } catch {
    return false;
  }
}

async function swIdbGetByKey(storeName, key) {
  const db = await swOpenIdb();
  if (!db || !db.objectStoreNames.contains(storeName)) return undefined;
  try {
    return await swIdbRequest(db.transaction([storeName], 'readonly').objectStore(storeName).get(key));
  } catch {
    return undefined;
  }
}

/** Normalisation d'URL en clé de cache (miroir de normalizeUrlForCache
 *  applicatif — MÊME normalisation de part et d'autre). */
function swNormalizeUrl(url) {
  try {
    const u = new URL(url, self.location.origin);
    u.searchParams.delete('_t');
    u.searchParams.sort();
    u.hash = '';
    return { path: u.pathname, full: u.pathname + (u.search || '') };
  } catch {
    const path = url.split('?')[0];
    return { path, full: url };
  }
}

function swResponseCacheKey(url, tenantId) {
  const { full } = swNormalizeUrl(url);
  return 'T:' + (tenantId || 'anon') + '|GET|' + full;
}

// ─── §2.3 — Write-through IndexedDB après un GET réseau réussi ────────────

const SW_RESPONSE_TTL = 5 * 60 * 1000; // 5 min (miroir DEFAULT_CACHE_TTL)

async function swWriteThroughIdb(request, response, tenantId) {
  const clone = response.clone();
  const text = await clone.text().catch(() => null);
  if (text === null) return;
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return;
  }
  const { path, full } = swNormalizeUrl(request.url);

  // (a) response_cache — TOUS formats (agrégats, settings, tableaux…)
  await swIdbPut('response_cache', {
    cacheKey: swResponseCacheKey(request.url, tenantId),
    tenantId: tenantId ?? null,
    url: full,
    data,
    cachedAt: Date.now(),
    expiresAt: Date.now() + SW_RESPONSE_TTL,
  }).catch(() => {});

  // (b) stores d'entités — tableaux (direct, {data:[…]} ou {items:[…]}) avec id
  const store = routeTable(path);
  if (!store || store === 'orion_cache') return; // agrégats → response_cache seul
  const arr = Array.isArray(data) ? data
    : (data && typeof data === 'object' && Array.isArray(data.data)) ? data.data
    : (data && typeof data === 'object' && Array.isArray(data.items)) ? data.items
    : null;
  if (!arr) return;
  const withId = arr.filter((item) => item && typeof item === 'object' && item.id !== undefined && item.id !== null);
  if (withId.length === 0) return;
  for (const item of withId) {
    await swIdbPut(store, {
      ...item,
      tenantId: item.tenantId || tenantId || null,
      _cachedAt: new Date().toISOString(),
    }).catch(() => {});
  }
}

// ─── Fusion des entités en attente dans les lectures servies hors ligne ────

function swPublicCopy(entity) {
  const copy = {};
  for (const [k, v] of Object.entries(entity || {})) {
    if (k.startsWith('_')) continue;
    copy[k] = v;
  }
  return copy;
}

function swTenantOf(item) {
  const v = item?.tenantId ?? item?.tenant_id;
  return v !== undefined && v !== null && v !== '' ? String(v) : null;
}

/** Fusion (v3.9 portée dans le SW) : liste tableau OU paginée {data|items},
 *  entités _isDirty ajoutées/remplacées, _deleted retirées, total recalé.
 *  Tenant-strict. */
async function swMergePendingEntities(storeName, data, tenantId) {
  try {
    if (data === null || data === undefined) return data;
    let arr = null;
    let container = null;
    if (Array.isArray(data)) {
      arr = data;
    } else if (typeof data === 'object' && Array.isArray(data.data)) {
      arr = data.data; container = { key: 'data', obj: data };
    } else if (typeof data === 'object' && Array.isArray(data.items)) {
      arr = data.items; container = { key: 'items', obj: data };
    }
    if (!arr) return data;

    const entities = await swIdbGetAll(storeName);
    if (!Array.isArray(entities) || entities.length === 0) return data;

    const relevant = entities.filter((e) => {
      if (!e || typeof e !== 'object' || !e.id) return false;
      if (tenantId && swTenantOf(e) !== null && swTenantOf(e) !== String(tenantId)) return false;
      return e._isDirty === true;
    });
    const deletedIds = new Set(
      entities
        .filter((e) => e?._deleted === true && (!tenantId || swTenantOf(e) === null || swTenantOf(e) === String(tenantId)))
        .map((e) => String(e.id))
    );

    const merged = [...arr.filter((item) => !item?.id || !deletedIds.has(String(item.id)))];
    let appended = 0;
    for (const dirty of relevant) {
      if (dirty._deleted) continue; // déjà retiré ci-dessus
      const pub = swPublicCopy(dirty);
      const idx = merged.findIndex((item) => item?.id && String(item.id) === String(dirty.id));
      if (idx >= 0) merged[idx] = pub;
      else { merged.push(pub); appended++; }
    }
    if (container) {
      container.obj[container.key] = merged;
      if (typeof container.obj?.total === 'number') container.obj.total = container.obj.total + appended;
      return data;
    }
    return merged;
  } catch {
    return data;
  }
}

/** Réponse servie depuis le cache (exact ou par-chemin) : parse + fusion des
 *  entités en attente (le composant voit SES créations hors ligne) puis
 *  re-sérialisation. Hors JSON → réponse intacte. */
async function swServeOfflineCachedResponse(cachedResponse, request, tenantId) {
  try {
    const ct = cachedResponse.headers.get('content-type') || '';
    if (!ct.includes('json')) return cachedResponse;
    const text = await cachedResponse.text();
    if (!text.trim()) return cachedResponse;
    const data = JSON.parse(text);
    const { path } = swNormalizeUrl(request.url);
    const store = routeTable(path);
    let out = data;
    if (store && store !== 'orion_cache') {
      out = await swMergePendingEntities(store, data, tenantId);
    }
    return new Response(JSON.stringify(out), {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers: {
        'Content-Type': 'application/json',
        'X-AH-Offline': '1',
      },
    });
  } catch {
    return cachedResponse;
  }
}

// ─── §2.4 — Cascade IndexedDB pour les GET hors ligne ─────────────────────

let swActiveYearCache = null;
async function swGetActiveAcademicYearId() {
  if (swActiveYearCache && Date.now() - swActiveYearCache.readAt < 60000) {
    return swActiveYearCache.yearId;
  }
  let yearId = null;
  try {
    const years = await swIdbGetAll('local_academic_year');
    yearId = years[0]?.id ?? null;
    if (!yearId) {
      const pulled = await swIdbGetAll('academicyear');
      const active = pulled.find((y) => y && (y.isActive === true || y.is_active === true));
      yearId = active?.id ?? null;
    }
  } catch {
    yearId = null;
  }
  swActiveYearCache = { yearId, readAt: Date.now() };
  return yearId;
}

/** Lecture IDB : (1) response_cache exacte, (2) response_cache même chemin
 *  (params proches), (3) stores d'entités → réponse fabriquée. null si rien. */
async function swIdbFallbackForGet(request, tenantId) {
  const { path, full } = swNormalizeUrl(request.url);
  const store = routeTable(path);

  // ⭐ v4.4.0 — Année demandée (param URL ou header x-academic-year-id).
  //    Utilisée pour ne JAMAIS servir les données de l'année ACTIVE quand
  //    une autre année est demandée (les stores IDB et le fallback par
  //    chemin reconstruisent selon l'année active).
  let requestedYear = null;
  try {
    requestedYear = new URL(request.url).searchParams.get('academicYearId')
      || (request.headers.get('x-academic-year-id') || '').trim()
      || null;
  } catch {
    requestedYear = null;
  }

  // (1) réponse exacte pour ce tenant
  const exactEntry = await swIdbGetByKey('response_cache', swResponseCacheKey(request.url, tenantId));
  if (exactEntry && exactEntry.data !== undefined && exactEntry.data !== null) {
    let out = exactEntry.data;
    if (store && store !== 'orion_cache') {
      out = await swMergePendingEntities(store, out, tenantId);
    }
    return new Response(JSON.stringify(out), {
      status: 200,
      statusText: 'OK (offline IDB)',
      headers: { 'Content-Type': 'application/json', 'X-AH-Offline': '1' },
    });
  }

  // (2) même chemin, params les plus proches, même tenant
  try {
    const db = await swOpenIdb();
    if (db && db.objectStoreNames.contains('response_cache')) {
      const entries = await swIdbRequest(
        db.transaction(['response_cache'], 'readonly').objectStore('response_cache').getAll()
      ).catch(() => []);
      const samePath = (entries || []).filter(
        (e) => e && e.data !== undefined && (e.url === path || String(e.url || '').startsWith(path + '?'))
          && (e.tenantId ?? 'anon') === (tenantId || 'anon')
      );
      // ⭐ v4.4.0/v4.4.2 — écarter les entrées d'une AUTRE année que celle
      //    demandée ; une entrée SANS année est implicitement scopée à
      //    l'année ACTIVE (header serveur) → exclue si autre année demandée.
      const yearOf = (u) => {
        try { return new URL(u, 'http://localhost').searchParams.get('academicYearId') || null; } catch { return null; }
      };
      const activeYearForPath = requestedYear ? await swGetActiveAcademicYearId() : null;
      const yearOk = samePath.filter((e) => {
        if (!requestedYear) return true;
        const ey = yearOf(e.url) || activeYearForPath;
        return !ey || ey === requestedYear;
      });
      // Aucune entrée de l'année demandée → on ne sert RIEN de ce chemin
      // (retour à la cascade → 503 honnête plutôt qu'une fausse donnée).
      const servable = requestedYear ? yearOk : samePath;
      if (servable.length > 0) {
        const wanted = new URL(full, 'http://localhost').searchParams;
        const scoreOf = (e) => {
          let score = 0;
          try {
            const got = new URL(e.url, 'http://localhost').searchParams;
            got.forEach((value, key) => {
              if (wanted.get(key) === value) score += 2;
            });
            score -= Math.max(0, [...got.keys()].length - [...wanted.keys()].length);
          } catch { /* ignoré */ }
          return score;
        };
        servable.sort((a, b) => (scoreOf(b) - scoreOf(a)) || ((b.cachedAt || 0) - (a.cachedAt || 0)));
        let out = servable[0].data;
        if (store && store !== 'orion_cache') {
          out = await swMergePendingEntities(store, out, tenantId);
        }
        return new Response(JSON.stringify(out), {
          status: 200,
          statusText: 'OK (offline IDB path)',
          headers: { 'Content-Type': 'application/json', 'X-AH-Offline': '1' },
        });
      }
    }
  } catch {
    /* non bloquant */
  }

  // (3) stores d'entités → fabrication d'une réponse liste
  if (!store) return null;
  // ⭐ v4.4.0 — Le magasin d'entités est filtré par l'année ACTIVE : si une
  //    AUTRE année est demandée, servir ces entités serait une fausse donnée.
  if (requestedYear) {
    const activeYearForGuard = await swGetActiveAcademicYearId();
    if (activeYearForGuard && requestedYear !== activeYearForGuard) return null;
  }
  let entities = await swIdbGetAll(store);
  if (!Array.isArray(entities) || entities.length === 0) return null;

  // Filtres : _deleted, tenant-strict, année active
  let filtered = entities.filter((item) => !item?._deleted);
  if (tenantId) {
    filtered = filtered.filter((item) => swTenantOf(item) === null || swTenantOf(item) === String(tenantId));
  } else {
    filtered = filtered.filter((item) => swTenantOf(item) === null);
  }
  const activeYearId = await swGetActiveAcademicYearId();
  if (activeYearId) {
    filtered = filtered.filter((item) => {
      const year = item?.academicYearId ?? item?.academic_year_id;
      if (year === undefined || year === null || year === '') return true;
      return String(year) === String(activeYearId);
    });
  }
  if (filtered.length === 0) return null;

  // Copies publiques (champs internes _ masqués — spec §2.4 : même format JSON)
  const publicList = filtered.map((item) => swPublicCopy(item));
  return new Response(JSON.stringify(publicList), {
    status: 200,
    statusText: 'OK (offline entity store)',
    headers: { 'Content-Type': 'application/json', 'X-AH-Offline': '1' },
  });
}

// ─── §4 — Interception des ÉCRITURES (POST/PUT/PATCH/DELETE) ──────────────

/** Famille d'URL d'une mutation (chemin sans les segments UUID/action
 *  finaux — miroir de invalidateResponseCacheFamily applicatif). */
function swUrlFamily(url) {
  const { path } = swNormalizeUrl(url);
  const segments = path.split('/').filter(Boolean);
  const ACTIONS = ['archive', 'restore', 'activate', 'close', 'promote', 'validate', 'admit',
    'pre-register', 'generate-credentials', 'duplicate', 'transfer', 'refund', 'resend', 'sign', 'return'];
  while (segments.length > 2) {
    const last = segments[segments.length - 1];
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(last);
    const isAction = ACTIONS.includes(last);
    if (isUuid || isAction) segments.pop();
    else break;
  }
  return '/' + segments.join('/');
}

/** Purge la famille d'URL dans le cache API (Cache API) + response_cache
 *  (IDB) — après une mutation RÉUSSIE (en ligne ou au replay) : la prochaine
 *  lecture ne doit pas servir une copie antérieure à l'écriture. */
async function swInvalidateCacheFamily(url) {
  const family = swUrlFamily(url);
  if (family.length < 2) return;
  try {
    const cache = await caches.open(API_CACHE);
    const keys = await cache.keys();
    await Promise.all(
      keys.map(async (k) => {
        try {
          const ku = new URL(k.url);
          if (ku.pathname === family || ku.pathname.startsWith(family + '/')) {
            await cache.delete(k);
          }
        } catch { /* clé illisible */ }
      })
    );
  } catch { /* non bloquant */ }
  try {
    const db = await swOpenIdb();
    if (db && db.objectStoreNames.contains('response_cache')) {
      const entries = await swIdbRequest(
        db.transaction(['response_cache'], 'readonly').objectStore('response_cache').getAll()
      ).catch(() => []);
      const tx = db.transaction(['response_cache'], 'readwrite');
      const os = tx.objectStore('response_cache');
      for (const e of entries || []) {
        const entryPath = String(e?.url || '').split('?')[0];
        if (entryPath === family || entryPath.startsWith(family + '/')) {
          try { os.delete(e.cacheKey); } catch { /* ignoré */ }
        }
      }
    }
  } catch { /* non bloquant */ }
}

function swUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Diffusion d'un message à toutes les pages ouvertes (pont applicatif :
 *  OfflineSWRegister traduit OUTBOX_CHANGED en événement DOM
 *  'outbox-changed' → badge « en attente de synchronisation » immédiat). */
async function swBroadcast(message) {
  try {
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    clients.forEach((client) => {
      try { client.postMessage(message); } catch { /* client parti */ }
    });
  } catch { /* non bloquant */ }
}

async function handleApiMutation(request) {
  const details = await apiIdentityAsync(request);

  // Corps non-JSON (FormData, binaire…) : file impossible → réseau honnête.
  const contentType = request.headers.get('content-type') || '';
  if (contentType && !contentType.includes('application/json')) {
    return fetch(request);
  }

  // Session inconnue (anti-fuite) ou anonyme : réseau honnête (pas de file).
  if (!details || details.key === null || !details.tenantId) {
    return fetch(request);
  }

  // ⭐ Lire le corps AVANT la tentative réseau (un Request ne peut être lu
  //    qu'une fois — le clone préserve la requête pour la mise en file).
  let bodyText = null;
  try {
    bodyText = await request.clone().text();
  } catch { /* corps illisible → restera null */ }

  const offline = !self.navigator || self.navigator.onLine === false;

  if (!offline) {
    try {
      // ⭐ §4.1 — réseau d'abord, timeout GÉNÉREUX (cf. SW_MUTATION_TIMEOUT) :
      //    une erreur HTTP (4xx/5xx) N'EST PAS un échec réseau — la réponse
      //    réelle du serveur est passée telle quelle au composant (§4.2).
      const response = await fetchWithTimeout(request, SW_MUTATION_TIMEOUT);
      if (response && response.status >= 200 && response.status < 300) {
        swInvalidateCacheFamily(request.url).catch(() => {});
      }
      // ⭐ v4.7.0b — RÉÉCRITURE TRANSPARENTE d'un 404 « id local obsolète » :
      //    la fiche a été CRÉÉE en ligne (pendant une coupure) sous un id
      //    local adopté par le formulaire, puis synchronisée sous l'id
      //    SERVEUR ; l'app continue d'adresser ses PUT/PATCH à l'id local →
      //    404 en ligne → l'autosave échouait SILENCIEUSEMENT et toutes les
      //    saisies postérieures à la synchronisation étaient perdues. Si un
      //    mapping _serverId existe pour l'id de l'URL, on REJOUE la requête
      //    vers l'id serveur et on retourne SA réponse — l'app ne voit rien,
      //    la sauvegarde aboutit sur la vraie fiche.
      if (response && response.status === 404
          && (request.method === 'PUT' || request.method === 'PATCH')) {
        const rewritten = await swReplayMutationToServerId(request, details, bodyText);
        if (rewritten) return rewritten;
      }
      return response;
    } catch (error) {
      // ⭐ ANTI-DOUBLON (politique 504 du module finance) : un TIMEOUT est
      //    AMBIGU — la requête a été ENVOYÉE, le serveur a pu la committer
      //    avant notre abandon. Mettre en file + rejouer créerait un DOUBLON
      //    (ex: encaissement enregistré 2×). → réponse 504 HONNÊTE, l'UI
      //    affiche l'erreur, l'utilisateur vérifie et relance lui-même.
      //    Seule une ERREUR RÉSEAU (fetch jamais parti / connexion refusée —
      //    TypeError) est sûre à mettre en file (§4.3).
      if (error && error.message === 'Timeout') {
        return new Response(
          JSON.stringify({
            message: "Délai d'attente dépassé. Le serveur a mis trop de temps à répondre — l'opération n'a PAS été mise en file (risque de doublon). Vérifiez l'état de la donnée puis réessayez.",
            offline: false,
            timeout: true,
          }),
          {
            status: 504,
            statusText: 'Gateway Timeout',
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      // Réseau KO (offline réel / connexion impossible) → mise en file (§4.3)
    }
  }

  return swQueueMutation(request, details, bodyText);
}

/** §4.3 — Échec réseau : enregistrement dans la file de mutations
 *  (outbox_events — même format que l'applicatif → badges/outbox UI lisibles)
 *  + écriture optimiste dans le store d'entités + Background Sync + réponse
 *  fabriquée qui IMITE un succès (X-Sync-Status: pending) pour que le code
 *  existant poursuive son flux normal (redirection, confirmation). */
/** ⭐ v4.7.0b — Rejoue une mutation PUT/PATCH vers l'id SERVEUR réel
 *  (mapping _serverId) et retourne SA réponse — utilisée par le chemin
 *  EN LIGNE de handleApiMutation après un 404 « id local obsolète ».
 *  Retourne null si aucun mapping ou si le replay n'aboutit pas (la
 *  réponse 404 d'origine est alors rendue telle quelle — honnêteté). */
async function swReplayMutationToServerId(request, details, bodyText) {
  try {
    const localId = swUuidFromUrl(request.url);
    if (!localId) return null;
    const serverId = await swResolveServerIdForUrl(request.url, localId);
    if (!serverId || serverId === localId) return null;
    const newUrl = request.url.split(localId).join(serverId);

    const headers = {};
    const auth = request.headers.get('authorization');
    if (auth) headers['Authorization'] = auth;
    const ct = request.headers.get('content-type');
    if (ct) headers['Content-Type'] = ct;
    const xtid = request.headers.get('x-tenant-id');
    if (xtid) headers['X-Tenant-ID'] = xtid;
    else if (details && details.tenantId) headers['X-Tenant-ID'] = details.tenantId;

    let sameOrigin = true;
    try { sameOrigin = new URL(newUrl).origin === self.location.origin; } catch { sameOrigin = true; }

    const init = { method: request.method, credentials: sameOrigin ? 'include' : 'omit', headers };
    if (bodyText) init.body = bodyText;

    const response = await fetchWithTimeout(new Request(newUrl, init), SW_MUTATION_TIMEOUT);
    if (response && response.status >= 200 && response.status < 300) {
      swInvalidateCacheFamily(newUrl).catch(() => {});
      return response;
    }
    return null;
  } catch {
    return null;
  }
}

async function swQueueMutation(request, details, bodyText) {
  let url = request.url;
  const method = request.method;
  let { path } = swNormalizeUrl(url);
  const tenantId = details.tenantId;

  let body = null;
  if (bodyText && bodyText.trim()) {
    try { body = JSON.parse(bodyText); } catch { body = null; }
  }

  const entityType = inferEntityType(path);
  const store = routeTable(path);

  // ID de l'entité : corps → URL → généré localement
  // ⭐ 2026-10-14 — FIX : pour les routes imbriquées (ex: /students/:id/guardians/:guardianId),
  //    on prend le DERNIER UUID de l'URL (l'id de la ressource cible), pas le premier.
  //    Avant : url.match retournait le premier UUID → studentId au lieu de guardianId.
  //    Désormais : pour les routes /guardians, on prend le dernier UUID.
  let urlId = null;
  const urlUuidMatches = [...url.matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)];
  if (urlUuidMatches.length > 0) {
    // ⭐ Pour les routes imbriquées (2+ UUIDs), le DERNIER est l'ID de l'entité cible.
    //    Ex: /api/students/{studentId}/guardians/{guardianId} → guardianId
    //    Ex: /api/students/{studentId}/guardians/relation/{junctionId} → junctionId
    urlId = urlUuidMatches[urlUuidMatches.length - 1][0];
  }

  // ─── ⭐ v4.7.0b — RÉÉCRITURE À L'ENTRÉE (id local → id serveur) ───────────
  //    Cas réel observé en production : l'autosave crée la fiche en file
  //    (id LOCAL adopté par le formulaire) → le POST est synchronisé SEUL
  //    (Background Sync) → le serveur a créé la fiche sous un AUTRE id →
  //    les PUT suivants (mis en file après) visaient l'id local → 404 →
  //    FAILED définitif. Le mapping _serverId (posé à la synchronisation de
  //    la création) permet de cibler DIRECTEMENT l'id serveur dès la mise
  //    en file — le replay ne peut plus échouer sur un id obsolète.
  try {
    if (urlId && method !== 'POST') {
      const serverId = await swResolveServerIdForUrl(url, urlId);
      if (serverId) {
        url = url.split(urlId).join(serverId);
        urlId = serverId;
        path = swNormalizeUrl(url).path;
      }
    }
  } catch { /* réécriture best-effort — l'URL originale reste utilisable */ }

  const entityId = (body && typeof body === 'object' && body.id) || urlId || swUuid();

  // URLs d'action /{uuid}/archive|admit|activate… → modification locale
  const actionMatch = path.match(
    /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/([a-z][a-z0-9-]*)$/i
  );
  const isActionUrl = Boolean(actionMatch && urlId && method !== 'DELETE');
  const actionName = actionMatch?.[1]?.toLowerCase() ?? '';

  const operation = method === 'POST' ? 'CREATE' : method === 'DELETE' ? 'DELETE' : 'UPDATE';

  // ⭐ 2026-10-14 — BATCH/COMPOUND ENDPOINT DETECTION :
  //    Les endpoints batch (ex: /api/students/bulk-setup, /batch-promote,
  //    /admit, /pre-register, /re-enroll, /change-class, /withdraw,
  //    /reset-physical-assignments, /finance/payments/bulk-apply, etc.)
  //    n'ont PAS d'UUID dans l'URL ET n'ont pas de body.id → le SW générait
  //    un UUID aléatoire (phantom) et écrivait une fausse entité dans le store.
  //
  //    Détection : POST sans UUID dans l'URL ET sans body.id ET l'URL
  //    contient un mot-clé d'action batch (pas un UUID cible).
  //    Ces endpoints sont MIS EN FILE (outbox) pour replay au retour du
  //    réseau, MAIS aucune entité optimiste n'est écrite dans le store —
  //    cela évite les faux élèves/paiements/etc. qui polluent les listes.
  const BATCH_KEYWORDS = [
    // Students
    'bulk-setup', 'batch-promote', 'batch-update-status', 'batch/submit',
    'batch/accept', 'batch/convert', 'batch/accept-and-enroll',
    'reset-physical-assignments', 'admit', 'pre-register', 're-enroll',
    'promote', 'repeat', 'withdraw', 'reintegrate', 'exclude', 'exit',
    'transfer', 'change-class', 'change-series', 'assign-physical-class',
    'update-enrollment-type', 'delete-student', 'repair-enrollment',
    'generate-bulk',
    // Finance — bulk / batch actions (audit 2026-10-14)
    'bulk-apply', 'bulk-delete', 'bulk-collect', 'bulk-remind',
    'mass-apply', 'mass-collect',
    'multi-action', 'update-student', // payments + collection-summary batch
    'copy-to-year', 'recalculate-accounts', // fee-structures batch actions
    'run-escalation', 'run-nightly', 'detect-arrears', // collection batch actions
    'write-off', 'transfer-year', 'auto-generate', // arrears batch actions
    'import/preview', 'import/run', // imports (arrears, collection-summary, overrides)
    'bulk-class', // overrides/bulk-class
    // Pedagogy — batch / workflow actions (audit 2026-10-14)
    'auto-propose', // monthly-plans auto-propose
    'director-observations', // monthly-plans director observations
    'duplicate-to-year', // monthly-plans / annual-plans duplicate
    'class-subjects/bulk', // pedagogy-prisma class-subjects bulk
    'auto-recovery', // financial-settings run-auto-recovery
    'send-compta-export', // financial-settings send-compta-export
    // Exams — batch / workflow actions (audit 2026-10-14)
    'apply', // exams/promotion/apply (bulk promotion decisions)
    'auto-annotations', // bulletins auto-annotations (bulk generate)
    'batch/approve', 'batch/reject', // validation batch endpoint
    'set-default', // bulletin-templates set-default (action sans body.id)
    'send-to-secretariat', // exam-preparation blocks send-to-secretariat
    // HR/Personnel — batch / workflow actions (audit 2026-10-14)
    //    On évite les verbes trop génériques (validate, generate, seed,
    //    reorder) qui pourraient capturer des routes légitimes. On ne
    //    garde QUE les endpoints vraiment batch (POST sans UUID dans
    //    l'URL). Les routes /:id/action ont un UUID → ne sont pas batch.
    'upload-apply', // recruitment/upload-apply (candidature bulk upload)
    'cards/generate-all', 'cards/distribute', // staff-card batch ops
    'cleanup/orphaned-files', // recruitment cleanup batch
    'fix/application-statuses', // recruitment fix batch
    // Academia Shop — batch / workflow actions (audit 2026-10-14)
    'wallet/recharge', // shop/wallet/recharge (e-wallet top-up, no UUID)
    // Paramètres — batch / workflow actions (audit 2026-10-14)
    'features/enable-all', 'features/disable-all', // settings/features batch
    'bilingual/migrate', 'bilingual/seed-en-structure', // settings/bilingual batch
    'academic-years/generate-next', // settings academic-years batch generation
    'school-calendar-config/reset', // settings calendar reset
    'check-expiring', // administrative-seals check-expiring batch
    'check-migration', // settings/bilingual/check-migration batch
  ];
  const isBatchEndpoint = method === 'POST' && !urlId
    && !(body && typeof body === 'object' && body.id)
    && BATCH_KEYWORDS.some(kw => path.includes('/' + kw) || path.endsWith(kw));

  // ─── Écriture optimiste dans le store d'entités (v3.9 portée au SW) ───
  //    L'entité créée/modifiée hors ligne est VISIBLE dans les listes (la
  //    fusion des _isDirty l'injecte dans les lectures servies hors ligne).
  //    ⭐ 2026-10-14 — SKIP optimiste pour les batch endpoints (phantom).
  let optimisticEntity = null;
  if (store && store !== 'orion_cache' && store !== 'api_cache' && !isBatchEndpoint) {
    try {
      if (isActionUrl) {
        const patch = { ...(body ?? {}) };
        if (actionName === 'archive' || actionName === 'soft-delete') patch.status = 'ARCHIVED';
        const existing = await swIdbGetByKey(store, entityId);
        optimisticEntity = {
          ...(existing ?? {}),
          ...patch,
          id: entityId,
          tenantId: existing?.tenantId ?? tenantId,
          _isDirty: true,
          _deleted: false,
          updatedAt: new Date().toISOString(),
        };
        await swIdbPut(store, optimisticEntity);
      } else if (method === 'POST') {
        optimisticEntity = {
          ...(body ?? {}),
          id: entityId,
          tenantId,
          _isDirty: true,
          _deleted: false,
          createdAt: (body && body.createdAt) || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await swIdbPut(store, optimisticEntity);
      } else if (method === 'PUT' || method === 'PATCH') {
        const existing = await swIdbGetByKey(store, entityId);
        optimisticEntity = {
          ...(existing ?? {}),
          ...(body ?? {}),
          id: entityId,
          tenantId: existing?.tenantId ?? tenantId,
          _isDirty: true,
          updatedAt: new Date().toISOString(),
        };
        await swIdbPut(store, optimisticEntity);
      } else if (method === 'DELETE') {
        const existing = await swIdbGetByKey(store, entityId);
        if (existing) {
          optimisticEntity = {
            ...existing,
            _deleted: true,
            _isDirty: true,
            updatedAt: new Date().toISOString(),
          };
          await swIdbPut(store, optimisticEntity);
        }
      }
    } catch { /* store absent — l'événement outbox reste la source de vérité */ }
  }

  // ─── Événement outbox (format IDENTIQUE à OutboxService.createEvent) ───
  //    metadata.sw marque la PROPRIÉTÉ du replay par le SW (le sync-engine
  //    applicatif ignore ces événements — jamais de double-replay) ;
  //    metadata.request conserve la requête ORIGINALE (URL, méthode, corps,
  //    en-tête Authorization capturé) pour un replay HTTP EXACT.
  const auth = request.headers.get('authorization');
  const nowIso = new Date().toISOString();

  // ─── ⭐ v4.7.0 — DÉDUP « dernière version gagne » (même URL, même verbe) ──
  //    Réseau mobile instable : l'autosave 10 s d'une fiche peut mettre en
  //    file DES DIZAINES de PUT successifs pour la MÊME URL pendant une
  //    coupure. Chaque événement = 1 requête serveur au replay → file
  //    interminable, versions intermédiaires inutiles, risque accru de 404
  //    (remap POST→PUT non encore appliqué). Désormais : un événement
  //    PENDING du SW pour la MÊME URL + MÊME verbe (PUT/PATCH/DELETE) est
  //    MIS À JOUR — corps remplacé par la version la plus récente — au lieu
  //    d'en empiler un nouveau. Les POST ne sont PAS dédupliqués : deux
  //    POST distincts peuvent être deux créations légitimes différentes.
  let replaceEventId = null;
  let replaceCreatedAt = null;
  if (method !== 'POST') {
    try {
      const db = await swOpenIdb();
      if (db && db.objectStoreNames.contains('outbox_events')) {
        const all = await swIdbRequest(
          db.transaction(['outbox_events'], 'readonly').objectStore('outbox_events').getAll()
        ).catch(() => []);
        const dupe = (all || []).find((e) => {
          if (!e || e.status !== 'PENDING' || !e.metadata) return false;
          try {
            const meta = typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata;
            return !!(meta && meta.sw && meta.request
              && meta.request.method === method && meta.request.url === url);
          } catch { return false; }
        });
        if (dupe) {
          replaceEventId = dupe.id;
          replaceCreatedAt = dupe.createdAt || null;
        }
      }
    } catch { /* dédup best-effort — en cas d'échec on empile (comportement historique) */ }
  }

  const eventId = replaceEventId || swUuid();
  const queued = await swIdbPut('outbox_events', {
    id: eventId,
    tenantId,
    userId: details.userId ?? undefined,
    entityType,
    entityId,
    operation,
    payload: JSON.stringify(body ?? { id: entityId }),
    metadata: JSON.stringify({
      request: {
        url,
        method,
        body: body ?? null,
        auth: auth || null,
      },
      sw: 'v4',
      action: isActionUrl ? actionName : undefined,
    }),
    status: 'PENDING',
    priority: 0,
    retryCount: 0,
    maxRetries: 10,
    attemptCount: 0,
    localVersion: Date.now(),
    // ⭐ v4.7.0 — dédup : on conserve le createdAt d'ORIGINE (ordre FIFO du
    //    replay inchangé — la fiche la plus ancienne part toujours en premier)
    //    mais updatedAt rafraîchi (visible dans les badges/outbox UI).
    createdAt: replaceCreatedAt || nowIso,
    updatedAt: nowIso,
    conflictStrategy: 'LAST_WRITE_WINS',
  });

  // ⭐ HONNÊTETÉ : si la file est INACCESSIBLE (IDB indisponible / store
  //    absent), la mutation N'EST PAS sauvegardée → on ne fabrique PAS un
  //    succès qui serait un mensonge silencieux : erreur 503 explicite.
  if (!queued) {
    return new Response(
      JSON.stringify({
        message: 'Hors ligne : impossible d\'enregistrer l\'opération sur cet appareil (stockage local indisponible). Réessayez une fois la connexion rétablie.',
        offline: true,
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json', 'X-AH-Offline': '1' },
      },
    );
  }

  // ─── Background Sync : replay automatique à la reconnexion ───
  try { await self.registration.sync.register('ah-sync-pending'); } catch { /* SW sans sync */ }

  // ─── Notifier les pages ouvertes (badge immédiat) ───
  swBroadcast({ type: 'OUTBOX_CHANGED', reason: 'queued', eventId });

  // ─── Réponse FABRIQUÉE (§4.3 + §5) : imite un succès pour que le flux du
  //    composant continue ; l'en-tête X-Sync-Status: pending est LE signal
  //    que les composants voulant afficher le badge doivent vérifier.
  const responseBody = method === 'DELETE'
    ? JSON.stringify({ id: entityId, deleted: true })
    : JSON.stringify(
        optimisticEntity
          ? swPublicCopy(optimisticEntity)
          : { id: entityId, ...(body && typeof body === 'object' ? body : {}), offline: true }
      );
  return new Response(responseBody, {
    status: 200,
    statusText: 'OK (offline - queued)', // ⚠️ ByteString : ASCII uniquement (pas de tiret cadratin)
    headers: {
      'Content-Type': 'application/json',
      'X-Sync-Status': 'pending',
      'X-Offline-Mutation': 'true',
      'X-AH-Offline': '1',
    },
  });
}

// ─── §4.3 — Replay des mutations SW à la reconnexion (Background Sync) ─────

/** Réponse serveur écrite dans le store local + _isDirty cleared (miroir du
 *  replayOfflineRequest du sync-engine applicatif). */
async function swApplyServerEntityResponse(event, parsed) {
  try {
    // ⭐ v4.7.0a — RÉSOLUTION SYMÉTRIQUE du store : l'écriture optimiste
    //    (swQueueMutation) écrit dans routeTable(path) ; la réponse serveur
    //    après replay doit écrire au MÊME endroit. AVANT : /api/pedagogy-
    //    space/fiches → entityType « PEDAGOGY_SPACE » → store dérivé
    //    'pedagogy_space' (INEXISTANT) → swIdbPut échouait silencieusement →
    //    l'entité optimiste restait _isDirty À VIE → les listes servies hors
    //    ligne fusionnaient un DOUBLON fantôme (id local jamais nettoyé).
    let storeName = null;
    try {
      const meta = typeof event.metadata === 'string' ? JSON.parse(event.metadata) : event.metadata;
      const reqUrl = meta && meta.request && meta.request.url;
      if (typeof reqUrl === 'string') storeName = routeTable(swNormalizeUrl(reqUrl).path);
    } catch { /* résolution par entityType ci-dessous */ }
    if (!storeName) storeName = swIdbStoreForEntityType(event.entityType);
    if (!storeName) return;
    const local = await swIdbGetByKey(storeName, event.entityId);
    const serverData =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.id === event.entityId
        ? parsed
        : Array.isArray(parsed)
          ? parsed.find((r) => r?.id === event.entityId)
          : null;
    if (local || serverData) {
      await swIdbPut(storeName, {
        ...(serverData ?? local),
        id: event.entityId,
        tenantId: local?.tenantId ?? event.tenantId,
        _isDirty: false,
        _deleted: false,
        _lastSync: new Date().toISOString(),
        ...(local ? { _version: (local._version || 1) + 1 } : {}),
        // ⭐ v4.7.0b — MARQUEUR _serverId : la création offline a reçu un id
        //    LOCAL (adopté par le formulaire) mais le serveur a créé la
        //    fiche sous un AUTRE id. On mémorise le mapping SUR l'entité
        //    locale → toute future écriture vers l'id local (en ligne par
        //    handleApiMutation ou en file par swQueueMutation) sera
        //    réécrite vers l'id SERVEUR — sans ce marqueur, chaque PUT
        //    recevait 404 (création synchronisée entre-temps) → échec
        //    silencieux de l'autosave → perte de TOUTES les saisies
        //    postérieures à la synchronisation (cas réel observé en prod).
        ...(parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            && typeof parsed.id === 'string' && parsed.id && parsed.id !== event.entityId
          ? { _serverId: parsed.id }
          : {}),
      });
    }
    // ⭐ v4.7.0a — CRÉATION dont l'id serveur ≠ id local : on écrit AUSSI la
    //    version propre sous l'id SERVEUR (la fabrication hors ligne montre
    //    la VRAIE fiche) ; l'entrée sous l'id local reste propre (plus de
    //    doublon fantôme dans la fusion _isDirty des listes hors ligne).
    //    Local d'abord, réponse serveur ensuite : les champs du formulaire
    //    (titre, contenu…) survivent même si la réponse PUT est sobre.
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        && typeof parsed.id === 'string' && parsed.id && parsed.id !== event.entityId) {
      const serverLocal = await swIdbGetByKey(storeName, parsed.id);
      const base = serverLocal ?? local ?? null;
      await swIdbPut(storeName, {
        ...(base && typeof base === 'object' ? base : {}),
        ...parsed,
        id: parsed.id,
        tenantId: (serverLocal && serverLocal.tenantId) || (local && local.tenantId) || event.tenantId,
        _isDirty: false,
        _deleted: false,
        _lastSync: new Date().toISOString(),
      });
    }
  } catch { /* non bloquant */ }
}

/** Miroir de idbStoreForEntityType applicatif : STUDENT → 'student',
 *  TEACHER_CLASS_ASSIGNMENT → 'teacherclassassignment'. */
function swIdbStoreForEntityType(entityType) {
  let name = String(entityType || '').toLowerCase();
  name = name.replace(/[_\-\s]+/g, '');
  if (name.endsWith('ies') && name.length > 3) name = name.slice(0, -3) + 'y';
  else if (name.endsWith('ses') && name.length > 3) name = name.slice(0, -2);
  else if (name.endsWith('xes') && name.length > 3) name = name.slice(0, -2);
  else if (name.endsWith('s') && !name.endsWith('ss') && name.length > 1) name = name.slice(0, -1);
  return name;
}

async function swUpdateOutboxEvent(db, eventId, patch) {
  try {
    const tx = db.transaction(['outbox_events'], 'readwrite');
    const store = tx.objectStore('outbox_events');
    const getReq = store.get(eventId);
    getReq.onsuccess = () => {
      const event = getReq.result;
      if (!event) return;
      store.put({ ...event, ...patch });
    };
  } catch { /* non bloquant */ }
}

/** ⭐ v4.7.0 — Remappe un id LOCAL (fiche créée en ligne par le SW) vers
 *  l'id SERVEUR réel dans tous les événements PENDING de la file du SW :
 *  - metadata.request.url : le segment /<id-local> devient /<id-serveur>
 *    (les PUT rejoués ciblent la vraie fiche au lieu d'un 404) ;
 *  - entityId : la réponse serveur du PUT s'écrira sous la bonne clé de
 *    store local (swApplyServerEntityResponse).
 *  ⭐ v4.7.0a — MIROIR MÉMOIRE (bug trouvé au harnais) : la boucle de
 *  replay lit les métadonnées du tableau `candidates` PARSÉ AVANT la
 *  boucle — sans ce miroir, la réécriture DB n'avait AUCUN effet sur le
 *  fetch du PUT suivant (il partait vers l'ANCIEN id local → 404 en
 *  production → FAILED définitif → perte des modifications postérieures)
 *  alors même que la DB semblait correcte après coup. On mute donc AUSSI
 *  les objets en mémoire (la boucle itère sur les MÊMES références).
 *  Les UUID sont uniques — un remplacement textuel est sûr. Best-effort :
 *  un échec laisse les événements intacts (comportement v4.6.0). */
async function swRemapLocalIdInPendingEvents(db, localId, serverId, candidates) {
  if (!localId || !serverId || String(localId) === String(serverId)) return;
  // Miroir mémoire TOUJOURS (même si la DB est inaccessible) : c'est LUI
  // qui décide de l'URL des fetch de replay de CETTE passe.
  if (Array.isArray(candidates)) {
    for (const c of candidates) {
      if (!c || !c.meta || !c.meta.request || typeof c.meta.request.url !== 'string') continue;
      if (!c.meta.request.url.includes(localId)) continue;
      c.meta.request.url = c.meta.request.url.split(localId).join(serverId);
      if (c.event && c.event.entityId === localId) c.event.entityId = serverId;
    }
  }
  if (!db || !db.objectStoreNames || !db.objectStoreNames.contains('outbox_events')) return;
  try {
    const all = await swIdbRequest(
      db.transaction(['outbox_events'], 'readonly').objectStore('outbox_events').getAll()
    ).catch(() => []);
    for (const e of all || []) {
      if (!e || (e.status !== 'PENDING' && e.status !== 'SYNCING')) continue;
      let meta = null;
      try { meta = typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata; } catch { meta = null; }
      if (!meta || !meta.sw || !meta.request || typeof meta.request.url !== 'string') continue;
      if (!meta.request.url.includes(localId)) continue;
      const newUrl = meta.request.url.split(localId).join(serverId);
      const newMeta = { ...meta, request: { ...meta.request, url: newUrl } };
      await swUpdateOutboxEvent(db, e.id, {
        entityId: e.entityId === localId ? serverId : e.entityId,
        metadata: JSON.stringify(newMeta),
        updatedAt: new Date().toISOString(),
      });
    }
  } catch { /* remap best-effort */ }
}

/** ⭐ v4.7.0a — Y a-t-il encore une CRÉATION (POST PENDING/SYNCING du SW)
 *  pour un id présent dans l'URL donnée ? Utilisé pour distinguer un 404 de
 *  « la fiche n'existe pas parce que sa création est ENCORE EN FILE » (course
 *  POST→PUT) d'un vrai refus métier. Best-effort : en cas d'erreur de lecture
 *  → false (comportement historique FAILED). */
async function swHasPendingCreateForUrl(db, url) {
  try {
    if (!db || !db.objectStoreNames || !db.objectStoreNames.contains('outbox_events')) return false;
    const all = await swIdbRequest(
      db.transaction(['outbox_events'], 'readonly').objectStore('outbox_events').getAll()
    ).catch(() => []);
    for (const e of all || []) {
      if (!e || (e.status !== 'PENDING' && e.status !== 'SYNCING')) continue;
      let m = null;
      try { m = typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata; } catch { m = null; }
      if (!m || !m.sw || !m.request || m.request.method !== 'POST') continue;
      if (e.entityId && typeof url === 'string' && url.includes(e.entityId)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** ⭐ v4.7.0b — Résout l'id SERVEUR réel d'un id LOCAL présent dans une URL
 *  (mapping _serverId mémorisé sur l'entité locale lors de la synchronisation
 *  d'une création offline). null si aucun mapping n'existe. */
async function swResolveServerIdForUrl(url, localId) {
  try {
    if (!localId || typeof url !== 'string') return null;
    const { path } = swNormalizeUrl(url);
    const store = routeTable(path);
    if (!store || store === 'orion_cache' || store === 'api_cache') return null;
    const entity = await swIdbGetByKey(store, localId);
    if (entity && typeof entity === 'object'
        && entity._serverId && String(entity._serverId) !== String(localId)) {
      return String(entity._serverId);
    }
    return null;
  } catch {
    return null;
  }
}

/** Extrait le premier UUID d'une URL (id d'entité du chemin), null sinon. */
function swUuidFromUrl(url) {
  try {
    const m = String(url).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    return m ? m[0] : null;
  } catch {
    return null;
  }
}

/** ⭐ PROPRIÉTAIRE UNIQUE : rejoue UNIQUEMENT les événements marqués
 *  metadata.sw (créés par le SW — cf. swQueueMutation). Les événements créés
 *  par la couche applicative restent au sync-engine applicatif. */
async function swReplayPendingMutations() {
  const db = await swOpenIdb();
  if (!db || !db.objectStoreNames.contains('outbox_events')) return { replayed: 0, failed: 0, stillPending: 0 };

  let all = [];
  try {
    all = await swIdbRequest(db.transaction(['outbox_events'], 'readonly').objectStore('outbox_events').getAll());
  } catch {
    return { replayed: 0, failed: 0, stillPending: 0 };
  }

  const now = Date.now();
  const candidates = [];
  for (const e of all || []) {
    if (!e || (e.status !== 'PENDING' && e.status !== 'SYNCING')) continue;
    let meta = null;
    try { meta = typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata; } catch { meta = null; }
    if (!meta || !meta.sw || !meta.request) continue; // pas à nous
    if (e.status === 'SYNCING') {
      const lastAttempt = Date.parse(e.lastAttemptAt || e.updatedAt || '') || 0;
      if (now - lastAttempt < 120000) continue; // replay en cours → pas de doublon
    }
    candidates.push({ event: e, meta });
  }
  if (candidates.length === 0) return { replayed: 0, failed: 0, stillPending: 0 };

  candidates.sort((a, b) => new Date(a.event.createdAt).getTime() - new Date(b.event.createdAt).getTime());

  // Token miroir (fallback si l'en-tête Authorization n'a pas été capturé)
  const authToken = await swGetAuthToken();

  let replayed = 0;
  let failed = 0;
  let stillPending = 0;

  for (const { event, meta } of candidates) {
    const req = meta.request;
    await swUpdateOutboxEvent(db, event.id, {
      status: 'SYNCING',
      lastAttemptAt: new Date().toISOString(),
      attemptCount: (event.attemptCount || 0) + 1,
    });

    let sameOrigin = true;
    try { sameOrigin = new URL(req.url).origin === self.location.origin; } catch { sameOrigin = true; }

    const headers = { 'Content-Type': 'application/json' };
    if (req.auth) headers['Authorization'] = req.auth;
    else if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
    if (event.tenantId) headers['X-Tenant-ID'] = event.tenantId;

    try {
      // ⭐ fetch initié PAR LE SW : ne passe PAS par notre propre fetch
      //    handler → pas d'auto-interception ni de récursion.
      const response = await fetch(req.url, {
        method: req.method,
        credentials: sameOrigin ? 'include' : 'omit',
        headers,
        ...(req.body !== null && req.body !== undefined
          ? { body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body) }
          : {}),
      });

      if (response.ok) {
        const text = await response.text().catch(() => '');
        let parsed = null;
        if (text.trim()) { try { parsed = JSON.parse(text); } catch { parsed = null; } }
        await swApplyServerEntityResponse(event, parsed);
        await swUpdateOutboxEvent(db, event.id, {
          status: 'SYNCED',
          syncedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        await swInvalidateCacheFamily(req.url);
        // ⭐ v4.7.0 — REMAP D'IDENTITÉ POST→PUT (bug « fiche incomplète
        //    après coupure mobile ») : une fiche CRÉÉE pendant une coupure
        //    reçoit un id LOCAL (généré par swQueueMutation) et la réponse
        //    fabriquée l'a fait adopter par le formulaire → les autosaves
        //    suivants mettent en file des PUT vers /fiches/<id-local>.
        //    Au replay du POST, le serveur crée la fiche avec SON id → sans
        //    remap, ces PUT recevaient 404 → FAILED DÉFINITIF → toutes les
        //    modifications postérieures à la création étaient perdues (la
        //    fiche réapparaissait amputée de sa fin de saisie). On réécrit
        //    l'id local → id serveur dans les événements PENDING restants
        //    (URL de replay + entityId) → les PUT rejoués ciblent la vraie
        //    fiche → contenu complet.
        if (req.method === 'POST' && parsed && typeof parsed === 'object'
            && !Array.isArray(parsed) && typeof parsed.id === 'string'
            && parsed.id && parsed.id !== event.entityId) {
          await swRemapLocalIdInPendingEvents(db, event.entityId, parsed.id, candidates);
        }
        replayed++;
      } else if (response.status >= 400 && response.status < 500) {
        // Refus MÉTIER du serveur (validation DTO, 403, 404…) → FAILED définitif
        const text = await response.text().catch(() => '');
        let msg = 'Serveur : ' + response.status;
        try {
          const parsed = JSON.parse(text);
          msg = parsed?.message || parsed?.error || msg;
        } catch { /* corps non-JSON */ }
        // ⭐ v4.7.0b — RÉÉCRITURE id local → id serveur (cas réel observé en
        //    production : la CRÉATION s'est synchronisée AVANT que ce PUT ne
        //    soit mis en file → il vise un id que le serveur n'a JAMAIS eu).
        //    On réécrit l'URL de l'événement (DB + miroir mémoire) et on le
        //    laisse PENDING : la passe suivante le rejouera vers la VRAIE
        //    fiche. Prioritaire sur le report de dépendance (le mapping est
        //    plus précis : il donne l'id RÉEL, pas juste « réessaie plus tard »).
        let handledByRewrite = false;
        if (response.status === 404) {
          const localId = swUuidFromUrl(req.url);
          if (localId) {
            const serverId = await swResolveServerIdForUrl(req.url, localId);
            if (serverId && serverId !== localId) {
              const newUrl = req.url.split(localId).join(serverId);
              const newMeta = { ...meta, request: { ...meta.request, url: newUrl } };
              meta.request.url = newUrl; // miroir mémoire (req === meta.request)
              await swUpdateOutboxEvent(db, event.id, {
                entityId: event.entityId === localId ? serverId : event.entityId,
                metadata: JSON.stringify(newMeta),
                status: 'PENDING',
                updatedAt: new Date().toISOString(),
              });
              stillPending++;
              handledByRewrite = true;
            }
          }
        }
        // ⭐ v4.7.0a — DÉPENDANCE POST→PUT (course de reprise découverte au
        //    harnais) : quand le réseau revient ENTRE le PUT et le POST d'une
        //    même passe de replay, le PUT part vers l'id LOCAL avant que la
        //    création n'ait réussi → 404 → (avant) FAILED définitif → toutes
        //    les modifications postérieures à la création étaient perdues.
        //    Si un POST (création) pour le MÊME id est encore en file, ce 404
        //    n'est PAS un refus métier : on laisse le PUT PENDING — la passe
        //    suivante traite le POST d'abord (FIFO) → remap id serveur → PUT
        //    rejoué vers la vraie fiche. Le report est BORNÉ : dès que le POST
        //    est SYNCED/FAILED, un 404 redevient définitif (comportement
        //    historique — une vraie suppression n'est jamais masquée).
        const deferredByPendingCreate = !handledByRewrite
          && response.status === 404
          && (req.method === 'PUT' || req.method === 'PATCH')
          && (await swHasPendingCreateForUrl(db, req.url));
        if (!handledByRewrite) {
          if (deferredByPendingCreate) {
            await swUpdateOutboxEvent(db, event.id, {
              status: 'PENDING',
              updatedAt: new Date().toISOString(),
            });
            stillPending++;
          } else {
            await swUpdateOutboxEvent(db, event.id, {
              status: 'FAILED',
              errorMessage: msg,
              updatedAt: new Date().toISOString(),
            });
            failed++;
          }
        }
      } else {
        // 5xx → transitoire (redémarrage Railway, cold start) → PENDING
        await swUpdateOutboxEvent(db, event.id, { status: 'PENDING', updatedAt: new Date().toISOString() });
        stillPending++;
      }
    } catch {
      // Réseau encore KO → PENDING (nouvelle tentative au prochain sync)
      await swUpdateOutboxEvent(db, event.id, { status: 'PENDING', updatedAt: new Date().toISOString() });
      stillPending++;
    }
  }

  // Notifier les pages (rafraîchissement des badges + invalidation queries)
  swBroadcast({
    type: 'OUTBOX_SYNCED',
    replayed,
    failed,
    stillPending,
    source: 'sw',
  });

  // Re-armaison si des événements restent en attente (le SW peut être tué —
  // Background Sync re-firera de toute façon à la prochaine connectivité).
  if (stillPending > 0) {
    try { await self.registration.sync.register('ah-sync-pending'); } catch { /* non critique */ }
  }

  return { replayed, failed, stillPending };
}

// ─── MESSAGE : update manuelle + pré-cache de module ─────────────────────
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING' || event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // ⭐ v3.3.1 — Version du SW actif : le client la compare à la version
  //    enregistrée lors du dernier pré-cache des modules (les caches
  //    ah-pages-<version> sont purgés à chaque bump → le pré-cache doit
  //    être refait). Réponse envoyée à la source du message (la page).
  if (event.data?.type === 'GET_SW_VERSION') {
    try {
      if (event.source && typeof event.source.postMessage === 'function') {
        event.source.postMessage({ type: 'SW_VERSION', version: SW_VERSION });
      }
    } catch {
      /* client parti — non-bloquant */
    }
  }
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      Promise.all(
        names
          .filter((n) => n !== AUTH_CACHE)
          .map((n) => caches.delete(n)),
      );
    });
  }

  // ⭐ v4.6.0 — CONSULTATION DE CACHE POUR LA NAVIGATION HORS LIGNE :
  //    OfflineNavigation (capture des clics) demande si la route cible a un
  //    payload RSC et/ou un HTML en cache AVANT de choisir entre navigation
  //    SPA (fluide, aucun rechargement) et navigation complète (fallback).
  //    Réponse : { type: 'AH_HAS_ROUTE_CACHE_RESULT', href, hasRsc, hasHtml }.
  if (event.data && event.data.type === 'AH_HAS_ROUTE_CACHE' && typeof event.data.href === 'string') {
    event.waitUntil(
      (async () => {
        let hasRsc = false;
        let hasHtml = false;
        try {
          const u = new URL(event.data.href, self.location.origin);
          if (u.origin === self.location.origin) {
            const rscCache = await caches.open(RSC_CACHE);
            hasRsc = !!(await matchRouteCache(rscCache, rscCacheKey(u.toString())));
            if (!hasRsc) {
              const pageCache = await caches.open(PAGE_CACHE);
              hasHtml = !!(await matchRouteCache(pageCache, u.pathname));
            }
          }
        } catch { /* consultation best-effort */ }
        try {
          if (event.source && typeof event.source.postMessage === 'function') {
            event.source.postMessage({
              type: 'AH_HAS_ROUTE_CACHE_RESULT',
              href: event.data.href,
              hasRsc,
              hasHtml,
            });
          }
        } catch { /* client parti — non-bloquant */ }
      })(),
    );
  }

  // ⭐ PRÉ-CACHE DE MODULE — le client demande au SW de fetcher une route
  //    et de mettre en cache son HTML + les chunks JS/CSS référencés.
  //    ⭐ v3.4.0 — la source du message est passée au pré-cache pour l'ACK
  //    (PRECACHE_MODULE_RESULT) : le client sait désormais si la route a
  //    RÉELLEMENT été mise en cache (fini le fire-and-forget aveugle).
  // ⭐ v4.8.0 — Epoch de build courante (hash des chunks du dernier shell
  //    frais servi en ligne) : le client la compare à celle de son dernier
  //    pré-cache — différente = déploiement détecté → re-pré-cache immédiat
  //    (rattrape un BUILD_EPOCH_CHANGED manqué : onglet fermé, SW démarré
  //    entre-temps, multi-onglets…).
  if (event.data?.type === 'GET_BUILD_EPOCH') {
    event.waitUntil((async () => {
      try {
        const epoch = await getStoredBuildEpoch();
        if (event.source && typeof event.source.postMessage === 'function') {
          event.source.postMessage({ type: 'BUILD_EPOCH', epoch });
        }
      } catch { /* non-bloquant */ }
    })());
  }

  // ⭐ v4.8.0 — `anonymous` : pages publiques (/login, /portal, /) pré-cachées
  //    SANS credentials (connecté, le middleware les redirige sinon → jamais
  //    cachées → déconnexion hors ligne sans page fraîche).
  if (event.data && event.data.type === 'PRECACHE_MODULE' && event.data.url) {
    event.waitUntil(precacheModule(event.data.url, event.source, event.data.anonymous === true));
  }

  // ⭐ v3.5.0 — Origine réelle de l'API (cross-origin axios) : la page
  //    (OfflineSWRegister) l'envoie à chaque chargement — le SW est isolé du
  //    DOM et ne peut pas lire getApiBaseUrl() lui-même. Un redémarrage du SW
  //    perd la valeur → la page la renvoie à chaque register().
  if (event.data && event.data.type === 'SET_API_ORIGIN' && typeof event.data.origin === 'string') {
    try {
      const u = new URL(event.data.origin);
      apiOriginOverride = u.origin;
    } catch {
      /* origine invalide — on garde la dérivation */
    }
  }

  // ⭐ v3.6.0 — Pré-cache des DONNÉES API (TOUS les modules, pas seulement
  //    les dashboards) : le client envoie la liste des endpoints + ses
  //    headers d'authentification ; le SW fetch chaque endpoint et l'écrit
  //    dans ah-api sous la clé normalisée (tenant|user). Hors ligne, les
  //    modules servent les VRAIES données sans visite préalable.
  //    ACK « skip-aware » : 400/401/403/404/405 = endpoint non applicable à
  //    ce rôle (skipCount) — pas un échec (le flag 24 h reste posable).
  if (event.data && event.data.type === 'PRECACHE_API' && Array.isArray(event.data.urls)) {
    event.waitUntil(
      precacheApiEndpoints(event.data.urls, event.data.headers || {}, event.source),
    );
  }

  // ⭐ V4.0 — TRIGGER_SYNC : la page (pont OfflineSWRegister, événement
  //    window 'online' + ⭐ v4.7.0 chargement de page et OUTBOX_CHANGED
  //    « fantôme online ») demande au SW de rejouer sa file de mutations
  //    (utile quand Background Sync n'est pas supporté/retarde — iOS, Safari).
  if (event.data && event.data.type === 'TRIGGER_SYNC') {
    event.waitUntil(
      (async () => {
        // ⭐ v4.7.0 — Hors ligne RÉEL : inutile de marteler le serveur à
        //    chaque chargement de page (chaque événement = 1 fetch voué à
        //    l'échec) — Background Sync et le retour du réseau relanceront.
        //    Le « fantôme online » (navigator.onLine true mais réseau KO)
        //    reste couvert : la tentative part, échoue, reste PENDING.
        if (self.navigator && self.navigator.onLine === false) return;
        try {
          await swReplayPendingMutations();
        } catch {
          /* non-critique */
        }
      })(),
    );
  }
});

// ─── Pré-cache des données API (v3.5.0 → v3.6.0 étendu) ────────────────────
/**
 * Fetch chaque endpoint et l'écrit dans ah-api avec la MÊME clé normalisée
 * que celle que calculera la requête réelle de la page (apiIdentity sur les
 * headers fournis → tenant|user). ACK global PRECACHE_API_RESULT.
 *
 * Headers fournis par le client : Authorization (Bearer JWT) + X-Tenant-ID —
 * les mêmes que ceux des appels axios/fetch de la page → même identité →
 * même clé → le cache est retrouvé hors ligne.
 *
 * ⚠️ CORS : les endpoints cross-origin (api.<domaine>) sont fetch avec
 * credentials 'omit' — exactement comme axios sans withCredentials → le
 * préflight OPTIONS Authorization est le même que celui des appels réels.
 */
async function precacheApiEndpoints(urls, headers, sourceClient) {
  const cache = await caches.open(API_CACHE);

  const authHeaders = {};
  const authz = headers.authorization || headers.Authorization;
  if (authz) authHeaders['Authorization'] = String(authz);
  const xtid = headers['x-tenant-id'] || headers['X-Tenant-ID'] || headers['X-Tenant-Id'];
  if (xtid) authHeaders['X-Tenant-ID'] = String(xtid);

  // ⭐ v3.6.0 — Compteurs séparés :
  //    okCount   → 200 JSON réellement cachés
  //    skipCount → 400/401/403/404/405 : le serveur a RÉPONDU mais l'endpoint
  //                n'est pas applicable à ce rôle / ces params (ex. un
  //                enseignant sur /api/finance/*). CE N'EST PAS UN ÉCHEC —
  //                sinon un rôle à périmètre restreint faisait échouer tout
  //                le pré-cache (flag jamais posé → retries permanents).
  //    (les autres cas — réseau KO, 5xx, timeout, non-JSON — restent échecs)
  let okCount = 0;
  let skipCount = 0;
  // ⭐ v3.6.0 — 6 en parallèle (au lieu de 4) : ~230 endpoints + vague
  //    dynamique à pré-cacher en arrière-plan sans occuper la journée.
  //    ⭐ v4.9.0 — retour à 4 EN PARALLÈLE + CESSION DE PRIORITÉ : avant chaque
  //    lot, on attend que les requêtes VISIBLES de la page (compteur
  //    pageRequestsInFlight) soient terminées — le pré-cache ne doit JAMAIS
  //    affamer les données que l'utilisateur regarde (fix « chargements
  //    > 30 s » production 2026-09-30 : connexion école + 6 fetch permanents
  //    + sémaphore backend 20 slots → famine des modules métier).
  const BATCH = 4;
  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH);
    if (!self.navigator || self.navigator.onLine === false) {
      // Connexion perdue en cours de pré-cache → arrêt (le client reprendra
      // au retour du réseau — le flag n'est posé qu'en cas de succès).
      break;
    }
    // ⭐ v4.9.0 — Les requêtes de la page passent TOUJOURS d'abord.
    await waitForIdlePageTraffic();
    await Promise.allSettled(
      batch.map(async (rawUrl) => {
        try {
          const absolute = new URL(String(rawUrl), self.location.origin);
          const isCrossOrigin = absolute.origin !== self.location.origin;
          const req = new Request(absolute.toString(), {
            method: 'GET',
            credentials: isCrossOrigin ? 'omit' : 'include',
            headers: { ...authHeaders, Accept: 'application/json' },
          });
          const res = await fetchWithTimeout(req, 15000);
          if (res && res.status === 200 && !res.redirected) {
            const ct = res.headers.get('content-type') || '';
            if (ct.includes('json')) {
              const identity = apiIdentity(req);
              if (identity !== null) {
                const key = apiCacheKey(req, identity);
                const copy = await toCacheableCopy(res);
                await cache.put(new Request(key), copy);
                okCount++;
              }
            }
          } else if (res && [400, 401, 403, 404, 405].includes(res.status)) {
            // ⭐ v3.6.0 — endpoint non applicable (rôle/périmètre/params) → skip
            try { await res.body?.cancel(); } catch { /* déjà consommé */ }
            skipCount++;
          }
        } catch {
          /* endpoint échoué — compté comme non-caché, retry au prochain cycle */
        }
      }),
    );

    // ⭐ v4.1.0 — PROGRESSION par batch (toutes les 6 URLs) → l'indicateur
    //    utilisateur « Préparation hors ligne · NN % » avance en direct.
    if (sourceClient && typeof sourceClient.postMessage === 'function') {
      try {
        sourceClient.postMessage({
          type: 'PRECACHE_API_PROGRESS',
          done: Math.min(i + BATCH, urls.length),
          total: urls.length,
        });
      } catch {
        /* client parti — non-bloquant */
      }
    }
  }

  trimApiCache().catch(() => {});

  if (sourceClient && typeof sourceClient.postMessage === 'function') {
    try {
      sourceClient.postMessage({
        type: 'PRECACHE_API_RESULT',
        okCount,
        skipCount,
        total: urls.length,
      });
    } catch {
      /* client parti — non-bloquant */
    }
  }
}

// ─── Pré-cache d'un module (HTML + chunks JS/CSS + payload RSC) ───────────
/**
 * ⭐ v3.4.0 — Trois changements :
 *   1. ACK systématique à la page émettrice (PRECACHE_MODULE_RESULT) — le
 *      client ne marque le pré-cache « frais » que si les routes réussissent.
 *   2. Le HTML est stocké via une copie SANS Vary (le Cache.match d'une
 *      navigation réelle échouait sur les entrées stockées avec Vary).
 *   3. Le payload RSC de la route est pré-caché (best-effort) → navigation
 *      client hors ligne SANS rechargement dur ; si le payload ne matche pas
 *      les attentes du routeur, celui-ci retombe de toute façon sur la
 *      navigation dure → HTML caché (comportement v3.3).
 */
/**
 * ⭐ v4.3.0 — CRAWL DU GRAPHE DE CHUNKS (build Turbopack).
 * PROBLÈME (retour terrain sept. 2026 : « connexion instable » module
 * élèves + onglet Enseignants & affectations) : les composants en
 * next/dynamic(…, { ssr: false }) — StudentsModulePage, dashboards des
 * portails… — ne figurent PAS dans le HTML pré-rendu : leur chunk est
 * résolu APRÈS hydratation via les maps de modules du runtime Turbopack
 * (turbopack-<hash>.js). Hors ligne, ce chunk manquait dans
 * ah-static-immutable → ChunkLoadError → error boundary « Connexion
 * instable ». Le HTML initial de /app/students ne référence que ~33
 * chunks alors que le navigateur en demande 37 (6 paresseux).
 * CORRECTIF : après le pré-cache des chunks du HTML, on SCANNE le contenu
 * des chunks pour y trouver les références /_next/static/immutable/chunks
 * /*.js|css et on pré-cache les chunks découverts en cascade (profondeur
 * 2, cap anti-dérive). Vérifié en production : le crawl couvre 100 % des
 * chunks paresseux demandés par le navigateur. Les chunks partagés déjà
 * en cache ne sont pas re-téléchargés ; un Set « déjà scannés » évite de
 * relire le même chunk pour chaque route du pré-cache.
 */
const CHUNK_REF_REGEX = /immutable\/chunks\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:js|css)/g;
const CHUNK_CRAWL_DEPTH = 3;
const CHUNK_CRAWL_MAX_NEW = 120; // par route — anti-dérive 2G/3G (v4.8.0 : 80→120, build Turbopack plus fragmenté)
const scannedChunks = new Set();

async function crawlChunkGraph(staticCache, seedUrls) {
  const origin = self.location.origin;
  const queue = [];
  for (const u of seedUrls) {
    try {
      const abs = new URL(u, origin).href;
      if (!scannedChunks.has(abs)) queue.push(abs);
    } catch { /* URL invalide — ignorée */ }
  }
  let newCached = 0;
  let frontier = queue;
  for (let depth = 0; depth < CHUNK_CRAWL_DEPTH; depth++) {
    const nextFrontier = [];
    for (const chunkUrl of frontier) {
      if (newCached >= CHUNK_CRAWL_MAX_NEW) break;
      // Déjà scanné dans une route précédente → ses refs sont déjà traitées
      if (scannedChunks.has(chunkUrl)) continue;
      scannedChunks.add(chunkUrl);
      let text = null;
      try {
        const existing = await staticCache.match(chunkUrl);
        if (existing) {
          text = await existing.text();
        } else {
          const res = await fetchWithTimeout(new Request(chunkUrl), 8000);
          if (res && res.ok) {
            const copy = res.clone();
            text = await res.text();
            await staticCache.put(chunkUrl, copy);
            newCached++;
          }
        }
      } catch { continue; }
      if (!text) continue;
      const refs = text.match(CHUNK_REF_REGEX) || [];
      for (const ref of refs) {
        const abs = origin + '/_next/static/' + ref;
        if (!scannedChunks.has(abs)) nextFrontier.push(abs);
      }
    }
    frontier = nextFrontier.filter((u) => !scannedChunks.has(u));
    if (!frontier.length || newCached >= CHUNK_CRAWL_MAX_NEW) break;
  }
  return newCached;
}

/** ⭐ v4.8.0 — Pré-cache d'une route. `anonymous` (credentials omit) pour les
 *  pages PUBLIQUES (/login, /portal, /) : connecté, le middleware les
 *  REDIRIGE (302 → /app ou sélection de portail) — une réponse redirigée
 *  n'est JAMAIS cachée (garde anti-empoisonnement) → ces pages restaient
 *  sans entrée fraîche → la DÉCONNEXION hors ligne tombait sur un HTML
 *  périmé sans ses chunks. En anonyme, le middleware sert la page publique 200. */
async function precacheModule(routeUrl, sourceClient, anonymous) {
  let htmlOk = false;
  let rscOk = false;
  try {
    // ⭐ v4.9.0 — CESSION DE PRIORITÉ aux requêtes visibles de la page avant
    //    chaque route pré-cachée (112 routes × HTML+RSC+chunks : la tempête
    //    de fond ne doit pas affamer les données de l'utilisateur).
    await waitForIdlePageTraffic();
    const cache = await caches.open(PAGE_CACHE);
    const staticCache = await caches.open(IMMUTABLE_CACHE); // ⭐ chunks immuables — cache persistant

    const response = await fetchWithTimeout(new Request(routeUrl, {
      credentials: anonymous ? 'omit' : 'include',
      headers: { Accept: 'text/html,application/xhtml+xml' },
    }), 10000);

    if (response && response.ok && !response.redirected) {
      // ⭐ v3.4.0 — copie SANS Vary : les navigations réelles (?tenant=…, sans
      //    headers RSC) matchent désormais l'entrée (Vary: RSC, Next-Router-*
      //    faisait échouer le matching de Cache).
      //    ⚠️ PAS de cache des réponses REDIRIGÉES (tenant invalide/session
      //    expirée → middleware renvoie /portal ou /login : embarquer cette
      //    page sous la clé du module empoisonnerait le cache offline).
      const headers = cacheableHeaders(response);
      const html = await response.text();
      await cache.put(routeUrl, new Response(html, {
        status: response.status,
        statusText: response.statusText,
        headers,
      }));
      htmlOk = true;

      // ⭐ v4.8.0 — ÉPOCH DE BUILD pour les routes SHELL (/app, /promoteur) :
      //    leur ensemble de chunks est déterministe par build → haché et
      //    comparé au dernier pré-cache ; changement = déploiement détecté
      //    (même sans bump de sw.js) → BUILD_EPOCH_CHANGED aux clients.
      try {
        const routePath = new URL(routeUrl).pathname;
        if (routePath === '/app' || routePath === '/app/' || routePath === '/promoteur') {
          await trackBuildEpochFromHtml(html);
        }
      } catch { /* non-bloquant */ }

      const chunkUrls = new Set();

      const scriptRegex = /<script[^>]+src=["']([^"']+)["']/g;
      const linkRegex = /<link[^>]+href=["']([^"']+)["']/g;

      let match;
      while ((match = scriptRegex.exec(html)) !== null) {
        const src = match[1];
        if (src && (src.includes('/_next/') || src.endsWith('.js'))) {
          chunkUrls.add(new URL(src, routeUrl).href);
        }
      }
      while ((match = linkRegex.exec(html)) !== null) {
        const href = match[1];
        if (href && (href.includes('/_next/') || href.endsWith('.css'))) {
          chunkUrls.add(new URL(href, routeUrl).href);
        }
      }

      const chunks = Array.from(chunkUrls);
      const BATCH = 4; // ⭐ v4.9.0 — 5 → 4 + cession de priorité par lot
      for (let i = 0; i < chunks.length; i += BATCH) {
        const batch = chunks.slice(i, i + BATCH);
        await waitForIdlePageTraffic();
        await Promise.allSettled(
          batch.map(async (chunkUrl) => {
            try {
              const existing = await staticCache.match(chunkUrl);
              if (existing) return; // déjà caché, skip
              const chunkRes = await fetchWithTimeout(new Request(chunkUrl), 8000);
              if (chunkRes && chunkRes.ok) {
                await staticCache.put(chunkUrl, chunkRes.clone());
              }
            } catch {
              // Non-bloquant
            }
          }),
        );
      }

      // ⭐ v4.3.0 — CRAWL du graphe de chunks : découvre les chunks PARESSEUX
      //    (dynamic ssr:false) référencés uniquement dans les maps du runtime
      //    Turbopack — sans cela, l'ouverture du module hors ligne déclenchait
      //    l'error boundary « Connexion instable » (élèves, affectations…).
      try {
        await crawlChunkGraph(staticCache, chunks);
      } catch {
        // Non-bloquant — le HTML reste le filet de sécurité
      }
    }

    // ⭐ v3.4.0 — PRÉ-CACHE RSC (best-effort, APRÈS l'HTML qui reste la
    //    priorité) : payload flight de la route sous clé normalisée (sans
    //    _rsc). Ne bloque JAMAIS l'ACK HTML.
    try {
      await waitForIdlePageTraffic(); // ⭐ v4.9.0 — page d'abord
      const rscCache = await caches.open(RSC_CACHE);
      const rscUrl = routeUrl + (routeUrl.includes('?') ? '&' : '?') + '_rsc=precache';
      const rscRes = await fetchWithTimeout(new Request(rscUrl, {
        credentials: anonymous ? 'omit' : 'include',
        headers: { RSC: '1', Accept: 'text/x-component' },
      }), 10000);
      if (rscRes && rscRes.ok && !rscRes.redirected) {
        const key = rscCacheKey(rscUrl);
        const copy = await toCacheableCopy(rscRes);
        await rscCache.put(new Request(key), copy);
        rscOk = true;
        trimRscCache();
      }
    } catch {
      // Best-effort : la navigation dure (HTML caché) reste le filet de sécurité
    }
  } catch {
    // Non-bloquant — l'ACK ok:false informe le client (retry / pas de flag)
  }

  // ⭐ v3.4.0 — ACK SYSTÉMATIQUE (même en échec) : le client marque le
  //    pré-cache « frais » uniquement si les routes réussissent réellement.
  if (sourceClient && typeof sourceClient.postMessage === 'function') {
    try {
      sourceClient.postMessage({
        type: 'PRECACHE_MODULE_RESULT',
        url: routeUrl,
        ok: htmlOk,
        rscOk,
      });
    } catch {
      /* client parti — non-bloquant */
    }
  }

  // ⭐ v3.8.0 — le cache pages est PERSISTANT (jamais purgé) → LRU après
  //    chaque écriture pour borner la croissance (112 routes pré-cachées +
  //    pages visitées + pages publiques ≈ 150-200 entrées en pratique).
  if (htmlOk) trimPageCache().catch(() => {});
}

/* ══════════════════════════════════════════════════════════════════════════
   BACKGROUND SYNC API — push de l'outbox quand l'onglet est fermé
   ══════════════════════════════════════════════════════════════════════════ */

// Constantes en phase avec local-db.service.ts (DB 'academia-helm-local'),
// client-access-token.ts (cache 'ah-auth-token') et sync-engine.service.ts
// (endpoint '/api/sync/push', batch 50).
const SW_DB_NAME = 'academia-helm-local';
const SW_OUTBOX_STORE = 'outbox_events';
const SW_AUTH_CACHE_NAME = 'ah-auth-token';
const SW_AUTH_TOKEN_URL = '/__sw_auth_token__';
const SW_SYNC_PUSH_BATCH = 50;
const SW_SYNC_MAX_RETRIES = 3;
const SW_DEVICE_ID = 'sw-bg-sync';

async function swGetAuthToken() {
  try {
    const cache = await caches.open(SW_AUTH_CACHE_NAME);
    const response = await cache.match(SW_AUTH_TOKEN_URL);
    if (!response) return null;
    const text = await response.text();
    return text && text.trim() ? text.trim() : null;
  } catch {
    return null;
  }
}

// ⭐ V4.0 — ouverture SANS version (l'app gère le schéma, version 18 —
//    l'ancienne ouverture versionnée (15) levait VersionError dès que l'app
//    avait migré la base : la couche IDB du SW était morte en production).
function swOpenLocalDB() {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(SW_DB_NAME);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IDB open blocked'));
    } catch (err) {
      reject(err);
    }
  });
}

function swReadPendingEvents(db, limit = 500) {
  return new Promise((resolve, reject) => {
    try {
      if (!db.objectStoreNames.contains(SW_OUTBOX_STORE)) {
        resolve([]);
        return;
      }
      const tx = db.transaction([SW_OUTBOX_STORE], 'readonly');
      const store = tx.objectStore(SW_OUTBOX_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const all = req.result || [];
        // ⭐ V4.0 — LEGACY UNIQUEMENT : les événements portant
        //    metadata.request (SW OU couche applicative) sont rejoués par
        //    replay HTTP EXACT (swReplayPendingMutations pour les .sw ;
        //    sync-engine.service pour les autres) — les POUSSER AUSSI par
        //    le batch générique /api/sync/push créerait des DOUBLONS
        //    (défaut de la v3.9 : double-push silencieux masqué par les
        //    échecs de colonnes du INSERT générique).
        const pending = all
          .filter((e) => {
            if (!e || e.status !== 'PENDING') return false;
            let meta = null;
            try { meta = typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata; } catch { meta = null; }
            return !(meta && meta.request);
          })
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          .slice(0, limit);
        resolve(pending);
      };
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

function swUpdateEventStatus(db, eventId, patch) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction([SW_OUTBOX_STORE], 'readwrite');
      const store = tx.objectStore(SW_OUTBOX_STORE);
      const getReq = store.get(eventId);
      getReq.onsuccess = () => {
        const event = getReq.result;
        if (!event) {
          resolve();
          return;
        }
        const putReq = store.put({ ...event, ...patch });
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    } catch (err) {
      reject(err);
    }
  });
}

function swToBackendOperation(event) {
  const tableName = (event.entityType || '').toLowerCase() + 's';
  const opMap = { CREATE: 'INSERT', UPDATE: 'UPDATE', DELETE: 'DELETE' };
  const operationType = opMap[event.operation] || event.operation;

  let payload = event.payload;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      // Garder la string brute — le backend gérera
    }
  }
  payload = {
    ...(payload || {}),
    tenantId: event.tenantId,
    version: event.localVersion ?? 1,
  };

  return {
    id: event.id,
    local_id: event.id, // ⭐ idempotence backend
    table_name: tableName,
    record_id: event.entityId,
    operation_type: operationType,
    payload,
    local_updated_at: event.createdAt,
    device_id: SW_DEVICE_ID,
    priority: event.priority || 0,
  };
}

async function swPushBatch(authToken, tenantId, operations) {
  const body = {
    tenantId,
    sqliteSchemaHash: 'unknown',
    sqliteVersion: '1',
    device_id: SW_DEVICE_ID,
    operations,
  };

  const headers = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch('/api/sync/push', {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Push HTTP ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * ⭐ Orchestrateur du push background.
 *    NB TENANT-STRICT : les events outbox de l'ANCIEN tenant (appareil partagé)
 *    sont purgés à la bascule par offline-bootstrap.service — et même s'il en
 *    restait, le serveur bloque toute écriture cross-tenant (JWT prime).
 */
async function swPushOutboxFromIDB() {
  const authToken = await swGetAuthToken();
  if (!authToken) {
    return; // Pas de token → rien à pousser (login au prochain chargement)
  }

  let db;
  try {
    db = await swOpenLocalDB();
  } catch {
    return; // Base absente → rien à faire
  }

  let pendingEvents;
  try {
    pendingEvents = await swReadPendingEvents(db, 500);
  } catch {
    return;
  }

  if (pendingEvents.length === 0) return;

  // Grouper par tenantId (le serveur n'applique que le tenant du JWT)
  const byTenant = new Map();
  for (const event of pendingEvents) {
    const tid = event.tenantId;
    if (!tid) continue;
    if (!byTenant.has(tid)) byTenant.set(tid, []);
    byTenant.get(tid).push(event);
  }

  for (const [tenantId, events] of byTenant) {
    for (let i = 0; i < events.length; i += SW_SYNC_PUSH_BATCH) {
      const batch = events.slice(i, i + SW_SYNC_PUSH_BATCH);
      const operations = batch.map(swToBackendOperation);

      let success = false;
      for (let attempt = 1; attempt <= SW_SYNC_MAX_RETRIES; attempt++) {
        try {
          const result = await swPushBatch(authToken, tenantId, operations);
          const results = Array.isArray(result?.results) ? result.results : [];
          const resultById = new Map(results.map((r) => [r.operation_id, r]));

          for (const event of batch) {
            const r = resultById.get(event.id);
            if (!r) continue;
            if (r.status === 'SUCCESS') {
              await swUpdateEventStatus(db, event.id, {
                status: 'ACKNOWLEDGED',
                syncedAt: new Date().toISOString(),
              });
            } else if (r.status === 'CONFLICT') {
              await swUpdateEventStatus(db, event.id, {
                status: 'CONFLICT',
                errorMessage: r.conflict_reason || 'Conflit',
                attemptCount: (event.attemptCount || 0) + 1,
                lastAttemptAt: new Date().toISOString(),
              });
            } else {
              await swUpdateEventStatus(db, event.id, {
                status: 'FAILED',
                errorMessage: r.error_message || 'Erreur (SW push)',
                retryCount: (event.retryCount || 0) + 1,
                attemptCount: (event.attemptCount || 0) + 1,
                lastAttemptAt: new Date().toISOString(),
              });
            }
          }

          success = true;
          break;
        } catch {
          if (attempt < SW_SYNC_MAX_RETRIES) {
            const delayMs = 1000 * Math.pow(2, attempt - 1);
            await new Promise((r) => setTimeout(r, delayMs));
          }
        }
      }
      // Échec réseau après retries → events laissés PENDING (retry au prochain sync)
    }
  }
}

self.addEventListener('sync', (event) => {
  // ⭐ V4.0 — FILE DU SW (mutations interceptées par handleApiMutation) :
  //    replay HTTP EXACT des événements metadata.sw, PUIS push générique
  //    legacy (événements sans metadata.request), PUIS notification des
  //    clients (pull + MAJ UI).
  if (event.tag === 'ah-sync-pending') {
    event.waitUntil(
      (async () => {
        try {
          await swReplayPendingMutations();
        } catch {
          // Non-critique — retry au prochain event
        }
        try {
          await swPushOutboxFromIDB();
        } catch {
          // Non-critique — retry au prochain event
        }
        try {
          const clients = await self.clients.matchAll({ includeUncontrolled: true });
          clients.forEach((client) => {
            client.postMessage({ type: 'BACKGROUND_SYNC_TRIGGER', source: 'sw' });
          });
        } catch {
          // Non-critique
        }
      })(),
    );
    return;
  }

  if (event.tag === 'sync-outbox') {
    event.waitUntil(
      (async () => {
        try {
          await swPushOutboxFromIDB();
        } catch {
          // Non-critique — retry au prochain event
        }
        // Notifier les clients ouverts (pull + MAJ UI — source 'sw')
        try {
          const clients = await self.clients.matchAll({ includeUncontrolled: true });
          clients.forEach((client) => {
            client.postMessage({ type: 'BACKGROUND_SYNC_TRIGGER', source: 'sw' });
          });
        } catch {
          // Non-critique
        }
      })(),
    );
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   WEB PUSH — notifications (chat, alertes finance, absences, etc.)
   ══════════════════════════════════════════════════════════════════════════ */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Academia Helm', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Academia Helm';
  const options = {
    body: data.body || data.preview || '',
    icon: data.icon || '/web-app-manifest-192x192.png',
    badge: data.badge || '/web-app-manifest-192x192.png',
    data: {
      url: data.data?.url || data.url || '/',
      notificationId: data.data?.notificationId || null,
    },
    tag: data.tag || 'academia-helm-notification',
    requireInteraction: data.requireInteraction || false,
    silent: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Notification click : focus ou ouvrir l'URL ───────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Chercher un onglet existant sur la même origine
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          // PostMessage pour que le frontend navigue vers l'URL
          client.postMessage({ type: 'NOTIFICATION_CLICK', url: targetUrl });
          return;
        }
      }
      // Aucun onglet ouvert → en ouvrir un nouveau
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});

// ─── Push subscription change : re-souscription ───────────────────────────
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      clientList.forEach((client) => {
        client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGE' });
      });
    }),
  );
});

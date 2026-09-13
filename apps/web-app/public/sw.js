/**
 * ============================================================================
 * SERVICE WORKER UNIFIÉ — Academia Helm (v4.1 « offline exhaustif + visible »)
 * ============================================================================
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

// v4.1.1 : au-dessus de v4.1.0 (pré-cache exhaustif) — bump pour que le
//    correctif API_TIMEOUT 12 s (sélecteurs header) soit bien déployé chez
//    tous les utilisateurs existants (SW_ACTIVATED → re-pré-cache).
const SW_VERSION = 'v4.2.1';
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
const RSC_TIMEOUT = 4000;

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
const API_CACHE_MAX = 1200;
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
  '/tarification',
  '/modules',
  '/contact',
  '/actualites',
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
  // ⭐ V4.0 — PASSERELLES DE PAIEMENT EXTERNES (Fedapay/FeexPay) : JAMAIS
  //    interceptées, ni en lecture ni en écriture. L'argent passe par des
  //    transactions externes qui ne peuvent être « rejouées » localement —
  //    spec §6 : aucune confirmation automatique sur l'argent. Hors ligne,
  //    ces appels échouent honnêtement (l'UI affiche l'erreur réseau).
  /^\/api\/(finance\/payments\/(fedapay|feexpay)|billing\/(feexpay|fedapay))(\/|$)/,
  // ⭐ V4.0 — Génération de documents / exports / téléchargements binaires :
  //    réponses non-JSON (PDF, XLSX, ZIP…) — ni cachables ni « fabricables ».
  /\/(export|receipt\.pdf|download|\/pdf)(\/|$|\?)/,
  /^\/platform\//, // back-office admin
  /^\/patronat(\/|$)/,
  /^\/saisiemaster(\/|$)/,
  /^\/admin(\/|$)/, // routes admin
  /^\/sign\//, // signature de contrats (tokens)
  /^\/receipt\//, // reçus (tokens)
  /^\/sw[\w.-]*\.js$/, // scripts service worker
  /^\/manifest.*\.webmanifest$/, // manifests dynamiques (toujours frais)
];

// ⭐ Timeouts : Neon cold start = 10-13 s → 8 s HTML avant fallback shell
const HTML_TIMEOUT = 8000;

// ─── INSTALL : pré-cache du shell hors ligne ──────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) =>
        Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(new Request(url, { cache: 'reload' })))),
      )
      .then(() => self.skipWaiting()),
  );
});

// ─── ACTIVATE : nettoyage des anciens caches + claim ──────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
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
    event.respondWith(handleApiMutation(request));
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
    event.respondWith(handleApiGet(request, CROSS_API_TIMEOUT));
    return;
  }

  // ⭐ v3.2.0 — Requêtes RSC/flight du routeur Next 16 (navigation client) :
  //    `rsc: 1` (navigation), `next-router-prefetch: 1` (préchargement liens),
  //    `next-router-segment-prefetch` (segments), `?_rsc=` (clé de cache).
  //    AVANT : aucune interception → hors ligne, échec réseau direct →
  //    SPINNER INFINI au changement de module. MAINTENANT : cache + 503 rapide.
  if (isRscRequest(request, url)) {
    event.respondWith(handleRsc(request));
    return;
  }

  // ⭐ v3.3.0 — API GET /api/* : NetworkFirst + cache identitaire + fallback
  //    offline (les chemins auth/sync/webhooks ont déjà été exclus par
  //    NEVER_INTERCEPT ci-dessus ; les non-GET sont sortis en tête de handler).
  if (pathname.startsWith('/api/')) {
    event.respondWith(handleApiGet(request));
    return;
  }

  // ⭐ Chunks immuables /_next/static/ → cache PERSISTANT + retry réseau
  if (IMMUTABLE_ASSET_PATTERNS.some((pattern) => pattern.test(request.url))) {
    event.respondWith(serveImmutable(request));
    return;
  }

  // ─── Assets statiques (mutables) : CacheFirst ────────────────────────
  if (STATIC_ASSET_PATTERNS.some((pattern) => pattern.test(request.url))) {
    event.respondWith(
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
    // ⭐ PATTERN APP-SHELL : les navigations /app/* passent par le shell
    //    pré-caché → l'app React démarre depuis le cache, les données viennent
    //    d'IndexedDB. AUCUNE page « hors ligne » n'est jamais substituée.
    if (pathname.startsWith('/app')) {
      event.respondWith(handleAppShellNavigation(request));
      return;
    }

    // Pages publiques autorisées au cache HTML
    if (CACHEABLE_HTML_PATTERNS.some((pattern) => pattern.test(pathname))) {
      event.respondWith(handlePublicPageNavigation(request));
      return;
    }

    // Autres navigations (non listées) → réseau direct, PAS d'interception
    return;
  }

  // Chunks JS/CSS dynamiques Next.js (hors /static/) → cache persistant + retry
  if (url.pathname.includes('/_next/') && (pathname.endsWith('.js') || pathname.endsWith('.css'))) {
    event.respondWith(serveImmutable(request));
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
 *    d'URL → on utilise un query param (préservé dans request.url). */
function apiCacheKey(request, identity) {
  let base;
  try {
    const u = new URL(request.url);
    u.searchParams.delete('_t');
    u.searchParams.sort(); // ordre stable des params → même clé quel que soit l'ordre
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

/** Injecte dans le HTML du shell un script de rechargement de la vraie route
 *  au retour du réseau (+ retry différé si le serveur était juste en train de
 *  se réveiller — Neon cold start). Garde anti-boucle : max 2 rechargements
 *  auto par URL et par session onglet (sessionStorage). */
async function shellWithRecoveryScript(shellResponse) {
  try {
    const html = await shellResponse.clone().text();
    const script =
      '<script>(function(){try{' +
      'var k="ah_shell_reload_"+location.pathname;var n=0;' +
      'try{n=Number(sessionStorage.getItem(k)||0)}catch(e){}' +
      'if(n<2){try{sessionStorage.setItem(k,String(n+1))}catch(e){}' +
      'window.addEventListener("online",function(){location.reload()});' +
      'setTimeout(function(){if(navigator.onLine){location.reload()}},20000);}' +
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

async function handleAppShellNavigation(request) {
  const cache = await caches.open(PAGE_CACHE);
  const url = new URL(request.url);

  // ⭐ ÉTAPE 1 : hors ligne (navigator.onLine === false) → cache immédiat
  //    (zéro latence — pas de timeout inutile, pas de page blanche)
  if (!self.navigator || self.navigator.onLine === false) {
    // ⭐ v3.4.0 — cascade exact → ignoreSearch (liens ?tenant=…)
    const cachedExact = await matchRouteCache(cache, request);
    if (cachedExact) return cachedExact;
    // ⭐ v3.5.0 — shell /app pour TOUTE route /app/* non cachée : l'app
    //    démarre depuis le cache, l'utilisateur continue à travailler
    //    (JAMAIS de page « connexion indisponible » pour l'app).
    const cachedShell = await matchRouteCache(cache, '/app');
    if (cachedShell) {
      return url.pathname === '/app' || url.pathname === '/app/'
        ? cachedShell
        : shellWithRecoveryScript(cachedShell);
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
      toCacheableCopy(networkResponse)
        .then((copy) => cache.put(request, copy))
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
    // ⭐ v3.5.0 — shell /app pour TOUTE route /app/* (cf. ÉTAPE 1) : l'app
    //    reste utilisable + rechargement auto de la vraie route quand le
    //    serveur répond à nouveau.
    const cachedShell = await matchRouteCache(cache, '/app');
    if (cachedShell) {
      return url.pathname === '/app' || url.pathname === '/app/'
        ? cachedShell
        : shellWithRecoveryScript(cachedShell);
    }
    // Dernier recours ABSOLU (shell pas encore pré-caché, ex. SW fraîchement
    // installé offline) : redirection immédiate vers /app — le shell y sera
    // servi depuis le pré-cache d'installation (PRECACHE_URLS inclut /app).
    // Si même /app échoue, offlineMinimalResponse prendra le relai.
    if (isAppNavigation(url.pathname) && url.pathname !== '/app' && url.pathname !== '/app/') {
      return Response.redirect(new URL('/app', url.origin).toString(), 302);
    }
    return offlineMinimalResponse(url.pathname);
  }
}

// ─── Handler : navigations publiques (cache + shell, jamais de page offline) ─
async function handlePublicPageNavigation(request) {
  const cache = await caches.open(PAGE_CACHE);
  const url = new URL(request.url);

  if (!self.navigator || self.navigator.onLine === false) {
    // ⭐ v3.4.0 — cascade exact → ignoreSearch : /login?portal=school&tenant=x
    //    matche désormais l'entrée pré-cachée /login (start_url PWA).
    const cachedExact = await matchRouteCache(cache, request);
    if (cachedExact) return cachedExact;
    // ⭐ v3.2.0 : plus de shell /login|/app pour une page publique non visitée
    //    (rendre la page de connexion sous /tarification est trompeur) →
    //    réponse sobre non-bloquante.
    return offlineMinimalResponse(url.pathname);
  }

  try {
    const networkResponse = await fetchWithTimeout(request, 4000);
    if (networkResponse && networkResponse.ok && !networkResponse.redirected) {
      // ⭐ v3.4.0 — copie SANS Vary (fire-and-forget)
      toCacheableCopy(networkResponse)
        .then((copy) => cache.put(request, copy))
        .catch(() => {});
      return networkResponse;
    }
    throw new Error('Network response not ok');
  } catch {
    // ⭐ v3.4.0 — cascade exact → ignoreSearch (login/portal avec ?tenant=)
    const cachedExact = await matchRouteCache(cache, request);
    if (cachedExact) return cachedExact;
    return offlineMinimalResponse(url.pathname);
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
  [/^\/api\/students(\/|$)/, 'student', /\/(statistics|stats|transfers|documents|id-cards|admissions|movements|abandons|guardians)(\/|$)/],
  [/^\/api\/students\/.*\/guardians/, 'guardian'],
  [/^\/api\/all-classes/, 'class'],
  [/^\/api\/classes/, 'class'],
  [/^\/api\/class-students/, 'classstudent'],
  [/^\/api\/class-subjects/, 'classsubject'],
  [/^\/api\/subjects/, 'subject'],
  [/^\/api\/school-levels/, 'schoollevel'],
  [/^\/api\/attendance/, 'attendance'],
  [/^\/api\/absences/, 'absence'],
  [/^\/api\/disciplinary/, 'disciplinaryincident'],
  [/^\/api\/incidents/, 'incident'],
  [/^\/api\/homeworks/, 'homework'],
  [/^\/api\/homework-entries/, 'homeworkentry'],
  [/^\/api\/students\/transfers/, 'studenttransfer'],
  [/^\/api\/students\/documents/, 'studentdocument'],
  [/^\/api\/students\/id-cards/, 'studentidcard'],
  [/^\/api\/students\/admissions/, 'admission'],
  [/^\/api\/students\/movements/, 'studentmovement'],

  // ─── Personnel, RH & Paie ───
  [/^\/api\/hr\/staff/, 'staff', /recruit/],
  [/^\/api\/hr\/teachers/, 'teacher'],
  [/^\/api\/teachers/, 'teacher'],
  [/^\/api\/hr\/contracts/, 'contract'],
  [/^\/api\/hr\/leaves/, 'leaverequest'],
  [/^\/api\/hr\/allowances/, 'staffallowance'],
  [/^\/api\/hr\/overtime/, 'overtimerecord'],
  [/^\/api\/hr\/attendance/, 'staffattendance'],
  [/^\/api\/hr\/evaluations/, 'staffevaluation'],
  [/^\/api\/hr\/documents/, 'staffdocument'],
  [/^\/api\/hr\/school-directors/, 'schooldirectors'],
  [/^\/api\/hr\/payroll/, 'salaryslip'],
  [/^\/api\/hr\/salary-payments/, 'salarypayment'],
  [/^\/api\/hr\/positions/, 'position'],
  [/^\/api\/hr\/collaborators/, 'staff'],
  [/^\/api\/hr\/planning/, 'staffplanning'],

  // ─── Finances & Économat ───
  [/^\/api\/finance\/fee-structures\/overrides/, 'feeoverride'],
  [/^\/api\/finance\/fee-structures/, 'feestructure'],
  [/^\/api\/finance\/fee-configurations/, 'feeconfiguration'],
  [/^\/api\/finance\/fee-definitions/, 'feedefinition'],
  [/^\/api\/finance\/fee-regimes/, 'feeregime'],
  [/^\/api\/finance\/payments/, 'payment'],
  [/^\/api\/finance\/invoices/, 'invoice'],
  [/^\/api\/finance\/expenses/, 'financeexpense'],
  [/^\/api\/finance\/transactions/, 'financetransaction'],
  [/^\/api\/finance\/student-accounts/, 'studentaccount'],
  [/^\/api\/finance\/treasury/, 'treasurymovement'],
  [/^\/api\/finance\/tuition-installments/, 'tuitioninstallment'],
  [/^\/api\/finance\/tuition-payments/, 'tuitionpayment'],
  [/^\/api\/finance\/payment-plans/, 'paymentplan'],
  [/^\/api\/finance\/cash-registers/, 'cashregister'],
  [/^\/api\/finance\/collection-cases/, 'collectioncase'],
  [/^\/api\/finance\/collection-reminders/, 'collectionreminder'],
  [/^\/api\/finance\/arrears/, 'feearrear'],

  // ─── Organisation pédagogique ───
  [/^\/api\/pedagogy\/teacher-profiles/, 'teacheracademicprofile'],
  [/^\/api\/pedagogy\/teacher-availabilities/, 'teacheravailability'],
  [/^\/api\/pedagogy\/teacher-class-assignments/, 'teacherclassassignment'],
  [/^\/api\/pedagogy\/academic-structure/, 'academicclass'],
  [/^\/api\/pedagogy-space\/my-classes/, 'teacherclassassignment'],
  [/^\/api\/class-diaries/, 'classdiary'],
  [/^\/api\/lesson-plans/, 'lessonplan'],
  [/^\/api\/lesson-journals/, 'lessonjournal'],
  [/^\/api\/pedagogical-files/, 'pedagogicalfile'],
  [/^\/api\/timetables/, 'timetable'],
  [/^\/api\/pedagogy\/materials/, 'pedagogicalmaterial'],
  [/^\/api\/pedagogy\/daily-logs/, 'dailylog'],
  [/^\/api\/pedagogy\/class-logs/, 'classlog'],
  [/^\/api\/pedagogy\/subjects/, 'subject'],
  [/^\/api\/pedagogy\/teachers/, 'teacher'],
  [/^\/api\/pedagogy\/timetables/, 'timetable'],
  [/^\/api\/pedagogy\/academic-levels/, 'academiclevel'],
  [/^\/api\/pedagogy\/academic-series/, 'academicseries'],
  [/^\/api\/pedagogy\/academic-cycles/, 'academiccycle'],
  [/^\/api\/pedagogy\/rooms/, 'room'],
  [/^\/api\/pedagogy\/control/, 'pedagogicalcontrol'],
  [/^\/api\/pedagogy\/weekly-reports/, 'weeklyreport'],

  // ─── Examens, Notes & Bulletins ───
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
  [/^\/api\/settings\/identity/, 'tenantidentityprofile'],
  [/^\/api\/settings\/bilingual/, 'settingsbilingual'],
  [/^\/api\/settings\/academic/, 'schoolacademicsettings'],
  [/^\/api\/settings\/communication/, 'settingscommunication'],
  [/^\/api\/settings\/security/, 'securitysettings'],
  [/^\/api\/settings\/features/, 'tenantfeature'],
  [/^\/api\/settings\/history/, 'settingshistory'],
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
  [/^\/api\/qhse\/audits/, 'qhseaudit'],
  [/^\/api\/qhse\/incidents/, 'qhseincident'],
  [/^\/api\/qhse\/risks/, 'qhserisk'],
  [/^\/api\/qhse\/action-plans/, 'qhseactionplan'],

  // ─── EduCast / Boutique / Bibliothèque ───
  [/^\/api\/educast\/contents/, 'educastcontent'],
  [/^\/api\/educast\/channels/, 'educastchannel'],
  [/^\/api\/educast\/playlists/, 'educastplaylist'],
  [/^\/api\/shop\/products/, 'shopproduct'],
  [/^\/api\/shop\/categories/, 'shopcategory'],
  [/^\/api\/shop\/orders/, 'shoporder'],
  [/^\/api\/shop\/sales/, 'shopsale'],
  [/^\/api\/library\/books/, 'librarybook'],
  [/^\/api\/library\/loans/, 'libraryloan'],
  [/^\/api\/library\/reservations/, 'libraryreservation'],

  // ─── Modules complémentaires (BFF /api/modules-complementaires/<module>/…) ───
  [/^\/api\/modules-complementaires\/shop\/products/, 'shopproduct'],
  [/^\/api\/modules-complementaires\/shop\/categories/, 'shopcategory'],
  [/^\/api\/modules-complementaires\/shop\/orders/, 'shoporder'],
  [/^\/api\/modules-complementaires\/shop\/sales/, 'shopsale'],
  [/^\/api\/modules-complementaires\/canteen\/menus/, 'canteenmenu'],
  [/^\/api\/modules-complementaires\/canteen\/subscriptions/, 'canteensubscription'],
  [/^\/api\/modules-complementaires\/canteen\/payments/, 'canteenpayment'],
  [/^\/api\/modules-complementaires\/canteen\/attendance/, 'canteenattendance'],
  [/^\/api\/modules-complementaires\/canteen\/settings/, 'canteensetting'],
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
      if (samePath.length > 0) {
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
        samePath.sort((a, b) => (scoreOf(b) - scoreOf(a)) || ((b.cachedAt || 0) - (a.cachedAt || 0)));
        let out = samePath[0].data;
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
async function swQueueMutation(request, details, bodyText) {
  const url = request.url;
  const method = request.method;
  const { path } = swNormalizeUrl(url);
  const tenantId = details.tenantId;

  let body = null;
  if (bodyText && bodyText.trim()) {
    try { body = JSON.parse(bodyText); } catch { body = null; }
  }

  const entityType = inferEntityType(path);
  const store = routeTable(path);

  // ID de l'entité : corps → URL → généré localement
  const urlUuidMatch = url.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  const urlId = urlUuidMatch ? urlUuidMatch[0] : null;
  const entityId = (body && typeof body === 'object' && body.id) || urlId || swUuid();

  // URLs d'action /{uuid}/archive|admit|activate… → modification locale
  const actionMatch = path.match(
    /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/([a-z][a-z0-9-]*)$/i
  );
  const isActionUrl = Boolean(actionMatch && urlId && method !== 'DELETE');
  const actionName = actionMatch?.[1]?.toLowerCase() ?? '';

  const operation = method === 'POST' ? 'CREATE' : method === 'DELETE' ? 'DELETE' : 'UPDATE';

  // ─── Écriture optimiste dans le store d'entités (v3.9 portée au SW) ───
  //    L'entité créée/modifiée hors ligne est VISIBLE dans les listes (la
  //    fusion des _isDirty l'injecte dans les lectures servies hors ligne).
  let optimisticEntity = null;
  if (store && store !== 'orion_cache' && store !== 'api_cache') {
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
  const eventId = swUuid();
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
    createdAt: nowIso,
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
    const entityType = event.entityType;
    const storeName = swIdbStoreForEntityType(entityType);
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
        replayed++;
      } else if (response.status >= 400 && response.status < 500) {
        // Refus MÉTIER du serveur (validation DTO, 403, 404…) → FAILED définitif
        const text = await response.text().catch(() => '');
        let msg = 'Serveur : ' + response.status;
        try {
          const parsed = JSON.parse(text);
          msg = parsed?.message || parsed?.error || msg;
        } catch { /* corps non-JSON */ }
        await swUpdateOutboxEvent(db, event.id, {
          status: 'FAILED',
          errorMessage: msg,
          updatedAt: new Date().toISOString(),
        });
        failed++;
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

  // ⭐ PRÉ-CACHE DE MODULE — le client demande au SW de fetcher une route
  //    et de mettre en cache son HTML + les chunks JS/CSS référencés.
  //    ⭐ v3.4.0 — la source du message est passée au pré-cache pour l'ACK
  //    (PRECACHE_MODULE_RESULT) : le client sait désormais si la route a
  //    RÉELLEMENT été mise en cache (fini le fire-and-forget aveugle).
  if (event.data && event.data.type === 'PRECACHE_MODULE' && event.data.url) {
    event.waitUntil(precacheModule(event.data.url, event.source));
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
  //    window 'online') demande au SW de rejouer sa file de mutations
  //    (utile quand Background Sync n'est pas supporté/retarde — iOS, Safari).
  if (event.data && event.data.type === 'TRIGGER_SYNC') {
    event.waitUntil(
      (async () => {
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
  const BATCH = 6;
  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH);
    if (!self.navigator || self.navigator.onLine === false) {
      // Connexion perdue en cours de pré-cache → arrêt (le client reprendra
      // au retour du réseau — le flag n'est posé qu'en cas de succès).
      break;
    }
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
async function precacheModule(routeUrl, sourceClient) {
  let htmlOk = false;
  let rscOk = false;
  try {
    const cache = await caches.open(PAGE_CACHE);
    const staticCache = await caches.open(IMMUTABLE_CACHE); // ⭐ chunks immuables — cache persistant

    const response = await fetchWithTimeout(new Request(routeUrl, {
      credentials: 'include',
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
      const BATCH = 5;
      for (let i = 0; i < chunks.length; i += BATCH) {
        const batch = chunks.slice(i, i + BATCH);
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
    }

    // ⭐ v3.4.0 — PRÉ-CACHE RSC (best-effort, APRÈS l'HTML qui reste la
    //    priorité) : payload flight de la route sous clé normalisée (sans
    //    _rsc). Ne bloque JAMAIS l'ACK HTML.
    try {
      const rscCache = await caches.open(RSC_CACHE);
      const rscUrl = routeUrl + (routeUrl.includes('?') ? '&' : '?') + '_rsc=precache';
      const rscRes = await fetchWithTimeout(new Request(rscUrl, {
        credentials: 'include',
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

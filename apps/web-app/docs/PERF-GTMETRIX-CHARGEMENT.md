# Performance de chargement — Standards GTMetrix & carte unique du cache réseau

**Date : 2026-09-18** · Périmètre : `apps/web-app` (Vercel) — interfaces promoteur, directeur, secrétaire, comptable, secrétaire-comptable, enseignant (+ parent).
**Statut : document de référence UNIQUE pour toute modification de cache réseau** (chantier performance ET chantier offline Service Worker).

> ⚠️ RÈGLE DE COORDINATION (spec §9) : toute modification de stratégie de cache réseau — Service Worker, en-têtes `Cache-Control`, TTL du cache client `get-cache.ts`, `staleTime` React Query, mapping route→IndexedDB — doit être **consignée dans CE document** et testée **à la fois en ligne (métriques GTMetrix) et hors ligne (repli IndexedDB)**. Les deux chantiers touchent les mêmes couches : sans cette carte commune, ils se marchent dessus.

---

## 1. Métriques cibles (spécification GTMetrix)

| Métrique | Cible | Où mesurée |
|---|---|---|
| Largest Contentful Paint (LCP) | < 2,5 s | 1er écran de chaque rôle |
| Total Blocking Time (TBT) | < 200 ms | idem |
| Cumulative Layout Shift (CLS) | < 0,1 | idem |
| Speed Index | < 3,4 s | idem |
| Fully Loaded Time | < 4 s | idem |
| Poids total de la page | < 2 Mo par vue de module | idem |
| Nombre de requêtes réseau | < 50 par vue de module | idem |

Protocole de mesure : Lighthouse local (`npm run lighthouse`) pour itérer, GTMetrix sur `www.academiahelm.com` + un sous-domaine école pour valider. Parcours représentatif par rôle : connexion → dashboard → liste (élèves/paiements) → saisie → export/rapport.

---

## 2. Audit « avant » (2026-09-18, mesures HTTP production + analyse statique)

| Indicateur | Avant | Cause racine identifiée |
|---|---|---|
| Landing `/` — LCP réel | **≥ 6,3 s** | plancher artificiel `LANDING_MIN_LOADING_MS = 6000` |
| Landing `/` — JS+CSS+fonts initial | ~400 Ko (brotli, 31 fichiers) | conforme — pas de goulet |
| Login — JS+CSS+fonts initial | ~434 Ko (brotli, 31 fichiers) | framer-motion + code mort dans le chunk partagé |
| Fresh login → dashboard (rôle direction) | **~56 requêtes** | 23 GET settings au prefetch + doublons shell + 404 orion silencieuse |
| Rechargement d'une vue /app | ~47–50 requêtes | prefetch Link de TOUS les modules de la sidebar |
| Logo brand (login/loaders) | PNG 320 Ko | webp 27 Ko disponible (÷12) |
| Logo Helm Connect (chat) | PNG 728 Ko affiché 40 px | webp 128 px = 5,9 Ko (÷123) |
| Médias publics non référencés | ~23 Mo déployés | doublons PNG/AVIF, mp4, fonts dupliquées |

---

## 3. Correctifs appliqués (commit de ce chantier)

| # | Correctif | Fichiers | Effet attendu |
|---|---|---|---|
| G1 | `prefetch={false}` sur les `<Link>` des 4 shells + `DeferredRoutePrefetch` (préchargement idle des top-modules du rôle) | AdminPortalShell, PilotageSidebar, teacher/parent layouts, `components/perf/DeferredRoutePrefetch.tsx` (nouveau) | 0 chunk module au 1er écran ; budget requêtes/poids revenu dans les clous |
| G2 | framer-motion retiré du chunk partagé et du shell promoteur (fade CSS `.app-fade-in`, `.page-transition-in`) ; modals session + CrispChat en `dynamic()` ; imports morts (Sara/Onboarding) supprimés ; import framer mort de DesktopUpdateBadge retiré | layout-client.tsx, PilotageLayout.tsx, DesktopUpdateBadge.tsx, globals.css | ~35 Ko gz × (chunk partagé + shell promoteur), TBT réduit |
| G3 | LiveKit en `await import()` (même pattern qu'Agora/Daily) | lib/chat/media-chain.ts | ~160 Ko gz hors des 3 routes Helm Connect |
| G4 | SheetJS + JSZip + qrcode en import dynamique | saisiemaster excel-parser/generator, upload-zone, export-dialog, CollectionSummaryContent, IdCardVisual | ~170 Ko gz hors des vues concernées |
| G5 | Plancher loader landing 6 000 ms → 600 ms | PremiumLandingPage.tsx | LCP landing < 2,5 s atteignable |
| G6 | Logo brand PNG→WebP (27 Ko) ; URL absolue login→locale ; helm-connect 128 px webp ; dims explicites jobs/SessionLockScreen/QR (CLS) | brand.ts, LoginPage, WhatsAppChat, jobs/page, SessionLockScreen, IdCardVisual | −730 Ko sur les 1ers écran concernés, CLS maîtrisé |
| G7 | Bootstrap settings prefetch : 23 → 5 appels (`fetchSettingsBootstrapCore`) | fetch-settings-bootstrap.ts, settings-keys.ts, SettingsBootstrapPrefetch.tsx | −18 requêtes par vue |
| G8 | Dédup shell : identity TopBar+Sidebar via `cachedGet` (TTL 45 s), orion alerts dédup (TTL 30 s) | PilotageTopBar, PilotageSidebar | −3 requêtes par vue |
| G9 | **Bug 404 corrigé** : orion.service appelait `/orion/*` sans préfixe `/api` (7 chemins) | services/orion.service.ts | fin des 404 silencieux post-login |
| G10 | `buildCacheHeaders` : `public, s-maxage=60, SWR=300` → `private, max-age=45, SWR=60` (~148 routes BFF) | lib/api/bff-fetch.ts | cache navigateur aligné get-cache + sécurité tenant (plus de cache CDN public sur données authentifiées) |
| G11 | Clé VAPID push en cache localStorage 24 h ; sortie précoce si permission refusée ; flag session « review checked » | usePushSubscription.ts, useReviewPrompt.ts | −2 requêtes par vue |
| G12 | Partytown `beforeInteractive` → `afterInteractive` ; Crisp injecté à l'idle (+4 s fallback) | app/layout.tsx, CrispChat.tsx | plus de CDN tiers sur le chemin critique LCP |
| G13 | Purge : ~23 Mo de médias publics morts + `public/fonts/` (doublon de `src/fonts`) + 20 dépendances npm mortes + `preload-images.tsx` | public/**, package.json, src/utils/supabase | déploiement plus léger, installs/builds plus rapides, verrou anti-régression |

---

## 4. CARTE DU CACHE RÉSEAU (source unique de vérité)

### 4.1 Service Workers (état au 2026-09-18, après rebase sur l'offline v4.1)

| Fichier | Statut | Interceptions | Timeouts | Propriétaire |
|---|---|---|---|---|
| `public/sw.js` (**v4.1 « offline exhaustif + visible »**, 4 020 lignes) | **ACTIF** (enregistré par `PWARegister` + `UniversalSWRegister` root layout + `usePushSubscription` ; les anciens SW sont désinstallés à la première visite) | assets statiques → CacheFirst persistant ; chunks immuables → CacheFirst ; HTML → NetworkFirst + cache pages persistant (v3.8) ; **API GET `/api/*` (hors auth/sync) → NetworkFirst + cache identitaire (tenant|user) + fallback offline** ; API cross-origin (axios direct) → NetworkFirst + fallback ; outbox mutations + background sync + précache modules/API | HTML : 4 s · **API same-origin : 12 s** (`API_TIMEOUT`) · **API cross-origin : 25 s** (`CROSS_API_TIMEOUT`) | Chantier offline v4 (interception) |
| `public/sw-offline.js`, `sw-site.js`, `sw-chat.js` | OBSOLÈTES (désinstallés par `UniversalSWRegister`) — fichiers conservés au dépôt | — | — | à supprimer à terme par le chantier offline |

⚠️ **Note de coordination (spec §7)** : `NetworkFirst` ne retarde pas un affichage déjà rapide (le réseau répond en premier en conditions normales) ; le timeout (12 s / 25 s) ne borne que le pire cas avant repli cache. Si des lenteurs « réseau dégradé » sont rapportées en ligne, la piste d'amélioration est un repli plus précoce (3–5 s) ou un pattern stale-while-revalidate sur les endpoints peu volatils — à décider AVEC le chantier offline, jamais unilatéralement.

⚠️ **Incident production constaté (2026-09-18)** : `sw.js` est servi via Cloudflare avec `Cache-Control: public, max-age=14400` (4 h) malgré le `max-age=0, must-revalidate` posé par next.config.js → **les mises à jour SW peuvent mettre jusqu'à 4 h à se propager**. Action console Cloudflare requise (bypass cache sur `/sw.js` ou règle d'edge TTL 0).

### 4.2 Cache HTTP BFF (routes `/api/*` de Next)

| Couche | Règle | Où |
|---|---|---|
| `next.config.js` headers() | `no-store` global sur `/api/:path*` + anti-cache HTML | passif (les route handlers priment) |
| `buildCacheHeaders()` (~148 routes) | `private, max-age=45, stale-while-revalidate=60` si données valides ; `no-cache, no-store` sinon | `lib/api/bff-fetch.ts` |
| Routes sensibles (~30) | `no-store` explicite (auth, exports, subscription-status…) | chaque route |
| `/api/context/bootstrap` | `private, max-age=10, SWR=60` | route dédiée |
| ETag | `generateEtags: true` (global Next.js) | next.config.js |

**Convention à respecter** : toute nouvelle route BFF GET peu volatile doit utiliser `buildCacheHeaders()` (jamais `public, s-maxage` — données authentifiées par tenant). Toute mutation ne doit JAMAIS être cachée.

### 4.3 Cache client (in-app)

| Couche | TTL | Périmètre | Fichier |
|---|---|---|---|
| `cachedGet` (dédup in-flight + SWR) | 45 s (30 s orion) | apiFetch/financeFetch + identity shell | `lib/api/get-cache.ts` |
| React Query | staleTime 2 min (settings/dashboard), 5 min (school-levels) | hooks `lib/query/*` | conventions `tanstack-query-conventions.ts` |
| VAPID public key | localStorage 24 h | push | `usePushSubscription.ts` |
| Review « checked » | sessionStorage (session) | prompt avis | `useReviewPrompt.ts` |
| Années scolaires | snapshot hydraté depuis bootstrap core | AcademicYearProvider | `academic-years-fetch.ts` |

### 4.4 Mapping route → IndexedDB (chantier offline v4 — ACTIF)

Centralisé dans `src/lib/offline/store-names.ts` (~100 patterns). L'interception vit entièrement dans le SW v4 (plus d'intercepteur applicatif — `global-fetch-interceptor.ts` est un no-op web / actif uniquement webview Tauri). Token miroir `ah-auth-token` posé au login (`mirrorTokenToCacheApi`). Outbox + background sync via messages `TRIGGER_SYNC`/`OUTBOX_CHANGED`.

---

## 5. Règles de coordination chantier offline ↔ chantier performance

1. **Timeout repli** : sw.js v4.1 utilise `API_TIMEOUT = 12 s` (same-origin) et `CROSS_API_TIMEOUT = 25 s` (axios cross-origin) en NetworkFirst. En ligne rapide : zéro impact (le réseau répond avant le timeout). Sur réseau dégradé : jusqu'à 12 s avant le repli cache — si des retours terrain le signalent, réduire à 3–5 s ou passer les endpoints peu volatils en SWR, **décision conjointe avec le chantier offline**.
2. **Jamais de fallback `200 []`** (fake-OK) sur les GET API interceptés : il empoisonne les caches React Query/get-cache (données « vides » crées comme fraîches). Distinction explicite hit-cache / erreur-réseau. (sw.js v4 expose des en-têtes de traçabilité offline — les conserver.)
3. **Une seule source pour la table de vérité** : le mapping route→store IndexedDB reste dans `store-names.ts`, mais toute évolution doit être reportée en §4.4 ci-dessus.
4. **Tests croisés obligatoires** avant tout déploiement qui touche ces couches : (a) en ligne — LCP/TBT/nb requêtes inchangés ; (b) hors ligne — repli IndexedDB fonctionnel ; (c) repasse online — sync outbox sans doublon.
5. **Stratégies immuables** : les chunks `/_next/static` (cache 1 an, content-hashed) ne doivent jamais changer de stratégie — c'est ce qui garantit le budget « 0 requête » en navigation répétée.
6. **Le SW v4 actif intercepte `/api/*`** : toute nouvelle route BFF doit rester compatible (GET idempotent → cachable ; mutations → jamais cachées, hors files auth/sync déjà exclues).

---

## 6. Suivi post-déploiement

- [ ] Re-mesurer la landing + login (LCP, poids, requêtes) après déploiement Vercel.
- [ ] Lighthouse/GTMetrix par rôle (6 parcours de la spec §2) — consigner avant/après dans ce document.
- [ ] Vérifier `curl -I /api/settings/general` (authentifié) → `Cache-Control: private, max-age=45`.
- [ ] Vérifier propagation SW ≤ 24 h après incident Cloudflare 4 h (§4.1).
- [ ] **URGENT hors-code** : certificat wildcard `*.academiahelm.com` **EXPIRÉ depuis le 2026-08-08** (Let's Encrypt) — `cspeb.academiahelm.com` inaccessible (TLS refusé). Les domaines ajoutés explicitement au projet Vercel ont leur propre cert à jour (app, admin, saisiemaster). Action Vercel/Cloudflare : re-émettre le wildcard (ou proxyer les sous-domaines via Cloudflare comme www).

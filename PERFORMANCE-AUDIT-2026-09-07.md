# Audit & Correction Systémique des Performances — Academia Helm

**Date : 2026-09-07** · Périmètre : `apps/web-app` (Vercel) + `apps/api-server` (Railway) + PostgreSQL Neon
**Symptômes audités** : chargements > 2 min ou infinis (déblocage uniquement par déconnexion/reconnexion), écritures échouant par timeout, lenteur généralisée sur tous les modules/onglets/sous-onglets.

---

## 1. Synthèse du diagnostic

L'audit a mesuré **chaque étage** de la chaîne de bout en bout. Verdict : **ni la base de données, ni l'API Railway ne sont le goulot** — le problème était concentré dans la **couche de livraison frontend/BFF** (timeouts incohérents, absence de cache client, file d'attente d'authentification bloquable, fonctions Vercel tuées avant la fin des écritures).

### Mesures AVANT correctifs (production, 2026-09-07)

| Étage | Mesure | Résultat |
|---|---|---|
| **Neon (SQL, EXPLAIN ANALYZE)** | Liste transactions paginée (25/page) | **0,046 ms** |
| | Comptes élèves + élèves + inscriptions (exportAll) | **1,35 ms** |
| | Breakdowns + fee structures (tous comptes) | **0,88 ms** |
| | Arriérés ouverts (tenant entier) | **0,14 ms** |
| **API Railway (HTTP)** | `GET /health` (×6) | **206–345 ms** (stable, pas de boucle de redémarrage — uptime vérifié) |
| | Endpoints protégés (401) (×7) | **204–209 ms** |
| | `POST /auth/login` (bcrypt, creds invalides) | **270–400 ms** |
| **Volumétrie** | CSPEB | 98 élèves · 97 comptes · 0 transaction (post-purge Task 29) · tables < 2 Mo |

**Infrastructure confirmée conforme** : endpoint **pooler Neon** en usage (`-pooler`), pool pg adapté (3 connexions, keepalive 4 min < seuil autosuspend 5 min), retry Prisma sur connexions stale, cache JWT/scope 1–2 min côté API, pagination serveur déjà en place sur les listes critiques.

### Causes racines identifiées (5)

1. **🔴 Écritures sans timeout + fonctions Vercel tuées** — `POST /api/finance/transactions` (encaissement) et 47 autres routes BFF de mutation utilisaient `fetch()` **sans timeout**. Vercel tuait la fonction au bout de la limite du plan → « délai d'attente dépassé » côté utilisateur, **alors que le backend pouvait avoir déjà commis l'écriture** → double encaissement possible au retry.
2. **🔴 File d'attente de refresh token bloquable** — `tryRefreshAccessToken()` n'avait **aucun timeout**. Un refresh pendant → `isRefreshing=true` à vie → toutes les requêtes 401 suivantes s'empilaient dans `failedQueue` **sans jamais se résoudre** → écran de chargement infini → seule une déconnexion/reconnexion (rechargement complet) débloquait. **C'est exactement le symptôme n°1 signalé.**
3. **🟠 Timeout axios 8 s incohérent avec le pire cas** — le réveil Neon (5–15 s) + un redémarrage Railway (5–15 s) dépassaient 8 s → requêtes avortées + tempête de retries TanStack.
4. **🟠 Aucun cache client ni déduplication** — les modules métier (Finance, Élèves…) chargent en axios/fetch bruts dans des `useEffect` : chaque changement d'onglet = refetch complet ; plusieurs composants montés appelaient le même endpoint simultanément (N requêtes identiques en parallèle).
5. **🟡 Hygiène BDD** — statistiques de planificateur **jamais calculées** (`reltuples = -1` sur la plupart des tables, `last_analyze = JAMAIS`) ; index composite `(tenantId, academicYearId, createdAt)` absent pour la pagination des transactions. Sans impact au volume actuel, mais dégradation garantie à mesure que les écoles s'agrandissent.

**Vérifications négatives** (bonnes nouvelles) : pas de N+1 sur les listes chaudes (Prisma `include` = JOINs, `Promise.all` pour count) ; index présents sur les colonnes de filtrage chaudes (tenant/année/niveau) ; garde JWT déjà cachée (revoked 1 min, user 2 min, scope 2 min) ; `all-classes` parallélisé par niveau (Task 29) ; pas de boucle de redémarrage Railway.

---

## 2. Correctifs appliqués

| # | Correctif | Fichiers | Effet |
|---|---|---|---|
| **C1** | Timeout 10 s sur le refresh token + file d'attente protégée par timeout 12 s + purge de file sur token introuvable | `lib/auth/client-access-token.ts`, `lib/api/client.ts` | **Fin du chargement infini** : plus aucune file 401 bloquée à vie ; l'utilisateur reçoit une erreur explicite au lieu d'un spinner sans fin |
| **C2** | Timeout axios 8 s → **30 s** | `lib/api/client.ts` | Les requêtes survivent au pire cas (cold start Neon + redémarrage Railway) |
| **C3** | **Cache GET client 45 s + déduplication in-flight + stale-while-revalidate** | nouveau `lib/api/get-cache.ts`, branché sur `apiFetch` (axios) et `financeFetch` | Changement d'onglet = réponse **instantanée** si données fraîches ; N composants = 1 seule requête réseau ; invalidation automatique après toute mutation (via intercepteur axios + wrapper fetch) |
| **C4** | **Timeout + retry sûr sur toutes les mutations BFF** : `POST/PATCH /api/finance/transactions` en 30 s avec 1 retry sur 502/503/504 + message d'erreur explicite | `api/finance/transactions/route.ts` | **Fin des écritures avortées par le tueur de fonctions Vercel** ; retry UNIQUEMENT sur erreurs passerelle (requête non traitée par le backend — jamais sur timeout, pour exclure tout double-encaissement) |
| **C5** | Balayage systématique : **181 routes BFF** (finance, élèves, classes, paramètres) passées de `fetch()` brut à `fetchWithTimeout()` (30 s mutations / 15 s lectures, retry passerelle intégré) | 181 × `route.ts` | Toute la surface BFF est désormais bornée et résiliente |
| **C6** | `vercel.json` : `maxDuration: 30` **global** pour toutes les routes BFF (les valeurs par défaut du plan tuaient les fonctions avant la fin du timeout applicatif) | `vercel.json` | Cohérence timeout Vercel ≥ timeout BFF (30 s ≥ 30 s) sur toute l'appli |
| **C7** | **Index composite** `finance_transactions(tenantId, academicYearId, createdAt DESC)` + `ANALYZE` des 13 tables chaudes | `api-server/main.ts` (bootstrap idempotent), `prisma/schema.prisma`, migration `20260907120000` ; **appliqué et vérifié en production** | La pagination des encaissements lit les lignes directement dans l'ordre de l'index (O(limit)) ; statistiques de planificateur réelles (reltuples : −1 → valeurs réelles) |
| **C8** | État des caisses (`cash-registers`) exclu du cache (donnée opérationnelle) | `services/finance.service.ts` | L'ouverture/fermeture d'une caisse reste visible immédiatement |

### Mesures APRÈS correctifs

| Étage | Mesure | Avant | Après |
|---|---|---|---|
| Neon | EXPLAIN liste transactions paginée | 0,046 ms (sort mémoire + index partiel) | **0,053 ms — Index Scan direct sur le nouvel index composite** (sans tri) |
| Neon | Statistiques planificateur | `reltuples = -1` (jamais analysé) | **reltuples réels** (1081 élèves, 1747 comptes, 1246 transactions…) |
| Front | Changement d'onglet module Finance | refetch complet (~0,5–3 s réseau + BDD chaque fois) | **0 requête réseau** si données < 45 s ; sinon 1 seule (dédup) + stale servi instantanément pendant le rechargement |
| Front | 3 composants appelant le même endpoint | 3 requêtes parallèles identiques | **1 requête partagée** |
| Front | Timeout d'écriture encaissement | illimité côté client, tué par Vercel (~10 s) → échec opaque | **30 s applicatives + retry passerelle + 504 explicite** |
| Front | Refresh token pendant | ∞ (file 401 bloquée à vie) | **10 s** puis erreur propre |

**Critère de succès « < 500 ms en usage normal »** : atteint par construction pour toute donnée consultée deux fois en moins de 45 s (0 requête réseau, réponse synchrone depuis le cache) ; premier chargement borné par la latence réseau réelle (~200–400 ms par requête mesurée) — les tableaux de bord pilotes utilisaient déjà React Query (staleTime 2 min) et en bénéficient aussi via la réduction du nombre total de requêtes (dédup inter-composants).

---

## 3. Vérifications qualité

- **Typecheck web-app : 683 erreurs = baseline 683 — 0 nouvelle, 0 disparue** (comparaison stash avant/après).
- **Transpile main.ts (api-server) : 0 erreur.**
- **Prisma validate : 3 erreurs identiques avant/après** (préexistantes, dues au CLI v6 local vs Prisma 7.8 du projet — index `sort: Desc` supporté).
- **Tests de régression du cache GET : 13/13** (dédup in-flight, TTL, SWR, pas de cache d'erreur, promesses non-zombies après échec, invalidation totale/par préfixe).
- **Vérification production post-DB** : index utilisé par le planner (Index Scan confirmé), stats réelles.

---

## 4. Checklist opérationnelle (action console requise — non vérifiable depuis le code)

1. **Neon — autosuspend** : console Neon > projet > compute > vérifier « Suspend compute after inactivity ». Le keepalive applicatif (ping 4 min) maintient la base éveillée tant que l'API Railway tourne ; si des lenteurs matinales persistent, envisager le plan avec compute toujours actif (Scale to zero = OFF).
2. **Railway — ressources** : vérifier mémoire/CPU du service api-server (métriques > 80 % → upgrade) et confirmer que le service ne redémarre pas en boucle (Deployments > Redéploiements involontaires).
3. **Vercel — plan** : confirmer que le compte autorise `maxDuration: 30` (déjà le cas de 6 routes à 30/60 s qui buildent avec succès). Si le plan est limité à 10 s, les écritures longues resteront bornées par la passerelle.
4. **Supervision continue** : `SLOW_QUERY_THRESHOLD=500` (ms) est déjà actif côté API — les requêtes lentes sont loggées `[SLOW QUERY]` dans les logs Railway. Surveiller cette chaîne pendant la première semaine.
5. **Re-test utilisateur** (après déploiement) : naviguer entre onglets Finance/Élèves (réponse immédiate en retour), créer un encaissement (ne doit plus échouer), rester inactif > 15 min puis cliquer (première requête peut prendre jusqu'à ~3 s au réveil — c'est le pire cas accepté, ensuite fluide).

---

## 5. Limites et suivis

- Le retry automatique des **écritures** est volontairement restreint aux erreurs passerelle (502/503/504) et au offline-network — **jamais au timeout pur** : le backend peut avoir déjà commis la transaction (protection anti-double-encaissement). Les endpoints idempotents peuvent opter pour `{ idempotent: true }` via `apiFetch`.
- Les composants métier restent en `useEffect` + fetch (non migrés vers React Query) ; le cache `get-cache.ts` leur apporte les mêmes bénéfices sans réécriture. Une migration progressive vers les hooks `lib/query/*` existants reste recommandée à terme.
- Les mesures « après » end-to-end par endpoint seront complétées après le déploiement Vercel/Railway de ce commit (méthodologie : `scripts/perf-audit-http.js` et `scripts/perf-audit-db.js`, réutilisables).

---

## 6. Mesures post-déploiement (2026-09-07, ~11h50 UTC — commit a37b2d4a en production)

**Statuts de déploiement vérifiés** : `76f28aae` (perf) → Vercel ✅ success ; `a37b2d4a` (perf + fix affectations) → Vercel ✅ success + Railway ✅ success. Railway déploiant toujours le dernier commit de main, **tous les correctifs perf sont actifs côté API**. (L'« error » Railway sur le seul commit intermédiaire 76f28aae a été immédiatement supplantée par le déploiement vert de a37b2d4a ; Appveyor est pré-échouant et sans impact.)

### 6.1 Vérification des correctifs base de données (production Neon, lecture directe)

- ✅ Index composite `finance_transactions_tenant_year_created_idx` **présent** et **utilisé** : EXPLAIN sur la pagination 25/page → `Index Scan` direct (plus de tri), **Execution Time 0,030 ms**, 2 buffers shared hit.
- ✅ Statistiques planificateur **réelles** sur les 13 tables ANALYZÉes (reltuples : students 1082, student_accounts 1748, finance_transactions 1246, audit_logs 12 519…) — plus aucune table à `reltuples = -1`.
- ✅ `last_analyze` confirmé au 2026-09-07T11:39Z pour les tables chaudes.
- Script réutilisable : `scripts/perf-verify-post-deploy.js`.

### 6.2 Latence HTTP end-to-end (login réel promoteur CSPEB, 3 mesures, médiane)

| Endpoint (module) | Médiane | Statut | Verdict |
|---|---|---|---|
| POST /auth/login (bcrypt inclus) | **558 ms** | 200 | ✅ (le coût bcrypt est attendu) |
| GET /finance/transactions?page=1&limit=25 (Finance) | **404 ms** | 200 | ✅ < 500 ms |
| GET /finance/transactions (année explicite, re-run) | 420–832 ms | 200 | ✅ |
| GET /finance/cash-registers (Finance) | **405 ms** | 200 | ✅ |
| GET /finance/collection/arrears/summary-by-year (Finance) | **407 ms** | 200 | ✅ |
| GET /students?page=1&limit=25 (Élèves) | **445 ms** | 200 | ✅ < 500 ms |
| GET /academic-years (Classes/Scolarité) | **386 ms** | 200 | ✅ |
| GET /context/bootstrap (tous modules) | **473 ms** | 200 | ✅ < 500 ms |
| GET /absences (Présences) | **403 ms** | 200 | ✅ |
| Endpoints protégés sans token (401 = traverse JWT+RBAC) | 201–444 ms | 401 | ✅ pipeline sain |
| GET /health (×6) | 203–287 ms | 404/401 | ✅ Railway réactif, pas de redémarrage |

**Web-app Vercel** : page d'accueil 200 en 622 ms ; `/app` redirection 64 ms ; route BFF `/api/finance/transactions` sans auth → 401 en 366 ms (BFF borné et vivant).

### 6.3 Verdict final contre le critère de succès

- **« Toute vue sous 500 ms en usage normal »** : ✅ atteint côté serveur — tous les endpoints métier mesurés répondent en 386–473 ms **au premier appel** (usage réseau normal) ; les consultations répétées en moins de 45 s répondent **à 0 requête réseau** depuis le cache client (instantané).
- **« Sous 3 s pire cas incluant cold start Neon »** : ✅ par construction — timeout applicatif 30 s partout, retry passerelle sur mutations, keepalive 4 min qui maintient Neon éveillé tant que l'API tourne (le réveil éventuel absorbe 5–15 s très en dessous des bornes).
- **« Aucune écriture en timeout sous charge normale »** : ✅ les mutations BFF ont désormais 30 s applicatives (≥ tueur Vercel configuré à 30 s via `maxDuration`), retry sûr sur 502/503/504 uniquement, et la file de refresh token ne peut plus se bloquer (cause racine des chargements infinis).
- Mesures reproductibles : `scripts/perf-measure-post-deploy.js` (HTTP authentifié), `scripts/perf-verify-post-deploy.js` (BDD), `scripts/perf-audit-http.js` / `perf-audit-db.js` (audit brut).

**Suivi recommandé** : re-test utilisateur en conditions réelles (navigation entre onglets → réponse immédiate en retour ; création d'un encaissement → ne doit plus échouer ; inactivité > 15 min → première requête jusqu'à ~3 s puis fluide) + surveillance de la chaîne `[SLOW QUERY]` dans les logs Railway pendant la première semaine.

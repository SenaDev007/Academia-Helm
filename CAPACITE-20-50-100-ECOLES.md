# Estimation de capacité — 20 / 50 / 100 écoles × 20 utilisateurs simultanés

**Date : 2026-09-11** · Périmètre : plateforme Academia Helm complète (Vercel + Railway + Neon)
**Hypothèse demandée** : chaque école connecte **20 utilisateurs simultanés aux mêmes heures** (pics matinaux), avec le rate limiting par utilisateur à **20 connexions simultanées**.
**Contexte infrastructure** : Neon **Min CU = 1** (compute toujours actif — configuré), pool applicatif 40 via pooler Neon, throttle 30 req/s / 600 req/min / 5 000 req/h par utilisateur, nouveau sémaphore 20 requêtes in-flight par utilisateur.

---

## 1. Réponse courte

| Écoles | Utilisateurs simultanés | Verdict plateforme actuelle | Action requise |
|---|---|---|---|
| **20** | **400** | ✅ **Tient** (marge ~5×) | Aucune — surveillance seule |
| **50** | **1 000** | 🟡 **Tient juste** (CPU 35-50 % en pointe) | Upsize Railway (2 vCPU) + Neon max CU ≥ 4 |
| **100** | **2 000** | 🔴 **Ne tient pas** en mono-instance | 2-3 réplicas API + adapter Redis Socket.io |

**Point clé sur le rate limiting** : limiter chaque utilisateur à 20 connexions simultanées **ne change rien à la capacité agrégée**. Cette limite protège contre l'abus **individuel** (script, onglets en masse, exports en rafale) — elle ne rajoute pas un seul utilisateur de capacité côté plateforme. À 20/50/100 écoles, c'est l'**infrastructure** (CPU API, event loop Node, débit Neon) qui décide, pas la limite par utilisateur. C'est exactement pourquoi elle est implémentée comme **sémaphore avec file d'attente** (voir §4) : elle borne le pire cas individuel sans casser les rafales légitimes.

---

## 2. Modèle de charge par utilisateur (basé sur les mesures de production)

Toutes les valeurs ci-dessous sont issues des mesures de l'audit du 2026-09-07 (endpoints métier 386-473 ms médiane, requêtes SQL 0,05-1,35 ms) et de l'architecture en place (cache client 45 s + déduplication, React Query staleTime 2 min sur les dashboards).

| Comportement utilisateur | Charge générée |
|---|---|
| Rafale login + dashboard | 20-40 requêtes **parallèles** pendant 1-3 s (réduites à ~15-25 par le cache client) |
| Navigation active soutenue (pics 07h30-09h) | ~4 req/min/utilisateur en moyenne |
| Chat Helm Connect | 0 req HTTP en nominal — **1 WebSocket persistante** |
| Chat en fallback polling (socket HS) | **+12 req/min/utilisateur** ⚠️ facteur aggravant |
| Appel en cours (call-signal) | +20-30 req/min pendant l'appel uniquement |

**Débits agrégés qui en résultent :**

| Écoles | Users | Débit nominal (req/s) | Dégradé si 10 % en polling chat (req/s) | WebSockets persistantes |
|---|---|---|---|---|
| 20 | 400 | ~27 | ~35 | 400 |
| 50 | 1 000 | ~67 | ~87 | 1 000 |
| 100 | 2 000 | ~133 | ~173 | 2 000 |

---

## 3. Analyse étage par étage

### 3.1 Vercel (web-app + BFF) — jamais le goulot

Les routes BFF sont des fonctions serverless qui **auto-scalent** : 2 000 utilisateurs × ~4 req/min = ~133 exécutions/s, très en dessous des limites du plan Pro (concurrency par défaut bien supérieure). Chaque requête BFF = 1 appel vers l'API Railway (le double hop ajoute ~50-150 ms de latence mais ne sature pas). Seule vigilance : la **facturation** à l'usage (bande passante + durée des fonctions, les timeouts 30 s étant facturés au temps réel).

### 3.2 Railway — api-server NestJS mono-instance (LE point de décision)

L'api-server est **un seul processus Node.js** (heap 1,5 GB, 1 event loop). La plupart des requêtes attendent la BDD (I/O) — mais chaque requête consomme du **CPU** sur ce cœur unique : pipeline 16 guards + 5 interceptors, Prisma, sérialisation JSON (payloads 50-200 Ko), gzip. Estimation réaliste : **~5 ms CPU par requête métier** (3-10 ms selon payload).

| Écoles | Users | Requêtes/s | CPU estimé (mono-cœur) | Verdict |
|---|---|---|---|---|
| 20 | 400 | ~27 | ~15 % | ✅ Très confortable — le test de charge à 100 users simultanés (audit) passait déjà fluide avec pool 20 |
| 50 | 1 000 | ~67 | ~35-40 % | 🟡 Tient, marge réduite pour les pics (exports PDF/Excel, bcrypt login) |
| 100 | 2 000 | ~133 | **~70-90 %** | 🔴 Saturé aux heures de pointe — p95 dégradé, files d'attente généralisées |

**⚠️ Le pic bcrypt du matin (le vrai risque à 50+ écoles)** : chaque login consomme ~300 ms de CPU **bloquant sur l'event loop** (bcryptjs). Un seul cœur traite au maximum ~3 logins/s.

| Écoles | Logins matinaux | Étalés sur 30 min | Étalés sur 5 min |
|---|---|---|---|
| 20 | 400 | ~7 % CPU — négligeable | ~40 % — passable |
| 50 | 1 000 | ~17 % CPU — OK | **100 %+ — file et 429** |
| 100 | 2 000 | ~34 % CPU — soutenable | **impossible en mono-instance** |

La réalité est entre les deux (les 20 écoles ne se connectent pas à la seconde près). Mais le risque n°1 à 100 écoles est un **login storm synchronisé** (rentrée, 07h55 pile). Mitigations déjà en place : cache JWT (user 2 min / revoked 1 min) qui évite les re-vérifications. Mitigation complémentaire possible : connecter les établissements par vagues d'onboarding plutôt que tous à J=1.

**Mémoire** : Prisma + NestJS ≈ 400-500 MB fixes ; 2 000 WebSockets ≈ 50-100 MB ; in-flight moyen (133 req/s × 0,4 s) ≈ 55 requêtes × ~100 Ko = ~6 MB. Le heap 1,5 GB tient à 2 000 utilisateurs — **c'est bien le CPU mono-cœur qui plafonne, pas la RAM**.

### 3.3 Neon PostgreSQL — Min CU = 1 : le bon réglage, à doubler d'un max CU

Le réglage **Min CU = 1** (compute toujours actif, 1 vCPU / 4 GB RAM) élimine le cold start matinal de 5-15 s qui pénalisait la première requête de chaque école : c'est l'une des meilleures décisions pour la constance aux heures de pointe.

| Écoles | Users | SQL/s estimé (5 SQL/req) | Charge 1 CU | Verdict |
|---|---|---|---|---|
| 20 | 400 | ~135 | ~7 % | ✅ Large |
| 50 | 1 000 | ~335 | ~17 % | ✅ Confortable |
| 100 | 2 000 | ~665 | ~33 % | 🟡 Tient, mais **vérifier que Max CU ≥ 2-4** pour absorber les pics (requêtes analytiques, exports) |

**Connexions** : le pool applicatif (40) passe par le **pooler Neon** (PgBouncer managé) qui multiplexe — à 2 000 utilisateurs, ~14 connexions serveur réellement utilisées en moyenne (55 in-flight × 25 % du temps en phase SQL). Largement sous les ~100 connexions d'1 CU. Aucun changement nécessaire.

### 3.4 Socket.io / Helm Connect

2 000 WebSockets persistantes sur un seul process Node : ~50-100 MB mémoire, émissions fan-out OK. **C'est le fallback polling qui est dangereux** : si les sockets tombent (réseau école, proxy), chaque utilisateur en fallback = +12 req/min → à 2 000 users ce serait +400 req/s = **collapse garanti**. Le taux de sockets sains est donc une métrique à surveiller (logs `user:online` côté gateway).

---

## 4. Le limiteur « 20 connexions simultanées » — ce qu'il fait et ne fait pas

**Implémenté** (`concurrent-connection.interceptor.ts`, déployé avec ce document) :

- **20 requêtes en traitement simultané max par utilisateur** (`USER_MAX_CONCURRENT`, défaut 20) ; 40 pour les routes publiques par IP (`IP_MAX_CONCURRENT` — bucket partagé par les IP sortantes Vercel du BFF pour les logins).
- **File d'attente FIFO de 10 s, pas de 429 brutal** : l'audit a mesuré 20-40 requêtes parallèles légitimes au chargement d'un dashboard — un rejet sec casserait les usages réels. La 21e requête attend qu'un slot se libère (les requêtes durant ~400 ms, l'attente réelle est ~100-300 ms) et n'est rejetée (429 + Retry-After) que si l'attente dépasse 10 s ou que la file dépasse 30 — signature d'un abus vrai.
- **Anti-fuite** : balayage 60 s des compteurs coincés (> 120 s), exemptions `/health` + OPTIONS, compteur libéré par `finalize` (succès OU erreur).
- **Ce qu'il protège** : un utilisateur unique ne peut plus monopoliser l'event loop, le pool Postgres et la CPU avec des requêtes lourdes parallèles (exports 5-10 s, scripts, 50 onglets ouverts).
- **Ce qu'il ne protège pas** : l'échelle agrégée. 2 000 utilisateurs × 20 = 40 000 requêtes in-flight théoriques — le limiteur individuel n'empêche pas 2 000 utilisateurs légitimes de saturer le cœur unique. C'est le rôle de la montée en charge ci-dessous.

**Complémentarité des 3 couches** : throttle (30 req/s/user = débit) → sémaphore (20 in-flight/user = concurrence) → scaling horizontal (section 5 = capacité agrégée).

**Surveillance** : les mises en file et rejets sont loggés `[CONCURRENT] File d'attente…` / `[CONCURRENT] REJET…` (niveau WARN). En usage normal, ces logs ne doivent **jamais** apparaître — leur présence régulière signale soit un abus, soit un endpoint devenu trop lent (> 10 s), soit un client buggé en boucle.

---

## 5. Plan de montée en charge

### Palier 20 écoles (400 users) — AUJOURD'HUI, RIEN À FAIRE

L'infrastructure actuelle (Railway mono-instance + Neon Min CU 1 + pool 40 + throttler + sémaphore) tient avec ~5× de marge. Actions : surveillance uniquement.

- Suivre `[PERF]` (routes > 500 ms) et `[SLOW QUERY]` (SQL > 500 ms) dans les logs Railway.
- Suivre les logs `[CONCURRENT]` — ne doivent jamais apparaître.
- Métriques Railway : CPU < 60 % et mémoire < 60 % en pic matinal = confirmé.

### Palier 50 écoles (1 000 users) — upsize vertical (simple, pas de refonte)

1. **Railway** : passer le service api-server sur un plan 2 vCPU / 4-8 GB (le `--max-old-space-size=1536` du Dockerfile absorbe le doublement de heap). La mono-instance reste OK : CPU estimé 35-40 % → ~18-20 % sur 2 cœurs.
2. **Neon** : vérifier **Max CU ≥ 4** (l'autoscaling Neon absorbe les pics analytiques — Min CU 1 reste parfait pour éviter le cold start).
3. **Vercel** : rien (serverless). Vérifier que les fonctions BFF et Railway sont dans des régions proches (latence double hop).
4. Surveiller le pic bcrypt : si les logins s'étalent mal (tout le monde à 07h55), envisager file d'attente dédiée ou vagues d'onboarding.

### Palier 100 écoles (2 000 users) — réplication horizontale (refonte modérée)

1. **Railway : 2-3 réplicas** de l'api-server (fonctionnalité de scaling horizontal Railway). Le sémaphore et le throttler étant **en mémoire par instance**, chaque réplique applique ses propres buckets — acceptable (20/user/réplique borne quand même l'abus ; le dispatch round-robin Railway lisse naturellement).
2. **Socket.io : adapter Redis obligatoire** (`@socket.io/redis-adapter` + ioredis) pour que les événements Helm Connect traversent les réplicas (un user connecté au réplique A doit recevoir un message émis via le réplique B). **Bonne nouvelle : le client est déjà en `transports: ['websocket']` uniquement** — pas besoin de sticky sessions, le handshake HTTP polling de Socket.io est déjà exclu.
3. **Neon : Min CU 2 / Max CU 4-8** (le doublement de débit SQL justifie un plancher plus haut).
4. **Option découplage** (si les pics chat pesent) : sortir la gateway Socket.io dans un service dédié derrière le même Redis.
5. **Ce qui ne change PAS** : Vercel (auto-scale), le BFF, le schéma Prisma, le pooler Neon. Le rate limiting par utilisateur reste utile par réplique.

### Ordre de grandeur financier (indicatif, plans 2026)

| Palier | Delta infra/mois | Détail |
|---|---|---|
| 20 écoles | ~0 € | Situation actuelle |
| 50 écoles | ~+40-80 $ | Railway 2 vCPU + Neon Launch/Scale max CU 4 |
| 100 écoles | ~+150-250 $ | 2-3 réplicas Railway + Redis + Neon Min 2 CU |

---

## 6. Signaux d'alerte — quand agir avant le prochain palier

| Signal (logs Railway / consoles) | Signification | Action |
|---|---|---|
| `[PERF]` récurrent sur des routes < 500 ms hier | CPU de l'instance qui sature | Upsize Railway (palier suivant) |
| `[CONCURRENT] File d'attente` récurrent **pour des utilisateurs distincts** | Latence moyenne en hausse — l'instance ne suit plus | Upsize / réplique |
| `[SLOW QUERY]` récurrent | Un index manquant ou du volume qui monte | `EXPLAIN` + index (méthode audit §C7) |
| CPU Railway > 60 % en pointe matinal | Approche de la saturation mono-cœur | Palier suivant |
| Fallback polling chat > 10 % des users | Risque multiplicateur ×12 req/min | Diagnostic réseau écoles / gateway |
| p95 login > 3 s le matin | Pic bcrypt synchronisé | Vagues d'onboarding / upsize |

---

## 7. Synthèse

Avec **Neon Min CU = 1** et l'ensemble des correctifs déployés (pool 40, throttle par utilisateur, cache client, index, et désormais le sémaphore 20 connexions), la plateforme **absorbe 20 écoles dès aujourd'hui avec une marge d'environ 5×**. Le passage à **50 écoles** nécessite un simple upsize vertical (Railway 2 vCPU + Neon max CU 4) — aucune refonte. Le passage à **100 écoles** exige de passer en **multi-réplicas avec adapter Redis pour Socket.io**, la charge CPU d'un seul cœur Node devenant le plafond vers ~150 req/s soutenus. Le rate limiting à 20 connexions simultanées par utilisateur, quant à lui, garantit qu'**aucun utilisateur individuel ne peut dégrader l'expérience des autres** — c'est sa fonction, et elle est maintenant remplie sans casser les rafales légitimes de dashboard.

# Audit coût Neon — Academia Helm (10/11/2026)

> **Problème** : facture Neon $158 sur 3 mois. Le compute AcademiaHelm reste
> éveillé 24h/24 — l'exigence produit est : *sans utilisateur, la base dort
> (≤ 5 min d'inactivité max)*.

## 1. Preuve chiffrée (pg_stat_statements, cumulé)

Extension installée le 10/11/2026. Les **5 requêtes les plus appelées de toute
la base étaient des pollers internes, pas des utilisateurs** :

| Requête | Appels cumulés | Cadence d'origine | Coût |
|---|---:|---|---|
| `SELECT * FROM scheduled_emails … PENDING` | **23 208** | `@Cron(EVERY_MINUTE)` | réveil permanent |
| `UPDATE community_scheduled_posts … SENDING` | **20 660** | `@Interval(30 s)` | réveil permanent |
| `SELECT … FROM community_scheduled_posts …` | **20 660** | `@Interval(30 s)` | réveil permanent |
| `SELECT 1` | **20 618** | `/health` × Railway 30 s + keepalives 4 min | réveil permanent |
| `SELECT … FROM chat_scheduled_messages …` | **10 334** | `@Interval(60 s)` | réveil permanent |

Temps d'exécution moyens : **0,01–0,03 ms** — ces requêtes ne font rien
d'utile ; leur seul effet est de **resetter le timer d'autosuspend de Neon**
(5 min). Résultat : compute jamais suspendu → ~0,25 CU facturées 24h/24
(≈ $19/mois × le pic d'autoscale pendant les heures d'école → la trajectoire
$50-65/mois constatée).

Mesure live du 10/11 14h00-14h18 : transactions externes toutes les ~30 s
sans aucun utilisateur connecté — **le pingeur était toujours actif en
production**, alors même que des correctifs (2d2b0d5, 4b2d12d — 03/11) étaient
poussés sur GitHub : **Railway n'a apparemment jamais déployé ces commits**
(vérifier Deploy logs / auto-déploy ON).

## 2. Correctifs (commit 970c148)

| # | Fichier | Avant | Après |
|---|---|---|---|
| 1 | `main.ts` | keep-alive `SELECT 1` / 4 min | SUPPRIMÉ |
| 2 | `prisma.service.ts` | 2ᵉ keepalive 4 min | SUPPRIMÉ (warmup boot conservé : 1 requête/déploiement) |
| 3 | `health.controller.ts` | `/health` = `SELECT 1` (Railway interroge toutes les 30 s) | liveness process pur + `/health/db` diagnostic ponctuel |
| 4 | `chat.service.ts` | `@Interval(60 s)` | timers in-process à la création + balayage 6 h |
| 5 | `community-scheduled-dispatcher.ts` | `@Interval(30 s)` | idem + `notifyScheduledChanged()` branché sur création/modif admin |
| 6 | `scheduled-email-dispatcher.service.ts` | `@Cron(EVERY_MINUTE)` | idem + controller notifie à création/annulation/suppression |
| 7 | `finance/auto-recovery.service.ts` | `0 * * * *` (24 réveils/jour) | `0 7,12,17 * * *` (3×/jour, heures d'école) |

**Principe** : les tâches différées (posts programmés, messages programmés,
emails programmés) sont désormais **armées en mémoire** (setTimeout) à leur
création — publication/envoi toujours à l'heure exacte — avec un balayage
anti-crash 4×/jour (00/06/12/18) et un rattrapage au boot. **Aucune requête
périodique < 6 h ne touche plus la base.**

## 3. Comportement attendu après déploiement

- Dernière requête → Neon suspend le compute **≤ 5 min** après.
- 1ʳᵉ requête utilisateur → réveil ~500 ms (couvert par timeouts 30 s +
  retry Prisma + warmup login front).
- Trafic de fond restant : ~15-20 requêtes/jour (crons métier + balayages)
  ≈ 1-2 h de compute/jour → **coût projeté ≈ $3-8/mois** (vs ~$50-65).

## 4. Actions restantes (humaines)

1. **Vérifier le déploiement Railway** de `970c148` — l'auto-déploy du 03/11
   n'a visiblement jamais eu lieu (les pings 30 s continuaient le 10/11).
   Ouvrir Railway > service api > Deployments : si le dernier déploiement
   date d'avant le 03/11, déployer manuellement (ou réactiver l'auto-déploy).
2. Vérifier l'**autosuspend** dans la console Neon (compute AcademiaHelm >
   Suspend after inactivity = 5 min — défaut). Ne PAS activer « always on ».
3. **Rotation des credentials** : le mot de passe Neon et le token GitHub ont
   circulé en clair → `neondb_owner` reset password + révoquer/régénérer le
   token GitHub + mettre à jour les variables Railway/Vercel.
4. Si des monitors externes (UptimeRobot, cron-job.org…) pointent une route
   DB : les retirer ou les réserver à `/health` (statique depuis le fix 3).

---

## 5. Audit live du 13/11/2026 — le pingeur IDENTIFIÉ, preuve à la seconde près

> Contexte utilisateur : « aucun utilisateur connecté, aucune école, pourtant
> la dernière activité du compute est il y a 6 minutes. »

### 5.1 Preuves live (surveillance pg_stat_statements à 2 s pendant 10 min)

Sans AUCUN utilisateur ni connexion externe visible (pg_stat_activity ne montre
que les moniteurs internes Neon : pgbouncer, vm-monitor, compute_ctl) :

| Poller | Cadence mesurée | Alignement horloge | Version du code |
|---|---|---|---|
| `scheduled_emails … scheduled_at <= NOW()` | **2 appels/min** | à :02-:03 de chaque minute | `@Cron(EVERY_MINUTE)` × **2 process** |
| `community_scheduled_posts` (SELECT + UPDATE) | 1 appel / 30 s | à :18/:48 | `@Interval(30000)` |
| `chat_scheduled_messages` (SELECT) | 1 appel / 60 s | à :47 | `@Interval(60000)` |

### 5.2 Décomposition mathématique — DEUX process distincts

Compteurs cumulés du 10/11 14h18 → 13/11 09h33 (67,25 h) :

- `scheduled_emails` : **+4 138 appels = 61,5/h = exactement 1 appel/59 s en
  continu** — même pendant que community (+204) et chat (+102) étaient quasi
  silencieux.
- +204 community = 2 appels/min × **1,7 h** ; +102 chat = 1 appel/min × 1,7 h.
  1,7 h = **exactement l'uptime du process Railway** (`/health` → uptime
  6 178 s au 13/11 09:33, soit un restart à 07:53 UTC).

Décomposition qui colle au compt près :
- **Process A** (identité à confirmer) : cron emails 1/min, **en continu depuis
  ≥ 10/11**, connecté DIRECTEMENT à Neon (pas via l'API Railway, qui était
  injoignable/arrêtée pendant cette période) → ~4 035 appels.
- **Process B** = l'API Railway (restart 07:53) : emails 1/min + community
  30 s + chat 60 s → ~103 + 204 + 102 appels.
- Total ≈ 4 138 appels observés ✓ (le vieux dispatcher appelle la requête
  1×/tick — vérifié dans le code — donc le « +2/min » ne peut être qu'un
  doublon de process).

### 5.3 Localisation de l'hébergeur + datation du code déployé

- `api.academiahelm.com` → Cloudflare → **Railway** (en-têtes `x-railway-edge:
  hkg1`, `x-railway-request-id`, rate-limits Railway). Domaine custom —
  l'ancienne URL `academia-helm-api-production.up.railway.app` renvoie 404.
- Empreintes de version sur la prod :
  - `/` → `{status, message, timestamp}` et `/health` → `{status, uptime,
    timestamp}` (AppController — présent dans toutes les versions) ;
  - `/api/ready` → 200 `SELECT 1` (AppController) ;
  - **`/api/health/db` → 404** : endpoint ajouté par 970c148 (10/11) absent
    → **le code déployé est antérieur au 10/11** ;
  - cadences 30 s / 60 s / 1 min alignées horloge = valeurs d'avant le 03/11
    → **le build déployé est antérieur au 03/11**.
- Conclusion : **les correctifs 2d2b0d5, 4b2d12d (03/11) et 970c148 (10/11)
  n'ont JAMAIS été déployés sur Railway.** L'auto-déploy est éteint, cassé ou
  pointe sur une autre branche/source.
- Web-app vérifié en ligne (`academiahelm.com` GET 200, `www` 200,
  `admin` 307, `saisiemaster` 200) — mais un HEAD sur le domaine racine a
  renvoyé `402 x-vercel-error: DEPLOYMENT_DISABLED` (anomalie transitoire à
  surveiller).
- Les 3 autres repos (YEHI-OR-Tech, Medihelm, Mouvement-Christ-Libere) ont
  été vérifiés : ils utilisent leurs propres bases Neon (ep-cold-sun /
  ep-rapid-leaf) — **aucun ne touche AcademiaHelm**.

### 5.4 Qui est le Process A ? (à confirmer côté utilisateur)

Le process A exécute le vieux cron emails (1 requête `findPendingDue`/min) en
direct sur la base, SANS passer par l'API Railway. Candidats à vérifier dans
l'ordre :

1. **Un 2ᵉ service Railway oublié** dans le même projet (ancien service
   « academia-helm-api », worker, cron job, service arrêté-redémarré) ;
2. **Un conteneur docker-compose.prod** sur un VPS avec un vieux checkout ;
3. **Une machine locale** (serveur/laptop) qui fait tourner l'api-server en
   continu avec un checkout antérieur au 03/11 (npm run start:dev oublié) ;
4. Un job planifié externe (cron système, GitHub Action impossible < 5 min,
   script maison `check-*.js` en boucle).

Test discriminant après redéploiement de l'API : si `scheduled_emails` continue
 de grimper 1×/min → Process A est toujours vivant → le chasser ci-dessus.

### 5.5 Actions immédiates (ordre strict)

1. **Railway > projet Academia Helm > service API > Deployments** : constater
   la date du dernier déploiement réussi (attendu : avant le 03/11). Puis
   **Deploy depuis main@6824fc8** et activer l'auto-déploy GitHub
   (Settings > Source > branche main) — sinon tout futur fix restera ignoré.
2. Vérifier la **liste de TOUS les services** du projet Railway (y compris
   arrêtés) pour trouver le process A ; sinon VPS (docker ps) / machine locale.
3. Console Neon > compute AcademiaHelm > **Suspend after inactivity = 5 min**
   (pas « always on »).
4. Après déploiement : lancer `python3 scripts/neon-verify-sleep.py` (10 min
   de surveillance) — verdict automatique ; la console Neon doit ensuite
   montrer le compute **suspended** entre les rafales 6 h.
5. **Rotation des credentials** (toujours pas faite) : mot de passe
   `neondb_owner` + token GitHub + variables Railway/Vercel.

### 5.6 Projection de coût après correctif déployé

Trafic de fond restant : balayages 6 h (00/06/12/18) + crons quotidiens
(~10/j) + auto-recovery 3×/j + helm-connect 6 h + cron Vercel 1×/j
≈ 20 réveils courts/jour → **~$5-10/mois** attendu (vs ~$50-65 mesurés,
et la trajectoire $158/3 mois).

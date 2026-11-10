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

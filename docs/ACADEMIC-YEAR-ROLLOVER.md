# Automatisation du Cycle Annuel + Trimestriel — Academia Helm

## Vue d'ensemble

Le système gère automatiquement le cycle annuel et trimestriel des années scolaires pour tous les tenants actifs. Plus besoin d'intervention manuelle pour clôturer une année terminée ou basculer de trimestre.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Cron @nestjs/schedule                                      │
│  ─────────────────────────                                   │
│  ┌─────────────────────────────────────────────┐            │
│  │ AcademicYearRolloverService                 │            │
│  │ @Cron(EVERY_DAY_AT_2AM)                     │            │
│  │ → Pour chaque tenant actif :                │            │
│  │   • Si année terminée → closeAndPromote     │            │
│  │   • Si fin ≤30j → pré-génère la suivante    │            │
│  │   • Si aucune active → génère l'année       │            │
│  │ → Notification email au directeur           │            │
│  └─────────────────────────────────────────────┘            │
│                                                              │
│  ┌─────────────────────────────────────────────┐            │
│  │ AcademicPeriodRolloverService               │            │
│  │ @Cron('5 2 * * *')  (2h05)                  │            │
│  │ → Pour chaque tenant :                      │            │
│  │   • Si période active dépassée → bascule    │            │
│  │   • Si aucune active → active la courante   │            │
│  └─────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

## Règles métier (calendrier type Bénin)

### Année scolaire
- **Pré-rentrée** : 2ᵉ lundi de septembre (lundi de la 2ᵉ semaine)
- **Rentrée officielle** : 3ᵉ lundi de septembre (lundi suivant)
- **Fin d'année** : dernier vendredi de juin de l'année suivante
- Format du nom : `YYYY-YYYY` (ex : `2025-2026`)

### Trimestres
- **T1** : pré-rentrée → 31 décembre (année de début)
- **T2** : 1er janvier → 31 mars (année de fin)
- **T3** : 1er avril → fin d'année (dernier vendredi de juin)

### Override manuel des règles
Si le gouvernement change les dates (ou pour un pays différent), chaque tenant peut personnaliser sa config via `SchoolCalendarConfig` (table `school_calendar_configs`). Les champs paramétrables sont :
- `startMonth` (défaut: 8 = septembre)
- `preEntryWeekNumber` (défaut: 2)
- `preEntryDayOfWeek` (défaut: 1 = lundi)
- `entryWeekOffset` (défaut: 1 semaine)
- `endMonth` (défaut: 5 = juin)
- `endDayOfWeek` (défaut: 5 = vendredi)
- `quarter1EndMonth` / `quarter1EndDay` (défaut: 11/31 = 31 déc)
- `quarter2EndMonth` / `quarter2EndDay` (défaut: 2/31 = 31 mars)
- `quarter3EndMonth` / `quarter3EndDay` (défaut: 5/30 = 30 juin)

Si aucun enregistrement `SchoolCalendarConfig` n'existe pour un tenant, les valeurs par défaut (Bénin) sont utilisées automatiquement — rétro-compatibilité garantie.

## Workflow automatisé

### Quotidiennement à 2h00 (années) + 2h05 (trimestres)

**Pour chaque tenant actif :**

1. **Vérification année active** :
   - Si `now > academicYear.endDate` → appel à `closeAndPromoteYear()`
     - Marque l'année comme `isClosed=true`, `isActive=false`
     - Crée l'entrée `AcademicYearClosure` (verrouillage)
     - Génère ou récupère l'année suivante, l'active
     - Crée les 3 trimestres par défaut pour la nouvelle année
     - Crée des enrollments `PROMOTION` pour chaque élève actif
   - Envoie un email de notification au(x) directeur(s) du tenant

2. **Pré-génération** :
   - Si l'année active se termine dans ≤ 30 jours ET que l'année suivante n'existe pas → la génère (non active)

3. **Auto-création** :
   - Si aucune année active n'existe → génère et active l'année courante

4. **Bascule des trimestres** (à 2h05, 5 min après le rollover annuel) :
   - Si `now > period.endDate` ET période active → `close()` + `activate()` la suivante
   - Si aucune période active mais qu'on est dans l'intervalle d'une période → l'active

### Workflow manuel (UI)

L'utilisateur peut aussi déclencher des actions manuelles depuis **Paramètres → Année scolaire** :

| Bouton | Action | Endpoint |
|---|---|---|
| Préparer la prochaine année | Génère l'année N+1 (non active) | `POST /settings/academic-years/generate-next` |
| Activer | Active une année spécifique | `POST /settings/academic-years/:id/activate` |
| Clôturer | Clôture une année inactive | `POST /settings/academic-years/:id/close` |
| **Passer à l'année suivante** | Clôture + active la suivante + promotions | `POST /settings/academic-years/:id/promote` |
| Modifier les dates | Override manuel des dates | `PUT /settings/academic-years/:id` |
| Créer les trimestres par défaut | Crée T1, T2, T3 selon la config | `POST /settings/academic-years/:id/periods/create-default` |

Le bouton **"Passer à l'année suivante"** (vert emerald, visible uniquement pour l'année active non clôturée) est le workflow recommandé en fin d'année — il fait tout en une seule transaction atomique.

## Configuration du calendrier scolaire (par tenant)

Accessible via **Paramètres → Calendrier scolaire** :

- `GET /settings/school-calendar-config` : lecture
- `PUT /settings/school-calendar-config` : mise à jour/création
- `POST /settings/school-calendar-config/reset` : réinitialisation aux valeurs par défaut (Bénin)

## Endpoints pour admin/debug

- `triggerManualRollover()` (méthode service) : force le cron immédiatement sans attendre 2h00. À exposer via un endpoint admin si besoin.

## Fichiers clés

### Backend
- `apps/api-server/src/academic-years/academic-year-rollover.service.ts` — Cron annuel + notifications
- `apps/api-server/src/settings/services/academic-period-rollover.service.ts` — Cron trimestriel
- `apps/api-server/src/settings/services/school-calendar-config.service.ts` — Config paramétrable
- `apps/api-server/src/settings/services/academic-year-settings.service.ts` — Service principal années
- `apps/api-server/src/settings/services/academic-period-settings.service.ts` — Service principal trimestres
- `apps/api-server/src/settings/settings.controller.ts` — Endpoints REST
- `apps/api-server/prisma/migrations/20260618000000_add_school_calendar_config/migration.sql` — Migration

### Frontend
- `apps/web-app/src/services/settings.service.ts` — Client API
- `apps/web-app/src/contexts/AcademicYearContext.tsx` — Contexte React + localStorage
- `apps/web-app/src/app/(app)/settings/page.tsx` — UI Paramètres (onglets Année scolaire + Calendrier scolaire)

## Sécurité & idempotence

- **Toutes les opérations sont transactionnelles** (Prisma `$transaction`)
- **Tous les cron jobs sont idempotents** : multi-exécution sans effet de bord
- **Le pattern "benin" est détecté automatiquement** (startDate.month === 8 && endDate.month === 5 && endDate.year === startDate.year + 1) — sinon fallback "3 parts égales"
- **Les notifications email sont non-bloquantes** : si l'email échoue, le rollover réussit quand même
- **Trigger SQL `prevent_update_if_year_closed`** empêche toute modification des notes/paiements/enrollments sur une année clôturée

## Tests

Voir `apps/api-server/src/academic-years/academic-year-rollover.service.spec.ts` pour les tests unitaires couvrant :
- Cas "année pas terminée → rien"
- Cas "année terminée → close + promote"
- Cas "année suivante inexistante → create + activate"
- Cas "année clôturée → rien"
- Cas "multi-tenant"

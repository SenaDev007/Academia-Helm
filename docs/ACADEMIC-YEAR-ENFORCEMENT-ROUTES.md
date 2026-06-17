# Routes exemptées d'année scolaire — Academia Helm

## Vue d'ensemble

Le mode "année scolaire stricte" exige que toutes les routes métier reçoivent un `academicYearId` (via le header `X-Academic-Year-ID` ou en query/body). Cependant, certaines routes sont légitimement sans année scolaire car elles gèrent des données de référence, de configuration, ou d'authentification.

Ce document liste les routes exemptées et explique pourquoi.

## Mécanisme d'exemption

### 1. Décorateur `@SkipAcademicYear()`
Marque une route ou un contrôleur comme exempté. À utiliser pour les cas spécifiques.

```typescript
@SkipAcademicYear()
@Get('/settings/general')
getGeneralSettings() {}
```

### 2. Décorateur `@Public()`
Les routes publiques (sans authentification) sont automatiquement exemptées.

### 3. Décorateur `@AllowCrossLevel()`
Les routes cross-level (Module Général) sont exemptées car elles peuvent traverser plusieurs années.

### 4. Fallback path-based
Le garde et l'interceptor ont une liste de prefixes de routes légitimement sans année. Cette liste est définie dans :
- `apps/api-server/src/common/guards/academic-year-enforcement.guard.ts` → méthode `isPathExempted()`
- `apps/api-server/src/common/interceptors/academic-year-enforcement.interceptor.ts` → méthode `isPathExempted()`

## Liste des routes exemptées (path-based)

| Prefix | Raison |
|---|---|
| `/auth/` | Authentification (login, register, OTP, password reset, Google OAuth) |
| `/countries` | Données de référence (pays) |
| `/departments` | Données de référence (départements) |
| `/school-levels` | Données de référence (niveaux scolaires) |
| `/schools` | Config école (tenant-level) |
| `/tenants` | Config tenant |
| `/users` | Gestion utilisateurs (tenant-level) |
| `/roles` | RBAC (tenant-level) |
| `/permissions` | RBAC (tenant-level) |
| `/rooms` | Infrastructure physique (salles) |
| `/academic-years` | Gestion des années scolaires elles-mêmes |
| `/academic-tracks` | Filières (config) |
| `/quarters` | Trimestres (config) |
| `/platform` | Back-office plateforme global |
| `/billing` | Facturation SaaS plateforme |
| `/onboarding` | Onboarding nouveau tenant |
| `/access-requests` | Demandes d'accès plateforme |
| `/portal` | Portail public (pré-inscription, recrutement) |
| `/reviews` | Avis publics plateforme |
| `/health` | Health check |
| `/media` | Upload média |
| `/sync` | Synchronisation offline-first |
| `/tenant-features` | Feature flags par tenant |
| `/audit-logs` | Audit logs (transverses) |
| `/sara` | Chatbot IA SARA |
| `/atlas` | Chatbot IA ATLAS |
| `/federis` | Réseau d'écoles Federis |
| `/security` | Sécurité plateforme |
| `/compliance` | Conformité |
| `/educmaster` | Config EducMaster |
| `/salary-policies` | Politiques salariales (config) |
| `/fee-configurations` | Configurations de frais (config) |
| `/grading-policies` | Politiques de notation (config) |
| `/settings/school-calendar-config` | Config calendrier scolaire |
| `/settings/general` | Paramètres généraux |
| `/settings/features` | Feature flags |
| `/settings/security` | Paramètres sécurité |
| `/settings/communication` | Paramètres communication |
| `/settings/bilingual` | Paramètres bilingue |
| `/settings/orion` | Paramètres ORION |
| `/settings/atlas` | Paramètres ATLAS |
| `/settings/offline` | Paramètres offline |
| `/settings/identity` | Identité établissement |
| `/settings/seals` | Cachets administratifs |
| `/settings/roles` | Rôles & permissions |
| `/settings/structure` | Structure pédagogique |
| `/settings/billing` | Paramètres facturation |
| `/settings/history` | Historique des changements |
| `/settings/stamps` | Cachets & signatures |

## Routes qui DOIVENT exiger l'année scolaire

Toutes les autres routes métier doivent recevoir `academicYearId` :

- `/students/*` — élèves, inscriptions, matricules, cartes d'identité
- `/finance/*` — paiements, frais, dépenses, transactions, recouvrement
- `/hr/*` — staff, contrats, paie, présences, congés, organigramme
- `/pedagogy/*` — classes, enseignants, matières, emplois du temps, cahiers
- `/exams/*` — examens, notes, bulletins, conseils de classe
- `/communication/*` — messages, annonces, campagnes
- `/modules-complementaires/*` — library, transport, canteen, infirmary, qhse, educast, shop, laboratory
- `/dashboard/*` — KPIs par rôle
- `/orion/*` — alertes, insights, KPIs ORION
- `/meetings/*` — réunions, comptes rendus
- `/discipline/*` — incidents disciplinaires
- `/absences/*` — absences
- `/grades/*` — notes
- `/subjects/*` — matières
- `/teachers/*` — enseignants
- `/expenses/*` — dépenses
- `/payments/*` — paiements
- `/payment-flows/*` — flux de paiement
- `/fee-configurations/*` — ⚠️ exempté (config) mais les installments devraient avoir une année
- `/kpi-objectives/*` — objectifs KPI
- `/classes/*` — classes
- `/qhs/*` — incidents QHSE

## Comment ajouter une nouvelle exemption

Si vous identifiez une route métier qui ne devrait pas exiger d'année scolaire :

1. **Privilégier le décorateur** `@SkipAcademicYear()` sur le contrôleur ou la méthode
2. **Si la route est dans un contrôleur entier sans année**, ajouter le prefix à `isPathExempted()` dans les deux fichiers (guard + interceptor)
3. **Documenter la raison** dans ce fichier

## Comment vérifier qu'une route reçoit bien l'année

Côté frontend, l'intercepteur Axios (`lib/api/client.ts`) injecte automatiquement `x-academic-year-id` depuis `localStorage['academicYear']` (objet JSON). Vérifier :

```javascript
// Dans la console du navigateur
localStorage.getItem('academicYear')
// Doit retourner un objet JSON avec un champ 'id'
```

Côté backend, le garde logge les violations dans la console :
```
ACADEMIC_YEAR_VIOLATION_ATTEMPT { tenantId, userId, endpoint, method, reason: 'Missing academic_year_id' }
```

Si vous voyez ce warning, c'est qu'un composant frontend n'envoie pas l'header. Utilisez `useModuleContext()` ou `useAcademicYear()` pour récupérer l'année courante.

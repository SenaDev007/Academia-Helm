# Filtre intelligent Rôles × Pistes × Niveaux — Topo de l'état actuel & Plan d'implémentation

> Date : 2026-09-06 · Périmètre : `apps/api-server` (NestJS/Prisma) + `apps/web-app` (Next.js 16)
> Objectif métier : tout membre du personnel (enseignant, directeur, secrétaire, secrétaire comptable)
> ne doit voir/écrire que les données de **son niveau scolaire** (Maternelle+Primaire vs Secondaire)
> et de **sa piste linguistique** (FR vs EN en école bilingue), dans TOUS les modules
> (Élèves, Finance, Pédagogie, Examens). L'UI doit être en français pour la piste FR, en anglais
> pour la piste EN.

---

## PARTIE 1 — TOPO DE L'ÉTAT ACTUEL (audit vérifié, fichier:ligne)

### 1.1 Vue synthétique

| Dimension | État | Verdict |
|---|---|---|
| Isolation **tenant** | JWT = source de vérité, header usurpable ignoré | ✅ Solide |
| Isolation **niveau scolaire** | Filtré par des valeurs **client-contrôlées** (header/query/body), jamais confrontées aux droits réels de l'utilisateur | 🔴 Illusoire |
| Isolation **piste FR/EN** | Inexistante côté serveur (0 garde, 0 filtre Prisma) ; dupliquée côté UI (pages FR/EN séparées) | 🔴 Absente |
| UI multilingue | Système i18n custom présent mais **jamais câblé** ; texte dur FR partout ; aucun champ langue dans User/session | 🔴 Inerte |
| Scoping **enseignant** (ses classes) | Partiel et contournable : `teacherId` passé en paramètre client, non vérifié contre l'identité connectée | 🟠 Fragile |

**Conclusion** : l'architecture multi-tenant est saine, mais les deux dimensions demandées
(niveau, piste) ne sont pas implémentées côté serveur. Tout est « filtré » par ce que le
frontend envoie — un header/query modifié suffit à tout voir.

---

### 1.2 Fondations du modèle de données — PRÊTES à 70 %

**Ce qui existe déjà (réutilisable)** :
- `SchoolLevel` (code MAT/PRI/SEC, mode FUSED_MATERNELLE_PRIMAIRE pour MAT+PRI fusionnés).
- `AcademicTrack` (FR/EN, `isDefault`) + `StudentAcademicTrack` (élève ↔ piste).
- `Class.schoolLevelId` + `Class.academicTrackId` + `Class.language` (schema.prisma:2404-2409).
- `Subject.academicTrackId` + `Subject.language` (schema.prisma:2477,2484).
- `Teacher.schoolLevelId` + `Teacher.assignedLanguages` (Json `["FR"]` / `["EN"]` / `["FR","EN"]`).
- `Staff.schoolLevelId` + `Staff.assignedLanguages` + `roleType` (TEACHER/admin).
- `StaffAssignment` (staffId → schoolLevelId, classId, subjectId) — affectation pédagogique.
- `StaffAdminAssignment` (adminRole DIRECTEUR/SECRETAIRE/SECRETAIRE_COMPTABLE… + schoolLevelCode MAT/PRI/SEC/MAT_PRI/ALL) — affectation administrative level-aware.
- Bilingue : `SettingsBilingual` + `bilingual-structure.service` (miroir EN des classes/sections, scope MAT+PRI uniquement).

**Manques bloquants du modèle** :
1. `StaffAdminAssignment` **n'a pas de dimension piste** (pas d'`academicTrackId`) → impossible de modéliser « Directeur piste FR ≠ Directeur piste EN ».
2. `Payment`, `Expense`, `FeeConfiguration`, `FinanceTransaction`… **n'ont pas d'`academicTrackId`** (dérivable via la classe, mais aucun code ne le fait).
3. `User` ne porte **ni niveau, ni piste, ni teacherId** → tout est re-dérivé à la volée par des chemins divergents.
4. Tables pédagogiques (`cahier_journal_entries`, `saisie_master_evaluations`, `class_diaries`) sans colonne langue/piste.

---

### 1.3 Authentification & résolution d'identité

- JWT (`jwt.strategy.ts:79-88`) : `{id, email, tenantId, role, isSuperAdmin, roles, permissions, portalType}` — **ni teacherId, ni niveaux, ni piste**.
- Login enseignant : `/api/portal/auth/teacher` par matricule → `Teacher` → `User` lié par email ; la réponse inclut `teacher.id` (`portal-auth.service.ts:433-467`).
- Login admin : `/auth/login` par email ; rôle stocké dans `User.role`.
- **Lien User ↔ Teacher/Staff = l'email** (fragile : 3 résolutions différentes coexistent — email, `teacher.createdBy`, `user.teacherId` jamais peuplé).
- ⚠️ **Bug `resolveUserRoleWithLevel`** (`admin-roles.ts:215-230`) : ne suffixe le rôle que pour
  MATERNELLE/PRIMAIRE/SECONDAIRE/MAT_PRI, or `StaffAdminAssignment` documente des codes
  **MAT/PRI/SEC** → une affectation « Secrétaire Comptable @ SEC » produit le rôle **générique**
  `SECRETAIRE_COMPTABLE` = **tous niveaux**. La restriction niveau est perdue dès la création du compte.
- ⚠️ `staff-credential.service.ts:226-231` : ne lit que **la première** affectation admin
  (`take: 1`) → les **cumuls** (directeur ET enseignant, plusieurs postes) sont écrasés.

---

### 1.4 Guards & middleware — existants mais majoritairement INERTES

Chargés globalement dans `app.module.ts:348-397` :

| Guard | Rôle supposé | Réalité |
|---|---|---|
| `JwtAuthGuard` | Authentification | ✅ Global, effectif (210/245 contrôleurs) |
| `TenantGuard` | Isolation tenant | ✅ JWT prime, header usurpé ignoré |
| `ContextValidationGuard`, `SchoolLevelIsolationGuard`, `AcademicYearEnforcementGuard` | Contexte niveau/année | ⚠️ **Conditionnés à `@RequireTenant()`** — utilisé par **1 contrôleur sur 245** (context.controller.ts) → inactifs partout ailleurs. Et même activés, ils ne vérifient que la **cohérence des paramètres** entre eux, jamais l'adéquation avec les **droits de l'utilisateur** |
| `LevelScopeGuard` | Le seul qui mappe rôle → niveaux autorisés | ❌ **Branché nulle part**. Fail-open ×3 (pas de header→OK, rôle inconnu→OK, erreur DB→OK). Ne lit que le header (contournable par query). Mapping bugué `PRIMARY` vs `PRIMAIRE`. **TEACHER absent du mapping → toutes niveaux** |
| `SchoolLevelIsolationGuard` règle 4 | Cross-level réservé au module Général | Contournable via `x-module-type` header client |
| — (piste) | — | ❌ **Aucun guard piste n'existe** ; header `x-academic-track` absent du CORS et de tout le code |
| `RolesGuard` | RBAC par rôle exact | ⚠️ Match exact de chaîne : `SECRETAIRE_COMPTABLE_SEC` **ne matche pas** `'SECRETAIRE_COMPTABLE'` → le rôle restrictif est rejeté, le générique passe (incitation à l'excès de droits) |
| `ALL_LEVEL_ROLES` (level-scope.guard.ts:108-122) | — | `SCHOOL_DIRECTOR`, `SECRETAIRE_COMPTABLE`… génériques = **tous niveaux** → un directeur générique voit le secondaire même si affecté Maternelle |

---

### 1.5 Modules métier — constats par module

#### Module Élèves (`src/students/`)
- `schoolLevelId` toujours **optionnel et client-contrôlé** ; la sentinelle `'ALL'` retourne tous les niveaux (`students-prisma.service.ts:146-157`).
- Lecture unitaire `GET /students/:id` et `/dossier` : **tenant seul** → un TEACHER lit le dossier complet (notes, discipline, guardians) de n'importe quel élève du tenant (`student-dossier.controller.ts:44` + TODO ligne 53).
- `POST /students`, `PUT /students/:id`, `enroll`, `promote`… : `schoolLevelId` du body jamais confronté aux droits de l'utilisateur.
- Exports globaux (`/students/export/global-*`, 4 routes) **sans `@Roles`** → tout utilisateur authentifié exporte tous les élèves de tous les niveaux.
- **Piste : 0 occurrence** dans tout le module (pas de `academicTrackId`, pas d'écriture de `StudentAcademicTrack`).
- Faille résiduelle tenant : `GET /students/identifiers/search/:matricule` sans filtre tenant.

#### Module Finance (`src/finance/`, `payments/`, `expenses/`, `fee-configurations/`) — le plus exposé
- Niveau **100 % client-contrôlé** (header `x-school-level-id` du body/query) ; `X-School-Level-ID: ALL` = tout voir (`payments-prisma.service.ts:130`).
- Lectures unitaires cross-niveau par ID (`payments/:id`, `expenses/:id`, `fees/definitions/:id`) : `where {id, tenantId}`.
- **15 rapports consolidés** (`/finance/reports/*`, `/finance/orion/*`) : `where {tenantId, academicYearId}` — aucun niveau, aucun rôle → un TEACHER (fail-open explicite `finance-transaction.controller.ts:58-62`) voit impayés, trésorerie, top-10 de tous les niveaux.
- Exports comptables FEC/OHADA (`/finance/exports/compta/*`) sans rôle ni niveau.
- Écritures : `POST /payments/enhanced` prend `body.schoolLevelId` tel quel ; `POST /finance/payments` accepte un `studentFeeId` d'un autre niveau.
- **Piste : 0 occurrence** (aucune table finance n'a d'`academicTrackId`).

#### Module Pédagogie (`src/pedagogy/`)
- Fiches/cahier journal filtrés par `tenantId + academicYearId + teacherId` — mais **`teacherId` est un paramètre client** : `resolveTeacherId` (service:58-90) accepte un ID Teacher brut → **impersonation d'un collègue** possible (fiches, cahiers).
- Rôles direction (`GLOBAL_ACCESS_ROLES`) : tout le tenant, sans niveau ni piste.
- ⭐ **Le bon pattern existe déjà, isolé** : `getAvailableSubjectsForClass` (service:7376-7456) lit **côté serveur** `Teacher.assignedLanguages` et filtre les matières (`s."language" = ANY(...)`) avec fallback sur `classes.language` — c'est le modèle à généraliser.
- `GET /lesson-plans` : filtres déclarés puis **ignorés** (retourne tout le tenant).
- `SaisieMasterController` : `@Public()` — CRUD évaluations **sans authentification**.
- Duplication UI : workspace `production` (FR) vs `production-en` (EN) au lieu d'un i18n.

#### Module Examens (`src/exams-grades/`)
- `language` et `academicTrackId` = **query params client** (`exams-prisma.controller.ts:43-…`, service:170-177) ; jamais dérivés du profil.
- `POST /exam-scores` : écriture de notes **sans vérification d'assignation** de l'enseignant, niveau/piste fournis par le client (service:21-112).
- Grading-sheet : vérification d'assignation **bypassée si `exam.classSubject` est null** (service:501-522) ; liste blanche direction sans notion de niveau → un directeur du Primaire saisit les notes du Secondaire.
- Bon point : propagation par copie `schoolLevelId`/`academicTrackId` à la création des examens/scores (service:552-568, 619-637) — mais la **source initiale est le client**.
- ⚠️ 3 endpoints avec fallback tenant sur header client + fallback SQL sans tenant (`exams-prisma.controller.ts:143/165/193`, service:662-666).

#### Transverse
- `POST /pedagogy/academic-structure/sections` accepte un `tenantId` du body (override).
- Bulletins : `generateReportCard` supporte `academicTrackId`+`language` quand fournis — mais c'est le DTO client qui décide.

---

### 1.6 Frontend (`apps/web-app`) — mécaniques présentes, non câblées

- **i18n inopérant** : `I18nContext.tsx` + dictionnaires fr/en/ar (241 clés) + `LanguageSwitcher` existent mais `useI18n` n'est **consommé par aucun composant** ; texte dur FR partout. Couverture 241 clés ≪ ~113 pages + 604 composants.
- **Aucune langue/piste dans User/session** : impossible aujourd'hui de dériver la locale UI du compte.
- Langue UI déterminée par `localStorage` (site-wide), sans lien avec le profil.
- `BilingualContext` : `currentTrack` persisté mais **réinitialisé à 'FR' à chaque chargement** (BilingualContext.tsx:111-117).
- ⭐ `SchoolLevelSelector` + `SchoolLevelContext` : **le bon pattern** — filtrage des niveaux par rôle/accreditations, lock mono-niveau, invalidation des queries au changement, header `x-school-level-id` injecté par l'intercepteur axios (`client.ts:66-74`). Mais **absent du portail enseignant**.
- `AcademicTrackSelector` : affiché seulement côté direction, lock par **heuristique** sur accreditations avec TODO explicite (« récupérer la langue depuis /api/hr/school-directors/me », AcademicTrackSelector.tsx:58).
- Portail enseignant : FR uniquement (workspace `production`), **pas d'espace EN**, ni sélecteur de niveau, ni toggle de langue.
- Routage par rôle : `role-portal-map.ts` (77+ rôles → 5 portails) et `admin-portal-map.ts` (6 shells dont secrétaire-comptable en union des 2 métiers) — **base RBAC riche et saine**.
- Double casquette gérée : un directeur peut se connecter via le portail enseignant (matricule) → `/app/teacher`.
- Filtre piste appliqué **côté client** dans examens (`exams/level-isolation.ts`) et MyClassesTab (« le filtre client est la source de vérité », commentaire MyClassesTab.tsx:53-55).

---

### 1.7 Récapitulatif des failles majeures (toutes vérifiées)

| # | Faille | Gravité | Localisation |
|---|---|---|---|
| F1 | Niveau lu depuis le client (header/query/body), jamais confronté aux droits réels | 🔴 | Tous modules |
| F2 | `'ALL'` bypass → tous les niveaux | 🔴 | students/finance |
| F3 | Lectures unitaires cross-niveau par ID (IDOR) | 🔴 | students/:id, finance/:id, exams/:id, fiches/:id |
| F4 | Piste absente côté serveur (0 filtre, 0 guard, 0 champ finance) | 🔴 | tous |
| F5 | Écritures sans validation du niveau (créer/modifier élèves, paiements, notes) | 🔴 | tous |
| F6 | Rapports/exports consolidés sans rôle ni niveau (finance FEC/OHADA, exports élèves) | 🔴 | finance, students |
| F7 | Impersonation enseignant via `teacherId` en query param | 🔴 | pedagogy-space |
| F8 | `POST /exam-scores` sans vérification d'assignation | 🔴 | exams |
| F9 | SaisieMaster `@Public()` sans auth | 🔴 | pedagogy |
| F10 | Guards niveau inertes (condition `@RequireTenant()` jamais posée) + LevelScopeGuard jamais branché + fail-open | 🔴 | common/guards |
| F11 | `resolveUserRoleWithLevel` perd le niveau pour codes MAT/PRI/SEC + cumuls écrasés (take:1) | 🟠 | admin-roles, staff-credential |
| F12 | Rôles génériques (SCHOOL_DIRECTOR…) = tous niveaux ; RolesGuard match exact qui **punit les rôles suffixés** | 🟠 | level-scope.guard, roles.guard |

---

## PARTIE 2 — PLAN D'IMPLÉMENTATION PROPRE ET PROFESSIONNELLE

### Principe directeur

> **« Never trust the client scope »** — le périmètre (niveaux autorisés, pistes autorisées,
> classes pour un enseignant) est **dérivé côté serveur depuis la base** (tables métier :
> Teacher, Staff, StaffAssignment, StaffAdminAssignment), résolu **une fois par requête**,
> mis en cache, puis **imposé** aux requêtes Prisma. Le client peut *affiner* dans son scope,
> jamais *élargir*.

Architecture cible — un « **Access Scope** » central :

```
Request (JWT) ──▶ JwtStrategy.validate()
                    └─▶ AccessScopeService.resolveUserScope(user)   ← cache 2 min
                          levels: ['MAT','PRI'], tracks: ['FR'],     (depuis DB métier)
                          teacherId?, staffId?, isTeacher, isMultiLevel, isAdmin …
                              │
                    request.user.scope
                              │
              ┌───────────────┴──────────────────┐
        ScopeGuard (global)              applyScope() helper Prisma
        • valide x-school-level-id        • where.schoolLevelId ∈ scope.levels
          contre scope.levels             • where.academicTrackId ∈ scope.tracks
        • mono-niveau → impose SON niveau  • vérif post-fetch sur les lectures unitaires
        • mono-piste  → impose SA piste    • validation du body sur les écritures
        • sinon 403 + audit-log
```

---

### Phase 0 — Fondations modèle & fixes de base (1,5 j)

1. **Migration Prisma** :
   - `StaffAdminAssignment` + `academicTrackId` (nullable ⇒ les deux pistes ; FR sinon). Index `@@index([tenantId, schoolLevelCode, academicTrackId])`.
   - `Payment`, `Expense`, `FeeConfiguration`, `FinanceTransaction` + `academicTrackId` (nullable, rétro-compat ; rempli à l'écriture depuis la classe de l'élève).
2. **Fix `resolveUserRoleWithLevel`** : accepter MAT/PRI/SEC (suffixe) en plus des formes longues.
3. **Fix cumuls** : `staff-credential.service` → agréger **toutes** les affectations actives (rôle le plus large = union des scopes ; le scope reste porté par les tables, le rôle n'est plus la seule source).
4. **Normalisation rétro-compat** : `assignedLanguages` null → `['FR']` (piste par défaut).

### Phase 1 — Noyau : AccessScopeService + enrichissement JWT (2-3 j)

1. **`AccessScopeService`** (`src/common/context/access-scope.service.ts`) :
   - `resolveUserScope(user)` → `{ staffId?, teacherId?, isTeacher, isAdmin, levels: string[] (codes), tracks: ('FR'|'EN')[], classIds?: string[] }`.
   - Sources, par ordre : `Teacher` (email) → `schoolLevelId` + `assignedLanguages` ; `StaffAdminAssignment` actives (toutes) → `schoolLevelCode` + `academicTrackId` ; `StaffAssignment` actives → `schoolLevelId` + classes (union, cumuls gérés).
   - Cache mémoire 2 min (même mécanique que jwt.strategy) — révocation ≤ 2 min sans re-login.
   - Rôles plateforme/promoteur (transverses) → scope explicite « all ».
2. **Enrichissement** : `JwtStrategy.validate()` appelle le scope et attache `request.user.scope`. Le **payload JWT reste inchangé** (le scope est résolu à la volée → changements d'affectation effectifs immédiatement).
3. **Login/portails** : réponse enrichie (`teacher: {id, schoolLevelCode, tracks}`, `locale` dérivée) pour que le frontend initialise sa langue et ses sélecteurs sans heuristique.
4. **Enrichissement des endpoints « me »** : `/context` et `/hr/school-directors/me` exposent le scope (supprime le TODO de `AcademicTrackSelector.tsx:58`).

### Phase 2 — Guards durcis, rollout progressif (2 j)

1. **`ScopeGuard` global** (remplace/vaporalise `LevelScopeGuard`) :
   - Lit `request.user.scope` (pas de mapping statique de rôle).
   - `x-school-level-id`/`?schoolLevelId` fourni ⇒ doit ∈ `scope.levels`, sinon **403 + audit log** (plus de `'ALL'` pour les non-transverses).
   - Utilisateur **mono-niveau** ⇒ le scope **impose** son niveau (header ignoré).
   - Décorateur `@ScopeEnforced()` posé d'abord sur les contrôleurs des 4 modules cibles (students, finance, pedagogy, exams-grades), puis étendu — évite de casser les 35 contrôleurs sans JwtAuthGuard et les routes transverses.
2. **`TrackScopeGuard`** (nouveau) : même logique pour la piste — résout `academicTrackId`/`language` effectif de la requête (param client ∈ scope.tracks sinon 403 ; mono-piste → imposé).
3. **Fix `SchoolLevelIsolationGuard`** : vérifier le header contre le scope (plus seulement la cohérence header/body).
4. **Fix `RolesGuard`** : normaliser les suffixes (`_MAT/_PRI/_SEC/_MAT_PRI` rattachés au rôle de base) pour ne plus punir les rôles restrictifs.
5. Mapping `PRIMARY`→`PRIMAIRE` corrigé.

### Phase 3 — Filtrage applicatif des 4 modules (5-8 j, le gros du travail)

Mécanique unique `applyScope(where, scope, {enforceLevel, enforceTrack})` :
- **Listes** : `AND schoolLevelId IN scope.levels` (+ `academicTrackId IN scope.tracks` ou `language ∈ tracks` selon la table) — le filtre client ne peut qu'affiner **dans** le scope.
- **Unitaires** : post-fetch, si l'enregistrement ∉ scope → 403.
- **Écritures** : `body.schoolLevelId`/classe/référence élève ∈ scope, sinon 400/403.
- **Enseignants** : restreindre en plus aux `classIds` de `TeacherClassAssignment`/`StaffAssignment` (élèves de ses classes, saisie de notes de ses matières uniquement).

Par module :
- **Élèves** : scope forcé sur findAll/statistics/abandons/enrollments/admissions ; IDOR corrigé sur `/:id` et `/dossier` (enseignant = élèves de ses classes) ; `@Roles` sur exports globaux + scope sur les exports ; création/modification : niveau validé ; écriture de `StudentAcademicTrack` à l'inscription ; correction des 2 failles tenant résiduelles.
- **Finance** : scope forcé sur paiements/frais/dépenses/trésorerie ; **rapports consolidés réservés aux rôles transverses multi-niveaux** (promoteur, DIRECTEUR_GENERAL) — un secrétaire comptable MAT+PRI voit le consolidé de SON périmètre uniquement ; suppression du bypass `'ALL'` ; `@Roles` sur reports/orion/exports + fail-open TEACHER corrigé ; `academicTrackId` dérivé de la classe de l'élève à chaque écriture.
- **Pédagogie** : `resolveTeacherId` refusé en paramètre client — résolu depuis `user.scope.teacherId` uniquement (fin de l'impersonation) ; généralisation du pattern `getAvailableSubjectsForClass` (lecture serveur de `Teacher.assignedLanguages`) à fiches, cahiers, matières ; `@Public()` retiré de SaisieMaster (ou portail signé dédié) ; filtres ignorés de `lesson-plans` branchés.
- **Examens** : `language`/`academicTrackId` dérivés du scope serveur (param client toléré s'il ∈ scope) ; `POST /exam-scores` + grading-sheet : vérification d'assignation enseignant **sans bypass** ; suppression des fallbacks tenant header/SQL sans tenant ; génération de bulletins : piste propagée.

### Phase 4 — Frontend : UI pilotée par le profil (3-5 j)

1. **Langue = profil** : à la connexion, la réponse (`locale` + `tracks`) initialise `I18nProvider` ; mono-piste FR → UI FR, EN → UI EN ; bi-piste → toggle manuel (persistant). `LanguageSwitcher` enfin monté.
2. **Branchement i18n progressif** : d'abord les coquilles (sidebars/topbars/layouts des portails enseignant, direction, secrétaire, comptable), puis module par module. Étendre les dictionnaires (~241 → plusieurs centaines de clés).
3. **Fusion des duplications** : `production` / `production-en` → un seul workspace paramétré par `currentTrack` ; portail enseignant EN rendu accessible.
4. **Sélecteurs guidés par le scope serveur** : `SchoolLevelSelector` étendu au portail enseignant (mono-niveau → lock) ; `AcademicTrackSelector` piloté par `/me` (fin de l'heuristique) ; `BilingualContext` corrigé (persistance réelle).
5. **Intercepteur axios** : envoi de la langue du contexte ; le niveau reste `x-school-level-id` (désormais validé serveur).
6. Dégradation propre : si `scope.tracks = ['FR','EN']` → sélecteur visible ; sinon UI fixée, aucune option de changement.

### Phase 5 — Tests & validation (2-3 j)

1. **Tests E2E matriciels** (script type `verify_scope_matrix.mjs`) : comptes de test {enseignant FR primaire, enseignant EN, enseignant cumul admin, directeur FR mat+pri, directeur EN, secrétaire comptable SEC, promoteur} × endpoints clés des 4 modules → assertions 200/403.
2. **Tests d'intrusion API** : header `x-school-level-id` falsifié, `'ALL'`, `teacherId` d'autrui, `language=EN` pour un FR, IDs d'autres niveaux → 403 attendus partout.
3. Vérification visuelle (VLM) des portails FR et EN.
4. Plan de rollback : décorateurs `@ScopeEnforced()` retirables module par module.

---

### Décisions d'architecture à valider

| # | Question | Recommandation |
|---|---|---|
| D1 | Piste sur les affectations admin : `StaffAdminAssignment.academicTrackId` null = les deux pistes ? | ✅ Oui — null = bi-piste (rétro-compat : les directeurs existants restent bi-piste) |
| D2 | Le promoteur/tenant-owner est-il filtré par piste/niveau ? | Non — transverse, il voit son école entière |
| D3 | Qui voit les consolidés multi-niveaux (finance/reports, exports) ? | Rôles transverses uniquement (PROMOTER, DIRECTOR_GENERAL, SCHOOL_ADMIN) ; les level-scoped voient le consolidé de leur périmètre |
| D4 | Cumul enseignant+admin : portail ? | Garder le choix à la connexion (portail École ou Enseignant) — le scope serveur est le même, seule l'UI diffère |
| D5 | Enseignant bi-piste (`["FR","EN"]`) : UI ? | Toggle FR/EN visible, données des deux pistes (c'est son métier), langue par défaut = FR |
| D6 | Secondaire bilingue ? | `bilingual-structure` se limite à MAT+PRI aujourd'hui — l'EN secondaire restera piste-données sans miroir structure tant que non demandé |

### Estimation & risques

- **Effort** : ~14-21 jours-homme (Phases 0-5), découpage en 5 PR indépendantes (une par phase).
- **Risque principal** : casser des flux existants en durcissant (35 contrôleurs sans JwtAuthGuard, exports utilisés par la direction, `@Public` SaisieMaster peut être utilisé en prod) → **rollout progressif par décorateur module par module + mode advisory (log-only) 48 h avant enforcement**.
- **Migration de données** : les comptes actuels en rôles génériques doivent être re-affectés via `StaffAdminAssignment` (HR) pour hériter des restrictions — prévoir un script de requalif.
- **Ordre conseillé** : Phase 0-1 (noyau) → 2 (guards sur finance d'abord — risque le plus élevé) → 3 (students, exams, pedagogy) → 4 (frontend) → 5.

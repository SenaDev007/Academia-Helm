# 📊 Analyse Préparation Synchronisation Offline - Academia Hub

**Date** : Analyse du schéma PostgreSQL pour préparation offline  
**Statut** : ✅ **ANALYSE COMPLÈTE**  
**Action** : ❌ **AUCUNE CRÉATION SQLITE** (analyse uniquement)

---

## 🎯 Objectif

Identifier et classifier les tables PostgreSQL nécessaires pour la synchronisation offline, en préparant le schéma SQLite qui sera un **miroir strict** du schéma PostgreSQL avec colonnes techniques supplémentaires.

---

## 📋 Classification des Tables

### 1. Tables de Référence (READ-ONLY - Miroir Strict) ✅

**Caractéristiques** :
- Données de référence rarement modifiées
- Lecture fréquente
- **Synchronisation** : DOWNLOAD uniquement (PostgreSQL → SQLite)
- **Colonnes techniques** : `sync_status`, `local_updated_at` (pas de `device_id`)

#### Liste des Tables de Référence :

| Table | Nom SQL | Usage Offline | Criticité |
|-------|---------|---------------|-----------|
| **Country** | `countries` | Lecture référence pays | ⭐⭐⭐ Essentielle |
| **AcademicYear** | `academic_years` | Lecture année active | ⭐⭐⭐ Essentielle |
| **SchoolLevel** | `school_levels` | Lecture niveaux (Maternelle, Primaire, Secondaire) | ⭐⭐⭐ Essentielle |
| **AcademicTrack** | `academic_tracks` | Lecture parcours (FR, EN) | ⭐⭐ Importante |
| **Subject** | `subjects` | Lecture matières | ⭐⭐⭐ Essentielle |
| **FeeCategory** | `fee_categories` | Lecture catégories de frais | ⭐⭐ Importante |
| **GradingPolicy** | `grading_policies` | Lecture politique de notation | ⭐⭐ Importante |
| **Role** | `roles` | Lecture rôles système | ⭐⭐ Importante |
| **Permission** | `permissions` | Lecture permissions | ⭐⭐ Importante |

**Total** : ~9 tables de référence

---

### 2. Tables de Configuration (READ-FREQUENT - Miroir Strict) ✅

**Caractéristiques** :
- Configuration du tenant/école
- Lecture très fréquente, écriture rare
- **Synchronisation** : DOWNLOAD principalement (PostgreSQL → SQLite)
- **Colonnes techniques** : `sync_status`, `local_updated_at`, `device_id` (si modification locale)

#### Liste des Tables de Configuration :

| Table | Nom SQL | Usage Offline | Criticité |
|-------|---------|---------------|-----------|
| **Tenant** | `tenants` | Lecture config tenant | ⭐⭐⭐ Essentielle |
| **School** | `schools` | Lecture config école | ⭐⭐⭐ Essentielle |
| **SchoolSettings** | `school_settings` | Lecture paramètres école | ⭐⭐ Importante |
| **SecuritySettings** | `security_settings` | Lecture paramètres sécurité | ⭐ Importante |
| **FeeRegime** | `fee_regimes` | Lecture régimes tarifaires | ⭐⭐⭐ Essentielle |
| **FeeDefinition** | `fee_definitions` | Lecture définitions de frais | ⭐⭐⭐ Essentielle |

**Total** : ~6 tables de configuration

---

### 3. Tables Métier Critiques (READ/WRITE - Miroir Strict) ✅

**Caractéristiques** :
- Données métier fréquemment lues et modifiées
- **Synchronisation** : BIDIRECTIONNEL (SQLite ↔ PostgreSQL)
- **Colonnes techniques** : `sync_status`, `local_updated_at`, `device_id` (obligatoires)

#### Liste des Tables Métier Critiques :

| Table | Nom SQL | Usage Offline | Criticité | Sync Fréquence |
|-------|---------|---------------|-----------|----------------|
| **User** | `users` | Authentification, profils | ⭐⭐⭐ Essentielle | Haute |
| **Student** | `students` | Dossiers élèves | ⭐⭐⭐ Essentielle | Très Haute |
| **Guardian** | `guardians` | Tuteurs/parents | ⭐⭐⭐ Essentielle | Haute |
| **StudentGuardian** | `student_guardians` | Relations élève-tuteur | ⭐⭐⭐ Essentielle | Haute |
| **Class** | `classes` | Classes | ⭐⭐⭐ Essentielle | Haute |
| **Teacher** | `teachers` | Enseignants | ⭐⭐⭐ Essentielle | Haute |
| **Grade** | `grades` | Notes | ⭐⭐⭐ Essentielle | Très Haute |
| **Exam** | `exams` | Examens | ⭐⭐⭐ Essentielle | Haute |
| **AttendanceRecord** | `attendance_records` | Présences | ⭐⭐⭐ Essentielle | Très Haute |
| **Absence** | `absences` | Absences | ⭐⭐⭐ Essentielle | Haute |
| **Discipline** | `discipline` | Discipline | ⭐⭐ Importante | Moyenne |
| **Payment** | `payments` | Paiements | ⭐⭐⭐ Essentielle | Très Haute |
| **StudentFee** | `student_fees` | Frais élèves | ⭐⭐⭐ Essentielle | Très Haute |
| **FeeInstallment** | `fee_installments` | Versements | ⭐⭐ Importante | Haute |
| **TuitionPayment** | `tuition_payments` | Paiements scolarité | ⭐⭐⭐ Essentielle | Très Haute |

**Total** : ~15 tables métier critiques

---

### 4. Tables Métier Secondaires (READ/WRITE - Miroir Strict) ✅

**Caractéristiques** :
- Données métier moins fréquemment utilisées
- **Synchronisation** : BIDIRECTIONNEL (SQLite ↔ PostgreSQL)
- **Colonnes techniques** : `sync_status`, `local_updated_at`, `device_id`

#### Liste des Tables Métier Secondaires :

| Table | Nom SQL | Usage Offline | Criticité |
|-------|---------|---------------|-----------|
| **ClassStudent** | `class_students` | Inscriptions classes | ⭐⭐ Importante |
| **HomeworkEntry** | `homework_entries` | Devoirs | ⭐⭐ Importante |
| **HomeworkSubmission** | `homework_submissions` | Soumissions devoirs | ⭐⭐ Importante |
| **LessonJournal** | `lesson_journals` | Journaux de classe | ⭐ Importante |
| **LessonPlan** | `lesson_plans` | Plans de cours | ⭐ Importante |
| **ReportCard** | `report_cards` | Bulletins | ⭐⭐ Importante |
| **Meeting** | `meetings` | Réunions | ⭐ Importante |
| **Message** | `messages` | Messages | ⭐⭐ Importante |
| **Announcement** | `announcements` | Annonces | ⭐⭐ Importante |
| **StudentDocument** | `student_documents` | Documents élèves | ⭐⭐ Importante |
| **Expense** | `expenses` | Dépenses | ⭐⭐ Importante |
| **LibraryLoan** | `library_loans` | Emprunts bibliothèque | ⭐ Importante |

**Total** : ~12 tables métier secondaires

---

### 5. Tables Techniques de Synchronisation (LOCAL ONLY) ✅

**Caractéristiques** :
- Tables gérant la synchronisation offline
- **Existent déjà** dans PostgreSQL : `SyncOperation`, `SyncConflict`, `SyncLog`
- **Nouvelle table nécessaire** : `outbox_events` (SQLite uniquement pour stocker événements en attente)

#### Tables Techniques :

| Table | Nom SQL | Usage | Localisation |
|-------|---------|-------|--------------|
| **SyncOperation** | `sync_operations` | Journal opérations sync | PostgreSQL + SQLite |
| **SyncConflict** | `sync_conflicts` | Conflits de sync | PostgreSQL + SQLite |
| **SyncLog** | `sync_logs` | Logs de sync | PostgreSQL + SQLite |
| **OutboxEvent** | `outbox_events` | Événements en attente | **SQLite uniquement** |

**Total** : 4 tables techniques (3 existent déjà, 1 à créer en SQLite)

---

### 6. Tables NON Nécessaires Offline (SKIP) ❌

**Caractéristiques** :
- Tables système ou technique
- Tables d'audit/logs uniquement serveur
- Tables temporaires

#### Liste des Tables à Exclure :

| Table | Nom SQL | Raison Exclusion |
|-------|---------|------------------|
| **AuditLog** | `audit_logs` | Logs serveur uniquement |
| **MessageLog** | `message_logs` | Logs serveur uniquement |
| **PortalSession** | `sessions` | Sessions serveur |
| **PasswordReset** | `password_resets` | Tokens temporaires |
| **PublicVerificationToken** | `public_verification_tokens` | Tokens temporaires |
| **SchemaVersion** | `schema_versions` | Technique migration |
| Tables de **cache** ou **stats** | - | Calculées serveur |

**Total** : ~8-10 tables à exclure

---

## 📊 Résumé des Tables par Catégorie

| Catégorie | Nombre | Synchronisation | Colonnes Techniques |
|-----------|--------|-----------------|---------------------|
| **Référence** | ~9 | DOWNLOAD uniquement | `sync_status`, `local_updated_at` |
| **Configuration** | ~6 | DOWNLOAD principalement | `sync_status`, `local_updated_at`, `device_id` |
| **Métier Critiques** | ~15 | BIDIRECTIONNEL | `sync_status`, `local_updated_at`, `device_id` |
| **Métier Secondaires** | ~12 | BIDIRECTIONNEL | `sync_status`, `local_updated_at`, `device_id` |
| **Techniques** | 4 | Gestion sync | Spécifique |
| **EXCLUES** | ~10 | - | - |
| **TOTAL SQLITE** | **~46 tables** | - | - |

---

## 🔧 Colonnes Techniques Offline

### Colonnes à Ajouter dans SQLite (pour tables métier)

Chaque table métier (catégories 2, 3, 4) doit contenir :

```sql
-- Colonnes techniques de synchronisation
sync_status TEXT DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced', 'conflict', 'error'))
  -- pending : Non synchronisé
  -- synced : Synchronisé avec PostgreSQL
  -- conflict : Conflit détecté (serveur = source de vérité)
  -- error : Erreur de synchronisation

local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL
  -- Date de dernière modification locale (avant sync)

device_id TEXT
  -- Identifiant unique du dispositif qui a fait la modification
  -- NULL si modifié depuis PostgreSQL
```

### Tables de Référence (Catégorie 1)

Tables de référence n'ont **PAS** besoin de `device_id` (lecture seule) :

```sql
sync_status TEXT DEFAULT 'synced' CHECK(sync_status IN ('synced', 'outdated'))
local_updated_at TEXT DEFAULT (datetime('now'))
  -- Pas de device_id (download uniquement)
```

---

## 📋 Liste Complète des Tables Offline

### Phase 1 : Tables Essentielles (46 tables)

#### Référence (9 tables)
1. `countries`
2. `academic_years`
3. `school_levels`
4. `academic_tracks`
5. `subjects`
6. `fee_categories`
7. `grading_policies`
8. `roles`
9. `permissions`

#### Configuration (6 tables)
10. `tenants`
11. `schools`
12. `school_settings`
13. `security_settings`
14. `fee_regimes`
15. `fee_definitions`

#### Métier Critiques (15 tables)
16. `users`
17. `students`
18. `guardians`
19. `student_guardians`
20. `classes`
21. `teachers`
22. `grades`
23. `exams`
24. `attendance_records`
25. `absences`
26. `discipline`
27. `payments`
28. `student_fees`
29. `fee_installments`
30. `tuition_payments`

#### Métier Secondaires (12 tables)
31. `class_students`
32. `homework_entries`
33. `homework_submissions`
34. `lesson_journals`
35. `lesson_plans`
36. `report_cards`
37. `meetings`
38. `messages`
39. `announcements`
40. `student_documents`
41. `expenses`
42. `library_loans`

#### Techniques (4 tables)
43. `sync_operations`
44. `sync_conflicts`
45. `sync_logs`
46. `outbox_events` (SQLite uniquement)

---

## ✅ Règles de Miroir Strict

### 1. Structure Identique

- ✅ **Noms de tables** : Identiques (`@@map` dans Prisma)
- ✅ **Noms de colonnes** : Identiques (camelCase conservé)
- ✅ **Types de colonnes** : Convertis (String → TEXT, DateTime → TEXT avec ISO8601)
- ✅ **Contraintes** : Préservées (PRIMARY KEY, UNIQUE, FOREIGN KEY si possible)
- ✅ **Index** : Répliqués pour performance

### 2. Colonnes Structurantes

Toutes les tables métier contiennent déjà dans PostgreSQL :

```sql
tenantId TEXT NOT NULL
academicYearId TEXT          -- nullable selon contexte
schoolLevelId TEXT           -- nullable selon contexte
createdAt TEXT NOT NULL
updatedAt TEXT NOT NULL
```

**Ces colonnes seront présentes dans SQLite également.**

### 3. Colonnes Techniques (SQLite uniquement)

**À ajouter lors de la génération SQLite** :

```sql
-- Pour tables métier (catégories 2, 3, 4)
sync_status TEXT DEFAULT 'pending'
local_updated_at TEXT DEFAULT (datetime('now'))
device_id TEXT

-- Pour tables référence (catégorie 1)
sync_status TEXT DEFAULT 'synced'
local_updated_at TEXT DEFAULT (datetime('now'))
-- Pas de device_id
```

---

## 📊 Statistiques

**Total tables PostgreSQL** : ~269 tables  
**Total tables SQLite nécessaires** : ~46 tables (~17% du schéma complet)

**Justification** : 
- Focus sur données métier critiques
- Exclusion des logs/audit serveur
- Exclusion des tables temporaires/tokens
- Exclusion des tables système/cache

---

## 🎯 Prochaines Étapes (Phase Future)

### Étape 1 : Génération Schéma SQLite

```bash
# Utiliser le script existant
npm run generate:sqlite-schema

# Vérifier la conformité
npm run validate:schema
```

### Étape 2 : Migration des Données Initiales

1. Download des tables de référence
2. Download des configurations tenant
3. Synchronisation bidirectionnelle des données métier

### Étape 3 : Implémentation Sync Service

1. Service de synchronisation DOWNLOAD (PostgreSQL → SQLite)
2. Service de synchronisation UPLOAD (SQLite → PostgreSQL)
3. Gestion des conflits (serveur = source de vérité)
4. Outbox pattern pour événements offline

---

## ✅ Validation

Cette analyse garantit que :

- ✅ **Toutes les tables critiques** sont identifiées
- ✅ **Colonnes techniques** sont définies clairement
- ✅ **Règles de miroir strict** sont documentées
- ✅ **Classification** permet priorisation de sync
- ✅ **Prêt pour génération SQLite** future

---

**⚠️ IMPORTANT** : Aucune base SQLite n'a été créée lors de cette analyse.  
**✅ Prêt** pour la phase d'implémentation offline future.

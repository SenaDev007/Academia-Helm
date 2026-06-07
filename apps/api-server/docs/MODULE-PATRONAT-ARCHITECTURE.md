# 🏛️ Module Patronat & Examens Nationaux - Architecture

## 📋 Vue d'ensemble

Le module **Patronat & Examens Nationaux** est un module institutionnel intégré à Academia Hub, conçu pour l'organisation des examens nationaux par les patronats d'écoles privées, associations départementales et organismes organisateurs d'examens.

## 🎯 Principes d'Architecture

### ✅ UN SEUL SCHÉMA PRISMA
- **Tous les modèles** sont dans `schema.prisma`
- **Aucune base séparée** - PostgreSQL unique
- **Isolation métier** par naming : `patronat_*`, `exam_*`, `question_bank_*`

### ✅ ISOLATION PAR TENANT.TYPE
- `Tenant.type = 'SCHOOL'` → Module école
- `Tenant.type = 'PATRONAT'` → Module patronat
- **Séparation logique**, pas physique

### ✅ DIMENSIONS FONDAMENTALES
Toutes les tables métier respectent :
- `tenantId` (obligatoire)
- `academicYearId` (obligatoire)
- `schoolLevelId` (optionnel, selon contexte)
- `createdAt`, `updatedAt` (audit)

## 📊 Modèles Principaux

### 🏢 ENTITÉS PATRONAT

#### `Patronat`
- **Un patronat = un tenant PATRONAT**
- Relation 1:1 avec `Tenant`
- Informations institutionnelles (nom légal, numéro d'enregistrement, région, scope)

#### `PatronatUser`
- Utilisateurs du patronat
- Rôles : `PATRONAT_ADMIN`, `PATRONAT_OPERATOR`, `EXAM_SUPERVISOR`, `EXAM_VIEWER`
- Permissions granulaires
- Référence à `User` existant

#### `PatronatSchool`
- **Table de liaison** Patronat ↔ École
- Rattachement d'écoles existantes (tenant SCHOOL)
- Statut : `PENDING`, `ACTIVE`, `SUSPENDED`, `REJECTED`
- Invitation par token
- Accès contrôlé : `READ_ONLY` ou `FULL_ACCESS`

### 📝 EXAMENS NATIONAUX

#### `NationalExam`
- Examens nationaux (CEP, BEPC, BAC, Concours)
- Dates d'inscription et d'examen
- Statut : `DRAFT`, `REGISTRATION_OPEN`, `REGISTRATION_CLOSED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`

#### `ExamCenter`
- Centres d'examen
- Capacité, salles, contact
- Relation avec `NationalExam`

#### `ExamCandidate`
- Candidats aux examens
- Numéro d'inscription unique, matricule, numéro de table
- Rattachement à école (si existante) ou création minimale
- Affectation centre/salle

#### `ExamRoom`
- Salles d'examen
- Capacité, occupation
- Relation avec `ExamCenter`

#### `ExamSupervisor`
- Surveillants d'examen
- Rôles : `SUPERVISOR`, `HEAD_SUPERVISOR`, `OBSERVER`
- Assignation centre/salle

#### `NationalExamSubject`
- Épreuves/matières d'examen
- Coefficient, durée, note maximale
- Dates et horaires

#### `ExamResult`
- Résultats par candidat/matière
- Score, note pondérée, mention, classement
- Statut : `DRAFT`, `VALIDATED`, `PUBLISHED`
- Validation par utilisateur autorisé

#### `ExamDocument`
- Documents générés (listes de surveillance, relevés, attestations)
- Types : `LISTE_SURVEILLANCE`, `RELEVE_NOTES`, `ATTESTATION`, `CERTIFICAT`
- Génération et publication traçables

### 📚 BANQUE D'ÉPREUVES

#### `QuestionBankResource`
- Ressources partagées (sujets, corrections, tests)
- Types : `EXAM_SUBJECT`, `PRACTICE_TEST`, `CORRECTION`
- Niveau d'accès : `PUBLIC`, `RESTRICTED`, `PRIVATE`
- Upload par patronat, accessible aux écoles

#### `ResourceAccessLog`
- Journal d'accès aux ressources
- Traçabilité : qui, quand, depuis quelle école
- Types : `VIEW`, `DOWNLOAD`, `PREVIEW`

## 🔗 Relations avec les Écoles

### Cas 1 : École existante Academia Hub
1. Recherche par `tenantId` (tenant SCHOOL)
2. Création `PatronatSchool` avec statut `PENDING`
3. Invitation envoyée à l'école
4. Validation par l'école → statut `ACTIVE`
5. Accès en lecture contrôlée aux données nécessaires

### Cas 2 : École inexistante
1. Création minimale d'un tenant SCHOOL
2. Saisie des candidats directement
3. Option de migration future vers module complet

## 🔐 Sécurité & Permissions

### Rôles Patronat
- **PATRONAT_ADMIN** : Administration complète
- **PATRONAT_OPERATOR** : Gestion opérationnelle
- **EXAM_SUPERVISOR** : Supervision examens
- **EXAM_VIEWER** : Consultation seule

### Cloisonnement
- Chaque patronat accède uniquement à ses données
- Écoles : accès limité à leurs candidats
- Audit logs obligatoires pour toutes les opérations

## 🔄 Offline-First

### SQLite Local
- **Miroir strict** des tables PostgreSQL
- Même nommage, mêmes colonnes
- Colonnes techniques autorisées :
  - `sync_status`
  - `local_updated_at`
  - `local_device_id`

### Synchronisation
- PostgreSQL = source de vérité
- SQLite = travail hors ligne
- Sync contrôlée, versionnée
- Blocage si schéma incompatible

## 🧠 Intégration ORION

ORION peut :
- Détecter anomalies d'inscription
- Alerter sur incohérences
- Produire rapports institutionnels
- **Rester en lecture seule** (rôle `academia_orion`)

## 📋 Tables Créées

### Tables Principales
1. `patronats`
2. `patronat_users`
3. `patronat_schools`
4. `national_exams`
5. `exam_centers`
6. `exam_candidates`
7. `exam_rooms`
8. `exam_supervisors`
9. `national_exam_subjects`
10. `exam_results`
11. `exam_documents`
12. `question_bank_resources`
13. `resource_access_logs`

### Modifications Existantes
- `Tenant` : ajout champ `type` (SCHOOL | PATRONAT)
- Relations ajoutées dans `Tenant`, `User`, `AcademicYear`, `SchoolLevel`

## ✅ Conformité

- ✅ **Dimensions fondamentales** : `tenantId`, `academicYearId` présents
- ✅ **Audit** : `createdAt`, `updatedAt`, `createdBy` présents
- ✅ **Relations** : Toutes les relations définies avec `@relation` explicites
- ✅ **Index** : Index sur clés étrangères et champs de recherche
- ✅ **Contraintes** : Unicité sur combinaisons critiques

## 🚀 Prochaines Étapes

1. **Migration Prisma** : Générer et appliquer la migration
2. **API Backend** : Créer les endpoints NestJS
3. **UI Patronat** : Interface dédiée
4. **SQLite Schema** : Générer le schéma local
5. **Sync Service** : Adapter pour le module Patronat
6. **Documentation** : Guides utilisateur et technique

---

**Architecture validée** ✅  
**Prêt pour implémentation backend** 🚀


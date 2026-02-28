# 🏗️ Analyse Architecturale Complète - Academia Hub

**Date d'analyse** : 2025-01-17  
**Architecte** : Analyse Senior  
**Version du projet** : 1.0.0

---

## 📋 Table des Matières

1. [Vue d'Ensemble](#vue-densemble)
2. [Architecture Globale](#architecture-globale)
3. [Structure du Monorepo](#structure-du-monorepo)
4. [Backend API (NestJS)](#backend-api-nestjs)
5. [Base de Données (Prisma + PostgreSQL)](#base-de-données-prisma--postgresql)
6. [Sécurité & Isolation Multi-Tenant](#sécurité--isolation-multi-tenant)
7. [Modules Fonctionnels](#modules-fonctionnels)
8. [Patterns & Bonnes Pratiques](#patterns--bonnes-pratiques)
9. [Recommandations](#recommandations)

---

## 🎯 Vue d'Ensemble

**Academia Hub** est une plateforme SaaS complète de gestion scolaire multi-tenant, construite avec une architecture moderne et scalable.

### Caractéristiques Principales

- **Multi-tenant** : Isolation stricte des données par tenant
- **Multi-niveaux** : Support de plusieurs niveaux scolaires (Primaire, Collège, Lycée, etc.)
- **Multi-années** : Gestion des années académiques
- **Modulaire** : Architecture basée sur des modules fonctionnels indépendants
- **Offline-First** : Support de la synchronisation hors ligne
- **Sécurisé** : Row-Level Security (RLS) au niveau base de données

---

## 🏛️ Architecture Globale

### Stack Technologique

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                           │
├─────────────────────────────────────────────────────────────┤
│  • Next.js (web-app)     - Application Web Production       │
│  • React + Vite (desktop-app) - Application Desktop Modèle  │
│  • Mobile App (mobile-app) - Application Mobile             │
└─────────────────────────────────────────────────────────────┘
                            ↕ REST API
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND LAYER                            │
├─────────────────────────────────────────────────────────────┤
│  • NestJS (api-server)   - API REST                         │
│  • Prisma ORM            - Gestion de la base de données    │
│  • PostgreSQL            - Base de données principale       │
│  • JWT Authentication    - Authentification                  │
│  • Row-Level Security    - Sécurité au niveau DB            │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                │
├─────────────────────────────────────────────────────────────┤
│  • PostgreSQL            - Base de données                  │
│  • Prisma Migrations     - Gestion des schémas              │
│  • RLS Policies          - Politiques de sécurité           │
└─────────────────────────────────────────────────────────────┘
```

### Flux de Données

```
Client (Browser/Desktop/Mobile)
    ↓
API Gateway (NestJS)
    ↓
Guards & Interceptors (Validation, Isolation, Context)
    ↓
Controllers (Endpoints REST)
    ↓
Services (Logique Métier)
    ↓
Prisma Client (ORM)
    ↓
PostgreSQL (avec RLS)
```

---

## 📁 Structure du Monorepo

```
academia-hub/
├── apps/
│   ├── api-server/          # Backend NestJS (Production)
│   ├── web-app/             # Frontend Next.js (Production)
│   ├── desktop-app/          # Application Desktop (Modèle)
│   ├── mobile-app/          # Application Mobile
│   ├── next-app/            # Application Next.js alternative
│   └── migration-tools/     # Outils de migration
├── database/                # Scripts de base de données
├── docs/                    # Documentation
├── public/                  # Assets statiques
└── package.json             # Configuration monorepo
```

### Applications Principales

#### 1. **api-server** (Backend)
- **Framework** : NestJS 10.3.0
- **ORM** : Prisma 5.19.0
- **Base de données** : PostgreSQL
- **Port** : 3000 (par défaut)
- **Préfixe API** : `/api`

#### 2. **web-app** (Frontend Production)
- **Framework** : Next.js (App Router)
- **Déploiement** : Vercel
- **Type** : Application Web SaaS

#### 3. **desktop-app** (Modèle de Référence)
- **Framework** : Vite + React
- **Type** : Application Desktop Electron
- **Usage** : Modèle de référence pour certaines fonctionnalités

---

## 🔧 Backend API (NestJS)

### Structure des Modules

L'API est organisée en **modules fonctionnels** suivant une architecture modulaire claire :

```
src/
├── app.module.ts                    # Module racine
├── main.ts                          # Point d'entrée
├── common/                          # Code partagé
│   ├── context/                     # Gestion du contexte
│   ├── guards/                      # Guards de sécurité
│   ├── interceptors/                # Interceptors
│   ├── decorators/                  # Décorateurs personnalisés
│   └── services/                    # Services partagés
├── auth/                            # Authentification
├── users/                           # Gestion des utilisateurs
├── tenants/                         # Gestion des tenants
├── students/                        # Module Étudiants
├── academic-years/                  # Années académiques
├── school-levels/                   # Niveaux scolaires
├── academic-tracks/                 # Parcours académiques
├── classes/                         # Classes
├── subjects/                        # Matières
├── teachers/                        # Enseignants
├── exams/                           # Examens
├── grades/                          # Notes
├── finance/                         # Module Finance
├── hr/                              # Module RH
├── pedagogy/                        # Module Pédagogie
├── communication/                   # Module Communication
├── meetings/                        # Module Réunions
├── orion/                           # Module ORION (Pilotage)
├── qhs/                             # Module QHSE
├── settings/                        # Module Paramètres
├── modules-complementaires/         # Modules complémentaires
├── sync/                            # Synchronisation offline
└── portal/                          # Portail public
```

### Guards Globaux (Sécurité)

L'application utilise **7 guards globaux** pour garantir la sécurité :

1. **JwtAuthGuard** : Authentification JWT
2. **TenantValidationGuard** : Validation du tenant
3. **TenantIsolationGuard** : Isolation stricte inter-tenant
4. **ContextValidationGuard** : Validation du contexte complet
5. **SchoolLevelIsolationGuard** : Isolation des niveaux scolaires
6. **AcademicYearEnforcementGuard** : Enforcement de l'année académique
7. **ThrottlerGuard** : Rate limiting

### Interceptors Globaux

1. **ContextInterceptor** : Résolution du contexte (tenant, school_level, module)
2. **SchoolLevelEnforcementInterceptor** : Enforcement automatique du school_level_id
3. **AcademicYearEnforcementInterceptor** : Enforcement automatique de l'academic_year_id
4. **AuditLogInterceptor** : Logs d'audit automatiques

### Rate Limiting

Configuration multi-niveaux :
- **Short** : 10 requêtes/seconde
- **Medium** : 100 requêtes/minute
- **Long** : 1000 requêtes/heure

---

## 🗄️ Base de Données (Prisma + PostgreSQL)

### Schéma Prisma

Le schéma Prisma contient **plus de 150 modèles** organisés en modules fonctionnels :

#### Modèles Core
- `Tenant` : Gestion multi-tenant
- `Country` : Pays
- `AcademicYear` : Années académiques
- `SchoolLevel` : Niveaux scolaires (Primaire, Collège, Lycée)
- `AcademicTrack` : Parcours académiques (FR, EN, Bilingue)
- `User` : Utilisateurs
- `Role` / `Permission` : RBAC
- `School` : Établissements scolaires

#### Module Étudiants
- `Student` : Étudiants
- `StudentEnrollment` : Inscriptions
- `StudentIdentifier` : Identifiants uniques
- `StudentIdCard` : Cartes scolaires
- `Guardian` : Tuteurs
- `StudentGuardian` : Relations tuteurs-étudiants
- `StudentAcademicRecord` : Dossiers académiques
- `StudentDocument` : Documents étudiants

#### Module Pédagogie
- `Class` : Classes
- `Subject` : Matières
- `Teacher` : Enseignants
- `Timetable` : Emplois du temps
- `LessonPlan` : Plans de cours
- `PedagogicalSheet` : Fiches pédagogiques
- `ClassDiary` : Journaux de classe

#### Module Examens & Notes
- `Exam` : Examens
- `ExamSession` : Sessions d'examen
- `Grade` : Notes
- `ExamScore` : Scores d'examen
- `ReportCard` : Bulletins
- `Ranking` : Classements
- `HonorRoll` : Tableaux d'honneur

#### Module Finance
- `FeeDefinition` : Définitions de frais
- `StudentFee` : Frais étudiants
- `Payment` : Paiements
- `PaymentAllocation` : Allocation des paiements
- `PaymentReceipt` : Reçus
- `TuitionPayment` : Paiements de scolarité
- `Expense` : Dépenses
- `TreasuryMovement` : Mouvements de trésorerie

#### Module RH
- `Staff` : Personnel
- `Contract` : Contrats
- `Payroll` : Paies
- `SalaryPayment` : Paiements de salaires
- `StaffAttendance` : Présence du personnel
- `StaffEvaluation` : Évaluations

#### Module Communication
- `Message` : Messages
- `MessageTemplate` : Modèles de messages
- `ScheduledMessage` : Messages programmés
- `AutomatedTrigger` : Déclencheurs automatiques
- `SmsLog` / `EmailLog` / `WhatsappLog` : Logs de communication

#### Module ORION (Pilotage)
- `OrionAlert` : Alertes
- `OrionReport` : Rapports
- `OrionInsight` : Insights
- `KpiDefinition` : Définitions de KPI
- `KpiSnapshot` : Snapshots de KPI

#### Modules Complémentaires
- `CanteenMenu` / `CanteenEnrollment` : Cantine
- `Vehicle` / `Route` / `TransportAssignment` : Transport
- `LibraryBook` / `LibraryLoan` : Bibliothèque
- `Lab` / `LabEquipment` : Laboratoires
- `MedicalRecord` : Dossiers médicaux
- `ShopProduct` / `ShopSale` : Boutique
- `EducastContent` : Contenu éducatif

### Règles Fondamentales du Schéma

1. **Toute table métier DOIT contenir** :
   - `tenantId` (obligatoire)
   - `academicYearId` (obligatoire)
   - `schoolLevelId` (obligatoire)
   - `academicTrackId` (optionnel, nullable pour compatibilité FR)

2. **Isolation Multi-Tenant** :
   - Toutes les requêtes sont filtrées par `tenantId`
   - RLS (Row-Level Security) au niveau PostgreSQL

3. **Isolation Multi-Niveaux** :
   - Les données sont isolées par `schoolLevelId`
   - Pas de mélange entre niveaux scolaires

### Migrations

- **Système** : Prisma Migrate
- **Emplacement** : `apps/api-server/prisma/migrations/`
- **Migration initiale** : `20260117123009_init_academia_helm`
- **RLS Policies** : `rls-policies.sql`

---

## 🔒 Sécurité & Isolation Multi-Tenant

### Architecture de Sécurité Multi-Couche

```
┌─────────────────────────────────────────┐
│  Layer 1: JWT Authentication          │
│  - Validation du token                │
│  - Extraction du tenantId             │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│  Layer 2: Tenant Validation Guard      │
│  - Vérification de l'existence         │
│  - Vérification du statut              │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│  Layer 3: Tenant Isolation Guard       │
│  - Vérification du tenantId            │
│  - Injection automatique               │
│  - Blocage des modifications           │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│  Layer 4: Context Resolution           │
│  - Résolution du schoolLevelId         │
│  - Résolution du module                │
│  - Validation du contexte              │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│  Layer 5: School Level Isolation      │
│  - Isolation stricte des niveaux       │
│  - Enforcement automatique              │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│  Layer 6: Database RLS                 │
│  - Politiques au niveau PostgreSQL     │
│  - Sécurité au niveau DB               │
└─────────────────────────────────────────┘
```

### Mécanismes d'Isolation

#### 1. Isolation Tenant
- **Guard** : `TenantIsolationGuard`
- **Vérifications** :
  - Présence du `tenantId`
  - Correspondance avec le tenant de l'utilisateur
  - Blocage des modifications de `tenantId` dans le body
  - Injection automatique du `tenantId` si absent

#### 2. Isolation School Level
- **Guard** : `SchoolLevelIsolationGuard`
- **Interceptor** : `SchoolLevelEnforcementInterceptor`
- **Vérifications** :
  - Présence du `schoolLevelId`
  - Blocage des modifications de `schoolLevelId`
  - Injection automatique du `schoolLevelId`

#### 3. Enforcement Academic Year
- **Guard** : `AcademicYearEnforcementGuard`
- **Interceptor** : `AcademicYearEnforcementInterceptor`
- **Vérifications** :
  - Présence de l'`academicYearId`
  - Validation de l'année académique active

### Row-Level Security (RLS)

Le projet utilise **Row-Level Security** au niveau PostgreSQL pour une sécurité supplémentaire :

- **Politiques RLS** : Définies dans `rls-policies.sql`
- **Rôles** :
  - `academia_app` : Rôle API (lecture/écriture)
  - `academia_orion` : Rôle ORION (lecture seule)
- **Isolation automatique** : Toutes les requêtes sont automatiquement filtrées par tenant

---

## 📦 Modules Fonctionnels

### Module 1 : Scolarité (Students)
**Fichiers** : `apps/api-server/src/students/`

**Fonctionnalités** :
- Gestion des étudiants
- Matricules globaux
- Cartes scolaires
- Dossiers académiques
- Vérification publique
- Tuteurs/Guardians
- Présence/Absences
- Discipline
- Documents
- Transfers

**Controllers** :
- `StudentsPrismaController`
- `GuardiansPrismaController`
- `AttendancePrismaController`
- `DisciplinePrismaController`
- `DocumentsPrismaController`
- `TransfersPrismaController`
- `StudentIdentifierController`
- `StudentIdCardController`
- `PublicVerificationController`
- `StudentDossierController`

### Module 2 : Pédagogie
**Fichiers** : `apps/api-server/src/pedagogy/`

**Fonctionnalités** :
- Classes
- Matières
- Enseignants
- Emplois du temps
- Plans de cours
- Fiches pédagogiques
- Journaux de classe
- Salles

### Module 3 : Examens & Notes
**Fichiers** : `apps/api-server/src/exams-grades/`

**Fonctionnalités** :
- Examens
- Sessions d'examen
- Notes
- Bulletins
- Classements
- Tableaux d'honneur
- Conseils de classe

### Module 4 : Finance
**Fichiers** : `apps/api-server/src/finance/`

**Fonctionnalités** :
- Définitions de frais
- Frais étudiants
- Paiements
- Allocation des paiements
- Reçus
- Dépenses
- Trésorerie
- Cas de recouvrement

### Module 5 : RH & Paie
**Fichiers** : `apps/api-server/src/hr/`

**Fonctionnalités** :
- Personnel
- Contrats
- Paies
- Présence
- Évaluations
- CNSS
- Impôts

### Module 6 : Communication
**Fichiers** : `apps/api-server/src/communication/`

**Fonctionnalités** :
- Messages
- Modèles
- Messages programmés
- Automatisation
- SMS/Email/WhatsApp
- Statistiques

### Module 7 : Réunions
**Fichiers** : `apps/api-server/src/meetings/`

**Fonctionnalités** :
- Réunions administratives
- Réunions pédagogiques
- Réunions parents
- Ordres du jour
- Procès-verbaux
- Signatures électroniques

### Module 8 : ORION (Pilotage)
**Fichiers** : `apps/api-server/src/orion/`

**Fonctionnalités** :
- Tableaux de bord
- Alertes
- Rapports
- Insights
- KPI
- Audit

### Module 9 : Modules Complémentaires
**Fichiers** : `apps/api-server/src/modules-complementaires/`

**Fonctionnalités** :
- Cantine
- Transport
- Bibliothèque
- Laboratoires
- Dossiers médicaux
- Boutique
- Educast

### Module 10 : QHSE
**Fichiers** : `apps/api-server/src/qhs/`

**Fonctionnalités** :
- Inspections
- Incidents
- Actions correctives
- Conformité
- Risques
- Audit QHSE

### Module 11 : Paramètres
**Fichiers** : `apps/api-server/src/settings/`

**Fonctionnalités** :
- Paramètres d'école
- Paramètres de sécurité
- Paramètres offline
- Paramètres ORION
- Paramètres Atlas
- Historique des paramètres

---

## 🎨 Patterns & Bonnes Pratiques

### 1. Architecture Modulaire

Chaque module suit une structure cohérente :

```
module-name/
├── module-name.module.ts        # Module NestJS
├── module-name.controller.ts    # Controllers REST
├── module-name.service.ts      # Services métier
├── module-name-prisma.service.ts  # Services Prisma
├── module-name-prisma.controller.ts # Controllers Prisma
├── entities/                    # Entités TypeORM (legacy)
├── dto/                         # Data Transfer Objects
└── services/                    # Services spécialisés
```

### 2. Dual ORM Pattern

Le projet utilise **deux ORMs** :

1. **TypeORM** (Legacy) : Pour certaines entités existantes
2. **Prisma** (Principal) : Pour toutes les nouvelles fonctionnalités

**Pattern** :
- Services Prisma : `*-prisma.service.ts`
- Controllers Prisma : `*-prisma.controller.ts`
- Migration progressive vers Prisma uniquement

### 3. Service Layer Pattern

Séparation claire des responsabilités :

```
Controller (HTTP Layer)
    ↓
Service (Business Logic)
    ↓
Prisma Service (Data Access)
    ↓
Database
```

### 4. Context Pattern

Le projet utilise un **système de contexte unifié** :

- **Service** : `RequestContextService`
- **Résolution** : Tenant → School Level → Module
- **Injection** : Automatique dans toutes les requêtes
- **Validation** : Stricte à chaque requête

### 5. Guard Chain Pattern

Les guards sont exécutés en chaîne pour une sécurité maximale :

```
JWT Auth → Tenant Validation → Tenant Isolation → 
Context Validation → School Level Isolation → 
Academic Year Enforcement → Rate Limiting
```

### 6. Interceptor Chain Pattern

Les interceptors enrichissent les requêtes :

```
Context Resolution → School Level Enforcement → 
Academic Year Enforcement → Audit Logging
```

### 7. DTO Validation

Utilisation de **class-validator** pour la validation :

- Validation automatique via `ValidationPipe`
- Transformation automatique des types
- Whitelist des propriétés autorisées

---

## 💡 Recommandations

### 1. Migration Complète vers Prisma

**État actuel** : Dual ORM (TypeORM + Prisma)  
**Recommandation** : Migrer complètement vers Prisma

**Avantages** :
- Code plus simple et maintenable
- Type-safety amélioré
- Meilleures performances
- Un seul ORM à maintenir

### 2. Documentation API

**État actuel** : Documentation basique dans `API-ENDPOINTS.md`  
**Recommandation** : Implémenter Swagger/OpenAPI

**Avantages** :
- Documentation interactive
- Génération automatique de clients
- Validation des schémas

### 3. Tests

**État actuel** : Configuration Jest présente  
**Recommandation** : Ajouter des tests unitaires et E2E

**Priorités** :
- Tests unitaires des services
- Tests d'intégration des controllers
- Tests E2E des flux critiques

### 4. Monitoring & Observabilité

**Recommandation** : Ajouter :
- Logging structuré (Winston/Pino)
- Métriques (Prometheus)
- Tracing (OpenTelemetry)
- Health checks

### 5. Cache Strategy

**Recommandation** : Implémenter un cache Redis pour :
- Données fréquemment accédées (tenants, school levels)
- Sessions utilisateurs
- Résultats de requêtes complexes

### 6. API Versioning

**Recommandation** : Implémenter le versioning d'API :
- `/api/v1/...`
- `/api/v2/...`
- Facilite les évolutions sans casser les clients

### 7. GraphQL (Optionnel)

**Recommandation** : Considérer GraphQL pour :
- Réduire le nombre de requêtes
- Flexibilité pour les clients
- Introspection automatique

### 8. Event-Driven Architecture (Futur)

**Recommandation** : Considérer des événements pour :
- Communication asynchrone entre modules
- Découplage des services
- Scalabilité horizontale

### 9. Microservices (Futur)

**Recommandation** : À long terme, considérer la migration vers microservices :
- Séparation par domaine métier
- Déploiement indépendant
- Scalabilité granulaire

### 10. Documentation Technique

**Recommandation** : Enrichir la documentation :
- Diagrammes d'architecture
- Guides de développement
- Standards de code
- Runbooks opérationnels

---

## 📊 Métriques du Projet

### Taille du Code

- **Modèles Prisma** : ~150+ modèles
- **Controllers** : ~109 controllers
- **Modules NestJS** : ~50+ modules
- **Guards** : 7 guards globaux
- **Interceptors** : 4 interceptors globaux

### Complexité

- **Multi-tenant** : ✅ Implémenté
- **Multi-niveaux** : ✅ Implémenté
- **Multi-années** : ✅ Implémenté
- **Offline-First** : ✅ Implémenté
- **RLS** : ✅ Implémenté
- **Rate Limiting** : ✅ Implémenté
- **Audit Logging** : ✅ Implémenté

---

## 🎯 Conclusion

**Academia Hub** est une plateforme SaaS bien architecturée avec :

✅ **Points Forts** :
- Architecture modulaire claire
- Sécurité multi-couche robuste
- Isolation stricte multi-tenant
- Schéma de base de données complet
- Patterns modernes et maintenables

⚠️ **Points d'Amélioration** :
- Migration complète vers Prisma
- Tests automatisés
- Documentation API interactive
- Monitoring & observabilité
- Cache strategy

**Verdict** : Architecture solide et scalable, prête pour la production avec quelques améliorations recommandées.

---

**Document généré le** : 2025-01-17  
**Version** : 1.0.0

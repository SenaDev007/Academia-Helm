# Architecture ERP Academia Hub - Vue d'Ensemble Complète

## 🏗️ PRINCIPES ARCHITECTURAUX

### 1. Multi-Tenant Stricte
- Chaque module respecte `tenant_id`
- Isolation complète des données
- Guards et interceptors automatiques

### 2. Support Bilingue FR/EN
- Via `AcademicTrack` (FR, EN)
- Colonnes `academic_track_id` sur tables pédagogiques
- Filtrage automatique par track

### 3. Gestion par Niveau Scolaire
- Via `SchoolLevel` (Maternelle, Primaire, Secondaire)
- Colonnes `school_level_id` sur tables concernées
- Context validation automatique

### 4. Offline-First
- SQLite local par tenant
- Journal des opérations
- Sync bidirectionnelle
- Résolution de conflits

### 5. Séparation Financière
- `PaymentFlow` : SAAS vs TUITION
- Comptes école séparés
- Traçabilité complète

### 6. IA Décisionnelle
- **ORION** : Analyse & décision (lecture seule)
- **ATLAS** : Assistance opérationnelle

### 7. Tarification Dynamique
- Par modules activés
- Par options (bilingue)
- Par groupes scolaires

---

## 📦 MODULES CŒUR (Existant)

### ✅ Élèves & Scolarité
- `StudentsModule` - Gestion des élèves
- `ClassesModule` - Classes
- `SubjectsModule` - Matières
- `AcademicYearsModule` - Années scolaires
- `QuartersModule` - Trimestres

### ✅ Finances
- `PaymentsModule` - Paiements
- `ExpensesModule` - Dépenses
- `FeeConfigurationsModule` - Configurations frais
- `PaymentFlowsModule` - Flux paiements (SAAS/TUITION)

### ✅ RH
- `TeachersModule` - Enseignants
- `SalaryPoliciesModule` - Politiques salariales
- `DepartmentsModule` - Départements

### ✅ Évaluation
- `ExamsModule` - Examens
- `GradesModule` - Notes
- `GradingPoliciesModule` - Politiques de notation

### ✅ Présence & Discipline
- `AbsencesModule` - Absences
- `DisciplineModule` - Discipline

### ✅ Système
- `AuthModule` - Authentification
- `UsersModule` - Utilisateurs
- `RolesModule` - Rôles
- `PermissionsModule` - Permissions
- `AuditLogsModule` - Audit
- `TenantsModule` - Tenants
- `SchoolLevelsModule` - Niveaux scolaires
- `AcademicTracksModule` - Tracks académiques
- `TenantFeaturesModule` - Feature flags

---

## 📦 MODULES ADDITIONNELS (À Créer)

### 📚 Bibliothèque
- Gestion des livres
- Emprunts/retours
- Catalogue
- Pénuries

### 🚌 Transport
- Gestion des bus
- Itinéraires
- Conducteurs
- Suivi GPS (optionnel)

### 🍽️ Cantine
- Menus
- Commandes
- Paiements
- Statistiques consommation

### 🏥 Infirmerie
- Visites médicales
- Vaccinations
- Urgences
- Dossiers médicaux

### 🛡️ QHSE (Qualité, Hygiène, Sécurité, Environnement)
- Inspections
- Incidents
- Formations sécurité
- Conformité

### 🛒 Boutique
- Produits
- Commandes
- Stocks
- Ventes

### 📡 EduCast
- Annonces
- Diffusion messages
- Campagnes
- Analytics

### 💬 Communication
- Messages internes
- Notifications
- Annonces
- Groupes

### 📅 Planification
- Emploi du temps
- Réservations salles
- Événements
- Calendrier

---

## 🤖 IA - ORION & ATLAS

### ORION (Analyse & Décision)
- Analyse performance pédagogique
- Analyse financière
- Analyse RH
- Alertes intelligentes
- Rapports exécutifs
- **Lecture seule** (ne modifie jamais les données)

### ATLAS (Assistance Opérationnelle)
- Guide workflows
- Réponses contextuelles
- Suggestions actions
- Aide à la saisie
- Respect permissions

---

## 🔄 OFFLINE-FIRST

### Architecture
- SQLite local par tenant
- Journal des opérations (`operation_logs`)
- Sync bidirectionnelle
- Résolution de conflits (last-write-wins ou merge)

### Tables Locales
- Répliques des tables principales
- Colonne `sync_status` (PENDING, SYNCED, CONFLICT)
- Colonne `last_synced_at`

---

## 💰 TARIFICATION DYNAMIQUE

### Structure
- `Module` : Code, nom, prix mensuel/annuel
- `TenantModule` : Activation module par tenant
- `PricingRule` : Règles de calcul (par élève, par classe, etc.)

### Calcul
- Prix de base
+ Modules activés
+ Options (bilingue, etc.)
+ Majorations (nombre élèves, etc.)

---

## 🔐 SÉCURITÉ & AUDIT

### RBAC
- Rôles hiérarchiques
- Permissions granulaires
- Context-aware (tenant + niveau + track)

### Audit
- Toutes écritures journalisées
- Historique modifications
- Exports légaux

---

## 📊 STRUCTURE DES MODULES

Chaque module suit cette structure :

```
module-name/
├── entities/
│   └── module-name.entity.ts
├── dto/
│   ├── create-module-name.dto.ts
│   └── update-module-name.dto.ts
├── module-name.repository.ts
├── module-name.service.ts
├── module-name.controller.ts
└── module-name.module.ts
```

### Contraintes par Module
- `tenant_id` obligatoire
- `academic_track_id` si applicable (pédagogique)
- `school_level_id` si applicable
- Audit logs automatiques
- Permissions vérifiées

---

## 🎯 PROCHAINES ÉTAPES

1. Créer l'architecture modulaire de base
2. Implémenter les modules additionnels
3. Créer ATLAS
4. Améliorer ORION
5. Implémenter offline-first
6. Système de tarification
7. Documentation complète


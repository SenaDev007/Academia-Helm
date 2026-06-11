# ✅ Checklist de Conformité - Academia Hub

## 📋 Pour Tout Nouveau Module

### 🏗️ Architecture

- [ ] **Entité avec `tenant_id` obligatoire**
  - Colonne `tenant_id` présente
  - Relation `ManyToOne` vers `Tenant`
  - Contrainte `ON DELETE CASCADE`

- [ ] **Filtrage automatique par tenant**
  - Repository filtre par `tenant_id`
  - Guards appliqués (`TenantIsolationGuard`)

- [ ] **Support `academic_track_id` si pédagogique**
  - Colonne `academic_track_id` (nullable)
  - Relation `ManyToOne` vers `AcademicTrack`
  - Service assigne track par défaut si non fourni

- [ ] **Support `school_level_id` si applicable**
  - Colonne `school_level_id` (nullable)
  - Relation `ManyToOne` vers `SchoolLevel`
  - Filtrage par niveau si nécessaire

- [ ] **Timestamps**
  - `created_at` (TIMESTAMPTZ)
  - `updated_at` (TIMESTAMPTZ)
  - Trigger pour `updated_at` automatique

---

### 🔐 Sécurité

- [ ] **Guards appliqués**
  - `JwtAuthGuard` : Authentification
  - `TenantValidationGuard` : Validation tenant
  - `TenantIsolationGuard` : Isolation tenant
  - `ContextValidationGuard` : Validation contexte
  - `RolesGuard` : Permissions RBAC

- [ ] **Permissions RBAC définies**
  - Permissions spécifiques au module
  - Rôles autorisés par endpoint
  - Vérification dans guards

- [ ] **Décorateurs utilisés**
  - `@TenantId()` : Extraction tenant_id
  - `@CurrentUser()` : Extraction utilisateur
  - `@SchoolLevelId()` : Extraction school_level_id
  - `@Roles()` : Définition rôles autorisés

---

### 📊 Audit & Traçabilité

- [ ] **Audit logs pour toutes les écritures**
  - `CREATE` : `MODULE_CREATED`
  - `UPDATE` : `MODULE_UPDATED`
  - `DELETE` : `MODULE_DELETED`
  - Changements stockés dans `changes`

- [ ] **Traçabilité complète**
  - Qui : `userId`
  - Quand : `createdAt`
  - Quoi : `action`, `resource`
  - Pourquoi : `reason` (si applicable)

---

### 🧪 Tests

- [ ] **Tests unitaires**
  - Repository
  - Service
  - Controller

- [ ] **Tests d'intégration**
  - Flux complets
  - Intégrations avec autres modules

- [ ] **Tests E2E**
  - Scénarios utilisateur
  - Cas limites

---

### 📝 Documentation

- [ ] **Documentation API**
  - Endpoints documentés
  - DTOs documentés
  - Exemples de requêtes

- [ ] **Documentation technique**
  - Architecture du module
  - Patterns utilisés
  - Intégrations

- [ ] **Guide utilisateur**
  - Fonctionnalités
  - Workflows
  - Cas d'usage

---

### 🔗 Intégrations

- [ ] **Intégration Academic Tracks** (si pédagogique)
  - Service injecté
  - Track par défaut assigné

- [ ] **Intégration Tenant Features** (si optionnel)
  - Vérification feature activée
  - Comportement conditionnel

- [ ] **Intégration Payment Flows** (si facturable)
  - Création flux paiement
  - Gestion abonnements

- [ ] **Intégration ORION** (si analysable)
  - Service d'analyse créé
  - Alertes générées

---

### 🔄 Offline-First (si applicable)

- [ ] **Service de sync**
  - Sync vers backend
  - Sync depuis backend
  - Résolution conflits

- [ ] **Journal des opérations**
  - Opérations locales journalisées
  - Statut sync tracé

---

### 💰 Tarification (si facturable)

- [ ] **Feature flag créé**
  - Code feature défini
  - Pricing configuré

- [ ] **Intégration pricing**
  - Calcul impact pricing
  - Affichage dans UI

---

## 📊 Checklist Globale

### Architecture Globale

- [ ] **Multi-tenant strict**
  - Toutes tables ont `tenant_id`
  - Isolation garantie

- [ ] **Support bilingue**
  - Modules pédagogiques supportent tracks
  - Filtrage par track

- [ ] **Gestion par niveau**
  - Modules respectent `school_level_id`
  - Filtrage par niveau

- [ ] **Séparation financière**
  - Paiements SAAS vs TUITION
  - Comptes école configurés

- [ ] **IA intégrée**
  - ORION analyse le module
  - Alertes générées

---

## 🎯 Validation Finale

Avant de merger un nouveau module :

- [ ] Tous les items de la checklist cochés
- [ ] Code review effectué
- [ ] Tests passent
- [ ] Documentation complète
- [ ] Aucune dette technique
- [ ] Conforme aux patterns

---

**Version :** 1.0.0  
**Dernière mise à jour :** 2024


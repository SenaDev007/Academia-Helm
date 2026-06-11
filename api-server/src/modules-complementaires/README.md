# MODULE 9 — MODULES COMPLÉMENTAIRES

## 🎯 Vue d'ensemble

Module optionnel activable à la carte pour étendre les fonctionnalités d'Academia Hub avec 7 sous-modules complémentaires :

1. **Cantine Scolaire** - Gestion des menus, inscriptions et présences repas
2. **Transport Scolaire** - Gestion des véhicules, itinéraires et affectations
3. **Bibliothèque** - Gestion des ouvrages, emprunts et retours
4. **Laboratoires** - Gestion des équipements, réservations et maintenance
5. **Infirmerie** - Dossiers médicaux, consultations et alertes santé
6. **Boutique Scolaire** - Gestion des produits, stocks et ventes
7. **EduCast** - Contenu pédagogique, streaming et diffusion

---

## 📦 Architecture

### Schéma Prisma (31 modèles)

Chaque sous-module est indépendant avec ses propres modèles :
- Multi-tenant strict (`tenantId` obligatoire)
- Année scolaire obligatoire (`academicYearId`)
- Relations avec les modules centraux (Student, User, SchoolLevel, Class)
- Index optimisés pour les performances
- Soft delete (pas de suppression destructive)

### Services NestJS (7 services)

- `CanteenService` - Gestion complète de la cantine
- `TransportService` - Gestion du transport scolaire
- `LibraryService` - Gestion de la bibliothèque
- `LabService` - Gestion des laboratoires
- `MedicalService` - Gestion de l'infirmerie
- `ShopService` - Gestion de la boutique
- `EducastService` - Gestion du contenu pédagogique

### Controller REST

`ModulesComplementairesController` avec 60+ endpoints organisés par sous-module.

### Intégration ORION

`ModulesComplementairesOrionService` :
- KPIs pour chaque sous-module
- Alertes intelligentes
- Recommandations stratégiques

---

## 🔌 Endpoints API

### Cantine

- `GET /modules-complementaires/canteen/menus` - Liste des menus
- `POST /modules-complementaires/canteen/menus` - Créer un menu
- `GET /modules-complementaires/canteen/menus/:id` - Détails d'un menu
- `GET /modules-complementaires/canteen/menus/:id/meals` - Repas d'un menu
- `POST /modules-complementaires/canteen/menus/:id/meals` - Ajouter un repas
- `GET /modules-complementaires/canteen/enrollments` - Liste des inscriptions
- `POST /modules-complementaires/canteen/enrollments` - Inscrire un élève
- `POST /modules-complementaires/canteen/attendances` - Enregistrer une présence
- `GET /modules-complementaires/canteen/stats` - Statistiques

### Transport

- `GET /modules-complementaires/transport/vehicles` - Liste des véhicules
- `POST /modules-complementaires/transport/vehicles` - Créer un véhicule
- `GET /modules-complementaires/transport/routes` - Liste des itinéraires
- `POST /modules-complementaires/transport/routes` - Créer un itinéraire
- `POST /modules-complementaires/transport/routes/:id/stops` - Ajouter un arrêt
- `GET /modules-complementaires/transport/assignments` - Liste des affectations
- `POST /modules-complementaires/transport/assignments` - Affecter un élève
- `POST /modules-complementaires/transport/attendances` - Enregistrer une présence
- `POST /modules-complementaires/transport/incidents` - Signaler un incident
- `GET /modules-complementaires/transport/stats` - Statistiques

### Bibliothèque

- `GET /modules-complementaires/library/books` - Liste des ouvrages
- `POST /modules-complementaires/library/books` - Ajouter un ouvrage
- `GET /modules-complementaires/library/loans` - Liste des emprunts
- `POST /modules-complementaires/library/loans` - Emprunter un livre
- `POST /modules-complementaires/library/loans/:id/return` - Retourner un livre
- `GET /modules-complementaires/library/overdue` - Livres en retard
- `GET /modules-complementaires/library/stats` - Statistiques

### Laboratoires

- `GET /modules-complementaires/labs` - Liste des laboratoires
- `POST /modules-complementaires/labs` - Créer un laboratoire
- `GET /modules-complementaires/labs/:id/equipment` - Équipements d'un lab
- `POST /modules-complementaires/labs/:id/equipment` - Ajouter un équipement
- `POST /modules-complementaires/labs/:id/reservations` - Réserver un lab
- `POST /modules-complementaires/labs/incidents` - Signaler un incident
- `GET /modules-complementaires/labs/stats` - Statistiques

### Infirmerie

- `GET /modules-complementaires/medical/records` - Liste des dossiers
- `POST /modules-complementaires/medical/records` - Créer/mettre à jour un dossier
- `GET /modules-complementaires/medical/records/:id/visits` - Consultations
- `POST /modules-complementaires/medical/visits` - Enregistrer une consultation
- `POST /modules-complementaires/medical/alerts` - Créer une alerte
- `GET /modules-complementaires/medical/alerts/critical` - Alertes critiques
- `GET /modules-complementaires/medical/stats` - Statistiques

### Boutique

- `GET /modules-complementaires/shop/products` - Liste des produits
- `POST /modules-complementaires/shop/products` - Créer un produit
- `POST /modules-complementaires/shop/sales` - Créer une vente
- `GET /modules-complementaires/shop/stats` - Statistiques

### EduCast

- `GET /modules-complementaires/educast/contents` - Liste des contenus
- `POST /modules-complementaires/educast/contents` - Créer un contenu
- `POST /modules-complementaires/educast/contents/:id/access` - Accorder un accès
- `POST /modules-complementaires/educast/sessions` - Démarrer une session
- `POST /modules-complementaires/educast/sessions/:id/end` - Terminer une session
- `GET /modules-complementaires/educast/stats` - Statistiques

### ORION

- `GET /modules-complementaires/orion/kpis` - KPIs de tous les sous-modules
- `GET /modules-complementaires/orion/alerts` - Alertes ORION

---

## 🧠 Intégration ORION

### KPIs Générés

**Cantine :**
- Taux d'inscription
- Taux de présence aux repas

**Transport :**
- Taux d'occupation des véhicules
- Taux de présence au transport

**Bibliothèque :**
- Taux d'emprunt
- Taux de retards

**Laboratoires :**
- Taux d'utilisation
- Taux d'équipements en maintenance

**Infirmerie :**
- Taux de visites
- Nombre d'alertes critiques

**Boutique :**
- Revenus totaux
- Taux de produits en stock faible

**EduCast :**
- Taux de complétion
- Taux d'engagement

### Alertes Générées

- Présence cantine faible (< 70%)
- Occupation transport faible (< 60%)
- Emprunts en retard (> 5)
- Équipements en maintenance élevé (> 20%)
- Alertes médicales critiques non traitées
- Stock boutique faible (> 3 produits)
- Engagement EduCast faible (< 30%)

---

## 🔐 Règles Métier

### Multi-tenant
- Tous les modèles ont `tenantId`
- Isolation stricte entre tenants
- Aucune fuite de données entre établissements

### Année Scolaire
- Tous les modèles ont `academicYearId`
- Historique préservé par année
- Pas de mélange entre années

### Niveaux Scolaires
- Relations avec `SchoolLevel` et `Class` quand pertinent
- Agrégation par niveau pour ORION
- Pas de mélange entre niveaux

### Soft Delete
- Pas de suppression destructive
- Désactivation via `isActive: false`
- Données conservées pour historique

### Modules Optionnels
- Activation/désactivation via feature flags
- Pas de dépendance critique au cœur
- Compatible offline-first

---

## 📊 Statistiques

- **31 modèles Prisma** pour 7 sous-modules
- **7 services NestJS** avec 50+ méthodes
- **1 controller REST** avec 60+ endpoints
- **15+ routes API proxy** Next.js
- **1 page frontend** principale
- **1 service ORION** intégré

---

## 🚀 Utilisation

### Activation d'un module

Les modules sont activés via les feature flags dans les paramètres du tenant.

### Accès Frontend

- Page principale : `/app/modules-complementaires`
- Sous-modules individuels : `/app/canteen`, `/app/transport`, etc.

### API Backend

Tous les endpoints sont préfixés par `/api/modules-complementaires/`

---

## 🔄 Prochaines Étapes

1. Générer les migrations Prisma : `npx prisma migrate dev`
2. Tester chaque sous-module via les endpoints REST
3. Compléter les pages individuelles de chaque sous-module
4. Implémenter les feature flags pour l'activation/désactivation
5. Ajouter la génération PDF pour les rapports

---

## 📚 Références

- [Prisma Documentation](https://www.prisma.io/docs)
- [NestJS Documentation](https://docs.nestjs.com)
- [ORION Module Documentation](../orion/README.md)


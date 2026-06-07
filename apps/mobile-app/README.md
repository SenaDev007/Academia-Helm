# 📱 Application Mobile Academia Hub

## Vue d'ensemble

Application mobile Academia Hub destinée aux **PARENTS** et **ÉLÈVES** pour un accès simple et sécurisé aux informations scolaires.

### Caractéristiques

- ✅ **Consultation uniquement** : Pas de gestion administrative
- ✅ **Parents et Élèves** : Deux profils distincts
- ✅ **Même API** : Réutilisation de l'infrastructure Web SaaS
- ✅ **Multi-tenant** : Isolation stricte des données
- ✅ **Offline limité** : Cache lecture uniquement
- ✅ **UX simple** : Interface rassurante et accessible

---

## 📚 Documentation

### Spécification Fonctionnelle

- **`docs/MOBILE-SPECIFICATION.md`** : Spécification complète
  - Vision et objectif
  - Périmètre strict
  - Cibles utilisateurs
  - Architecture technique
  - Fonctionnalités détaillées
  - Sécurité et multi-tenant
  - UX et design
  - API et intégration

### Parcours Utilisateur

- **`docs/USER-JOURNEYS.md`** : Parcours utilisateur détaillés
  - Parcours parent (5 parcours)
  - Parcours élève (5 parcours)
  - Parcours notifications
  - Matrice des parcours
  - Objectifs UX

### Limites de Responsabilités

- **`docs/RESPONSIBILITIES.md`** : Responsabilités et limites
  - Responsabilités de l'application
  - Responsabilités exclues
  - Responsabilités établissement
  - Responsabilités éditeur
  - Cadre juridique

---

## 🏗️ Architecture

### Stack Technologique

- **Framework** : Flutter (Android & iOS)
- **Langage** : Dart
- **API** : REST (même backend que Web)
- **Authentification** : JWT
- **Cache** : Hive / SQLite

### Structure Projet

```
apps/mobile-app/
├── lib/
│   ├── main.dart
│   ├── core/          # Services core (API, auth, cache)
│   ├── models/        # Modèles de données
│   ├── screens/       # Écrans de l'application
│   └── widgets/       # Composants réutilisables
├── docs/              # Documentation
├── pubspec.yaml       # Dépendances Flutter
└── README.md
```

---

## 🎯 Fonctionnalités Principales

### Pour les Parents

- ✅ Consultation des notes de leurs enfants
- ✅ Suivi des paiements et factures
- ✅ Lecture des messages de l'école
- ✅ Consultation des absences
- ✅ Notifications importantes

### Pour les Élèves

- ✅ Consultation de leurs propres notes
- ✅ Emploi du temps
- ✅ Absences et retards
- ✅ Messages de l'école
- ✅ Devoirs et évaluations

---

## 🔒 Sécurité

### Authentification

- JWT avec refresh token
- Stockage sécurisé (Keychain/Keystore)
- Déconnexion automatique si token expiré

### Multi-Tenant

- Résolution par sous-domaine ou tenant ID
- Isolation stricte des données
- Sélection d'établissement si nécessaire

### Données

- Chiffrement en transit (HTTPS)
- Cache non sensible uniquement
- Expiration cache : 30 jours maximum

---

## 📋 Statut

📝 **Spécification complète** — Prête pour développement

### Prochaines Étapes

1. Setup projet Flutter
2. Configuration API client
3. Implémentation authentification
4. Développement écrans principaux
5. Tests et validation

---

## 📞 Contact

Pour toute question sur l'application mobile :

**YEHI OR Tech**  
Email : contact@academiahub.com

---

**Version** : 1.0  
**Dernière mise à jour** : 2025


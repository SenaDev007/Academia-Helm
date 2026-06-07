# 📱 Application Mobile Academia Hub — Spécification Fonctionnelle

## 🎯 Vision et Objectif

L'application mobile Academia Hub est une extension du Web SaaS, destinée exclusivement aux **PARENTS** et **ÉLÈVES** pour un accès simple et sécurisé aux informations scolaires.

### Objectif Principal

Offrir un accès mobile consultatif à :
- Informations scolaires
- Résultats et notes
- Communications école → famille
- Paiements (lecture et notifications)

### Positionnement

- **Extension** du Web SaaS, pas un remplacement
- **Consultation uniquement**, aucune gestion administrative
- **Simple et rassurante**, UX pensée pour les parents
- **Sécurisée**, même niveau de sécurité que le Web

---

## 🔒 Périmètre Strict

### ✅ Autorisé

- Consultation des informations personnelles
- Consultation des notes et résultats
- Consultation des paiements et factures
- Réception de notifications
- Lecture des messages école → parents
- Consultation de l'emploi du temps
- Consultation des absences et retards

### ❌ Interdit

- Modification de données administratives
- Gestion des élèves (inscriptions, etc.)
- Gestion des paiements (paiement direct)
- Modification des notes
- Accès aux données d'autres élèves
- Gestion des utilisateurs
- Accès aux KPI ou bilans directionnels

---

## 👥 Cibles Utilisateurs

### Parents

**Rôle** : `PARENT`

**Besoins** :
- Suivre la scolarité de leur(s) enfant(s)
- Consulter les notes et résultats
- Suivre les paiements
- Recevoir les communications de l'école
- Consulter l'emploi du temps
- Voir les absences et retards

**Accès** :
- Un compte parent peut voir tous ses enfants
- Données isolées par établissement (multi-tenant)

### Élèves

**Rôle** : `STUDENT`

**Besoins** :
- Consulter leurs propres notes
- Voir leur emploi du temps
- Consulter leurs absences
- Recevoir les communications
- Voir les devoirs et évaluations à venir

**Accès** :
- Un compte élève voit uniquement ses propres données
- Données isolées par établissement (multi-tenant)

---

## 🏗️ Architecture Technique

### Stack Technologique

- **Framework** : Flutter (Android & iOS)
- **Langage** : Dart
- **API** : Même API REST que le Web SaaS
- **Authentification** : JWT (même système que le Web)
- **Multi-tenant** : Résolution par sous-domaine ou tenant ID
- **Cache** : Hive / SQLite (lecture seule, offline limité)

### Architecture

```
apps/mobile-app/
├── lib/
│   ├── main.dart
│   ├── core/
│   │   ├── api/
│   │   │   ├── client.dart          # Client API (même base URL que Web)
│   │   │   └── endpoints.dart       # Endpoints API
│   │   ├── auth/
│   │   │   ├── auth_service.dart    # Service d'authentification
│   │   │   └── auth_state.dart      # État d'authentification
│   │   ├── tenant/
│   │   │   └── tenant_resolver.dart # Résolution tenant
│   │   └── cache/
│   │       └── cache_service.dart   # Cache local (lecture)
│   ├── models/
│   │   ├── student.dart
│   │   ├── grade.dart
│   │   ├── payment.dart
│   │   └── message.dart
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── login_screen.dart
│   │   │   └── forgot_password_screen.dart
│   │   ├── home/
│   │   │   └── home_screen.dart
│   │   ├── grades/
│   │   │   ├── grades_list_screen.dart
│   │   │   └── grade_detail_screen.dart
│   │   ├── payments/
│   │   │   ├── payments_list_screen.dart
│   │   │   └── payment_detail_screen.dart
│   │   ├── messages/
│   │   │   ├── messages_list_screen.dart
│   │   │   └── message_detail_screen.dart
│   │   └── profile/
│   │       └── profile_screen.dart
│   └── widgets/
│       ├── grade_card.dart
│       ├── payment_card.dart
│       └── message_card.dart
├── pubspec.yaml
└── README.md
```

---

## 📋 Fonctionnalités Détaillées

### 1. Authentification

#### Connexion

**Écran** : `LoginScreen`

**Fonctionnalités** :
- Champ email/identifiant
- Champ mot de passe
- Bouton "Se connecter"
- Lien "Mot de passe oublié"
- Sélection du tenant (si multi-tenant)

**Flux** :
1. Saisie identifiants
2. Validation côté client
3. Appel API `/api/auth/login`
4. Stockage JWT (sécurisé)
5. Redirection vers Home

**Sécurité** :
- JWT stocké dans Keychain/Keystore
- Refresh token automatique
- Déconnexion si token expiré

#### Mot de passe oublié

**Écran** : `ForgotPasswordScreen`

**Fonctionnalités** :
- Champ email
- Bouton "Envoyer le lien de réinitialisation"
- Message de confirmation

**Flux** :
1. Saisie email
2. Appel API `/api/auth/forgot-password`
3. Affichage message de confirmation

---

### 2. Accueil (Home)

#### Dashboard Parent

**Écran** : `HomeScreen` (Parent)

**Contenu** :
- Liste des enfants (cartes)
- Résumé des dernières notes
- Paiements en attente (badge)
- Messages non lus (badge)
- Notifications importantes

**Navigation** :
- Notes → GradesListScreen
- Paiements → PaymentsListScreen
- Messages → MessagesListScreen
- Profil → ProfileScreen

#### Dashboard Élève

**Écran** : `HomeScreen` (Élève)

**Contenu** :
- Notes récentes
- Prochains devoirs/évaluations
- Messages non lus (badge)
- Emploi du temps du jour
- Absences récentes

**Navigation** :
- Notes → GradesListScreen
- Emploi du temps → ScheduleScreen
- Messages → MessagesListScreen
- Profil → ProfileScreen

---

### 3. Notes et Résultats

#### Liste des Notes

**Écran** : `GradesListScreen`

**Fonctionnalités** :
- Liste des notes par période (trimestre, semestre)
- Filtres : matière, période, type d'évaluation
- Tri : date, matière, note
- Affichage moyenne par matière
- Indicateur visuel (couleur) selon note

**Données** :
- Notes de l'élève (si parent : notes de l'enfant sélectionné)
- Matière
- Date
- Type d'évaluation
- Coefficient
- Commentaire (si disponible)

**Cache** :
- Cache des 30 derniers jours
- Refresh pull-to-refresh
- Indicateur de données en cache

#### Détail d'une Note

**Écran** : `GradeDetailScreen`

**Contenu** :
- Détails complets de la note
- Matière
- Date et heure
- Type d'évaluation
- Note / Note maximale
- Coefficient
- Commentaire enseignant
- Classement (si disponible)

**Actions** :
- Retour
- Partager (si autorisé)

---

### 4. Paiements

#### Liste des Paiements

**Écran** : `PaymentsListScreen`

**Fonctionnalités** :
- Liste des paiements (factures, reçus)
- Filtres : période, statut (payé, en attente)
- Tri : date, montant
- Badge "En attente" pour paiements non réglés
- Affichage solde restant dû

**Données** :
- Date
- Libellé (ex: "Frais de scolarité - Janvier 2025")
- Montant
- Statut (Payé, En attente, En retard)
- Date d'échéance (si applicable)

**Actions** :
- Voir détails
- Télécharger reçu/facture (PDF)

**Limites** :
- ❌ Pas de paiement direct dans l'app
- ✅ Notification vers paiement externe (Fedapay, etc.)

#### Détail d'un Paiement

**Écran** : `PaymentDetailScreen`

**Contenu** :
- Détails complets du paiement
- Date
- Libellé
- Montant
- Statut
- Date d'échéance
- Méthode de paiement (si payé)
- Référence de transaction
- Reçu/facture téléchargeable (PDF)

**Actions** :
- Télécharger reçu/facture
- Partager (si autorisé)

---

### 5. Messages

#### Liste des Messages

**Écran** : `MessagesListScreen`

**Fonctionnalités** :
- Liste des messages école → parents/élèves
- Filtres : non lus, date, type
- Tri : date (plus récent en premier)
- Badge "Non lu"
- Indicateur de message important

**Données** :
- Titre
- Expéditeur (école, enseignant, direction)
- Date
- Type (information, urgence, rappel)
- Extrait
- Statut (lu, non lu)

**Actions** :
- Marquer comme lu
- Voir détails

#### Détail d'un Message

**Écran** : `MessageDetailScreen`

**Contenu** :
- Titre
- Expéditeur
- Date et heure
- Type
- Contenu complet
- Pièces jointes (si disponibles)
- Actions (télécharger pièce jointe)

**Actions** :
- Marquer comme lu (automatique à l'ouverture)
- Télécharger pièces jointes
- Partager (si autorisé)

---

### 6. Emploi du Temps (Élèves uniquement)

#### Emploi du Temps

**Écran** : `ScheduleScreen`

**Fonctionnalités** :
- Vue hebdomadaire
- Navigation semaine précédente/suivante
- Affichage cours, salles, enseignants
- Indicateur cours du jour
- Changements temporaires (si disponibles)

**Données** :
- Jour
- Heure
- Matière
- Salle
- Enseignant
- Type (cours, TD, TP)

**Cache** :
- Cache de la semaine en cours
- Refresh pull-to-refresh

---

### 7. Absences et Retards

#### Liste des Absences

**Écran** : `AbsencesListScreen`

**Fonctionnalités** :
- Liste des absences et retards
- Filtres : période, type (absence, retard)
- Tri : date
- Statistiques (nombre d'absences, retards)

**Données** :
- Date
- Heure (pour retards)
- Type (absence, retard)
- Justification (si disponible)
- Motif (si disponible)

**Limites** :
- ❌ Pas de justification dans l'app (processus séparé)
- ✅ Consultation uniquement

---

### 8. Profil

#### Profil Utilisateur

**Écran** : `ProfileScreen`

**Fonctionnalités** :
- Informations personnelles (nom, email, téléphone)
- Informations enfant(s) (si parent)
- Paramètres de notification
- Déconnexion
- Informations établissement

**Actions** :
- Modifier email/téléphone (si autorisé)
- Gérer notifications
- Déconnexion
- Changer de mot de passe (redirection Web)

**Limites** :
- ❌ Pas de modification de données critiques
- ✅ Modifications limitées (email, téléphone, notifications)

---

### 9. Notifications Push

#### Types de Notifications

- **Nouvelle note** : "Une nouvelle note a été publiée"
- **Paiement en attente** : "Un paiement est en attente"
- **Message important** : "Nouveau message de l'école"
- **Absence** : "Absence enregistrée aujourd'hui"
- **Rappel** : "Rappel : [événement]"

#### Gestion des Notifications

**Paramètres** :
- Activer/désactiver notifications
- Types de notifications (granularité)
- Heures de réception (si applicable)

**Implémentation** :
- Firebase Cloud Messaging (FCM) pour Android
- Apple Push Notification Service (APNs) pour iOS
- Backend : Endpoint `/api/notifications/register`

---

## 🔄 Parcours Utilisateur

### Parcours Parent — Consultation des Notes

1. **Connexion** → LoginScreen
   - Saisie identifiants
   - Sélection tenant (si applicable)
   - Validation

2. **Accueil** → HomeScreen
   - Affichage liste enfants
   - Sélection enfant

3. **Notes** → GradesListScreen
   - Affichage notes de l'enfant
   - Filtrage par période/matière

4. **Détail Note** → GradeDetailScreen
   - Consultation détail
   - Retour

5. **Retour Accueil** → HomeScreen

### Parcours Élève — Consultation Emploi du Temps

1. **Connexion** → LoginScreen
   - Saisie identifiants
   - Validation

2. **Accueil** → HomeScreen
   - Affichage résumé journée

3. **Emploi du Temps** → ScheduleScreen
   - Vue hebdomadaire
   - Navigation semaines

4. **Retour Accueil** → HomeScreen

### Parcours Parent — Suivi Paiements

1. **Connexion** → LoginScreen

2. **Accueil** → HomeScreen
   - Badge "Paiements en attente"

3. **Paiements** → PaymentsListScreen
   - Liste paiements
   - Filtrage par statut

4. **Détail Paiement** → PaymentDetailScreen
   - Consultation détail
   - Téléchargement reçu

5. **Retour** → PaymentsListScreen

---

## 🔐 Sécurité et Multi-Tenant

### Authentification

- **JWT** : Même système que le Web
- **Refresh Token** : Renouvellement automatique
- **Stockage sécurisé** : Keychain (iOS), Keystore (Android)
- **Déconnexion automatique** : Si token expiré

### Multi-Tenant

- **Résolution** : Par sous-domaine ou tenant ID
- **Isolation** : Données strictement isolées par tenant
- **Sélection** : Si parent a enfants dans plusieurs établissements

### Données Sensibles

- **Chiffrement** : Données en transit (HTTPS)
- **Cache** : Données en cache non sensibles uniquement
- **Expiration cache** : 30 jours maximum

---

## 📱 UX et Design

### Principes

- **Simple** : Interface épurée, pas de surcharge
- **Rassurante** : Couleurs douces, typographie lisible
- **Accessible** : Respect des guidelines iOS/Android
- **Rapide** : Chargement optimisé, cache intelligent

### Design System

- **Couleurs** : Palette Academia Hub (navy, soft-gold)
- **Typographie** : Lisible, hiérarchie claire
- **Icônes** : Lucide Icons (cohérence avec Web)
- **Composants** : Material Design (Android), Cupertino (iOS)

### États

- **Chargement** : Indicateurs de chargement clairs
- **Erreur** : Messages d'erreur compréhensibles
- **Vide** : États vides avec messages rassurants
- **Offline** : Indication données en cache

---

## 📊 API et Intégration

### Endpoints Utilisés

```
GET  /api/auth/login
POST /api/auth/logout
POST /api/auth/forgot-password

GET  /api/students/{id}/grades
GET  /api/students/{id}/grades/{gradeId}

GET  /api/students/{id}/payments
GET  /api/students/{id}/payments/{paymentId}
GET  /api/students/{id}/payments/{paymentId}/receipt

GET  /api/messages
GET  /api/messages/{id}
POST /api/messages/{id}/read

GET  /api/students/{id}/schedule
GET  /api/students/{id}/absences

GET  /api/profile
PUT  /api/profile (limité)

POST /api/notifications/register
```

### Format de Réponse

- **JSON** : Format standardisé
- **Pagination** : Pour listes longues
- **Erreurs** : Codes HTTP standardisés

---

## 🚫 Limites de Responsabilités

### Responsabilités de l'Application

✅ **Consultation** : Accès en lecture aux données
✅ **Notifications** : Réception et affichage
✅ **Cache** : Stockage temporaire pour consultation offline
✅ **Sécurité** : Protection des données en transit et au repos

### Responsabilités Exclues

❌ **Gestion administrative** : Aucune modification de données critiques
❌ **Paiement direct** : Pas de traitement de paiement dans l'app
❌ **Décisions** : L'app ne prend aucune décision
❌ **Données tierces** : Pas d'accès aux données d'autres utilisateurs

### Responsabilité de l'Établissement

- **Exactitude des données** : L'établissement est responsable de l'exactitude
- **Communications** : L'établissement est responsable du contenu des messages
- **Paiements** : L'établissement gère les paiements (hors app)

### Responsabilité de YEHI OR Tech

- **Disponibilité** : Maintien de la disponibilité de l'API
- **Sécurité** : Protection des données selon les standards
- **Support** : Support technique de l'application

---

## 📋 Checklist de Développement

### Phase 1 : Fondations

- [ ] Setup projet Flutter
- [ ] Configuration API client
- [ ] Système d'authentification
- [ ] Résolution multi-tenant
- [ ] Cache local (Hive/SQLite)

### Phase 2 : Fonctionnalités Core

- [ ] Écran de connexion
- [ ] Dashboard accueil
- [ ] Liste et détail notes
- [ ] Liste et détail paiements
- [ ] Liste et détail messages

### Phase 3 : Fonctionnalités Avancées

- [ ] Emploi du temps (élèves)
- [ ] Absences et retards
- [ ] Notifications push
- [ ] Profil utilisateur
- [ ] Paramètres

### Phase 4 : Polish et Tests

- [ ] Tests unitaires
- [ ] Tests d'intégration
- [ ] Tests utilisateurs
- [ ] Optimisation performance
- [ ] Documentation utilisateur

---

## 📝 Résumé

### Caractéristiques Clés

- ✅ **Consultation uniquement** : Pas de gestion administrative
- ✅ **Parents et Élèves** : Deux profils distincts
- ✅ **Même API** : Réutilisation de l'infrastructure Web
- ✅ **Multi-tenant** : Isolation stricte des données
- ✅ **Offline limité** : Cache lecture uniquement
- ✅ **UX simple** : Interface rassurante et accessible

### Technologies

- **Flutter** : Framework cross-platform
- **API REST** : Même backend que le Web
- **JWT** : Authentification sécurisée
- **Cache local** : Hive/SQLite pour offline limité

### Statut

📝 **Spécification complète** — Prête pour développement

---

**Version** : 1.0  
**Dernière mise à jour** : 2025


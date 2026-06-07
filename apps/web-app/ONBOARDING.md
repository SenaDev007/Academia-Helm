# 🚀 Parcours d'Onboarding Academia Hub

## Vue d'ensemble

Le parcours d'onboarding permet à un établissement scolaire de créer son compte, obtenir son sous-domaine et accéder immédiatement à la plateforme après paiement réussi.

**Principe fondamental** : Aucune validation manuelle. Tout est automatisé.

---

## 📋 Étapes du Parcours

### 1️⃣ Informations Établissement

**Champs obligatoires :**
- Nom officiel de l'établissement
- Type d'établissement (Maternelle, Primaire, Secondaire, Mixte, Universitaire)
- Pays (Bénin par défaut)
- Téléphone
- Email

**Champs optionnels :**
- Ville
- Adresse

**Fonctionnalités :**
- Génération automatique du sous-domaine en temps réel
- Vérification de disponibilité du sous-domaine
- Prévisualisation : `nom-ecole.academiahub.com`
- Validation en temps réel

### 2️⃣ Responsable Principal

**Champs obligatoires :**
- Nom complet
- Email (sera l'identifiant de connexion)
- Téléphone
- Mot de passe (minimum 8 caractères)
- Confirmation du mot de passe

**Fonctionnalités :**
- Affichage/masquage du mot de passe
- Validation en temps réel
- Vérification de correspondance des mots de passe

### 3️⃣ Récapitulatif & Paiement

**Contenu :**
- Récapitulatif des informations saisies
- Montant : 100.000 FCFA (souscription initiale)
- Mention : "Accès immédiat à tous les modules • Période d'essai 30 jours"
- Bouton de paiement Fedapay

**Processus :**
1. Clic sur "Payer et activer Academia Hub"
2. Redirection vers Fedapay (ou intégration widget)
3. Paiement sécurisé
4. Callback de confirmation
5. Création automatique du tenant et de l'utilisateur
6. Activation du compte

### 4️⃣ Confirmation & Redirection

**Affichage :**
- Message de succès
- Sous-domaine généré
- Statut : "Période d'essai active (30 jours)"
- Bouton d'accès direct
- Redirection automatique après 3 secondes

**Redirection :**
```
https://{subdomain}.academiahub.com/app
```

---

## 🔧 Création Automatique

### Après Paiement Réussi

1. **Génération du sous-domaine unique**
   - Normalisation du nom de l'établissement
   - Vérification de disponibilité
   - Ajout de suffixe si nécessaire

2. **Création du Tenant**
   ```json
   {
     "name": "Nom de l'établissement",
     "subdomain": "nom-ecole",
     "slug": "nom-ecole",
     "status": "trial",
     "country": "BJ",
     "city": "Cotonou",
     "address": "...",
     "phone": "...",
     "email": "...",
     "schoolType": "..."
   }
   ```

3. **Création de l'Utilisateur Administrateur**
   ```json
   {
     "email": "responsable@ecole.com",
     "password": "...",
     "firstName": "Jean",
     "lastName": "DUPONT",
     "phone": "...",
     "role": "admin",
     "tenantId": "...",
     "isPrimaryAdmin": true
   }
   ```

4. **Activation Immédiate**
   - Statut tenant : `trial` (30 jours)
   - Compte utilisateur : `active`
   - Accès immédiat à tous les modules

---

## 🛡️ Gestion des Cas Particuliers

### Sous-domaine Déjà Pris

**Comportement :**
1. Génération du sous-domaine de base
2. Vérification de disponibilité
3. Si pris, ajout automatique d'un suffixe numérique : `nom-ecole-2`
4. Si toujours pris, utilisation d'un timestamp : `nom-ecole-abc123`

**Message utilisateur :**
> "Ce sous-domaine est déjà utilisé. Un suffixe sera ajouté automatiquement."

### Paiement Échoué

**Comportement :**
1. Affichage d'un message d'erreur
2. Possibilité de réessayer
3. Aucun tenant créé
4. Redirection vers `/onboarding-error?error=...`

### Informations Incomplètes

**Comportement :**
1. Validation en temps réel à chaque étape
2. Messages d'erreur contextuels
3. Blocage de passage à l'étape suivante
4. Mise en évidence des champs invalides

### Tentative de Double Inscription

**Comportement :**
1. Vérification de l'email du responsable
2. Si email existe déjà : erreur 409
3. Message : "Cet email est déjà utilisé"
4. Redirection vers `/onboarding-error`

### Erreur lors de la Création

**Comportement :**
1. Si création tenant échoue : rollback complet
2. Si création utilisateur échoue : suppression du tenant créé
3. Message d'erreur clair
4. Redirection vers `/onboarding-error`

---

## 🔐 Sécurité

### Validation des Données

- **Sous-domaine** : Format strict (lettres minuscules, chiffres, tirets uniquement)
- **Email** : Format valide requis
- **Mot de passe** : Minimum 8 caractères
- **Téléphone** : Format validé

### Mots Réservés (Sous-domaines)

Les sous-domaines suivants sont réservés et ne peuvent pas être utilisés :
- `www`, `api`, `admin`, `app`, `mail`, `ftp`
- `localhost`, `test`, `staging`, `dev`

### Rollback Automatique

En cas d'erreur lors de la création :
1. Si création utilisateur échoue → Suppression du tenant
2. Aucune donnée orpheline
3. Transaction atomique

---

## 📊 États du Compte (Modèle d'Abonnement)

Les états sont normalisés via `SubscriptionStatus` côté application.

### `PENDING`

- Paiement initial lancé mais pas encore confirmé
- Aucun sous-domaine actif
- Accès limité à la page de suivi / support

### `ACTIVE_TRIAL`

- Période d'essai de 30 jours après activation
- Accès complet à tous les modules
- Passage automatique à `ACTIVE_SUBSCRIBED` après 30 jours si l'abonnement mensuel est en place

### `ACTIVE_SUBSCRIBED`

- Abonnement mensuel actif (15.000 FCFA / mois)
- Paiements récurrents via Fedapay
- Accès complet à tous les modules

### `SUSPENDED`

- Paiement en retard ou échec récurrent
- Accès en **lecture seule**
- Aucune suppression de données
- Réactivation automatique après régularisation du paiement

### `TERMINATED`

- Résiliation définitive
- Aucun accès à la plateforme
- Données conservées (ex. 90 jours) selon la politique backend

---

## 🔄 Flux Complet

```
1. Utilisateur remplit formulaire
   ↓
2. Génération sous-domaine en temps réel
   ↓
3. Validation des informations
   ↓
4. Récapitulatif
   ↓
5. Paiement Fedapay
   ↓
6. Callback paiement réussi
   ↓
7. Création tenant (API)
   ↓
8. Création utilisateur (API)
   ↓
9. Activation compte
   ↓
10. Redirection vers sous-domaine
    https://{subdomain}.academiahub.com/app
```

---

## 🎯 Objectifs Atteints

✅ **Aucune validation manuelle**  
✅ **Création automatique complète**  
✅ **Sous-domaine unique garanti**  
✅ **Redirection immédiate**  
✅ **Gestion d'erreurs robuste**  
✅ **Sécurité maximale**  
✅ **UX fluide et claire**

---

## 📝 Notes Techniques

### API Routes

- `POST /api/onboarding` : Création complète
- `GET /api/onboarding/check-subdomain?subdomain=xxx` : Vérification disponibilité

### Services

- `onboarding.service.ts` : Service client
- `subdomain.ts` : Utilitaires sous-domaine

### Pages

- `/signup` : Parcours d'onboarding
- `/onboarding-error` : Page d'erreur

---

## 🚨 Points d'Attention

1. **Fedapay Integration** : À implémenter (actuellement simulé)
2. **Webhook Callback** : À configurer pour confirmation paiement
3. **DNS Configuration** : Wildcard DNS requis pour sous-domaines
4. **Rate Limiting** : Protection contre abus
5. **Email Confirmation** : Optionnel mais recommandé

---

**Version** : 1.0.0  
**Dernière mise à jour** : 2025


# 📝 Système de Témoignages Clients

## Vue d'ensemble

Le système de témoignages permet aux établissements de soumettre des témoignages authentiques sur leur expérience avec Academia Hub. **Tous les témoignages sont soumis à une validation manuelle obligatoire** avant publication, garantissant la crédibilité et le contrôle éditorial.

---

## 🎯 Principes Fondamentaux

### 1. **Validation Manuelle Obligatoire**

- ❌ **Aucune publication automatique** : Tous les témoignages sont en statut `PENDING` après soumission
- ✅ **Contrôle éditorial strict** : Un administrateur doit valider chaque témoignage
- ✅ **Authenticité garantie** : Seuls les témoignages vérifiés sont publiés

### 2. **Ton Sobre et Institutionnel**

- Pas de marketing excessif
- Témoignages authentiques et vérifiables
- Présentation professionnelle et crédible

### 3. **Traçabilité Complète**

- Chaque témoignage est lié à un `tenantId` (établissement)
- Historique des validations/rejets
- Raisons de rejet documentées

---

## 📋 Workflow de Validation

### Étape 1 : Soumission par l'École

**Côté Frontend** : L'école soumet un témoignage via le formulaire dans son dashboard.

```typescript
// Exemple de soumission
const submission: TestimonialSubmission = {
  authorName: "Jean DUPONT",
  authorFunction: "Directeur",
  authorPhotoUrl: "https://...", // Optionnel
  schoolName: "École Primaire Excellence",
  schoolCity: "Cotonou",
  content: "Academia Hub a transformé notre gestion...",
  rating: 5, // 1 à 5
};

const response = await submitTestimonial(submission);
// response.testimonialId : ID du témoignage créé
// response.message : "Votre témoignage a été soumis et sera examiné..."
```

**Côté Backend** : 
- Création du témoignage avec `status = 'PENDING'`
- Enregistrement du `tenantId` (vérification que l'école est authentifiée)
- Notification admin (email ou dashboard) pour validation

### Étape 2 : Validation par l'Administrateur

**Côté Backend** : Interface d'administration pour valider/rejeter les témoignages.

**Actions possibles** :
1. **Approuver** (`status = 'APPROVED'`) :
   - Le témoignage devient visible publiquement
   - Optionnel : marquer comme `featured = true` (mis en avant)
   - Enregistrer `reviewedAt` et `reviewedBy`

2. **Rejeter** (`status = 'REJECTED'`) :
   - Le témoignage n'est pas publié
   - Enregistrer `rejectionReason` (ex: "Contenu inapproprié", "Témoignage non vérifiable")
   - Notification à l'école (optionnel)

3. **Demander des modifications** :
   - Statut reste `PENDING`
   - Commentaire envoyé à l'école
   - L'école peut modifier et resoumettre

### Étape 3 : Publication

Une fois `status = 'APPROVED'`, le témoignage est :
- ✅ Visible sur la page `/testimonials`
- ✅ Visible dans la section témoignages de la landing page (si `featured = true`)
- ✅ Recherchable et filtrable

---

## 🗄️ Modèle de Données

### Testimonial

```typescript
interface Testimonial {
  id: string;
  tenantId: string; // École qui a soumis
  
  // Informations du témoin
  authorName: string;
  authorFunction: string; // "Directeur", "Promoteur", etc.
  authorPhotoUrl?: string;
  schoolName: string;
  schoolCity?: string;
  
  // Contenu
  content: string;
  rating: number; // 1 à 5
  
  // Validation
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string; // ID admin
  rejectionReason?: string;
  
  // Affichage
  featured: boolean; // Mis en avant
  displayOrder: number; // Ordre d'affichage
  
  createdAt: string;
  updatedAt: string;
}
```

### Statuts

- **`PENDING`** : Soumis, en attente de validation
- **`APPROVED`** : Validé et publié
- **`REJECTED`** : Rejeté (non publié)
- **`ARCHIVED`** : Archivé (anciennement publié, retiré)

---

## 🔐 Sécurité et Validation

### Validation Côté Backend

**Champs obligatoires** :
- `authorName` : Non vide, max 100 caractères
- `authorFunction` : Non vide, max 100 caractères
- `schoolName` : Non vide, max 200 caractères
- `content` : Non vide, min 50 caractères, max 1000 caractères
- `rating` : Entier entre 1 et 5

**Vérifications** :
- ✅ L'utilisateur est authentifié
- ✅ Le `tenantId` correspond à l'utilisateur authentifié
- ✅ L'école a un abonnement actif (optionnel, selon la stratégie)
- ✅ Pas de spam : limite de soumissions par école (ex: 1 par mois)

### Protection contre les Abus

1. **Limite de soumissions** : 1 témoignage par école et par période (ex: 1/mois)
2. **Vérification d'identité** : L'admin peut vérifier que l'auteur est bien le directeur/promoteur
3. **Modération du contenu** : Filtrage des mots inappropriés (optionnel)
4. **Rate limiting** : Limite de requêtes par IP

---

## 📱 Interface Utilisateur

### Pour les Écoles (Dashboard)

**Soumission de témoignage** :
- Formulaire accessible depuis le dashboard
- Champs : Nom, Fonction, Photo (optionnel), École, Ville, Contenu, Note
- Prévisualisation avant soumission
- Message de confirmation : "Votre témoignage a été soumis et sera examiné sous 48h"

**Suivi des témoignages** :
- Liste des témoignages soumis avec leur statut
- Si `PENDING` : "En attente de validation"
- Si `APPROVED` : "Publié" + lien vers la page publique
- Si `REJECTED` : "Rejeté" + raison du rejet

### Pour les Administrateurs (Backend)

**Interface de modération** :
- Liste des témoignages `PENDING`
- Actions : Approuver, Rejeter, Demander modifications
- Prévisualisation du témoignage
- Informations sur l'école (tenantId, nom, statut d'abonnement)

**Gestion des témoignages publiés** :
- Liste des témoignages `APPROVED`
- Actions : Mettre en avant (`featured`), Archiver, Modifier l'ordre d'affichage
- Statistiques : Nombre de témoignages par statut

---

## 🎨 Affichage Public

### Landing Page

**Section témoignages** :
- Affichage de 3 témoignages `featured = true`
- Design sobre et institutionnel
- Lien vers la page complète `/testimonials`

### Page Témoignages (`/testimonials`)

**Contenu** :
- Tous les témoignages `APPROVED`
- Grille responsive (3 colonnes desktop, 2 tablette, 1 mobile)
- Filtres optionnels : Par note, Par ville, Par fonction
- Badge "Témoignage mis en avant" pour les `featured`

**Design** :
- Carte blanche avec bordure subtile
- Icône de citation (Quote)
- Étoiles pour la note
- Photo ou initiale de l'auteur
- Informations : Nom, Fonction, École, Ville

---

## 🔄 API Routes Requises (Backend)

### `POST /api/testimonials/submit`

**Rôle** : Soumettre un nouveau témoignage

**Authentification** : Requise (JWT)

**Body** :
```json
{
  "authorName": "Jean DUPONT",
  "authorFunction": "Directeur",
  "authorPhotoUrl": "https://...",
  "schoolName": "École Primaire Excellence",
  "schoolCity": "Cotonou",
  "content": "Academia Hub a transformé...",
  "rating": 5
}
```

**Réponse** :
```json
{
  "success": true,
  "testimonialId": "test_123",
  "message": "Votre témoignage a été soumis et sera examiné sous 48h."
}
```

**Validation** :
- Vérifier que l'utilisateur est authentifié
- Extraire `tenantId` depuis le token JWT
- Valider les champs (format, longueur)
- Vérifier la limite de soumissions
- Créer le témoignage avec `status = 'PENDING'`

### `GET /api/testimonials`

**Rôle** : Récupérer les témoignages publiés

**Query params** :
- `status` : `APPROVED` (obligatoire pour les requêtes publiques)
- `featured` : `true` | `false` (optionnel)
- `limit` : Nombre max (optionnel, défaut: 50)

**Réponse** :
```json
[
  {
    "id": "test_123",
    "authorName": "Jean DUPONT",
    "authorFunction": "Directeur",
    "schoolName": "École Primaire Excellence",
    "content": "...",
    "rating": 5,
    "featured": true,
    ...
  }
]
```

**Sécurité** :
- Ne retourner que les témoignages `APPROVED`
- Ne pas exposer `tenantId`, `reviewedBy`, `rejectionReason` dans les réponses publiques

### `GET /api/testimonials/my` (Authentifié)

**Rôle** : Récupérer les témoignages de l'école connectée

**Authentification** : Requise

**Réponse** : Liste des témoignages avec tous les statuts (`PENDING`, `APPROVED`, `REJECTED`)

### `POST /api/testimonials/:id/approve` (Admin)

**Rôle** : Approuver un témoignage

**Authentification** : Requise (Admin uniquement)

**Body** :
```json
{
  "featured": true, // Optionnel
  "displayOrder": 1  // Optionnel
}
```

### `POST /api/testimonials/:id/reject` (Admin)

**Rôle** : Rejeter un témoignage

**Authentification** : Requise (Admin uniquement)

**Body** :
```json
{
  "rejectionReason": "Contenu inapproprié"
}
```

---

## 📊 Exemple de Workflow Complet

### Scénario : Soumission et Validation

1. **École soumet un témoignage**
   - Formulaire rempli dans le dashboard
   - Appel `POST /api/testimonials/submit`
   - Backend crée le témoignage avec `status = 'PENDING'`
   - Notification admin (email ou dashboard)

2. **Admin examine le témoignage**
   - Interface admin : Liste des témoignages `PENDING`
   - Vérification : L'école existe, l'auteur est vérifiable
   - Décision : Approuver

3. **Admin approuve**
   - Appel `POST /api/testimonials/:id/approve`
   - Backend met à jour `status = 'APPROVED'`, `reviewedAt`, `reviewedBy`
   - Optionnel : `featured = true`

4. **Publication**
   - Le témoignage apparaît sur `/testimonials`
   - Si `featured = true`, apparaît aussi sur la landing page
   - Notification à l'école (optionnel) : "Votre témoignage a été publié"

---

## ⚠️ Contraintes et Bonnes Pratiques

### Contraintes

- ❌ **Pas de publication automatique** : Toujours valider manuellement
- ❌ **Pas de contenu marketing excessif** : Ton sobre et institutionnel
- ❌ **Pas d'exposition de données sensibles** : Ne pas exposer `tenantId` publiquement
- ✅ **Validation stricte** : Vérifier l'authenticité des témoignages
- ✅ **Traçabilité** : Enregistrer qui a validé/rejeté et quand

### Bonnes Pratiques

1. **Réactivité** : Répondre aux soumissions sous 48h
2. **Transparence** : Communiquer clairement les raisons de rejet
3. **Diversité** : Varier les témoignages mis en avant
4. **Authenticité** : Vérifier que l'auteur est bien le directeur/promoteur
5. **Respect** : Traiter les témoignages avec respect, même s'ils sont rejetés

---

## 📝 Résumé

- ✅ **Validation manuelle obligatoire** : Aucune publication automatique
- ✅ **Contrôle éditorial strict** : Tous les témoignages sont vérifiés
- ✅ **Ton sobre et institutionnel** : Pas de marketing excessif
- ✅ **Traçabilité complète** : Historique des validations/rejets
- ✅ **Sécurité multi-tenant** : Isolation stricte des données
- ✅ **Interface publique** : Page dédiée et section sur la landing page

**Version** : 1.0.0  
**Dernière mise à jour** : 2025


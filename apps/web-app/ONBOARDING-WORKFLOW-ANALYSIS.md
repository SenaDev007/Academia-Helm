# 🔍 Analyse Complète du Workflow Onboarding

## 📋 Vue d'ensemble

Ce document analyse le workflow complet de l'onboarding dans `OnboardingWizard.tsx` et vérifie que tous les mappings et connexions à la base de données sont corrects.

---

## ✅ Phase 1 : Établissement (Step 1)

### Frontend → Backend Mapping

| Frontend (OnboardingWizard) | Backend (OnboardingService) | Base de données (OnboardingDraft) | Statut |
|------------------------------|----------------------------|-----------------------------------|--------|
| `schoolName` | `schoolName` | `school_name` | ✅ OK |
| `schoolType` | `schoolType` | `school_type` | ✅ OK |
| `city` | `city` | `city` | ✅ OK |
| `country` | `country` | `country` | ✅ OK |
| `phone` | `phone` | `phone` | ✅ OK |
| `email` | `email` | `email` | ✅ OK |
| `bilingual` | `bilingual` | `bilingual` | ✅ OK |
| `schoolsCount` | `schoolsCount` | `schools_count` | ✅ OK |
| `logoUrl` | ❌ Non envoyé | ❌ Non stocké | ⚠️ **MANQUANT** |

### Problèmes identifiés

1. **Logo non envoyé** : Le frontend a `logoUrl` dans l'interface mais ne l'envoie pas au backend
   - **Impact** : Le logo ne peut pas être sauvegardé
   - **Solution** : Vérifier si le logo doit être uploadé via `/api/onboarding/upload-logo` avant la phase 1

### API Route

- **Frontend** : `POST /api/onboarding/draft`
- **Backend** : `POST /api/onboarding/draft`
- **Service** : `OnboardingService.createDraft()`
- **Statut** : ✅ Connecté correctement

### Validation

- ✅ Validation frontend complète
- ✅ Validation backend via DTO (`CreateDraftDto`)
- ✅ Vérification d'unicité (email + status DRAFT/PENDING_PAYMENT)

---

## ✅ Phase 2 : Promoteur (Step 2)

### Frontend → Backend Mapping

| Frontend (OnboardingWizard) | Backend (OnboardingService) | Base de données (OnboardingDraft) | Statut |
|------------------------------|----------------------------|-----------------------------------|--------|
| `firstName` | `firstName` | `promoter_first_name` | ✅ OK |
| `lastName` | `lastName` | `promoter_last_name` | ✅ OK |
| `promoterEmail` | `email` | `promoter_email` | ✅ OK |
| `promoterPhone` | `phone` | `promoter_phone` | ✅ OK |
| `password` | `password` (hashé) | `promoter_password_hash` | ✅ OK |
| `otp` | `otpCode` | Vérifié via `OnboardingOTP` | ✅ OK |
| `confirmPassword` | ❌ Non envoyé | ❌ Non stocké | ✅ OK (validation frontend uniquement) |

### Problèmes identifiés

1. **OTP Workflow incomplet** :
   - ❌ Le frontend n'appelle pas `/api/onboarding/otp/generate` avant la vérification
   - ❌ Le frontend simule l'envoi OTP (`handleSendOtp` ligne 441-459)
   - ⚠️ Le frontend simule la vérification OTP (`handleVerifyOtp` ligne 461-479)
   - **Impact** : L'OTP n'est pas réellement envoyé/vérifié
   - **Solution** : Connecter les fonctions OTP aux vraies routes API

2. **Normalisation téléphone** :
   - ✅ Le frontend normalise le téléphone avant l'envoi
   - ✅ Le backend reçoit le téléphone normalisé
   - **Statut** : ✅ OK

### API Routes

- **Frontend** : `POST /api/onboarding/promoter`
- **Backend** : `POST /api/onboarding/draft/:draftId/promoter`
- **Service** : `OnboardingService.addPromoterInfo()`
- **Statut** : ✅ Connecté correctement (mais OTP non fonctionnel)

### Validation

- ✅ Validation frontend complète (mot de passe, confirmation, OTP)
- ✅ Validation backend via DTO
- ✅ Vérification OTP (si fourni)
- ⚠️ Mode développement : OTP optionnel (non recommandé)

---

## ✅ Phase 3 : Plan & Options (Step 3)

### Frontend → Backend Mapping

| Frontend (OnboardingWizard) | Backend (OnboardingService) | Base de données (OnboardingDraft) | Statut |
|------------------------------|----------------------------|-----------------------------------|--------|
| `planCode` | `planId` (converti) | `selected_plan_id` | ✅ OK |
| `billingPeriod` | `periodType` (MONTHLY/YEARLY) | `price_snapshot.periodType` | ✅ OK |
| `schoolsCount` | Utilisé depuis draft | `price_snapshot.schoolsCount` | ✅ OK |
| `bilingual` | Utilisé depuis draft | `price_snapshot.bilingualFee` | ✅ OK |
| `bilingualEnabled` | ❌ Non utilisé | ❌ Non stocké | ⚠️ **REDONDANT** |

### Problèmes identifiés

1. **Conversion planCode → planId** :
   - ✅ Le frontend convertit `planCode` en `planId` via l'API publique
   - ✅ Le backend accepte `planId` ou `planCode` (via `PricingService`)
   - **Statut** : ✅ OK

2. **Champ `bilingualEnabled` redondant** :
   - ⚠️ Le frontend envoie `bilingualEnabled` mais le backend utilise `draft.bilingual`
   - **Impact** : Aucun (le backend ignore ce champ)
   - **Solution** : Supprimer `bilingualEnabled` du frontend ou l'utiliser

3. **Calcul du prix** :
   - ✅ Le frontend calcule le prix côté client (affichage uniquement)
   - ✅ Le backend recalcule le prix via `PricingService` (source de vérité)
   - **Statut** : ✅ OK (double calcul acceptable pour UX)

### API Route

- **Frontend** : `POST /api/onboarding/plan`
- **Backend** : `POST /api/onboarding/draft/:draftId/plan`
- **Service** : `OnboardingService.selectPlan()`
- **Statut** : ✅ Connecté correctement

### Validation

- ✅ Validation frontend (planCode requis)
- ✅ Validation backend (planId/planCode valide)
- ✅ Calcul du prix via `PricingService`

---

## ✅ Phase 4 : Paiement (Step 4)

### Frontend → Backend Mapping

| Frontend (OnboardingWizard) | Backend (OnboardingService) | Base de données (OnboardingPayment) | Statut |
|------------------------------|----------------------------|--------------------------------------|--------|
| `draftId` | `draftId` | `draft_id` | ✅ OK |
| ❌ Aucun autre champ | Généré automatiquement | `reference`, `amount`, `status` | ✅ OK |

### Problèmes identifiés

1. **Redirection FedaPay** :
   - ✅ Le backend génère l'URL de paiement FedaPay
   - ✅ Le frontend redirige vers cette URL
   - **Statut** : ✅ OK

2. **Webhook FedaPay** :
   - ⚠️ Le webhook doit mettre à jour le statut du paiement
   - ⚠️ Le webhook doit finaliser l'onboarding (créer Tenant, School, User)
   - **Vérification** : À vérifier dans le code backend

### API Route

- **Frontend** : `POST /api/onboarding/payment`
- **Backend** : `POST /api/onboarding/draft/:draftId/payment`
- **Service** : `OnboardingService.createPaymentSession()`
- **Statut** : ✅ Connecté correctement

### Validation

- ✅ Vérification du statut du draft (PENDING_PAYMENT)
- ✅ Vérification du priceSnapshot
- ✅ Création de la session FedaPay

---

## 🔴 Problèmes Critiques à Corriger

### 1. OTP Workflow Non Fonctionnel

**Problème** : Le frontend simule l'envoi et la vérification OTP au lieu d'appeler les vraies routes API.

**Fichiers concernés** :
- `apps/web-app/src/components/onboarding/OnboardingWizard.tsx` (lignes 441-479)

**Solution** :
```typescript
// Remplacer handleSendOtp
const handleSendOtp = async () => {
  if (!data.promoterPhone || !data.draftId) {
    setErrors({ promoterPhone: 'Veuillez entrer votre numéro de téléphone' });
    return;
  }

  setIsSubmitting(true);
  try {
    const normalizedPhone = normalizePhoneNumber(data.promoterPhone, data.country);
    const response = await fetch('/api/onboarding/otp/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draftId: data.draftId,
        phone: normalizedPhone,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Erreur lors de l\'envoi du code OTP');
    }

    const result = await response.json();
    setOtpSent(true);
    setOtpCode(result.code); // En dev uniquement
    setOtpExpiresAt(new Date(result.expiresAt));
    setErrors({});
  } catch (error: any) {
    setErrors({ otp: error.message || 'Erreur lors de l\'envoi du code OTP' });
  } finally {
    setIsSubmitting(false);
  }
};

// Remplacer handleVerifyOtp
const handleVerifyOtp = async () => {
  if (!data.otp || data.otp.length !== 6) {
    setErrors({ otp: 'Le code OTP doit contenir 6 chiffres' });
    return;
  }

  if (!data.draftId || !data.promoterPhone) {
    setErrors({ otp: 'Informations manquantes' });
    return;
  }

  setIsSubmitting(true);
  try {
    const normalizedPhone = normalizePhoneNumber(data.promoterPhone, data.country);
    const response = await fetch('/api/onboarding/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draftId: data.draftId,
        phone: normalizedPhone,
        code: data.otp,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Code OTP invalide');
    }

    setOtpVerified(true);
    setErrors({});
  } catch (error: any) {
    setErrors({ otp: error.message || 'Code OTP invalide' });
  } finally {
    setIsSubmitting(false);
  }
};
```

### 2. Logo Non Géré

**Problème** : Le champ `logoUrl` existe dans l'interface mais n'est jamais utilisé.

**Solution** :
- Option 1 : Supprimer `logoUrl` de l'interface si non nécessaire
- Option 2 : Ajouter un upload de logo avant la phase 1 (via `/api/onboarding/upload-logo`)

### 3. Champ `bilingualEnabled` Redondant

**Problème** : Le frontend envoie `bilingualEnabled` mais le backend l'ignore.

**Solution** : Supprimer `bilingualEnabled` du body envoyé à `/api/onboarding/plan`

---

## ⚠️ Améliorations Recommandées

### 1. Gestion d'Erreurs

- ✅ Les erreurs sont affichées dans l'UI
- ⚠️ Certaines erreurs réseau ne sont pas gérées (timeout, connexion perdue)
- **Recommandation** : Ajouter un retry automatique pour les erreurs réseau

### 2. Persistance du Draft

- ⚠️ Si l'utilisateur rafraîchit la page, le draft est perdu
- **Recommandation** : Sauvegarder le `draftId` dans `localStorage` et restaurer l'état

### 3. Validation Téléphone

- ✅ Normalisation du téléphone
- ⚠️ Validation du format (10 chiffres) mais pas de vérification de l'existence du numéro
- **Statut** : ✅ OK (vérification OTP suffit)

### 4. Timer OTP

- ⚠️ Le frontend affiche un timer mais ne vérifie pas l'expiration côté client
- **Recommandation** : Ajouter un composant `OtpTimer` qui vérifie l'expiration et réinitialise le formulaire

---

## ✅ Points Positifs

1. **Mapping correct** : Tous les champs essentiels sont correctement mappés
2. **Validation complète** : Validation frontend et backend
3. **Gestion d'erreurs** : Erreurs affichées à l'utilisateur
4. **Normalisation téléphone** : Gestion correcte des codes pays
5. **Calcul prix** : Double calcul (frontend pour UX, backend pour sécurité)
6. **Workflow séquentiel** : Les phases sont bien ordonnées

---

## 📊 Résumé

| Phase | Mapping | API | Validation | Statut Global |
|-------|---------|-----|------------|---------------|
| 1. Établissement | ✅ | ✅ | ✅ | ✅ **OK** |
| 2. Promoteur | ✅ | ✅ | ✅ | ⚠️ **OTP non fonctionnel** |
| 3. Plan | ✅ | ✅ | ✅ | ✅ **OK** |
| 4. Paiement | ✅ | ✅ | ✅ | ✅ **OK** |

**Statut global** : ⚠️ **Fonctionnel mais nécessite corrections OTP**

---

## 🔧 Actions Requises

1. **URGENT** : Corriger le workflow OTP (appels API réels)
2. **MOYEN** : Gérer le logo (upload ou suppression)
3. **FAIBLE** : Nettoyer les champs redondants
4. **FAIBLE** : Améliorer la persistance du draft

---

**Date d'analyse** : 2025-01-XX  
**Version analysée** : 1.0.0

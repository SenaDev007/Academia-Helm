# ✅ Gestion du Draft Existant - Onboarding

## 📋 Problème Identifié

**Erreur** : `POST /api/onboarding/draft` retournait une erreur **400 Bad Request** avec le message :
```
"Un onboarding est déjà en cours pour cet email"
```

**Cause** : Le backend vérifie si un draft existe déjà pour l'email fourni avec le statut `DRAFT` ou `PENDING_PAYMENT`. Si c'est le cas, il retourne une erreur 400.

**Problème UX** : L'utilisateur ne pouvait pas continuer son onboarding existant.

---

## ✅ Solution Appliquée

### 1. Backend : Retour de l'ID du Draft Existant

**Fichier** : `apps/api-server/src/onboarding/services/onboarding.service.ts`

**Modification** :
```typescript
if (existingDraft) {
  // Retourner l'ID du draft existant dans l'erreur pour permettre au frontend de le charger
  const errorResponse = {
    message: 'Un onboarding est déjà en cours pour cet email',
    existingDraftId: existingDraft.id,
    status: existingDraft.status,
  };
  throw new BadRequestException(errorResponse);
}
```

**Avant** :
- ❌ Erreur simple sans information sur le draft existant
- ❌ L'utilisateur ne pouvait pas récupérer son draft

**Après** :
- ✅ L'erreur contient l'ID du draft existant
- ✅ Le frontend peut charger automatiquement le draft

### 2. Frontend : Chargement Automatique du Draft Existant

**Fichier** : `apps/web-app/src/components/onboarding/OnboardingWizard.tsx`

**Modification** :
```typescript
if (!response.ok) {
  const error = await response.json();
  
  // Si un draft existe déjà, essayer de le charger
  if (error.message?.includes('déjà en cours')) {
    const existingDraftId = error.existingDraftId 
      || (error.message && typeof error.message === 'object' && error.message.existingDraftId)
      || (error.message?.existingDraftId);
    
    if (existingDraftId) {
      // Charger le draft existant
      const existingDraftResponse = await fetch(`/api/onboarding/draft?draftId=${existingDraftId}`);
      if (existingDraftResponse.ok) {
        const existingDraft = await existingDraftResponse.json();
        // Charger les données du draft existant dans le formulaire
        const updatedData = {
          ...data,
          draftId: existingDraft.id,
          schoolName: existingDraft.schoolName || data.schoolName,
          // ... autres champs
        };
        setData(updatedData);
        // Afficher un message informatif
        setErrors({
          info: `Un onboarding est déjà en cours pour cet email. Vos données ont été chargées. Vous pouvez continuer où vous vous êtes arrêté.`,
        });
        setIsSubmitting(false);
        return; // Continuer avec le draft existant
      }
    }
  }
  
  // Si pas de draft existant, afficher l'erreur normale
  throw new Error(errorMessage);
}
```

**Avant** :
- ❌ Erreur affichée à l'utilisateur
- ❌ Impossible de continuer l'onboarding existant

**Après** :
- ✅ Détection automatique du draft existant
- ✅ Chargement automatique des données
- ✅ Message informatif (pas une erreur)
- ✅ L'utilisateur peut continuer où il s'est arrêté

### 3. Affichage du Message Informatif

**Fichier** : `apps/web-app/src/components/onboarding/OnboardingWizard.tsx`

**Ajout** :
```typescript
{errors.info && (
  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md flex items-start">
    <CheckCircle className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
    <p className="text-sm text-blue-800">{errors.info}</p>
  </div>
)}
```

**Résultat** :
- ✅ Message informatif en bleu (pas une erreur rouge)
- ✅ Icône de validation (CheckCircle)
- ✅ Message clair et rassurant

---

## 🔄 Workflow

### Scénario : Utilisateur essaie de créer un nouveau draft avec un email existant

1. **Utilisateur** : Remplit Phase 1 et clique sur "Continuer"
2. **Frontend** : Envoie `POST /api/onboarding/draft` avec les données
3. **Backend** : Détecte un draft existant pour cet email
4. **Backend** : Retourne erreur 400 avec `existingDraftId`
5. **Frontend** : Détecte l'erreur et l'ID du draft existant
6. **Frontend** : Charge le draft existant via `GET /api/onboarding/draft?draftId=...`
7. **Frontend** : Remplit automatiquement le formulaire avec les données du draft
8. **Frontend** : Affiche un message informatif
9. **Utilisateur** : Peut continuer l'onboarding où il s'est arrêté

---

## 📊 Structure de l'Erreur Backend

```typescript
{
  message: 'Un onboarding est déjà en cours pour cet email',
  existingDraftId: 'uuid-du-draft',
  status: 'DRAFT' | 'PENDING_PAYMENT',
  error: 'Bad Request',
  statusCode: 400
}
```

---

## 🧪 Tests Recommandés

### Test 1 : Draft Existant Détecté
- [ ] Créer un draft avec un email
- [ ] Essayer de créer un nouveau draft avec le même email
- [ ] Vérifier que l'erreur 400 est retournée avec `existingDraftId`
- [ ] Vérifier que le draft existant est chargé automatiquement
- [ ] Vérifier que les données sont pré-remplies dans le formulaire
- [ ] Vérifier que le message informatif est affiché

### Test 2 : Continuation de l'Onboarding
- [ ] Charger un draft existant
- [ ] Vérifier que l'utilisateur peut continuer à l'étape suivante
- [ ] Vérifier que les données sont préservées

### Test 3 : Gestion des Erreurs
- [ ] Vérifier que si le chargement du draft échoue, l'erreur normale est affichée
- [ ] Vérifier que les autres erreurs 400 sont toujours gérées correctement

---

## ✅ Checklist

- [x] Backend retourne l'ID du draft existant dans l'erreur
- [x] Frontend détecte l'erreur de draft existant
- [x] Frontend charge automatiquement le draft existant
- [x] Frontend remplit le formulaire avec les données du draft
- [x] Message informatif affiché (pas une erreur)
- [x] L'utilisateur peut continuer l'onboarding
- [x] Gestion des erreurs améliorée
- [x] Aucune erreur de lint

---

## 🎯 Résultat

**La gestion du draft existant est maintenant automatique** :

- ✅ **Détection automatique** : Le backend retourne l'ID du draft existant
- ✅ **Chargement automatique** : Le frontend charge le draft existant
- ✅ **Remplissage automatique** : Le formulaire est pré-rempli avec les données
- ✅ **Message informatif** : L'utilisateur est informé qu'il peut continuer
- ✅ **UX améliorée** : L'utilisateur peut reprendre son onboarding sans perdre ses données

**Statut** : ✅ **GESTION DU DRAFT EXISTANT IMPLÉMENTÉE**

---

**Date d'implémentation** : 2025-01-XX  
**Version** : 1.0.0  
**Statut** : ✅ **IMPLÉMENTÉ**

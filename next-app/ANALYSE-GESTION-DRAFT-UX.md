# 📊 Analyse Gestion Draft - Amélioration UX

## 🔍 Analyse Actuelle

### Points Positifs ✅

1. **Détection automatique** : Le système détecte automatiquement un draft existant
2. **Modal de choix** : L'utilisateur peut choisir entre continuer ou annuler
3. **Sauvegarde localStorage** : Les données sont sauvegardées localement
4. **Chargement automatique** : Le draft existant est chargé automatiquement

### Points à Améliorer ⚠️

1. **Expiration du draft** : Pas de gestion claire de l'expiration (24h mentionnée mais pas visible)
2. **Feedback utilisateur** : Pas d'indication claire du statut du draft
3. **Récupération automatique** : Pas de récupération automatique au chargement de la page
4. **Indicateur visuel** : Pas d'indication qu'un draft est en cours
5. **Gestion d'erreurs** : Peut être améliorée pour les cas de timeout/erreur réseau

---

## 🎯 Recommandations UX

### 1. Indicateur de Draft en Cours

**Problème** : L'utilisateur ne sait pas qu'un draft existe avant de soumettre

**Solution** : Afficher un bandeau informatif en haut du formulaire si un draft existe

```typescript
// Au chargement de la page, vérifier si un draft existe pour l'email
useEffect(() => {
  const checkExistingDraft = async () => {
    if (data.email && data.email.includes('@')) {
      // Vérifier silencieusement si un draft existe
      // Afficher un bandeau si trouvé
    }
  };
  checkExistingDraft();
}, [data.email]);
```

**Bénéfice** : L'utilisateur est informé avant de remplir le formulaire

---

### 2. Récupération Automatique au Chargement

**Problème** : Si l'utilisateur revient sur la page, il doit refaire tout le formulaire

**Solution** : Charger automatiquement le draft au montage du composant

```typescript
useEffect(() => {
  const loadDraftOnMount = async () => {
    // Si on a un draftId dans localStorage, charger le draft
    const savedDraftId = localStorage.getItem('onboarding-draft-id');
    if (savedDraftId) {
      try {
        const draft = await fetch(`/api/onboarding/draft?draftId=${savedDraftId}`);
        if (draft.ok) {
          const draftData = await draft.json();
          // Charger les données dans le formulaire
          // Afficher un message : "Votre brouillon a été restauré"
        }
      } catch (error) {
        // Draft expiré ou introuvable, continuer normalement
      }
    }
  };
  loadDraftOnMount();
}, []);
```

**Bénéfice** : L'utilisateur peut reprendre où il s'est arrêté sans perdre ses données

---

### 3. Indicateur de Progression

**Problème** : L'utilisateur ne sait pas à quelle étape il était

**Solution** : Afficher un indicateur de progression dans la modal

```typescript
// Dans la modal de choix
const getProgressInfo = (draft) => {
  if (draft.promoterEmail && draft.selectedPlanId) {
    return { step: 4, label: 'Prêt pour le paiement' };
  } else if (draft.promoterEmail) {
    return { step: 3, label: 'Plan à sélectionner' };
  } else if (draft.promoterFirstName) {
    return { step: 2, label: 'Informations promoteur incomplètes' };
  } else {
    return { step: 1, label: 'Informations établissement' };
  }
};
```

**Bénéfice** : L'utilisateur sait exactement où il en était

---

### 4. Gestion de l'Expiration

**Problème** : Les drafts expirent après 24h mais l'utilisateur ne le sait pas

**Solution** : Afficher la date d'expiration et un avertissement

```typescript
// Dans la modal
const isExpiringSoon = (createdAt) => {
  const hoursSinceCreation = (Date.now() - new Date(createdAt)) / (1000 * 60 * 60);
  return hoursSinceCreation > 20; // Avertir si moins de 4h restantes
};

{isExpiringSoon(existingDraftInfo.data.createdAt) && (
  <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-4">
    <p className="text-sm text-amber-800">
      ⚠️ Ce brouillon expirera dans moins de 4 heures. Complétez votre inscription rapidement.
    </p>
  </div>
)}
```

**Bénéfice** : L'utilisateur est averti avant l'expiration

---

### 5. Sauvegarde Automatique en Temps Réel

**Problème** : Les données ne sont sauvegardées que lors de la soumission

**Solution** : Sauvegarder automatiquement dans le draft à chaque changement

```typescript
// Debounce pour éviter trop de requêtes
const debouncedSave = useMemo(
  () => debounce(async (draftData) => {
    if (data.draftId) {
      await fetch(`/api/onboarding/draft/${data.draftId}/update`, {
        method: 'PATCH',
        body: JSON.stringify(draftData),
      });
    }
  }, 2000), // Sauvegarder 2 secondes après le dernier changement
  [data.draftId]
);

useEffect(() => {
  if (data.draftId && step === 1) {
    debouncedSave(data);
  }
}, [data, step]);
```

**Bénéfice** : Les données sont toujours sauvegardées, même en cas de fermeture accidentelle

---

### 6. Message de Confirmation pour Annulation

**Problème** : L'annulation du draft est irréversible mais pas clairement indiquée

**Solution** : Ajouter une confirmation avant suppression

```typescript
const handleCancelExistingDraft = async () => {
  // Confirmation avant suppression
  const confirmed = window.confirm(
    'Êtes-vous sûr de vouloir annuler ce brouillon ? Cette action est irréversible et vous devrez recommencer depuis le début.'
  );
  
  if (!confirmed) return;
  
  // ... reste du code
};
```

**Bénéfice** : Évite les suppressions accidentelles

---

### 7. Affichage des Données du Draft dans la Modal

**Problème** : La modal affiche peu d'informations sur le draft existant

**Solution** : Afficher un résumé complet

```typescript
// Dans la modal
<div className="bg-gray-50 rounded-lg p-4 mb-4">
  <p className="text-sm font-medium text-gray-900 mb-3">Résumé du brouillon :</p>
  <div className="space-y-2 text-sm text-gray-600">
    <div><strong>Établissement :</strong> {existingDraftInfo.data.schoolName}</div>
    <div><strong>Type :</strong> {existingDraftInfo.data.schoolType}</div>
    <div><strong>Ville :</strong> {existingDraftInfo.data.city}</div>
    <div><strong>Email :</strong> {existingDraftInfo.data.email}</div>
    {existingDraftInfo.data.promoterFirstName && (
      <div><strong>Promoteur :</strong> {existingDraftInfo.data.promoterFirstName} {existingDraftInfo.data.promoterLastName}</div>
    )}
    {existingDraftInfo.data.selectedPlanId && (
      <div><strong>Plan sélectionné :</strong> Oui</div>
    )}
    <div><strong>Progression :</strong> {getProgressInfo(existingDraftInfo.data).label}</div>
    <div><strong>Créé le :</strong> {new Date(existingDraftInfo.data.createdAt).toLocaleString('fr-FR')}</div>
  </div>
</div>
```

**Bénéfice** : L'utilisateur voit clairement ce qui a été sauvegardé

---

### 8. Bouton "Reprendre le brouillon" Visible

**Problème** : L'utilisateur doit soumettre le formulaire pour voir qu'un draft existe

**Solution** : Afficher un bouton visible si un draft existe

```typescript
// En haut du formulaire, avant les champs
{existingDraftInfo && !showDraftChoiceModal && (
  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-blue-900">Un brouillon existe pour cet email</p>
        <p className="text-sm text-blue-700">Vous pouvez reprendre votre inscription où vous vous êtes arrêté</p>
      </div>
      <button
        onClick={() => setShowDraftChoiceModal(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        Reprendre le brouillon
      </button>
    </div>
  </div>
)}
```

**Bénéfice** : L'utilisateur peut reprendre sans avoir à soumettre

---

## 📋 Checklist d'Implémentation

### Priorité Haute 🔴

- [ ] **Récupération automatique au chargement** : Charger le draft si draftId existe
- [ ] **Indicateur de progression** : Afficher l'étape actuelle dans la modal
- [ ] **Message de confirmation** : Confirmer avant suppression du draft
- [ ] **Résumé complet** : Afficher toutes les informations du draft dans la modal

### Priorité Moyenne 🟡

- [ ] **Indicateur de draft en cours** : Bandeau informatif si draft existe
- [ ] **Gestion expiration** : Afficher avertissement si expiration proche
- [ ] **Bouton visible** : Bouton "Reprendre" visible dans le formulaire

### Priorité Basse 🟢

- [ ] **Sauvegarde automatique** : Sauvegarder en temps réel (debounce)
- [ ] **Amélioration messages** : Messages plus clairs et rassurants

---

## 🎨 Exemples de Messages Améliorés

### Message dans la Modal

**Avant** :
> "Un onboarding est déjà en cours pour cet email"

**Après** :
> "Un brouillon d'inscription existe déjà pour cet email. Vous pouvez reprendre où vous vous êtes arrêté ou créer un nouveau brouillon."

### Message de Confirmation

**Avant** :
> (Pas de confirmation)

**Après** :
> "⚠️ Attention : Annuler ce brouillon le supprimera définitivement. Vous devrez recommencer depuis le début. Êtes-vous sûr de vouloir continuer ?"

### Message de Récupération

**Nouveau** :
> "✅ Votre brouillon a été restauré. Vous pouvez continuer votre inscription."

---

## 🔄 Workflow Amélioré

### Scénario 1 : Utilisateur revient sur la page

1. **Chargement** : Le système vérifie si un draftId existe dans localStorage
2. **Récupération** : Si trouvé, charge le draft depuis l'API
3. **Affichage** : Affiche un message "Votre brouillon a été restauré"
4. **Remplissage** : Remplit automatiquement le formulaire
5. **Navigation** : Va à l'étape appropriée selon la progression

### Scénario 2 : Utilisateur entre un email avec draft existant

1. **Détection** : Le système vérifie silencieusement si un draft existe
2. **Bandeau** : Affiche un bandeau informatif "Un brouillon existe pour cet email"
3. **Bouton** : Propose un bouton "Reprendre le brouillon"
4. **Choix** : L'utilisateur peut continuer à remplir ou reprendre

### Scénario 3 : Utilisateur soumet avec draft existant

1. **Détection** : Le backend retourne l'erreur avec existingDraftId
2. **Modal** : Affiche la modal avec résumé complet
3. **Choix** : L'utilisateur choisit de continuer ou annuler
4. **Action** : Selon le choix, charge ou supprime le draft

---

## ✅ Résultat Attendu

Après ces améliorations, l'expérience utilisateur sera :

- ✅ **Plus transparente** : L'utilisateur sait toujours où il en est
- ✅ **Plus sécurisée** : Les données sont sauvegardées automatiquement
- ✅ **Plus intuitive** : Les actions sont claires et confirmées
- ✅ **Plus rassurante** : L'utilisateur ne perd jamais ses données
- ✅ **Plus informative** : Toutes les informations nécessaires sont affichées

---

**Date d'analyse** : 2025-01-XX  
**Version** : 1.0.0  
**Statut** : 📊 **ANALYSE COMPLÈTE - PRÊT POUR IMPLÉMENTATION**

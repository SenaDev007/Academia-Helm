# ✅ Amélioration : Vérification du Draft par Email

## 📋 Problème Identifié

La bannière de restauration du draft s'affichait au chargement de la page pour tous les utilisateurs, ce qui n'était pas approprié car :
- Il peut y avoir plusieurs utilisateurs sur la plateforme
- Le draft doit être vérifié uniquement pour l'email spécifique de l'utilisateur
- La vérification doit se faire quand l'utilisateur saisit son email, pas au chargement

---

## ✅ Solution Implémentée

### 1. Nouvel Endpoint Backend

**Fichier** : `apps/api-server/src/onboarding/onboarding.controller.ts`

```typescript
/**
 * Vérifier si un draft existe pour un email
 */
@Get('draft/check/:email')
async checkDraftByEmail(@Param('email') email: string) {
  const draft = await this.onboardingService.checkDraftByEmail(email);
  return {
    exists: !!draft,
    draft: draft || null,
  };
}
```

**Fichier** : `apps/api-server/src/onboarding/services/onboarding.service.ts`

```typescript
/**
 * Vérifie si un draft existe pour un email
 */
async checkDraftByEmail(email: string) {
  const existingDraft = await this.prisma.onboardingDraft.findFirst({
    where: {
      email,
      status: { in: ['DRAFT', 'PENDING_PAYMENT'] },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return existingDraft;
}
```

### 2. Route API Next.js

**Fichier** : `apps/web-app/src/app/api/onboarding/draft/check/[email]/route.ts`

Proxy Next.js pour l'endpoint backend `/onboarding/draft/check/:email`.

### 3. Vérification Dynamique dans le Frontend

**Fichier** : `apps/web-app/src/components/onboarding/OnboardingWizard.tsx`

**Avant** :
```typescript
// ❌ Vérification au montage pour tous les utilisateurs
useEffect(() => {
  checkForSavedDraft(); // Vérifie localStorage au chargement
}, []);
```

**Après** :
```typescript
// ✅ Vérification uniquement quand l'utilisateur saisit l'email
useEffect(() => {
  // Ne vérifier que si on est à l'étape 1 et que l'email est valide
  if (step !== 1 || !data.email || !data.email.includes('@')) {
    setShowDraftRestoreBanner(false);
    return;
  }

  // Ne pas vérifier si on a déjà un draftId
  if (data.draftId) {
    return;
  }

  // Debounce : attendre 1 seconde après la dernière modification
  const timeoutId = setTimeout(async () => {
    const encodedEmail = encodeURIComponent(data.email);
    const response = await fetch(`/api/onboarding/draft/check/${encodedEmail}`);
    
    if (response.ok) {
      const result = await response.json();
      if (result.exists && result.draft) {
        setPendingDraftInfo({
          id: result.draft.id,
          data: result.draft,
        });
        setShowDraftRestoreBanner(true);
      }
    }
  }, 1000);

  return () => clearTimeout(timeoutId);
}, [data.email, step, data.draftId]);
```

---

## 🔄 Nouveau Workflow

### Scénario : Utilisateur saisit son email

1. **Utilisateur saisit l'email** dans le champ "Email de l'établissement"
2. **Attente de 1 seconde** (debounce) après la dernière frappe
3. **Vérification API** : Appel à `/api/onboarding/draft/check/{email}`
4. **Résultat** :
   - **Si un draft existe** : Bannière affichée avec les informations du draft
   - **Si aucun draft** : Pas de bannière, formulaire reste vide
5. **Choix de l'utilisateur** :
   - **"Restaurer"** : Charge le draft et continue l'inscription
   - **"Nouveau"** : Ignore le draft et démarre une nouvelle inscription

---

## ✅ Avantages

1. **Spécifique à l'utilisateur** : Vérifie uniquement pour l'email saisi
2. **Performance** : Debounce de 1 seconde évite les appels API inutiles
3. **Expérience utilisateur** : La bannière apparaît seulement quand nécessaire
4. **Multi-utilisateurs** : Chaque utilisateur voit uniquement son propre draft
5. **Non-intrusif** : Pas de vérification au chargement de la page

---

## 🎯 Résultat

✅ **Vérification ciblée** : Le draft est vérifié uniquement pour l'email spécifique saisi par l'utilisateur.

✅ **Affichage conditionnel** : La bannière s'affiche seulement si un draft existe pour cet email.

✅ **Multi-utilisateurs** : Plusieurs utilisateurs peuvent utiliser la plateforme sans interférence.

✅ **Performance optimisée** : Debounce réduit les appels API inutiles.

---

**Date d'implémentation** : 2025-01-XX  
**Version** : 1.0.0  
**Statut** : ✅ **IMPLÉMENTÉ**

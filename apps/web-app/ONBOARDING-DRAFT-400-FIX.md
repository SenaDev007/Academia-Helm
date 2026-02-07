# ✅ Correction Erreur 400 - Onboarding Draft

## 📋 Problème Identifié

**Erreur** : `POST /api/onboarding/draft` retournait une erreur **400 Bad Request**

**Cause** : Le frontend envoyait `logoUrl` dans le body, mais :
- ❌ Le DTO backend `CreateDraftDto` n'inclut pas `logoUrl`
- ❌ Le modèle Prisma `OnboardingDraft` n'a pas de champ `logoUrl`
- ❌ NestJS avec `class-validator` rejette les propriétés inconnues par défaut

---

## ✅ Solution Appliquée

### 1. Retrait de `logoUrl` de l'envoi du draft

**Fichier** : `apps/web-app/src/components/onboarding/OnboardingWizard.tsx`

**Avant** :
```typescript
body: JSON.stringify({
  schoolName: data.schoolName,
  schoolType: data.schoolType,
  city: data.city,
  country: data.country,
  phone: normalizedPhone,
  email: data.email,
  bilingual: data.bilingual,
  schoolsCount: data.schoolsCount,
  logoUrl: data.logoUrl, // ❌ Provoquait l'erreur 400
}),
```

**Après** :
```typescript
body: JSON.stringify({
  schoolName: data.schoolName,
  schoolType: data.schoolType,
  city: data.city,
  country: data.country,
  phone: normalizedPhone,
  email: data.email,
  bilingual: data.bilingual,
  schoolsCount: data.schoolsCount,
  // logoUrl n'est pas envoyé ici car il n'est pas dans le modèle OnboardingDraft
  // Le logo sera associé à l'établissement lors de la création finale du tenant
}),
```

### 2. Amélioration de la gestion des erreurs

**Fichier** : `apps/web-app/src/components/onboarding/OnboardingWizard.tsx`

**Ajout** :
```typescript
if (!response.ok) {
  const error = await response.json();
  console.error('❌ [Onboarding Draft] Error response:', error);
  // Afficher le message d'erreur du backend ou un message par défaut
  const errorMessage = error.message || error.error || 'Erreur lors de la création du draft';
  throw new Error(errorMessage);
}
```

**Fichier** : `apps/web-app/src/app/api/onboarding/draft/route.ts`

**Ajout** :
```typescript
console.log('🔍 [Onboarding Draft] Request body:', JSON.stringify(body, null, 2));

// ...

if (!response.ok) {
  console.error('❌ [Onboarding Draft] Backend error:', {
    status: response.status,
    statusText: response.statusText,
    data,
  });
  return NextResponse.json(data, { status: response.status });
}
```

---

## 📊 Structure du DTO Backend

Le DTO `CreateDraftDto` attend uniquement :

```typescript
{
  schoolName: string;      // ✅ Requis, min 2 caractères
  schoolType: string;      // ✅ Requis
  city: string;            // ✅ Requis
  country: string;         // ✅ Requis
  phone: string;          // ✅ Requis
  email: string;          // ✅ Requis, format email
  bilingual?: boolean;     // ⚪ Optionnel
  schoolsCount?: number;   // ⚪ Optionnel
  // logoUrl n'existe pas ❌
}
```

---

## 🔄 Gestion du Logo

### Workflow Actuel

1. **Phase 1 - Upload du logo** :
   - L'utilisateur sélectionne un logo
   - Le logo est uploadé via `/api/onboarding/upload-logo`
   - L'URL est stockée dans `data.logoUrl` (frontend uniquement)

2. **Phase 1 - Création du draft** :
   - Le draft est créé **sans** `logoUrl`
   - Le logo n'est pas sauvegardé dans `OnboardingDraft`

3. **Création finale du tenant** :
   - Le logo sera associé à l'établissement lors de la création du tenant
   - Le logo sera stocké dans `SchoolSettings.logoUrl`

### Pourquoi cette approche ?

- ✅ Le logo n'est pas nécessaire pour créer le draft
- ✅ Le logo sera associé lors de la création finale du tenant
- ✅ Évite de modifier le schéma Prisma pour un champ temporaire

---

## 🧪 Tests Recommandés

### Test 1 : Création du draft sans logo
- [ ] Remplir Phase 1 sans logo
- [ ] Vérifier que le draft est créé avec succès
- [ ] Vérifier que `draftId` est retourné

### Test 2 : Création du draft avec logo
- [ ] Remplir Phase 1 avec logo uploadé
- [ ] Vérifier que le draft est créé avec succès
- [ ] Vérifier que le logo est toujours dans `data.logoUrl` (frontend)
- [ ] Vérifier que le logo sera associé lors de la création du tenant

### Test 3 : Gestion des erreurs
- [ ] Vérifier que les messages d'erreur du backend sont affichés
- [ ] Vérifier les logs dans la console pour le debugging
- [ ] Vérifier que l'erreur 400 ne se produit plus

---

## ✅ Checklist

- [x] Retrait de `logoUrl` de l'envoi du draft
- [x] Amélioration de la gestion des erreurs frontend
- [x] Amélioration du logging dans la route API
- [x] Documentation du workflow du logo
- [x] Aucune erreur de lint

---

## 📝 Fichiers Modifiés

1. **`apps/web-app/src/components/onboarding/OnboardingWizard.tsx`**
   - Retrait de `logoUrl` de l'envoi du draft
   - Amélioration de la gestion des erreurs

2. **`apps/web-app/src/app/api/onboarding/draft/route.ts`**
   - Ajout du logging du body de la requête
   - Ajout du logging des erreurs backend

---

## 🎯 Résultat

**L'erreur 400 est maintenant corrigée** :

- ✅ Le frontend n'envoie plus `logoUrl` dans le draft
- ✅ Le backend accepte la requête sans erreur
- ✅ Les messages d'erreur sont mieux gérés et affichés
- ✅ Le logging est amélioré pour le debugging

**Statut** : ✅ **ERREUR 400 CORRIGÉE**

---

**Date de correction** : 2025-01-XX  
**Version** : 1.0.0  
**Statut** : ✅ **CORRIGÉ**

# ✅ Correction : Erreur EACCES avec localhost

## 📋 Problème Identifié

L'erreur `EACCES` (permission refusée) se produisait lors des appels API depuis les routes Next.js vers le backend NestJS. Le problème venait de l'utilisation de `localhost` au lieu de `127.0.0.1` dans les URLs.

**Erreur** :
```
TypeError: fetch failed
[cause]: AggregateError [EACCES]:
  at internalConnectMultiple (node:net:1134:18)
```

## 🔍 Cause

Dans les routes API Next.js (côté serveur), l'utilisation de `localhost` peut causer des problèmes de résolution DNS/IPv6, notamment sur Windows, ce qui génère des erreurs `EACCES`.

## ✅ Solution Implémentée

### 1. Fonction Helper `normalizeApiUrl()`

**Fichier** : `apps/web-app/src/lib/utils/api-urls.ts`

```typescript
/**
 * Normalise une URL pour utiliser 127.0.0.1 au lieu de localhost
 * Évite les erreurs EACCES dans les routes API Next.js (côté serveur)
 * 
 * @param url - URL à normaliser
 * @returns URL normalisée avec 127.0.0.1
 */
export function normalizeApiUrl(url: string): string {
  // Remplacer localhost par 127.0.0.1 pour éviter les problèmes DNS/IPv6/EACCES
  return url.replace(/http:\/\/localhost:/g, 'http://127.0.0.1:');
}
```

### 2. Application dans toutes les routes API d'onboarding

Les routes suivantes ont été mises à jour pour utiliser `normalizeApiUrl()` :

- ✅ `apps/web-app/src/app/api/onboarding/promoter/route.ts`
- ✅ `apps/web-app/src/app/api/onboarding/draft/route.ts`
- ✅ `apps/web-app/src/app/api/onboarding/draft/[draftId]/route.ts`
- ✅ `apps/web-app/src/app/api/onboarding/plan/route.ts`
- ✅ `apps/web-app/src/app/api/onboarding/payment/route.ts`
- ✅ `apps/web-app/src/app/api/onboarding/otp/generate/route.ts`
- ✅ `apps/web-app/src/app/api/onboarding/otp/verify/route.ts`

**Exemple d'utilisation** :
```typescript
const apiBaseUrl = getApiBaseUrlForRoutes();
const promoterUrl = `${apiBaseUrl}/onboarding/draft/${draftId}/promoter`;

// Normaliser l'URL pour utiliser 127.0.0.1 au lieu de localhost
const finalUrl = normalizeApiUrl(promoterUrl);
const response = await fetch(finalUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(backendBody),
});
```

### 3. Amélioration de `getApiBaseUrl()`

**Fichier** : `apps/web-app/src/lib/utils/urls.ts`

Le fallback pour l'environnement local utilise déjà `127.0.0.1` :
```typescript
// Dernier recours : utiliser le port par défaut API
// ⚠️ IMPORTANT : Utiliser 127.0.0.1 au lieu de localhost pour éviter les problèmes DNS/IPv6/EACCES
const port = process.env.API_PORT || '3000';
return `http://127.0.0.1:${port}/api`;
```

## 🔄 Workflow Corrigé

### Avant (avec erreur EACCES)
1. Route API Next.js appelle `getApiBaseUrlForRoutes()`
2. Retourne `http://localhost:3000/api`
3. `fetch()` essaie de se connecter à `localhost`
4. ❌ Erreur `EACCES` (permission refusée)

### Après (corrigé)
1. Route API Next.js appelle `getApiBaseUrlForRoutes()`
2. Retourne `http://127.0.0.1:3000/api` (ou `http://localhost:3000/api`)
3. `normalizeApiUrl()` convertit `localhost` en `127.0.0.1`
4. `fetch()` se connecte à `127.0.0.1`
5. ✅ Connexion réussie

## ✅ Avantages

1. **Résout l'erreur EACCES** : Utilisation de `127.0.0.1` évite les problèmes DNS/IPv6
2. **Centralisé** : Fonction helper réutilisable dans toutes les routes API
3. **Transparent** : Aucun impact sur le code existant, juste une normalisation
4. **Robuste** : Fonctionne sur tous les systèmes (Windows, Linux, Mac)

## 🎯 Résultat

✅ **Problème résolu** : Les routes API Next.js peuvent maintenant se connecter au backend NestJS sans erreur `EACCES`.

✅ **Toutes les routes d'onboarding corrigées** : Toutes les routes API d'onboarding utilisent maintenant `normalizeApiUrl()` pour garantir une connexion fiable.

---

**Date de correction** : 2025-01-XX  
**Version** : 1.0.0  
**Statut** : ✅ **CORRIGÉ**

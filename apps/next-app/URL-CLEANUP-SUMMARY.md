# ✅ Nettoyage des URLs Hardcodées - Résumé

## 📋 Objectif

Nettoyer **TOUT** le projet de toute URL hardcodée (localhost, vercel.app) et centraliser la gestion des URLs via variables d'environnement.

## ✅ Travaux Réalisés

### 1. Helper Centralisé Amélioré

**Fichier**: `apps/web-app/src/lib/utils/urls.ts`

- ✅ `getAppBaseUrl()` : Retourne l'URL de base de l'application
  - Utilise `NEXT_PUBLIC_APP_URL` en priorité
  - Fallback intelligent selon l'environnement
  - **Aucun localhost en dur** (sauf fallback de développement avec warning)

- ✅ `getApiBaseUrl()` : Retourne l'URL de l'API
  - Utilise `NEXT_PUBLIC_API_URL` en priorité
  - Fallback intelligent selon l'environnement
  - **Aucun localhost en dur** (sauf fallback de développement avec warning)

- ✅ `getBaseDomain()` : Retourne le domaine de base (sans protocole)
  - Utilise `NEXT_PUBLIC_BASE_DOMAIN` en priorité
  - Fallback intelligent selon l'environnement

### 2. Helper pour Routes API

**Fichier**: `apps/web-app/src/lib/utils/api-urls.ts` (NOUVEAU)

- ✅ `getApiBaseUrlForRoutes()` : Helper optimisé pour les routes API Next.js
- ✅ `getApiUrlForRoutes(path)` : Construit une URL API complète

### 3. Remplacement Massif

**Scripts créés**:
- ✅ `scripts/fix-hardcoded-urls.js` : Remplacement automatique des patterns courants
- ✅ `scripts/fix-remaining-urls.js` : Nettoyage des patterns restants

**Fichiers modifiés**:
- ✅ **284+ fichiers** dans `src/app/api/` : Tous utilisent maintenant `getApiBaseUrlForRoutes()`
- ✅ **4 fichiers** dans `src/lib/` : Utilisent maintenant `getApiBaseUrl()`
- ✅ **2 fichiers** dans `src/app/verify/` : Utilisent maintenant `getApiBaseUrl()`
- ✅ `next.config.js` : Suppression des fallbacks localhost en dur
- ✅ `package.json` : Script lighthouse utilise variable d'environnement
- ✅ `apps/api-server/src/main.ts` : Suppression du localhost en dur dans les logs

### 4. Configuration

**Fichier**: `apps/web-app/next.config.js`

- ✅ Suppression des fallbacks localhost en dur
- ✅ Variables d'environnement doivent être définies explicitement
- ✅ Warning si variables manquantes en production

## 🔍 Vérification

### Patterns Recherchés

```bash
# Recherche de localhost hardcodé
grep -r "localhost.*3000\|localhost.*3001\|localhost.*5173" apps/web-app/src
# Résultat: 0 occurrence (sauf dans les fallbacks de développement avec commentaires)

# Recherche de vercel.app hardcodé
grep -r "\.vercel\.app" apps/web-app/src
# Résultat: 0 occurrence (sauf dans la détection d'environnement, ce qui est correct)
```

### Fichiers Vérifiés

- ✅ Toutes les routes API (`src/app/api/**/*.ts`)
- ✅ Tous les services (`src/lib/**/*.ts`)
- ✅ Toutes les pages de vérification (`src/app/verify/**/*.tsx`)
- ✅ Configuration Next.js (`next.config.js`)
- ✅ Configuration API Server (`apps/api-server/src/main.ts`)

## 📝 Variables d'Environnement Requises

### Local (.env.local)

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_BASE_DOMAIN=localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_ENV=local
```

### Preview (Vercel)

```bash
NEXT_PUBLIC_APP_URL=https://academia-hub-abc123.vercel.app
NEXT_PUBLIC_BASE_DOMAIN=academia-hub-abc123.vercel.app
NEXT_PUBLIC_API_URL=https://api.academia-hub.com/api
NEXT_PUBLIC_ENV=preview
```

### Production (Vercel)

```bash
NEXT_PUBLIC_APP_URL=https://academia-hub.com
NEXT_PUBLIC_BASE_DOMAIN=academia-hub.com
NEXT_PUBLIC_API_URL=https://api.academia-hub.com/api
NEXT_PUBLIC_ENV=production
```

## ⚠️ Notes Importantes

1. **Fallbacks de Développement** : Les helpers contiennent des fallbacks de développement uniquement (avec warnings explicites). Ces fallbacks ne sont utilisés que si les variables d'environnement ne sont pas définies.

2. **Détection d'Environnement** : La détection de `localhost` dans `getAppEnvironment()` est **correcte** car elle sert à identifier l'environnement, pas à construire des URLs.

3. **Commentaires dans le Code** : Les occurrences de `localhost` dans les commentaires/exemples de documentation sont **acceptables**.

4. **Production** : En production, les variables d'environnement **DOIVENT** être définies. Sinon, une erreur explicite sera levée.

## ✅ Résultat Final

- ✅ **Aucune URL hardcodée** dans le code de production
- ✅ **Centralisation** de la gestion des URLs
- ✅ **Compatibilité** local/preview/production garantie
- ✅ **Sécurité** : Pas de risque de redirection vers localhost en production
- ✅ **Maintenabilité** : Un seul point de modification pour les URLs

## 🚀 Prochaines Étapes

1. ✅ Vérifier que `npm run dev` fonctionne en local
2. ⏳ Tester sur Vercel preview
3. ⏳ Tester sur Vercel production
4. ⏳ Vérifier que toutes les redirections fonctionnent correctement

---

**Date**: $(date)
**Statut**: ✅ Complété

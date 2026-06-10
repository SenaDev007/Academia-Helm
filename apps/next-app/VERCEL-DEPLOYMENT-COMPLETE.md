# ✅ Préparation Vercel Complète - Academia Hub Next.js

## 🎯 Statut : PRÊT POUR DÉPLOIEMENT

L'application **Next.js** (`apps/web-app/`) a été complètement préparée pour un déploiement propre sur Vercel.

---

## 📋 Clarification de l'Architecture

### ✅ `apps/web-app/` - **FRONTEND WEB (PRODUCTION)**

**Type** : Next.js 14 App Router  
**Usage** : Application Web SaaS déployée sur Vercel  
**Fichiers** : `apps/web-app/src/`  
**Base de données** : API REST uniquement (PostgreSQL via backend)

**Déploiement** : Vercel (production)

### ⚠️ `apps/desktop-app/` - **VERSION DESKTOP (MODÈLE/RÉFÉRENCE)**

**Type** : Vite + React  
**Usage** : Application Desktop Electron (modèle de référence)  
**Fichiers** : `apps/desktop-app/src/`  
**Base de données** : SQLite local + API REST

**⚠️ NOTE** : Cette application sert de **modèle de référence** pour certaines fonctionnalités, mais **N'EST PAS** l'application Web de production.

---

## 📦 Fichiers Modifiés/Créés pour Next.js (web-app)

### Configuration (3 fichiers)

1. ✅ **`vercel.json`** - Créé
   - Configuration Next.js pour Vercel
   - Headers de cache
   - Framework auto-détecté

2. ✅ **`next.config.js`** - Mis à jour
   - Variables d'environnement `NEXT_PUBLIC_*`
   - Output `standalone` pour Vercel
   - Optimisations activées

3. ✅ **`package.json`** - Vérifié
   - Script `build` : `next build` ✅
   - Pas de scripts Electron ✅
   - Pas de dépendances Electron ✅

### Code Source (3 fichiers)

4. ✅ **`src/utils/platform.ts`** - Créé
   - Détection de plateforme (Web/Desktop/Mobile)
   - Helpers pour logique conditionnelle
   - Compatible Next.js

5. ✅ **`src/utils/electron-compat.ts`** - Créé
   - Wrapper Electron → HTTP
   - Compatibilité Web uniquement (Next.js)
   - Toutes les méthodes utilisent HTTP

6. ✅ **`src/lib/offline/local-db.service.ts`** - Mis à jour
   - SQLite désactivé pour Next.js
   - IndexedDB uniquement (côté client)
   - Commentaires clarifiés

### Variables d'Environnement (2 fichiers)

7. ✅ **`.env.example`** - Créé
8. ✅ **`.env.production`** - Créé

---

## 🔐 Variables d'Environnement (Vercel)

### Obligatoires

```bash
NEXT_PUBLIC_PLATFORM=web
NEXT_PUBLIC_API_URL=https://api.academiahub.com
NEXT_PUBLIC_APP_URL=https://app.academiahub.com
NEXT_PUBLIC_ENV=production
```

### Optionnelles (Côté Serveur)

```bash
API_URL=https://api.academiahub.com
NODE_ENV=production
```

**Note** : Les variables `NEXT_PUBLIC_*` sont automatiquement exposées côté client dans Next.js.

---

## 🚫 Points Désactivés Côté Web (Next.js)

### Electron / Desktop

- ❌ **SQLite** → Désactivé (Next.js = Web uniquement)
- ❌ **Electron API direct** → Remplacé par wrapper HTTP
- ❌ **better-sqlite3** → Non utilisé
- ❌ **Accès filesystem** → Désactivé
- ❌ **IPC** → Désactivé
- ❌ **Preload scripts** → Désactivés

### Logique Conditionnelle

Toute logique conditionnelle utilise maintenant :

```typescript
import { isWeb, isDesktop, onWeb, onDesktop } from '@/utils/platform';

// Next.js = toujours Web
if (isWeb()) {
  // Utilise API HTTP
  const response = await apiClient.get('/data');
}
```

---

## 🚀 Instructions Exactes pour Déployer sur Vercel

### Méthode 1 : Vercel Dashboard (Recommandé)

1. **Aller sur [vercel.com](https://vercel.com)**
2. **Cliquer sur "New Project"**
3. **Importer le repository GitHub** (ou GitLab/Bitbucket)
4. **Configurer le projet** :
   - **Framework Preset** : `Next.js` (auto-détecté)
   - **Root Directory** : `apps/web-app` ⚠️ **IMPORTANT**
   - **Build Command** : `npm run build` (auto-détecté)
   - **Output Directory** : `.next` (auto-détecté)
   - **Install Command** : `npm install` (auto-détecté)
5. **Ajouter les variables d'environnement** :
   - `NEXT_PUBLIC_PLATFORM` = `web`
   - `NEXT_PUBLIC_API_URL` = `https://api.academiahub.com`
   - `NEXT_PUBLIC_APP_URL` = `https://app.academiahub.com`
   - `NEXT_PUBLIC_ENV` = `production`
6. **Cliquer sur "Deploy"**

### Méthode 2 : Vercel CLI

```bash
# 1. Installer Vercel CLI globalement
npm i -g vercel

# 2. Se connecter
vercel login

# 3. Aller dans le dossier web-app
cd apps/web-app

# 4. Déployer (preview)
vercel

# 5. Déployer en production
vercel --prod
```

### Méthode 3 : GitHub Integration (Automatique)

1. **Connecter le repository** sur Vercel
2. **Vercel détecte automatiquement** :
   - Framework : Next.js
   - Build command : `npm run build`
   - Output directory : `.next`
3. **Configurer manuellement** :
   - **Root Directory** : `apps/web-app` ⚠️ **CRITIQUE**
   - Variables d'environnement (voir ci-dessus)
4. **Push sur `main`** → Déploiement automatique

---

## ✅ Vérifications Finales

### Build Local

```bash
cd apps/web-app
npm install
npm run build
```

**Résultat attendu** :
- ✅ Pas d'erreurs TypeScript
- ✅ Dossier `.next/` créé
- ✅ Pas de références Electron
- ✅ Pas de dépendances Node incompatibles

### Preview Local

```bash
npm run start
# ou
npm run dev
```

**Vérifier** :
- ✅ Application accessible sur `http://localhost:3001`
- ✅ Routes fonctionnent (`/`, `/app-test`, etc.)
- ✅ Pas d'erreurs console liées à Electron
- ✅ API calls fonctionnent (si backend disponible)

### Déploiement Vercel

**Vérifier** :
- ✅ Build réussit sur Vercel
- ✅ Application accessible sur l'URL Vercel
- ✅ Routes fonctionnent (Next.js App Router)
- ✅ Variables d'environnement configurées
- ✅ API calls pointent vers la bonne URL
- ✅ Pas d'erreurs console

---

## 📋 Checklist Complète

### Avant Déploiement

- [x] ✅ `vercel.json` créé et configuré
- [x] ✅ `next.config.js` optimisé pour Vercel
- [x] ✅ Variables d'environnement migrées (`NEXT_PUBLIC_*`)
- [x] ✅ SQLite désactivé
- [x] ✅ Wrapper Electron créé (`electron-compat.ts`)
- [x] ✅ Détection de plateforme implémentée (`platform.ts`)
- [x] ✅ `local-db.service.ts` nettoyé (IndexedDB uniquement)
- [x] ✅ Pas de références Electron directes
- [x] ✅ Documentation complète créée

### Configuration Vercel

- [ ] Variables d'environnement ajoutées dans Vercel Dashboard
- [ ] **Root Directory configuré** : `apps/web-app` ⚠️ **CRITIQUE**
- [ ] Build Command configuré : `npm run build` (auto)
- [ ] Output Directory configuré : `.next` (auto)
- [ ] Framework Preset configuré : `Next.js` (auto)

### Post-Déploiement

- [ ] Application accessible sur l'URL Vercel
- [ ] Routes fonctionnent (Next.js App Router)
- [ ] API calls fonctionnent
- [ ] Pas d'erreurs console
- [ ] Performance acceptable

---

## 🐛 Dépannage

### Build échoue sur Vercel

**Solutions** :
1. Vérifier que **Root Directory** = `apps/web-app` ⚠️
2. Vérifier que toutes les variables `NEXT_PUBLIC_*` sont configurées
3. Vérifier que `package.json` contient toutes les dépendances
4. Vérifier qu'il n'y a plus de références à Electron

### Routes ne fonctionnent pas (404)

**Solutions** :
1. Vérifier que `vercel.json` est présent
2. Vérifier que Next.js App Router est utilisé correctement
3. Vérifier que les fichiers sont dans `src/app/`

### API calls échouent

**Solutions** :
1. Vérifier que `NEXT_PUBLIC_API_URL` est configuré correctement
2. Vérifier que CORS est configuré côté backend
3. Vérifier que les headers d'authentification sont présents

---

## 📚 Documentation Complémentaire

- **`VERCEL-PREPARATION.md`** - Guide détaillé
- **`README-STRUCTURE.md`** - Clarification architecture
- **`apps/README-STRUCTURE.md`** - Structure complète

---

## 🎯 Résumé

### ✅ Réalisé

- Configuration Vercel complète pour Next.js
- Nettoyage code Electron
- Migration variables d'environnement (`NEXT_PUBLIC_*`)
- Wrapper de compatibilité Electron → HTTP
- Documentation complète

### 🚀 Prêt pour

- Déploiement Vercel immédiat
- Production stable
- Évolution vers architecture SaaS

---

## ⚠️ Points Critiques

1. **Root Directory** : Toujours configurer `apps/web-app` dans Vercel
2. **Variables d'environnement** : Utiliser `NEXT_PUBLIC_*` pour le client
3. **Pas d'Electron** : Next.js = Web uniquement
4. **IndexedDB uniquement** : Pas de SQLite en Next.js

---

**Application Next.js prête pour Vercel** ✅  
**Configuration complète** ✅  
**Code nettoyé et optimisé** ✅  
**Documentation complète** ✅


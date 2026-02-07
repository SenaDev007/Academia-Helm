# 📱 Stratégie PWA - Application Web Installable (Offline)

**Date** : 2025-01-17  
**Version** : 1.0.0

---

## 🎯 Décision Stratégique

**✅ Application Web PWA (Progressive Web App)**  
**✅ Application Mobile (Native ou PWA)**  
**❌ Application Desktop (Plus nécessaire)**

---

## 🎯 Pourquoi PWA au lieu de Desktop ?

### ✅ Avantages de la PWA

1. **Installation Simple**
   - Un seul clic pour installer depuis le navigateur
   - Pas besoin de télécharger un installateur
   - Mise à jour automatique

2. **Multi-Plateforme**
   - Fonctionne sur Windows, Mac, Linux, Android, iOS
   - Une seule base de code
   - Maintenance simplifiée

3. **Mode Offline Complet**
   - IndexedDB pour le stockage local
   - Service Worker pour le cache
   - Synchronisation automatique

4. **Performance**
   - Chargement rapide
   - Cache intelligent
   - Expérience native

5. **Pas de Compilation Native**
   - Pas besoin de Visual Studio Build Tools
   - Pas de better-sqlite3 à compiler
   - Déploiement simplifié

---

## 📋 Configuration PWA Actuelle

### ✅ Déjà Configuré

1. **Manifest.json** ✅
   - Fichier : `apps/web-app/public/manifest.json`
   - Configuration : `display: "standalone"`
   - Icônes : Configurées

2. **Metadata Next.js** ✅
   - Fichier : `apps/web-app/src/app/layout.tsx`
   - Manifest : Référencé
   - Icônes : Configurées

3. **Détection PWA** ✅
   - Fichier : `apps/web-app/src/components/loading/LoadingScreenMobile.tsx`
   - Détection automatique de l'installation

### ⚠️ À Ajouter

1. **Service Worker** (Pour le cache offline)
2. **Installation Prompt** (Invitation à installer)
3. **Offline Page** (Page affichée hors ligne)

---

## 🔧 Configuration PWA Complète

### 1. Service Worker (Cache Offline)

**Option A : Next.js avec next-pwa** (Recommandé)

```bash
cd apps/web-app
npm install next-pwa
```

**Configuration** : `apps/web-app/next.config.js`

```javascript
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development', // Désactiver en dev
});

module.exports = withPWA({
  // ... votre config existante
});
```

**Option B : Service Worker Manuel**

Créer `apps/web-app/public/sw.js` :

```javascript
// Service Worker pour cache offline
const CACHE_NAME = 'academia-hub-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/images/logo-Academia Hub.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});
```

### 2. Installation Prompt

**Composant** : `apps/web-app/src/components/pwa/InstallPrompt.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    
    setDeferredPrompt(null);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg z-50">
      <p className="mb-2">Installez Academia Hub pour une meilleure expérience offline</p>
      <button
        onClick={handleInstall}
        className="bg-white text-blue-600 px-4 py-2 rounded font-semibold"
      >
        Installer
      </button>
    </div>
  );
}
```

### 3. Offline Page

**Page** : `apps/web-app/src/app/offline/page.tsx`

```typescript
export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Mode Hors Ligne</h1>
        <p>Vous êtes actuellement hors ligne.</p>
        <p>L'application fonctionne en mode offline avec IndexedDB.</p>
      </div>
    </div>
  );
}
```

---

## 📱 Configuration Mobile

### Application Mobile Native vs PWA

**Option 1 : PWA Mobile** (Recommandé pour commencer)

- ✅ Une seule base de code (Web + Mobile)
- ✅ Pas besoin de développer une app native
- ✅ Installation depuis le navigateur mobile
- ✅ Mise à jour automatique

**Option 2 : Application Native** (Si nécessaire plus tard)

- React Native
- Expo
- Capacitor (wrapper PWA)

---

## 🗂️ Structure Recommandée

```
apps/
├── api-server/          # Backend NestJS (Production)
├── web-app/            # Frontend Next.js PWA (Web + Mobile)
│   ├── public/
│   │   ├── manifest.json      ✅ Déjà configuré
│   │   └── sw.js              ⚠️ À ajouter (Service Worker)
│   ├── src/
│   │   ├── app/
│   │   │   └── offline/       ⚠️ À ajouter (Page offline)
│   │   └── components/
│   │       └── pwa/            ⚠️ À ajouter (Install prompt)
│   └── next.config.js          ⚠️ À configurer (PWA)
│
└── mobile-app/         # Documentation uniquement (ou future app native)
    └── docs/
```

---

## ✅ Checklist PWA

### Configuration de Base

- [x] `manifest.json` créé et configuré
- [x] Metadata Next.js configurée
- [x] Icônes PWA configurées
- [ ] Service Worker configuré
- [ ] Installation prompt implémenté
- [ ] Page offline créée

### Fonctionnalités Offline

- [x] IndexedDB configuré (`local-db.service.ts`)
- [x] Outbox Pattern implémenté
- [x] Synchronisation automatique
- [ ] Cache des assets (Service Worker)
- [ ] Cache des pages (Service Worker)

### Tests

- [ ] Test d'installation sur Chrome
- [ ] Test d'installation sur Edge
- [ ] Test d'installation sur Safari (iOS)
- [ ] Test mode offline complet
- [ ] Test synchronisation

---

## 🚀 Avantages de cette Approche

### Pour les Utilisateurs

- ✅ Installation en un clic
- ✅ Fonctionne offline
- ✅ Mise à jour automatique
- ✅ Pas besoin de télécharger un installateur
- ✅ Fonctionne sur tous les appareils

### Pour le Développement

- ✅ Une seule base de code (Web + Mobile)
- ✅ Pas de compilation native
- ✅ Déploiement simplifié
- ✅ Maintenance facilitée
- ✅ Pas besoin de better-sqlite3

---

## 📝 Migration depuis Desktop

### Ce qui Change

1. **Base de données locale** :
   - ❌ SQLite (better-sqlite3) → ✅ IndexedDB (déjà implémenté)

2. **Installation** :
   - ❌ Installateur .exe/.dmg → ✅ Installation depuis navigateur

3. **Mise à jour** :
   - ❌ Télécharger nouvelle version → ✅ Mise à jour automatique

4. **Déploiement** :
   - ❌ Build Electron → ✅ Build Next.js (déjà fait)

### Ce qui Reste Identique

- ✅ Architecture offline-first
- ✅ Synchronisation automatique
- ✅ Outbox Pattern
- ✅ Gestion des conflits
- ✅ Toutes les fonctionnalités métier

---

## 🎯 Prochaines Étapes

### Priorité 1 : Service Worker

1. Installer `next-pwa` ou créer un service worker manuel
2. Configurer le cache des assets
3. Tester le mode offline

### Priorité 2 : Installation Prompt

1. Créer le composant d'invitation à installer
2. Intégrer dans le layout
3. Tester sur différents navigateurs

### Priorité 3 : Optimisations

1. Cache des pages fréquemment visitées
2. Préchargement des données critiques
3. Optimisation de la taille du bundle

---

## 📚 Documentation

- **PWA Next.js** : https://nextjs.org/docs/app/building-your-application/routing/progressive-web-apps
- **Service Workers** : https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
- **IndexedDB** : https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API

---

## ✅ Conclusion

**Votre décision est excellente** :

- ✅ PWA = Installation simple + Mode offline complet
- ✅ IndexedDB = Pas besoin de better-sqlite3
- ✅ Une seule base de code pour Web + Mobile
- ✅ Maintenance simplifiée

**L'application Desktop n'est plus nécessaire** car la PWA offre les mêmes fonctionnalités avec une meilleure expérience utilisateur.

---

**Dernière mise à jour** : 2025-01-17

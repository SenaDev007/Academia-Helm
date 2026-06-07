# 🎯 Système de Loading Professionnel - Academia Hub

**Date** : Implémentation complète  
**Statut** : ✅ **Système de loading professionnel implémenté**

---

## 📋 Vue d'Ensemble

Système de loading centralisé, professionnel et cohérent pour Academia Hub, couvrant :
- ✅ Flow post-login strict en 6 étapes
- ✅ Loading global plein écran
- ✅ Loading par module
- ✅ Skeleton loaders (tables, cards, dashboards)
- ✅ Intégration ORION dans le loading
- ✅ Messages professionnels centralisés

---

## 🏗️ Architecture

### Structure des Fichiers

```
apps/web-app/src/
├── lib/loading/
│   ├── loading-messages.ts          # Messages centralisés
│   └── post-login-flow.service.ts    # Service flow post-login
├── components/loading/
│   ├── LoadingScreen.tsx            # Composant loading global
│   ├── PostLoginLoading.tsx         # Loading post-login
│   ├── PostLoginFlowWrapper.tsx     # Wrapper flow post-login
│   ├── ModuleLoading.tsx            # Loading transitions modules
│   ├── Skeleton.tsx                 # Composants skeleton
│   ├── OrionLoadingIndicator.tsx    # Indicateur ORION
│   └── OrionAlertsBanner.tsx       # Bannière alertes ORION
└── hooks/
    └── usePostLoginFlow.ts          # Hook flow post-login
```

---

## 🔄 Flow Post-Login (Ordre Strict)

### Étapes d'Initialisation

Le flow post-login s'exécute dans **cet ordre exact** :

#### 1️⃣ Initialisation Contexte Sécurisé
- Vérifier le tenant (école)
- Charger le `tenant_id`
- Charger le sous-domaine
- Vérifier l'état du compte (actif / suspendu)

**Message** : "Initialisation de votre environnement sécurisé…"  
**Durée minimale** : 300ms

---

#### 2️⃣ Vérification Année Scolaire
- Charger l'année scolaire active
- Vérifier les dates (début / fin)
- Bloquer si aucune année active

**Message** : "Vérification de l'année scolaire active…"  
**Durée minimale** : 200ms

---

#### 3️⃣ Chargement Rôles & Permissions
- Récupérer le rôle utilisateur
- Appliquer le RBAC
- Préparer les menus autorisés

**Message** : "Chargement des rôles et permissions…"  
**Durée minimale** : 200ms

---

#### 4️⃣ Vérification Offline-First
- Vérifier disponibilité SQLite
- Vérifier opérations en attente
- Déterminer le mode : ONLINE / OFFLINE / SYNC_REQUIRED

**Message** : "Vérification du mode hors connexion…"  
**Durée minimale** : 300ms

---

#### 5️⃣ Initialisation ORION (Direction Uniquement)
- Déclencher l'analyse ORION
- Charger les alertes critiques
- Préparer le résumé de pilotage

**Message** : "Préparation du tableau de pilotage…"  
**Durée minimale** : 500ms  
**Rôles** : `DIRECTOR`, `SUPER_DIRECTOR`, `ADMIN` uniquement

---

#### 6️⃣ Préchargement UI
- Précharger layout principal
- Préparer les composants clés
- Initialiser les skeleton loaders

**Message** : "Finalisation de l'interface…"  
**Durée minimale** : 200ms

---

## 📦 Composants

### LoadingScreen

Composant de chargement global plein écran.

```tsx
import { LoadingScreen } from '@/components/loading/LoadingScreen';

<LoadingScreen
  message={{ title: 'Chargement…', subtitle: 'Veuillez patienter' }}
  progress={75}
  showProgress={true}
  variant="default"
/>
```

**Variants** :
- `default` : Fond blanc
- `minimal` : Fond gris clair
- `orion` : Dégradé bleu (pour ORION)

---

### PostLoginLoading

Composant qui orchestre automatiquement le flow post-login.

```tsx
import { PostLoginLoading } from '@/components/loading/PostLoginLoading';

<PostLoginLoading
  onComplete={(result) => {
    // Rediriger vers le dashboard
  }}
  onError={(error) => {
    // Gérer l'erreur
  }}
/>
```

---

### Skeleton Components

Composants skeleton pour remplacer le contenu pendant le chargement.

```tsx
import {
  TableSkeleton,
  CardSkeleton,
  DashboardSkeleton,
  ListSkeleton,
  FormSkeleton,
} from '@/components/loading/Skeleton';

// Table
<TableSkeleton rows={5} columns={4} />

// Cartes KPI
<CardSkeleton count={4} />

// Dashboard complet
<DashboardSkeleton />

// Liste
<ListSkeleton items={5} />

// Formulaire
<FormSkeleton fields={5} />
```

**Règle** : Le squelette remplace le contenu, jamais un spinner seul.

---

### ModuleLoading

Composant de chargement pour les transitions de modules.

```tsx
import { ModuleLoading } from '@/components/loading/ModuleLoading';

<ModuleLoading moduleName="finance" />
```

**Modules supportés** :
- `finance` : "Chargement des données financières…"
- `examens` : "Préparation des évaluations et résultats…"
- `pedagogie` : "Chargement de l'espace pédagogique…"
- `orion` : "Analyse des indicateurs clés…"
- `eleves` : "Chargement des données élèves…"
- `paiements` : "Chargement des données de paiement…"

---

### OrionLoadingIndicator

Indicateur de chargement ORION avec messages contextuels.

```tsx
import { OrionLoadingIndicator } from '@/components/loading/OrionLoadingIndicator';

<OrionLoadingIndicator
  isActive={true}
  alertsCount={3}
/>
```

---

### OrionAlertsBanner

Bannière pour afficher les alertes ORION critiques après le chargement.

```tsx
import { OrionAlertsBanner } from '@/components/loading/OrionAlertsBanner';

<OrionAlertsBanner
  alerts={orionAlerts}
  onDismiss={(id) => acknowledgeAlert(id)}
/>
```

---

## 🎣 Hooks

### usePostLoginFlow

Hook pour orchestrer le flow post-login avec gestion d'état.

```tsx
import { usePostLoginFlow } from '@/hooks/usePostLoginFlow';

function MyComponent() {
  const { isLoading, progress, result, error, execute } = usePostLoginFlow();

  useEffect(() => {
    execute();
  }, [execute]);

  if (isLoading) {
    return (
      <LoadingScreen
        message={progress?.message}
        progress={progress?.progress}
      />
    );
  }

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  return <Dashboard data={result} />;
}
```

---

## 📝 Messages Centralisés

Tous les messages sont centralisés dans `loading-messages.ts`.

### Messages Post-Login

```typescript
import { POST_LOGIN_MESSAGES } from '@/lib/loading/loading-messages';

const message = POST_LOGIN_MESSAGES.INIT_SECURE_CONTEXT;
// { title: 'Initialisation...', subtitle: '...', duration: 300 }
```

### Messages par Module

```typescript
import { getModuleMessage } from '@/lib/loading/loading-messages';

const message = getModuleMessage('finance');
// { title: 'Chargement des données financières...', ... }
```

---

## 🔌 Intégration

### Layout Principal

Le flow post-login est intégré automatiquement dans `app/app/layout.tsx` via `AppLayoutClient`.

```tsx
// app/app/layout.tsx
<AppLayoutClient user={user} tenant={tenant}>
  <PilotageLayout>
    {children}
  </PilotageLayout>
</AppLayoutClient>
```

### Dashboard

Les alertes ORION peuvent être affichées dans le dashboard :

```tsx
import { OrionAlertsBanner } from '@/components/loading/OrionAlertsBanner';

function DirectorDashboard() {
  const [orionAlerts, setOrionAlerts] = useState([]);

  useEffect(() => {
    // Écouter les alertes du flow post-login
    window.addEventListener('post-login-complete', (event: any) => {
      setOrionAlerts(event.detail.orionAlerts);
    });
  }, []);

  return (
    <div>
      <OrionAlertsBanner alerts={orionAlerts} />
      {/* Reste du dashboard */}
    </div>
  );
}
```

---

## ⚙️ Configuration

### Durées Minimales

Les durées minimales garantissent une expérience fluide :

| Étape | Durée Minimale |
|-------|----------------|
| INIT_SECURE_CONTEXT | 300ms |
| VERIFY_ACADEMIC_YEAR | 200ms |
| LOAD_ROLES_PERMISSIONS | 200ms |
| CHECK_OFFLINE_STATUS | 300ms |
| INIT_ORION | 500ms |
| PRELOAD_UI | 200ms |

**Total minimum** : ~1.7s

### Timeout

Si le flow prend plus de **10 secondes**, un message d'erreur est affiché.

---

## 🎨 Design

### LoadingScreen

- **Fond** : Blanc (default), Gris clair (minimal), Dégradé bleu (orion)
- **Logo** : Cercle animé avec initiales "AH"
- **Animation** : Pulse sur le logo, barre de progression fluide
- **Messages** : Titre + sous-titre optionnel

### Skeleton

- **Couleur** : `bg-gray-200`
- **Animation** : `animate-pulse`
- **Formes** : Rectangles arrondis (`rounded-md`)

---

## ✅ Checklist d'Implémentation

- [x] Service flow post-login avec 6 étapes
- [x] Composant LoadingScreen global
- [x] Composants Skeleton (table, card, dashboard, list, form)
- [x] Composant ModuleLoading
- [x] Messages centralisés
- [x] Hook usePostLoginFlow
- [x] Intégration ORION dans le loading
- [x] Bannière alertes ORION
- [x] Intégration dans le layout principal
- [x] Gestion des erreurs

---

## 🚀 Utilisation

### Exemple Complet

```tsx
'use client';

import { useEffect, useState } from 'react';
import { usePostLoginFlow } from '@/hooks/usePostLoginFlow';
import { LoadingScreen } from '@/components/loading/LoadingScreen';
import { DashboardSkeleton } from '@/components/loading/Skeleton';
import { OrionAlertsBanner } from '@/components/loading/OrionAlertsBanner';

export default function DashboardPage() {
  const { isLoading, progress, result, execute } = usePostLoginFlow();
  const [orionAlerts, setOrionAlerts] = useState([]);

  useEffect(() => {
    execute();
  }, [execute]);

  useEffect(() => {
    if (result?.orionAlerts) {
      setOrionAlerts(result.orionAlerts);
    }
  }, [result]);

  if (isLoading) {
    return (
      <LoadingScreen
        message={progress ? {
          title: progress.message,
          subtitle: progress.subtitle,
        } : undefined}
        progress={progress?.progress}
      />
    );
  }

  if (!result) {
    return <DashboardSkeleton />;
  }

  return (
    <div>
      <OrionAlertsBanner alerts={orionAlerts} />
      {/* Contenu du dashboard */}
    </div>
  );
}
```

---

**Le système de loading professionnel est maintenant opérationnel !** ✅

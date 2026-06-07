# Installation - Academia Hub Next.js App

## 🚀 Démarrage Rapide

### 1. Installation des dépendances

```bash
cd apps/web-app
npm install
```

### 2. Configuration de l'environnement

Créer un fichier `.env.local` :

```env
# API Backend
API_URL=http://localhost:3000/api
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

### 3. Démarrage en développement

```bash
npm run dev
```

L'application sera accessible sur `http://localhost:3001`

## 🧪 Test Multi-Tenant en Local

### Option 1 : Utiliser le header X-Tenant-Subdomain

En développement, le middleware accepte le header `X-Tenant-Subdomain` pour simuler un sous-domaine.

### Option 2 : Modifier /etc/hosts (macOS/Linux)

```bash
sudo nano /etc/hosts
```

Ajouter :
```
127.0.0.1 ecole1.localhost
127.0.0.1 ecole2.localhost
```

Puis accéder à `http://ecole1.localhost:3001/app`

### Option 3 : Utiliser un proxy local

Configurer un proxy local pour rediriger les sous-domaines vers localhost:3001.

## 📝 Scripts Disponibles

- `npm run dev` : Développement
- `npm run build` : Build production
- `npm run start` : Démarrer en production
- `npm run lint` : Linter le code
- `npm run type-check` : Vérifier les types TypeScript

## 🔧 Configuration

### TypeScript Strict

Le projet utilise TypeScript en mode strict :
- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noImplicitReturns: true`

### Tailwind CSS

Configuration dans `tailwind.config.js` avec les couleurs du design system Academia Hub.

## 🐛 Dépannage

### Erreur "Module not found"

Vérifier que toutes les dépendances sont installées :
```bash
npm install
```

### Erreur de connexion API

Vérifier que l'API backend est démarrée et accessible sur `http://localhost:3000/api`

### Problème de sous-domaine en local

Utiliser le header `X-Tenant-Subdomain` ou modifier `/etc/hosts` comme indiqué ci-dessus.


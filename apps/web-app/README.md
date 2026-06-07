# Academia Hub - Next.js App

Application Next.js App Router pour Academia Hub SaaS multi-tenant.

## 🏗️ Architecture

### Structure du Projet

```
apps/web-app/
├── src/
│   ├── app/                    # App Router (Next.js 14+)
│   │   ├── layout.tsx         # Layout racine
│   │   ├── page.tsx           # Page d'accueil (landing)
│   │   ├── (public)/          # Routes publiques
│   │   │   ├── plateforme/
│   │   │   ├── modules/
│   │   │   ├── tarification/
│   │   │   ├── securite/
│   │   │   ├── contact/
│   │   │   └── signup/
│   │   ├── (auth)/            # Routes d'authentification
│   │   │   ├── login/
│   │   │   └── forgot-password/
│   │   └── app/               # Routes protégées (dashboard)
│   │       ├── layout.tsx     # Layout dashboard
│   │       ├── page.tsx       # Dashboard principal
│   │       └── [module]/      # Modules métier
│   │
│   ├── components/            # Composants React
│   │   ├── public/           # Composants pages publiques
│   │   ├── auth/             # Composants authentification
│   │   ├── dashboard/        # Composants dashboard
│   │   └── layout/           # Composants layout
│   │
│   ├── lib/                   # Bibliothèques utilitaires
│   │   ├── tenant/           # Résolution multi-tenant
│   │   ├── auth/             # Gestion sessions
│   │   └── api/              # Client API
│   │
│   ├── services/             # Services métier
│   │   ├── auth.service.ts
│   │   └── tenant.service.ts
│   │
│   ├── hooks/                 # React Hooks
│   │   ├── useAuth.ts
│   │   └── useTenant.ts
│   │
│   ├── types/                 # Types TypeScript
│   │   └── index.ts
│   │
│   └── middleware.ts          # Next.js Middleware (multi-tenant)
│
├── public/                    # Assets statiques
├── next.config.js            # Configuration Next.js
├── tsconfig.json             # Configuration TypeScript
└── package.json
```

## 🔐 Multi-Tenant par Sous-Domaine

### Fonctionnement

1. **Résolution du Tenant** :
   - Le middleware extrait le sous-domaine depuis `host` header
   - Ex: `ecole1.academiahub.com` → subdomain = `ecole1`
   - Le tenant est résolu via l'API backend

2. **Routes Protégées** :
   - `/app/*` : Nécessite un tenant valide
   - Si pas de tenant → redirection vers `/tenant-not-found`
   - Si tenant inactif → redirection vers `/tenant-not-found`

3. **Routes Publiques** :
   - Accessibles uniquement sur le domaine principal
   - Si sous-domaine → redirection vers domaine principal

### Développement Local

Pour tester avec un sous-domaine en local :

```bash
# Option 1: Utiliser le header X-Tenant-Subdomain
# (configuré automatiquement par le middleware)

# Option 2: Modifier /etc/hosts
127.0.0.1 ecole1.localhost
127.0.0.1 ecole2.localhost

# Puis accéder à http://ecole1.localhost:3001/app
```

## 🔒 Authentification

### Flow d'Authentification

1. **Login** :
   - POST `/api/auth/login` avec email/password
   - Retourne : user, tenant, token, expiresAt
   - Token stocké dans cookie httpOnly

2. **Session** :
   - Session stockée dans cookie `academia_session`
   - Token JWT dans cookie `academia_token`
   - Vérification automatique dans middleware

3. **Protection des Routes** :
   - Routes `/app/*` : nécessitent authentification
   - Redirection automatique vers `/login` si non authentifié

## 🚀 Démarrage

### Installation

```bash
cd apps/web-app
npm install
```

### Développement

```bash
npm run dev
```

L'application sera accessible sur `http://localhost:3001`

### Build Production

```bash
npm run build
npm start
```

## 📝 Variables d'Environnement

Créer un fichier `.env.local` :

```env
# API Backend
API_URL=http://localhost:3000/api
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3001

# Production
# NEXT_PUBLIC_APP_URL=https://academiahub.com
```

## 🛡️ Sécurité

- ✅ Cookies httpOnly pour les tokens
- ✅ HTTPS en production
- ✅ Validation TypeScript strict
- ✅ Protection CSRF
- ✅ Isolation multi-tenant stricte

## 📚 Documentation

- [Next.js App Router](https://nextjs.org/docs/app)
- [TypeScript Strict Mode](https://www.typescriptlang.org/tsconfig#strict)
- [Multi-Tenant Architecture](./docs/MULTI-TENANT.md)


# Architecture Next.js - Academia Hub

## 🏗️ Vue d'ensemble

Application Next.js App Router pour Academia Hub SaaS multi-tenant.

## 📁 Structure du Projet

```
apps/web-app/
├── src/
│   ├── app/                      # App Router (Next.js 14+)
│   │   ├── layout.tsx           # Layout racine
│   │   ├── page.tsx             # Page d'accueil
│   │   ├── (public)/            # Routes publiques (group)
│   │   │   ├── layout.tsx       # Layout pages publiques
│   │   │   ├── plateforme/
│   │   │   ├── modules/
│   │   │   ├── tarification/
│   │   │   ├── securite/
│   │   │   ├── contact/
│   │   │   └── signup/
│   │   ├── (auth)/              # Routes authentification (group)
│   │   │   ├── layout.tsx       # Layout auth
│   │   │   └── login/
│   │   ├── app/                 # Routes protégées (dashboard)
│   │   │   ├── layout.tsx       # Layout dashboard (avec auth check)
│   │   │   ├── page.tsx         # Dashboard principal
│   │   │   └── [module]/        # Modules métier
│   │   ├── api/                 # API Routes
│   │   │   └── auth/
│   │   │       ├── login/
│   │   │       └── logout/
│   │   └── tenant-not-found/    # Page erreur tenant
│   │
│   ├── components/              # Composants React
│   │   ├── public/             # Composants pages publiques
│   │   ├── auth/               # Composants authentification
│   │   ├── dashboard/          # Composants dashboard
│   │   └── layout/             # Composants layout
│   │
│   ├── lib/                    # Bibliothèques utilitaires
│   │   ├── tenant/             # Résolution multi-tenant
│   │   │   └── resolver.ts
│   │   ├── auth/               # Gestion sessions
│   │   │   └── session.ts
│   │   └── api/                # Client API
│   │       └── client.ts
│   │
│   ├── services/               # Services métier
│   │   ├── auth.service.ts
│   │   └── tenant.service.ts
│   │
│   ├── hooks/                  # React Hooks
│   │   ├── useAuth.ts
│   │   └── useTenant.ts
│   │
│   ├── types/                  # Types TypeScript
│   │   └── index.ts
│   │
│   └── middleware.ts           # Next.js Middleware
│
├── public/                     # Assets statiques
├── next.config.js             # Configuration Next.js
├── tsconfig.json              # Configuration TypeScript
└── package.json
```

## 🔐 Multi-Tenant par Sous-Domaine

### Fonctionnement

1. **Middleware** (`src/middleware.ts`) :
   - Intercepte toutes les requêtes
   - Extrait le sous-domaine depuis `host` header
   - Résout le tenant via l'API backend
   - Ajoute `X-Tenant-ID` dans les headers

2. **Résolution Tenant** (`src/lib/tenant/resolver.ts`) :
   - `extractSubdomain()` : Extrait le sous-domaine
   - `resolveTenant()` : Résout le tenant depuis l'API
   - `isMainDomain()` : Vérifie si on est sur le domaine principal

3. **Protection Routes** :
   - Routes `/app/*` : Nécessitent tenant valide + authentification
   - Routes publiques : Accessibles uniquement sur domaine principal

### Exemples

- `academiahub.com` → Domaine principal (landing, pricing)
- `ecole1.academiahub.com` → Tenant "ecole1"
- `ecole2.academiahub.com` → Tenant "ecole2"

## 🔒 Authentification

### Flow

1. **Login** :
   - POST `/api/auth/login` avec email/password
   - Retourne : user, tenant, token
   - Token stocké dans cookie httpOnly

2. **Session** :
   - Stockée dans cookie `academia_session` (httpOnly)
   - Token JWT dans cookie `academia_token` (httpOnly)
   - Vérification automatique dans layouts

3. **Protection** :
   - Layout `/app` vérifie l'authentification
   - Redirection automatique vers `/login` si non authentifié

### Services

- `src/services/auth.service.ts` : Login, logout, checkAuth
- `src/lib/auth/session.ts` : Gestion cookies (server/client)

## 🛡️ Sécurité

### Mesures Implémentées

1. **Cookies httpOnly** : Tokens non accessibles depuis JavaScript
2. **HTTPS en production** : Cookies sécurisés
3. **Validation TypeScript strict** : Types stricts partout
4. **Isolation multi-tenant** : Vérification à chaque requête
5. **Middleware protection** : Vérification tenant avant rendu

### Headers Sécurité

Configurés dans `next.config.js` :
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`

## 📝 Conventions

### Naming

- **Components** : PascalCase (`DashboardPage.tsx`)
- **Hooks** : camelCase avec `use` (`useAuth.ts`)
- **Services** : camelCase avec `.service.ts` (`auth.service.ts`)
- **Types** : PascalCase (`User`, `Tenant`)

### File Structure

- **Pages** : Dans `src/app/`
- **Components** : Dans `src/components/`
- **Services** : Dans `src/services/`
- **Hooks** : Dans `src/hooks/`
- **Types** : Dans `src/types/`

## 🚀 Développement

### Commandes

```bash
# Développement
npm run dev

# Build production
npm run build

# Type checking
npm run type-check

# Lint
npm run lint
```

### Variables d'Environnement

Créer `.env.local` :

```env
API_URL=http://localhost:3000/api
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

### Test Multi-Tenant Local

1. Modifier `/etc/hosts` :
```
127.0.0.1 ecole1.localhost
127.0.0.1 ecole2.localhost
```

2. Accéder à `http://ecole1.localhost:3001/app`

Ou utiliser le header `X-Tenant-Subdomain` en développement.

## 📚 Documentation Complémentaire

- [Next.js App Router](https://nextjs.org/docs/app)
- [TypeScript Strict](https://www.typescriptlang.org/tsconfig#strict)
- [Multi-Tenant Patterns](./docs/MULTI-TENANT.md)


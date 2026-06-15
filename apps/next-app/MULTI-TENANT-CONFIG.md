# 🏢 Configuration Multi-Tenant - Academia Hub

## ✅ Statut : Configuration Complète

Ce document décrit la configuration complète du système multi-tenant d'Academia Hub.

---

## 📋 1. Architecture Multi-Tenant

### Structure

```
┌─────────────────────────────────────────┐
│  Portail Central (academiahelm.com)    │
│  - Sélection de l'école                │
│  - Redirection vers sous-domaine       │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Sous-domaine (school.academiahelm.com) │
│  - Application principale               │
│  - Isolation par tenant                │
└─────────────────────────────────────────┘
```

### Flux d'Accès

1. **Utilisateur accède au portail** : `/portal`
2. **Sélection du portail** : École, Enseignant, Parent
3. **Recherche de l'établissement** : Autocomplete avec logo
4. **Redirection automatique** : Vers `{school-slug}.academiahelm.com/login`
5. **Authentification** : Contextuelle selon le portail

---

## 📋 2. Configuration des URLs

### Variables d'Environnement

```bash
# URL de base de l'application
NEXT_PUBLIC_APP_URL=http://localhost:3001  # Local
NEXT_PUBLIC_APP_URL=https://academiahelm.com  # Production

# Domaine de base (pour sous-domaines)
NEXT_PUBLIC_BASE_DOMAIN=localhost:3001  # Local
NEXT_PUBLIC_BASE_DOMAIN=academiahelm.com  # Production

# Environnement
NEXT_PUBLIC_ENV=local  # local | preview | test | production
```

### Helper Centralisé

Toutes les URLs sont gérées via `src/lib/utils/urls.ts` :

```typescript
import { 
  getAppBaseUrl, 
  getApiBaseUrl, 
  getTenantRedirectUrl,
  getBaseDomain 
} from '@/lib/utils/urls';

// URL de base de l'app
const appUrl = getAppBaseUrl(); // http://localhost:3001 ou https://academiahelm.com

// URL de l'API
const apiUrl = getApiBaseUrl(); // http://localhost:3000/api ou https://api.academiahelm.com/api

// Redirection vers un tenant
const redirectUrl = getTenantRedirectUrl('college-x', '/login', { portal: 'school' });
// Local: http://localhost:3001/login?tenant=college-x&portal=school
// Prod: https://college-x.academiahelm.com/login?portal=school
```

---

## 📋 3. Redirections Multi-Tenant

### En Local (Development)

En local, les sous-domaines sont disponibles via `*.localhost` ou via des **paramètres de requête** :

```
http://school.localhost:3001/app
OU
http://localhost:3001/app?tenant=college-x
```

Le middleware détecte le sous-domaine ou le paramètre `tenant` et résout le tenant.

### En Production / Test

En production et test, les sous-domaines sont utilisés :

```
https://college-x.academiahelm.com/app
OU
https://college-x.test.academiahelm.com/app
```

Le middleware extrait le sous-domaine depuis le header `Host` et résout le tenant.

---

## 📋 4. Middleware Configuration

### Extraction du Sous-domaine

Le middleware (`src/middleware.ts`) extrait le sous-domaine :

```typescript
function extractSubdomainFromRequest(request: NextRequest): string | null {
  const host = request.headers.get('host') || request.headers.get('x-forwarded-host');
  
  if (!host) return null;
  
  // En développement local, utiliser le header X-Tenant-Subdomain
  if (process.env.NODE_ENV === 'development') {
    const devSubdomain = request.headers.get('x-tenant-subdomain');
    if (devSubdomain) return devSubdomain;
  }
  
  const parts = host.split('.');
  
  // Si 3+ parties et la première n'est pas 'www' ou 'localhost'
  if (parts.length >= 3 && parts[0] !== 'www' && parts[0] !== 'localhost') {
    return parts[0]; // Le sous-domaine
  }
  
  return null;
}
```

### Résolution du Tenant

Le middleware résout le tenant depuis l'API :

```typescript
async function resolveTenant(subdomain: string) {
  const apiUrl = getApiBaseUrl();
  const response = await fetch(`${apiUrl}/tenants/by-subdomain/${subdomain}`);
  
  if (!response.ok) return null;
  
  const tenant = await response.json();
  
  // Vérifier le statut de souscription
  if (tenant.subscriptionStatus === 'PENDING' || tenant.subscriptionStatus === 'TERMINATED') {
    return null;
  }
  
  return tenant;
}
```

### Headers Ajoutés

Le middleware ajoute ces headers à chaque requête :

```
X-Tenant-ID: tenant-uuid
X-Tenant-Slug: college-x
X-Tenant-Subscription-Status: ACTIVE_SUBSCRIBED
X-User-ID: user-uuid (si authentifié)
```

---

## 📋 5. Protection des Routes

### Routes Publiques

Ces routes sont accessibles sans sous-domaine :

```typescript
const publicRoutes = [
  '/',
  '/modules',
  '/tarification',
  '/securite',
  '/contact',
  '/signup',
  '/login',
  '/admin-login',
  '/forgot-password',
  '/portal',
];
```

### Routes App (Nécessitent un Sous-domaine)

Toutes les routes `/app/**` nécessitent un sous-domaine valide :

```typescript
if (pathname.startsWith('/app')) {
  if (!subdomain) {
    // Rediriger vers le portail
    return NextResponse.redirect(new URL('/login', getAppBaseUrl()));
  }
  
  const tenant = await resolveTenant(subdomain);
  
  if (!tenant) {
    // Rediriger vers la page "tenant not found"
    return NextResponse.redirect(new URL('/tenant-not-found', getAppBaseUrl()));
  }
  
  // Ajouter les headers tenant
  // ...
}
```

---

## 📋 6. Configuration Vercel

### Variables d'Environnement Vercel

Dans le dashboard Vercel, configurez :

```bash
NEXT_PUBLIC_APP_URL=https://academiahelm.com
NEXT_PUBLIC_BASE_DOMAIN=academiahelm.com
NEXT_PUBLIC_API_URL=https://api.academiahelm.com/api
NEXT_PUBLIC_ENV=production
```

### Configuration DNS

Pour chaque école, créez un enregistrement DNS CNAME :

```
college-x.academiahelm.com → CNAME → academiahelm.com
```

Vercel gérera automatiquement le routage vers votre application Next.js.

---

## 📋 7. Configuration Supabase Auth

### Redirect URLs

Dans Supabase Dashboard > Authentication > URL Configuration :

```
# Local
http://localhost:3000/**
http://localhost:3001/**
http://127.0.0.1:3000/**
http://127.0.0.1:3001/**

# Vercel Preview
https://*.vercel.app/**

# Production (tous les sous-domaines)
https://*.academiahelm.com/**
https://academiahelm.com/**
```

### Site URL

```
# Local
http://localhost:3001

# Production
https://academiahelm.com
```

---

## 📋 8. Tests

### Test Local

1. Démarrer l'application : `npm run dev`
2. Accéder à : `http://localhost:3001/portal`
3. Sélectionner un portail et une école
4. Vérifier la redirection : `http://localhost:3001/login?tenant=college-x&portal=school`

### Test Production

1. Déployer sur Vercel
2. Configurer les DNS pour un sous-domaine de test
3. Accéder à : `https://test-school.academia-hub.com/app`
4. Vérifier que le tenant est résolu et les headers ajoutés

---

## ⚠️ Notes Importantes

1. **Isolation des Données** : Chaque tenant ne voit QUE ses données grâce à RLS.

2. **Performance** : Le middleware résout le tenant à chaque requête. Considérez un cache Redis pour améliorer les performances.

3. **Sécurité** : Ne jamais faire confiance au sous-domaine côté client. Toujours valider côté serveur.

4. **Fallback** : Si le tenant n'est pas trouvé, rediriger vers `/tenant-not-found` au lieu d'afficher une erreur.

5. **Logs** : Logger chaque résolution de tenant pour le debugging et l'audit.

---

## 🔗 Ressources

- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [Vercel Multi-Tenant](https://vercel.com/docs/concepts/edge-network/headers)
- [Supabase Multi-Tenant](https://supabase.com/docs/guides/auth/row-level-security)

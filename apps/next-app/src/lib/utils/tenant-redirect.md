# Tenant Redirection - Documentation

## 📋 Vue d'ensemble

Le système de redirection tenant permet de rediriger les utilisateurs vers leur école de manière sécurisée, avec support pour :
- **Local** : Utilise les query params (pas de DNS requis)
- **Preview (Vercel)** : Utilise les sous-domaines Vercel
- **Production** : Utilise les sous-domaines réels

## 🔧 Configuration

### Variables d'environnement

```bash
# Domaine de base (sans protocole)
NEXT_PUBLIC_BASE_DOMAIN=localhost:3001        # Local
NEXT_PUBLIC_BASE_DOMAIN=academia-hub.com      # Production

# URL de l'application
NEXT_PUBLIC_APP_URL=http://localhost:3001     # Local
NEXT_PUBLIC_APP_URL=https://academia-hub.com  # Production

# URL de l'API
NEXT_PUBLIC_API_URL=http://localhost:3000/api # Local
NEXT_PUBLIC_API_URL=https://api.academia-hub.com/api # Production
```

## 📖 Utilisation

### Hook React

```tsx
import { useTenantRedirect } from '@/lib/hooks/useTenantRedirect';

function MyComponent() {
  const { redirectToTenant, getTenantRedirectUrl } = useTenantRedirect();

  const handleRedirect = async () => {
    await redirectToTenant({
      tenantSlug: 'college-x',
      tenantId: 'uuid-here',
      path: '/login',
      portalType: 'SCHOOL',
    });
  };

  const url = getTenantRedirectUrl({
    tenantSlug: 'college-x',
    path: '/login',
  });

  return <button onClick={handleRedirect}>Accéder</button>;
}
```

### Fonction directe

```ts
import { redirectToTenant, getTenantRedirectUrl } from '@/lib/utils/tenant-redirect';

// Obtenir l'URL sans rediriger
const url = getTenantRedirectUrl({
  tenantSlug: 'college-x',
  path: '/login',
  portalType: 'SCHOOL',
});

// Rediriger avec logging
await redirectToTenant({
  tenantSlug: 'college-x',
  tenantId: 'uuid-here',
  path: '/login',
  portalType: 'SCHOOL',
});
```

## 🔒 Sécurité

### Protection automatique

Le middleware Next.js protège automatiquement les routes `/app` :
- ✅ Vérifie la présence d'un tenant (subdomain ou query param)
- ✅ Valide l'existence du tenant
- ✅ Vérifie le statut d'abonnement
- ✅ Log toutes les tentatives d'accès

### Logging

Toutes les redirections sont automatiquement loggées :
- **Local** : Console uniquement
- **Preview/Production** : Envoyé au backend pour stockage

Les logs contiennent :
- Tenant ID et slug
- URL source et destination
- Méthode de redirection (query/subdomain)
- Timestamp
- User agent et IP (si disponible)

## 🌍 Environnements

### Local (Development)

En local, le système utilise les query params pour éviter d'avoir besoin de DNS :

```
http://localhost:3001/login?tenant=college-x&portal=school
```

**Avantages** :
- Pas besoin de configurer `/etc/hosts`
- Fonctionne immédiatement
- Facile à tester

### Preview (Vercel)

En preview Vercel, utilise les sous-domaines Vercel :

```
https://college-x-abc123.vercel.app/login?portal=school
```

### Production

En production, utilise les sous-domaines réels :

```
https://college-x.academia-hub.com/login?portal=school
```

## 🚨 Gestion des erreurs

### Tenant non trouvé

Si le tenant n'existe pas, redirection vers `/tenant-not-found` avec logging.

### Tenant inactif

Si le tenant est inactif (PENDING, TERMINATED), redirection vers `/tenant-not-found`.

### Accès sans tenant

Si accès à `/app` sans tenant, redirection vers `/portal` pour sélection.

## 📊 Analytics

Les redirections sont loggées pour :
- Analytics d'utilisation
- Détection de tentatives d'accès non autorisées
- Audit de sécurité
- Optimisation des performances

## 🔄 Migration depuis l'ancien système

L'ancienne fonction `getTenantRedirectUrl` de `urls.ts` est toujours disponible mais dépréciée. Elle utilise maintenant la nouvelle implémentation en interne.

**Migration recommandée** :
```ts
// Ancien
import { getTenantRedirectUrl } from '@/lib/utils/urls';
const url = getTenantRedirectUrl('college-x', '/login');

// Nouveau
import { getTenantRedirectUrl } from '@/lib/utils/tenant-redirect';
const url = getTenantRedirectUrl({
  tenantSlug: 'college-x',
  path: '/login',
});
```

## 🧪 Tests

### Tester en local

1. Accéder à `/portal`
2. Sélectionner un portail
3. Rechercher une école
4. Cliquer sur "Continuer"
5. Vérifier la redirection avec query param `?tenant=...`

### Tester en production

1. Accéder à `https://academia-hub.com/portal`
2. Sélectionner un portail
3. Rechercher une école
4. Cliquer sur "Continuer"
5. Vérifier la redirection vers `https://{school-slug}.academia-hub.com/login`

## 📝 Notes importantes

- ⚠️ Ne jamais utiliser `localhost` en dur dans le code
- ⚠️ Toujours utiliser `NEXT_PUBLIC_BASE_DOMAIN`
- ⚠️ Le logging ne doit jamais bloquer la redirection
- ✅ Le système fonctionne sans DNS en local
- ✅ Compatible avec Supabase Auth

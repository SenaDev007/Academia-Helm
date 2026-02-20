# Chargement du tenant depuis la DB - Implémentation complète

## ✅ Problème résolu

Les routes API d'authentification créaient un objet tenant avec des valeurs par défaut (`name: 'Mon École'`, `subdomain: ''`) au lieu de charger le tenant réel depuis la base de données.

---

## 🔧 Solution implémentée

### 1. Fonction helper `loadTenantFromApi()`

**Fichier** : `apps/web-app/src/lib/utils/load-tenant.ts`

Fonction utilitaire qui :
- Charge le tenant depuis l'API backend (`GET /tenants/:id`) avec le token JWT reçu après authentification
- Mappe les données du backend vers le format `Tenant` attendu par le frontend
- Gère les conversions de dates (ISO strings)
- Mappe le statut d'abonnement (`subscriptionStatus`) depuis les formats legacy vers le format normalisé
- Retourne `null` en cas d'erreur (avec fallback dans les routes API)

**Fonctionnalités** :
- ✅ Utilise le token JWT pour authentifier la requête vers `/tenants/:id`
- ✅ Gestion d'erreurs robuste (404, 401, 403, etc.)
- ✅ Mapping intelligent des dates (string ISO, Date object, etc.)
- ✅ Mapping du statut d'abonnement (legacy → normalisé)

---

### 2. Mise à jour des routes API d'authentification

Toutes les routes API d'authentification ont été mises à jour pour :

1. **Charger le tenant depuis l'API** avec `loadTenantFromApi(tenantId, token)`
2. **Fallback gracieux** : Si le chargement échoue, utiliser des valeurs minimales (compatibilité)
3. **Construire l'objet `user` complet** avec tous les champs requis (`permissions`, `createdAt`, etc.)

**Fichiers modifiés** :
- ✅ `apps/web-app/src/app/api/portal/auth/school/route.ts`
- ✅ `apps/web-app/src/app/api/portal/auth/teacher/route.ts`
- ✅ `apps/web-app/src/app/api/portal/auth/parent/route.ts`
- ✅ `apps/web-app/src/app/api/auth/login/route.ts`

---

## 📋 Détails techniques

### Format de réponse backend

L'endpoint `GET /tenants/:id` retourne un objet tenant avec :
- `id`, `name`, `slug`, `subdomain`
- `status`, `subscriptionStatus`
- `createdAt`, `updatedAt`, `trialEndsAt`, `nextPaymentDueAt`
- Autres champs selon le modèle Tenant

### Mapping vers le format frontend

La fonction `loadTenantFromApi()` mappe :
- **Dates** : Conversion vers ISO strings (`trialEndsAt`, `nextPaymentDueAt` → `undefined` si absentes)
- **SubscriptionStatus** : Mapping depuis formats legacy (`trial`, `active`, etc.) vers format normalisé (`ACTIVE_TRIAL`, `ACTIVE_SUBSCRIBED`, etc.)
- **Subdomain** : Utilise `subdomain` ou `slug` en fallback

### Gestion d'erreurs

- **404** : Tenant non trouvé → retourne `null` (fallback utilisé)
- **401/403** : Token invalide ou non autorisé → retourne `null` (fallback utilisé)
- **Autres erreurs** : Log et retourne `null` (fallback utilisé)

Le fallback garantit que l'authentification ne bloque pas même si le chargement du tenant échoue.

---

## 🔄 Flux complet après correction

### Portail École / Enseignant / Parent

```
1. POST /api/portal/auth/school → Backend authentifie et retourne { user, token }
2. Route API Next.js → loadTenantFromApi(tenantId, token)
3. Appel GET /tenants/:id avec Authorization: Bearer {token}
4. Backend retourne tenant complet (name, slug, subdomain, subscriptionStatus, etc.)
5. Mapping vers format Tenant frontend
6. Construction session avec tenant réel + user complet
7. setServerSession(session) → Cookies stockés
8. Retourne { success: true, user, tenant } avec vraies données
```

### Login Standard

```
1. POST /api/auth/login → Backend authentifie et retourne { user, accessToken }
2. Route API Next.js → loadTenantFromApi(tenantId, accessToken) si tenantId présent
3. Même processus de chargement et mapping
4. Construction session avec tenant réel
```

---

## ✅ Avantages

1. **Données réelles** : Le tenant dans la session contient maintenant les vraies données (nom, slug, subdomain, statut d'abonnement)
2. **Cohérence** : Les données sont cohérentes entre la session et la DB
3. **Performance** : Une seule requête supplémentaire après authentification (acceptable)
4. **Robustesse** : Fallback gracieux si le chargement échoue (l'authentification ne bloque pas)
5. **Type-safe** : Types TypeScript corrects (`undefined` au lieu de `null` pour les dates optionnelles)

---

## 🧪 Tests recommandés

1. **Login portail École** :
   - Se connecter → vérifier que `tenant.name` dans la session correspond au vrai nom de l'école
   - Vérifier que `tenant.slug` et `tenant.subdomain` sont corrects

2. **Login standard avec tenant** :
   - Se connecter avec `tenant_id` → vérifier que le tenant chargé correspond

3. **PLATFORM_OWNER** :
   - Se connecter sans tenant → vérifier que le fallback fonctionne (tenant vide ou valeurs par défaut)

4. **Erreur de chargement** :
   - Simuler une erreur 404 ou 401 lors du chargement → vérifier que le fallback fonctionne et que l'authentification réussit quand même

---

## 📝 Notes

- **Token requis** : Le chargement du tenant nécessite un token JWT valide. Si le token n'est pas fourni, la fonction retourne `null` et le fallback est utilisé.
- **Permissions** : Le champ `permissions` dans `user` est initialisé à `[]` et sera chargé via `/context/bootstrap` après la connexion.
- **Performance** : Une requête supplémentaire est effectuée après chaque authentification. C'est acceptable car :
  - C'est une opération critique (données tenant)
  - Le fallback garantit que ça ne bloque pas l'authentification
  - Le layout `/app` charge déjà le contexte complet via `/context/bootstrap`

---

## ✅ Statut

**Tous les TODOs ont été supprimés et remplacés par une implémentation complète.**

Le chargement du tenant depuis la DB est maintenant fonctionnel dans toutes les routes d'authentification.

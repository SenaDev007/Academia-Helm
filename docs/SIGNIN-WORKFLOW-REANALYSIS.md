# Réanalyse du workflow Sign-in - État actuel après corrections

## ✅ Corrections appliquées

1. ✅ **Résolution tenant slug/UUID** : Backend accepte slug ou UUID
2. ✅ **Passage tenant_id dans URL** : Portail ajoute `tenant_id` dans l'URL
3. ✅ **OTP Parent** : Stockage et vérification implémentés

---

## 🔍 Analyse du workflow complet

### Flux 1 : Portail → Login Portail → App

```
1. /portal → Utilisateur choisit portail (school/teacher/parent) + école
2. redirectToTenant() → /login?portal=school&tenant=<slug>&tenant_id=<uuid>
3. LoginPage.handleSchoolLogin() → POST /api/portal/auth/school { tenantId: uuid }
4. Backend portal-auth.service.loginSchool() → résout tenant, vérifie user, génère token
5. Route API Next.js → setServerSession() avec token + tenant
6. LoginPage → window.location.href = '/app'  ⚠️ SANS tenant dans l'URL
7. Middleware → Vérifie ?tenant= dans URL → ❌ PAS DE TENANT → redirige vers /portal
```

**❌ PROBLÈME IDENTIFIÉ** : Après login portail, redirection vers `/app` sans `?tenant=`. Le middleware vérifie l'URL, pas la session, donc redirige vers `/portal`.

---

### Flux 2 : Login Standard avec tenant

```
1. /login?tenant=<slug>&tenant_id=<uuid>
2. LoginPage.handleStandardLogin() → POST /api/auth/login { tenant_id: uuid }
3. Backend auth.service.login() → 
   - Si PLATFORM_OWNER → OK (pas de tenant requis)
   - Sinon → Vérifie portal_type ? ❌ PAS ENVOYÉ
   - Si portal_type && portal_type !== PLATFORM → exige tenant_id ✅
   - Sinon (pas de portal_type) → génère token SANS vérifier tenant ❌
4. Route API Next.js → setServerSession()
5. LoginPage → window.location.href = '/app?tenant=<slug>' ✅
```

**⚠️ PROBLÈME IDENTIFIÉ** : Le backend `auth.service.login()` ne vérifie le tenant que si `portal_type` est fourni. Le login standard n'envoie jamais `portal_type`, donc un utilisateur normal peut se connecter avec un `tenant_id` sans vérification que l'utilisateur appartient à ce tenant.

---

### Flux 3 : Login Standard sans tenant (PLATFORM_OWNER)

```
1. /login (sans tenant)
2. LoginPage.handleStandardLogin() → POST /api/auth/login { email, password }
3. Backend auth.service.login() → 
   - Détecte PLATFORM_OWNER → génère token SANS tenantId ✅
4. Route API Next.js → setServerSession() avec tenant.id = '' ⚠️
5. LoginPage → window.location.href = '/app' ✅
6. Middleware → Pas de tenant requis pour /app si session valide ? À vérifier
```

**⚠️ POINT D'ATTENTION** : La route API crée un tenant avec `id: ''` pour PLATFORM_OWNER. Le layout `/app` pourrait avoir besoin d'un tenant.

---

## 🐛 Problèmes identifiés

### 1. **Redirection après login portail sans tenant dans l'URL** ❌ CRITIQUE

**Fichier** : `apps/web-app/src/components/auth/LoginPage.tsx`

**Problème** :
```typescript
// handleSchoolLogin, handleTeacherLogin, handleParentLogin
window.location.href = redirectPath; // '/app' sans ?tenant=
```

**Impact** : Le middleware vérifie `?tenant=` dans l'URL pour autoriser `/app`. Sans tenant dans l'URL, redirection vers `/portal` même si la session est valide.

**Solution** : Ajouter `tenant` (slug) et `tenant_id` (UUID) dans l'URL de redirection :
```typescript
const redirectUrl = tenantSlug || tenantIdFromUrl
  ? `${redirectPath}?tenant=${encodeURIComponent(tenantSlug || '')}&tenant_id=${encodeURIComponent(tenantIdFromUrl || '')}`
  : redirectPath;
window.location.href = redirectUrl;
```

---

### 2. **Login standard : pas de vérification tenant si pas de portal_type** ⚠️

**Fichier** : `apps/api-server/src/auth/auth.service.ts`

**Problème** :
```typescript
// Si portal_type est SCHOOL, TEACHER ou PARENT, tenant_id est requis
if (loginDto.portal_type && loginDto.portal_type !== 'PLATFORM') {
  // Vérifie tenant...
}
// Sinon, génère token sans vérifier tenant
```

**Impact** : Un utilisateur normal peut se connecter avec `tenant_id` sans vérification d'appartenance au tenant.

**Solution** : Si `tenant_id` est fourni (même sans `portal_type`), vérifier que l'utilisateur appartient à ce tenant :
```typescript
if (loginDto.tenant_id) {
  const tenant = await this.prisma.tenant.findUnique({
    where: { id: loginDto.tenant_id },
  });
  if (!tenant || tenant.status !== 'active') {
    throw new ForbiddenException('Tenant not found or inactive');
  }
  if (user.tenantId !== loginDto.tenant_id) {
    throw new ForbiddenException('User does not belong to the specified tenant');
  }
}
```

---

### 3. **Routes API Next.js : tenant avec valeurs par défaut** ⚠️

**Fichiers** : `/api/portal/auth/school|teacher|parent/route.ts`, `/api/auth/login/route.ts`

**Problème** :
```typescript
const tenant = {
  id: data.user.tenantId || body.tenantId || '',
  name: 'Mon École', // ⚠️ Valeur par défaut
  subdomain: '', // ⚠️ Vide
  subscriptionStatus: 'ACTIVE_SUBSCRIBED',
  // ...
};
```

**Impact** : Le tenant dans la session n'a pas les vraies données (nom, subdomain). Le layout `/app` pourrait avoir besoin de ces infos.

**Solution** : Charger le tenant depuis la DB ou depuis la réponse backend si disponible. Le backend portal-auth pourrait retourner les infos tenant.

---

### 4. **Middleware : vérifie URL, pas session** ⚠️

**Fichier** : `apps/web-app/src/middleware.ts`

**Problème** : Le middleware vérifie `?tenant=` dans l'URL pour autoriser `/app`, mais ne vérifie pas la session. Donc même avec une session valide, si l'URL n'a pas `?tenant=`, redirection vers `/portal`.

**Impact** : Après login portail, si la redirection oublie `?tenant=`, l'utilisateur est redirigé vers `/portal` malgré une session valide.

**Solution** : Vérifier aussi la session dans le middleware :
```typescript
const user = getUserFromSessionCookie(request);
if (pathname.startsWith('/app')) {
  if (!subdomain && !tenantParam) {
    // Si session valide avec tenant, autoriser l'accès
    if (user?.tenantId) {
      return response; // Autoriser avec session
    }
    // Sinon rediriger vers portail
  }
}
```

---

## 📊 Tableau récapitulatif

| Problème | Criticité | Fichiers concernés | Solution |
|----------|-----------|-------------------|----------|
| **Redirection sans tenant après login portail** | 🔴 CRITIQUE | `LoginPage.tsx` | Ajouter `?tenant=` dans redirectUrl |
| **Pas de vérification tenant si pas portal_type** | 🟡 MOYEN | `auth.service.ts` | Vérifier tenant si `tenant_id` fourni |
| **Tenant avec valeurs par défaut dans session** | 🟡 MOYEN | Routes API Next.js | Charger tenant depuis DB |
| **Middleware vérifie URL pas session** | 🟡 MOYEN | `middleware.ts` | Vérifier session aussi |

---

## 🔄 Flux corrigés (après corrections proposées)

### Flux 1 corrigé : Portail → Login Portail → App

```
1. /portal → Utilisateur choisit portail + école
2. redirectToTenant() → /login?portal=school&tenant=<slug>&tenant_id=<uuid>
3. LoginPage.handleSchoolLogin() → POST /api/portal/auth/school
4. Backend → génère token + tenant
5. Route API Next.js → setServerSession()
6. LoginPage → window.location.href = '/app?tenant=<slug>&tenant_id=<uuid>' ✅
7. Middleware → Vérifie ?tenant= → ✅ AUTORISE
8. Layout /app → getServerSession() → ✅ SESSION VALIDE
```

### Flux 2 corrigé : Login Standard avec tenant

```
1. /login?tenant=<slug>&tenant_id=<uuid>
2. LoginPage.handleStandardLogin() → POST /api/auth/login { tenant_id }
3. Backend auth.service.login() → 
   - Si tenant_id fourni → Vérifie tenant + appartenance ✅
   - Génère token avec tenantId ✅
4. Route API Next.js → setServerSession()
5. LoginPage → window.location.href = '/app?tenant=<slug>&tenant_id=<uuid>' ✅
```

---

## 📝 Recommandations

### Priorité 1 (Critique)
1. ✅ **Corriger redirection après login portail** : Ajouter `?tenant=` dans l'URL de redirection

### Priorité 2 (Important)
2. ✅ **Vérifier tenant dans login standard** : Si `tenant_id` fourni, vérifier appartenance même sans `portal_type`
3. ✅ **Middleware : vérifier session** : Autoriser `/app` si session valide avec tenant, même sans `?tenant=` dans l'URL

### Priorité 3 (Amélioration)
4. ⚠️ **Charger tenant depuis DB** : Routes API Next.js devraient charger le tenant complet depuis la DB au lieu de valeurs par défaut
5. ⚠️ **Backend retourne infos tenant** : Les réponses portal-auth pourraient inclure `tenant: { id, name, slug, ... }`

---

## 🧪 Tests à effectuer après corrections

1. **Login portail École** :
   - Se connecter → vérifier redirection vers `/app?tenant=<slug>&tenant_id=<uuid>`
   - Vérifier que le middleware autorise l'accès
   - Vérifier que le layout `/app` charge correctement

2. **Login standard avec tenant** :
   - `/login?tenant=<slug>&tenant_id=<uuid>` → connexion utilisateur normal
   - Vérifier que le backend rejette si l'utilisateur n'appartient pas au tenant

3. **Login PLATFORM_OWNER** :
   - `/login` sans tenant → connexion PLATFORM_OWNER
   - Vérifier que le middleware autorise `/app` même sans `?tenant=`

4. **Session persistante** :
   - Se connecter → fermer l'onglet → rouvrir `/app?tenant=<slug>`
   - Vérifier que la session est toujours valide

# Analyse du workflow Sign-in multi-portails

## Vue d'ensemble

L'application propose plusieurs **portails** et **points d'entrée** pour la connexion :

| Portail / Entrée | URL / Contexte | Méthode d'auth | Backend | Frontend |
|------------------|----------------|----------------|---------|----------|
| **Portail central** | `/portal` | Sélection école + type de portail → redirection vers login | — | Page portail + `useTenantRedirect` |
| **Login standard** | `/login` (sans `portal`) | Email + mot de passe | `POST /api/auth/login` | `LoginPage` → `/api/auth/login` |
| **Portail École** | `/login?portal=school&tenant=xxx` | Email + mot de passe | `POST /api/portal/auth/school` | `LoginPage` → `/api/portal/auth/school` |
| **Portail Enseignant** | `/login?portal=teacher&tenant=xxx` | Matricule + mot de passe | `POST /api/portal/auth/teacher` | `LoginPage` → `/api/portal/auth/teacher` |
| **Portail Parent** | `/login?portal=parent&tenant=xxx` | Téléphone + OTP (2 étapes) | `POST /api/portal/auth/parent` | `LoginPage` → `/api/portal/auth/parent` |
| **Super Admin** | `/admin-login` | Email + mot de passe (PLATFORM_OWNER) | `POST /api/auth/login` (portal_type PLATFORM) | `AdminLoginPage` |
| **Patronat** | `/patronat/login` | Auth dédiée patronat | (à vérifier) | `PatronatLoginPage` |

---

## 1. Flux général : du portail à l’app

```
[Utilisateur] → /portal
    → Choisit un portail (École / Enseignant / Parent)
    → Recherche et sélectionne un établissement
    → handleContinue() appelle redirectToTenant({ tenantSlug, tenantId, path: '/login', portalType, queryParams: { portal } })
    → Redirection vers :
        • Local : /login?tenant=<tenantSlug>&portal=<school|teacher|parent>
        • Prod  : https://<tenantSlug>.<baseDomain>/login?portal=...
[LoginPage] lit searchParams : portal, tenant, redirect
    → Affiche le formulaire selon portal (school / teacher / parent) ou formulaire standard
    → Soumet vers l’API correspondante (auth/login ou portal/auth/school|teacher|parent)
[Route API Next.js] proxy vers l’API NestJS + setServerSession(session)
    → Cookie academia_session + academia_token
[Redirect] window.location.href = redirectPath (défaut /app)
[Middleware] Pour /app : exige subdomain ou ?tenant= ; sinon redirige vers /portal
[Layout /app] getServerSession() → si pas de session, redirect('/login')
```

---

## 2. Backend (API NestJS)

### 2.1 Auth principal : `POST /api/auth/login`

- **Fichier** : `apps/api-server/src/auth/auth.controller.ts` + `auth.service.ts`
- **Guard** : `LocalAuthGuard` (valide email + password via `LoginDto`)
- **Body** : `LoginDto` : `email`, `password`, optionnel `tenant_id`, optionnel `portal_type` (enum : PLATFORM | SCHOOL | TEACHER | PARENT)

Comportement :

- **PLATFORM_OWNER** (détecté par `isPlatformOwner(user)` ) : token sans `tenantId` ; si `portal_type` fourni et ≠ PLATFORM → 403.
- **Autre utilisateur** : si `portal_type === 'PLATFORM'` → 403. Si `portal_type` est SCHOOL/TEACHER/PARENT, **tenant_id obligatoire** : vérification tenant actif + `user.tenantId === loginDto.tenant_id`, puis token enrichi avec `tenantId`.

**Point d’attention** : la route Next.js `/api/auth/login` n’envoie **pas** `portal_type` ni `tenant_id` au backend ; elle envoie seulement `email`, `password`, `tenantSubdomain`. Donc le login “standard” depuis la même page ne remplit pas les règles portail (tenant obligatoire pour SCHOOL/TEACHER/PARENT) côté API.

### 2.2 Portails : `POST /api/portal/auth/school | teacher | parent`

- **Fichier** : `apps/api-server/src/portal/controllers/portal-auth.controller.ts` + `portal-auth.service.ts`
- **Routes** : publiques (`@Public()`), pas de guard global.

| Route | DTO | Logique métier |
|-------|-----|----------------|
| `POST /api/portal/auth/school` | tenantId, email, password | Tenant actif ; user avec email + tenantId ; rôle parmi DIRECTOR, SUPER_DIRECTOR, ADMIN, ACCOUNTANT ; bcrypt ; session portail + JWT avec portalType SCHOOL |
| `POST /api/portal/auth/teacher` | tenantId, teacherIdentifier, password | Tenant actif ; Teacher par matricule + tenantId ; User lié (email teacher) ; rôle TEACHER ; bcrypt ; session + JWT TEACHER |
| `POST /api/portal/auth/parent` | tenantId, phone, otp? | Sans OTP : génère OTP, en dev le renvoie. Avec OTP : en dev accepte ; hors dev “non implémenté”. Session + JWT PARENT |

**Point critique** : les DTOs utilisent **tenantId** et le service fait `prisma.tenant.findUnique({ where: { id: dto.tenantId } })`. Donc le backend attend un **UUID** (id du tenant). Or la redirection depuis le portail met dans l’URL **tenant = tenantSlug** (voir `getTenantRedirectUrl` : `url.searchParams.set('tenant', tenantSlug)`). La LoginPage envoie donc le **slug** comme `tenantId` aux routes portail → risque “Établissement non trouvé ou inactif” si l’API ne résout pas le tenant par slug.

---

## 3. Frontend (Next.js)

### 3.1 Page de login unique : `(auth)/login/page.tsx` → `LoginPage`

- **Fichier** : `apps/web-app/src/components/auth/LoginPage.tsx`
- **Query params lus** : `portal`, `tenant`, `redirect` (défaut `/app`).

Comportement :

- Pas de `portal` → **login standard** : formulaire email + password → `POST /api/auth/login` avec `email`, `password`, `tenantSubdomain` (= `tenant` de l’URL). Pas d’envoi de `portal_type` ni `tenant_id` (UUID).
- `portal=school` → formulaire email + password → `POST /api/portal/auth/school` avec `tenantId`, `email`, `password` (ici `tenantId` = paramètre `tenant` de l’URL = slug en pratique).
- `portal=teacher` → formulaire matricule + password → `POST /api/portal/auth/teacher` avec `tenantId`, `teacherIdentifier`, `password`.
- `portal=parent` → formulaire téléphone puis OTP → deux appels `POST /api/portal/auth/parent` (sans puis avec `otp`).

Après succès : les routes API Next.js (proxies) appellent `setServerSession(session)` (cookie session + token), puis la page fait `window.location.href = redirectPath`.

### 3.2 Routes API Next.js (proxies)

| Route Next.js | Appelle | Après succès |
|---------------|--------|--------------|
| `POST /api/auth/login` | `POST ${API}/api/auth/login` | setServerSession ; retourne success + user + tenant |
| `POST /api/portal/auth/school` | `POST ${API}/portal/auth/school` | setServerSession ; retourne success, user, tenant, portalType |
| `POST /api/portal/auth/teacher` | `POST ${API}/portal/auth/teacher` | (à confirmer : même pattern que school) |
| `POST /api/portal/auth/parent` | `POST ${API}/portal/auth/parent` | (à confirmer : même pattern) |

Les proxies construisent un objet `tenant` (id, name, subdomain, etc.) et le mettent en session avec le token renvoyé par le backend.

### 3.3 Session

- **Fichiers** : `apps/web-app/src/lib/auth/session.ts`
- **Cookies** : `academia_session` (objet session), `academia_token` (JWT).
- **Layout /app** : `getServerSession()` ; si pas de session → `redirect('/login')`.

### 3.4 Middleware

- **Fichier** : `apps/web-app/src/middleware.ts`
- `/login`, `/admin-login`, `/portal`, etc. sont en **publicRoutes**.
- Avec sous-domaine, les routes publiques (sauf `/`) redirigent vers le domaine principal (même path).
- Pour `/app` : si pas de subdomain et pas de `?tenant=` → redirection vers `/portal` ; sinon résolution du tenant (subdomain ou paramètre).

### 3.5 Admin et Patronat

- **Admin** : `/admin-login` → composant dédié (ex. `AdminLoginPage`) ; login vers même backend auth avec identifiants PLATFORM_OWNER (ou équivalent).
- **Patronat** : `/patronat/login` → `PatronatLoginPage` ; middleware dédié `middleware-patronat.ts` pour les chemins `/patronat/*`.

---

## 4. Incohérences et pistes de correction

### 4.1 Tenant : slug vs UUID

- **Problème** : La redirection portail met `tenant=<tenantSlug>`. La LoginPage envoie ce paramètre comme `tenantId` aux APIs portail, alors que le backend utilise `tenantId` en `findUnique({ where: { id: dto.tenantId } })`.
- **Piste** :
  - Soit ajouter dans l’URL le tenant **id** (ex. `tenant_id=<uuid>`) et faire envoyer par le front le vrai `tenantId` (UUID) aux routes portail.
  - Soit faire accepter par le backend un identifiant “slug ou id” et résoudre le tenant par `slug` ou `id` (ex. `findFirst` sur slug ou id).

### 4.2 Login standard sans portail

- **Problème** : `/api/auth/login` (Next.js) n’envoie pas `portal_type` ni `tenant_id` au backend. Si l’utilisateur a un `tenant` dans l’URL (ex. lien dev “Connexion rapide”), le backend ne reçoit que `tenantSubdomain` et ne peut pas appliquer la logique “tenant obligatoire pour SCHOOL/TEACHER/PARENT”.
- **Piste** : Si l’URL contient `tenant=`, résoudre le tenant (slug → id) côté front et envoyer à l’API auth `tenant_id` (UUID) et éventuellement `portal_type` selon le cas d’usage (ou garder un seul “login app” sans portal_type).

### 4.3 Portail Parent (OTP)

- En production, la vérification OTP parent n’est pas implémentée (retour “non implémentée”). À prévoir : stockage OTP temporaire (Redis/table), envoi SMS/WhatsApp, vérification au second appel.

### 4.4 Réponses portail et `success`

- Backend portail renvoie `{ user, token, sessionId, portalType }` sans champ `success`. Les proxies Next.js renvoient `{ success: true, ... }`. La LoginPage (school) vérifie `!data.success` → cohérent grâce au proxy. À garder en tête si on expose directement le backend.

---

## 5. Résumé des flux par portail

1. **Portail École** : Portail → choix école + portail École → `/login?portal=school&tenant=<slug>` → formulaire email/password → `POST /api/portal/auth/school` (tenantId = slug aujourd’hui) → session → redirect `/app`.
2. **Portail Enseignant** : Idem avec `portal=teacher`, formulaire matricule/password, `POST /api/portal/auth/teacher`.
3. **Portail Parent** : Idem avec `portal=parent`, formulaire téléphone puis OTP, deux appels `POST /api/portal/auth/parent`.
4. **Login “standard”** : `/login` sans `portal` → email/password → `POST /api/auth/login` (sans portal_type/tenant_id) → session → redirect.
5. **Admin** : `/admin-login` → auth PLATFORM_OWNER → accès `/admin`.
6. **Patronat** : `/patronat/login` → flux patronat dédié.

Pour la suite du travail sur le sign-in depuis les différents portails, les deux points les plus bloquants sont : **résolution tenant slug vs id** sur toute la chaîne (portail → login → API), et **alignement du login standard** avec les champs attendus par le backend (tenant_id / portal_type si besoin).

# Corrections du workflow Sign-in - Problèmes résolus

## ✅ Problèmes corrigés

### 1. **Tenant slug vs UUID** ✅

**Problème** : Le portail redirigeait avec `tenant=<slug>` dans l'URL, mais les APIs portail attendaient `tenantId` = UUID. Résultat : "Établissement non trouvé".

**Solution** :
- **Backend** (`portal-auth.service.ts`) : Ajout d'un helper `resolveTenant()` qui accepte soit un UUID soit un slug. Détection UUID via regex, puis `findUnique` par `id` ou `slug` selon le cas. Utilisé dans `loginSchool`, `loginTeacher`, `loginParent`.
- **Frontend** (`tenant-redirect.ts`) : Ajout de `tenant_id` (UUID) dans les query params de l'URL lors de la redirection depuis le portail (en local et production). Le portail passe déjà `tenantId: selectedSchool.id` dans la config.
- **LoginPage** : Lit `tenant_id` depuis l'URL en priorité, utilise `tenant` (slug) en fallback pour compatibilité. Envoie `tenantIdForApi` (UUID si présent, sinon slug) aux APIs portail.

**Fichiers modifiés** :
- `apps/api-server/src/portal/services/portal-auth.service.ts`
- `apps/web-app/src/lib/utils/tenant-redirect.ts`
- `apps/web-app/src/components/auth/LoginPage.tsx`

---

### 2. **Login standard sans tenant_id** ✅

**Problème** : La route `/api/auth/login` (Next.js) n'envoyait pas `tenant_id` ni `portal_type` au backend, donc le backend ne pouvait pas appliquer la logique "tenant obligatoire pour portails".

**Solution** :
- **Frontend LoginPage** : Lit `tenant_id` depuis l'URL et l'envoie dans le body de la requête vers `/api/auth/login`.
- **Route API Next.js** (`/api/auth/login/route.ts`) : Accepte `tenant_id` dans `LoginCredentials` et le transmet au backend NestJS.

**Fichiers modifiés** :
- `apps/web-app/src/components/auth/LoginPage.tsx`
- `apps/web-app/src/app/api/auth/login/route.ts`

---

### 3. **OTP Parent - Stockage et vérification** ✅

**Problème** : La vérification OTP parent n'était pas implémentée (retour "non implémentée" en production).

**Solution** :
- **Stockage OTP** : Ajout d'un Map en mémoire (`parentOtpStore`) avec TTL de 5 minutes. Clé : `${tenantId}:${normalizedPhone}`. Valeur : `{ code, expiresAt }`.
- **Méthodes** :
  - `storeParentOtp()` : Stocke l'OTP avec expiration.
  - `verifyParentOtp()` : Vérifie le code, supprime l'entrée si valide ou expirée.
- **Intégration** : `loginParent()` appelle `storeParentOtp()` lors de la génération, et `verifyParentOtp()` lors de la vérification. En dev, l'OTP est toujours retourné dans la réponse pour faciliter les tests.

**Note** : En production multi-instance, préférer Redis ou une table dédiée (ex. `PortalParentOtp`) pour le stockage OTP. L'implémentation actuelle fonctionne pour dev et instances uniques.

**Fichiers modifiés** :
- `apps/api-server/src/portal/services/portal-auth.service.ts`

---

## 📋 Résumé des changements

| Composant | Changement | Impact |
|-----------|------------|--------|
| **Backend portal-auth** | Résolution tenant par slug ou UUID | Les APIs portail acceptent maintenant slug ou UUID |
| **Frontend redirect** | Ajout `tenant_id` dans URL | Le login reçoit l'UUID du tenant |
| **LoginPage** | Utilise `tenant_id` prioritairement | Envoie UUID aux APIs quand disponible |
| **Route API login** | Transmet `tenant_id` au backend | Le backend peut appliquer la logique tenant |
| **OTP Parent** | Stockage en mémoire + vérification | OTP fonctionnel en dev et instances uniques |

---

## 🧪 Tests recommandés

1. **Portail École** :
   - Aller sur `/portal` → choisir "Portail École" → sélectionner une école
   - Vérifier que l'URL contient `tenant_id=<uuid>` et `tenant=<slug>`
   - Se connecter avec email/password → doit fonctionner

2. **Portail Enseignant** :
   - Même flux avec matricule/password → doit fonctionner

3. **Portail Parent** :
   - Même flux avec téléphone → OTP généré → vérifier avec OTP → doit fonctionner
   - En dev, l'OTP est affiché dans la réponse JSON

4. **Login standard** :
   - `/login?tenant=<slug>&tenant_id=<uuid>` → connexion → doit fonctionner
   - `/login` sans tenant → connexion PLATFORM_OWNER → doit fonctionner

---

## 📝 Notes

- **Compatibilité** : Le système accepte toujours les slugs pour compatibilité avec les anciennes URLs/bookmarks.
- **OTP Production** : Pour la production multi-instance, migrer vers Redis ou une table `PortalParentOtp` avec colonnes : `tenantId`, `phone`, `codeHash`, `expiresAt`, `createdAt`.
- **Performance** : La résolution tenant (slug vs UUID) ajoute une requête DB supplémentaire si un slug est fourni. En production, privilégier l'envoi de l'UUID depuis le frontend.

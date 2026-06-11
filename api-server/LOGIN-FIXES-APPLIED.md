# ✅ Corrections Appliquées - Login

## 🔧 Problèmes Identifiés et Corrigés

### 1. ✅ Stratégie JWT Non Enregistrée

**Erreur** : `Unknown authentication strategy "jwt"`

**Cause** : La stratégie `JwtStrategy` n'était pas enregistrée dans les providers de `AuthModule`.

**Correction** :
- Ajout de `JwtStrategy` dans les imports de `AuthModule`
- Ajout de `JwtStrategy` dans les providers de `AuthModule`

**Fichier modifié** : `apps/api-server/src/auth/auth.module.ts`

```typescript
import { JwtStrategy } from './strategies/jwt.strategy';

// ...
providers: [
  // ...
  JwtStrategy, // ✅ Ajouté
  // ...
],
```

### 2. ✅ Mapping de Colonne Incorrect

**Erreur** : `la colonne User.password_hash n'existe pas`

**Cause** : L'entité TypeORM mappait `passwordHash` à `password_hash` (snake_case), mais la colonne dans la base de données s'appelle `passwordHash` (camelCase).

**Correction** :
- Changé `@Column({ name: 'password_hash' })` en `@Column({ name: 'passwordHash' })`

**Fichier modifié** : `apps/api-server/src/users/entities/user.entity.ts`

```typescript
@Column({ name: 'passwordHash' }) // ✅ Corrigé
passwordHash: string;
```

### 3. ✅ Guards Ignorant les Routes Publiques

**Problème** : Les guards `TenantValidationGuard` et `TenantIsolationGuard` bloquaient les routes publiques.

**Correction** : Ajout de la vérification des routes publiques dans les deux guards.

**Fichiers modifiés** :
- `apps/api-server/src/common/guards/tenant-validation.guard.ts`
- `apps/api-server/src/common/guards/tenant-isolation.guard.ts`

## 🚀 Action Requise : Redémarrer l'API

**IMPORTANT** : L'API doit être redémarrée pour que les modifications prennent effet.

```bash
# Arrêter l'API actuelle (Ctrl+C)
cd apps/api-server
npm run start:dev
```

## 🧪 Test du Login

Après redémarrage, tester le login :

```bash
# Test avec le script
cd apps/api-server
node test-login.js

# Ou avec cURL
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "s.akpovitohou@gmail.com",
    "password": "C@ptain.Yehioracadhub2021"
  }'
```

## ✅ Résultat Attendu

```json
{
  "user": {
    "id": "...",
    "email": "s.akpovitohou@gmail.com",
    "firstName": "...",
    "lastName": "...",
    "tenantId": "..."
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## 📝 Notes

- La compilation est réussie (530 fichiers compilés)
- Aucune erreur de linting
- Les guards ignorent maintenant les routes publiques
- La stratégie JWT est correctement enregistrée
- Le mapping de colonne correspond au schéma Prisma

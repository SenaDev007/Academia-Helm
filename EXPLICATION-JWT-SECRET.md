# 🔐 JWT_SECRET - Explication Complète

**Date** : 2025-01-17  
**Version** : 1.0.0

---

## 🎯 Qu'est-ce que JWT_SECRET ?

**JWT_SECRET** est une **clé secrète** utilisée pour **signer** et **vérifier** les tokens JWT (JSON Web Tokens) dans votre application Academia Hub.

---

## 🔑 Qu'est-ce qu'un JWT ?

**JWT (JSON Web Token)** est un standard d'authentification qui permet de transmettre des informations de manière sécurisée entre le client et le serveur.

### Structure d'un JWT

Un token JWT se compose de 3 parties séparées par des points (`.`) :

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

1. **Header** (En-tête) : Type de token et algorithme de signature
2. **Payload** (Corps) : Les données (ID utilisateur, email, rôles, etc.)
3. **Signature** : Signature cryptographique créée avec `JWT_SECRET`

---

## 🔒 À quoi sert JWT_SECRET ?

### 1. **Signature des Tokens** (Création)

Quand un utilisateur se connecte, le serveur crée un token JWT en utilisant `JWT_SECRET` pour le **signer** :

```typescript
// Dans auth.service.ts
const token = this.jwtService.sign({
  sub: user.id,
  email: user.email,
  tenantId: user.tenantId,
  roles: user.roles,
});
```

**Sans JWT_SECRET** : Impossible de créer des tokens valides.

### 2. **Vérification des Tokens** (Validation)

Quand le client envoie une requête avec un token, le serveur **vérifie** que le token est valide en utilisant le même `JWT_SECRET` :

```typescript
// Dans jwt.strategy.ts
super({
  secretOrKey: configService.get<string>('JWT_SECRET'),
});
```

**Sans JWT_SECRET** : Impossible de vérifier si un token est authentique.

### 3. **Sécurité**

Le `JWT_SECRET` garantit que :
- ✅ Seul votre serveur peut créer des tokens valides
- ✅ Les tokens ne peuvent pas être falsifiés
- ✅ Les tokens ne peuvent pas être modifiés sans être détectés

---

## 🛡️ Pourquoi c'est Important ?

### Scénario 1 : JWT_SECRET Faible ou Prédictible

**Problème** : Si quelqu'un devine votre `JWT_SECRET`, il peut :
- Créer des tokens JWT valides
- Se faire passer pour n'importe quel utilisateur
- Accéder à toutes les données de l'application

**Exemple** :
```env
# ❌ MAUVAIS - Trop simple
JWT_SECRET=secret123

# ❌ MAUVAIS - Mot de passe commun
JWT_SECRET=password

# ❌ MAUVAIS - Valeur par défaut
JWT_SECRET=your-secret-key-change-in-production
```

### Scénario 2 : JWT_SECRET Fort et Aléatoire

**Solution** : Un `JWT_SECRET` fort empêche :
- La création de tokens frauduleux
- L'accès non autorisé
- La falsification de données

**Exemple** :
```env
# ✅ BON - Long, aléatoire, complexe
JWT_SECRET=a7f3b9c2d4e6f8a1b3c5d7e9f0a2b4c6d8e0f2a4b6c8d0e2f4a6b8c0d2e4f6a8b
```

---

## 📝 Comment JWT_SECRET est Utilisé dans Academia Hub

### 1. Configuration (auth.module.ts)

```typescript
JwtModule.registerAsync({
  useFactory: async (configService: ConfigService) => ({
    secret: configService.get<string>('JWT_SECRET'),
    signOptions: {
      expiresIn: '24h', // Le token expire après 24 heures
    },
  }),
}),
```

### 2. Création de Tokens (auth.service.ts)

Quand un utilisateur se connecte :
```typescript
const tokens = this.generateTokens(user);
// Utilise JWT_SECRET pour signer le token
```

### 3. Vérification de Tokens (jwt.strategy.ts)

Quand une requête arrive avec un token :
```typescript
super({
  secretOrKey: configService.get<string>('JWT_SECRET'),
});
// Utilise JWT_SECRET pour vérifier la signature
```

---

## 🔐 Bonnes Pratiques

### ✅ À FAIRE

1. **Utiliser une clé longue et aléatoire**
   - Minimum 32 caractères
   - Mélange de lettres, chiffres, symboles
   - Générée de manière aléatoire

2. **Différentes clés pour chaque environnement**
   - `JWT_SECRET` différent en développement
   - `JWT_SECRET` différent en production
   - Jamais la même clé partout

3. **Ne jamais commiter dans Git**
   - Le `.env` doit être dans `.gitignore`
   - Utiliser des variables d'environnement système en production

4. **Changer régulièrement en production**
   - Rotation périodique (tous les 6-12 mois)
   - Invalider les anciens tokens lors du changement

### ❌ À NE PAS FAIRE

1. **Utiliser des valeurs simples**
   ```env
   # ❌ MAUVAIS
   JWT_SECRET=secret
   JWT_SECRET=123456
   JWT_SECRET=academia-hub
   ```

2. **Partager la même clé partout**
   ```env
   # ❌ MAUVAIS - Même clé en dev et prod
   JWT_SECRET=my-secret-key
   ```

3. **Commiter dans Git**
   ```bash
   # ❌ MAUVAIS - Ne jamais faire ça
   git add .env
   git commit -m "Add JWT_SECRET"
   ```

4. **Utiliser la valeur par défaut en production**
   ```env
   # ❌ MAUVAIS - Valeur par défaut
   JWT_SECRET=your-secret-key-change-in-production
   ```

---

## 🎲 Comment Générer un JWT_SECRET Fort

### Méthode 1 : Node.js

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Résultat** :
```
a7f3b9c2d4e6f8a1b3c5d7e9f0a2b4c6d8e0f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4a6b8c0d2e4f6a8b
```

### Méthode 2 : OpenSSL

```bash
openssl rand -hex 64
```

### Méthode 3 : En ligne

- [https://randomkeygen.com/](https://randomkeygen.com/)
- [https://www.grc.com/passwords.htm](https://www.grc.com/passwords.htm)

---

## 📋 Exemple de Configuration

### Développement

```env
# .env (développement)
JWT_SECRET=dev-secret-key-not-for-production-12345678901234567890
JWT_EXPIRES_IN=24h
```

### Production

```env
# .env (production)
JWT_SECRET=a7f3b9c2d4e6f8a1b3c5d7e9f0a2b4c6d8e0f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4a6b8c0d2e4f6a8b
JWT_EXPIRES_IN=7d
```

---

## 🔄 Que se passe-t-il si JWT_SECRET change ?

### Scénario : Changement de JWT_SECRET

1. **Anciens tokens** : Deviennent invalides (ne peuvent plus être vérifiés)
2. **Nouveaux tokens** : Créés avec le nouveau secret
3. **Utilisateurs** : Doivent se reconnecter pour obtenir un nouveau token

**Impact** : Tous les utilisateurs connectés seront déconnectés.

---

## 🎯 Résumé

| Aspect | Description |
|--------|-------------|
| **Quoi** | Clé secrète pour signer et vérifier les tokens JWT |
| **Pourquoi** | Sécuriser l'authentification et empêcher la falsification |
| **Où** | Dans le fichier `.env` (jamais dans Git) |
| **Comment** | Générer une clé aléatoire de 32+ caractères |
| **Quand** | Toujours, pour chaque environnement |

---

## ✅ Checklist

- [ ] `JWT_SECRET` est défini dans `.env`
- [ ] `JWT_SECRET` fait au moins 32 caractères
- [ ] `JWT_SECRET` est aléatoire et complexe
- [ ] `JWT_SECRET` est différent en dev et prod
- [ ] `.env` est dans `.gitignore`
- [ ] `JWT_SECRET` n'est jamais commité dans Git

---

**Dernière mise à jour** : 2025-01-17

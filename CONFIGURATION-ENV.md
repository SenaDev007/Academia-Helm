# ⚙️ Configuration des Fichiers .env - Academia Hub

**Date** : 2025-01-17  
**Version** : 1.0.0

---

## 📋 Vue d'Ensemble

Academia Hub nécessite **deux fichiers de configuration** :
1. **`apps/api-server/.env`** - Configuration du backend (API Server)
2. **`apps/web-app/.env.local`** - Configuration du frontend (Next.js)

---

## 🔧 Fichier 1 : `apps/api-server/.env`

### Configuration Minimale (Développement)

```env
# ============================================================================
# BASE DE DONNÉES
# ============================================================================
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/academia_hub
DIRECT_URL=postgresql://postgres:postgres@localhost:5432/academia_hub

# ============================================================================
# API SERVER
# ============================================================================
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3001
HOST=localhost

# ============================================================================
# JWT AUTHENTIFICATION
# ============================================================================
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
```

### Configuration Complète (Production)

```env
# ============================================================================
# BASE DE DONNÉES
# ============================================================================
DATABASE_URL=postgresql://user:password@host:5432/academia_hub
DIRECT_URL=postgresql://user:password@host:5432/academia_hub
DB_HOST=your-db-host
DB_PORT=5432
DB_USERNAME=your-db-user
DB_PASSWORD=your-db-password
DB_DATABASE=academia_hub
DB_SSL=true

# ============================================================================
# API SERVER
# ============================================================================
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://your-frontend-domain.com
HOST=0.0.0.0

# ============================================================================
# JWT AUTHENTIFICATION
# ============================================================================
JWT_SECRET=your-very-secure-secret-key-minimum-32-characters
JWT_EXPIRES_IN=7d

# ============================================================================
# PLATFORM OWNER (Développement uniquement)
# ============================================================================
PLATFORM_OWNER_EMAIL=dev@academia-hub.local
PLATFORM_OWNER_SECRET=C@ptain.Yehioracadhub2021

# ============================================================================
# LOGGING
# ============================================================================
LOG_SLOW_QUERIES=true
LOG_LEVEL=info

# ============================================================================
# INTÉGRATIONS (Optionnel)
# ============================================================================
# FedaPay
FEDAPAY_API_KEY=your-fedapay-api-key
FEDAPAY_SECRET_KEY=your-fedapay-secret-key
FEDAPAY_MODE=sandbox

# Twilio (SMS)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Email (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-email-password
SMTP_FROM=noreply@academia-hub.com
```

---

## 🌐 Fichier 2 : `apps/web-app/.env.local`

### Configuration Minimale (Développement)

```env
# ============================================================================
# API BACKEND
# ============================================================================
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api

# ============================================================================
# PORT (Optionnel - Next.js utilise 3000 par défaut)
# ============================================================================
PORT=3001
```

### Configuration Complète (Production)

```env
# ============================================================================
# API BACKEND
# ============================================================================
NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.com/api

# ============================================================================
# APPLICATION
# ============================================================================
NEXT_PUBLIC_APP_URL=https://your-frontend-domain.com
NEXT_PUBLIC_APP_NAME=Academia Hub

# ============================================================================
# ANALYTICS (Optionnel)
# ============================================================================
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

---

## 📝 Description des Variables

### Variables API Server (`apps/api-server/.env`)

#### Base de Données

| Variable | Description | Exemple | Requis |
|----------|-------------|---------|--------|
| `DATABASE_URL` | URL de connexion PostgreSQL (Prisma) | `postgresql://user:pass@host:5432/db` | ✅ Oui |
| `DIRECT_URL` | URL directe PostgreSQL (migrations) | `postgresql://user:pass@host:5432/db` | ✅ Oui |
| `DB_HOST` | Hôte de la base de données | `localhost` | ⚠️ Optionnel |
| `DB_PORT` | Port PostgreSQL | `5432` | ⚠️ Optionnel |
| `DB_USERNAME` | Nom d'utilisateur PostgreSQL | `postgres` | ⚠️ Optionnel |
| `DB_PASSWORD` | Mot de passe PostgreSQL | `postgres` | ⚠️ Optionnel |
| `DB_DATABASE` | Nom de la base de données | `academia_hub` | ⚠️ Optionnel |
| `DB_SSL` | Activer SSL pour PostgreSQL | `true` ou `false` | ⚠️ Optionnel |

#### API Server

| Variable | Description | Exemple | Requis |
|----------|-------------|---------|--------|
| `PORT` | Port d'écoute de l'API | `3000` | ✅ Oui |
| `NODE_ENV` | Environnement d'exécution | `development` ou `production` | ✅ Oui |
| `FRONTEND_URL` | URL du frontend (pour CORS) | `http://localhost:3001` | ✅ Oui |
| `HOST` | Hôte d'écoute | `localhost` ou `0.0.0.0` | ⚠️ Optionnel |

#### JWT

| Variable | Description | Exemple | Requis |
|----------|-------------|---------|--------|
| `JWT_SECRET` | Clé secrète pour signer les tokens JWT | `your-secret-key` | ✅ Oui |
| `JWT_EXPIRES_IN` | Durée de validité des tokens | `7d` | ⚠️ Optionnel |

#### Platform Owner (Développement)

| Variable | Description | Exemple | Requis |
|----------|-------------|---------|--------|
| `PLATFORM_OWNER_EMAIL` | Email du propriétaire de la plateforme | `dev@academia-hub.local` | ⚠️ Dev uniquement |
| `PLATFORM_OWNER_SECRET` | Secret pour authentification platform owner | `secret` | ⚠️ Dev uniquement |

#### Logging

| Variable | Description | Exemple | Requis |
|----------|-------------|---------|--------|
| `LOG_SLOW_QUERIES` | Logger les requêtes lentes | `true` ou `false` | ⚠️ Optionnel |
| `LOG_LEVEL` | Niveau de log | `info`, `warn`, `error` | ⚠️ Optionnel |

#### Intégrations

| Variable | Description | Exemple | Requis |
|----------|-------------|---------|--------|
| `FEDAPAY_API_KEY` | Clé API FedaPay | `your-key` | ⚠️ Optionnel |
| `FEDAPAY_SECRET_KEY` | Secret FedaPay | `your-secret` | ⚠️ Optionnel |
| `TWILIO_ACCOUNT_SID` | SID compte Twilio | `your-sid` | ⚠️ Optionnel |
| `TWILIO_AUTH_TOKEN` | Token Twilio | `your-token` | ⚠️ Optionnel |
| `SMTP_HOST` | Serveur SMTP | `smtp.gmail.com` | ⚠️ Optionnel |
| `SMTP_PORT` | Port SMTP | `587` | ⚠️ Optionnel |
| `SMTP_USER` | Utilisateur SMTP | `user@example.com` | ⚠️ Optionnel |
| `SMTP_PASSWORD` | Mot de passe SMTP | `password` | ⚠️ Optionnel |

---

### Variables Frontend (`apps/web-app/.env.local`)

#### API Backend

| Variable | Description | Exemple | Requis |
|----------|-------------|---------|--------|
| `NEXT_PUBLIC_API_BASE_URL` | URL de base de l'API backend | `http://localhost:3000/api` | ✅ Oui |

#### Application

| Variable | Description | Exemple | Requis |
|----------|-------------|---------|--------|
| `PORT` | Port d'écoute Next.js | `3001` | ⚠️ Optionnel |
| `NEXT_PUBLIC_APP_URL` | URL publique de l'application | `https://app.example.com` | ⚠️ Optionnel |
| `NEXT_PUBLIC_APP_NAME` | Nom de l'application | `Academia Hub` | ⚠️ Optionnel |

**⚠️ Important** : Les variables Next.js doivent commencer par `NEXT_PUBLIC_` pour être accessibles côté client.

---

## 🚀 Configuration Rapide (Développement)

### Étape 1 : Créer le fichier API Server

```bash
cd apps/api-server
cp ENV-EXAMPLE.txt .env
```

Puis éditer `.env` avec vos valeurs :

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/academia_hub
DIRECT_URL=postgresql://postgres:postgres@localhost:5432/academia_hub
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3001
JWT_SECRET=your-secret-key-change-in-production
```

### Étape 2 : Créer le fichier Frontend

```bash
cd apps/web-app
touch .env.local
```

Puis ajouter :

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
PORT=3001
```

---

## 🔒 Sécurité

### ⚠️ Règles Importantes

1. **Ne jamais commiter les fichiers `.env`** dans Git
   - Ajouter `.env` et `.env.local` au `.gitignore`

2. **Utiliser des secrets forts en production**
   - `JWT_SECRET` : Minimum 32 caractères, aléatoire
   - `DB_PASSWORD` : Mot de passe fort

3. **Variables sensibles**
   - Ne jamais exposer `JWT_SECRET`
   - Ne jamais exposer les mots de passe de base de données
   - Ne jamais exposer les clés API (FedaPay, Twilio, etc.)

4. **Environnements séparés**
   - `.env` pour le développement local
   - Variables d'environnement système pour la production
   - Ne jamais utiliser les mêmes secrets en dev et prod

---

## ✅ Checklist de Configuration

### API Server (`apps/api-server/.env`)

- [ ] `DATABASE_URL` configuré avec les bonnes credentials
- [ ] `DIRECT_URL` identique à `DATABASE_URL`
- [ ] `PORT` défini (3000 par défaut)
- [ ] `NODE_ENV` défini (`development` ou `production`)
- [ ] `FRONTEND_URL` défini (pour CORS)
- [ ] `JWT_SECRET` défini avec une valeur sécurisée
- [ ] `JWT_EXPIRES_IN` défini (optionnel, `7d` par défaut)

### Frontend (`apps/web-app/.env.local`)

- [ ] `NEXT_PUBLIC_API_BASE_URL` défini et pointe vers l'API
- [ ] `PORT` défini si différent de 3000 (3001 recommandé)

---

## 🐛 Dépannage

### Erreur : "DATABASE_URL is not defined"

**Solution** :
1. Vérifier que le fichier `.env` existe dans `apps/api-server/`
2. Vérifier que `DATABASE_URL` est bien défini
3. Redémarrer l'API Server

### Erreur : "CORS policy blocked"

**Solution** :
1. Vérifier que `FRONTEND_URL` dans `apps/api-server/.env` correspond à l'URL du frontend
2. En développement, vérifier que c'est bien `http://localhost:3001`

### Erreur : "Cannot connect to API"

**Solution** :
1. Vérifier que `NEXT_PUBLIC_API_BASE_URL` dans `apps/web-app/.env.local` est correct
2. Vérifier que l'API Server est démarré sur le bon port
3. Vérifier que l'URL se termine par `/api`

---

## 📚 Exemples par Environnement

### Développement Local

**`apps/api-server/.env`** :
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/academia_hub
DIRECT_URL=postgresql://postgres:postgres@localhost:5432/academia_hub
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3001
JWT_SECRET=dev-secret-key-not-for-production
```

**`apps/web-app/.env.local`** :
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
PORT=3001
```

### Production

**`apps/api-server/.env`** :
```env
DATABASE_URL=postgresql://user:password@db-host:5432/academia_hub
DIRECT_URL=postgresql://user:password@db-host:5432/academia_hub
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://app.academia-hub.com
JWT_SECRET=very-secure-random-secret-minimum-32-characters
DB_SSL=true
```

**`apps/web-app/.env.local`** :
```env
NEXT_PUBLIC_API_BASE_URL=https://api.academia-hub.com/api
NEXT_PUBLIC_APP_URL=https://app.academia-hub.com
```

---

## 🎯 Résumé Rapide

**Fichiers à créer** :
1. `apps/api-server/.env` - Configuration backend
2. `apps/web-app/.env.local` - Configuration frontend

**Variables minimales requises** :

**API Server** :
- `DATABASE_URL`
- `DIRECT_URL`
- `PORT`
- `NODE_ENV`
- `FRONTEND_URL`
- `JWT_SECRET`

**Frontend** :
- `NEXT_PUBLIC_API_BASE_URL`

---

**Dernière mise à jour** : 2025-01-17

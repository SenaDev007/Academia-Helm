# 🚀 Ordre de Démarrage de l'Application Academia Hub

**Date** : 2025-01-17  
**Version** : 1.0.0

---

## 📋 Vue d'Ensemble

L'application Academia Hub suit un **ordre de démarrage séquentiel strict** pour garantir que tous les services démarrent correctement :

```
1. PostgreSQL (Base de données)
   ↓
2. Migrations Prisma
   ↓
3. API Server (NestJS)
   ↓
4. Frontend (Next.js)
```

---

## 🔄 Ordre de Démarrage Détaillé

### Étape 1 : PostgreSQL (Base de données)

**Statut** : ⚠️ **PRÉREQUIS** (doit être démarré avant)

**Port** : `5432`  
**Base de données** : `academia_helm`

**Vérification** :
- **Linux/Mac** : `pg_isready -h localhost -p 5432`
- **Windows** : Vérifier le service PostgreSQL dans "Services" (services.msc)

**Démarrage manuel si nécessaire** :
- **Linux** : `sudo systemctl start postgresql`
- **Mac** : `brew services start postgresql`
- **Windows** : Démarrer le service PostgreSQL dans "Services"

**Durée** : ~2-5 secondes (si déjà démarré)

---

### Étape 2 : Migrations Prisma

**Statut** : ✅ **AUTOMATIQUE** (exécuté par le script de démarrage)

**Commande** : `npx prisma migrate deploy`  
**Emplacement** : `apps/api-server/`

**Actions** :
1. Vérifie le schéma Prisma (`prisma/schema.prisma`)
2. Applique les migrations en attente
3. Synchronise le schéma avec la base de données

**Durée** : ~5-15 secondes (selon le nombre de migrations)

**Logs** :
```
✅ Migrations appliquées
```

---

### Étape 3 : API Server (NestJS)

**Statut** : ✅ **AUTOMATIQUE** (démarre après les migrations)

**Port** : `3000`  
**Préfixe API** : `/api`  
**URL** : `http://localhost:3000/api`

**Commande** : `npm run start:dev`  
**Emplacement** : `apps/api-server/`

**Processus de démarrage** :

1. **Initialisation NestJS** (~3-5 secondes)
   - Chargement des modules
   - Injection des dépendances
   - Configuration des guards et interceptors

2. **Connexion à la base de données** (~1-2 secondes)
   - Connexion Prisma à PostgreSQL
   - Vérification de la connexion

3. **Démarrage du serveur HTTP** (~1 seconde)
   - Écoute sur le port 3000
   - Configuration CORS
   - Configuration des pipes de validation

**Health Check** :
- **Endpoint** : `http://localhost:3000/api/health`
- **Vérification** : Le script attend que cet endpoint réponde avec `{"status":"ok"}`

**Durée totale** : ~10-20 secondes

**Logs attendus** :
```
🚀 Academia Hub API Server is running on: http://localhost:3000/api
```

**Vérification** :
```bash
curl http://localhost:3000/api/health
# Réponse attendue: {"status":"ok","database":"connected"}
```

---

### Étape 4 : Frontend (Next.js)

**Statut** : ✅ **AUTOMATIQUE** (démarre après que l'API soit prête)

**Port** : `3001`  
**URL** : `http://localhost:3001`

**Commande** : `npm run dev`  
**Emplacement** : `apps/web-app/`

**Processus de démarrage** :

1. **Compilation Next.js** (~10-30 secondes)
   - Compilation TypeScript
   - Optimisation des assets
   - Préparation des routes

2. **Démarrage du serveur de développement** (~2-3 secondes)
   - Écoute sur le port 3001
   - Hot Module Replacement (HMR) activé

**Durée totale** : ~15-35 secondes

**Logs attendus** :
```
▲ Next.js 14.2.0
- Local:        http://localhost:3001
- Ready in X seconds
```

---

## 📊 Timeline Complète

```
T+0s    : Démarrage du script
T+2s    : ✅ PostgreSQL vérifié
T+5s    : ✅ Migrations appliquées
T+10s   : ⏳ API Server en cours de démarrage
T+25s   : ✅ API Server prêt (health check OK)
T+30s   : ⏳ Frontend en cours de compilation
T+60s   : ✅ Frontend prêt
```

**Durée totale estimée** : **~60-90 secondes**

---

## 🛠️ Scripts de Démarrage

### Windows (`start-dev.bat`)

```cmd
@echo off
REM 1. Vérification PostgreSQL
REM 2. Application des migrations
REM 3. Démarrage API Server (fenêtre séparée)
REM 4. Attente health check API
REM 5. Démarrage Frontend (fenêtre séparée)
```

**Usage** :
```cmd
start-dev.bat
```

### Linux/Mac (`start-dev.sh`)

```bash
#!/bin/bash
# 1. Vérification PostgreSQL
# 2. Application des migrations
# 3. Démarrage API Server (arrière-plan)
# 4. Attente health check API (30 tentatives max)
# 5. Démarrage Frontend (arrière-plan)
```

**Usage** :
```bash
chmod +x start-dev.sh
./start-dev.sh
```

---

## 🔍 Vérifications à Chaque Étape

### Étape 1 : PostgreSQL

**Vérification** :
```bash
# Linux/Mac
pg_isready -h localhost -p 5432

# Windows
# Vérifier dans "Services" (services.msc)
```

**Si échec** :
- ❌ Erreur : "PostgreSQL n'est pas accessible"
- ✅ Solution : Démarrer PostgreSQL manuellement

---

### Étape 2 : Migrations

**Vérification** :
```bash
cd apps/api-server
npx prisma migrate status
```

**Si échec** :
- ❌ Erreur : "Schema Prisma non trouvé"
- ✅ Solution : Vérifier que `prisma/schema.prisma` existe

---

### Étape 3 : API Server

**Vérification** :
```bash
# Health check
curl http://localhost:3000/api/health

# Réponse attendue
{"status":"ok","database":"connected"}
```

**Si échec** :
- ❌ Erreur : "API Server n'a pas démarré dans les temps"
- ✅ Solutions :
  1. Vérifier les logs : `tail -f /tmp/academia-hub/api-server.log` (Linux/Mac)
  2. Vérifier que le port 3000 n'est pas utilisé
  3. Vérifier le fichier `.env` dans `apps/api-server/`
  4. Vérifier la connexion à PostgreSQL

**Logs à vérifier** :
```bash
# Linux/Mac
tail -f /tmp/academia-hub/api-server.log

# Windows
# Voir la fenêtre "Academia Hub - API Server"
```

---

### Étape 4 : Frontend

**Vérification** :
```bash
# Ouvrir dans le navigateur
http://localhost:3001
```

**Si échec** :
- ❌ Erreur : Frontend ne démarre pas
- ✅ Solutions :
  1. Vérifier que le port 3001 n'est pas utilisé
  2. Vérifier le fichier `.env.local` dans `apps/web-app/`
  3. Vérifier que l'API est accessible (`NEXT_PUBLIC_API_BASE_URL`)

**Logs à vérifier** :
```bash
# Linux/Mac
tail -f /tmp/academia-hub/frontend.log

# Windows
# Voir la fenêtre "Academia Hub - Frontend"
```

---

## 🐳 Démarrage avec Docker

Si vous utilisez Docker, l'ordre de démarrage est géré par `docker-compose.dev.yml` :

```yaml
services:
  postgres:
    # Démarre en premier
    healthcheck: ...
  
  api-server:
    depends_on:
      postgres:
        condition: service_healthy  # ✅ Attend PostgreSQL
    healthcheck: ...
  
  frontend:
    depends_on:
      api-server:
        condition: service_healthy  # ✅ Attend l'API
```

**Ordre Docker** :
1. PostgreSQL (avec health check)
2. API Server (attend PostgreSQL)
3. Frontend (attend l'API)

**Commande** :
```bash
docker-compose -f docker-compose.dev.yml up
```

---

## ⚙️ Configuration Requise

### Variables d'Environnement API (`apps/api-server/.env`)

```env
# Base de données
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/academia_helm
DIRECT_URL=postgresql://postgres:postgres@localhost:5432/academia_helm

# API
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3001

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
```

### Variables d'Environnement Frontend (`apps/web-app/.env.local`)

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
```

---

## 🛑 Arrêt de l'Application

### Windows

Fermer les fenêtres :
- "Academia Hub - API Server"
- "Academia Hub - Frontend"

### Linux/Mac

Appuyer sur **Ctrl+C** dans le terminal où le script tourne.

Le script arrêtera automatiquement :
- API Server (PID stocké)
- Frontend (PID stocké)

---

## 📝 Checklist de Démarrage

Avant de démarrer, vérifier :

- [ ] PostgreSQL est démarré et accessible sur le port 5432
- [ ] Base de données `academia_helm` existe
- [ ] Fichier `.env` dans `apps/api-server/` configuré
- [ ] Fichier `.env.local` dans `apps/web-app/` configuré
- [ ] Dépendances installées (`npm install` dans chaque dossier)
- [ ] Être dans le dossier racine du projet
- [ ] Ports 3000 et 3001 disponibles

---

## 🎯 Résumé Rapide

**Ordre de démarrage** :
1. ✅ PostgreSQL (prérequis)
2. ✅ Migrations Prisma (automatique)
3. ✅ API Server sur port 3000 (automatique)
4. ✅ Frontend sur port 3001 (automatique)

**Commande unique** :
```bash
# Windows
start-dev.bat

# Linux/Mac
./start-dev.sh
```

**Durée totale** : ~60-90 secondes

---

**Dernière mise à jour** : 2025-01-17

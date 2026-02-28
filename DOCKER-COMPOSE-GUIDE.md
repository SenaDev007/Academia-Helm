# 🐳 Guide Docker Compose - Academia Hub

**Date** : 2025-01-17  
**Version** : 1.0.0

---

## 📋 Table des Matières

1. [Prérequis](#prérequis)
2. [Démarrage Rapide (développement)](#démarrage-rapide)
3. [Production (Docker Compose prod)](#production-docker-compose-prod)
4. [Commandes Utiles](#commandes-utiles)
5. [Configuration](#configuration)
6. [Dépannage](#dépannage)

---

## ✅ Prérequis

### Installation Docker

- **Windows** : [Docker Desktop](https://www.docker.com/products/docker-desktop)
- **Mac** : [Docker Desktop](https://www.docker.com/products/docker-desktop)
- **Linux** : 
  ```bash
  sudo apt-get update
  sudo apt-get install docker.io docker-compose
  ```

### Vérification

```bash
docker --version
docker-compose --version
```

---

## 🚀 Démarrage Rapide

### 1. Démarrer tous les services

```bash
docker-compose -f docker-compose.dev.yml up
```

### 2. Démarrer en arrière-plan

```bash
docker-compose -f docker-compose.dev.yml up -d
```

### 3. Voir les logs

```bash
# Tous les services
docker-compose -f docker-compose.dev.yml logs -f

# Un service spécifique
docker-compose -f docker-compose.dev.yml logs -f api-server
docker-compose -f docker-compose.dev.yml logs -f frontend
docker-compose -f docker-compose.dev.yml logs -f postgres
```

### 4. Arrêter les services

```bash
# Arrêter (garder les données)
docker-compose -f docker-compose.dev.yml down

# Arrêter et supprimer les volumes (⚠️ supprime les données)
docker-compose -f docker-compose.dev.yml down -v
```

---

## 🚀 Production (Docker Compose prod)

Pour déployer en production avec Docker (VPS, serveur dédié) :

1. **Copier et éditer le fichier d'environnement** :
   ```bash
   cp .env.docker.example .env
   ```
   Renseigner au minimum : `POSTGRES_PASSWORD`, `JWT_SECRET`, et les URLs publiques (`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL`).

2. **Construire et démarrer** :
   ```bash
   npm run docker:prod:build
   npm run docker:prod:up
   ```
   Ou : `docker compose -f docker-compose.prod.yml up -d`

3. **Ports** : frontend (3001), API (3000), PostgreSQL (5432). Mettre un reverse proxy (Nginx/Caddy) devant et activer le SSL. Voir aussi [docs/HEBERGEMENT-OVH.md](docs/HEBERGEMENT-OVH.md).

---

## 📊 Services Disponibles

| Service | Port | URL | Description |
|---------|------|-----|-------------|
| PostgreSQL | 5432 | `postgresql://localhost:5432/academia_helm` | Base de données |
| API Server | 3000 | `http://localhost:3000/api` | Backend NestJS |
| Frontend | 3001 | `http://localhost:3001` | Frontend Next.js |

---

## 🔧 Commandes Utiles

### Vérifier l'état des services

```bash
docker-compose -f docker-compose.dev.yml ps
```

### Redémarrer un service

```bash
docker-compose -f docker-compose.dev.yml restart api-server
docker-compose -f docker-compose.dev.yml restart frontend
```

### Reconstruire les images

```bash
# Reconstruire toutes les images
docker-compose -f docker-compose.dev.yml build

# Reconstruire un service spécifique
docker-compose -f docker-compose.dev.yml build api-server
```

### Accéder au shell d'un conteneur

```bash
# API Server
docker-compose -f docker-compose.dev.yml exec api-server sh

# PostgreSQL
docker-compose -f docker-compose.dev.yml exec postgres psql -U postgres -d academia_helm
```

### Appliquer les migrations Prisma

```bash
docker-compose -f docker-compose.dev.yml exec api-server npx prisma migrate deploy
```

### Générer le client Prisma

```bash
docker-compose -f docker-compose.dev.yml exec api-server npx prisma generate
```

---

## ⚙️ Configuration

### Variables d'Environnement

Les variables d'environnement sont définies dans `docker-compose.dev.yml`.

Pour les modifier, éditez le fichier ou créez un `.env` :

```bash
# .env
JWT_SECRET=your-secret-key
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/academia_helm
```

### Ports

Pour changer les ports, modifiez `docker-compose.dev.yml` :

```yaml
ports:
  - "3000:3000"  # Format: "HOST:CONTAINER"
```

---

## 🔍 Dépannage

### Problème : Port déjà utilisé

```bash
# Vérifier quel processus utilise le port
# Windows
netstat -ano | findstr :3000

# Linux/Mac
lsof -i :3000

# Arrêter le processus ou changer le port dans docker-compose.dev.yml
```

### Problème : Erreur de connexion à la base de données

```bash
# Vérifier que PostgreSQL est démarré
docker-compose -f docker-compose.dev.yml ps postgres

# Voir les logs PostgreSQL
docker-compose -f docker-compose.dev.yml logs postgres

# Vérifier la connexion
docker-compose -f docker-compose.dev.yml exec postgres psql -U postgres -d academia_helm -c "SELECT 1;"
```

### Problème : Les migrations ne s'appliquent pas

```bash
# Appliquer manuellement les migrations
docker-compose -f docker-compose.dev.yml exec api-server npx prisma migrate deploy

# Réinitialiser la base de données (⚠️ supprime les données)
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d postgres
docker-compose -f docker-compose.dev.yml exec api-server npx prisma migrate deploy
```

### Problème : Les changements de code ne sont pas pris en compte

Les volumes montent le code local, donc les changements devraient être visibles immédiatement.

Si ce n'est pas le cas :

```bash
# Redémarrer le service
docker-compose -f docker-compose.dev.yml restart api-server
```

### Problème : Erreur "Cannot connect to Docker daemon"

```bash
# Vérifier que Docker est démarré
docker ps

# Si erreur, démarrer Docker Desktop (Windows/Mac)
# Ou démarrer le service Docker (Linux)
sudo systemctl start docker
```

---

## 📝 Notes Importantes

### Données Persistantes

Les données PostgreSQL sont stockées dans un volume Docker nommé `postgres_data`.

Pour sauvegarder :
```bash
docker-compose -f docker-compose.dev.yml exec postgres pg_dump -U postgres academia_helm > backup.sql
```

Pour restaurer :
```bash
docker-compose -f docker-compose.dev.yml exec -T postgres psql -U postgres academia_helm < backup.sql
```

### Performance

En développement, les volumes montent le code local pour le hot-reload.

En production, utilisez des images optimisées sans volumes de développement.

### Sécurité

⚠️ **Ne jamais utiliser cette configuration en production !**

- Mots de passe en dur
- Pas de SSL/TLS
- Logs de debug activés
- Ports exposés publiquement

---

## 🎯 Workflow Recommandé

### Développement Quotidien

```bash
# 1. Démarrer les services
docker-compose -f docker-compose.dev.yml up -d

# 2. Voir les logs
docker-compose -f docker-compose.dev.yml logs -f

# 3. Développer normalement (hot-reload activé)

# 4. Arrêter en fin de journée
docker-compose -f docker-compose.dev.yml down
```

### Nouveau Développeur

```bash
# 1. Cloner le repo
git clone <repo>
cd academia-hub

# 2. Démarrer avec Docker Compose
docker-compose -f docker-compose.dev.yml up

# 3. C'est tout ! Tout fonctionne immédiatement
```

---

## 📚 Ressources

- [Documentation Docker Compose](https://docs.docker.com/compose/)
- [Documentation Prisma](https://www.prisma.io/docs)
- [Documentation NestJS](https://docs.nestjs.com/)
- [Documentation Next.js](https://nextjs.org/docs)

---

**Dernière mise à jour** : 2026-02-14 — ajout Docker production (Dockerfile, docker-compose.prod.yml, .env.docker.example).

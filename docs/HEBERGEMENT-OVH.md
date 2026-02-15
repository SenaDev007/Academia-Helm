# Hébergement OVH — Academia Hub

Ce document décrit la configuration pour héberger le frontend Academia Hub sur **academia-hub.pro** (domaine OVH) et l’API + base de données sur OVH.

---

## Vue d’ensemble

- **Domaine** : academia-hub.pro (acheté chez [OVH Cloud](https://www.ovhcloud.com))
- **Frontend** : application Next.js (PWA) hébergée sur un hébergement web OVH ou un VPS OVH
- **API** : NestJS (à héberger sur un VPS ou instance dédiée OVH)
- **Base de données** : PostgreSQL (offre base managée OVH ou instance sur VPS)

---

## 1. Variables d’environnement — Frontend (web-app)

À configurer sur l’hébergeur du frontend (ou dans `.env.local` en local).

### Production (academia-hub.pro)

```env
# Application
NEXT_PUBLIC_APP_URL=https://academia-hub.pro
NEXT_PUBLIC_BASE_DOMAIN=academia-hub.pro

# API Backend (à adapter selon votre déploiement API)
# Exemple : API sur le même domaine (reverse proxy) ou sous-domaine
NEXT_PUBLIC_API_URL=https://api.academia-hub.pro/api
# OU si l’API est sur le même serveur derrière un reverse proxy :
# NEXT_PUBLIC_API_URL=https://academia-hub.pro/api

NEXT_PUBLIC_ENV=production
NEXT_PUBLIC_PLATFORM=web
```

### Développement local

```env
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_BASE_DOMAIN=localhost:3001
NEXT_PUBLIC_API_URL=http://127.0.0.1:3000/api
NEXT_PUBLIC_ENV=local
```

---

## 2. Déploiement du frontend (Next.js)

### Comprendre le procédé en deux étapes

Le déploiement se fait en **deux temps** :

| Étape | Outil | Rôle |
|-------|--------|------|
| **1. Envoyer les fichiers** | **FileZilla** (FTP/SFTP) | Transférer le contenu du dossier `standalone` (dont `server.js`, `node_modules`, `public`) vers le serveur. FileZilla **ne fait qu'envoyer des fichiers** — il ne peut pas lancer de programme. |
| **2. Démarrer l'application** | **SSH** (terminal) | Se connecter au serveur en ligne de commande et exécuter `node server.js`. **Sans cette étape, le site ne tourne pas** : les fichiers sont présents mais aucun processus Node.js ne répond. |

**En résumé** : FileZilla = copie des fichiers sur le serveur. Pour que le site soit en ligne, il faut **en plus** se connecter en SSH et lancer `node server.js` (ou PM2).

**Prérequis** : Un **VPS OVH** (ou un hébergement avec Node.js **et** accès SSH). Un hébergement web « classique » (PHP seul, sans SSH) ne permet pas d'exécuter Node.js.

---

### Déploiement avec FileZilla puis exécution de `node server.js`

*(Voir la section « Comprendre le procédé en deux étapes » ci-dessus pour le rôle de FileZilla vs SSH.)*

**Prérequis** : VPS ou hébergement avec Node.js et SSH (voir ci-dessus).

#### Étape 1 — Préparer les fichiers en local

Après `npm run build` dans `apps/web-app` :

1. Dossier à envoyer :
   - **Contenu de** `apps/web-app/.next/standalone/` : tout ce qu’il y a dedans (dont `server.js`, `node_modules`, `.next`, etc.).
2. À la même racine que `server.js`, copier le dossier **static** :
   - Copier `apps/web-app/public` vers `standalone/public` (ou, selon la structure, le contenu de `apps/web-app/.next/static` doit déjà être dans `standalone/.next/static` ; Next met aussi les assets publics à servir dans `standalone/public` si vous les y copiez).

En pratique Next.js standalone attend que les fichiers statiques soient dans un dossier `public` à côté de `server.js`. Vérifiez dans `.next/standalone` : s’il n’y a pas de `public`, copiez-y `apps/web-app/public` (images, favicon, etc.).

#### Étape 2 — Envoyer les fichiers avec FileZilla

1. Connexion : **FTP** ou **SFTP** (préférable) avec l’hôte, l’utilisateur et le mot de passe fournis par OVH pour votre VPS ou hébergement.
2. Côté serveur : aller dans le répertoire où doit tourner le site (ex. `~/academia-hub` ou `/var/www/academia-hub`).
3. Envoyer tout le contenu de votre dossier **standalone** (dont `server.js`, `node_modules`, `.next`, `public` si vous l’avez ajouté).

#### Étape 3 — Exécuter `node server.js` (obligatoirement en SSH)

FileZilla ne lance pas de commandes. Il faut ouvrir un **terminal** et se connecter en **SSH** au serveur :

1. **Connexion SSH** (depuis Windows : PowerShell, CMD, ou outil comme PuTTY) :
   ```bash
   ssh utilisateur@votre-serveur.academia-hub.pro
   ```
   (Remplacez `utilisateur` et `votre-serveur` par les identifiants OVH.)

2. **Aller dans le dossier où vous avez envoyé les fichiers** (celui qui contient `server.js`) :
   ```bash
   cd ~/academia-hub
   # ou
   cd /var/www/academia-hub
   ```

3. **Vérifier que Node.js est installé** :
   ```bash
   node -v
   ```
   Si ce n’est pas le cas, installez Node.js (LTS) sur le VPS (voir doc OVH ou nvm).

4. **Lancer l’application** :
   ```bash
   node server.js
   ```
   L’app écoute par défaut sur le port **3000** (standalone Next.js). Pour un autre port, Next lit la variable d’environnement `PORT` (ex. `PORT=3001 node server.js`).

5. **En production** : ne pas laisser la commande dans le terminal SSH (elle s’arrête à la déconnexion). Utiliser un **gestionnaire de processus** :
   ```bash
   npm install -g pm2
   pm2 start server.js --name "academia-hub-web"
   pm2 save
   pm2 startup
   ```
   Ainsi l’app redémarre après un reboot. Ensuite, configurer Nginx (ou Caddy) en reverse proxy vers `http://127.0.0.1:3000` (ou le port choisi) et activer le SSL.

**Résumé** : FileZilla = envoi des fichiers ; **exécution de `node server.js` = uniquement possible en SSH** (ou via un script/CRON/panel qui exécute des commandes sur le serveur).

---

### Option A : Hébergement web OVH (PHP / Node si disponible)

- Vérifier que l’hébergement supporte **Node.js** (sinon privilégier un VPS).
- Build en local : `cd apps/web-app && npm run build`
- Le dossier `apps/web-app/.next/standalone` (après build) contient l’app + `node_modules` nécessaires. Déployer ce contenu + le dossier `static` selon la doc OVH (ex. via FTP/SFTP ou Git + script de déploiement).
- Démarrer avec : `node server.js` (à configurer comme service ou via la console OVH si Node est disponible).

### Option B : VPS OVH (recommandé pour Next.js)

1. Créer un VPS (ex. VPS Value ou supérieur) sur [OVH Cloud](https://www.ovhcloud.com).
2. Installer Node.js (LTS) et éventuellement un reverse proxy (Nginx/Caddy).
3. Cloner le dépôt, installer les dépendances, build :
   ```bash
   cd apps/web-app && npm ci && npm run build
   ```
4. Lancer en production : `npm start` (écoute sur le port 3001 par défaut) ou utiliser le binaire standalone :
   ```bash
   cd .next/standalone && node server.js
   ```
5. Configurer Nginx (ou Caddy) pour :
   - écouter sur 80/443 pour `academia-hub.pro` ;
   - proxy vers `http://127.0.0.1:3001`.
6. Configurer le SSL (Let’s Encrypt) via OVH ou Certbot.

---

### Option C : Docker (VPS ou serveur avec Docker)

Sur un VPS où Docker et Docker Compose sont installés, vous pouvez déployer toute la stack (PostgreSQL, API, frontend) avec les fichiers de production :

1. **Préparer les variables d'environnement** :
   ```bash
   cp .env.docker.example .env
   # Éditer .env : POSTGRES_PASSWORD, JWT_SECRET, NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_API_URL
   ```

2. **Construire et lancer** :
   ```bash
   npm run docker:prod:build
   npm run docker:prod:up
   ```
   Ou directement : `docker compose -f docker-compose.prod.yml up -d`

3. **Ports exposés** : frontend `3001`, API `3000`, PostgreSQL `5432`. Configurer Nginx (ou Caddy) en reverse proxy vers le frontend (port 3001) et l'API (port 3000), puis activer le SSL.

4. **Détails** : voir le guide [DOCKER-COMPOSE-GUIDE.md](../DOCKER-COMPOSE-GUIDE.md) (développement et production).

---

## 3. Base de données PostgreSQL (OVH)

- **Base managée OVH** : créer une instance PostgreSQL dans l’espace client OVH, récupérer l’URL de connexion (host, port, user, password, database).
- **VPS** : installer PostgreSQL sur le VPS et créer une base dédiée à l’API.

Variables pour l’**API** (NestJS), dans `apps/api-server/.env` :

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
DIRECT_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
```

Remplacer `USER`, `PASSWORD`, `HOST`, `DATABASE` par les valeurs fournies par OVH (ou votre installation VPS).

---

## 4. DNS (domaine academia-hub.pro)

Dans la zone DNS OVH du domaine :

- **Frontend** :
  - `academia-hub.pro` → A ou CNAME vers l’IP ou l’hébergement du frontend.
  - `www.academia-hub.pro` → redirection ou CNAME vers `academia-hub.pro` (recommandé).
- **API** (si sous-domaine dédié) :
  - `api.academia-hub.pro` → A ou CNAME vers l’IP du serveur API.

---

## 5. Multi-tenant (sous-domaines)

Si vous utilisez des sous-domaines par école (ex. `ecole1.academia-hub.pro`) :

1. Dans la zone DNS : enregistrement **wildcard** `*.academia-hub.pro` → même IP que le frontend (ou même serveur).
2. Le middleware Next.js résout déjà le tenant via le sous-domaine et l’API `/tenants/by-subdomain/:subdomain`.
3. Vérifier que `NEXT_PUBLIC_APP_URL` et `NEXT_PUBLIC_BASE_DOMAIN` correspondent au domaine principal (ex. `academia-hub.pro`) pour les redirections.

---

## 6. Checklist déploiement

- [ ] Domaine academia-hub.pro pointant vers l’hébergement frontend
- [ ] Variables d’environnement production configurées (sans Supabase / Vercel)
- [ ] Build Next.js : `npm run build` dans `apps/web-app`
- [ ] API NestJS déployée et accessible (URL cohérente avec `NEXT_PUBLIC_API_URL`)
- [ ] Base PostgreSQL OVH créée et `DATABASE_URL` / `DIRECT_URL` configurés dans l’API
- [ ] SSL (HTTPS) activé pour academia-hub.pro (et api.academia-hub.pro si utilisé)
- [ ] Si déploiement Docker : `.env` rempli à partir de `.env.docker.example`, puis `docker compose -f docker-compose.prod.yml up -d`
- [ ] Tests : login, multi-tenant, appels API

---

**Dernière mise à jour** : après nettoyage Vercel / Supabase — hébergement prévu sur OVH (academia-hub.pro).

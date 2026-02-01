# 🔧 CONFIGURATION BASE DE DONNÉES - GUIDE RAPIDE

## ❌ Erreur Actuelle

```
error: authentification par mot de passe échouée pour l'utilisateur 'postgres'
```

## ✅ Solution

### 1. Créer le fichier `.env`

Créez un fichier `.env` dans `apps/api-server/` avec la configuration suivante :

```env
# ============================================================================
# CONFIGURATION BASE DE DONNÉES
# ============================================================================
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=VOTRE_MOT_DE_PASSE_POSTGRES
DB_DATABASE=academia_hub

# OU utiliser DATABASE_URL (format complet)
DATABASE_URL=postgresql://postgres:VOTRE_MOT_DE_PASSE_POSTGRES@localhost:5432/academia_hub
```

### 2. Vérifier les Credentials PostgreSQL

#### Option A : Utiliser pgAdmin 4
1. Ouvrez pgAdmin 4
2. Connectez-vous avec votre mot de passe PostgreSQL
3. Vérifiez que l'utilisateur `postgres` existe et a les bonnes permissions

#### Option B : Réinitialiser le mot de passe PostgreSQL

**Windows (via Services)** :
1. Ouvrez "Services" (services.msc)
2. Trouvez "postgresql-x64-XX" (où XX est la version)
3. Arrêtez le service
4. Modifiez le fichier `pg_hba.conf` (généralement dans `C:\Program Files\PostgreSQL\XX\data\`)
5. Changez `md5` en `trust` pour la ligne `host all all 127.0.0.1/32`
6. Redémarrez le service PostgreSQL
7. Connectez-vous sans mot de passe : `psql -U postgres`
8. Changez le mot de passe : `ALTER USER postgres WITH PASSWORD 'nouveau_mot_de_passe';`
9. Remettez `md5` dans `pg_hba.conf`
10. Redémarrez le service

**Via ligne de commande** :
```bash
# Se connecter à PostgreSQL
psql -U postgres

# Changer le mot de passe
ALTER USER postgres WITH PASSWORD 'votre_nouveau_mot_de_passe';
```

### 3. Créer la Base de Données

```bash
# Se connecter à PostgreSQL
psql -U postgres

# Créer la base de données
CREATE DATABASE academia_hub;

# Vérifier
\l
```

### 4. Exécuter les Migrations Prisma

```bash
cd apps/api-server

# Générer le client Prisma
npx prisma generate

# Appliquer les migrations
npx prisma migrate deploy
# OU pour le développement
npx prisma migrate dev
```

### 5. Vérifier la Connexion

```bash
# Tester la connexion
npx prisma db pull
```

## 🔍 Vérification

Une fois configuré, redémarrez l'API :

```bash
cd apps/api-server
npm run start:dev
```

Vous devriez voir :
```
✅ Prisma connected with connection pooling
✅ Database connection verified
```

## ⚠️ Notes Importantes

1. **Sécurité** : Ne commitez JAMAIS le fichier `.env` dans Git
2. **Format DATABASE_URL** : `postgresql://username:password@host:port/database`
3. **Port par défaut** : PostgreSQL utilise le port `5432` par défaut
4. **Utilisateur par défaut** : `postgres` est l'utilisateur super-admin par défaut

## 🆘 Dépannage

### Erreur : "database does not exist"
```bash
psql -U postgres
CREATE DATABASE academia_hub;
```

### Erreur : "password authentication failed"
- Vérifiez le mot de passe dans `.env`
- Vérifiez que l'utilisateur `postgres` existe
- Réinitialisez le mot de passe (voir Option B ci-dessus)

### Erreur : "connection refused"
- Vérifiez que PostgreSQL est démarré
- Vérifiez le port (par défaut 5432)
- Vérifiez le host (localhost ou 127.0.0.1)

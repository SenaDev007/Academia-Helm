# 🚀 CORRECTION RAPIDE - ERREUR POSTGRESQL

## ✅ Variables DB ajoutées

Les variables de base de données ont été ajoutées au fichier `.env` avec des valeurs par défaut.

## ⚠️ ACTION REQUISE

**Modifiez le mot de passe PostgreSQL dans `.env`** :

```env
DB_PASSWORD=VOTRE_VRAI_MOT_DE_PASSE_POSTGRES
```

## 🧪 Tester la connexion

```bash
cd apps/api-server
npm run test:db
```

Ce script va :
- ✅ Tester la connexion PostgreSQL
- ✅ Afficher la version PostgreSQL
- ✅ Vérifier que la base de données existe

## 📝 Si le test échoue

### 1. Vérifier le mot de passe PostgreSQL

**Option A : Via pgAdmin 4**
- Ouvrez pgAdmin 4
- Connectez-vous avec votre mot de passe
- Notez le mot de passe utilisé

**Option B : Réinitialiser le mot de passe**
```bash
# Se connecter à PostgreSQL (sans mot de passe si configuré en trust)
psql -U postgres

# Changer le mot de passe
ALTER USER postgres WITH PASSWORD 'nouveau_mot_de_passe';
```

### 2. Créer la base de données

```bash
psql -U postgres
CREATE DATABASE academia_hub;
\q
```

### 3. Mettre à jour .env

Modifiez `apps/api-server/.env` :
```env
DB_PASSWORD=votre_nouveau_mot_de_passe
```

### 4. Retester

```bash
npm run test:db
```

## ✅ Une fois la connexion réussie

```bash
# Générer le client Prisma
npx prisma generate

# Appliquer les migrations
npx prisma migrate deploy

# Démarrer l'API
npm run start:dev
```

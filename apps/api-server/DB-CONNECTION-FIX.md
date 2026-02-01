# ✅ Fix - Accessibilité de la Base de Données

## 🐛 Problème Identifié

La base de données PostgreSQL n'était pas accessible à cause d'un **DATABASE_URL mal encodé**.

### Erreur
```
Can't reach database server at `localhost:5432`
```

### Cause
Le mot de passe dans `DATABASE_URL` contenait des caractères spéciaux (`@`) qui n'étaient pas encodés en URL.

## ✅ Solution Appliquée

### 1. Encodage du Mot de Passe

**Mot de passe original** : `C@ptain.Yehioracadhub2021`
**Mot de passe encodé** : `C%40ptain.Yehioracadhub2021`

Le caractère `@` doit être encodé en `%40` dans l'URL.

### 2. DATABASE_URL Corrigé

```env
DATABASE_URL=postgresql://postgres:C%40ptain.Yehioracadhub2021@localhost:5432/academia_hub
```

### 3. Vérification de la Connexion

✅ La connexion fonctionne maintenant :
```bash
npx prisma db pull
# ✅ Introspected 278 models successfully
```

## 📋 Mise à Jour du Fichier .env

**IMPORTANT** : Mettez à jour votre fichier `.env` avec le DATABASE_URL encodé :

```env
# Configuration Base de Données
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=C@ptain.Yehioracadhub2021
DB_DATABASE=academia_hub

# ✅ DATABASE_URL avec mot de passe encodé
DATABASE_URL=postgresql://postgres:C%40ptain.Yehioracadhub2021@localhost:5432/academia_hub
```

## 🔍 Vérification

### 1. Tester la Connexion

```bash
cd apps/api-server
npx prisma db pull
```

### 2. Vérifier les Tenants

```bash
# Via Prisma Studio
npx prisma studio
# Ouvrir http://localhost:5555

# Ou via script
npx ts-node prisma/seed-test-tenants.ts
```

### 3. Créer les Tenants si Nécessaire

Si la base de données est vide ou ne contient pas de tenants :

```bash
cd apps/api-server
npx ts-node prisma/seed-test-tenants.ts
```

## 🚀 Résultat

- ✅ Base de données accessible
- ✅ Prisma peut se connecter
- ✅ 278 modèles introspectés
- ✅ Prisma Studio disponible sur http://localhost:5555

## ⚠️ Notes Importantes

1. **Encodage URL** : Les caractères spéciaux dans les mots de passe doivent être encodés :
   - `@` → `%40`
   - `!` → `%21`
   - `#` → `%23`
   - `$` → `%24`
   - `%` → `%25`
   - `&` → `%26`
   - `+` → `%2B`
   - `=` → `%3D`

2. **Variables d'environnement** : 
   - `DB_PASSWORD` : Utilise le mot de passe **non encodé**
   - `DATABASE_URL` : Utilise le mot de passe **encodé**

3. **Sécurité** : Ne commitez JAMAIS le fichier `.env` dans Git

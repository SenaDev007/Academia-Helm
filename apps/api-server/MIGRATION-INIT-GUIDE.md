# 🚀 Guide de Migration Initiale - Academia Hub

## 📋 Situation Actuelle

### ✅ Configuration Validée
- ✅ Schéma Prisma valide
- ✅ Fichier `.env` créé avec `DATABASE_URL` et `DIRECT_URL`
- ✅ Configuration datasource correcte

### ❌ Problème de Connexion
```
Error: P1001: Can't reach database server at `db.ankbtgwlofidxtafdueu.supabase.co:5432`
```

## 🔍 Diagnostic

### Migration Existante Détectée
Il existe déjà une migration dans `prisma/migrations/20250101000000_init_complete_schema/`.

**Options**:
1. **Utiliser la migration existante** (si elle est complète)
2. **Créer une nouvelle migration** `init_academia_helm` (comme demandé)

## 🚀 Solutions

### Solution 1: Résoudre la Connexion d'Abord

**Étapes**:

1. **Vérifier le projet Supabase**:
   - Accédez à https://app.supabase.com
   - Vérifiez que le projet `ankbtgwlofidxtafdueu` est actif
   - Vérifiez qu'il n'est pas en pause

2. **Vérifier les credentials**:
   - Allez dans Settings > Database
   - Récupérez le "Connection string" (URI)
   - Vérifiez que le mot de passe est correct

3. **Tester la connexion**:
   ```bash
   # Avec psql (si installé)
   psql "postgresql://postgres:PASSWORD@db.ankbtgwlofidxtafdueu.supabase.co:5432/postgres"
   
   # Ou avec Prisma
   npx prisma db pull --print
   ```

4. **Une fois la connexion fonctionnelle**, lancer la migration:
   ```bash
   cd apps/api-server
   npx prisma migrate dev --name init_academia_helm --schema=prisma/schema.prisma
   ```

### Solution 2: Utiliser la Migration Existante

Si la migration existante est complète et que vous voulez l'appliquer:

```bash
cd apps/api-server

# Vérifier l'état
npx prisma migrate status

# Appliquer la migration existante (si connexion OK)
npx prisma migrate deploy
```

### Solution 3: Supprimer et Recréer (Si Migration Incomplète)

Si la migration existante n'est pas complète:

```bash
cd apps/api-server

# Supprimer le dossier migrations (⚠️ seulement si migration non appliquée)
rm -rf prisma/migrations

# Créer une nouvelle migration
npx prisma migrate dev --name init_academia_helm --schema=prisma/schema.prisma
```

## 📋 Checklist Avant Migration

- [ ] Projet Supabase actif et accessible
- [ ] Credentials DATABASE_URL corrects dans `.env`
- [ ] Credentials DIRECT_URL corrects dans `.env`
- [ ] Test de connexion réussi (`npx prisma db pull`)
- [ ] Schéma Prisma validé (`npx prisma validate`)

## 🎯 Commande de Migration (Une Fois Connexion OK)

```bash
cd apps/api-server

# Créer la migration initiale
npx prisma migrate dev --name init_academia_helm --schema=prisma/schema.prisma

# Vérifier l'état
npx prisma migrate status

# Générer le client Prisma
npx prisma generate
```

## ✅ Vérification Post-Migration

Une fois la migration réussie:

1. **Vérifier les tables créées**:
   ```bash
   npx prisma db pull --print
   ```

2. **Vérifier dans Supabase Dashboard**:
   - Table Editor > Vérifier que toutes les tables sont présentes
   - Vérifier les relations (Foreign Keys)
   - Vérifier les index

3. **Compter les tables**:
   ```sql
   SELECT COUNT(*) FROM information_schema.tables 
   WHERE table_schema = 'public';
   ```

## ⚠️ Notes Importantes

1. **Ne pas utiliser `db push`**: Utiliser uniquement `prisma migrate dev`
2. **Ne pas modifier le schéma**: Le schéma est finalisé
3. **Migration atomique**: La migration créera toutes les tables en une seule transaction
4. **Backup**: Avant migration, assurez-vous d'avoir un backup (même si base vide)

## 🔧 Dépannage

Voir `MIGRATION-TROUBLESHOOTING.md` pour plus de détails sur les erreurs de connexion.

---

**Statut**: ⏳ En attente de résolution de la connexion Supabase  
**Action requise**: Vérifier et corriger la connexion avant de lancer la migration

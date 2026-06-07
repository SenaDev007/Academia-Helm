# 🐘 POSTGRESQL - GUIDE RAPIDE

## 🚀 Démarrage rapide

### 1. Créer un projet Supabase

1. Aller sur [supabase.com](https://supabase.com)
2. Créer un nouveau projet
3. Noter la `DATABASE_URL`

### 2. Configurer les variables d'environnement

```bash
cd apps/api-server
cp env.example.txt .env
# Éditer .env et remplir les valeurs
```

### 3. Créer les rôles PostgreSQL

```bash
psql $DATABASE_ADMIN_URL < migrations/000_create_roles.sql
```

⚠️ **IMPORTANT :** Changer les mots de passe dans `migrations/000_create_roles.sql` avant !

### 4. Générer le client Prisma

```bash
npx prisma generate
```

### 5. Appliquer les migrations

```bash
npx prisma migrate dev --name init
```

---

## 💾 Backup

### Backup manuel

```bash
./scripts/backup.sh
```

### Restauration

```bash
./scripts/restore.sh backups/academiahub_YYYYMMDD_HHMMSS.sql
```

---

## 📚 Documentation complète

Voir : `docs/POSTGRESQL-SETUP.md`

---

## 🔐 Rôles PostgreSQL

- `academia_app` → API Backend (SELECT/INSERT/UPDATE)
- `academia_admin` → Migrations (ALL PRIVILEGES)
- `academia_orion` → ORION IA (SELECT ONLY)

---

**Statut :** ✅ Configuration complète


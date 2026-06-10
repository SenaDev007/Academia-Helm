# 🐘 CONFIGURATION POSTGRESQL - ACADEMIA HUB

## 🎯 Objectifs techniques

Academia Hub doit supporter :

- ✅ SaaS **multi-tenant**
- ✅ **offline-first** (sync massif)
- ✅ **forte cohérence** des données
- ✅ **audit légal**
- ✅ **ORION (IA analytique)** - READ ONLY
- ✅ Croissance progressive (écoles → groupes → pays)

---

## 🥇 OPTION RECOMMANDÉE : SUPABASE

### Pourquoi Supabase ?

- ✅ PostgreSQL **pur** (pas de vendor lock-in)
- ✅ Backups automatiques (quotidiens, rétention 7-30 jours)
- ✅ Sécurité réseau (SSL, firewall)
- ✅ Scalabilité (upgrade facile)
- ✅ Administration minimale
- ✅ Interface web pour monitoring
- ✅ Auth intégrée (bonus)

### Alternatives

- **Railway** → Ultra simple, rapide, fiable
- **AWS RDS** → Plus tard (enterprise, plus complexe)
- **DigitalOcean** → Bon compromis prix/performance

👉 **Pour Academia Hub, nous recommandons Supabase.**

---

## 🧱 ARCHITECTURE CIBLE

```
┌─────────────────────────────────────────┐
│  Web / Desktop / Mobile                 │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  API Backend (NestJS)                   │
│  Rôle : academia_app                     │
│  Permissions : SELECT / INSERT / UPDATE │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  PostgreSQL Central (Supabase)           │
│  - Multi-tenant                         │
│  - Backups automatiques                 │
│  - SSL / Sécurité                       │
└──────────────┬──────────────────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
┌───▼──────┐      ┌───────▼──────┐
│ Backups  │      │ ORION (IA)   │
│ (Niveau  │      │ Rôle :       │
│ 1, 2, 3) │      │ academia_orion│
│          │      │ SELECT ONLY  │
└──────────┘      └──────────────┘
```

**Règles strictes :**
- ❌ Aucun client ne parle directement à PostgreSQL
- ✅ API = seule porte d'entrée
- ✅ ORION = rôle read-only (ne peut jamais écrire)

---

## 🔐 RÔLES POSTGRESQL (OBLIGATOIRES)

### 1. `academia_app` (API Backend)

**Permissions :**
- `SELECT` / `INSERT` / `UPDATE` sur toutes les tables
- `USAGE` sur les séquences
- `EXECUTE` sur les fonctions

**Utilisation :**
- Connexion depuis l'API NestJS
- Toutes les opérations CRUD normales
- Ne peut pas supprimer (DELETE) sauf via migrations

**Création :**
```sql
CREATE ROLE academia_app WITH
  LOGIN
  PASSWORD 'CHANGE_ME_IN_PRODUCTION'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT;
```

### 2. `academia_admin` (Migrations)

**Permissions :**
- `ALL PRIVILEGES` (superuser pour migrations)

**Utilisation :**
- Exécution des migrations Prisma
- Administration de la base
- Création/modification de schémas

**Création :**
```sql
CREATE ROLE academia_admin WITH
  LOGIN
  PASSWORD 'CHANGE_ME_IN_PRODUCTION'
  SUPERUSER
  CREATEDB
  CREATEROLE;
```

### 3. `academia_orion` (ORION - IA analytique)

**Permissions :**
- `SELECT ONLY` sur toutes les tables
- `EXECUTE` sur les fonctions (pour agrégations)

**Utilisation :**
- Connexion depuis ORION (service IA)
- Lecture seule pour analyses
- **NE PEUT JAMAIS ÉCRIRE**

**Création :**
```sql
CREATE ROLE academia_orion WITH
  LOGIN
  PASSWORD 'CHANGE_ME_IN_PRODUCTION'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT;
```

**Sécurité :**
- Trigger de protection contre les écritures (voir migration `000_create_roles.sql`)

---

## 📄 SCHÉMA PRISMA

Le schéma Prisma complet est dans : `apps/api-server/prisma/schema.prisma`

### Tables principales :

1. **Core Context**
   - `Tenant` - Multi-tenant
   - `AcademicYear` - Années scolaires
   - `SchoolLevel` - Niveaux (Maternelle, Primaire, Secondaire)
   - `AcademicTrack` - Tracks (FR, EN)

2. **Users & Auth**
   - `User` - Utilisateurs

3. **Students & Academics**
   - `Student` - Élèves
   - `Class` - Classes
   - `Subject` - Matières
   - `Exam` - Examens
   - `Grade` - Notes

4. **Finance**
   - `TuitionPayment` - Paiements scolarité
   - `PaymentFlow` - Flux de paiement (SAAS/TUITION)
   - `TenantFeature` - Features activées

5. **Audit**
   - `AuditLog` - Logs d'audit

### Règles fondamentales :

- ✅ Toute table métier DOIT contenir `tenantId` + `academicYearId` + `schoolLevelId`
- ✅ `academicTrackId` est optionnel (nullable pour compatibilité FR par défaut)
- ✅ ORION = SELECT ONLY (rôle `academia_orion`)
- ✅ API = seule porte d'entrée (rôle `academia_app`)

---

## 🚀 INSTALLATION

### 1. Créer un projet Supabase

1. Aller sur [supabase.com](https://supabase.com)
2. Créer un nouveau projet
3. Noter :
   - `DATABASE_URL` (ex: `postgresql://postgres:password@db.xxx.supabase.co:5432/postgres`)
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

### 2. Configurer les variables d'environnement

Créer `.env` dans `apps/api-server/` :

```env
# Database
DATABASE_URL="postgresql://academia_app:password@db.xxx.supabase.co:5432/postgres"

# Pour migrations (admin)
DATABASE_ADMIN_URL="postgresql://academia_admin:password@db.xxx.supabase.co:5432/postgres"

# Pour ORION (read-only)
DATABASE_ORION_URL="postgresql://academia_orion:password@db.xxx.supabase.co:5432/postgres"
```

### 3. Créer les rôles PostgreSQL

```bash
cd apps/api-server
psql $DATABASE_ADMIN_URL < migrations/000_create_roles.sql
```

⚠️ **IMPORTANT :** Changer les mots de passe dans la migration avant l'exécution !

### 4. Générer le client Prisma

```bash
cd apps/api-server
npx prisma generate
```

### 5. Appliquer les migrations

```bash
cd apps/api-server
npx prisma migrate dev --name init
```

---

## 💾 STRATÉGIE DE BACKUP & RESTAURATION

### 🟦 NIVEAU 1 — Backups automatiques (Supabase)

**Configuration :**
- ✅ Activés par défaut sur Supabase
- ✅ Quotidiens
- ✅ Rétention : 7-30 jours (configurable)
- ✅ Restauration en 1 clic via l'interface Supabase

**Accès :**
- Interface Supabase → Settings → Database → Backups

---

### 🟨 NIVEAU 2 — Backups manuels versionnés

**Script :** `apps/api-server/scripts/backup.sh`

**Usage :**
```bash
cd apps/api-server
export DATABASE_URL="postgresql://..."
export BACKUP_STORAGE_PATH="./backups"  # Optionnel
chmod +x scripts/backup.sh
./scripts/backup.sh
```

**Résultat :**
- Fichier : `backups/academiahub_YYYYMMDD_HHMMSS.sql`
- Log : `backups/backup_YYYYMMDD_HHMMSS.log`
- Lien symbolique : `backups/latest.sql`

**Planification (cron hebdomadaire) :**
```bash
# Ajouter dans crontab (crontab -e)
0 2 * * 0 cd /path/to/apps/api-server && ./scripts/backup.sh
```

**Stockage recommandé :**
- S3 (AWS)
- Google Drive (chiffré)
- Serveur secondaire
- Git LFS (petites bases uniquement)

---

### 🟥 NIVEAU 3 — Snapshots critiques

**À faire AVANT :**
- Migration majeure Prisma
- Ajout de module sensible
- Changement de pricing
- Mise à jour majeure

**Procédure :**
```bash
# 1. Backup manuel
./scripts/backup.sh

# 2. Taguer le backup
cp backups/latest.sql backups/snapshot_before_migration_XXX.sql

# 3. Exécuter la migration
npx prisma migrate deploy

# 4. Vérifier que tout fonctionne
# Si problème → restaurer le snapshot
```

---

## 🔄 RESTAURATION

### Script de restauration

**Script :** `apps/api-server/scripts/restore.sh`

**Usage :**
```bash
cd apps/api-server
export DATABASE_URL="postgresql://..."
chmod +x scripts/restore.sh
./scripts/restore.sh backups/academiahub_20240101_120000.sql
```

**⚠️ ATTENTION :** La restauration **ÉCRASE** la base actuelle !

### Via Supabase

1. Interface Supabase → Settings → Database → Backups
2. Sélectionner un backup
3. Cliquer sur "Restore"
4. Confirmer

---

## 🔐 SÉCURITÉ DES BACKUPS

### Règles strictes :

- ❌ **Jamais** sur le PC local seul
- ❌ **Jamais** en clair (chiffrer si stockage externe)
- ✅ Accès limité (seulement admin)
- ✅ Journal des restaurations (qui/quand/pourquoi)

### Chiffrement (optionnel) :

```bash
# Chiffrer le backup
gpg --encrypt --recipient admin@academiahub.com backups/latest.sql

# Déchiffrer
gpg --decrypt backups/latest.sql.gpg > backups/latest.sql
```

---

## 🧠 STRATÉGIE ORION & BACKUP

### Règles ORION :

- ✅ ORION lit la base **active uniquement**
- ✅ ORION ne touche **jamais** aux backups
- ✅ ORION = rôle `academia_orion` (SELECT ONLY)
- ✅ Protection par trigger contre les écritures

### Utilisation des backups :

- ✅ Audit légal
- ✅ Reprise après incident
- ✅ Analyse historique (plus tard)
- ❌ ORION n'utilise pas les backups (trop lent)

---

## 📊 MONITORING & MAINTENANCE

### Supabase Dashboard

- **Database** → Monitoring des performances
- **Database** → Connection Pooling
- **Database** → Query Performance

### Commandes utiles :

```bash
# Voir la taille de la base
psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size(current_database()));"

# Voir les connexions actives
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity;"

# Voir les tables les plus volumineuses
psql $DATABASE_URL -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

---

## ✅ CHECKLIST DE CONFIGURATION

- [ ] Projet Supabase créé
- [ ] Variables d'environnement configurées (`.env`)
- [ ] Rôles PostgreSQL créés (`000_create_roles.sql`)
- [ ] Mots de passe changés (production)
- [ ] Client Prisma généré (`npx prisma generate`)
- [ ] Migrations appliquées (`npx prisma migrate dev`)
- [ ] Scripts de backup testés (`./scripts/backup.sh`)
- [ ] Scripts de restauration testés (`./scripts/restore.sh`)
- [ ] Cron de backup configuré (hebdomadaire)
- [ ] Stockage des backups configuré (S3/GDrive)
- [ ] ORION configuré avec `DATABASE_ORION_URL`
- [ ] Monitoring activé (Supabase Dashboard)

---

## 🚨 EN CAS DE PROBLÈME

### Base corrompue

1. Arrêter l'API
2. Restaurer le dernier backup valide
3. Vérifier les logs
4. Redémarrer l'API

### Migration échouée

1. Restaurer le snapshot d'avant migration
2. Analyser l'erreur
3. Corriger la migration
4. Réessayer

### ORION essaie d'écrire

1. Vérifier le rôle utilisé (`current_user`)
2. Vérifier que `DATABASE_ORION_URL` pointe vers `academia_orion`
3. Vérifier les triggers de protection

---

**Date de création :** $(date)
**Statut :** ✅ Configuration complète


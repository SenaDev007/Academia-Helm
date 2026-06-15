# 📦 Système de Migrations Prisma - Academia Hub

## ✅ Système Complet Implémenté

Un système complet de génération, validation et application de migrations Prisma **sûres** et **auditables** a été mis en place.

---

## 📦 Outils Disponibles

### 1. Analyseur de Schéma ✅

**Fichier** : `scripts/analyze-schema.ts`

**Fonctionnalités** :
- Analyse le `schema.prisma`
- Vérifie la présence de `tenant_id`, `academic_year_id`, `school_level_id`
- Identifie les index manquants
- Détecte les contraintes manquantes
- Génère un rapport détaillé

**Commande** :
```bash
npm run analyze:schema
```

**Sortie** : `prisma/schema-analysis-report.txt`

---

### 2. Générateur de Migrations Sûres ✅

**Fichier** : `scripts/generate-safe-migrations.ts`

**Fonctionnalités** :
- Planifie les migrations par module
- Génère les migrations avec `prisma migrate dev --create-only`
- Ajoute la documentation pour chaque migration
- Améliore avec des index composés
- Identifie les migrations nécessitant un backup

**Commande** :
```bash
npm run migrate:generate-safe
```

**Résultat** : Migrations dans `prisma/migrations/` avec documentation

---

### 3. Validateur de Migrations ✅

**Fichier** : `scripts/validate-migrations.ts`

**Fonctionnalités** :
- Détecte les opérations destructives (DROP, TRUNCATE, DELETE)
- Identifie les opérations risquées (ALTER, RENAME)
- Vérifie l'utilisation de `IF NOT EXISTS`
- Recommande les backups nécessaires

**Commande** :
```bash
npm run migrate:validate
```

**Sortie** : `prisma/migrations-validation-report.txt`

---

### 4. Commandes Prisma Standard ✅

```bash
# Vérifier l'état des migrations
npm run migrate:status

# Appliquer les migrations (développement)
npm run migrate:dev

# Appliquer les migrations (production)
npm run migrate:deploy
```

---

## 🔄 Workflow Recommandé

### Étape 1 : Analyser le Schéma

```bash
npm run analyze:schema
```

**Vérifie** :
- ✅ Cohérence du schéma
- ✅ Présence des colonnes structurantes
- ✅ Index recommandés

**Corrigez** les erreurs avant de continuer.

---

### Étape 2 : Générer les Migrations

```bash
npm run migrate:generate-safe
```

**Génère** :
- Migrations par module
- Documentation pour chaque migration
- Index composés recommandés

---

### Étape 3 : Valider les Migrations

```bash
npm run migrate:validate
```

**Vérifie** :
- ❌ Absence d'opérations destructives
- ⚠️  Opérations risquées
- 💾 Recommandations de backup

**Corrigez** les problèmes avant d'appliquer.

---

### Étape 4 : Appliquer les Migrations

#### Développement

```bash
npm run migrate:dev
```

#### Production

```bash
# 1. Backup obligatoire
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Vérifier l'état
npm run migrate:status

# 3. Appliquer
npm run migrate:deploy
```

---

## 📋 Plan de Migration par Module

Le système génère automatiquement 12 migrations :

1. **init_core** - Tables de base (2-5 min)
2. **students_module** - Module Élèves (3-7 min)
3. **finance_module** - Module Finances ⚠️ Backup requis (5-10 min)
4. **hr_module** - Module RH ⚠️ Backup requis (4-8 min)
5. **planning_module** - Module Planification (2-5 min)
6. **pedagogical_sheets_module** - Fiches pédagogiques ⚠️ Backup requis (4-8 min)
7. **exams_module** - Module Examens ⚠️ Backup requis (5-10 min)
8. **communication_module** - Module Communication (3-6 min)
9. **supplementary_modules** - Modules supplémentaires (6-12 min)
10. **ai_modules** - Modules IA (2-5 min)
11. **audit_compliance** - Audit & Conformité (2-4 min)
12. **indexes_constraints** - Index & Contraintes (5-15 min)

**Temps total estimé** : 40-80 minutes (développement)

---

## 🔐 Règles de Sécurité

### ✅ AUTORISÉ

- `CREATE TABLE IF NOT EXISTS`
- `ALTER TABLE ADD COLUMN`
- `CREATE INDEX IF NOT EXISTS`
- `ADD CONSTRAINT` (FK, UNIQUE, CHECK)

### ❌ INTERDIT

- `DROP TABLE`
- `TRUNCATE TABLE`
- `DELETE FROM` (sauf données de test)
- `ALTER TABLE DROP COLUMN`
- `ALTER TABLE DROP CONSTRAINT`

### ⚠️  RISQUÉ (nécessite backup)

- `ALTER TABLE ALTER COLUMN`
- `ALTER TABLE RENAME`
- Modifications de types de colonnes

---

## 🔙 Rollback

### Principe

Les migrations Prisma ne sont **pas réversibles automatiquement**.

### Stratégie

1. **Backup avant migration** (obligatoire en production)
2. **Restaurer depuis backup** si problème
3. **Créer une migration corrective** si nécessaire

### Backup PostgreSQL

```bash
# Avant migration
pg_dump $DATABASE_URL > backup_before_migration_$(date +%Y%m%d_%H%M%S).sql

# Après migration (vérification)
# Si problème, restaurer :
psql $DATABASE_URL < backup_before_migration_YYYYMMDD_HHMMSS.sql
```

---

## ✅ Checklist Avant Migration

### Développement

- [ ] Schéma analysé (`npm run analyze:schema`)
- [ ] Migrations générées (`npm run migrate:generate-safe`)
- [ ] Migrations validées (`npm run migrate:validate`)
- [ ] Tests locaux passés
- [ ] Client Prisma régénéré

### Production

- [ ] ✅ **Backup complet de la base**
- [ ] Schéma analysé
- [ ] Migrations validées
- [ ] Plan de rollback préparé
- [ ] Fenêtre de maintenance planifiée
- [ ] Équipe disponible pour support
- [ ] Tests sur environnement de staging

---

## 📚 Documentation

- [Guide de Migration Complet](./docs/MIGRATION-GUIDE.md)
- [Architecture Offline-First](./docs/OFFLINE-FIRST-ARCHITECTURE.md)
- [Correspondance PostgreSQL ↔ SQLite](./docs/SQLITE-SCHEMA-CONFORMITY.md)

---

## 🚨 Procédure d'Urgence

### En Cas de Problème

1. **ARRÊTER** immédiatement l'application
2. **VÉRIFIER** l'état de la base (`npm run migrate:status`)
3. **RESTAURER** depuis le backup si nécessaire
4. **ANALYSER** les logs de migration
5. **CORRIGER** le schéma si nécessaire
6. **RE-GÉNÉRER** les migrations
7. **TESTER** en développement
8. **RE-DÉPLOYER** avec précaution

---

## 📊 Structure des Migrations

```
prisma/migrations/
  ├── 20240101120000_init_core/
  │   ├── migration.sql          # SQL de la migration
  │   └── MIGRATION.md           # Documentation
  ├── 20240101130000_students_module/
  │   ├── migration.sql
  │   └── MIGRATION.md
  └── ...
```

Chaque migration contient :
- **migration.sql** : SQL généré par Prisma
- **MIGRATION.md** : Documentation complète

---

## 🔍 Vérification Post-Migration

Après chaque migration, vérifier :

1. ✅ Toutes les tables créées
2. ✅ Index composés présents
3. ✅ Contraintes FK actives
4. ✅ Données de test valides
5. ✅ Performance des requêtes

```sql
-- Vérifier les tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Vérifier les index
SELECT tablename, indexname FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

---

**Système prêt pour production** ✅  
**Migrations sûres et auditables** ✅  
**Documentation complète** ✅


# 📦 Guide de Migration Prisma - Academia Hub

## 🎯 Objectif

Générer et appliquer des migrations Prisma **sûres**, **auditables** et **sans risque de perte de données**.

---

## 🔄 Workflow Complet

### 1. Analyse du Schéma

Avant de générer des migrations, analyser le schéma :

```bash
npm run analyze:schema
```

**Vérifie** :
- ✅ Présence de `tenant_id` sur toutes les tables métier
- ✅ Présence de `academic_year_id` et `school_level_id`
- ✅ Index composés recommandés
- ✅ Contraintes de conformité

**Sortie** : `prisma/schema-analysis-report.txt`

---

### 2. Génération de Migrations

Générer les migrations de manière sûre :

```bash
npm run migrate:generate-safe
```

**Processus** :
1. Analyse le `schema.prisma`
2. Planifie les migrations par module
3. Génère les migrations avec `prisma migrate dev --create-only`
4. Ajoute la documentation pour chaque migration
5. Améliore avec des index composés

**Résultat** : Migrations dans `prisma/migrations/` avec documentation

---

### 3. Validation des Migrations

Valider que les migrations sont sûres :

```bash
npm run migrate:validate
```

**Vérifie** :
- ❌ Absence d'opérations destructives (DROP, TRUNCATE, DELETE)
- ⚠️  Opérations risquées (ALTER, RENAME)
- ✅ Utilisation de `IF NOT EXISTS`
- 💾 Recommandations de backup

**Sortie** : `prisma/migrations-validation-report.txt`

---

### 4. Application des Migrations

#### Développement

```bash
npm run migrate:dev
```

**Applique** la migration et régénère le client Prisma.

#### Production

```bash
npm run migrate:deploy
```

**Applique** uniquement les migrations en attente, sans régénérer le client.

#### Vérification

```bash
npm run migrate:status
```

**Affiche** l'état des migrations (appliquées, en attente).

---

## 📋 Structure des Migrations

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

## 📊 Plan de Migration par Module

### 1. Init Core
- Tables de base (tenants, academic_years, school_levels, users)
- **Temps** : 2-5 minutes
- **Backup** : Non requis

### 2. Students Module
- Tables étudiants, classes, inscriptions, présence, discipline
- **Temps** : 3-7 minutes
- **Backup** : Non requis

### 3. Finance Module
- Tables paiements, abonnements, dépenses, trésorerie
- **Temps** : 5-10 minutes
- **Backup** : ⚠️ **REQUIS** (données financières sensibles)

### 4. HR Module
- Tables personnel, contrats, présence, évaluations, paie
- **Temps** : 4-8 minutes
- **Backup** : ⚠️ **REQUIS** (données RH sensibles)

### 5. Planning Module
- Tables salles, matières, emplois du temps
- **Temps** : 2-5 minutes
- **Backup** : Non requis

### 6. Pedagogical Sheets Module
- Tables fiches, journaux, devoirs
- **Temps** : 4-8 minutes
- **Backup** : ⚠️ **REQUIS** (données pédagogiques importantes)

### 7. Exams Module
- Tables examens, notes, bulletins, classements
- **Temps** : 5-10 minutes
- **Backup** : ⚠️ **REQUIS** (données d'évaluation critiques)

### 8. Communication Module
- Tables messages, templates, logs
- **Temps** : 3-6 minutes
- **Backup** : Non requis

### 9. Supplementary Modules
- Bibliothèque, Laboratoire, Transport, Cantine, etc.
- **Temps** : 6-12 minutes
- **Backup** : Non requis

### 10. AI Modules
- Tables ORION et ATLAS
- **Temps** : 2-5 minutes
- **Backup** : Non requis

### 11. Audit & Compliance
- Tables audit, logs, exports, consentements
- **Temps** : 2-4 minutes
- **Backup** : Non requis

### 12. Indexes & Constraints
- Index composés et contraintes
- **Temps** : 5-15 minutes
- **Backup** : Non requis

---

## 🔙 Rollback

### Principe

Les migrations Prisma ne sont **pas réversibles automatiquement**.

### Stratégie de Rollback

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

## 📚 Documentation des Migrations

Chaque migration générée contient un fichier `MIGRATION.md` avec :

- Description de la migration
- Tables impactées
- Informations de sécurité
- Instructions d'application
- Procédure de rollback
- Notes importantes

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

-- Vérifier les FK
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE contype = 'f'
ORDER BY conrelid::regclass;
```

---

## 📊 Statistiques

### Temps Total Estimé

- **Développement** : 40-80 minutes (toutes migrations)
- **Production** : 60-120 minutes (avec backups et vérifications)

### Ordre Recommandé

1. Init Core
2. Students Module
3. Planning Module
4. Communication Module
5. Finance Module (avec backup)
6. HR Module (avec backup)
7. Pedagogical Sheets Module (avec backup)
8. Exams Module (avec backup)
9. Supplementary Modules
10. AI Modules
11. Audit & Compliance
12. Indexes & Constraints

---

**Dernière mise à jour** : Généré automatiquement  
**Version Prisma** : Vérifier `package.json`


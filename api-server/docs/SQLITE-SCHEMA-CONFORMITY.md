# 📊 Correspondance PostgreSQL ↔ SQLite - Academia Hub

## 🎯 Objectif

Garantir que la base de données locale SQLite est **STRICTEMENT CONFORME** au schéma PostgreSQL défini dans `schema.prisma`.

**PostgreSQL = Source unique de vérité**  
**SQLite = Miroir exact pour offline-first**

---

## 📋 Règles Structurelles Obligatoires

### 1. Tables Métier

✅ **TOUTES** les tables métier existant dans PostgreSQL **DOIVENT** exister dans SQLite.

✅ Les noms de tables doivent être **IDENTIQUES** (via `@@map` dans Prisma).

✅ Les colonnes doivent être :
- Identiques en nom
- Compatibles en type
- Identiques en sémantique

### 2. Colonnes Structurantes

Toute table métier **DOIT** contenir :

```sql
tenant_id TEXT NOT NULL
academic_year_id TEXT NOT NULL  -- ou nullable selon contexte
school_level_id TEXT NOT NULL   -- ou nullable selon contexte
academic_track_id TEXT           -- nullable, présent où applicable
created_at TEXT NOT NULL DEFAULT (datetime('now'))
updated_at TEXT NOT NULL DEFAULT (datetime('now'))
```

### 3. Colonnes Techniques Locales

SQLite **PEUT** avoir en plus (uniquement pour la sync) :

```sql
sync_status TEXT DEFAULT 'pending'        -- pending, synced, conflict
local_updated_at TEXT DEFAULT (datetime('now'))
local_device_id TEXT
```

### 4. Tables Techniques

SQLite **PEUT** avoir des tables techniques (absentes de PostgreSQL) :

- `sync_operations` - Journal des opérations de sync
- `sync_conflicts` - Conflits de synchronisation
- `sync_logs` - Logs de synchronisation
- `schema_version` - Version du schéma appliqué

---

## 🔄 Génération Automatique

### Commande

```bash
npm run generate:sqlite-schema
```

### Processus

1. **Lecture** de `prisma/schema.prisma`
2. **Parsing** des modèles Prisma
3. **Conversion** des types Prisma → SQLite
4. **Génération** de `prisma/sqlite-schema.sql`

### Types de Conversion

| Prisma | SQLite |
|--------|--------|
| `String` | `TEXT` |
| `Int` | `INTEGER` |
| `Float` | `REAL` |
| `Decimal` | `REAL` |
| `Boolean` | `INTEGER` (0/1) |
| `DateTime` | `TEXT` (ISO 8601) |
| `Json` | `TEXT` (JSON string) |
| `Bytes` | `BLOB` |

---

## 📦 Migrations Versionnées

### Structure

```
migrations/sqlite/
  └── YYYYMMDDHHMMSS_migration_name/
      ├── up.sql          # Migration vers l'avant
      ├── down.sql        # Rollback
      └── metadata.json   # Métadonnées (version, hash, etc.)
```

### Génération

```bash
npm run migrate:sqlite:generate -- --name add_new_table
```

### Application

```bash
npm run migrate:sqlite:up
```

### Rollback

```bash
npm run migrate:sqlite:down
```

---

## ✅ Validation de Conformité

### Avant Toute Synchronisation

Le système **BLOQUE** automatiquement la sync si :

1. ❌ Hash du schéma non conforme
2. ❌ Table métier manquante
3. ❌ Colonne structurante absente
4. ❌ Version de migration incompatible

### Vérification Manuelle

```bash
npm run validate:schema
```

### Résultat

```json
{
  "isValid": true,
  "errors": [],
  "warnings": [],
  "prismaSchemaHash": "abc123...",
  "sqliteSchemaHash": "abc123...",
  "sqliteVersion": "20240101120000_initial"
}
```

---

## 🚨 Interdictions Strictes

### ❌ NE PAS

- Créer un schéma SQLite indépendant
- Improviser des tables locales
- Stocker des données métier hors schéma
- Synchroniser une base non conforme
- Modifier manuellement le schéma SQLite

### ✅ DOIT

- Générer automatiquement depuis Prisma
- Valider avant chaque sync
- Journaliser toutes les divergences
- Bloquer les syncs non conformes

---

## 📊 Correspondance des Tables

### Tables Essentielles

| PostgreSQL | SQLite | Statut |
|------------|--------|--------|
| `tenants` | `tenants` | ✅ Obligatoire |
| `academic_years` | `academic_years` | ✅ Obligatoire |
| `school_levels` | `school_levels` | ✅ Obligatoire |
| `academic_tracks` | `academic_tracks` | ✅ Obligatoire |
| `users` | `users` | ✅ Obligatoire |
| `students` | `students` | ✅ Obligatoire |
| `classes` | `classes` | ✅ Obligatoire |
| `subjects` | `subjects` | ✅ Obligatoire |
| `exams` | `exams` | ✅ Obligatoire |
| `grades` | `grades` | ✅ Obligatoire |
| `payments` | `payments` | ✅ Obligatoire |
| `tuition_payments` | `tuition_payments` | ✅ Obligatoire |

### Tables Techniques (SQLite uniquement)

| Table | Description |
|-------|-------------|
| `sync_operations` | Journal des opérations de sync |
| `sync_conflicts` | Conflits de synchronisation |
| `sync_logs` | Logs de synchronisation |
| `schema_version` | Version du schéma appliqué |

---

## 🔐 Sécurité & Audit

### Hash du Schéma

Chaque schéma est identifié par un hash SHA-256 :

- **PostgreSQL** : Hash du `schema.prisma`
- **SQLite** : Hash du schéma SQLite généré

Les deux doivent être **IDENTIQUES** pour autoriser la sync.

### Journalisation

Toutes les validations sont journalisées :

- ✅ Conformité réussie
- ❌ Divergences détectées
- ⚠️ Avertissements

---

## 🛠️ Maintenance

### Mise à Jour du Schéma

1. **Modifier** `schema.prisma`
2. **Générer** le schéma SQLite : `npm run generate:sqlite-schema`
3. **Créer** une migration : `npm run migrate:sqlite:generate`
4. **Appliquer** la migration : `npm run migrate:sqlite:up`
5. **Valider** : `npm run validate:schema`

### Vérification Continue

Le système vérifie automatiquement :

- À chaque démarrage de l'application
- Avant chaque synchronisation
- Après chaque migration

---

## 📚 Références

- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Offline-First Patterns](https://offlinefirst.org/)

---

## ✅ Checklist de Conformité

Avant de déployer une nouvelle version :

- [ ] Schéma Prisma mis à jour
- [ ] Schéma SQLite régénéré
- [ ] Migration SQLite créée
- [ ] Migration SQLite testée
- [ ] Validation de conformité réussie
- [ ] Tests de synchronisation passés
- [ ] Documentation mise à jour

---

**Dernière mise à jour** : Généré automatiquement depuis `schema.prisma`  
**Version** : Vérifier `schema_version` dans SQLite


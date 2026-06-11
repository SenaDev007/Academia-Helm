# 🏗️ Architecture Offline-First - Academia Hub

## 🎯 Vision Globale

Academia Hub est conçu comme une plateforme **offline-first** où :

- **PostgreSQL** = Source unique de vérité (serveur central)
- **SQLite** = Base locale de travail (client desktop/mobile)
- **Synchronisation** = Mécanisme bidirectionnel contrôlé

---

## 📊 Principe Fondamental

### PostgreSQL = Source Unique de Vérité

Le schéma PostgreSQL défini dans `schema.prisma` est la **SEULE** source de vérité structurelle.

Toute modification du schéma doit :
1. ✅ Commencer par `schema.prisma`
2. ✅ Générer automatiquement le schéma SQLite
3. ✅ Créer des migrations versionnées pour les deux bases
4. ✅ Valider la conformité avant déploiement

### SQLite = Miroir Exact

Le schéma SQLite doit être **STRICTEMENT CONFORME** au schéma PostgreSQL :

- ✅ Mêmes tables métier
- ✅ Mêmes colonnes
- ✅ Mêmes types (convertis selon compatibilité)
- ✅ Mêmes contraintes logiques

**Aucune divergence structurelle n'est autorisée.**

---

## 🔄 Flux de Génération

```
schema.prisma (PostgreSQL)
    ↓
[Générateur Automatique]
    ↓
sqlite-schema.sql (SQLite)
    ↓
[Migrations Versionnées]
    ↓
[Validation de Conformité]
    ↓
✅ Déploiement
```

---

## 🛠️ Outils Disponibles

### 1. Génération du Schéma SQLite

```bash
npm run generate:sqlite-schema
```

**Génère** : `prisma/sqlite-schema.sql`

**Processus** :
- Parse `schema.prisma` avec Prisma DMMF
- Convertit les types Prisma → SQLite
- Ajoute les colonnes techniques locales
- Génère les index et contraintes

### 2. Migrations SQLite

```bash
# Générer une migration
npm run migrate:sqlite:generate -- --name add_new_table

# Appliquer les migrations
npm run migrate:sqlite:up

# Rollback
npm run migrate:sqlite:down
```

**Structure** :
```
migrations/sqlite/
  └── YYYYMMDDHHMMSS_migration_name/
      ├── up.sql
      ├── down.sql
      └── metadata.json
```

### 3. Validation de Conformité

```bash
npm run validate:schema
```

**Vérifie** :
- Hash du schéma Prisma
- Hash du schéma SQLite
- Correspondance des tables
- Correspondance des colonnes

---

## 🔐 Sécurité & Validation

### Validation Obligatoire Avant Sync

Toute synchronisation **DOIT** passer par la validation :

```typescript
// 1. Validation de conformité
const validation = await schemaValidator.validateSQLiteConformity(
  sqliteSchemaHash,
  sqliteVersion
);

// 2. Blocage si non conforme
if (!validation.isValid) {
  throw new Error('Synchronisation bloquée - schéma non conforme');
}

// 3. Synchronisation autorisée
await syncService.syncUp(request);
```

### Hash du Schéma

Chaque schéma est identifié par un hash SHA-256 :

- **PostgreSQL** : Hash de `schema.prisma`
- **SQLite** : Hash de `sqlite-schema.sql`

Les deux doivent être **IDENTIQUES** pour autoriser la sync.

---

## 📋 Règles Structurelles

### Colonnes Obligatoires (Tables Métier)

Toute table métier **DOIT** contenir :

```sql
tenant_id TEXT NOT NULL
academic_year_id TEXT NOT NULL  -- ou nullable selon contexte
school_level_id TEXT NOT NULL   -- ou nullable selon contexte
academic_track_id TEXT           -- nullable, présent où applicable
created_at TEXT NOT NULL DEFAULT (datetime('now'))
updated_at TEXT NOT NULL DEFAULT (datetime('now'))
```

### Colonnes Techniques (SQLite uniquement)

SQLite **PEUT** avoir en plus :

```sql
sync_status TEXT DEFAULT 'pending'        -- pending, synced, conflict
local_updated_at TEXT DEFAULT (datetime('now'))
local_device_id TEXT
```

### Tables Techniques (SQLite uniquement)

SQLite **PEUT** avoir des tables absentes de PostgreSQL :

- `sync_operations` - Journal des opérations
- `sync_conflicts` - Conflits de synchronisation
- `sync_logs` - Logs de synchronisation
- `schema_version` - Version du schéma

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

## 📚 Documentation Complémentaire

- [Correspondance PostgreSQL ↔ SQLite](./SQLITE-SCHEMA-CONFORMITY.md)
- [Guide de Migration](./MIGRATION-GUIDE.md)
- [API de Synchronisation](./SYNC-API.md)

---

**Dernière mise à jour** : Généré automatiquement  
**Version** : Vérifier `schema_version` dans SQLite


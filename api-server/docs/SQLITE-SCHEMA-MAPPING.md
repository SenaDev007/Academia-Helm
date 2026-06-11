# 📊 Correspondance PostgreSQL ↔ SQLite - Academia Hub

**Date** : Documentation du schéma SQLite  
**Statut** : ✅ **Schéma SQLite documenté**

---

## 🎯 Principe Fondamental

**PostgreSQL = Source de Vérité**  
**SQLite = Miroir Strict avec Colonnes Techniques**

Le schéma SQLite doit **strictement refléter** le schéma PostgreSQL, avec uniquement des colonnes techniques supplémentaires pour la synchronisation offline.

---

## 📋 Tables Critiques SQLite

### 1. `students` ↔ `students` (PostgreSQL)

**Colonnes Métier** (identiques PostgreSQL) :
- `id`, `tenantId`, `academicYearId`, `currentAcademicYearId`, `schoolLevelId`
- `studentCode`, `firstName`, `lastName`, `dateOfBirth`, `gender`
- `nationality`, `primaryLanguage`, `status`
- `createdAt`, `updatedAt`

**Colonnes Techniques** (SQLite uniquement) :
- `local_id TEXT UNIQUE` - ID temporaire si généré offline
- `sync_status TEXT` - PENDING | SYNCED | CONFLICT | ERROR
- `local_updated_at TEXT` - Date modification locale
- `device_id TEXT` - Identifiant dispositif

---

### 2. `payments` ↔ `payments` (PostgreSQL)

**Colonnes Métier** (identiques PostgreSQL) :
- `id`, `tenantId`, `academicYearId`, `studentId`, `schoolLevelId`
- `feeConfigurationId`, `amount`, `paymentMethod`, `paymentDate`
- `reference`, `receiptNumber`, `status`, `paymentFlowId`, `notes`
- `createdBy`, `createdAt`, `updatedAt`, `studentFeeId`

**Colonnes Techniques** (SQLite uniquement) :
- `local_id TEXT UNIQUE`
- `sync_status TEXT`
- `local_updated_at TEXT`
- `device_id TEXT`

---

### 3. `student_fee_profiles` ↔ `student_fee_profiles` (PostgreSQL)

**Colonnes Métier** (identiques PostgreSQL) :
- `id`, `studentId`, `academicYearId`, `feeRegimeId`
- `justification`, `validatedBy`, `validatedAt`
- `createdAt`, `updatedAt`

**Colonnes Techniques** (SQLite uniquement) :
- `local_id TEXT UNIQUE`
- `sync_status TEXT`
- `local_updated_at TEXT`
- `device_id TEXT`

---

### 4. `collection_cases` ↔ `collection_cases` (PostgreSQL)

**Colonnes Métier** (identiques PostgreSQL) :
- `id`, `tenantId`, `studentId`, `academicYearId`
- `totalDue`, `totalPaid`, `outstandingAmount`
- `status`, `escalationLevel`, `lastActionAt`, `blockedUntil`
- `createdAt`, `updatedAt`

**Colonnes Techniques** (SQLite uniquement) :
- `local_id TEXT UNIQUE`
- `sync_status TEXT`
- `local_updated_at TEXT`
- `device_id TEXT`

---

### 5. `student_documents` ↔ `student_documents` (PostgreSQL)

**Colonnes Métier** (identiques PostgreSQL) :
- `id`, `tenantId`, `academicYearId`, `schoolLevelId`, `studentId`
- `documentType`, `fileName`, `filePath`
- `fileSize`, `mimeType`, `uploadedBy`
- `createdAt`, `updatedAt`

**Colonnes Techniques** (SQLite uniquement) :
- `local_id TEXT UNIQUE`
- `sync_status TEXT`
- `local_updated_at TEXT`
- `device_id TEXT`

---

### 6. `offline_operations` (SQLite uniquement)

**Table de journalisation** (n'existe pas dans PostgreSQL) :

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | TEXT PRIMARY KEY | UUID de l'opération |
| `table_name` | TEXT NOT NULL | Nom de la table concernée |
| `record_id` | TEXT NOT NULL | ID de l'enregistrement |
| `operation_type` | TEXT NOT NULL | INSERT \| UPDATE \| DELETE |
| `payload` | TEXT NOT NULL | JSON immuable (état complet) |
| `created_at` | TEXT | Date création opération |
| `sync_status` | TEXT | PENDING \| SYNCING \| SYNCED \| FAILED \| CONFLICT |
| `retry_count` | INTEGER | Nombre de tentatives |
| `error_message` | TEXT | Message d'erreur (si applicable) |
| `synced_at` | TEXT | Date sync réussie |

---

### 7. `schema_version` (SQLite uniquement)

**Table de versionnement** (n'existe pas dans PostgreSQL) :

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | INTEGER PRIMARY KEY | Auto-increment |
| `version` | TEXT UNIQUE | Version du schéma (ex: "1.0.0") |
| `schema_hash` | TEXT | Hash du schéma pour validation |
| `description` | TEXT | Description de la version |
| `applied_at` | TEXT | Date d'application |

---

## 🔄 Correspondance de Types

| PostgreSQL | SQLite | Exemple |
|------------|--------|---------|
| `TEXT` | `TEXT` | `"tenantId" TEXT` |
| `TIMESTAMP(3)` | `TEXT` | `'2024-01-01 12:00:00'` (ISO 8601) |
| `DATE` | `TEXT` | `'2024-01-01'` (ISO 8601) |
| `DECIMAL(10,2)` | `REAL` | `100.50` (approximation) |
| `BOOLEAN` | `INTEGER` | `0` (false) ou `1` (true) |
| `JSONB` / `Json` | `TEXT` | `'{"key": "value"}'` (JSON string) |
| `UUID` | `TEXT` | `'uuid-string'` |

---

## 📊 Structure des Fichiers SQL

### Fichier 1 : `prisma/sqlite-schema.sql`

**Contenu** :
- Tables métier (`students`, `payments`, `student_fee_profiles`, `collection_cases`, `student_documents`)
- Table `schema_version`
- Colonnes techniques pour chaque table métier
- Index pour performance

**Usage** : Script complet pour créer le schéma SQLite local.

---

### Fichier 2 : `prisma/sqlite-offline-operations.sql`

**Contenu** :
- Table `offline_operations` (journalisation)
- Index pour performance
- Documentation des règles de journalisation

**Usage** : Script pour créer la table de journalisation offline.

---

## ✅ Checklist Correspondance

Pour chaque table SQLite :

- [ ] **Nom identique** : Même nom que PostgreSQL (via `@@map`)
- [ ] **Colonnes métier** : Toutes présentes, même ordre si possible
- [ ] **Types convertis** : String→TEXT, DateTime→TEXT, Decimal→REAL, Boolean→INTEGER
- [ ] **Colonnes techniques** : `local_id`, `sync_status`, `local_updated_at`, `device_id`
- [ ] **Index** : Répliqués depuis PostgreSQL
- [ ] **Contraintes** : PRIMARY KEY, UNIQUE préservées (si compatibles SQLite)

---

**Le schéma SQLite est maintenant documenté et prêt !** ✅

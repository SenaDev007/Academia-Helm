# 💾 Configuration Base de Données Locale - Mode Offline

**Date** : 2025-01-17  
**Version** : 1.0.0

---

## 🎯 Vue d'Ensemble

Academia Hub utilise une **architecture offline-first** avec deux types de bases de données locales selon la plateforme :

1. **Desktop App (Electron)** : **SQLite** via `better-sqlite3`
2. **Web App (Navigateur)** : **IndexedDB** (API Web native)

**Principe** : PostgreSQL (serveur) = Source de vérité | SQLite/IndexedDB (client) = Cache local offline

---

## 🖥️ Desktop App : SQLite avec better-sqlite3

### Configuration Requise

#### 1. Installation de better-sqlite3

**⚠️ Important** : `better-sqlite3` nécessite la compilation native. Vous avez déjà Visual Studio Build Tools, mais il manque le **Windows SDK**.

**Option A : Installer le Windows SDK** (si vous voulez compiler better-sqlite3)

1. Ouvrir **Visual Studio Installer**
2. Modifier **Visual Studio Build Tools 2022**
3. Cocher **"Développement Desktop en C++"**
4. S'assurer que **"Windows 10/11 SDK"** est coché
5. Installer et redémarrer

**Option B : Continuer sans better-sqlite3** (recommandé pour l'instant)

Le projet utilise PostgreSQL en production, donc `better-sqlite3` n'est pas critique. Vous pouvez continuer avec `npm install --ignore-scripts`.

#### 2. Variables d'Environnement

**Fichier** : `apps/desktop-app/.env` (ou variables système)

```env
# ============================================================================
# BASE DE DONNÉES LOCALE - SQLITE (Mode Offline)
# ============================================================================

# Chemin vers le fichier SQLite local
# Par défaut : dans le dossier de l'application
SQLITE_DB_PATH=./data/academia-hub-local.db

# Mode de synchronisation
# auto : Synchronisation automatique à la reconnexion
# manual : Synchronisation manuelle uniquement
SYNC_MODE=auto

# Intervalle de synchronisation (en millisecondes)
# Par défaut : 5 minutes (300000 ms)
SYNC_INTERVAL=300000

# URL de l'API pour la synchronisation
API_URL=http://localhost:3000/api
```

### Structure SQLite Locale

Le schéma SQLite local doit être conforme au schéma PostgreSQL avec des colonnes de synchronisation :

```sql
-- Exemple : Table Students avec colonnes de sync
CREATE TABLE students (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  academic_year_id TEXT NOT NULL,
  school_level_id TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  birth_date DATE,
  enrollment_date DATE,
  class_id TEXT,
  status TEXT DEFAULT 'ACTIVE',
  
  -- Colonnes de synchronisation (obligatoires)
  _version INTEGER DEFAULT 1,
  _last_sync TIMESTAMP,
  _is_dirty INTEGER DEFAULT 0,
  _deleted INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table Outbox (événements à synchroniser)
CREATE TABLE outbox_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,        -- 'CREATE', 'UPDATE', 'DELETE'
  entity_type TEXT NOT NULL,        -- 'student', 'grade', etc.
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL,            -- JSON de l'événement
  metadata TEXT,                    -- JSON métadonnées
  status TEXT DEFAULT 'PENDING',    -- 'PENDING', 'SYNCING', 'SYNCED', 'FAILED'
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  synced_at TIMESTAMP
);

-- Table Sync State (état de synchronisation)
CREATE TABLE sync_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL UNIQUE,
  last_sync_timestamp TIMESTAMP,
  last_sync_success BOOLEAN DEFAULT 0,
  pending_events_count INTEGER DEFAULT 0,
  conflict_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour performance
CREATE INDEX idx_outbox_status ON outbox_events(status, created_at);
CREATE INDEX idx_outbox_tenant ON outbox_events(tenant_id, status);
CREATE INDEX idx_students_dirty ON students(_is_dirty, _last_sync);
```

### Génération du Schéma SQLite

Le projet contient un script pour générer le schéma SQLite à partir de Prisma :

```bash
cd apps/api-server
npm run generate:sqlite-schema
```

**Fichier généré** : `apps/api-server/prisma/sqlite-schema.sql`

---

## 🌐 Web App : IndexedDB (Navigateur)

### Configuration

**Aucune configuration requise** : IndexedDB est une API Web native, pas besoin d'installation.

### Variables d'Environnement

**Fichier** : `apps/web-app/.env.local`

```env
# ============================================================================
# BASE DE DONNÉES LOCALE - INDEXEDDB (Mode Offline)
# ============================================================================

# Nom de la base de données IndexedDB
# Par défaut : academia-hub-local
NEXT_PUBLIC_LOCAL_DB_NAME=academia-hub-local

# Version de la base de données (pour migrations)
NEXT_PUBLIC_LOCAL_DB_VERSION=1

# Mode de synchronisation
NEXT_PUBLIC_SYNC_MODE=auto

# Intervalle de synchronisation (en millisecondes)
NEXT_PUBLIC_SYNC_INTERVAL=300000

# URL de l'API pour la synchronisation
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
```

### Structure IndexedDB

IndexedDB utilise le même schéma conceptuel que SQLite, mais avec une API différente :

```typescript
// Structure IndexedDB (gérée automatiquement par le service)
interface LocalDbConfig {
  name: string;           // 'academia-hub-local'
  version: number;        // 1
  stores: string[];       // ['students', 'grades', 'outbox_events', ...]
}
```

---

## 🔄 Synchronisation Offline → Online

### Principe

1. **Mode Offline** : Toutes les opérations sont écrites dans SQLite/IndexedDB local
2. **Événements Outbox** : Chaque modification crée un événement dans `outbox_events`
3. **Mode Online** : Les événements sont synchronisés automatiquement vers PostgreSQL
4. **Résolution Conflits** : Le serveur (PostgreSQL) a toujours raison

### Endpoint de Synchronisation

**Route** : `POST /api/sync/offline`

**Fichier** : `apps/api-server/src/sync/sync.controller.ts`

```typescript
@Post('offline')
async syncOffline(
  @Request() req,
  @Body() request: OfflineSyncRequestDto,
): Promise<OfflineSyncResponseDto> {
  const user = req.user;
  return this.offlineSyncService.syncOfflineOperations(request, user.id);
}
```

### Format de Requête

```typescript
interface OfflineSyncRequestDto {
  tenantId: string;
  sqliteSchemaHash: string;      // Hash du schéma SQLite
  sqliteVersion: string;         // Version du schéma
  operations: OfflineOperationDto[];
}

interface OfflineOperationDto {
  id: string;                     // ID unique de l'opération
  operation_type: 'INSERT' | 'UPDATE' | 'DELETE';
  entity_type: string;           // 'student', 'grade', etc.
  entity_id: string;
  payload: any;                   // Données de l'entité
  metadata?: any;
  timestamp: string;              // Timestamp client
}
```

---

## 📝 Variables d'Environnement Complètes

### Desktop App (`apps/desktop-app/.env`)

```env
# ============================================================================
# BASE DE DONNÉES LOCALE - SQLITE (Mode Offline)
# ============================================================================
SQLITE_DB_PATH=./data/academia-hub-local.db
SYNC_MODE=auto
SYNC_INTERVAL=300000
API_URL=http://localhost:3000/api

# ============================================================================
# API BACKEND
# ============================================================================
API_BASE_URL=http://localhost:3000/api
```

### Web App (`apps/web-app/.env.local`)

```env
# ============================================================================
# BASE DE DONNÉES LOCALE - INDEXEDDB (Mode Offline)
# ============================================================================
NEXT_PUBLIC_LOCAL_DB_NAME=academia-hub-local
NEXT_PUBLIC_LOCAL_DB_VERSION=1
NEXT_PUBLIC_SYNC_MODE=auto
NEXT_PUBLIC_SYNC_INTERVAL=300000

# ============================================================================
# API BACKEND
# ============================================================================
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
```

---

## 🔧 Configuration du Serveur pour la Sync

### Variables d'Environnement API Server

**Fichier** : `apps/api-server/.env`

```env
# ============================================================================
# SYNCHRONISATION OFFLINE
# ============================================================================

# Activer la synchronisation offline
OFFLINE_SYNC_ENABLED=true

# Taille maximale du batch de synchronisation
OFFLINE_SYNC_BATCH_SIZE=1000

# Timeout pour les opérations de sync (en ms)
OFFLINE_SYNC_TIMEOUT=30000

# Activer la validation du schéma SQLite
OFFLINE_SYNC_VALIDATE_SCHEMA=true
```

---

## ✅ Checklist de Configuration

### Desktop App (SQLite)

- [ ] Visual Studio Build Tools installé (avec Windows SDK si compilation nécessaire)
- [ ] `better-sqlite3` installé (ou `--ignore-scripts` si non nécessaire)
- [ ] Fichier `.env` créé avec `SQLITE_DB_PATH`
- [ ] Schéma SQLite généré (`npm run generate:sqlite-schema`)
- [ ] Base de données locale initialisée au premier démarrage

### Web App (IndexedDB)

- [ ] Fichier `.env.local` créé avec `NEXT_PUBLIC_LOCAL_DB_NAME`
- [ ] Service IndexedDB initialisé au premier chargement
- [ ] Schéma IndexedDB créé automatiquement

### API Server

- [ ] Variables de sync configurées dans `.env`
- [ ] Endpoint `/api/sync/offline` accessible
- [ ] Validation du schéma SQLite activée

---

## 🐛 Dépannage

### Erreur : "better-sqlite3 compilation failed"

**Solution** :
1. Installer Windows SDK dans Visual Studio Build Tools
2. Ou utiliser `npm install --ignore-scripts` (si SQLite non critique)

### Erreur : "SQLite schema incompatible"

**Solution** :
1. Régénérer le schéma SQLite : `npm run generate:sqlite-schema`
2. Appliquer les migrations SQLite : `npm run migrate:sqlite:up`
3. Vérifier que le hash du schéma correspond

### Erreur : "IndexedDB quota exceeded"

**Solution** :
1. Nettoyer les anciennes données
2. Augmenter le quota dans les paramètres du navigateur
3. Implémenter une stratégie de nettoyage automatique

---

## 📚 Documentation Complémentaire

- **Architecture Offline-First** : `docs/architecture/OFFLINE-FIRST-ARCHITECTURE.md`
- **Implémentation** : `docs/architecture/OFFLINE-FIRST-IMPLEMENTATION.md`
- **Résumé** : `docs/architecture/OFFLINE-FIRST-SUMMARY.md`

---

## 🎯 Résumé

| Plateforme | Base Locale | Configuration | Installation |
|-----------|-------------|---------------|--------------|
| **Desktop** | SQLite (better-sqlite3) | `.env` avec `SQLITE_DB_PATH` | Nécessite compilation native |
| **Web** | IndexedDB | `.env.local` avec `NEXT_PUBLIC_LOCAL_DB_NAME` | Aucune (API native) |
| **Serveur** | PostgreSQL | `.env` avec `DATABASE_URL` | PostgreSQL installé |

**Principe** : PostgreSQL = Source de vérité | SQLite/IndexedDB = Cache local offline

---

**Dernière mise à jour** : 2025-01-17

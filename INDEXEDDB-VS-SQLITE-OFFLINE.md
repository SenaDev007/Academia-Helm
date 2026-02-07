# 💾 IndexedDB vs SQLite (better-sqlite3) - Mode Offline

**Date** : 2025-01-17  
**Version** : 1.0.0

---

## 🎯 Réponse Rapide

**OUI, IndexedDB peut être utilisé pour la base de données locale en mode offline** et c'est même **recommandé pour l'application Web**.

**better-sqlite3** est uniquement nécessaire pour l'**application Desktop (Electron)**.

---

## 📊 Comparaison

| Critère | IndexedDB | better-sqlite3 |
|---------|-----------|----------------|
| **Plateforme** | Navigateur (Web) | Desktop (Electron/Node.js) |
| **Installation** | ✅ API native (aucune) | ⚠️ Nécessite compilation native |
| **Mode Offline** | ✅ Oui, complet | ✅ Oui, complet |
| **Capacité** | ~50% de l'espace disque | Illimitée (disque) |
| **Performance** | ✅ Très bonne | ✅ Excellente |
| **Transactions** | ✅ Oui | ✅ Oui |
| **Requêtes SQL** | ❌ Non (API NoSQL) | ✅ Oui (SQL complet) |
| **Synchronisation** | ✅ Oui (Outbox Pattern) | ✅ Oui (Outbox Pattern) |

---

## 🌐 IndexedDB pour Application Web

### ✅ Avantages

1. **API Native du Navigateur**
   - Aucune installation requise
   - Fonctionne dans tous les navigateurs modernes
   - Pas de compilation native nécessaire

2. **Mode Offline Complet**
   - Stockage persistant même après fermeture du navigateur
   - Capacité importante (généralement 50% de l'espace disque disponible)
   - Transactions ACID

3. **Performance**
   - Très rapide pour les opérations CRUD
   - Indexation automatique
   - Asynchrone (non-bloquant)

4. **Synchronisation**
   - Compatible avec l'Outbox Pattern
   - Supporte les opérations batch
   - Gestion des conflits

### ⚠️ Limitations

1. **Pas de SQL**
   - API NoSQL (object stores)
   - Requêtes via index ou scan
   - Pas de JOIN, GROUP BY, etc.

2. **Capacité Limitée**
   - Dépend du navigateur et de l'espace disque
   - Généralement plusieurs GB (suffisant pour la plupart des cas)

3. **Navigateur Uniquement**
   - Ne fonctionne pas côté serveur (Next.js SSR)
   - Uniquement côté client (browser)

---

## 🖥️ better-sqlite3 pour Application Desktop

### ✅ Avantages

1. **SQL Complet**
   - Requêtes SQL complètes
   - JOIN, GROUP BY, etc.
   - Plus flexible pour requêtes complexes

2. **Performance Maximale**
   - Très rapide
   - Optimisé pour grandes quantités de données

3. **Fichier Unique**
   - Base de données dans un fichier `.db`
   - Facile à sauvegarder/restaurer
   - Portable

### ⚠️ Limitations

1. **Compilation Native**
   - Nécessite Visual Studio Build Tools + Windows SDK
   - Plus complexe à installer
   - Problèmes de compatibilité entre plateformes

2. **Desktop Uniquement**
   - Ne fonctionne pas dans le navigateur
   - Uniquement pour Electron/Node.js

---

## 🏗️ Architecture dans Academia Hub

### Application Web (`apps/web-app`)

**Utilise IndexedDB** ✅

```typescript
// apps/web-app/src/lib/offline/local-db.service.ts

// Détection automatique de l'environnement
if (typeof window !== 'undefined') {
  // Web/Next.js Client : IndexedDB
  await this.initializeIndexedDB();
}
```

**Pourquoi IndexedDB ?**
- ✅ Application Web (Next.js)
- ✅ Fonctionne dans le navigateur
- ✅ Pas de compilation native nécessaire
- ✅ Mode offline complet

### Application Desktop (`apps/desktop-app`)

**Utilise SQLite (better-sqlite3)** ✅

```typescript
// Pour Desktop Electron
import Database from 'better-sqlite3';

const db = new Database('./data/academia-hub-local.db');
```

**Pourquoi SQLite ?**
- ✅ Application Electron (Desktop)
- ✅ Accès au système de fichiers
- ✅ SQL complet pour requêtes complexes
- ✅ Performance maximale

---

## 🔄 Synchronisation Offline → Online

### Les Deux Utilisent le Même Pattern

**IndexedDB (Web)** et **SQLite (Desktop)** utilisent tous les deux :

1. **Outbox Pattern** : Toutes les modifications → `outbox_events`
2. **Colonnes de Sync** : `_version`, `_last_sync`, `_is_dirty`, `_deleted`
3. **Synchronisation** : `POST /api/sync/offline`
4. **Résolution Conflits** : Serveur (PostgreSQL) = source de vérité

### Flux Identique

```
Mode Offline
  ↓
Écriture dans IndexedDB/SQLite local
  ↓
Création événement dans outbox_events
  ↓
[Retour Internet]
  ↓
Synchronisation automatique vers PostgreSQL
  ↓
Mise à jour état local
```

---

## ✅ Recommandation pour Academia Hub

### Application Web (Next.js)

**Utilisez IndexedDB** ✅

**Raisons** :
- ✅ Déjà implémenté dans le projet
- ✅ API native du navigateur
- ✅ Pas de compilation nécessaire
- ✅ Mode offline complet
- ✅ Performance suffisante

**Configuration** :
```env
# apps/web-app/.env.local
NEXT_PUBLIC_LOCAL_DB_NAME=academia-hub-local
NEXT_PUBLIC_LOCAL_DB_VERSION=1
```

### Application Desktop (Electron)

**Utilisez SQLite (better-sqlite3)** ✅

**Raisons** :
- ✅ SQL complet pour requêtes complexes
- ✅ Performance maximale
- ✅ Fichier portable
- ✅ Meilleur pour applications desktop

**Configuration** :
```env
# apps/desktop-app/.env
SQLITE_DB_PATH=./data/academia-hub-local.db
```

---

## 📝 Exemple d'Utilisation

### IndexedDB (Web)

```typescript
// Créer une entité offline
await localDbService.create('students', {
  id: 'student-123',
  tenantId: 'tenant-1',
  firstName: 'John',
  lastName: 'Doe',
  _version: 1,
  _isDirty: true,
  _lastSync: null
});

// Créer un événement dans l'outbox
await outboxService.createEvent({
  tenantId: 'tenant-1',
  eventType: 'CREATE',
  entityType: 'student',
  entityId: 'student-123',
  payload: { ... }
});
```

### SQLite (Desktop)

```typescript
// Créer une entité offline
db.prepare(`
  INSERT INTO students (
    id, tenant_id, first_name, last_name,
    _version, _is_dirty, _last_sync
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(
  'student-123',
  'tenant-1',
  'John',
  'Doe',
  1,
  1,
  null
);

// Créer un événement dans l'outbox
db.prepare(`
  INSERT INTO outbox_events (
    id, tenant_id, event_type, entity_type, entity_id, payload, status
  ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
`).run(...);
```

---

## 🎯 Conclusion

### Pour l'Application Web

**Utilisez IndexedDB** ✅

- ✅ Déjà implémenté
- ✅ Pas besoin de better-sqlite3
- ✅ Mode offline complet
- ✅ Synchronisation automatique

### Pour l'Application Desktop

**Utilisez SQLite (better-sqlite3)** ✅

- ✅ SQL complet
- ✅ Performance maximale
- ✅ Fichier portable

---

## 📚 Documentation

- **IndexedDB MDN** : https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- **better-sqlite3** : https://github.com/WiseLibs/better-sqlite3
- **Architecture Offline** : `docs/architecture/OFFLINE-FIRST-ARCHITECTURE.md`

---

**Dernière mise à jour** : 2025-01-17

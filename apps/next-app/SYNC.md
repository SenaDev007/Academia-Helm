# 🔄 Moteur de Synchronisation Offline-First

## Vue d'ensemble

Le moteur de synchronisation garantit la continuité opérationnelle entre l'application **Desktop (SQLite)** et la plateforme **Web SaaS (PostgreSQL)**, en utilisant le **Outbox Pattern** pour garantir la cohérence et la traçabilité.

---

## 🎯 Principes Fondamentaux

### 1. **PostgreSQL = Source de Vérité**

- Toutes les données opérationnelles sont stockées dans PostgreSQL (serveur)
- SQLite (Desktop) est une **cache locale** avec synchronisation bidirectionnelle
- En cas de conflit, la version serveur prévaut (avec résolution explicite)

### 2. **Offline-First**

- L'application Desktop fonctionne **sans connexion internet**
- Toutes les modifications sont enregistrées localement dans SQLite
- Les changements sont synchronisés dès que la connexion est rétablie

### 3. **Outbox Pattern**

- Chaque modification locale est enregistrée dans une **table outbox** avant d'être synchronisée
- Garantit qu'aucune modification n'est perdue
- Permet la retry automatique en cas d'échec

### 4. **Aucune Perte de Données**

- Tous les événements sont journalisés (audit trail)
- Les conflits sont détectés et résolus explicitement
- Les échecs de synchronisation sont retentés automatiquement

---

## 📋 Architecture

### Composants

```
┌─────────────────┐         ┌─────────────────┐
│   Desktop App   │         │   Web SaaS      │
│   (SQLite)      │◄───────►│   (PostgreSQL)   │
└─────────────────┘         └─────────────────┘
         │                           │
         │                           │
    ┌────▼────┐                 ┌───▼────┐
    │ Outbox  │                 │  API   │
    │ Table   │                 │ Routes │
    └─────────┘                 └────────┘
```

### Flux de Synchronisation

#### **Synchronisation Montante (Desktop → Server)**

1. **Modification locale** : L'utilisateur modifie une donnée dans l'app Desktop
2. **Enregistrement Outbox** : L'événement est enregistré dans la table `outbox_events`
3. **Tentative de sync** : L'app Desktop tente d'envoyer les événements au serveur
4. **Traitement serveur** :
   - Validation de chaque événement
   - Détection de conflits (version locale vs version serveur)
   - Application des changements acceptés
   - Enregistrement dans l'audit trail
5. **Réponse** : Le serveur renvoie les événements acceptés, rejetés, et en conflit
6. **Mise à jour Outbox** : L'app Desktop met à jour le statut des événements

#### **Synchronisation Descendante (Server → Desktop)**

1. **Requête Desktop** : L'app Desktop demande les changements depuis la dernière sync
2. **Récupération serveur** : Le serveur récupère tous les changements depuis `lastSyncTimestamp`
3. **Filtrage multi-tenant** : Seuls les changements du tenant courant sont renvoyés
4. **Application locale** : L'app Desktop applique les changements dans SQLite
5. **Mise à jour timestamp** : Le `lastSyncTimestamp` est mis à jour

---

## 📦 Format des Événements

### OutboxEvent (Desktop → Server)

```typescript
interface OutboxEvent {
  id: string;                    // UUID généré côté Desktop
  tenantId: string;              // ID du tenant (établissement)
  entityType: SyncEntityType;    // Type d'entité (STUDENT, TEACHER, etc.)
  entityId: string;              // ID de l'entité modifiée
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: Record<string, any>;   // Données de l'entité (JSON)
  localVersion: number;           // Version locale (timestamp ou version number)
  createdAt: string;             // Timestamp de création
  lastAttemptAt?: string;        // Dernière tentative d'envoi
  attemptCount: number;           // Nombre de tentatives
  status: OutboxEventStatus;     // PENDING | SENT | ACKNOWLEDGED | FAILED | CONFLICT
  errorMessage?: string;          // Message d'erreur si échec
}
```

### Types d'Entités Synchronisables

- `STUDENT` : Élèves
- `TEACHER` : Enseignants
- `CLASS` : Classes
- `EXAM` : Examens
- `GRADE` : Notes
- `PAYMENT` : Paiements
- `ATTENDANCE` : Présences
- `ABSENCE` : Absences
- `DISCIPLINARY_INCIDENT` : Incidents disciplinaires
- `ACADEMIC_YEAR` : Années académiques
- `SCHOOL_LEVEL` : Niveaux scolaires

---

## 🔄 Flux de Synchronisation Détaillé

### 1. Modification Locale (Desktop)

```typescript
// Exemple : Création d'un élève
const newStudent = {
  firstName: 'Jean',
  lastName: 'DUPONT',
  // ... autres champs
};

// 1. Insertion dans SQLite
await db.students.insert(newStudent);

// 2. Enregistrement dans l'Outbox
await db.outbox_events.insert({
  id: generateUUID(),
  tenantId: currentTenantId,
  entityType: 'STUDENT',
  entityId: newStudent.id,
  operation: 'CREATE',
  payload: newStudent,
  localVersion: Date.now(),
  createdAt: new Date().toISOString(),
  attemptCount: 0,
  status: 'PENDING',
});
```

### 2. Synchronisation Montante

```typescript
// Récupérer les événements en attente
const pendingEvents = await db.outbox_events
  .where('status')
  .equals('PENDING')
  .toArray();

// Préparer la requête
const syncUpRequest: SyncUpRequest = {
  clientId: getClientId(), // ID unique de l'installation Desktop
  events: pendingEvents,
  lastSyncTimestamp: getLastSyncTimestamp(),
};

// Envoyer au serveur
const response = await syncUp(syncUpRequest);

// Traiter la réponse
for (const acknowledged of response.acknowledged) {
  // Marquer comme synchronisé
  await db.outbox_events.update(acknowledged.outboxEventId, {
    status: 'ACKNOWLEDGED',
    serverEventId: acknowledged.serverEventId,
  });
  
  // Mettre à jour l'ID local si création
  if (acknowledged.entityId !== originalEntityId) {
    await db.students.update(originalEntityId, {
      id: acknowledged.entityId,
    });
  }
}

// Traiter les conflits
for (const conflict of response.conflicts) {
  await db.outbox_events.update(conflict.outboxEventId, {
    status: 'CONFLICT',
    errorMessage: conflict.reason,
  });
  
  // Notifier l'utilisateur pour résolution manuelle
  showConflictNotification(conflict);
}
```

### 3. Synchronisation Descendante

```typescript
// Requête des changements serveur
const syncDownRequest: SyncDownRequest = {
  clientId: getClientId(),
  lastSyncTimestamp: getLastSyncTimestamp(),
  entityTypes: undefined, // Toutes les entités
};

// Récupérer les changements
const response = await syncDown(syncDownRequest);

// Appliquer chaque changement localement
for (const change of response.changes) {
  switch (change.operation) {
    case 'CREATE':
      await db[change.entityType.toLowerCase()].insert({
        ...change.payload,
        id: change.entityId,
        serverVersion: change.serverVersion,
      });
      break;
      
    case 'UPDATE':
      await db[change.entityType.toLowerCase()].update(change.entityId, {
        ...change.payload,
        serverVersion: change.serverVersion,
      });
      break;
      
    case 'DELETE':
      await db[change.entityType.toLowerCase()].delete(change.entityId);
      break;
  }
}

// Mettre à jour le timestamp
setLastSyncTimestamp(response.syncTimestamp);
```

---

## ⚔️ Résolution de Conflits

### Détection de Conflits

Un conflit est détecté lorsque :
- La version locale (`localVersion`) est différente de la version serveur (`serverVersion`)
- L'entité a été modifiée côté serveur depuis la dernière synchronisation

### Stratégie de Résolution

**Principe** : **PostgreSQL = Source de Vérité**

1. **Conflit détecté** : Le serveur renvoie le conflit avec les données serveur
2. **Notification utilisateur** : L'app Desktop affiche le conflit
3. **Résolution manuelle** : L'utilisateur choisit :
   - **Accepter la version serveur** : Écraser la version locale
   - **Rejeter la version serveur** : Garder la version locale (nécessite une nouvelle modification serveur)
4. **Application** : La résolution est envoyée au serveur qui applique le choix

### Exemple de Conflit

```typescript
// Conflit détecté
const conflict = {
  outboxEventId: 'evt_123',
  reason: 'Version locale (123456) différente de version serveur (123789)',
  serverData: {
    id: 'student_456',
    firstName: 'Jean',
    lastName: 'DUPONT',
    // ... données serveur
    serverVersion: 123789,
  },
};

// Résolution : Accepter la version serveur
await resolveConflict('evt_123', true);

// L'app Desktop met à jour SQLite avec les données serveur
await db.students.update('student_456', conflict.serverData);
```

---

## 📊 Journalisation (Audit Trail)

### SyncLog

Chaque synchronisation est journalisée pour traçabilité :

```typescript
interface SyncLog {
  id: string;
  tenantId: string;
  clientId: string;
  direction: 'UP' | 'DOWN';
  eventsCount: number;
  conflictsCount: number;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  errorMessage?: string;
}
```

### Utilisation

- **Audit** : Traçabilité complète de toutes les synchronisations
- **Debugging** : Identification des problèmes de synchronisation
- **Analytics** : Statistiques de synchronisation par tenant

---

## 🔐 Sécurité Multi-Tenant

### Isolation Stricte

- Chaque événement est associé à un `tenantId`
- Le serveur vérifie que le `tenantId` de l'événement correspond au tenant de l'utilisateur authentifié
- Les changements serveur sont filtrés par `tenantId` avant envoi

### Validation

- **Authentification** : Token JWT requis pour toutes les requêtes de synchronisation
- **Autorisation** : Vérification que l'utilisateur a accès au tenant
- **Validation des données** : Chaque événement est validé avant application

---

## 🚀 Implémentation Backend Requise

### Routes API Backend

#### `POST /api/sync/up`

**Responsabilités** :
1. Valider chaque événement (format, tenantId, permissions)
2. Détecter les conflits (comparaison de versions)
3. Appliquer les changements acceptés dans PostgreSQL
4. Enregistrer dans l'audit trail
5. Retourner la réponse avec événements acceptés/rejetés/conflits

**Logique de conflit** :
```typescript
// Pseudo-code backend
for (const event of request.events) {
  const existingEntity = await db.findEntity(event.entityType, event.entityId);
  
  if (existingEntity && existingEntity.serverVersion !== event.localVersion) {
    // Conflit détecté
    conflicts.push({
      outboxEventId: event.id,
      reason: 'Version mismatch',
      serverData: existingEntity,
    });
  } else {
    // Pas de conflit, appliquer le changement
    await applyChange(event);
    acknowledged.push({
      outboxEventId: event.id,
      serverEventId: generateServerEventId(),
      entityId: event.entityId,
      serverVersion: newVersion,
    });
  }
}
```

#### `POST /api/sync/down`

**Responsabilités** :
1. Récupérer tous les changements depuis `lastSyncTimestamp`
2. Filtrer par `tenantId` (sécurité multi-tenant)
3. Optionnellement filtrer par `entityTypes`
4. Retourner les changements à appliquer

**Logique** :
```typescript
// Pseudo-code backend
const changes = await db.sync_events
  .where('tenantId').equals(tenantId)
  .where('modifiedAt').greaterThan(request.lastSyncTimestamp)
  .toArray();

return {
  changes: changes.map(change => ({
    id: change.id,
    entityType: change.entityType,
    entityId: change.entityId,
    operation: change.operation,
    payload: change.payload,
    serverVersion: change.serverVersion,
    modifiedAt: change.modifiedAt,
  })),
  syncTimestamp: new Date().toISOString(),
  hasMore: false,
};
```

---

## 📱 Implémentation Desktop Requise

### Table Outbox (SQLite)

```sql
CREATE TABLE outbox_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL, -- 'CREATE' | 'UPDATE' | 'DELETE'
  payload TEXT NOT NULL, -- JSON
  local_version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  last_attempt_at TEXT,
  attempt_count INTEGER DEFAULT 0,
  status TEXT NOT NULL, -- 'PENDING' | 'SENT' | 'ACKNOWLEDGED' | 'FAILED' | 'CONFLICT'
  error_message TEXT,
  server_event_id TEXT
);

CREATE INDEX idx_outbox_status ON outbox_events(status);
CREATE INDEX idx_outbox_tenant ON outbox_events(tenant_id);
```

### Table Sync State (SQLite)

```sql
CREATE TABLE sync_state (
  id INTEGER PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  last_sync_timestamp TEXT,
  client_id TEXT NOT NULL UNIQUE
);
```

### Logique de Synchronisation

1. **Trigger automatique** : Après chaque modification, enregistrer dans l'Outbox
2. **Synchronisation périodique** : Toutes les 30 secondes si en ligne
3. **Retry automatique** : En cas d'échec, retenter avec backoff exponentiel
4. **Résolution de conflits** : Interface utilisateur pour résoudre les conflits

---

## ⚠️ Contraintes & Bonnes Pratiques

### Contraintes

- ❌ **Pas de calcul côté client** : Tous les calculs métier restent côté serveur
- ❌ **Pas de hardcode** : Les règles de synchronisation sont configurables
- ❌ **Pas de perte de données** : Tous les événements sont journalisés
- ✅ **PostgreSQL = Source de vérité** : En cas de conflit, la version serveur prévaut
- ✅ **Isolation multi-tenant** : Chaque tenant est strictement isolé

### Bonnes Pratiques

1. **Synchronisation incrémentale** : Ne synchroniser que les changements depuis la dernière sync
2. **Pagination** : Pour les grandes quantités de données, utiliser la pagination
3. **Retry avec backoff** : En cas d'échec, retenter avec un délai croissant
4. **Validation stricte** : Valider tous les événements avant application
5. **Audit trail complet** : Journaliser toutes les opérations de synchronisation

---

## 🔍 Exemple Complet

### Scénario : Création d'un élève hors ligne

1. **Desktop** : L'utilisateur crée un élève "Jean DUPONT"
   - Insertion dans SQLite : `students` table
   - Enregistrement dans Outbox : `outbox_events` avec `status = 'PENDING'`

2. **Connexion rétablie** : L'app détecte la connexion
   - Récupération des événements `PENDING`
   - Envoi au serveur via `POST /api/sync/up`

3. **Serveur** : Traitement de l'événement
   - Validation : OK
   - Conflit : Aucun (nouvelle entité)
   - Application : Insertion dans PostgreSQL
   - Génération d'un ID serveur : `student_server_789`

4. **Réponse serveur** :
   ```json
   {
     "acknowledged": [{
       "outboxEventId": "evt_123",
       "serverEventId": "srv_evt_456",
       "entityId": "student_server_789",
       "serverVersion": 123456
     }],
     "conflicts": [],
     "rejected": []
   }
   ```

5. **Desktop** : Mise à jour
   - Mise à jour de l'Outbox : `status = 'ACKNOWLEDGED'`
   - Mise à jour de l'élève : `id = 'student_server_789'`

6. **Synchronisation descendante** : Vérification des changements serveur
   - Aucun changement (déjà synchronisé)

---

## 📝 Résumé

- ✅ **Outbox Pattern** : Garantit qu'aucune modification n'est perdue
- ✅ **Synchronisation bidirectionnelle** : Desktop ↔ Server
- ✅ **Résolution de conflits** : PostgreSQL = Source de vérité
- ✅ **Journalisation complète** : Audit trail de toutes les opérations
- ✅ **Isolation multi-tenant** : Sécurité garantie
- ✅ **Offline-first** : Fonctionnement sans connexion

**Version** : 1.0.0  
**Dernière mise à jour** : 2025


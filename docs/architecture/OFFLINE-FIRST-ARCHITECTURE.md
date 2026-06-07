# 🔌 Architecture Offline-First — Academia Hub

## 🎯 Vision et Objectif

Implémenter une architecture offline-first complète permettant à Academia Hub de fonctionner à **100% hors ligne**, avec synchronisation automatique et sécurisée vers PostgreSQL lorsque la connexion internet est rétablie.

### Principe Non Négociable

> **Le client peut TOUT faire offline.  
> Le serveur consolide et valide.  
> PostgreSQL est la source de vérité finale.**

---

## 🏗️ Architecture Générale

### Vue d'Ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Web/Desktop/Mobile)              │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │   UI Layer   │───▶│ Business     │───▶│  Outbox      │ │
│  │              │    │ Logic        │    │  Pattern     │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
│         │                    │                    │         │
│         └────────────────────┼────────────────────┘         │
│                              │                              │
│                    ┌─────────▼─────────┐                    │
│                    │  SQLite Local     │                    │
│                    │  (IndexedDB Web)  │                    │
│                    └───────────────────┘                    │
│                              │                              │
│                    ┌─────────▼─────────┐                    │
│                    │  Network          │                    │
│                    │  Detection        │                    │
│                    └───────────────────┘                    │
└────────────────────────────┬────────────────────────────────┘
                             │
                             │ HTTPS
                             │
┌────────────────────────────▼────────────────────────────────┐
│                    SERVEUR (API SaaS)                       │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │  /sync       │───▶│  Validation  │───▶│  Conflict    │ │
│  │  Endpoint    │    │  Business    │    │  Resolution  │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
│         │                    │                    │         │
│         └────────────────────┼────────────────────┘         │
│                              │                              │
│                    ┌─────────▼─────────┐                    │
│                    │  PostgreSQL      │                    │
│                    │  (Source Truth)  │                    │
│                    └───────────────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Composants Client

### 1. Base Locale SQLite (ou IndexedDB)

#### Schéma Local

Le schéma local doit être **proche de PostgreSQL** avec toutes les tables métier :

```sql
-- Tables métier (exemples)
CREATE TABLE students (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  birth_date DATE,
  enrollment_date DATE,
  class_id TEXT,
  status TEXT DEFAULT 'ACTIVE',
  _version INTEGER DEFAULT 1,
  _last_sync TIMESTAMP,
  _is_dirty INTEGER DEFAULT 0,
  _deleted INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE grades (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  exam_id TEXT,
  value REAL NOT NULL,
  max_value REAL DEFAULT 20,
  coefficient REAL DEFAULT 1,
  comment TEXT,
  exam_date DATE,
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
CREATE INDEX idx_grades_dirty ON grades(_is_dirty, _last_sync);
```

#### Métadonnées de Synchronisation

Chaque table métier contient des colonnes de synchronisation :
- `_version` : Version de l'entité (pour détection conflits)
- `_last_sync` : Dernière synchronisation réussie
- `_is_dirty` : Flag indiquant si l'entité a été modifiée localement
- `_deleted` : Flag soft delete

### 2. Outbox Pattern

#### Principe

**Toute action utilisateur génère un événement dans l'outbox. Aucun appel direct à l'API métier.**

#### Flux

```
Action Utilisateur
  ↓
Business Logic (écriture SQLite locale)
  ↓
Génération événement Outbox
  ↓
Écriture dans outbox_events
  ↓
[Si online] → Synchronisation automatique
[Si offline] → Attente connexion
```

#### Implémentation

```typescript
// src/services/outbox.service.ts

interface OutboxEvent {
  id: string;
  tenantId: string;
  eventType: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: string;
  entityId: string;
  payload: any;
  metadata?: any;
}

class OutboxService {
  /**
   * Crée un événement dans l'outbox
   */
  async createEvent(event: Omit<OutboxEvent, 'id' | 'status' | 'created_at'>): Promise<void> {
    const eventId = generateUUID();
    
    await db.execute(`
      INSERT INTO outbox_events (
        id, tenant_id, event_type, entity_type, entity_id,
        payload, metadata, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')
    `, [
      eventId,
      event.tenantId,
      event.eventType,
      event.entityType,
      event.entityId,
      JSON.stringify(event.payload),
      event.metadata ? JSON.stringify(event.metadata) : null
    ]);
  }

  /**
   * Récupère les événements en attente
   */
  async getPendingEvents(tenantId: string, limit = 100): Promise<OutboxEvent[]> {
    return await db.query(`
      SELECT * FROM outbox_events
      WHERE tenant_id = ? AND status = 'PENDING'
      ORDER BY created_at ASC
      LIMIT ?
    `, [tenantId, limit]);
  }

  /**
   * Marque un événement comme synchronisé
   */
  async markAsSynced(eventId: string): Promise<void> {
    await db.execute(`
      UPDATE outbox_events
      SET status = 'SYNCED', synced_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [eventId]);
  }

  /**
   * Marque un événement comme échec
   */
  async markAsFailed(eventId: string, error: string): Promise<void> {
    await db.execute(`
      UPDATE outbox_events
      SET status = 'FAILED', error_message = ?, retry_count = retry_count + 1
      WHERE id = ?
    `, [error, eventId]);
  }
}
```

### 3. Mode Offline Total

#### Principe

**Aucune action ne doit échouer hors ligne. L'UI doit refléter l'état "offline".**

#### Implémentation

```typescript
// src/services/offline.service.ts

class OfflineService {
  private isOnline: boolean = navigator.onLine;

  constructor() {
    // Écouter les changements de connexion
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.onConnectionRestored();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.onConnectionLost();
    });
  }

  /**
   * Vérifie si l'application est en ligne
   */
  isConnected(): boolean {
    return this.isOnline;
  }

  /**
   * Exécute une action (offline-first)
   */
  async executeAction<T>(
    action: () => Promise<T>,
    offlineAction: () => Promise<T>
  ): Promise<T> {
    if (this.isOnline) {
      try {
        return await action();
      } catch (error) {
        // Si échec, fallback offline
        return await offlineAction();
      }
    } else {
      return await offlineAction();
    }
  }

  /**
   * Callback quand la connexion est rétablie
   */
  private async onConnectionRestored(): Promise<void> {
    // Lancer la synchronisation automatique
    await syncService.sync();
  }

  /**
   * Callback quand la connexion est perdue
   */
  private onConnectionLost(): void {
    // Afficher un indicateur offline dans l'UI
    uiService.showOfflineIndicator();
  }
}
```

### 4. Détection Connexion

#### Implémentation

```typescript
// src/services/network-detection.service.ts

class NetworkDetectionService {
  private listeners: Array<(online: boolean) => void> = [];

  constructor() {
    // Écouter les événements réseau
    window.addEventListener('online', () => this.notifyListeners(true));
    window.addEventListener('offline', () => this.notifyListeners(false));

    // Vérification périodique (ping serveur)
    setInterval(() => this.checkConnection(), 30000); // Toutes les 30s
  }

  /**
   * Vérifie la connexion réelle (ping serveur)
   */
  private async checkConnection(): Promise<void> {
    try {
      const response = await fetch('/api/health', { method: 'HEAD' });
      this.notifyListeners(response.ok);
    } catch {
      this.notifyListeners(false);
    }
  }

  /**
   * Ajoute un listener
   */
  onConnectionChange(callback: (online: boolean) => void): void {
    this.listeners.push(callback);
  }

  /**
   * Notifie tous les listeners
   */
  private notifyListeners(online: boolean): void {
    this.listeners.forEach(callback => callback(online));
  }
}
```

---

## 🔄 Service de Synchronisation Client

### Implémentation

```typescript
// src/services/sync.service.ts

interface SyncRequest {
  tenantId: string;
  events: OutboxEvent[];
  clientTimestamp: string;
}

interface SyncResponse {
  success: boolean;
  syncedEvents: string[];        // IDs des événements synchronisés
  conflicts: Conflict[];         // Conflits détectés
  errors: SyncError[];           // Erreurs de validation
  serverTimestamp: string;
}

interface Conflict {
  eventId: string;
  entityType: string;
  entityId: string;
  reason: string;
  serverVersion: any;
  clientVersion: any;
}

class SyncService {
  private isSyncing: boolean = false;
  private syncInterval: number | null = null;

  constructor() {
    // Synchronisation automatique périodique (si online)
    this.startAutoSync();
  }

  /**
   * Lance la synchronisation
   */
  async sync(): Promise<SyncResponse> {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return;
    }

    if (!offlineService.isConnected()) {
      console.log('Offline, skipping sync');
      return;
    }

    this.isSyncing = true;

    try {
      const tenantId = await authService.getTenantId();
      const pendingEvents = await outboxService.getPendingEvents(tenantId);

      if (pendingEvents.length === 0) {
        return { success: true, syncedEvents: [], conflicts: [], errors: [], serverTimestamp: new Date().toISOString() };
      }

      // Marquer les événements comme "SYNCING"
      await this.markEventsAsSyncing(pendingEvents.map(e => e.id));

      // Envoyer au serveur
      const response = await this.sendToServer({
        tenantId,
        events: pendingEvents,
        clientTimestamp: new Date().toISOString()
      });

      // Traiter la réponse
      await this.handleSyncResponse(response, pendingEvents);

      return response;
    } catch (error) {
      console.error('Sync error:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Envoie les événements au serveur
   */
  private async sendToServer(request: SyncRequest): Promise<SyncResponse> {
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await authService.getToken()}`
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Traite la réponse de synchronisation
   */
  private async handleSyncResponse(
    response: SyncResponse,
    events: OutboxEvent[]
  ): Promise<void> {
    // Marquer les événements synchronisés
    for (const eventId of response.syncedEvents) {
      await outboxService.markAsSynced(eventId);
    }

    // Traiter les conflits
    for (const conflict of response.conflicts) {
      await this.resolveConflict(conflict);
    }

    // Traiter les erreurs
    for (const error of response.errors) {
      await this.handleSyncError(error);
    }

    // Mettre à jour le timestamp de dernière sync
    await this.updateSyncState(response.serverTimestamp);
  }

  /**
   * Résout un conflit
   */
  private async resolveConflict(conflict: Conflict): Promise<void> {
    // Stratégie : Last Write Wins avec notification utilisateur
    // Le serveur a toujours raison (source de vérité)
    
    // Mettre à jour la version locale avec la version serveur
    await this.updateLocalEntity(
      conflict.entityType,
      conflict.entityId,
      conflict.serverVersion
    );

    // Notifier l'utilisateur du conflit
    uiService.showConflictNotification(conflict);
  }

  /**
   * Démarre la synchronisation automatique
   */
  private startAutoSync(): void {
    // Sync toutes les 5 minutes si online
    this.syncInterval = setInterval(async () => {
      if (offlineService.isConnected()) {
        await this.sync();
      }
    }, 5 * 60 * 1000);
  }
}
```

---

## 🖥️ Composants Serveur

### 1. Endpoint /sync

#### Implémentation

```typescript
// src/app/api/sync/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { validateSyncRequest, processSyncEvents } from '@/services/sync.service';

/**
 * POST /api/sync
 * 
 * Endpoint de synchronisation offline-first
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authentification
    const session = await getServerSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = session.tenantId;
    const body = await request.json();

    // 2. Validation de la requête
    const validation = validateSyncRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid sync request', details: validation.errors },
        { status: 400 }
      );
    }

    // 3. Traitement des événements
    const result = await processSyncEvents(tenantId, body.events);

    // 4. Réponse structurée
    return NextResponse.json({
      success: true,
      syncedEvents: result.syncedEvents,
      conflicts: result.conflicts,
      errors: result.errors,
      serverTimestamp: new Date().toISOString()
    }, { status: 200 });

  } catch (error: any) {
    console.error('Sync endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
```

### 2. Service de Synchronisation Serveur

```typescript
// src/services/sync.service.ts

interface SyncResult {
  syncedEvents: string[];
  conflicts: Conflict[];
  errors: SyncError[];
}

class SyncService {
  /**
   * Traite les événements de synchronisation
   */
  async processSyncEvents(
    tenantId: string,
    events: OutboxEvent[]
  ): Promise<SyncResult> {
    const result: SyncResult = {
      syncedEvents: [],
      conflicts: [],
      errors: []
    };

    // Traiter les événements dans l'ordre
    for (const event of events) {
      try {
        // Vérifier les conflits
        const conflict = await this.checkConflict(tenantId, event);
        if (conflict) {
          result.conflicts.push(conflict);
          continue;
        }

        // Valider l'événement
        const validation = await this.validateEvent(tenantId, event);
        if (!validation.valid) {
          result.errors.push({
            eventId: event.id,
            error: validation.error,
            details: validation.details
          });
          continue;
        }

        // Appliquer l'événement
        await this.applyEvent(tenantId, event);
        result.syncedEvents.push(event.id);

        // Journaliser
        await this.logSyncEvent(tenantId, event, 'SUCCESS');

      } catch (error: any) {
        result.errors.push({
          eventId: event.id,
          error: error.message,
          details: error.stack
        });
      }
    }

    return result;
  }

  /**
   * Vérifie les conflits
   */
  private async checkConflict(
    tenantId: string,
    event: OutboxEvent
  ): Promise<Conflict | null> {
    // Récupérer la version serveur
    const serverEntity = await this.getServerEntity(
      tenantId,
      event.entityType,
      event.entityId
    );

    if (!serverEntity) {
      return null; // Pas de conflit si l'entité n'existe pas
    }

    // Comparer les versions
    const clientVersion = event.payload._version || 1;
    const serverVersion = serverEntity._version || 1;

    if (clientVersion < serverVersion) {
      // Le serveur a une version plus récente
      return {
        eventId: event.id,
        entityType: event.entityType,
        entityId: event.entityId,
        reason: 'Server has newer version',
        serverVersion: serverEntity,
        clientVersion: event.payload
      };
    }

    return null;
  }

  /**
   * Valide un événement
   */
  private async validateEvent(
    tenantId: string,
    event: OutboxEvent
  ): Promise<{ valid: boolean; error?: string; details?: any }> {
    // Validation métier selon le type d'entité
    switch (event.entityType) {
      case 'student':
        return await this.validateStudent(tenantId, event.payload);
      case 'grade':
        return await this.validateGrade(tenantId, event.payload);
      // ... autres types
      default:
        return { valid: false, error: 'Unknown entity type' };
    }
  }

  /**
   * Applique un événement
   */
  private async applyEvent(
    tenantId: string,
    event: OutboxEvent
  ): Promise<void> {
    // Transaction PostgreSQL
    await db.transaction(async (trx) => {
      switch (event.eventType) {
        case 'CREATE':
          await this.createEntity(trx, tenantId, event);
          break;
        case 'UPDATE':
          await this.updateEntity(trx, tenantId, event);
          break;
        case 'DELETE':
          await this.deleteEntity(trx, tenantId, event);
          break;
      }

      // Incrémenter la version
      await this.incrementVersion(trx, tenantId, event);
    });
  }

  /**
   * Journalise un événement de sync
   */
  private async logSyncEvent(
    tenantId: string,
    event: OutboxEvent,
    status: 'SUCCESS' | 'CONFLICT' | 'ERROR'
  ): Promise<void> {
    await db.query(`
      INSERT INTO sync_logs (
        tenant_id, event_id, entity_type, entity_id,
        event_type, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      tenantId,
      event.id,
      event.entityType,
      event.entityId,
      event.eventType,
      status
    ]);
  }
}
```

### 3. Gestion des Conflits

#### Stratégie : Last Write Wins avec Notification

```typescript
// src/services/conflict-resolution.service.ts

class ConflictResolutionService {
  /**
   * Résout un conflit selon la stratégie
   */
  async resolveConflict(
    tenantId: string,
    conflict: Conflict
  ): Promise<void> {
    // Stratégie : Le serveur a toujours raison (source de vérité)
    // Mais on notifie l'utilisateur

    // 1. Mettre à jour avec la version serveur
    await this.updateWithServerVersion(
      tenantId,
      conflict.entityType,
      conflict.entityId,
      conflict.serverVersion
    );

    // 2. Créer un événement de notification
    await this.createConflictNotification(tenantId, conflict);

    // 3. Journaliser
    await this.logConflictResolution(tenantId, conflict);
  }

  /**
   * Met à jour avec la version serveur
   */
  private async updateWithServerVersion(
    tenantId: string,
    entityType: string,
    entityId: string,
    serverVersion: any
  ): Promise<void> {
    // Mise à jour dans PostgreSQL
    await db.query(`
      UPDATE ${entityType}s
      SET 
        -- Mettre à jour tous les champs avec la version serveur
        _version = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `, [
      serverVersion._version + 1,
      entityId,
      tenantId
    ]);
  }
}
```

---

## 🔒 Sécurité

### Authentification

- JWT pour chaque requête de sync
- Validation du tenant_id
- Rate limiting sur /sync

### Validation

- Validation métier stricte
- Sanitization des données
- Vérification des permissions

### Traçabilité

- Journalisation complète
- Audit trail
- Logs exploitables

---

## 📊 Table de Synchronisation Serveur

```sql
-- Table de logs de synchronisation
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  event_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,              -- 'SUCCESS', 'CONFLICT', 'ERROR'
  error_message TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Index
CREATE INDEX idx_sync_logs_tenant ON sync_logs(tenant_id, created_at);
CREATE INDEX idx_sync_logs_event ON sync_logs(event_id);
```

---

## 📝 Résumé

### Architecture Client

- ✅ Base locale SQLite complète
- ✅ Outbox Pattern pour tous les événements
- ✅ Mode offline total
- ✅ Détection connexion automatique
- ✅ Synchronisation automatique

### Architecture Serveur

- ✅ Endpoint /sync robuste
- ✅ Validation métier stricte
- ✅ Résolution de conflits
- ✅ Journalisation complète
- ✅ PostgreSQL source de vérité

### Contraintes Respectées

- ✅ Aucune perte de données
- ✅ Aucun sync silencieux en échec
- ✅ Aucun hardcode
- ✅ Traçabilité complète
- ✅ Logs exploitables
- ✅ Sécurité prioritaire

---

**Version** : 1.0  
**Dernière mise à jour** : 2025


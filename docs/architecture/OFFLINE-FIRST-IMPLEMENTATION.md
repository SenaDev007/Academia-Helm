# 🔧 Implémentation Offline-First — Academia Hub

## Vue d'ensemble

Guide d'implémentation détaillé pour l'architecture offline-first d'Academia Hub.

---

## 📋 Phase 1 : Base Locale SQLite

### 1.1 Schéma SQLite

Créer le schéma SQLite local avec toutes les tables métier :

```sql
-- File: database/sqlite/local-schema.sql

-- Table Students
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

-- Table Grades
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

-- Table Outbox Events
CREATE TABLE outbox_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  metadata TEXT,
  status TEXT DEFAULT 'PENDING',
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  synced_at TIMESTAMP
);

-- Table Sync State
CREATE TABLE sync_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL UNIQUE,
  last_sync_timestamp TIMESTAMP,
  last_sync_success BOOLEAN DEFAULT 0,
  pending_events_count INTEGER DEFAULT 0,
  conflict_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index
CREATE INDEX idx_outbox_status ON outbox_events(status, created_at);
CREATE INDEX idx_outbox_tenant ON outbox_events(tenant_id, status);
CREATE INDEX idx_students_dirty ON students(_is_dirty, _last_sync);
CREATE INDEX idx_grades_dirty ON grades(_is_dirty, _last_sync);
```

### 1.2 Service SQLite

```typescript
// src/services/local-db.service.ts

import Database from 'better-sqlite3';
import { app } from 'electron'; // Pour Desktop
// ou localStorage pour Web

class LocalDbService {
  private db: Database;

  constructor() {
    const dbPath = this.getDbPath();
    this.db = new Database(dbPath);
    this.initializeSchema();
  }

  /**
   * Initialise le schéma
   */
  private initializeSchema(): void {
    // Exécuter le schéma SQLite
    const schema = fs.readFileSync('database/sqlite/local-schema.sql', 'utf-8');
    this.db.exec(schema);
  }

  /**
   * Exécute une requête
   */
  query(sql: string, params: any[] = []): any[] {
    return this.db.prepare(sql).all(params);
  }

  /**
   * Exécute une commande
   */
  execute(sql: string, params: any[] = []): void {
    this.db.prepare(sql).run(params);
  }

  /**
   * Transaction
   */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }
}
```

---

## 📋 Phase 2 : Outbox Pattern

### 2.1 Service Outbox

```typescript
// src/services/outbox.service.ts

class OutboxService {
  /**
   * Crée un événement dans l'outbox
   */
  async createEvent(event: Omit<OutboxEvent, 'id' | 'status' | 'created_at'>): Promise<string> {
    const eventId = this.generateUUID();
    
    await localDb.execute(`
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

    // Mettre à jour le compteur d'événements en attente
    await this.updatePendingCount(event.tenantId);

    return eventId;
  }

  /**
   * Récupère les événements en attente
   */
  async getPendingEvents(tenantId: string, limit = 100): Promise<OutboxEvent[]> {
    const rows = await localDb.query(`
      SELECT * FROM outbox_events
      WHERE tenant_id = ? AND status = 'PENDING'
      ORDER BY created_at ASC
      LIMIT ?
    `, [tenantId, limit]);

    return rows.map(row => ({
      id: row.id,
      tenantId: row.tenant_id,
      eventType: row.event_type,
      entityType: row.entity_type,
      entityId: row.entity_id,
      payload: JSON.parse(row.payload),
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      status: row.status,
      retryCount: row.retry_count,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      syncedAt: row.synced_at
    }));
  }

  /**
   * Marque un événement comme synchronisé
   */
  async markAsSynced(eventId: string): Promise<void> {
    await localDb.execute(`
      UPDATE outbox_events
      SET status = 'SYNCED', synced_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [eventId]);

    // Mettre à jour le compteur
    const event = await this.getEvent(eventId);
    await this.updatePendingCount(event.tenantId);
  }

  /**
   * Marque un événement comme échec
   */
  async markAsFailed(eventId: string, error: string): Promise<void> {
    await localDb.execute(`
      UPDATE outbox_events
      SET status = 'FAILED', error_message = ?, retry_count = retry_count + 1
      WHERE id = ?
    `, [error, eventId]);
  }

  /**
   * Met à jour le compteur d'événements en attente
   */
  private async updatePendingCount(tenantId: string): Promise<void> {
    const count = await localDb.query(`
      SELECT COUNT(*) as count FROM outbox_events
      WHERE tenant_id = ? AND status = 'PENDING'
    `, [tenantId]);

    await localDb.execute(`
      UPDATE sync_state
      SET pending_events_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = ?
    `, [count[0].count, tenantId]);
  }
}
```

### 2.2 Intégration dans Business Logic

```typescript
// src/services/student.service.ts

class StudentService {
  /**
   * Crée un élève (offline-first)
   */
  async createStudent(tenantId: string, data: CreateStudentDto): Promise<Student> {
    const studentId = this.generateUUID();
    const student: Student = {
      id: studentId,
      tenantId,
      ...data,
      _version: 1,
      _isDirty: true,
      _deleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // 1. Écrire dans SQLite local
    await localDb.execute(`
      INSERT INTO students (
        id, tenant_id, first_name, last_name, email, phone,
        birth_date, enrollment_date, class_id, status,
        _version, _is_dirty, _deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      student.id,
      student.tenantId,
      student.firstName,
      student.lastName,
      student.email,
      student.phone,
      student.birthDate,
      student.enrollmentDate,
      student.classId,
      student.status,
      student._version,
      1, // _is_dirty
      0, // _deleted
      student.createdAt,
      student.updatedAt
    ]);

    // 2. Créer un événement dans l'outbox
    await outboxService.createEvent({
      tenantId,
      eventType: 'CREATE',
      entityType: 'student',
      entityId: studentId,
      payload: student,
      metadata: {
        userId: await authService.getUserId(),
        timestamp: new Date().toISOString()
      }
    });

    // 3. Si online, lancer la synchronisation
    if (offlineService.isConnected()) {
      syncService.sync(); // Async, ne pas attendre
    }

    return student;
  }

  /**
   * Met à jour un élève (offline-first)
   */
  async updateStudent(
    tenantId: string,
    studentId: string,
    data: UpdateStudentDto
  ): Promise<Student> {
    // 1. Récupérer l'élève local
    const student = await this.getStudentLocal(tenantId, studentId);
    if (!student) {
      throw new Error('Student not found');
    }

    // 2. Mettre à jour dans SQLite local
    const updatedStudent = {
      ...student,
      ...data,
      _version: student._version + 1,
      _isDirty: true,
      updatedAt: new Date()
    };

    await localDb.execute(`
      UPDATE students
      SET first_name = ?, last_name = ?, email = ?, phone = ?,
          _version = ?, _is_dirty = ?, updated_at = ?
      WHERE id = ? AND tenant_id = ?
    `, [
      updatedStudent.firstName,
      updatedStudent.lastName,
      updatedStudent.email,
      updatedStudent.phone,
      updatedStudent._version,
      1, // _is_dirty
      updatedStudent.updatedAt,
      studentId,
      tenantId
    ]);

    // 3. Créer un événement dans l'outbox
    await outboxService.createEvent({
      tenantId,
      eventType: 'UPDATE',
      entityType: 'student',
      entityId: studentId,
      payload: updatedStudent,
      metadata: {
        userId: await authService.getUserId(),
        timestamp: new Date().toISOString()
      }
    });

    // 4. Si online, lancer la synchronisation
    if (offlineService.isConnected()) {
      syncService.sync(); // Async
    }

    return updatedStudent;
  }
}
```

---

## 📋 Phase 3 : Service de Synchronisation

### 3.1 Service Sync Client

```typescript
// src/services/sync.service.ts

class SyncService {
  private isSyncing: boolean = false;
  private syncInterval: number | null = null;

  constructor() {
    // Écouter les changements de connexion
    networkDetectionService.onConnectionChange((online) => {
      if (online) {
        this.sync(); // Lancer la sync quand la connexion revient
      }
    });

    // Synchronisation automatique périodique
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
        return {
          success: true,
          syncedEvents: [],
          conflicts: [],
          errors: [],
          serverTimestamp: new Date().toISOString()
        };
      }

      // Marquer comme "SYNCING"
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
      // Marquer les événements comme FAILED
      await this.handleSyncError(error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Envoie les événements au serveur
   */
  private async sendToServer(request: SyncRequest): Promise<SyncResponse> {
    const token = await authService.getToken();
    
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Sync failed: ${error.message || response.statusText}`);
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
      
      // Mettre à jour l'entité locale (marquer comme synced)
      const event = events.find(e => e.id === eventId);
      if (event) {
        await this.markEntityAsSynced(event.entityType, event.entityId);
      }
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
   * Marque une entité comme synchronisée
   */
  private async markEntityAsSynced(
    entityType: string,
    entityId: string
  ): Promise<void> {
    await localDb.execute(`
      UPDATE ${entityType}s
      SET _is_dirty = 0, _last_sync = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [entityId]);
  }

  /**
   * Résout un conflit
   */
  private async resolveConflict(conflict: Conflict): Promise<void> {
    // Stratégie : Le serveur a toujours raison
    // Mettre à jour la version locale avec la version serveur
    
    await localDb.execute(`
      UPDATE ${conflict.entityType}s
      SET 
        -- Mettre à jour avec la version serveur
        _version = ?,
        _is_dirty = 0,
        _last_sync = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      conflict.serverVersion._version,
      conflict.entityId
    ]);

    // Notifier l'utilisateur
    uiService.showConflictNotification(conflict);
  }

  /**
   * Démarre la synchronisation automatique
   */
  private startAutoSync(): void {
    // Sync toutes les 5 minutes si online
    this.syncInterval = setInterval(async () => {
      if (offlineService.isConnected() && !this.isSyncing) {
        await this.sync();
      }
    }, 5 * 60 * 1000);
  }
}
```

---

## 📋 Phase 4 : Endpoint Serveur /sync

### 4.1 Route API

```typescript
// src/app/api/sync/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/session';
import { processSyncEvents } from '@/services/sync.service';

/**
 * POST /api/sync
 * 
 * Endpoint de synchronisation offline-first
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authentification
    const session = await getServerSession(request);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const tenantId = session.tenantId;
    const body = await request.json();

    // 2. Validation de la requête
    if (!body.events || !Array.isArray(body.events)) {
      return NextResponse.json(
        { error: 'Invalid request: events array required' },
        { status: 400 }
      );
    }

    if (body.events.length > 1000) {
      return NextResponse.json(
        { error: 'Too many events: maximum 1000 per request' },
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
      {
        error: 'Internal server error',
        message: error.message
      },
      { status: 500 }
    );
  }
}
```

### 4.2 Service de Synchronisation Serveur

```typescript
// src/services/server-sync.service.ts

interface SyncResult {
  syncedEvents: string[];
  conflicts: Conflict[];
  errors: SyncError[];
}

class ServerSyncService {
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

    // Traiter les événements dans l'ordre (transaction)
    for (const event of events) {
      try {
        // 1. Vérifier les conflits
        const conflict = await this.checkConflict(tenantId, event);
        if (conflict) {
          result.conflicts.push(conflict);
          await this.logSyncEvent(tenantId, event, 'CONFLICT');
          continue;
        }

        // 2. Valider l'événement
        const validation = await this.validateEvent(tenantId, event);
        if (!validation.valid) {
          result.errors.push({
            eventId: event.id,
            error: validation.error || 'Validation failed',
            details: validation.details
          });
          await this.logSyncEvent(tenantId, event, 'ERROR', validation.error);
          continue;
        }

        // 3. Appliquer l'événement (transaction PostgreSQL)
        await this.applyEvent(tenantId, event);
        result.syncedEvents.push(event.id);
        await this.logSyncEvent(tenantId, event, 'SUCCESS');

      } catch (error: any) {
        result.errors.push({
          eventId: event.id,
          error: error.message,
          details: error.stack
        });
        await this.logSyncEvent(tenantId, event, 'ERROR', error.message);
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
      // Pas de conflit si l'entité n'existe pas (CREATE)
      if (event.eventType === 'CREATE') {
        return null;
      }
      // Conflit si UPDATE/DELETE sur entité inexistante
      return {
        eventId: event.id,
        entityType: event.entityType,
        entityId: event.entityId,
        reason: 'Entity does not exist on server',
        serverVersion: null,
        clientVersion: event.payload
      };
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
    status: 'SUCCESS' | 'CONFLICT' | 'ERROR',
    errorMessage?: string
  ): Promise<void> {
    await db.query(`
      INSERT INTO sync_logs (
        tenant_id, event_id, entity_type, entity_id,
        event_type, status, error_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      tenantId,
      event.id,
      event.entityType,
      event.entityId,
      event.eventType,
      status,
      errorMessage || null
    ]);
  }
}
```

---

## 📋 Phase 5 : UI Offline

### 5.1 Indicateur Offline

```typescript
// src/components/OfflineIndicator.tsx

'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { useOffline } from '@/hooks/useOffline';

export default function OfflineIndicator() {
  const isOnline = useOffline();

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-orange-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2 z-50">
      <WifiOff className="w-5 h-5" />
      <span>Mode hors ligne - Synchronisation automatique à la reconnexion</span>
    </div>
  );
}
```

### 5.2 Hook useOffline

```typescript
// src/hooks/useOffline.ts

import { useState, useEffect } from 'react';
import { networkDetectionService } from '@/services/network-detection.service';

export function useOffline(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    networkDetectionService.onConnectionChange(setIsOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
```

---

## 📝 Résumé

### Checklist d'Implémentation

- [ ] Schéma SQLite local créé
- [ ] Service LocalDb implémenté
- [ ] Outbox Pattern implémenté
- [ ] Service de synchronisation client
- [ ] Endpoint /sync serveur
- [ ] Gestion des conflits
- [ ] Détection réseau
- [ ] UI offline
- [ ] Tests complets
- [ ] Documentation

---

**Version** : 1.0  
**Dernière mise à jour** : 2025


# 📝 Mécanisme de Journalisation Offline - Academia Hub

**Date** : Documentation du mécanisme de journalisation  
**Statut** : ✅ **Mécanisme documenté**

---

## 🎯 Principe Fondamental

**Aucune écriture directe dans les tables métier sans journalisation.**

Toute action offline (INSERT, UPDATE, DELETE) doit être :
1. ✅ Écrite dans la table métier (SQLite)
2. ✅ Journalisée dans `offline_operations` (obligatoire)
3. ✅ Synchronisée ultérieurement avec PostgreSQL

---

## 📋 Table `offline_operations`

### Structure

```sql
CREATE TABLE offline_operations (
  id TEXT PRIMARY KEY,                    -- UUID de l'opération
  table_name TEXT NOT NULL,              -- Nom de la table (ex: 'students')
  record_id TEXT NOT NULL,               -- ID de l'enregistrement
  operation_type TEXT NOT NULL,          -- INSERT | UPDATE | DELETE
  payload TEXT NOT NULL,                 -- JSON immuable (état complet)
  created_at TEXT DEFAULT (datetime('now')),
  sync_status TEXT DEFAULT 'PENDING',    -- PENDING | SYNCING | SYNCED | FAILED | CONFLICT
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  synced_at TEXT
);
```

### Règles

1. **Payload Immutable** : Une fois créé, le payload JSON ne peut jamais être modifié
2. **État Complet** : Le payload contient l'état COMPLET de l'entité (pas seulement les champs modifiés)
3. **Journal Obligatoire** : Toute écriture métier doit créer une entrée dans `offline_operations`
4. **Ordre Chronologique** : Les opérations sont synchronisées dans l'ordre de `created_at`

---

## 🔧 Wrapper d'Écriture SQLite

### Principe

Toute écriture dans une table métier doit passer par un wrapper qui :
1. ✅ Effectue l'opération sur la table métier
2. ✅ Crée automatiquement l'entrée dans `offline_operations`
3. ✅ Garantit l'atomicité (transaction)

### Implémentation TypeScript (Exemple)

```typescript
/**
 * Wrapper d'écriture SQLite avec journalisation automatique
 */
class OfflineWriteWrapper {
  /**
   * Créer un enregistrement avec journalisation
   */
  async insert(tableName: string, data: any, deviceId: string): Promise<string> {
    const db = await this.getDB();
    const operationId = uuidv4();
    const recordId = data.id || uuidv4(); // ID final ou local_id temporaire
    
    // Transaction atomique
    await db.transaction((tx) => {
      // 1. Insertion dans la table métier
      tx.executeSql(
        `INSERT INTO ${tableName} (id, ${Object.keys(data).join(', ')}, sync_status, local_updated_at, device_id)
         VALUES (?, ?, ?, ?, ?)`,
        [
          recordId,
          ...Object.values(data),
          'PENDING',
          new Date().toISOString(),
          deviceId
        ]
      );
      
      // 2. Journalisation dans offline_operations
      tx.executeSql(
        `INSERT INTO offline_operations (
          id, table_name, record_id, operation_type, payload,
          created_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          operationId,
          tableName,
          recordId,
          'INSERT',
          JSON.stringify(data), // Payload immuable
          new Date().toISOString(),
          'PENDING'
        ]
      );
    });
    
    return recordId;
  }
  
  /**
   * Modifier un enregistrement avec journalisation
   */
  async update(tableName: string, recordId: string, data: any, deviceId: string): Promise<void> {
    const db = await this.getDB();
    const operationId = uuidv4();
    
    // Récupérer l'état complet actuel
    const currentState = await db.executeSql(
      `SELECT * FROM ${tableName} WHERE id = ?`,
      [recordId]
    );
    
    // Fusionner avec les modifications
    const updatedState = { ...currentState, ...data, id: recordId };
    
    // Transaction atomique
    await db.transaction((tx) => {
      // 1. Mise à jour dans la table métier
      const setClause = Object.keys(data).map(k => `${k} = ?`).join(', ');
      tx.executeSql(
        `UPDATE ${tableName}
         SET ${setClause}, sync_status = ?, local_updated_at = ?, device_id = ?
         WHERE id = ?`,
        [
          ...Object.values(data),
          'PENDING',
          new Date().toISOString(),
          deviceId,
          recordId
        ]
      );
      
      // 2. Journalisation dans offline_operations
      tx.executeSql(
        `INSERT INTO offline_operations (
          id, table_name, record_id, operation_type, payload,
          created_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          operationId,
          tableName,
          recordId,
          'UPDATE',
          JSON.stringify(updatedState), // État COMPLET
          new Date().toISOString(),
          'PENDING'
        ]
      );
    });
  }
  
  /**
   * Supprimer un enregistrement (soft delete) avec journalisation
   */
  async delete(tableName: string, recordId: string, deviceId: string): Promise<void> {
    const db = await this.getDB();
    const operationId = uuidv4();
    
    // Récupérer l'état complet actuel
    const currentState = await db.executeSql(
      `SELECT * FROM ${tableName} WHERE id = ?`,
      [recordId]
    );
    
    // Soft delete : mettre status = 'DELETED'
    const deletedState = { ...currentState, status: 'DELETED', id: recordId };
    
    // Transaction atomique
    await db.transaction((tx) => {
      // 1. Soft delete dans la table métier
      tx.executeSql(
        `UPDATE ${tableName}
         SET status = ?, sync_status = ?, local_updated_at = ?, device_id = ?
         WHERE id = ?`,
        ['DELETED', 'PENDING', new Date().toISOString(), deviceId, recordId]
      );
      
      // 2. Journalisation dans offline_operations
      tx.executeSql(
        `INSERT INTO offline_operations (
          id, table_name, record_id, operation_type, payload,
          created_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          operationId,
          tableName,
          recordId,
          'DELETE',
          JSON.stringify(deletedState), // État COMPLET avant suppression
          new Date().toISOString(),
          'PENDING'
        ]
      );
    });
  }
}
```

---

## 📊 Flux de Journalisation

```
Action Utilisateur (Offline)
  ↓
Wrapper d'Écriture
  ↓
Transaction SQLite (Atomique)
  ├── 1. Écriture table métier
  │     (INSERT/UPDATE/DELETE)
  └── 2. Journalisation offline_operations
        (INSERT avec payload JSON)
  ↓
Succès → Enregistrement créé
  ↓
Synchronisation (quand online)
  ↓
API POST /sync/upload
  ↓
Lecture offline_operations (status='PENDING')
  ↓
Envoi payload à PostgreSQL
  ↓
Mise à jour sync_status='SYNCED'
```

---

## 🔍 Exemples Concrets

### Exemple 1 : Création d'un élève offline

```typescript
// ❌ Écriture directe (INTERDITE)
await db.executeSql(
  'INSERT INTO students (id, tenantId, firstName, lastName, ...) VALUES (?, ?, ?, ?, ...)',
  ['student-id', 'tenant-id', 'Jean', 'Dupont', ...]
);

// ✅ Écriture avec wrapper (OBLIGATOIRE)
await offlineWriteWrapper.insert('students', {
  id: 'student-uuid',
  tenantId: 'tenant-uuid',
  academicYearId: 'academic-year-uuid',
  schoolLevelId: 'school-level-uuid',
  firstName: 'Jean',
  lastName: 'Dupont',
  status: 'ACTIVE'
}, deviceId);

// Résultat :
// 1. Insertion dans `students` (avec sync_status='PENDING')
// 2. Insertion dans `offline_operations` (operation_type='INSERT', payload=JSON complet)
```

---

### Exemple 2 : Modification d'un paiement offline

```typescript
// ✅ Modification avec wrapper
await offlineWriteWrapper.update('payments', 'payment-uuid', {
  amount: 150.00,  // Modification
  notes: 'Paiement partiel'  // Modification
}, deviceId);

// Résultat :
// 1. UPDATE dans `payments` (amount=150.00, notes=..., sync_status='PENDING')
// 2. INSERT dans `offline_operations` :
//    - operation_type='UPDATE'
//    - payload='{"id":"payment-uuid","amount":150.00,"notes":"Paiement partiel",...}' (état COMPLET)
```

---

### Exemple 3 : Suppression offline (soft delete)

```typescript
// ✅ Suppression avec wrapper (soft delete)
await offlineWriteWrapper.delete('students', 'student-uuid', deviceId);

// Résultat :
// 1. UPDATE dans `students` (status='DELETED', sync_status='PENDING')
// 2. INSERT dans `offline_operations` :
//    - operation_type='DELETE'
//    - payload='{"id":"student-uuid","status":"DELETED",...}' (état complet avant suppression)
```

---

## 🔄 Récupération des Opérations en Attente

### Récupérer toutes les opérations pending

```sql
-- Récupérer par ordre chronologique
SELECT * FROM offline_operations
WHERE sync_status = 'PENDING'
ORDER BY created_at ASC;
```

### Récupérer les opérations d'une table spécifique

```sql
-- Récupérer opérations pending pour 'students'
SELECT * FROM offline_operations
WHERE table_name = 'students'
AND sync_status = 'PENDING'
ORDER BY created_at ASC;
```

---

## ✅ Validation Post-Journalisation

### Vérifier qu'une opération est journalisée

```sql
-- Vérifier qu'une modification d'élève est journalisée
SELECT * FROM offline_operations
WHERE table_name = 'students'
AND record_id = 'student-uuid'
AND operation_type = 'UPDATE'
ORDER BY created_at DESC
LIMIT 1;
```

### Vérifier la cohérence

```sql
-- Vérifier que tous les enregistrements PENDING ont une opération journalisée
SELECT 
  s.id as student_id,
  COUNT(o.id) as operation_count
FROM students s
LEFT JOIN offline_operations o ON o.table_name = 'students' AND o.record_id = s.id
WHERE s.sync_status = 'PENDING'
GROUP BY s.id
HAVING COUNT(o.id) = 0;  -- Devrait être 0 (tous doivent avoir une opération)
```

---

## ⚠️ Règles Strictes

### ❌ NE JAMAIS

1. **Écriture directe sans wrapper** :
   ```typescript
   // ❌ INTERDIT
   db.executeSql('INSERT INTO students (...) VALUES (...)');
   ```

2. **Modifier le payload après création** :
   ```typescript
   // ❌ INTERDIT
   UPDATE offline_operations SET payload = '...' WHERE id = '...';
   ```

3. **Suppression physique (DELETE)** :
   ```typescript
   // ❌ INTERDIT
   db.executeSql('DELETE FROM students WHERE id = ?', [studentId]);
   ```

### ✅ TOUJOURS

1. **Utiliser le wrapper d'écriture** :
   ```typescript
   // ✅ OBLIGATOIRE
   await offlineWriteWrapper.insert('students', data, deviceId);
   ```

2. **Payload état complet** :
   ```typescript
   // ✅ Payload doit contenir TOUS les champs
   const payload = JSON.stringify({
     id: record.id,
     ...record,  // Tous les champs
   });
   ```

3. **Soft delete uniquement** :
   ```typescript
   // ✅ Soft delete (status='DELETED')
   await offlineWriteWrapper.delete('students', studentId, deviceId);
   ```

---

## 📊 Métadonnées de Synchronisation

### Mise à jour `sync_status` après sync

```typescript
// Après synchronisation réussie
await db.executeSql(
  `UPDATE offline_operations
   SET sync_status = ?, synced_at = ?
   WHERE id = ?`,
  ['SYNCED', new Date().toISOString(), operationId]
);

// Mettre à jour aussi la table métier
await db.executeSql(
  `UPDATE students
   SET sync_status = ?
   WHERE id = ?`,
  ['SYNCED', recordId]
);
```

### Gestion des conflits

```typescript
// En cas de conflit
await db.executeSql(
  `UPDATE offline_operations
   SET sync_status = ?, error_message = ?
   WHERE id = ?`,
  ['CONFLICT', 'Conflit détecté: serveur a priorité', operationId]
);

// Mettre à jour la table métier avec la version serveur
await db.executeSql(
  `UPDATE students
   SET sync_status = ?, ... (données serveur)
   WHERE id = ?`,
  ['SYNCED', recordId]
);
```

---

## ✅ Checklist Mécanisme de Journalisation

- [ ] Table `offline_operations` créée
- [ ] Wrapper d'écriture implémenté
- [ ] Toutes les écritures passent par le wrapper
- [ ] Payload JSON immuable (jamais modifié)
- [ ] Payload contient état complet (tous les champs)
- [ ] Transaction atomique (table métier + offline_operations)
- [ ] Soft delete uniquement (pas de DELETE physique)
- [ ] Index sur `offline_operations` pour performance
- [ ] Récupération chronologique des opérations pending

---

**Le mécanisme de journalisation offline est maintenant documenté !** ✅

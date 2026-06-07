# ⚔️ Gestion des Conflits Offline → Online - Academia Hub

**Date** : Documentation gestion conflits  
**Statut** : ✅ **Mécanisme documenté**

---

## 🎯 Règle Générale

**PostgreSQL gagne toujours.**

En cas de conflit entre données offline (SQLite) et online (PostgreSQL), la version PostgreSQL est appliquée.

---

## 📋 Cas de Conflit

### 1. Enregistrement Modifié Côté Serveur

**Scénario** :
- Élève modifié offline (local_updated_at: 2024-01-01T10:00:00)
- Même élève modifié en ligne (updatedAt: 2024-01-01T11:00:00)
- Sync détecte `server.updatedAt > client.local_updated_at`

**Résolution** : PostgreSQL gagne

**Action client** :
- Marquer opération `sync_status = 'CONFLICT'` dans `offline_operations`
- Mettre à jour enregistrement local avec `server_data`
- Notifier utilisateur

---

### 2. Enregistrement Supprimé Côté Serveur

**Scénario** :
- Tentative UPDATE/DELETE sur enregistrement supprimé côté serveur
- Serveur retourne `status = 'DELETED'` ou enregistrement absent

**Résolution** : PostgreSQL gagne

**Action client** :
- Marquer opération `sync_status = 'CONFLICT'`
- Supprimer enregistrement local (soft delete déjà appliqué)
- Notifier utilisateur

---

### 3. Règle Métier Violée

**Scénario** :
- Paiement modifié offline mais reçu déjà émis côté serveur
- Élève modifié offline mais profil tarifaire supprimé côté serveur
- etc.

**Résolution** : PostgreSQL gagne (règle métier serveur prioritaire)

**Action client** :
- Marquer opération `sync_status = 'CONFLICT'`
- Appliquer version serveur
- Notifier utilisateur avec `conflict_reason`

---

## 🔍 Détection de Conflit

### Méthode 1 : Comparaison `updated_at`

```typescript
if (serverRecord.updatedAt > clientPayload.local_updated_at) {
  // Conflit détecté : serveur modifié après client
  return { hasConflict: true, reason: '...' };
}
```

**Avantage** : Simple, efficace  
**Limite** : Nécessite `updated_at` présent

---

### Méthode 2 : Comparaison Version (si versioning implémenté)

```typescript
if (serverRecord.version > clientPayload.version) {
  // Conflit détecté : version serveur supérieure
  return { hasConflict: true, reason: '...' };
}
```

**Avantage** : Plus robuste  
**Limite** : Nécessite versioning implémenté

---

### Méthode 3 : Vérification Règles Métier

```typescript
// Exemple : Paiement avec reçu émis
if (serverRecord.receiptNumber && !clientPayload.receiptNumber) {
  return { hasConflict: true, reason: 'Un reçu a été émis pour ce paiement côté serveur' };
}
```

**Avantage** : Détecte conflits métier spécifiques  
**Limite** : Nécessite règles par table

---

## 📊 Flow de Gestion Conflit

```
Opération Offline
  ↓
Détection Conflit (Serveur)
  ↓
Conflit Détecté ?
  ├── NON → Appliquer opération (SUCCESS)
  └── OUI → Marquer CONFLICT
            ↓
            Retourner server_data
            ↓
            Client met à jour local
            ↓
            Notifier utilisateur
            ↓
            Proposer options :
              - Annuler
              - Ressaisir
              - Demander validation direction
```

---

## 🔧 Implémentation Client

### 1. Détecter Conflit par `updated_at`

```typescript
// Avant sync, vérifier updated_at
const localRecord = await localDb.getRecord('students', studentId);
const serverRecord = await apiClient.getStudent(studentId);

if (new Date(serverRecord.updatedAt) > new Date(localRecord.local_updated_at)) {
  // Conflit détecté : ne pas sync
  await offlineOperations.markAsConflict(operationId, {
    reason: 'Enregistrement modifié côté serveur',
    serverData: serverRecord,
  });
  return;
}
```

---

### 2. Marquer Opération en CONFLICT

```typescript
// Après réception réponse sync avec status='CONFLICT'
await offlineOperations.update(operationId, {
  sync_status: 'CONFLICT',
  error_message: result.conflict_reason,
});

// Mettre à jour enregistrement local avec server_data
await localDb.update('students', studentId, {
  ...result.server_data,
  sync_status: 'SYNCED', // Maintenant syncé (version serveur)
  local_updated_at: new Date().toISOString(),
  device_id: null, // Modifié depuis serveur
});
```

---

### 3. Notifier Utilisateur

```typescript
// Notification utilisateur
notifyUser({
  type: 'conflict',
  title: 'Conflit de synchronisation',
  message: result.conflict_reason,
  actions: [
    { label: 'Annuler', action: 'cancel' },
    { label: 'Ressaisir', action: 'retry' },
    { label: 'Demander validation', action: 'request_validation' },
  ],
  data: {
    operationId: result.operation_id,
    tableName: operation.table_name,
    recordId: operation.record_id,
    serverData: result.server_data,
  },
});
```

---

## 🎨 Options Utilisateur en Cas de Conflit

### Option 1 : Annuler

**Action** : Ignorer l'opération offline, conserver version serveur

**Implémentation** :
```typescript
// Supprimer opération offline
await offlineOperations.delete(operationId);

// Conserver version serveur (déjà appliquée)
```

---

### Option 2 : Ressaisir

**Action** : Remplacer version serveur par nouvelle version client

**Implémentation** :
```typescript
// Créer nouvelle opération UPDATE avec données corrigées
await offlineWriteWrapper.update('students', studentId, {
  ...correctedData, // Données corrigées par utilisateur
  // ...
});

// Sync ultérieure appliquera la nouvelle version
```

---

### Option 3 : Demander Validation Direction

**Action** : Soumettre opération pour validation administrative

**Implémentation** :
```typescript
// Créer demande de validation
await validationRequests.create({
  operationId: operationId,
  tableName: operation.table_name,
  recordId: operation.record_id,
  clientData: operation.payload,
  serverData: result.server_data,
  requestedBy: userId,
  status: 'PENDING',
});

// Marquer opération en attente validation
await offlineOperations.update(operationId, {
  sync_status: 'PENDING_VALIDATION',
});
```

---

## 📋 Tableau Récapitulatif

| Cas de Conflit | Détection | Résolution | Action Client |
|----------------|-----------|------------|---------------|
| **Enregistrement modifié serveur** | `server.updatedAt > client.local_updated_at` | PostgreSQL gagne | Appliquer `server_data` |
| **Enregistrement supprimé serveur** | `server.status = 'DELETED'` ou absent | PostgreSQL gagne | Supprimer local |
| **Règle métier violée** | Vérification spécifique (ex: reçu émis) | PostgreSQL gagne | Notifier + options |

---

## ✅ Checklist Gestion Conflits

### Côté Serveur

- [ ] Détection conflit par `updated_at`
- [ ] Détection conflit par version (si versioning)
- [ ] Vérification règles métier par table
- [ ] Retourner `server_data` en cas de conflit
- [ ] Retourner `conflict_reason` explicite

### Côté Client

- [ ] Marquer opération `sync_status = 'CONFLICT'`
- [ ] Appliquer `server_data` localement
- [ ] Notifier utilisateur avec `conflict_reason`
- [ ] Proposer options (annuler, ressaisir, validation)
- [ ] Archivage opération conflictuelle (traçabilité)

---

## 🔍 Exemples Concrets

### Exemple 1 : Conflit Modification

**Scénario** :
- Offline : Élève `firstName = "Jean"` (local_updated_at: 10:00)
- Online : Élève `firstName = "Jean-Michel"` (updatedAt: 11:00)
- Sync : Détecte `11:00 > 10:00` → CONFLICT

**Résolution** :
```json
{
  "operation_id": "op-uuid",
  "status": "CONFLICT",
  "server_record_id": "student-uuid",
  "server_data": {
    "id": "student-uuid",
    "firstName": "Jean-Michel",
    ...
  },
  "conflict_reason": "Enregistrement modifié côté serveur le 2024-01-01T11:00:00Z"
}
```

**Action client** :
- Appliquer `server_data` (firstName = "Jean-Michel")
- Notifier utilisateur : "Modification écrasée par version serveur"

---

### Exemple 2 : Conflit Suppression

**Scénario** :
- Offline : UPDATE sur élève
- Online : Élève supprimé (`status = 'DELETED'`)
- Sync : Détecte suppression → CONFLICT

**Résolution** :
```json
{
  "operation_id": "op-uuid",
  "status": "CONFLICT",
  "conflict_reason": "Enregistrement supprimé côté serveur",
  "error_message": "Impossible de mettre à jour un enregistrement supprimé"
}
```

**Action client** :
- Marquer élève localement comme `DELETED`
- Notifier utilisateur : "Élève supprimé côté serveur"

---

## ⚠️ Règles Importantes

1. **PostgreSQL = Autorité Finale** : Jamais de merge automatique
2. **Notification Obligatoire** : Toujours notifier utilisateur en cas de conflit
3. **Options Utilisateur** : Toujours proposer choix (annuler, ressaisir, validation)
4. **Traçabilité** : Conserver historique des conflits (archivage)

---

**La gestion des conflits est maintenant documentée !** ✅

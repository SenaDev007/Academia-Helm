# 🔄 Protocole de Synchronisation Offline → PostgreSQL - Academia Hub

**Date** : Documentation du protocole de sync  
**Endpoint** : `POST /api/sync/offline`  
**Statut** : ✅ **Protocole documenté**

---

## 🎯 Vue d'Ensemble

Le protocole de synchronisation permet de synchroniser les opérations effectuées offline (SQLite) vers PostgreSQL (serveur).

**Principe** : PostgreSQL = Autorité Finale  
**Règle** : PostgreSQL gagne en cas de conflit

---

## 📋 Flux de Synchronisation

```
┌─────────────────────────────────────────────────────────────────┐
│  1. DÉTECTION CONNEXION DISPONIBLE                              │
│     (Middleware réseau détecte reconnexion)                     │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. VÉRIFICATION VERSION SCHÉMA                                 │
│     - Client envoie sqliteSchemaHash                            │
│     - Serveur valide conformité                                 │
│     - Rejet si schéma incompatible                              │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. ENVOI OPÉRATIONS PAR ORDRE CHRONOLOGIQUE                    │
│     - Opérations triées par local_updated_at                    │
│     - Envoi batch par table                                     │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. VALIDATION SERVEUR                                          │
│     - Vérification tenantId & permissions                       │
│     - Validation règles métier                                  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. APPLIQUER RÈGLES MÉTIER SERVEUR                             │
│     - Transaction par batch                                     │
│     - Détection conflits                                        │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. RETOURNER RÉSULTAT PAR OPÉRATION                            │
│     - SUCCESS : Opération appliquée                             │
│     - CONFLICT : Conflit détecté (serveur gagne)                │
│     - ERROR : Erreur technique                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📡 Endpoint : POST /api/sync/offline

### Authentification

**Requis** : JWT Bearer Token  
**Guard** : `JwtAuthGuard`

### Headers

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

### Request Body

```typescript
{
  tenantId: string;              // Tenant ID (doit correspondre au token JWT)
  sqliteSchemaHash: string;      // Hash du schéma SQLite
  sqliteVersion: string;         // Version du schéma SQLite (ex: "1.0.0")
  lastSyncTimestamp?: string;    // Timestamp dernière sync (ISO 8601)
  operations: [                   // Opérations à synchroniser (triées chronologiquement)
    {
      id: string;                // UUID de l'opération
      table_name: string;        // Nom de la table (ex: "students")
      record_id: string;         // ID de l'enregistrement
      operation_type: "INSERT" | "UPDATE" | "DELETE";
      payload: object;           // JSON payload (état complet de l'entité)
      local_updated_at?: string; // Date modification locale (ISO 8601)
      device_id?: string;        // Identifiant dispositif
    }
  ]
}
```

### Response Body (Succès)

```typescript
{
  sync_id: string;               // UUID de la session de sync
  tenantId: string;
  success: boolean;              // True si aucune erreur fatale
  total_operations: number;      // Nombre total d'opérations
  successful_operations: number; // Nombre d'opérations réussies
  conflicted_operations: number; // Nombre d'opérations en conflit
  failed_operations: number;     // Nombre d'opérations échouées
  results: [                     // Résultat détaillé par opération
    {
      operation_id: string;
      status: "SUCCESS" | "CONFLICT" | "ERROR" | "VALIDATION_FAILED";
      server_record_id?: string; // ID final sur serveur (si SUCCESS)
      server_data?: object;      // Données serveur (si CONFLICT)
      error_message?: string;    // Message d'erreur (si ERROR)
      conflict_reason?: string;  // Raison conflit (si CONFLICT)
    }
  ],
  schema_validation_status: "OK" | "INCOMPATIBLE" | "WARNING";
  completed_at: string;          // Date fin sync (ISO 8601)
}
```

### Response Body (Erreur)

#### 400 Bad Request - Schéma Incompatible

```json
{
  "statusCode": 400,
  "message": "Schéma SQLite incompatible: <reason>. Mise à jour de l'application requise.",
  "error": "Bad Request"
}
```

#### 403 Forbidden - Permissions Insuffisantes

```json
{
  "statusCode": 403,
  "message": "Accès interdit: tenant non autorisé",
  "error": "Forbidden"
}
```

---

## 🔒 Sécurité

### Validation TenantId

Le `tenantId` dans le body **DOIT** correspondre au `tenantId` du token JWT.

**Rejet si** :
- `tenantId` mismatch entre body et token
- Utilisateur n'appartient pas au tenant
- Tenant inactif

### Permissions Utilisateur

**Vérifications** :
- Utilisateur existe
- Utilisateur actif (`status = 'active'`)
- Utilisateur appartient au tenant

---

## ⚙️ Règles de Traitement

### 1. Transaction par Batch

Les opérations sont **groupées par table** et traitées dans une **transaction unique**.

**Avantage** : Atomicité garantie par table

**Timeout** : 30 secondes maximum par transaction

### 2. Ordre Chronologique

Les opérations sont **toujours triées** par `local_updated_at` (ordre croissant).

**Garantie** : Création avant modification, modification avant suppression

### 3. Journalisation Serveur

**Toutes les opérations sont journalisées** dans une table d'audit (à implémenter).

**Objectif** : Traçabilité complète des syncs

### 4. Rejet si Schéma Incompatible

Si `schema_validation_status !== 'OK'`, la sync est **rejetée** avant traitement.

**Message** : "Mise à jour de l'application requise"

---

## 📊 Gestion des Conflits

Voir document séparé : `CONFLICT-RESOLUTION.md`

**Règle générale** : PostgreSQL gagne toujours

---

## 🔍 Exemples

### Exemple 1 : Sync Simple (Succès)

**Request** :
```json
{
  "tenantId": "tenant-uuid",
  "sqliteSchemaHash": "abc123...",
  "sqliteVersion": "1.0.0",
  "operations": [
    {
      "id": "op-uuid-1",
      "table_name": "students",
      "record_id": "student-uuid",
      "operation_type": "INSERT",
      "payload": {
        "id": "student-uuid",
        "tenantId": "tenant-uuid",
        "firstName": "Jean",
        "lastName": "Dupont",
        ...
      },
      "local_updated_at": "2024-01-01T12:00:00Z"
    }
  ]
}
```

**Response** :
```json
{
  "sync_id": "sync-uuid",
  "tenantId": "tenant-uuid",
  "success": true,
  "total_operations": 1,
  "successful_operations": 1,
  "conflicted_operations": 0,
  "failed_operations": 0,
  "results": [
    {
      "operation_id": "op-uuid-1",
      "status": "SUCCESS",
      "server_record_id": "student-uuid"
    }
  ],
  "schema_validation_status": "OK",
  "completed_at": "2024-01-01T12:00:01Z"
}
```

### Exemple 2 : Sync avec Conflit

**Request** : (même que Exemple 1, mais enregistrement déjà modifié côté serveur)

**Response** :
```json
{
  "sync_id": "sync-uuid",
  "tenantId": "tenant-uuid",
  "success": false,
  "total_operations": 1,
  "successful_operations": 0,
  "conflicted_operations": 1,
  "failed_operations": 0,
  "results": [
    {
      "operation_id": "op-uuid-1",
      "status": "CONFLICT",
      "server_record_id": "student-uuid",
      "server_data": {
        "id": "student-uuid",
        "firstName": "Jean-Michel", // Modifié côté serveur
        ...
      },
      "conflict_reason": "Enregistrement modifié côté serveur le 2024-01-01T11:59:00Z"
    }
  ],
  "schema_validation_status": "OK",
  "completed_at": "2024-01-01T12:00:01Z"
}
```

---

## ✅ Checklist Client

Avant d'envoyer une requête de sync :

- [ ] Connexion réseau disponible
- [ ] Token JWT valide
- [ ] `sqliteSchemaHash` à jour
- [ ] Opérations triées par `local_updated_at` (ordre croissant)
- [ ] `tenantId` correspond au token JWT
- [ ] Payload JSON valide (état complet pour chaque opération)
- [ ] Pas d'opérations dupliquées (même `operation_id`)

---

## ⚠️ Erreurs Courantes

### 1. Schéma Incompatible

**Cause** : Schéma SQLite obsolète

**Solution** : Mettre à jour l'application

---

### 2. TenantId Mismatch

**Cause** : `tenantId` dans body ≠ `tenantId` dans token JWT

**Solution** : Vérifier cohérence `tenantId`

---

### 3. Transaction Timeout

**Cause** : Trop d'opérations dans un batch

**Solution** : Réduire taille batch ou diviser en plusieurs appels

---

## 📊 Métriques Recommandées

**Taille batch** : Maximum 100 opérations par appel  
**Taille payload** : Maximum 5 MB par requête  
**Fréquence sync** : Maximum 1 sync toutes les 5 secondes

---

**Le protocole de synchronisation est maintenant documenté !** ✅

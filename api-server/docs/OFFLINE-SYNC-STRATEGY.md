# 🔄 Stratégie de Synchronisation Offline → Online - Academia Hub

**Date** : Documentation stratégie offline-first  
**Statut** : ✅ **Stratégie définie**

---

## 🎯 Principes Fondamentaux

### 1. PostgreSQL = Autorité Finale

**PostgreSQL (Supabase) est la source de vérité unique.**

- ✅ Toutes les décisions de conflit en faveur de PostgreSQL
- ✅ SQLite est un miroir temporaire pour travail offline
- ✅ La synchronisation est **unidirectionnelle** : SQLite → PostgreSQL
- ✅ Le download PostgreSQL → SQLite est pour mise à jour uniquement

### 2. SQLite = Travail Hors Ligne

**SQLite permet le travail complet offline.**

- ✅ Lecture de toutes les données nécessaires
- ✅ Création/modification/suppression (avec colonnes techniques)
- ✅ Validation métier côté client (si applicable)
- ✅ Stockage dans outbox pour sync ultérieure

### 3. Synchronisation Explicite

**Aucune synchronisation silencieuse.**

- ✅ L'utilisateur doit déclencher explicitement la sync
- ✅ La sync peut être automatique à la reconnexion (optionnel)
- ✅ Notification de l'utilisateur en cas d'erreur/conflit
- ✅ Logs complets de toutes les opérations de sync

### 4. Aucune Perte de Données

**Toutes les données offline sont préservées.**

- ✅ Outbox pattern : stockage des événements en attente
- ✅ Versioning : détection de conflits par version
- ✅ Rollback : possibilité de restaurer état précédent
- ✅ Archivage : conservation des données supprimées (soft delete)

---

## 📊 Cycle Offline → Sync → Online

```
┌─────────────────────────────────────────────────────────────────┐
│                         OFFLINE MODE                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  1. Travail Local (SQLite)                              │  │
│  │     - Lecture données                                     │  │
│  │     - Création/modification (avec colonnes techniques)   │  │
│  │     - Validation métier côté client                      │  │
│  │     - Stockage dans outbox_events                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ Reconnexion réseau détectée
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SYNC PREPARATION                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  2. Validation Schéma                                    │  │
│  │     - Vérifier compatibilité SQLite ↔ PostgreSQL        │  │
│  │     - Bloquer si schéma incompatible                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  3. Préparation Outbox                                   │  │
│  │     - Récupérer événements pending (outbox_events)      │  │
│  │     - Trier par ordre chronologique                      │  │
│  │     - Valider données avant envoi                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ Sync démarre
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SYNC UPLOAD                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  4. Upload Événements (SQLite → PostgreSQL)             │  │
│  │     Pour chaque événement dans outbox_events :          │  │
│  │     a. Envoyer à API (POST /sync/upload)                │  │
│  │     b. Si succès :                                       │  │
│  │        - Marquer événement comme SYNCED                  │  │
│  │        - Mettre à jour sync_status = 'synced'            │  │
│  │        - Mettre à jour local_updated_at                  │  │
│  │     c. Si conflit :                                      │  │
│  │        - Marquer événement comme CONFLICT                │  │
│  │        - Mettre à jour sync_status = 'conflict'          │  │
│  │        - Stocker conflit dans sync_conflicts             │  │
│  │        - Notifier utilisateur                            │  │
│  │     d. Si erreur :                                       │  │
│  │        - Marquer événement comme FAILED                  │  │
│  │        - Incrémenter retry_count                         │  │
│  │        - Réessayer selon stratégie retry                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ Upload terminé
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SYNC DOWNLOAD                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  5. Download Mises à Jour (PostgreSQL → SQLite)         │  │
│  │     a. Demander dernières modifications (GET /sync/pull) │  │
│  │     b. Appliquer mises à jour dans SQLite                │  │
│  │     c. Mettre à jour sync_status = 'synced'              │  │
│  │     d. Mettre à jour local_updated_at                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ Sync terminée
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                         ONLINE MODE                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  6. Travail Normal                                       │  │
│  │     - Les modifications peuvent aller directement API    │  │
│  │     - Ou passer par SQLite + outbox (optionnel)          │  │
│  │     - PostgreSQL reste source de vérité                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 Modules Offline-Enabled

### ✅ Modules Actifs Offline

Ces modules fonctionnent **complètement offline** :

| Module | Tables Offline | Opérations Offline |
|--------|----------------|-------------------|
| **Élèves** | `students`, `student_guardians`, `guardians` | CRUD complet |
| **Notes** | `grades`, `exams` | Création/lecture |
| **Présences** | `attendance_records`, `absences` | CRUD complet |
| **Paiements** | `payments`, `student_fees`, `payment_allocations` | Création/lecture |
| **Frais** | `fee_definitions`, `fee_regimes`, `student_fee_profiles` | Lecture |
| **Classes** | `classes`, `class_students` | Lecture |
| **Devoirs** | `homework_entries`, `homework_submissions` | CRUD complet |
| **Annonces** | `announcements` | Lecture |

**Total** : ~46 tables offline (voir `OFFLINE-SYNC-ANALYSIS.md`)

---

### ❌ Modules Interdits Offline

Ces modules **nécessitent une connexion** :

| Module | Raison | Tables Exclues |
|--------|--------|----------------|
| **Authentification** | Tokens serveur, sessions | `sessions`, `portal_sessions` |
| **Audit/Logs** | Serveur uniquement | `audit_logs`, `message_logs` |
| **Tokens temporaires** | Validation serveur | `password_resets`, `public_verification_tokens` |
| **Cache/Stats** | Calculé serveur | `*_cache`, `*_stats` |

---

## ⚠️ Opérations Interdites Offline

### 1. Authentification Initiale

**Règle** : L'utilisateur doit être authentifié **en ligne** avant de travailler offline.

**Raison** : Tokens JWT, sessions serveur, validation credentials.

**Solution** : Token d'authentification validé une fois, puis cache local (tant que valide).

---

### 2. Création Tenant/École

**Règle** : Création de tenant/école **interdite offline**.

**Raison** : Configuration serveur, validation unique, paiement.

**Solution** : Nécessite connexion pour création initiale.

---

### 3. Suppression Définitive

**Règle** : Suppression physique (`DELETE`) **interdite offline**.

**Raison** : Récupération impossible, traçabilité.

**Solution** : Utiliser soft delete (`status = 'DELETED'`) qui sera sync.

---

### 4. Opérations Administrateur

**Règle** : Modifications paramètres école **interdites offline**.

**Raison** : Validation serveur, règles métier complexes.

**Tables concernées** :
- `school_settings`
- `security_settings`
- `tenant_settings`
- `fee_regimes` (création/modification)

**Solution** : Lecture uniquement offline, modification en ligne.

---

### 5. Génération Documents Officiels

**Règle** : Génération reçus/bulletins **interdite offline**.

**Raison** : Validation serveur, signature électronique, archivage.

**Tables concernées** :
- `payment_receipts` (génération)
- `report_cards` (génération)
- `student_id_cards` (génération)

**Solution** : Prévisualisation offline, génération effective en ligne.

---

## 🔧 Métadonnées de Synchronisation

### Colonnes Techniques (SQLite)

Chaque table métier contient :

```sql
-- Statut de synchronisation
sync_status TEXT DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced', 'conflict', 'error'))
  -- pending : Non synchronisé (modifié localement)
  -- synced : Synchronisé avec PostgreSQL
  -- conflict : Conflit détecté (serveur = source de vérité)
  -- error : Erreur de synchronisation

-- Date modification locale
local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL
  -- Date/heure de dernière modification locale (avant sync)
  -- Mise à jour automatique lors INSERT/UPDATE

-- Identifiant dispositif
device_id TEXT
  -- Identifiant unique du dispositif qui a fait la modification
  -- NULL si modifié depuis PostgreSQL (via download)
  -- UUID généré côté client
```

### Table Outbox (SQLite)

```sql
CREATE TABLE outbox_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('CREATE', 'UPDATE', 'DELETE')),
  entity_type TEXT NOT NULL,  -- 'student', 'grade', 'payment', etc.
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL,      -- JSON de l'entité
  metadata TEXT,               -- JSON métadonnées (device_id, etc.)
  status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'SYNCING', 'SYNCED', 'FAILED', 'CONFLICT')),
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  synced_at TIMESTAMP
);
```

---

## 📊 Règles Fondamentales de Sync

### Règle 1 : Ordre Chronologique

**Les événements sont synchronisés dans l'ordre chronologique.**

```sql
-- Tri des événements outbox par date de création
SELECT * FROM outbox_events 
WHERE status = 'PENDING' 
ORDER BY created_at ASC;
```

**Raison** : Garantit cohérence (création avant modification, etc.).

---

### Règle 2 : Validation Avant Sync

**Toutes les données sont validées avant envoi à PostgreSQL.**

**Validations** :
- ✅ Format des données (types, contraintes)
- ✅ Règles métier (profil tarifaire, etc.)
- ✅ Cohérence relationnelle (FK valides)

**En cas d'erreur** : Événement marqué `FAILED`, utilisateur notifié.

---

### Règle 3 : Résolution Conflits (Serveur = Autorité)

**En cas de conflit, PostgreSQL gagne toujours.**

**Scénario** :
1. Élève modifié offline
2. Même élève modifié en ligne (autre dispositif)
3. Sync détecte conflit (`version` différente)

**Résolution** :
- ✅ Version PostgreSQL est appliquée dans SQLite
- ✅ Version locale est archivée dans `sync_conflicts`
- ✅ Utilisateur notifié du conflit

---

### Règle 4 : Idempotence

**Les opérations de sync sont idempotentes.**

**Garantie** : Relancer la sync plusieurs fois produit le même résultat.

**Implémentation** :
- ✅ Utilisation d'IDs uniques (`id` UUID)
- ✅ Vérification existence avant création
- ✅ Comparaison version avant modification

---

### Règle 5 : Atomicité

**La sync est atomique par événement.**

**Garantie** : Un événement est soit entièrement synchronisé, soit pas du tout.

**Implémentation** :
- ✅ Transaction SQLite pour chaque événement
- ✅ Rollback en cas d'erreur
- ✅ Statut mis à jour après succès uniquement

---

### Règle 6 : Retry avec Backoff

**Les erreurs réseau sont réessayées avec backoff exponentiel.**

**Stratégie** :
- ✅ `retry_count` incrémenté à chaque échec
- ✅ Délai avant retry : `2^retry_count * 5 secondes` (max 5 minutes)
- ✅ Max tentatives : 5 (configurable)

**Après max tentatives** : Événement marqué `FAILED`, utilisateur notifié.

---

### Règle 7 : Download Incrémental

**Seules les modifications récentes sont téléchargées.**

**Implémentation** :
- ✅ Paramètre `last_sync_timestamp` envoyé à l'API
- ✅ API retourne uniquement entités modifiées après `last_sync_timestamp`
- ✅ Réduction bande passante et temps de sync

---

### Règle 8 : Validation Schéma Avant Sync

**Le schéma SQLite doit être compatible avec PostgreSQL.**

**Vérification** :
- ✅ Hash du schéma SQLite = Hash du schéma PostgreSQL
- ✅ Version du schéma SQLite = Version du schéma PostgreSQL
- ✅ Tables essentielles présentes

**En cas d'incompatibilité** : Sync bloquée, utilisateur notifié (mise à jour app requise).

---

## 🔄 Flux de Synchronisation

### Phase 1 : Préparation

```typescript
// 1. Vérifier connexion réseau
if (!networkDetector.isOnline()) {
  throw new Error('Pas de connexion réseau');
}

// 2. Valider schéma SQLite
const schemaValid = await schemaValidator.validate();
if (!schemaValid) {
  throw new Error('Schéma SQLite incompatible');
}

// 3. Récupérer événements pending
const pendingEvents = await outboxService.getPendingEvents();
```

---

### Phase 2 : Upload (SQLite → PostgreSQL)

```typescript
for (const event of pendingEvents) {
  try {
    // Marquer comme syncing
    await outboxService.markAsSyncing(event.id);
    
    // Envoyer à l'API
    const response = await apiClient.post('/sync/upload', {
      eventType: event.event_type,
      entityType: event.entity_type,
      entityId: event.entity_id,
      payload: JSON.parse(event.payload),
    });
    
    if (response.status === 'SUCCESS') {
      // Succès : marquer comme synced
      await outboxService.markAsSynced(event.id);
      await localDbService.updateSyncStatus(event.entity_id, 'synced');
    } else if (response.status === 'CONFLICT') {
      // Conflit : serveur gagne
      await outboxService.markAsConflict(event.id, response.serverVersion);
      await localDbService.updateFromServer(event.entity_id, response.serverData);
    }
  } catch (error) {
    // Erreur : marquer comme failed
    await outboxService.markAsFailed(event.id, error.message);
  }
}
```

---

### Phase 3 : Download (PostgreSQL → SQLite)

```typescript
// Récupérer timestamp dernière sync
const lastSyncTimestamp = await syncStateService.getLastSyncTimestamp();

// Demander mises à jour depuis PostgreSQL
const updates = await apiClient.get('/sync/pull', {
  last_sync_timestamp: lastSyncTimestamp,
});

// Appliquer mises à jour dans SQLite
for (const update of updates) {
  await localDbService.updateOrInsert(update.entity_type, update.data, {
    sync_status: 'synced',
    local_updated_at: update.updated_at,
    device_id: null, // Modifié depuis serveur
  });
}

// Mettre à jour timestamp
await syncStateService.updateLastSyncTimestamp(new Date());
```

---

## 📊 Tableau Récapitulatif

### Stratégie par Type d'Opération

| Opération | Offline | Sync | Conflit | Notes |
|-----------|---------|------|---------|-------|
| **Lecture** | ✅ | N/A | N/A | Données en cache SQLite |
| **Création** | ✅ | Upload | Serveur gagne | ID temporaire → ID final |
| **Modification** | ✅ | Upload | Serveur gagne | Version locale archivée |
| **Suppression** | ✅ (soft) | Upload | Serveur gagne | Soft delete uniquement |
| **Authentification** | ❌ | N/A | N/A | Nécessite connexion |
| **Création tenant** | ❌ | N/A | N/A | Configuration serveur |

---

## 🎯 Règles Fondamentales Résumées

1. **PostgreSQL = Autorité Finale** (conflits résolus en faveur de PostgreSQL)
2. **SQLite = Travail Hors Ligne** (CRUD complet avec métadonnées)
3. **Sync Explicite** (utilisateur déclenche, pas silencieux)
4. **Aucune Perte de Données** (outbox pattern, versioning, archivage)
5. **Ordre Chronologique** (événements triés par date)
6. **Validation Avant Sync** (données validées avant envoi)
7. **Idempotence** (relance sync sans effet de bord)
8. **Atomicité** (transaction par événement)
9. **Retry avec Backoff** (erreurs réseau réessayées)
10. **Download Incrémental** (seulement modifications récentes)

---

## ✅ Diagramme Logique de Sync

```
┌─────────────┐
│   OFFLINE   │
│  (SQLite)   │
└──────┬──────┘
       │
       │ Événements créés
       ▼
┌─────────────┐
│   OUTBOX    │
│   EVENTS    │
│  (pending)  │
└──────┬──────┘
       │
       │ Reconnexion
       ▼
┌─────────────┐     ┌─────────────┐
│   VALIDATE   │─────▶│   SCHEMA    │
│   SCHEMA     │     │  COMPATIBLE?│
└──────┬──────┘     └─────────────┘
       │
       │ OK
       ▼
┌─────────────┐
│    UPLOAD   │──────────────┐
│  (SQLite →  │              │
│  PostgreSQL)│              │
└──────┬──────┘              │
       │                     │
       │ Succès              │ Conflit
       ▼                     ▼
┌─────────────┐     ┌─────────────┐
│   SYNCED    │     │  CONFLICT   │
│  (serveur   │     │ (serveur =  │
│   gagne)    │     │ autorité)   │
└─────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐
│  DOWNLOAD   │
│ (PostgreSQL │
│   → SQLite) │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   ONLINE    │
│  (synced)   │
└─────────────┘
```

---

**La stratégie de synchronisation offline → online est maintenant documentée !** ✅

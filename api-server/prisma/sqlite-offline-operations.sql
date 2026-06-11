-- ============================================================================
-- TABLE OFFLINE_OPERATIONS - JOURNALISATION ACTIONS OFFLINE
-- ============================================================================
-- 
-- Cette table trace TOUTES les actions faites offline pour synchronisation
-- ultérieure avec PostgreSQL.
-- 
-- RÈGLE : Aucune écriture directe dans les tables métier sans journalisation.
-- 
-- ============================================================================

-- ============================================================================
-- TABLE OFFLINE_OPERATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS offline_operations (
  -- Identifiant unique
  id TEXT PRIMARY KEY,
  
  -- Table concernée
  table_name TEXT NOT NULL,
  
  -- ID de l'enregistrement (peut être local_id si généré offline)
  record_id TEXT NOT NULL,
  
  -- Type d'opération
  operation_type TEXT NOT NULL CHECK(operation_type IN ('INSERT', 'UPDATE', 'DELETE')),
  
  -- Payload JSON immuable (état complet de l'entité au moment de l'opération)
  payload TEXT NOT NULL,  -- JSON string (immuable après création)
  
  -- Métadonnées de l'opération
  created_at TEXT DEFAULT (datetime('now')) NOT NULL,
  
  -- Statut de synchronisation
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCING', 'SYNCED', 'FAILED', 'CONFLICT')),
  
  -- Retry logic
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  synced_at TEXT  -- Date de synchronisation réussie (NULL si pas encore sync)
);

-- ============================================================================
-- INDEX POUR PERFORMANCE
-- ============================================================================

-- Index pour recherche par table + record
CREATE INDEX IF NOT EXISTS idx_offline_operations_table_record 
ON offline_operations(table_name, record_id);

-- Index pour récupération des événements en attente (tri chronologique)
CREATE INDEX IF NOT EXISTS idx_offline_operations_sync_status_created 
ON offline_operations(sync_status, created_at);

-- Index pour requêtes par date
CREATE INDEX IF NOT EXISTS idx_offline_operations_created_at 
ON offline_operations(created_at);

-- Index pour recherche par table + statut
CREATE INDEX IF NOT EXISTS idx_offline_operations_table_status 
ON offline_operations(table_name, sync_status);

-- ============================================================================
-- RÈGLES DE JOURNALISATION
-- ============================================================================
-- 
-- 1. TOUTE création/modification/suppression dans une table métier
--    doit créer une entrée dans offline_operations
-- 
-- 2. Le payload JSON doit contenir l'état COMPLET de l'entité
--    (pas seulement les champs modifiés)
-- 
-- 3. Le payload est IMMUABLE (ne jamais modifier après création)
-- 
-- 4. L'ID de l'opération est un UUID généré côté client
-- 
-- 5. Le record_id peut être :
--    - L'ID final (si déjà sync)
--    - Le local_id (si généré offline, pas encore sync)
-- 
-- ============================================================================

-- ============================================================================
-- EXEMPLE DE DONNÉES
-- ============================================================================
-- 
-- INSERT dans offline_operations lors création élève :
-- 
-- INSERT INTO offline_operations (
--   id,
--   table_name,
--   record_id,
--   operation_type,
--   payload,
--   created_at,
--   sync_status
-- )
-- VALUES (
--   'uuid-op-1',
--   'students',
--   'local-id-temp-1',  -- ou 'uuid-student-final' si déjà sync
--   'INSERT',
--   '{
--     "id": "uuid-student",
--     "tenantId": "tenant-uuid",
--     "academicYearId": "academic-year-uuid",
--     "firstName": "Jean",
--     "lastName": "Dupont",
--     ...
--   }',
--   datetime('now'),
--   'PENDING'
-- );
-- 
-- UPDATE dans offline_operations lors modification :
-- 
-- INSERT INTO offline_operations (
--   id,
--   table_name,
--   record_id,
--   operation_type,
--   payload
-- )
-- VALUES (
--   'uuid-op-2',
--   'students',
--   'uuid-student-existant',
--   'UPDATE',
--   '{
--     "id": "uuid-student",
--     "firstName": "Jean-Michel",  -- Modifié
--     "lastName": "Dupont",
--     ...  -- Tous les autres champs aussi (état complet)
--   }'
-- );
-- 
-- DELETE dans offline_operations (soft delete) :
-- 
-- INSERT INTO offline_operations (
--   id,
--   table_name,
--   record_id,
--   operation_type,
--   payload
-- )
-- VALUES (
--   'uuid-op-3',
--   'students',
--   'uuid-student',
--   'DELETE',
--   '{
--     "id": "uuid-student",
--     "status": "DELETED",  -- Soft delete
--     ...
--   }'
-- );
-- 
-- ============================================================================

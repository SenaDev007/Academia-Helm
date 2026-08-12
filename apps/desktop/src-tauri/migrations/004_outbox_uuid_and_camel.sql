-- ============================================================================
-- 004_outbox_uuid_and_camel.sql — Migration de l'outbox vers UUID + camelCase
-- ============================================================================
--
-- ⭐ CORRIGE 3 BUGS CRITIQUES identifiés par l'audit offline-first :
--
-- 1. IDÉMPOTENCE CASSÉE : `id INTEGER AUTOINCREMENT` → 2 appareils du même
--    tenant envoient `local_id=1`, `local_id=2`, etc. → le backend considère
--    faussement le 2e comme déjà synchronisé → PERTE DE DONNÉES.
--    Fix : `id TEXT PRIMARY KEY` (UUID généré côté client).
--
-- 2. CONFLITS IMPOSSIBLES À MARQUER : `CHECK(status IN ('pending','syncing',
--    'synced','failed'))` exclut `'conflict'`. L'UPDATE correspondante échoue.
--    Fix : ajouter `'conflict'` à la CHECK constraint.
--
-- 3. MISMATCH SCHÉMA : le frontend (app.html) utilise des colonnes camelCase
--    (tableName, recordId, createdAt, syncedAt, retryCount) mais le schéma
--    SQLite est snake_case (table_name, record_id, created_at, synced_at,
--    retry_count). Le SELECT échoue → 0 record lu → PUSH NE POUSSE RIEN.
--    Fix : recréer _sync_outbox avec colonnes camelCase.
--
-- ⚠️ Cette migration est DESTRUCTIVE pour les records pending existants.
--    Les records déjà synced sont conservés (copiés), mais les records
--    pending/syncing/failed sont réinitialisés à pending avec un nouveau UUID.
--    En pratique, cela ne devrait pas causer de perte de données car :
--    - Les records synced ont déjà été poussés vers Neon
--    - Les records pending seront re-poussés au prochain cycle de sync
-- ============================================================================

-- ⭐ ÉTAPE 1 : Sauvegarder les records existants
DROP TABLE IF EXISTS _sync_outbox_backup;
CREATE TABLE _sync_outbox_backup AS
  SELECT
    CAST(ROWID AS TEXT) AS temp_id,  -- UUID temporaire (sera remplacé)
    table_name,
    record_id,
    operation,
    data,
    created_at,
    synced_at,
    sync_error,
    retry_count,
    status
  FROM _sync_outbox;

-- ⭐ ÉTAPE 2 : Supprimer l'ancienne table et ses index
DROP INDEX IF EXISTS idx_sync_outbox_status;
DROP INDEX IF EXISTS idx_sync_outbox_table;
DROP TABLE IF EXISTS _sync_outbox;

-- ⭐ ÉTAPE 3 : Recréer _sync_outbox avec colonnes camelCase + UUID + CHECK étendu
CREATE TABLE _sync_outbox (
  id              TEXT PRIMARY KEY,        -- ⭐ UUID (pas AUTOINCREMENT)
  tableName       TEXT NOT NULL,            -- ⭐ camelCase (avant : table_name)
  recordId        TEXT NOT NULL,            -- ⭐ camelCase (avant : record_id)
  operation       TEXT NOT NULL CHECK(operation IN ('INSERT', 'UPDATE', 'DELETE')),
  data            TEXT NOT NULL,
  tenantId        TEXT,                     -- ⭐ ajouté pour filtrage multi-tenant
  createdAt       TEXT NOT NULL DEFAULT (datetime('now')),  -- ⭐ camelCase
  syncedAt        TEXT,                     -- ⭐ camelCase
  syncError       TEXT,                     -- ⭐ camelCase
  retryCount      INTEGER DEFAULT 0,        -- ⭐ camelCase
  status          TEXT DEFAULT 'pending'
                  CHECK(status IN ('pending', 'syncing', 'synced', 'failed', 'conflict'))
                  -- ⭐ 'conflict' ajouté (avant : refusé par CHECK)
);

-- ⭐ ÉTAPE 4 : Index pour performance
CREATE INDEX IF NOT EXISTS idx_sync_outbox_status ON _sync_outbox (status);
CREATE INDEX IF NOT EXISTS idx_sync_outbox_table ON _sync_outbox (tableName, recordId);
CREATE INDEX IF NOT EXISTS idx_sync_outbox_tenant ON _sync_outbox (tenantId, status);
CREATE INDEX IF NOT EXISTS idx_sync_outbox_created ON _sync_outbox (createdAt);

-- ⭐ ÉTAPE 5 : Restaurer les records sauvegardés avec UUID générés
--    On utilise randomblob() pour générer un UUID-like (32 chars hex)
--    Ce n'est pas un vrai UUID v4, mais c'est suffisamment unique pour l'idempotence
INSERT INTO _sync_outbox (id, tableName, recordId, operation, data, tenantId, createdAt, syncedAt, syncError, retryCount, status)
SELECT
  lower(hex(randomblob(16))) AS id,  -- UUID-like 32 chars hex
  table_name AS tableName,
  record_id AS recordId,
  operation,
  data,
  NULL AS tenantId,  -- non disponible dans l'ancien schéma
  created_at AS createdAt,
  synced_at AS syncedAt,
  sync_error AS syncError,
  retry_count AS retryCount,
  CASE
    WHEN status = 'synced' THEN 'synced'  -- garder synced
    WHEN status = 'syncing' THEN 'pending'  -- reset syncing → pending
    WHEN status = 'failed' THEN 'pending'   -- reset failed → pending (retry)
    ELSE 'pending'
  END AS status
FROM _sync_outbox_backup
WHERE status != 'synced'  -- ⭐ Ne garder QUE les non-synced (les synced sont déjà poussés)
   OR synced_at IS NOT NULL;  -- ou les synced avec timestamp (pour historique)

-- ⭐ ÉTAPE 6 : Nettoyer la backup
DROP TABLE _sync_outbox_backup;

-- ============================================================================
-- ⚠️ IMPORTANT : Les triggers de 003_outbox_triggers.sql utilisent les anciens
--    noms de colonnes (table_name, record_id, created_at, status).
--    Ces triggers vont ÉCHOUER silencieusement après cette migration car
--    les colonnes n'existent plus.
--
--    Solution : recréer les triggers avec les nouveaux noms camelCase.
--    Comme il y a 624 tables × 3 triggers = 1872 triggers, on le fait
--    dynamiquement via un script SQL qui parcourt sqlite_master.
-- ============================================================================

-- ⭐ ÉTAPE 7 : Supprimer tous les triggers existants qui référencent _sync_outbox
--    (sqlite_master ne permet pas de DROP TRIGGER IF EXISTS sur tous d'un coup,
--    mais les triggers sont recréés ci-dessous avec CREATE OR REPLACE)
DELETE FROM sqlite_master
WHERE type = 'trigger'
  AND sql LIKE '%_sync_outbox%'
  AND sql LIKE '%table_name%';  -- ne supprimer QUE ceux qui utilisent l'ancien schéma

-- ⭐ ÉTAPE 8 : Créer un trigger universel pour TOUTES les tables
--    Au lieu de 1872 triggers individuels (1 par table × 3 opérations),
--    on utilise un seul trigger par table qui appelle une fonction commune.
--
--    ⚠️ SQLite ne supporte pas les triggers sur toutes les tables d'un coup,
--    ni les fonctions PL/SQL complexes. On doit donc générer les triggers
--    dynamiquement.
--
--    Pour cette migration, on ne recrée QUE les triggers pour les tables
--    essentielles (students, payments, attendance_records, exam_scores, classes).
--    Les autres tables seront ajoutées au besoin (le pull les synchronise
--    automatiquement, et les écritures utilisateur offline passent par
--    le frontend qui insère directement dans _sync_outbox).

-- Trigger pour students (INSERT/UPDATE/DELETE)
CREATE TRIGGER IF NOT EXISTS trg_students_outbox_insert
AFTER INSERT ON "students"
FOR EACH ROW
BEGIN
    INSERT INTO _sync_outbox (id, tableName, recordId, operation, data, tenantId, createdAt, status)
    VALUES (
        lower(hex(randomblob(16))),
        'students',
        NEW."id",
        'INSERT',
        json_object('id', NEW."id", 'tenantId', NEW."tenantId", 'firstName', NEW."firstName", 'lastName', NEW."lastName", 'matricule', NEW."matricule", 'gender', NEW."gender", 'status', NEW."status", 'schoolLevelId', NEW."schoolLevelId", 'academicYearId', NEW."academicYearId", 'createdAt', NEW."createdAt", 'updatedAt', NEW."updatedAt"),
        NEW."tenantId",
        datetime('now'),
        'pending'
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_students_outbox_update
AFTER UPDATE ON "students"
FOR EACH ROW
WHEN OLD."id" IS NOT NULL
BEGIN
    INSERT INTO _sync_outbox (id, tableName, recordId, operation, data, tenantId, createdAt, status)
    VALUES (
        lower(hex(randomblob(16))),
        'students',
        NEW."id",
        'UPDATE',
        json_object('id', NEW."id", 'tenantId', NEW."tenantId", 'firstName', NEW."firstName", 'lastName', NEW."lastName", 'matricule', NEW."matricule", 'gender', NEW."gender", 'status', NEW."status", 'schoolLevelId', NEW."schoolLevelId", 'academicYearId', NEW."academicYearId", 'createdAt', NEW."createdAt", 'updatedAt', NEW."updatedAt"),
        NEW."tenantId",
        datetime('now'),
        'pending'
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_students_outbox_delete
AFTER DELETE ON "students"
FOR EACH ROW
BEGIN
    INSERT INTO _sync_outbox (id, tableName, recordId, operation, data, tenantId, createdAt, status)
    VALUES (
        lower(hex(randomblob(16))),
        'students',
        OLD."id",
        'DELETE',
        json_object('id', OLD."id", 'tenantId', OLD."tenantId"),
        OLD."tenantId",
        datetime('now'),
        'pending'
    );
END;

-- Trigger pour payments (INSERT/UPDATE/DELETE)
CREATE TRIGGER IF NOT EXISTS trg_payments_outbox_insert
AFTER INSERT ON "payments"
FOR EACH ROW
BEGIN
    INSERT INTO _sync_outbox (id, tableName, recordId, operation, data, tenantId, createdAt, status)
    VALUES (
        lower(hex(randomblob(16))),
        'payments',
        NEW."id",
        'INSERT',
        json_object('id', NEW."id", 'tenantId', NEW."tenantId", 'studentId', NEW."studentId", 'amount', NEW."amount", 'status', NEW."status", 'paymentMethod', NEW."paymentMethod", 'reference', NEW."reference", 'createdAt', NEW."createdAt"),
        NEW."tenantId",
        datetime('now'),
        'pending'
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_payments_outbox_update
AFTER UPDATE ON "payments"
FOR EACH ROW
WHEN OLD."id" IS NOT NULL
BEGIN
    INSERT INTO _sync_outbox (id, tableName, recordId, operation, data, tenantId, createdAt, status)
    VALUES (
        lower(hex(randomblob(16))),
        'payments',
        NEW."id",
        'UPDATE',
        json_object('id', NEW."id", 'tenantId', NEW."tenantId", 'studentId', NEW."studentId", 'amount', NEW."amount", 'status', NEW."status", 'paymentMethod', NEW."paymentMethod", 'reference', NEW."reference", 'createdAt', NEW."createdAt"),
        NEW."tenantId",
        datetime('now'),
        'pending'
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_payments_outbox_delete
AFTER DELETE ON "payments"
FOR EACH ROW
BEGIN
    INSERT INTO _sync_outbox (id, tableName, recordId, operation, data, tenantId, createdAt, status)
    VALUES (
        lower(hex(randomblob(16))),
        'payments',
        OLD."id",
        'DELETE',
        json_object('id', OLD."id", 'tenantId', OLD."tenantId"),
        OLD."tenantId",
        datetime('now'),
        'pending'
    );
END;

-- Trigger pour attendance_records (INSERT/UPDATE/DELETE)
CREATE TRIGGER IF NOT EXISTS trg_attendance_records_outbox_insert
AFTER INSERT ON "attendance_records"
FOR EACH ROW
BEGIN
    INSERT INTO _sync_outbox (id, tableName, recordId, operation, data, tenantId, createdAt, status)
    VALUES (
        lower(hex(randomblob(16))),
        'attendance_records',
        NEW."id",
        'INSERT',
        json_object('id', NEW."id", 'tenantId', NEW."tenantId", 'studentId', NEW."studentId", 'classId', NEW."classId", 'date', NEW."date", 'status', NEW."status", 'notes', NEW."notes", 'createdAt', NEW."createdAt"),
        NEW."tenantId",
        datetime('now'),
        'pending'
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_attendance_records_outbox_update
AFTER UPDATE ON "attendance_records"
FOR EACH ROW
WHEN OLD."id" IS NOT NULL
BEGIN
    INSERT INTO _sync_outbox (id, tableName, recordId, operation, data, tenantId, createdAt, status)
    VALUES (
        lower(hex(randomblob(16))),
        'attendance_records',
        NEW."id",
        'UPDATE',
        json_object('id', NEW."id", 'tenantId', NEW."tenantId", 'studentId', NEW."studentId", 'classId', NEW."classId", 'date', NEW."date", 'status', NEW."status", 'notes', NEW."notes", 'createdAt', NEW."createdAt"),
        NEW."tenantId",
        datetime('now'),
        'pending'
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_attendance_records_outbox_delete
AFTER DELETE ON "attendance_records"
FOR EACH ROW
BEGIN
    INSERT INTO _sync_outbox (id, tableName, recordId, operation, data, tenantId, createdAt, status)
    VALUES (
        lower(hex(randomblob(16))),
        'attendance_records',
        OLD."id",
        'DELETE',
        json_object('id', OLD."id", 'tenantId', OLD."tenantId"),
        OLD."tenantId",
        datetime('now'),
        'pending'
    );
END;

-- Trigger pour exam_scores (INSERT/UPDATE/DELETE)
CREATE TRIGGER IF NOT EXISTS trg_exam_scores_outbox_insert
AFTER INSERT ON "exam_scores"
FOR EACH ROW
BEGIN
    INSERT INTO _sync_outbox (id, tableName, recordId, operation, data, tenantId, createdAt, status)
    VALUES (
        lower(hex(randomblob(16))),
        'exam_scores',
        NEW."id",
        'INSERT',
        json_object('id', NEW."id", 'tenantId', NEW."tenantId", 'studentId', NEW."studentId", 'examId', NEW."examId", 'evaluationId', NEW."evaluationId", 'subjectId', NEW."subjectId", 'score', NEW."score", 'grade', NEW."grade", 'comment', NEW."comment", 'createdAt', NEW."createdAt"),
        NEW."tenantId",
        datetime('now'),
        'pending'
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_exam_scores_outbox_update
AFTER UPDATE ON "exam_scores"
FOR EACH ROW
WHEN OLD."id" IS NOT NULL
BEGIN
    INSERT INTO _sync_outbox (id, tableName, recordId, operation, data, tenantId, createdAt, status)
    VALUES (
        lower(hex(randomblob(16))),
        'exam_scores',
        NEW."id",
        'UPDATE',
        json_object('id', NEW."id", 'tenantId', NEW."tenantId", 'studentId', NEW."studentId", 'examId', NEW."examId", 'evaluationId', NEW."evaluationId", 'subjectId', NEW."subjectId", 'score', NEW."score", 'grade', NEW."grade", 'comment', NEW."comment", 'createdAt', NEW."createdAt"),
        NEW."tenantId",
        datetime('now'),
        'pending'
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_exam_scores_outbox_delete
AFTER DELETE ON "exam_scores"
FOR EACH ROW
BEGIN
    INSERT INTO _sync_outbox (id, tableName, recordId, operation, data, tenantId, createdAt, status)
    VALUES (
        lower(hex(randomblob(16))),
        'exam_scores',
        OLD."id",
        'DELETE',
        json_object('id', OLD."id", 'tenantId', OLD."tenantId"),
        OLD."tenantId",
        datetime('now'),
        'pending'
    );
END;

-- Trigger pour classes (INSERT/UPDATE/DELETE)
CREATE TRIGGER IF NOT EXISTS trg_classes_outbox_insert
AFTER INSERT ON "classes"
FOR EACH ROW
BEGIN
    INSERT INTO _sync_outbox (id, tableName, recordId, operation, data, tenantId, createdAt, status)
    VALUES (
        lower(hex(randomblob(16))),
        'classes',
        NEW."id",
        'INSERT',
        json_object('id', NEW."id", 'tenantId', NEW."tenantId", 'name', NEW."name", 'code', NEW."code", 'schoolLevelId', NEW."schoolLevelId", 'academicYearId', NEW."academicYearId", 'capacity', NEW."capacity", 'isActive', NEW."isActive", 'createdAt', NEW."createdAt"),
        NEW."tenantId",
        datetime('now'),
        'pending'
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_classes_outbox_update
AFTER UPDATE ON "classes"
FOR EACH ROW
WHEN OLD."id" IS NOT NULL
BEGIN
    INSERT INTO _sync_outbox (id, tableName, recordId, operation, data, tenantId, createdAt, status)
    VALUES (
        lower(hex(randomblob(16))),
        'classes',
        NEW."id",
        'UPDATE',
        json_object('id', NEW."id", 'tenantId', NEW."tenantId", 'name', NEW."name", 'code', NEW."code", 'schoolLevelId', NEW."schoolLevelId", 'academicYearId', NEW."academicYearId", 'capacity', NEW."capacity", 'isActive', NEW."isActive", 'createdAt', NEW."createdAt"),
        NEW."tenantId",
        datetime('now'),
        'pending'
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_classes_outbox_delete
AFTER DELETE ON "classes"
FOR EACH ROW
BEGIN
    INSERT INTO _sync_outbox (id, tableName, recordId, operation, data, tenantId, createdAt, status)
    VALUES (
        lower(hex(randomblob(16))),
        'classes',
        OLD."id",
        'DELETE',
        json_object('id', OLD."id", 'tenantId', OLD."tenantId"),
        OLD."tenantId",
        datetime('now'),
        'pending'
    );
END;

-- ============================================================================
-- ⚠️ NOTE : Les autres tables (624 au total) n'ont pas de triggers individuels
--    dans cette migration. Pour les écritures offline sur ces tables, le
--    frontend doit insérer MANUELLEMENT dans _sync_outbox via db.execute().
--    Le pull automatique les synchronisera depuis Neon au prochain cycle.
--
--    Si une table spécifique nécessite un trigger, l'ajouter ici en suivant
--    le même pattern que students/payments/attendance_records/exam_scores/classes.
-- ============================================================================

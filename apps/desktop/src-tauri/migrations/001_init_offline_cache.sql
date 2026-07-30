-- ============================================================================
-- 001_init_offline_cache.sql — Sync metadata tables
-- ============================================================================
-- This migration creates the sync infrastructure tables.
-- The full application schema is in 002_full_schema_sqlite.sql.
-- ============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Tracks the last sync timestamp for each table
CREATE TABLE IF NOT EXISTS _sync_metadata (
  table_name      TEXT PRIMARY KEY,
  last_sync_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_sync_status TEXT DEFAULT 'success',
  records_pulled  INTEGER DEFAULT 0,
  records_pushed  INTEGER DEFAULT 0,
  error_message   TEXT
);

-- Outbox: queue of local writes waiting to be synced to Neon
CREATE TABLE IF NOT EXISTS _sync_outbox (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name      TEXT NOT NULL,
  record_id       TEXT NOT NULL,
  operation       TEXT NOT NULL CHECK(operation IN ('INSERT', 'UPDATE', 'DELETE')),
  data            TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at       TEXT,
  sync_error      TEXT,
  retry_count     INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'syncing', 'synced', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_sync_outbox_status ON _sync_outbox (status);
CREATE INDEX IF NOT EXISTS idx_sync_outbox_table ON _sync_outbox (table_name, record_id);

-- Sync log: history of all sync operations
CREATE TABLE IF NOT EXISTS _sync_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_type       TEXT NOT NULL CHECK(sync_type IN ('initial', 'pull', 'push', 'manual', 'auto')),
  started_at      TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at    TEXT,
  tables_synced   INTEGER DEFAULT 0,
  records_pulled  INTEGER DEFAULT 0,
  records_pushed  INTEGER DEFAULT 0,
  conflicts       INTEGER DEFAULT 0,
  errors          INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'running' CHECK(status IN ('running', 'success', 'partial', 'failed'))
);

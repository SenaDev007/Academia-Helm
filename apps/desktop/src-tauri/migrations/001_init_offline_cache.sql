-- ============================================================================
-- SQLite Local Cache — Academia Helm Desktop
-- ============================================================================
-- Cette base de données locale (SQLite) est embarquée dans l'app desktop.
-- Elle permet à l'utilisateur de travailler hors connexion.
--
-- Stratégie de synchronisation :
--   1. Quand l'utilisateur est online → lectures/écritures via API NestJS
--      → Neon PostgreSQL (source de vérité)
--   2. Les données lues sont mises en cache dans SQLite local
--   3. Quand l'utilisateur est offline → lectures depuis SQLite local
--   4. Les écritures offline sont stockées dans `pending_sync_queue`
--   5. Quand la connexion est rétablie → push de la queue vers l'API NestJS
--      → Neon PostgreSQL → confirmation → suppression de la queue
--
-- ⚠️ Cette DB locale n'est JAMAIS la source de vérité — c'est un cache.
--    Neon PostgreSQL reste la source de vérité unique.
-- ============================================================================

-- ── Méta-données de synchronisation ──
CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Cache des élèves (lecture seule offline) ──
CREATE TABLE IF NOT EXISTS cached_students (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  matricule TEXT,
  gender TEXT,
  class_id TEXT,
  class_name TEXT,
  level_name TEXT,
  photo_url TEXT,
  data_json TEXT NOT NULL, -- données complètes en JSON
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cached_students_tenant ON cached_students(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cached_students_class ON cached_students(class_id);

-- ── Cache des classes ──
CREATE TABLE IF NOT EXISTS cached_classes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  level_id TEXT,
  level_name TEXT,
  data_json TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Cache des comptes scolaires (finances) ──
CREATE TABLE IF NOT EXISTS cached_student_accounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  total_due REAL,
  total_paid REAL,
  balance REAL,
  status TEXT,
  data_json TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Cache des transactions financières ──
CREATE TABLE IF NOT EXISTS cached_transactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  receipt_number TEXT,
  amount REAL,
  payment_method TEXT,
  created_at TEXT,
  reference TEXT,
  data_json TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Cache des bulletins ──
CREATE TABLE IF NOT EXISTS cached_report_cards (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  quarter_name TEXT,
  overall_average REAL,
  rank INTEGER,
  file_path TEXT,
  data_json TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Cache du cahier journal ──
CREATE TABLE IF NOT EXISTS cached_cahier_journal (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  week_start_date TEXT NOT NULL,
  entries_json TEXT,
  observations TEXT,
  status TEXT,
  data_json TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── File d'attente de synchronisation (écritures offline) ──
-- Quand l'utilisateur crée/modifie une donnée en mode offline,
-- l'action est stockée ici et sera poussée vers l'API quand la connexion
-- sera rétablie.
CREATE TABLE IF NOT EXISTS pending_sync_queue (
  id TEXT PRIMARY KEY, -- UUID généré côté client
  tenant_id TEXT NOT NULL,
  entity_type TEXT NOT NULL, -- 'student', 'transaction', 'attendance', etc.
  entity_id TEXT, -- ID de l'entité (si modification)
  operation TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE'
  endpoint TEXT NOT NULL, -- URL API cible (ex: '/api/students')
  method TEXT NOT NULL, -- 'POST', 'PATCH', 'DELETE'
  payload_json TEXT, -- données à envoyer
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' -- 'PENDING', 'SYNCING', 'FAILED'
);

CREATE INDEX IF NOT EXISTS idx_pending_sync_tenant ON pending_sync_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pending_sync_status ON pending_sync_queue(status);

-- ── État de la connexion (online/offline) ──
INSERT OR IGNORE INTO sync_meta (key, value) VALUES
  ('last_online_sync', ''),
  ('last_offline_action', ''),
  ('db_version', '1'),
  ('tenant_id', '');

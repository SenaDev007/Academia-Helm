-- ============================================================================
-- SQLite Local Cache — Academia Helm Desktop
-- ============================================================================
-- Base de données locale embarquée dans l'app desktop Tauri.
-- Permet à l'utilisateur de travailler hors connexion.
--
-- ⚠️ Cette DB locale n'est JAMAIS la source de vérité — c'est un cache.
--    Neon PostgreSQL reste la source de vérité unique.
--    Le sync-worker alimente ce cache depuis Neon toutes les 60s.
-- ============================================================================

-- ── Méta-données de synchronisation ──
CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── MODULE ÉLÈVE ──

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
  data_json TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cached_students_tenant ON cached_students(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cached_students_class ON cached_students(class_id);

CREATE TABLE IF NOT EXISTS cached_student_enrollments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  class_id TEXT,
  academic_year_id TEXT,
  status TEXT,
  data_json TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cached_enrollments_student ON cached_student_enrollments(student_id);

CREATE TABLE IF NOT EXISTS cached_guardians (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  data_json TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cached_student_guardians (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  guardian_id TEXT NOT NULL,
  is_primary INTEGER,
  data_json TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cached_sg_student ON cached_student_guardians(student_id);

CREATE TABLE IF NOT EXISTS cached_admissions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  status TEXT,
  data_json TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── MODULE PÉDAGOGIE ──

CREATE TABLE IF NOT EXISTS cached_classes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  level_id TEXT,
  level_name TEXT,
  data_json TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cached_classes_tenant ON cached_classes(tenant_id);

CREATE TABLE IF NOT EXISTS cached_school_levels (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT,
  code TEXT,
  data_json TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cached_subjects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT,
  code TEXT,
  data_json TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cached_schedules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  class_id TEXT,
  subject_id TEXT,
  day_of_week TEXT,
  start_time TEXT,
  end_time TEXT,
  data_json TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cached_schedules_class ON cached_schedules(class_id);

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
CREATE INDEX IF NOT EXISTS idx_cached_cj_class ON cached_cahier_journal(class_id);

CREATE TABLE IF NOT EXISTS cached_pedagogical_fiches (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  class_id TEXT,
  subject_id TEXT,
  week_start_date TEXT,
  data_json TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cached_homework_entries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  class_id TEXT,
  subject_id TEXT,
  title TEXT,
  due_date TEXT,
  data_json TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cached_hw_class ON cached_homework_entries(class_id);

CREATE TABLE IF NOT EXISTS cached_pedagogical_task_students (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_id TEXT,
  homework_entry_id TEXT,
  status TEXT,
  score REAL,
  data_json TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cached_pts_student ON cached_pedagogical_task_students(student_id);

-- ── MODULE FINANCE ──

CREATE TABLE IF NOT EXISTS cached_student_accounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  total_due REAL,
  total_paid REAL,
  balance REAL,
  arrears_amount REAL,
  status TEXT,
  data_json TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cached_sa_student ON cached_student_accounts(student_id);

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
CREATE INDEX IF NOT EXISTS idx_cached_tx_tenant ON cached_transactions(tenant_id);

CREATE TABLE IF NOT EXISTS cached_fee_structures (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  fee_type TEXT,
  amount REAL,
  data_json TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cached_fee_arrears (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_id TEXT,
  academic_year_id TEXT,
  total_due REAL,
  total_paid REAL,
  balance_due REAL,
  status TEXT,
  data_json TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cached_fee_installments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_account_id TEXT,
  amount REAL,
  due_date TEXT,
  status TEXT,
  data_json TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cached_recovery_reminders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_id TEXT,
  sent_at TEXT,
  channel TEXT,
  data_json TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cached_finance_expenses (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  amount REAL,
  category TEXT,
  expense_date TEXT,
  data_json TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── MODULE ÉVALUATIONS ──

CREATE TABLE IF NOT EXISTS cached_evaluations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  class_id TEXT,
  subject_id TEXT,
  title TEXT,
  evaluation_date TEXT,
  status TEXT,
  data_json TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cached_eval_class ON cached_evaluations(class_id);

CREATE TABLE IF NOT EXISTS cached_grades (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  evaluation_id TEXT,
  student_id TEXT,
  score REAL,
  data_json TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cached_grades_eval ON cached_grades(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_cached_grades_student ON cached_grades(student_id);

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
CREATE INDEX IF NOT EXISTS idx_cached_rc_student ON cached_report_cards(student_id);

CREATE TABLE IF NOT EXISTS cached_report_card_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  report_card_id TEXT,
  subject_id TEXT,
  average REAL,
  coefficient REAL,
  rank INTEGER,
  data_json TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cached_rci_report ON cached_report_card_items(report_card_id);

CREATE TABLE IF NOT EXISTS cached_quarters (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT,
  number INTEGER,
  data_json TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── MODULE PRÉSENCES ──

CREATE TABLE IF NOT EXISTS cached_attendance_records (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_id TEXT,
  date TEXT,
  status TEXT,
  data_json TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cached_ar_student ON cached_attendance_records(student_id);

CREATE TABLE IF NOT EXISTS cached_attendance_registers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  class_id TEXT,
  week_start_date TEXT,
  status TEXT,
  data_json TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── File d'attente de synchronisation (écritures offline) ──
CREATE TABLE IF NOT EXISTS pending_sync_queue (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  operation TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
);
CREATE INDEX IF NOT EXISTS idx_pending_sync_tenant ON pending_sync_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pending_sync_status ON pending_sync_queue(status);

-- ── État initial ──
INSERT OR IGNORE INTO sync_meta (key, value) VALUES
  ('last_online_sync', ''),
  ('last_offline_action', ''),
  ('last_sync_token', ''),
  ('db_version', '2'),
  ('tenant_id', '');

-- ============================================================================
-- SCHÉMA SQLITE - ACADEMIA HUB (OFFLINE-FIRST)
-- ============================================================================
-- 
-- Ce schéma SQLite reflète STRICTEMENT le schéma PostgreSQL.
-- PostgreSQL est la source de vérité.
-- SQLite = miroir exact avec colonnes techniques supplémentaires.
-- 
-- RÈGLES :
-- - Noms de tables identiques à PostgreSQL
-- - Colonnes métier identiques (types convertis : String→TEXT, DateTime→TEXT)
-- - Colonnes techniques ajoutées : local_id, sync_status, local_updated_at, device_id
-- 
-- ============================================================================

-- ============================================================================
-- TABLE DE VERSIONNEMENT DU SCHÉMA
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_version (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT NOT NULL UNIQUE,
  schema_hash TEXT NOT NULL,
  description TEXT,
  applied_at TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE DE JOURNALISATION OFFLINE
-- ============================================================================

CREATE TABLE IF NOT EXISTS offline_operations (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation_type TEXT NOT NULL CHECK(operation_type IN ('INSERT', 'UPDATE', 'DELETE')),
  payload TEXT NOT NULL,  -- JSON immuable de l'état complet
  created_at TEXT DEFAULT (datetime('now')) NOT NULL,
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCING', 'SYNCED', 'FAILED', 'CONFLICT')),
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  synced_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_offline_operations_table_record ON offline_operations(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_offline_operations_sync_status ON offline_operations(sync_status, created_at);
CREATE INDEX IF NOT EXISTS idx_offline_operations_created_at ON offline_operations(created_at);

-- ============================================================================
-- TABLE 1: STUDENTS
-- ============================================================================
-- 
-- Correspondance PostgreSQL : table "students"
-- Colonnes techniques ajoutées : local_id, sync_status, local_updated_at, device_id
-- 
-- ============================================================================

CREATE TABLE IF NOT EXISTS students (
  -- Colonnes métier (identiques à PostgreSQL)
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  currentAcademicYearId TEXT,
  schoolLevelId TEXT NOT NULL,
  -- ADDENDUM §2.1 — Identifiant global Academia Helm (permanent, cross-school)
  -- Format : AH-STU-YYYY-NNNNNNNNN. Conservé lors de tout transfert inter-écoles.
  globalStudentId TEXT UNIQUE,          -- global_student_id (addendum)
  studentCode TEXT,
  matricule TEXT,                        -- Matricule local à l'école courante
  enrollmentYear INTEGER,
  firstName TEXT NOT NULL,
  lastName TEXT NOT NULL,
  dateOfBirth TEXT,  -- DateTime → TEXT (ISO 8601)
  gender TEXT,
  nationality TEXT,
  primaryLanguage TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  -- Colonnes techniques offline
  local_id TEXT UNIQUE,  -- ID temporaire si généré offline
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')),
  local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  device_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_students_tenantId ON students(tenantId);
CREATE INDEX IF NOT EXISTS idx_students_academicYearId ON students(academicYearId);
CREATE INDEX IF NOT EXISTS idx_students_schoolLevelId ON students(schoolLevelId);
CREATE INDEX IF NOT EXISTS idx_students_globalStudentId ON students(globalStudentId); -- Clé cross-school (addendum)
CREATE INDEX IF NOT EXISTS idx_students_tenantId_academicYearId_schoolLevelId ON students(tenantId, academicYearId, schoolLevelId);
CREATE INDEX IF NOT EXISTS idx_students_tenantId_status ON students(tenantId, status);
CREATE INDEX IF NOT EXISTS idx_students_tenantId_studentCode ON students(tenantId, studentCode);
CREATE INDEX IF NOT EXISTS idx_students_sync_status ON students(sync_status);
CREATE INDEX IF NOT EXISTS idx_students_local_updated_at ON students(local_updated_at);

-- ============================================================================
-- TABLE 2: PAYMENTS
-- ============================================================================
-- 
-- Correspondance PostgreSQL : table "payments"
-- Colonnes techniques ajoutées : local_id, sync_status, local_updated_at, device_id
-- 
-- ============================================================================

CREATE TABLE IF NOT EXISTS payments (
  -- Colonnes métier (identiques à PostgreSQL)
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT,
  studentId TEXT NOT NULL,
  schoolLevelId TEXT NOT NULL,
  feeConfigurationId TEXT,
  amount REAL NOT NULL,  -- Decimal → REAL
  paymentMethod TEXT,
  paymentDate TEXT NOT NULL,  -- Date → TEXT (ISO 8601)
  reference TEXT,
  receiptNumber TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  paymentFlowId TEXT,
  notes TEXT,
  createdBy TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  studentFeeId TEXT,
  
  -- Colonnes techniques offline
  local_id TEXT UNIQUE,
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')),
  local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  device_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_payments_tenantId_schoolLevelId ON payments(tenantId, schoolLevelId);
CREATE INDEX IF NOT EXISTS idx_payments_studentId ON payments(studentId);
CREATE INDEX IF NOT EXISTS idx_payments_studentFeeId ON payments(studentFeeId);
CREATE INDEX IF NOT EXISTS idx_payments_sync_status ON payments(sync_status);
CREATE INDEX IF NOT EXISTS idx_payments_local_updated_at ON payments(local_updated_at);

-- ============================================================================
-- TABLE 3: STUDENT_FEE_PROFILES
-- ============================================================================
-- 
-- Correspondance PostgreSQL : table "student_fee_profiles"
-- Colonnes techniques ajoutées : local_id, sync_status, local_updated_at, device_id
-- 
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_fee_profiles (
  -- Colonnes métier (identiques à PostgreSQL)
  id TEXT PRIMARY KEY,
  studentId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  feeRegimeId TEXT NOT NULL,
  justification TEXT,
  validatedBy TEXT,
  validatedAt TEXT,  -- DateTime → TEXT
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  -- Colonnes techniques offline
  local_id TEXT UNIQUE,
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')),
  local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  device_id TEXT,
  
  -- Contrainte unique (identique PostgreSQL)
  UNIQUE(studentId, academicYearId)
);

CREATE INDEX IF NOT EXISTS idx_student_fee_profiles_studentId ON student_fee_profiles(studentId);
CREATE INDEX IF NOT EXISTS idx_student_fee_profiles_academicYearId ON student_fee_profiles(academicYearId);
CREATE INDEX IF NOT EXISTS idx_student_fee_profiles_feeRegimeId ON student_fee_profiles(feeRegimeId);
CREATE INDEX IF NOT EXISTS idx_student_fee_profiles_sync_status ON student_fee_profiles(sync_status);
CREATE INDEX IF NOT EXISTS idx_student_fee_profiles_local_updated_at ON student_fee_profiles(local_updated_at);

-- ============================================================================
-- TABLE 4: COLLECTION_CASES
-- ============================================================================
-- 
-- Correspondance PostgreSQL : table "collection_cases"
-- Colonnes techniques ajoutées : local_id, sync_status, local_updated_at, device_id
-- 
-- ============================================================================

CREATE TABLE IF NOT EXISTS collection_cases (
  -- Colonnes métier (identiques à PostgreSQL)
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  studentId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  totalDue REAL NOT NULL,  -- Decimal → REAL
  totalPaid REAL NOT NULL DEFAULT 0,  -- Decimal → REAL
  outstandingAmount REAL NOT NULL,  -- Decimal → REAL
  status TEXT NOT NULL DEFAULT 'ON_TIME',
  escalationLevel INTEGER NOT NULL DEFAULT 0,
  lastActionAt TEXT,  -- DateTime → TEXT
  blockedUntil TEXT,  -- DateTime → TEXT
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  -- Colonnes techniques offline
  local_id TEXT UNIQUE,
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')),
  local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  device_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_collection_cases_tenantId ON collection_cases(tenantId);
CREATE INDEX IF NOT EXISTS idx_collection_cases_studentId ON collection_cases(studentId);
CREATE INDEX IF NOT EXISTS idx_collection_cases_academicYearId ON collection_cases(academicYearId);
CREATE INDEX IF NOT EXISTS idx_collection_cases_status ON collection_cases(status);
CREATE INDEX IF NOT EXISTS idx_collection_cases_sync_status ON collection_cases(sync_status);
CREATE INDEX IF NOT EXISTS idx_collection_cases_local_updated_at ON collection_cases(local_updated_at);

-- ============================================================================
-- TABLE 5: STUDENT_DOCUMENTS
-- ============================================================================
-- 
-- Correspondance PostgreSQL : table "student_documents"
-- Note: "pedagogic_documents" fait référence à cette table
-- Colonnes techniques ajoutées : local_id, sync_status, local_updated_at, device_id
-- 
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_documents (
  -- Colonnes métier (identiques à PostgreSQL)
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  schoolLevelId TEXT NOT NULL,
  studentId TEXT NOT NULL,
  documentType TEXT NOT NULL,
  fileName TEXT NOT NULL,
  filePath TEXT NOT NULL,
  fileSize INTEGER,
  mimeType TEXT,
  uploadedBy TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  -- Colonnes techniques offline
  local_id TEXT UNIQUE,
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')),
  local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  device_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_student_documents_tenantId_academicYearId ON student_documents(tenantId, academicYearId);
CREATE INDEX IF NOT EXISTS idx_student_documents_studentId ON student_documents(studentId);
CREATE INDEX IF NOT EXISTS idx_student_documents_documentType ON student_documents(documentType);
CREATE INDEX IF NOT EXISTS idx_student_documents_sync_status ON student_documents(sync_status);
CREATE INDEX IF NOT EXISTS idx_student_documents_local_updated_at ON student_documents(local_updated_at);

-- ============================================================================
-- TABLE 6: USER_DEVICES (OTP & Device Tracking)
-- ============================================================================
-- 
-- Correspondance PostgreSQL : table "user_devices"
-- Pas de colonnes techniques offline (table serveur uniquement)
-- 
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_devices (
  -- Colonnes métier (identiques à PostgreSQL)
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  tenantId TEXT NOT NULL,
  deviceHash TEXT NOT NULL UNIQUE,
  deviceName TEXT,
  deviceType TEXT NOT NULL CHECK(deviceType IN ('desktop', 'tablet', 'mobile')),
  userAgent TEXT,
  ipAddress TEXT,
  isTrusted INTEGER NOT NULL DEFAULT 0,  -- Boolean → INTEGER
  lastUsedAt TEXT,  -- DateTime → TEXT
  trustedAt TEXT,  -- DateTime → TEXT
  revokedAt TEXT,  -- DateTime → TEXT
  metadata TEXT,  -- Json → TEXT (JSON string)
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_devices_userId ON user_devices(userId);
CREATE INDEX IF NOT EXISTS idx_user_devices_tenantId ON user_devices(tenantId);
CREATE INDEX IF NOT EXISTS idx_user_devices_userId_tenantId ON user_devices(userId, tenantId);
CREATE INDEX IF NOT EXISTS idx_user_devices_isTrusted ON user_devices(isTrusted);
CREATE INDEX IF NOT EXISTS idx_user_devices_deviceHash ON user_devices(deviceHash);

-- ============================================================================
-- TABLE 7: OTP_CODES (OTP & Device Tracking)
-- ============================================================================
-- 
-- Correspondance PostgreSQL : table "otp_codes"
-- Pas de colonnes techniques offline (table serveur uniquement)
-- 
-- ============================================================================

CREATE TABLE IF NOT EXISTS otp_codes (
  -- Colonnes métier (identiques à PostgreSQL)
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  tenantId TEXT NOT NULL,
  deviceId TEXT,
  code TEXT NOT NULL,
  codeHash TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK(purpose IN ('LOGIN', 'DEVICE_VERIFICATION', 'SENSITIVE_ACTION')),
  phoneNumber TEXT NOT NULL,
  isUsed INTEGER NOT NULL DEFAULT 0,  -- Boolean → INTEGER
  isExpired INTEGER NOT NULL DEFAULT 0,  -- Boolean → INTEGER
  attempts INTEGER NOT NULL DEFAULT 0,
  maxAttempts INTEGER NOT NULL DEFAULT 3,
  expiresAt TEXT NOT NULL,  -- DateTime → TEXT
  usedAt TEXT,  -- DateTime → TEXT
  metadata TEXT,  -- Json → TEXT (JSON string)
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_otp_codes_userId ON otp_codes(userId);
CREATE INDEX IF NOT EXISTS idx_otp_codes_tenantId ON otp_codes(tenantId);
CREATE INDEX IF NOT EXISTS idx_otp_codes_deviceId ON otp_codes(deviceId);
CREATE INDEX IF NOT EXISTS idx_otp_codes_codeHash ON otp_codes(codeHash);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expiresAt ON otp_codes(expiresAt);
CREATE INDEX IF NOT EXISTS idx_otp_codes_isUsed ON otp_codes(isUsed);
CREATE INDEX IF NOT EXISTS idx_otp_codes_userId_tenantId ON otp_codes(userId, tenantId);

-- ============================================================================
-- TABLE 8: DEVICE_SESSIONS (OTP & Device Tracking)
-- ============================================================================
-- 
-- Correspondance PostgreSQL : table "device_sessions"
-- Pas de colonnes techniques offline (table serveur uniquement)
-- 
-- ============================================================================

CREATE TABLE IF NOT EXISTS device_sessions (
  -- Colonnes métier (identiques à PostgreSQL)
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  deviceId TEXT NOT NULL,
  sessionToken TEXT NOT NULL UNIQUE,
  refreshToken TEXT,
  ipAddress TEXT,
  userAgent TEXT,
  isActive INTEGER NOT NULL DEFAULT 1,  -- Boolean → INTEGER
  expiresAt TEXT NOT NULL,  -- DateTime → TEXT
  lastActivityAt TEXT NOT NULL DEFAULT (datetime('now')),  -- DateTime → TEXT
  metadata TEXT,  -- Json → TEXT (JSON string)
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_device_sessions_userId ON device_sessions(userId);
CREATE INDEX IF NOT EXISTS idx_device_sessions_tenantId ON device_sessions(tenantId);
CREATE INDEX IF NOT EXISTS idx_device_sessions_deviceId ON device_sessions(deviceId);
CREATE INDEX IF NOT EXISTS idx_device_sessions_academicYearId ON device_sessions(academicYearId);
CREATE INDEX IF NOT EXISTS idx_device_sessions_isActive ON device_sessions(isActive);
CREATE INDEX IF NOT EXISTS idx_device_sessions_expiresAt ON device_sessions(expiresAt);
CREATE INDEX IF NOT EXISTS idx_device_sessions_sessionToken ON device_sessions(sessionToken);
CREATE INDEX IF NOT EXISTS idx_device_sessions_userId_tenantId_academicYearId ON device_sessions(userId, tenantId, academicYearId);

-- ============================================================================
-- TABLE 9: AUTH_AUDIT_LOGS (OTP & Device Tracking)
-- ============================================================================
-- 
-- Correspondance PostgreSQL : table "auth_audit_logs"
-- Pas de colonnes techniques offline (table serveur uniquement)
-- 
-- ============================================================================

CREATE TABLE IF NOT EXISTS auth_audit_logs (
  -- Colonnes métier (identiques à PostgreSQL)
  id TEXT PRIMARY KEY,
  userId TEXT,
  tenantId TEXT,
  deviceId TEXT,
  sessionId TEXT,
  action TEXT NOT NULL,
  ipAddress TEXT,
  userAgent TEXT,
  status TEXT NOT NULL,
  reason TEXT,
  metadata TEXT,  -- Json → TEXT (JSON string)
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_userId ON auth_audit_logs(userId);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_tenantId ON auth_audit_logs(tenantId);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_deviceId ON auth_audit_logs(deviceId);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_sessionId ON auth_audit_logs(sessionId);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_action ON auth_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_status ON auth_audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_createdAt ON auth_audit_logs(createdAt);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_userId_tenantId ON auth_audit_logs(userId, tenantId);

-- ============================================================================
-- TABLE 10: STUDENT_ENROLLMENTS (ADDENDUM — Inscriptions scolaires locales)
-- ============================================================================
-- ADDENDUM §5.2 : Contient le local_student_matricule propre à chaque école.
-- Un même élève (globalStudentId) peut avoir plusieurs enrollments dans différentes écoles.
-- Préparation offline autorisée — synchronisation serveur obligatoire pour officialiser.
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_enrollments (
  -- Colonnes métier (identiques à PostgreSQL)
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  academicTermId TEXT,                  -- Trimestre/période (addendum §5.2)
  schoolLevelId TEXT NOT NULL,
  studentId TEXT NOT NULL,
  classId TEXT,
  -- ADDENDUM §2.2 — Matricule local attribué par CETTE école pour CET élève
  -- Distinct du globalStudentId. Standards propres à chaque école (ex: EPA/2026/045)
  localStudentMatricule TEXT,           -- local_student_matricule (addendum)
  enrollmentType TEXT NOT NULL DEFAULT 'NEW',
  enrollmentDate TEXT NOT NULL,         -- DateTime → TEXT
  entryDate TEXT,                       -- Date effective d'entrée (addendum)
  status TEXT NOT NULL DEFAULT 'PENDING', -- PRE_REGISTERED | ADMITTED | RE_ENROLLED | TRANSFERRED | WITHDRAWN
  transferStatus TEXT,                  -- PENDING_TRANSFER | IN_TRANSFER | TRANSFERRED (addendum §5.2)
  previousArrears REAL NOT NULL DEFAULT 0,
  exitDate TEXT,
  exitReason TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,

  -- Colonnes techniques offline
  local_id TEXT UNIQUE,
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')),
  local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  device_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_student_enrollments_tenantId ON student_enrollments(tenantId, academicYearId, schoolLevelId);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_studentId ON student_enrollments(studentId);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_localMatricule ON student_enrollments(localStudentMatricule); -- Recherche par matricule local (addendum)
CREATE INDEX IF NOT EXISTS idx_student_enrollments_sync_status ON student_enrollments(sync_status);

-- ============================================================================
-- TABLE 11: STUDENT_TRANSFER_REQUESTS (ADDENDUM — Transferts inter-écoles)
-- ============================================================================
-- ADDENDUM §9 — Règle Offline-First critique :
--   Phases préparables HORS LIGNE : DRAFT, sélection docs, prévisualisation certificat.
--   Phases exigeant CONNEXION : envoi officiel, notification, acceptation, création inscription.
-- ADDENDUM §6 — Statuts : DRAFT | REQUESTED | SENT_TO_DESTINATION | ACCEPTED_BY_DESTINATION |
--                          REJECTED_BY_DESTINATION | APPROVED_BY_SOURCE | COMPLETED | CANCELLED | ARCHIVED
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_transfer_requests (
  -- Colonnes métier (identiques à PostgreSQL)
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,               -- École source
  sourceSchoolId TEXT NOT NULL,
  targetSchoolId TEXT NOT NULL,
  studentId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,         -- Année scolaire source
  destinationAcademicYearId TEXT,       -- Année scolaire école destination (addendum §5.3)
  currentLevelId TEXT,
  currentClassId TEXT,
  requestedLevelId TEXT,
  requestedClassId TEXT,
  -- ADDENDUM §5.3 — Matricules locaux source et destination
  sourceLocalMatricule TEXT,            -- source_local_matricule (addendum)
  destinationLocalMatricule TEXT,       -- destination_local_matricule (addendum)
  motif TEXT,
  message TEXT,
  -- ADDENDUM §6 — Statuts complets
  status TEXT NOT NULL DEFAULT 'DRAFT',
  decision TEXT,
  decisionDate TEXT,
  -- ADDENDUM §11 — Traçabilité complète des validations
  requestedBy TEXT,                     -- Utilisateur habilité initiateur (addendum)
  requestedAt TEXT,                     -- Date envoi officiel (addendum)
  approvedBySource TEXT,                -- Validation école source (addendum)
  approvedBySourceAt TEXT,
  approvedByDestination TEXT,           -- Validation école destination (addendum)
  approvedByDestinationAt TEXT,
  completedAt TEXT,                     -- completed_at (addendum)
  sourceExitConfirmed INTEGER DEFAULT 0, -- Boolean → INTEGER
  sourceExitDate TEXT,
  executedAt TEXT,                      -- Legacy
  orionVigilanceFlag INTEGER DEFAULT 0,
  orionVigilanceNote TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,

  -- Colonnes techniques offline
  -- RÈGLE CRITIQUE : sync_status = PENDING jusqu'à synchronisation serveur.
  -- Aucun transfert ne devient officiel sans SYNCED.
  local_id TEXT UNIQUE,
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')),
  local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  device_id TEXT,
  -- Indique si ce brouillon est offline (interdit de finaliser sans connexion)
  is_offline_draft INTEGER DEFAULT 1    -- 1 = DRAFT hors ligne, 0 = soumis au serveur
);

CREATE INDEX IF NOT EXISTS idx_student_transfers_tenantId ON student_transfer_requests(tenantId);
CREATE INDEX IF NOT EXISTS idx_student_transfers_studentId ON student_transfer_requests(studentId);
CREATE INDEX IF NOT EXISTS idx_student_transfers_status ON student_transfer_requests(status);
CREATE INDEX IF NOT EXISTS idx_student_transfers_sourceSchoolId ON student_transfer_requests(sourceSchoolId);
CREATE INDEX IF NOT EXISTS idx_student_transfers_targetSchoolId ON student_transfer_requests(targetSchoolId);
CREATE INDEX IF NOT EXISTS idx_student_transfers_sync_status ON student_transfer_requests(sync_status);
CREATE INDEX IF NOT EXISTS idx_student_transfers_is_offline_draft ON student_transfer_requests(is_offline_draft);

-- ============================================================================
-- TABLE 12: ACADEMIC_YEARS
-- ============================================================================
CREATE TABLE IF NOT EXISTS academic_years (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  name TEXT NOT NULL,
  startDate TEXT NOT NULL,
  endDate TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  isDefault INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 13: QUARTERS (Trimestres / Semestres)
-- ============================================================================
CREATE TABLE IF NOT EXISTS quarters (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  name TEXT NOT NULL,
  startDate TEXT NOT NULL,
  endDate TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 14: SCHOOL_LEVELS
-- ============================================================================
CREATE TABLE IF NOT EXISTS school_levels (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  levelType TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 15: CLASSES
-- ============================================================================
CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  schoolLevelId TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  capacity INTEGER,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 16: SUBJECTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  schoolLevelId TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  coefficient REAL DEFAULT 1.0,
  weeklyHours INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 17: TEACHERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS teachers (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  userId TEXT,
  firstName TEXT NOT NULL,
  lastName TEXT NOT NULL,
  matricule TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 18: CLASS_STUDENTS (Affectations élèves aux classes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS class_students (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  schoolLevelId TEXT NOT NULL,
  classId TEXT NOT NULL,
  studentId TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  -- Colonnes techniques offline
  local_id TEXT UNIQUE,
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')),
  local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  device_id TEXT
);

-- ============================================================================
-- TABLE 19: CLASS_SUBJECTS (Matières par classe)
-- ============================================================================
CREATE TABLE IF NOT EXISTS class_subjects (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  classId TEXT NOT NULL,
  subjectId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  weeklyHours INTEGER DEFAULT 0,
  coefficient REAL DEFAULT 1.0,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 20: ATTENDANCE_RECORDS
-- ============================================================================
CREATE TABLE IF NOT EXISTS attendance_records (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  schoolLevelId TEXT NOT NULL,
  studentId TEXT NOT NULL,
  classId TEXT,
  date TEXT NOT NULL,
  status TEXT NOT NULL, -- PRESENT | ABSENT | LATE | EXCUSED
  notes TEXT,
  recordedBy TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  -- Colonnes techniques offline
  local_id TEXT UNIQUE,
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')),
  local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  device_id TEXT
);

-- ============================================================================
-- TABLE 21: ABSENCES (Justifications)
-- ============================================================================
CREATE TABLE IF NOT EXISTS absences (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  studentId TEXT NOT NULL,
  schoolLevelId TEXT NOT NULL,
  classId TEXT,
  date TEXT NOT NULL,
  isJustified INTEGER DEFAULT 0,
  justification TEXT,
  justifiedBy TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  -- Colonnes techniques offline
  local_id TEXT UNIQUE,
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')),
  local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  device_id TEXT
);

-- ============================================================================
-- TABLE 22: EXAMS
-- ============================================================================
CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  schoolLevelId TEXT NOT NULL,
  quarterId TEXT,
  subjectId TEXT NOT NULL,
  classId TEXT,
  name TEXT NOT NULL,
  examType TEXT DEFAULT 'COMPOSITION',
  examDate TEXT NOT NULL,
  maxScore REAL DEFAULT 20.0,
  coefficient REAL DEFAULT 1.0,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 23: EXAM_SCORES (Notes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS exam_scores (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  schoolLevelId TEXT NOT NULL,
  examId TEXT NOT NULL,
  studentId TEXT NOT NULL,
  subjectId TEXT NOT NULL,
  score REAL,
  maxScore REAL,
  coefficient REAL DEFAULT 1.0,
  remarks TEXT,
  isValidated INTEGER DEFAULT 0,
  recordedBy TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  -- Colonnes techniques offline
  local_id TEXT UNIQUE,
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')),
  local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  device_id TEXT
);

-- ============================================================================
-- TABLE 24: TIMETABLES
-- ============================================================================
CREATE TABLE IF NOT EXISTS timetables (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  schoolLevelId TEXT NOT NULL,
  name TEXT NOT NULL,
  isActive INTEGER DEFAULT 1,
  startDate TEXT NOT NULL,
  endDate TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 25: TIMETABLE_ENTRIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS timetable_entries (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  schoolLevelId TEXT NOT NULL,
  timetableId TEXT NOT NULL,
  classId TEXT,
  subjectId TEXT,
  teacherId TEXT,
  dayOfWeek INTEGER NOT NULL,
  startTime TEXT NOT NULL,
  endTime TEXT NOT NULL,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 26: LESSON_JOURNALS (Cahier de texte)
-- ============================================================================
CREATE TABLE IF NOT EXISTS lesson_journals (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  schoolLevelId TEXT NOT NULL,
  teacherId TEXT,
  classId TEXT,
  subjectId TEXT,
  date TEXT NOT NULL,
  status TEXT DEFAULT 'DRAFT',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  -- Colonnes techniques offline
  local_id TEXT UNIQUE,
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')),
  local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  device_id TEXT
);

-- ============================================================================
-- TABLE 27: LESSON_PLANS (Fiches de cours)
-- ============================================================================
CREATE TABLE IF NOT EXISTS lesson_plans (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  schoolLevelId TEXT NOT NULL,
  classId TEXT,
  subjectId TEXT,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  homework TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  -- Colonnes techniques offline
  local_id TEXT UNIQUE,
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')),
  local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  device_id TEXT
);

-- ============================================================================
-- TABLE 28: DISCIPLINE
-- ============================================================================
CREATE TABLE IF NOT EXISTS discipline (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  studentId TEXT NOT NULL,
  schoolLevelId TEXT NOT NULL,
  incidentType TEXT NOT NULL,
  description TEXT NOT NULL,
  incidentDate TEXT NOT NULL,
  severity TEXT DEFAULT 'LOW',
  status TEXT DEFAULT 'PENDING',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  -- Colonnes techniques offline
  local_id TEXT UNIQUE,
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')),
  local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  device_id TEXT
);

-- ============================================================================
-- TABLE 29: ANNOUNCEMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  schoolLevelId TEXT NOT NULL,
  classId TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'GENERAL',
  status TEXT DEFAULT 'DRAFT',
  publishedAt TEXT,
  expiresAt TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 30: STUDENT_FEES
-- ============================================================================
CREATE TABLE IF NOT EXISTS student_fees (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  studentId TEXT NOT NULL,
  feeDefinitionId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  totalAmount REAL NOT NULL,
  status TEXT DEFAULT 'NOT_STARTED',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 31: FEE_DEFINITIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS fee_definitions (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  schoolLevelId TEXT NOT NULL,
  classId TEXT,
  label TEXT NOT NULL,
  amount REAL NOT NULL,
  isMandatory INTEGER DEFAULT 1,
  dueDate TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 32: SYNC_OPERATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS sync_operations (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  operationType TEXT NOT NULL,
  status TEXT DEFAULT 'PENDING',
  startedAt TEXT DEFAULT (datetime('now')),
  completedAt TEXT,
  recordsCount INTEGER,
  errorMessage TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 33: SYNC_LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS sync_logs (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  operationId TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  details TEXT, -- JSON
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 34: SYNC_CONFLICTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS sync_conflicts (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  operationId TEXT NOT NULL,
  tableName TEXT NOT NULL,
  recordId TEXT NOT NULL,
  localData TEXT NOT NULL, -- JSON
  remoteData TEXT NOT NULL, -- JSON
  resolution TEXT,
  resolvedAt TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 35: MEDICAL_RECORDS (Infirmerie)
-- ============================================================================
CREATE TABLE IF NOT EXISTS medical_records (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  studentId TEXT NOT NULL,
  bloodType TEXT,
  emergencyContact TEXT,
  emergencyPhone TEXT,
  notes TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  -- Colonnes techniques offline
  local_id TEXT UNIQUE,
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')),
  local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  device_id TEXT,
  
  UNIQUE(tenantId, academicYearId, studentId)
);

-- ============================================================================
-- TABLE 36: MEDICAL_VISITS (Consultations infirmerie)
-- ============================================================================
CREATE TABLE IF NOT EXISTS medical_visits (
  id TEXT PRIMARY KEY,
  recordId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  visitDate TEXT NOT NULL,
  reason TEXT NOT NULL,
  diagnosis TEXT,
  treatment TEXT,
  temperature REAL,
  bloodPressure TEXT,
  notes TEXT,
  performedBy TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  -- Colonnes techniques offline
  local_id TEXT UNIQUE,
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')),
  local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  device_id TEXT
);

-- ============================================================================
-- TABLE 37: STAFF
-- ============================================================================
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT,
  schoolLevelId TEXT,
  employeeNumber TEXT UNIQUE NOT NULL,
  firstName TEXT NOT NULL,
  lastName TEXT NOT NULL,
  gender TEXT,
  position TEXT,
  department TEXT,
  roleType TEXT DEFAULT 'TEACHER',
  status TEXT DEFAULT 'ACTIVE',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 38: TRANSPORT_VEHICLES
-- ============================================================================
CREATE TABLE IF NOT EXISTS transport_vehicles (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  name TEXT,
  vehicleType TEXT NOT NULL,
  plateNumber TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  capacity INTEGER NOT NULL,
  status TEXT DEFAULT 'ACTIVE',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  UNIQUE(tenantId, academicYearId, plateNumber)
);

-- ============================================================================
-- TABLE 39: TRANSPORT_ROUTES
-- ============================================================================
CREATE TABLE IF NOT EXISTS transport_routes (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  vehicleId TEXT,
  name TEXT NOT NULL,
  code TEXT,
  startTime TEXT NOT NULL,
  endTime TEXT,
  distance REAL,
  duration INTEGER,
  type TEXT DEFAULT 'ROUND_TRIP',
  isActive INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 40: TRANSPORT_DRIVERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS transport_drivers (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  staffId TEXT,
  firstName TEXT NOT NULL,
  lastName TEXT NOT NULL,
  phone TEXT NOT NULL,
  licenseNumber TEXT NOT NULL,
  status TEXT DEFAULT 'ACTIVE',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 41: TRANSPORT_TRIPS
-- ============================================================================
CREATE TABLE IF NOT EXISTS transport_trips (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  routeId TEXT NOT NULL,
  vehicleId TEXT NOT NULL,
  driverId TEXT NOT NULL,
  tripDate TEXT NOT NULL,
  plannedStartTime TEXT NOT NULL,
  actualStartTime TEXT,
  actualEndTime TEXT,
  status TEXT DEFAULT 'PLANNED',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  -- Colonnes techniques offline
  local_id TEXT UNIQUE,
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')),
  local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  device_id TEXT
);

-- ============================================================================
-- TABLE 42: TRANSPORT_ATTENDANCES
-- ============================================================================
CREATE TABLE IF NOT EXISTS transport_attendances (
  id TEXT PRIMARY KEY,
  assignmentId TEXT NOT NULL,
  tripId TEXT,
  attendanceDate TEXT NOT NULL,
  direction TEXT DEFAULT 'TO_SCHOOL',
  status TEXT DEFAULT 'PRESENT',
  notes TEXT,
  recordedBy TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  -- Colonnes techniques offline
  local_id TEXT UNIQUE,
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')),
  local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  device_id TEXT,
  
  UNIQUE(assignmentId, attendanceDate, direction)
);

-- ============================================================================
-- TABLE 43: SHOP_PRODUCTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS shop_products (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  unitPrice REAL NOT NULL,
  minStock INTEGER DEFAULT 5,
  isActive INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  UNIQUE(tenantId, academicYearId, code)
);

-- ============================================================================
-- TABLE 44: SHOP_ORDERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS shop_orders (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  orderNumber TEXT NOT NULL,
  studentId TEXT,
  totalAmount REAL NOT NULL,
  status TEXT DEFAULT 'PENDING',
  paymentStatus TEXT DEFAULT 'UNPAID',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  -- Colonnes techniques offline
  local_id TEXT UNIQUE,
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')),
  local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  device_id TEXT,
  
  UNIQUE(tenantId, academicYearId, orderNumber)
);

-- ============================================================================
-- TABLE 45: SHOP_STOCKS
-- ============================================================================
CREATE TABLE IF NOT EXISTS shop_stocks (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  productId TEXT UNIQUE NOT NULL,
  quantity INTEGER DEFAULT 0,
  reservedQty INTEGER DEFAULT 0,
  location TEXT,
  lastInventory TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- INDEXES FOR SPECIALIZED TABLES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_medical_records_studentId ON medical_records(studentId);
CREATE INDEX IF NOT EXISTS idx_medical_visits_recordId ON medical_visits(recordId);
CREATE INDEX IF NOT EXISTS idx_transport_trips_date ON transport_trips(tripDate);
CREATE INDEX IF NOT EXISTS idx_transport_attendances_date ON transport_attendances(attendanceDate);
CREATE INDEX IF NOT EXISTS idx_shop_orders_orderNumber ON shop_orders(orderNumber);
CREATE INDEX IF NOT EXISTS idx_shop_stocks_productId ON shop_stocks(productId);

-- ============================================================================
-- TABLE 46: GUARDIANS (Parents/Tuteurs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS guardians (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  firstName TEXT NOT NULL,
  lastName TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  relationship TEXT,
  address TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 47: STUDENT_GUARDIANS (Pivot)
-- ============================================================================
CREATE TABLE IF NOT EXISTS student_guardians (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  studentId TEXT NOT NULL,
  guardianId TEXT NOT NULL,
  relationship TEXT,
  isPrimary INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  UNIQUE(studentId, guardianId)
);

-- ============================================================================
-- TABLE 48: ROOMS (Salles de classe)
-- ============================================================================
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT,
  roomCode TEXT NOT NULL,
  roomName TEXT NOT NULL,
  roomType TEXT NOT NULL,
  capacity INTEGER,
  status TEXT DEFAULT 'ACTIVE',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  UNIQUE(tenantId, roomCode)
);

-- ============================================================================
-- TABLE 49: TIME_SLOTS (Créneaux horaires)
-- ============================================================================
CREATE TABLE IF NOT EXISTS time_slots (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  dayOfWeek INTEGER NOT NULL,
  startTime TEXT NOT NULL,
  endTime TEXT NOT NULL,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  UNIQUE(tenantId, dayOfWeek, startTime, endTime)
);

-- ============================================================================
-- TABLE 50: ACADEMIC_TRACKS (Séries/Filières)
-- ============================================================================
CREATE TABLE IF NOT EXISTS academic_tracks (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  isActive INTEGER DEFAULT 1,
  isDefault INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  UNIQUE(tenantId, code)
);

-- ============================================================================
-- TABLE 51: PEDAGOGY_ACADEMIC_CLASSES (Classes pédagogiques)
-- ============================================================================
CREATE TABLE IF NOT EXISTS pedagogy_academic_classes (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  levelId TEXT NOT NULL,
  cycleId TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  capacity INTEGER,
  roomId TEXT,
  mainTeacherId TEXT,
  isActive INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  UNIQUE(tenantId, academicYearId, code)
);

-- ============================================================================
-- TABLE 52: COUNTRIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS countries (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  currencyCode TEXT,
  phonePrefix TEXT,
  isDefault INTEGER DEFAULT 0,
  isActive INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 53: GRADING_POLICIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS grading_policies (
  id TEXT PRIMARY KEY,
  countryId TEXT NOT NULL,
  name TEXT NOT NULL,
  educationLevel TEXT NOT NULL,
  maxScore REAL NOT NULL,
  passingScore REAL NOT NULL,
  gradeScales TEXT, -- JSON
  isActive INTEGER DEFAULT 1,
  isDefault INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 54: GRADES (Notes finales par trimestre)
-- ============================================================================
CREATE TABLE IF NOT EXISTS grades (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  schoolLevelId TEXT NOT NULL,
  studentId TEXT NOT NULL,
  subjectId TEXT NOT NULL,
  quarterId TEXT,
  examId TEXT,
  score REAL NOT NULL,
  maxScore REAL DEFAULT 20.0,
  coefficient REAL DEFAULT 1.0,
  status TEXT DEFAULT 'VALIDATED',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  -- Colonnes techniques offline
  local_id TEXT UNIQUE,
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')),
  local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  device_id TEXT
);

-- ============================================================================
-- TABLE 55: GRADE_CALCULATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS grade_calculations (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  schoolLevelId TEXT NOT NULL,
  studentId TEXT NOT NULL,
  subjectId TEXT,
  quarterId TEXT,
  calculationType TEXT NOT NULL,
  rawAverage REAL NOT NULL,
  weightedAverage REAL NOT NULL,
  finalGrade REAL,
  calculatedAt TEXT DEFAULT (datetime('now')),
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 56: GRADE_RULES_VERSIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS grade_rules_versions (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  schoolLevelId TEXT NOT NULL,
  versionNumber INTEGER NOT NULL,
  name TEXT NOT NULL,
  rules TEXT, -- JSON
  isActive INTEGER DEFAULT 0,
  effectiveDate TEXT NOT NULL,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 57: REPORT_CARDS (Bulletins)
-- ============================================================================
CREATE TABLE IF NOT EXISTS report_cards (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  schoolLevelId TEXT NOT NULL,
  studentId TEXT NOT NULL,
  quarterId TEXT,
  average REAL,
  rank INTEGER,
  totalStudents INTEGER,
  status TEXT DEFAULT 'DRAFT',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 58: REPORT_CARD_ITEMS (Lignes de bulletin)
-- ============================================================================
CREATE TABLE IF NOT EXISTS report_card_items (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  schoolLevelId TEXT NOT NULL,
  reportCardId TEXT NOT NULL,
  subjectId TEXT NOT NULL,
  average REAL,
  rank INTEGER,
  comments TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 59: RANKINGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS rankings (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  schoolLevelId TEXT NOT NULL,
  studentId TEXT NOT NULL,
  rankingType TEXT NOT NULL,
  rank INTEGER NOT NULL,
  average REAL NOT NULL,
  totalStudents INTEGER NOT NULL,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 60: HONOR_ROLLS (Tableaux d'honneur)
-- ============================================================================
CREATE TABLE IF NOT EXISTS honor_rolls (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  schoolLevelId TEXT NOT NULL,
  studentId TEXT NOT NULL,
  mention TEXT NOT NULL,
  average REAL NOT NULL,
  rank INTEGER NOT NULL,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 61: HOMEWORK_ENTRIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS homework_entries (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  schoolLevelId TEXT NOT NULL,
  lessonPlanId TEXT,
  classId TEXT,
  subjectId TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  dueDate TEXT NOT NULL,
  maxScore REAL,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  -- Colonnes techniques offline
  local_id TEXT UNIQUE,
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')),
  local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  device_id TEXT
);

-- ============================================================================
-- TABLE 62: HOMEWORK_SUBMISSIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS homework_submissions (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  schoolLevelId TEXT NOT NULL,
  homeworkId TEXT NOT NULL,
  studentId TEXT NOT NULL,
  content TEXT,
  submittedAt TEXT DEFAULT (datetime('now')),
  score REAL,
  feedback TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  -- Colonnes techniques offline
  local_id TEXT UNIQUE,
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')),
  local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  device_id TEXT
);

-- ============================================================================
-- TABLE 63: PEDAGOGY_ACADEMIC_CYCLES
-- ============================================================================
CREATE TABLE IF NOT EXISTS pedagogy_academic_cycles (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  isActive INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  UNIQUE(tenantId, code)
);

-- ============================================================================
-- TABLE 64: PEDAGOGY_ACADEMIC_LEVELS
-- ============================================================================
CREATE TABLE IF NOT EXISTS pedagogy_academic_levels (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  cycleId TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  orderIndex INTEGER NOT NULL,
  isActive INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  UNIQUE(tenantId, code)
);

-- ============================================================================
-- TABLE 65: PEDAGOGY_ACADEMIC_SERIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS pedagogy_academic_series (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  isActive INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  UNIQUE(tenantId, code)
);

-- ============================================================================
-- TABLE 66: PEDAGOGY_TEACHING_ASSIGNMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS pedagogy_teaching_assignments (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  teacherId TEXT NOT NULL,
  classId TEXT NOT NULL,
  subjectId TEXT NOT NULL,
  isMainTeacher INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  UNIQUE(academicYearId, teacherId, classId, subjectId)
);

-- ============================================================================
-- TABLE 68: QHSE_SETTINGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS qhse_settings (
  id TEXT PRIMARY KEY,
  tenantId TEXT UNIQUE NOT NULL,
  auditFrequency INTEGER DEFAULT 30,
  riskThreshold REAL DEFAULT 5.0,
  notificationsEnabled INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 69: QHSE_INCIDENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS qhse_incidents (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  incidentType TEXT NOT NULL,
  severity TEXT DEFAULT 'MEDIUM',
  description TEXT NOT NULL,
  location TEXT,
  incidentDate TEXT NOT NULL,
  status TEXT DEFAULT 'OPEN',
  reportedBy TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  -- Colonnes techniques offline
  local_id TEXT UNIQUE,
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')),
  local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  device_id TEXT
);

-- ============================================================================
-- TABLE 70: QHSE_RISKS
-- ============================================================================
CREATE TABLE IF NOT EXISTS qhse_risks (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  probability REAL DEFAULT 1.0,
  impact REAL DEFAULT 1.0,
  mitigationPlan TEXT,
  status TEXT DEFAULT 'ACTIVE',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 71: QHSE_AUDITS
-- ============================================================================
CREATE TABLE IF NOT EXISTS qhse_audits (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  auditType TEXT NOT NULL,
  title TEXT NOT NULL,
  plannedDate TEXT NOT NULL,
  completedDate TEXT,
  status TEXT DEFAULT 'PLANNED',
  auditorId TEXT,
  score REAL,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 72: LABS
-- ============================================================================
CREATE TABLE IF NOT EXISTS labs (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  location TEXT,
  capacity INTEGER,
  isActive INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 73: LAB_EQUIPMENT
-- ============================================================================
CREATE TABLE IF NOT EXISTS lab_equipment (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  labId TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  status TEXT DEFAULT 'FUNCTIONAL',
  lastMaintenance TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  UNIQUE(tenantId, code)
);

-- ============================================================================
-- TABLE 74: LAB_SESSIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS lab_sessions (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  labId TEXT NOT NULL,
  classId TEXT,
  subjectId TEXT,
  teacherId TEXT,
  sessionDate TEXT NOT NULL,
  startTime TEXT NOT NULL,
  endTime TEXT,
  topic TEXT NOT NULL,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  -- Colonnes techniques offline
  local_id TEXT UNIQUE,
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')),
  local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  device_id TEXT
);

-- ============================================================================
-- TABLE 75: LIBRARY_BOOKS
-- ============================================================================
CREATE TABLE IF NOT EXISTS library_books (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  categoryId TEXT,
  title TEXT NOT NULL,
  author TEXT,
  isbn TEXT,
  publisher TEXT,
  publishDate TEXT,
  language TEXT DEFAULT 'FR',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 76: LIBRARY_COPIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS library_copies (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  bookId TEXT NOT NULL,
  barcode TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'AVAILABLE',
  location TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 77: LIBRARY_LOANS
-- ============================================================================
CREATE TABLE IF NOT EXISTS library_loans (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  bookId TEXT NOT NULL,
  copyId TEXT NOT NULL,
  studentId TEXT,
  staffId TEXT,
  readerType TEXT DEFAULT 'STUDENT',
  loanDate TEXT NOT NULL,
  dueDate TEXT NOT NULL,
  returnDate TEXT,
  status TEXT DEFAULT 'ACTIVE',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  -- Colonnes techniques offline
  local_id TEXT UNIQUE,
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')),
  local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  device_id TEXT
);

-- ============================================================================
-- TABLE 78: LIBRARY_CATEGORIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS library_categories (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  UNIQUE(tenantId, name)
);

-- ============================================================================
-- TABLE 79: LIBRARY_RESERVATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS library_reservations (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  bookId TEXT NOT NULL,
  userId TEXT NOT NULL,
  reserveDate TEXT DEFAULT (datetime('now')),
  expiryDate TEXT,
  status TEXT DEFAULT 'WAITING',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 80: MEETINGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  meetingType TEXT NOT NULL,
  scopeType TEXT NOT NULL,
  schoolLevelId TEXT,
  classId TEXT,
  studentId TEXT,
  title TEXT NOT NULL,
  description TEXT,
  meetingDate TEXT NOT NULL,
  startTime TEXT,
  endTime TEXT,
  location TEXT,
  status TEXT DEFAULT 'PLANNED',
  createdBy TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 81: MEETING_PARTICIPANTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS meeting_participants (
  id TEXT PRIMARY KEY,
  meetingId TEXT NOT NULL,
  participantType TEXT NOT NULL,
  participantId TEXT NOT NULL,
  invitedAt TEXT DEFAULT (datetime('now')),
  attendanceStatus TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  UNIQUE(meetingId, participantType, participantId)
);

-- ============================================================================
-- TABLE 82: MEETING_DECISIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS meeting_decisions (
  id TEXT PRIMARY KEY,
  meetingId TEXT NOT NULL,
  decisionText TEXT NOT NULL,
  responsibleId TEXT,
  dueDate TEXT,
  status TEXT DEFAULT 'PENDING',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 83: MEETING_AGENDAS
-- ============================================================================
CREATE TABLE IF NOT EXISTS meeting_agendas (
  id TEXT PRIMARY KEY,
  meetingId TEXT NOT NULL,
  agendaOrder INTEGER DEFAULT 0,
  topic TEXT NOT NULL,
  description TEXT,
  presenterId TEXT,
  status TEXT DEFAULT 'PLANNED',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 84: MEETING_MINUTES (PV de réunion)
-- ============================================================================
CREATE TABLE IF NOT EXISTS meeting_minutes (
  id TEXT PRIMARY KEY,
  meetingId TEXT UNIQUE NOT NULL,
  templateId TEXT,
  version INTEGER DEFAULT 1,
  content TEXT NOT NULL,
  language TEXT DEFAULT 'FR',
  recordedBy TEXT,
  validated INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 85: FEE_CATEGORIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS fee_categories (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  code TEXT,
  isActive INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  UNIQUE(tenantId, code)
);

-- ============================================================================
-- TABLE 86: FEE_ARREARS (Arriérés)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fee_arrears (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  studentId TEXT NOT NULL,
  studentFeeId TEXT NOT NULL,
  totalDue REAL NOT NULL,
  totalPaid REAL DEFAULT 0,
  balanceDue REAL NOT NULL,
  arrearsLevel TEXT DEFAULT 'LOW',
  lastPaymentDate TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  UNIQUE(studentId, studentFeeId, academicYearId)
);

-- ============================================================================
-- TABLE 87: FEE_INSTALLMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS fee_installments (
  id TEXT PRIMARY KEY,
  feeDefinitionId TEXT NOT NULL,
  installmentLabel TEXT NOT NULL,
  amount REAL NOT NULL,
  dueDate TEXT NOT NULL,
  orderIndex INTEGER NOT NULL,
  isMandatory INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 88: FEE_STRUCTURES
-- ============================================================================
CREATE TABLE IF NOT EXISTS fee_structures (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  levelId TEXT,
  classId TEXT,
  name TEXT NOT NULL,
  feeType TEXT NOT NULL,
  totalAmount REAL NOT NULL,
  isInstallment INTEGER DEFAULT 0,
  isActive INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 89: TUITION_PAYMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS tuition_payments (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  schoolLevelId TEXT NOT NULL,
  studentId TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'XOF',
  status TEXT NOT NULL,
  paymentMethod TEXT,
  paidAt TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  -- Colonnes techniques offline
  local_id TEXT UNIQUE,
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')),
  local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  device_id TEXT
);

-- ============================================================================
-- TABLE 90: TUITION_INSTALLMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS tuition_installments (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  schoolLevelId TEXT NOT NULL,
  tuitionPaymentId TEXT NOT NULL,
  installmentNumber INTEGER NOT NULL,
  amount REAL NOT NULL,
  dueDate TEXT NOT NULL,
  paidAt TEXT,
  status TEXT DEFAULT 'PENDING',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 91: STUDENT_ACCOUNTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS student_accounts (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  studentId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  totalDue REAL DEFAULT 0,
  totalPaid REAL DEFAULT 0,
  balance REAL DEFAULT 0,
  arrearsAmount REAL DEFAULT 0,
  status TEXT DEFAULT 'ACTIVE',
  isBlocked INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  UNIQUE(studentId, academicYearId)
);

-- ============================================================================
-- TABLE 92: FINANCE_TRANSACTIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_transactions (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  studentAccountId TEXT NOT NULL,
  type TEXT NOT NULL, -- CREDIT | DEBIT
  amount REAL NOT NULL,
  paymentMethod TEXT NOT NULL,
  reference TEXT,
  cashierId TEXT NOT NULL,
  receiptNumber TEXT UNIQUE NOT NULL,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  -- Colonnes techniques offline
  local_id TEXT UNIQUE,
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')),
  local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  device_id TEXT
);

-- ============================================================================
-- TABLE 93: FINANCE_BUDGETS
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_budgets (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  categoryId TEXT NOT NULL,
  allocatedAmount REAL NOT NULL,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  UNIQUE(tenantId, academicYearId, categoryId)
);

-- ============================================================================
-- TABLE 94: FINANCE_EXPENSES
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_expenses (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  categoryId TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'PENDING',
  requestedById TEXT NOT NULL,
  approvedById TEXT,
  approvedAt TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  -- Colonnes techniques offline
  local_id TEXT UNIQUE,
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')),
  local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  device_id TEXT
);

-- ============================================================================
-- TABLE 95: FINANCE_DAILY_CLOSURES
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_daily_closures (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  date TEXT NOT NULL,
  totalIncome REAL NOT NULL,
  totalExpense REAL NOT NULL,
  netBalance REAL NOT NULL,
  closureType TEXT DEFAULT 'MANUAL',
  validatedById TEXT,
  anomalyDetected INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  UNIQUE(tenantId, academicYearId, date)
);

-- ============================================================================
-- TABLE 96: EMPLOYMENT_CONTRACTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS employment_contracts (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  staffId TEXT NOT NULL,
  contractNumber TEXT UNIQUE NOT NULL,
  contractType TEXT NOT NULL,
  startDate TEXT NOT NULL,
  endDate TEXT,
  baseSalary REAL NOT NULL,
  status TEXT DEFAULT 'ACTIVE',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 97: SALARY_POLICIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS salary_policies (
  id TEXT PRIMARY KEY,
  countryId TEXT NOT NULL,
  name TEXT NOT NULL,
  salaryStructure TEXT, -- JSON
  socialContributions TEXT, -- JSON
  isActive INTEGER DEFAULT 1,
  isDefault INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 98: PAYROLLS (Livre de paie)
-- ============================================================================
CREATE TABLE IF NOT EXISTS payrolls (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  status TEXT DEFAULT 'DRAFT',
  totalAmount REAL NOT NULL,
  processedAt TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  UNIQUE(tenantId, academicYearId, month)
);

-- ============================================================================
-- TABLE 99: PAYROLL_ITEMS (Lignes de paie)
-- ============================================================================
CREATE TABLE IF NOT EXISTS payroll_items (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  payrollId TEXT NOT NULL,
  staffId TEXT NOT NULL,
  baseSalary REAL NOT NULL,
  totalAllowances REAL DEFAULT 0,
  totalDeductions REAL DEFAULT 0,
  netSalary REAL NOT NULL,
  status TEXT DEFAULT 'PENDING',
  paidAt TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 100: SALARY_SLIPS (Bulletins de paie)
-- ============================================================================
CREATE TABLE IF NOT EXISTS salary_slips (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  payrollItemId TEXT UNIQUE NOT NULL,
  receiptNumber TEXT UNIQUE NOT NULL,
  period TEXT NOT NULL,
  issuedAt TEXT DEFAULT (datetime('now')),
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 101: TAX_RATES
-- ============================================================================
CREATE TABLE IF NOT EXISTS tax_rates (
  id TEXT PRIMARY KEY,
  countryCode TEXT NOT NULL,
  taxType TEXT DEFAULT 'IRPP',
  bracketMin REAL NOT NULL,
  bracketMax REAL,
  ratePercentage REAL NOT NULL,
  fixedAmount REAL,
  effectiveFrom TEXT NOT NULL,
  isActive INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 102: TAX_WITHHOLDINGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS tax_withholdings (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  payrollItemId TEXT NOT NULL,
  staffId TEXT NOT NULL,
  taxType TEXT DEFAULT 'IRPP',
  taxableAmount REAL NOT NULL,
  withheldAmount REAL NOT NULL,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 103: EMPLOYEE_CNSS
-- ============================================================================
CREATE TABLE IF NOT EXISTS employee_cnss (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  staffId TEXT UNIQUE NOT NULL,
  cnssNumber TEXT,
  affiliationDate TEXT,
  isActive INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 104: OVERTIME_RECORDS
-- ============================================================================
CREATE TABLE IF NOT EXISTS overtime_records (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  staffId TEXT NOT NULL,
  date TEXT NOT NULL,
  hours REAL NOT NULL,
  validated INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 105: EXPENSE_CATEGORIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS expense_categories (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  code TEXT,
  parentId TEXT,
  isActive INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 106: EXPENSES
-- ============================================================================
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT,
  schoolLevelId TEXT NOT NULL,
  categoryId TEXT,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  expenseDate TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  approvedBy TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  -- Colonnes techniques offline
  local_id TEXT UNIQUE,
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')),
  local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  device_id TEXT
);

-- ============================================================================
-- TABLE 107: NATIONAL_EXAMS
-- ============================================================================
CREATE TABLE IF NOT EXISTS national_exams (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  examType TEXT NOT NULL, -- CEP, BEPC, BAC, etc.
  startDate TEXT NOT NULL,
  endDate TEXT NOT NULL,
  status TEXT DEFAULT 'DRAFT',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 108: NATIONAL_EXAM_SUBJECTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS national_exam_subjects (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  examId TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  coefficient REAL DEFAULT 1.0,
  maxScore REAL DEFAULT 20.0,
  passingScore REAL DEFAULT 10.0,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 109: EXAM_SESSIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS exam_sessions (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  examId TEXT NOT NULL,
  name TEXT NOT NULL,
  startDate TEXT NOT NULL,
  endDate TEXT NOT NULL,
  status TEXT DEFAULT 'OPEN',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 110: EXAM_CENTERS (Centres d'examen)
-- ============================================================================
CREATE TABLE IF NOT EXISTS exam_centers (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  examId TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  location TEXT,
  capacity INTEGER,
  status TEXT DEFAULT 'ACTIVE',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 111: EXAM_ROOMS (Salles d'examen)
-- ============================================================================
CREATE TABLE IF NOT EXISTS exam_rooms (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  centerId TEXT NOT NULL,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  status TEXT DEFAULT 'ACTIVE',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 112: EXAM_CANDIDATES
-- ============================================================================
CREATE TABLE IF NOT EXISTS exam_candidates (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  examId TEXT NOT NULL,
  centerId TEXT,
  roomId TEXT,
  registrationNumber TEXT NOT NULL,
  matricule TEXT,
  tableNumber INTEGER,
  firstName TEXT NOT NULL,
  lastName TEXT NOT NULL,
  status TEXT DEFAULT 'REGISTERED',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  -- Colonnes techniques offline
  local_id TEXT UNIQUE,
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')),
  local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  device_id TEXT,
  
  UNIQUE(tenantId, academicYearId, examId, registrationNumber)
);

-- ============================================================================
-- TABLE 113: EXAM_RESULTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS exam_results (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  examId TEXT NOT NULL,
  candidateId TEXT NOT NULL,
  subjectId TEXT NOT NULL,
  score REAL NOT NULL,
  maxScore REAL DEFAULT 20.0,
  coefficient REAL DEFAULT 1.0,
  weightedScore REAL NOT NULL,
  status TEXT DEFAULT 'DRAFT',
  enteredBy TEXT,
  validatedBy TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  -- Colonnes techniques offline
  local_id TEXT UNIQUE,
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')),
  local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  device_id TEXT,
  
  UNIQUE(tenantId, academicYearId, examId, candidateId, subjectId)
);

-- ============================================================================
-- TABLE 114: EXAM_DELIBERATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS exam_deliberations (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  examId TEXT NOT NULL,
  juryName TEXT,
  deliberatedAt TEXT DEFAULT (datetime('now')),
  totalCandidates INTEGER NOT NULL,
  passedCount INTEGER NOT NULL,
  failedCount INTEGER NOT NULL,
  successRate REAL NOT NULL,
  status TEXT DEFAULT 'DRAFT',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 115: EXAM_STAFFS
-- ============================================================================
CREATE TABLE IF NOT EXISTS exam_staffs (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  centerId TEXT NOT NULL,
  firstName TEXT NOT NULL,
  lastName TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT DEFAULT 'ACTIVE',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 116: EXAM_SUPERVISORS (Surveillants)
-- ============================================================================
CREATE TABLE IF NOT EXISTS exam_supervisors (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  examId TEXT NOT NULL,
  centerId TEXT,
  roomId TEXT,
  firstName TEXT NOT NULL,
  lastName TEXT NOT NULL,
  role TEXT DEFAULT 'SUPERVISOR',
  status TEXT DEFAULT 'ASSIGNED',
  assignedDate TEXT DEFAULT (datetime('now')),
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 117: EXAM_INCIDENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS exam_incidents (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  examId TEXT NOT NULL,
  centerId TEXT NOT NULL,
  candidateId TEXT,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL,
  reportedAt TEXT DEFAULT (datetime('now')),
  reportedBy TEXT NOT NULL,
  status TEXT DEFAULT 'OPEN',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 118: ORION_ALERTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS orion_alerts (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT,
  alertType TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  recommendation TEXT,
  acknowledged INTEGER DEFAULT 0,
  acknowledgedAt TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 119: ORION_REPORTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS orion_reports (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT,
  reportType TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  period TEXT,
  generatedAt TEXT DEFAULT (datetime('now')),
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 120: ORION_RISK_FLAGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS orion_risk_flags (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT NOT NULL,
  entityType TEXT NOT NULL,
  entityId TEXT NOT NULL,
  riskCategory TEXT NOT NULL,
  riskScore REAL NOT NULL,
  level TEXT NOT NULL,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 121: MESSAGES
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  academicYearId TEXT,
  senderUserId TEXT NOT NULL,
  subject TEXT,
  content TEXT NOT NULL,
  messageType TEXT DEFAULT 'INFO',
  status TEXT DEFAULT 'DRAFT',
  sentAt TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  -- Colonnes techniques offline
  local_id TEXT UNIQUE,
  sync_status TEXT DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCED', 'CONFLICT', 'ERROR')),
  local_updated_at TEXT DEFAULT (datetime('now')) NOT NULL,
  device_id TEXT
);

-- ============================================================================
-- TABLE 122: MESSAGE_RECIPIENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS message_recipients (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  messageId TEXT NOT NULL,
  recipientId TEXT NOT NULL,
  recipientType TEXT NOT NULL,
  status TEXT DEFAULT 'PENDING',
  deliveredAt TEXT,
  readAt TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  UNIQUE(messageId, recipientId, recipientType)
);

-- ============================================================================
-- TABLE 123: PUSH_NOTIFICATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS push_notifications (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  recipientId TEXT NOT NULL,
  recipientType TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL,
  sentAt TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 124: SMS_LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS sms_logs (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  recipient TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL,
  sentAt TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 125: EMAIL_LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_logs (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL,
  sentAt TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 126: FEDERIS_INVOICES
-- ============================================================================
CREATE TABLE IF NOT EXISTS federis_invoices (
  id TEXT PRIMARY KEY,
  patronatId TEXT NOT NULL,
  tenantId TEXT NOT NULL,
  number TEXT UNIQUE NOT NULL,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'XOF',
  dueDate TEXT NOT NULL,
  status TEXT DEFAULT 'UNPAID',
  type TEXT DEFAULT 'SUBSCRIPTION',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 127: FEDERIS_PAYMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS federis_payments (
  id TEXT PRIMARY KEY,
  invoiceId TEXT NOT NULL,
  tenantId TEXT NOT NULL,
  amount REAL NOT NULL,
  paymentDate TEXT DEFAULT (datetime('now')),
  method TEXT NOT NULL,
  transactionId TEXT,
  status TEXT DEFAULT 'COMPLETED',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 128: ROLES
-- ============================================================================
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  tenantId TEXT,
  name TEXT NOT NULL,
  description TEXT,
  isSystemRole INTEGER DEFAULT 0,
  canAccessOrion INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 129: PERMISSIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 130: ROLE_PERMISSIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  roleId TEXT NOT NULL,
  permissionId TEXT NOT NULL,
  levelScope TEXT,
  PRIMARY KEY (roleId, permissionId)
);

-- ============================================================================
-- TABLE 131: USER_ROLES
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_roles (
  userId TEXT NOT NULL,
  roleId TEXT NOT NULL,
  tenantId TEXT,
  PRIMARY KEY (userId, roleId)
);

-- ============================================================================
-- TABLE 132: GED_DOCUMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS ged_documents (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  fileUrl TEXT NOT NULL,
  fileType TEXT,
  fileSize INTEGER,
  ownerId TEXT,
  isPublic INTEGER DEFAULT 0,
  status TEXT DEFAULT 'ACTIVE',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 133: GENERATED_DOCUMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS generated_documents (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  documentType TEXT NOT NULL,
  title TEXT NOT NULL,
  fileUrl TEXT NOT NULL,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 134: DOCUMENT_TEMPLATES
-- ============================================================================
CREATE TABLE IF NOT EXISTS document_templates (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  template TEXT NOT NULL,
  isActive INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 135: TENANT_SETTINGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_settings (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT, -- JSON
  category TEXT,
  isSystem INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  UNIQUE(tenantId, key)
);

-- ============================================================================
-- TABLE 136: SETTINGS_HISTORY
-- ============================================================================
CREATE TABLE IF NOT EXISTS settings_history (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  settingId TEXT,
  key TEXT NOT NULL,
  oldValue TEXT,
  newValue TEXT,
  changedBy TEXT,
  changedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 137: PRICING_CONFIGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS pricing_configs (
  id TEXT PRIMARY KEY,
  initialSubscriptionFee INTEGER NOT NULL,
  monthlyBasePrice INTEGER NOT NULL,
  yearlyBasePrice INTEGER NOT NULL,
  currency TEXT DEFAULT 'XOF',
  isActive INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  UNIQUE(version)
);

-- ============================================================================
-- TABLE 138: SUBSCRIPTIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  tenantId TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL,
  status TEXT DEFAULT 'TRIAL',
  startDate TEXT NOT NULL,
  endDate TEXT,
  trialEndsAt TEXT,
  amount REAL NOT NULL,
  billingCycle TEXT DEFAULT 'MONTHLY',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 139: SUBSCRIPTION_PLANS
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  monthlyPrice INTEGER NOT NULL,
  yearlyPrice INTEGER NOT NULL,
  maxSchools INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 140: SUBSCRIPTION_INVOICES
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscription_invoices (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  subscriptionId TEXT NOT NULL,
  invoiceNumber TEXT UNIQUE NOT NULL,
  amount REAL NOT NULL,
  status TEXT DEFAULT 'PENDING',
  issueDate TEXT DEFAULT (datetime('now')),
  dueDate TEXT NOT NULL,
  paidAt TEXT,
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL
);

-- ============================================================================
-- TABLE 141: MODULES
-- ============================================================================
CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  schoolLevelId TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  isEnabled INTEGER DEFAULT 1,
  configuration TEXT DEFAULT '{}',
  createdAt TEXT DEFAULT (datetime('now')) NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now')) NOT NULL,
  
  UNIQUE(tenantId, type, schoolLevelId)
);

-- ============================================================================
-- INDEXES FOR INFRASTRUCTURE TABLES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_ged_documents_tenantId ON ged_documents(tenantId);
CREATE INDEX IF NOT EXISTS idx_tenant_settings_key ON tenant_settings(key);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_roles_tenantId ON roles(tenantId);

-- ============================================================================
-- CORRESPONDANCE POSTGRESQL ↔ SQLITE
-- ============================================================================

-- Résumé des correspondances :
-- 
-- PostgreSQL          SQLite               Notes
-- ----------          ------               -----
-- students            students             Colonnes techniques ajoutées
-- payments            payments             Colonnes techniques ajoutées
-- student_fee_profiles student_fee_profiles Colonnes techniques ajoutées
-- collection_cases    collection_cases     Colonnes techniques ajoutées
-- student_documents   student_documents    Colonnes techniques ajoutées
-- user_devices        user_devices         Pas de colonnes techniques (serveur uniquement)
-- otp_codes           otp_codes            Pas de colonnes techniques (serveur uniquement)
-- device_sessions     device_sessions      Pas de colonnes techniques (serveur uniquement)
-- auth_audit_logs     auth_audit_logs      Pas de colonnes techniques (serveur uniquement)
-- 
-- Colonnes techniques (uniquement SQLite) :
-- - local_id TEXT UNIQUE              (ID temporaire offline)
-- - sync_status TEXT                  (PENDING | SYNCED | CONFLICT | ERROR)
-- - local_updated_at TEXT             (Date modification locale)
-- - device_id TEXT                    (Identifiant dispositif)
-- 
-- Conversion de types :
-- - String → TEXT                     (identique)
-- - DateTime → TEXT                   (ISO 8601: 'YYYY-MM-DD HH:MM:SS')
-- - Date → TEXT                       (ISO 8601: 'YYYY-MM-DD')
-- - Decimal → REAL                    (approximation, précision 10.2)
-- - Boolean → INTEGER                 (0 = false, 1 = true)
-- - Json → TEXT                       (JSON string)
-- 
-- ============================================================================

-- ============================================================================
-- Academia Helm — SQLite Schema (auto-generated from Neon PostgreSQL)
-- ============================================================================
-- Generated: 2026-07-30T12:58:24.194Z
-- Tables: 625
--
-- This file is executed by tauri-plugin-sql on first launch to create
-- the local SQLite database with the same schema as Neon PostgreSQL.
-- ============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Table: HelmInvoice
CREATE TABLE IF NOT EXISTS "HelmInvoice" (
  "id" TEXT PRIMARY KEY,
  "subscriptionId" TEXT,
  "tenantId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "plan" TEXT,
  "billingCycle" TEXT,
  "period" TEXT,
  "fedapayTxId" TEXT,
  "paidAt" TEXT,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "invoiceNumber" TEXT,
  "customerEmail" TEXT,
  "customerName" TEXT,
  "customerPhone" TEXT,
  "description" TEXT,
  "type" TEXT,
  "paymentReference" TEXT,
  "paymentMethod" TEXT,
  "paymentOperator" TEXT,
  "bilingualEnabled" INTEGER NOT NULL DEFAULT 0,
  "issuedAt" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_HelmInvoice_subscriptionId" ON "HelmInvoice" ("subscriptionId");
CREATE INDEX IF NOT EXISTS "idx_HelmInvoice_tenantId" ON "HelmInvoice" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_HelmInvoice_fedapayTxId" ON "HelmInvoice" ("fedapayTxId");

-- Table: HelmSubscription
CREATE TABLE IF NOT EXISTS "HelmSubscription" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "plan" TEXT NOT NULL,
  "billingCycle" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "monthlyAmount" INTEGER NOT NULL,
  "annualAmount" INTEGER NOT NULL,
  "setupFee" INTEGER NOT NULL,
  "startDate" TEXT NOT NULL DEFAULT (datetime('now')),
  "currentPeriodStart" TEXT NOT NULL,
  "currentPeriodEnd" TEXT NOT NULL,
  "trialEnd" TEXT,
  "cancelledAt" TEXT,
  "lastStudentCount" INTEGER NOT NULL DEFAULT 0,
  "lastCountCheckedAt" TEXT,
  "upgradeGraceEnd" TEXT,
  "pendingUpgradePlan" TEXT,
  "activeAddons" TEXT NOT NULL,
  "fedapayCustomerId" TEXT,
  "fedapaySubId" TEXT,
  "lastPaymentDate" TEXT,
  "lastPaymentAmount" INTEGER,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "notified7DaysBefore" TEXT,
  "notified3DaysBefore" TEXT,
  "notified1DayBefore" TEXT,
  "expiredAt" TEXT,
  "gracePeriodEnd" TEXT,
  "suspendedAt" TEXT,
  "blockedAt" TEXT,
  "notifiedBlockWarning" TEXT,
  "reactivationFee" INTEGER NOT NULL DEFAULT 5000,
  "bilingualEnabled" INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "idx_HelmSubscription_tenantId" ON "HelmSubscription" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_HelmSubscription_fedapayCustomerId" ON "HelmSubscription" ("fedapayCustomerId");
CREATE INDEX IF NOT EXISTS "idx_HelmSubscription_fedapaySubId" ON "HelmSubscription" ("fedapaySubId");

-- Table: HelmUpgradeEvent
CREATE TABLE IF NOT EXISTS "HelmUpgradeEvent" (
  "id" TEXT PRIMARY KEY,
  "subscriptionId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "fromPlan" TEXT NOT NULL,
  "toPlan" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "studentCountAt" INTEGER NOT NULL,
  "notifiedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "confirmedAt" TEXT,
  "gracePeriodEnd" TEXT NOT NULL,
  "suspendedAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_HelmUpgradeEvent_subscriptionId" ON "HelmUpgradeEvent" ("subscriptionId");
CREATE INDEX IF NOT EXISTS "idx_HelmUpgradeEvent_tenantId" ON "HelmUpgradeEvent" ("tenantId");

-- Table: absences
CREATE TABLE IF NOT EXISTS "absences" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "classId" TEXT,
  "date" TEXT NOT NULL,
  "isJustified" INTEGER NOT NULL DEFAULT 0,
  "justification" TEXT,
  "justifiedBy" TEXT,
  "createdBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_absences_tenantId" ON "absences" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_absences_studentId" ON "absences" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_absences_schoolLevelId" ON "absences" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_absences_classId" ON "absences" ("classId");

-- Table: academic_analytics_snapshots
CREATE TABLE IF NOT EXISTS "academic_analytics_snapshots" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "periodId" TEXT,
  "scopeType" TEXT NOT NULL,
  "scopeId" TEXT,
  "dataJson" TEXT NOT NULL,
  "calculatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_academic_analytics_snapshots_tenantId" ON "academic_analytics_snapshots" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_academic_analytics_snapshots_academicYearId" ON "academic_analytics_snapshots" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_academic_analytics_snapshots_periodId" ON "academic_analytics_snapshots" ("periodId");
CREATE INDEX IF NOT EXISTS "idx_academic_analytics_snapshots_scopeId" ON "academic_analytics_snapshots" ("scopeId");

-- Table: academic_audit_logs
CREATE TABLE IF NOT EXISTS "academic_audit_logs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "action" TEXT NOT NULL,
  "oldValue" TEXT,
  "newValue" TEXT,
  "performedById" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_academic_audit_logs_tenantId" ON "academic_audit_logs" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_academic_audit_logs_academicYearId" ON "academic_audit_logs" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_academic_audit_logs_entityId" ON "academic_audit_logs" ("entityId");
CREATE INDEX IF NOT EXISTS "idx_academic_audit_logs_performedById" ON "academic_audit_logs" ("performedById");

-- Table: academic_decision_rules
CREATE TABLE IF NOT EXISTS "academic_decision_rules" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "minAverage" REAL,
  "maxAverage" REAL,
  "requiresCouncil" INTEGER NOT NULL DEFAULT 1,
  "isPositive" INTEGER NOT NULL DEFAULT 0,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_academic_decision_rules_tenantId" ON "academic_decision_rules" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_academic_decision_rules_academicYearId" ON "academic_decision_rules" ("academicYearId");

-- Table: academic_mention_rules
CREATE TABLE IF NOT EXISTS "academic_mention_rules" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "name" TEXT NOT NULL,
  "minAverage" REAL NOT NULL,
  "maxAverage" REAL NOT NULL,
  "appreciation" TEXT,
  "language" TEXT NOT NULL,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_academic_mention_rules_tenantId" ON "academic_mention_rules" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_academic_mention_rules_academicYearId" ON "academic_mention_rules" ("academicYearId");

-- Table: academic_periods
CREATE TABLE IF NOT EXISTS "academic_periods" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "periodOrder" INTEGER NOT NULL,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT NOT NULL,
  "isActive" INTEGER NOT NULL DEFAULT 0,
  "isClosed" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_academic_periods_tenantId" ON "academic_periods" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_academic_periods_academicYearId" ON "academic_periods" ("academicYearId");

-- Table: academic_settings_audit_logs
CREATE TABLE IF NOT EXISTS "academic_settings_audit_logs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "settingsId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "field" TEXT,
  "oldValue" TEXT,
  "newValue" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_academic_settings_audit_logs_tenantId" ON "academic_settings_audit_logs" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_academic_settings_audit_logs_settingsId" ON "academic_settings_audit_logs" ("settingsId");
CREATE INDEX IF NOT EXISTS "idx_academic_settings_audit_logs_userId" ON "academic_settings_audit_logs" ("userId");

-- Table: academic_tracks
CREATE TABLE IF NOT EXISTS "academic_tracks" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "isDefault" INTEGER NOT NULL DEFAULT 0,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_academic_tracks_tenantId" ON "academic_tracks" ("tenantId");

-- Table: academic_year_closures
CREATE TABLE IF NOT EXISTS "academic_year_closures" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "closedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "closedBy" TEXT NOT NULL,
  "isLocked" INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS "idx_academic_year_closures_tenantId" ON "academic_year_closures" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_academic_year_closures_academicYearId" ON "academic_year_closures" ("academicYearId");

-- Table: academic_years
CREATE TABLE IF NOT EXISTS "academic_years" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "preEntryDate" TEXT,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT NOT NULL,
  "isActive" INTEGER NOT NULL DEFAULT 0,
  "isAutoGenerated" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "officialStartDate" TEXT,
  "isClosed" INTEGER NOT NULL DEFAULT 0,
  "createdBy" TEXT,
  "closedAt" TEXT,
  "closedBy" TEXT,
  "subscription_id" TEXT,
  "admissionOpenDate" TEXT,
  "admissionCloseDate" TEXT,
  "admissionEnabled" INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS "idx_academic_years_tenantId" ON "academic_years" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_academic_years_subscription_id" ON "academic_years" ("subscription_id");

-- Table: account_breakdowns
CREATE TABLE IF NOT EXISTS "account_breakdowns" (
  "id" TEXT PRIMARY KEY,
  "studentAccountId" TEXT NOT NULL,
  "feeStructureId" TEXT NOT NULL,
  "initialAmount" REAL NOT NULL,
  "adjustedAmount" REAL NOT NULL,
  "paidAmount" REAL NOT NULL DEFAULT 0,
  "remainingAmount" REAL NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_account_breakdowns_studentAccountId" ON "account_breakdowns" ("studentAccountId");
CREATE INDEX IF NOT EXISTS "idx_account_breakdowns_feeStructureId" ON "account_breakdowns" ("feeStructureId");

-- Table: activity_logs
CREATE TABLE IF NOT EXISTS "activity_logs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "schoolLevelId" TEXT,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "resource" TEXT,
  "resourceId" TEXT,
  "details" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_activity_logs_tenantId" ON "activity_logs" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_activity_logs_academicYearId" ON "activity_logs" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_activity_logs_schoolLevelId" ON "activity_logs" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_activity_logs_userId" ON "activity_logs" ("userId");
CREATE INDEX IF NOT EXISTS "idx_activity_logs_resourceId" ON "activity_logs" ("resourceId");

-- Table: administrative_seal_usages
CREATE TABLE IF NOT EXISTS "administrative_seal_usages" (
  "id" TEXT PRIMARY KEY,
  "sealVersionId" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "usedBy" TEXT NOT NULL,
  "usedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "schoolId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_administrative_seal_usages_sealVersionId" ON "administrative_seal_usages" ("sealVersionId");
CREATE INDEX IF NOT EXISTS "idx_administrative_seal_usages_documentId" ON "administrative_seal_usages" ("documentId");
CREATE INDEX IF NOT EXISTS "idx_administrative_seal_usages_schoolId" ON "administrative_seal_usages" ("schoolId");
CREATE INDEX IF NOT EXISTS "idx_administrative_seal_usages_academicYearId" ON "administrative_seal_usages" ("academicYearId");

-- Table: administrative_seal_versions
CREATE TABLE IF NOT EXISTS "administrative_seal_versions" (
  "id" TEXT PRIMARY KEY,
  "sealId" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "primaryColor" TEXT,
  "secondaryColor" TEXT,
  "shape" TEXT NOT NULL,
  "logoUrl" TEXT,
  "signatureUrl" TEXT,
  "textLayout" TEXT,
  "fontFamily" TEXT,
  "fontWeight" TEXT,
  "fontSize" TEXT,
  "borderStyle" TEXT,
  "borderThickness" INTEGER,
  "innerSymbols" TEXT,
  "rotation" INTEGER NOT NULL DEFAULT 0,
  "opacity" INTEGER NOT NULL DEFAULT 100,
  "generatedFileUrl" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL DEFAULT 1,
  "createdBy" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_administrative_seal_versions_sealId" ON "administrative_seal_versions" ("sealId");

-- Table: administrative_seals
CREATE TABLE IF NOT EXISTS "administrative_seals" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "role" TEXT,
  "holderName" TEXT,
  "holderTitle" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "validFrom" TEXT,
  "validTo" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_administrative_seals_tenantId" ON "administrative_seals" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_administrative_seals_schoolId" ON "administrative_seals" ("schoolId");
CREATE INDEX IF NOT EXISTS "idx_administrative_seals_academicYearId" ON "administrative_seals" ("academicYearId");

-- Table: admission_documents
CREATE TABLE IF NOT EXISTS "admission_documents" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "admissionId" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "fileName" TEXT,
  "filePath" TEXT,
  "mimeType" TEXT,
  "fileSize" INTEGER,
  "status" TEXT NOT NULL,
  "expiresAt" TEXT,
  "validatedById" TEXT,
  "validatedAt" TEXT,
  "comment" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_admission_documents_tenantId" ON "admission_documents" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_admission_documents_admissionId" ON "admission_documents" ("admissionId");
CREATE INDEX IF NOT EXISTS "idx_admission_documents_validatedById" ON "admission_documents" ("validatedById");

-- Table: admission_interviews
CREATE TABLE IF NOT EXISTS "admission_interviews" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "admissionId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "scheduledAt" TEXT,
  "conductedAt" TEXT,
  "responsibleId" TEXT,
  "result" TEXT,
  "score" REAL,
  "comment" TEXT,
  "recommendation" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_admission_interviews_tenantId" ON "admission_interviews" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_admission_interviews_admissionId" ON "admission_interviews" ("admissionId");
CREATE INDEX IF NOT EXISTS "idx_admission_interviews_responsibleId" ON "admission_interviews" ("responsibleId");

-- Table: admissions
CREATE TABLE IF NOT EXISTS "admissions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "dateOfBirth" TEXT,
  "gender" TEXT,
  "status" TEXT NOT NULL,
  "applicationDate" TEXT NOT NULL DEFAULT (datetime('now')),
  "decisionDate" TEXT,
  "decisionBy" TEXT,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "birthPlace" TEXT,
  "nationality" TEXT,
  "address" TEXT,
  "requestedClassId" TEXT,
  "requestedSeriesId" TEXT,
  "wantsBilingual" INTEGER NOT NULL DEFAULT 0,
  "previousSchool" TEXT,
  "mainGuardianName" TEXT,
  "mainGuardianPhone" TEXT,
  "mainGuardianEmail" TEXT,
  "admissionNumber" TEXT,
  "convertedStudentId" TEXT,
  "createdByUserId" TEXT,
  "interviewDate" TEXT,
  "testDate" TEXT,
  "testScore" REAL,
  "mainGuardianRelationship" TEXT,
  "previousLevel" TEXT,
  "changeReason" TEXT,
  "mainGuardianAddress" TEXT,
  "mainGuardianProfession" TEXT,
  "reviewComment" TEXT,
  "decisionComment" TEXT,
  "convertedAt" TEXT,
  "metadata" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "previousArrears" REAL NOT NULL DEFAULT 0,
  "isNewStudent" INTEGER NOT NULL DEFAULT 1,
  "requestedAcademicClassId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_admissions_tenantId" ON "admissions" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_admissions_academicYearId" ON "admissions" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_admissions_schoolLevelId" ON "admissions" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_admissions_requestedClassId" ON "admissions" ("requestedClassId");
CREATE INDEX IF NOT EXISTS "idx_admissions_requestedSeriesId" ON "admissions" ("requestedSeriesId");
CREATE INDEX IF NOT EXISTS "idx_admissions_convertedStudentId" ON "admissions" ("convertedStudentId");
CREATE INDEX IF NOT EXISTS "idx_admissions_createdByUserId" ON "admissions" ("createdByUserId");
CREATE INDEX IF NOT EXISTS "idx_admissions_createdById" ON "admissions" ("createdById");
CREATE INDEX IF NOT EXISTS "idx_admissions_updatedById" ON "admissions" ("updatedById");
CREATE INDEX IF NOT EXISTS "idx_admissions_requestedAcademicClassId" ON "admissions" ("requestedAcademicClassId");

-- Table: allowance_types
CREATE TABLE IF NOT EXISTS "allowance_types" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "isTaxable" INTEGER NOT NULL DEFAULT 1,
  "isCnss" INTEGER NOT NULL DEFAULT 0,
  "amount" REAL,
  "isFixed" INTEGER NOT NULL DEFAULT 1,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_allowance_types_tenantId" ON "allowance_types" ("tenantId");

-- Table: announcements
CREATE TABLE IF NOT EXISTS "announcements" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "publishedAt" TEXT,
  "expiresAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "attachments" TEXT,
  "classId" TEXT,
  "content" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "isPinned" INTEGER NOT NULL DEFAULT 0,
  "metadata" TEXT,
  "requiresAcknowledgment" INTEGER NOT NULL DEFAULT 0,
  "schoolLevelId" TEXT NOT NULL,
  "target" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_announcements_tenantId" ON "announcements" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_announcements_classId" ON "announcements" ("classId");
CREATE INDEX IF NOT EXISTS "idx_announcements_schoolLevelId" ON "announcements" ("schoolLevelId");

-- Table: annual_teacher_supplies
CREATE TABLE IF NOT EXISTS "annual_teacher_supplies" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "classId" TEXT,
  "materialId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_annual_teacher_supplies_tenantId" ON "annual_teacher_supplies" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_annual_teacher_supplies_academicYearId" ON "annual_teacher_supplies" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_annual_teacher_supplies_teacherId" ON "annual_teacher_supplies" ("teacherId");
CREATE INDEX IF NOT EXISTS "idx_annual_teacher_supplies_schoolLevelId" ON "annual_teacher_supplies" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_annual_teacher_supplies_classId" ON "annual_teacher_supplies" ("classId");
CREATE INDEX IF NOT EXISTS "idx_annual_teacher_supplies_materialId" ON "annual_teacher_supplies" ("materialId");

-- Table: app_releases
CREATE TABLE IF NOT EXISTS "app_releases" (
  "id" TEXT PRIMARY KEY,
  "version" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "arch" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "file_size" INTEGER NOT NULL,
  "download_url" TEXT NOT NULL,
  "checksum_sha256" TEXT,
  "release_channel" TEXT NOT NULL,
  "is_latest" INTEGER NOT NULL DEFAULT 0,
  "release_notes" TEXT,
  "min_os_version" TEXT,
  "uploaded_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);


-- Table: arrear_transfers
CREATE TABLE IF NOT EXISTS "arrear_transfers" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "studentAccountId" TEXT NOT NULL,
  "fromAcademicYearId" TEXT NOT NULL,
  "toAcademicYearId" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "feeArrearId" TEXT,
  "transferredAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "transferredBy" TEXT,
  "notes" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_arrear_transfers_tenantId" ON "arrear_transfers" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_arrear_transfers_studentId" ON "arrear_transfers" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_arrear_transfers_studentAccountId" ON "arrear_transfers" ("studentAccountId");
CREATE INDEX IF NOT EXISTS "idx_arrear_transfers_fromAcademicYearId" ON "arrear_transfers" ("fromAcademicYearId");
CREATE INDEX IF NOT EXISTS "idx_arrear_transfers_toAcademicYearId" ON "arrear_transfers" ("toAcademicYearId");
CREATE INDEX IF NOT EXISTS "idx_arrear_transfers_feeArrearId" ON "arrear_transfers" ("feeArrearId");

-- Table: atlas_conversations
CREATE TABLE IF NOT EXISTS "atlas_conversations" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "schoolLevelId" TEXT,
  "userId" TEXT NOT NULL,
  "title" TEXT,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_atlas_conversations_tenantId" ON "atlas_conversations" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_atlas_conversations_academicYearId" ON "atlas_conversations" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_atlas_conversations_schoolLevelId" ON "atlas_conversations" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_atlas_conversations_userId" ON "atlas_conversations" ("userId");

-- Table: atlas_feedback
CREATE TABLE IF NOT EXISTS "atlas_feedback" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "schoolLevelId" TEXT,
  "messageId" TEXT,
  "conversationId" TEXT,
  "rating" INTEGER,
  "comment" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_atlas_feedback_tenantId" ON "atlas_feedback" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_atlas_feedback_academicYearId" ON "atlas_feedback" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_atlas_feedback_schoolLevelId" ON "atlas_feedback" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_atlas_feedback_messageId" ON "atlas_feedback" ("messageId");
CREATE INDEX IF NOT EXISTS "idx_atlas_feedback_conversationId" ON "atlas_feedback" ("conversationId");

-- Table: atlas_messages
CREATE TABLE IF NOT EXISTS "atlas_messages" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "schoolLevelId" TEXT,
  "conversationId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_atlas_messages_tenantId" ON "atlas_messages" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_atlas_messages_academicYearId" ON "atlas_messages" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_atlas_messages_schoolLevelId" ON "atlas_messages" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_atlas_messages_conversationId" ON "atlas_messages" ("conversationId");

-- Table: atlas_settings
CREATE TABLE IF NOT EXISTS "atlas_settings" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "isEnabled" INTEGER NOT NULL DEFAULT 0,
  "scope" TEXT NOT NULL,
  "allowedModules" TEXT,
  "allowHumanHandoff" INTEGER NOT NULL DEFAULT 1,
  "conversationHistoryDays" INTEGER NOT NULL DEFAULT 90,
  "maxConversationsPerDay" INTEGER,
  "language" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_atlas_settings_tenantId" ON "atlas_settings" ("tenantId");

-- Table: attendance_records
CREATE TABLE IF NOT EXISTS "attendance_records" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "classId" TEXT,
  "date" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "notes" TEXT,
  "recordedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_attendance_records_tenantId" ON "attendance_records" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_attendance_records_academicYearId" ON "attendance_records" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_attendance_records_schoolLevelId" ON "attendance_records" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_attendance_records_studentId" ON "attendance_records" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_attendance_records_classId" ON "attendance_records" ("classId");

-- Table: attendance_registers
CREATE TABLE IF NOT EXISTS "attendance_registers" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "month" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "studentsData" TEXT NOT NULL,
  "demiJourneeMois" INTEGER,
  "presencePossibleMois" INTEGER,
  "totalAbsencesMois" INTEGER,
  "totalPresencesEffectivesMois" INTEGER,
  "pourcentagePresences" REAL,
  "pourcentageAbsences" REAL,
  "arreteDate" TEXT,
  "arreteHeure" TEXT,
  "effectifJourFilles" INTEGER,
  "effectifJourGarcons" INTEGER,
  "directeurSignatureDate" TEXT,
  "titulaireSignatureDate" TEXT,
  "status" TEXT NOT NULL,
  "submittedAt" TEXT,
  "validatedAt" TEXT,
  "validatedBy" TEXT,
  "rejectionReason" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "teacherSignature" TEXT,
  "directorSignature" TEXT,
  "holidays" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_attendance_registers_tenantId" ON "attendance_registers" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_attendance_registers_academicYearId" ON "attendance_registers" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_attendance_registers_classId" ON "attendance_registers" ("classId");
CREATE INDEX IF NOT EXISTS "idx_attendance_registers_teacherId" ON "attendance_registers" ("teacherId");

-- Table: audit_logs
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "resourceId" TEXT,
  "tableName" TEXT NOT NULL,
  "recordId" TEXT,
  "oldData" TEXT,
  "newData" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "changes" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "tenant_id" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_audit_logs_userId" ON "audit_logs" ("userId");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_resourceId" ON "audit_logs" ("resourceId");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_recordId" ON "audit_logs" ("recordId");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_tenant_id" ON "audit_logs" ("tenant_id");

-- Table: auth_audit_logs
CREATE TABLE IF NOT EXISTS "auth_audit_logs" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT,
  "tenantId" TEXT,
  "deviceId" TEXT,
  "sessionId" TEXT,
  "action" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "status" TEXT NOT NULL,
  "reason" TEXT,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_auth_audit_logs_userId" ON "auth_audit_logs" ("userId");
CREATE INDEX IF NOT EXISTS "idx_auth_audit_logs_tenantId" ON "auth_audit_logs" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_auth_audit_logs_deviceId" ON "auth_audit_logs" ("deviceId");
CREATE INDEX IF NOT EXISTS "idx_auth_audit_logs_sessionId" ON "auth_audit_logs" ("sessionId");

-- Table: automated_triggers
CREATE TABLE IF NOT EXISTS "automated_triggers" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "schoolLevelId" TEXT,
  "triggerType" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "templateId" TEXT,
  "conditions" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "lastTriggeredAt" TEXT,
  "triggerCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_automated_triggers_tenantId" ON "automated_triggers" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_automated_triggers_academicYearId" ON "automated_triggers" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_automated_triggers_schoolLevelId" ON "automated_triggers" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_automated_triggers_channelId" ON "automated_triggers" ("channelId");
CREATE INDEX IF NOT EXISTS "idx_automated_triggers_templateId" ON "automated_triggers" ("templateId");

-- Table: automation_executions
CREATE TABLE IF NOT EXISTS "automation_executions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "triggeredAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "status" TEXT NOT NULL,
  "inputPayload" TEXT,
  "actionPayload" TEXT,
  "errorMessage" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_automation_executions_tenantId" ON "automation_executions" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_automation_executions_ruleId" ON "automation_executions" ("ruleId");

-- Table: automation_rules
CREATE TABLE IF NOT EXISTS "automation_rules" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "schoolLevelId" TEXT,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "description" TEXT,
  "condition" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdById" TEXT,
  "approvedById" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_automation_rules_tenantId" ON "automation_rules" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_automation_rules_academicYearId" ON "automation_rules" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_automation_rules_schoolLevelId" ON "automation_rules" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_automation_rules_createdById" ON "automation_rules" ("createdById");
CREATE INDEX IF NOT EXISTS "idx_automation_rules_approvedById" ON "automation_rules" ("approvedById");

-- Table: bilingual_pedagogy_policies
CREATE TABLE IF NOT EXISTS "bilingual_pedagogy_policies" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "isEnabled" INTEGER NOT NULL DEFAULT 0,
  "allowFrenchSubjects" INTEGER NOT NULL DEFAULT 1,
  "allowEnglishSubjects" INTEGER NOT NULL DEFAULT 1,
  "allowBilingualSubjects" INTEGER NOT NULL DEFAULT 1,
  "separateLanguageAverages" INTEGER NOT NULL DEFAULT 0,
  "showLanguageSectionsOnBulletin" INTEGER NOT NULL DEFAULT 1,
  "allowBilingualAppreciations" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_bilingual_pedagogy_policies_tenantId" ON "bilingual_pedagogy_policies" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_bilingual_pedagogy_policies_academicYearId" ON "bilingual_pedagogy_policies" ("academicYearId");

-- Table: billing_events
CREATE TABLE IF NOT EXISTS "billing_events" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "subscription_id" TEXT,
  "type" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "channel" TEXT NOT NULL,
  "reference" TEXT,
  "metadata" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_billing_events_tenant_id" ON "billing_events" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_billing_events_subscription_id" ON "billing_events" ("subscription_id");

-- Table: billing_reminder_logs
CREATE TABLE IF NOT EXISTS "billing_reminder_logs" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "subscription_id" TEXT NOT NULL,
  "reminder_type" TEXT NOT NULL,
  "days_remaining" INTEGER NOT NULL,
  "sent_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "channels" TEXT NOT NULL,
  "success" INTEGER NOT NULL DEFAULT 1,
  "error_message" TEXT,
  "metadata" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_billing_reminder_logs_tenant_id" ON "billing_reminder_logs" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_billing_reminder_logs_subscription_id" ON "billing_reminder_logs" ("subscription_id");

-- Table: blog_articles
CREATE TABLE IF NOT EXISTS "blog_articles" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "excerpt" TEXT,
  "content" TEXT,
  "coverImageUrl" TEXT,
  "category" TEXT,
  "tags" TEXT,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "status" TEXT NOT NULL,
  "publishedAt" TEXT,
  "authorId" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_blog_articles_authorId" ON "blog_articles" ("authorId");

-- Table: bulletin_publication_policies
CREATE TABLE IF NOT EXISTS "bulletin_publication_policies" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "requireGradeValidation" INTEGER NOT NULL DEFAULT 1,
  "requireClassCouncil" INTEGER NOT NULL DEFAULT 1,
  "requireDirectorApproval" INTEGER NOT NULL DEFAULT 1,
  "blockIfFinanceDebt" INTEGER NOT NULL DEFAULT 0,
  "allowParentDownload" INTEGER NOT NULL DEFAULT 1,
  "allowStudentDownload" INTEGER NOT NULL DEFAULT 0,
  "publicationMode" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_bulletin_publication_policies_tenantId" ON "bulletin_publication_policies" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_bulletin_publication_policies_academicYearId" ON "bulletin_publication_policies" ("academicYearId");

-- Table: bulletin_templates
CREATE TABLE IF NOT EXISTS "bulletin_templates" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "levelId" TEXT,
  "classId" TEXT,
  "seriesId" TEXT,
  "language" TEXT NOT NULL,
  "layoutJson" TEXT NOT NULL,
  "isDefault" INTEGER NOT NULL DEFAULT 0,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdById" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_bulletin_templates_tenantId" ON "bulletin_templates" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_bulletin_templates_levelId" ON "bulletin_templates" ("levelId");
CREATE INDEX IF NOT EXISTS "idx_bulletin_templates_classId" ON "bulletin_templates" ("classId");
CREATE INDEX IF NOT EXISTS "idx_bulletin_templates_seriesId" ON "bulletin_templates" ("seriesId");
CREATE INDEX IF NOT EXISTS "idx_bulletin_templates_createdById" ON "bulletin_templates" ("createdById");

-- Table: bulletins
CREATE TABLE IF NOT EXISTS "bulletins" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "bulletinNumber" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "averageSnapshot" TEXT NOT NULL,
  "decisionSnapshot" TEXT,
  "pdfUrl" TEXT,
  "qrToken" TEXT,
  "generatedById" TEXT,
  "generatedAt" TEXT,
  "publishedById" TEXT,
  "publishedAt" TEXT,
  "isLocked" INTEGER NOT NULL DEFAULT 0,
  "templateId" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_bulletins_tenantId" ON "bulletins" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_bulletins_academicYearId" ON "bulletins" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_bulletins_periodId" ON "bulletins" ("periodId");
CREATE INDEX IF NOT EXISTS "idx_bulletins_studentId" ON "bulletins" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_bulletins_classId" ON "bulletins" ("classId");
CREATE INDEX IF NOT EXISTS "idx_bulletins_generatedById" ON "bulletins" ("generatedById");
CREATE INDEX IF NOT EXISTS "idx_bulletins_publishedById" ON "bulletins" ("publishedById");
CREATE INDEX IF NOT EXISTS "idx_bulletins_templateId" ON "bulletins" ("templateId");

-- Table: cahier_de_textes
CREATE TABLE IF NOT EXISTS "cahier_de_textes" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "subjectId" TEXT,
  "schoolName" TEXT,
  "className" TEXT,
  "academicYearLabel" TEXT,
  "trimester" INTEGER NOT NULL,
  "testTitle" TEXT NOT NULL,
  "testDate" TEXT,
  "durationMinutes" INTEGER,
  "teacherName" TEXT,
  "maxScore" REAL NOT NULL DEFAULT 20.0,
  "passingScore" REAL NOT NULL DEFAULT 10.0,
  "coefficient" REAL NOT NULL DEFAULT 1.0,
  "studentScores" TEXT NOT NULL,
  "totalStudents" INTEGER,
  "totalPresent" INTEGER,
  "totalAbsent" INTEGER,
  "averageScore" REAL,
  "highestScore" REAL,
  "lowestScore" REAL,
  "passedCount" INTEGER,
  "failedCount" INTEGER,
  "passRate" REAL,
  "boysCount" INTEGER,
  "girlsCount" INTEGER,
  "boysAverage" REAL,
  "girlsAverage" REAL,
  "boysPassed" INTEGER,
  "girlsPassed" INTEGER,
  "pedagogicalObservations" TEXT,
  "recommandations" TEXT,
  "teacherSignature" TEXT,
  "directorSignature" TEXT,
  "status" TEXT NOT NULL,
  "submittedAt" TEXT,
  "validatedAt" TEXT,
  "validatedBy" TEXT,
  "rejectionReason" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "testType" TEXT NOT NULL,
  "testNumber" INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_cahier_de_textes_tenantId" ON "cahier_de_textes" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_cahier_de_textes_academicYearId" ON "cahier_de_textes" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_cahier_de_textes_teacherId" ON "cahier_de_textes" ("teacherId");
CREATE INDEX IF NOT EXISTS "idx_cahier_de_textes_classId" ON "cahier_de_textes" ("classId");
CREATE INDEX IF NOT EXISTS "idx_cahier_de_textes_subjectId" ON "cahier_de_textes" ("subjectId");

-- Table: cahier_journal_entries
CREATE TABLE IF NOT EXISTS "cahier_journal_entries" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "weekStartDate" TEXT NOT NULL,
  "weekEndDate" TEXT NOT NULL,
  "className" TEXT,
  "entries" TEXT NOT NULL,
  "observations" TEXT,
  "directorName" TEXT,
  "directorValidatedAt" TEXT,
  "status" TEXT NOT NULL,
  "submittedAt" TEXT,
  "validatedAt" TEXT,
  "validatedBy" TEXT,
  "rejectionReason" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "teacherSignature" TEXT,
  "directorSignature" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_cahier_journal_entries_tenantId" ON "cahier_journal_entries" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_cahier_journal_entries_academicYearId" ON "cahier_journal_entries" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_cahier_journal_entries_teacherId" ON "cahier_journal_entries" ("teacherId");
CREATE INDEX IF NOT EXISTS "idx_cahier_journal_entries_classId" ON "cahier_journal_entries" ("classId");

-- Table: canteen_allergies
CREATE TABLE IF NOT EXISTS "canteen_allergies" (
  "id" TEXT PRIMARY KEY,
  "allergen" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "academicYearId" TEXT,
  "emergencyContact" TEXT,
  "forbiddenFoods" TEXT,
  "instructions" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "medicalDocUrl" TEXT,
  "studentId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_canteen_allergies_academicYearId" ON "canteen_allergies" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_canteen_allergies_studentId" ON "canteen_allergies" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_canteen_allergies_tenantId" ON "canteen_allergies" ("tenantId");

-- Table: canteen_attendances
CREATE TABLE IF NOT EXISTS "canteen_attendances" (
  "id" TEXT PRIMARY KEY,
  "enrollmentId" TEXT NOT NULL,
  "mealType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "notes" TEXT,
  "recordedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "academicYearId" TEXT,
  "attendanceDate" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_canteen_attendances_enrollmentId" ON "canteen_attendances" ("enrollmentId");
CREATE INDEX IF NOT EXISTS "idx_canteen_attendances_academicYearId" ON "canteen_attendances" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_canteen_attendances_tenantId" ON "canteen_attendances" ("tenantId");

-- Table: canteen_diets
CREATE TABLE IF NOT EXISTS "canteen_diets" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "forbiddenFoods" TEXT,
  "instructions" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "academicYearId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_canteen_diets_tenantId" ON "canteen_diets" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_canteen_diets_academicYearId" ON "canteen_diets" ("academicYearId");

-- Table: canteen_enrollments
CREATE TABLE IF NOT EXISTS "canteen_enrollments" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "schoolLevelId" TEXT,
  "classId" TEXT,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "activeDays" TEXT,
  "dietId" TEXT,
  "observations" TEXT,
  "paymentStatus" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "subscriptionId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_canteen_enrollments_tenantId" ON "canteen_enrollments" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_canteen_enrollments_academicYearId" ON "canteen_enrollments" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_canteen_enrollments_studentId" ON "canteen_enrollments" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_canteen_enrollments_schoolLevelId" ON "canteen_enrollments" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_canteen_enrollments_classId" ON "canteen_enrollments" ("classId");
CREATE INDEX IF NOT EXISTS "idx_canteen_enrollments_dietId" ON "canteen_enrollments" ("dietId");
CREATE INDEX IF NOT EXISTS "idx_canteen_enrollments_subscriptionId" ON "canteen_enrollments" ("subscriptionId");

-- Table: canteen_food_stocks
CREATE TABLE IF NOT EXISTS "canteen_food_stocks" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "quantity" REAL NOT NULL,
  "unit" TEXT NOT NULL,
  "alertThreshold" REAL NOT NULL,
  "location" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "academicYearId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_canteen_food_stocks_tenantId" ON "canteen_food_stocks" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_canteen_food_stocks_academicYearId" ON "canteen_food_stocks" ("academicYearId");

-- Table: canteen_incidents
CREATE TABLE IF NOT EXISTS "canteen_incidents" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "enrollmentId" TEXT,
  "date" TEXT NOT NULL DEFAULT (datetime('now')),
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "immediateAction" TEXT,
  "correctiveMeasure" TEXT,
  "isParentInformed" INTEGER NOT NULL DEFAULT 0,
  "isStaffInformed" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL,
  "attachmentUrl" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_canteen_incidents_tenantId" ON "canteen_incidents" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_canteen_incidents_academicYearId" ON "canteen_incidents" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_canteen_incidents_enrollmentId" ON "canteen_incidents" ("enrollmentId");

-- Table: canteen_meal_services
CREATE TABLE IF NOT EXISTS "canteen_meal_services" (
  "id" TEXT PRIMARY KEY,
  "enrollmentId" TEXT NOT NULL,
  "menuId" TEXT NOT NULL,
  "serviceDate" TEXT NOT NULL,
  "serviceHour" TEXT,
  "status" TEXT NOT NULL,
  "isSpecialMeal" INTEGER NOT NULL DEFAULT 0,
  "recordedBy" TEXT,
  "observation" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "tenantId" TEXT,
  "academicYearId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_canteen_meal_services_enrollmentId" ON "canteen_meal_services" ("enrollmentId");
CREATE INDEX IF NOT EXISTS "idx_canteen_meal_services_menuId" ON "canteen_meal_services" ("menuId");
CREATE INDEX IF NOT EXISTS "idx_canteen_meal_services_tenantId" ON "canteen_meal_services" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_canteen_meal_services_academicYearId" ON "canteen_meal_services" ("academicYearId");

-- Table: canteen_menus
CREATE TABLE IF NOT EXISTS "canteen_menus" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "accompaniment" TEXT,
  "allergens" TEXT,
  "beverage" TEXT,
  "date" TEXT NOT NULL,
  "dessert" TEXT,
  "entry" TEXT,
  "estimatedCost" REAL,
  "imageUrl" TEXT,
  "mainPlate" TEXT NOT NULL,
  "nutritionValue" TEXT,
  "observation" TEXT,
  "period" TEXT,
  "schoolLevelId" TEXT,
  "status" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_canteen_menus_tenantId" ON "canteen_menus" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_canteen_menus_academicYearId" ON "canteen_menus" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_canteen_menus_schoolLevelId" ON "canteen_menus" ("schoolLevelId");

-- Table: canteen_payments
CREATE TABLE IF NOT EXISTS "canteen_payments" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "discount" REAL NOT NULL DEFAULT 0,
  "penalty" REAL NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL,
  "paymentMode" TEXT,
  "paymentDate" TEXT,
  "period" TEXT,
  "invoiceUrl" TEXT,
  "receiptUrl" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "schoolLevelId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_canteen_payments_tenantId" ON "canteen_payments" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_canteen_payments_enrollmentId" ON "canteen_payments" ("enrollmentId");
CREATE INDEX IF NOT EXISTS "idx_canteen_payments_schoolLevelId" ON "canteen_payments" ("schoolLevelId");

-- Table: canteen_purchase_orders
CREATE TABLE IF NOT EXISTS "canteen_purchase_orders" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "orderDate" TEXT NOT NULL DEFAULT (datetime('now')),
  "deliveryDate" TEXT,
  "totalAmount" REAL NOT NULL,
  "status" TEXT NOT NULL,
  "items" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_canteen_purchase_orders_tenantId" ON "canteen_purchase_orders" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_canteen_purchase_orders_academicYearId" ON "canteen_purchase_orders" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_canteen_purchase_orders_supplierId" ON "canteen_purchase_orders" ("supplierId");

-- Table: canteen_reports
CREATE TABLE IF NOT EXISTS "canteen_reports" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "parameters" TEXT,
  "data" TEXT,
  "generatedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "academicYearId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_canteen_reports_tenantId" ON "canteen_reports" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_canteen_reports_academicYearId" ON "canteen_reports" ("academicYearId");

-- Table: canteen_settings
CREATE TABLE IF NOT EXISTS "canteen_settings" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "mealTimes" TEXT,
  "isParentVisible" INTEGER NOT NULL DEFAULT 1,
  "notifyOnLowStock" INTEGER NOT NULL DEFAULT 1,
  "stockAlertLevel" REAL NOT NULL DEFAULT 10,
  "allowedPaymentModes" TEXT,
  "updatedAt" TEXT NOT NULL,
  "academicYearId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_canteen_settings_tenantId" ON "canteen_settings" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_canteen_settings_academicYearId" ON "canteen_settings" ("academicYearId");

-- Table: canteen_stock_movements
CREATE TABLE IF NOT EXISTS "canteen_stock_movements" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "stockId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "quantity" REAL NOT NULL,
  "unitPrice" REAL,
  "date" TEXT NOT NULL DEFAULT (datetime('now')),
  "expiryDate" TEXT,
  "supplierId" TEXT,
  "recordedBy" TEXT,
  "reference" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "academicYearId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_canteen_stock_movements_tenantId" ON "canteen_stock_movements" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_canteen_stock_movements_stockId" ON "canteen_stock_movements" ("stockId");
CREATE INDEX IF NOT EXISTS "idx_canteen_stock_movements_supplierId" ON "canteen_stock_movements" ("supplierId");
CREATE INDEX IF NOT EXISTS "idx_canteen_stock_movements_academicYearId" ON "canteen_stock_movements" ("academicYearId");

-- Table: canteen_subscriptions
CREATE TABLE IF NOT EXISTS "canteen_subscriptions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "price" REAL NOT NULL,
  "description" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "academicYearId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_canteen_subscriptions_tenantId" ON "canteen_subscriptions" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_canteen_subscriptions_academicYearId" ON "canteen_subscriptions" ("academicYearId");

-- Table: canteen_suppliers
CREATE TABLE IF NOT EXISTS "canteen_suppliers" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contactName" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "suppliedProducts" TEXT,
  "paymentTerms" TEXT,
  "qualityRating" INTEGER DEFAULT 5,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "academicYearId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_canteen_suppliers_tenantId" ON "canteen_suppliers" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_canteen_suppliers_academicYearId" ON "canteen_suppliers" ("academicYearId");

-- Table: card_design_templates
CREATE TABLE IF NOT EXISTS "card_design_templates" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "layout" TEXT NOT NULL,
  "isSystem" INTEGER NOT NULL DEFAULT 0,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_card_design_templates_tenantId" ON "card_design_templates" ("tenantId");

-- Table: cash_closures
CREATE TABLE IF NOT EXISTS "cash_closures" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "closureDate" TEXT NOT NULL,
  "openingBalance" REAL NOT NULL,
  "closingBalance" REAL NOT NULL,
  "totalIncome" REAL NOT NULL,
  "totalExpenses" REAL NOT NULL,
  "discrepancy" REAL,
  "notes" TEXT,
  "closedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_cash_closures_tenantId" ON "cash_closures" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_cash_closures_academicYearId" ON "cash_closures" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_cash_closures_schoolLevelId" ON "cash_closures" ("schoolLevelId");

-- Table: cash_register_transactions
CREATE TABLE IF NOT EXISTS "cash_register_transactions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "cashRegisterId" TEXT NOT NULL,
  "transactionType" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "direction" TEXT NOT NULL,
  "note" TEXT,
  "reference" TEXT,
  "userId" TEXT,
  "relatedTransferId" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_cash_register_transactions_tenantId" ON "cash_register_transactions" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_cash_register_transactions_cashRegisterId" ON "cash_register_transactions" ("cashRegisterId");
CREATE INDEX IF NOT EXISTS "idx_cash_register_transactions_userId" ON "cash_register_transactions" ("userId");
CREATE INDEX IF NOT EXISTS "idx_cash_register_transactions_relatedTransferId" ON "cash_register_transactions" ("relatedTransferId");

-- Table: cash_register_transfers
CREATE TABLE IF NOT EXISTS "cash_register_transfers" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "fromCashRegisterId" TEXT NOT NULL,
  "toCashRegisterId" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "note" TEXT,
  "reference" TEXT,
  "userId" TEXT,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_cash_register_transfers_tenantId" ON "cash_register_transfers" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_cash_register_transfers_fromCashRegisterId" ON "cash_register_transfers" ("fromCashRegisterId");
CREATE INDEX IF NOT EXISTS "idx_cash_register_transfers_toCashRegisterId" ON "cash_register_transfers" ("toCashRegisterId");
CREATE INDEX IF NOT EXISTS "idx_cash_register_transfers_userId" ON "cash_register_transfers" ("userId");

-- Table: cash_registers
CREATE TABLE IF NOT EXISTS "cash_registers" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "code" TEXT NOT NULL,
  "description" TEXT,
  "responsibleUserId" TEXT,
  "location" TEXT,
  "openingBalance" REAL DEFAULT 0,
  "currentBalance" REAL DEFAULT 0,
  "isOpen" INTEGER DEFAULT 0,
  "openedAt" TEXT,
  "openedByUserId" TEXT,
  "closedAt" TEXT,
  "closedByUserId" TEXT,
  "updatedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "bankName" TEXT,
  "bankAccountNumber" TEXT,
  "bankIBAN" TEXT,
  "bankBranch" TEXT,
  "bankAccountType" TEXT,
  "bankContact" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_cash_registers_tenantId" ON "cash_registers" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_cash_registers_responsibleUserId" ON "cash_registers" ("responsibleUserId");
CREATE INDEX IF NOT EXISTS "idx_cash_registers_openedByUserId" ON "cash_registers" ("openedByUserId");
CREATE INDEX IF NOT EXISTS "idx_cash_registers_closedByUserId" ON "cash_registers" ("closedByUserId");

-- Table: certified_electronic_signatures
CREATE TABLE IF NOT EXISTS "certified_electronic_signatures" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "signatureType" TEXT NOT NULL,
  "signatureImageUrl" TEXT,
  "certificateHash" TEXT NOT NULL,
  "publicKey" TEXT,
  "issuedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "expiresAt" TEXT,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_certified_electronic_signatures_tenantId" ON "certified_electronic_signatures" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_certified_electronic_signatures_userId" ON "certified_electronic_signatures" ("userId");

-- Table: class_councils
CREATE TABLE IF NOT EXISTS "class_councils" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "academicTrackId" TEXT,
  "classId" TEXT NOT NULL,
  "quarterId" TEXT,
  "councilDate" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "participants" TEXT,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_class_councils_tenantId" ON "class_councils" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_class_councils_academicYearId" ON "class_councils" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_class_councils_schoolLevelId" ON "class_councils" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_class_councils_academicTrackId" ON "class_councils" ("academicTrackId");
CREATE INDEX IF NOT EXISTS "idx_class_councils_classId" ON "class_councils" ("classId");
CREATE INDEX IF NOT EXISTS "idx_class_councils_quarterId" ON "class_councils" ("quarterId");

-- Table: class_diaries
CREATE TABLE IF NOT EXISTS "class_diaries" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "classSubjectId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "homework" TEXT,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_class_diaries_tenantId" ON "class_diaries" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_class_diaries_academicYearId" ON "class_diaries" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_class_diaries_schoolLevelId" ON "class_diaries" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_class_diaries_classSubjectId" ON "class_diaries" ("classSubjectId");

-- Table: class_students
CREATE TABLE IF NOT EXISTS "class_students" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "enrollmentDate" TEXT NOT NULL,
  "exitDate" TEXT,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_class_students_tenantId" ON "class_students" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_class_students_academicYearId" ON "class_students" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_class_students_schoolLevelId" ON "class_students" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_class_students_classId" ON "class_students" ("classId");
CREATE INDEX IF NOT EXISTS "idx_class_students_studentId" ON "class_students" ("studentId");

-- Table: class_subjects
CREATE TABLE IF NOT EXISTS "class_subjects" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "classId" TEXT,
  "subjectId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "weeklyHours" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "academicClassId" TEXT,
  "coefficient" REAL NOT NULL DEFAULT 1.0
);

CREATE INDEX IF NOT EXISTS "idx_class_subjects_tenantId" ON "class_subjects" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_class_subjects_classId" ON "class_subjects" ("classId");
CREATE INDEX IF NOT EXISTS "idx_class_subjects_subjectId" ON "class_subjects" ("subjectId");
CREATE INDEX IF NOT EXISTS "idx_class_subjects_academicYearId" ON "class_subjects" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_class_subjects_academicClassId" ON "class_subjects" ("academicClassId");

-- Table: class_transfers
CREATE TABLE IF NOT EXISTS "class_transfers" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "fromClassId" TEXT,
  "toClassId" TEXT,
  "transferDate" TEXT NOT NULL,
  "reason" TEXT,
  "approvedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "transferType" TEXT NOT NULL,
  "fromSeriesId" TEXT,
  "toSeriesId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_class_transfers_tenantId" ON "class_transfers" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_class_transfers_academicYearId" ON "class_transfers" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_class_transfers_schoolLevelId" ON "class_transfers" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_class_transfers_studentId" ON "class_transfers" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_class_transfers_fromClassId" ON "class_transfers" ("fromClassId");
CREATE INDEX IF NOT EXISTS "idx_class_transfers_toClassId" ON "class_transfers" ("toClassId");
CREATE INDEX IF NOT EXISTS "idx_class_transfers_fromSeriesId" ON "class_transfers" ("fromSeriesId");
CREATE INDEX IF NOT EXISTS "idx_class_transfers_toSeriesId" ON "class_transfers" ("toSeriesId");

-- Table: classes
CREATE TABLE IF NOT EXISTS "classes" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "academicTrackId" TEXT,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "capacity" INTEGER,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "language" TEXT,
  "officialClassId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_classes_tenantId" ON "classes" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_classes_academicYearId" ON "classes" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_classes_schoolLevelId" ON "classes" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_classes_academicTrackId" ON "classes" ("academicTrackId");
CREATE INDEX IF NOT EXISTS "idx_classes_officialClassId" ON "classes" ("officialClassId");

-- Table: classrooms
CREATE TABLE IF NOT EXISTS "classrooms" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "gradeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "capacity" INTEGER,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "isArchived" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_classrooms_tenantId" ON "classrooms" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_classrooms_academicYearId" ON "classrooms" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_classrooms_gradeId" ON "classrooms" ("gradeId");

-- Table: climate_academic_correlations
CREATE TABLE IF NOT EXISTS "climate_academic_correlations" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "incidentCount" INTEGER NOT NULL,
  "averageScore" REAL NOT NULL,
  "correlationValue" REAL NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_climate_academic_correlations_tenantId" ON "climate_academic_correlations" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_climate_academic_correlations_classId" ON "climate_academic_correlations" ("classId");
CREATE INDEX IF NOT EXISTS "idx_climate_academic_correlations_academicYearId" ON "climate_academic_correlations" ("academicYearId");

-- Table: climate_score_snapshots
CREATE TABLE IF NOT EXISTS "climate_score_snapshots" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "periodStart" TEXT NOT NULL,
  "periodEnd" TEXT NOT NULL,
  "globalScore" REAL NOT NULL,
  "incidentCount" INTEGER NOT NULL,
  "criticalCount" INTEGER NOT NULL,
  "teacherAbsences" INTEGER NOT NULL,
  "infraIssues" INTEGER NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_climate_score_snapshots_tenantId" ON "climate_score_snapshots" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_climate_score_snapshots_academicYearId" ON "climate_score_snapshots" ("academicYearId");

-- Table: cms_pages
CREATE TABLE IF NOT EXISTS "cms_pages" (
  "id" TEXT PRIMARY KEY,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);


-- Table: cnss_declaration_lines
CREATE TABLE IF NOT EXISTS "cnss_declaration_lines" (
  "id" TEXT PRIMARY KEY,
  "cnssDeclarationId" TEXT NOT NULL,
  "employeeCNSSId" TEXT NOT NULL,
  "grossSalary" REAL NOT NULL,
  "employeeShare" REAL NOT NULL,
  "employerShare" REAL NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_cnss_declaration_lines_cnssDeclarationId" ON "cnss_declaration_lines" ("cnssDeclarationId");
CREATE INDEX IF NOT EXISTS "idx_cnss_declaration_lines_employeeCNSSId" ON "cnss_declaration_lines" ("employeeCNSSId");

-- Table: cnss_declarations
CREATE TABLE IF NOT EXISTS "cnss_declarations" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "month" TEXT NOT NULL,
  "totalEmployeeShare" REAL NOT NULL DEFAULT 0,
  "totalEmployerShare" REAL NOT NULL DEFAULT 0,
  "totalAmount" REAL NOT NULL,
  "status" TEXT NOT NULL,
  "declaredAt" TEXT,
  "paidAt" TEXT,
  "paymentReference" TEXT,
  "paymentProofPath" TEXT,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_cnss_declarations_tenantId" ON "cnss_declarations" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_cnss_declarations_academicYearId" ON "cnss_declarations" ("academicYearId");

-- Table: cnss_rates
CREATE TABLE IF NOT EXISTS "cnss_rates" (
  "id" TEXT PRIMARY KEY,
  "countryCode" TEXT NOT NULL,
  "employeeRate" REAL NOT NULL,
  "employerRate" REAL NOT NULL,
  "salaryCeiling" REAL,
  "effectiveFrom" TEXT NOT NULL,
  "effectiveTo" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);


-- Table: collection_actions
CREATE TABLE IF NOT EXISTS "collection_actions" (
  "id" TEXT PRIMARY KEY,
  "feeArrearId" TEXT,
  "collectionCaseId" TEXT,
  "actionType" TEXT NOT NULL,
  "channel" TEXT,
  "message" TEXT,
  "notes" TEXT,
  "performedBy" TEXT,
  "performedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_collection_actions_feeArrearId" ON "collection_actions" ("feeArrearId");
CREATE INDEX IF NOT EXISTS "idx_collection_actions_collectionCaseId" ON "collection_actions" ("collectionCaseId");

-- Table: collection_cases
CREATE TABLE IF NOT EXISTS "collection_cases" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "totalDue" REAL NOT NULL,
  "totalPaid" REAL NOT NULL DEFAULT 0,
  "outstandingAmount" REAL NOT NULL,
  "status" TEXT NOT NULL,
  "escalationLevel" INTEGER NOT NULL DEFAULT 0,
  "lastActionAt" TEXT,
  "blockedUntil" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_collection_cases_tenantId" ON "collection_cases" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_collection_cases_studentId" ON "collection_cases" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_collection_cases_academicYearId" ON "collection_cases" ("academicYearId");

-- Table: collection_reminders
CREATE TABLE IF NOT EXISTS "collection_reminders" (
  "id" TEXT PRIMARY KEY,
  "feeArrearId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "reminderStage" TEXT NOT NULL,
  "sentAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "status" TEXT NOT NULL,
  "message" TEXT,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_collection_reminders_feeArrearId" ON "collection_reminders" ("feeArrearId");

-- Table: communication_channels
CREATE TABLE IF NOT EXISTS "communication_channels" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "config" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_communication_channels_tenantId" ON "communication_channels" ("tenantId");

-- Table: communication_stats
CREATE TABLE IF NOT EXISTS "communication_stats" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "schoolLevelId" TEXT,
  "date" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "sent" INTEGER NOT NULL DEFAULT 0,
  "delivered" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "cost" REAL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_communication_stats_tenantId" ON "communication_stats" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_communication_stats_academicYearId" ON "communication_stats" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_communication_stats_schoolLevelId" ON "communication_stats" ("schoolLevelId");

-- Table: compliance_records
CREATE TABLE IF NOT EXISTS "compliance_records" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "complianceRequirementId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "schoolLevelId" TEXT,
  "status" TEXT NOT NULL,
  "evidencePath" TEXT,
  "validated" INTEGER NOT NULL DEFAULT 0,
  "validatedBy" TEXT,
  "validatedAt" TEXT,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_compliance_records_tenantId" ON "compliance_records" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_compliance_records_complianceRequirementId" ON "compliance_records" ("complianceRequirementId");
CREATE INDEX IF NOT EXISTS "idx_compliance_records_academicYearId" ON "compliance_records" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_compliance_records_schoolLevelId" ON "compliance_records" ("schoolLevelId");

-- Table: compliance_requirements
CREATE TABLE IF NOT EXISTS "compliance_requirements" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "mandatory" INTEGER NOT NULL DEFAULT 1,
  "legalReference" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_compliance_requirements_tenantId" ON "compliance_requirements" ("tenantId");

-- Table: contract_amendments
CREATE TABLE IF NOT EXISTS "contract_amendments" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "amendmentType" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "previousValue" TEXT,
  "newValue" TEXT,
  "effectiveDate" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_contract_amendments_tenantId" ON "contract_amendments" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_contract_amendments_contractId" ON "contract_amendments" ("contractId");

-- Table: contract_document_configs
CREATE TABLE IF NOT EXISTS "contract_document_configs" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "header_logo_url" TEXT,
  "header_logo_position" TEXT,
  "header_logo_max_height" INTEGER DEFAULT 60,
  "header_show_school_name" INTEGER DEFAULT 1,
  "header_show_address" INTEGER DEFAULT 1,
  "header_show_contact" INTEGER DEFAULT 1,
  "header_show_authorization_number" INTEGER DEFAULT 1,
  "header_show_decorative_line" INTEGER DEFAULT 1,
  "header_decorative_line_color" TEXT,
  "header_background_color" TEXT,
  "watermark_text" TEXT,
  "watermark_opacity" REAL DEFAULT 0.05,
  "watermark_font_size" INTEGER DEFAULT 72,
  "watermark_rotation" INTEGER,
  "watermark_color" TEXT,
  "footer_show_academia_signature" INTEGER DEFAULT 1,
  "footer_show_page_number" INTEGER DEFAULT 1,
  "footer_show_contract_ref" INTEGER DEFAULT 1,
  "footer_show_qr_code" INTEGER DEFAULT 1,
  "footer_background_color" TEXT,
  "footer_accent_color" TEXT,
  "style_primary_color" TEXT,
  "style_accent_color" TEXT,
  "style_font_family" TEXT,
  "style_title_font_size" INTEGER DEFAULT 15,
  "style_body_font_size" INTEGER DEFAULT 12,
  "style_line_height" REAL DEFAULT 1.7,
  "style_margin_top" INTEGER DEFAULT 20,
  "style_margin_bottom" INTEGER DEFAULT 20,
  "style_margin_left" INTEGER DEFAULT 15,
  "style_margin_right" INTEGER DEFAULT 15,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "watermark_type" TEXT,
  "watermark_image_url" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_contract_document_configs_tenant_id" ON "contract_document_configs" ("tenant_id");

-- Table: contract_sign_tokens
CREATE TABLE IF NOT EXISTS "contract_sign_tokens" (
  "id" TEXT PRIMARY KEY,
  "contractId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expiresAt" TEXT NOT NULL,
  "usedAt" TEXT,
  "signedByIp" TEXT,
  "signedByUserAgent" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_contract_sign_tokens_contractId" ON "contract_sign_tokens" ("contractId");
CREATE INDEX IF NOT EXISTS "idx_contract_sign_tokens_tenantId" ON "contract_sign_tokens" ("tenantId");

-- Table: contract_templates
CREATE TABLE IF NOT EXISTS "contract_templates" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "contractType" TEXT NOT NULL,
  "template" TEXT NOT NULL,
  "variables" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_contract_templates_tenantId" ON "contract_templates" ("tenantId");

-- Table: corrective_actions
CREATE TABLE IF NOT EXISTS "corrective_actions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "schoolLevelId" TEXT,
  "inspectionId" TEXT,
  "incidentId" TEXT,
  "action" TEXT NOT NULL,
  "assignedTo" TEXT,
  "dueDate" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "completedAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_corrective_actions_tenantId" ON "corrective_actions" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_corrective_actions_academicYearId" ON "corrective_actions" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_corrective_actions_schoolLevelId" ON "corrective_actions" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_corrective_actions_inspectionId" ON "corrective_actions" ("inspectionId");
CREATE INDEX IF NOT EXISTS "idx_corrective_actions_incidentId" ON "corrective_actions" ("incidentId");

-- Table: council_decisions
CREATE TABLE IF NOT EXISTS "council_decisions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "councilId" TEXT NOT NULL,
  "studentId" TEXT,
  "quarterId" TEXT,
  "decision" TEXT NOT NULL,
  "decisionType" TEXT,
  "description" TEXT NOT NULL,
  "comments" TEXT,
  "votesFor" INTEGER,
  "votesAgainst" INTEGER,
  "votesAbstain" INTEGER,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_council_decisions_tenantId" ON "council_decisions" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_council_decisions_academicYearId" ON "council_decisions" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_council_decisions_schoolLevelId" ON "council_decisions" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_council_decisions_councilId" ON "council_decisions" ("councilId");
CREATE INDEX IF NOT EXISTS "idx_council_decisions_studentId" ON "council_decisions" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_council_decisions_quarterId" ON "council_decisions" ("quarterId");

-- Table: council_minutes
CREATE TABLE IF NOT EXISTS "council_minutes" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "councilId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "attachments" TEXT,
  "recordedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_council_minutes_tenantId" ON "council_minutes" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_council_minutes_academicYearId" ON "council_minutes" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_council_minutes_schoolLevelId" ON "council_minutes" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_council_minutes_councilId" ON "council_minutes" ("councilId");

-- Table: countries
CREATE TABLE IF NOT EXISTS "countries" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code3" TEXT,
  "numericCode" TEXT,
  "currencyCode" TEXT,
  "currencySymbol" TEXT,
  "phonePrefix" TEXT,
  "flagEmoji" TEXT,
  "isDefault" INTEGER NOT NULL DEFAULT 0,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);


-- Table: daily_closures
CREATE TABLE IF NOT EXISTS "daily_closures" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "totalCollected" REAL NOT NULL DEFAULT 0,
  "totalSpent" REAL NOT NULL DEFAULT 0,
  "openingBalance" REAL NOT NULL DEFAULT 0,
  "closingBalance" REAL NOT NULL DEFAULT 0,
  "discrepancy" REAL,
  "validated" INTEGER NOT NULL DEFAULT 0,
  "validatedBy" TEXT,
  "validatedAt" TEXT,
  "notes" TEXT,
  "createdBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_daily_closures_tenantId" ON "daily_closures" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_daily_closures_academicYearId" ON "daily_closures" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_daily_closures_schoolLevelId" ON "daily_closures" ("schoolLevelId");

-- Table: daily_logs
CREATE TABLE IF NOT EXISTS "daily_logs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "classId" TEXT,
  "date" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "validated" INTEGER NOT NULL DEFAULT 0,
  "validatedBy" TEXT,
  "validatedAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_daily_logs_tenantId" ON "daily_logs" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_daily_logs_academicYearId" ON "daily_logs" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_daily_logs_schoolLevelId" ON "daily_logs" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_daily_logs_teacherId" ON "daily_logs" ("teacherId");
CREATE INDEX IF NOT EXISTS "idx_daily_logs_classId" ON "daily_logs" ("classId");

-- Table: data_consents
CREATE TABLE IF NOT EXISTS "data_consents" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "consentType" TEXT NOT NULL,
  "consented" INTEGER NOT NULL DEFAULT 0,
  "consentText" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_data_consents_tenantId" ON "data_consents" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_data_consents_userId" ON "data_consents" ("userId");

-- Table: data_exports
CREATE TABLE IF NOT EXISTS "data_exports" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "exportType" TEXT NOT NULL,
  "filePath" TEXT,
  "status" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_data_exports_tenantId" ON "data_exports" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_data_exports_userId" ON "data_exports" ("userId");

-- Table: departments
CREATE TABLE IF NOT EXISTS "departments" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "managerId" TEXT,
  "createdBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_departments_tenantId" ON "departments" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_departments_managerId" ON "departments" ("managerId");

-- Table: device_sessions
CREATE TABLE IF NOT EXISTS "device_sessions" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "sessionToken" TEXT NOT NULL,
  "refreshToken" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TEXT NOT NULL,
  "lastActivityAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_device_sessions_userId" ON "device_sessions" ("userId");
CREATE INDEX IF NOT EXISTS "idx_device_sessions_tenantId" ON "device_sessions" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_device_sessions_academicYearId" ON "device_sessions" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_device_sessions_deviceId" ON "device_sessions" ("deviceId");

-- Table: disciplinary_actions
CREATE TABLE IF NOT EXISTS "disciplinary_actions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "disciplineId" TEXT,
  "actionType" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "actionDate" TEXT NOT NULL,
  "duration" INTEGER,
  "status" TEXT NOT NULL,
  "decidedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_disciplinary_actions_tenantId" ON "disciplinary_actions" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_disciplinary_actions_academicYearId" ON "disciplinary_actions" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_disciplinary_actions_schoolLevelId" ON "disciplinary_actions" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_disciplinary_actions_studentId" ON "disciplinary_actions" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_disciplinary_actions_disciplineId" ON "disciplinary_actions" ("disciplineId");

-- Table: discipline
CREATE TABLE IF NOT EXISTS "discipline" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "incidentDate" TEXT NOT NULL,
  "severity" TEXT,
  "description" TEXT NOT NULL,
  "actionTaken" TEXT,
  "reportedBy" TEXT,
  "createdBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_discipline_tenantId" ON "discipline" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_discipline_studentId" ON "discipline" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_discipline_schoolLevelId" ON "discipline" ("schoolLevelId");

-- Table: discipline_records
CREATE TABLE IF NOT EXISTS "discipline_records" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "incidentDate" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "actionTaken" TEXT,
  "reportedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_discipline_records_tenantId" ON "discipline_records" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_discipline_records_academicYearId" ON "discipline_records" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_discipline_records_schoolLevelId" ON "discipline_records" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_discipline_records_studentId" ON "discipline_records" ("studentId");

-- Table: discounts
CREATE TABLE IF NOT EXISTS "discounts" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "value" REAL NOT NULL,
  "applicableTo" TEXT,
  "startDate" TEXT,
  "endDate" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "maxUses" INTEGER,
  "currentUses" INTEGER NOT NULL DEFAULT 0,
  "conditions" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_discounts_tenantId" ON "discounts" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_discounts_academicYearId" ON "discounts" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_discounts_schoolLevelId" ON "discounts" ("schoolLevelId");

-- Table: document_seals
CREATE TABLE IF NOT EXISTS "document_seals" (
  "id" TEXT PRIMARY KEY,
  "documentType" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "sealVersionId" TEXT NOT NULL,
  "position" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_document_seals_documentId" ON "document_seals" ("documentId");
CREATE INDEX IF NOT EXISTS "idx_document_seals_sealVersionId" ON "document_seals" ("sealVersionId");

-- Table: document_templates
CREATE TABLE IF NOT EXISTS "document_templates" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "template" TEXT NOT NULL,
  "variables" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_document_templates_tenantId" ON "document_templates" ("tenantId");

-- Table: educast_accesses
CREATE TABLE IF NOT EXISTS "educast_accesses" (
  "id" TEXT PRIMARY KEY,
  "contentId" TEXT NOT NULL,
  "studentId" TEXT,
  "schoolLevelId" TEXT,
  "classId" TEXT,
  "accessType" TEXT NOT NULL,
  "grantedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "grantedBy" TEXT,
  "expiresAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_educast_accesses_contentId" ON "educast_accesses" ("contentId");
CREATE INDEX IF NOT EXISTS "idx_educast_accesses_studentId" ON "educast_accesses" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_educast_accesses_schoolLevelId" ON "educast_accesses" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_educast_accesses_classId" ON "educast_accesses" ("classId");

-- Table: educast_announcements
CREATE TABLE IF NOT EXISTS "educast_announcements" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT,
  "mediaItemId" TEXT,
  "authorId" TEXT NOT NULL,
  "targetAudience" TEXT NOT NULL,
  "publishedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "expiresAt" TEXT,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_educast_announcements_tenantId" ON "educast_announcements" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_educast_announcements_academicYearId" ON "educast_announcements" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_educast_announcements_mediaItemId" ON "educast_announcements" ("mediaItemId");
CREATE INDEX IF NOT EXISTS "idx_educast_announcements_authorId" ON "educast_announcements" ("authorId");

-- Table: educast_channel_subscribers
CREATE TABLE IF NOT EXISTS "educast_channel_subscribers" (
  "id" TEXT PRIMARY KEY,
  "channelId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_educast_channel_subscribers_channelId" ON "educast_channel_subscribers" ("channelId");
CREATE INDEX IF NOT EXISTS "idx_educast_channel_subscribers_userId" ON "educast_channel_subscribers" ("userId");

-- Table: educast_content_pack_items
CREATE TABLE IF NOT EXISTS "educast_content_pack_items" (
  "id" TEXT PRIMARY KEY,
  "packId" TEXT NOT NULL,
  "mediaItemId" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_educast_content_pack_items_packId" ON "educast_content_pack_items" ("packId");
CREATE INDEX IF NOT EXISTS "idx_educast_content_pack_items_mediaItemId" ON "educast_content_pack_items" ("mediaItemId");

-- Table: educast_content_packs
CREATE TABLE IF NOT EXISTS "educast_content_packs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "price" REAL NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_educast_content_packs_tenantId" ON "educast_content_packs" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_educast_content_packs_academicYearId" ON "educast_content_packs" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_educast_content_packs_channelId" ON "educast_content_packs" ("channelId");

-- Table: educast_contents
CREATE TABLE IF NOT EXISTS "educast_contents" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "contentType" TEXT NOT NULL,
  "filePath" TEXT,
  "url" TEXT,
  "duration" INTEGER,
  "fileSize" INTEGER,
  "thumbnailPath" TEXT,
  "schoolLevelId" TEXT,
  "classId" TEXT,
  "isPublic" INTEGER NOT NULL DEFAULT 0,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "uploadedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_educast_contents_tenantId" ON "educast_contents" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_educast_contents_academicYearId" ON "educast_contents" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_educast_contents_schoolLevelId" ON "educast_contents" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_educast_contents_classId" ON "educast_contents" ("classId");

-- Table: educast_engagement
CREATE TABLE IF NOT EXISTS "educast_engagement" (
  "id" TEXT PRIMARY KEY,
  "mediaItemId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "durationSeen" INTEGER,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_educast_engagement_mediaItemId" ON "educast_engagement" ("mediaItemId");
CREATE INDEX IF NOT EXISTS "idx_educast_engagement_userId" ON "educast_engagement" ("userId");

-- Table: educast_favorites
CREATE TABLE IF NOT EXISTS "educast_favorites" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "mediaItemId" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_educast_favorites_userId" ON "educast_favorites" ("userId");
CREATE INDEX IF NOT EXISTS "idx_educast_favorites_mediaItemId" ON "educast_favorites" ("mediaItemId");

-- Table: educast_media_items
CREATE TABLE IF NOT EXISTS "educast_media_items" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  "duration" INTEGER,
  "authorId" TEXT NOT NULL,
  "channelId" TEXT,
  "categoryId" TEXT,
  "subjectId" TEXT,
  "levelId" TEXT,
  "classId" TEXT,
  "tags" TEXT,
  "status" TEXT NOT NULL,
  "visibility" TEXT NOT NULL,
  "monetizationStatus" TEXT NOT NULL,
  "price" REAL NOT NULL DEFAULT 0,
  "isDownloadable" INTEGER NOT NULL DEFAULT 1,
  "commentsEnabled" INTEGER NOT NULL DEFAULT 1,
  "viewCount" INTEGER NOT NULL DEFAULT 0,
  "likeCount" INTEGER NOT NULL DEFAULT 0,
  "isFeatured" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_educast_media_items_tenantId" ON "educast_media_items" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_educast_media_items_academicYearId" ON "educast_media_items" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_educast_media_items_authorId" ON "educast_media_items" ("authorId");
CREATE INDEX IF NOT EXISTS "idx_educast_media_items_channelId" ON "educast_media_items" ("channelId");
CREATE INDEX IF NOT EXISTS "idx_educast_media_items_categoryId" ON "educast_media_items" ("categoryId");
CREATE INDEX IF NOT EXISTS "idx_educast_media_items_subjectId" ON "educast_media_items" ("subjectId");
CREATE INDEX IF NOT EXISTS "idx_educast_media_items_levelId" ON "educast_media_items" ("levelId");
CREATE INDEX IF NOT EXISTS "idx_educast_media_items_classId" ON "educast_media_items" ("classId");

-- Table: educast_payout_requests
CREATE TABLE IF NOT EXISTS "educast_payout_requests" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "status" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_educast_payout_requests_tenantId" ON "educast_payout_requests" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_educast_payout_requests_teacherId" ON "educast_payout_requests" ("teacherId");

-- Table: educast_playlist_items
CREATE TABLE IF NOT EXISTS "educast_playlist_items" (
  "id" TEXT PRIMARY KEY,
  "playlistId" TEXT NOT NULL,
  "mediaItemId" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_educast_playlist_items_playlistId" ON "educast_playlist_items" ("playlistId");
CREATE INDEX IF NOT EXISTS "idx_educast_playlist_items_mediaItemId" ON "educast_playlist_items" ("mediaItemId");

-- Table: educast_playlists
CREATE TABLE IF NOT EXISTS "educast_playlists" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "ownerId" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "status" TEXT NOT NULL,
  "isPremium" INTEGER NOT NULL DEFAULT 0,
  "price" REAL NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_educast_playlists_tenantId" ON "educast_playlists" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_educast_playlists_academicYearId" ON "educast_playlists" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_educast_playlists_ownerId" ON "educast_playlists" ("ownerId");
CREATE INDEX IF NOT EXISTS "idx_educast_playlists_targetId" ON "educast_playlists" ("targetId");

-- Table: educast_purchases
CREATE TABLE IF NOT EXISTS "educast_purchases" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mediaItemId" TEXT,
  "packId" TEXT,
  "amount" REAL NOT NULL,
  "commission" REAL NOT NULL,
  "teacherShare" REAL NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_educast_purchases_tenantId" ON "educast_purchases" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_educast_purchases_userId" ON "educast_purchases" ("userId");
CREATE INDEX IF NOT EXISTS "idx_educast_purchases_mediaItemId" ON "educast_purchases" ("mediaItemId");
CREATE INDEX IF NOT EXISTS "idx_educast_purchases_packId" ON "educast_purchases" ("packId");

-- Table: educast_reports
CREATE TABLE IF NOT EXISTS "educast_reports" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "reportType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "periodStart" TEXT,
  "periodEnd" TEXT,
  "content" TEXT,
  "generatedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_educast_reports_tenantId" ON "educast_reports" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_educast_reports_academicYearId" ON "educast_reports" ("academicYearId");

-- Table: educast_resources
CREATE TABLE IF NOT EXISTS "educast_resources" (
  "id" TEXT PRIMARY KEY,
  "mediaItemId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_educast_resources_mediaItemId" ON "educast_resources" ("mediaItemId");

-- Table: educast_sessions
CREATE TABLE IF NOT EXISTS "educast_sessions" (
  "id" TEXT PRIMARY KEY,
  "contentId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "startTime" TEXT NOT NULL DEFAULT (datetime('now')),
  "endTime" TEXT,
  "duration" INTEGER,
  "progress" INTEGER,
  "completed" INTEGER NOT NULL DEFAULT 0,
  "deviceType" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_educast_sessions_contentId" ON "educast_sessions" ("contentId");
CREATE INDEX IF NOT EXISTS "idx_educast_sessions_studentId" ON "educast_sessions" ("studentId");

-- Table: educast_settings
CREATE TABLE IF NOT EXISTS "educast_settings" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_educast_settings_tenantId" ON "educast_settings" ("tenantId");

-- Table: educast_subscriptions
CREATE TABLE IF NOT EXISTS "educast_subscriptions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "startDate" TEXT NOT NULL DEFAULT (datetime('now')),
  "endDate" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_educast_subscriptions_tenantId" ON "educast_subscriptions" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_educast_subscriptions_userId" ON "educast_subscriptions" ("userId");
CREATE INDEX IF NOT EXISTS "idx_educast_subscriptions_channelId" ON "educast_subscriptions" ("channelId");

-- Table: educast_teacher_channels
CREATE TABLE IF NOT EXISTS "educast_teacher_channels" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slogan" TEXT,
  "description" TEXT,
  "avatarUrl" TEXT,
  "bannerUrl" TEXT,
  "subjects" TEXT,
  "levels" TEXT,
  "language" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "isMonetized" INTEGER NOT NULL DEFAULT 0,
  "subscriberCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_educast_teacher_channels_tenantId" ON "educast_teacher_channels" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_educast_teacher_channels_teacherId" ON "educast_teacher_channels" ("teacherId");

-- Table: educast_webinars
CREATE TABLE IF NOT EXISTS "educast_webinars" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "presenterId" TEXT NOT NULL,
  "scheduledAt" TEXT NOT NULL,
  "duration" INTEGER NOT NULL,
  "streamUrl" TEXT,
  "meetingId" TEXT,
  "status" TEXT NOT NULL,
  "isReplayAvail" INTEGER NOT NULL DEFAULT 0,
  "replayMediaId" TEXT,
  "isPayant" INTEGER NOT NULL DEFAULT 0,
  "price" REAL NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_educast_webinars_tenantId" ON "educast_webinars" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_educast_webinars_academicYearId" ON "educast_webinars" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_educast_webinars_presenterId" ON "educast_webinars" ("presenterId");
CREATE INDEX IF NOT EXISTS "idx_educast_webinars_meetingId" ON "educast_webinars" ("meetingId");
CREATE INDEX IF NOT EXISTS "idx_educast_webinars_replayMediaId" ON "educast_webinars" ("replayMediaId");

-- Table: education_cycles
CREATE TABLE IF NOT EXISTS "education_cycles" (
  "id" TEXT PRIMARY KEY,
  "levelId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_education_cycles_levelId" ON "education_cycles" ("levelId");

-- Table: education_grades
CREATE TABLE IF NOT EXISTS "education_grades" (
  "id" TEXT PRIMARY KEY,
  "cycleId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "seriesId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_education_grades_cycleId" ON "education_grades" ("cycleId");
CREATE INDEX IF NOT EXISTS "idx_education_grades_seriesId" ON "education_grades" ("seriesId");

-- Table: education_levels
CREATE TABLE IF NOT EXISTS "education_levels" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isEnabled" INTEGER NOT NULL DEFAULT 1,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_education_levels_tenantId" ON "education_levels" ("tenantId");

-- Table: education_series
CREATE TABLE IF NOT EXISTS "education_series" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_education_series_tenantId" ON "education_series" ("tenantId");

-- Table: electronic_signatures
CREATE TABLE IF NOT EXISTS "electronic_signatures" (
  "id" TEXT PRIMARY KEY,
  "minutesId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "signatureType" TEXT NOT NULL,
  "signatureHash" TEXT NOT NULL,
  "signatureData" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "signedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_electronic_signatures_minutesId" ON "electronic_signatures" ("minutesId");
CREATE INDEX IF NOT EXISTS "idx_electronic_signatures_userId" ON "electronic_signatures" ("userId");

-- Table: email_logs
CREATE TABLE IF NOT EXISTS "email_logs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "provider" TEXT,
  "providerId" TEXT,
  "sentAt" TEXT,
  "deliveredAt" TEXT,
  "bouncedAt" TEXT,
  "errorMessage" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "category" TEXT,
  "subCategory" TEXT,
  "module" TEXT,
  "fromEmail" TEXT,
  "fromName" TEXT,
  "recipientName" TEXT,
  "recipientType" TEXT,
  "recipientId" TEXT,
  "cc" TEXT,
  "bcc" TEXT,
  "textContent" TEXT,
  "threadId" TEXT,
  "inReplyTo" TEXT,
  "references" TEXT,
  "replyTo" TEXT,
  "replyToToken" TEXT,
  "openedAt" TEXT,
  "clickedAt" TEXT,
  "openCount" INTEGER NOT NULL DEFAULT 0,
  "clickCount" INTEGER NOT NULL DEFAULT 0,
  "triggeredBy" TEXT,
  "triggeredByUserId" TEXT,
  "templateId" TEXT,
  "relatedEntityId" TEXT,
  "relatedEntityType" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_email_logs_tenantId" ON "email_logs" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_email_logs_providerId" ON "email_logs" ("providerId");
CREATE INDEX IF NOT EXISTS "idx_email_logs_recipientId" ON "email_logs" ("recipientId");
CREATE INDEX IF NOT EXISTS "idx_email_logs_threadId" ON "email_logs" ("threadId");
CREATE INDEX IF NOT EXISTS "idx_email_logs_triggeredByUserId" ON "email_logs" ("triggeredByUserId");
CREATE INDEX IF NOT EXISTS "idx_email_logs_templateId" ON "email_logs" ("templateId");
CREATE INDEX IF NOT EXISTS "idx_email_logs_relatedEntityId" ON "email_logs" ("relatedEntityId");

-- Table: employee_cnss
CREATE TABLE IF NOT EXISTS "employee_cnss" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "cnssNumber" TEXT,
  "affiliationDate" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_employee_cnss_tenantId" ON "employee_cnss" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_employee_cnss_staffId" ON "employee_cnss" ("staffId");

-- Table: employment_contracts
CREATE TABLE IF NOT EXISTS "employment_contracts" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "schoolLevelId" TEXT,
  "staffId" TEXT NOT NULL,
  "templateId" TEXT,
  "contractType" TEXT NOT NULL,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT,
  "baseSalary" REAL NOT NULL,
  "paymentMode" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "terms" TEXT,
  "signedAt" TEXT,
  "signedBy" TEXT,
  "terminatedAt" TEXT,
  "terminationReason" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_employment_contracts_tenantId" ON "employment_contracts" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_employment_contracts_academicYearId" ON "employment_contracts" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_employment_contracts_schoolLevelId" ON "employment_contracts" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_employment_contracts_staffId" ON "employment_contracts" ("staffId");
CREATE INDEX IF NOT EXISTS "idx_employment_contracts_templateId" ON "employment_contracts" ("templateId");

-- Table: evaluation_competencies
CREATE TABLE IF NOT EXISTS "evaluation_competencies" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "evaluationId" TEXT NOT NULL,
  "domainId" TEXT,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "expectedLevel" TEXT,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_evaluation_competencies_tenantId" ON "evaluation_competencies" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_evaluation_competencies_evaluationId" ON "evaluation_competencies" ("evaluationId");
CREATE INDEX IF NOT EXISTS "idx_evaluation_competencies_domainId" ON "evaluation_competencies" ("domainId");

-- Table: evaluation_participants
CREATE TABLE IF NOT EXISTS "evaluation_participants" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "evaluationId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "isEligible" INTEGER NOT NULL DEFAULT 1,
  "exclusionReason" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_evaluation_participants_tenantId" ON "evaluation_participants" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_evaluation_participants_evaluationId" ON "evaluation_participants" ("evaluationId");
CREATE INDEX IF NOT EXISTS "idx_evaluation_participants_studentId" ON "evaluation_participants" ("studentId");

-- Table: evaluation_results
CREATE TABLE IF NOT EXISTS "evaluation_results" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "evaluationId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "numericScore" REAL,
  "qualitativeCode" TEXT,
  "appreciation" TEXT,
  "teacherComment" TEXT,
  "directorComment" TEXT,
  "isAbsent" INTEGER NOT NULL DEFAULT 0,
  "isExempted" INTEGER NOT NULL DEFAULT 0,
  "absenceReason" TEXT,
  "status" TEXT NOT NULL,
  "enteredById" TEXT,
  "submittedById" TEXT,
  "validatedById" TEXT,
  "lockedById" TEXT,
  "enteredAt" TEXT,
  "submittedAt" TEXT,
  "validatedAt" TEXT,
  "lockedAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_evaluation_results_tenantId" ON "evaluation_results" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_evaluation_results_evaluationId" ON "evaluation_results" ("evaluationId");
CREATE INDEX IF NOT EXISTS "idx_evaluation_results_studentId" ON "evaluation_results" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_evaluation_results_enteredById" ON "evaluation_results" ("enteredById");
CREATE INDEX IF NOT EXISTS "idx_evaluation_results_submittedById" ON "evaluation_results" ("submittedById");
CREATE INDEX IF NOT EXISTS "idx_evaluation_results_validatedById" ON "evaluation_results" ("validatedById");
CREATE INDEX IF NOT EXISTS "idx_evaluation_results_lockedById" ON "evaluation_results" ("lockedById");

-- Table: evaluation_sessions
CREATE TABLE IF NOT EXISTS "evaluation_sessions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "description" TEXT,
  "periodId" TEXT NOT NULL,
  "schoolStage" TEXT NOT NULL,
  "levelId" TEXT,
  "classId" TEXT,
  "seriesId" TEXT,
  "startDate" TEXT,
  "endDate" TEXT,
  "status" TEXT NOT NULL,
  "createdById" TEXT,
  "validatedById" TEXT,
  "lockedById" TEXT,
  "validatedAt" TEXT,
  "lockedAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_evaluation_sessions_tenantId" ON "evaluation_sessions" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_evaluation_sessions_academicYearId" ON "evaluation_sessions" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_evaluation_sessions_periodId" ON "evaluation_sessions" ("periodId");
CREATE INDEX IF NOT EXISTS "idx_evaluation_sessions_levelId" ON "evaluation_sessions" ("levelId");
CREATE INDEX IF NOT EXISTS "idx_evaluation_sessions_classId" ON "evaluation_sessions" ("classId");
CREATE INDEX IF NOT EXISTS "idx_evaluation_sessions_seriesId" ON "evaluation_sessions" ("seriesId");
CREATE INDEX IF NOT EXISTS "idx_evaluation_sessions_createdById" ON "evaluation_sessions" ("createdById");
CREATE INDEX IF NOT EXISTS "idx_evaluation_sessions_validatedById" ON "evaluation_sessions" ("validatedById");
CREATE INDEX IF NOT EXISTS "idx_evaluation_sessions_lockedById" ON "evaluation_sessions" ("lockedById");

-- Table: evaluation_types
CREATE TABLE IF NOT EXISTS "evaluation_types" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "defaultMaxScore" REAL NOT NULL DEFAULT 20.0,
  "defaultCoefficient" REAL NOT NULL DEFAULT 1.0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "code" TEXT,
  "schoolLevelId" TEXT,
  "isSystem" INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "idx_evaluation_types_tenantId" ON "evaluation_types" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_evaluation_types_schoolLevelId" ON "evaluation_types" ("schoolLevelId");

-- Table: evaluations
CREATE TABLE IF NOT EXISTS "evaluations" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "evaluationTypeId" TEXT NOT NULL,
  "title" TEXT,
  "evaluationDate" TEXT NOT NULL DEFAULT (datetime('now')),
  "maxScore" REAL NOT NULL DEFAULT 20.0,
  "coefficient" REAL NOT NULL DEFAULT 1.0,
  "status" TEXT NOT NULL,
  "createdBy" TEXT,
  "validatedById" TEXT,
  "validatedAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "description" TEXT,
  "teacherId" TEXT,
  "gradeScaleId" TEXT,
  "startDate" TEXT,
  "endDate" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_evaluations_tenantId" ON "evaluations" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_evaluations_academicYearId" ON "evaluations" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_evaluations_classId" ON "evaluations" ("classId");
CREATE INDEX IF NOT EXISTS "idx_evaluations_subjectId" ON "evaluations" ("subjectId");
CREATE INDEX IF NOT EXISTS "idx_evaluations_periodId" ON "evaluations" ("periodId");
CREATE INDEX IF NOT EXISTS "idx_evaluations_evaluationTypeId" ON "evaluations" ("evaluationTypeId");
CREATE INDEX IF NOT EXISTS "idx_evaluations_validatedById" ON "evaluations" ("validatedById");
CREATE INDEX IF NOT EXISTS "idx_evaluations_teacherId" ON "evaluations" ("teacherId");
CREATE INDEX IF NOT EXISTS "idx_evaluations_gradeScaleId" ON "evaluations" ("gradeScaleId");

-- Table: exam_advanced_settings
CREATE TABLE IF NOT EXISTS "exam_advanced_settings" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "allowTeacherGradeEditAfterSubmit" INTEGER NOT NULL DEFAULT 0,
  "allowGradeCorrectionAfterLock" INTEGER NOT NULL DEFAULT 0,
  "requireCorrectionApproval" INTEGER NOT NULL DEFAULT 1,
  "allowExcelImport" INTEGER NOT NULL DEFAULT 1,
  "allowExcelExport" INTEGER NOT NULL DEFAULT 1,
  "roundingPrecision" INTEGER NOT NULL DEFAULT 2,
  "roundingMode" TEXT NOT NULL,
  "showClassAverageOnBulletin" INTEGER NOT NULL DEFAULT 1,
  "showSubjectRankOnBulletin" INTEGER NOT NULL DEFAULT 1,
  "showGeneralRankOnBulletin" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_exam_advanced_settings_tenantId" ON "exam_advanced_settings" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_exam_advanced_settings_academicYearId" ON "exam_advanced_settings" ("academicYearId");

-- Table: exam_calculation_rules
CREATE TABLE IF NOT EXISTS "exam_calculation_rules" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "ruleType" TEXT NOT NULL,
  "config" TEXT NOT NULL,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_exam_calculation_rules_tenantId" ON "exam_calculation_rules" ("tenantId");

-- Table: exam_candidates
CREATE TABLE IF NOT EXISTS "exam_candidates" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "patronatSchoolId" TEXT,
  "schoolTenantId" TEXT,
  "centerId" TEXT,
  "roomId" TEXT,
  "registrationNumber" TEXT NOT NULL,
  "matricule" TEXT NOT NULL,
  "tableNumber" TEXT,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "dateOfBirth" TEXT,
  "gender" TEXT,
  "nationality" TEXT,
  "placeOfBirth" TEXT,
  "address" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "photo" TEXT,
  "registrationDate" TEXT NOT NULL DEFAULT (datetime('now')),
  "status" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "createdBy" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_exam_candidates_tenantId" ON "exam_candidates" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_exam_candidates_academicYearId" ON "exam_candidates" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_exam_candidates_examId" ON "exam_candidates" ("examId");
CREATE INDEX IF NOT EXISTS "idx_exam_candidates_patronatSchoolId" ON "exam_candidates" ("patronatSchoolId");
CREATE INDEX IF NOT EXISTS "idx_exam_candidates_schoolTenantId" ON "exam_candidates" ("schoolTenantId");
CREATE INDEX IF NOT EXISTS "idx_exam_candidates_centerId" ON "exam_candidates" ("centerId");
CREATE INDEX IF NOT EXISTS "idx_exam_candidates_roomId" ON "exam_candidates" ("roomId");

-- Table: exam_centers
CREATE TABLE IF NOT EXISTS "exam_centers" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT,
  "location" TEXT,
  "capacity" INTEGER NOT NULL DEFAULT 0,
  "totalRooms" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL,
  "contactName" TEXT,
  "contactPhone" TEXT,
  "contactEmail" TEXT,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "createdBy" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_exam_centers_tenantId" ON "exam_centers" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_exam_centers_academicYearId" ON "exam_centers" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_exam_centers_examId" ON "exam_centers" ("examId");

-- Table: exam_compositions
CREATE TABLE IF NOT EXISTS "exam_compositions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "centerId" TEXT NOT NULL,
  "roomId" TEXT,
  "subjectId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "totalCandidates" INTEGER NOT NULL DEFAULT 0,
  "absentCount" INTEGER NOT NULL DEFAULT 0,
  "incidentCount" INTEGER NOT NULL DEFAULT 0,
  "report" TEXT,
  "status" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_exam_compositions_tenantId" ON "exam_compositions" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_exam_compositions_examId" ON "exam_compositions" ("examId");
CREATE INDEX IF NOT EXISTS "idx_exam_compositions_centerId" ON "exam_compositions" ("centerId");
CREATE INDEX IF NOT EXISTS "idx_exam_compositions_roomId" ON "exam_compositions" ("roomId");
CREATE INDEX IF NOT EXISTS "idx_exam_compositions_subjectId" ON "exam_compositions" ("subjectId");

-- Table: exam_deliberation_cases
CREATE TABLE IF NOT EXISTS "exam_deliberation_cases" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "deliberationId" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "comments" TEXT,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_exam_deliberation_cases_tenantId" ON "exam_deliberation_cases" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_exam_deliberation_cases_deliberationId" ON "exam_deliberation_cases" ("deliberationId");
CREATE INDEX IF NOT EXISTS "idx_exam_deliberation_cases_candidateId" ON "exam_deliberation_cases" ("candidateId");

-- Table: exam_deliberations
CREATE TABLE IF NOT EXISTS "exam_deliberations" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "juryName" TEXT,
  "deliberatedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "totalCandidates" INTEGER NOT NULL,
  "passedCount" INTEGER NOT NULL,
  "failedCount" INTEGER NOT NULL,
  "successRate" REAL NOT NULL,
  "reportUrl" TEXT,
  "status" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_exam_deliberations_tenantId" ON "exam_deliberations" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_exam_deliberations_examId" ON "exam_deliberations" ("examId");

-- Table: exam_documents
CREATE TABLE IF NOT EXISTS "exam_documents" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "candidateId" TEXT,
  "documentType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "fileUrl" TEXT NOT NULL,
  "fileSize" INTEGER,
  "mimeType" TEXT,
  "status" TEXT NOT NULL,
  "generatedBy" TEXT,
  "generatedAt" TEXT,
  "publishedBy" TEXT,
  "publishedAt" TEXT,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_exam_documents_tenantId" ON "exam_documents" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_exam_documents_academicYearId" ON "exam_documents" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_exam_documents_examId" ON "exam_documents" ("examId");
CREATE INDEX IF NOT EXISTS "idx_exam_documents_candidateId" ON "exam_documents" ("candidateId");

-- Table: exam_incidents
CREATE TABLE IF NOT EXISTS "exam_incidents" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "centerId" TEXT NOT NULL,
  "candidateId" TEXT,
  "type" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "reportedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "reportedBy" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_exam_incidents_tenantId" ON "exam_incidents" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_exam_incidents_examId" ON "exam_incidents" ("examId");
CREATE INDEX IF NOT EXISTS "idx_exam_incidents_centerId" ON "exam_incidents" ("centerId");
CREATE INDEX IF NOT EXISTS "idx_exam_incidents_candidateId" ON "exam_incidents" ("candidateId");

-- Table: exam_results
CREATE TABLE IF NOT EXISTS "exam_results" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "score" REAL NOT NULL,
  "maxScore" REAL NOT NULL DEFAULT 20.0,
  "coefficient" REAL NOT NULL DEFAULT 1.0,
  "weightedScore" REAL NOT NULL,
  "grade" TEXT,
  "rank" INTEGER,
  "status" TEXT NOT NULL,
  "remarks" TEXT,
  "enteredBy" TEXT,
  "validatedBy" TEXT,
  "validatedAt" TEXT,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_exam_results_tenantId" ON "exam_results" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_exam_results_academicYearId" ON "exam_results" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_exam_results_examId" ON "exam_results" ("examId");
CREATE INDEX IF NOT EXISTS "idx_exam_results_candidateId" ON "exam_results" ("candidateId");
CREATE INDEX IF NOT EXISTS "idx_exam_results_subjectId" ON "exam_results" ("subjectId");

-- Table: exam_rooms
CREATE TABLE IF NOT EXISTS "exam_rooms" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "centerId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL DEFAULT 0,
  "currentOccupancy" INTEGER NOT NULL DEFAULT 0,
  "floor" INTEGER,
  "building" TEXT,
  "status" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "createdBy" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_exam_rooms_tenantId" ON "exam_rooms" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_exam_rooms_academicYearId" ON "exam_rooms" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_exam_rooms_examId" ON "exam_rooms" ("examId");
CREATE INDEX IF NOT EXISTS "idx_exam_rooms_centerId" ON "exam_rooms" ("centerId");

-- Table: exam_scores
CREATE TABLE IF NOT EXISTS "exam_scores" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "academicTrackId" TEXT,
  "examId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "score" REAL NOT NULL,
  "maxScore" REAL NOT NULL,
  "coefficient" REAL NOT NULL DEFAULT 1.0,
  "remarks" TEXT,
  "isValidated" INTEGER NOT NULL DEFAULT 0,
  "validatedBy" TEXT,
  "validatedAt" TEXT,
  "recordedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "language" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_exam_scores_tenantId" ON "exam_scores" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_exam_scores_academicYearId" ON "exam_scores" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_exam_scores_schoolLevelId" ON "exam_scores" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_exam_scores_academicTrackId" ON "exam_scores" ("academicTrackId");
CREATE INDEX IF NOT EXISTS "idx_exam_scores_examId" ON "exam_scores" ("examId");
CREATE INDEX IF NOT EXISTS "idx_exam_scores_studentId" ON "exam_scores" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_exam_scores_subjectId" ON "exam_scores" ("subjectId");

-- Table: exam_sessions
CREATE TABLE IF NOT EXISTS "exam_sessions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "academicTrackId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_exam_sessions_tenantId" ON "exam_sessions" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_exam_sessions_academicYearId" ON "exam_sessions" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_exam_sessions_schoolLevelId" ON "exam_sessions" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_exam_sessions_academicTrackId" ON "exam_sessions" ("academicTrackId");

-- Table: exam_staffs
CREATE TABLE IF NOT EXISTS "exam_staffs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "centerId" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "status" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_exam_staffs_tenantId" ON "exam_staffs" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_exam_staffs_centerId" ON "exam_staffs" ("centerId");

-- Table: exam_subject_files
CREATE TABLE IF NOT EXISTS "exam_subject_files" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileType" TEXT NOT NULL,
  "isEncrypted" INTEGER NOT NULL DEFAULT 1,
  "unlockCode" TEXT,
  "availableAt" TEXT,
  "status" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_exam_subject_files_tenantId" ON "exam_subject_files" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_exam_subject_files_subjectId" ON "exam_subject_files" ("subjectId");

-- Table: exam_subjects
CREATE TABLE IF NOT EXISTS "exam_subjects" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "classId" TEXT,
  "maxScore" REAL NOT NULL DEFAULT 20.0,
  "coefficient" REAL NOT NULL DEFAULT 1.0,
  "duration" INTEGER,
  "examDate" TEXT,
  "roomId" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_exam_subjects_tenantId" ON "exam_subjects" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_exam_subjects_academicYearId" ON "exam_subjects" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_exam_subjects_schoolLevelId" ON "exam_subjects" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_exam_subjects_examId" ON "exam_subjects" ("examId");
CREATE INDEX IF NOT EXISTS "idx_exam_subjects_subjectId" ON "exam_subjects" ("subjectId");
CREATE INDEX IF NOT EXISTS "idx_exam_subjects_classId" ON "exam_subjects" ("classId");
CREATE INDEX IF NOT EXISTS "idx_exam_subjects_roomId" ON "exam_subjects" ("roomId");

-- Table: exam_supervisors
CREATE TABLE IF NOT EXISTS "exam_supervisors" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "centerId" TEXT,
  "roomId" TEXT,
  "userId" TEXT,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "role" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "assignedDate" TEXT NOT NULL DEFAULT (datetime('now')),
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "createdBy" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_exam_supervisors_tenantId" ON "exam_supervisors" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_exam_supervisors_academicYearId" ON "exam_supervisors" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_exam_supervisors_examId" ON "exam_supervisors" ("examId");
CREATE INDEX IF NOT EXISTS "idx_exam_supervisors_centerId" ON "exam_supervisors" ("centerId");
CREATE INDEX IF NOT EXISTS "idx_exam_supervisors_roomId" ON "exam_supervisors" ("roomId");
CREATE INDEX IF NOT EXISTS "idx_exam_supervisors_userId" ON "exam_supervisors" ("userId");

-- Table: exams
CREATE TABLE IF NOT EXISTS "exams" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "academicTrackId" TEXT,
  "examSessionId" TEXT,
  "quarterId" TEXT,
  "classSubjectId" TEXT,
  "subjectId" TEXT NOT NULL,
  "classId" TEXT,
  "name" TEXT NOT NULL,
  "examType" TEXT NOT NULL,
  "examDate" TEXT NOT NULL,
  "maxScore" REAL NOT NULL DEFAULT 20.0,
  "coefficient" REAL NOT NULL DEFAULT 1.0,
  "description" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "language" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_exams_tenantId" ON "exams" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_exams_academicYearId" ON "exams" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_exams_schoolLevelId" ON "exams" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_exams_academicTrackId" ON "exams" ("academicTrackId");
CREATE INDEX IF NOT EXISTS "idx_exams_examSessionId" ON "exams" ("examSessionId");
CREATE INDEX IF NOT EXISTS "idx_exams_quarterId" ON "exams" ("quarterId");
CREATE INDEX IF NOT EXISTS "idx_exams_classSubjectId" ON "exams" ("classSubjectId");
CREATE INDEX IF NOT EXISTS "idx_exams_subjectId" ON "exams" ("subjectId");
CREATE INDEX IF NOT EXISTS "idx_exams_classId" ON "exams" ("classId");

-- Table: expense_categories
CREATE TABLE IF NOT EXISTS "expense_categories" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "schoolLevelId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "code" TEXT,
  "parentId" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "compteOhada" TEXT,
  "compteOhadaLib" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_expense_categories_tenantId" ON "expense_categories" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_expense_categories_academicYearId" ON "expense_categories" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_expense_categories_schoolLevelId" ON "expense_categories" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_expense_categories_parentId" ON "expense_categories" ("parentId");

-- Table: expenses
CREATE TABLE IF NOT EXISTS "expenses" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "schoolLevelId" TEXT NOT NULL,
  "categoryId" TEXT,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "expenseDate" TEXT NOT NULL,
  "paymentMethod" TEXT,
  "reference" TEXT,
  "status" TEXT NOT NULL,
  "approvedBy" TEXT,
  "approvedAt" TEXT,
  "attachmentUrl" TEXT,
  "createdBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_expenses_tenantId" ON "expenses" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_expenses_academicYearId" ON "expenses" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_expenses_schoolLevelId" ON "expenses" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_expenses_categoryId" ON "expenses" ("categoryId");

-- Table: federis_communities
CREATE TABLE IF NOT EXISTS "federis_communities" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "communityScope" TEXT NOT NULL,
  "ownerPatronatId" TEXT NOT NULL,
  "visibility" TEXT NOT NULL,
  "requiresApproval" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_federis_communities_ownerPatronatId" ON "federis_communities" ("ownerPatronatId");

-- Table: federis_community_members
CREATE TABLE IF NOT EXISTS "federis_community_members" (
  "id" TEXT PRIMARY KEY,
  "communityId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "joinedAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_federis_community_members_communityId" ON "federis_community_members" ("communityId");
CREATE INDEX IF NOT EXISTS "idx_federis_community_members_userId" ON "federis_community_members" ("userId");

-- Table: federis_community_posts
CREATE TABLE IF NOT EXISTS "federis_community_posts" (
  "id" TEXT PRIMARY KEY,
  "communityId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "postType" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_federis_community_posts_communityId" ON "federis_community_posts" ("communityId");
CREATE INDEX IF NOT EXISTS "idx_federis_community_posts_userId" ON "federis_community_posts" ("userId");

-- Table: federis_connect_events
CREATE TABLE IF NOT EXISTS "federis_connect_events" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "location" TEXT,
  "linkUrl" TEXT,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT,
  "eventType" TEXT NOT NULL,
  "visibility" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_federis_connect_events_tenantId" ON "federis_connect_events" ("tenantId");

-- Table: federis_connect_profiles
CREATE TABLE IF NOT EXISTS "federis_connect_profiles" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "displayName" TEXT,
  "avatarUrl" TEXT,
  "bio" TEXT,
  "preferences" TEXT,
  "status" TEXT NOT NULL,
  "lastSeenAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_federis_connect_profiles_userId" ON "federis_connect_profiles" ("userId");
CREATE INDEX IF NOT EXISTS "idx_federis_connect_profiles_tenantId" ON "federis_connect_profiles" ("tenantId");

-- Table: federis_conversation_participants
CREATE TABLE IF NOT EXISTS "federis_conversation_participants" (
  "id" TEXT PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "joinedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "lastReadAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_federis_conversation_participants_conversationId" ON "federis_conversation_participants" ("conversationId");
CREATE INDEX IF NOT EXISTS "idx_federis_conversation_participants_userId" ON "federis_conversation_participants" ("userId");

-- Table: federis_conversations
CREATE TABLE IF NOT EXISTS "federis_conversations" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "conversationType" TEXT NOT NULL,
  "title" TEXT,
  "scope" TEXT,
  "createdBy" TEXT NOT NULL,
  "patronatId" TEXT,
  "relatedSchoolId" TEXT,
  "relatedGroupId" TEXT,
  "relatedCommunityId" TEXT,
  "status" TEXT NOT NULL,
  "lastMessageAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_federis_conversations_tenantId" ON "federis_conversations" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_federis_conversations_patronatId" ON "federis_conversations" ("patronatId");
CREATE INDEX IF NOT EXISTS "idx_federis_conversations_relatedSchoolId" ON "federis_conversations" ("relatedSchoolId");
CREATE INDEX IF NOT EXISTS "idx_federis_conversations_relatedGroupId" ON "federis_conversations" ("relatedGroupId");
CREATE INDEX IF NOT EXISTS "idx_federis_conversations_relatedCommunityId" ON "federis_conversations" ("relatedCommunityId");

-- Table: federis_event_participants
CREATE TABLE IF NOT EXISTS "federis_event_participants" (
  "id" TEXT PRIMARY KEY,
  "eventId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "joinedAt" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_federis_event_participants_eventId" ON "federis_event_participants" ("eventId");
CREATE INDEX IF NOT EXISTS "idx_federis_event_participants_userId" ON "federis_event_participants" ("userId");

-- Table: federis_group_members
CREATE TABLE IF NOT EXISTS "federis_group_members" (
  "id" TEXT PRIMARY KEY,
  "groupId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "joinedAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_federis_group_members_groupId" ON "federis_group_members" ("groupId");
CREATE INDEX IF NOT EXISTS "idx_federis_group_members_userId" ON "federis_group_members" ("userId");

-- Table: federis_group_posts
CREATE TABLE IF NOT EXISTS "federis_group_posts" (
  "id" TEXT PRIMARY KEY,
  "groupId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_federis_group_posts_groupId" ON "federis_group_posts" ("groupId");
CREATE INDEX IF NOT EXISTS "idx_federis_group_posts_userId" ON "federis_group_posts" ("userId");

-- Table: federis_groups
CREATE TABLE IF NOT EXISTS "federis_groups" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "patronatId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "groupType" TEXT NOT NULL,
  "visibility" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_federis_groups_tenantId" ON "federis_groups" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_federis_groups_patronatId" ON "federis_groups" ("patronatId");

-- Table: federis_inter_patronat_connections
CREATE TABLE IF NOT EXISTS "federis_inter_patronat_connections" (
  "id" TEXT PRIMARY KEY,
  "requesterPatronatId" TEXT NOT NULL,
  "receiverPatronatId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "requestedBy" TEXT NOT NULL,
  "acceptedBy" TEXT,
  "requestedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "acceptedAt" TEXT,
  "rejectedAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_federis_inter_patronat_connections_requesterPatronatId" ON "federis_inter_patronat_connections" ("requesterPatronatId");
CREATE INDEX IF NOT EXISTS "idx_federis_inter_patronat_connections_receiverPatronatId" ON "federis_inter_patronat_connections" ("receiverPatronatId");

-- Table: federis_invoices
CREATE TABLE IF NOT EXISTS "federis_invoices" (
  "id" TEXT PRIMARY KEY,
  "patronatId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "currency" TEXT NOT NULL,
  "dueDate" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_federis_invoices_patronatId" ON "federis_invoices" ("patronatId");
CREATE INDEX IF NOT EXISTS "idx_federis_invoices_tenantId" ON "federis_invoices" ("tenantId");

-- Table: federis_message_actions
CREATE TABLE IF NOT EXISTS "federis_message_actions" (
  "id" TEXT PRIMARY KEY,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "completedAt" TEXT,
  "metadata" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_federis_message_actions_messageId" ON "federis_message_actions" ("messageId");
CREATE INDEX IF NOT EXISTS "idx_federis_message_actions_userId" ON "federis_message_actions" ("userId");

-- Table: federis_message_attachments
CREATE TABLE IF NOT EXISTS "federis_message_attachments" (
  "id" TEXT PRIMARY KEY,
  "messageId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileType" TEXT NOT NULL,
  "fileSize" INTEGER,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_federis_message_attachments_messageId" ON "federis_message_attachments" ("messageId");

-- Table: federis_message_reads
CREATE TABLE IF NOT EXISTS "federis_message_reads" (
  "id" TEXT PRIMARY KEY,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_federis_message_reads_messageId" ON "federis_message_reads" ("messageId");
CREATE INDEX IF NOT EXISTS "idx_federis_message_reads_userId" ON "federis_message_reads" ("userId");

-- Table: federis_messages
CREATE TABLE IF NOT EXISTS "federis_messages" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "senderUserId" TEXT NOT NULL,
  "senderEntityType" TEXT NOT NULL,
  "senderEntityId" TEXT,
  "content" TEXT NOT NULL,
  "messageType" TEXT NOT NULL,
  "requiresAction" INTEGER NOT NULL DEFAULT 0,
  "actionDeadline" TEXT,
  "parentMessageId" TEXT,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "deletedAt" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_federis_messages_tenantId" ON "federis_messages" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_federis_messages_conversationId" ON "federis_messages" ("conversationId");
CREATE INDEX IF NOT EXISTS "idx_federis_messages_senderUserId" ON "federis_messages" ("senderUserId");
CREATE INDEX IF NOT EXISTS "idx_federis_messages_senderEntityId" ON "federis_messages" ("senderEntityId");
CREATE INDEX IF NOT EXISTS "idx_federis_messages_parentMessageId" ON "federis_messages" ("parentMessageId");

-- Table: federis_notice_recipients
CREATE TABLE IF NOT EXISTS "federis_notice_recipients" (
  "id" TEXT PRIMARY KEY,
  "noticeId" TEXT NOT NULL,
  "schoolTenantId" TEXT,
  "userId" TEXT,
  "isRead" INTEGER NOT NULL DEFAULT 0,
  "readAt" TEXT,
  "acknowledgedAt" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_federis_notice_recipients_noticeId" ON "federis_notice_recipients" ("noticeId");
CREATE INDEX IF NOT EXISTS "idx_federis_notice_recipients_schoolTenantId" ON "federis_notice_recipients" ("schoolTenantId");
CREATE INDEX IF NOT EXISTS "idx_federis_notice_recipients_userId" ON "federis_notice_recipients" ("userId");

-- Table: federis_official_notices
CREATE TABLE IF NOT EXISTS "federis_official_notices" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "patronatId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "priority" TEXT NOT NULL,
  "requiresAcknowledgement" INTEGER NOT NULL DEFAULT 0,
  "scheduledAt" TEXT,
  "sentAt" TEXT,
  "createdBy" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_federis_official_notices_tenantId" ON "federis_official_notices" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_federis_official_notices_patronatId" ON "federis_official_notices" ("patronatId");

-- Table: federis_payments
CREATE TABLE IF NOT EXISTS "federis_payments" (
  "id" TEXT PRIMARY KEY,
  "invoiceId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "paymentDate" TEXT NOT NULL DEFAULT (datetime('now')),
  "method" TEXT NOT NULL,
  "transactionId" TEXT,
  "status" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_federis_payments_invoiceId" ON "federis_payments" ("invoiceId");
CREATE INDEX IF NOT EXISTS "idx_federis_payments_tenantId" ON "federis_payments" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_federis_payments_transactionId" ON "federis_payments" ("transactionId");

-- Table: federis_poll_options
CREATE TABLE IF NOT EXISTS "federis_poll_options" (
  "id" TEXT PRIMARY KEY,
  "pollId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "idx_federis_poll_options_pollId" ON "federis_poll_options" ("pollId");

-- Table: federis_poll_votes
CREATE TABLE IF NOT EXISTS "federis_poll_votes" (
  "id" TEXT PRIMARY KEY,
  "optionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_federis_poll_votes_optionId" ON "federis_poll_votes" ("optionId");
CREATE INDEX IF NOT EXISTS "idx_federis_poll_votes_userId" ON "federis_poll_votes" ("userId");

-- Table: federis_polls
CREATE TABLE IF NOT EXISTS "federis_polls" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "isMultiple" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TEXT,
  "visibility" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_federis_polls_tenantId" ON "federis_polls" ("tenantId");

-- Table: federis_post_comments
CREATE TABLE IF NOT EXISTS "federis_post_comments" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "communityPostId" TEXT,
  "groupPostId" TEXT,
  "content" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_federis_post_comments_userId" ON "federis_post_comments" ("userId");
CREATE INDEX IF NOT EXISTS "idx_federis_post_comments_communityPostId" ON "federis_post_comments" ("communityPostId");
CREATE INDEX IF NOT EXISTS "idx_federis_post_comments_groupPostId" ON "federis_post_comments" ("groupPostId");

-- Table: federis_post_reactions
CREATE TABLE IF NOT EXISTS "federis_post_reactions" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "communityPostId" TEXT,
  "groupPostId" TEXT,
  "type" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_federis_post_reactions_userId" ON "federis_post_reactions" ("userId");
CREATE INDEX IF NOT EXISTS "idx_federis_post_reactions_communityPostId" ON "federis_post_reactions" ("communityPostId");
CREATE INDEX IF NOT EXISTS "idx_federis_post_reactions_groupPostId" ON "federis_post_reactions" ("groupPostId");

-- Table: fee_arrears
CREATE TABLE IF NOT EXISTS "fee_arrears" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "studentFeeId" TEXT,
  "totalDue" REAL NOT NULL,
  "totalPaid" REAL NOT NULL DEFAULT 0,
  "balanceDue" REAL NOT NULL,
  "arrearsLevel" TEXT NOT NULL,
  "lastPaymentDate" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "notes" TEXT,
  "status" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_fee_arrears_tenantId" ON "fee_arrears" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_fee_arrears_academicYearId" ON "fee_arrears" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_fee_arrears_studentId" ON "fee_arrears" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_fee_arrears_studentFeeId" ON "fee_arrears" ("studentFeeId");

-- Table: fee_categories
CREATE TABLE IF NOT EXISTS "fee_categories" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "code" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "compteOhada" TEXT,
  "compteOhadaLib" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_fee_categories_tenantId" ON "fee_categories" ("tenantId");

-- Table: fee_configurations
CREATE TABLE IF NOT EXISTS "fee_configurations" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "feeType" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "level" TEXT,
  "classId" TEXT,
  "academicYearId" TEXT,
  "amount" REAL NOT NULL,
  "isRequired" INTEGER NOT NULL DEFAULT 1,
  "dueDate" TEXT,
  "createdBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_fee_configurations_tenantId" ON "fee_configurations" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_fee_configurations_schoolLevelId" ON "fee_configurations" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_fee_configurations_classId" ON "fee_configurations" ("classId");
CREATE INDEX IF NOT EXISTS "idx_fee_configurations_academicYearId" ON "fee_configurations" ("academicYearId");

-- Table: fee_definitions
CREATE TABLE IF NOT EXISTS "fee_definitions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "classId" TEXT,
  "feeCategoryId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "isMandatory" INTEGER NOT NULL DEFAULT 1,
  "dueDate" TEXT,
  "description" TEXT,
  "createdBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_fee_definitions_tenantId" ON "fee_definitions" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_fee_definitions_academicYearId" ON "fee_definitions" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_fee_definitions_schoolLevelId" ON "fee_definitions" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_fee_definitions_classId" ON "fee_definitions" ("classId");
CREATE INDEX IF NOT EXISTS "idx_fee_definitions_feeCategoryId" ON "fee_definitions" ("feeCategoryId");

-- Table: fee_installments
CREATE TABLE IF NOT EXISTS "fee_installments" (
  "id" TEXT PRIMARY KEY,
  "feeDefinitionId" TEXT NOT NULL,
  "installmentLabel" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "dueDate" TEXT NOT NULL,
  "orderIndex" INTEGER NOT NULL,
  "isMandatory" INTEGER NOT NULL DEFAULT 1,
  "description" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_fee_installments_feeDefinitionId" ON "fee_installments" ("feeDefinitionId");

-- Table: fee_overrides
CREATE TABLE IF NOT EXISTS "fee_overrides" (
  "id" TEXT PRIMARY KEY,
  "feeStructureId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "customAmount" REAL NOT NULL,
  "reason" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_fee_overrides_feeStructureId" ON "fee_overrides" ("feeStructureId");
CREATE INDEX IF NOT EXISTS "idx_fee_overrides_studentId" ON "fee_overrides" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_fee_overrides_createdById" ON "fee_overrides" ("createdById");

-- Table: fee_regime_rules
CREATE TABLE IF NOT EXISTS "fee_regime_rules" (
  "id" TEXT PRIMARY KEY,
  "feeRegimeId" TEXT NOT NULL,
  "feeType" TEXT NOT NULL,
  "discountType" TEXT NOT NULL,
  "discountValue" REAL NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_fee_regime_rules_feeRegimeId" ON "fee_regime_rules" ("feeRegimeId");

-- Table: fee_regimes
CREATE TABLE IF NOT EXISTS "fee_regimes" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "isDefault" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_fee_regimes_tenantId" ON "fee_regimes" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_fee_regimes_academicYearId" ON "fee_regimes" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_fee_regimes_schoolLevelId" ON "fee_regimes" ("schoolLevelId");

-- Table: fee_structure_installments
CREATE TABLE IF NOT EXISTS "fee_structure_installments" (
  "id" TEXT PRIMARY KEY,
  "feeStructureId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "dueDate" TEXT,
  "orderIndex" INTEGER NOT NULL,
  "dueDateType" TEXT NOT NULL,
  "daysOffset" INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_fee_structure_installments_feeStructureId" ON "fee_structure_installments" ("feeStructureId");

-- Table: fee_structures
CREATE TABLE IF NOT EXISTS "fee_structures" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "levelId" TEXT,
  "classId" TEXT,
  "name" TEXT NOT NULL,
  "feeType" TEXT NOT NULL,
  "totalAmount" REAL NOT NULL,
  "isInstallment" INTEGER NOT NULL DEFAULT 0,
  "isMandatory" INTEGER NOT NULL DEFAULT 1,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdById" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "customFeeTypeLabel" TEXT,
  "academicClassId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_fee_structures_tenantId" ON "fee_structures" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_fee_structures_academicYearId" ON "fee_structures" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_fee_structures_levelId" ON "fee_structures" ("levelId");
CREATE INDEX IF NOT EXISTS "idx_fee_structures_classId" ON "fee_structures" ("classId");
CREATE INDEX IF NOT EXISTS "idx_fee_structures_createdById" ON "fee_structures" ("createdById");
CREATE INDEX IF NOT EXISTS "idx_fee_structures_academicClassId" ON "fee_structures" ("academicClassId");

-- Table: finance_budgets
CREATE TABLE IF NOT EXISTS "finance_budgets" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "allocatedAmount" REAL NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_finance_budgets_tenantId" ON "finance_budgets" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_finance_budgets_academicYearId" ON "finance_budgets" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_finance_budgets_categoryId" ON "finance_budgets" ("categoryId");

-- Table: finance_daily_closures
CREATE TABLE IF NOT EXISTS "finance_daily_closures" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "totalIncome" REAL NOT NULL,
  "totalExpense" REAL NOT NULL,
  "netBalance" REAL NOT NULL,
  "closureType" TEXT NOT NULL,
  "validatedById" TEXT,
  "validatedAt" TEXT,
  "anomalyDetected" INTEGER NOT NULL DEFAULT 0,
  "anomalyNote" TEXT,
  "physicalAmount" REAL,
  "discrepancy" REAL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_finance_daily_closures_tenantId" ON "finance_daily_closures" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_finance_daily_closures_academicYearId" ON "finance_daily_closures" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_finance_daily_closures_validatedById" ON "finance_daily_closures" ("validatedById");

-- Table: finance_expenses
CREATE TABLE IF NOT EXISTS "finance_expenses" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "description" TEXT NOT NULL,
  "receiptUrl" TEXT,
  "status" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "approvedById" TEXT,
  "approvedAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "rejectReason" TEXT,
  "overBudget" INTEGER NOT NULL DEFAULT 0,
  "expenseDate" TEXT NOT NULL DEFAULT (datetime('now')),
  "vendor" TEXT,
  "invoiceRef" TEXT,
  "pendingApproverId" TEXT,
  "cashRegisterId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_finance_expenses_tenantId" ON "finance_expenses" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_finance_expenses_academicYearId" ON "finance_expenses" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_finance_expenses_categoryId" ON "finance_expenses" ("categoryId");
CREATE INDEX IF NOT EXISTS "idx_finance_expenses_requestedById" ON "finance_expenses" ("requestedById");
CREATE INDEX IF NOT EXISTS "idx_finance_expenses_approvedById" ON "finance_expenses" ("approvedById");
CREATE INDEX IF NOT EXISTS "idx_finance_expenses_pendingApproverId" ON "finance_expenses" ("pendingApproverId");
CREATE INDEX IF NOT EXISTS "idx_finance_expenses_cashRegisterId" ON "finance_expenses" ("cashRegisterId");

-- Table: finance_transaction_allocations
CREATE TABLE IF NOT EXISTS "finance_transaction_allocations" (
  "id" TEXT PRIMARY KEY,
  "financeTransactionId" TEXT NOT NULL,
  "accountBreakdownId" TEXT NOT NULL,
  "amount" REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_finance_transaction_allocations_financeTransactionId" ON "finance_transaction_allocations" ("financeTransactionId");
CREATE INDEX IF NOT EXISTS "idx_finance_transaction_allocations_accountBreakdownId" ON "finance_transaction_allocations" ("accountBreakdownId");

-- Table: finance_transactions
CREATE TABLE IF NOT EXISTS "finance_transactions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "studentAccountId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "paymentMethod" TEXT NOT NULL,
  "reference" TEXT,
  "reversedFromId" TEXT,
  "cashierId" TEXT NOT NULL,
  "deviceId" TEXT,
  "receiptNumber" TEXT NOT NULL,
  "receiptUrl" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "cashRegisterId" TEXT,
  "integrityHash" TEXT,
  "tenderedAmount" REAL,
  "changeGiven" REAL
);

CREATE INDEX IF NOT EXISTS "idx_finance_transactions_tenantId" ON "finance_transactions" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_finance_transactions_academicYearId" ON "finance_transactions" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_finance_transactions_studentAccountId" ON "finance_transactions" ("studentAccountId");
CREATE INDEX IF NOT EXISTS "idx_finance_transactions_reversedFromId" ON "finance_transactions" ("reversedFromId");
CREATE INDEX IF NOT EXISTS "idx_finance_transactions_cashierId" ON "finance_transactions" ("cashierId");
CREATE INDEX IF NOT EXISTS "idx_finance_transactions_deviceId" ON "finance_transactions" ("deviceId");
CREATE INDEX IF NOT EXISTS "idx_finance_transactions_cashRegisterId" ON "finance_transactions" ("cashRegisterId");

-- Table: financial_anomalies
CREATE TABLE IF NOT EXISTS "financial_anomalies" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "referenceId" TEXT NOT NULL,
  "detectedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "resolved" INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "idx_financial_anomalies_tenantId" ON "financial_anomalies" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_financial_anomalies_referenceId" ON "financial_anomalies" ("referenceId");

-- Table: financial_audit_logs
CREATE TABLE IF NOT EXISTS "financial_audit_logs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "oldValue" TEXT,
  "newValue" TEXT,
  "performedById" TEXT NOT NULL,
  "performedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "ipAddress" TEXT,
  "deviceId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_financial_audit_logs_tenantId" ON "financial_audit_logs" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_financial_audit_logs_entityId" ON "financial_audit_logs" ("entityId");
CREATE INDEX IF NOT EXISTS "idx_financial_audit_logs_performedById" ON "financial_audit_logs" ("performedById");
CREATE INDEX IF NOT EXISTS "idx_financial_audit_logs_deviceId" ON "financial_audit_logs" ("deviceId");

-- Table: financial_notes
CREATE TABLE IF NOT EXISTS "financial_notes" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "noteCode" TEXT NOT NULL,
  "noteTitle" TEXT NOT NULL,
  "lineLabel" TEXT NOT NULL,
  "amountN" REAL NOT NULL DEFAULT 0,
  "amountN1" REAL,
  "metadata" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_financial_notes_tenantId" ON "financial_notes" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_financial_notes_academicYearId" ON "financial_notes" ("academicYearId");

-- Table: financial_report_exports
CREATE TABLE IF NOT EXISTS "financial_report_exports" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "reportType" TEXT NOT NULL,
  "generatedById" TEXT NOT NULL,
  "generatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_financial_report_exports_tenantId" ON "financial_report_exports" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_financial_report_exports_academicYearId" ON "financial_report_exports" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_financial_report_exports_generatedById" ON "financial_report_exports" ("generatedById");

-- Table: financial_report_headers
CREATE TABLE IF NOT EXISTS "financial_report_headers" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "centreDepot" TEXT,
  "denominationSociale" TEXT,
  "sigleUsuel" TEXT,
  "exerciceClosLe" TEXT,
  "dureeExerciceMois" INTEGER,
  "adresse" TEXT,
  "numeroIF" TEXT,
  "greffe" TEXT,
  "numeroRC" TEXT,
  "numeroCCSS" TEXT,
  "numeroTelephone" TEXT,
  "adresseGeoComplete" TEXT,
  "formeJuridique" TEXT,
  "capitalSocial" TEXT,
  "nombreEmployes" INTEGER,
  "referentielBancaire" TEXT,
  "regimeFiscal" TEXT,
  "paysSiegeSocial" TEXT,
  "nbEtablissementsPays" INTEGER,
  "nbEtablissementsHorsPays" INTEGER,
  "premiereAnneeExercice" TEXT,
  "activiteDesignation" TEXT,
  "activiteLocalisation" TEXT,
  "nbSalaries" INTEGER,
  "chiffreAffaires" REAL,
  "partsMarcha" TEXT,
  "exportations" TEXT,
  "dirigeants" TEXT,
  "membresConseil" TEXT,
  "commissairesComptes" TEXT,
  "notesApplicables" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_financial_report_headers_tenantId" ON "financial_report_headers" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_financial_report_headers_academicYearId" ON "financial_report_headers" ("academicYearId");

-- Table: financial_settings
CREATE TABLE IF NOT EXISTS "financial_settings" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "blockingThreshold" REAL NOT NULL DEFAULT 0,
  "allowPartialPayment" INTEGER NOT NULL DEFAULT 1,
  "minimumInstallmentAmount" REAL,
  "autoClosureEnabled" INTEGER NOT NULL DEFAULT 1,
  "autoClosureTime" TEXT NOT NULL,
  "reminderWarningDays" INTEGER NOT NULL DEFAULT 3,
  "reminderUrgentDays" INTEGER NOT NULL DEFAULT 7,
  "reminderFinalDays" INTEGER NOT NULL DEFAULT 15,
  "cancellationDelayHours" INTEGER NOT NULL DEFAULT 24,
  "budgetAlertThreshold" INTEGER NOT NULL DEFAULT 85,
  "expenseReceiptThreshold" REAL,
  "fedapayEnabled" INTEGER NOT NULL DEFAULT 0,
  "fedapayPublicKey" TEXT,
  "fedapaySecretKey" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "autoRecoveryEnabled" INTEGER NOT NULL DEFAULT 0,
  "autoRecoveryChannels" TEXT NOT NULL,
  "autoRecoveryFrequency" TEXT NOT NULL,
  "autoRecoveryTime" TEXT NOT NULL,
  "autoRecoveryMaxLevel" TEXT NOT NULL,
  "comptaAutoExportEnabled" INTEGER NOT NULL DEFAULT 0,
  "comptaAutoExportEmail" TEXT,
  "comptaAutoExportFormat" TEXT NOT NULL,
  "comptaAutoExportDay" INTEGER NOT NULL DEFAULT 5,
  "comptaAutoExportLastSent" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_financial_settings_tenantId" ON "financial_settings" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_financial_settings_academicYearId" ON "financial_settings" ("academicYearId");

-- Table: financial_statements
CREATE TABLE IF NOT EXISTS "financial_statements" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "lineCode" TEXT NOT NULL,
  "lineLabel" TEXT NOT NULL,
  "note" TEXT,
  "amountN" REAL NOT NULL DEFAULT 0,
  "amountN1" REAL,
  "category" TEXT,
  "isSubtotal" INTEGER NOT NULL DEFAULT 0,
  "isTotal" INTEGER NOT NULL DEFAULT 0,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_financial_statements_tenantId" ON "financial_statements" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_financial_statements_academicYearId" ON "financial_statements" ("academicYearId");

-- Table: ged_document_versions
CREATE TABLE IF NOT EXISTS "ged_document_versions" (
  "id" TEXT PRIMARY KEY,
  "documentId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "filePath" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "mimeType" TEXT NOT NULL,
  "hash" TEXT,
  "createdById" TEXT,
  "academicYearId" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_ged_document_versions_documentId" ON "ged_document_versions" ("documentId");
CREATE INDEX IF NOT EXISTS "idx_ged_document_versions_createdById" ON "ged_document_versions" ("createdById");
CREATE INDEX IF NOT EXISTS "idx_ged_document_versions_academicYearId" ON "ged_document_versions" ("academicYearId");

-- Table: ged_documents
CREATE TABLE IF NOT EXISTS "ged_documents" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "schoolLevelId" TEXT,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "sourceType" TEXT,
  "sourceId" TEXT,
  "archivalStatus" TEXT NOT NULL,
  "retentionPolicy" TEXT,
  "metadata" TEXT,
  "createdById" TEXT,
  "validatedById" TEXT,
  "validatedAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_ged_documents_tenantId" ON "ged_documents" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_ged_documents_academicYearId" ON "ged_documents" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_ged_documents_schoolLevelId" ON "ged_documents" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_ged_documents_sourceId" ON "ged_documents" ("sourceId");
CREATE INDEX IF NOT EXISTS "idx_ged_documents_createdById" ON "ged_documents" ("createdById");
CREATE INDEX IF NOT EXISTS "idx_ged_documents_validatedById" ON "ged_documents" ("validatedById");

-- Table: generated_documents
CREATE TABLE IF NOT EXISTS "generated_documents" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "schoolLevelId" TEXT,
  "templateId" TEXT,
  "documentType" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "fileSize" INTEGER,
  "mimeType" TEXT,
  "metadata" TEXT,
  "generatedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_generated_documents_tenantId" ON "generated_documents" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_generated_documents_academicYearId" ON "generated_documents" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_generated_documents_schoolLevelId" ON "generated_documents" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_generated_documents_templateId" ON "generated_documents" ("templateId");

-- Table: global_pedagogical_resources
CREATE TABLE IF NOT EXISTS "global_pedagogical_resources" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" TEXT NOT NULL,
  "subjectArea" TEXT NOT NULL,
  "gradeLevel" TEXT NOT NULL,
  "tags" TEXT,
  "isPublished" INTEGER NOT NULL DEFAULT 0,
  "authorId" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_global_pedagogical_resources_authorId" ON "global_pedagogical_resources" ("authorId");

-- Table: global_resource_versions
CREATE TABLE IF NOT EXISTS "global_resource_versions" (
  "id" TEXT PRIMARY KEY,
  "resourceId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "changeLog" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_global_resource_versions_resourceId" ON "global_resource_versions" ("resourceId");

-- Table: grade_calculations
CREATE TABLE IF NOT EXISTS "grade_calculations" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "academicTrackId" TEXT,
  "studentId" TEXT NOT NULL,
  "subjectId" TEXT,
  "quarterId" TEXT,
  "calculationType" TEXT NOT NULL,
  "rawAverage" REAL NOT NULL,
  "weightedAverage" REAL NOT NULL,
  "finalGrade" REAL,
  "gradeRulesVersionId" TEXT,
  "calculatedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_grade_calculations_tenantId" ON "grade_calculations" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_grade_calculations_academicYearId" ON "grade_calculations" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_grade_calculations_schoolLevelId" ON "grade_calculations" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_grade_calculations_academicTrackId" ON "grade_calculations" ("academicTrackId");
CREATE INDEX IF NOT EXISTS "idx_grade_calculations_studentId" ON "grade_calculations" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_grade_calculations_subjectId" ON "grade_calculations" ("subjectId");
CREATE INDEX IF NOT EXISTS "idx_grade_calculations_quarterId" ON "grade_calculations" ("quarterId");
CREATE INDEX IF NOT EXISTS "idx_grade_calculations_gradeRulesVersionId" ON "grade_calculations" ("gradeRulesVersionId");

-- Table: grade_correction_requests
CREATE TABLE IF NOT EXISTS "grade_correction_requests" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "gradeId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_grade_correction_requests_tenantId" ON "grade_correction_requests" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_grade_correction_requests_gradeId" ON "grade_correction_requests" ("gradeId");

-- Table: grade_locks
CREATE TABLE IF NOT EXISTS "grade_locks" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "subjectId" TEXT,
  "lockType" TEXT NOT NULL,
  "lockedById" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_grade_locks_tenantId" ON "grade_locks" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_grade_locks_academicYearId" ON "grade_locks" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_grade_locks_periodId" ON "grade_locks" ("periodId");
CREATE INDEX IF NOT EXISTS "idx_grade_locks_classId" ON "grade_locks" ("classId");
CREATE INDEX IF NOT EXISTS "idx_grade_locks_subjectId" ON "grade_locks" ("subjectId");
CREATE INDEX IF NOT EXISTS "idx_grade_locks_lockedById" ON "grade_locks" ("lockedById");

-- Table: grade_rules_versions
CREATE TABLE IF NOT EXISTS "grade_rules_versions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "rules" TEXT NOT NULL,
  "isActive" INTEGER NOT NULL DEFAULT 0,
  "effectiveDate" TEXT NOT NULL,
  "createdBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_grade_rules_versions_tenantId" ON "grade_rules_versions" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_grade_rules_versions_academicYearId" ON "grade_rules_versions" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_grade_rules_versions_schoolLevelId" ON "grade_rules_versions" ("schoolLevelId");

-- Table: grade_scales
CREATE TABLE IF NOT EXISTS "grade_scales" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "minGrade" REAL NOT NULL,
  "maxGrade" REAL,
  "mention" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_grade_scales_tenantId" ON "grade_scales" ("tenantId");

-- Table: grade_validation_batches
CREATE TABLE IF NOT EXISTS "grade_validation_batches" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "evaluationId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "subjectId" TEXT,
  "status" TEXT NOT NULL,
  "submittedById" TEXT NOT NULL,
  "submittedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "reviewedById" TEXT,
  "reviewedAt" TEXT,
  "reviewComment" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_grade_validation_batches_tenantId" ON "grade_validation_batches" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_grade_validation_batches_academicYearId" ON "grade_validation_batches" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_grade_validation_batches_periodId" ON "grade_validation_batches" ("periodId");
CREATE INDEX IF NOT EXISTS "idx_grade_validation_batches_evaluationId" ON "grade_validation_batches" ("evaluationId");
CREATE INDEX IF NOT EXISTS "idx_grade_validation_batches_classId" ON "grade_validation_batches" ("classId");
CREATE INDEX IF NOT EXISTS "idx_grade_validation_batches_subjectId" ON "grade_validation_batches" ("subjectId");
CREATE INDEX IF NOT EXISTS "idx_grade_validation_batches_submittedById" ON "grade_validation_batches" ("submittedById");
CREATE INDEX IF NOT EXISTS "idx_grade_validation_batches_reviewedById" ON "grade_validation_batches" ("reviewedById");

-- Table: grades
CREATE TABLE IF NOT EXISTS "grades" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT,
  "academicTrackId" TEXT,
  "language" TEXT,
  "studentId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "examId" TEXT,
  "score" REAL,
  "maxScore" REAL NOT NULL DEFAULT 20.0,
  "coefficient" REAL NOT NULL DEFAULT 1.0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "classId" TEXT,
  "comment" TEXT,
  "evaluationId" TEXT,
  "isAbsent" INTEGER NOT NULL DEFAULT 0,
  "periodId" TEXT,
  "qualitativeCode" TEXT,
  "status" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_grades_tenantId" ON "grades" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_grades_academicYearId" ON "grades" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_grades_schoolLevelId" ON "grades" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_grades_academicTrackId" ON "grades" ("academicTrackId");
CREATE INDEX IF NOT EXISTS "idx_grades_studentId" ON "grades" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_grades_subjectId" ON "grades" ("subjectId");
CREATE INDEX IF NOT EXISTS "idx_grades_examId" ON "grades" ("examId");
CREATE INDEX IF NOT EXISTS "idx_grades_classId" ON "grades" ("classId");
CREATE INDEX IF NOT EXISTS "idx_grades_evaluationId" ON "grades" ("evaluationId");
CREATE INDEX IF NOT EXISTS "idx_grades_periodId" ON "grades" ("periodId");

-- Table: grading_policies
CREATE TABLE IF NOT EXISTS "grading_policies" (
  "id" TEXT PRIMARY KEY,
  "countryId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "educationLevel" TEXT NOT NULL,
  "maxScore" REAL NOT NULL,
  "passingScore" REAL NOT NULL,
  "gradeScales" TEXT NOT NULL,
  "calculationRules" TEXT,
  "reportCardConfig" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "isDefault" INTEGER NOT NULL DEFAULT 0,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_grading_policies_countryId" ON "grading_policies" ("countryId");

-- Table: guardians
CREATE TABLE IF NOT EXISTS "guardians" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "relationship" TEXT,
  "address" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_guardians_tenantId" ON "guardians" ("tenantId");

-- Table: homework_entries
CREATE TABLE IF NOT EXISTS "homework_entries" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "academicTrackId" TEXT,
  "lessonPlanId" TEXT,
  "classId" TEXT,
  "subjectId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "dueDate" TEXT NOT NULL,
  "maxScore" REAL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_homework_entries_tenantId" ON "homework_entries" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_homework_entries_academicYearId" ON "homework_entries" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_homework_entries_schoolLevelId" ON "homework_entries" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_homework_entries_academicTrackId" ON "homework_entries" ("academicTrackId");
CREATE INDEX IF NOT EXISTS "idx_homework_entries_lessonPlanId" ON "homework_entries" ("lessonPlanId");
CREATE INDEX IF NOT EXISTS "idx_homework_entries_classId" ON "homework_entries" ("classId");
CREATE INDEX IF NOT EXISTS "idx_homework_entries_subjectId" ON "homework_entries" ("subjectId");

-- Table: homework_submissions
CREATE TABLE IF NOT EXISTS "homework_submissions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "homeworkId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "content" TEXT,
  "attachments" TEXT,
  "submittedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "score" REAL,
  "maxScore" REAL,
  "feedback" TEXT,
  "gradedAt" TEXT,
  "gradedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_homework_submissions_tenantId" ON "homework_submissions" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_homework_submissions_academicYearId" ON "homework_submissions" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_homework_submissions_schoolLevelId" ON "homework_submissions" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_homework_submissions_homeworkId" ON "homework_submissions" ("homeworkId");
CREATE INDEX IF NOT EXISTS "idx_homework_submissions_studentId" ON "homework_submissions" ("studentId");

-- Table: honor_rolls
CREATE TABLE IF NOT EXISTS "honor_rolls" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "academicTrackId" TEXT,
  "classId" TEXT,
  "quarterId" TEXT,
  "studentId" TEXT NOT NULL,
  "mention" TEXT NOT NULL,
  "category" TEXT,
  "average" REAL NOT NULL,
  "rank" INTEGER NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_honor_rolls_tenantId" ON "honor_rolls" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_honor_rolls_academicYearId" ON "honor_rolls" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_honor_rolls_schoolLevelId" ON "honor_rolls" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_honor_rolls_academicTrackId" ON "honor_rolls" ("academicTrackId");
CREATE INDEX IF NOT EXISTS "idx_honor_rolls_classId" ON "honor_rolls" ("classId");
CREATE INDEX IF NOT EXISTS "idx_honor_rolls_quarterId" ON "honor_rolls" ("quarterId");
CREATE INDEX IF NOT EXISTS "idx_honor_rolls_studentId" ON "honor_rolls" ("studentId");

-- Table: hr_academic_profiles
CREATE TABLE IF NOT EXISTS "hr_academic_profiles" (
  "id" TEXT PRIMARY KEY,
  "candidateId" TEXT NOT NULL,
  "teachingLevel" TEXT NOT NULL,
  "subjects" TEXT,
  "pedagogicalExperience" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_hr_academic_profiles_candidateId" ON "hr_academic_profiles" ("candidateId");

-- Table: hr_academic_scores
CREATE TABLE IF NOT EXISTS "hr_academic_scores" (
  "id" TEXT PRIMARY KEY,
  "candidateId" TEXT NOT NULL,
  "pedagogicalScore" INTEGER NOT NULL,
  "academicScore" INTEGER NOT NULL,
  "globalScore" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_hr_academic_scores_candidateId" ON "hr_academic_scores" ("candidateId");

-- Table: hr_ai_reports
CREATE TABLE IF NOT EXISTS "hr_ai_reports" (
  "id" TEXT PRIMARY KEY,
  "candidateId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "reportType" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "generatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_hr_ai_reports_candidateId" ON "hr_ai_reports" ("candidateId");
CREATE INDEX IF NOT EXISTS "idx_hr_ai_reports_applicationId" ON "hr_ai_reports" ("applicationId");

-- Table: hr_applications
CREATE TABLE IF NOT EXISTS "hr_applications" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 0,
  "scoreCV" INTEGER NOT NULL DEFAULT 0,
  "scoreLetter" INTEGER NOT NULL DEFAULT 0,
  "scoreMatching" INTEGER NOT NULL DEFAULT 0,
  "risks" TEXT NOT NULL,
  "riskDetail" TEXT,
  "matchDetail" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "staffId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_hr_applications_tenantId" ON "hr_applications" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_hr_applications_jobId" ON "hr_applications" ("jobId");
CREATE INDEX IF NOT EXISTS "idx_hr_applications_candidateId" ON "hr_applications" ("candidateId");
CREATE INDEX IF NOT EXISTS "idx_hr_applications_staffId" ON "hr_applications" ("staffId");

-- Table: hr_candidate_documents
CREATE TABLE IF NOT EXISTS "hr_candidate_documents" (
  "id" TEXT PRIMARY KEY,
  "candidateId" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "fileSize" INTEGER,
  "mimeType" TEXT,
  "category" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_hr_candidate_documents_candidateId" ON "hr_candidate_documents" ("candidateId");

-- Table: hr_candidates
CREATE TABLE IF NOT EXISTS "hr_candidates" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "address" TEXT,
  "gender" TEXT,
  "dateOfBirth" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "country" TEXT,
  "city" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_hr_candidates_tenantId" ON "hr_candidates" ("tenantId");

-- Table: hr_document_upload_tokens
CREATE TABLE IF NOT EXISTS "hr_document_upload_tokens" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "candidate_id" TEXT NOT NULL,
  "staff_id" TEXT,
  "token" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "required_docs" TEXT NOT NULL,
  "uploaded_docs" TEXT,
  "expires_at" TEXT,
  "completed_at" TEXT,
  "candidate_email" TEXT,
  "candidate_name" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_hr_document_upload_tokens_tenant_id" ON "hr_document_upload_tokens" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_hr_document_upload_tokens_candidate_id" ON "hr_document_upload_tokens" ("candidate_id");
CREATE INDEX IF NOT EXISTS "idx_hr_document_upload_tokens_staff_id" ON "hr_document_upload_tokens" ("staff_id");

-- Table: hr_interviews
CREATE TABLE IF NOT EXISTS "hr_interviews" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "time" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "evaluator" TEXT NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 0,
  "comments" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "result" TEXT,
  "feedback" TEXT,
  "meetingLink" TEXT,
  "phoneNumber" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_hr_interviews_tenantId" ON "hr_interviews" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_hr_interviews_candidateId" ON "hr_interviews" ("candidateId");

-- Table: hr_jobs
CREATE TABLE IF NOT EXISTS "hr_jobs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "ref" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "dept" TEXT NOT NULL,
  "loc" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "description" TEXT,
  "missions" TEXT,
  "responsibilities" TEXT,
  "academicLevel" TEXT,
  "experience" TEXT,
  "skillsRequired" TEXT,
  "salary" TEXT,
  "contractType" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "publishedAt" TEXT,
  "assets" TEXT,
  "schoolLevelCode" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_hr_jobs_tenantId" ON "hr_jobs" ("tenantId");

-- Table: hr_staff_cards
CREATE TABLE IF NOT EXISTS "hr_staff_cards" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "staff_id" TEXT NOT NULL,
  "card_type" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "pdf_url" TEXT,
  "qr_data" TEXT,
  "expires_at" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_hr_staff_cards_tenant_id" ON "hr_staff_cards" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_hr_staff_cards_staff_id" ON "hr_staff_cards" ("staff_id");

-- Table: hr_talent_pool
CREATE TABLE IF NOT EXISTS "hr_talent_pool" (
  "id" TEXT PRIMARY KEY,
  "candidateId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_hr_talent_pool_candidateId" ON "hr_talent_pool" ("candidateId");

-- Table: hr_teaching_certifications
CREATE TABLE IF NOT EXISTS "hr_teaching_certifications" (
  "id" TEXT PRIMARY KEY,
  "candidateId" TEXT NOT NULL,
  "certificationName" TEXT NOT NULL,
  "issuer" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_hr_teaching_certifications_candidateId" ON "hr_teaching_certifications" ("candidateId");

-- Table: hr_test_questionnaires
CREATE TABLE IF NOT EXISTS "hr_test_questionnaires" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "test_id" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "duration_minutes" INTEGER NOT NULL DEFAULT 30,
  "questions" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "passing_score" INTEGER DEFAULT 60,
  "max_score" INTEGER DEFAULT 100,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "test_type" TEXT,
  "instructions" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_hr_test_questionnaires_tenant_id" ON "hr_test_questionnaires" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_hr_test_questionnaires_test_id" ON "hr_test_questionnaires" ("test_id");

-- Table: hr_test_responses
CREATE TABLE IF NOT EXISTS "hr_test_responses" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "questionnaire_id" TEXT NOT NULL,
  "candidate_id" TEXT NOT NULL,
  "application_id" TEXT,
  "token" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "started_at" TEXT,
  "submitted_at" TEXT,
  "expires_at" TEXT,
  "responses" TEXT,
  "auto_score" INTEGER,
  "auto_score_max" INTEGER,
  "recruiter_score" INTEGER,
  "recruiter_feedback" TEXT,
  "recruiter_scored_at" TEXT,
  "candidate_email" TEXT,
  "candidate_name" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_hr_test_responses_tenant_id" ON "hr_test_responses" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_hr_test_responses_questionnaire_id" ON "hr_test_responses" ("questionnaire_id");
CREATE INDEX IF NOT EXISTS "idx_hr_test_responses_candidate_id" ON "hr_test_responses" ("candidate_id");
CREATE INDEX IF NOT EXISTS "idx_hr_test_responses_application_id" ON "hr_test_responses" ("application_id");

-- Table: hr_test_results
CREATE TABLE IF NOT EXISTS "hr_test_results" (
  "id" TEXT PRIMARY KEY,
  "testId" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "result" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "notes" TEXT,
  "evaluatedAt" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_hr_test_results_testId" ON "hr_test_results" ("testId");
CREATE INDEX IF NOT EXISTS "idx_hr_test_results_candidateId" ON "hr_test_results" ("candidateId");

-- Table: hr_tests
CREATE TABLE IF NOT EXISTS "hr_tests" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "duration" INTEGER,
  "instructions" TEXT,
  "maxScore" INTEGER NOT NULL DEFAULT 100,
  "passingScore" INTEGER NOT NULL DEFAULT 50,
  "status" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_hr_tests_tenantId" ON "hr_tests" ("tenantId");

-- Table: in_app_notifications
CREATE TABLE IF NOT EXISTS "in_app_notifications" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "priority" TEXT NOT NULL,
  "data" TEXT,
  "relatedEntityType" TEXT,
  "relatedEntityId" TEXT,
  "isRead" INTEGER NOT NULL DEFAULT 0,
  "readAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_in_app_notifications_tenantId" ON "in_app_notifications" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_in_app_notifications_recipientId" ON "in_app_notifications" ("recipientId");
CREATE INDEX IF NOT EXISTS "idx_in_app_notifications_relatedEntityId" ON "in_app_notifications" ("relatedEntityId");

-- Table: inbound_emails
CREATE TABLE IF NOT EXISTS "inbound_emails" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "originalEmailId" TEXT,
  "threadId" TEXT,
  "fromEmail" TEXT NOT NULL,
  "fromName" TEXT,
  "toEmail" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "textContent" TEXT,
  "htmlContent" TEXT,
  "attachments" TEXT,
  "providerId" TEXT,
  "rawHeaders" TEXT,
  "status" TEXT NOT NULL,
  "errorMessage" TEXT,
  "receivedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "processedAt" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_inbound_emails_tenantId" ON "inbound_emails" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_inbound_emails_originalEmailId" ON "inbound_emails" ("originalEmailId");
CREATE INDEX IF NOT EXISTS "idx_inbound_emails_threadId" ON "inbound_emails" ("threadId");
CREATE INDEX IF NOT EXISTS "idx_inbound_emails_providerId" ON "inbound_emails" ("providerId");

-- Table: incident_actions
CREATE TABLE IF NOT EXISTS "incident_actions" (
  "id" TEXT PRIMARY KEY,
  "incidentId" TEXT NOT NULL,
  "actionDescription" TEXT NOT NULL,
  "responsibleUserId" TEXT,
  "dueDate" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "completedAt" TEXT,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_incident_actions_incidentId" ON "incident_actions" ("incidentId");
CREATE INDEX IF NOT EXISTS "idx_incident_actions_responsibleUserId" ON "incident_actions" ("responsibleUserId");

-- Table: incident_attachments
CREATE TABLE IF NOT EXISTS "incident_attachments" (
  "id" TEXT PRIMARY KEY,
  "incidentId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "fileSize" INTEGER,
  "mimeType" TEXT,
  "uploadedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_incident_attachments_incidentId" ON "incident_attachments" ("incidentId");

-- Table: incidents
CREATE TABLE IF NOT EXISTS "incidents" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT,
  "studentId" TEXT,
  "classId" TEXT,
  "inspectionId" TEXT,
  "incidentType" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "occurredAt" TEXT NOT NULL,
  "location" TEXT,
  "reportedByUserId" TEXT,
  "status" TEXT NOT NULL,
  "closedAt" TEXT,
  "closedByUserId" TEXT,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_incidents_tenantId" ON "incidents" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_incidents_academicYearId" ON "incidents" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_incidents_schoolLevelId" ON "incidents" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_incidents_studentId" ON "incidents" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_incidents_classId" ON "incidents" ("classId");
CREATE INDEX IF NOT EXISTS "idx_incidents_inspectionId" ON "incidents" ("inspectionId");
CREATE INDEX IF NOT EXISTS "idx_incidents_reportedByUserId" ON "incidents" ("reportedByUserId");
CREATE INDEX IF NOT EXISTS "idx_incidents_closedByUserId" ON "incidents" ("closedByUserId");

-- Table: infirmary_access_logs
CREATE TABLE IF NOT EXISTS "infirmary_access_logs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "accessType" TEXT NOT NULL,
  "reason" TEXT,
  "ipAddress" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_infirmary_access_logs_tenantId" ON "infirmary_access_logs" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_infirmary_access_logs_userId" ON "infirmary_access_logs" ("userId");
CREATE INDEX IF NOT EXISTS "idx_infirmary_access_logs_studentId" ON "infirmary_access_logs" ("studentId");

-- Table: infirmary_allergies
CREATE TABLE IF NOT EXISTS "infirmary_allergies" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "allergyType" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "allergen" TEXT NOT NULL,
  "specificInstructions" TEXT,
  "emergencyContact" TEXT,
  "documentPath" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_infirmary_allergies_tenantId" ON "infirmary_allergies" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_infirmary_allergies_studentId" ON "infirmary_allergies" ("studentId");

-- Table: infirmary_authorizations
CREATE TABLE IF NOT EXISTS "infirmary_authorizations" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "parentId" TEXT,
  "authorizationType" TEXT NOT NULL,
  "validFrom" TEXT NOT NULL,
  "validUntil" TEXT,
  "documentPath" TEXT,
  "signature" TEXT,
  "status" TEXT NOT NULL,
  "validatedAt" TEXT,
  "validatedBy" TEXT,
  "observation" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_infirmary_authorizations_tenantId" ON "infirmary_authorizations" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_infirmary_authorizations_studentId" ON "infirmary_authorizations" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_infirmary_authorizations_parentId" ON "infirmary_authorizations" ("parentId");

-- Table: infirmary_checkups
CREATE TABLE IF NOT EXISTS "infirmary_checkups" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "checkupDate" TEXT NOT NULL,
  "checkupType" TEXT NOT NULL,
  "targetClassIds" TEXT,
  "targetStudentIds" TEXT,
  "healthProvider" TEXT,
  "location" TEXT,
  "purpose" TEXT,
  "syntheticResults" TEXT,
  "recommendations" TEXT,
  "documentPaths" TEXT,
  "parentsNotified" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL,
  "createdBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_infirmary_checkups_tenantId" ON "infirmary_checkups" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_infirmary_checkups_academicYearId" ON "infirmary_checkups" ("academicYearId");

-- Table: infirmary_contraindications
CREATE TABLE IF NOT EXISTS "infirmary_contraindications" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "contraindicationType" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "forbiddenActivity" TEXT,
  "forbiddenMedication" TEXT,
  "forbiddenFood" TEXT,
  "severity" TEXT NOT NULL,
  "documentPath" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_infirmary_contraindications_tenantId" ON "infirmary_contraindications" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_infirmary_contraindications_studentId" ON "infirmary_contraindications" ("studentId");

-- Table: infirmary_emergencies
CREATE TABLE IF NOT EXISTS "infirmary_emergencies" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "classId" TEXT,
  "incidentDate" TEXT NOT NULL,
  "incidentTime" TEXT NOT NULL,
  "location" TEXT,
  "incidentType" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "firstAidGiven" TEXT,
  "parentContacted" INTEGER NOT NULL DEFAULT 0,
  "directionInformed" INTEGER NOT NULL DEFAULT 0,
  "externalServiceCalled" INTEGER NOT NULL DEFAULT 0,
  "transferPerformed" INTEGER NOT NULL DEFAULT 0,
  "transferDestination" TEXT,
  "reportFilePath" TEXT,
  "status" TEXT NOT NULL,
  "relatedModule" TEXT,
  "relatedRecordId" TEXT,
  "reportedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_infirmary_emergencies_tenantId" ON "infirmary_emergencies" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_infirmary_emergencies_academicYearId" ON "infirmary_emergencies" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_infirmary_emergencies_studentId" ON "infirmary_emergencies" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_infirmary_emergencies_classId" ON "infirmary_emergencies" ("classId");
CREATE INDEX IF NOT EXISTS "idx_infirmary_emergencies_relatedRecordId" ON "infirmary_emergencies" ("relatedRecordId");

-- Table: infirmary_medical_records
CREATE TABLE IF NOT EXISTS "infirmary_medical_records" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "bloodType" TEXT,
  "emergencyContact" TEXT,
  "emergencyPhone" TEXT,
  "knownDiseases" TEXT,
  "currentTreatments" TEXT,
  "treatingPhysician" TEXT,
  "healthInsurance" TEXT,
  "insuranceNumber" TEXT,
  "medicalDocuments" TEXT,
  "observations" TEXT,
  "status" TEXT NOT NULL,
  "lastUpdatedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_infirmary_medical_records_tenantId" ON "infirmary_medical_records" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_infirmary_medical_records_studentId" ON "infirmary_medical_records" ("studentId");

-- Table: infirmary_medication_movements
CREATE TABLE IF NOT EXISTS "infirmary_medication_movements" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "stockId" TEXT NOT NULL,
  "studentId" TEXT,
  "movementType" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "reason" TEXT,
  "performedBy" TEXT,
  "authorizedBy" TEXT,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_infirmary_medication_movements_tenantId" ON "infirmary_medication_movements" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_infirmary_medication_movements_academicYearId" ON "infirmary_medication_movements" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_infirmary_medication_movements_stockId" ON "infirmary_medication_movements" ("stockId");
CREATE INDEX IF NOT EXISTS "idx_infirmary_medication_movements_studentId" ON "infirmary_medication_movements" ("studentId");

-- Table: infirmary_medication_stocks
CREATE TABLE IF NOT EXISTS "infirmary_medication_stocks" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "unit" TEXT,
  "alertThreshold" INTEGER NOT NULL DEFAULT 5,
  "entryDate" TEXT NOT NULL,
  "expiryDate" TEXT,
  "supplier" TEXT,
  "location" TEXT,
  "storageConditions" TEXT,
  "status" TEXT NOT NULL,
  "observation" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_infirmary_medication_stocks_tenantId" ON "infirmary_medication_stocks" ("tenantId");

-- Table: infirmary_reports
CREATE TABLE IF NOT EXISTS "infirmary_reports" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "reportType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "periodStart" TEXT,
  "periodEnd" TEXT,
  "content" TEXT,
  "filePath" TEXT,
  "generatedBy" TEXT,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_infirmary_reports_tenantId" ON "infirmary_reports" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_infirmary_reports_academicYearId" ON "infirmary_reports" ("academicYearId");

-- Table: infirmary_settings
CREATE TABLE IF NOT EXISTS "infirmary_settings" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_infirmary_settings_tenantId" ON "infirmary_settings" ("tenantId");

-- Table: infirmary_visits
CREATE TABLE IF NOT EXISTS "infirmary_visits" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "classId" TEXT,
  "visitDate" TEXT NOT NULL,
  "arrivalTime" TEXT NOT NULL,
  "departureTime" TEXT,
  "reason" TEXT NOT NULL,
  "symptoms" TEXT,
  "actionTaken" TEXT,
  "medicationGiven" TEXT,
  "restGranted" INTEGER NOT NULL DEFAULT 0,
  "returnedToClass" INTEGER NOT NULL DEFAULT 0,
  "parentContacted" INTEGER NOT NULL DEFAULT 0,
  "directionInformed" INTEGER NOT NULL DEFAULT 0,
  "observation" TEXT,
  "status" TEXT NOT NULL,
  "recordedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_infirmary_visits_tenantId" ON "infirmary_visits" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_infirmary_visits_academicYearId" ON "infirmary_visits" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_infirmary_visits_studentId" ON "infirmary_visits" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_infirmary_visits_classId" ON "infirmary_visits" ("classId");

-- Table: inspection_checklists
CREATE TABLE IF NOT EXISTS "inspection_checklists" (
  "id" TEXT PRIMARY KEY,
  "inspectionId" TEXT NOT NULL,
  "itemLabel" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_inspection_checklists_inspectionId" ON "inspection_checklists" ("inspectionId");

-- Table: inspections
CREATE TABLE IF NOT EXISTS "inspections" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "schoolLevelId" TEXT,
  "inspectionType" TEXT NOT NULL,
  "inspectorName" TEXT,
  "inspectionDate" TEXT NOT NULL,
  "summary" TEXT,
  "status" TEXT NOT NULL,
  "followUpDate" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_inspections_tenantId" ON "inspections" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_inspections_academicYearId" ON "inspections" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_inspections_schoolLevelId" ON "inspections" ("schoolLevelId");

-- Table: job_number_sequences
CREATE TABLE IF NOT EXISTS "job_number_sequences" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "current" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_job_number_sequences_tenantId" ON "job_number_sequences" ("tenantId");

-- Table: kindergarten_evaluation_domains
CREATE TABLE IF NOT EXISTS "kindergarten_evaluation_domains" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "isDefault" INTEGER NOT NULL DEFAULT 0,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_kindergarten_evaluation_domains_tenantId" ON "kindergarten_evaluation_domains" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_kindergarten_evaluation_domains_academicYearId" ON "kindergarten_evaluation_domains" ("academicYearId");

-- Table: kpi_definitions
CREATE TABLE IF NOT EXISTS "kpi_definitions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT,
  "academicYearId" TEXT,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "scope" TEXT NOT NULL,
  "category" TEXT,
  "unit" TEXT,
  "formula" TEXT,
  "isSystem" INTEGER NOT NULL DEFAULT 0,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_kpi_definitions_tenantId" ON "kpi_definitions" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_kpi_definitions_academicYearId" ON "kpi_definitions" ("academicYearId");

-- Table: kpi_objectives
CREATE TABLE IF NOT EXISTS "kpi_objectives" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT,
  "kpiId" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "targetValue" REAL NOT NULL,
  "minAcceptable" REAL,
  "maxAcceptable" REAL,
  "status" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_kpi_objectives_tenantId" ON "kpi_objectives" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_kpi_objectives_academicYearId" ON "kpi_objectives" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_kpi_objectives_schoolLevelId" ON "kpi_objectives" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_kpi_objectives_kpiId" ON "kpi_objectives" ("kpiId");
CREATE INDEX IF NOT EXISTS "idx_kpi_objectives_createdById" ON "kpi_objectives" ("createdById");

-- Table: kpi_snapshots
CREATE TABLE IF NOT EXISTS "kpi_snapshots" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "schoolLevelId" TEXT,
  "kpiId" TEXT NOT NULL,
  "value" REAL NOT NULL,
  "period" TEXT,
  "metadata" TEXT,
  "computedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_kpi_snapshots_tenantId" ON "kpi_snapshots" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_kpi_snapshots_academicYearId" ON "kpi_snapshots" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_kpi_snapshots_schoolLevelId" ON "kpi_snapshots" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_kpi_snapshots_kpiId" ON "kpi_snapshots" ("kpiId");

-- Table: lab_consumables
CREATE TABLE IF NOT EXISTS "lab_consumables" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "labId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT,
  "quantity" REAL NOT NULL DEFAULT 0,
  "unit" TEXT NOT NULL,
  "alertThreshold" REAL NOT NULL DEFAULT 10,
  "expiryDate" TEXT,
  "lastRestockDate" TEXT,
  "location" TEXT,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_lab_consumables_tenantId" ON "lab_consumables" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_lab_consumables_labId" ON "lab_consumables" ("labId");

-- Table: lab_equipment
CREATE TABLE IF NOT EXISTS "lab_equipment" (
  "id" TEXT PRIMARY KEY,
  "labId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "manufacturer" TEXT,
  "model" TEXT,
  "serialNumber" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "condition" TEXT NOT NULL,
  "lastMaintenance" TEXT,
  "nextMaintenance" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "acquisitionDate" TEXT,
  "category" TEXT,
  "cost" REAL,
  "inventoryNumber" TEXT,
  "location" TEXT,
  "photoUrl" TEXT,
  "supplier" TEXT,
  "techSheetUrl" TEXT,
  "tenantId" TEXT NOT NULL,
  "warranty" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_lab_equipment_labId" ON "lab_equipment" ("labId");
CREATE INDEX IF NOT EXISTS "idx_lab_equipment_academicYearId" ON "lab_equipment" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_lab_equipment_tenantId" ON "lab_equipment" ("tenantId");

-- Table: lab_incidents
CREATE TABLE IF NOT EXISTS "lab_incidents" (
  "id" TEXT PRIMARY KEY,
  "equipmentId" TEXT,
  "incidentDate" TEXT NOT NULL,
  "incidentType" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "resolved" INTEGER NOT NULL DEFAULT 0,
  "resolvedAt" TEXT,
  "reportedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "labId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_lab_incidents_equipmentId" ON "lab_incidents" ("equipmentId");
CREATE INDEX IF NOT EXISTS "idx_lab_incidents_labId" ON "lab_incidents" ("labId");
CREATE INDEX IF NOT EXISTS "idx_lab_incidents_tenantId" ON "lab_incidents" ("tenantId");

-- Table: lab_maintenance
CREATE TABLE IF NOT EXISTS "lab_maintenance" (
  "id" TEXT PRIMARY KEY,
  "equipmentId" TEXT NOT NULL,
  "maintenanceDate" TEXT NOT NULL,
  "maintenanceType" TEXT NOT NULL,
  "description" TEXT,
  "cost" REAL,
  "performedBy" TEXT,
  "nextMaintenance" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_lab_maintenance_equipmentId" ON "lab_maintenance" ("equipmentId");
CREATE INDEX IF NOT EXISTS "idx_lab_maintenance_tenantId" ON "lab_maintenance" ("tenantId");

-- Table: lab_purchase_requests
CREATE TABLE IF NOT EXISTS "lab_purchase_requests" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "requesterId" TEXT,
  "itemName" TEXT NOT NULL,
  "itemType" TEXT NOT NULL,
  "quantity" REAL NOT NULL,
  "estimatedCost" REAL,
  "reason" TEXT,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_lab_purchase_requests_tenantId" ON "lab_purchase_requests" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_lab_purchase_requests_requesterId" ON "lab_purchase_requests" ("requesterId");

-- Table: lab_reports
CREATE TABLE IF NOT EXISTS "lab_reports" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "labId" TEXT NOT NULL,
  "reportType" TEXT NOT NULL,
  "periodStart" TEXT,
  "periodEnd" TEXT,
  "content" TEXT,
  "generatedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_lab_reports_tenantId" ON "lab_reports" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_lab_reports_labId" ON "lab_reports" ("labId");

-- Table: lab_reservations
CREATE TABLE IF NOT EXISTS "lab_reservations" (
  "id" TEXT PRIMARY KEY,
  "labId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "reservedBy" TEXT,
  "reservationDate" TEXT NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "purpose" TEXT,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "classId" TEXT,
  "consumablesNeeded" TEXT,
  "equipmentsNeeded" TEXT,
  "needsAssistance" INTEGER NOT NULL DEFAULT 0,
  "objective" TEXT,
  "riskLevel" TEXT,
  "studentCount" INTEGER,
  "subjectId" TEXT,
  "tenantId" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_lab_reservations_labId" ON "lab_reservations" ("labId");
CREATE INDEX IF NOT EXISTS "idx_lab_reservations_academicYearId" ON "lab_reservations" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_lab_reservations_classId" ON "lab_reservations" ("classId");
CREATE INDEX IF NOT EXISTS "idx_lab_reservations_subjectId" ON "lab_reservations" ("subjectId");
CREATE INDEX IF NOT EXISTS "idx_lab_reservations_tenantId" ON "lab_reservations" ("tenantId");

-- Table: lab_safety_rules
CREATE TABLE IF NOT EXISTS "lab_safety_rules" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "labId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "severity" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_lab_safety_rules_tenantId" ON "lab_safety_rules" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_lab_safety_rules_labId" ON "lab_safety_rules" ("labId");

-- Table: lab_sessions
CREATE TABLE IF NOT EXISTS "lab_sessions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "labId" TEXT NOT NULL,
  "teacherId" TEXT,
  "classId" TEXT,
  "subjectId" TEXT,
  "theme" TEXT NOT NULL,
  "objectives" TEXT,
  "competencies" TEXT,
  "materialUsed" TEXT,
  "consumablesUsed" TEXT,
  "studentsPresent" INTEGER,
  "studentsAbsent" INTEGER,
  "sessionDate" TEXT NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "report" TEXT,
  "incidents" TEXT,
  "signatureUrl" TEXT,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_lab_sessions_tenantId" ON "lab_sessions" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_lab_sessions_academicYearId" ON "lab_sessions" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_lab_sessions_labId" ON "lab_sessions" ("labId");
CREATE INDEX IF NOT EXISTS "idx_lab_sessions_teacherId" ON "lab_sessions" ("teacherId");
CREATE INDEX IF NOT EXISTS "idx_lab_sessions_classId" ON "lab_sessions" ("classId");
CREATE INDEX IF NOT EXISTS "idx_lab_sessions_subjectId" ON "lab_sessions" ("subjectId");

-- Table: lab_settings
CREATE TABLE IF NOT EXISTS "lab_settings" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_lab_settings_tenantId" ON "lab_settings" ("tenantId");

-- Table: lab_stock_movements
CREATE TABLE IF NOT EXISTS "lab_stock_movements" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "consumableId" TEXT NOT NULL,
  "movementType" TEXT NOT NULL,
  "quantity" REAL NOT NULL,
  "reason" TEXT,
  "sessionId" TEXT,
  "performedBy" TEXT,
  "movementDate" TEXT NOT NULL DEFAULT (datetime('now')),
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_lab_stock_movements_tenantId" ON "lab_stock_movements" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_lab_stock_movements_consumableId" ON "lab_stock_movements" ("consumableId");
CREATE INDEX IF NOT EXISTS "idx_lab_stock_movements_sessionId" ON "lab_stock_movements" ("sessionId");

-- Table: labs
CREATE TABLE IF NOT EXISTS "labs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "capacity" INTEGER,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "building" TEXT,
  "floor" TEXT,
  "internalCode" TEXT,
  "managerId" TEXT,
  "observations" TEXT,
  "photos" TEXT,
  "rules" TEXT,
  "safetyConsigns" TEXT,
  "status" TEXT NOT NULL,
  "type" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_labs_tenantId" ON "labs" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_labs_academicYearId" ON "labs" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_labs_managerId" ON "labs" ("managerId");

-- Table: leave_requests
CREATE TABLE IF NOT EXISTS "leave_requests" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT,
  "staffId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT NOT NULL,
  "reason" TEXT,
  "status" TEXT NOT NULL,
  "approvedBy" TEXT,
  "approvedAt" TEXT,
  "rejectedReason" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_leave_requests_tenantId" ON "leave_requests" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_leave_requests_academicYearId" ON "leave_requests" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_leave_requests_schoolLevelId" ON "leave_requests" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_leave_requests_staffId" ON "leave_requests" ("staffId");

-- Table: legal_pages
CREATE TABLE IF NOT EXISTS "legal_pages" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "effectiveDate" TEXT NOT NULL DEFAULT (datetime('now')),
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);


-- Table: lesson_journal_entries
CREATE TABLE IF NOT EXISTS "lesson_journal_entries" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "journalId" TEXT NOT NULL,
  "period" TEXT,
  "topic" TEXT NOT NULL,
  "objectives" TEXT,
  "activities" TEXT,
  "materials" TEXT,
  "homework" TEXT,
  "notes" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_lesson_journal_entries_tenantId" ON "lesson_journal_entries" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_lesson_journal_entries_academicYearId" ON "lesson_journal_entries" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_lesson_journal_entries_schoolLevelId" ON "lesson_journal_entries" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_lesson_journal_entries_journalId" ON "lesson_journal_entries" ("journalId");

-- Table: lesson_journal_validations
CREATE TABLE IF NOT EXISTS "lesson_journal_validations" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "journalId" TEXT NOT NULL,
  "validatorId" TEXT,
  "status" TEXT NOT NULL,
  "comments" TEXT,
  "validatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_lesson_journal_validations_tenantId" ON "lesson_journal_validations" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_lesson_journal_validations_academicYearId" ON "lesson_journal_validations" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_lesson_journal_validations_schoolLevelId" ON "lesson_journal_validations" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_lesson_journal_validations_journalId" ON "lesson_journal_validations" ("journalId");
CREATE INDEX IF NOT EXISTS "idx_lesson_journal_validations_validatorId" ON "lesson_journal_validations" ("validatorId");

-- Table: lesson_journals
CREATE TABLE IF NOT EXISTS "lesson_journals" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "academicTrackId" TEXT,
  "teacherId" TEXT,
  "classId" TEXT,
  "subjectId" TEXT,
  "date" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "submittedAt" TEXT,
  "validatedAt" TEXT,
  "validatedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_lesson_journals_tenantId" ON "lesson_journals" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_lesson_journals_academicYearId" ON "lesson_journals" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_lesson_journals_schoolLevelId" ON "lesson_journals" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_lesson_journals_academicTrackId" ON "lesson_journals" ("academicTrackId");
CREATE INDEX IF NOT EXISTS "idx_lesson_journals_teacherId" ON "lesson_journals" ("teacherId");
CREATE INDEX IF NOT EXISTS "idx_lesson_journals_classId" ON "lesson_journals" ("classId");
CREATE INDEX IF NOT EXISTS "idx_lesson_journals_subjectId" ON "lesson_journals" ("subjectId");

-- Table: lesson_plan_assignments
CREATE TABLE IF NOT EXISTS "lesson_plan_assignments" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "lessonPlanId" TEXT NOT NULL,
  "classId" TEXT,
  "assignedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "dueDate" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_lesson_plan_assignments_tenantId" ON "lesson_plan_assignments" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_lesson_plan_assignments_academicYearId" ON "lesson_plan_assignments" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_lesson_plan_assignments_schoolLevelId" ON "lesson_plan_assignments" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_lesson_plan_assignments_lessonPlanId" ON "lesson_plan_assignments" ("lessonPlanId");
CREATE INDEX IF NOT EXISTS "idx_lesson_plan_assignments_classId" ON "lesson_plan_assignments" ("classId");

-- Table: lesson_plan_validations
CREATE TABLE IF NOT EXISTS "lesson_plan_validations" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "lessonPlanId" TEXT NOT NULL,
  "validatorId" TEXT,
  "status" TEXT NOT NULL,
  "comments" TEXT,
  "validatedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_lesson_plan_validations_tenantId" ON "lesson_plan_validations" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_lesson_plan_validations_academicYearId" ON "lesson_plan_validations" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_lesson_plan_validations_schoolLevelId" ON "lesson_plan_validations" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_lesson_plan_validations_lessonPlanId" ON "lesson_plan_validations" ("lessonPlanId");
CREATE INDEX IF NOT EXISTS "idx_lesson_plan_validations_validatorId" ON "lesson_plan_validations" ("validatorId");

-- Table: lesson_plan_versions
CREATE TABLE IF NOT EXISTS "lesson_plan_versions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "lessonPlanId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "changes" TEXT,
  "createdBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_lesson_plan_versions_tenantId" ON "lesson_plan_versions" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_lesson_plan_versions_academicYearId" ON "lesson_plan_versions" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_lesson_plan_versions_schoolLevelId" ON "lesson_plan_versions" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_lesson_plan_versions_lessonPlanId" ON "lesson_plan_versions" ("lessonPlanId");

-- Table: lesson_plans
CREATE TABLE IF NOT EXISTS "lesson_plans" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "academicTrackId" TEXT,
  "classId" TEXT,
  "subjectId" TEXT,
  "date" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "homework" TEXT,
  "attachments" TEXT,
  "publishedAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "teacherId" TEXT,
  "objectives" TEXT,
  "methodology" TEXT,
  "materials" TEXT,
  "evaluation" TEXT,
  "status" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "submittedAt" TEXT,
  "validatedAt" TEXT,
  "validatedBy" TEXT,
  "rejectionReason" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_lesson_plans_tenantId" ON "lesson_plans" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_lesson_plans_academicYearId" ON "lesson_plans" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_lesson_plans_schoolLevelId" ON "lesson_plans" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_lesson_plans_academicTrackId" ON "lesson_plans" ("academicTrackId");
CREATE INDEX IF NOT EXISTS "idx_lesson_plans_classId" ON "lesson_plans" ("classId");
CREATE INDEX IF NOT EXISTS "idx_lesson_plans_subjectId" ON "lesson_plans" ("subjectId");
CREATE INDEX IF NOT EXISTS "idx_lesson_plans_teacherId" ON "lesson_plans" ("teacherId");

-- Table: level_evaluation_policies
CREATE TABLE IF NOT EXISTS "level_evaluation_policies" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolStage" TEXT NOT NULL,
  "levelId" TEXT,
  "classId" TEXT,
  "seriesId" TEXT,
  "evaluationMode" TEXT NOT NULL,
  "defaultCoefficient" REAL,
  "qualitativeScaleId" TEXT,
  "calculationRuleId" TEXT,
  "defaultEvaluationCount" INTEGER,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_level_evaluation_policies_tenantId" ON "level_evaluation_policies" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_level_evaluation_policies_academicYearId" ON "level_evaluation_policies" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_level_evaluation_policies_levelId" ON "level_evaluation_policies" ("levelId");
CREATE INDEX IF NOT EXISTS "idx_level_evaluation_policies_classId" ON "level_evaluation_policies" ("classId");
CREATE INDEX IF NOT EXISTS "idx_level_evaluation_policies_seriesId" ON "level_evaluation_policies" ("seriesId");
CREATE INDEX IF NOT EXISTS "idx_level_evaluation_policies_qualitativeScaleId" ON "level_evaluation_policies" ("qualitativeScaleId");
CREATE INDEX IF NOT EXISTS "idx_level_evaluation_policies_calculationRuleId" ON "level_evaluation_policies" ("calculationRuleId");

-- Table: library_books
CREATE TABLE IF NOT EXISTS "library_books" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "isbn" TEXT,
  "title" TEXT NOT NULL,
  "author" TEXT,
  "publisher" TEXT,
  "publicationYear" INTEGER,
  "language" TEXT NOT NULL,
  "totalCopies" INTEGER NOT NULL DEFAULT 1,
  "availableCopies" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "categoryId" TEXT,
  "coverUrl" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "location" TEXT,
  "summary" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_library_books_tenantId" ON "library_books" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_library_books_academicYearId" ON "library_books" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_library_books_categoryId" ON "library_books" ("categoryId");

-- Table: library_categories
CREATE TABLE IF NOT EXISTS "library_categories" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_library_categories_tenantId" ON "library_categories" ("tenantId");

-- Table: library_copies
CREATE TABLE IF NOT EXISTS "library_copies" (
  "id" TEXT PRIMARY KEY,
  "bookId" TEXT NOT NULL,
  "copyNumber" TEXT NOT NULL,
  "barcode" TEXT,
  "status" TEXT NOT NULL,
  "condition" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_library_copies_bookId" ON "library_copies" ("bookId");

-- Table: library_digital_resources
CREATE TABLE IF NOT EXISTS "library_digital_resources" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "subjectId" TEXT,
  "author" TEXT,
  "fileUrl" TEXT,
  "externalUrl" TEXT,
  "accessRights" TEXT NOT NULL,
  "viewCount" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_library_digital_resources_tenantId" ON "library_digital_resources" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_library_digital_resources_academicYearId" ON "library_digital_resources" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_library_digital_resources_subjectId" ON "library_digital_resources" ("subjectId");

-- Table: library_favorites
CREATE TABLE IF NOT EXISTS "library_favorites" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "bookId" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_library_favorites_userId" ON "library_favorites" ("userId");
CREATE INDEX IF NOT EXISTS "idx_library_favorites_bookId" ON "library_favorites" ("bookId");

-- Table: library_inventory_campaigns
CREATE TABLE IF NOT EXISTS "library_inventory_campaigns" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "periodStart" TEXT NOT NULL,
  "periodEnd" TEXT,
  "status" TEXT NOT NULL,
  "responsible" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_library_inventory_campaigns_tenantId" ON "library_inventory_campaigns" ("tenantId");

-- Table: library_inventory_items
CREATE TABLE IF NOT EXISTS "library_inventory_items" (
  "id" TEXT PRIMARY KEY,
  "campaignId" TEXT NOT NULL,
  "copyId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "scannedAt" TEXT,
  "observation" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_library_inventory_items_campaignId" ON "library_inventory_items" ("campaignId");
CREATE INDEX IF NOT EXISTS "idx_library_inventory_items_copyId" ON "library_inventory_items" ("copyId");

-- Table: library_loans
CREATE TABLE IF NOT EXISTS "library_loans" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "bookId" TEXT NOT NULL,
  "copyId" TEXT NOT NULL,
  "studentId" TEXT,
  "loanDate" TEXT NOT NULL,
  "dueDate" TEXT NOT NULL,
  "returnDate" TEXT,
  "status" TEXT NOT NULL,
  "notes" TEXT,
  "loanedBy" TEXT,
  "returnedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "readerType" TEXT NOT NULL,
  "staffId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_library_loans_tenantId" ON "library_loans" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_library_loans_academicYearId" ON "library_loans" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_library_loans_bookId" ON "library_loans" ("bookId");
CREATE INDEX IF NOT EXISTS "idx_library_loans_copyId" ON "library_loans" ("copyId");
CREATE INDEX IF NOT EXISTS "idx_library_loans_studentId" ON "library_loans" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_library_loans_staffId" ON "library_loans" ("staffId");

-- Table: library_penalties
CREATE TABLE IF NOT EXISTS "library_penalties" (
  "id" TEXT PRIMARY KEY,
  "loanId" TEXT NOT NULL,
  "penaltyDate" TEXT NOT NULL,
  "penaltyType" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "description" TEXT,
  "paidAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_library_penalties_loanId" ON "library_penalties" ("loanId");
CREATE INDEX IF NOT EXISTS "idx_library_penalties_tenantId" ON "library_penalties" ("tenantId");

-- Table: library_recommendations
CREATE TABLE IF NOT EXISTS "library_recommendations" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "bookId" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "teacherId" TEXT,
  "comment" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_library_recommendations_tenantId" ON "library_recommendations" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_library_recommendations_academicYearId" ON "library_recommendations" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_library_recommendations_bookId" ON "library_recommendations" ("bookId");
CREATE INDEX IF NOT EXISTS "idx_library_recommendations_targetId" ON "library_recommendations" ("targetId");
CREATE INDEX IF NOT EXISTS "idx_library_recommendations_teacherId" ON "library_recommendations" ("teacherId");

-- Table: library_reports
CREATE TABLE IF NOT EXISTS "library_reports" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "reportType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "periodStart" TEXT,
  "periodEnd" TEXT,
  "content" TEXT,
  "generatedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_library_reports_tenantId" ON "library_reports" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_library_reports_academicYearId" ON "library_reports" ("academicYearId");

-- Table: library_reservations
CREATE TABLE IF NOT EXISTS "library_reservations" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "bookId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "reserveDate" TEXT NOT NULL DEFAULT (datetime('now')),
  "expiryDate" TEXT,
  "status" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_library_reservations_tenantId" ON "library_reservations" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_library_reservations_academicYearId" ON "library_reservations" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_library_reservations_bookId" ON "library_reservations" ("bookId");
CREATE INDEX IF NOT EXISTS "idx_library_reservations_userId" ON "library_reservations" ("userId");

-- Table: library_settings
CREATE TABLE IF NOT EXISTS "library_settings" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_library_settings_tenantId" ON "library_settings" ("tenantId");

-- Table: material_movements
CREATE TABLE IF NOT EXISTS "material_movements" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "materialId" TEXT NOT NULL,
  "movementType" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "reference" TEXT,
  "notes" TEXT,
  "performedById" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_material_movements_tenantId" ON "material_movements" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_material_movements_academicYearId" ON "material_movements" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_material_movements_materialId" ON "material_movements" ("materialId");
CREATE INDEX IF NOT EXISTS "idx_material_movements_performedById" ON "material_movements" ("performedById");

-- Table: material_stocks
CREATE TABLE IF NOT EXISTS "material_stocks" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "materialId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "classId" TEXT,
  "quantityTotal" INTEGER NOT NULL DEFAULT 0,
  "quantityAvailable" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_material_stocks_tenantId" ON "material_stocks" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_material_stocks_academicYearId" ON "material_stocks" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_material_stocks_materialId" ON "material_stocks" ("materialId");
CREATE INDEX IF NOT EXISTS "idx_material_stocks_schoolLevelId" ON "material_stocks" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_material_stocks_classId" ON "material_stocks" ("classId");

-- Table: media_assets
CREATE TABLE IF NOT EXISTS "media_assets" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "size" INTEGER,
  "alt" TEXT,
  "tags" TEXT,
  "uploadedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);


-- Table: media_contents
CREATE TABLE IF NOT EXISTS "media_contents" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "schoolLevelId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  "duration" INTEGER,
  "size" INTEGER,
  "category" TEXT,
  "isPublic" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_media_contents_tenantId" ON "media_contents" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_media_contents_academicYearId" ON "media_contents" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_media_contents_schoolLevelId" ON "media_contents" ("schoolLevelId");

-- Table: media_sessions
CREATE TABLE IF NOT EXISTS "media_sessions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "contentId" TEXT NOT NULL,
  "studentId" TEXT,
  "startTime" TEXT NOT NULL DEFAULT (datetime('now')),
  "endTime" TEXT,
  "status" TEXT NOT NULL,
  "progress" REAL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_media_sessions_tenantId" ON "media_sessions" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_media_sessions_academicYearId" ON "media_sessions" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_media_sessions_schoolLevelId" ON "media_sessions" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_media_sessions_contentId" ON "media_sessions" ("contentId");
CREATE INDEX IF NOT EXISTS "idx_media_sessions_studentId" ON "media_sessions" ("studentId");

-- Table: media_views
CREATE TABLE IF NOT EXISTS "media_views" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "timestamp" TEXT NOT NULL,
  "duration" INTEGER,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_media_views_tenantId" ON "media_views" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_media_views_academicYearId" ON "media_views" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_media_views_schoolLevelId" ON "media_views" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_media_views_sessionId" ON "media_views" ("sessionId");

-- Table: medical_alerts
CREATE TABLE IF NOT EXISTS "medical_alerts" (
  "id" TEXT PRIMARY KEY,
  "recordId" TEXT NOT NULL,
  "alertType" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "acknowledged" INTEGER NOT NULL DEFAULT 0,
  "acknowledgedAt" TEXT,
  "acknowledgedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_medical_alerts_recordId" ON "medical_alerts" ("recordId");

-- Table: medical_records
CREATE TABLE IF NOT EXISTS "medical_records" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "bloodType" TEXT,
  "allergies" TEXT,
  "chronicConditions" TEXT,
  "medications" TEXT,
  "emergencyContact" TEXT,
  "emergencyPhone" TEXT,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_medical_records_tenantId" ON "medical_records" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_medical_records_academicYearId" ON "medical_records" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_medical_records_studentId" ON "medical_records" ("studentId");

-- Table: medical_visits
CREATE TABLE IF NOT EXISTS "medical_visits" (
  "id" TEXT PRIMARY KEY,
  "recordId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "visitDate" TEXT NOT NULL,
  "visitTime" TEXT,
  "reason" TEXT NOT NULL,
  "diagnosis" TEXT,
  "treatment" TEXT,
  "medicationId" TEXT,
  "temperature" REAL,
  "bloodPressure" TEXT,
  "notes" TEXT,
  "performedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_medical_visits_recordId" ON "medical_visits" ("recordId");
CREATE INDEX IF NOT EXISTS "idx_medical_visits_academicYearId" ON "medical_visits" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_medical_visits_medicationId" ON "medical_visits" ("medicationId");

-- Table: medications
CREATE TABLE IF NOT EXISTS "medications" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "dosage" TEXT,
  "form" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "expiryDate" TEXT,
  "stockLevel" INTEGER NOT NULL DEFAULT 0,
  "isPrescription" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_medications_tenantId" ON "medications" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_medications_academicYearId" ON "medications" ("academicYearId");

-- Table: meeting_agendas
CREATE TABLE IF NOT EXISTS "meeting_agendas" (
  "id" TEXT PRIMARY KEY,
  "meetingId" TEXT NOT NULL,
  "agendaOrder" INTEGER NOT NULL DEFAULT 0,
  "topic" TEXT NOT NULL,
  "description" TEXT,
  "presenterId" TEXT,
  "durationMinutes" INTEGER,
  "status" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_meeting_agendas_meetingId" ON "meeting_agendas" ("meetingId");
CREATE INDEX IF NOT EXISTS "idx_meeting_agendas_presenterId" ON "meeting_agendas" ("presenterId");

-- Table: meeting_attachments
CREATE TABLE IF NOT EXISTS "meeting_attachments" (
  "id" TEXT PRIMARY KEY,
  "meetingId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "fileSize" INTEGER,
  "fileType" TEXT,
  "uploadedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_meeting_attachments_meetingId" ON "meeting_attachments" ("meetingId");

-- Table: meeting_decisions
CREATE TABLE IF NOT EXISTS "meeting_decisions" (
  "id" TEXT PRIMARY KEY,
  "meetingId" TEXT NOT NULL,
  "decisionText" TEXT NOT NULL,
  "decisionOrder" INTEGER NOT NULL DEFAULT 0,
  "responsibleId" TEXT,
  "dueDate" TEXT,
  "status" TEXT NOT NULL,
  "completionDate" TEXT,
  "completionNotes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_meeting_decisions_meetingId" ON "meeting_decisions" ("meetingId");
CREATE INDEX IF NOT EXISTS "idx_meeting_decisions_responsibleId" ON "meeting_decisions" ("responsibleId");

-- Table: meeting_minutes
CREATE TABLE IF NOT EXISTS "meeting_minutes" (
  "id" TEXT PRIMARY KEY,
  "meetingId" TEXT NOT NULL,
  "templateId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "content" TEXT NOT NULL,
  "renderedContent" TEXT,
  "pdfPath" TEXT,
  "language" TEXT NOT NULL,
  "recordedBy" TEXT,
  "recordedAt" TEXT,
  "validatedBy" TEXT,
  "validatedAt" TEXT,
  "validated" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_meeting_minutes_meetingId" ON "meeting_minutes" ("meetingId");
CREATE INDEX IF NOT EXISTS "idx_meeting_minutes_templateId" ON "meeting_minutes" ("templateId");

-- Table: meeting_minutes_templates
CREATE TABLE IF NOT EXISTS "meeting_minutes_templates" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT,
  "meetingType" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "template" TEXT NOT NULL,
  "structure" TEXT,
  "isSystem" INTEGER NOT NULL DEFAULT 0,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "language" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_meeting_minutes_templates_tenantId" ON "meeting_minutes_templates" ("tenantId");

-- Table: meeting_minutes_versions
CREATE TABLE IF NOT EXISTS "meeting_minutes_versions" (
  "id" TEXT PRIMARY KEY,
  "minutesId" TEXT NOT NULL,
  "templateId" TEXT,
  "version" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "renderedContent" TEXT,
  "pdfPath" TEXT,
  "changes" TEXT,
  "modifiedBy" TEXT,
  "modifiedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "validatedBy" TEXT,
  "validatedAt" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_meeting_minutes_versions_minutesId" ON "meeting_minutes_versions" ("minutesId");
CREATE INDEX IF NOT EXISTS "idx_meeting_minutes_versions_templateId" ON "meeting_minutes_versions" ("templateId");

-- Table: meeting_notifications
CREATE TABLE IF NOT EXISTS "meeting_notifications" (
  "id" TEXT PRIMARY KEY,
  "meetingId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "sentAt" TEXT,
  "errorMessage" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_meeting_notifications_meetingId" ON "meeting_notifications" ("meetingId");
CREATE INDEX IF NOT EXISTS "idx_meeting_notifications_participantId" ON "meeting_notifications" ("participantId");

-- Table: meeting_participants
CREATE TABLE IF NOT EXISTS "meeting_participants" (
  "id" TEXT PRIMARY KEY,
  "meetingId" TEXT NOT NULL,
  "participantType" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "invitedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "invitedBy" TEXT,
  "attendanceStatus" TEXT,
  "attendanceTime" TEXT,
  "excuseReason" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_meeting_participants_meetingId" ON "meeting_participants" ("meetingId");
CREATE INDEX IF NOT EXISTS "idx_meeting_participants_participantId" ON "meeting_participants" ("participantId");

-- Table: meetings
CREATE TABLE IF NOT EXISTS "meetings" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "meetingType" TEXT NOT NULL,
  "scopeType" TEXT NOT NULL,
  "schoolLevelId" TEXT,
  "classId" TEXT,
  "studentId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "meetingDate" TEXT NOT NULL,
  "startTime" TEXT,
  "endTime" TEXT,
  "location" TEXT,
  "locationOnline" INTEGER NOT NULL DEFAULT 0,
  "meetingLink" TEXT,
  "status" TEXT NOT NULL,
  "cancelledAt" TEXT,
  "cancelledBy" TEXT,
  "cancelledReason" TEXT,
  "createdBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_meetings_tenantId" ON "meetings" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_meetings_academicYearId" ON "meetings" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_meetings_schoolLevelId" ON "meetings" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_meetings_classId" ON "meetings" ("classId");
CREATE INDEX IF NOT EXISTS "idx_meetings_studentId" ON "meetings" ("studentId");

-- Table: message_logs
CREATE TABLE IF NOT EXISTS "message_logs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "recipientType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "deliveredAt" TEXT,
  "openedAt" TEXT,
  "errorMessage" TEXT,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_message_logs_tenantId" ON "message_logs" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_message_logs_messageId" ON "message_logs" ("messageId");

-- Table: message_recipients
CREATE TABLE IF NOT EXISTS "message_recipients" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "recipientType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "deliveredAt" TEXT,
  "readAt" TEXT,
  "errorMessage" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_message_recipients_tenantId" ON "message_recipients" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_message_recipients_messageId" ON "message_recipients" ("messageId");
CREATE INDEX IF NOT EXISTS "idx_message_recipients_recipientId" ON "message_recipients" ("recipientId");

-- Table: message_targets
CREATE TABLE IF NOT EXISTS "message_targets" (
  "id" TEXT PRIMARY KEY,
  "messageId" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_message_targets_messageId" ON "message_targets" ("messageId");
CREATE INDEX IF NOT EXISTS "idx_message_targets_targetId" ON "message_targets" ("targetId");

-- Table: message_templates
CREATE TABLE IF NOT EXISTS "message_templates" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "channelId" TEXT,
  "subject" TEXT,
  "content" TEXT NOT NULL,
  "contentFr" TEXT,
  "contentEn" TEXT,
  "variables" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_message_templates_tenantId" ON "message_templates" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_message_templates_channelId" ON "message_templates" ("channelId");

-- Table: messages
CREATE TABLE IF NOT EXISTS "messages" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "schoolLevelId" TEXT,
  "channelId" TEXT,
  "senderUserId" TEXT NOT NULL,
  "subject" TEXT,
  "content" TEXT NOT NULL,
  "contentFr" TEXT,
  "contentEn" TEXT,
  "messageType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "isScheduled" INTEGER NOT NULL DEFAULT 0,
  "scheduledAt" TEXT,
  "sentAt" TEXT,
  "isArchived" INTEGER NOT NULL DEFAULT 0,
  "attachments" TEXT,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_messages_tenantId" ON "messages" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_messages_academicYearId" ON "messages" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_messages_schoolLevelId" ON "messages" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_messages_channelId" ON "messages" ("channelId");
CREATE INDEX IF NOT EXISTS "idx_messages_senderUserId" ON "messages" ("senderUserId");

-- Table: modules
CREATE TABLE IF NOT EXISTS "modules" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "description" TEXT,
  "schoolLevelId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "isEnabled" INTEGER NOT NULL DEFAULT 1,
  "configuration" TEXT NOT NULL,
  "permissions" TEXT,
  "dependencies" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "route" TEXT,
  "icon" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_modules_tenantId" ON "modules" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_modules_schoolLevelId" ON "modules" ("schoolLevelId");

-- Table: monthly_evaluations
CREATE TABLE IF NOT EXISTS "monthly_evaluations" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "attendanceRegisterId" TEXT NOT NULL,
  "month" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "evaluationNumber" INTEGER,
  "etapeNumber" INTEGER,
  "subjectsConfig" TEXT NOT NULL,
  "studentScores" TEXT NOT NULL,
  "seuilReussite" REAL NOT NULL DEFAULT 10.0,
  "effectifTotalGarcons" INTEGER,
  "effectifTotalFilles" INTEGER,
  "effectifTotalClasse" INTEGER,
  "ayantComposeG" INTEGER,
  "ayantComposeF" INTEGER,
  "ayantComposeTotal" INTEGER,
  "ayantAtteintSeuilG" INTEGER,
  "ayantAtteintSeuilF" INTEGER,
  "ayantAtteintSeuilTotal" INTEGER,
  "nAyantPasAtteintG" INTEGER,
  "nAyantPasAtteintF" INTEGER,
  "nAyantPasAtteintTotal" INTEGER,
  "pourcentageReussiteG" REAL,
  "pourcentageReussiteF" REAL,
  "pourcentageReussiteTotal" REAL,
  "teacherSignatureDate" TEXT,
  "directorSignatureDate" TEXT,
  "status" TEXT NOT NULL,
  "submittedAt" TEXT,
  "validatedAt" TEXT,
  "validatedBy" TEXT,
  "rejectionReason" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_monthly_evaluations_tenantId" ON "monthly_evaluations" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_monthly_evaluations_academicYearId" ON "monthly_evaluations" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_monthly_evaluations_classId" ON "monthly_evaluations" ("classId");
CREATE INDEX IF NOT EXISTS "idx_monthly_evaluations_attendanceRegisterId" ON "monthly_evaluations" ("attendanceRegisterId");

-- Table: monthly_summaries
CREATE TABLE IF NOT EXISTS "monthly_summaries" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "monthlyData" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_monthly_summaries_tenantId" ON "monthly_summaries" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_monthly_summaries_academicYearId" ON "monthly_summaries" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_monthly_summaries_classId" ON "monthly_summaries" ("classId");

-- Table: multigrade_assignments
CREATE TABLE IF NOT EXISTS "multigrade_assignments" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "classIds" TEXT NOT NULL,
  "language" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_multigrade_assignments_tenantId" ON "multigrade_assignments" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_multigrade_assignments_academicYearId" ON "multigrade_assignments" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_multigrade_assignments_teacherId" ON "multigrade_assignments" ("teacherId");

-- Table: national_exam_subjects
CREATE TABLE IF NOT EXISTS "national_exam_subjects" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "coefficient" REAL NOT NULL DEFAULT 1.0,
  "duration" INTEGER,
  "maxScore" REAL NOT NULL DEFAULT 20.0,
  "passingScore" REAL,
  "examDate" TEXT,
  "startTime" TEXT,
  "endTime" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "createdBy" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_national_exam_subjects_tenantId" ON "national_exam_subjects" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_national_exam_subjects_academicYearId" ON "national_exam_subjects" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_national_exam_subjects_examId" ON "national_exam_subjects" ("examId");

-- Table: national_exams
CREATE TABLE IF NOT EXISTS "national_exams" (
  "id" TEXT PRIMARY KEY,
  "patronatId" TEXT,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "examType" TEXT NOT NULL,
  "level" TEXT NOT NULL,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT NOT NULL,
  "registrationStartDate" TEXT NOT NULL,
  "registrationEndDate" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "totalCandidates" INTEGER NOT NULL DEFAULT 0,
  "totalCenters" INTEGER NOT NULL DEFAULT 0,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "createdBy" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_national_exams_patronatId" ON "national_exams" ("patronatId");
CREATE INDEX IF NOT EXISTS "idx_national_exams_tenantId" ON "national_exams" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_national_exams_academicYearId" ON "national_exams" ("academicYearId");

-- Table: national_export_logs
CREATE TABLE IF NOT EXISTS "national_export_logs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "exportType" TEXT NOT NULL,
  "exportedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "status" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_national_export_logs_tenantId" ON "national_export_logs" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_national_export_logs_studentId" ON "national_export_logs" ("studentId");

-- Table: offline_sync_settings
CREATE TABLE IF NOT EXISTS "offline_sync_settings" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "isEnabled" INTEGER NOT NULL DEFAULT 1,
  "syncFrequencyMinutes" INTEGER NOT NULL DEFAULT 15,
  "conflictResolution" TEXT NOT NULL,
  "autoSyncOnConnect" INTEGER NOT NULL DEFAULT 1,
  "maxOfflineDays" INTEGER NOT NULL DEFAULT 7,
  "allowOfflineModification" INTEGER NOT NULL DEFAULT 1,
  "syncOnBackground" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_offline_sync_settings_tenantId" ON "offline_sync_settings" ("tenantId");

-- Table: onboarding_drafts
CREATE TABLE IF NOT EXISTS "onboarding_drafts" (
  "id" TEXT PRIMARY KEY,
  "school_name" TEXT NOT NULL,
  "school_type" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "bilingual" INTEGER NOT NULL DEFAULT 0,
  "schools_count" INTEGER NOT NULL DEFAULT 1,
  "preferred_subdomain" TEXT,
  "promoter_first_name" TEXT,
  "promoter_last_name" TEXT,
  "promoter_email" TEXT,
  "promoter_phone" TEXT,
  "promoter_password_hash" TEXT,
  "otp_verified" INTEGER NOT NULL DEFAULT 0,
  "selected_plan_id" TEXT,
  "price_snapshot" TEXT,
  "status" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL,
  "logo_url" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_onboarding_drafts_selected_plan_id" ON "onboarding_drafts" ("selected_plan_id");

-- Table: onboarding_otps
CREATE TABLE IF NOT EXISTS "onboarding_otps" (
  "id" TEXT PRIMARY KEY,
  "draft_id" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "expires_at" TEXT NOT NULL,
  "verified" INTEGER NOT NULL DEFAULT 0,
  "verified_at" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_onboarding_otps_draft_id" ON "onboarding_otps" ("draft_id");

-- Table: onboarding_payments
CREATE TABLE IF NOT EXISTS "onboarding_payments" (
  "id" TEXT PRIMARY KEY,
  "draft_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "metadata" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_onboarding_payments_draft_id" ON "onboarding_payments" ("draft_id");

-- Table: one_time_bonuses
CREATE TABLE IF NOT EXISTS "one_time_bonuses" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT,
  "staffId" TEXT NOT NULL,
  "payrollItemId" TEXT,
  "amount" REAL NOT NULL,
  "reason" TEXT NOT NULL,
  "bonusType" TEXT NOT NULL,
  "authorizedBy" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "approvedBy" TEXT,
  "approvedAt" TEXT,
  "paidAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_one_time_bonuses_tenantId" ON "one_time_bonuses" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_one_time_bonuses_academicYearId" ON "one_time_bonuses" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_one_time_bonuses_schoolLevelId" ON "one_time_bonuses" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_one_time_bonuses_staffId" ON "one_time_bonuses" ("staffId");
CREATE INDEX IF NOT EXISTS "idx_one_time_bonuses_payrollItemId" ON "one_time_bonuses" ("payrollItemId");

-- Table: online_payments
CREATE TABLE IF NOT EXISTS "online_payments" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "provider" TEXT NOT NULL,
  "providerRef" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "paymentId" TEXT,
  "idempotencyKey" TEXT,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_online_payments_tenantId" ON "online_payments" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_online_payments_studentId" ON "online_payments" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_online_payments_paymentId" ON "online_payments" ("paymentId");

-- Table: order_items
CREATE TABLE IF NOT EXISTS "order_items" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" REAL NOT NULL,
  "totalPrice" REAL NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_order_items_tenantId" ON "order_items" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_order_items_academicYearId" ON "order_items" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_order_items_schoolLevelId" ON "order_items" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_order_items_orderId" ON "order_items" ("orderId");
CREATE INDEX IF NOT EXISTS "idx_order_items_productId" ON "order_items" ("productId");

-- Table: orders
CREATE TABLE IF NOT EXISTS "orders" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "studentId" TEXT,
  "orderNumber" TEXT NOT NULL,
  "totalAmount" REAL NOT NULL,
  "status" TEXT NOT NULL,
  "orderDate" TEXT NOT NULL DEFAULT (datetime('now')),
  "completedAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_orders_tenantId" ON "orders" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_orders_academicYearId" ON "orders" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_orders_schoolLevelId" ON "orders" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_orders_studentId" ON "orders" ("studentId");

-- Table: organigram_nodes
CREATE TABLE IF NOT EXISTS "organigram_nodes" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "level" INTEGER NOT NULL DEFAULT 0,
  "order" INTEGER NOT NULL DEFAULT 0,
  "schoolLevelCode" TEXT,
  "staffId" TEXT,
  "parentId" TEXT,
  "metadata" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_organigram_nodes_tenantId" ON "organigram_nodes" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_organigram_nodes_staffId" ON "organigram_nodes" ("staffId");
CREATE INDEX IF NOT EXISTS "idx_organigram_nodes_parentId" ON "organigram_nodes" ("parentId");

-- Table: orion_access_logs
CREATE TABLE IF NOT EXISTS "orion_access_logs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "portalType" TEXT NOT NULL,
  "triggeredAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "kpisGenerated" INTEGER NOT NULL DEFAULT 0,
  "alertsGenerated" INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "idx_orion_access_logs_tenantId" ON "orion_access_logs" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_orion_access_logs_userId" ON "orion_access_logs" ("userId");

-- Table: orion_alerts
CREATE TABLE IF NOT EXISTS "orion_alerts" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "schoolLevelId" TEXT,
  "alertType" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "recommendation" TEXT,
  "message" TEXT,
  "acknowledged" INTEGER NOT NULL DEFAULT 0,
  "acknowledgedAt" TEXT,
  "acknowledgedBy" TEXT,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_orion_alerts_tenantId" ON "orion_alerts" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_orion_alerts_academicYearId" ON "orion_alerts" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_orion_alerts_schoolLevelId" ON "orion_alerts" ("schoolLevelId");

-- Table: orion_audit_logs
CREATE TABLE IF NOT EXISTS "orion_audit_logs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "resourceType" TEXT,
  "resourceId" TEXT,
  "metadata" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_orion_audit_logs_tenantId" ON "orion_audit_logs" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_orion_audit_logs_userId" ON "orion_audit_logs" ("userId");
CREATE INDEX IF NOT EXISTS "idx_orion_audit_logs_resourceId" ON "orion_audit_logs" ("resourceId");

-- Table: orion_discipline_predictions
CREATE TABLE IF NOT EXISTS "orion_discipline_predictions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "riskScore" REAL NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "factors" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_orion_discipline_predictions_tenantId" ON "orion_discipline_predictions" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_orion_discipline_predictions_classId" ON "orion_discipline_predictions" ("classId");
CREATE INDEX IF NOT EXISTS "idx_orion_discipline_predictions_academicYearId" ON "orion_discipline_predictions" ("academicYearId");

-- Table: orion_feature_snapshots
CREATE TABLE IF NOT EXISTS "orion_feature_snapshots" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "features" TEXT NOT NULL,
  "generatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_orion_feature_snapshots_tenantId" ON "orion_feature_snapshots" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_orion_feature_snapshots_entityId" ON "orion_feature_snapshots" ("entityId");
CREATE INDEX IF NOT EXISTS "idx_orion_feature_snapshots_academicYearId" ON "orion_feature_snapshots" ("academicYearId");

-- Table: orion_forecasts
CREATE TABLE IF NOT EXISTS "orion_forecasts" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "predictedAverage" REAL NOT NULL,
  "riskProbability" REAL NOT NULL,
  "generatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_orion_forecasts_tenantId" ON "orion_forecasts" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_orion_forecasts_academicYearId" ON "orion_forecasts" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_orion_forecasts_entityId" ON "orion_forecasts" ("entityId");

-- Table: orion_insights
CREATE TABLE IF NOT EXISTS "orion_insights" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "schoolLevelId" TEXT,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "priority" TEXT NOT NULL,
  "sourceData" TEXT,
  "isRead" INTEGER NOT NULL DEFAULT 0,
  "readAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_orion_insights_tenantId" ON "orion_insights" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_orion_insights_academicYearId" ON "orion_insights" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_orion_insights_schoolLevelId" ON "orion_insights" ("schoolLevelId");

-- Table: orion_model_versions
CREATE TABLE IF NOT EXISTS "orion_model_versions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "modelName" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "algorithm" TEXT,
  "accuracy" REAL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_orion_model_versions_tenantId" ON "orion_model_versions" ("tenantId");

-- Table: orion_pedagogical_insights
CREATE TABLE IF NOT EXISTS "orion_pedagogical_insights" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "scopeType" TEXT NOT NULL,
  "scopeId" TEXT,
  "insightType" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "confidenceScore" REAL NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_orion_pedagogical_insights_tenantId" ON "orion_pedagogical_insights" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_orion_pedagogical_insights_academicYearId" ON "orion_pedagogical_insights" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_orion_pedagogical_insights_scopeId" ON "orion_pedagogical_insights" ("scopeId");

-- Table: orion_reports
CREATE TABLE IF NOT EXISTS "orion_reports" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "schoolLevelId" TEXT,
  "reportType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "period" TEXT,
  "generatedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_orion_reports_tenantId" ON "orion_reports" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_orion_reports_academicYearId" ON "orion_reports" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_orion_reports_schoolLevelId" ON "orion_reports" ("schoolLevelId");

-- Table: orion_risk_flags
CREATE TABLE IF NOT EXISTS "orion_risk_flags" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "riskCategory" TEXT NOT NULL,
  "riskScore" REAL NOT NULL,
  "level" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_orion_risk_flags_tenantId" ON "orion_risk_flags" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_orion_risk_flags_academicYearId" ON "orion_risk_flags" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_orion_risk_flags_entityId" ON "orion_risk_flags" ("entityId");

-- Table: orion_settings
CREATE TABLE IF NOT EXISTS "orion_settings" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "isEnabled" INTEGER NOT NULL DEFAULT 1,
  "alertThresholdCritical" INTEGER NOT NULL DEFAULT 5,
  "alertThresholdWarning" INTEGER NOT NULL DEFAULT 10,
  "kpiCalculationFrequency" TEXT NOT NULL,
  "autoGenerateInsights" INTEGER NOT NULL DEFAULT 1,
  "insightsFrequency" TEXT NOT NULL,
  "visibleKPICategories" TEXT,
  "allowOrionExports" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_orion_settings_tenantId" ON "orion_settings" ("tenantId");

-- Table: otp_codes
CREATE TABLE IF NOT EXISTS "otp_codes" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "deviceId" TEXT,
  "code" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "phoneNumber" TEXT NOT NULL,
  "isUsed" INTEGER NOT NULL DEFAULT 0,
  "isExpired" INTEGER NOT NULL DEFAULT 0,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "expiresAt" TEXT NOT NULL,
  "usedAt" TEXT,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_otp_codes_userId" ON "otp_codes" ("userId");
CREATE INDEX IF NOT EXISTS "idx_otp_codes_tenantId" ON "otp_codes" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_otp_codes_deviceId" ON "otp_codes" ("deviceId");

-- Table: overtime_records
CREATE TABLE IF NOT EXISTS "overtime_records" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT,
  "staffId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "hours" REAL NOT NULL,
  "validated" INTEGER NOT NULL DEFAULT 0,
  "validatedBy" TEXT,
  "validatedAt" TEXT,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_overtime_records_tenantId" ON "overtime_records" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_overtime_records_academicYearId" ON "overtime_records" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_overtime_records_schoolLevelId" ON "overtime_records" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_overtime_records_staffId" ON "overtime_records" ("staffId");

-- Table: password_resets
CREATE TABLE IF NOT EXISTS "password_resets" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expiresAt" TEXT NOT NULL,
  "usedAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_password_resets_userId" ON "password_resets" ("userId");

-- Table: patronat_bureau_members
CREATE TABLE IF NOT EXISTS "patronat_bureau_members" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "patronatId" TEXT NOT NULL,
  "userId" TEXT,
  "role" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "photoUrl" TEXT,
  "signatureUrl" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_patronat_bureau_members_tenantId" ON "patronat_bureau_members" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_patronat_bureau_members_patronatId" ON "patronat_bureau_members" ("patronatId");
CREATE INDEX IF NOT EXISTS "idx_patronat_bureau_members_userId" ON "patronat_bureau_members" ("userId");

-- Table: patronat_manual_schools
CREATE TABLE IF NOT EXISTS "patronat_manual_schools" (
  "id" TEXT PRIMARY KEY,
  "patronatId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "address" TEXT,
  "contactPerson" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "status" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_patronat_manual_schools_patronatId" ON "patronat_manual_schools" ("patronatId");
CREATE INDEX IF NOT EXISTS "idx_patronat_manual_schools_tenantId" ON "patronat_manual_schools" ("tenantId");

-- Table: patronat_schools
CREATE TABLE IF NOT EXISTS "patronat_schools" (
  "id" TEXT PRIMARY KEY,
  "patronatId" TEXT,
  "tenantId" TEXT NOT NULL,
  "schoolTenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "invitationToken" TEXT,
  "invitedAt" TEXT,
  "joinedAt" TEXT,
  "suspendedAt" TEXT,
  "suspendedBy" TEXT,
  "suspendedReason" TEXT,
  "accessLevel" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "createdBy" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_patronat_schools_patronatId" ON "patronat_schools" ("patronatId");
CREATE INDEX IF NOT EXISTS "idx_patronat_schools_tenantId" ON "patronat_schools" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_patronat_schools_schoolTenantId" ON "patronat_schools" ("schoolTenantId");
CREATE INDEX IF NOT EXISTS "idx_patronat_schools_academicYearId" ON "patronat_schools" ("academicYearId");

-- Table: patronat_users
CREATE TABLE IF NOT EXISTS "patronat_users" (
  "id" TEXT PRIMARY KEY,
  "patronatId" TEXT,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "permissions" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "assignedRegions" TEXT,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "createdBy" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_patronat_users_patronatId" ON "patronat_users" ("patronatId");
CREATE INDEX IF NOT EXISTS "idx_patronat_users_tenantId" ON "patronat_users" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_patronat_users_userId" ON "patronat_users" ("userId");

-- Table: patronats
CREATE TABLE IF NOT EXISTS "patronats" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "abbreviation" TEXT,
  "legalName" TEXT,
  "registrationNumber" TEXT,
  "address" TEXT,
  "primaryPhone" TEXT,
  "primaryEmail" TEXT,
  "website" TEXT,
  "logo" TEXT,
  "region" TEXT,
  "scope" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "bureauMembers" TEXT,
  "officialDocs" TEXT,
  "subscriptionPlan" TEXT NOT NULL,
  "subscriptionStatus" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_patronats_tenantId" ON "patronats" ("tenantId");

-- Table: payment_allocations
CREATE TABLE IF NOT EXISTS "payment_allocations" (
  "id" TEXT PRIMARY KEY,
  "paymentId" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "studentFeeId" TEXT,
  "studentArrearId" TEXT,
  "allocatedAmount" REAL NOT NULL,
  "allocationOrder" INTEGER NOT NULL,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_payment_allocations_paymentId" ON "payment_allocations" ("paymentId");
CREATE INDEX IF NOT EXISTS "idx_payment_allocations_targetId" ON "payment_allocations" ("targetId");
CREATE INDEX IF NOT EXISTS "idx_payment_allocations_studentFeeId" ON "payment_allocations" ("studentFeeId");
CREATE INDEX IF NOT EXISTS "idx_payment_allocations_studentArrearId" ON "payment_allocations" ("studentArrearId");

-- Table: payment_flows
CREATE TABLE IF NOT EXISTS "payment_flows" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "flowType" TEXT NOT NULL,
  "destination" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "currency" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "pspReference" TEXT,
  "subscriptionId" TEXT,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_payment_flows_tenantId" ON "payment_flows" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_payment_flows_subscriptionId" ON "payment_flows" ("subscriptionId");

-- Table: payment_initiations
CREATE TABLE IF NOT EXISTS "payment_initiations" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "studentAccountId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "studentName" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "phone" TEXT,
  "operator" TEXT,
  "status" TEXT NOT NULL,
  "transactionId" TEXT,
  "rawResponse" TEXT,
  "errorMessage" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "confirmedAt" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_payment_initiations_tenantId" ON "payment_initiations" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_payment_initiations_studentAccountId" ON "payment_initiations" ("studentAccountId");
CREATE INDEX IF NOT EXISTS "idx_payment_initiations_academicYearId" ON "payment_initiations" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_payment_initiations_transactionId" ON "payment_initiations" ("transactionId");

-- Table: payment_notifications
CREATE TABLE IF NOT EXISTS "payment_notifications" (
  "id" TEXT PRIMARY KEY,
  "paymentId" TEXT NOT NULL,
  "receiptId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "recipientPhone" TEXT NOT NULL,
  "messageSnapshot" TEXT NOT NULL,
  "attachmentUrl" TEXT,
  "status" TEXT NOT NULL,
  "sentAt" TEXT,
  "errorMessage" TEXT,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_payment_notifications_paymentId" ON "payment_notifications" ("paymentId");
CREATE INDEX IF NOT EXISTS "idx_payment_notifications_receiptId" ON "payment_notifications" ("receiptId");

-- Table: payment_plans
CREATE TABLE IF NOT EXISTS "payment_plans" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "totalAmount" REAL NOT NULL,
  "numberOfInstallments" INTEGER NOT NULL,
  "frequency" TEXT NOT NULL,
  "startDate" TEXT NOT NULL,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_payment_plans_tenantId" ON "payment_plans" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_payment_plans_academicYearId" ON "payment_plans" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_payment_plans_schoolLevelId" ON "payment_plans" ("schoolLevelId");

-- Table: payment_promises
CREATE TABLE IF NOT EXISTS "payment_promises" (
  "id" TEXT PRIMARY KEY,
  "feeArrearId" TEXT NOT NULL,
  "promisedAmount" REAL NOT NULL,
  "promisedDate" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "notes" TEXT,
  "createdBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_payment_promises_feeArrearId" ON "payment_promises" ("feeArrearId");

-- Table: payment_receipts
CREATE TABLE IF NOT EXISTS "payment_receipts" (
  "id" TEXT PRIMARY KEY,
  "paymentId" TEXT NOT NULL,
  "receiptNumber" TEXT NOT NULL,
  "filePath" TEXT,
  "verificationToken" TEXT,
  "verificationTokenHash" TEXT,
  "issuedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "issuedBy" TEXT,
  "isDuplicate" INTEGER NOT NULL DEFAULT 0,
  "duplicateOf" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_payment_receipts_paymentId" ON "payment_receipts" ("paymentId");

-- Table: payment_summaries
CREATE TABLE IF NOT EXISTS "payment_summaries" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "studentFeeId" TEXT NOT NULL,
  "expectedAmount" REAL NOT NULL,
  "paidAmount" REAL NOT NULL DEFAULT 0,
  "balance" REAL NOT NULL DEFAULT 0,
  "lastPaymentDate" TEXT,
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_payment_summaries_tenantId" ON "payment_summaries" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_payment_summaries_studentId" ON "payment_summaries" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_payment_summaries_academicYearId" ON "payment_summaries" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_payment_summaries_studentFeeId" ON "payment_summaries" ("studentFeeId");

-- Table: payment_webhook_logs
CREATE TABLE IF NOT EXISTS "payment_webhook_logs" (
  "id" TEXT PRIMARY KEY,
  "reference" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "processed" INTEGER NOT NULL DEFAULT 0,
  "processed_at" TEXT,
  "payload" TEXT,
  "metadata" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now'))
);


-- Table: payments
CREATE TABLE IF NOT EXISTS "payments" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "studentId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "feeConfigurationId" TEXT,
  "amount" REAL NOT NULL,
  "paymentMethod" TEXT,
  "paymentDate" TEXT NOT NULL,
  "reference" TEXT,
  "receiptNumber" TEXT,
  "status" TEXT NOT NULL,
  "paymentFlowId" TEXT,
  "notes" TEXT,
  "createdBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "studentFeeId" TEXT,
  "transactionType" TEXT NOT NULL,
  "reversedFromId" TEXT,
  "reversalReason" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_payments_tenantId" ON "payments" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_payments_academicYearId" ON "payments" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_payments_studentId" ON "payments" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_payments_schoolLevelId" ON "payments" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_payments_feeConfigurationId" ON "payments" ("feeConfigurationId");
CREATE INDEX IF NOT EXISTS "idx_payments_paymentFlowId" ON "payments" ("paymentFlowId");
CREATE INDEX IF NOT EXISTS "idx_payments_studentFeeId" ON "payments" ("studentFeeId");
CREATE INDEX IF NOT EXISTS "idx_payments_reversedFromId" ON "payments" ("reversedFromId");

-- Table: payroll_items
CREATE TABLE IF NOT EXISTS "payroll_items" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT,
  "payrollId" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "baseSalary" REAL NOT NULL,
  "overtimeAmount" REAL NOT NULL DEFAULT 0,
  "bonuses" REAL NOT NULL DEFAULT 0,
  "grossSalary" REAL NOT NULL,
  "cnssEmployee" REAL NOT NULL DEFAULT 0,
  "cnssEmployer" REAL NOT NULL DEFAULT 0,
  "taxableAmount" REAL NOT NULL,
  "irppAmount" REAL NOT NULL DEFAULT 0,
  "otherDeductions" REAL NOT NULL DEFAULT 0,
  "totalDeductions" REAL NOT NULL,
  "netSalary" REAL NOT NULL,
  "status" TEXT NOT NULL,
  "calculatedAt" TEXT,
  "validatedAt" TEXT,
  "paidAt" TEXT,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_payroll_items_tenantId" ON "payroll_items" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_payroll_items_academicYearId" ON "payroll_items" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_payroll_items_schoolLevelId" ON "payroll_items" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_payroll_items_payrollId" ON "payroll_items" ("payrollId");
CREATE INDEX IF NOT EXISTS "idx_payroll_items_staffId" ON "payroll_items" ("staffId");

-- Table: payroll_periods
CREATE TABLE IF NOT EXISTS "payroll_periods" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT,
  "name" TEXT NOT NULL,
  "periodType" TEXT NOT NULL,
  "month" TEXT,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "closedBy" TEXT,
  "closedAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_payroll_periods_tenantId" ON "payroll_periods" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_payroll_periods_academicYearId" ON "payroll_periods" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_payroll_periods_schoolLevelId" ON "payroll_periods" ("schoolLevelId");

-- Table: payroll_rates
CREATE TABLE IF NOT EXISTS "payroll_rates" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "roleType" TEXT NOT NULL,
  "grade" TEXT,
  "monthlyBaseSalary" REAL NOT NULL,
  "hourlyRate" REAL NOT NULL,
  "overtimeMultiplier" REAL NOT NULL DEFAULT 1.50,
  "effectiveFrom" TEXT NOT NULL,
  "effectiveTo" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_payroll_rates_tenantId" ON "payroll_rates" ("tenantId");

-- Table: payrolls
CREATE TABLE IF NOT EXISTS "payrolls" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT,
  "month" TEXT NOT NULL,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "totalAmount" REAL NOT NULL,
  "processedBy" TEXT,
  "processedAt" TEXT,
  "paidAt" TEXT,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "payrollPeriodId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_payrolls_tenantId" ON "payrolls" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_payrolls_academicYearId" ON "payrolls" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_payrolls_schoolLevelId" ON "payrolls" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_payrolls_payrollPeriodId" ON "payrolls" ("payrollPeriodId");

-- Table: pedagogical_document_comments
CREATE TABLE IF NOT EXISTS "pedagogical_document_comments" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "authorRole" TEXT NOT NULL,
  "comment" TEXT NOT NULL,
  "section" TEXT,
  "isRead" INTEGER NOT NULL DEFAULT 0,
  "readAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_pedagogical_document_comments_tenantId" ON "pedagogical_document_comments" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_document_comments_academicYearId" ON "pedagogical_document_comments" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_document_comments_schoolLevelId" ON "pedagogical_document_comments" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_document_comments_documentId" ON "pedagogical_document_comments" ("documentId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_document_comments_authorId" ON "pedagogical_document_comments" ("authorId");

-- Table: pedagogical_document_notifications
CREATE TABLE IF NOT EXISTS "pedagogical_document_notifications" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "notificationType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "smsSent" INTEGER NOT NULL DEFAULT 0,
  "smsSentAt" TEXT,
  "whatsappSent" INTEGER NOT NULL DEFAULT 0,
  "whatsappSentAt" TEXT,
  "emailSent" INTEGER NOT NULL DEFAULT 0,
  "emailSentAt" TEXT,
  "inAppRead" INTEGER NOT NULL DEFAULT 0,
  "inAppReadAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_pedagogical_document_notifications_tenantId" ON "pedagogical_document_notifications" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_document_notifications_academicYearId" ON "pedagogical_document_notifications" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_document_notifications_schoolLevelId" ON "pedagogical_document_notifications" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_document_notifications_documentId" ON "pedagogical_document_notifications" ("documentId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_document_notifications_recipientId" ON "pedagogical_document_notifications" ("recipientId");

-- Table: pedagogical_document_reviews
CREATE TABLE IF NOT EXISTS "pedagogical_document_reviews" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "comments" TEXT,
  "sectionComments" TEXT,
  "reviewedAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_pedagogical_document_reviews_tenantId" ON "pedagogical_document_reviews" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_document_reviews_academicYearId" ON "pedagogical_document_reviews" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_document_reviews_schoolLevelId" ON "pedagogical_document_reviews" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_document_reviews_documentId" ON "pedagogical_document_reviews" ("documentId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_document_reviews_reviewerId" ON "pedagogical_document_reviews" ("reviewerId");

-- Table: pedagogical_document_versions
CREATE TABLE IF NOT EXISTS "pedagogical_document_versions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "changes" TEXT,
  "createdBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_pedagogical_document_versions_tenantId" ON "pedagogical_document_versions" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_document_versions_academicYearId" ON "pedagogical_document_versions" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_document_versions_schoolLevelId" ON "pedagogical_document_versions" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_document_versions_documentId" ON "pedagogical_document_versions" ("documentId");

-- Table: pedagogical_documents
CREATE TABLE IF NOT EXISTS "pedagogical_documents" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "teacherId" TEXT,
  "classId" TEXT,
  "subjectId" TEXT,
  "documentType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "content" TEXT NOT NULL,
  "period" TEXT,
  "weekStartDate" TEXT,
  "weekEndDate" TEXT,
  "status" TEXT NOT NULL,
  "submittedAt" TEXT,
  "validatedAt" TEXT,
  "validatedBy" TEXT,
  "rejectionReason" TEXT,
  "acknowledgedAt" TEXT,
  "acknowledgedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_pedagogical_documents_tenantId" ON "pedagogical_documents" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_documents_academicYearId" ON "pedagogical_documents" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_documents_schoolLevelId" ON "pedagogical_documents" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_documents_teacherId" ON "pedagogical_documents" ("teacherId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_documents_classId" ON "pedagogical_documents" ("classId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_documents_subjectId" ON "pedagogical_documents" ("subjectId");

-- Table: pedagogical_materials
CREATE TABLE IF NOT EXISTS "pedagogical_materials" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT,
  "schoolLevelId" TEXT NOT NULL,
  "subjectId" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_pedagogical_materials_tenantId" ON "pedagogical_materials" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_materials_schoolLevelId" ON "pedagogical_materials" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_materials_subjectId" ON "pedagogical_materials" ("subjectId");

-- Table: pedagogical_sheet_validations
CREATE TABLE IF NOT EXISTS "pedagogical_sheet_validations" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "pedagogicalSheetId" TEXT NOT NULL,
  "validatorId" TEXT,
  "status" TEXT NOT NULL,
  "comments" TEXT,
  "validatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_pedagogical_sheet_validations_tenantId" ON "pedagogical_sheet_validations" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_sheet_validations_academicYearId" ON "pedagogical_sheet_validations" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_sheet_validations_schoolLevelId" ON "pedagogical_sheet_validations" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_sheet_validations_pedagogicalSheetId" ON "pedagogical_sheet_validations" ("pedagogicalSheetId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_sheet_validations_validatorId" ON "pedagogical_sheet_validations" ("validatorId");

-- Table: pedagogical_sheet_versions
CREATE TABLE IF NOT EXISTS "pedagogical_sheet_versions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "pedagogicalSheetId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "changes" TEXT,
  "createdBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_pedagogical_sheet_versions_tenantId" ON "pedagogical_sheet_versions" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_sheet_versions_academicYearId" ON "pedagogical_sheet_versions" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_sheet_versions_schoolLevelId" ON "pedagogical_sheet_versions" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_sheet_versions_pedagogicalSheetId" ON "pedagogical_sheet_versions" ("pedagogicalSheetId");

-- Table: pedagogical_sheets
CREATE TABLE IF NOT EXISTS "pedagogical_sheets" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "academicTrackId" TEXT,
  "classId" TEXT,
  "subjectId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "content" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "submittedAt" TEXT,
  "validatedAt" TEXT,
  "validatedBy" TEXT,
  "rejectionReason" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_pedagogical_sheets_tenantId" ON "pedagogical_sheets" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_sheets_academicYearId" ON "pedagogical_sheets" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_sheets_schoolLevelId" ON "pedagogical_sheets" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_sheets_academicTrackId" ON "pedagogical_sheets" ("academicTrackId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_sheets_classId" ON "pedagogical_sheets" ("classId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_sheets_subjectId" ON "pedagogical_sheets" ("subjectId");

-- Table: pedagogical_task_students
CREATE TABLE IF NOT EXISTS "pedagogical_task_students" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "homeworkEntryId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "score" REAL,
  "appreciation" TEXT,
  "observation" TEXT,
  "submittedAt" TEXT,
  "evaluatedAt" TEXT,
  "parentNotified" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_pedagogical_task_students_tenantId" ON "pedagogical_task_students" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_task_students_academicYearId" ON "pedagogical_task_students" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_task_students_homeworkEntryId" ON "pedagogical_task_students" ("homeworkEntryId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_task_students_studentId" ON "pedagogical_task_students" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_task_students_teacherId" ON "pedagogical_task_students" ("teacherId");

-- Table: pedagogical_weekly_logs
CREATE TABLE IF NOT EXISTS "pedagogical_weekly_logs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "classId" TEXT,
  "weekStartDate" TEXT NOT NULL,
  "weekEndDate" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "summary" TEXT,
  "submittedAt" TEXT,
  "validatedAt" TEXT,
  "validatedBy" TEXT,
  "rejectionReason" TEXT,
  "classLogIds" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_pedagogical_weekly_logs_tenantId" ON "pedagogical_weekly_logs" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_weekly_logs_academicYearId" ON "pedagogical_weekly_logs" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_weekly_logs_teacherId" ON "pedagogical_weekly_logs" ("teacherId");
CREATE INDEX IF NOT EXISTS "idx_pedagogical_weekly_logs_classId" ON "pedagogical_weekly_logs" ("classId");

-- Table: pedagogy_academic_classes
CREATE TABLE IF NOT EXISTS "pedagogy_academic_classes" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "levelId" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "capacity" INTEGER,
  "roomId" TEXT,
  "mainTeacherId" TEXT,
  "languageTrack" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "seriesId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_pedagogy_academic_classes_tenantId" ON "pedagogy_academic_classes" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_academic_classes_academicYearId" ON "pedagogy_academic_classes" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_academic_classes_levelId" ON "pedagogy_academic_classes" ("levelId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_academic_classes_cycleId" ON "pedagogy_academic_classes" ("cycleId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_academic_classes_roomId" ON "pedagogy_academic_classes" ("roomId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_academic_classes_mainTeacherId" ON "pedagogy_academic_classes" ("mainTeacherId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_academic_classes_seriesId" ON "pedagogy_academic_classes" ("seriesId");

-- Table: pedagogy_academic_cycles
CREATE TABLE IF NOT EXISTS "pedagogy_academic_cycles" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "levelId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_pedagogy_academic_cycles_tenantId" ON "pedagogy_academic_cycles" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_academic_cycles_academicYearId" ON "pedagogy_academic_cycles" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_academic_cycles_levelId" ON "pedagogy_academic_cycles" ("levelId");

-- Table: pedagogy_academic_levels
CREATE TABLE IF NOT EXISTS "pedagogy_academic_levels" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_pedagogy_academic_levels_tenantId" ON "pedagogy_academic_levels" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_academic_levels_academicYearId" ON "pedagogy_academic_levels" ("academicYearId");

-- Table: pedagogy_academic_series
CREATE TABLE IF NOT EXISTS "pedagogy_academic_series" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "levelId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_pedagogy_academic_series_tenantId" ON "pedagogy_academic_series" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_academic_series_academicYearId" ON "pedagogy_academic_series" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_academic_series_levelId" ON "pedagogy_academic_series" ("levelId");

-- Table: pedagogy_attachments
CREATE TABLE IF NOT EXISTS "pedagogy_attachments" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "uploadedAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_pedagogy_attachments_tenantId" ON "pedagogy_attachments" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_attachments_entityId" ON "pedagogy_attachments" ("entityId");

-- Table: pedagogy_audit_logs
CREATE TABLE IF NOT EXISTS "pedagogy_audit_logs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "performedBy" TEXT NOT NULL,
  "oldData" TEXT,
  "newData" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_pedagogy_audit_logs_tenantId" ON "pedagogy_audit_logs" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_audit_logs_entityId" ON "pedagogy_audit_logs" ("entityId");

-- Table: pedagogy_class_logs
CREATE TABLE IF NOT EXISTS "pedagogy_class_logs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "lessonDate" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "homework" TEXT,
  "durationHours" INTEGER NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "actualEnd" TEXT,
  "actualStart" TEXT,
  "attendanceData" TEXT,
  "detailedContent" TEXT,
  "hashSignature" TEXT,
  "linkedSheetId" TEXT,
  "lockedAt" TEXT,
  "materialsUsed" TEXT,
  "observations" TEXT,
  "roomId" TEXT,
  "scheduledEnd" TEXT,
  "scheduledStart" TEXT,
  "status" TEXT NOT NULL,
  "submittedAt" TEXT,
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_pedagogy_class_logs_tenantId" ON "pedagogy_class_logs" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_class_logs_academicYearId" ON "pedagogy_class_logs" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_class_logs_teacherId" ON "pedagogy_class_logs" ("teacherId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_class_logs_classId" ON "pedagogy_class_logs" ("classId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_class_logs_subjectId" ON "pedagogy_class_logs" ("subjectId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_class_logs_linkedSheetId" ON "pedagogy_class_logs" ("linkedSheetId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_class_logs_roomId" ON "pedagogy_class_logs" ("roomId");

-- Table: pedagogy_kpi_snapshots
CREATE TABLE IF NOT EXISTS "pedagogy_kpi_snapshots" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "teacherId" TEXT,
  "classId" TEXT,
  "lessonPlanRate" REAL NOT NULL,
  "journalRate" REAL NOT NULL,
  "classLogRate" REAL NOT NULL,
  "weeklyReportRate" REAL NOT NULL,
  "calculatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_pedagogy_kpi_snapshots_tenantId" ON "pedagogy_kpi_snapshots" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_kpi_snapshots_academicYearId" ON "pedagogy_kpi_snapshots" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_kpi_snapshots_teacherId" ON "pedagogy_kpi_snapshots" ("teacherId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_kpi_snapshots_classId" ON "pedagogy_kpi_snapshots" ("classId");

-- Table: pedagogy_room_maintenances
CREATE TABLE IF NOT EXISTS "pedagogy_room_maintenances" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT,
  "reason" TEXT NOT NULL,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_pedagogy_room_maintenances_tenantId" ON "pedagogy_room_maintenances" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_room_maintenances_roomId" ON "pedagogy_room_maintenances" ("roomId");

-- Table: pedagogy_room_schedules
CREATE TABLE IF NOT EXISTS "pedagogy_room_schedules" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "classId" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_pedagogy_room_schedules_tenantId" ON "pedagogy_room_schedules" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_room_schedules_academicYearId" ON "pedagogy_room_schedules" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_room_schedules_roomId" ON "pedagogy_room_schedules" ("roomId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_room_schedules_classId" ON "pedagogy_room_schedules" ("classId");

-- Table: pedagogy_series_subjects
CREATE TABLE IF NOT EXISTS "pedagogy_series_subjects" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "seriesId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "coefficient" INTEGER NOT NULL,
  "weeklyHours" INTEGER NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_pedagogy_series_subjects_tenantId" ON "pedagogy_series_subjects" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_series_subjects_academicYearId" ON "pedagogy_series_subjects" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_series_subjects_seriesId" ON "pedagogy_series_subjects" ("seriesId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_series_subjects_subjectId" ON "pedagogy_series_subjects" ("subjectId");

-- Table: pedagogy_signatures
CREATE TABLE IF NOT EXISTS "pedagogy_signatures" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "signedById" TEXT NOT NULL,
  "signedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "signatureHash" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_pedagogy_signatures_tenantId" ON "pedagogy_signatures" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_signatures_entityId" ON "pedagogy_signatures" ("entityId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_signatures_signedById" ON "pedagogy_signatures" ("signedById");

-- Table: pedagogy_teacher_academic_profiles
CREATE TABLE IF NOT EXISTS "pedagogy_teacher_academic_profiles" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "maxWeeklyHours" INTEGER NOT NULL,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "isSemainier" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_pedagogy_teacher_academic_profiles_tenantId" ON "pedagogy_teacher_academic_profiles" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_teacher_academic_profiles_academicYearId" ON "pedagogy_teacher_academic_profiles" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_teacher_academic_profiles_teacherId" ON "pedagogy_teacher_academic_profiles" ("teacherId");

-- Table: pedagogy_teacher_availabilities
CREATE TABLE IF NOT EXISTS "pedagogy_teacher_availabilities" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "status" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_pedagogy_teacher_availabilities_tenantId" ON "pedagogy_teacher_availabilities" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_teacher_availabilities_academicYearId" ON "pedagogy_teacher_availabilities" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_teacher_availabilities_profileId" ON "pedagogy_teacher_availabilities" ("profileId");

-- Table: pedagogy_teacher_level_authorizations
CREATE TABLE IF NOT EXISTS "pedagogy_teacher_level_authorizations" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "levelId" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_pedagogy_teacher_level_authorizations_tenantId" ON "pedagogy_teacher_level_authorizations" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_teacher_level_authorizations_academicYearId" ON "pedagogy_teacher_level_authorizations" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_teacher_level_authorizations_profileId" ON "pedagogy_teacher_level_authorizations" ("profileId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_teacher_level_authorizations_levelId" ON "pedagogy_teacher_level_authorizations" ("levelId");

-- Table: pedagogy_teacher_subject_qualifications
CREATE TABLE IF NOT EXISTS "pedagogy_teacher_subject_qualifications" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "certified" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_pedagogy_teacher_subject_qualifications_tenantId" ON "pedagogy_teacher_subject_qualifications" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_teacher_subject_qualifications_academicYearId" ON "pedagogy_teacher_subject_qualifications" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_teacher_subject_qualifications_profileId" ON "pedagogy_teacher_subject_qualifications" ("profileId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_teacher_subject_qualifications_subjectId" ON "pedagogy_teacher_subject_qualifications" ("subjectId");

-- Table: pedagogy_teaching_assignments
CREATE TABLE IF NOT EXISTS "pedagogy_teaching_assignments" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "seriesId" TEXT,
  "weeklyHours" INTEGER NOT NULL,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_pedagogy_teaching_assignments_tenantId" ON "pedagogy_teaching_assignments" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_teaching_assignments_academicYearId" ON "pedagogy_teaching_assignments" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_teaching_assignments_profileId" ON "pedagogy_teaching_assignments" ("profileId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_teaching_assignments_classId" ON "pedagogy_teaching_assignments" ("classId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_teaching_assignments_subjectId" ON "pedagogy_teaching_assignments" ("subjectId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_teaching_assignments_seriesId" ON "pedagogy_teaching_assignments" ("seriesId");

-- Table: pedagogy_teaching_journals
CREATE TABLE IF NOT EXISTS "pedagogy_teaching_journals" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "weekStartDate" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "submittedAt" TEXT,
  "approvedAt" TEXT,
  "approvedById" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "autoGenerated" INTEGER NOT NULL DEFAULT 0,
  "hashSignature" TEXT,
  "lockedAt" TEXT,
  "weekEndDate" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_pedagogy_teaching_journals_tenantId" ON "pedagogy_teaching_journals" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_teaching_journals_academicYearId" ON "pedagogy_teaching_journals" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_teaching_journals_teacherId" ON "pedagogy_teaching_journals" ("teacherId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_teaching_journals_approvedById" ON "pedagogy_teaching_journals" ("approvedById");

-- Table: pedagogy_weekly_journal_entries
CREATE TABLE IF NOT EXISTS "pedagogy_weekly_journal_entries" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "weeklyId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "classId" TEXT,
  "subjectId" TEXT,
  "scheduledStart" TEXT,
  "scheduledEnd" TEXT,
  "plannedTopic" TEXT,
  "linkedSheetId" TEXT,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_pedagogy_weekly_journal_entries_tenantId" ON "pedagogy_weekly_journal_entries" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_weekly_journal_entries_weeklyId" ON "pedagogy_weekly_journal_entries" ("weeklyId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_weekly_journal_entries_classId" ON "pedagogy_weekly_journal_entries" ("classId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_weekly_journal_entries_subjectId" ON "pedagogy_weekly_journal_entries" ("subjectId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_weekly_journal_entries_linkedSheetId" ON "pedagogy_weekly_journal_entries" ("linkedSheetId");

-- Table: pedagogy_weekly_reports
CREATE TABLE IF NOT EXISTS "pedagogy_weekly_reports" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "weekStartDate" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "issues" TEXT,
  "recommendations" TEXT,
  "status" TEXT NOT NULL,
  "submittedAt" TEXT,
  "approvedAt" TEXT,
  "approvedById" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_pedagogy_weekly_reports_tenantId" ON "pedagogy_weekly_reports" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_weekly_reports_academicYearId" ON "pedagogy_weekly_reports" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_weekly_reports_teacherId" ON "pedagogy_weekly_reports" ("teacherId");
CREATE INDEX IF NOT EXISTS "idx_pedagogy_weekly_reports_approvedById" ON "pedagogy_weekly_reports" ("approvedById");

-- Table: permissions
CREATE TABLE IF NOT EXISTS "permissions" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);


-- Table: platform_marketing_reviews
CREATE TABLE IF NOT EXISTS "platform_marketing_reviews" (
  "id" TEXT PRIMARY KEY,
  "quote" TEXT NOT NULL,
  "author_label" TEXT NOT NULL,
  "role_label" TEXT NOT NULL,
  "organization_label" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "published" INTEGER NOT NULL DEFAULT 0,
  "verified_at" TEXT,
  "collect_method" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL
);


-- Table: platform_owner_access_requests
CREATE TABLE IF NOT EXISTS "platform_owner_access_requests" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "platform_owner_id" TEXT NOT NULL,
  "portal_type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "requested_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "reviewed_at" TEXT,
  "reviewed_by" TEXT,
  "review_note" TEXT,
  "revoked_at" TEXT,
  "revoked_by" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_platform_owner_access_requests_tenant_id" ON "platform_owner_access_requests" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_platform_owner_access_requests_platform_owner_id" ON "platform_owner_access_requests" ("platform_owner_id");

-- Table: portal_sessions
CREATE TABLE IF NOT EXISTS "portal_sessions" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT,
  "tenantId" TEXT NOT NULL,
  "portalType" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "expiresAt" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_portal_sessions_userId" ON "portal_sessions" ("userId");
CREATE INDEX IF NOT EXISTS "idx_portal_sessions_tenantId" ON "portal_sessions" ("tenantId");

-- Table: positions
CREATE TABLE IF NOT EXISTS "positions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_positions_tenantId" ON "positions" ("tenantId");

-- Table: pricing_configs
CREATE TABLE IF NOT EXISTS "pricing_configs" (
  "id" TEXT PRIMARY KEY,
  "initial_subscription_fee" INTEGER NOT NULL,
  "multi_school_initial_discount_percent" INTEGER,
  "monthly_base_price" INTEGER NOT NULL,
  "yearly_base_price" INTEGER NOT NULL,
  "yearly_discount_percent" INTEGER NOT NULL,
  "bilingual_monthly_addon" INTEGER NOT NULL,
  "bilingual_yearly_addon" INTEGER NOT NULL,
  "school_additional_price" INTEGER NOT NULL,
  "trial_days" INTEGER NOT NULL DEFAULT 30,
  "grace_days" INTEGER NOT NULL DEFAULT 7,
  "reminder_days" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "is_active" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "created_by" TEXT,
  "metadata" TEXT
);


-- Table: pricing_group_tiers
CREATE TABLE IF NOT EXISTS "pricing_group_tiers" (
  "id" TEXT PRIMARY KEY,
  "schools_count" INTEGER NOT NULL,
  "monthly_price" INTEGER NOT NULL,
  "yearly_price" INTEGER NOT NULL,
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL,
  "created_by" TEXT,
  "metadata" TEXT
);


-- Table: pricing_overrides
CREATE TABLE IF NOT EXISTS "pricing_overrides" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT,
  "code" TEXT,
  "percent_discount" INTEGER,
  "fixed_price" INTEGER,
  "expires_at" TEXT,
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "created_by" TEXT,
  "metadata" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_pricing_overrides_tenant_id" ON "pricing_overrides" ("tenant_id");

-- Table: pricing_plans
CREATE TABLE IF NOT EXISTS "pricing_plans" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "tagline" TEXT,
  "description" TEXT,
  "studentMin" INTEGER NOT NULL DEFAULT 0,
  "studentMax" INTEGER,
  "initialFee" INTEGER NOT NULL DEFAULT 0,
  "monthlyAmount" INTEGER,
  "yearlyAmount" INTEGER,
  "bilingualMonthly" INTEGER,
  "bilingualYearly" INTEGER,
  "features" TEXT,
  "isPopular" INTEGER NOT NULL DEFAULT 0,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);


-- Table: primary_pedagogical_fiches
CREATE TABLE IF NOT EXISTS "primary_pedagogical_fiches" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "subjectId" TEXT,
  "sheetType" TEXT NOT NULL,
  "schoolName" TEXT,
  "className" TEXT,
  "academicYearLabel" TEXT,
  "trimester" INTEGER,
  "weekNumber" INTEGER,
  "lessonDate" TEXT,
  "lessonTime" TEXT,
  "durationMinutes" INTEGER,
  "teacherName" TEXT,
  "boysCount" INTEGER,
  "girlsCount" INTEGER,
  "totalStudents" INTEGER,
  "boysPresent" INTEGER,
  "girlsPresent" INTEGER,
  "totalPresent" INTEGER,
  "boysAbsent" INTEGER,
  "girlsAbsent" INTEGER,
  "totalAbsent" INTEGER,
  "competence" TEXT,
  "habilete" TEXT,
  "prealable" TEXT,
  "contenu" TEXT,
  "methodes" TEXT,
  "moyensDidactiques" TEXT,
  "deroulement" TEXT,
  "evaluation" TEXT,
  "reference" TEXT,
  "adminDate" TEXT,
  "adminWeek" INTEGER,
  "adminHoraire" TEXT,
  "adminDuree" INTEGER,
  "teacherSignature" TEXT,
  "directorSignature" TEXT,
  "status" TEXT NOT NULL,
  "submittedAt" TEXT,
  "validatedAt" TEXT,
  "validatedBy" TEXT,
  "rejectionReason" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "san" TEXT,
  "sequence" TEXT,
  "cours" TEXT,
  "titre" TEXT,
  "duree" TEXT,
  "ibis_1" TEXT,
  "ibis_2" TEXT,
  "ibis_3" TEXT,
  "ibis_4" TEXT,
  "ibis_5" TEXT,
  "objectivation" TEXT,
  "evalRetour" TEXT,
  "projection" TEXT,
  "phase_introductive" TEXT,
  "phase_systematisation" TEXT,
  "phase_application" TEXT,
  "app_col1" TEXT,
  "app_col2" TEXT,
  "app_col3" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_primary_pedagogical_fiches_tenantId" ON "primary_pedagogical_fiches" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_primary_pedagogical_fiches_academicYearId" ON "primary_pedagogical_fiches" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_primary_pedagogical_fiches_teacherId" ON "primary_pedagogical_fiches" ("teacherId");
CREATE INDEX IF NOT EXISTS "idx_primary_pedagogical_fiches_classId" ON "primary_pedagogical_fiches" ("classId");
CREATE INDEX IF NOT EXISTS "idx_primary_pedagogical_fiches_subjectId" ON "primary_pedagogical_fiches" ("subjectId");

-- Table: products
CREATE TABLE IF NOT EXISTS "products" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "schoolLevelId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "price" REAL NOT NULL,
  "stock" INTEGER NOT NULL DEFAULT 0,
  "sku" TEXT,
  "imageUrl" TEXT,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_products_tenantId" ON "products" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_products_academicYearId" ON "products" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_products_schoolLevelId" ON "products" ("schoolLevelId");

-- Table: public_verification_logs
CREATE TABLE IF NOT EXISTS "public_verification_logs" (
  "id" TEXT PRIMARY KEY,
  "tokenId" TEXT,
  "ipAddress" TEXT,
  "result" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_public_verification_logs_tokenId" ON "public_verification_logs" ("tokenId");

-- Table: public_verification_tokens
CREATE TABLE IF NOT EXISTS "public_verification_tokens" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "expiresAt" TEXT NOT NULL,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "verificationCount" INTEGER NOT NULL DEFAULT 0,
  "lastVerifiedAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_public_verification_tokens_tenantId" ON "public_verification_tokens" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_public_verification_tokens_entityId" ON "public_verification_tokens" ("entityId");
CREATE INDEX IF NOT EXISTS "idx_public_verification_tokens_academicYearId" ON "public_verification_tokens" ("academicYearId");

-- Table: push_notifications
CREATE TABLE IF NOT EXISTS "push_notifications" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "recipientType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "data" TEXT,
  "status" TEXT NOT NULL,
  "sentAt" TEXT,
  "deliveredAt" TEXT,
  "errorMessage" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_push_notifications_tenantId" ON "push_notifications" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_push_notifications_recipientId" ON "push_notifications" ("recipientId");

-- Table: push_subscriptions
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "keysP256dh" TEXT NOT NULL,
  "keysAuth" TEXT NOT NULL,
  "expirationTime" TEXT,
  "userAgent" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_push_subscriptions_tenantId" ON "push_subscriptions" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_push_subscriptions_userId" ON "push_subscriptions" ("userId");

-- Table: qhs_audits
CREATE TABLE IF NOT EXISTS "qhs_audits" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT,
  "auditType" TEXT NOT NULL,
  "scope" TEXT,
  "date" TEXT NOT NULL,
  "auditor" TEXT,
  "status" TEXT NOT NULL,
  "globalResult" TEXT,
  "checklist" TEXT,
  "recommendations" TEXT,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_qhs_audits_tenantId" ON "qhs_audits" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_qhs_audits_academicYearId" ON "qhs_audits" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_qhs_audits_schoolLevelId" ON "qhs_audits" ("schoolLevelId");

-- Table: qhs_corrective_actions
CREATE TABLE IF NOT EXISTS "qhs_corrective_actions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT,
  "incidentId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "ownerId" TEXT,
  "dueDate" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "completedAt" TEXT,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_qhs_corrective_actions_tenantId" ON "qhs_corrective_actions" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_qhs_corrective_actions_academicYearId" ON "qhs_corrective_actions" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_qhs_corrective_actions_schoolLevelId" ON "qhs_corrective_actions" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_qhs_corrective_actions_incidentId" ON "qhs_corrective_actions" ("incidentId");
CREATE INDEX IF NOT EXISTS "idx_qhs_corrective_actions_ownerId" ON "qhs_corrective_actions" ("ownerId");

-- Table: qhs_decision_logs
CREATE TABLE IF NOT EXISTS "qhs_decision_logs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT,
  "incidentId" TEXT NOT NULL,
  "decidedById" TEXT,
  "decidedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "decisionType" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "details" TEXT,
  "metadata" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_qhs_decision_logs_tenantId" ON "qhs_decision_logs" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_qhs_decision_logs_academicYearId" ON "qhs_decision_logs" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_qhs_decision_logs_schoolLevelId" ON "qhs_decision_logs" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_qhs_decision_logs_incidentId" ON "qhs_decision_logs" ("incidentId");
CREATE INDEX IF NOT EXISTS "idx_qhs_decision_logs_decidedById" ON "qhs_decision_logs" ("decidedById");

-- Table: qhs_incidents
CREATE TABLE IF NOT EXISTS "qhs_incidents" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT,
  "sourceModule" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "gravity" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "location" TEXT,
  "relatedResourceType" TEXT,
  "relatedResourceId" TEXT,
  "createdById" TEXT,
  "validatedById" TEXT,
  "validatedAt" TEXT,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_qhs_incidents_tenantId" ON "qhs_incidents" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_qhs_incidents_academicYearId" ON "qhs_incidents" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_qhs_incidents_schoolLevelId" ON "qhs_incidents" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_qhs_incidents_relatedResourceId" ON "qhs_incidents" ("relatedResourceId");
CREATE INDEX IF NOT EXISTS "idx_qhs_incidents_createdById" ON "qhs_incidents" ("createdById");
CREATE INDEX IF NOT EXISTS "idx_qhs_incidents_validatedById" ON "qhs_incidents" ("validatedById");

-- Table: qhs_risk_register
CREATE TABLE IF NOT EXISTS "qhs_risk_register" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "domain" TEXT NOT NULL,
  "probability" INTEGER NOT NULL,
  "impact" INTEGER NOT NULL,
  "level" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "ownerId" TEXT,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_qhs_risk_register_tenantId" ON "qhs_risk_register" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_qhs_risk_register_academicYearId" ON "qhs_risk_register" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_qhs_risk_register_schoolLevelId" ON "qhs_risk_register" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_qhs_risk_register_ownerId" ON "qhs_risk_register" ("ownerId");

-- Table: qhse_action_plan_items
CREATE TABLE IF NOT EXISTS "qhse_action_plan_items" (
  "id" TEXT PRIMARY KEY,
  "planId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "responsibleId" TEXT,
  "dueDate" TEXT,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_qhse_action_plan_items_planId" ON "qhse_action_plan_items" ("planId");
CREATE INDEX IF NOT EXISTS "idx_qhse_action_plan_items_responsibleId" ON "qhse_action_plan_items" ("responsibleId");

-- Table: qhse_action_plans
CREATE TABLE IF NOT EXISTS "qhse_action_plans" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "origin" TEXT NOT NULL,
  "description" TEXT,
  "responsibleId" TEXT NOT NULL,
  "priority" TEXT NOT NULL,
  "dueDate" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "closedAt" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_qhse_action_plans_tenantId" ON "qhse_action_plans" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_qhse_action_plans_responsibleId" ON "qhse_action_plans" ("responsibleId");

-- Table: qhse_alerts
CREATE TABLE IF NOT EXISTS "qhse_alerts" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "level" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "isRead" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_qhse_alerts_tenantId" ON "qhse_alerts" ("tenantId");

-- Table: qhse_audit_findings
CREATE TABLE IF NOT EXISTS "qhse_audit_findings" (
  "id" TEXT PRIMARY KEY,
  "auditId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "gravity" TEXT NOT NULL,
  "recommendation" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_qhse_audit_findings_auditId" ON "qhse_audit_findings" ("auditId");

-- Table: qhse_audits
CREATE TABLE IF NOT EXISTS "qhse_audits" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "auditorId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "score" INTEGER,
  "summary" TEXT,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_qhse_audits_tenantId" ON "qhse_audits" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_qhse_audits_academicYearId" ON "qhse_audits" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_qhse_audits_auditorId" ON "qhse_audits" ("auditorId");

-- Table: qhse_compliance
CREATE TABLE IF NOT EXISTS "qhse_compliance" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "dueDate" TEXT,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_qhse_compliance_tenantId" ON "qhse_compliance" ("tenantId");

-- Table: qhse_documents
CREATE TABLE IF NOT EXISTS "qhse_documents" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_qhse_documents_tenantId" ON "qhse_documents" ("tenantId");

-- Table: qhse_health_visits
CREATE TABLE IF NOT EXISTS "qhse_health_visits" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "symptoms" TEXT,
  "treatment" TEXT,
  "isEmergency" INTEGER NOT NULL DEFAULT 0,
  "parentNotified" INTEGER NOT NULL DEFAULT 0,
  "responsibleId" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_qhse_health_visits_tenantId" ON "qhse_health_visits" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_qhse_health_visits_academicYearId" ON "qhse_health_visits" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_qhse_health_visits_userId" ON "qhse_health_visits" ("userId");
CREATE INDEX IF NOT EXISTS "idx_qhse_health_visits_responsibleId" ON "qhse_health_visits" ("responsibleId");

-- Table: qhse_hygiene_check_items
CREATE TABLE IF NOT EXISTS "qhse_hygiene_check_items" (
  "id" TEXT PRIMARY KEY,
  "inspectionId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_qhse_hygiene_check_items_inspectionId" ON "qhse_hygiene_check_items" ("inspectionId");

-- Table: qhse_hygiene_inspections
CREATE TABLE IF NOT EXISTS "qhse_hygiene_inspections" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "zone" TEXT NOT NULL,
  "inspectorId" TEXT NOT NULL,
  "date" TEXT NOT NULL DEFAULT (datetime('now')),
  "score" INTEGER,
  "notes" TEXT,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_qhse_hygiene_inspections_tenantId" ON "qhse_hygiene_inspections" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_qhse_hygiene_inspections_academicYearId" ON "qhse_hygiene_inspections" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_qhse_hygiene_inspections_inspectorId" ON "qhse_hygiene_inspections" ("inspectorId");

-- Table: qhse_incident_attachments
CREATE TABLE IF NOT EXISTS "qhse_incident_attachments" (
  "id" TEXT PRIMARY KEY,
  "incidentId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileType" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_qhse_incident_attachments_incidentId" ON "qhse_incident_attachments" ("incidentId");

-- Table: qhse_incidents
CREATE TABLE IF NOT EXISTS "qhse_incidents" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "gravity" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "measuresTaken" TEXT,
  "witnesses" TEXT,
  "reportedById" TEXT NOT NULL,
  "studentId" TEXT,
  "staffId" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_qhse_incidents_tenantId" ON "qhse_incidents" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_qhse_incidents_academicYearId" ON "qhse_incidents" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_qhse_incidents_reportedById" ON "qhse_incidents" ("reportedById");
CREATE INDEX IF NOT EXISTS "idx_qhse_incidents_studentId" ON "qhse_incidents" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_qhse_incidents_staffId" ON "qhse_incidents" ("staffId");

-- Table: qhse_periodic_controls
CREATE TABLE IF NOT EXISTS "qhse_periodic_controls" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "frequency" TEXT NOT NULL,
  "nextDueDate" TEXT NOT NULL,
  "responsibleId" TEXT,
  "lastResult" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_qhse_periodic_controls_tenantId" ON "qhse_periodic_controls" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_qhse_periodic_controls_responsibleId" ON "qhse_periodic_controls" ("responsibleId");

-- Table: qhse_reports
CREATE TABLE IF NOT EXISTS "qhse_reports" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT,
  "generatedBy" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_qhse_reports_tenantId" ON "qhse_reports" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_qhse_reports_academicYearId" ON "qhse_reports" ("academicYearId");

-- Table: qhse_risks
CREATE TABLE IF NOT EXISTS "qhse_risks" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "location" TEXT,
  "probability" INTEGER NOT NULL DEFAULT 1,
  "impact" INTEGER NOT NULL DEFAULT 1,
  "criticite" TEXT NOT NULL,
  "measures" TEXT,
  "status" TEXT NOT NULL,
  "responsibleId" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_qhse_risks_tenantId" ON "qhse_risks" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_qhse_risks_responsibleId" ON "qhse_risks" ("responsibleId");

-- Table: qhse_security_controls
CREATE TABLE IF NOT EXISTS "qhse_security_controls" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "lastCheckAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "nextCheckAt" TEXT,
  "responsibleId" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_qhse_security_controls_tenantId" ON "qhse_security_controls" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_qhse_security_controls_responsibleId" ON "qhse_security_controls" ("responsibleId");

-- Table: qhse_settings
CREATE TABLE IF NOT EXISTS "qhse_settings" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_qhse_settings_tenantId" ON "qhse_settings" ("tenantId");

-- Table: qualitative_scales
CREATE TABLE IF NOT EXISTS "qualitative_scales" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "rank" INTEGER NOT NULL DEFAULT 0,
  "isDefault" INTEGER NOT NULL DEFAULT 0,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_qualitative_scales_tenantId" ON "qualitative_scales" ("tenantId");

-- Table: quarters
CREATE TABLE IF NOT EXISTS "quarters" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT NOT NULL,
  "isCurrent" INTEGER NOT NULL DEFAULT 0,
  "createdBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_quarters_tenantId" ON "quarters" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_quarters_academicYearId" ON "quarters" ("academicYearId");

-- Table: question_bank_resources
CREATE TABLE IF NOT EXISTS "question_bank_resources" (
  "id" TEXT PRIMARY KEY,
  "patronatId" TEXT,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "resourceType" TEXT NOT NULL,
  "subject" TEXT,
  "class" TEXT,
  "examType" TEXT,
  "fileUrl" TEXT NOT NULL,
  "fileSize" INTEGER,
  "mimeType" TEXT,
  "isPublic" INTEGER NOT NULL DEFAULT 0,
  "accessLevel" TEXT NOT NULL,
  "uploadedBy" TEXT,
  "uploadedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "status" TEXT NOT NULL,
  "downloadCount" INTEGER NOT NULL DEFAULT 0,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_question_bank_resources_patronatId" ON "question_bank_resources" ("patronatId");
CREATE INDEX IF NOT EXISTS "idx_question_bank_resources_tenantId" ON "question_bank_resources" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_question_bank_resources_academicYearId" ON "question_bank_resources" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_question_bank_resources_schoolLevelId" ON "question_bank_resources" ("schoolLevelId");

-- Table: rankings
CREATE TABLE IF NOT EXISTS "rankings" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "academicTrackId" TEXT,
  "classId" TEXT,
  "quarterId" TEXT,
  "rankingType" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  "average" REAL NOT NULL,
  "totalStudents" INTEGER NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_rankings_tenantId" ON "rankings" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_rankings_academicYearId" ON "rankings" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_rankings_schoolLevelId" ON "rankings" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_rankings_academicTrackId" ON "rankings" ("academicTrackId");
CREATE INDEX IF NOT EXISTS "idx_rankings_classId" ON "rankings" ("classId");
CREATE INDEX IF NOT EXISTS "idx_rankings_quarterId" ON "rankings" ("quarterId");
CREATE INDEX IF NOT EXISTS "idx_rankings_studentId" ON "rankings" ("studentId");

-- Table: recovery_reminders
CREATE TABLE IF NOT EXISTS "recovery_reminders" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "studentAccountId" TEXT NOT NULL,
  "reminderLevel" TEXT NOT NULL,
  "amountDue" REAL NOT NULL,
  "sentVia" TEXT NOT NULL,
  "sentAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "createdBySystem" INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS "idx_recovery_reminders_tenantId" ON "recovery_reminders" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_recovery_reminders_academicYearId" ON "recovery_reminders" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_recovery_reminders_studentAccountId" ON "recovery_reminders" ("studentAccountId");

-- Table: recruiter_profiles
CREATE TABLE IF NOT EXISTS "recruiter_profiles" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "recruiterType" TEXT NOT NULL,
  "staffId" TEXT,
  "fullName" TEXT NOT NULL,
  "functionLabel" TEXT,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "signatureText" TEXT,
  "signatureLogoUrl" TEXT,
  "defaultInterviewFormat" TEXT NOT NULL,
  "defaultInterviewDelayHr" INTEGER NOT NULL DEFAULT 48,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_recruiter_profiles_tenantId" ON "recruiter_profiles" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_recruiter_profiles_staffId" ON "recruiter_profiles" ("staffId");

-- Table: report_card_items
CREATE TABLE IF NOT EXISTS "report_card_items" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "reportCardId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "average" REAL NOT NULL,
  "coefficient" REAL NOT NULL,
  "rank" INTEGER,
  "comments" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_report_card_items_tenantId" ON "report_card_items" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_report_card_items_academicYearId" ON "report_card_items" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_report_card_items_schoolLevelId" ON "report_card_items" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_report_card_items_reportCardId" ON "report_card_items" ("reportCardId");
CREATE INDEX IF NOT EXISTS "idx_report_card_items_subjectId" ON "report_card_items" ("subjectId");

-- Table: report_cards
CREATE TABLE IF NOT EXISTS "report_cards" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "academicTrackId" TEXT,
  "studentId" TEXT NOT NULL,
  "quarterId" TEXT,
  "type" TEXT NOT NULL,
  "overallAverage" REAL NOT NULL,
  "rank" INTEGER,
  "status" TEXT NOT NULL,
  "filePath" TEXT,
  "generatedAt" TEXT,
  "validatedAt" TEXT,
  "validatedBy" TEXT,
  "publishedAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "language" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_report_cards_tenantId" ON "report_cards" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_report_cards_academicYearId" ON "report_cards" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_report_cards_schoolLevelId" ON "report_cards" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_report_cards_academicTrackId" ON "report_cards" ("academicTrackId");
CREATE INDEX IF NOT EXISTS "idx_report_cards_studentId" ON "report_cards" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_report_cards_quarterId" ON "report_cards" ("quarterId");

-- Table: resource_access_logs
CREATE TABLE IF NOT EXISTS "resource_access_logs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "accessedBy" TEXT,
  "schoolTenantId" TEXT,
  "accessType" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "accessedAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_resource_access_logs_tenantId" ON "resource_access_logs" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_resource_access_logs_resourceId" ON "resource_access_logs" ("resourceId");
CREATE INDEX IF NOT EXISTS "idx_resource_access_logs_schoolTenantId" ON "resource_access_logs" ("schoolTenantId");

-- Table: result_correction_requests
CREATE TABLE IF NOT EXISTS "result_correction_requests" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "resultId" TEXT NOT NULL,
  "evaluationId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "approvedById" TEXT,
  "reason" TEXT NOT NULL,
  "oldNumericScore" REAL,
  "newNumericScore" REAL,
  "oldQualitativeCode" TEXT,
  "newQualitativeCode" TEXT,
  "oldAppreciation" TEXT,
  "newAppreciation" TEXT,
  "status" TEXT NOT NULL,
  "requestedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "approvedAt" TEXT,
  "rejectedAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_result_correction_requests_tenantId" ON "result_correction_requests" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_result_correction_requests_resultId" ON "result_correction_requests" ("resultId");
CREATE INDEX IF NOT EXISTS "idx_result_correction_requests_evaluationId" ON "result_correction_requests" ("evaluationId");
CREATE INDEX IF NOT EXISTS "idx_result_correction_requests_studentId" ON "result_correction_requests" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_result_correction_requests_requestedById" ON "result_correction_requests" ("requestedById");
CREATE INDEX IF NOT EXISTS "idx_result_correction_requests_approvedById" ON "result_correction_requests" ("approvedById");

-- Table: result_import_batches
CREATE TABLE IF NOT EXISTS "result_import_batches" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "evaluationId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "successRows" INTEGER NOT NULL DEFAULT 0,
  "errorRows" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL,
  "errorReportUrl" TEXT,
  "importedById" TEXT,
  "importedAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_result_import_batches_tenantId" ON "result_import_batches" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_result_import_batches_evaluationId" ON "result_import_batches" ("evaluationId");
CREATE INDEX IF NOT EXISTS "idx_result_import_batches_importedById" ON "result_import_batches" ("importedById");

-- Table: reviews
CREATE TABLE IF NOT EXISTS "reviews" (
  "id" TEXT PRIMARY KEY,
  "authorName" TEXT NOT NULL,
  "authorRole" TEXT,
  "schoolName" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "photoUrl" TEXT,
  "rating" INTEGER NOT NULL,
  "comment" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "featured" INTEGER NOT NULL DEFAULT 0,
  "source" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "publishedAt" TEXT,
  "tenantId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_reviews_tenantId" ON "reviews" ("tenantId");

-- Table: revoked_tokens
CREATE TABLE IF NOT EXISTS "revoked_tokens" (
  "id" TEXT PRIMARY KEY,
  "token" TEXT NOT NULL,
  "expiresAt" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);


-- Table: risk_alerts
CREATE TABLE IF NOT EXISTS "risk_alerts" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "schoolLevelId" TEXT,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "acknowledged" INTEGER NOT NULL DEFAULT 0,
  "acknowledgedBy" TEXT,
  "acknowledgedAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_risk_alerts_tenantId" ON "risk_alerts" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_risk_alerts_academicYearId" ON "risk_alerts" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_risk_alerts_schoolLevelId" ON "risk_alerts" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_risk_alerts_sourceId" ON "risk_alerts" ("sourceId");

-- Table: role_permissions
CREATE TABLE IF NOT EXISTS "role_permissions" (
  "roleId" TEXT,
  "permissionId" TEXT,
  "levelScope" TEXT,
  PRIMARY KEY ("roleId", "permissionId")
);


-- Table: roles
CREATE TABLE IF NOT EXISTS "roles" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isSystemRole" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "canAccessOrion" INTEGER NOT NULL DEFAULT 0,
  "canAccessAtlas" INTEGER NOT NULL DEFAULT 0,
  "allowedLevelIds" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_roles_tenantId" ON "roles" ("tenantId");

-- Table: room_allocations
CREATE TABLE IF NOT EXISTS "room_allocations" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "allocationType" TEXT NOT NULL,
  "referenceId" TEXT,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_room_allocations_tenantId" ON "room_allocations" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_room_allocations_academicYearId" ON "room_allocations" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_room_allocations_roomId" ON "room_allocations" ("roomId");
CREATE INDEX IF NOT EXISTS "idx_room_allocations_referenceId" ON "room_allocations" ("referenceId");

-- Table: room_maintenances
CREATE TABLE IF NOT EXISTS "room_maintenances" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT,
  "reason" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_room_maintenances_tenantId" ON "room_maintenances" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_room_maintenances_roomId" ON "room_maintenances" ("roomId");

-- Table: room_reservations
CREATE TABLE IF NOT EXISTS "room_reservations" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT,
  "roomId" TEXT NOT NULL,
  "reservedBy" TEXT,
  "reservationDate" TEXT NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "purpose" TEXT,
  "status" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_room_reservations_tenantId" ON "room_reservations" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_room_reservations_academicYearId" ON "room_reservations" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_room_reservations_schoolLevelId" ON "room_reservations" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_room_reservations_roomId" ON "room_reservations" ("roomId");

-- Table: room_schedules
CREATE TABLE IF NOT EXISTS "room_schedules" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "classId" TEXT,
  "subjectId" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_room_schedules_tenantId" ON "room_schedules" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_room_schedules_academicYearId" ON "room_schedules" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_room_schedules_roomId" ON "room_schedules" ("roomId");
CREATE INDEX IF NOT EXISTS "idx_room_schedules_classId" ON "room_schedules" ("classId");
CREATE INDEX IF NOT EXISTS "idx_room_schedules_subjectId" ON "room_schedules" ("subjectId");

-- Table: rooms
CREATE TABLE IF NOT EXISTS "rooms" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "roomCode" TEXT NOT NULL,
  "roomName" TEXT NOT NULL,
  "roomType" TEXT NOT NULL,
  "capacity" INTEGER,
  "schoolLevelId" TEXT,
  "equipment" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "description" TEXT,
  "createdBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_rooms_tenantId" ON "rooms" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_rooms_academicYearId" ON "rooms" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_rooms_schoolLevelId" ON "rooms" ("schoolLevelId");

-- Table: saisie_master_evaluations
CREATE TABLE IF NOT EXISTS "saisie_master_evaluations" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "subjectId" TEXT,
  "schoolName" TEXT,
  "className" TEXT,
  "academicYearLabel" TEXT,
  "trimester" INTEGER NOT NULL,
  "evaluationType" TEXT NOT NULL,
  "evaluationLabel" TEXT,
  "testTitle" TEXT NOT NULL,
  "testDate" TEXT,
  "durationMinutes" INTEGER,
  "teacherName" TEXT,
  "maxScore" REAL NOT NULL DEFAULT 20.0,
  "passingScore" REAL NOT NULL DEFAULT 10.0,
  "coefficient" REAL NOT NULL DEFAULT 1.0,
  "studentScores" TEXT NOT NULL,
  "totalStudents" INTEGER,
  "totalPresent" INTEGER,
  "totalAbsent" INTEGER,
  "averageScore" REAL,
  "highestScore" REAL,
  "lowestScore" REAL,
  "passedCount" INTEGER,
  "failedCount" INTEGER,
  "passRate" REAL,
  "boysCount" INTEGER,
  "girlsCount" INTEGER,
  "boysAverage" REAL,
  "girlsAverage" REAL,
  "boysPassed" INTEGER,
  "girlsPassed" INTEGER,
  "pedagogicalObservations" TEXT,
  "recommandations" TEXT,
  "teacherSignature" TEXT,
  "directorSignature" TEXT,
  "status" TEXT NOT NULL,
  "submittedAt" TEXT,
  "validatedAt" TEXT,
  "validatedBy" TEXT,
  "rejectionReason" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_saisie_master_evaluations_tenantId" ON "saisie_master_evaluations" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_saisie_master_evaluations_academicYearId" ON "saisie_master_evaluations" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_saisie_master_evaluations_teacherId" ON "saisie_master_evaluations" ("teacherId");
CREATE INDEX IF NOT EXISTS "idx_saisie_master_evaluations_classId" ON "saisie_master_evaluations" ("classId");
CREATE INDEX IF NOT EXISTS "idx_saisie_master_evaluations_subjectId" ON "saisie_master_evaluations" ("subjectId");

-- Table: saisiemaster_prospects
CREATE TABLE IF NOT EXISTS "saisiemaster_prospects" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "schoolName" TEXT NOT NULL,
  "phoneNumber" TEXT,
  "city" TEXT,
  "source" TEXT,
  "status" TEXT,
  "signupDate" TEXT DEFAULT (datetime('now')),
  "lastLoginAt" TEXT,
  "loginCount" INTEGER DEFAULT 1,
  "firstFollowupSent" INTEGER DEFAULT 0,
  "firstFollowupSentAt" TEXT,
  "secondFollowupSent" INTEGER DEFAULT 0,
  "secondFollowupSentAt" TEXT,
  "convertedToTenantId" TEXT,
  "convertedAt" TEXT,
  "classesCreated" INTEGER DEFAULT 0,
  "gradesEntered" INTEGER DEFAULT 0,
  "exportsCount" INTEGER DEFAULT 0,
  "createdAt" TEXT DEFAULT (datetime('now')),
  "updatedAt" TEXT DEFAULT (datetime('now')),
  "password" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_saisiemaster_prospects_convertedToTenantId" ON "saisiemaster_prospects" ("convertedToTenantId");

-- Table: saisiemaster_sessions
CREATE TABLE IF NOT EXISTS "saisiemaster_sessions" (
  "id" TEXT PRIMARY KEY,
  "prospectId" TEXT NOT NULL,
  "className" TEXT NOT NULL,
  "schoolYear" TEXT,
  "academicYear" TEXT,
  "studentCount" INTEGER DEFAULT 0,
  "subjectCount" INTEGER DEFAULT 0,
  "gradesData" TEXT,
  "createdAt" TEXT DEFAULT (datetime('now')),
  "updatedAt" TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_saisiemaster_sessions_prospectId" ON "saisiemaster_sessions" ("prospectId");

-- Table: saisiemaster_testimonials
CREATE TABLE IF NOT EXISTS "saisiemaster_testimonials" (
  "id" TEXT PRIMARY KEY,
  "prospectId" TEXT,
  "authorName" TEXT NOT NULL,
  "authorRole" TEXT NOT NULL,
  "schoolName" TEXT NOT NULL,
  "city" TEXT,
  "rating" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "isPublished" INTEGER NOT NULL DEFAULT 0,
  "isFeatured" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "publishedAt" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_saisiemaster_testimonials_prospectId" ON "saisiemaster_testimonials" ("prospectId");

-- Table: salary_payments
CREATE TABLE IF NOT EXISTS "salary_payments" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT,
  "payrollItemId" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "paymentMethod" TEXT NOT NULL,
  "paymentDate" TEXT NOT NULL,
  "reference" TEXT,
  "status" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_salary_payments_tenantId" ON "salary_payments" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_salary_payments_academicYearId" ON "salary_payments" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_salary_payments_schoolLevelId" ON "salary_payments" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_salary_payments_payrollItemId" ON "salary_payments" ("payrollItemId");
CREATE INDEX IF NOT EXISTS "idx_salary_payments_staffId" ON "salary_payments" ("staffId");

-- Table: salary_policies
CREATE TABLE IF NOT EXISTS "salary_policies" (
  "id" TEXT PRIMARY KEY,
  "countryId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "salaryStructure" TEXT NOT NULL,
  "socialContributions" TEXT NOT NULL,
  "leaveRules" TEXT,
  "bonuses" TEXT,
  "taxRules" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "isDefault" INTEGER NOT NULL DEFAULT 0,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_salary_policies_countryId" ON "salary_policies" ("countryId");

-- Table: salary_slips
CREATE TABLE IF NOT EXISTS "salary_slips" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "payrollItemId" TEXT NOT NULL,
  "receiptNumber" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "filePath" TEXT,
  "pdfGenerated" INTEGER NOT NULL DEFAULT 0,
  "pdfGeneratedAt" TEXT,
  "content" TEXT,
  "issuedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "issuedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_salary_slips_tenantId" ON "salary_slips" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_salary_slips_payrollItemId" ON "salary_slips" ("payrollItemId");

-- Table: scheduled_emails
CREATE TABLE IF NOT EXISTS "scheduled_emails" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "to_email" TEXT NOT NULL,
  "to_name" TEXT,
  "recipient_type" TEXT,
  "recipient_id" TEXT,
  "subject" TEXT NOT NULL,
  "html_body" TEXT NOT NULL,
  "text_body" TEXT,
  "category" TEXT,
  "subcategory" TEXT,
  "module" TEXT,
  "reply_to_override" TEXT,
  "scheduled_at" TEXT NOT NULL,
  "timezone" TEXT,
  "status" TEXT NOT NULL,
  "sent_at" TEXT,
  "email_log_id" TEXT,
  "error_message" TEXT,
  "created_by_user_id" TEXT,
  "created_by_name" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_scheduled_emails_tenant_id" ON "scheduled_emails" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_scheduled_emails_recipient_id" ON "scheduled_emails" ("recipient_id");
CREATE INDEX IF NOT EXISTS "idx_scheduled_emails_email_log_id" ON "scheduled_emails" ("email_log_id");
CREATE INDEX IF NOT EXISTS "idx_scheduled_emails_created_by_user_id" ON "scheduled_emails" ("created_by_user_id");

-- Table: scheduled_messages
CREATE TABLE IF NOT EXISTS "scheduled_messages" (
  "id" TEXT PRIMARY KEY,
  "messageId" TEXT NOT NULL,
  "scheduledAt" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "sentAt" TEXT,
  "errorMessage" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_scheduled_messages_messageId" ON "scheduled_messages" ("messageId");

-- Table: school_academic_settings
CREATE TABLE IF NOT EXISTS "school_academic_settings" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "schoolYearId" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "systemCode" TEXT,
  "cycleCode" TEXT,
  "levelCode" TEXT,
  "classId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "isActive" INTEGER NOT NULL DEFAULT 0,
  "isLocked" INTEGER NOT NULL DEFAULT 0,
  "config" TEXT NOT NULL,
  "createdById" TEXT,
  "activatedById" TEXT,
  "lockedById" TEXT,
  "activatedAt" TEXT,
  "lockedAt" TEXT,
  "archivedAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "language" TEXT,
  "secondaryCycle" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_school_academic_settings_tenantId" ON "school_academic_settings" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_school_academic_settings_schoolYearId" ON "school_academic_settings" ("schoolYearId");
CREATE INDEX IF NOT EXISTS "idx_school_academic_settings_classId" ON "school_academic_settings" ("classId");
CREATE INDEX IF NOT EXISTS "idx_school_academic_settings_createdById" ON "school_academic_settings" ("createdById");
CREATE INDEX IF NOT EXISTS "idx_school_academic_settings_activatedById" ON "school_academic_settings" ("activatedById");
CREATE INDEX IF NOT EXISTS "idx_school_academic_settings_lockedById" ON "school_academic_settings" ("lockedById");

-- Table: school_calendar_configs
CREATE TABLE IF NOT EXISTS "school_calendar_configs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "startMonth" INTEGER NOT NULL DEFAULT 8,
  "preEntryWeekNumber" INTEGER NOT NULL DEFAULT 2,
  "preEntryDayOfWeek" INTEGER NOT NULL DEFAULT 1,
  "entryWeekOffset" INTEGER NOT NULL DEFAULT 1,
  "endMonth" INTEGER NOT NULL DEFAULT 5,
  "endDayOfWeek" INTEGER NOT NULL DEFAULT 5,
  "quarter1EndMonth" INTEGER NOT NULL DEFAULT 11,
  "quarter1EndDay" INTEGER NOT NULL DEFAULT 31,
  "quarter2EndMonth" INTEGER NOT NULL DEFAULT 2,
  "quarter2EndDay" INTEGER NOT NULL DEFAULT 31,
  "quarter3EndMonth" INTEGER NOT NULL DEFAULT 5,
  "quarter3EndDay" INTEGER NOT NULL DEFAULT 30,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_school_calendar_configs_tenantId" ON "school_calendar_configs" ("tenantId");

-- Table: school_levels
CREATE TABLE IF NOT EXISTS "school_levels" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "isActive" INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS "idx_school_levels_tenantId" ON "school_levels" ("tenantId");

-- Table: school_payment_accounts
CREATE TABLE IF NOT EXISTS "school_payment_accounts" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "psp" TEXT NOT NULL,
  "accountIdentifier" TEXT NOT NULL,
  "accountName" TEXT NOT NULL,
  "accountType" TEXT,
  "isVerified" INTEGER NOT NULL DEFAULT 0,
  "verifiedAt" TEXT,
  "verifiedBy" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "metadata" TEXT,
  "createdBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_school_payment_accounts_tenantId" ON "school_payment_accounts" ("tenantId");

-- Table: school_search_logs
CREATE TABLE IF NOT EXISTS "school_search_logs" (
  "id" TEXT PRIMARY KEY,
  "searchTerm" TEXT NOT NULL,
  "ipAddress" TEXT,
  "resultsCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);


-- Table: school_settings
CREATE TABLE IF NOT EXISTS "school_settings" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "schoolName" TEXT NOT NULL,
  "logoUrl" TEXT,
  "sealUrl" TEXT,
  "signatureUrl" TEXT,
  "timezone" TEXT NOT NULL,
  "defaultLanguage" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "currencySymbol" TEXT NOT NULL,
  "address" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "website" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "abbreviation" TEXT,
  "authorizationDate" TEXT,
  "authorizationNumber" TEXT,
  "city" TEXT,
  "country" TEXT NOT NULL,
  "department" TEXT,
  "establishmentType" TEXT NOT NULL,
  "fax" TEXT,
  "foundingDate" TEXT,
  "gpsCoordinates" TEXT,
  "postalCode" TEXT,
  "primaryColor" TEXT NOT NULL,
  "secondaryColor" TEXT NOT NULL,
  "secondaryPhone" TEXT,
  "slogan" TEXT,
  "socialMediaLinks" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "whatsapp" TEXT,
  "feexpayShopId" TEXT,
  "feexpayApiKey" TEXT,
  "adminStructureMode" TEXT NOT NULL,
  "fedapayShopId" TEXT,
  "fedapayApiKey" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_school_settings_tenantId" ON "school_settings" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_school_settings_feexpayShopId" ON "school_settings" ("feexpayShopId");
CREATE INDEX IF NOT EXISTS "idx_school_settings_fedapayShopId" ON "school_settings" ("fedapayShopId");

-- Table: school_strategic_snapshots
CREATE TABLE IF NOT EXISTS "school_strategic_snapshots" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "climateScore" REAL,
  "academicScore" REAL,
  "financeScore" REAL,
  "rhScore" REAL,
  "globalIndex" REAL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_school_strategic_snapshots_tenantId" ON "school_strategic_snapshots" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_school_strategic_snapshots_academicYearId" ON "school_strategic_snapshots" ("academicYearId");

-- Table: schools
CREATE TABLE IF NOT EXISTS "schools" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "abbreviation" TEXT,
  "educationLevels" TEXT,
  "motto" TEXT,
  "slogan" TEXT,
  "address" TEXT,
  "primaryPhone" TEXT,
  "secondaryPhone" TEXT,
  "primaryEmail" TEXT,
  "website" TEXT,
  "whatsapp" TEXT,
  "logo" TEXT,
  "primaryColor" TEXT NOT NULL,
  "secondaryColor" TEXT NOT NULL,
  "founderName" TEXT,
  "directorPrimary" TEXT,
  "directorSecondary" TEXT,
  "createdBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "city" TEXT,
  "department" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_schools_tenantId" ON "schools" ("tenantId");

-- Table: security_events
CREATE TABLE IF NOT EXISTS "security_events" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT,
  "userId" TEXT,
  "eventType" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "ipAddress" TEXT,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_security_events_tenantId" ON "security_events" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_security_events_userId" ON "security_events" ("userId");

-- Table: security_settings
CREATE TABLE IF NOT EXISTS "security_settings" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "passwordMinLength" INTEGER NOT NULL DEFAULT 8,
  "passwordRequireUppercase" INTEGER NOT NULL DEFAULT 1,
  "passwordRequireLowercase" INTEGER NOT NULL DEFAULT 1,
  "passwordRequireNumbers" INTEGER NOT NULL DEFAULT 1,
  "passwordRequireSpecial" INTEGER NOT NULL DEFAULT 0,
  "passwordExpirationDays" INTEGER,
  "sessionTimeoutMinutes" INTEGER NOT NULL DEFAULT 30,
  "maxLoginAttempts" INTEGER NOT NULL DEFAULT 5,
  "lockoutDurationMinutes" INTEGER NOT NULL DEFAULT 15,
  "twoFactorEnabled" INTEGER NOT NULL DEFAULT 0,
  "requireEmailVerification" INTEGER NOT NULL DEFAULT 1,
  "auditLogRetentionDays" INTEGER NOT NULL DEFAULT 365,
  "dataRetentionYears" INTEGER NOT NULL DEFAULT 7,
  "gdprCompliant" INTEGER NOT NULL DEFAULT 0,
  "allowInspectionAccess" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_security_settings_tenantId" ON "security_settings" ("tenantId");

-- Table: seo_meta
CREATE TABLE IF NOT EXISTS "seo_meta" (
  "id" TEXT PRIMARY KEY,
  "pagePath" TEXT NOT NULL,
  "title" TEXT,
  "description" TEXT,
  "ogTitle" TEXT,
  "ogDescription" TEXT,
  "ogImageUrl" TEXT,
  "keywords" TEXT,
  "canonicalUrl" TEXT,
  "noIndex" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);


-- Table: sessions
CREATE TABLE IF NOT EXISTS "sessions" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "expiresAt" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_sessions_userId" ON "sessions" ("userId");

-- Table: settings_bilingual
CREATE TABLE IF NOT EXISTS "settings_bilingual" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "isEnabled" INTEGER NOT NULL DEFAULT 0,
  "separateSubjects" INTEGER NOT NULL DEFAULT 1,
  "separateGrades" INTEGER NOT NULL DEFAULT 1,
  "defaultUILanguage" TEXT NOT NULL,
  "migrationRequired" INTEGER NOT NULL DEFAULT 0,
  "migrationStatus" TEXT,
  "migratedAt" TEXT,
  "billingImpactAcknowledged" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "defaultLanguage" TEXT NOT NULL,
  "activatedAt" TEXT,
  "pricingSupplement" INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "idx_settings_bilingual_tenantId" ON "settings_bilingual" ("tenantId");

-- Table: settings_communication
CREATE TABLE IF NOT EXISTS "settings_communication" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "smsProvider" TEXT,
  "smsCredentials" TEXT,
  "smsEnabled" INTEGER NOT NULL DEFAULT 0,
  "whatsappProvider" TEXT,
  "whatsappCredentials" TEXT,
  "whatsappEnabled" INTEGER NOT NULL DEFAULT 0,
  "smtpHost" TEXT,
  "smtpPort" INTEGER DEFAULT 587,
  "smtpUser" TEXT,
  "smtpPassword" TEXT,
  "smtpFromEmail" TEXT,
  "smtpFromName" TEXT,
  "smtpSecure" INTEGER NOT NULL DEFAULT 1,
  "emailEnabled" INTEGER NOT NULL DEFAULT 0,
  "defaultSenderName" TEXT,
  "defaultSenderPhone" TEXT,
  "dailySmsLimit" INTEGER,
  "dailyEmailLimit" INTEGER,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_settings_communication_tenantId" ON "settings_communication" ("tenantId");

-- Table: settings_history
CREATE TABLE IF NOT EXISTS "settings_history" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "settingId" TEXT,
  "key" TEXT NOT NULL,
  "category" TEXT,
  "oldValue" TEXT,
  "newValue" TEXT,
  "changedBy" TEXT,
  "changedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "reason" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_settings_history_tenantId" ON "settings_history" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_settings_history_settingId" ON "settings_history" ("settingId");

-- Table: settings_pedagogical_structure
CREATE TABLE IF NOT EXISTS "settings_pedagogical_structure" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "maternelleEnabled" INTEGER NOT NULL DEFAULT 0,
  "primaireEnabled" INTEGER NOT NULL DEFAULT 1,
  "secondaireEnabled" INTEGER NOT NULL DEFAULT 1,
  "cyclesConfiguration" TEXT,
  "activeSeries" TEXT,
  "allowLevelModification" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_settings_pedagogical_structure_tenantId" ON "settings_pedagogical_structure" ("tenantId");

-- Table: shop_categories
CREATE TABLE IF NOT EXISTS "shop_categories" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "parentId" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_shop_categories_tenantId" ON "shop_categories" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_shop_categories_parentId" ON "shop_categories" ("parentId");

-- Table: shop_deliveries
CREATE TABLE IF NOT EXISTS "shop_deliveries" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "deliveryMode" TEXT NOT NULL,
  "recipientName" TEXT,
  "deliveredAt" TEXT,
  "status" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_shop_deliveries_tenantId" ON "shop_deliveries" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_shop_deliveries_academicYearId" ON "shop_deliveries" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_shop_deliveries_orderId" ON "shop_deliveries" ("orderId");

-- Table: shop_discounts
CREATE TABLE IF NOT EXISTS "shop_discounts" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "value" REAL NOT NULL,
  "code" TEXT,
  "startDate" TEXT,
  "endDate" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_shop_discounts_tenantId" ON "shop_discounts" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_shop_discounts_academicYearId" ON "shop_discounts" ("academicYearId");

-- Table: shop_loyalty_cards
CREATE TABLE IF NOT EXISTS "shop_loyalty_cards" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "studentId" TEXT,
  "staffId" TEXT,
  "cardNumber" TEXT NOT NULL,
  "balance" REAL NOT NULL DEFAULT 0,
  "points" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_shop_loyalty_cards_tenantId" ON "shop_loyalty_cards" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_shop_loyalty_cards_studentId" ON "shop_loyalty_cards" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_shop_loyalty_cards_staffId" ON "shop_loyalty_cards" ("staffId");

-- Table: shop_order_items
CREATE TABLE IF NOT EXISTS "shop_order_items" (
  "id" TEXT PRIMARY KEY,
  "orderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" REAL NOT NULL,
  "totalPrice" REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_shop_order_items_orderId" ON "shop_order_items" ("orderId");
CREATE INDEX IF NOT EXISTS "idx_shop_order_items_productId" ON "shop_order_items" ("productId");

-- Table: shop_orders
CREATE TABLE IF NOT EXISTS "shop_orders" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "orderNumber" TEXT NOT NULL,
  "studentId" TEXT,
  "parentId" TEXT,
  "totalAmount" REAL NOT NULL,
  "status" TEXT NOT NULL,
  "paymentStatus" TEXT NOT NULL,
  "pickupDate" TEXT,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_shop_orders_tenantId" ON "shop_orders" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_shop_orders_academicYearId" ON "shop_orders" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_shop_orders_studentId" ON "shop_orders" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_shop_orders_parentId" ON "shop_orders" ("parentId");

-- Table: shop_products
CREATE TABLE IF NOT EXISTS "shop_products" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "unitPrice" REAL NOT NULL,
  "costPrice" REAL,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "categoryId" TEXT,
  "imageUrl" TEXT,
  "maxStock" INTEGER,
  "minStock" INTEGER NOT NULL DEFAULT 5,
  "taxRate" REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "idx_shop_products_tenantId" ON "shop_products" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_shop_products_academicYearId" ON "shop_products" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_shop_products_categoryId" ON "shop_products" ("categoryId");

-- Table: shop_purchase_orders
CREATE TABLE IF NOT EXISTS "shop_purchase_orders" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "poNumber" TEXT NOT NULL,
  "date" TEXT NOT NULL DEFAULT (datetime('now')),
  "totalAmount" REAL NOT NULL,
  "status" TEXT NOT NULL,
  "notes" TEXT,
  "receivedAt" TEXT,
  "receivedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_shop_purchase_orders_tenantId" ON "shop_purchase_orders" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_shop_purchase_orders_academicYearId" ON "shop_purchase_orders" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_shop_purchase_orders_supplierId" ON "shop_purchase_orders" ("supplierId");

-- Table: shop_returns
CREATE TABLE IF NOT EXISTS "shop_returns" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "saleId" TEXT,
  "orderId" TEXT,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "reason" TEXT,
  "status" TEXT NOT NULL,
  "refundAmount" REAL NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_shop_returns_tenantId" ON "shop_returns" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_shop_returns_academicYearId" ON "shop_returns" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_shop_returns_saleId" ON "shop_returns" ("saleId");
CREATE INDEX IF NOT EXISTS "idx_shop_returns_orderId" ON "shop_returns" ("orderId");
CREATE INDEX IF NOT EXISTS "idx_shop_returns_productId" ON "shop_returns" ("productId");

-- Table: shop_sale_items
CREATE TABLE IF NOT EXISTS "shop_sale_items" (
  "id" TEXT PRIMARY KEY,
  "saleId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" REAL NOT NULL,
  "totalPrice" REAL NOT NULL,
  "discount" REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "idx_shop_sale_items_saleId" ON "shop_sale_items" ("saleId");
CREATE INDEX IF NOT EXISTS "idx_shop_sale_items_productId" ON "shop_sale_items" ("productId");

-- Table: shop_sales
CREATE TABLE IF NOT EXISTS "shop_sales" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "saleNumber" TEXT NOT NULL,
  "saleDate" TEXT NOT NULL DEFAULT (datetime('now')),
  "customerType" TEXT NOT NULL,
  "customerName" TEXT,
  "totalAmount" REAL NOT NULL,
  "paymentStatus" TEXT NOT NULL,
  "notes" TEXT,
  "soldBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "discountAmount" REAL NOT NULL DEFAULT 0,
  "parentId" TEXT,
  "paymentMode" TEXT NOT NULL,
  "staffId" TEXT,
  "studentId" TEXT,
  "subTotal" REAL NOT NULL,
  "taxAmount" REAL NOT NULL DEFAULT 0,
  "walletUsed" INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "idx_shop_sales_tenantId" ON "shop_sales" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_shop_sales_academicYearId" ON "shop_sales" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_shop_sales_parentId" ON "shop_sales" ("parentId");
CREATE INDEX IF NOT EXISTS "idx_shop_sales_staffId" ON "shop_sales" ("staffId");
CREATE INDEX IF NOT EXISTS "idx_shop_sales_studentId" ON "shop_sales" ("studentId");

-- Table: shop_school_kit_items
CREATE TABLE IF NOT EXISTS "shop_school_kit_items" (
  "id" TEXT PRIMARY KEY,
  "kitId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS "idx_shop_school_kit_items_kitId" ON "shop_school_kit_items" ("kitId");
CREATE INDEX IF NOT EXISTS "idx_shop_school_kit_items_productId" ON "shop_school_kit_items" ("productId");

-- Table: shop_school_kits
CREATE TABLE IF NOT EXISTS "shop_school_kits" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "schoolLevelId" TEXT,
  "price" REAL NOT NULL,
  "description" TEXT,
  "isMandatory" INTEGER NOT NULL DEFAULT 0,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_shop_school_kits_tenantId" ON "shop_school_kits" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_shop_school_kits_academicYearId" ON "shop_school_kits" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_shop_school_kits_schoolLevelId" ON "shop_school_kits" ("schoolLevelId");

-- Table: shop_settings
CREATE TABLE IF NOT EXISTS "shop_settings" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "lowStockAlert" INTEGER NOT NULL DEFAULT 1,
  "allowPreOrders" INTEGER NOT NULL DEFAULT 1,
  "loyaltyProgramActive" INTEGER NOT NULL DEFAULT 0,
  "pointsPer1000" INTEGER NOT NULL DEFAULT 10,
  "receiptHeader" TEXT,
  "receiptFooter" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_shop_settings_tenantId" ON "shop_settings" ("tenantId");

-- Table: shop_stock_movements
CREATE TABLE IF NOT EXISTS "shop_stock_movements" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "reason" TEXT,
  "referenceId" TEXT,
  "performedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_shop_stock_movements_tenantId" ON "shop_stock_movements" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_shop_stock_movements_productId" ON "shop_stock_movements" ("productId");
CREATE INDEX IF NOT EXISTS "idx_shop_stock_movements_referenceId" ON "shop_stock_movements" ("referenceId");

-- Table: shop_stocks
CREATE TABLE IF NOT EXISTS "shop_stocks" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "reservedQty" INTEGER NOT NULL DEFAULT 0,
  "location" TEXT,
  "lastInventory" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_shop_stocks_tenantId" ON "shop_stocks" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_shop_stocks_productId" ON "shop_stocks" ("productId");

-- Table: shop_suppliers
CREATE TABLE IF NOT EXISTS "shop_suppliers" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contactName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "category" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_shop_suppliers_tenantId" ON "shop_suppliers" ("tenantId");

-- Table: shop_wallet_transactions
CREATE TABLE IF NOT EXISTS "shop_wallet_transactions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "cardId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "reference" TEXT,
  "description" TEXT,
  "performedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_shop_wallet_transactions_tenantId" ON "shop_wallet_transactions" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_shop_wallet_transactions_cardId" ON "shop_wallet_transactions" ("cardId");

-- Table: signed_documents
CREATE TABLE IF NOT EXISTS "signed_documents" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "documentHash" TEXT NOT NULL,
  "signatureId" TEXT NOT NULL,
  "signedBy" TEXT NOT NULL,
  "signedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "verificationToken" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_signed_documents_tenantId" ON "signed_documents" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_signed_documents_documentId" ON "signed_documents" ("documentId");
CREATE INDEX IF NOT EXISTS "idx_signed_documents_signatureId" ON "signed_documents" ("signatureId");

-- Table: sms_logs
CREATE TABLE IF NOT EXISTS "sms_logs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "provider" TEXT,
  "providerId" TEXT,
  "cost" REAL,
  "sentAt" TEXT,
  "deliveredAt" TEXT,
  "errorMessage" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_sms_logs_tenantId" ON "sms_logs" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_sms_logs_providerId" ON "sms_logs" ("providerId");

-- Table: staff
CREATE TABLE IF NOT EXISTS "staff" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "schoolLevelId" TEXT,
  "employeeNumber" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "gender" TEXT,
  "dateOfBirth" TEXT,
  "birthDate" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "position" TEXT,
  "department" TEXT,
  "roleType" TEXT NOT NULL,
  "hireDate" TEXT,
  "contractType" TEXT,
  "status" TEXT NOT NULL,
  "salary" REAL,
  "bankDetails" TEXT,
  "emergencyContact" TEXT,
  "qualifications" TEXT,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "globalMatricule" TEXT,
  "tenantMatricule" TEXT,
  "terminationType" TEXT,
  "terminationDetails" TEXT,
  "terminatedAt" TEXT,
  "noticePeriodDays" INTEGER,
  "lastWorkingDate" TEXT,
  "nationality" TEXT,
  "maritalStatus" TEXT,
  "numberOfChildren" INTEGER,
  "nationalId" TEXT,
  "cnssNumber" TEXT,
  "ifuNumber" TEXT,
  "mobileMoneyNumber" TEXT,
  "mobileMoneyOperator" TEXT,
  "ifNumber" TEXT,
  "assignedLanguages" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_staff_tenantId" ON "staff" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_staff_academicYearId" ON "staff" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_staff_schoolLevelId" ON "staff" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_staff_nationalId" ON "staff" ("nationalId");

-- Table: staff_admin_assignments
CREATE TABLE IF NOT EXISTS "staff_admin_assignments" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "schoolLevelCode" TEXT NOT NULL,
  "adminRole" TEXT NOT NULL,
  "academicYearId" TEXT,
  "startDate" TEXT NOT NULL DEFAULT (datetime('now')),
  "endDate" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_staff_admin_assignments_tenantId" ON "staff_admin_assignments" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_staff_admin_assignments_staffId" ON "staff_admin_assignments" ("staffId");
CREATE INDEX IF NOT EXISTS "idx_staff_admin_assignments_academicYearId" ON "staff_admin_assignments" ("academicYearId");

-- Table: staff_allowances
CREATE TABLE IF NOT EXISTS "staff_allowances" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "schoolLevelId" TEXT,
  "staffId" TEXT NOT NULL,
  "allowanceTypeId" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "effectiveDate" TEXT NOT NULL,
  "endDate" TEXT,
  "status" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_staff_allowances_tenantId" ON "staff_allowances" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_staff_allowances_academicYearId" ON "staff_allowances" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_staff_allowances_schoolLevelId" ON "staff_allowances" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_staff_allowances_staffId" ON "staff_allowances" ("staffId");
CREATE INDEX IF NOT EXISTS "idx_staff_allowances_allowanceTypeId" ON "staff_allowances" ("allowanceTypeId");

-- Table: staff_assignments
CREATE TABLE IF NOT EXISTS "staff_assignments" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "classId" TEXT,
  "subjectId" TEXT,
  "role" TEXT NOT NULL,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT,
  "status" TEXT NOT NULL,
  "hoursPerWeek" INTEGER,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_staff_assignments_tenantId" ON "staff_assignments" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_staff_assignments_academicYearId" ON "staff_assignments" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_staff_assignments_schoolLevelId" ON "staff_assignments" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_staff_assignments_staffId" ON "staff_assignments" ("staffId");
CREATE INDEX IF NOT EXISTS "idx_staff_assignments_classId" ON "staff_assignments" ("classId");
CREATE INDEX IF NOT EXISTS "idx_staff_assignments_subjectId" ON "staff_assignments" ("subjectId");

-- Table: staff_attendances
CREATE TABLE IF NOT EXISTS "staff_attendances" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT,
  "staffId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "checkIn" TEXT,
  "checkOut" TEXT,
  "status" TEXT NOT NULL,
  "hoursWorked" REAL,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "latitude" REAL,
  "longitude" REAL,
  "markedByRole" TEXT NOT NULL,
  "geoAccuracy" REAL,
  "geoVerified" INTEGER NOT NULL DEFAULT 0,
  "geoDistance" REAL,
  "markedBy" TEXT,
  "deviceInfo" TEXT,
  "ipAddress" TEXT,
  "checkOutMethod" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_staff_attendances_tenantId" ON "staff_attendances" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_staff_attendances_academicYearId" ON "staff_attendances" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_staff_attendances_schoolLevelId" ON "staff_attendances" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_staff_attendances_staffId" ON "staff_attendances" ("staffId");

-- Table: staff_documents
CREATE TABLE IF NOT EXISTS "staff_documents" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "schoolLevelId" TEXT,
  "staffId" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "fileSize" INTEGER,
  "mimeType" TEXT,
  "validated" INTEGER NOT NULL DEFAULT 0,
  "uploadedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT,
  "validationStatus" TEXT NOT NULL,
  "expiresAt" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS "idx_staff_documents_tenantId" ON "staff_documents" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_staff_documents_academicYearId" ON "staff_documents" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_staff_documents_schoolLevelId" ON "staff_documents" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_staff_documents_staffId" ON "staff_documents" ("staffId");

-- Table: staff_evaluations
CREATE TABLE IF NOT EXISTS "staff_evaluations" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT,
  "staffId" TEXT NOT NULL,
  "evaluatorId" TEXT,
  "score" REAL,
  "comments" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_staff_evaluations_tenantId" ON "staff_evaluations" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_staff_evaluations_academicYearId" ON "staff_evaluations" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_staff_evaluations_schoolLevelId" ON "staff_evaluations" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_staff_evaluations_staffId" ON "staff_evaluations" ("staffId");
CREATE INDEX IF NOT EXISTS "idx_staff_evaluations_evaluatorId" ON "staff_evaluations" ("evaluatorId");

-- Table: staff_number_sequences
CREATE TABLE IF NOT EXISTS "staff_number_sequences" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "current" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_staff_number_sequences_tenantId" ON "staff_number_sequences" ("tenantId");

-- Table: staff_photos
CREATE TABLE IF NOT EXISTS "staff_photos" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "originalUrl" TEXT NOT NULL,
  "hdUrl" TEXT NOT NULL,
  "thumbnailUrl" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "academicYearId" TEXT,
  "schoolLevelId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_staff_photos_tenantId" ON "staff_photos" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_staff_photos_staffId" ON "staff_photos" ("staffId");
CREATE INDEX IF NOT EXISTS "idx_staff_photos_academicYearId" ON "staff_photos" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_staff_photos_schoolLevelId" ON "staff_photos" ("schoolLevelId");

-- Table: staff_schedules
CREATE TABLE IF NOT EXISTS "staff_schedules" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT,
  "staffId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "shiftType" TEXT NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "role" TEXT,
  "location" TEXT,
  "notes" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_staff_schedules_tenantId" ON "staff_schedules" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_staff_schedules_academicYearId" ON "staff_schedules" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_staff_schedules_schoolLevelId" ON "staff_schedules" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_staff_schedules_staffId" ON "staff_schedules" ("staffId");

-- Table: staff_trainings
CREATE TABLE IF NOT EXISTS "staff_trainings" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "schoolLevelId" TEXT,
  "staffId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "provider" TEXT,
  "dateCompleted" TEXT NOT NULL,
  "description" TEXT,
  "certificatePath" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_staff_trainings_tenantId" ON "staff_trainings" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_staff_trainings_academicYearId" ON "staff_trainings" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_staff_trainings_schoolLevelId" ON "staff_trainings" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_staff_trainings_staffId" ON "staff_trainings" ("staffId");

-- Table: store_payments
CREATE TABLE IF NOT EXISTS "store_payments" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "paymentMethod" TEXT NOT NULL,
  "paymentDate" TEXT NOT NULL DEFAULT (datetime('now')),
  "status" TEXT NOT NULL,
  "reference" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_store_payments_tenantId" ON "store_payments" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_store_payments_academicYearId" ON "store_payments" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_store_payments_schoolLevelId" ON "store_payments" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_store_payments_orderId" ON "store_payments" ("orderId");

-- Table: student_academic_records
CREATE TABLE IF NOT EXISTS "student_academic_records" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "classId" TEXT,
  "schoolLevelId" TEXT NOT NULL,
  "level" TEXT,
  "enrollmentStatus" TEXT NOT NULL,
  "averageScore" REAL,
  "rank" INTEGER,
  "totalAbsences" INTEGER NOT NULL DEFAULT 0,
  "totalIncidents" INTEGER NOT NULL DEFAULT 0,
  "totalSanctions" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_student_academic_records_tenantId" ON "student_academic_records" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_student_academic_records_studentId" ON "student_academic_records" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_student_academic_records_academicYearId" ON "student_academic_records" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_student_academic_records_classId" ON "student_academic_records" ("classId");
CREATE INDEX IF NOT EXISTS "idx_student_academic_records_schoolLevelId" ON "student_academic_records" ("schoolLevelId");

-- Table: student_academic_tracks
CREATE TABLE IF NOT EXISTS "student_academic_tracks" (
  "id" TEXT PRIMARY KEY,
  "studentId" TEXT NOT NULL,
  "academicTrackId" TEXT NOT NULL,
  "enrollmentDate" TEXT,
  "exitDate" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_student_academic_tracks_studentId" ON "student_academic_tracks" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_student_academic_tracks_academicTrackId" ON "student_academic_tracks" ("academicTrackId");

-- Table: student_accounts
CREATE TABLE IF NOT EXISTS "student_accounts" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "totalDue" REAL NOT NULL DEFAULT 0,
  "totalPaid" REAL NOT NULL DEFAULT 0,
  "balance" REAL NOT NULL DEFAULT 0,
  "arrearsAmount" REAL NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL,
  "isBlocked" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "carriedArrears" REAL NOT NULL DEFAULT 0,
  "blockReason" TEXT,
  "blockDate" TEXT,
  "unblockDate" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_student_accounts_tenantId" ON "student_accounts" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_student_accounts_studentId" ON "student_accounts" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_student_accounts_academicYearId" ON "student_accounts" ("academicYearId");

-- Table: student_arrears
CREATE TABLE IF NOT EXISTS "student_arrears" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "fromAcademicYearId" TEXT NOT NULL,
  "toAcademicYearId" TEXT NOT NULL,
  "amountDue" REAL NOT NULL,
  "amountPaid" REAL NOT NULL DEFAULT 0,
  "balanceDue" REAL NOT NULL,
  "status" TEXT NOT NULL,
  "generatedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_student_arrears_tenantId" ON "student_arrears" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_student_arrears_studentId" ON "student_arrears" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_student_arrears_fromAcademicYearId" ON "student_arrears" ("fromAcademicYearId");
CREATE INDEX IF NOT EXISTS "idx_student_arrears_toAcademicYearId" ON "student_arrears" ("toAcademicYearId");

-- Table: student_audit_logs
CREATE TABLE IF NOT EXISTS "student_audit_logs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "beforeData" TEXT,
  "afterData" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_student_audit_logs_tenantId" ON "student_audit_logs" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_student_audit_logs_studentId" ON "student_audit_logs" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_student_audit_logs_userId" ON "student_audit_logs" ("userId");

-- Table: student_council_decisions
CREATE TABLE IF NOT EXISTS "student_council_decisions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "councilId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "appreciation" TEXT,
  "recommendation" TEXT,
  "sanctions" TEXT,
  "decidedById" TEXT NOT NULL,
  "decidedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_student_council_decisions_tenantId" ON "student_council_decisions" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_student_council_decisions_councilId" ON "student_council_decisions" ("councilId");
CREATE INDEX IF NOT EXISTS "idx_student_council_decisions_studentId" ON "student_council_decisions" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_student_council_decisions_decidedById" ON "student_council_decisions" ("decidedById");

-- Table: student_disciplinary_summaries
CREATE TABLE IF NOT EXISTS "student_disciplinary_summaries" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "absencesCount" INTEGER NOT NULL DEFAULT 0,
  "justifiedAbsences" INTEGER NOT NULL DEFAULT 0,
  "unjustifiedAbsences" INTEGER NOT NULL DEFAULT 0,
  "incidentsCount" INTEGER NOT NULL DEFAULT 0,
  "minorIncidents" INTEGER NOT NULL DEFAULT 0,
  "majorIncidents" INTEGER NOT NULL DEFAULT 0,
  "sanctionsCount" INTEGER NOT NULL DEFAULT 0,
  "warningsCount" INTEGER NOT NULL DEFAULT 0,
  "suspensionsCount" INTEGER NOT NULL DEFAULT 0,
  "expulsionsCount" INTEGER NOT NULL DEFAULT 0,
  "lastIncidentDate" TEXT,
  "lastSanctionDate" TEXT,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_student_disciplinary_summaries_tenantId" ON "student_disciplinary_summaries" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_student_disciplinary_summaries_studentId" ON "student_disciplinary_summaries" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_student_disciplinary_summaries_academicYearId" ON "student_disciplinary_summaries" ("academicYearId");

-- Table: student_documents
CREATE TABLE IF NOT EXISTS "student_documents" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "fileSize" INTEGER,
  "mimeType" TEXT,
  "uploadedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_student_documents_tenantId" ON "student_documents" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_student_documents_academicYearId" ON "student_documents" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_student_documents_schoolLevelId" ON "student_documents" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_student_documents_studentId" ON "student_documents" ("studentId");

-- Table: student_enrollments
CREATE TABLE IF NOT EXISTS "student_enrollments" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "classId" TEXT,
  "enrollmentType" TEXT NOT NULL,
  "enrollmentDate" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "exitDate" TEXT,
  "exitReason" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "previousArrears" REAL NOT NULL DEFAULT 0,
  "academicTermId" TEXT,
  "entryDate" TEXT,
  "localStudentMatricule" TEXT,
  "transferStatus" TEXT,
  "academicClassId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_student_enrollments_tenantId" ON "student_enrollments" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_student_enrollments_academicYearId" ON "student_enrollments" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_student_enrollments_schoolLevelId" ON "student_enrollments" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_student_enrollments_studentId" ON "student_enrollments" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_student_enrollments_classId" ON "student_enrollments" ("classId");
CREATE INDEX IF NOT EXISTS "idx_student_enrollments_academicTermId" ON "student_enrollments" ("academicTermId");
CREATE INDEX IF NOT EXISTS "idx_student_enrollments_academicClassId" ON "student_enrollments" ("academicClassId");

-- Table: student_fee_profiles
CREATE TABLE IF NOT EXISTS "student_fee_profiles" (
  "id" TEXT PRIMARY KEY,
  "studentId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "feeRegimeId" TEXT NOT NULL,
  "justification" TEXT,
  "validatedBy" TEXT,
  "validatedAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_student_fee_profiles_studentId" ON "student_fee_profiles" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_student_fee_profiles_academicYearId" ON "student_fee_profiles" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_student_fee_profiles_feeRegimeId" ON "student_fee_profiles" ("feeRegimeId");

-- Table: student_fees
CREATE TABLE IF NOT EXISTS "student_fees" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "feeDefinitionId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "totalAmount" REAL NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_student_fees_tenantId" ON "student_fees" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_student_fees_studentId" ON "student_fees" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_student_fees_feeDefinitionId" ON "student_fees" ("feeDefinitionId");
CREATE INDEX IF NOT EXISTS "idx_student_fees_academicYearId" ON "student_fees" ("academicYearId");

-- Table: student_guardians
CREATE TABLE IF NOT EXISTS "student_guardians" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "guardianId" TEXT NOT NULL,
  "relationship" TEXT NOT NULL,
  "isPrimary" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_student_guardians_tenantId" ON "student_guardians" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_student_guardians_studentId" ON "student_guardians" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_student_guardians_guardianId" ON "student_guardians" ("guardianId");

-- Table: student_id_cards
CREATE TABLE IF NOT EXISTS "student_id_cards" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "cardNumber" TEXT NOT NULL,
  "qrPayload" TEXT NOT NULL,
  "qrHash" TEXT NOT NULL,
  "frontImagePath" TEXT,
  "backImagePath" TEXT,
  "pdfPath" TEXT,
  "generatedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "generatedBy" TEXT,
  "validUntil" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "isRevoked" INTEGER NOT NULL DEFAULT 0,
  "revokedAt" TEXT,
  "revokedBy" TEXT,
  "revocationReason" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "templateId" TEXT,
  "designSnapshot" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_student_id_cards_tenantId" ON "student_id_cards" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_student_id_cards_academicYearId" ON "student_id_cards" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_student_id_cards_schoolLevelId" ON "student_id_cards" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_student_id_cards_studentId" ON "student_id_cards" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_student_id_cards_templateId" ON "student_id_cards" ("templateId");

-- Table: student_identifiers
CREATE TABLE IF NOT EXISTS "student_identifiers" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "globalMatricule" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "institutionCode" TEXT NOT NULL,
  "firstEnrollmentYear" INTEGER NOT NULL,
  "sequenceNumber" INTEGER NOT NULL,
  "temporaryLocalId" TEXT,
  "isOfflineGenerated" INTEGER NOT NULL DEFAULT 0,
  "synchronizedAt" TEXT,
  "generatedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "generatedBy" TEXT,
  "locked" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_student_identifiers_tenantId" ON "student_identifiers" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_student_identifiers_studentId" ON "student_identifiers" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_student_identifiers_temporaryLocalId" ON "student_identifiers" ("temporaryLocalId");

-- Table: student_number_sequences
CREATE TABLE IF NOT EXISTS "student_number_sequences" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "current" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_student_number_sequences_tenantId" ON "student_number_sequences" ("tenantId");

-- Table: student_period_averages
CREATE TABLE IF NOT EXISTS "student_period_averages" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "totalWeighted" REAL NOT NULL DEFAULT 0,
  "totalCoefficient" REAL NOT NULL DEFAULT 0,
  "generalAverage" REAL NOT NULL DEFAULT 0,
  "classRank" INTEGER NOT NULL DEFAULT 0,
  "isPublished" INTEGER NOT NULL DEFAULT 0,
  "calculatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_student_period_averages_tenantId" ON "student_period_averages" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_student_period_averages_academicYearId" ON "student_period_averages" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_student_period_averages_periodId" ON "student_period_averages" ("periodId");
CREATE INDEX IF NOT EXISTS "idx_student_period_averages_studentId" ON "student_period_averages" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_student_period_averages_classId" ON "student_period_averages" ("classId");

-- Table: student_photos
CREATE TABLE IF NOT EXISTS "student_photos" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "originalUrl" TEXT NOT NULL,
  "hdUrl" TEXT NOT NULL,
  "thumbnailUrl" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_student_photos_tenantId" ON "student_photos" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_student_photos_studentId" ON "student_photos" ("studentId");

-- Table: student_subject_averages
CREATE TABLE IF NOT EXISTS "student_subject_averages" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "average" REAL NOT NULL DEFAULT 0,
  "coefficient" REAL NOT NULL DEFAULT 1.0,
  "weightedAverage" REAL NOT NULL DEFAULT 0,
  "appreciation" TEXT,
  "calculatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_student_subject_averages_tenantId" ON "student_subject_averages" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_student_subject_averages_academicYearId" ON "student_subject_averages" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_student_subject_averages_periodId" ON "student_subject_averages" ("periodId");
CREATE INDEX IF NOT EXISTS "idx_student_subject_averages_studentId" ON "student_subject_averages" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_student_subject_averages_subjectId" ON "student_subject_averages" ("subjectId");
CREATE INDEX IF NOT EXISTS "idx_student_subject_averages_classId" ON "student_subject_averages" ("classId");

-- Table: student_transfer_documents
CREATE TABLE IF NOT EXISTS "student_transfer_documents" (
  "id" TEXT PRIMARY KEY,
  "transferRequestId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileType" TEXT NOT NULL,
  "category" TEXT,
  "isOriginal" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_student_transfer_documents_transferRequestId" ON "student_transfer_documents" ("transferRequestId");

-- Table: student_transfer_messages
CREATE TABLE IF NOT EXISTS "student_transfer_messages" (
  "id" TEXT PRIMARY KEY,
  "transferRequestId" TEXT NOT NULL,
  "senderUserId" TEXT NOT NULL,
  "senderTenantId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_student_transfer_messages_transferRequestId" ON "student_transfer_messages" ("transferRequestId");
CREATE INDEX IF NOT EXISTS "idx_student_transfer_messages_senderUserId" ON "student_transfer_messages" ("senderUserId");
CREATE INDEX IF NOT EXISTS "idx_student_transfer_messages_senderTenantId" ON "student_transfer_messages" ("senderTenantId");

-- Table: student_transfer_requests
CREATE TABLE IF NOT EXISTS "student_transfer_requests" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "sourceSchoolId" TEXT NOT NULL,
  "targetSchoolId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "currentLevelId" TEXT,
  "currentClassId" TEXT,
  "requestedLevelId" TEXT,
  "requestedClassId" TEXT,
  "motif" TEXT,
  "message" TEXT,
  "status" TEXT NOT NULL,
  "decision" TEXT,
  "decisionDate" TEXT,
  "decidedBy" TEXT,
  "sourceExitConfirmed" INTEGER NOT NULL DEFAULT 0,
  "sourceExitDate" TEXT,
  "executedAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "orionVigilanceFlag" INTEGER NOT NULL DEFAULT 0,
  "orionVigilanceNote" TEXT,
  "approvedByDestination" TEXT,
  "approvedByDestinationAt" TEXT,
  "approvedBySource" TEXT,
  "approvedBySourceAt" TEXT,
  "completedAt" TEXT,
  "destinationAcademicYearId" TEXT,
  "destinationLocalMatricule" TEXT,
  "requestedAt" TEXT,
  "requestedBy" TEXT,
  "sourceLocalMatricule" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_student_transfer_requests_tenantId" ON "student_transfer_requests" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_student_transfer_requests_sourceSchoolId" ON "student_transfer_requests" ("sourceSchoolId");
CREATE INDEX IF NOT EXISTS "idx_student_transfer_requests_targetSchoolId" ON "student_transfer_requests" ("targetSchoolId");
CREATE INDEX IF NOT EXISTS "idx_student_transfer_requests_studentId" ON "student_transfer_requests" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_student_transfer_requests_academicYearId" ON "student_transfer_requests" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_student_transfer_requests_currentLevelId" ON "student_transfer_requests" ("currentLevelId");
CREATE INDEX IF NOT EXISTS "idx_student_transfer_requests_currentClassId" ON "student_transfer_requests" ("currentClassId");
CREATE INDEX IF NOT EXISTS "idx_student_transfer_requests_requestedLevelId" ON "student_transfer_requests" ("requestedLevelId");
CREATE INDEX IF NOT EXISTS "idx_student_transfer_requests_requestedClassId" ON "student_transfer_requests" ("requestedClassId");
CREATE INDEX IF NOT EXISTS "idx_student_transfer_requests_destinationAcademicYearId" ON "student_transfer_requests" ("destinationAcademicYearId");

-- Table: student_transfer_status_history
CREATE TABLE IF NOT EXISTS "student_transfer_status_history" (
  "id" TEXT PRIMARY KEY,
  "transferRequestId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "changedBy" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_student_transfer_status_history_transferRequestId" ON "student_transfer_status_history" ("transferRequestId");

-- Table: students
CREATE TABLE IF NOT EXISTS "students" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "currentAcademicYearId" TEXT,
  "schoolLevelId" TEXT NOT NULL,
  "studentCode" TEXT,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "dateOfBirth" TEXT,
  "gender" TEXT,
  "nationality" TEXT,
  "primaryLanguage" TEXT,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "placeOfBirth" TEXT,
  "regimeType" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "npi" TEXT,
  "matricule" TEXT,
  "enrollmentYear" INTEGER,
  "photoUrl" TEXT,
  "globalStudentId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_students_tenantId" ON "students" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_students_academicYearId" ON "students" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_students_currentAcademicYearId" ON "students" ("currentAcademicYearId");
CREATE INDEX IF NOT EXISTS "idx_students_schoolLevelId" ON "students" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_students_globalStudentId" ON "students" ("globalStudentId");

-- Table: subject_assignments
CREATE TABLE IF NOT EXISTS "subject_assignments" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "teacherId" TEXT,
  "classId" TEXT,
  "hoursPerWeek" INTEGER,
  "coefficient" REAL,
  "status" TEXT NOT NULL,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_subject_assignments_tenantId" ON "subject_assignments" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_subject_assignments_academicYearId" ON "subject_assignments" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_subject_assignments_schoolLevelId" ON "subject_assignments" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_subject_assignments_subjectId" ON "subject_assignments" ("subjectId");
CREATE INDEX IF NOT EXISTS "idx_subject_assignments_teacherId" ON "subject_assignments" ("teacherId");
CREATE INDEX IF NOT EXISTS "idx_subject_assignments_classId" ON "subject_assignments" ("classId");

-- Table: subjects
CREATE TABLE IF NOT EXISTS "subjects" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "schoolLevelId" TEXT NOT NULL,
  "academicTrackId" TEXT,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "coefficient" REAL NOT NULL DEFAULT 1.0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "language" TEXT,
  "weeklyHours" INTEGER DEFAULT 0,
  "description" TEXT,
  "abbreviation" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_subjects_tenantId" ON "subjects" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_subjects_academicYearId" ON "subjects" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_subjects_schoolLevelId" ON "subjects" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_subjects_academicTrackId" ON "subjects" ("academicTrackId");

-- Table: subscription_invoices
CREATE TABLE IF NOT EXISTS "subscription_invoices" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "currency" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "issueDate" TEXT NOT NULL DEFAULT (datetime('now')),
  "dueDate" TEXT NOT NULL,
  "paidAt" TEXT,
  "paymentFlowId" TEXT,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_subscription_invoices_tenantId" ON "subscription_invoices" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_subscription_invoices_subscriptionId" ON "subscription_invoices" ("subscriptionId");
CREATE INDEX IF NOT EXISTS "idx_subscription_invoices_paymentFlowId" ON "subscription_invoices" ("paymentFlowId");

-- Table: subscription_plans
CREATE TABLE IF NOT EXISTS "subscription_plans" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "monthly_price" INTEGER NOT NULL,
  "yearly_price" INTEGER NOT NULL,
  "max_schools" INTEGER NOT NULL DEFAULT 1,
  "bilingual_allowed" INTEGER NOT NULL DEFAULT 0,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now'))
);


-- Table: subscriptions
CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "plan" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT,
  "trialEndsAt" TEXT,
  "nextPaymentDueAt" TEXT,
  "amount" REAL NOT NULL,
  "currency" TEXT NOT NULL,
  "billingCycle" TEXT NOT NULL,
  "autoRenew" INTEGER NOT NULL DEFAULT 1,
  "cancelledAt" TEXT,
  "cancelledBy" TEXT,
  "cancellationReason" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "bilingual_enabled" INTEGER NOT NULL DEFAULT 0,
  "current_period_end" TEXT,
  "current_period_start" TEXT,
  "dev_override" INTEGER NOT NULL DEFAULT 0,
  "plan_id" TEXT,
  "schools_count" INTEGER NOT NULL DEFAULT 1,
  "trial_end" TEXT,
  "trial_start" TEXT,
  "notified7DaysBefore" TEXT,
  "notified3DaysBefore" TEXT,
  "notified1DayBefore" TEXT,
  "expiredAt" TEXT,
  "gracePeriodEnd" TEXT,
  "suspendedAt" TEXT,
  "blockedAt" TEXT,
  "notifiedBlockWarning" TEXT,
  "reactivationFee" INTEGER NOT NULL DEFAULT 5000
);

CREATE INDEX IF NOT EXISTS "idx_subscriptions_tenantId" ON "subscriptions" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_subscriptions_plan_id" ON "subscriptions" ("plan_id");

-- Table: sync_conflicts
CREATE TABLE IF NOT EXISTS "sync_conflicts" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "tableName" TEXT NOT NULL,
  "recordId" TEXT NOT NULL,
  "localData" TEXT NOT NULL,
  "remoteData" TEXT NOT NULL,
  "resolution" TEXT,
  "resolvedBy" TEXT,
  "resolvedAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_sync_conflicts_tenantId" ON "sync_conflicts" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_sync_conflicts_operationId" ON "sync_conflicts" ("operationId");
CREATE INDEX IF NOT EXISTS "idx_sync_conflicts_recordId" ON "sync_conflicts" ("recordId");

-- Table: sync_logs
CREATE TABLE IF NOT EXISTS "sync_logs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "level" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "details" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_sync_logs_tenantId" ON "sync_logs" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_sync_logs_operationId" ON "sync_logs" ("operationId");

-- Table: sync_operations
CREATE TABLE IF NOT EXISTS "sync_operations" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "operationType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "startedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "completedAt" TEXT,
  "recordsCount" INTEGER,
  "errorMessage" TEXT,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_sync_operations_tenantId" ON "sync_operations" ("tenantId");

-- Table: tax_declarations
CREATE TABLE IF NOT EXISTS "tax_declarations" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "data" TEXT NOT NULL,
  "totalAmount" REAL NOT NULL DEFAULT 0,
  "submittedAt" TEXT,
  "paidAt" TEXT,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_tax_declarations_tenantId" ON "tax_declarations" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_tax_declarations_academicYearId" ON "tax_declarations" ("academicYearId");

-- Table: tax_payroll_periods
CREATE TABLE IF NOT EXISTS "tax_payroll_periods" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "staffType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "totalGross" REAL NOT NULL DEFAULT 0,
  "totalDeductions" REAL NOT NULL DEFAULT 0,
  "totalNet" REAL NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_tax_payroll_periods_tenantId" ON "tax_payroll_periods" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_tax_payroll_periods_academicYearId" ON "tax_payroll_periods" ("academicYearId");

-- Table: tax_payslips
CREATE TABLE IF NOT EXISTS "tax_payslips" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "payrollPeriodId" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "salaireBase" REAL NOT NULL DEFAULT 0,
  "moinsPercesArriere" REAL NOT NULL DEFAULT 0,
  "gratificationsEtrennes" REAL NOT NULL DEFAULT 0,
  "indemnites" REAL NOT NULL DEFAULT 0,
  "primeSalissures" REAL NOT NULL DEFAULT 0,
  "salaireBrut" REAL NOT NULL DEFAULT 0,
  "cnssOuvriere" REAL NOT NULL DEFAULT 0,
  "itsNet" REAL NOT NULL DEFAULT 0,
  "irppNet" REAL NOT NULL DEFAULT 0,
  "avanceAcompte" REAL NOT NULL DEFAULT 0,
  "opposition" REAL NOT NULL DEFAULT 0,
  "taxesRadioTele" REAL NOT NULL DEFAULT 0,
  "totalRetenues" REAL NOT NULL DEFAULT 0,
  "netAPayer" REAL NOT NULL DEFAULT 0,
  "cnssPatronale" REAL NOT NULL DEFAULT 0,
  "vps" REAL NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_tax_payslips_tenantId" ON "tax_payslips" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_tax_payslips_academicYearId" ON "tax_payslips" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_tax_payslips_staffId" ON "tax_payslips" ("staffId");
CREATE INDEX IF NOT EXISTS "idx_tax_payslips_payrollPeriodId" ON "tax_payslips" ("payrollPeriodId");

-- Table: tax_rates
CREATE TABLE IF NOT EXISTS "tax_rates" (
  "id" TEXT PRIMARY KEY,
  "countryCode" TEXT NOT NULL,
  "taxType" TEXT NOT NULL,
  "bracketMin" REAL NOT NULL,
  "bracketMax" REAL,
  "ratePercentage" REAL NOT NULL,
  "fixedAmount" REAL,
  "effectiveFrom" TEXT NOT NULL,
  "effectiveTo" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "description" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);


-- Table: tax_settings
CREATE TABLE IF NOT EXISTS "tax_settings" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "cnssFamilialesRate" REAL NOT NULL DEFAULT 9.0,
  "cnssRisquesRate" REAL NOT NULL DEFAULT 1.0,
  "cnssVieillesseRate" REAL NOT NULL DEFAULT 0.0,
  "cnssPatronaleRate" REAL NOT NULL DEFAULT 6.4,
  "cnssOuvriereRate" REAL NOT NULL DEFAULT 3.6,
  "istVpsRate" REAL NOT NULL DEFAULT 4.0,
  "istIrppRate" REAL NOT NULL DEFAULT 0.0,
  "aibAchatsRate" REAL NOT NULL DEFAULT 1.0,
  "aibPrestationsRate" REAL NOT NULL DEFAULT 5.0,
  "istFrequency" TEXT NOT NULL,
  "cnssFrequency" TEXT NOT NULL,
  "aibFrequency" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_tax_settings_tenantId" ON "tax_settings" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_tax_settings_academicYearId" ON "tax_settings" ("academicYearId");

-- Table: tax_withholdings
CREATE TABLE IF NOT EXISTS "tax_withholdings" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "payrollItemId" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "taxRateId" TEXT,
  "taxType" TEXT NOT NULL,
  "taxableAmount" REAL NOT NULL,
  "bracketMin" REAL,
  "bracketMax" REAL,
  "ratePercentage" REAL,
  "fixedAmount" REAL,
  "withheldAmount" REAL NOT NULL,
  "calculationDetails" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_tax_withholdings_tenantId" ON "tax_withholdings" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_tax_withholdings_academicYearId" ON "tax_withholdings" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_tax_withholdings_payrollItemId" ON "tax_withholdings" ("payrollItemId");
CREATE INDEX IF NOT EXISTS "idx_tax_withholdings_staffId" ON "tax_withholdings" ("staffId");
CREATE INDEX IF NOT EXISTS "idx_tax_withholdings_taxRateId" ON "tax_withholdings" ("taxRateId");

-- Table: teacher_availability
CREATE TABLE IF NOT EXISTS "teacher_availability" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "staffId" TEXT,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_teacher_availability_tenantId" ON "teacher_availability" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_teacher_availability_teacherId" ON "teacher_availability" ("teacherId");
CREATE INDEX IF NOT EXISTS "idx_teacher_availability_staffId" ON "teacher_availability" ("staffId");

-- Table: teacher_class_assignments
CREATE TABLE IF NOT EXISTS "teacher_class_assignments" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "classSubjectId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "classId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_teacher_class_assignments_tenantId" ON "teacher_class_assignments" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_teacher_class_assignments_teacherId" ON "teacher_class_assignments" ("teacherId");
CREATE INDEX IF NOT EXISTS "idx_teacher_class_assignments_classSubjectId" ON "teacher_class_assignments" ("classSubjectId");
CREATE INDEX IF NOT EXISTS "idx_teacher_class_assignments_academicYearId" ON "teacher_class_assignments" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_teacher_class_assignments_classId" ON "teacher_class_assignments" ("classId");

-- Table: teacher_material_assignments
CREATE TABLE IF NOT EXISTS "teacher_material_assignments" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "materialId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "classId" TEXT,
  "quantity" INTEGER NOT NULL,
  "conditionAtIssue" TEXT NOT NULL,
  "signed" INTEGER NOT NULL DEFAULT 0,
  "signedAt" TEXT,
  "signedBy" TEXT,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_teacher_material_assignments_tenantId" ON "teacher_material_assignments" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_teacher_material_assignments_academicYearId" ON "teacher_material_assignments" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_teacher_material_assignments_teacherId" ON "teacher_material_assignments" ("teacherId");
CREATE INDEX IF NOT EXISTS "idx_teacher_material_assignments_materialId" ON "teacher_material_assignments" ("materialId");
CREATE INDEX IF NOT EXISTS "idx_teacher_material_assignments_schoolLevelId" ON "teacher_material_assignments" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_teacher_material_assignments_classId" ON "teacher_material_assignments" ("classId");

-- Table: teacher_subjects
CREATE TABLE IF NOT EXISTS "teacher_subjects" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_teacher_subjects_tenantId" ON "teacher_subjects" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_teacher_subjects_teacherId" ON "teacher_subjects" ("teacherId");
CREATE INDEX IF NOT EXISTS "idx_teacher_subjects_subjectId" ON "teacher_subjects" ("subjectId");
CREATE INDEX IF NOT EXISTS "idx_teacher_subjects_academicYearId" ON "teacher_subjects" ("academicYearId");

-- Table: teachers
CREATE TABLE IF NOT EXISTS "teachers" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "matricule" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "gender" TEXT,
  "dateOfBirth" TEXT,
  "address" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "departmentId" TEXT,
  "position" TEXT,
  "specialization" TEXT,
  "subjectId" TEXT,
  "academicYearId" TEXT,
  "hireDate" TEXT,
  "contractType" TEXT,
  "status" TEXT NOT NULL,
  "workingHours" INTEGER,
  "salary" REAL,
  "bankDetails" TEXT,
  "emergencyContact" TEXT,
  "qualifications" TEXT,
  "notes" TEXT,
  "createdBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "assignedLanguages" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_teachers_tenantId" ON "teachers" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_teachers_schoolLevelId" ON "teachers" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_teachers_departmentId" ON "teachers" ("departmentId");
CREATE INDEX IF NOT EXISTS "idx_teachers_subjectId" ON "teachers" ("subjectId");
CREATE INDEX IF NOT EXISTS "idx_teachers_academicYearId" ON "teachers" ("academicYearId");

-- Table: tenant_block_selections
CREATE TABLE IF NOT EXISTS "tenant_block_selections" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "variant_id" TEXT NOT NULL,
  "color_overrides" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_tenant_block_selections_tenant_id" ON "tenant_block_selections" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_tenant_block_selections_variant_id" ON "tenant_block_selections" ("variant_id");

-- Table: tenant_contact_messages
CREATE TABLE IF NOT EXISTS "tenant_contact_messages" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "websiteId" TEXT,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "subject" TEXT,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_tenant_contact_messages_tenantId" ON "tenant_contact_messages" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_tenant_contact_messages_websiteId" ON "tenant_contact_messages" ("websiteId");

-- Table: tenant_domains
CREATE TABLE IF NOT EXISTS "tenant_domains" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "isPrimary" INTEGER NOT NULL DEFAULT 0,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "verifiedAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_tenant_domains_tenantId" ON "tenant_domains" ("tenantId");

-- Table: tenant_events
CREATE TABLE IF NOT EXISTS "tenant_events" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "websiteId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT,
  "location" TEXT,
  "imageUrl" TEXT,
  "category" TEXT,
  "status" TEXT NOT NULL,
  "isFeatured" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_tenant_events_tenantId" ON "tenant_events" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_tenant_events_websiteId" ON "tenant_events" ("websiteId");

-- Table: tenant_faq_items
CREATE TABLE IF NOT EXISTS "tenant_faq_items" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "websiteId" TEXT,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "category" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_tenant_faq_items_tenantId" ON "tenant_faq_items" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_tenant_faq_items_websiteId" ON "tenant_faq_items" ("websiteId");

-- Table: tenant_features
CREATE TABLE IF NOT EXISTS "tenant_features" (
  "tenantId" TEXT,
  "featureCode" TEXT,
  "isEnabled" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL,
  "enabledAt" TEXT,
  "enabledBy" TEXT,
  "disabledAt" TEXT,
  "disabledBy" TEXT,
  "metadata" TEXT,
  "billingImpact" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  PRIMARY KEY ("tenantId", "featureCode")
);


-- Table: tenant_gallery_items
CREATE TABLE IF NOT EXISTS "tenant_gallery_items" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "websiteId" TEXT,
  "imageUrl" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  "caption" TEXT,
  "category" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_tenant_gallery_items_tenantId" ON "tenant_gallery_items" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_tenant_gallery_items_websiteId" ON "tenant_gallery_items" ("websiteId");

-- Table: tenant_identity_profiles
CREATE TABLE IF NOT EXISTS "tenant_identity_profiles" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "isActive" INTEGER NOT NULL DEFAULT 0,
  "schoolName" TEXT NOT NULL,
  "schoolAcronym" TEXT,
  "schoolType" TEXT NOT NULL,
  "authorizationNumber" TEXT,
  "foundationDate" TEXT,
  "slogan" TEXT,
  "address" TEXT,
  "city" TEXT,
  "department" TEXT,
  "country" TEXT NOT NULL,
  "postalCode" TEXT,
  "phonePrimary" TEXT,
  "phoneSecondary" TEXT,
  "email" TEXT,
  "website" TEXT,
  "currency" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "logoUrl" TEXT,
  "stampUrl" TEXT,
  "directorSignatureUrl" TEXT,
  "createdBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "activatedAt" TEXT,
  "activatedBy" TEXT,
  "deactivatedAt" TEXT,
  "deactivatedBy" TEXT,
  "changeReason" TEXT,
  "whatsapp" TEXT,
  "maternellePickupMorning" TEXT,
  "maternellePickupAfternoon" TEXT,
  "cardPrimaryColor" TEXT,
  "cardSecondaryColor" TEXT,
  "cardShowQRCode" INTEGER DEFAULT 1,
  "cardShowBarcode" INTEGER DEFAULT 1,
  "cardShowPhoto" INTEGER DEFAULT 1,
  "cardShowGuardian" INTEGER DEFAULT 1,
  "cardShowEmergencyCall" INTEGER DEFAULT 1,
  "cardShowSchoolAddress" INTEGER DEFAULT 1,
  "cardFooterText" TEXT,
  "cardConditionsText" TEXT,
  "maternelleSingleExit" INTEGER DEFAULT 0,
  "maternelleSingleExitTime" TEXT,
  "cardFontFamily" TEXT,
  "cardFontSizeScale" TEXT,
  "cardStudentNameStyle" TEXT,
  "cardPhotoPosition" TEXT,
  "cardPhotoSize" TEXT,
  "cardPhotoShape" TEXT,
  "cardHeaderStyle" TEXT,
  "cardLogoPosition" TEXT,
  "cardLogoSize" TEXT,
  "cardShowMatricule" INTEGER DEFAULT 1,
  "cardShowBirthInfo" INTEGER DEFAULT 1,
  "cardShowGender" INTEGER DEFAULT 1,
  "cardShowLevel" INTEGER DEFAULT 1,
  "cardQrPosition" TEXT,
  "cardQrSize" TEXT,
  "cardQrWithLogo" INTEGER DEFAULT 1,
  "latitude" REAL,
  "longitude" REAL,
  "geoRadius" INTEGER NOT NULL DEFAULT 100
);

CREATE INDEX IF NOT EXISTS "idx_tenant_identity_profiles_tenantId" ON "tenant_identity_profiles" ("tenantId");

-- Table: tenant_media
CREATE TABLE IF NOT EXISTS "tenant_media" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "alt" TEXT,
  "type" TEXT NOT NULL,
  "original_url" TEXT NOT NULL,
  "hd_url" TEXT,
  "thumbnail_url" TEXT,
  "mime_type" TEXT NOT NULL,
  "size" INTEGER NOT NULL DEFAULT 0,
  "width" INTEGER,
  "height" INTEGER,
  "folder" TEXT NOT NULL,
  "tags" TEXT NOT NULL,
  "uploaded_by_id" TEXT,
  "usages_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_tenant_media_tenant_id" ON "tenant_media" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_tenant_media_uploaded_by_id" ON "tenant_media" ("uploaded_by_id");

-- Table: tenant_news_articles
CREATE TABLE IF NOT EXISTS "tenant_news_articles" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "websiteId" TEXT,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "excerpt" TEXT,
  "content" TEXT NOT NULL,
  "coverImageUrl" TEXT,
  "category" TEXT,
  "tags" TEXT,
  "status" TEXT NOT NULL,
  "publishedAt" TEXT,
  "isFeatured" INTEGER NOT NULL DEFAULT 0,
  "viewCount" INTEGER NOT NULL DEFAULT 0,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_tenant_news_articles_tenantId" ON "tenant_news_articles" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_tenant_news_articles_websiteId" ON "tenant_news_articles" ("websiteId");

-- Table: tenant_payment_config
CREATE TABLE IF NOT EXISTS "tenant_payment_config" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "isActive" INTEGER NOT NULL DEFAULT 0,
  "feexpayApiKey" TEXT,
  "feexpayShopId" TEXT,
  "feexpaySecretKey" TEXT,
  "fedapayPublicKey" TEXT,
  "fedapaySecretKey" TEXT,
  "webhookSecret" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_tenant_payment_config_tenantId" ON "tenant_payment_config" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_tenant_payment_config_feexpayShopId" ON "tenant_payment_config" ("feexpayShopId");

-- Table: tenant_resource_annotations
CREATE TABLE IF NOT EXISTS "tenant_resource_annotations" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_tenant_resource_annotations_tenantId" ON "tenant_resource_annotations" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_tenant_resource_annotations_resourceId" ON "tenant_resource_annotations" ("resourceId");
CREATE INDEX IF NOT EXISTS "idx_tenant_resource_annotations_teacherId" ON "tenant_resource_annotations" ("teacherId");

-- Table: tenant_resource_usages
CREATE TABLE IF NOT EXISTS "tenant_resource_usages" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "teacherId" TEXT,
  "usedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "context" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_tenant_resource_usages_tenantId" ON "tenant_resource_usages" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_tenant_resource_usages_resourceId" ON "tenant_resource_usages" ("resourceId");
CREATE INDEX IF NOT EXISTS "idx_tenant_resource_usages_teacherId" ON "tenant_resource_usages" ("teacherId");

-- Table: tenant_settings
CREATE TABLE IF NOT EXISTS "tenant_settings" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT,
  "category" TEXT,
  "description" TEXT,
  "isSystem" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_tenant_settings_tenantId" ON "tenant_settings" ("tenantId");

-- Table: tenant_signatures
CREATE TABLE IF NOT EXISTS "tenant_signatures" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "educationLevelId" TEXT,
  "role" TEXT NOT NULL,
  "holderFirstName" TEXT NOT NULL,
  "holderLastName" TEXT NOT NULL,
  "signatureUrl" TEXT,
  "generatedAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_tenant_signatures_tenantId" ON "tenant_signatures" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_tenant_signatures_educationLevelId" ON "tenant_signatures" ("educationLevelId");

-- Table: tenant_stamps
CREATE TABLE IF NOT EXISTS "tenant_stamps" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "educationLevelId" TEXT,
  "circularStampUrl" TEXT,
  "rectangularStampUrl" TEXT,
  "ovalStampUrl" TEXT,
  "generatedAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_tenant_stamps_tenantId" ON "tenant_stamps" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_tenant_stamps_educationLevelId" ON "tenant_stamps" ("educationLevelId");

-- Table: tenant_testimonials
CREATE TABLE IF NOT EXISTS "tenant_testimonials" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "websiteId" TEXT,
  "authorName" TEXT NOT NULL,
  "authorRole" TEXT,
  "authorPhotoUrl" TEXT,
  "content" TEXT NOT NULL,
  "rating" INTEGER,
  "isFeatured" INTEGER NOT NULL DEFAULT 0,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_tenant_testimonials_tenantId" ON "tenant_testimonials" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_tenant_testimonials_websiteId" ON "tenant_testimonials" ("websiteId");

-- Table: tenant_theme_settings
CREATE TABLE IF NOT EXISTS "tenant_theme_settings" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "theme_id" TEXT,
  "mode" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
  "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_tenant_theme_settings_tenant_id" ON "tenant_theme_settings" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_tenant_theme_settings_theme_id" ON "tenant_theme_settings" ("theme_id");

-- Table: tenant_website_level_sections
CREATE TABLE IF NOT EXISTS "tenant_website_level_sections" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "websiteId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "directorWord" TEXT,
  "directorName" TEXT,
  "directorPhotoUrl" TEXT,
  "directorIsActive" INTEGER,
  "presentationTitle" TEXT,
  "presentationContent" TEXT,
  "presentationIsActive" INTEGER,
  "admissionsTitle" TEXT,
  "admissionsContent" TEXT,
  "admissionsIsActive" INTEGER,
  "schoolLifeTitle" TEXT,
  "schoolLifeContent" TEXT,
  "schoolLifeIsActive" INTEGER,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_tenant_website_level_sections_tenantId" ON "tenant_website_level_sections" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_tenant_website_level_sections_websiteId" ON "tenant_website_level_sections" ("websiteId");
CREATE INDEX IF NOT EXISTS "idx_tenant_website_level_sections_schoolLevelId" ON "tenant_website_level_sections" ("schoolLevelId");

-- Table: tenant_websites
CREATE TABLE IF NOT EXISTS "tenant_websites" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "heroTitle" TEXT,
  "heroSubtitle" TEXT,
  "heroImageUrl" TEXT,
  "heroCtaText" TEXT,
  "heroCtaUrl" TEXT,
  "heroIsActive" INTEGER NOT NULL DEFAULT 1,
  "keyFigures" TEXT NOT NULL,
  "promoterWord" TEXT,
  "promoterName" TEXT,
  "promoterPhotoUrl" TEXT,
  "promoterIsActive" INTEGER NOT NULL DEFAULT 1,
  "directorWord" TEXT,
  "directorName" TEXT,
  "directorPhotoUrl" TEXT,
  "directorIsActive" INTEGER NOT NULL DEFAULT 1,
  "presentationTitle" TEXT,
  "presentationContent" TEXT,
  "presentationImageUrl" TEXT,
  "presentationIsActive" INTEGER NOT NULL DEFAULT 1,
  "admissionsTitle" TEXT,
  "admissionsContent" TEXT,
  "admissionsIsActive" INTEGER NOT NULL DEFAULT 1,
  "schoolLifeTitle" TEXT,
  "schoolLifeContent" TEXT,
  "schoolLifeIsActive" INTEGER NOT NULL DEFAULT 1,
  "footerAboutText" TEXT,
  "footerCopyrightText" TEXT,
  "footerIsActive" INTEGER NOT NULL DEFAULT 1,
  "socialLinks" TEXT NOT NULL,
  "seoMetaTitle" TEXT,
  "seoMetaDescription" TEXT,
  "seoKeywords" TEXT,
  "seoOgImageUrl" TEXT,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "contactAddress" TEXT,
  "contactMapUrl" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "aiEnabled" INTEGER NOT NULL DEFAULT 0,
  "aiWelcomeMessage" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "customColors" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_tenant_websites_tenantId" ON "tenant_websites" ("tenantId");

-- Table: tenants
CREATE TABLE IF NOT EXISTS "tenants" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "subdomain" TEXT,
  "slug" TEXT NOT NULL,
  "schemaName" TEXT,
  "countryId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "subscriptionStatus" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "subscriptionPlan" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "trialEndsAt" TEXT,
  "nextPaymentDueAt" TEXT,
  "estimatedStudentCount" INTEGER,
  "lastCountUpdate" TEXT,
  "studentCountCache" INTEGER NOT NULL DEFAULT 0,
  "studentEnrollmentBlocked" INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "idx_tenants_countryId" ON "tenants" ("countryId");

-- Table: time_slots
CREATE TABLE IF NOT EXISTS "time_slots" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_time_slots_tenantId" ON "time_slots" ("tenantId");

-- Table: timetable_configs
CREATE TABLE IF NOT EXISTS "timetable_configs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolDays" TEXT NOT NULL,
  "timeBlocks" TEXT NOT NULL,
  "dayStartTime" TEXT NOT NULL,
  "dayEndTime" TEXT NOT NULL,
  "defaultSessionDuration" INTEGER NOT NULL DEFAULT 120,
  "lunchBreakStart" TEXT,
  "lunchBreakEnd" TEXT,
  "saturdayEnabled" INTEGER NOT NULL DEFAULT 0,
  "eveningEnabled" INTEGER NOT NULL DEFAULT 0,
  "eveningStart" TEXT,
  "eveningEnd" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_timetable_configs_tenantId" ON "timetable_configs" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_timetable_configs_schoolLevelId" ON "timetable_configs" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_timetable_configs_academicYearId" ON "timetable_configs" ("academicYearId");

-- Table: timetable_constraints
CREATE TABLE IF NOT EXISTS "timetable_constraints" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "schoolLevelId" TEXT,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "entityId" TEXT,
  "entityType" TEXT,
  "params" TEXT NOT NULL,
  "weight" INTEGER NOT NULL DEFAULT 5,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_timetable_constraints_tenantId" ON "timetable_constraints" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_timetable_constraints_schoolLevelId" ON "timetable_constraints" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_timetable_constraints_entityId" ON "timetable_constraints" ("entityId");

-- Table: timetable_entries
CREATE TABLE IF NOT EXISTS "timetable_entries" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "timetableId" TEXT NOT NULL,
  "classId" TEXT,
  "subjectId" TEXT,
  "teacherId" TEXT,
  "roomId" TEXT,
  "timeSlotId" TEXT,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "duration" INTEGER,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_timetable_entries_tenantId" ON "timetable_entries" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_timetable_entries_academicYearId" ON "timetable_entries" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_timetable_entries_schoolLevelId" ON "timetable_entries" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_timetable_entries_timetableId" ON "timetable_entries" ("timetableId");
CREATE INDEX IF NOT EXISTS "idx_timetable_entries_classId" ON "timetable_entries" ("classId");
CREATE INDEX IF NOT EXISTS "idx_timetable_entries_subjectId" ON "timetable_entries" ("subjectId");
CREATE INDEX IF NOT EXISTS "idx_timetable_entries_teacherId" ON "timetable_entries" ("teacherId");
CREATE INDEX IF NOT EXISTS "idx_timetable_entries_roomId" ON "timetable_entries" ("roomId");
CREATE INDEX IF NOT EXISTS "idx_timetable_entries_timeSlotId" ON "timetable_entries" ("timeSlotId");

-- Table: timetable_solutions
CREATE TABLE IF NOT EXISTS "timetable_solutions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "timetableId" TEXT,
  "score" INTEGER NOT NULL DEFAULT 0,
  "feasibilityScore" INTEGER NOT NULL DEFAULT 0,
  "pedagogyScore" INTEGER NOT NULL DEFAULT 0,
  "comfortScore" INTEGER NOT NULL DEFAULT 0,
  "preferenceScore" INTEGER NOT NULL DEFAULT 0,
  "conflictCount" INTEGER NOT NULL DEFAULT 0,
  "conflicts" TEXT NOT NULL,
  "entries" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_timetable_solutions_tenantId" ON "timetable_solutions" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_timetable_solutions_academicYearId" ON "timetable_solutions" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_timetable_solutions_schoolLevelId" ON "timetable_solutions" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_timetable_solutions_timetableId" ON "timetable_solutions" ("timetableId");

-- Table: timetable_versions
CREATE TABLE IF NOT EXISTS "timetable_versions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "timetableId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "name" TEXT,
  "description" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 0,
  "effectiveDate" TEXT NOT NULL,
  "createdBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_timetable_versions_tenantId" ON "timetable_versions" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_timetable_versions_academicYearId" ON "timetable_versions" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_timetable_versions_schoolLevelId" ON "timetable_versions" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_timetable_versions_timetableId" ON "timetable_versions" ("timetableId");

-- Table: timetables
CREATE TABLE IF NOT EXISTS "timetables" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_timetables_tenantId" ON "timetables" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_timetables_academicYearId" ON "timetables" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_timetables_schoolLevelId" ON "timetables" ("schoolLevelId");

-- Table: training_sessions
CREATE TABLE IF NOT EXISTS "training_sessions" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "schoolLevelId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "trainer" TEXT,
  "date" TEXT NOT NULL,
  "duration" INTEGER,
  "participants" TEXT,
  "status" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_training_sessions_tenantId" ON "training_sessions" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_training_sessions_academicYearId" ON "training_sessions" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_training_sessions_schoolLevelId" ON "training_sessions" ("schoolLevelId");

-- Table: transfer_requests
CREATE TABLE IF NOT EXISTS "transfer_requests" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT,
  "studentId" TEXT NOT NULL,
  "fromClassId" TEXT NOT NULL,
  "toClassId" TEXT NOT NULL,
  "reason" TEXT,
  "status" TEXT NOT NULL,
  "requestedBy" TEXT,
  "approvedBy" TEXT,
  "approvedAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_transfer_requests_tenantId" ON "transfer_requests" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_transfer_requests_academicYearId" ON "transfer_requests" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_transfer_requests_schoolLevelId" ON "transfer_requests" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_transfer_requests_studentId" ON "transfer_requests" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_transfer_requests_fromClassId" ON "transfer_requests" ("fromClassId");
CREATE INDEX IF NOT EXISTS "idx_transfer_requests_toClassId" ON "transfer_requests" ("toClassId");

-- Table: transport_assignments
CREATE TABLE IF NOT EXISTS "transport_assignments" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "vehicleId" TEXT,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "amount" REAL,
  "dropoffStopId" TEXT,
  "paymentStatus" TEXT NOT NULL,
  "period" TEXT,
  "pickupStopId" TEXT,
  "status" TEXT NOT NULL,
  "subscriptionType" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_transport_assignments_tenantId" ON "transport_assignments" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_transport_assignments_academicYearId" ON "transport_assignments" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_transport_assignments_studentId" ON "transport_assignments" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_transport_assignments_routeId" ON "transport_assignments" ("routeId");
CREATE INDEX IF NOT EXISTS "idx_transport_assignments_vehicleId" ON "transport_assignments" ("vehicleId");
CREATE INDEX IF NOT EXISTS "idx_transport_assignments_dropoffStopId" ON "transport_assignments" ("dropoffStopId");
CREATE INDEX IF NOT EXISTS "idx_transport_assignments_pickupStopId" ON "transport_assignments" ("pickupStopId");

-- Table: transport_attendances
CREATE TABLE IF NOT EXISTS "transport_attendances" (
  "id" TEXT PRIMARY KEY,
  "assignmentId" TEXT NOT NULL,
  "attendanceDate" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "notes" TEXT,
  "recordedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "tripId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_transport_attendances_assignmentId" ON "transport_attendances" ("assignmentId");
CREATE INDEX IF NOT EXISTS "idx_transport_attendances_tripId" ON "transport_attendances" ("tripId");

-- Table: transport_attendants
CREATE TABLE IF NOT EXISTS "transport_attendants" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "staffId" TEXT,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "role" TEXT,
  "status" TEXT NOT NULL,
  "observations" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_transport_attendants_tenantId" ON "transport_attendants" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_transport_attendants_academicYearId" ON "transport_attendants" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_transport_attendants_staffId" ON "transport_attendants" ("staffId");

-- Table: transport_drivers
CREATE TABLE IF NOT EXISTS "transport_drivers" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "staffId" TEXT,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "licenseNumber" TEXT NOT NULL,
  "licenseCategory" TEXT NOT NULL,
  "licenseExpiry" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "observations" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_transport_drivers_tenantId" ON "transport_drivers" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_transport_drivers_academicYearId" ON "transport_drivers" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_transport_drivers_staffId" ON "transport_drivers" ("staffId");

-- Table: transport_incidents
CREATE TABLE IF NOT EXISTS "transport_incidents" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "vehicleId" TEXT,
  "routeId" TEXT,
  "incidentDate" TEXT NOT NULL,
  "incidentType" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "resolvedAt" TEXT,
  "reportedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "actionTaken" TEXT,
  "directionNotified" INTEGER NOT NULL DEFAULT 0,
  "driverId" TEXT,
  "parentNotified" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL,
  "studentId" TEXT,
  "tripId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_transport_incidents_tenantId" ON "transport_incidents" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_transport_incidents_academicYearId" ON "transport_incidents" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_transport_incidents_vehicleId" ON "transport_incidents" ("vehicleId");
CREATE INDEX IF NOT EXISTS "idx_transport_incidents_routeId" ON "transport_incidents" ("routeId");
CREATE INDEX IF NOT EXISTS "idx_transport_incidents_driverId" ON "transport_incidents" ("driverId");
CREATE INDEX IF NOT EXISTS "idx_transport_incidents_studentId" ON "transport_incidents" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_transport_incidents_tripId" ON "transport_incidents" ("tripId");

-- Table: transport_route_stops
CREATE TABLE IF NOT EXISTS "transport_route_stops" (
  "id" TEXT PRIMARY KEY,
  "routeId" TEXT NOT NULL,
  "zoneId" TEXT,
  "stopOrder" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT,
  "landmark" TEXT,
  "latitude" REAL,
  "longitude" REAL,
  "arrivalTime" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_transport_route_stops_routeId" ON "transport_route_stops" ("routeId");
CREATE INDEX IF NOT EXISTS "idx_transport_route_stops_zoneId" ON "transport_route_stops" ("zoneId");

-- Table: transport_routes
CREATE TABLE IF NOT EXISTS "transport_routes" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "vehicleId" TEXT,
  "zoneId" TEXT,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "description" TEXT,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT,
  "distance" REAL,
  "duration" INTEGER,
  "type" TEXT NOT NULL,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "schoolLevelId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_transport_routes_tenantId" ON "transport_routes" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_transport_routes_academicYearId" ON "transport_routes" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_transport_routes_vehicleId" ON "transport_routes" ("vehicleId");
CREATE INDEX IF NOT EXISTS "idx_transport_routes_zoneId" ON "transport_routes" ("zoneId");
CREATE INDEX IF NOT EXISTS "idx_transport_routes_schoolLevelId" ON "transport_routes" ("schoolLevelId");

-- Table: transport_schedules
CREATE TABLE IF NOT EXISTS "transport_schedules" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "vehicleId" TEXT,
  "driverId" TEXT,
  "attendantId" TEXT,
  "dayOfWeek" INTEGER,
  "specificDate" TEXT,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_transport_schedules_tenantId" ON "transport_schedules" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_transport_schedules_academicYearId" ON "transport_schedules" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_transport_schedules_routeId" ON "transport_schedules" ("routeId");
CREATE INDEX IF NOT EXISTS "idx_transport_schedules_vehicleId" ON "transport_schedules" ("vehicleId");
CREATE INDEX IF NOT EXISTS "idx_transport_schedules_driverId" ON "transport_schedules" ("driverId");
CREATE INDEX IF NOT EXISTS "idx_transport_schedules_attendantId" ON "transport_schedules" ("attendantId");

-- Table: transport_settings
CREATE TABLE IF NOT EXISTS "transport_settings" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "description" TEXT,
  "academicYearId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_transport_settings_tenantId" ON "transport_settings" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_transport_settings_academicYearId" ON "transport_settings" ("academicYearId");

-- Table: transport_trip_events
CREATE TABLE IF NOT EXISTS "transport_trip_events" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "eventTime" TEXT NOT NULL DEFAULT (datetime('now')),
  "location" TEXT,
  "latitude" REAL,
  "longitude" REAL,
  "description" TEXT,
  "academicYearId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_transport_trip_events_tenantId" ON "transport_trip_events" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_transport_trip_events_tripId" ON "transport_trip_events" ("tripId");
CREATE INDEX IF NOT EXISTS "idx_transport_trip_events_academicYearId" ON "transport_trip_events" ("academicYearId");

-- Table: transport_trips
CREATE TABLE IF NOT EXISTS "transport_trips" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "scheduleId" TEXT,
  "routeId" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "attendantId" TEXT,
  "tripDate" TEXT NOT NULL,
  "plannedStartTime" TEXT NOT NULL,
  "actualStartTime" TEXT,
  "actualEndTime" TEXT,
  "status" TEXT NOT NULL,
  "delayMinutes" INTEGER NOT NULL DEFAULT 0,
  "observations" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_transport_trips_tenantId" ON "transport_trips" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_transport_trips_academicYearId" ON "transport_trips" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_transport_trips_scheduleId" ON "transport_trips" ("scheduleId");
CREATE INDEX IF NOT EXISTS "idx_transport_trips_routeId" ON "transport_trips" ("routeId");
CREATE INDEX IF NOT EXISTS "idx_transport_trips_vehicleId" ON "transport_trips" ("vehicleId");
CREATE INDEX IF NOT EXISTS "idx_transport_trips_driverId" ON "transport_trips" ("driverId");
CREATE INDEX IF NOT EXISTS "idx_transport_trips_attendantId" ON "transport_trips" ("attendantId");

-- Table: transport_vehicle_documents
CREATE TABLE IF NOT EXISTS "transport_vehicle_documents" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "expiryDate" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "academicYearId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_transport_vehicle_documents_tenantId" ON "transport_vehicle_documents" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_transport_vehicle_documents_vehicleId" ON "transport_vehicle_documents" ("vehicleId");
CREATE INDEX IF NOT EXISTS "idx_transport_vehicle_documents_academicYearId" ON "transport_vehicle_documents" ("academicYearId");

-- Table: transport_vehicle_maintenance
CREATE TABLE IF NOT EXISTS "transport_vehicle_maintenance" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "maintenanceType" TEXT NOT NULL,
  "maintenanceDate" TEXT NOT NULL,
  "mileageAtMaintenance" REAL,
  "cost" REAL,
  "description" TEXT,
  "nextMaintenanceDate" TEXT,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "academicYearId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_transport_vehicle_maintenance_tenantId" ON "transport_vehicle_maintenance" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_transport_vehicle_maintenance_vehicleId" ON "transport_vehicle_maintenance" ("vehicleId");
CREATE INDEX IF NOT EXISTS "idx_transport_vehicle_maintenance_academicYearId" ON "transport_vehicle_maintenance" ("academicYearId");

-- Table: transport_vehicles
CREATE TABLE IF NOT EXISTS "transport_vehicles" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "name" TEXT,
  "vehicleType" TEXT NOT NULL,
  "plateNumber" TEXT NOT NULL,
  "brand" TEXT,
  "model" TEXT,
  "year" INTEGER,
  "capacity" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "driverId" TEXT,
  "attendantId" TEXT,
  "insuranceInfo" TEXT,
  "technicalVisit" TEXT,
  "registrationCard" TEXT,
  "mileage" REAL,
  "consumption" REAL,
  "acquisitionDate" TEXT,
  "cost" REAL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_transport_vehicles_tenantId" ON "transport_vehicles" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_transport_vehicles_academicYearId" ON "transport_vehicles" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_transport_vehicles_driverId" ON "transport_vehicles" ("driverId");
CREATE INDEX IF NOT EXISTS "idx_transport_vehicles_attendantId" ON "transport_vehicles" ("attendantId");

-- Table: transport_zones
CREATE TABLE IF NOT EXISTS "transport_zones" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "academicYearId" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_transport_zones_tenantId" ON "transport_zones" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_transport_zones_academicYearId" ON "transport_zones" ("academicYearId");

-- Table: treasury_movements
CREATE TABLE IF NOT EXISTS "treasury_movements" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "currency" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "reference" TEXT,
  "movementDate" TEXT NOT NULL,
  "relatedPaymentId" TEXT,
  "relatedExpenseId" TEXT,
  "createdBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_treasury_movements_tenantId" ON "treasury_movements" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_treasury_movements_academicYearId" ON "treasury_movements" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_treasury_movements_schoolLevelId" ON "treasury_movements" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_treasury_movements_relatedPaymentId" ON "treasury_movements" ("relatedPaymentId");
CREATE INDEX IF NOT EXISTS "idx_treasury_movements_relatedExpenseId" ON "treasury_movements" ("relatedExpenseId");

-- Table: tuition_installments
CREATE TABLE IF NOT EXISTS "tuition_installments" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "tuitionPaymentId" TEXT NOT NULL,
  "installmentNumber" INTEGER NOT NULL,
  "amount" REAL NOT NULL,
  "dueDate" TEXT NOT NULL,
  "paidAt" TEXT,
  "status" TEXT NOT NULL,
  "paymentFlowId" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_tuition_installments_tenantId" ON "tuition_installments" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_tuition_installments_academicYearId" ON "tuition_installments" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_tuition_installments_schoolLevelId" ON "tuition_installments" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_tuition_installments_tuitionPaymentId" ON "tuition_installments" ("tuitionPaymentId");
CREATE INDEX IF NOT EXISTS "idx_tuition_installments_paymentFlowId" ON "tuition_installments" ("paymentFlowId");

-- Table: tuition_payments
CREATE TABLE IF NOT EXISTS "tuition_payments" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "currency" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "paymentMethod" TEXT,
  "paymentFlowId" TEXT,
  "paidAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_tuition_payments_tenantId" ON "tuition_payments" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_tuition_payments_academicYearId" ON "tuition_payments" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_tuition_payments_schoolLevelId" ON "tuition_payments" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_tuition_payments_studentId" ON "tuition_payments" ("studentId");
CREATE INDEX IF NOT EXISTS "idx_tuition_payments_paymentFlowId" ON "tuition_payments" ("paymentFlowId");

-- Table: user_devices
CREATE TABLE IF NOT EXISTS "user_devices" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "deviceHash" TEXT NOT NULL,
  "deviceName" TEXT,
  "deviceType" TEXT NOT NULL,
  "userAgent" TEXT,
  "ipAddress" TEXT,
  "isTrusted" INTEGER NOT NULL DEFAULT 0,
  "lastUsedAt" TEXT,
  "trustedAt" TEXT,
  "revokedAt" TEXT,
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "lastSyncAt" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_user_devices_userId" ON "user_devices" ("userId");
CREATE INDEX IF NOT EXISTS "idx_user_devices_tenantId" ON "user_devices" ("tenantId");

-- Table: user_roles
CREATE TABLE IF NOT EXISTS "user_roles" (
  "userId" TEXT,
  "roleId" TEXT,
  "tenantId" TEXT,
  PRIMARY KEY ("userId", "roleId")
);

CREATE INDEX IF NOT EXISTS "idx_user_roles_tenantId" ON "user_roles" ("tenantId");

-- Table: user_tenants
CREATE TABLE IF NOT EXISTS "user_tenants" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "role" TEXT,
  "isActive" INTEGER DEFAULT 1,
  "createdAt" TEXT DEFAULT (datetime('now')),
  "updatedAt" TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_user_tenants_userId" ON "user_tenants" ("userId");
CREATE INDEX IF NOT EXISTS "idx_user_tenants_tenantId" ON "user_tenants" ("tenantId");

-- Table: users
CREATE TABLE IF NOT EXISTS "users" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT,
  "firstName" TEXT,
  "lastName" TEXT,
  "role" TEXT,
  "isSuperAdmin" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL,
  "lastLogin" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_users_tenantId" ON "users" ("tenantId");

-- Table: weekly_duty_assignments
CREATE TABLE IF NOT EXISTS "weekly_duty_assignments" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "weekStartDate" TEXT NOT NULL,
  "weekEndDate" TEXT NOT NULL,
  "weekNumber" INTEGER NOT NULL,
  "assignmentMode" TEXT NOT NULL,
  "assignedBy" TEXT,
  "reason" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_weekly_duty_assignments_tenantId" ON "weekly_duty_assignments" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_weekly_duty_assignments_academicYearId" ON "weekly_duty_assignments" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_weekly_duty_assignments_schoolLevelId" ON "weekly_duty_assignments" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_weekly_duty_assignments_teacherId" ON "weekly_duty_assignments" ("teacherId");

-- Table: weekly_log_daily_reports
CREATE TABLE IF NOT EXISTS "weekly_log_daily_reports" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "weeklyLogId" TEXT,
  "weekNumber" INTEGER NOT NULL,
  "trimester" INTEGER NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "reportDate" TEXT NOT NULL,
  "staffAttendance" TEXT,
  "staffSummary" TEXT,
  "studentAttendanceRate" REAL,
  "highAbsenceClasses" TEXT,
  "parentNotifiedAbsences" TEXT,
  "lateCount" INTEGER,
  "specialCases" TEXT,
  "scheduleRespected" TEXT,
  "modifiedCourses" TEXT,
  "remarkableActivities" TEXT,
  "classClimate" TEXT,
  "positiveBehaviors" TEXT,
  "problematicBehaviors" TEXT,
  "correctiveMeasures" TEXT,
  "roomCleanliness" TEXT,
  "toiletsCondition" TEXT,
  "waterStatus" TEXT,
  "electricityStatus" TEXT,
  "urgentRepairs" TEXT,
  "adminVisit" INTEGER NOT NULL DEFAULT 0,
  "pedagoVisit" INTEGER NOT NULL DEFAULT 0,
  "parentVisit" INTEGER NOT NULL DEFAULT 0,
  "visitDetails" TEXT,
  "directorInstructions" TEXT,
  "urgentNeeds" TEXT,
  "strengths" TEXT,
  "improvements" TEXT,
  "recommendations" TEXT,
  "status" TEXT NOT NULL,
  "filledBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_weekly_log_daily_reports_tenantId" ON "weekly_log_daily_reports" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_weekly_log_daily_reports_academicYearId" ON "weekly_log_daily_reports" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_weekly_log_daily_reports_weeklyLogId" ON "weekly_log_daily_reports" ("weeklyLogId");

-- Table: weekly_log_summaries
CREATE TABLE IF NOT EXISTS "weekly_log_summaries" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "weekNumber" INTEGER NOT NULL,
  "trimester" INTEGER NOT NULL,
  "weekStartDate" TEXT NOT NULL,
  "weekEndDate" TEXT NOT NULL,
  "globalLevel" TEXT,
  "generalObservations" TEXT,
  "scheduleRespect" TEXT,
  "engagedTeachers" TEXT,
  "recurringDifficulties" TEXT,
  "studentBehavior" TEXT,
  "specialFollowUp" TEXT,
  "criticalPoints" TEXT,
  "urgentInterventions" TEXT,
  "weeklyVisits" TEXT,
  "visitorRecommendations" TEXT,
  "weeklyStats" TEXT,
  "priorityActions" TEXT,
  "status" TEXT NOT NULL,
  "submittedAt" TEXT,
  "validatedAt" TEXT,
  "validatedBy" TEXT,
  "rejectionReason" TEXT,
  "filledBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_weekly_log_summaries_tenantId" ON "weekly_log_summaries" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_weekly_log_summaries_academicYearId" ON "weekly_log_summaries" ("academicYearId");

-- Table: weekly_semainier_daily_entries
CREATE TABLE IF NOT EXISTS "weekly_semainier_daily_entries" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "semainierId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "observations" TEXT,
  "actions" TEXT,
  "events" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_weekly_semainier_daily_entries_tenantId" ON "weekly_semainier_daily_entries" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_weekly_semainier_daily_entries_academicYearId" ON "weekly_semainier_daily_entries" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_weekly_semainier_daily_entries_schoolLevelId" ON "weekly_semainier_daily_entries" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_weekly_semainier_daily_entries_semainierId" ON "weekly_semainier_daily_entries" ("semainierId");

-- Table: weekly_semainier_incidents
CREATE TABLE IF NOT EXISTS "weekly_semainier_incidents" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "semainierId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "reportedBy" TEXT NOT NULL,
  "actions" TEXT,
  "escalatedToQHSE" INTEGER NOT NULL DEFAULT 0,
  "escalatedAt" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_weekly_semainier_incidents_tenantId" ON "weekly_semainier_incidents" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_weekly_semainier_incidents_academicYearId" ON "weekly_semainier_incidents" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_weekly_semainier_incidents_schoolLevelId" ON "weekly_semainier_incidents" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_weekly_semainier_incidents_semainierId" ON "weekly_semainier_incidents" ("semainierId");

-- Table: weekly_semainiers
CREATE TABLE IF NOT EXISTS "weekly_semainiers" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "weekStartDate" TEXT NOT NULL,
  "weekEndDate" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "submittedAt" TEXT,
  "validatedAt" TEXT,
  "validatedBy" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_weekly_semainiers_tenantId" ON "weekly_semainiers" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_weekly_semainiers_academicYearId" ON "weekly_semainiers" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_weekly_semainiers_schoolLevelId" ON "weekly_semainiers" ("schoolLevelId");
CREATE INDEX IF NOT EXISTS "idx_weekly_semainiers_assignmentId" ON "weekly_semainiers" ("assignmentId");

-- Table: weekly_seminar_config
CREATE TABLE IF NOT EXISTS "weekly_seminar_config" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "weekNumber" INTEGER NOT NULL,
  "trimester" INTEGER NOT NULL,
  "weekStartDate" TEXT NOT NULL,
  "weekEndDate" TEXT NOT NULL,
  "teacherId" TEXT,
  "classIds" TEXT,
  "teacherSignature" TEXT,
  "status" TEXT,
  "createdAt" TEXT DEFAULT (datetime('now')),
  "updatedAt" TEXT DEFAULT (datetime('now')),
  "directorSignature" TEXT,
  "rejectionReason" TEXT,
  "submittedAt" TEXT,
  "validatedAt" TEXT,
  "validatedBy" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_weekly_seminar_config_tenantId" ON "weekly_seminar_config" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_weekly_seminar_config_academicYearId" ON "weekly_seminar_config" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_weekly_seminar_config_teacherId" ON "weekly_seminar_config" ("teacherId");

-- Table: weekly_seminar_daily_report
CREATE TABLE IF NOT EXISTS "weekly_seminar_daily_report" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "seminarConfigId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "date" TEXT NOT NULL,
  "teacherAttendance" TEXT,
  "studentPresence" TEXT,
  "pedagogy" TEXT,
  "discipline" TEXT,
  "hygiene" TEXT,
  "visits" TEXT,
  "communication" TEXT,
  "dailySummary" TEXT,
  "filledBy" TEXT,
  "createdAt" TEXT DEFAULT (datetime('now')),
  "updatedAt" TEXT DEFAULT (datetime('now')),
  "teacherAttendanceSynthesis" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_weekly_seminar_daily_report_tenantId" ON "weekly_seminar_daily_report" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_weekly_seminar_daily_report_academicYearId" ON "weekly_seminar_daily_report" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_weekly_seminar_daily_report_seminarConfigId" ON "weekly_seminar_daily_report" ("seminarConfigId");

-- Table: weekly_seminar_weekly_report
CREATE TABLE IF NOT EXISTS "weekly_seminar_weekly_report" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "seminarConfigId" TEXT NOT NULL,
  "generalFunctioning" TEXT,
  "pedagogicSummary" TEXT,
  "disciplineSummary" TEXT,
  "infrastructureSummary" TEXT,
  "visitSummary" TEXT,
  "weeklyStats" TEXT,
  "strategicRecommendations" TEXT,
  "semainierName" TEXT,
  "semainierSignature" TEXT,
  "directorName" TEXT,
  "directorSignature" TEXT,
  "createdAt" TEXT DEFAULT (datetime('now')),
  "updatedAt" TEXT DEFAULT (datetime('now')),
  "weekNumber" INTEGER,
  "staffAttendanceStats" TEXT,
  "studentAttendanceStats" TEXT,
  "pedagogySummary" TEXT,
  "hygieneSummary" TEXT,
  "visitsAndCommsSummary" TEXT,
  "recommendations" TEXT,
  "teacherSignature" TEXT,
  "filledBy" TEXT,
  "submittedAt" TEXT,
  "validatedAt" TEXT,
  "validatedBy" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_weekly_seminar_weekly_report_tenantId" ON "weekly_seminar_weekly_report" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_weekly_seminar_weekly_report_academicYearId" ON "weekly_seminar_weekly_report" ("academicYearId");
CREATE INDEX IF NOT EXISTS "idx_weekly_seminar_weekly_report_seminarConfigId" ON "weekly_seminar_weekly_report" ("seminarConfigId");

-- Table: whatsapp_logs
CREATE TABLE IF NOT EXISTS "whatsapp_logs" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "provider" TEXT,
  "providerId" TEXT,
  "sentAt" TEXT,
  "deliveredAt" TEXT,
  "readAt" TEXT,
  "errorMessage" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL,
  "category" TEXT,
  "subCategory" TEXT,
  "module" TEXT,
  "recipientName" TEXT,
  "recipientType" TEXT,
  "recipientId" TEXT,
  "fromPhone" TEXT,
  "templateId" TEXT,
  "templateLanguage" TEXT,
  "threadId" TEXT,
  "triggeredBy" TEXT,
  "triggeredByUserId" TEXT,
  "relatedEntityId" TEXT,
  "relatedEntityType" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_whatsapp_logs_tenantId" ON "whatsapp_logs" ("tenantId");
CREATE INDEX IF NOT EXISTS "idx_whatsapp_logs_providerId" ON "whatsapp_logs" ("providerId");
CREATE INDEX IF NOT EXISTS "idx_whatsapp_logs_recipientId" ON "whatsapp_logs" ("recipientId");
CREATE INDEX IF NOT EXISTS "idx_whatsapp_logs_templateId" ON "whatsapp_logs" ("templateId");
CREATE INDEX IF NOT EXISTS "idx_whatsapp_logs_threadId" ON "whatsapp_logs" ("threadId");
CREATE INDEX IF NOT EXISTS "idx_whatsapp_logs_triggeredByUserId" ON "whatsapp_logs" ("triggeredByUserId");
CREATE INDEX IF NOT EXISTS "idx_whatsapp_logs_relatedEntityId" ON "whatsapp_logs" ("relatedEntityId");

-- ============================================================================
-- SYNC METADATA TABLES — Used by the sync engine
-- ============================================================================

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
  data            TEXT NOT NULL,  -- JSON of the record
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
  sync_type       TEXT NOT NULL CHECK(sync_type IN ('initial', 'pull', 'push', 'manual')),
  started_at      TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at    TEXT,
  tables_synced   INTEGER DEFAULT 0,
  records_pulled  INTEGER DEFAULT 0,
  records_pushed  INTEGER DEFAULT 0,
  conflicts       INTEGER DEFAULT 0,
  errors          INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'running' CHECK(status IN ('running', 'success', 'partial', 'failed'))
);


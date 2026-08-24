-- ============================================================================
-- Migration: 20260815130000_create_discipline_module
-- ============================================================================
-- Module Discipline — Compteur de conduite pour le surveillant général
-- ============================================================================

-- 1. discipline_rules : Barème des fautes
CREATE TABLE IF NOT EXISTS discipline_rules (
  id TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "schoolLevelId" TEXT,
  name TEXT NOT NULL,
  description TEXT,
  hours_penalty INTEGER DEFAULT 0,
  points_deducted NUMERIC(5,2) DEFAULT 0,
  severity TEXT DEFAULT 'MINOR',
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP(3) DEFAULT now(),
  "updatedAt" TIMESTAMP(3) DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_discipline_rules_tenant ON discipline_rules ("tenantId");

-- 2. conduct_settings : Configuration
CREATE TABLE IF NOT EXISTS conduct_settings (
  id TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolLevelId" TEXT,
  conduct_reference NUMERIC(5,2) DEFAULT 20,
  critical_threshold NUMERIC(5,2) DEFAULT 5,
  "createdAt" TIMESTAMP(3) DEFAULT now(),
  "updatedAt" TIMESTAMP(3) DEFAULT now(),
  UNIQUE ("tenantId", "academicYearId", "schoolLevelId")
);

-- 3. sanctions : Sanctions attribuées
CREATE TABLE IF NOT EXISTS sanctions (
  id TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "ruleId" TEXT,
  "schoolLevelId" TEXT,
  "quarterId" TEXT,
  fault_name TEXT NOT NULL,
  hours_attributed INTEGER DEFAULT 0,
  points_deducted NUMERIC(5,2) DEFAULT 0,
  sanction_date DATE NOT NULL,
  "supervisorId" TEXT NOT NULL,
  comment TEXT,
  status TEXT DEFAULT 'ACTIVE',
  cancelled_by TEXT,
  cancelled_reason TEXT,
  cancelled_at TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) DEFAULT now(),
  "updatedAt" TIMESTAMP(3) DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sanctions_student ON sanctions ("studentId");
CREATE INDEX IF NOT EXISTS idx_sanctions_status ON sanctions (status);

-- 4. conduct_ledger : Compteur de conduite
CREATE TABLE IF NOT EXISTS conduct_ledger (
  id TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "quarterId" TEXT NOT NULL,
  conduct_reference NUMERIC(5,2) DEFAULT 20,
  total_points_deducted NUMERIC(5,2) DEFAULT 0,
  conduct_final NUMERIC(5,2) DEFAULT 20,
  calculated_at TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) DEFAULT now(),
  "updatedAt" TIMESTAMP(3) DEFAULT now(),
  UNIQUE ("tenantId", "studentId", "quarterId")
);
CREATE INDEX IF NOT EXISTS idx_conduct_ledger_student ON conduct_ledger ("studentId");

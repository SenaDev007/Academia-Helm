-- ============================================================================
-- 021_saisiemaster_prospects.sql
-- ----------------------------------------------------------------------------
-- Lead capture system for SaisieMaster (free tool integrated at /saisiemaster
-- in Academia Helm web-app). Directors create a free account → captured as
-- prospects → automated follow-up emails pitch Academia Helm after 3 days.
--
-- Two tables:
--   1. saisiemaster_prospects  — prospect accounts (LEAD → CONTACTED → ...)
--   2. saisiemaster_sessions   — saved grade-entry sessions per prospect
-- ============================================================================

CREATE TABLE IF NOT EXISTS "saisiemaster_prospects" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" TEXT UNIQUE NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "schoolName" TEXT NOT NULL,
  "phoneNumber" TEXT,
  "city" TEXT,
  "source" TEXT DEFAULT 'saiemaster',
  "status" TEXT DEFAULT 'LEAD',
  "signupDate" TIMESTAMPTZ DEFAULT NOW(),
  "lastLoginAt" TIMESTAMPTZ,
  "loginCount" INT DEFAULT 1,
  "firstFollowupSent" BOOLEAN DEFAULT false,
  "firstFollowupSentAt" TIMESTAMPTZ,
  "secondFollowupSent" BOOLEAN DEFAULT false,
  "secondFollowupSentAt" TIMESTAMPTZ,
  "convertedToTenantId" TEXT,
  "convertedAt" TIMESTAMPTZ,
  "classesCreated" INT DEFAULT 0,
  "gradesEntered" INT DEFAULT 0,
  "exportsCount" INT DEFAULT 0,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "saisiemaster_prospects_email_idx" ON "saisiemaster_prospects"("email");
CREATE INDEX IF NOT EXISTS "saisiemaster_prospects_status_idx" ON "saisiemaster_prospects"("status");
CREATE INDEX IF NOT EXISTS "saisiemaster_prospects_signupDate_idx" ON "saisiemaster_prospects"("signupDate");

CREATE TABLE IF NOT EXISTS "saisiemaster_sessions" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "prospectId" TEXT NOT NULL REFERENCES "saisiemaster_prospects"("id") ON DELETE CASCADE,
  "className" TEXT NOT NULL,
  "schoolYear" TEXT,
  "academicYear" TEXT,
  "studentCount" INT DEFAULT 0,
  "subjectCount" INT DEFAULT 0,
  "gradesData" JSONB,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "saisiemaster_sessions_prospectId_idx" ON "saisiemaster_sessions"("prospectId");

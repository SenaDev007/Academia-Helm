-- ============================================================================
-- RECRUITMENT MODULE - COMPLETE TABLES MIGRATION (Idempotent)
-- ============================================================================
-- Creates all recruitment-related tables if they don't exist.
-- Uses IF NOT EXISTS to be safe for re-runs.

-- ─── HR Jobs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "hr_jobs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dept" TEXT NOT NULL,
    "loc" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BROUILLON',
    "description" TEXT,
    "missions" TEXT,
    "responsibilities" TEXT,
    "academicLevel" TEXT,
    "experience" TEXT,
    "skillsRequired" TEXT,
    "salary" TEXT,
    "contractType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_jobs_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_jobs_ref_key') THEN
        ALTER TABLE "hr_jobs" ADD CONSTRAINT "hr_jobs_ref_key" UNIQUE ("ref");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_jobs_tenantId_fkey') THEN
        ALTER TABLE "hr_jobs" ADD CONSTRAINT "hr_jobs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "hr_jobs_tenantId_idx" ON "hr_jobs"("tenantId");

-- ─── HR Candidates ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "hr_candidates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "gender" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_candidates_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_candidates_tenantId_fkey') THEN
        ALTER TABLE "hr_candidates" ADD CONSTRAINT "hr_candidates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "hr_candidates_tenantId_idx" ON "hr_candidates"("tenantId");

-- ─── HR Applications ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "hr_applications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOUVEAU',
    "score" INTEGER NOT NULL DEFAULT 0,
    "scoreCV" INTEGER NOT NULL DEFAULT 0,
    "scoreLetter" INTEGER NOT NULL DEFAULT 0,
    "scoreMatching" INTEGER NOT NULL DEFAULT 0,
    "risks" TEXT NOT NULL DEFAULT 'Aucun',
    "riskDetail" TEXT,
    "matchDetail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_applications_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_applications_tenantId_fkey') THEN
        ALTER TABLE "hr_applications" ADD CONSTRAINT "hr_applications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_applications_jobId_fkey') THEN
        ALTER TABLE "hr_applications" ADD CONSTRAINT "hr_applications_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "hr_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_applications_candidateId_fkey') THEN
        ALTER TABLE "hr_applications" ADD CONSTRAINT "hr_applications_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "hr_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "hr_applications_tenantId_idx" ON "hr_applications"("tenantId");
CREATE INDEX IF NOT EXISTS "hr_applications_jobId_idx" ON "hr_applications"("jobId");
CREATE INDEX IF NOT EXISTS "hr_applications_candidateId_idx" ON "hr_applications"("candidateId");

-- ─── HR Interviews ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "hr_interviews" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "evaluator" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_interviews_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_interviews_tenantId_fkey') THEN
        ALTER TABLE "hr_interviews" ADD CONSTRAINT "hr_interviews_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_interviews_candidateId_fkey') THEN
        ALTER TABLE "hr_interviews" ADD CONSTRAINT "hr_interviews_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "hr_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "hr_interviews_tenantId_idx" ON "hr_interviews"("tenantId");
CREATE INDEX IF NOT EXISTS "hr_interviews_candidateId_idx" ON "hr_interviews"("candidateId");

-- ─── HR Tests ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "hr_tests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_tests_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_tests_tenantId_fkey') THEN
        ALTER TABLE "hr_tests" ADD CONSTRAINT "hr_tests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "hr_tests_tenantId_idx" ON "hr_tests"("tenantId");

-- ─── HR Test Results ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "hr_test_results" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "result" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_test_results_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_test_results_testId_fkey') THEN
        ALTER TABLE "hr_test_results" ADD CONSTRAINT "hr_test_results_testId_fkey" FOREIGN KEY ("testId") REFERENCES "hr_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_test_results_candidateId_fkey') THEN
        ALTER TABLE "hr_test_results" ADD CONSTRAINT "hr_test_results_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "hr_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "hr_test_results_testId_idx" ON "hr_test_results"("testId");
CREATE INDEX IF NOT EXISTS "hr_test_results_candidateId_idx" ON "hr_test_results"("candidateId");

-- ─── HR AI Reports ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "hr_ai_reports" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_ai_reports_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_ai_reports_candidateId_fkey') THEN
        ALTER TABLE "hr_ai_reports" ADD CONSTRAINT "hr_ai_reports_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "hr_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_ai_reports_applicationId_fkey') THEN
        ALTER TABLE "hr_ai_reports" ADD CONSTRAINT "hr_ai_reports_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "hr_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "hr_ai_reports_candidateId_idx" ON "hr_ai_reports"("candidateId");
CREATE INDEX IF NOT EXISTS "hr_ai_reports_applicationId_idx" ON "hr_ai_reports"("applicationId");

-- ─── HR Talent Pool ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "hr_talent_pool" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_talent_pool_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_talent_pool_candidateId_key') THEN
        ALTER TABLE "hr_talent_pool" ADD CONSTRAINT "hr_talent_pool_candidateId_key" UNIQUE ("candidateId");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_talent_pool_candidateId_fkey') THEN
        ALTER TABLE "hr_talent_pool" ADD CONSTRAINT "hr_talent_pool_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "hr_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ─── HR Academic Profiles ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "hr_academic_profiles" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "teachingLevel" TEXT NOT NULL,
    "subjects" TEXT[] DEFAULT '{}',
    "pedagogicalExperience" TEXT,

    CONSTRAINT "hr_academic_profiles_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_academic_profiles_candidateId_key') THEN
        ALTER TABLE "hr_academic_profiles" ADD CONSTRAINT "hr_academic_profiles_candidateId_key" UNIQUE ("candidateId");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_academic_profiles_candidateId_fkey') THEN
        ALTER TABLE "hr_academic_profiles" ADD CONSTRAINT "hr_academic_profiles_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "hr_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ─── HR Candidate Documents (already has a migration but ensure it's safe) ─
CREATE TABLE IF NOT EXISTS "hr_candidate_documents" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_candidate_documents_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_candidate_documents_candidateId_fkey') THEN
        ALTER TABLE "hr_candidate_documents" ADD CONSTRAINT "hr_candidate_documents_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "hr_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "hr_candidate_documents_candidateId_idx" ON "hr_candidate_documents"("candidateId");

-- ─── HR Teaching Certifications ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "hr_teaching_certifications" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "certificationName" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,

    CONSTRAINT "hr_teaching_certifications_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_teaching_certifications_candidateId_fkey') THEN
        ALTER TABLE "hr_teaching_certifications" ADD CONSTRAINT "hr_teaching_certifications_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "hr_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "hr_teaching_certifications_candidateId_idx" ON "hr_teaching_certifications"("candidateId");

-- ─── HR Academic Scores ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "hr_academic_scores" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "pedagogicalScore" INTEGER NOT NULL,
    "academicScore" INTEGER NOT NULL,
    "globalScore" INTEGER NOT NULL,

    CONSTRAINT "hr_academic_scores_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_academic_scores_candidateId_key') THEN
        ALTER TABLE "hr_academic_scores" ADD CONSTRAINT "hr_academic_scores_candidateId_key" UNIQUE ("candidateId");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_academic_scores_candidateId_fkey') THEN
        ALTER TABLE "hr_academic_scores" ADD CONSTRAINT "hr_academic_scores_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "hr_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

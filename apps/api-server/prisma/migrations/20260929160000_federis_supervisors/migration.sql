-- ⭐ Academia Federis — Gestion des surveillants (2026-09-29)
-- Module « Centres, salles & Surveillants » (onglet « Gestion des
-- surveillants ») : workflow complet patronat ↔ écoles rattachées :
--   1. Le patronat envoie une DEMANDE aux écoles (supervisor_requests) :
--      « présentez vos enseignants comme surveillants ».
--   2. Chaque école sélectionne ses enseignants dans sa base (Teacher) et
--      envoie sa liste (school_supervisor_submissions, snapshot inclus).
--   3. Le patronat consulte les listes par école + le récapitulatif global,
--      puis fait la RÉPARTITION par centre et par salle (exam_supervisors
--      enrichis : source, école d'origine, enseignant, traçabilité).
--   4. À la validation, les écoles sont notifiées (interface admin) et
--      transmettent l'affectation à l'UI de l'enseignant (teacherNotifiedAt).
--
-- ⚠️ 100 % IDEMPOTENTE (miroir de l'auto-guérison du service
-- FederisSupervisorsService.ensureSchema — pattern ensure-tables main.ts) :
-- chaque statement est un no-op si l'objet existe déjà, contraintes via
-- DO $$ ... IF NOT EXISTS — le déploiement ne dépend PAS de l'ordre
-- d'exécution migration / premier appel API.

-- ═══════════════════════════════════════════════════════════════════
-- 1. Demandes du patronat aux écoles rattachées
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "supervisor_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "examId" TEXT,
    "examLabel" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "deadline" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "supervisor_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "supervisor_requests_tenantId_idx"
    ON "supervisor_requests"("tenantId");
CREATE INDEX IF NOT EXISTS "supervisor_requests_academicYearId_idx"
    ON "supervisor_requests"("academicYearId");
CREATE INDEX IF NOT EXISTS "supervisor_requests_examId_idx"
    ON "supervisor_requests"("examId");
CREATE INDEX IF NOT EXISTS "supervisor_requests_status_idx"
    ON "supervisor_requests"("status");

-- Clé étrangère : tenant du patronat émetteur (isolation territoriale)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supervisor_requests_tenantId_fkey') THEN
        ALTER TABLE "supervisor_requests"
            ADD CONSTRAINT "supervisor_requests_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 2. Réponses des écoles : listes d'enseignants présentés comme
--    surveillants (snapshot des données Teacher de l'école)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "school_supervisor_submissions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "teacherIds" JSONB NOT NULL,
    "teachers" JSONB,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_supervisor_submissions_pkey" PRIMARY KEY ("id")
);

-- Une seule réponse par école et par demande
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_supervisor_submissions_tenantId_requestId_key') THEN
        ALTER TABLE "school_supervisor_submissions"
            ADD CONSTRAINT "school_supervisor_submissions_tenantId_requestId_key"
            UNIQUE ("tenantId", "requestId");
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "school_supervisor_submissions_tenantId_idx"
    ON "school_supervisor_submissions"("tenantId");
CREATE INDEX IF NOT EXISTS "school_supervisor_submissions_requestId_idx"
    ON "school_supervisor_submissions"("requestId");
CREATE INDEX IF NOT EXISTS "school_supervisor_submissions_status_idx"
    ON "school_supervisor_submissions"("status");

-- Clé étrangère : tenant de l'école émettrice
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_supervisor_submissions_tenantId_fkey') THEN
        ALTER TABLE "school_supervisor_submissions"
            ADD CONSTRAINT "school_supervisor_submissions_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- Clé étrangère : demande concernée
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_supervisor_submissions_requestId_fkey') THEN
        ALTER TABLE "school_supervisor_submissions"
            ADD CONSTRAINT "school_supervisor_submissions_requestId_fkey"
            FOREIGN KEY ("requestId") REFERENCES "supervisor_requests"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 3. Enrichissement des affectations (exam_supervisors) : origine de la
--    nomination (MANUAL | SCHOOL_NOMINATION), école d'origine, enseignant,
--    demande / soumission d'origine, transmission à l'UI de l'enseignant
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE "exam_supervisors" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "exam_supervisors" ADD COLUMN IF NOT EXISTS "schoolTenantId" TEXT;
ALTER TABLE "exam_supervisors" ADD COLUMN IF NOT EXISTS "teacherId" TEXT;
ALTER TABLE "exam_supervisors" ADD COLUMN IF NOT EXISTS "requestId" TEXT;
ALTER TABLE "exam_supervisors" ADD COLUMN IF NOT EXISTS "submissionId" TEXT;
ALTER TABLE "exam_supervisors" ADD COLUMN IF NOT EXISTS "teacherNotifiedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "exam_supervisors_schoolTenantId_idx"
    ON "exam_supervisors"("schoolTenantId");
CREATE INDEX IF NOT EXISTS "exam_supervisors_requestId_idx"
    ON "exam_supervisors"("requestId");
CREATE INDEX IF NOT EXISTS "exam_supervisors_submissionId_idx"
    ON "exam_supervisors"("submissionId");

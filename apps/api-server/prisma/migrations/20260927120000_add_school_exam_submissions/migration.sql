-- ⭐ Academia Federis / Academia Helm — Examens nationaux (CEP / BEPC / Baccalauréat)
-- Soumission des candidats par l'établissement : l'école sélectionne ses élèves
-- éligibles (CM2 → CEP, 3ème → BEPC, Terminale → Bac par série) et envoie la
-- liste officielle au(x) patronat(s) rattaché(s) depuis le module Examen Helm
-- (onglet « Examens nationaux », sous-onglets CEP / BEPC / Baccalauréat).

-- ═══════════════════════════════════════════════════════════════════
-- 1. Table des soumissions d'examens nationaux par école
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "school_exam_submissions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "examType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "candidateIds" JSONB NOT NULL,
    "patronatIds" JSONB,
    "submittedAt" TIMESTAMP(3),
    "submittedBy" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_exam_submissions_pkey" PRIMARY KEY ("id")
);

-- Une seule soumission par (école, année scolaire, type d'examen)
CREATE UNIQUE INDEX IF NOT EXISTS "school_exam_submissions_tenantId_academicYearId_examType_key"
    ON "school_exam_submissions"("tenantId", "academicYearId", "examType");
CREATE INDEX IF NOT EXISTS "school_exam_submissions_tenantId_academicYearId_idx"
    ON "school_exam_submissions"("tenantId", "academicYearId");
CREATE INDEX IF NOT EXISTS "school_exam_submissions_examType_idx"
    ON "school_exam_submissions"("examType");

-- Clé étrangère : le tenant école émetteur
ALTER TABLE "school_exam_submissions"
    ADD CONSTRAINT "school_exam_submissions_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE;

-- Clé étrangère : l'année scolaire de l'école
ALTER TABLE "school_exam_submissions"
    ADD CONSTRAINT "school_exam_submissions_academicYearId_fkey"
    FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE;

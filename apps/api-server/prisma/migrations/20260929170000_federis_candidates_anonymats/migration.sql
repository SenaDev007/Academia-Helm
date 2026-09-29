-- ============================================================================
-- 20260929170000_federis_candidates_anonymats — Module Candidats (2026-09-29)
-- ============================================================================
-- 1. Anonymats des candidats (post-composition : saisie des notes et
--    correction SANS identité) : exam_candidates.anonymatCode + issuedAt.
-- 2. Format de matricule paramétrable par le patronat (module Paramètres) :
--    patronats.matriculeFormat (null = format par défaut {EXAM}-{ANNEE}-{SEQ:5}).
-- Idempotent (CREATE ... IF NOT EXISTS / DO $$ IF NOT EXISTS) — pattern des
-- migrations Federis précédentes (20260929150000 / 20260929160000).

-- 1a. Anonymat des candidats -------------------------------------------------
ALTER TABLE "exam_candidates" ADD COLUMN IF NOT EXISTS "anonymatCode" TEXT;
ALTER TABLE "exam_candidates" ADD COLUMN IF NOT EXISTS "anonymatIssuedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "exam_candidates_examId_anonymatCode_idx"
    ON "exam_candidates"("examId", "anonymatCode");

-- 1b. Format de matricule du patronat ----------------------------------------
ALTER TABLE "patronats" ADD COLUMN IF NOT EXISTS "matriculeFormat" TEXT;

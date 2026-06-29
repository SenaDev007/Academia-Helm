-- ============================================================================
-- Migration: extend admissions table with missing fields
-- ============================================================================
--
-- Objectif : Ajouter les champs manquants à la table `admissions` pour
-- supporter le workflow d'admission complet (infos élève, vœux, responsable
-- légal, traçabilité conversion).
--
-- Avant : la table n'avait que 13 colonnes (id, tenantId, academicYearId,
-- schoolLevelId, firstName, lastName, dateOfBirth, gender, status,
-- applicationDate, decisionDate, decisionBy, notes).
--
-- Après : 25+ colonnes — toutes les données collectées par le formulaire
-- frontend (AdmissionForm.tsx) sont désormais persistées.
-- ============================================================================

-- ─── Champs identité élève ──────────────────────────────────────────────────
ALTER TABLE "admissions"
  ADD COLUMN IF NOT EXISTS "birthPlace" TEXT,
  ADD COLUMN IF NOT EXISTS "nationality" TEXT DEFAULT 'Béninoise',
  ADD COLUMN IF NOT EXISTS "address" TEXT;

-- ─── Champs vœux académiques ────────────────────────────────────────────────
ALTER TABLE "admissions"
  ADD COLUMN IF NOT EXISTS "requestedClassId" TEXT,
  ADD COLUMN IF NOT EXISTS "requestedSeriesId" TEXT,
  ADD COLUMN IF NOT EXISTS "wantsBilingual" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "previousSchool" TEXT;

-- ─── Champs responsable légal ───────────────────────────────────────────────
ALTER TABLE "admissions"
  ADD COLUMN IF NOT EXISTS "mainGuardianName" TEXT,
  ADD COLUMN IF NOT EXISTS "mainGuardianPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "mainGuardianEmail" TEXT;

-- ─── Champs traçabilité ─────────────────────────────────────────────────────
ALTER TABLE "admissions"
  ADD COLUMN IF NOT EXISTS "admissionNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "convertedStudentId" TEXT,
  ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;

-- ─── Champs entretien/test (pour Phase 3) ───────────────────────────────────
ALTER TABLE "admissions"
  ADD COLUMN IF NOT EXISTS "interviewDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "testDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "testScore" DOUBLE PRECISION;

-- ─── Index pour les nouveaux champs ─────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "admissions_admissionNumber_idx"
  ON "admissions" ("admissionNumber")
  WHERE "admissionNumber" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "admissions_convertedStudentId_idx"
  ON "admissions" ("convertedStudentId")
  WHERE "convertedStudentId" IS NOT NULL;

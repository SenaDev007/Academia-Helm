-- ============================================================================
-- Migration : Fix Evaluations Schema
-- Date : 2026-07-24
-- ============================================================================
-- Objectifs :
--   1. Étendre l'enum EvaluationStatus avec DRAFT, LOCKED, CANCELLED
--   2. Ajouter les champs manquants à evaluations : description, teacherId, gradeScaleId
--   3. Ajouter code, schoolLevelId, isSystem à evaluation_types
--   4. Changer la FK evaluations.periodId de quarters → academic_periods
--   5. Créer contrainte unique (tenantId, code) sur evaluation_types
-- ============================================================================

-- ─── 1. Étendre l'enum EvaluationStatus ─────────────────────────────────────
-- Ajouter DRAFT, LOCKED, CANCELLED à l'enum existant
ALTER TYPE "EvaluationStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "EvaluationStatus" ADD VALUE IF NOT EXISTS 'LOCKED';
ALTER TYPE "EvaluationStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- ─── 2. Ajouter champs manquants à evaluations ──────────────────────────────
ALTER TABLE "evaluations"
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "teacherId" TEXT,
  ADD COLUMN IF NOT EXISTS "gradeScaleId" TEXT;

-- ⚠️ ATTENTION : avant de changer la FK periodId, on doit s'assurer que
-- toutes les valeurs existantes de evaluations.periodId existent dans
-- academic_periods. Comme evaluations est vide (0 lignes vérifiées),
-- on peut changer la FK sans risque.

-- ─── 3. Changer la FK evaluations.periodId de quarters → academic_periods ──
-- 3a. Supprimer l'ancienne contrainte FK
ALTER TABLE "evaluations" DROP CONSTRAINT IF EXISTS "evaluations_periodId_fkey";

-- 3b. Ajouter la nouvelle FK vers academic_periods
ALTER TABLE "evaluations"
  ADD CONSTRAINT "evaluations_periodId_fkey"
  FOREIGN KEY ("periodId") REFERENCES "academic_periods"("id") ON DELETE RESTRICT;

-- ─── 4. Ajouter FK gradeScaleId → grade_scales ──────────────────────────────
ALTER TABLE "evaluations"
  ADD CONSTRAINT "evaluations_gradeScaleId_fkey"
  FOREIGN KEY ("gradeScaleId") REFERENCES "grade_scales"("id") ON DELETE SET NULL;

-- ⚠️ teacherId : on ne crée PAS de FK stricte car la table des enseignants
-- peut varier (Staff vs User selon le tenant). On garde juste la colonne.

-- ─── 5. Ajouter champs à evaluation_types ───────────────────────────────────
ALTER TABLE "evaluation_types"
  ADD COLUMN IF NOT EXISTS "code" TEXT,
  ADD COLUMN IF NOT EXISTS "schoolLevelId" TEXT,
  ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- ─── 6. Contrainte unique (tenantId, code) sur evaluation_types ─────────────
-- Permet d'éviter les doublons de types (ex: 2x "DEVOIRS" pour le même tenant)
-- ⚠️ code peut être NULL (pour les types custom créés par l'utilisateur),
-- on utilise une contrainte partielle pour ne l'appliquer qu'aux code non-null.
CREATE UNIQUE INDEX IF NOT EXISTS "evaluation_types_tenantId_code_key"
  ON "evaluation_types"("tenantId", "code")
  WHERE "code" IS NOT NULL;

-- Index sur schoolLevelId pour filtrer les types par niveau
CREATE INDEX IF NOT EXISTS "evaluation_types_schoolLevelId_idx"
  ON "evaluation_types"("schoolLevelId");

-- ─── 7. Vérifications ──────────────────────────────────────────────────────
-- L'enum doit maintenant contenir 7 valeurs : DRAFT, PLANNED, OPEN_FOR_GRADING, SUBMITTED, VALIDATED, LOCKED, CANCELLED
-- Vérification :
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'EvaluationStatus') ORDER BY enumsortorder;

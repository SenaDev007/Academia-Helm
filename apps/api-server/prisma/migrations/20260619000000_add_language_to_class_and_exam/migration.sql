-- ============================================================================
-- Migration : add_language_to_class_and_exam
-- ============================================================================
-- Ajoute le champ `language` (FR/EN) aux tables `classes` et `exams` pour
-- permettre la séparation bilingue dans les modules Pédagogie et Examens.
--
-- Le champ est nullable (String?) pour rétro-compatibilité : les tenants
-- non bilingues ont NULL, les tenants bilingues ont 'FR' ou 'EN'.
-- ============================================================================

ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "language" TEXT;
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "language" TEXT;

-- Backfill : les classes existantes sans langue sont marquées FR
UPDATE "classes" SET "language" = 'FR' WHERE "language" IS NULL;

-- Backfill : les examens existants sans langue sont marqués FR
UPDATE "exams" SET "language" = 'FR' WHERE "language" IS NULL;

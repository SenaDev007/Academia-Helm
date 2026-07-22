-- ============================================================================
-- Migration: Renommer cahier_de_tests → cahier_de_textes (UNIQUEMENT le renommage)
-- ============================================================================
-- Tâche 1 : Renommage simple Cahier de Test → Cahier de Texte
-- ============================================================================

-- 1) Renommer la table cahier_de_tests → cahier_de_textes
ALTER TABLE IF EXISTS "cahier_de_tests" RENAME TO "cahier_de_textes";

-- 2) Renommer la contrainte primary key
ALTER TABLE IF EXISTS "cahier_de_textes" RENAME CONSTRAINT "cahier_de_tests_pkey" TO "cahier_de_textes_pkey";

-- 3) Renommer les index existants
ALTER INDEX IF EXISTS "cahier_de_tests_tenant_year_teacher_idx" RENAME TO "cahier_de_textes_tenant_year_teacher_idx";
ALTER INDEX IF EXISTS "cahier_de_tests_class_idx" RENAME TO "cahier_de_textes_class_idx";
ALTER INDEX IF EXISTS "cahier_de_tests_subject_idx" RENAME TO "cahier_de_textes_subject_idx";
ALTER INDEX IF EXISTS "cahier_de_tests_status_idx" RENAME TO "cahier_de_textes_status_idx";
ALTER INDEX IF EXISTS "cahier_de_tests_trimester_idx" RENAME TO "cahier_de_textes_trimester_idx";
ALTER INDEX IF EXISTS "cahier_de_tests_test_type_idx" RENAME TO "cahier_de_textes_test_type_idx";

-- 4) Supprimer les colonnes ajoutées par erreur dans la migration précédente
--    (elles appartiendront à la tâche 2: saisiemaster)
DROP INDEX IF EXISTS "cahier_de_textes_tenant_year_class_subj_trim_eval_key";
DROP INDEX IF EXISTS "cahier_de_textes_evaluation_type_idx";
ALTER TABLE "cahier_de_textes" DROP COLUMN IF EXISTS "evaluationType";
ALTER TABLE "cahier_de_textes" DROP COLUMN IF EXISTS "evaluationLabel";
ALTER TABLE "cahier_de_textes" DROP COLUMN IF EXISTS "evaluationNumber";

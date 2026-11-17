-- ============================================================================
-- FIX — Saisie des notes : « there is no unique or exclusion constraint
-- matching the ON CONFLICT specification »
-- ============================================================================
-- La base production portait un index unique à 4 colonnes
--   grades("tenantId","evaluationId","studentId","gradeComponent")
-- hérité d'une époque antérieure au schéma actuel, alors que le schéma Prisma
-- déclare @@unique([tenantId, evaluationId, studentId]).
-- L'upsert Prisma (GradesService.bulkSave) génère
--   INSERT ... ON CONFLICT ("tenantId","evaluationId","studentId") DO UPDATE
-- → aucune contrainte/index unique ne correspondait → DriverAdapterError.
--
-- Vérifié avant application : AUCUN doublon (tenantId, evaluationId, studentId).
-- (En production, l'opération a été exécutée avec CONCURRENTLY hors transaction
-- pour ne pas verrouiller les écritures.)
-- ============================================================================

DROP INDEX IF EXISTS "grades_tenant_evaluation_student_component_key";

CREATE UNIQUE INDEX IF NOT EXISTS "tenantId_evaluationId_studentId"
    ON "grades" ("tenantId", "evaluationId", "studentId");

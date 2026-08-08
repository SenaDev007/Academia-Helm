-- ============================================================================
-- Migration: Add evaluationTypeId to report_cards
-- ============================================================================
-- Permet de lier chaque bulletin à un type d'évaluation spécifique
-- (mensuelle 1, certificative, etc.) en plus de la période.
--
-- Sans cette colonne, le directeur ne peut signer qu'un seul bulletin par
-- élève + période — or l'utilisateur veut pouvoir générer des bulletins
-- séparés pour chaque type d'évaluation (EM1, EM2, EC, EP, etc.).
--
-- ⭐ Toutes les colonnes sont NULLABLE pour préserver la rétro-compatibilité
--    avec les bulletins existants (qui ont tous evaluationTypeId = NULL).
-- ============================================================================

-- 1. Ajouter evaluationTypeId (nullable) — FK vers evaluation_types
ALTER TABLE "report_cards"
  ADD COLUMN IF NOT EXISTS "evaluationTypeId" TEXT;

-- 2. Ajouter evaluationTypeName et evaluationTypeCode (dénormalisation pour
--    éviter un JOIN systématique côté backend)
ALTER TABLE "report_cards"
  ADD COLUMN IF NOT EXISTS "evaluationTypeName" TEXT;

ALTER TABLE "report_cards"
  ADD COLUMN IF NOT EXISTS "evaluationTypeCode" TEXT;

-- 3. Index pour accélérer les requêtes de filtrage par type d'évaluation
CREATE INDEX IF NOT EXISTS "report_cards_eval_type_idx"
  ON "report_cards" ("tenantId", "academicYearId", "evaluationTypeId");

-- 4. Ajouter la contrainte FK (non-bloquante — pas de CASCADE pour préserver
--    l'historique si un type d'évaluation est supprimé)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'report_cards_evaluationTypeId_fkey'
  ) THEN
    ALTER TABLE "report_cards"
      ADD CONSTRAINT "report_cards_evaluationTypeId_fkey"
      FOREIGN KEY ("evaluationTypeId") REFERENCES "evaluation_types"("id")
      ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FK constraint skipped: %', SQLERRM;
END $$;

-- 5. Mettre à jour les bulletins existants : essayer de résoudre evaluationTypeId
--    en cherchant le type d'évaluation de l'évaluation liée à la période.
--    (best-effort : ne touche pas aux bulletins sans match)
UPDATE "report_cards" rc
SET
  "evaluationTypeId" = et.id,
  "evaluationTypeName" = et.name,
  "evaluationTypeCode" = et.code
FROM "evaluation_types" et
WHERE rc."evaluationTypeId" IS NULL
  AND et.id IN (
    SELECT DISTINCT e."evaluationTypeId"
    FROM "evaluations" e
    WHERE e."periodId" = rc."quarterId"
      AND e."tenantId" = rc."tenantId"
      AND e."academicYearId" = rc."academicYearId"
      AND e."evaluationTypeId" IS NOT NULL
    LIMIT 1
  );

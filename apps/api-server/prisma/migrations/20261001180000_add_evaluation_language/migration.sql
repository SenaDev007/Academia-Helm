-- ⭐ 2026-10-01 — Ajout du champ language sur la table evaluations
--    Permet de séparer les évaluations FR et EN même quand les classes
--    sont partagées (miroirs Nursery/Maternelle, Primary/Primaire).
--    Par défaut 'FR' pour toutes les évaluations existantes (rétrocompatibilité).

ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "language" TEXT DEFAULT 'FR';

-- ⭐ Index pour accélérer le filtrage par piste linguistique
CREATE INDEX IF NOT EXISTS "evaluations_language_idx"
  ON "evaluations" ("language")
  WHERE "language" IS NOT NULL;

-- ⭐ Mettre à jour les évaluations existantes : celles dont la classe est FR
--    marquée ou legacy (sans marqueur) → language='FR' (déjà le défaut).
--    Celles dont la classe est EN marquée → language='EN'.
UPDATE "evaluations" e
SET "language" = 'EN'
WHERE e."language" = 'FR'
  AND EXISTS (
    SELECT 1 FROM "classes" c
    WHERE c.id = e."classId"
      AND c."language" = 'EN'
  );

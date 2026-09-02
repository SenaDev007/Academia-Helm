-- ⭐ Weekly Record of Work — champs dédiés dans monthly_plans
--
-- Le Weekly Record of Work (EN track) réutilisait la table monthly_plans
-- avec month = terme ("First Term"/"Second Term"/"Third Term"), EXACTEMENT
-- comme le Scheme of Work → collision de données (même classLevel + month +
-- teacherId). Cette migration sépare proprement les deux documents.
--
-- Nouvelles colonnes :
--   - documentType : 'PLAN' (planif mensuelle FR, legacy) |
--                    'SCHEME_OF_WORK' | 'WEEKLY_RECORD'
--   - headTeacherInitials  : initiales du directeur/head teacher (champ texte)
--   - headTeacherDate      : date saisie par le head teacher (texte YYYY-MM-DD)
--   - headTeacherSignature : signature (data URL) du head teacher
--   - weekDates            : JSON des 12 dates de fin de semaine du terme
--                            ex: ["2026-09-11","2026-09-18",...,"2026-11-27"]
--
-- ⭐ Toutes les lignes d'un même document partagent les mêmes valeurs
--    (même pattern que status/teacherSignature/directorSignature).

ALTER TABLE "monthly_plans"
    ADD COLUMN IF NOT EXISTS "documentType" TEXT NOT NULL DEFAULT 'PLAN';
ALTER TABLE "monthly_plans"
    ADD COLUMN IF NOT EXISTS "headTeacherInitials" TEXT;
ALTER TABLE "monthly_plans"
    ADD COLUMN IF NOT EXISTS "headTeacherDate" TEXT;
ALTER TABLE "monthly_plans"
    ADD COLUMN IF NOT EXISTS "headTeacherSignature" TEXT;
ALTER TABLE "monthly_plans"
    ADD COLUMN IF NOT EXISTS "weekDates" TEXT;

-- ⭐ Rétro-compatibilité des données existantes :
--    Les lignes EN-termes avec weekNumber = 0 sont des Weekly Records
--    (les cellules Scheme of Work ont weekNumber 1-12 et subDomain =
--    Topic/Objectives/Activities/Resources/Evaluation).
UPDATE "monthly_plans"
    SET "documentType" = 'WEEKLY_RECORD'
    WHERE "month" IN ('First Term', 'Second Term', 'Third Term')
      AND "weekNumber" = 0;

-- Les lignes EN-termes restantes (weekNumber 1-12) sont des Scheme of Work.
UPDATE "monthly_plans"
    SET "documentType" = 'SCHEME_OF_WORK'
    WHERE "month" IN ('First Term', 'Second Term', 'Third Term')
      AND "documentType" = 'PLAN';

-- Index pour les listes côté direction (filtrées par type de document)
CREATE INDEX IF NOT EXISTS "monthly_plans_doc_type_idx"
    ON "monthly_plans" ("tenantId", "documentType", "status");

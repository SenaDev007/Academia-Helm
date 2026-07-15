-- ============================================================================
-- Migration : Migrer les fee_structures de classId (physique) vers academicClassId (officiel)
-- ============================================================================
--
-- Objectif : Les anciennes configurations de frais utilisaient classId (classe
-- physique : CE1-A, CE1-B, etc.). On les aligne sur academicClassId (classe
-- officielle : CE1, CM2, 6ème, etc.) en copiant officialClassId depuis la table
-- classes.
--
-- Prérequis : La colonne fee_structures.academicClassId doit exister (ajoutée
-- par la migration précédente).
-- ============================================================================

-- 1. Copier officialClassId depuis classes vers fee_structures.academicClassId
UPDATE fee_structures fs
SET "academicClassId" = c."officialClassId"
FROM classes c
WHERE c.id = fs."classId"
  AND fs."classId" IS NOT NULL
  AND fs."academicClassId" IS NULL
  AND c."officialClassId" IS NOT NULL;

-- 2. Vérification : combien de fee_structures restent sans academicClassId
-- (ce sont des classId sans officialClassId — orphelins)
-- SELECT COUNT(*) FROM fee_structures WHERE "classId" IS NOT NULL AND "academicClassId" IS NULL;

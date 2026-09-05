-- ============================================================================
-- V10g — Barème anglophone : First CA et Second CA /40 → /20
-- ============================================================================
-- Règle métier confirmée par l'utilisateur :
--   Premier CA  : noté /20 (était /40 par erreur)
--   Second CA   : noté /20 (était /40 par erreur)
--   Examination : noté /60 (inchangé)
--   Récapitulatif trimestriel par matière = 20 + 20 + 60 = /100.
--
-- La migration :
--   1. RECALE les notes CA existantes (score / 2) — conserve le pourcentage
--      exact de performance saisi (ex: 34/40 → 17/20).
--   2. Met à jour grades.maxScore pour les notes liées à des évaluations CA.
--   3. Met à jour evaluations.maxScore (40 → 20) pour les évaluations CA.
--   4. Met à jour evaluation_types.defaultMaxScore (40 → 20) pour les types CA.
--
-- Codes reconnus (les deux familles) : FIRST_CA, SECOND_CA, FCA, SCA.
-- Idempotent : chaque UPDATE filtre sur la valeur 40, rejouable sans effet.
-- ============================================================================

-- 1. Rescaler les notes existantes des évaluations CA (/2, arrondi 2 décimales)
UPDATE grades g
SET score = ROUND(g.score / 2.0, 2)
FROM evaluations e
JOIN evaluation_types et ON et.id = e."evaluationTypeId"
WHERE g."evaluationId" = e.id
  AND UPPER(et.code) IN ('FIRST_CA', 'SECOND_CA', 'FCA', 'SCA')
  AND g.score IS NOT NULL;

-- 2. Barème des lignes de notes liées aux évaluations CA
UPDATE grades g
SET "maxScore" = 20
FROM evaluations e
JOIN evaluation_types et ON et.id = e."evaluationTypeId"
WHERE g."evaluationId" = e.id
  AND UPPER(et.code) IN ('FIRST_CA', 'SECOND_CA', 'FCA', 'SCA')
  AND g."maxScore" = 40;

-- 3. Barème des évaluations CA
UPDATE evaluations e
SET "maxScore" = 20
FROM evaluation_types et
WHERE et.id = e."evaluationTypeId"
  AND UPPER(et.code) IN ('FIRST_CA', 'SECOND_CA', 'FCA', 'SCA')
  AND e."maxScore" = 40;

-- 4. Barème par défaut des types CA
UPDATE evaluation_types
SET "defaultMaxScore" = 20
WHERE UPPER(code) IN ('FIRST_CA', 'SECOND_CA', 'FCA', 'SCA')
  AND "defaultMaxScore" = 40;

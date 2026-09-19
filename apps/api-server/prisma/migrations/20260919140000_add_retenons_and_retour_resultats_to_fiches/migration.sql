-- ============================================================================
-- FICHES PÉDAGOGIQUES PRIMAIRE — 2 évolutions (retour promoteur, 2026-09-19) :
--
-- 1) SECTION « RETENONS » (leçon à retenir) en BAS de chaque fiche :
--    retenons → texte (potentiellement long) de la leçon à retenir saisie
--               par l'enseignant. Un SEUL champ, éditable et ré-éditable à
--               volonté, affiché dans l'UI de préparation ET dans le PDF
--               généré (primaire : section IV- RETENONS ; maternelle :
--               bloc RETENONS après RANGEMENT).
--
-- 2) SECTION « RETOUR ET PROJECTION » EN TABLEAU (comme le DÉROULEMENT) :
--    chaque rubrique (Objectivation, Évaluation, Projection) gagne une
--    2e colonne « Résultat attendu », exactement comme la section
--    II- Déroulement (tableau N° / Consignes / Résultats attendus) :
--      objectivationResultat → Résultat attendu de l'Objectivation
--      evalRetourResultat    → Résultat attendu de l'Évaluation
--      projectionResultat    → Résultat attendu de la Projection
--
-- Utilisées dans la PRÉPARATION de la fiche (UI FR + EN), la GÉNÉRATION DU
-- PDF et la VUE DIRECTEUR, persistées via le CRUD /pedagogy-space/fiches
-- (champs ajoutés au fieldMap create + allowedFields update + listes de
-- repli optionnel 42703), et copiées par la duplication d'année
-- (duplicate-to-year).
--
-- Colonnes NULLABLE (rétro-compatibilité) : les fiches existantes restent
-- valides ; les colonnes vides ne s'affichent pas dans le PDF.
-- ============================================================================

ALTER TABLE "primary_pedagogical_fiches"
  ADD COLUMN IF NOT EXISTS "retenons" TEXT,
  ADD COLUMN IF NOT EXISTS "objectivationResultat" TEXT,
  ADD COLUMN IF NOT EXISTS "evalRetourResultat" TEXT,
  ADD COLUMN IF NOT EXISTS "projectionResultat" TEXT;

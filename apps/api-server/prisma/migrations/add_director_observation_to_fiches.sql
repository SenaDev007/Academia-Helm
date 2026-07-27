-- ============================================================================
-- Migration : Ajout colonnes directorObservation + directorSignature
--             sur primary_pedagogical_fiches
-- ============================================================================
-- Permet au directeur d'ajouter ses observations (par section + générale)
-- et d'apposer sa signature lors de la validation d'une fiche pédagogique.
-- ============================================================================

-- Observation générale du directeur (HTML riche)
ALTER TABLE "primary_pedagogical_fiches"
  ADD COLUMN IF NOT EXISTS "directorObservation" TEXT;

-- Signature du directeur (base64 PNG)
ALTER TABLE "primary_pedagogical_fiches"
  ADD COLUMN IF NOT EXISTS "directorSignature" TEXT;

-- Date de signature du directeur
ALTER TABLE "primary_pedagogical_fiches"
  ADD COLUMN IF NOT EXISTS "directorSignatureDate" TIMESTAMP(3);

-- Observations par section (JSON) :
-- {
--   "phase_preparatoire": "Observation...",
--   "deroulement": "Observation...",
--   "retour_projection": "Observation..."
-- }
ALTER TABLE "primary_pedagogical_fiches"
  ADD COLUMN IF NOT EXISTS "directorSectionObservations" JSONB DEFAULT '{}';

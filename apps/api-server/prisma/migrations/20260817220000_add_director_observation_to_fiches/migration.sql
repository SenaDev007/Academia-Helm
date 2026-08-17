-- Migration : ajout colonnes directorObservation, directorSectionObservations, directorSignatureDate
-- sur primary_pedagogical_fiches.
--
-- Ces colonnes sont nécessaires pour le workflow de validation direction :
-- - directorObservation : observation générale du directeur (texte riche HTML)
-- - directorSectionObservations : observations par section (JSON { phase_preparatoire: "...", deroulement: "...", ... })
-- - directorSignatureDate : date à laquelle le directeur a signé
--
-- Sans ces colonnes, l'endpoint PUT /director/fiches/:id/director-update échoue
-- avec Prisma P2010 (raw query failed, code 42703 = undefined_column).

ALTER TABLE "primary_pedagogical_fiches"
  ADD COLUMN IF NOT EXISTS "directorObservation" TEXT,
  ADD COLUMN IF NOT EXISTS "directorSectionObservations" JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "directorSignatureDate" TIMESTAMP(3);

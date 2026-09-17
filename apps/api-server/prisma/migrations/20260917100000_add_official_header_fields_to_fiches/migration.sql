-- ============================================================================
-- FICHES PÉDAGOGIQUES PRIMAIRE — champs d'en-tête conformes aux modèles
-- officiels (captures fournies par l'école, 2026-09-17) :
--
--   MATH (fiche de mathématiques — curriculum « dossiers ») :
--     fn       → Fn° (numéro de la fiche, en haut à gauche)
--     dossier  → DOSSIER N° (ex : 1)
--     theme    → THEME (ex : La coopérative agricole)
--     saTheme  → Thème (sous-thème de la SA : ex : l'organisation de la production)
--     seance   → Séance N° (ex : 0)
--     (champs existants conservés : san = SA N°, sequence = Séquence N°,
--      cours = Cours, duree = Durée, lessonDate = Date, titre = Titre)
--
--   ÉDUCATION SOCIALE / SCIENTIFIQUE ET TECHNOLOGIQUE / ARTISTIQUE / EPS /
--   STANDARD (Anglais-Informatique) :
--     fn, theme, seance (+ san, cours, duree, lessonDate, titre existants)
--
--   FRANÇAIS :
--     matiereSpecifique → matière spécifique du français renseignée juste
--                         après l'en-tête (Vocabulaire thématique, Dictée,
--                         Expression écrite, Grammaire, Conjugaison, Lecture…)
--     unite              → Unité N°
--     etape              → Étape N°
--
-- Toutes ces colonnes sont NULLABLE (rétro-compatibilité : les fiches
-- existantes restent valides, les nouvelles peuvent renseigner ces champs).
-- ============================================================================

ALTER TABLE "primary_pedagogical_fiches"
  ADD COLUMN IF NOT EXISTS "fn" TEXT,
  ADD COLUMN IF NOT EXISTS "dossier" TEXT,
  ADD COLUMN IF NOT EXISTS "theme" TEXT,
  ADD COLUMN IF NOT EXISTS "saTheme" TEXT,
  ADD COLUMN IF NOT EXISTS "seance" TEXT,
  ADD COLUMN IF NOT EXISTS "unite" TEXT,
  ADD COLUMN IF NOT EXISTS "etape" TEXT,
  ADD COLUMN IF NOT EXISTS "matiereSpecifique" TEXT;

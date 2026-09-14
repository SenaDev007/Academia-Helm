-- ============================================================================
-- Fiches pédagogiques MATERNELLE — 2 nouveaux formats (conformes aux PDFs
-- officiels fournis par l'école) :
--   sheetType = 'DOMAINE'   → fiche « Domaine » (n° de domaine renseigné par
--                             l'enseignante) — en-tête ÉCOLE MATERNELLE,
--                             FICHE DE, DOMAINE [n°], Domaine du, Composante,
--                             Date, Sous-composante, ACTIVITÉS D'APPRENTISSAGE
--                             N°, champs, DÉROULEMENT 2 colonnes
--                             (Consignes | Résultats Attendus) avec
--                             INTRODUCTION, RÉALISATION, RETOUR ET PROJECTION,
--                             RANGEMENT, Notes personnelles.
--   sheetType = 'DOMAINE_2' → fiche « Domaine 2 » (DOMAINE II fixe) — champs,
--                             DÉROULEMENT 5 colonnes (Plan | Durée | Description
--                             des activités | Formation Evolution | Dosage),
--                             INTRODUCTION, RÉALISATION (Situation problème,
--                             Question de compréhension, Activités 1-3),
--                             RETOUR ET PROJECTION, RANGEMENT, Notes personnelles.
--
-- Le contenu structuré de ces fiches est stocké dans maternelleContent (JSONB).
-- ============================================================================

ALTER TABLE "primary_pedagogical_fiches"
  ADD COLUMN IF NOT EXISTS "maternelleContent" JSONB;

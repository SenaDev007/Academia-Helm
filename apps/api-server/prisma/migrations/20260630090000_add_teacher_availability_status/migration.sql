-- ============================================================================
-- Migration: add status column to pedagogy_teacher_availabilities
-- ============================================================================
--
-- Objectif : Ajouter un champ 'status' à la table pedagogy_teacher_availabilities
-- pour supporter 3 états de disponibilité au lieu de 2 (binaire).
--
-- États :
--   'UNAVAILABLE' (défaut, rétro-compat) : enseignant NON disponible
--   'PREFERRED'                            : enseignant PEUT enseigner + préfère ce créneau
--   (pas d'enregistrement)                 : enseignant disponible (neutre)
--
-- Le moteur STE (Smart Timetable Engine) priorise les créneaux PREFERRED
-- et exclut UNAVAILABLE lors de la planification.
--
-- Rétro-compatibilité :
--   Tous les enregistrements existants (qui représentaient une indisponibilité
--   en sémantique binaire) sont automatiquement marqués 'UNAVAILABLE' grâce
--   au DEFAULT 'UNAVAILABLE'. C'est la même sémantique qu'avant.
-- ============================================================================

-- Ajouter la colonne status avec valeur par défaut 'UNAVAILABLE'
ALTER TABLE "pedagogy_teacher_availabilities"
ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) NOT NULL DEFAULT 'UNAVAILABLE';

-- Mettre à jour les enregistrements existants (au cas où DEFAULT n'aurait pas appliqué)
UPDATE "pedagogy_teacher_availabilities"
SET "status" = 'UNAVAILABLE'
WHERE "status" IS NULL OR "status" = '';

-- Créer un index pour filtrer rapidement par statut (utile pour le moteur STE)
CREATE INDEX IF NOT EXISTS "pedagogy_teacher_availabilities_status_idx"
ON "pedagogy_teacher_availabilities" ("status");

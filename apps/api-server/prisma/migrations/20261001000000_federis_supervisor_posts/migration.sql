-- ⭐ Academia Federis — Répartition des enseignants par POSTE (2026-10-01)
-- Demande utilisateur : les enseignants envoyés par les écoles sont répartis
-- par le patronat entre TROIS postes :
--   • SURVEILLANCE — surveillance des épreuves dans les centres et salles ;
--   • CORRECTION   — participation à la correction des copies ;
--   • SECRETARIAT  — secrétariat de l'examen (saisie des notes).
--
-- Le champ existant `role` (SURVEILLANT / CHEF_DE_SALLE / CHEF_DE_CENTRE)
-- conserve la nuance D'ENCADREMENT de la surveillance ; la nouvelle colonne
-- `post` porte la MISSION administrative de l'enseignant.
--
-- ⚠️ 100 % IDEMPOTENTE (miroir de l'auto-guérison
-- FederisSupervisorsService.ensureSchema — Railway n'exécute pas
-- `prisma migrate deploy` au démarrage, la colonne est aussi créée au
-- premier appel du service).

ALTER TABLE "exam_supervisors"
    ADD COLUMN IF NOT EXISTS "post" TEXT NOT NULL DEFAULT 'SURVEILLANCE';

-- Index de filtrage (registre par poste : surveillance / correction / secrétariat)
CREATE INDEX IF NOT EXISTS "exam_supervisors_post_idx"
    ON "exam_supervisors"("post");

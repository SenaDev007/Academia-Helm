-- ⭐ Migration : ajout des champs taskType, status, presentationDate, attachments, observations
--    à la table homework_entries pour discriminer les sous-onglets de Travaux & Suivi.
--
--    taskType : HOMEWORK (défaut) | RESEARCH | LESSON | RECITATION | PRACTICAL | PROJECT
--    status : DRAFT | ASSIGNED (défaut) | COMPLETED | ARCHIVED
--    presentationDate : pour les exposés, récitations, activités pratiques
--    attachments : JSONB array of {url, name, type} pour pièces jointes
--    observations : texte libre pour les observations globales de l'enseignant

-- 1. Ajouter les colonnes avec valeurs par défaut
ALTER TABLE "homework_entries"
  ADD COLUMN IF NOT EXISTS "taskType" TEXT NOT NULL DEFAULT 'HOMEWORK',
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
  ADD COLUMN IF NOT EXISTS "presentationDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "attachments" JSONB,
  ADD COLUMN IF NOT EXISTS "observations" TEXT;

-- 2. Créer un index sur taskType pour filtrer rapidement par sous-onglet
CREATE INDEX IF NOT EXISTS "homework_entries_tenant_year_tasktype_idx"
  ON "homework_entries" ("tenantId", "academicYearId", "taskType");

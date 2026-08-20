-- ⭐ Refonte Cahier de Texte (Secondaire)
--    Le cahier de texte passe d'un module d'évaluations à un journal de cours :
--    L'enseignant renseigne chaque jour ce qu'il a enseigné (titre, horaires, contenu)
--
--    Nouveaux champs :
--    - courseTitle : titre du cours dispensé
--    - startTime : heure de début (format HH:MM)
--    - endTime : heure de fin (format HH:MM)
--    - content : contenu du cours en HTML riche (RichTextEditor)
--    - lessonDate : date du cours (différent de testDate qui reste pour les évaluations)

ALTER TABLE "cahier_de_textes"
  ADD COLUMN IF NOT EXISTS "courseTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "startTime" TEXT,
  ADD COLUMN IF NOT EXISTS "endTime" TEXT,
  ADD COLUMN IF NOT EXISTS "content" TEXT,
  ADD COLUMN IF NOT EXISTS "lessonDate" DATE;

-- Index pour filtrer par date de cours
CREATE INDEX IF NOT EXISTS "cahier_de_textes_lesson_date_idx"
  ON "cahier_de_textes" ("tenantId", "academicYearId", "lessonDate");

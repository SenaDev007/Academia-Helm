-- ============================================================================
-- Ajout de la colonne `officialClassId` à la table `classes`
-- ============================================================================
-- Contexte :
-- Le modèle `Class` dans schema.prisma déclare :
--   officialClassId String?
--   officialClass   AcademicClass? @relation("PhysicalClassOfficialClass",
--                          fields: [officialClassId], references: [id],
--                          onDelete: SetNull)
--
-- Cette colonne permet de lier une section physique (ex: « CE1 A ») à sa
-- classe officielle (AcademicClass « CE1 »).
--
-- MAIS la colonne n'a jamais été créée en BDD — probablement perdue lors
-- d'un précédent rollback de migration ou d'un prisma migrate reset partiel.
--
-- Sans cette colonne, toute requête Prisma qui inclut `physicalClasses`
-- (relation inverse côté AcademicClass) échoue avec :
--   "Colonne manquante en base de données (colonne inconnue)."
--   (Prisma P2022)
--
-- Cette migration idempotente :
--   1. Ajoute la colonne `officialClassId` (TEXT, nullable) si elle n'existe pas
--   2. Crée la FK vers pedagogy_academic_classes(id) avec ON DELETE SET NULL
--   3. Crée un index sur officialClassId pour accélérer les requêtes
--      (findAllClasses filtre par WHERE officialClassId = AcademicClass.id)
-- ============================================================================

DO $$
BEGIN
    -- 1. Ajouter la colonne si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'classes' AND column_name = 'officialClassId'
    ) THEN
        ALTER TABLE "classes" ADD COLUMN "officialClassId" TEXT;
        RAISE NOTICE 'Colonne officialClassId ajoutée à la table classes.';
    ELSE
        RAISE NOTICE 'Colonne officialClassId existe déjà — skipped.';
    END IF;
END $$;

-- 2. Créer la FK si elle n'existe pas (ON DELETE SET NULL — cohérent avec
--    le @relation onDelete: SetNull du schema Prisma)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'classes_officialClassId_fkey'
          AND table_name = 'classes'
    ) THEN
        ALTER TABLE "classes"
            ADD CONSTRAINT "classes_officialClassId_fkey"
            FOREIGN KEY ("officialClassId") REFERENCES "pedagogy_academic_classes"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
        RAISE NOTICE 'FK classes_officialClassId_fkey créée.';
    ELSE
        RAISE NOTICE 'FK classes_officialClassId_fkey existe déjà — skipped.';
    END IF;
END $$;

-- 3. Index sur officialClassId (filtre fréquent dans findAllClasses)
CREATE INDEX IF NOT EXISTS "classes_officialClassId_idx" ON "classes"("officialClassId");

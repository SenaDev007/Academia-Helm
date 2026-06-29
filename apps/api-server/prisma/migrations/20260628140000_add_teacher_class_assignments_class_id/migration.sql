-- ============================================================================
-- Ajout de la colonne `classId` à la table `teacher_class_assignments`
-- ============================================================================
-- Contexte :
-- Le modèle Prisma TeacherClassAssignment déclare :
--   classId String?
--   physicalClass Class? @relation("TeacherClassAssignmentPhysicalClass",
--                       fields: [classId], references: [id], onDelete: SetNull)
--
-- Mais la colonne `classId` n'a JAMAIS été créée en BDD — probablement
-- perdue lors d'un précédent prisma migrate reset ou rollback.
--
-- Conséquence : toute requête Prisma qui include `assignments` sur
-- ClassSubject (relation inverse vers TeacherClassAssignment) échoue avec
-- P2022 "Colonne manquante" — Prisma essaie de SELECT classId sur
-- teacher_class_assignments et la colonne n'existe pas.
--
-- Ça fait CRASHER l'endpoint GET /class-subjects/:classId, qui retourne 500
-- au lieu des liens matière-classe. C'est la cause racine du bug
-- "Aucune matière affectée" dans le sous-onglet Affectation Classes.
--
-- Cette migration idempotente :
--   1. Ajoute la colonne `classId` (TEXT, nullable) si elle n'existe pas
--   2. Crée la FK vers classes(id) avec ON DELETE SET NULL
--   3. Crée un index sur classId
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'teacher_class_assignments' AND column_name = 'classId'
    ) THEN
        ALTER TABLE "teacher_class_assignments" ADD COLUMN "classId" TEXT;
        RAISE NOTICE 'Colonne classId ajoutée à teacher_class_assignments.';
    ELSE
        RAISE NOTICE 'Colonne classId existe déjà — skipped.';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'teacher_class_assignments_classId_fkey'
          AND table_name = 'teacher_class_assignments'
    ) THEN
        ALTER TABLE "teacher_class_assignments"
            ADD CONSTRAINT "teacher_class_assignments_classId_fkey"
            FOREIGN KEY ("classId") REFERENCES "classes"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
        RAISE NOTICE 'FK teacher_class_assignments_classId_fkey créée.';
    ELSE
        RAISE NOTICE 'FK teacher_class_assignments_classId_fkey existe déjà — skipped.';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "teacher_class_assignments_classId_idx"
    ON "teacher_class_assignments"("classId");

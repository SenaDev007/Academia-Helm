-- ============================================================================
-- Restauration de la relation FK entre subjects et academic_years
-- ============================================================================
-- Contexte :
-- Le commit 8e4db9e1 avait supprimé la @relation Prisma entre Subject et
-- AcademicYear (et droppé cette FK en BDD via SQL manuel) pour tenter de
-- résoudre un bug de suppression automatique des matières. Cette approche
-- était incorrecte — la vraie cause était un script de nettoyage dans main.ts
-- qui faisait prisma.subject.deleteMany({ where: { tenantId } }) à chaque
-- démarrage. Ce script a été corrigé dans le commit 9922a12d.
--
-- Sans cette FK, prisma.subject.findMany({ include: { academicYear: true } })
-- lève l'erreur : "Unknown field `academicYear` for include statement on
-- model `Subject`" — cassant toute la lecture/écriture des matières.
--
-- Cette migration restaure la FK de façon idempotente :
--   - Si la contrainte existe déjà → ne fait rien (safe à rejouer)
--   - Si elle n'existe pas → la crée avec ON DELETE SET NULL
--
-- Le comportement ON DELETE SET NULL est cohérent avec le @relation Prisma
-- du schema.prisma (AcademicYear? avec onDelete: SetNull), qui permet à
-- une matière de survivre à la suppression de son année scolaire.
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'subjects_academicYearId_fkey'
          AND table_name = 'subjects'
    ) THEN
        ALTER TABLE "subjects"
            ADD CONSTRAINT "subjects_academicYearId_fkey"
            FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
        RAISE NOTICE 'Constraint subjects_academicYearId_fkey added.';
    ELSE
        RAISE NOTICE 'Constraint subjects_academicYearId_fkey already exists — skipping.';
    END IF;
END $$;

-- Créer un index sur academicYearId pour accélérer les requêtes filtrées par année
-- (Prisma génère normalement cet index automatiquement via @@index, mais on s'assure
-- qu'il existe en BDD au cas où il aurait été droppé avec la FK.)
CREATE INDEX IF NOT EXISTS "subjects_academicYearId_idx" ON "subjects"("academicYearId");

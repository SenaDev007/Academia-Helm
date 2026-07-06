-- Migration : Rendre fee_arrears.studentFeeId nullable + ajouter notes
-- Permet la saisie manuelle d'arriérés (sans StudentFee lié) pour l'onboarding
-- des nouveaux clients qui ont des arriérés sur papier.

ALTER TABLE "fee_arrears" ALTER COLUMN "studentFeeId" DROP NOT NULL;
ALTER TABLE "fee_arrears" ADD COLUMN IF NOT EXISTS "notes" TEXT;
DROP INDEX IF EXISTS "fee_arrears_studentId_studentFeeId_academicYearId_key";

-- Migration : Ajout des champs previousArrears et isNewStudent à la table admissions
-- Permet aux nouveaux clients de saisir les arriérés antérieurs (sur papier)
-- et de distinguer les nouveaux élèves (INSCRIPTION) des anciens (REINSCRIPTION).

ALTER TABLE "admissions" ADD COLUMN IF NOT EXISTS "previousArrears" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "admissions" ADD COLUMN IF NOT EXISTS "isNewStudent" BOOLEAN NOT NULL DEFAULT true;

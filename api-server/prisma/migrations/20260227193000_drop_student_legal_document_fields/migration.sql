-- Drop legacy legal document fields on students (no longer used in app)
ALTER TABLE "students" DROP COLUMN IF EXISTS "legalDocumentType";
ALTER TABLE "students" DROP COLUMN IF EXISTS "legalDocumentNumber";


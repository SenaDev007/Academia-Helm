-- Add NPI (Numéro d'Identification Personnel) to students - distinct from matricule/code élève
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "npi" TEXT;

-- Comment: Relations StudentAuditLog, AcademicYearClosure are Prisma-only (no new tables/columns).
-- This migration only adds the new student.npi column.

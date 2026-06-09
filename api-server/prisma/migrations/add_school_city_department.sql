-- Add city and department fields to schools table
-- These fields enable geographic classification of schools for the Benin map feature

ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "department" TEXT;

-- Add index on department for faster map-stats queries
CREATE INDEX IF NOT EXISTS "schools_department_idx" ON "schools" ("department");

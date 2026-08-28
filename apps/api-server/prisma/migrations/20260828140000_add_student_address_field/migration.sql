-- Add address field to Student model
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "address" TEXT;

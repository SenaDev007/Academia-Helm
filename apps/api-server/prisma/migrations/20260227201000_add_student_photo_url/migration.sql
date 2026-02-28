-- Add student photo URL field (used for ID cards, public verification, etc.)
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;


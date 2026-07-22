-- Migration: ajout colonnes teacherSignature et directorSignature dans attendance_registers
-- Permet de stocker les signatures (images base64) comme dans le module RH contrats.

ALTER TABLE "attendance_registers"
  ADD COLUMN IF NOT EXISTS "teacherSignature" TEXT,
  ADD COLUMN IF NOT EXISTS "directorSignature" TEXT;

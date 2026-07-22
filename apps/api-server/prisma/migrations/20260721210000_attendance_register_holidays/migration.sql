-- Migration: ajout colonne holidays dans attendance_registers
-- Stocke les jours fériés du mois (JSON array de dates ISO)

ALTER TABLE "attendance_registers"
  ADD COLUMN IF NOT EXISTS "holidays" JSONB DEFAULT '[]';

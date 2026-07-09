-- Migration : Ajout des champs de relance automatique à FinancialSettings
ALTER TABLE financial_settings
  ADD COLUMN IF NOT EXISTS "autoRecoveryEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "autoRecoveryChannels" TEXT NOT NULL DEFAULT '{"email":true,"whatsapp":true,"sms":true}',
  ADD COLUMN IF NOT EXISTS "autoRecoveryFrequency" TEXT NOT NULL DEFAULT 'DAILY',
  ADD COLUMN IF NOT EXISTS "autoRecoveryTime" TEXT NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS "autoRecoveryMaxLevel" TEXT NOT NULL DEFAULT 'MISE_EN_DEMEURE';

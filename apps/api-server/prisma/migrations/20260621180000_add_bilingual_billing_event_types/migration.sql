-- ============================================================================
-- Migration: 20260621180000_add_bilingual_billing_event_types
-- ============================================================================
-- Étend l'enum BillingEventType pour supporter les événements liés à
-- l'option bilingue (activation/désactivation).
-- ============================================================================

ALTER TYPE "BillingEventType" ADD VALUE IF NOT EXISTS 'BILINGUAL_ACTIVATION';
ALTER TYPE "BillingEventType" ADD VALUE IF NOT EXISTS 'BILINGUAL_ACTIVATED';
ALTER TYPE "BillingEventType" ADD VALUE IF NOT EXISTS 'BILINGUAL_DEACTIVATED';

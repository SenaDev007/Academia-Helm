-- ============================================================================
-- Migration: 20260619100000_add_meeting_link_phone_to_interviews
-- ============================================================================
-- Ajoute meetingLink et phoneNumber à hr_interviews pour supporter les
-- visioconférences (Google Meet/Zoom) et les entretiens téléphoniques.
-- ============================================================================

ALTER TABLE "hr_interviews" ADD COLUMN IF NOT EXISTS "meetingLink" TEXT;
ALTER TABLE "hr_interviews" ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;

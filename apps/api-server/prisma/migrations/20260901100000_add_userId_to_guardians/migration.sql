-- ============================================================================
-- Migration: Add userId column to guardians table
-- ============================================================================
--
-- ⭐ Why this migration exists:
-- The chat system (chat_conversations, chat_participants, chat_messages) is
-- built around User IDs. To chat with a parent, the parent needs a User
-- account.
--
-- Previously, the guardians table had NO userId column — so even though
-- some SQL queries in chat.service.ts referenced g."userId", the column
-- didn't exist and those queries would throw silently.
--
-- This migration:
--   1. Adds a nullable userId column to guardians
--   2. Creates an index on it (for fast lookup of "which guardian is
--      linked to this user")
--   3. Adds a foreign key constraint to users(id) with ON DELETE SET NULL
--      (so deleting a user doesn't cascade-delete the guardian record)
--
-- After this migration, the backend's ParentUserProvisioningService will
-- auto-create a User account (role=PARENT) for each guardian that doesn't
-- have one yet, and back-fill guardian.userId.
-- ============================================================================

ALTER TABLE "guardians" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- Index for fast lookup "which guardians are linked to this user?"
CREATE INDEX IF NOT EXISTS "guardians_userId_idx" ON "guardians"("userId");

-- Foreign key constraint (defer to users table)
-- Use DO block to make it idempotent (the constraint may already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'guardians_userId_fkey'
  ) THEN
    ALTER TABLE "guardians"
      ADD CONSTRAINT "guardians_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE SET NULL;
  END IF;
END$$;

-- ============================================================================
-- Signal Protocol V3 — Pre-keys table
-- ============================================================================
-- Stores pre-key bundles (identity key, signed pre-key, one-time pre-keys)
-- for the Signal Protocol V3 implementation.
--
-- Each user has:
--   - 1 IDENTITY row (long-term ECDH P-256 public key, base64 SPKI)
--   - 1 SIGNED_PREKEY row (medium-term, signed by identity key)
--   - 0..N ONE_TIME_PREKEY rows (single-use, atomically consumed on fetch)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "signal_prekeys" (
    "id"                  TEXT NOT NULL,
    "userId"              TEXT NOT NULL,
    "keyType"             TEXT NOT NULL,  -- IDENTITY | SIGNED_PREKEY | ONE_TIME_PREKEY
    "publicKeyBase64"     TEXT NOT NULL,
    "prekeyId"            INTEGER,        -- NULL for IDENTITY, integer for SPK/OPK
    "signatureBase64"     TEXT,           -- only for SIGNED_PREKEY
    "isConsumed"          BOOLEAN NOT NULL DEFAULT false,
    "consumedAt"          TIMESTAMP(3),
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "signal_prekeys_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one row per (userId, keyType, prekeyId)
-- (For IDENTITY rows, prekeyId is NULL — we rely on a partial unique index.)
CREATE UNIQUE INDEX IF NOT EXISTS "signal_prekeys_user_type_id_idx"
    ON "signal_prekeys" ("userId", "keyType", "prekeyId")
    WHERE "prekeyId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "signal_prekeys_user_identity_idx"
    ON "signal_prekeys" ("userId", "keyType")
    WHERE "keyType" = 'IDENTITY';

-- Lookups
CREATE INDEX IF NOT EXISTS "signal_prekeys_user_idx" ON "signal_prekeys" ("userId");
CREATE INDEX IF NOT EXISTS "signal_prekeys_opk_available_idx"
    ON "signal_prekeys" ("userId", "isConsumed", "createdAt")
    WHERE "keyType" = 'ONE_TIME_PREKEY';

-- Foreign key to users
ALTER TABLE "signal_prekeys" ADD CONSTRAINT "signal_prekeys_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

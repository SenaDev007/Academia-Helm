-- ⭐ Bilingual OTP activation + annual expiry
--    Adds fields to settings_bilingual for:
--    - OTP verification (the school must enter a code sent to YEHI OR Tech
--      before the bilingual mode can be activated — ensures payment was made)
--    - Annual expiry (bilingual mode expires on August 31 of each year;
--      the school must re-activate with a new OTP at the start of each school year)

-- Pending OTP code (hashed) and its expiration timestamp
ALTER TABLE "settings_bilingual" ADD COLUMN IF NOT EXISTS "pendingOtpCode" TEXT;
ALTER TABLE "settings_bilingual" ADD COLUMN IF NOT EXISTS "pendingOtpExpiresAt" TIMESTAMP(3);
ALTER TABLE "settings_bilingual" ADD COLUMN IF NOT EXISTS "pendingOtpAttempts" INTEGER DEFAULT 0;

-- When the bilingual mode was last activated with a valid OTP
ALTER TABLE "settings_bilingual" ADD COLUMN IF NOT EXISTS "otpActivatedAt" TIMESTAMP(3);

-- When the bilingual mode expires (August 31 of the next school year)
-- The school must re-activate with a new OTP before this date.
ALTER TABLE "settings_bilingual" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

-- Whether the bilingual mode is currently expired (computed from expiresAt)
-- This is a cache to avoid recomputing on every read.
ALTER TABLE "settings_bilingual" ADD COLUMN IF NOT EXISTS "isExpired" BOOLEAN DEFAULT false;

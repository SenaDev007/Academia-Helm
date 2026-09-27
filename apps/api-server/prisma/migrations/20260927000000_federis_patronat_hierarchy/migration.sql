-- ⭐ Academia Federis — Hiérarchie multi-pays des patronats
-- Niveaux territoriaux configurables par pays + rattachement hiérarchique
-- national → territorial + abonnement par année scolaire.
-- Conforme au cahier des charges Federis (multi-pays, sans coder le modèle béninois en dur).

-- ═══════════════════════════════════════════════════════════════════
-- 1. Table des niveaux territoriaux par pays
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "country_territorial_levels" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "country_territorial_levels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "country_territorial_levels_countryId_code_key"
    ON "country_territorial_levels"("countryId", "code");
CREATE INDEX IF NOT EXISTS "country_territorial_levels_countryId_idx"
    ON "country_territorial_levels"("countryId");

ALTER TABLE "country_territorial_levels"
    ADD CONSTRAINT "country_territorial_levels_countryId_fkey"
    FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE CASCADE;

-- ═══════════════════════════════════════════════════════════════════
-- 2. Colonnes hiérarchiques et abonnement sur patronats
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE "patronats" ADD COLUMN IF NOT EXISTS "orgLevel" TEXT NOT NULL DEFAULT 'TERRITORIAL';
ALTER TABLE "patronats" ADD COLUMN IF NOT EXISTS "parentPatronatId" TEXT;
ALTER TABLE "patronats" ADD COLUMN IF NOT EXISTS "territoryName" TEXT;
ALTER TABLE "patronats" ADD COLUMN IF NOT EXISTS "territorialLevelId" TEXT;
ALTER TABLE "patronats" ADD COLUMN IF NOT EXISTS "countryId" TEXT;
ALTER TABLE "patronats" ADD COLUMN IF NOT EXISTS "subscriptionPeriod" TEXT NOT NULL DEFAULT 'SCHOOL_YEAR';
ALTER TABLE "patronats" ADD COLUMN IF NOT EXISTS "subscriptionStartedAt" TIMESTAMP(3);
ALTER TABLE "patronats" ADD COLUMN IF NOT EXISTS "subscriptionExpiresAt" TIMESTAMP(3);
ALTER TABLE "patronats" ADD COLUMN IF NOT EXISTS "billingRemindersSent" JSONB;

-- Plans Federis : ESSENTIEL (100 000 FCFA / année scolaire) / INSTITUTION (250 000 FCFA / année scolaire)
ALTER TABLE "patronats" ALTER COLUMN "subscriptionPlan" SET DEFAULT 'ESSENTIEL';
ALTER TABLE "patronats" ALTER COLUMN "subscriptionStatus" SET DEFAULT 'PENDING_PAYMENT';

CREATE INDEX IF NOT EXISTS "patronats_parentPatronatId_idx" ON "patronats"("parentPatronatId");
CREATE INDEX IF NOT EXISTS "patronats_orgLevel_idx" ON "patronats"("orgLevel");

ALTER TABLE "patronats" DROP CONSTRAINT IF EXISTS "patronats_parentPatronatId_fkey";
ALTER TABLE "patronats"
    ADD CONSTRAINT "patronats_parentPatronatId_fkey"
    FOREIGN KEY ("parentPatronatId") REFERENCES "patronats"("id");

ALTER TABLE "patronats" DROP CONSTRAINT IF EXISTS "patronats_countryId_fkey";
ALTER TABLE "patronats"
    ADD CONSTRAINT "patronats_countryId_fkey"
    FOREIGN KEY ("countryId") REFERENCES "countries"("id");

ALTER TABLE "patronats" DROP CONSTRAINT IF EXISTS "patronats_territorialLevelId_fkey";
ALTER TABLE "patronats"
    ADD CONSTRAINT "patronats_territorialLevelId_fkey"
    FOREIGN KEY ("territorialLevelId") REFERENCES "country_territorial_levels"("id");

-- ═══════════════════════════════════════════════════════════════════
-- 3. Seed défensif des niveaux territoriaux
--    Niveau NATIONAL (order 1) pour tous les pays actifs,
--    Bénin : DEPARTMENT (order 2) — les autres pays seront configurés
--    après validation de leur organisation réelle (cahier des charges §2.2).
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO "country_territorial_levels" ("id", "countryId", "code", "label", "order", "isActive", "createdAt", "updatedAt")
SELECT uuid_generate_v4(), c."id", 'NATIONAL', 'National', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "countries" c
WHERE NOT EXISTS (
    SELECT 1 FROM "country_territorial_levels" ctl
    WHERE ctl."countryId" = c."id" AND ctl."code" = 'NATIONAL'
);

INSERT INTO "country_territorial_levels" ("id", "countryId", "code", "label", "order", "isActive", "createdAt", "updatedAt")
SELECT uuid_generate_v4(), c."id", 'DEPARTMENT', 'Département', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "countries" c
WHERE c."code" = 'BJ'
  AND NOT EXISTS (
    SELECT 1 FROM "country_territorial_levels" ctl
    WHERE ctl."countryId" = c."id" AND ctl."code" = 'DEPARTMENT'
);

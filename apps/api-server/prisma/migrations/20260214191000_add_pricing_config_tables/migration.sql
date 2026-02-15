-- CreateTable: pricing_configs (billing / pricing)
CREATE TABLE IF NOT EXISTS "pricing_configs" (
    "id" TEXT NOT NULL,
    "initial_subscription_fee" INTEGER NOT NULL,
    "multi_school_initial_discount_percent" INTEGER,
    "monthly_base_price" INTEGER NOT NULL,
    "yearly_base_price" INTEGER NOT NULL,
    "yearly_discount_percent" INTEGER NOT NULL,
    "bilingual_monthly_addon" INTEGER NOT NULL,
    "bilingual_yearly_addon" INTEGER NOT NULL,
    "school_additional_price" INTEGER NOT NULL,
    "trial_days" INTEGER NOT NULL DEFAULT 30,
    "grace_days" INTEGER NOT NULL DEFAULT 7,
    "reminder_days" JSONB NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "metadata" JSONB,

    CONSTRAINT "pricing_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pricing_configs_version_key" ON "pricing_configs"("version");
CREATE INDEX IF NOT EXISTS "pricing_configs_is_active_idx" ON "pricing_configs"("is_active");
CREATE INDEX IF NOT EXISTS "pricing_configs_version_idx" ON "pricing_configs"("version");
CREATE INDEX IF NOT EXISTS "pricing_configs_created_at_idx" ON "pricing_configs"("created_at");

-- CreateTable: pricing_group_tiers
CREATE TABLE IF NOT EXISTS "pricing_group_tiers" (
    "id" TEXT NOT NULL,
    "schools_count" INTEGER NOT NULL,
    "monthly_price" INTEGER NOT NULL,
    "yearly_price" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "metadata" JSONB,

    CONSTRAINT "pricing_group_tiers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pricing_group_tiers_schools_count_key" ON "pricing_group_tiers"("schools_count");
CREATE INDEX IF NOT EXISTS "pricing_group_tiers_schools_count_idx" ON "pricing_group_tiers"("schools_count");
CREATE INDEX IF NOT EXISTS "pricing_group_tiers_is_active_idx" ON "pricing_group_tiers"("is_active");

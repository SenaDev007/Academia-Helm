-- ═══════════════════════════════════════════════════════════════════════════
-- Module « Paramètres — Règles de calcul » (Academia Federis — 2026-09-30)
--
-- Règles de calcul des résultats par type d'examen (CEP | BEPC | BAC | CAP) :
-- seuil d'admission (passMark) et seuil de rachat (rescueMark).
--
-- Sémantique « source de vérité » :
--   · SANS ligne pour un type  → les DÉFAUTS DU BACKEND s'appliquent
--     (admission 10/20, rachat 9,5/20) — affichés dans le module Paramètres ;
--   · AVEC ligne pour un type  → la configuration du patronat DEVIENT la
--     source de vérité du backend (délibération, décisions, registre, PDF).
--
-- ⚠️ 100 % IDEMPOTENTE (pattern migrations federis 20260929160000+) :
-- chaque statement est un no-op si l'objet existe déjà.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "federis_grading_rules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "examType" TEXT NOT NULL,
    "passMark" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "rescueMark" DOUBLE PRECISION NOT NULL DEFAULT 9.5,
    "updatedBy" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "federis_grading_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "federis_grading_rules_tenantId_idx"
    ON "federis_grading_rules"("tenantId");

-- Une règle par (tenant, type d'examen) — la ligne fait foi dès qu'elle existe
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'federis_grading_rules_tenantId_examType_key') THEN
        ALTER TABLE "federis_grading_rules"
            ADD CONSTRAINT "federis_grading_rules_tenantId_examType_key"
            UNIQUE ("tenantId", "examType");
    END IF;
END $$;

-- Clé étrangère : tenant du patronat (isolation)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'federis_grading_rules_tenantId_fkey') THEN
        ALTER TABLE "federis_grading_rules"
            ADD CONSTRAINT "federis_grading_rules_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE;
    END IF;
END $$;

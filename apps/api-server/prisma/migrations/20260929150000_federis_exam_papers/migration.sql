-- ⭐ Academia Federis — Module « Épreuves et documents » (2026-09-29)
-- Scindé en deux onglets : Épreuves (création avec champs enrichis — même
-- pattern que les fiches pédagogiques / épreuves enseignants Academia Helm)
-- et Catalogue (arborescence année scolaire → examen CEP/BEPC/BAC/CAP →
-- épreuves). Génération PDF 100 % backend (Puppeteer, pattern Helm).
--
-- ⚠️ 100 % IDEMPOTENTE (miroir de l'auto-guérison du service
-- FederisEpreuveService.ensureTable — pattern ensure-tables main.ts) :
-- chaque statement est un no-op si l'objet existe déjà, contraintes via
-- DO $$ ... IF NOT EXISTS — le déploiement ne dépend PAS de l'ordre
-- d'exécution migration / premier appel API.

-- ═══════════════════════════════════════════════════════════════════
-- 1. Table des épreuves créées par les patronats
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "federis_exam_papers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patronatId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "examCategory" TEXT NOT NULL,
    "subject" TEXT,
    "title" TEXT NOT NULL,
    "sessionLabel" TEXT,
    "durationLabel" TEXT,
    "maxScoreLabel" TEXT,
    "coefficient" TEXT,
    "showIdentityFields" BOOLEAN NOT NULL DEFAULT true,
    "customHeader" TEXT,
    "situation" TEXT,
    "tache" TEXT,
    "sections" JSONB,
    "cleCorrection" TEXT,
    "grilleCorrection" TEXT,
    "footerText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "federis_exam_papers_pkey" PRIMARY KEY ("id")
);

-- Catalogue : année scolaire → examen → épreuves (isolation par tenant)
CREATE INDEX IF NOT EXISTS "federis_exam_papers_tenantId_academicYearId_examCategory_idx"
    ON "federis_exam_papers"("tenantId", "academicYearId", "examCategory");
CREATE INDEX IF NOT EXISTS "federis_exam_papers_tenantId_status_idx"
    ON "federis_exam_papers"("tenantId", "status");

-- Clé étrangère : tenant du patronat propriétaire (isolation territoriale)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'federis_exam_papers_tenantId_fkey') THEN
        ALTER TABLE "federis_exam_papers"
            ADD CONSTRAINT "federis_exam_papers_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- Clé étrangère : patronat propriétaire
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'federis_exam_papers_patronatId_fkey') THEN
        ALTER TABLE "federis_exam_papers"
            ADD CONSTRAINT "federis_exam_papers_patronatId_fkey"
            FOREIGN KEY ("patronatId") REFERENCES "patronats"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 2. En-tête personnalisé réutilisable (patronat → toutes ses épreuves)
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE "patronats" ADD COLUMN IF NOT EXISTS "epreuveHeader" TEXT;

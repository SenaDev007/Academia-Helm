-- ═══════════════════════════════════════════════════════════════════════════
-- Module « Matières » (Academia Federis — 2026-09-29)
--
-- Catalogue des matières d'examen du patronat, par type (CEP | BEPC | BAC |
-- CAP) et par série (BAC : A1, A2, C, D… / CAP : filières). Ces matières
-- alimentent le workflow complet : lancement d'examen (attachées à la
-- campagne via NationalExamSubject), module Épreuves (FK subjectId + signal
-- « épreuves à préparer ») et module Notes et Moyennes.
--
-- + federis_exam_papers.subjectId : lien exact épreuve ↔ matière du catalogue
--   (repli sur le nom normalisé pour les épreuves antérieures au module).
--
-- ⚠️ 100 % IDEMPOTENTE (pattern migrations federis 20260929160000+) : chaque
-- statement est un no-op si l'objet existe déjà, contraintes via DO $$ …
-- IF NOT EXISTS — le déploiement ne dépend pas de l'ordre migration/appel.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ 1. Catalogue des matières d'examen ═══════════════════════════════════

CREATE TABLE IF NOT EXISTS "federis_subjects" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "examType" TEXT NOT NULL,
    "series" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coefficient" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 20.0,
    "duration" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    CONSTRAINT "federis_subjects_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "federis_subjects_tenantId_academicYearId_examType_idx"
    ON "federis_subjects"("tenantId", "academicYearId", "examType");
CREATE INDEX IF NOT EXISTS "federis_subjects_tenantId_examType_series_idx"
    ON "federis_subjects"("tenantId", "examType", "series");

-- Unicité : une matière par (tenant, année, type, série, code)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'federis_subjects_tenantId_academicYearId_examType_series_code_key') THEN
        ALTER TABLE "federis_subjects"
            ADD CONSTRAINT "federis_subjects_tenantId_academicYearId_examType_series_code_key"
            UNIQUE ("tenantId", "academicYearId", "examType", "series", "code");
    END IF;
END $$;

-- Clé étrangère : tenant du patronat (isolation territoriale)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'federis_subjects_tenantId_fkey') THEN
        ALTER TABLE "federis_subjects"
            ADD CONSTRAINT "federis_subjects_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- ═══ 2. Lien exact épreuve ↔ matière du catalogue ═════════════════════════

ALTER TABLE "federis_exam_papers" ADD COLUMN IF NOT EXISTS "subjectId" TEXT;

CREATE INDEX IF NOT EXISTS "federis_exam_papers_subjectId_idx"
    ON "federis_exam_papers"("subjectId");

-- FK douce : suppression de la matière → l'épreuve conserve son intitulé
-- texte (subjectId → NULL) ; garde d'existence de la table cible.
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'federis_exam_papers_subjectId_fkey')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'federis_subjects') THEN
        ALTER TABLE "federis_exam_papers"
            ADD CONSTRAINT "federis_exam_papers_subjectId_fkey"
            FOREIGN KEY ("subjectId") REFERENCES "federis_subjects"("id") ON DELETE SET NULL;
    END IF;
END $$;

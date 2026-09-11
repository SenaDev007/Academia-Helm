-- ⭐ BRIEF PERF 3.3 + 3.4 — Correctifs performance Academia Helm
-- 1) app_sequences : séquences atomiques (reçus, refs TX, ventes) — remplace
--    les read-modify-write findFirst max+1 par des upserts ON CONFLICT atomiques
-- 2) Index manquants sur les colonnes de filtrage fréquent (audit requêtes)

-- ── 1. Table de séquences atomiques ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "app_sequences" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_sequences_pkey" PRIMARY KEY ("id")
);

-- Une ligne par (tenant, clé de séquence)
CREATE UNIQUE INDEX IF NOT EXISTS "app_sequences_tenantId_key_key"
    ON "app_sequences"("tenantId", "key");
CREATE INDEX IF NOT EXISTS "app_sequences_tenantId_idx"
    ON "app_sequences"("tenantId");

-- FK vers tenants (cascade, cohérent avec student_number_sequences)
ALTER TABLE "app_sequences" DROP CONSTRAINT IF EXISTS "app_sequences_tenantId_fkey";
ALTER TABLE "app_sequences"
    ADD CONSTRAINT "app_sequences_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 2. Index manquants (colonnes de filtrage/tri fréquentes) ───────────────
-- payments : listes par année + plage de dates + dashboards « encaissements du jour »
-- Avant : seq scan filtré après l'index (tenantId, schoolLevelId).
CREATE INDEX IF NOT EXISTS "payments_tenantId_academicYearId_paymentDate_idx"
    ON "payments"("tenantId", "academicYearId", "paymentDate");
CREATE INDEX IF NOT EXISTS "payments_tenantId_status_idx"
    ON "payments"("tenantId", "status");

-- grades : validation par classe, dashboards examens (grade.count par classe/statut)
CREATE INDEX IF NOT EXISTS "grades_classId_idx"
    ON "grades"("classId");
CREATE INDEX IF NOT EXISTS "grades_classId_status_idx"
    ON "grades"("classId", "status");

-- teachers : login/lookup par email dans le périmètre tenant (findFirst full scan avant)
CREATE INDEX IF NOT EXISTS "teachers_tenantId_email_idx"
    ON "teachers"("tenantId", "email");
CREATE INDEX IF NOT EXISTS "teachers_tenantId_status_idx"
    ON "teachers"("tenantId", "status");

-- quarters : résolution du trimestre courant (findFirst tenant+année)
CREATE INDEX IF NOT EXISTS "quarters_tenantId_academicYearId_idx"
    ON "quarters"("tenantId", "academicYearId");

-- absences : dashboard « absences du jour » + filtres par date
CREATE INDEX IF NOT EXISTS "absences_tenantId_date_idx"
    ON "absences"("tenantId", "date");

-- finance_transactions : liste des encaissements paginée (tenant + année + createdAt)
CREATE INDEX IF NOT EXISTS "finance_transactions_tenantId_academicYearId_createdAt_idx"
    ON "finance_transactions"("tenantId", "academicYearId", "createdAt");
CREATE INDEX IF NOT EXISTS "finance_transactions_tenantId_receiptNumber_idx"
    ON "finance_transactions"("tenantId", "receiptNumber");

-- student_accounts : page Encaissements charge les comptes par année (exportAll)
CREATE INDEX IF NOT EXISTS "student_accounts_tenantId_academicYearId_idx"
    ON "student_accounts"("tenantId", "academicYearId");

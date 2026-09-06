-- ⭐ Filtre intelligent Rôles × Pistes × Niveaux — Consolidation (P0, 2e vague)
--
-- ⚠️ HISTORIQUE : cette migration a été appliquée DIRECTEMENT sur Neon prod le
-- 06/09/2026 (session Task 14, script apply_migration_scope_consolidate.js)
-- et enregistrée dans _prisma_migrations ; le dossier du repo a été perdu lors
-- du reset du sandbox. Il est RECONSTITUÉ ici (2026-09-06, session P5/D6) pour
-- aligner repo ↔ base (zéro drift). `prisma migrate deploy` ne la rejouera pas
-- (déjà marquée appliquée) ; le SQL est écrit idempotent par sécurité.
--
-- Contenu : la colonne piste `academicTrackId` est garantie sur TOUTES les
-- tables finance (payments + expenses + fee_configurations + finance_transactions)
-- + FK vers academic_tracks (SET NULL) + index tenant/piste + backfill depuis
-- la classe courante de l'élève.

-- ── 1. expenses ─────────────────────────────────────────────────────────────
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "academicTrackId" TEXT;
DO $$ BEGIN
  ALTER TABLE "expenses"
    ADD CONSTRAINT "expenses_academicTrackId_fkey"
    FOREIGN KEY ("academicTrackId") REFERENCES "academic_tracks"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "idx_expenses_tenant_track" ON "expenses"("tenantId", "academicTrackId");

-- ── 2. fee_configurations ───────────────────────────────────────────────────
ALTER TABLE "fee_configurations" ADD COLUMN IF NOT EXISTS "academicTrackId" TEXT;
DO $$ BEGIN
  ALTER TABLE "fee_configurations"
    ADD CONSTRAINT "fee_configurations_academicTrackId_fkey"
    FOREIGN KEY ("academicTrackId") REFERENCES "academic_tracks"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "idx_fee_configurations_tenant_track"
  ON "fee_configurations"("tenantId", "academicTrackId");

-- ── 3. finance_transactions ─────────────────────────────────────────────────
ALTER TABLE "finance_transactions" ADD COLUMN IF NOT EXISTS "academicTrackId" TEXT;
DO $$ BEGIN
  ALTER TABLE "finance_transactions"
    ADD CONSTRAINT "finance_transactions_academicTrackId_fkey"
    FOREIGN KEY ("academicTrackId") REFERENCES "academic_tracks"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "idx_finance_transactions_tenant_track"
  ON "finance_transactions"("tenantId", "academicTrackId");

-- ── 4. Index piste complémentaires (payments / staff_admin_assignments) ─────
CREATE INDEX IF NOT EXISTS "idx_payments_tenant_track" ON "payments"("tenantId", "academicTrackId");
CREATE INDEX IF NOT EXISTS "idx_staff_admin_assignments_tenant_track_active"
  ON "staff_admin_assignments"("tenantId", "academicTrackId") WHERE "isActive" = true;

-- ── 5. Backfill : piste de l'élève via sa classe courante (idempotent) ──────
--    finance_transactions → compte élève → classe courante
UPDATE "finance_transactions" ft
SET "academicTrackId" = COALESCE(cl."academicTrackId",
  CASE WHEN cl."language" = 'EN' THEN (SELECT id FROM academic_tracks WHERE "tenantId" = ft."tenantId" AND code = 'EN') ELSE NULL END)
FROM "student_accounts" sa
LEFT JOIN "class_students" cs ON cs."studentId" = sa."studentId"
LEFT JOIN "classes" cl ON cl.id = cs."classId"
WHERE ft."studentAccountId" = sa.id
  AND ft."academicTrackId" IS NULL
  AND cl.id IS NOT NULL;

--    expenses / fee_configurations : piste de la classe visée si identifiable
UPDATE "fee_configurations" fc
SET "academicTrackId" = COALESCE(cl."academicTrackId",
  CASE WHEN cl."language" = 'EN' THEN (SELECT id FROM academic_tracks WHERE "tenantId" = fc."tenantId" AND code = 'EN') ELSE NULL END)
FROM "classes" cl
WHERE fc."classId" = cl.id AND fc."academicTrackId" IS NULL;

UPDATE "expenses" e
SET "academicTrackId" = COALESCE(cl."academicTrackId",
  CASE WHEN cl."language" = 'EN' THEN (SELECT id FROM academic_tracks WHERE "tenantId" = e."tenantId" AND code = 'EN') ELSE NULL END)
FROM "classes" cl
WHERE e."schoolLevelId" = cl."schoolLevelId"
  AND e."academicTrackId" IS NULL
  AND cl."language" = 'EN';

-- ⭐ Filtre intelligent Rôles × Pistes × Niveaux — Fondation (P0)
--
-- 1. Piste linguistique sur les affectations administratives :
--    permet de modéliser « Directeur piste FR ≠ Directeur piste EN ».
--    NULL = les deux pistes (rétro-compatibilité : affectations existantes bi-piste).
-- 2. Piste dénormalisée sur les paiements (remplie à l'écriture depuis la classe
--    de l'élève ; NULL = piste indéterminée, exonéré du filtre piste).

-- ── 1. staff_admin_assignments ──────────────────────────────────────────────
ALTER TABLE "staff_admin_assignments" ADD COLUMN "academicTrackId" TEXT;
ALTER TABLE "staff_admin_assignments"
  ADD CONSTRAINT "staff_admin_assignments_academicTrackId_fkey"
  FOREIGN KEY ("academicTrackId") REFERENCES "academic_tracks"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "staff_admin_assignments_tenantId_schoolLevelCode_academicTrackId_idx"
  ON "staff_admin_assignments"("tenantId", "schoolLevelCode", "academicTrackId");

-- ── 2. payments ─────────────────────────────────────────────────────────────
ALTER TABLE "payments" ADD COLUMN "academicTrackId" TEXT;
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_academicTrackId_fkey"
  FOREIGN KEY ("academicTrackId") REFERENCES "academic_tracks"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "payments_tenantId_schoolLevelId_academicTrackId_idx"
  ON "payments"("tenantId", "schoolLevelId", "academicTrackId");

-- ── 3. Backfill payments : piste depuis la classe courante de l'élève ───────
--    (class_students le plus récent, sinon student_enrollments) — idempotent.
UPDATE payments p
SET "academicTrackId" = (
  SELECT t.id FROM academic_tracks t
  WHERE t."tenantId" = p."tenantId"
    AND t.code = COALESCE(
      (SELECT cl.language FROM class_students cs
       JOIN classes cl ON cl.id = cs."classId"
       WHERE cs."studentId" = p."studentId"
       ORDER BY cs."createdAt" DESC LIMIT 1),
      (SELECT cl.language FROM student_enrollments se
       JOIN classes cl ON cl.id = se."classId"
       WHERE se."studentId" = p."studentId" AND se."classId" IS NOT NULL
       ORDER BY se."enrollmentDate" DESC NULLS LAST LIMIT 1)
    )
    LIMIT 1
)
WHERE p."academicTrackId" IS NULL
  AND p."studentId" IS NOT NULL;

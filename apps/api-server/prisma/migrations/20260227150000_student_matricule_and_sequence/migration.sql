-- Matricule élève institutionnel : séquence par tenant + colonnes Student

-- Table séquence (un enregistrement par tenant)
CREATE TABLE IF NOT EXISTS "student_number_sequences" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_number_sequences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "student_number_sequences_tenantId_key" ON "student_number_sequences"("tenantId");

ALTER TABLE "student_number_sequences" ADD CONSTRAINT "student_number_sequences_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Colonnes Student
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "matricule" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "enrollmentYear" INTEGER;

-- Contrainte unique (tenantId, matricule) pour matricule non null
CREATE UNIQUE INDEX IF NOT EXISTS "students_tenantId_matricule_key" ON "students"("tenantId", "matricule") WHERE "matricule" IS NOT NULL;

-- Backfill : lignes existantes reçoivent un matricule unique (LEGACY- + id) et année d'inscription
UPDATE "students"
SET "matricule" = 'LEGACY-' || "id"::text,
    "enrollmentYear" = EXTRACT(YEAR FROM "createdAt")::INTEGER
WHERE "matricule" IS NULL;

-- Index pour requêtes par matricule
CREATE INDEX IF NOT EXISTS "students_tenantId_matricule_idx" ON "students"("tenantId", "matricule");

-- Trigger : interdire toute modification du matricule
CREATE OR REPLACE FUNCTION prevent_matricule_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."matricule" IS DISTINCT FROM NEW."matricule" THEN
    RAISE EXCEPTION 'Matricule modification is forbidden';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS no_update_matricule ON "students";
CREATE TRIGGER no_update_matricule
  BEFORE UPDATE ON "students"
  FOR EACH ROW
  EXECUTE PROCEDURE prevent_matricule_update();

-- Module 1 — Triggers SQL de sécurité (PostgreSQL)
-- À exécuter manuellement après les migrations Prisma : psql -f module1_students_security_triggers.sql
-- Tables concernées : students, student_enrollments, grades

-- ---------------------------------------------------------------------------
-- A. Matricule unique par tenant (contrainte déjà gérée par @@unique(tenantId, studentCode) dans Prisma)
-- Si besoin d'un nom de contrainte explicite :
-- ALTER TABLE "students" ADD CONSTRAINT "unique_matricule_per_tenant" UNIQUE ("tenantId", "studentCode");
-- (ignorer si la contrainte existe déjà)

-- ---------------------------------------------------------------------------
-- B. Interdire suppression physique d'un élève
CREATE OR REPLACE FUNCTION prevent_student_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Suppression physique interdite. Utiliser is_active = false ou status = WITHDRAWN';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_student_delete ON "students";
CREATE TRIGGER trg_prevent_student_delete
  BEFORE DELETE ON "students"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_student_delete();

-- ---------------------------------------------------------------------------
-- C. Empêcher modification de l'année scolaire sur un enrollment
CREATE OR REPLACE FUNCTION prevent_academic_year_update_enrollment()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."academicYearId" IS DISTINCT FROM NEW."academicYearId" THEN
    RAISE EXCEPTION 'Changement d''année scolaire interdit sur un enrollment';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_year_change ON "student_enrollments";
CREATE TRIGGER trg_prevent_year_change
  BEFORE UPDATE ON "student_enrollments"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_academic_year_update_enrollment();

-- ---------------------------------------------------------------------------
-- D. Empêcher changement de classe si des notes existent pour cet élève dans cette année
CREATE OR REPLACE FUNCTION prevent_class_change_if_grades()
RETURNS TRIGGER AS $$
DECLARE
  grade_count INT;
BEGIN
  IF OLD."classId" IS NOT DISTINCT FROM NEW."classId" THEN
    RETURN NEW;
  END IF;
  SELECT COUNT(*)::INT INTO grade_count
  FROM "grades"
  WHERE "studentId" = OLD."studentId"
    AND "academicYearId" = OLD."academicYearId";
  IF grade_count > 0 THEN
    RAISE EXCEPTION 'Impossible de changer de classe : notes existantes pour cet élève dans cette année';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_class_change_if_grades ON "student_enrollments";
CREATE TRIGGER trg_prevent_class_change_if_grades
  BEFORE UPDATE ON "student_enrollments"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_class_change_if_grades();

-- ---------------------------------------------------------------------------
-- E. Arriérés verrouillés (optionnel) : empêcher mise à zéro manuelle de previousArrears
-- Décommenter si la politique métier impose de ne jamais remettre à 0 manuellement.
/*
CREATE OR REPLACE FUNCTION prevent_arrears_manual_clear()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."previousArrears" < OLD."previousArrears" AND OLD."previousArrears" > 0 THEN
    RAISE EXCEPTION 'Réduction manuelle des arriérés interdite';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_arrears_clear ON "student_enrollments";
CREATE TRIGGER trg_prevent_arrears_clear
  BEFORE UPDATE ON "student_enrollments"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_arrears_manual_clear();
*/

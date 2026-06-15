-- MODULE 1 — ÉLÈVES & INSCRIPTIONS : TRIGGERS DE SÉCURITÉ

-- 1. Empêcher la suppression physique d'un élève
CREATE OR REPLACE FUNCTION prevent_student_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Suppression physique interdite pour le modèle Student. Utiliser status = ''WITHDRAWN'' ou isActive = false.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_student_delete ON "students";
CREATE TRIGGER trg_prevent_student_delete
BEFORE DELETE ON "students"
FOR EACH ROW
EXECUTE FUNCTION prevent_student_delete();

-- 2. Empêcher la modification de l'année académique d'une inscription
CREATE OR REPLACE FUNCTION prevent_academic_year_update()
RETURNS trigger AS $$
BEGIN
  IF OLD."academicYearId" <> NEW."academicYearId" THEN
    RAISE EXCEPTION 'Changement d''année académique interdit sur une inscription existante.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_year_change ON "student_enrollments";
CREATE TRIGGER trg_prevent_year_change
BEFORE UPDATE ON "student_enrollments"
FOR EACH ROW
EXECUTE FUNCTION prevent_academic_year_update();

-- 3. Empêcher le changement de classe si des notes existent déjà
CREATE OR REPLACE FUNCTION prevent_class_change_if_grades()
RETURNS trigger AS $$
DECLARE
  grade_count INT;
BEGIN
  -- Si la classe n'a pas changé, on laisse passer
  IF OLD."classId" = NEW."classId" THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO grade_count
  FROM "grades"
  WHERE "studentId" = OLD."studentId"
  AND "academicYearId" = OLD."academicYearId";

  IF grade_count > 0 THEN
    RAISE EXCEPTION 'Impossible de changer de classe : des notes existent déjà pour cet élève dans cette année académique.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_class_change_if_grades ON "student_enrollments";
CREATE TRIGGER trg_prevent_class_change_if_grades
BEFORE UPDATE ON "student_enrollments"
FOR EACH ROW
EXECUTE FUNCTION prevent_class_change_if_grades();

-- 4. Verrouillage des modifications si l'année est clôturée
CREATE OR REPLACE FUNCTION check_academic_year_lock()
RETURNS trigger AS $$
DECLARE
  is_locked BOOLEAN;
BEGIN
  SELECT "isLocked" INTO is_locked
  FROM "academic_year_closures"
  WHERE "academicYearId" = NEW."academicYearId"
  AND "tenantId" = NEW."tenantId";

  IF is_locked = true THEN
    RAISE EXCEPTION 'Modification interdite : l''année académique est clôturée et verrouillée.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer aux tables sensibles
DROP TRIGGER IF EXISTS trg_check_lock_enrollment ON "student_enrollments";
CREATE TRIGGER trg_check_lock_enrollment
BEFORE UPDATE OR INSERT ON "student_enrollments"
FOR EACH ROW
EXECUTE FUNCTION check_academic_year_lock();

DROP TRIGGER IF EXISTS trg_check_lock_regime ON "student_regimes";
CREATE TRIGGER trg_check_lock_regime
BEFORE UPDATE OR INSERT ON "student_regimes"
FOR EACH ROW
EXECUTE FUNCTION check_academic_year_lock();

-- ============================================================================
-- INDEXES DE PERFORMANCE CRITIQUES
-- ============================================================================
-- 
-- Objectif: Éliminer les Seq Scan massifs
-- Temps cible: Requêtes < 100ms
--
-- ============================================================================

-- ÉLÈVES
CREATE INDEX IF NOT EXISTS idx_students_tenant_year 
ON students(tenant_id, academic_year_id);

CREATE INDEX IF NOT EXISTS idx_students_tenant_level 
ON students(tenant_id, school_level_id);

CREATE INDEX IF NOT EXISTS idx_students_class 
ON students(class_id) WHERE class_id IS NOT NULL;

-- CLASSES
CREATE INDEX IF NOT EXISTS idx_classes_tenant_year 
ON classes(tenant_id, academic_year_id);

CREATE INDEX IF NOT EXISTS idx_classes_level 
ON classes(school_level_id);

-- NOTES
CREATE INDEX IF NOT EXISTS idx_grades_student_exam 
ON grades(student_id, exam_id);

CREATE INDEX IF NOT EXISTS idx_grades_tenant_year 
ON grades(tenant_id, academic_year_id);

CREATE INDEX IF NOT EXISTS idx_grades_subject 
ON grades(subject_id);

-- PAIEMENTS
CREATE INDEX IF NOT EXISTS idx_payments_tenant_year 
ON payments(tenant_id, academic_year_id);

CREATE INDEX IF NOT EXISTS idx_payments_student 
ON payments(student_id);

CREATE INDEX IF NOT EXISTS idx_payments_status 
ON payments(status) WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_payments_date 
ON payments(payment_date);

-- PERSONNEL
CREATE INDEX IF NOT EXISTS idx_staff_tenant 
ON staff(tenant_id);

CREATE INDEX IF NOT EXISTS idx_staff_status 
ON staff(status) WHERE status = 'active';

-- ABSENCES
CREATE INDEX IF NOT EXISTS idx_absences_tenant_student 
ON absences(tenant_id, student_id);

CREATE INDEX IF NOT EXISTS idx_absences_date 
ON absences(date);

-- INSCRIPTIONS
CREATE INDEX IF NOT EXISTS idx_student_enrollments_tenant_year 
ON student_enrollments(tenant_id, academic_year_id);

CREATE INDEX IF NOT EXISTS idx_student_enrollments_student 
ON student_enrollments(student_id);

CREATE INDEX IF NOT EXISTS idx_student_enrollments_class 
ON student_enrollments(class_id);

-- FRAIS SCOLAIRES
CREATE INDEX IF NOT EXISTS idx_student_fees_tenant_year 
ON student_fees(tenant_id, academic_year_id);

CREATE INDEX IF NOT EXISTS idx_student_fees_student 
ON student_fees(student_id);

CREATE INDEX IF NOT EXISTS idx_student_fees_status 
ON student_fees(status);

-- ANNÉES SCOLAIRES
CREATE INDEX IF NOT EXISTS idx_academic_years_tenant_active 
ON academic_years(tenant_id, is_active) WHERE is_active = true;

-- NIVEAUX SCOLAIRES
CREATE INDEX IF NOT EXISTS idx_school_levels_tenant 
ON school_levels(tenant_id);

-- COMPOSITE INDEXES pour requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_students_tenant_level_year 
ON students(tenant_id, school_level_id, academic_year_id);

CREATE INDEX IF NOT EXISTS idx_payments_tenant_year_status 
ON payments(tenant_id, academic_year_id, status);

-- ============================================================================
-- ANALYSE DES INDEXES
-- ============================================================================

-- Vérifier l'utilisation des index
-- ANALYZE students;
-- ANALYZE classes;
-- ANALYZE grades;
-- ANALYZE payments;
-- ANALYZE staff;

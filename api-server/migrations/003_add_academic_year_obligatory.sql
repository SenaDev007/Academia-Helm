-- ============================================================================
-- MIGRATION : Academic Year comme Dimension Obligatoire
-- ============================================================================
--
-- Cette migration ajoute academic_year_id comme colonne OBLIGATOIRE
-- sur toutes les tables métier qui n'en ont pas encore.
--
-- PRINCIPE :
-- - Toute donnée métier DOIT référencer academic_year_id
-- - Une seule année active par tenant
-- - Aucun calcul sans contexte d'année scolaire
--
-- ============================================================================

-- 1. Ajouter academic_year_id sur students (OBLIGATOIRE)
ALTER TABLE students
ADD COLUMN IF NOT EXISTS academic_year_id UUID;

-- Créer la contrainte de clé étrangère
ALTER TABLE students
ADD CONSTRAINT fk_students_academic_year
FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE RESTRICT;

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_students_academic_year ON students(academic_year_id);

-- 2. Rendre academic_year_id OBLIGATOIRE sur exams (actuellement nullable)
-- D'abord, mettre à jour les valeurs NULL avec l'année active du tenant
UPDATE exams e
SET academic_year_id = (
  SELECT ay.id
  FROM academic_years ay
  WHERE ay.tenant_id = e.tenant_id
    AND ay.is_current = true
  LIMIT 1
)
WHERE e.academic_year_id IS NULL;

-- Ensuite, rendre la colonne NOT NULL
ALTER TABLE exams
ALTER COLUMN academic_year_id SET NOT NULL;

-- 3. Rendre academic_year_id OBLIGATOIRE sur grades (actuellement nullable)
-- D'abord, mettre à jour les valeurs NULL
UPDATE grades g
SET academic_year_id = (
  SELECT ay.id
  FROM academic_years ay
  WHERE ay.tenant_id = g.tenant_id
    AND ay.is_current = true
  LIMIT 1
)
WHERE g.academic_year_id IS NULL;

-- Ensuite, rendre la colonne NOT NULL
ALTER TABLE grades
ALTER COLUMN academic_year_id SET NOT NULL;

-- 4. Ajouter academic_year_id sur classes (OBLIGATOIRE)
ALTER TABLE classes
ADD COLUMN IF NOT EXISTS academic_year_id UUID;

-- Mettre à jour les valeurs NULL
UPDATE classes c
SET academic_year_id = (
  SELECT ay.id
  FROM academic_years ay
  WHERE ay.tenant_id = c.tenant_id
    AND ay.is_current = true
  LIMIT 1
)
WHERE c.academic_year_id IS NULL;

-- Créer la contrainte de clé étrangère
ALTER TABLE classes
ADD CONSTRAINT fk_classes_academic_year
FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE RESTRICT;

-- Index
CREATE INDEX IF NOT EXISTS idx_classes_academic_year ON classes(academic_year_id);

-- 5. Ajouter academic_year_id sur subjects (OBLIGATOIRE)
ALTER TABLE subjects
ADD COLUMN IF NOT EXISTS academic_year_id UUID;

-- Mettre à jour les valeurs NULL
UPDATE subjects s
SET academic_year_id = (
  SELECT ay.id
  FROM academic_years ay
  WHERE ay.tenant_id = s.tenant_id
    AND ay.is_current = true
  LIMIT 1
)
WHERE s.academic_year_id IS NULL;

-- Créer la contrainte de clé étrangère
ALTER TABLE subjects
ADD CONSTRAINT fk_subjects_academic_year
FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE RESTRICT;

-- Index
CREATE INDEX IF NOT EXISTS idx_subjects_academic_year ON subjects(academic_year_id);

-- 6. Ajouter academic_year_id sur absences (OBLIGATOIRE)
ALTER TABLE absences
ADD COLUMN IF NOT EXISTS academic_year_id UUID;

-- Mettre à jour les valeurs NULL
UPDATE absences a
SET academic_year_id = (
  SELECT ay.id
  FROM academic_years ay
  WHERE ay.tenant_id = a.tenant_id
    AND ay.is_current = true
  LIMIT 1
)
WHERE a.academic_year_id IS NULL;

-- Créer la contrainte de clé étrangère
ALTER TABLE absences
ADD CONSTRAINT fk_absences_academic_year
FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE RESTRICT;

-- Index
CREATE INDEX IF NOT EXISTS idx_absences_academic_year ON absences(academic_year_id);

-- 7. Ajouter academic_year_id sur payments (OBLIGATOIRE)
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS academic_year_id UUID;

-- Mettre à jour les valeurs NULL
UPDATE payments p
SET academic_year_id = (
  SELECT ay.id
  FROM academic_years ay
  WHERE ay.tenant_id = p.tenant_id
    AND ay.is_current = true
  LIMIT 1
)
WHERE p.academic_year_id IS NULL;

-- Créer la contrainte de clé étrangère
ALTER TABLE payments
ADD CONSTRAINT fk_payments_academic_year
FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE RESTRICT;

-- Index
CREATE INDEX IF NOT EXISTS idx_payments_academic_year ON payments(academic_year_id);

-- 8. Ajouter academic_year_id sur expenses (OBLIGATOIRE)
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS academic_year_id UUID;

-- Mettre à jour les valeurs NULL
UPDATE expenses e
SET academic_year_id = (
  SELECT ay.id
  FROM academic_years ay
  WHERE ay.tenant_id = e.tenant_id
    AND ay.is_current = true
  LIMIT 1
)
WHERE e.academic_year_id IS NULL;

-- Créer la contrainte de clé étrangère
ALTER TABLE expenses
ADD CONSTRAINT fk_expenses_academic_year
FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE RESTRICT;

-- Index
CREATE INDEX IF NOT EXISTS idx_expenses_academic_year ON expenses(academic_year_id);

-- 9. Rendre academic_year_id OBLIGATOIRE sur students
-- D'abord, mettre à jour les valeurs NULL
UPDATE students s
SET academic_year_id = (
  SELECT ay.id
  FROM academic_years ay
  WHERE ay.tenant_id = s.tenant_id
    AND ay.is_current = true
  LIMIT 1
)
WHERE s.academic_year_id IS NULL;

-- Ensuite, rendre la colonne NOT NULL
ALTER TABLE students
ALTER COLUMN academic_year_id SET NOT NULL;

-- 10. Créer un index composite pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_students_tenant_year_level 
ON students(tenant_id, academic_year_id, school_level_id);

CREATE INDEX IF NOT EXISTS idx_exams_tenant_year_level 
ON exams(tenant_id, academic_year_id, school_level_id);

CREATE INDEX IF NOT EXISTS idx_grades_tenant_year_level 
ON grades(tenant_id, academic_year_id, school_level_id);

CREATE INDEX IF NOT EXISTS idx_payments_tenant_year_level 
ON payments(tenant_id, academic_year_id, school_level_id);

-- ============================================================================
-- VÉRIFICATION POST-MIGRATION
-- ============================================================================
-- Vérifier qu'aucune ligne n'a academic_year_id NULL
-- SELECT 
--   'students' as table_name,
--   COUNT(*) as rows_without_year
-- FROM students WHERE academic_year_id IS NULL
-- UNION ALL
-- SELECT 'exams', COUNT(*) FROM exams WHERE academic_year_id IS NULL
-- UNION ALL
-- SELECT 'grades', COUNT(*) FROM grades WHERE academic_year_id IS NULL;
-- Résultat attendu : 0 pour toutes les tables
-- ============================================================================


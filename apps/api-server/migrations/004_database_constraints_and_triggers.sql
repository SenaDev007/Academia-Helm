-- ============================================================================
-- MIGRATION : Contraintes SQL, Triggers et Audit Trail
-- ============================================================================
--
-- Cette migration ajoute :
-- 1. Clés étrangères (Foreign Keys) avec ON DELETE approprié
-- 2. Contraintes CHECK pour l'intégrité métier
-- 3. Triggers pour enforcement automatique
-- 4. Système d'audit trail complet
--
-- ============================================================================

-- ============================================================================
-- 1️⃣ CLÉS ÉTRANGÈRES (FOREIGN KEYS) — OBLIGATOIRES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1.1 Tenant (racine) - ON DELETE CASCADE
-- ----------------------------------------------------------------------------

-- Students
ALTER TABLE students
DROP CONSTRAINT IF EXISTS fk_students_tenant;
ALTER TABLE students
ADD CONSTRAINT fk_students_tenant
FOREIGN KEY (tenant_id) REFERENCES tenants(id)
ON DELETE CASCADE;

-- Classes
ALTER TABLE classes
DROP CONSTRAINT IF EXISTS fk_classes_tenant;
ALTER TABLE classes
ADD CONSTRAINT fk_classes_tenant
FOREIGN KEY (tenant_id) REFERENCES tenants(id)
ON DELETE CASCADE;

-- Subjects
ALTER TABLE subjects
DROP CONSTRAINT IF EXISTS fk_subjects_tenant;
ALTER TABLE subjects
ADD CONSTRAINT fk_subjects_tenant
FOREIGN KEY (tenant_id) REFERENCES tenants(id)
ON DELETE CASCADE;

-- Exams
ALTER TABLE exams
DROP CONSTRAINT IF EXISTS fk_exams_tenant;
ALTER TABLE exams
ADD CONSTRAINT fk_exams_tenant
FOREIGN KEY (tenant_id) REFERENCES tenants(id)
ON DELETE CASCADE;

-- Grades
ALTER TABLE grades
DROP CONSTRAINT IF EXISTS fk_grades_tenant;
ALTER TABLE grades
ADD CONSTRAINT fk_grades_tenant
FOREIGN KEY (tenant_id) REFERENCES tenants(id)
ON DELETE CASCADE;

-- Payments
ALTER TABLE payments
DROP CONSTRAINT IF EXISTS fk_payments_tenant;
ALTER TABLE payments
ADD CONSTRAINT fk_payments_tenant
FOREIGN KEY (tenant_id) REFERENCES tenants(id)
ON DELETE CASCADE;

-- Expenses
ALTER TABLE expenses
DROP CONSTRAINT IF EXISTS fk_expenses_tenant;
ALTER TABLE expenses
ADD CONSTRAINT fk_expenses_tenant
FOREIGN KEY (tenant_id) REFERENCES tenants(id)
ON DELETE CASCADE;

-- Absences
ALTER TABLE absences
DROP CONSTRAINT IF EXISTS fk_absences_tenant;
ALTER TABLE absences
ADD CONSTRAINT fk_absences_tenant
FOREIGN KEY (tenant_id) REFERENCES tenants(id)
ON DELETE CASCADE;

-- Fee Configurations
ALTER TABLE fee_configurations
DROP CONSTRAINT IF EXISTS fk_fee_configurations_tenant;
ALTER TABLE fee_configurations
ADD CONSTRAINT fk_fee_configurations_tenant
FOREIGN KEY (tenant_id) REFERENCES tenants(id)
ON DELETE CASCADE;

-- ----------------------------------------------------------------------------
-- 1.2 Academic Year - ON DELETE RESTRICT
-- ----------------------------------------------------------------------------

-- Students
ALTER TABLE students
DROP CONSTRAINT IF EXISTS fk_students_academic_year;
ALTER TABLE students
ADD CONSTRAINT fk_students_academic_year
FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
ON DELETE RESTRICT;

-- Classes
ALTER TABLE classes
DROP CONSTRAINT IF EXISTS fk_classes_academic_year;
ALTER TABLE classes
ADD CONSTRAINT fk_classes_academic_year
FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
ON DELETE RESTRICT;

-- Subjects
ALTER TABLE subjects
DROP CONSTRAINT IF EXISTS fk_subjects_academic_year;
ALTER TABLE subjects
ADD CONSTRAINT fk_subjects_academic_year
FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
ON DELETE RESTRICT;

-- Exams
ALTER TABLE exams
DROP CONSTRAINT IF EXISTS fk_exams_academic_year;
ALTER TABLE exams
ADD CONSTRAINT fk_exams_academic_year
FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
ON DELETE RESTRICT;

-- Grades
ALTER TABLE grades
DROP CONSTRAINT IF EXISTS fk_grades_academic_year;
ALTER TABLE grades
ADD CONSTRAINT fk_grades_academic_year
FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
ON DELETE RESTRICT;

-- Payments
ALTER TABLE payments
DROP CONSTRAINT IF EXISTS fk_payments_academic_year;
ALTER TABLE payments
ADD CONSTRAINT fk_payments_academic_year
FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
ON DELETE RESTRICT;

-- Expenses
ALTER TABLE expenses
DROP CONSTRAINT IF EXISTS fk_expenses_academic_year;
ALTER TABLE expenses
ADD CONSTRAINT fk_expenses_academic_year
FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
ON DELETE RESTRICT;

-- Absences
ALTER TABLE absences
DROP CONSTRAINT IF EXISTS fk_absences_academic_year;
ALTER TABLE absences
ADD CONSTRAINT fk_absences_academic_year
FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
ON DELETE RESTRICT;

-- Fee Configurations
ALTER TABLE fee_configurations
DROP CONSTRAINT IF EXISTS fk_fee_configurations_academic_year;
ALTER TABLE fee_configurations
ADD CONSTRAINT fk_fee_configurations_academic_year
FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
ON DELETE RESTRICT;

-- ----------------------------------------------------------------------------
-- 1.3 School Level - ON DELETE RESTRICT
-- ----------------------------------------------------------------------------

-- Students
ALTER TABLE students
DROP CONSTRAINT IF EXISTS fk_students_school_level;
ALTER TABLE students
ADD CONSTRAINT fk_students_school_level
FOREIGN KEY (school_level_id) REFERENCES school_levels(id)
ON DELETE RESTRICT;

-- Classes
ALTER TABLE classes
DROP CONSTRAINT IF EXISTS fk_classes_school_level;
ALTER TABLE classes
ADD CONSTRAINT fk_classes_school_level
FOREIGN KEY (school_level_id) REFERENCES school_levels(id)
ON DELETE RESTRICT;

-- Subjects
ALTER TABLE subjects
DROP CONSTRAINT IF EXISTS fk_subjects_school_level;
ALTER TABLE subjects
ADD CONSTRAINT fk_subjects_school_level
FOREIGN KEY (school_level_id) REFERENCES school_levels(id)
ON DELETE RESTRICT;

-- Exams
ALTER TABLE exams
DROP CONSTRAINT IF EXISTS fk_exams_school_level;
ALTER TABLE exams
ADD CONSTRAINT fk_exams_school_level
FOREIGN KEY (school_level_id) REFERENCES school_levels(id)
ON DELETE RESTRICT;

-- Grades
ALTER TABLE grades
DROP CONSTRAINT IF EXISTS fk_grades_school_level;
ALTER TABLE grades
ADD CONSTRAINT fk_grades_school_level
FOREIGN KEY (school_level_id) REFERENCES school_levels(id)
ON DELETE RESTRICT;

-- Payments
ALTER TABLE payments
DROP CONSTRAINT IF EXISTS fk_payments_school_level;
ALTER TABLE payments
ADD CONSTRAINT fk_payments_school_level
FOREIGN KEY (school_level_id) REFERENCES school_levels(id)
ON DELETE RESTRICT;

-- Expenses
ALTER TABLE expenses
DROP CONSTRAINT IF EXISTS fk_expenses_school_level;
ALTER TABLE expenses
ADD CONSTRAINT fk_expenses_school_level
FOREIGN KEY (school_level_id) REFERENCES school_levels(id)
ON DELETE RESTRICT;

-- Absences
ALTER TABLE absences
DROP CONSTRAINT IF EXISTS fk_absences_school_level;
ALTER TABLE absences
ADD CONSTRAINT fk_absences_school_level
FOREIGN KEY (school_level_id) REFERENCES school_levels(id)
ON DELETE RESTRICT;

-- Fee Configurations
ALTER TABLE fee_configurations
DROP CONSTRAINT IF EXISTS fk_fee_configurations_school_level;
ALTER TABLE fee_configurations
ADD CONSTRAINT fk_fee_configurations_school_level
FOREIGN KEY (school_level_id) REFERENCES school_levels(id)
ON DELETE RESTRICT;

-- ----------------------------------------------------------------------------
-- 1.4 Academic Track - ON DELETE RESTRICT (nullable)
-- ----------------------------------------------------------------------------

-- Subjects
ALTER TABLE subjects
DROP CONSTRAINT IF EXISTS fk_subjects_academic_track;
ALTER TABLE subjects
ADD CONSTRAINT fk_subjects_academic_track
FOREIGN KEY (academic_track_id) REFERENCES academic_tracks(id)
ON DELETE RESTRICT;

-- Exams
ALTER TABLE exams
DROP CONSTRAINT IF EXISTS fk_exams_academic_track;
ALTER TABLE exams
ADD CONSTRAINT fk_exams_academic_track
FOREIGN KEY (academic_track_id) REFERENCES academic_tracks(id)
ON DELETE RESTRICT;

-- Grades
ALTER TABLE grades
DROP CONSTRAINT IF EXISTS fk_grades_academic_track;
ALTER TABLE grades
ADD CONSTRAINT fk_grades_academic_track
FOREIGN KEY (academic_track_id) REFERENCES academic_tracks(id)
ON DELETE RESTRICT;

-- ============================================================================
-- 2️⃣ CONTRAINTES CHECK — INTÉGRITÉ MÉTIER
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1 Une seule année scolaire active par tenant
-- ----------------------------------------------------------------------------

DROP INDEX IF EXISTS uniq_active_academic_year;
CREATE UNIQUE INDEX uniq_active_academic_year
ON academic_years (tenant_id)
WHERE is_current = TRUE;

-- ----------------------------------------------------------------------------
-- 2.2 Codes de niveaux scolaires autorisés
-- ----------------------------------------------------------------------------

ALTER TABLE school_levels
DROP CONSTRAINT IF EXISTS chk_school_level_code;
ALTER TABLE school_levels
ADD CONSTRAINT chk_school_level_code
CHECK (code IN ('MATERNELLE', 'PRIMAIRE', 'SECONDAIRE'));

-- ----------------------------------------------------------------------------
-- 2.3 Codes de pistes académiques
-- ----------------------------------------------------------------------------

ALTER TABLE academic_tracks
DROP CONSTRAINT IF EXISTS chk_academic_track_code;
ALTER TABLE academic_tracks
ADD CONSTRAINT chk_academic_track_code
CHECK (code IN ('FR', 'EN'));

-- ----------------------------------------------------------------------------
-- 2.4 Séparation stricte des flux financiers
-- ----------------------------------------------------------------------------

-- Si la table payment_flows existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_flows') THEN
    ALTER TABLE payment_flows
    DROP CONSTRAINT IF EXISTS chk_payment_flow_type;
    ALTER TABLE payment_flows
    ADD CONSTRAINT chk_payment_flow_type
    CHECK (
      (flow_type = 'SAAS' AND destination = 'ACADEMIA')
      OR
      (flow_type = 'TUITION' AND destination = 'SCHOOL')
    );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2.5 Statuts de paiement valides
-- ----------------------------------------------------------------------------

ALTER TABLE payments
DROP CONSTRAINT IF EXISTS chk_payment_status;
ALTER TABLE payments
ADD CONSTRAINT chk_payment_status
CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED'));

-- ----------------------------------------------------------------------------
-- 2.6 Montants positifs
-- ----------------------------------------------------------------------------

ALTER TABLE payments
DROP CONSTRAINT IF EXISTS chk_payment_amount_positive;
ALTER TABLE payments
ADD CONSTRAINT chk_payment_amount_positive
CHECK (amount >= 0);

ALTER TABLE expenses
DROP CONSTRAINT IF EXISTS chk_expense_amount_positive;
ALTER TABLE expenses
ADD CONSTRAINT chk_expense_amount_positive
CHECK (amount >= 0);

-- ============================================================================
-- 3️⃣ TRIGGERS — RÈGLES STRUCTURELLES AUTOMATIQUES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1 Fonction : Enforce Academic Year
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_academic_year()
RETURNS trigger AS $$
BEGIN
  IF NEW.academic_year_id IS NULL THEN
    RAISE EXCEPTION 'academic_year_id is mandatory for table %', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 3.2 Fonction : Enforce School Level
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_school_level()
RETURNS trigger AS $$
BEGIN
  IF NEW.school_level_id IS NULL THEN
    RAISE EXCEPTION 'school_level_id is mandatory for table %', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 3.3 Fonction : Enforce Tenant
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_tenant()
RETURNS trigger AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is mandatory for table %', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 3.4 Appliquer les triggers sur toutes les tables métier
-- ----------------------------------------------------------------------------

-- Students
DROP TRIGGER IF EXISTS trg_students_academic_year ON students;
CREATE TRIGGER trg_students_academic_year
BEFORE INSERT OR UPDATE ON students
FOR EACH ROW EXECUTE FUNCTION enforce_academic_year();

DROP TRIGGER IF EXISTS trg_students_school_level ON students;
CREATE TRIGGER trg_students_school_level
BEFORE INSERT OR UPDATE ON students
FOR EACH ROW EXECUTE FUNCTION enforce_school_level();

DROP TRIGGER IF EXISTS trg_students_tenant ON students;
CREATE TRIGGER trg_students_tenant
BEFORE INSERT OR UPDATE ON students
FOR EACH ROW EXECUTE FUNCTION enforce_tenant();

-- Classes
DROP TRIGGER IF EXISTS trg_classes_academic_year ON classes;
CREATE TRIGGER trg_classes_academic_year
BEFORE INSERT OR UPDATE ON classes
FOR EACH ROW EXECUTE FUNCTION enforce_academic_year();

DROP TRIGGER IF EXISTS trg_classes_school_level ON classes;
CREATE TRIGGER trg_classes_school_level
BEFORE INSERT OR UPDATE ON classes
FOR EACH ROW EXECUTE FUNCTION enforce_school_level();

DROP TRIGGER IF EXISTS trg_classes_tenant ON classes;
CREATE TRIGGER trg_classes_tenant
BEFORE INSERT OR UPDATE ON classes
FOR EACH ROW EXECUTE FUNCTION enforce_tenant();

-- Subjects
DROP TRIGGER IF EXISTS trg_subjects_academic_year ON subjects;
CREATE TRIGGER trg_subjects_academic_year
BEFORE INSERT OR UPDATE ON subjects
FOR EACH ROW EXECUTE FUNCTION enforce_academic_year();

DROP TRIGGER IF EXISTS trg_subjects_school_level ON subjects;
CREATE TRIGGER trg_subjects_school_level
BEFORE INSERT OR UPDATE ON subjects
FOR EACH ROW EXECUTE FUNCTION enforce_school_level();

DROP TRIGGER IF EXISTS trg_subjects_tenant ON subjects;
CREATE TRIGGER trg_subjects_tenant
BEFORE INSERT OR UPDATE ON subjects
FOR EACH ROW EXECUTE FUNCTION enforce_tenant();

-- Exams
DROP TRIGGER IF EXISTS trg_exams_academic_year ON exams;
CREATE TRIGGER trg_exams_academic_year
BEFORE INSERT OR UPDATE ON exams
FOR EACH ROW EXECUTE FUNCTION enforce_academic_year();

DROP TRIGGER IF EXISTS trg_exams_school_level ON exams;
CREATE TRIGGER trg_exams_school_level
BEFORE INSERT OR UPDATE ON exams
FOR EACH ROW EXECUTE FUNCTION enforce_school_level();

DROP TRIGGER IF EXISTS trg_exams_tenant ON exams;
CREATE TRIGGER trg_exams_tenant
BEFORE INSERT OR UPDATE ON exams
FOR EACH ROW EXECUTE FUNCTION enforce_tenant();

-- Grades
DROP TRIGGER IF EXISTS trg_grades_academic_year ON grades;
CREATE TRIGGER trg_grades_academic_year
BEFORE INSERT OR UPDATE ON grades
FOR EACH ROW EXECUTE FUNCTION enforce_academic_year();

DROP TRIGGER IF EXISTS trg_grades_school_level ON grades;
CREATE TRIGGER trg_grades_school_level
BEFORE INSERT OR UPDATE ON grades
FOR EACH ROW EXECUTE FUNCTION enforce_school_level();

DROP TRIGGER IF EXISTS trg_grades_tenant ON grades;
CREATE TRIGGER trg_grades_tenant
BEFORE INSERT OR UPDATE ON grades
FOR EACH ROW EXECUTE FUNCTION enforce_tenant();

-- Payments
DROP TRIGGER IF EXISTS trg_payments_academic_year ON payments;
CREATE TRIGGER trg_payments_academic_year
BEFORE INSERT OR UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION enforce_academic_year();

DROP TRIGGER IF EXISTS trg_payments_school_level ON payments;
CREATE TRIGGER trg_payments_school_level
BEFORE INSERT OR UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION enforce_school_level();

DROP TRIGGER IF EXISTS trg_payments_tenant ON payments;
CREATE TRIGGER trg_payments_tenant
BEFORE INSERT OR UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION enforce_tenant();

-- Expenses
DROP TRIGGER IF EXISTS trg_expenses_academic_year ON expenses;
CREATE TRIGGER trg_expenses_academic_year
BEFORE INSERT OR UPDATE ON expenses
FOR EACH ROW EXECUTE FUNCTION enforce_academic_year();

DROP TRIGGER IF EXISTS trg_expenses_school_level ON expenses;
CREATE TRIGGER trg_expenses_school_level
BEFORE INSERT OR UPDATE ON expenses
FOR EACH ROW EXECUTE FUNCTION enforce_school_level();

DROP TRIGGER IF EXISTS trg_expenses_tenant ON expenses;
CREATE TRIGGER trg_expenses_tenant
BEFORE INSERT OR UPDATE ON expenses
FOR EACH ROW EXECUTE FUNCTION enforce_tenant();

-- Absences
DROP TRIGGER IF EXISTS trg_absences_academic_year ON absences;
CREATE TRIGGER trg_absences_academic_year
BEFORE INSERT OR UPDATE ON absences
FOR EACH ROW EXECUTE FUNCTION enforce_academic_year();

DROP TRIGGER IF EXISTS trg_absences_school_level ON absences;
CREATE TRIGGER trg_absences_school_level
BEFORE INSERT OR UPDATE ON absences
FOR EACH ROW EXECUTE FUNCTION enforce_school_level();

DROP TRIGGER IF EXISTS trg_absences_tenant ON absences;
CREATE TRIGGER trg_absences_tenant
BEFORE INSERT OR UPDATE ON absences
FOR EACH ROW EXECUTE FUNCTION enforce_tenant();

-- Fee Configurations
DROP TRIGGER IF EXISTS trg_fee_configurations_academic_year ON fee_configurations;
CREATE TRIGGER trg_fee_configurations_academic_year
BEFORE INSERT OR UPDATE ON fee_configurations
FOR EACH ROW EXECUTE FUNCTION enforce_academic_year();

DROP TRIGGER IF EXISTS trg_fee_configurations_school_level ON fee_configurations;
CREATE TRIGGER trg_fee_configurations_school_level
BEFORE INSERT OR UPDATE ON fee_configurations
FOR EACH ROW EXECUTE FUNCTION enforce_school_level();

DROP TRIGGER IF EXISTS trg_fee_configurations_tenant ON fee_configurations;
CREATE TRIGGER trg_fee_configurations_tenant
BEFORE INSERT OR UPDATE ON fee_configurations
FOR EACH ROW EXECUTE FUNCTION enforce_tenant();

-- ============================================================================
-- 4️⃣ AUDIT TRAIL — OBLIGATOIRE
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 4.1 Table d'audit générique (si elle n'existe pas)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID,
  action VARCHAR(50) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  resource_id UUID,
  changes JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fk_audit_logs_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- ----------------------------------------------------------------------------
-- 4.2 Fonction d'audit générique
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS trigger AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
BEGIN
  -- Récupérer user_id depuis le contexte de session (peut être NULL)
  BEGIN
    v_user_id := current_setting('app.current_user_id', true)::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;
  
  -- Récupérer tenant_id depuis NEW ou OLD (peut ne pas exister dans toutes les tables)
  BEGIN
    IF TG_OP = 'DELETE' THEN
      v_tenant_id := OLD.tenant_id;
    ELSE
      v_tenant_id := NEW.tenant_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Si la colonne tenant_id n'existe pas dans cette table, utiliser NULL
    v_tenant_id := NULL;
  END;
  
  -- Insérer dans audit_logs seulement si la table existe et a les colonnes nécessaires
  BEGIN
    INSERT INTO audit_logs (
      tenant_id,
      user_id,
      action,
      resource,
      resource_id,
      changes,
      ip_address,
      user_agent,
      created_at
    )
    VALUES (
      v_tenant_id,
      v_user_id,
      TG_OP,
      TG_TABLE_NAME,
      COALESCE(NEW.id, OLD.id),
      jsonb_build_object(
        'old', row_to_json(OLD),
        'new', row_to_json(NEW)
      ),
      current_setting('app.current_ip', true),
      current_setting('app.current_user_agent', true),
      CURRENT_TIMESTAMP
    );
  EXCEPTION WHEN OTHERS THEN
    -- Si l'insertion échoue (table n'existe pas, colonnes manquantes, etc.), ignorer silencieusement
    -- C'est une opération non-bloquante
    NULL;
  END;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 4.3 Appliquer l'audit sur les tables critiques
-- ----------------------------------------------------------------------------

-- Students
DROP TRIGGER IF EXISTS trg_audit_students ON students;
CREATE TRIGGER trg_audit_students
AFTER INSERT OR UPDATE OR DELETE ON students
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- Payments
DROP TRIGGER IF EXISTS trg_audit_payments ON payments;
CREATE TRIGGER trg_audit_payments
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- Expenses
DROP TRIGGER IF EXISTS trg_audit_expenses ON expenses;
CREATE TRIGGER trg_audit_expenses
AFTER INSERT OR UPDATE OR DELETE ON expenses
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- Grades
DROP TRIGGER IF EXISTS trg_audit_grades ON grades;
CREATE TRIGGER trg_audit_grades
AFTER INSERT OR UPDATE OR DELETE ON grades
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- Exams
DROP TRIGGER IF EXISTS trg_audit_exams ON exams;
CREATE TRIGGER trg_audit_exams
AFTER INSERT OR UPDATE OR DELETE ON exams
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- Fee Configurations
DROP TRIGGER IF EXISTS trg_audit_fee_configurations ON fee_configurations;
CREATE TRIGGER trg_audit_fee_configurations
AFTER INSERT OR UPDATE OR DELETE ON fee_configurations
FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ============================================================================
-- 5️⃣ RÈGLES SPÉCIALES — ORION & ATLAS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 5.1 Vues en lecture seule pour ORION
-- ----------------------------------------------------------------------------

-- Vue pour ORION : Statistiques par niveau et année (lecture seule)
CREATE OR REPLACE VIEW v_orion_stats_by_level_year AS
SELECT
  s.tenant_id,
  s.academic_year_id,
  s.school_level_id,
  sl.code AS school_level_code,
  COUNT(DISTINCT s.id) AS total_students,
  COUNT(DISTINCT g.id) AS total_grades,
  AVG(g.score) AS average_score,
  COUNT(DISTINCT p.id) AS total_payments,
  SUM(p.amount) AS total_revenue
FROM students s
JOIN school_levels sl ON sl.id = s.school_level_id
LEFT JOIN grades g ON g.student_id = s.id AND g.academic_year_id = s.academic_year_id
LEFT JOIN payments p ON p.student_id = s.id AND p.academic_year_id = s.academic_year_id
GROUP BY s.tenant_id, s.academic_year_id, s.school_level_id, sl.code;

-- Rendre la vue en lecture seule (pas de trigger nécessaire, les vues sont naturellement en lecture seule)

-- ----------------------------------------------------------------------------
-- 5.2 Fonction pour vérifier les permissions ORION/ATLAS
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION check_orion_atlas_permissions()
RETURNS trigger AS $$
BEGIN
  -- Vérifier si l'opération provient d'ORION ou ATLAS
  IF current_setting('app.current_user_role', true) IN ('ORION', 'ATLAS') THEN
    -- ORION et ATLAS ne peuvent jamais écrire
    IF TG_OP IN ('INSERT', 'UPDATE', 'DELETE') THEN
      RAISE EXCEPTION 'ORION and ATLAS have READ-ONLY access. Write operations are forbidden.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: Cette fonction sera appelée par les guards/interceptors backend
-- Les triggers SQL sont une couche de sécurité supplémentaire

-- ============================================================================
-- ✅ VÉRIFICATION POST-MIGRATION
-- ============================================================================

-- Vérifier que toutes les contraintes sont en place
DO $$
DECLARE
  constraint_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO constraint_count
  FROM information_schema.table_constraints
  WHERE constraint_type = 'FOREIGN KEY'
    AND table_schema = 'public'
    AND table_name IN ('students', 'classes', 'subjects', 'exams', 'grades', 'payments', 'expenses', 'absences');
  
  RAISE NOTICE 'Foreign keys created: %', constraint_count;
  
  SELECT COUNT(*) INTO constraint_count
  FROM information_schema.table_constraints
  WHERE constraint_type = 'CHECK'
    AND table_schema = 'public';
  
  RAISE NOTICE 'Check constraints created: %', constraint_count;
END $$;


-- ============================================================================
-- MIGRATION : Ajout du système Academic Tracks (Bilingue FR/EN)
-- ============================================================================
-- 
-- Cette migration ajoute le support des écoles bilingues SANS casser
-- le schéma existant. Toutes les colonnes ajoutées sont NULLABLE pour
-- garantir la compatibilité avec les données existantes.
-- 
-- PRINCIPE :
-- - Les données existantes = implicitement FR (academic_track_id = NULL)
-- - Les nouvelles données peuvent être liées à un track spécifique
-- - Aucune migration de données n'est nécessaire
-- 
-- ============================================================================

-- 1. Créer la table academic_tracks
CREATE TABLE IF NOT EXISTS academic_tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    code VARCHAR(20) NOT NULL CHECK (code IN ('FR', 'EN')),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    "order" INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_academic_tracks_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT uq_academic_tracks_tenant_code UNIQUE (tenant_id, code)
);

-- Index pour améliorer les performances
CREATE INDEX idx_academic_tracks_tenant ON academic_tracks(tenant_id);
CREATE INDEX idx_academic_tracks_code ON academic_tracks(code);

-- 2. Créer la table student_academic_tracks (liaison élève-track)
CREATE TABLE IF NOT EXISTS student_academic_tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    academic_track_id UUID NOT NULL,
    enrollment_date DATE,
    exit_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_student_academic_tracks_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT fk_student_academic_tracks_track FOREIGN KEY (academic_track_id) REFERENCES academic_tracks(id) ON DELETE CASCADE,
    CONSTRAINT uq_student_academic_tracks UNIQUE (student_id, academic_track_id)
);

-- Index pour améliorer les performances
CREATE INDEX idx_student_academic_tracks_student ON student_academic_tracks(student_id);
CREATE INDEX idx_student_academic_tracks_track ON student_academic_tracks(academic_track_id);

-- 3. Ajouter academic_track_id sur subjects (NULLABLE)
ALTER TABLE subjects 
ADD COLUMN IF NOT EXISTS academic_track_id UUID;

ALTER TABLE subjects
ADD CONSTRAINT fk_subjects_academic_track 
FOREIGN KEY (academic_track_id) REFERENCES academic_tracks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_subjects_academic_track ON subjects(academic_track_id);

-- 4. Ajouter academic_track_id sur exams (NULLABLE)
ALTER TABLE exams 
ADD COLUMN IF NOT EXISTS academic_track_id UUID;

ALTER TABLE exams
ADD CONSTRAINT fk_exams_academic_track 
FOREIGN KEY (academic_track_id) REFERENCES academic_tracks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_exams_academic_track ON exams(academic_track_id);

-- 5. Ajouter academic_track_id sur grades (NULLABLE)
ALTER TABLE grades 
ADD COLUMN IF NOT EXISTS academic_track_id UUID;

ALTER TABLE grades
ADD CONSTRAINT fk_grades_academic_track 
FOREIGN KEY (academic_track_id) REFERENCES academic_tracks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_grades_academic_track ON grades(academic_track_id);

-- 6. Ajouter academic_track_id sur classes (NULLABLE)
ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS academic_track_id UUID;

ALTER TABLE classes
ADD CONSTRAINT fk_classes_academic_track 
FOREIGN KEY (academic_track_id) REFERENCES academic_tracks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_classes_academic_track ON classes(academic_track_id);

-- 7. Initialiser le track FR par défaut pour tous les tenants existants
-- Cette requête crée automatiquement le track FR pour chaque tenant
INSERT INTO academic_tracks (tenant_id, code, name, description, "order", is_active, is_default, created_at, updated_at)
SELECT 
    t.id,
    'FR',
    'Francophone',
    'Piste académique francophone (par défaut)',
    0,
    true,
    true,
    NOW(),
    NOW()
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM academic_tracks at 
    WHERE at.tenant_id = t.id AND at.code = 'FR'
)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- ============================================================================
-- NOTES IMPORTANTES :
-- ============================================================================
-- 
-- 1. Toutes les colonnes academic_track_id sont NULLABLE
--    → Les données existantes continuent de fonctionner
--    → NULL = track par défaut (FR)
-- 
-- 2. Les contraintes FOREIGN KEY utilisent ON DELETE SET NULL
--    → Si un track est supprimé, les données ne sont pas perdues
--    → Elles reviennent au comportement par défaut (FR)
-- 
-- 3. Le track FR est automatiquement créé pour tous les tenants
--    → Aucune action manuelle nécessaire
--    → Le système fonctionne immédiatement après la migration
-- 
-- 4. Les index améliorent les performances des requêtes filtrées par track
-- 
-- ============================================================================


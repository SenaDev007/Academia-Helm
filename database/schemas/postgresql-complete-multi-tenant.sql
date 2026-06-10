-- ============================================================================
-- ACADEMIA HUB - SCHÉMA POSTGRESQL MULTI-TENANT COMPLET
-- ============================================================================
-- Architecture SaaS multi-tenant robuste avec isolation stricte par tenant
-- Migration SQLite → PostgreSQL avec toutes les tables métier
-- + Colonnes SaaS obligatoires (tenant_id, created_at, updated_at, created_by)
-- ============================================================================
-- Auteur: Architecture Database Senior
-- Date: 2024
-- Version: 1.0.0
-- ============================================================================

-- ============================================================================
-- EXTENSIONS POSTGRESQL
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Pour recherches textuelles avancées
CREATE EXTENSION IF NOT EXISTS "btree_gin"; -- Pour index GIN sur JSONB

-- ============================================================================
-- FONCTIONS UTILITAIRES
-- ============================================================================

-- Fonction pour mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir le tenant_id depuis le contexte (RLS)
CREATE OR REPLACE FUNCTION get_current_tenant_id() RETURNS UUID AS $$
BEGIN
    RETURN current_setting('app.current_tenant_id', TRUE)::UUID;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- TABLES SAAS (Gestion Multi-tenant)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: countries (Pays)
-- ----------------------------------------------------------------------------
CREATE TABLE countries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Codes ISO
    code VARCHAR(2) UNIQUE NOT NULL,
    code3 VARCHAR(3),
    numeric_code VARCHAR(10),
    
    -- Informations
    name VARCHAR(255) NOT NULL,
    currency_code VARCHAR(10),
    currency_symbol VARCHAR(10),
    phone_prefix VARCHAR(10),
    flag_emoji TEXT,
    
    -- Configuration
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT countries_code_unique UNIQUE (code)
);

CREATE INDEX idx_countries_code ON countries(code);
CREATE INDEX idx_countries_default ON countries(is_default) WHERE is_default = TRUE;
CREATE INDEX idx_countries_active ON countries(is_active) WHERE is_active = TRUE;

-- ----------------------------------------------------------------------------
-- Table: tenants (Organisations/Écoles)
-- ----------------------------------------------------------------------------
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Informations de base
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    abbreviation VARCHAR(50),
    slug VARCHAR(100) UNIQUE,
    
    -- Lien pays (OBLIGATOIRE)
    country_id UUID NOT NULL REFERENCES countries(id) ON DELETE RESTRICT,
    
    -- Statut
    status VARCHAR(20) DEFAULT 'active' 
        CHECK (status IN ('active', 'suspended', 'cancelled')),
    
    -- Informations de contact
    primary_email VARCHAR(255),
    primary_phone VARCHAR(50),
    address TEXT,
    website VARCHAR(255),
    
    -- Configuration
    settings JSONB DEFAULT '{}',
    subscription_plan VARCHAR(50) DEFAULT 'free',
    subscription_status VARCHAR(20) DEFAULT 'active',
    schema_name VARCHAR(100), -- Pour multi-schema si nécessaire
    
    -- Métadonnées
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE NULL,
    
    CONSTRAINT tenants_subdomain_unique UNIQUE (subdomain),
    CONSTRAINT tenants_slug_unique UNIQUE (slug)
);

CREATE INDEX idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_country ON tenants(country_id);
CREATE INDEX idx_tenants_active ON tenants(status) WHERE status = 'active';

-- ----------------------------------------------------------------------------
-- Table: school_levels (Niveaux scolaires - Dimension structurante)
-- ----------------------------------------------------------------------------
CREATE TABLE school_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Type de niveau (enum)
    type VARCHAR(50) NOT NULL CHECK (type IN ('MATERNELLE', 'PRIMAIRE', 'SECONDAIRE')),
    
    -- Informations
    name VARCHAR(255) NOT NULL,
    abbreviation VARCHAR(50),
    description TEXT,
    
    -- Ordre d'affichage
    "order" INTEGER DEFAULT 0,
    
    -- Statut
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Métadonnées (configuration spécifique par niveau)
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Contraintes
    CONSTRAINT school_levels_tenant_type_unique UNIQUE (tenant_id, type)
);

CREATE INDEX idx_school_levels_tenant ON school_levels(tenant_id);
CREATE INDEX idx_school_levels_type ON school_levels(tenant_id, type);
CREATE INDEX idx_school_levels_active ON school_levels(tenant_id, is_active) WHERE is_active = TRUE;

-- ----------------------------------------------------------------------------
-- Table: modules (Modules fonctionnels indépendants)
-- ----------------------------------------------------------------------------
CREATE TABLE modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Type de module (enum)
    type VARCHAR(50) NOT NULL CHECK (type IN (
        -- Modules principaux
        'SCOLARITE', 'FINANCES', 'RH', 'PEDAGOGIE', 'EXAMENS', 'COMMUNICATION',
        -- Modules supplémentaires
        'BIBLIOTHEQUE', 'LABORATOIRE', 'TRANSPORT', 'CANTINE', 
        'INFIRMERIE', 'QHSE', 'EDUCAST', 'BOUTIQUE'
    )),
    
    -- Informations
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100),
    description TEXT,
    
    -- Association niveau scolaire (OBLIGATOIRE)
    school_level_id UUID NOT NULL REFERENCES school_levels(id) ON DELETE RESTRICT,
    
    -- Statut et activation
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    is_enabled BOOLEAN DEFAULT TRUE,
    
    -- Configuration
    configuration JSONB DEFAULT '{}',
    permissions JSONB DEFAULT '[]', -- Permissions requises pour accéder
    dependencies JSONB DEFAULT '[]', -- Modules dont ce module dépend
    
    -- Interface
    "order" INTEGER DEFAULT 0,
    route VARCHAR(255),
    icon VARCHAR(100),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Contraintes
    CONSTRAINT modules_tenant_type_school_level_unique 
        UNIQUE (tenant_id, type, school_level_id)
);

CREATE INDEX idx_modules_tenant ON modules(tenant_id);
CREATE INDEX idx_modules_school_level ON modules(tenant_id, school_level_id);
CREATE INDEX idx_modules_type ON modules(tenant_id, type);
CREATE INDEX idx_modules_enabled ON modules(tenant_id, school_level_id, is_enabled) 
    WHERE is_enabled = TRUE AND status = 'active';

-- ----------------------------------------------------------------------------
-- Table: users (Utilisateurs système)
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Authentification
    email VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    
    -- Informations personnelles
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),
    avatar_url TEXT,
    
    -- Statut
    status VARCHAR(20) DEFAULT 'active' 
        CHECK (status IN ('active', 'inactive', 'suspended')),
    email_verified BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    
    -- Métadonnées
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE NULL,
    
    -- Contraintes
    CONSTRAINT users_email_tenant_unique UNIQUE (email, tenant_id),
    CONSTRAINT users_username_tenant_unique UNIQUE (username, tenant_id)
);

CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_status ON users(tenant_id, status);
CREATE INDEX idx_users_active ON users(tenant_id, status) WHERE status = 'active';

-- ----------------------------------------------------------------------------
-- Table: roles (Rôles système)
-- ----------------------------------------------------------------------------
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT roles_name_tenant_unique UNIQUE (name, tenant_id)
);

CREATE INDEX idx_roles_tenant_id ON roles(tenant_id);
CREATE INDEX idx_roles_system ON roles(is_system_role) WHERE is_system_role = TRUE;

-- ----------------------------------------------------------------------------
-- Table: permissions (Permissions granulaires)
-- ----------------------------------------------------------------------------
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_permissions_resource ON permissions(resource);
CREATE INDEX idx_permissions_action ON permissions(action);
CREATE INDEX idx_permissions_resource_action ON permissions(resource, action);

-- ----------------------------------------------------------------------------
-- Table: role_permissions (Assignation permissions → rôles)
-- ----------------------------------------------------------------------------
CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    
    PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);

-- ----------------------------------------------------------------------------
-- Table: user_roles (Assignation rôles → utilisateurs)
-- ----------------------------------------------------------------------------
CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    assigned_by UUID REFERENCES users(id),
    
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);

-- ----------------------------------------------------------------------------
-- Table: audit_logs (Audit complet des actions)
-- ----------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    
    -- Action
    action VARCHAR(50) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    resource_id UUID,
    
    -- Détails
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    
    -- Métadonnées
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource, resource_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at DESC);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================================================
-- TABLES MÉTIER - ACADÉMIQUES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: academic_years (Années académiques)
-- ----------------------------------------------------------------------------
CREATE TABLE academic_years (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN DEFAULT FALSE,
    
    -- Métadonnées SaaS
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    CONSTRAINT academic_years_tenant_name_unique UNIQUE (tenant_id, name),
    CONSTRAINT academic_years_dates_check CHECK (end_date > start_date)
);

CREATE INDEX idx_academic_years_tenant ON academic_years(tenant_id);
CREATE INDEX idx_academic_years_current ON academic_years(tenant_id, is_current) 
    WHERE is_current = TRUE;
CREATE INDEX idx_academic_years_dates ON academic_years(start_date, end_date);

-- ----------------------------------------------------------------------------
-- Table: quarters (Trimestres)
-- ----------------------------------------------------------------------------
CREATE TABLE quarters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    
    name VARCHAR(50) NOT NULL,
    number INTEGER NOT NULL CHECK (number BETWEEN 1 AND 4),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN DEFAULT FALSE,
    
    -- Métadonnées SaaS
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    CONSTRAINT quarters_tenant_academic_year_number_unique 
        UNIQUE (tenant_id, academic_year_id, number),
    CONSTRAINT quarters_dates_check CHECK (end_date > start_date)
);

CREATE INDEX idx_quarters_tenant ON quarters(tenant_id);
CREATE INDEX idx_quarters_academic_year ON quarters(academic_year_id);
CREATE INDEX idx_quarters_current ON quarters(tenant_id, is_current) 
    WHERE is_current = TRUE;

-- ----------------------------------------------------------------------------
-- Table: schools (Écoles)
-- ----------------------------------------------------------------------------
CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    abbreviation VARCHAR(50),
    education_levels TEXT[],
    motto TEXT,
    slogan TEXT,
    address TEXT,
    primary_phone VARCHAR(50),
    secondary_phone VARCHAR(50),
    primary_email VARCHAR(255),
    website VARCHAR(255),
    whatsapp VARCHAR(50),
    logo TEXT,
    primary_color VARCHAR(7) DEFAULT '#3b82f6',
    secondary_color VARCHAR(7) DEFAULT '#10b981',
    founder_name VARCHAR(255),
    director_primary VARCHAR(255),
    director_secondary VARCHAR(255),
    
    -- Métadonnées SaaS
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    CONSTRAINT schools_tenant_unique UNIQUE (tenant_id)
);

CREATE INDEX idx_schools_tenant ON schools(tenant_id);
CREATE INDEX idx_schools_education_levels ON schools USING GIN(education_levels);

-- ============================================================================
-- TABLES MÉTIER - PÉDAGOGIQUES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: classes (Classes)
-- ----------------------------------------------------------------------------
CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Niveau scolaire (OBLIGATOIRE)
    school_level_id UUID NOT NULL REFERENCES school_levels(id) ON DELETE RESTRICT,
    
    name VARCHAR(100) NOT NULL,
    level VARCHAR(50) NOT NULL,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
    capacity INTEGER,
    main_teacher_id UUID, -- Référence vers teachers
    room_id UUID, -- Référence vers rooms
    description TEXT,
    
    -- Métadonnées SaaS
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    CONSTRAINT classes_tenant_name_academic_year_unique 
        UNIQUE (tenant_id, name, academic_year_id)
);

CREATE INDEX idx_classes_tenant ON classes(tenant_id);
CREATE INDEX idx_classes_school_level ON classes(tenant_id, school_level_id);
CREATE INDEX idx_classes_academic_year ON classes(academic_year_id);
CREATE INDEX idx_classes_level ON classes(tenant_id, level);
CREATE INDEX idx_classes_main_teacher ON classes(main_teacher_id);
CREATE INDEX idx_classes_room ON classes(room_id);

-- ----------------------------------------------------------------------------
-- Table: subjects (Matières)
-- ----------------------------------------------------------------------------
CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Niveau scolaire (OBLIGATOIRE)
    school_level_id UUID NOT NULL REFERENCES school_levels(id) ON DELETE RESTRICT,
    
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    level VARCHAR(50) NOT NULL,
    coefficient DECIMAL(3,2) DEFAULT 1.0,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
    
    -- Métadonnées SaaS
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    CONSTRAINT subjects_tenant_code_unique UNIQUE (tenant_id, code)
);

CREATE INDEX idx_subjects_tenant ON subjects(tenant_id);
CREATE INDEX idx_subjects_school_level ON subjects(tenant_id, school_level_id);
CREATE INDEX idx_subjects_level ON subjects(tenant_id, level);
CREATE INDEX idx_subjects_academic_year ON subjects(academic_year_id);
CREATE INDEX idx_subjects_code ON subjects(tenant_id, code);

-- ----------------------------------------------------------------------------
-- Table: students (Élèves)
-- ----------------------------------------------------------------------------
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Niveau scolaire (OBLIGATOIRE)
    school_level_id UUID NOT NULL REFERENCES school_levels(id) ON DELETE RESTRICT,
    
    -- Numéro EducMaster (généré automatiquement)
    educmaster_number VARCHAR(50),
    
    -- Informations personnelles
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other')),
    date_of_birth DATE,
    place_of_birth VARCHAR(255),
    nationality VARCHAR(100),
    
    -- Contact
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    parent_phone VARCHAR(50),
    parent_email VARCHAR(255),
    parent_name VARCHAR(255),
    
    -- Scolarité
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    enrollment_date DATE,
    enrollment_status VARCHAR(50) DEFAULT 'active' 
        CHECK (enrollment_status IN ('active', 'graduated', 'transferred', 'expelled', 'inactive')),
    photo_url TEXT,
    
    -- Documents
    identity_document_type VARCHAR(50),
    identity_document_number VARCHAR(100),
    
    -- Métadonnées
    notes TEXT,
    
    -- Métadonnées SaaS
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    CONSTRAINT students_educmaster_tenant_unique UNIQUE (tenant_id, educmaster_number)
);

CREATE INDEX idx_students_tenant ON students(tenant_id);
CREATE INDEX idx_students_school_level ON students(tenant_id, school_level_id);
CREATE INDEX idx_students_class ON students(tenant_id, class_id);
CREATE INDEX idx_students_educmaster ON students(educmaster_number);
CREATE INDEX idx_students_name ON students(tenant_id, last_name, first_name);
CREATE INDEX idx_students_status ON students(tenant_id, enrollment_status);
CREATE INDEX idx_students_enrollment_date ON students(tenant_id, enrollment_date);
CREATE INDEX idx_students_active ON students(tenant_id, enrollment_status) 
    WHERE enrollment_status = 'active';

-- ----------------------------------------------------------------------------
-- Table: teachers (Enseignants)
-- ----------------------------------------------------------------------------
CREATE TABLE teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Niveau scolaire (OBLIGATOIRE)
    school_level_id UUID NOT NULL REFERENCES school_levels(id) ON DELETE RESTRICT,
    
    matricule VARCHAR(100) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other')),
    date_of_birth DATE,
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    
    -- Professionnel
    department_id UUID, -- Référence vers departments
    position VARCHAR(100),
    specialization TEXT,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
    hire_date DATE,
    contract_type VARCHAR(50) 
        CHECK (contract_type IN ('CDI', 'CDD', 'Stage', 'Freelance', 'Interim')),
    status VARCHAR(50) DEFAULT 'active' 
        CHECK (status IN ('active', 'inactive', 'on-leave', 'terminated', 'retired')),
    
    -- Rémunération
    working_hours INTEGER,
    salary DECIMAL(10,2),
    bank_details TEXT,
    
    -- Contact urgence
    emergency_contact TEXT,
    qualifications TEXT,
    notes TEXT,
    
    -- Métadonnées SaaS
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    CONSTRAINT teachers_tenant_matricule_unique UNIQUE (tenant_id, matricule)
);

CREATE INDEX idx_teachers_tenant ON teachers(tenant_id);
CREATE INDEX idx_teachers_school_level ON teachers(tenant_id, school_level_id);
CREATE INDEX idx_teachers_matricule ON teachers(tenant_id, matricule);
CREATE INDEX idx_teachers_status ON teachers(tenant_id, status);
CREATE INDEX idx_teachers_department ON teachers(tenant_id, department_id);
CREATE INDEX idx_teachers_subject ON teachers(subject_id);
CREATE INDEX idx_teachers_active ON teachers(tenant_id, status) 
    WHERE status = 'active';

-- ----------------------------------------------------------------------------
-- Table: departments (Départements)
-- ----------------------------------------------------------------------------
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    manager_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    
    -- Métadonnées SaaS
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    CONSTRAINT departments_tenant_name_unique UNIQUE (tenant_id, name)
);

CREATE INDEX idx_departments_tenant ON departments(tenant_id);
CREATE INDEX idx_departments_manager ON departments(manager_id);

-- ----------------------------------------------------------------------------
-- Table: rooms (Salles)
-- ----------------------------------------------------------------------------
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    capacity INTEGER,
    equipment JSONB DEFAULT '[]',
    status VARCHAR(50) DEFAULT 'available' 
        CHECK (status IN ('available', 'occupied', 'maintenance', 'reserved')),
    description TEXT,
    
    -- Métadonnées SaaS
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    CONSTRAINT rooms_tenant_name_unique UNIQUE (tenant_id, name)
);

CREATE INDEX idx_rooms_tenant ON rooms(tenant_id);
CREATE INDEX idx_rooms_status ON rooms(tenant_id, status);
CREATE INDEX idx_rooms_type ON rooms(tenant_id, type);
CREATE INDEX idx_rooms_equipment ON rooms USING GIN(equipment);

-- ============================================================================
-- TABLES MÉTIER - PRÉSENCE & DISCIPLINE
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: absences (Absences)
-- ----------------------------------------------------------------------------
CREATE TABLE absences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Niveau scolaire (OBLIGATOIRE)
    school_level_id UUID NOT NULL REFERENCES school_levels(id) ON DELETE RESTRICT,
    
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    is_justified BOOLEAN DEFAULT FALSE,
    justification TEXT,
    justified_by UUID REFERENCES users(id),
    
    -- Métadonnées SaaS
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_absences_tenant ON absences(tenant_id);
CREATE INDEX idx_absences_school_level ON absences(tenant_id, school_level_id);
CREATE INDEX idx_absences_student ON absences(tenant_id, student_id, date);
CREATE INDEX idx_absences_class ON absences(tenant_id, class_id, date);
CREATE INDEX idx_absences_date ON absences(tenant_id, date DESC);
CREATE INDEX idx_absences_justified ON absences(tenant_id, is_justified);

-- ----------------------------------------------------------------------------
-- Table: discipline (Incidents disciplinaires)
-- ----------------------------------------------------------------------------
CREATE TABLE discipline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Niveau scolaire (OBLIGATOIRE)
    school_level_id UUID NOT NULL REFERENCES school_levels(id) ON DELETE RESTRICT,
    
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    incident_date DATE NOT NULL,
    severity VARCHAR(50) CHECK (severity IN ('minor', 'major', 'severe')),
    description TEXT NOT NULL,
    action_taken TEXT,
    reported_by UUID REFERENCES users(id),
    
    -- Métadonnées SaaS
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_discipline_tenant ON discipline(tenant_id);
CREATE INDEX idx_discipline_school_level ON discipline(tenant_id, school_level_id);
CREATE INDEX idx_discipline_student ON discipline(tenant_id, student_id);
CREATE INDEX idx_discipline_date ON discipline(tenant_id, incident_date DESC);
CREATE INDEX idx_discipline_severity ON discipline(tenant_id, severity);

-- ============================================================================
-- TABLES MÉTIER - ÉVALUATION
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: exams (Examens)
-- ----------------------------------------------------------------------------
CREATE TABLE exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Niveau scolaire (OBLIGATOIRE)
    school_level_id UUID NOT NULL REFERENCES school_levels(id) ON DELETE RESTRICT,
    
    name VARCHAR(255) NOT NULL,
    exam_type VARCHAR(50),
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
    quarter_id UUID REFERENCES quarters(id) ON DELETE SET NULL,
    exam_date DATE,
    max_score DECIMAL(5,2),
    
    -- Métadonnées SaaS
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_exams_tenant ON exams(tenant_id);
CREATE INDEX idx_exams_school_level ON exams(tenant_id, school_level_id);
CREATE INDEX idx_exams_class ON exams(tenant_id, class_id);
CREATE INDEX idx_exams_subject ON exams(tenant_id, subject_id);
CREATE INDEX idx_exams_quarter ON exams(tenant_id, quarter_id);
CREATE INDEX idx_exams_date ON exams(tenant_id, exam_date DESC);

-- ----------------------------------------------------------------------------
-- Table: grades (Notes)
-- ----------------------------------------------------------------------------
CREATE TABLE grades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Niveau scolaire (OBLIGATOIRE)
    school_level_id UUID NOT NULL REFERENCES school_levels(id) ON DELETE RESTRICT,
    
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
    quarter_id UUID REFERENCES quarters(id) ON DELETE SET NULL,
    
    score DECIMAL(5,2) NOT NULL,
    max_score DECIMAL(5,2),
    coefficient DECIMAL(3,2) DEFAULT 1.0,
    notes TEXT,
    
    -- Métadonnées SaaS
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    CONSTRAINT grades_score_check CHECK (score >= 0 AND score <= COALESCE(max_score, 20))
);

CREATE INDEX idx_grades_tenant ON grades(tenant_id);
CREATE INDEX idx_grades_school_level ON grades(tenant_id, school_level_id);
CREATE INDEX idx_grades_student ON grades(tenant_id, student_id);
CREATE INDEX idx_grades_exam ON grades(tenant_id, exam_id);
CREATE INDEX idx_grades_subject ON grades(tenant_id, subject_id);
CREATE INDEX idx_grades_quarter ON grades(tenant_id, quarter_id);
CREATE INDEX idx_grades_class ON grades(tenant_id, class_id);
CREATE INDEX idx_grades_academic_year ON grades(tenant_id, academic_year_id);

-- ============================================================================
-- TABLES MÉTIER - FINANCE
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: fee_configurations (Configuration des frais)
-- ----------------------------------------------------------------------------
CREATE TABLE fee_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Niveau scolaire (OBLIGATOIRE)
    school_level_id UUID NOT NULL REFERENCES school_levels(id) ON DELETE RESTRICT,
    
    name VARCHAR(255) NOT NULL,
    fee_type VARCHAR(50) NOT NULL,
    level VARCHAR(50),
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL,
    is_required BOOLEAN DEFAULT TRUE,
    due_date DATE,
    
    -- Métadonnées SaaS
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    CONSTRAINT fee_configurations_amount_check CHECK (amount >= 0)
);

CREATE INDEX idx_fee_configurations_tenant ON fee_configurations(tenant_id);
CREATE INDEX idx_fee_configurations_school_level ON fee_configurations(tenant_id, school_level_id);
CREATE INDEX idx_fee_configurations_class ON fee_configurations(tenant_id, class_id);
CREATE INDEX idx_fee_configurations_academic_year ON fee_configurations(tenant_id, academic_year_id);
CREATE INDEX idx_fee_configurations_type ON fee_configurations(tenant_id, fee_type);
CREATE INDEX idx_fee_configurations_due_date ON fee_configurations(tenant_id, due_date);

-- ----------------------------------------------------------------------------
-- Table: payments (Paiements)
-- ----------------------------------------------------------------------------
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Niveau scolaire (OBLIGATOIRE)
    school_level_id UUID NOT NULL REFERENCES school_levels(id) ON DELETE RESTRICT,
    
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    fee_configuration_id UUID REFERENCES fee_configurations(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) 
        CHECK (payment_method IN ('cash', 'bank_transfer', 'mobile_money', 'check', 'other')),
    payment_date DATE NOT NULL,
    reference VARCHAR(255),
    receipt_number VARCHAR(100),
    status VARCHAR(50) DEFAULT 'completed' 
        CHECK (status IN ('pending', 'completed', 'cancelled', 'refunded')),
    notes TEXT,
    
    -- Métadonnées SaaS
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    CONSTRAINT payments_amount_check CHECK (amount > 0)
);

CREATE INDEX idx_payments_tenant ON payments(tenant_id);
CREATE INDEX idx_payments_school_level ON payments(tenant_id, school_level_id);
CREATE INDEX idx_payments_student ON payments(tenant_id, student_id);
CREATE INDEX idx_payments_date ON payments(tenant_id, payment_date DESC);
CREATE INDEX idx_payments_status ON payments(tenant_id, status);
CREATE INDEX idx_payments_receipt_number ON payments(receipt_number);
CREATE INDEX idx_payments_fee_configuration ON payments(fee_configuration_id);

-- ----------------------------------------------------------------------------
-- Table: expenses (Dépenses)
-- ----------------------------------------------------------------------------
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Niveau scolaire (OBLIGATOIRE)
    school_level_id UUID NOT NULL REFERENCES school_levels(id) ON DELETE RESTRICT,
    
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    expense_date DATE NOT NULL,
    payment_method VARCHAR(50),
    reference VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending' 
        CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    attachment_url TEXT,
    
    -- Métadonnées SaaS
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    CONSTRAINT expenses_amount_check CHECK (amount > 0)
);

CREATE INDEX idx_expenses_tenant ON expenses(tenant_id);
CREATE INDEX idx_expenses_school_level ON expenses(tenant_id, school_level_id);
CREATE INDEX idx_expenses_date ON expenses(tenant_id, expense_date DESC);
CREATE INDEX idx_expenses_category ON expenses(tenant_id, category);
CREATE INDEX idx_expenses_status ON expenses(tenant_id, status);
CREATE INDEX idx_expenses_approved_by ON expenses(approved_by);

-- ============================================================================
-- TABLES POLICIES (Architecture Policy-Driven)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: grading_policies (Politiques de notation)
-- ----------------------------------------------------------------------------
CREATE TABLE grading_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    country_id UUID NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,
    education_level VARCHAR(50) NOT NULL,
    max_score DECIMAL(5,2) NOT NULL,
    passing_score DECIMAL(5,2) NOT NULL,
    grade_scales JSONB NOT NULL,
    calculation_rules JSONB,
    report_card_config JSONB,
    
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT grading_policies_country_level_unique 
        UNIQUE (country_id, education_level, is_default) 
        WHERE is_default = TRUE
);

CREATE INDEX idx_grading_policies_country ON grading_policies(country_id);
CREATE INDEX idx_grading_policies_default ON grading_policies(country_id, is_default) 
    WHERE is_default = TRUE;
CREATE INDEX idx_grading_policies_level ON grading_policies(country_id, education_level);
CREATE INDEX idx_grading_policies_scales ON grading_policies USING GIN(grade_scales);

-- ----------------------------------------------------------------------------
-- Table: salary_policies (Politiques salariales)
-- ----------------------------------------------------------------------------
CREATE TABLE salary_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    country_id UUID NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,
    salary_structure JSONB NOT NULL,
    social_contributions JSONB NOT NULL,
    leave_rules JSONB,
    bonuses JSONB,
    tax_rules JSONB,
    
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT salary_policies_country_default_unique 
        UNIQUE (country_id, is_default) 
        WHERE is_default = TRUE
);

CREATE INDEX idx_salary_policies_country ON salary_policies(country_id);
CREATE INDEX idx_salary_policies_default ON salary_policies(country_id, is_default) 
    WHERE is_default = TRUE;
CREATE INDEX idx_salary_policies_structure ON salary_policies USING GIN(salary_structure);

-- ============================================================================
-- TRIGGERS - Mise à jour automatique de updated_at
-- ============================================================================

-- Fonction déjà créée plus haut, application sur toutes les tables
CREATE TRIGGER update_countries_updated_at BEFORE UPDATE ON countries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_academic_years_updated_at BEFORE UPDATE ON academic_years
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quarters_updated_at BEFORE UPDATE ON quarters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schools_updated_at BEFORE UPDATE ON schools
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subjects_updated_at BEFORE UPDATE ON subjects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teachers_updated_at BEFORE UPDATE ON teachers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_absences_updated_at BEFORE UPDATE ON absences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_discipline_updated_at BEFORE UPDATE ON discipline
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exams_updated_at BEFORE UPDATE ON exams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grades_updated_at BEFORE UPDATE ON grades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fee_configurations_updated_at BEFORE UPDATE ON fee_configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grading_policies_updated_at BEFORE UPDATE ON grading_policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_salary_policies_updated_at BEFORE UPDATE ON salary_policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_school_levels_updated_at BEFORE UPDATE ON school_levels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_modules_updated_at BEFORE UPDATE ON modules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FONCTIONS D'INITIALISATION
-- ============================================================================

-- Fonction pour initialiser les niveaux scolaires par défaut
CREATE OR REPLACE FUNCTION initialize_default_school_levels(p_tenant_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Maternelle
    INSERT INTO school_levels (tenant_id, type, name, abbreviation, description, "order", is_active)
    VALUES (p_tenant_id, 'MATERNELLE', 'Maternelle', 'MAT', 'Niveau maternelle (3-6 ans)', 0, TRUE)
    ON CONFLICT (tenant_id, type) DO NOTHING;
    
    -- Primaire
    INSERT INTO school_levels (tenant_id, type, name, abbreviation, description, "order", is_active)
    VALUES (p_tenant_id, 'PRIMAIRE', 'Primaire', 'PRI', 'Niveau primaire (6-12 ans)', 1, TRUE)
    ON CONFLICT (tenant_id, type) DO NOTHING;
    
    -- Secondaire
    INSERT INTO school_levels (tenant_id, type, name, abbreviation, description, "order", is_active)
    VALUES (p_tenant_id, 'SECONDAIRE', 'Secondaire', 'SEC', 'Niveau secondaire (12-18 ans)', 2, TRUE)
    ON CONFLICT (tenant_id, type) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour initialiser les modules par défaut pour un niveau
CREATE OR REPLACE FUNCTION initialize_default_modules(
    p_tenant_id UUID,
    p_school_level_id UUID
)
RETURNS VOID AS $$
BEGIN
    -- SCOLARITE
    INSERT INTO modules (tenant_id, type, name, code, description, school_level_id, status, is_enabled, permissions, dependencies, "order", route, icon)
    VALUES (p_tenant_id, 'SCOLARITE', 'Scolarité & Élèves', 'scolarite', 'Gestion des élèves et inscriptions', p_school_level_id, 'active', TRUE, '["students.read", "students.manage"]'::JSONB, '[]'::JSONB, 1, '/dashboard/students', 'Users')
    ON CONFLICT (tenant_id, type, school_level_id) DO NOTHING;
    
    -- FINANCES
    INSERT INTO modules (tenant_id, type, name, code, description, school_level_id, status, is_enabled, permissions, dependencies, "order", route, icon)
    VALUES (p_tenant_id, 'FINANCES', 'Économat & Finance', 'finances', 'Gestion financière et comptabilité', p_school_level_id, 'active', TRUE, '["finance.read", "finance.manage"]'::JSONB, '[]'::JSONB, 2, '/dashboard/finance', 'Calculator')
    ON CONFLICT (tenant_id, type, school_level_id) DO NOTHING;
    
    -- PEDAGOGIE
    INSERT INTO modules (tenant_id, type, name, code, description, school_level_id, status, is_enabled, permissions, dependencies, "order", route, icon)
    VALUES (p_tenant_id, 'PEDAGOGIE', 'Études & Planification', 'pedagogie', 'Emplois du temps et planning', p_school_level_id, 'active', TRUE, '["planning.read", "planning.manage"]'::JSONB, '["SCOLARITE"]'::JSONB, 3, '/dashboard/planning', 'Building')
    ON CONFLICT (tenant_id, type, school_level_id) DO NOTHING;
    
    -- EXAMENS
    INSERT INTO modules (tenant_id, type, name, code, description, school_level_id, status, is_enabled, permissions, dependencies, "order", route, icon)
    VALUES (p_tenant_id, 'EXAMENS', 'Examens & Évaluation', 'examens', 'Examens, notes et bulletins', p_school_level_id, 'active', TRUE, '["exams.read", "exams.manage"]'::JSONB, '["SCOLARITE", "PEDAGOGIE"]'::JSONB, 4, '/dashboard/examinations', 'BookOpen')
    ON CONFLICT (tenant_id, type, school_level_id) DO NOTHING;
    
    -- RH
    INSERT INTO modules (tenant_id, type, name, code, description, school_level_id, status, is_enabled, permissions, dependencies, "order", route, icon)
    VALUES (p_tenant_id, 'RH', 'Personnel & RH', 'rh', 'Gestion du personnel et RH', p_school_level_id, 'active', TRUE, '["hr.read", "hr.manage"]'::JSONB, '[]'::JSONB, 5, '/dashboard/hr', 'UserCheck')
    ON CONFLICT (tenant_id, type, school_level_id) DO NOTHING;
    
    -- COMMUNICATION
    INSERT INTO modules (tenant_id, type, name, code, description, school_level_id, status, is_enabled, permissions, dependencies, "order", route, icon)
    VALUES (p_tenant_id, 'COMMUNICATION', 'Communication', 'communication', 'SMS, emails et notifications', p_school_level_id, 'active', TRUE, '["communication.read", "communication.manage"]'::JSONB, '[]'::JSONB, 6, '/dashboard/communication', 'MessageSquare')
    ON CONFLICT (tenant_id, type, school_level_id) DO NOTHING;
    
    -- Modules supplémentaires (7-14)
    INSERT INTO modules (tenant_id, type, name, code, description, school_level_id, status, is_enabled, permissions, dependencies, "order", route, icon)
    VALUES 
        (p_tenant_id, 'BIBLIOTHEQUE', 'Bibliothèque', 'bibliotheque', 'Gestion du catalogue et prêts de livres', p_school_level_id, 'active', TRUE, '["library.read", "library.manage"]'::JSONB, '["SCOLARITE"]'::JSONB, 7, '/dashboard/library', 'Book'),
        (p_tenant_id, 'LABORATOIRE', 'Laboratoire', 'laboratoire', 'Gestion des équipements et réservations', p_school_level_id, 'active', TRUE, '["laboratory.read", "laboratory.manage"]'::JSONB, '["PEDAGOGIE"]'::JSONB, 8, '/dashboard/laboratory', 'FlaskConical'),
        (p_tenant_id, 'TRANSPORT', 'Transport', 'transport', 'Gestion des véhicules et itinéraires', p_school_level_id, 'active', TRUE, '["transport.read", "transport.manage"]'::JSONB, '["SCOLARITE"]'::JSONB, 9, '/dashboard/transport', 'Bus'),
        (p_tenant_id, 'CANTINE', 'Cantine', 'cantine', 'Gestion des repas et menus', p_school_level_id, 'active', TRUE, '["cafeteria.read", "cafeteria.manage"]'::JSONB, '["SCOLARITE", "FINANCES"]'::JSONB, 10, '/dashboard/cafeteria', 'UtensilsCrossed'),
        (p_tenant_id, 'INFIRMERIE', 'Infirmerie', 'infirmerie', 'Dossiers médicaux et visites', p_school_level_id, 'active', TRUE, '["health.read", "health.manage"]'::JSONB, '["SCOLARITE"]'::JSONB, 11, '/dashboard/health', 'Heart'),
        (p_tenant_id, 'QHSE', 'QHSE', 'qhse', 'Qualité, Hygiène, Sécurité et Environnement', p_school_level_id, 'active', TRUE, '["qhse.read", "qhse.manage"]'::JSONB, '[]'::JSONB, 12, '/dashboard/qhse', 'ShieldCheck'),
        (p_tenant_id, 'EDUCAST', 'EduCast', 'educast', 'Diffusion de contenu éducatif', p_school_level_id, 'active', TRUE, '["educast.read", "educast.manage"]'::JSONB, '["PEDAGOGIE"]'::JSONB, 13, '/dashboard/educast', 'Radio'),
        (p_tenant_id, 'BOUTIQUE', 'Boutique', 'boutique', 'Vente de fournitures scolaires', p_school_level_id, 'active', TRUE, '["boutique.read", "boutique.manage"]'::JSONB, '["SCOLARITE", "FINANCES"]'::JSONB, 14, '/dashboard/boutique', 'ShoppingCart')
    ON CONFLICT (tenant_id, type, school_level_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW-LEVEL SECURITY (RLS) - Isolation stricte par tenant
-- ============================================================================

-- Activation RLS sur toutes les tables tenant-aware
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE discipline ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE quarters ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour isolation par tenant
CREATE POLICY students_tenant_isolation ON students
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY teachers_tenant_isolation ON teachers
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY classes_tenant_isolation ON classes
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY subjects_tenant_isolation ON subjects
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY exams_tenant_isolation ON exams
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY grades_tenant_isolation ON grades
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY payments_tenant_isolation ON payments
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY expenses_tenant_isolation ON expenses
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY absences_tenant_isolation ON absences
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY discipline_tenant_isolation ON discipline
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY academic_years_tenant_isolation ON academic_years
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY quarters_tenant_isolation ON quarters
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY schools_tenant_isolation ON schools
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY departments_tenant_isolation ON departments
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY rooms_tenant_isolation ON rooms
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY fee_configurations_tenant_isolation ON fee_configurations
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY users_tenant_isolation ON users
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY audit_logs_tenant_isolation ON audit_logs
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY school_levels_tenant_isolation ON school_levels
    FOR ALL USING (tenant_id = get_current_tenant_id());

CREATE POLICY modules_tenant_isolation ON modules
    FOR ALL USING (tenant_id = get_current_tenant_id());

-- ============================================================================
-- VUES UTILES
-- ============================================================================

-- Vue: Vue agrégée des élèves par classe
CREATE OR REPLACE VIEW students_by_class AS
SELECT 
    c.tenant_id,
    c.id AS class_id,
    c.name AS class_name,
    COUNT(s.id) AS student_count,
    COUNT(CASE WHEN s.enrollment_status = 'active' THEN 1 END) AS active_students
FROM classes c
LEFT JOIN students s ON s.class_id = c.id AND s.tenant_id = c.tenant_id
GROUP BY c.tenant_id, c.id, c.name;

-- Vue: Vue des paiements par élève
CREATE OR REPLACE VIEW student_payment_summary AS
SELECT 
    s.tenant_id,
    s.id AS student_id,
    s.first_name || ' ' || s.last_name AS student_name,
    COALESCE(SUM(p.amount), 0) AS total_paid,
    COUNT(p.id) AS payment_count
FROM students s
LEFT JOIN payments p ON p.student_id = s.id AND p.tenant_id = s.tenant_id
GROUP BY s.tenant_id, s.id, s.first_name, s.last_name;

-- Vue: Vue des notes moyennes par élève
CREATE OR REPLACE VIEW student_grades_summary AS
SELECT 
    s.tenant_id,
    s.id AS student_id,
    s.first_name || ' ' || s.last_name AS student_name,
    g.quarter_id,
    g.academic_year_id,
    AVG(g.score) AS average_score,
    COUNT(g.id) AS grade_count
FROM students s
LEFT JOIN grades g ON g.student_id = s.id AND g.tenant_id = s.tenant_id
GROUP BY s.tenant_id, s.id, s.first_name, s.last_name, g.quarter_id, g.academic_year_id;

-- ============================================================================
-- VUES D'AGRÉGATION - BILANS PAR MODULE ET PAR NIVEAU
-- ============================================================================

-- Vue: Statistiques par niveau scolaire
CREATE OR REPLACE VIEW school_level_statistics AS
SELECT 
    sl.tenant_id,
    sl.id AS school_level_id,
    sl.type,
    sl.name AS school_level_name,
    COUNT(DISTINCT s.id) AS total_students,
    COUNT(DISTINCT c.id) AS total_classes,
    COUNT(DISTINCT t.id) AS total_teachers,
    COUNT(DISTINCT sub.id) AS total_subjects,
    COUNT(DISTINCT e.id) AS total_exams,
    COALESCE(SUM(p.amount), 0) AS total_payments,
    COALESCE(SUM(exp.amount), 0) AS total_expenses
FROM school_levels sl
LEFT JOIN students s ON s.school_level_id = sl.id AND s.tenant_id = sl.tenant_id
LEFT JOIN classes c ON c.school_level_id = sl.id AND c.tenant_id = sl.tenant_id
LEFT JOIN teachers t ON t.school_level_id = sl.id AND t.tenant_id = sl.tenant_id
LEFT JOIN subjects sub ON sub.school_level_id = sl.id AND sub.tenant_id = sl.tenant_id
LEFT JOIN exams e ON e.school_level_id = sl.id AND e.tenant_id = sl.tenant_id
LEFT JOIN payments p ON p.school_level_id = sl.id AND p.tenant_id = sl.tenant_id AND p.status = 'completed'
LEFT JOIN expenses exp ON exp.school_level_id = sl.id AND exp.tenant_id = sl.tenant_id AND exp.status = 'approved'
WHERE sl.is_active = TRUE
GROUP BY sl.tenant_id, sl.id, sl.type, sl.name;

-- Vue: Bilan financier par niveau
CREATE OR REPLACE VIEW financial_summary_by_level AS
SELECT 
    sl.tenant_id,
    sl.id AS school_level_id,
    sl.type,
    sl.name AS school_level_name,
    COALESCE(SUM(p.amount), 0) AS total_revenue,
    COALESCE(SUM(exp.amount), 0) AS total_expenses,
    COALESCE(SUM(p.amount), 0) - COALESCE(SUM(exp.amount), 0) AS net_balance,
    COUNT(DISTINCT p.id) AS payment_count,
    COUNT(DISTINCT exp.id) AS expense_count
FROM school_levels sl
LEFT JOIN payments p ON p.school_level_id = sl.id AND p.tenant_id = sl.tenant_id AND p.status = 'completed'
LEFT JOIN expenses exp ON exp.school_level_id = sl.id AND exp.tenant_id = sl.tenant_id AND exp.status = 'approved'
WHERE sl.is_active = TRUE
GROUP BY sl.tenant_id, sl.id, sl.type, sl.name;

-- Vue: Modules activés par niveau
CREATE OR REPLACE VIEW active_modules_by_level AS
SELECT 
    m.tenant_id,
    m.school_level_id,
    sl.type AS school_level_type,
    sl.name AS school_level_name,
    m.type AS module_type,
    m.name AS module_name,
    m.is_enabled,
    m.status,
    m.permissions,
    m.dependencies,
    m."order",
    m.route
FROM modules m
INNER JOIN school_levels sl ON sl.id = m.school_level_id
WHERE m.is_enabled = TRUE AND m.status = 'active'
ORDER BY m.tenant_id, m.school_level_id, m."order";

-- Vue: Statistiques par module et par niveau
CREATE OR REPLACE VIEW module_statistics_by_level AS
SELECT 
    m.tenant_id,
    m.school_level_id,
    sl.type AS school_level_type,
    sl.name AS school_level_name,
    m.type AS module_type,
    m.name AS module_name,
    CASE m.type
        WHEN 'SCOLARITE' THEN (
            SELECT COUNT(*) FROM students s 
            WHERE s.tenant_id = m.tenant_id 
            AND s.school_level_id = m.school_level_id
        )
        WHEN 'FINANCES' THEN (
            SELECT COUNT(*) FROM payments p 
            WHERE p.tenant_id = m.tenant_id 
            AND p.school_level_id = m.school_level_id
        )
        WHEN 'RH' THEN (
            SELECT COUNT(*) FROM teachers t 
            WHERE t.tenant_id = m.tenant_id 
            AND t.school_level_id = m.school_level_id
        )
        WHEN 'PEDAGOGIE' THEN (
            SELECT COUNT(*) FROM classes c 
            WHERE c.tenant_id = m.tenant_id 
            AND c.school_level_id = m.school_level_id
        )
        WHEN 'EXAMENS' THEN (
            SELECT COUNT(*) FROM exams e 
            WHERE e.tenant_id = m.tenant_id 
            AND e.school_level_id = m.school_level_id
        )
        ELSE 0
    END AS record_count
FROM modules m
INNER JOIN school_levels sl ON sl.id = m.school_level_id
WHERE m.is_enabled = TRUE AND m.status = 'active';

-- Vue: Bilan financier par module et par niveau (lecture seule)
CREATE OR REPLACE VIEW financial_summary_by_module_and_level AS
SELECT 
    m.tenant_id,
    m.school_level_id,
    sl.type AS school_level_type,
    sl.name AS school_level_name,
    m.type AS module_type,
    m.name AS module_name,
    CASE m.type
        WHEN 'FINANCES' THEN (
            SELECT COALESCE(SUM(p.amount), 0) FROM payments p 
            WHERE p.tenant_id = m.tenant_id 
            AND p.school_level_id = m.school_level_id
            AND p.status = 'completed'
        )
        WHEN 'CANTINE' THEN (
            SELECT COALESCE(SUM(p.amount), 0) FROM payments p 
            WHERE p.tenant_id = m.tenant_id 
            AND p.school_level_id = m.school_level_id
            AND p.status = 'completed'
            AND p.fee_configuration_id IN (
                SELECT id FROM fee_configurations 
                WHERE tenant_id = m.tenant_id 
                AND school_level_id = m.school_level_id
                AND fee_type = 'cantine'
            )
        )
        WHEN 'BOUTIQUE' THEN (
            SELECT COALESCE(SUM(p.amount), 0) FROM payments p 
            WHERE p.tenant_id = m.tenant_id 
            AND p.school_level_id = m.school_level_id
            AND p.status = 'completed'
            AND p.fee_configuration_id IN (
                SELECT id FROM fee_configurations 
                WHERE tenant_id = m.tenant_id 
                AND school_level_id = m.school_level_id
                AND fee_type = 'boutique'
            )
        )
        ELSE 0
    END AS total_revenue,
    CASE m.type
        WHEN 'FINANCES' THEN (
            SELECT COALESCE(SUM(exp.amount), 0) FROM expenses exp 
            WHERE exp.tenant_id = m.tenant_id 
            AND exp.school_level_id = m.school_level_id
            AND exp.status = 'approved'
        )
        ELSE 0
    END AS total_expenses
FROM modules m
INNER JOIN school_levels sl ON sl.id = m.school_level_id
WHERE m.is_enabled = TRUE AND m.status = 'active'
AND m.type IN ('FINANCES', 'CANTINE', 'BOUTIQUE');

-- ============================================================================
-- COMMENTAIRES ET DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE tenants IS 'Organisations/Écoles - Niveau racine du multi-tenant';
COMMENT ON TABLE users IS 'Utilisateurs système - Authentification et autorisation';
COMMENT ON TABLE students IS 'Élèves - Données métier principales';
COMMENT ON TABLE teachers IS 'Enseignants - Données métier principales';
COMMENT ON TABLE countries IS 'Pays dans la plateforme - Chaque tenant appartient à un pays';
COMMENT ON TABLE grading_policies IS 'Politiques de notation par pays - Architecture policy-driven';
COMMENT ON TABLE salary_policies IS 'Politiques salariales par pays - Architecture policy-driven';
COMMENT ON TABLE school_levels IS 'Niveaux scolaires structurants - MATERNELLE, PRIMAIRE, SECONDAIRE - Dimension obligatoire pour toutes les données métier';
COMMENT ON TABLE modules IS 'Modules fonctionnels indépendants - Chaque module est associé à un tenant et un niveau scolaire';

COMMENT ON COLUMN tenants.country_id IS 'OBLIGATOIRE : Chaque école appartient à un pays';
COMMENT ON COLUMN school_levels.tenant_id IS 'Isolation multi-tenant - Chaque niveau appartient à un tenant';
COMMENT ON COLUMN school_levels.type IS 'Type de niveau : MATERNELLE, PRIMAIRE, SECONDAIRE';
COMMENT ON COLUMN modules.tenant_id IS 'Isolation multi-tenant - Chaque module appartient à un tenant';
COMMENT ON COLUMN modules.school_level_id IS 'OBLIGATOIRE : Chaque module est associé à un niveau scolaire';
COMMENT ON COLUMN modules.is_enabled IS 'Activation/désactivation du module pour ce niveau';
COMMENT ON COLUMN students.tenant_id IS 'Isolation multi-tenant - TOUJOURS présent dans les requêtes';
COMMENT ON COLUMN students.school_level_id IS 'OBLIGATOIRE : Niveau scolaire de l''élève - Aucune donnée métier sans niveau';
COMMENT ON COLUMN teachers.tenant_id IS 'Isolation multi-tenant - TOUJOURS présent dans les requêtes';
COMMENT ON COLUMN teachers.school_level_id IS 'OBLIGATOIRE : Niveau scolaire de l''enseignant - Aucune donnée métier sans niveau';
COMMENT ON COLUMN classes.school_level_id IS 'OBLIGATOIRE : Niveau scolaire de la classe - Aucune donnée métier sans niveau';
COMMENT ON COLUMN subjects.school_level_id IS 'OBLIGATOIRE : Niveau scolaire de la matière - Aucune donnée métier sans niveau';
COMMENT ON COLUMN exams.school_level_id IS 'OBLIGATOIRE : Niveau scolaire de l''examen - Aucune donnée métier sans niveau';
COMMENT ON COLUMN grades.tenant_id IS 'Isolation multi-tenant - TOUJOURS présent dans les requêtes';
COMMENT ON COLUMN grades.school_level_id IS 'OBLIGATOIRE : Niveau scolaire de la note - Aucune donnée métier sans niveau';
COMMENT ON COLUMN payments.school_level_id IS 'OBLIGATOIRE : Niveau scolaire du paiement - Bilans séparés par niveau';
COMMENT ON COLUMN expenses.school_level_id IS 'OBLIGATOIRE : Niveau scolaire de la dépense - Bilans séparés par niveau';
COMMENT ON COLUMN fee_configurations.school_level_id IS 'OBLIGATOIRE : Niveau scolaire de la configuration - Bilans séparés par niveau';
COMMENT ON COLUMN absences.school_level_id IS 'OBLIGATOIRE : Niveau scolaire de l''absence - Aucune donnée métier sans niveau';
COMMENT ON COLUMN discipline.school_level_id IS 'OBLIGATOIRE : Niveau scolaire de l''incident - Aucune donnée métier sans niveau';

-- ============================================================================
-- FIN DU SCHÉMA
-- ============================================================================


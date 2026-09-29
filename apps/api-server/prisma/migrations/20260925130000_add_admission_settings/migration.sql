-- ============================================================================
-- 20260925130000_add_admission_settings
-- ============================================================================
-- Module Admissions configurable par le promoteur depuis /app/admissions.
--
-- 3 tables :
--   - admission_settings (1 ligne par tenant) : activation, titres, CTA...
--   - admission_steps (N lignes par tenant) : étapes 1..N
--   - admission_documents (N lignes par tenant) : documents requis
-- ============================================================================

-- ─── Table admission_settings ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admission_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"      TEXT NOT NULL UNIQUE,
  "isActive"      BOOLEAN NOT NULL DEFAULT false,
  title           TEXT,
  subtitle        TEXT,
  "ctaText"       TEXT DEFAULT 'Soumettre l''admission de mon enfant',
  "ctaUrl"        TEXT DEFAULT '/public/pre-enrollment',
  "documentsTitle"  TEXT DEFAULT 'Documents requis',
  "documentsIntro"  TEXT,
  "stepsTitle"      TEXT DEFAULT 'Notre processus d''admission',
  "stepsIntro"      TEXT,
  "ctaBlockTitle"   TEXT DEFAULT 'Prêt à nous rejoindre ?',
  "ctaBlockText"    TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_admission_settings_tenant
    FOREIGN KEY ("tenantId") REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admission_settings_tenant ON admission_settings("tenantId");

-- ─── Table admission_steps ────────────────────────────────────────────────
-- ⚠️ admissionId est UUID (pas TEXT) pour matcher admission_settings.id
CREATE TABLE IF NOT EXISTS admission_steps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"      TEXT NOT NULL,
  "admissionId"   UUID NOT NULL,
  num             INTEGER NOT NULL DEFAULT 1,
  title           TEXT NOT NULL,
  description     TEXT,
  "iconName"      TEXT DEFAULT 'CheckCircle2',
  "order"         INTEGER NOT NULL DEFAULT 0,
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_admission_steps_tenant
    FOREIGN KEY ("tenantId") REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_admission_steps_admission
    FOREIGN KEY ("admissionId") REFERENCES admission_settings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admission_steps_tenant ON admission_steps("tenantId");
CREATE INDEX IF NOT EXISTS idx_admission_steps_admission ON admission_steps("admissionId");

-- ─── Table admission_required_documents ────────────────────────────────
-- ⭐ Renommé admission_required_documents (au lieu de admission_documents)
--    pour éviter le conflit avec la table admission_documents existante
--    (système de transfert inter-écoles).
-- ⚠️ admissionId est UUID (pas TEXT) pour matcher admission_settings.id
CREATE TABLE IF NOT EXISTS admission_required_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"      TEXT NOT NULL,
  "admissionId"   UUID NOT NULL,
  label           TEXT NOT NULL,
  description     TEXT,
  "iconName"      TEXT DEFAULT 'FileText',
  "order"         INTEGER NOT NULL DEFAULT 0,
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_admission_required_documents_tenant
    FOREIGN KEY ("tenantId") REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_admission_required_documents_admission
    FOREIGN KEY ("admissionId") REFERENCES admission_settings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admission_required_documents_tenant ON admission_required_documents("tenantId");
CREATE INDEX IF NOT EXISTS idx_admission_required_documents_admission ON admission_required_documents("admissionId");

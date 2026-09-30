-- Academia Helm : distinctions, certificats et tableaux d'honneur (PostgreSQL)

CREATE TABLE distinction_rules (
  id          BIGSERIAL PRIMARY KEY,
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  level       TEXT NOT NULL CHECK (level IN ('maternel','primaire','secondaire')),
  code        TEXT NOT NULL,              -- ex : PRI_FELIC (voir DistinctionCode)
  min_pct     NUMERIC(5,2) NOT NULL CHECK (min_pct BETWEEN 0 AND 100),
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (school_id, level, code)
);

CREATE TABLE distinctions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id          UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id         UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id           UUID NOT NULL REFERENCES classes(id),
  period_id          UUID NOT NULL REFERENCES periods(id),
  code               TEXT NOT NULL,
  average            NUMERIC(6,2),
  base               SMALLINT NOT NULL,
  rank               SMALLINT,
  verification_code  TEXT NOT NULL UNIQUE,
  file_url           TEXT,
  issued_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at         TIMESTAMPTZ,
  -- une seule émission par élève, période et type de distinction
  UNIQUE (student_id, period_id, code)
);

CREATE INDEX distinctions_class_period_idx ON distinctions (class_id, period_id);

-- Page publique /verifier/[code] : SELECT sur verification_code uniquement,
-- en exposant nom, mention, période et école (jamais la moyenne exacte sans consentement).

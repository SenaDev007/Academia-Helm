-- ============================================================================
-- Migration : hr_test_questionnaires + hr_test_responses
-- ============================================================================
-- Système de questionnaire en ligne pour les tests de recrutement.
-- Le recruteur crée un questionnaire (QCM, Vrai/Faux, texte), l'envoie au
-- candidat par email avec un lien unique + token. Le candidat répond avec
-- une minuterie anti-fraude. Les réponses sont corrigées automatiquement
-- (QCM/Vrai-Faux) et le recruteur peut ajouter sa note manuellement.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "hr_test_questionnaires" (
    "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "tenant_id"       TEXT NOT NULL,
    "test_id"         TEXT,                    -- FK vers hr_tests (optionnel)
    "title"           TEXT NOT NULL,
    "description"     TEXT,
    "duration_minutes" INT NOT NULL DEFAULT 30, -- Minuterie anti-fraude
    "questions"       TEXT NOT NULL,            -- JSON array de questions
    "status"          TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT | PUBLISHED | CLOSED
    "passing_score"   INT DEFAULT 60,           -- Score minimum pour réussir (%)
    "max_score"       INT DEFAULT 100,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_test_questionnaires_tenant_id_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_hr_test_questionnaires_tenant"
    ON "hr_test_questionnaires" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_hr_test_questionnaires_test"
    ON "hr_test_questionnaires" ("test_id");

CREATE TABLE IF NOT EXISTS "hr_test_responses" (
    "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "tenant_id"       TEXT NOT NULL,
    "questionnaire_id" TEXT NOT NULL,
    "candidate_id"    TEXT NOT NULL,
    "application_id"  TEXT,
    "token"           TEXT NOT NULL UNIQUE,     -- Token unique pour le lien public
    "status"          TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | IN_PROGRESS | SUBMITTED | EXPIRED
    "started_at"      TIMESTAMP(3),             -- Début de la minuterie
    "submitted_at"    TIMESTAMP(3),             -- Soumission
    "expires_at"      TIMESTAMP(3),             -- Le lien expire si non commencé
    "responses"       TEXT,                     -- JSON array des réponses du candidat
    "auto_score"      INT,                      -- Score automatique (QCM/Vrai-Faux)
    "auto_score_max"  INT,                      -- Score max possible (auto)
    "recruiter_score" INT,                      -- Note manuelle du recruteur
    "recruiter_feedback" TEXT,
    "recruiter_scored_at" TIMESTAMP(3),
    "candidate_email" TEXT,                     -- Email du candidat (pour audit)
    "candidate_name"  TEXT,                     -- Nom du candidat (pour audit)
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_test_responses_tenant_id_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
    CONSTRAINT "hr_test_responses_questionnaire_id_fkey"
        FOREIGN KEY ("questionnaire_id") REFERENCES "hr_test_questionnaires"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_hr_test_responses_tenant"
    ON "hr_test_responses" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_hr_test_responses_questionnaire"
    ON "hr_test_responses" ("questionnaire_id");
CREATE INDEX IF NOT EXISTS "idx_hr_test_responses_candidate"
    ON "hr_test_responses" ("candidate_id");
CREATE INDEX IF NOT EXISTS "idx_hr_test_responses_token"
    ON "hr_test_responses" ("token");
CREATE INDEX IF NOT EXISTS "idx_hr_test_responses_status"
    ON "hr_test_responses" ("status");

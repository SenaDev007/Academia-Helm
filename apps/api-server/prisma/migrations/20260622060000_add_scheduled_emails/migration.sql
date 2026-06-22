-- ============================================================================
-- Migration : scheduled_emails — Emails programmés à une date/heure précise
-- ============================================================================
-- Permet au recruteur (ou tout staff) de programmer l'envoi d'un email à un
-- candidat/parent/staff à une date/heure précise.
-- Ex : rappel d'entretien J-1 à 8h, message de bienvenue à la date de prise
-- de fonction, etc.
--
-- Un cron tourne toutes les minutes pour dispatcher les emails PENDING dont
-- scheduledAt <= now().
-- ============================================================================

CREATE TABLE IF NOT EXISTS "scheduled_emails" (
    "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "tenant_id"       TEXT NOT NULL,

    -- Destinataire
    "to_email"        TEXT NOT NULL,
    "to_name"         TEXT,
    "recipient_type"  TEXT,          -- CANDIDAT | PARENT | STAFF | ENSEIGNANT | EXTERNE
    "recipient_id"    TEXT,          -- FK optionnelle (ex: HrCandidate.id)

    -- Contenu
    "subject"         TEXT NOT NULL,
    "html_body"       TEXT NOT NULL,
    "text_body"       TEXT,

    -- Catégorisation (pour EmailLog)
    "category"        TEXT,          -- RECRUTEMENT | PEDAGOGIE | FINANCE | COMMUNICATION | SYSTEM
    "subcategory"     TEXT,
    "module"          TEXT,          -- hr | finance | students | communication

    -- Reply-to override (ex: email du recruteur pour que le candidat réponde direct)
    "reply_to_override" TEXT,

    -- Programmation
    "scheduled_at"    TIMESTAMP(3) NOT NULL,
    "timezone"        TEXT DEFAULT 'Africa/Porto-Novo',

    -- Statut
    "status"          TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING | SENT | FAILED | CANCELLED
    "sent_at"         TIMESTAMP(3),
    "email_log_id"    TEXT,          -- FK vers email_logs.id (une fois envoyé)
    "error_message"   TEXT,

    -- Métadonnées
    "created_by_user_id" TEXT,
    "created_by_name"    TEXT,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Relations
    CONSTRAINT "scheduled_emails_tenant_id_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
);

-- Index pour le dispatcher (poll efficace)
CREATE INDEX IF NOT EXISTS "idx_scheduled_emails_pending_due"
    ON "scheduled_emails" ("scheduled_at")
    WHERE "status" = 'PENDING';

CREATE INDEX IF NOT EXISTS "idx_scheduled_emails_tenant"
    ON "scheduled_emails" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_scheduled_emails_status"
    ON "scheduled_emails" ("status");

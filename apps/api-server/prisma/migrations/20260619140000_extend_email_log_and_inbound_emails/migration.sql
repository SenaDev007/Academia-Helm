-- ============================================================================
-- Migration: 20260619140000_extend_email_log_and_inbound_emails
-- ============================================================================
-- Étend la table `email_logs` existante pour la catégorisation, le threading,
-- le tracking et le reply-to personnalisé. Crée la table `inbound_emails` pour
-- stocker les réponses reçues par les candidats/parents.
--
-- Objectif : transformer le module Communication en boîte mail traçable,
-- catégorisée et bidirectionnelle (sortant + entrant).
-- ============================================================================

-- ─── 1. Étendre `email_logs` ────────────────────────────────────────────────
-- Toutes les colonnes sont ajoutées avec IF NOT EXISTS pour la sécurité.

-- Catégorisation
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "category"          TEXT;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "subCategory"       TEXT;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "module"            TEXT;

-- Expéditeur & destinataire enrichis
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "fromEmail"         TEXT;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "fromName"          TEXT;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "recipientName"     TEXT;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "recipientType"     TEXT;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "recipientId"       TEXT;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "cc"                TEXT;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "bcc"               TEXT;

-- Contenu
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "textContent"       TEXT;

-- Threading (conversation)
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "threadId"          TEXT;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "inReplyTo"         TEXT;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "references"        TEXT;

-- Reply-to personnalisé (Volet 2 — inbound)
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "replyTo"           TEXT;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "replyToToken"      TEXT;

-- Tracking avancé (Phase 4)
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "openedAt"          TIMESTAMP(3);
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "clickedAt"         TIMESTAMP(3);
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "openCount"         INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "clickCount"        INTEGER NOT NULL DEFAULT 0;

-- Métadonnées
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "triggeredBy"       TEXT;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "triggeredByUserId" TEXT;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "templateId"        TEXT;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "relatedEntityId"   TEXT;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "relatedEntityType" TEXT;

-- Index pour requêtes fréquentes
CREATE INDEX IF NOT EXISTS "email_logs_tenantId_category_idx"     ON "email_logs" ("tenantId", "category");
CREATE INDEX IF NOT EXISTS "email_logs_tenantId_status_idx"       ON "email_logs" ("tenantId", "status");
CREATE INDEX IF NOT EXISTS "email_logs_tenantId_recipient_idx"    ON "email_logs" ("tenantId", "recipient");
CREATE INDEX IF NOT EXISTS "email_logs_threadId_idx"              ON "email_logs" ("threadId");
CREATE INDEX IF NOT EXISTS "email_logs_replyToToken_idx"          ON "email_logs" ("replyToToken");
CREATE INDEX IF NOT EXISTS "email_logs_tenantId_createdAt_idx"    ON "email_logs" ("tenantId", "createdAt" DESC);

-- ─── 2. Créer `inbound_emails` ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "inbound_emails" (
    "id"              TEXT NOT NULL,
    "tenantId"        TEXT NOT NULL,

    -- Lien vers l'email original (peut être null si pas de match)
    "originalEmailId" TEXT,
    "threadId"        TEXT,

    -- Expéditeur (le candidat/parent qui répond)
    "fromEmail"       TEXT NOT NULL,
    "fromName"        TEXT,
    "toEmail"         TEXT NOT NULL,  -- ex: log_abc123@replies.academiahelm.com

    -- Contenu
    "subject"         TEXT NOT NULL,
    "textContent"     TEXT,
    "htmlContent"     TEXT,
    "attachments"     TEXT,            -- JSON array

    -- Provider (Resend Inbound)
    "providerId"      TEXT,
    "rawHeaders"      TEXT,

    -- Traitement
    "status"          TEXT NOT NULL DEFAULT 'RECEIVED',  -- RECEIVED | PROCESSED | FAILED | ARCHIVED
    "errorMessage"    TEXT,

    "receivedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt"     TIMESTAMP(3),

    CONSTRAINT "inbound_emails_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inbound_emails_originalEmailId_fkey"
        FOREIGN KEY ("originalEmailId") REFERENCES "email_logs" ("id") ON DELETE SET NULL,
    CONSTRAINT "inbound_emails_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "inbound_emails_tenantId_idx"          ON "inbound_emails" ("tenantId");
CREATE INDEX IF NOT EXISTS "inbound_emails_originalEmailId_idx"   ON "inbound_emails" ("originalEmailId");
CREATE INDEX IF NOT EXISTS "inbound_emails_fromEmail_idx"         ON "inbound_emails" ("fromEmail");
CREATE INDEX IF NOT EXISTS "inbound_emails_threadId_idx"          ON "inbound_emails" ("threadId");
CREATE INDEX IF NOT EXISTS "inbound_emails_tenantId_receivedAt_idx" ON "inbound_emails" ("tenantId", "receivedAt" DESC);

-- ─── 3. Préfixer le statut par défaut pour les anciens logs ─────────────────
-- Les anciens logs (s'il y en a) ont un statut 'sent' ou autre → on garde tel quel
-- mais on s'assure que les nouveaux auront bien 'PENDING' au moment du INSERT.
-- (Pas de UPDATE ici car la colonne status existait déjà.)

-- ─── 4. Backfill `fromEmail` et `fromName` pour les logs existants ──────────
-- Si d'anciens logs existent avec un `recipient` mais pas de `fromEmail`, on
-- remplit avec les valeurs par défaut. (Aucun log en production pour l'instant
-- donc cette étape est un no-op — mais on garde le SQL pour la postérité.)
UPDATE "email_logs"
SET "fromEmail" = 'noreply@academiahelm.com',
    "fromName"  = 'Academia Helm'
WHERE "fromEmail" IS NULL
  AND "recipient" IS NOT NULL;

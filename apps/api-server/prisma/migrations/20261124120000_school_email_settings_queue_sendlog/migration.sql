-- ============================================================================
-- 📧 Tâche 181 — Envoi d'e-mails via le Gmail de chaque école (Phase 1)
-- Cahier des charges « Academia Helm : envoi d'e-mails via le Gmail de chaque
-- école ». 3 nouvelles tables, toutes filtrées par tenant_id.
-- ============================================================================

-- Réglages e-mail de l'école (1 ligne par école, secrets chiffrés AES-256-GCM)
CREATE TABLE "school_email_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'aucun',
    "fromName" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "replyTo" TEXT NOT NULL,
    "smtpHost" TEXT,
    "smtpPort" INTEGER DEFAULT 587,
    "smtpUser" TEXT,
    "secretEncrypted" TEXT,
    "secretIv" TEXT,
    "secretTag" TEXT,
    "status" TEXT NOT NULL DEFAULT 'non_configure',
    "lastError" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "dailyCap" INTEGER NOT NULL DEFAULT 490,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_email_settings_pkey" PRIMARY KEY ("id")
);

-- Journal des envois : une ligne PAR DESTINATAIRE (cap = COUNT sur fenêtre 24 h)
CREATE TABLE "email_send_log" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_send_log_pkey" PRIMARY KEY ("id")
);

-- File d'attente (alternative PostgreSQL à BullMQ — FOR UPDATE SKIP LOCKED)
CREATE TABLE "email_queue" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'en_attente',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_queue_pkey" PRIMARY KEY ("id")
);

-- Index : plafond 24 h glissantes + journal + file
CREATE UNIQUE INDEX "school_email_settings_tenantId_key" ON "school_email_settings"("tenantId");
CREATE INDEX "email_send_log_tenantId_createdAt_idx" ON "email_send_log"("tenantId", "createdAt");
CREATE INDEX "email_send_log_tenantId_status_idx" ON "email_send_log"("tenantId", "status");
CREATE INDEX "email_queue_tenantId_status_nextAttemptAt_idx" ON "email_queue"("tenantId", "status", "nextAttemptAt");
CREATE INDEX "email_queue_status_nextAttemptAt_idx" ON "email_queue"("status", "nextAttemptAt");
CREATE INDEX "email_queue_tenantId_createdAt_idx" ON "email_queue"("tenantId", "createdAt");

-- Clés étrangères (cascade à la suppression de l'école → secrets supprimés)
ALTER TABLE "school_email_settings" ADD CONSTRAINT "school_email_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_send_log" ADD CONSTRAINT "email_send_log_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_queue" ADD CONSTRAINT "email_queue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

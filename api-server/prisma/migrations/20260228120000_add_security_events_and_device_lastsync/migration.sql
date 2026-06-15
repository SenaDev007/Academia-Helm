-- Offline-first / SIEM : last_sync_at sur user_devices, table security_events

-- AlterTable user_devices : dernière synchronisation offline → serveur
ALTER TABLE "user_devices" ADD COLUMN IF NOT EXISTS "lastSyncAt" TIMESTAMP(3);

-- CreateTable security_events (SIEM simple : login échoués, sync anormale, etc.)
CREATE TABLE IF NOT EXISTS "security_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "ipAddress" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "security_events_tenantId_idx" ON "security_events"("tenantId");
CREATE INDEX IF NOT EXISTS "security_events_userId_idx" ON "security_events"("userId");
CREATE INDEX IF NOT EXISTS "security_events_eventType_idx" ON "security_events"("eventType");
CREATE INDEX IF NOT EXISTS "security_events_createdAt_idx" ON "security_events"("createdAt");

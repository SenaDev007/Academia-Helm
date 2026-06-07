-- ============================================================================
-- MIGRATION: OTP & Device Tracking Tables
-- ============================================================================
-- 
-- Tables pour l'authentification OTP contextuelle et le tracking des appareils
-- 
-- ============================================================================

-- ----------------------------------------------------------------------------
-- USER DEVICES - Tracking des appareils utilisateurs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "user_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "deviceHash" TEXT NOT NULL,
    "deviceName" TEXT,
    "deviceType" TEXT NOT NULL, -- 'desktop' | 'tablet' | 'mobile'
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "isTrusted" BOOLEAN NOT NULL DEFAULT false,
    "lastUsedAt" TIMESTAMP(3),
    "trustedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_devices_deviceHash_key" ON "user_devices"("deviceHash");
CREATE INDEX "user_devices_userId_idx" ON "user_devices"("userId");
CREATE INDEX "user_devices_tenantId_idx" ON "user_devices"("tenantId");
CREATE INDEX "user_devices_userId_tenantId_idx" ON "user_devices"("userId", "tenantId");
CREATE INDEX "user_devices_isTrusted_idx" ON "user_devices"("isTrusted");

-- ----------------------------------------------------------------------------
-- OTP CODES - Codes OTP pour authentification
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "otp_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "deviceId" TEXT,
    "code" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL, -- 'LOGIN' | 'DEVICE_VERIFICATION' | 'SENSITIVE_ACTION'
    "phoneNumber" TEXT NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "isExpired" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "otp_codes_userId_idx" ON "otp_codes"("userId");
CREATE INDEX "otp_codes_tenantId_idx" ON "otp_codes"("tenantId");
CREATE INDEX "otp_codes_deviceId_idx" ON "otp_codes"("deviceId");
CREATE INDEX "otp_codes_codeHash_idx" ON "otp_codes"("codeHash");
CREATE INDEX "otp_codes_expiresAt_idx" ON "otp_codes"("expiresAt");
CREATE INDEX "otp_codes_isUsed_idx" ON "otp_codes"("isUsed");
CREATE INDEX "otp_codes_userId_tenantId_idx" ON "otp_codes"("userId", "tenantId");

-- ----------------------------------------------------------------------------
-- DEVICE SESSIONS - Sessions liées aux appareils
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "device_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "device_sessions_sessionToken_key" ON "device_sessions"("sessionToken");
CREATE INDEX "device_sessions_userId_idx" ON "device_sessions"("userId");
CREATE INDEX "device_sessions_tenantId_idx" ON "device_sessions"("tenantId");
CREATE INDEX "device_sessions_deviceId_idx" ON "device_sessions"("deviceId");
CREATE INDEX "device_sessions_academicYearId_idx" ON "device_sessions"("academicYearId");
CREATE INDEX "device_sessions_isActive_idx" ON "device_sessions"("isActive");
CREATE INDEX "device_sessions_expiresAt_idx" ON "device_sessions"("expiresAt");
CREATE INDEX "device_sessions_userId_tenantId_academicYearId_idx" ON "device_sessions"("userId", "tenantId", "academicYearId");

-- ----------------------------------------------------------------------------
-- AUTH AUDIT LOGS - Logs d'audit pour l'authentification
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "auth_audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "tenantId" TEXT,
    "deviceId" TEXT,
    "sessionId" TEXT,
    "action" TEXT NOT NULL, -- 'LOGIN' | 'LOGOUT' | 'OTP_SENT' | 'OTP_VERIFIED' | 'OTP_FAILED' | 'DEVICE_TRUSTED' | 'DEVICE_REVOKED' | 'SESSION_EXPIRED' | 'CONTEXT_CHANGED'
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "status" TEXT NOT NULL, -- 'SUCCESS' | 'FAILED' | 'BLOCKED'
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auth_audit_logs_userId_idx" ON "auth_audit_logs"("userId");
CREATE INDEX "auth_audit_logs_tenantId_idx" ON "auth_audit_logs"("tenantId");
CREATE INDEX "auth_audit_logs_deviceId_idx" ON "auth_audit_logs"("deviceId");
CREATE INDEX "auth_audit_logs_sessionId_idx" ON "auth_audit_logs"("sessionId");
CREATE INDEX "auth_audit_logs_action_idx" ON "auth_audit_logs"("action");
CREATE INDEX "auth_audit_logs_status_idx" ON "auth_audit_logs"("status");
CREATE INDEX "auth_audit_logs_createdAt_idx" ON "auth_audit_logs"("createdAt");
CREATE INDEX "auth_audit_logs_userId_tenantId_idx" ON "auth_audit_logs"("userId", "tenantId");

-- ----------------------------------------------------------------------------
-- FOREIGN KEYS
-- ----------------------------------------------------------------------------
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "user_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "user_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "auth_audit_logs" ADD CONSTRAINT "auth_audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "auth_audit_logs" ADD CONSTRAINT "auth_audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "auth_audit_logs" ADD CONSTRAINT "auth_audit_logs_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "user_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "auth_audit_logs" ADD CONSTRAINT "auth_audit_logs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "device_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

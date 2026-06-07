-- CreateTable
CREATE TABLE "user_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "deviceHash" TEXT NOT NULL,
    "deviceName" TEXT,
    "deviceType" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "deviceId" TEXT,
    "code" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "device_sessions" (
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

-- CreateTable
CREATE TABLE "auth_audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "tenantId" TEXT,
    "deviceId" TEXT,
    "sessionId" TEXT,
    "action" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedagogical_materials" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "schoolLevelId" TEXT NOT NULL,
    "subjectId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedagogical_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_stocks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "schoolLevelId" TEXT NOT NULL,
    "classId" TEXT,
    "quantityTotal" INTEGER NOT NULL DEFAULT 0,
    "quantityAvailable" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_movements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "movementType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "performedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_material_assignments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "schoolLevelId" TEXT NOT NULL,
    "classId" TEXT,
    "quantity" INTEGER NOT NULL,
    "conditionAtIssue" TEXT NOT NULL,
    "signed" BOOLEAN NOT NULL DEFAULT false,
    "signedAt" TIMESTAMP(3),
    "signedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_material_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annual_teacher_supplies" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "schoolLevelId" TEXT NOT NULL,
    "classId" TEXT,
    "materialId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "annual_teacher_supplies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_devices_deviceHash_key" ON "user_devices"("deviceHash");

-- CreateIndex
CREATE INDEX "user_devices_userId_idx" ON "user_devices"("userId");

-- CreateIndex
CREATE INDEX "user_devices_tenantId_idx" ON "user_devices"("tenantId");

-- CreateIndex
CREATE INDEX "user_devices_userId_tenantId_idx" ON "user_devices"("userId", "tenantId");

-- CreateIndex
CREATE INDEX "user_devices_isTrusted_idx" ON "user_devices"("isTrusted");

-- CreateIndex
CREATE INDEX "otp_codes_userId_idx" ON "otp_codes"("userId");

-- CreateIndex
CREATE INDEX "otp_codes_tenantId_idx" ON "otp_codes"("tenantId");

-- CreateIndex
CREATE INDEX "otp_codes_deviceId_idx" ON "otp_codes"("deviceId");

-- CreateIndex
CREATE INDEX "otp_codes_codeHash_idx" ON "otp_codes"("codeHash");

-- CreateIndex
CREATE INDEX "otp_codes_expiresAt_idx" ON "otp_codes"("expiresAt");

-- CreateIndex
CREATE INDEX "otp_codes_isUsed_idx" ON "otp_codes"("isUsed");

-- CreateIndex
CREATE INDEX "otp_codes_userId_tenantId_idx" ON "otp_codes"("userId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "device_sessions_sessionToken_key" ON "device_sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "device_sessions_userId_idx" ON "device_sessions"("userId");

-- CreateIndex
CREATE INDEX "device_sessions_tenantId_idx" ON "device_sessions"("tenantId");

-- CreateIndex
CREATE INDEX "device_sessions_deviceId_idx" ON "device_sessions"("deviceId");

-- CreateIndex
CREATE INDEX "device_sessions_academicYearId_idx" ON "device_sessions"("academicYearId");

-- CreateIndex
CREATE INDEX "device_sessions_isActive_idx" ON "device_sessions"("isActive");

-- CreateIndex
CREATE INDEX "device_sessions_expiresAt_idx" ON "device_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "device_sessions_userId_tenantId_academicYearId_idx" ON "device_sessions"("userId", "tenantId", "academicYearId");

-- CreateIndex
CREATE INDEX "auth_audit_logs_userId_idx" ON "auth_audit_logs"("userId");

-- CreateIndex
CREATE INDEX "auth_audit_logs_tenantId_idx" ON "auth_audit_logs"("tenantId");

-- CreateIndex
CREATE INDEX "auth_audit_logs_deviceId_idx" ON "auth_audit_logs"("deviceId");

-- CreateIndex
CREATE INDEX "auth_audit_logs_sessionId_idx" ON "auth_audit_logs"("sessionId");

-- CreateIndex
CREATE INDEX "auth_audit_logs_action_idx" ON "auth_audit_logs"("action");

-- CreateIndex
CREATE INDEX "auth_audit_logs_status_idx" ON "auth_audit_logs"("status");

-- CreateIndex
CREATE INDEX "auth_audit_logs_createdAt_idx" ON "auth_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "auth_audit_logs_userId_tenantId_idx" ON "auth_audit_logs"("userId", "tenantId");

-- CreateIndex
CREATE INDEX "pedagogical_materials_tenantId_schoolLevelId_idx" ON "pedagogical_materials"("tenantId", "schoolLevelId");

-- CreateIndex
CREATE INDEX "pedagogical_materials_category_idx" ON "pedagogical_materials"("category");

-- CreateIndex
CREATE INDEX "pedagogical_materials_isActive_idx" ON "pedagogical_materials"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "pedagogical_materials_tenantId_code_key" ON "pedagogical_materials"("tenantId", "code");

-- CreateIndex
CREATE INDEX "material_stocks_tenantId_academicYearId_idx" ON "material_stocks"("tenantId", "academicYearId");

-- CreateIndex
CREATE INDEX "material_stocks_materialId_idx" ON "material_stocks"("materialId");

-- CreateIndex
CREATE INDEX "material_stocks_schoolLevelId_idx" ON "material_stocks"("schoolLevelId");

-- CreateIndex
CREATE UNIQUE INDEX "material_stocks_tenantId_academicYearId_materialId_schoolLe_key" ON "material_stocks"("tenantId", "academicYearId", "materialId", "schoolLevelId", "classId");

-- CreateIndex
CREATE INDEX "material_movements_tenantId_academicYearId_idx" ON "material_movements"("tenantId", "academicYearId");

-- CreateIndex
CREATE INDEX "material_movements_materialId_idx" ON "material_movements"("materialId");

-- CreateIndex
CREATE INDEX "material_movements_movementType_idx" ON "material_movements"("movementType");

-- CreateIndex
CREATE INDEX "material_movements_performedById_idx" ON "material_movements"("performedById");

-- CreateIndex
CREATE INDEX "material_movements_createdAt_idx" ON "material_movements"("createdAt");

-- CreateIndex
CREATE INDEX "teacher_material_assignments_tenantId_academicYearId_teache_idx" ON "teacher_material_assignments"("tenantId", "academicYearId", "teacherId");

-- CreateIndex
CREATE INDEX "teacher_material_assignments_materialId_idx" ON "teacher_material_assignments"("materialId");

-- CreateIndex
CREATE INDEX "teacher_material_assignments_schoolLevelId_idx" ON "teacher_material_assignments"("schoolLevelId");

-- CreateIndex
CREATE INDEX "teacher_material_assignments_signed_idx" ON "teacher_material_assignments"("signed");

-- CreateIndex
CREATE INDEX "annual_teacher_supplies_tenantId_academicYearId_teacherId_idx" ON "annual_teacher_supplies"("tenantId", "academicYearId", "teacherId");

-- CreateIndex
CREATE INDEX "annual_teacher_supplies_materialId_idx" ON "annual_teacher_supplies"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "annual_teacher_supplies_tenantId_academicYearId_teacherId_m_key" ON "annual_teacher_supplies"("tenantId", "academicYearId", "teacherId", "materialId", "classId");

-- AddForeignKey
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "user_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "user_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_audit_logs" ADD CONSTRAINT "auth_audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_audit_logs" ADD CONSTRAINT "auth_audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_audit_logs" ADD CONSTRAINT "auth_audit_logs_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "user_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_audit_logs" ADD CONSTRAINT "auth_audit_logs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "device_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedagogical_materials" ADD CONSTRAINT "pedagogical_materials_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedagogical_materials" ADD CONSTRAINT "pedagogical_materials_schoolLevelId_fkey" FOREIGN KEY ("schoolLevelId") REFERENCES "school_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedagogical_materials" ADD CONSTRAINT "pedagogical_materials_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_stocks" ADD CONSTRAINT "material_stocks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_stocks" ADD CONSTRAINT "material_stocks_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_stocks" ADD CONSTRAINT "material_stocks_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "pedagogical_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_stocks" ADD CONSTRAINT "material_stocks_schoolLevelId_fkey" FOREIGN KEY ("schoolLevelId") REFERENCES "school_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_stocks" ADD CONSTRAINT "material_stocks_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_movements" ADD CONSTRAINT "material_movements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_movements" ADD CONSTRAINT "material_movements_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_movements" ADD CONSTRAINT "material_movements_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "pedagogical_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_movements" ADD CONSTRAINT "material_movements_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_material_assignments" ADD CONSTRAINT "teacher_material_assignments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_material_assignments" ADD CONSTRAINT "teacher_material_assignments_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_material_assignments" ADD CONSTRAINT "teacher_material_assignments_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_material_assignments" ADD CONSTRAINT "teacher_material_assignments_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "pedagogical_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_material_assignments" ADD CONSTRAINT "teacher_material_assignments_schoolLevelId_fkey" FOREIGN KEY ("schoolLevelId") REFERENCES "school_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_material_assignments" ADD CONSTRAINT "teacher_material_assignments_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_material_assignments" ADD CONSTRAINT "teacher_material_assignments_signedBy_fkey" FOREIGN KEY ("signedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annual_teacher_supplies" ADD CONSTRAINT "annual_teacher_supplies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annual_teacher_supplies" ADD CONSTRAINT "annual_teacher_supplies_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annual_teacher_supplies" ADD CONSTRAINT "annual_teacher_supplies_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annual_teacher_supplies" ADD CONSTRAINT "annual_teacher_supplies_schoolLevelId_fkey" FOREIGN KEY ("schoolLevelId") REFERENCES "school_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annual_teacher_supplies" ADD CONSTRAINT "annual_teacher_supplies_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annual_teacher_supplies" ADD CONSTRAINT "annual_teacher_supplies_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "pedagogical_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

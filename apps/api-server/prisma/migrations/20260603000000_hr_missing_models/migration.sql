-- ============================================================================
-- HR MODULE - MISSING MODELS MIGRATION
-- ============================================================================

-- Leave Requests
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "schoolLevelId" TEXT,
    "staffId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "leave_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "leave_requests_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "leave_requests_schoolLevelId_fkey" FOREIGN KEY ("schoolLevelId") REFERENCES "school_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "leave_requests_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "leave_requests_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "leave_requests_tenantId_academicYearId_idx" ON "leave_requests"("tenantId", "academicYearId");
CREATE INDEX "leave_requests_staffId_idx" ON "leave_requests"("staffId");
CREATE INDEX "leave_requests_status_idx" ON "leave_requests"("status");
CREATE INDEX "leave_requests_startDate_endDate_idx" ON "leave_requests"("startDate", "endDate");

-- Allowance Types
CREATE TABLE "allowance_types" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isTaxable" BOOLEAN NOT NULL DEFAULT true,
    "isCnss" BOOLEAN NOT NULL DEFAULT false,
    "amount" DECIMAL(10,2),
    "isFixed" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allowance_types_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "allowance_types_code_key" UNIQUE ("code"),
    CONSTRAINT "allowance_types_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "allowance_types_tenantId_idx" ON "allowance_types"("tenantId");
CREATE INDEX "allowance_types_code_idx" ON "allowance_types"("code");
CREATE INDEX "allowance_types_isActive_idx" ON "allowance_types"("isActive");

-- Staff Allowances
CREATE TABLE "staff_allowances" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT,
    "schoolLevelId" TEXT,
    "staffId" TEXT NOT NULL,
    "allowanceTypeId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "endDate" DATE,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_allowances_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "staff_allowances_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "staff_allowances_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "staff_allowances_schoolLevelId_fkey" FOREIGN KEY ("schoolLevelId") REFERENCES "school_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "staff_allowances_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "staff_allowances_allowanceTypeId_fkey" FOREIGN KEY ("allowanceTypeId") REFERENCES "allowance_types"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "staff_allowances_tenantId_idx" ON "staff_allowances"("tenantId");
CREATE INDEX "staff_allowances_staffId_idx" ON "staff_allowances"("staffId");
CREATE INDEX "staff_allowances_allowanceTypeId_idx" ON "staff_allowances"("allowanceTypeId");
CREATE INDEX "staff_allowances_status_idx" ON "staff_allowances"("status");

-- Contract Amendments
CREATE TABLE "contract_amendments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "amendmentType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "effectiveDate" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_amendments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "contract_amendments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "contract_amendments_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "employment_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "contract_amendments_tenantId_idx" ON "contract_amendments"("tenantId");
CREATE INDEX "contract_amendments_contractId_idx" ON "contract_amendments"("contractId");
CREATE INDEX "contract_amendments_effectiveDate_idx" ON "contract_amendments"("effectiveDate");

-- Staff Schedules (Planning/Garde)
CREATE TABLE "staff_schedules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "schoolLevelId" TEXT,
    "staffId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "shiftType" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "role" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_schedules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "staff_schedules_staffId_dayOfWeek_shiftType_academicYearId_key" UNIQUE ("staffId", "dayOfWeek", "shiftType", "academicYearId"),
    CONSTRAINT "staff_schedules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "staff_schedules_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "staff_schedules_schoolLevelId_fkey" FOREIGN KEY ("schoolLevelId") REFERENCES "school_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "staff_schedules_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "staff_schedules_tenantId_academicYearId_idx" ON "staff_schedules"("tenantId", "academicYearId");
CREATE INDEX "staff_schedules_staffId_idx" ON "staff_schedules"("staffId");
CREATE INDEX "staff_schedules_dayOfWeek_idx" ON "staff_schedules"("dayOfWeek");
CREATE INDEX "staff_schedules_isActive_idx" ON "staff_schedules"("isActive");

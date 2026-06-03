-- ============================================================================
-- HR MODULE - PAYROLL PERIOD, PAYROLL RATE, ONE-TIME BONUS
-- ============================================================================

-- Payroll Periods
CREATE TABLE "payroll_periods" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "schoolLevelId" TEXT,
    "name" TEXT NOT NULL,
    "periodType" TEXT NOT NULL DEFAULT 'MONTHLY',
    "month" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closedBy" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payroll_periods_tenantId_academicYearId_month_key" UNIQUE ("tenantId", "academicYearId", "month"),
    CONSTRAINT "payroll_periods_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payroll_periods_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "payroll_periods_schoolLevelId_fkey" FOREIGN KEY ("schoolLevelId") REFERENCES "school_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "payroll_periods_closedBy_fkey" FOREIGN KEY ("closedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "payroll_periods_tenantId_academicYearId_idx" ON "payroll_periods"("tenantId", "academicYearId");
CREATE INDEX "payroll_periods_status_idx" ON "payroll_periods"("status");
CREATE INDEX "payroll_periods_startDate_endDate_idx" ON "payroll_periods"("startDate", "endDate");

-- Payroll Rates
CREATE TABLE "payroll_rates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'BJ',
    "roleType" TEXT NOT NULL,
    "grade" TEXT,
    "monthlyBaseSalary" DECIMAL(10,2) NOT NULL,
    "hourlyRate" DECIMAL(10,2) NOT NULL,
    "overtimeMultiplier" DECIMAL(5,2) NOT NULL DEFAULT 1.50,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_rates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payroll_rates_tenantId_countryCode_roleType_grade_effectiveFrom_key" UNIQUE ("tenantId", "countryCode", "roleType", "grade", "effectiveFrom"),
    CONSTRAINT "payroll_rates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "payroll_rates_tenantId_countryCode_idx" ON "payroll_rates"("tenantId", "countryCode");
CREATE INDEX "payroll_rates_roleType_idx" ON "payroll_rates"("roleType");
CREATE INDEX "payroll_rates_effectiveFrom_effectiveTo_idx" ON "payroll_rates"("effectiveFrom", "effectiveTo");
CREATE INDEX "payroll_rates_isActive_idx" ON "payroll_rates"("isActive");

-- One-Time Bonuses
CREATE TABLE "one_time_bonuses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "schoolLevelId" TEXT,
    "staffId" TEXT NOT NULL,
    "payrollItemId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "bonusType" TEXT NOT NULL DEFAULT 'OTHER',
    "authorizedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "one_time_bonuses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "one_time_bonuses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "one_time_bonuses_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "one_time_bonuses_schoolLevelId_fkey" FOREIGN KEY ("schoolLevelId") REFERENCES "school_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "one_time_bonuses_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "one_time_bonuses_payrollItemId_fkey" FOREIGN KEY ("payrollItemId") REFERENCES "payroll_items"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "one_time_bonuses_authorizedBy_fkey" FOREIGN KEY ("authorizedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "one_time_bonuses_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "one_time_bonuses_tenantId_academicYearId_idx" ON "one_time_bonuses"("tenantId", "academicYearId");
CREATE INDEX "one_time_bonuses_staffId_idx" ON "one_time_bonuses"("staffId");
CREATE INDEX "one_time_bonuses_status_idx" ON "one_time_bonuses"("status");
CREATE INDEX "one_time_bonuses_bonusType_idx" ON "one_time_bonuses"("bonusType");

-- Add payrollPeriodId to existing payrolls table
ALTER TABLE "payrolls" ADD COLUMN "payrollPeriodId" TEXT;
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "payroll_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "payrolls_payrollPeriodId_idx" ON "payrolls"("payrollPeriodId");

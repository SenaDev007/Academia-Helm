-- CreateTable
CREATE TABLE IF NOT EXISTS "tax_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT,
    "cnssFamilialesRate" DOUBLE PRECISION NOT NULL DEFAULT 9.0,
    "cnssRisquesRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "cnssVieillesseRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "cnssPatronaleRate" DOUBLE PRECISION NOT NULL DEFAULT 6.4,
    "cnssOuvriereRate" DOUBLE PRECISION NOT NULL DEFAULT 3.6,
    "istVpsRate" DOUBLE PRECISION NOT NULL DEFAULT 4.0,
    "istIrppRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "aibAchatsRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "aibPrestationsRate" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "istFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "cnssFrequency" TEXT NOT NULL DEFAULT 'QUARTERLY',
    "aibFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tax_settings_tenantId_key" ON "tax_settings"("tenantId");

-- AddForeignKey
ALTER TABLE "tax_settings" ADD CONSTRAINT "tax_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE IF NOT EXISTS "financial_statements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "lineCode" TEXT NOT NULL,
    "lineLabel" TEXT NOT NULL,
    "note" TEXT,
    "amountN" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "amountN1" DECIMAL(18,2),
    "category" TEXT,
    "isSubtotal" BOOLEAN NOT NULL DEFAULT false,
    "isTotal" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_statements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "financial_statements_tenantId_academicYearId_type_lineCode_key" ON "financial_statements"("tenantId", "academicYearId", "type", "lineCode");
CREATE INDEX IF NOT EXISTS "financial_statements_tenantId_academicYearId_type_idx" ON "financial_statements"("tenantId", "academicYearId", "type");

-- AddForeignKey
ALTER TABLE "financial_statements" ADD CONSTRAINT "financial_statements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE IF NOT EXISTS "financial_notes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "noteCode" TEXT NOT NULL,
    "noteTitle" TEXT NOT NULL,
    "lineLabel" TEXT NOT NULL,
    "amountN" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "amountN1" DECIMAL(18,2),
    "metadata" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "financial_notes_tenantId_academicYearId_noteCode_idx" ON "financial_notes"("tenantId", "academicYearId", "noteCode");

-- AddForeignKey
ALTER TABLE "financial_notes" ADD CONSTRAINT "financial_notes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE IF NOT EXISTS "tax_declarations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "data" JSONB NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_declarations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tax_declarations_tenantId_academicYearId_type_period_key" ON "tax_declarations"("tenantId", "academicYearId", "type", "period");
CREATE INDEX IF NOT EXISTS "tax_declarations_tenantId_academicYearId_type_idx" ON "tax_declarations"("tenantId", "academicYearId", "type");

-- AddForeignKey
ALTER TABLE "tax_declarations" ADD CONSTRAINT "tax_declarations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
